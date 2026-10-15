$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root ".codex-logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root ".npm-cache"), (Join-Path $Root ".npm-global") | Out-Null
$env:npm_config_cache = Join-Path $Root ".npm-cache"
$env:npm_config_prefix = Join-Path $Root ".npm-global"

function Get-ListeningPid {
  param([int]$Port)
  $Line = netstat -ano | Select-String "LISTENING" | Select-String ":$Port\s" | Select-Object -First 1
  if (-not $Line) { return $null }
  $Parts = ($Line.ToString() -split "\s+") | Where-Object { $_ }
  if ($Parts.Length -ge 5) { return [int]$Parts[4] }
  return $null
}

function Start-LoggedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [string]$OutLog,
    [string]$ErrLog,
    [string]$WorkingDirectory = $Root
  )

  if (Test-Path -LiteralPath $OutLog) { Remove-Item -LiteralPath $OutLog -Force }
  if (Test-Path -LiteralPath $ErrLog) { Remove-Item -LiteralPath $ErrLog -Force }

  Start-Process -FilePath $FilePath `
    -WorkingDirectory $WorkingDirectory `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $OutLog `
    -RedirectStandardError $ErrLog `
    -ArgumentList $ArgumentList
}

$BackendPid = Get-ListeningPid -Port 3000
if (-not $BackendPid) {
  $Backend = Start-LoggedProcess -FilePath "npm.cmd" -ArgumentList @("run", "backend:start") -OutLog (Join-Path $LogDir "backend-public.out.log") -ErrLog (Join-Path $LogDir "backend-public.err.log")
  $BackendPid = $Backend.Id
}

$FrontendPid = Get-ListeningPid -Port 5173
if (-not $FrontendPid) {
  $Frontend = Start-LoggedProcess -FilePath "npm.cmd" -ArgumentList @("run", "frontend:dev") -OutLog (Join-Path $LogDir "frontend-public.out.log") -ErrLog (Join-Path $LogDir "frontend-public.err.log")
  $FrontendPid = $Frontend.Id
}

Start-Sleep -Seconds 6
$Tunnel = Start-LoggedProcess -FilePath "npx.cmd" -ArgumentList @("--yes", "localtunnel", "--port", "5173", "--local-host", "localhost") -OutLog (Join-Path $LogDir "localtunnel-public.out.log") -ErrLog (Join-Path $LogDir "localtunnel-public.err.log")

$PidInfo = [pscustomobject]@{
  backendPid = $BackendPid
  frontendPid = $FrontendPid
  tunnelPid = $Tunnel.Id
  tunnel = "localtunnel"
  startedAt = (Get-Date).ToString("s")
}
$Json = $PidInfo | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText((Join-Path $LogDir "public-stack-pids.json"), $Json, (New-Object System.Text.UTF8Encoding($false)))