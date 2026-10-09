# Start the CWS AI Project Radar locally: http://localhost:8765
# Small web server without installation (PowerShell only). It serves index.html and request.html,
# is only reachable on this computer (localhost) and sends nothing to the internet.
# Stop: Ctrl+C in the terminal or close the window.

$ErrorActionPreference = 'Stop'
$port   = 8765
$root   = [IO.Path]::GetFullPath($PSScriptRoot)
$public = @('index.html', 'request.html')
$prefix = "http://localhost:$port/"

# Prefer the database server (Node). Every browser on this computer then shares one register.
if (Get-Command node -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "  Starting the shared database on this computer ..." -ForegroundColor Green
    Start-Process $prefix
    & node (Join-Path $PSScriptRoot 'server\server.mjs')
    exit $LASTEXITCODE
}
Write-Host "Node.js was not found. Starting without the shared database (data stays in this browser)." -ForegroundColor Yellow

if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') {
    Write-Host "PowerShell runs in constrained language mode here (company policy). The mini server cannot start this way." -ForegroundColor Red
    exit 2
}

try {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
} catch {
    if ($_.Exception.Message -match 'in use|verwendet|conflicts|Konflikt|183|32') {
        Write-Host "Port $port is already in use. Is the radar already running? Opening $prefix in the browser." -ForegroundColor Yellow
        Start-Process $prefix
        exit 0
    }
    Write-Host "Server could not start: $($_.Exception.Message)" -ForegroundColor Red
    exit 3
}

Write-Host ""
Write-Host "  CWS AI Project Radar is running at $prefix" -ForegroundColor Green
Write-Host "  Only reachable on this computer. Stop with Ctrl+C." -ForegroundColor DarkGray
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
        # Wait asynchronously so Ctrl+C works at any time
        $task = $listener.GetContextAsync()
        while (-not $task.AsyncWaitHandle.WaitOne(250)) { }
        $ctx = $task.GetAwaiter().GetResult()
        $res = $ctx.Response
        try {
            $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
            if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
            if ($public -contains "$rel.html") { $rel = "$rel.html" }   # /request works like on Vercel
            $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
            $res.Headers['Cache-Control'] = 'no-store'
            if (($public -contains $rel) -and $file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
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
