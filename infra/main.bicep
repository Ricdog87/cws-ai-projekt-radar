// CWS KI-Projekt-Radar on Azure App Service (Linux, Node.js 22 LTS) with a staging deployment slot.
//
// Release flow (see docs/azure-app-service.md):
//   1. GitHub Actions deploys the package to the "staging" slot (its own database).
//   2. Smoke test against https://<app>-staging.azurewebsites.net/api/ready.
//   3. Approval, then slot swap. App Service warms the new code up against the production
//      settings first (WEBSITE_SWAP_WARMUP_PING_PATH) and only swaps when /api/ready answers 200.
//   4. Rollback = swap again.
//
// Deploy:
//   az deployment group create -g <resource-group> -f infra/main.bicep -p infra/main.parameters.json \
//     -p postgresAdminPassword=<secret> radarUsers='<JSON, see docs>'
//
// Secrets never go into this file or the parameter file. They are passed at deploy time and
// stored in Key Vault; the app reads them through Key Vault references with its managed identity.

targetScope = 'resourceGroup'

@description('Name of the web app. Becomes <name>.azurewebsites.net, so it must be globally unique.')
@minLength(2)
@maxLength(50)
param appName string

@description('Azure region. Germany West Central (Frankfurt) keeps all data in Germany.')
param location string = resourceGroup().location

@description('App Service plan. Deployment slots need Standard or Premium; Basic and Free have none.')
@allowed([ 'S1', 'S2', 'S3', 'P0v3', 'P1v3', 'P2v3', 'P1mv3' ])
param planSku string = 'P0v3'

@description('Instances of the plan. With 2 or more, the health check takes an unhealthy instance out of rotation.')
@minValue(1)
@maxValue(10)
param instanceCount int = 1

@description('Create Azure Database for PostgreSQL Flexible Server (databases "radar" and "radar_staging"). false = use an existing database via externalDatabaseUrl.')
param deployPostgres bool = true

@description('Administrator login of the PostgreSQL server.')
param postgresAdminLogin string = 'radaradmin'

@description('Administrator password of the PostgreSQL server (only when deployPostgres = true).')
@secure()
param postgresAdminPassword string = ''

@description('PostgreSQL compute size. Standard_B1ms (Burstable) is enough for a team of up to ~50 people.')
param postgresSku string = 'Standard_B1ms'

@description('Backup retention of the database in days (7 to 35).')
@minValue(7)
@maxValue(35)
param postgresBackupDays int = 14

@description('Connection string of an existing production database (only when deployPostgres = false).')
@secure()
param externalDatabaseUrl string = ''

@description('Connection string of an existing staging database (only when deployPostgres = false). Never the production database.')
@secure()
param externalStagingDatabaseUrl string = ''

@description('Private network: VNet integration for the app and a PostgreSQL server without public access. false = public endpoint with the firewall rule "Azure services only".')
param privateNetwork bool = true

@description('Address space of the VNet (only with privateNetwork). Must not overlap with CWS networks if it is peered later.')
param vnetAddressPrefix string = '10.40.0.0/24'

@description('Subnet for the App Service VNet integration (at least /27).')
param appSubnetPrefix string = '10.40.0.0/26'

@description('Subnet delegated to PostgreSQL Flexible Server.')
param postgresSubnetPrefix string = '10.40.0.64/28'

@description('First accounts as JSON: [{"id":"…","name":"…","role":"…","code":"…","admin":true}]. They sign in with these codes until an admin issues new ones in the app; after that it can stay empty.')
@secure()
param radarUsers string = ''

@description('Application Insights and Log Analytics for logs, requests and availability.')
param monitoring bool = true

@description('E-mail for alerts when the plan runs above 90 % CPU or memory (deployments can then fail; scale out before releasing). Empty = no alerts.')
param alertEmail string = ''

@description('GitHub repository (owner/name) allowed to deploy via OpenID Connect, e.g. "Ricdog87/cws-ai-projekt-radar". Empty = no deployment identity is created.')
param githubRepository string = ''

@description('Tags on every resource.')
param tags object = {
  app: 'cws-ki-projekt-radar'
}

var suffix = uniqueString(resourceGroup().id, appName)
var planName = 'asp-${appName}'
var pgName = 'psql-${appName}-${take(suffix, 6)}'
var kvName = take('kv${replace(appName, '-', '')}${suffix}', 24)
var stickySettings = [ 'DATABASE_URL', 'RADAR_USERS', 'RADAR_SECRET', 'RADAR_SLOT' ]
var keyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var websiteContributor = 'de139f84-1756-47ae-9be6-808fbbe84772'

// App setting that App Service resolves from Key Vault with the identity of the slot.
func kvRef(vault string, secret string) string => '@Microsoft.KeyVault(VaultName=${vault};SecretName=${secret})'

/* ---------------- monitoring ---------------- */
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = if (monitoring) {
  name: 'log-${appName}'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = if (monitoring) {
  name: 'appi-${appName}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'Node.JS'
    WorkspaceResourceId: logs.id
    DisableLocalAuth: false
  }
}

/* ---------------- network ---------------- */
resource vnet 'Microsoft.Network/virtualNetworks@2024-01-01' = if (privateNetwork) {
  name: 'vnet-${appName}'
  location: location
  tags: tags
  properties: {
    addressSpace: { addressPrefixes: [ vnetAddressPrefix ] }
    subnets: [
      {
        name: 'snet-app'
        properties: {
          addressPrefix: appSubnetPrefix
          delegations: [ { name: 'web', properties: { serviceName: 'Microsoft.Web/serverFarms' } } ]
        }
      }
      {
        name: 'snet-postgres'
        properties: {
          addressPrefix: postgresSubnetPrefix
          delegations: [ { name: 'postgres', properties: { serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers' } } ]
        }
      }
    ]
  }
}

resource pgDns 'Microsoft.Network/privateDnsZones@2020-06-01' = if (privateNetwork && deployPostgres) {
  name: '${pgName}.private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource pgDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = if (privateNetwork && deployPostgres) {
  parent: pgDns
  name: 'link-${appName}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: { id: vnet.id }
  }
}

/* ---------------- database ---------------- */
resource pg 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = if (deployPostgres) {
  name: pgName
  location: location
  tags: tags
  sku: {
    name: postgresSku
    tier: startsWith(postgresSku, 'Standard_B') ? 'Burstable' : 'GeneralPurpose'
  }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: postgresBackupDays, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    network: privateNetwork ? {
      delegatedSubnetResourceId: '${vnet.id}/subnets/snet-postgres'
      privateDnsZoneArmResourceId: pgDns.id
      publicNetworkAccess: 'Disabled'
    } : {
      publicNetworkAccess: 'Enabled'
    }
  }
  dependsOn: [ pgDnsLink ]
}

resource pgAzureOnly 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = if (deployPostgres && !privateNetwork) {
  parent: pg
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

resource dbProduction 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = if (deployPostgres) {
  parent: pg
  name: 'radar'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
  dependsOn: [ pgAzureOnly ] // one change at a time on the server
}

resource dbStaging 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = if (deployPostgres) {
  parent: pg
  name: 'radar_staging'
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
  dependsOn: [ dbProduction ]
}

/* ---------------- secrets ---------------- */
var pgBase = deployPostgres ? 'postgres://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${pg.properties.fullyQualifiedDomainName}:5432' : ''

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

resource secretDbProduction 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: { value: deployPostgres ? '${pgBase}/radar?sslmode=require' : externalDatabaseUrl }
  dependsOn: [ dbProduction ]
}

resource secretDbStaging 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url-staging'
  properties: { value: deployPostgres ? '${pgBase}/radar_staging?sslmode=require' : externalStagingDatabaseUrl }
  dependsOn: [ dbStaging ]
}

resource secretUsers 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (!empty(radarUsers)) {
  parent: vault
  name: 'radar-users'
  properties: { value: radarUsers }
}

/* ---------------- app service ---------------- */
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: planName
  location: location
  tags: tags
  kind: 'linux'
  sku: { name: planSku, capacity: instanceCount }
  properties: { reserved: true }
}

var commonSettings = concat([
  { name: 'WEBSITE_RUN_FROM_PACKAGE', value: '1' }
  { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'false' }
  { name: 'WEBSITE_SWAP_WARMUP_PING_PATH', value: '/api/ready' }
  { name: 'WEBSITE_SWAP_WARMUP_PING_STATUSES', value: '200' }
  { name: 'NODE_ENV', value: 'production' }
], monitoring ? [
  { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
  { name: 'ApplicationInsightsAgent_EXTENSION_VERSION', value: '~3' }
] : [], empty(radarUsers) ? [] : [
  { name: 'RADAR_USERS', value: kvRef(kvName, 'radar-users') }
])

var siteConfig = {
  linuxFxVersion: 'NODE|22-lts'
  appCommandLine: 'node server/azure.mjs'
  alwaysOn: true
  http20Enabled: true
  minTlsVersion: '1.2'
  scmMinTlsVersion: '1.2'
  ftpsState: 'Disabled'
  healthCheckPath: '/api/ready'
  remoteDebuggingEnabled: false
  webSocketsEnabled: false
  vnetRouteAllEnabled: privateNetwork
}

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: appName
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    virtualNetworkSubnetId: privateNetwork ? '${vnet.id}/subnets/snet-app' : null
    siteConfig: union(siteConfig, {
      appSettings: concat(commonSettings, [
        { name: 'DATABASE_URL', value: kvRef(kvName, 'database-url') }
        { name: 'RADAR_SLOT', value: 'production' }
      ])
    })
  }
}

resource staging 'Microsoft.Web/sites/slots@2023-12-01' = {
  parent: site
  name: 'staging'
  location: location
  tags: tags
  kind: 'app,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    clientAffinityEnabled: false
    virtualNetworkSubnetId: privateNetwork ? '${vnet.id}/subnets/snet-app' : null
    siteConfig: union(siteConfig, {
      appSettings: concat(commonSettings, [
        { name: 'DATABASE_URL', value: kvRef(kvName, 'database-url-staging') }
        { name: 'RADAR_SLOT', value: 'staging' }
      ])
    })
  }
}

// Settings that belong to the slot, not to the code: they stay put when the slots are swapped.
resource sticky 'Microsoft.Web/sites/config@2023-12-01' = {
  parent: site
  name: 'slotConfigNames'
  properties: { appSettingNames: stickySettings }
}

// Deploy with Microsoft Entra ID only: no FTP, no publishing passwords.
resource noFtp 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: site
  name: 'ftp'
  properties: { allow: false }
}

resource noScmPassword 'Microsoft.Web/sites/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: site
  name: 'scm'
  properties: { allow: false }
}

resource stagingNoFtp 'Microsoft.Web/sites/slots/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: staging
  name: 'ftp'
  properties: { allow: false }
}

resource stagingNoScmPassword 'Microsoft.Web/sites/slots/basicPublishingCredentialsPolicies@2023-12-01' = {
  parent: staging
  name: 'scm'
  properties: { allow: false }
}

// Both slots read their secrets from Key Vault with their own identity.
resource siteReadsSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, site.id, keyVaultSecretsUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: site.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource stagingReadsSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, staging.id, keyVaultSecretsUser)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUser)
    principalId: staging.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource siteLogs 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = if (monitoring) {
  scope: site
  name: 'logs'
  properties: {
    workspaceId: logs.id
    logs: [
      { category: 'AppServiceConsoleLogs', enabled: true }
      { category: 'AppServiceHTTPLogs', enabled: true }
      { category: 'AppServicePlatformLogs', enabled: true }
    ]
    metrics: [ { category: 'AllMetrics', enabled: true } ]
  }
}

// Above 90 % CPU or memory a deployment may not get through: alert, so IT can scale out first.
resource alertGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(alertEmail)) {
  name: 'ag-${appName}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'radar'
    enabled: true
    emailReceivers: [ { name: 'it', emailAddress: alertEmail, useCommonAlertSchema: true } ]
  }
}

resource planBusy 'Microsoft.Insights/metricAlerts@2018-03-01' = [for m in [ 'CpuPercentage', 'MemoryPercentage' ]: if (!empty(alertEmail)) {
  name: 'alert-${appName}-${toLower(replace(m, 'Percentage', ''))}'
  location: 'global'
  tags: tags
  properties: {
    description: '${m} of the App Service plan above 90 % for 15 minutes. Scale out before the next release.'
    severity: 2
    enabled: true
    scopes: [ plan.id ]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: m
          criterionType: 'StaticThresholdCriterion'
          metricName: m
          metricNamespace: 'Microsoft.Web/serverfarms'
          operator: 'GreaterThan'
          threshold: 90
          timeAggregation: 'Average'
        }
      ]
    }
    actions: [ { actionGroupId: alertGroup.id } ]
  }
}]

/* ---------------- deployment identity for GitHub Actions (OpenID Connect, no stored password) ---------------- */
resource deployer 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = if (!empty(githubRepository)) {
  name: 'id-${appName}-deploy'
  location: location
  tags: tags
}

resource deployFromStaging 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (!empty(githubRepository)) {
  parent: deployer
  name: 'github-staging'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:environment:staging'
    audiences: [ 'api://AzureADTokenExchange' ]
  }
}

resource deployFromProduction 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = if (!empty(githubRepository)) {
  parent: deployer
  name: 'github-production'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepository}:environment:production'
    audiences: [ 'api://AzureADTokenExchange' ]
  }
  dependsOn: [ deployFromStaging ] // federated credentials of one identity cannot be written in parallel
}

resource deployerManagesSite 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(githubRepository)) {
  scope: site
  name: guid(site.id, githubRepository, websiteContributor)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', websiteContributor)
    principalId: deployer.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

/* ---------------- outputs ---------------- */
output productionUrl string = 'https://${site.properties.defaultHostName}'
output stagingUrl string = 'https://${staging.properties.defaultHostName}'
output webAppName string = site.name
output keyVaultName string = vault.name
output postgresHost string = deployPostgres ? pg.properties.fullyQualifiedDomainName : ''
output githubClientId string = empty(githubRepository) ? '' : deployer.properties.clientId
output githubTenantId string = subscription().tenantId
output githubSubscriptionId string = subscription().subscriptionId
