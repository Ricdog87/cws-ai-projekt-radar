# CWS AI Projekt-Radar lokal starten: http://localhost:8765
# Kleiner Webserver ohne Installation (nur PowerShell). Er liefert den Ordner "app" aus,
# ist nur auf diesem Rechner erreichbar (localhost) und sendet nichts ins Internet.
# Beenden: Strg+C im Terminal oder Fenster schließen.

$ErrorActionPreference = 'Stop'
$port   = 8765
$root   = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))
$prefix = "http://localhost:$port/"

if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') {
    Write-Host "PowerShell läuft hier im eingeschränkten Modus (Firmenrichtlinie). Der Mini-Server kann so nicht starten." -ForegroundColor Red
    exit 2
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
} catch {
    if ($_.Exception.Message -match 'in use|verwendet|conflicts|Konflikt|183|32') {
        Write-Host "Port $port ist schon belegt. Läuft das Radar bereits? Ich öffne $prefix im Browser." -ForegroundColor Yellow
        Start-Process $prefix
        exit 0
    }
    Write-Host "Server konnte nicht starten: $($_.Exception.Message)" -ForegroundColor Red
    exit 3
}

Write-Host ""
Write-Host "  CWS AI Projekt-Radar läuft auf $prefix" -ForegroundColor Green
Write-Host "  Nur lokal erreichbar. Beenden mit Strg+C." -ForegroundColor DarkGray
Write-Host ""
Start-Process $prefix

$types = @{
    '.html'  = 'text/html; charset=utf-8'
    '.js'    = 'text/javascript; charset=utf-8'
    '.css'   = 'text/css; charset=utf-8'
    '.json'  = 'application/json; charset=utf-8'
    '.png'   = 'image/png'
    '.svg'   = 'image/svg+xml'
    '.ico'   = 'image/x-icon'
    '.woff2' = 'font/woff2'
}

try {
    while ($listener.IsListening) {
        # Asynchron warten, damit Strg+C jederzeit greift
        $task = $listener.GetContextAsync()
        while (-not $task.AsyncWaitHandle.WaitOne(250)) { }
        $ctx = $task.GetAwaiter().GetResult()
        $res = $ctx.Response
        try {
            $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
            $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
            $res.Headers['Cache-Control'] = 'no-store'
            if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
                $bytes = [IO.File]::ReadAllBytes($file)
                $ext = [IO.Path]::GetExtension($file).ToLower()
                $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $res.StatusCode = 404
            }
        } finally {
            $res.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
