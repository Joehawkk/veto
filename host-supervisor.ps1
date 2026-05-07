$ErrorActionPreference = 'Continue'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $RepoRoot '.codex-run'
$HostDir = Join-Path $RepoRoot '.host'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$BackendDir = Join-Path $RepoRoot 'backend'
$StopFlag = Join-Path $RunDir 'stop.flag'
$PublicUrlFile = Join-Path $RunDir 'public-url.txt'
$SupervisorLog = Join-Path $RunDir 'supervisor.log'

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $HostDir | Out-Null

function Write-Log([string]$Message) {
  $line = "$(Get-Date -Format s) $Message"
  Add-Content -Path $SupervisorLog -Value $line
}

function Read-Pid([string]$Name) {
  $path = Join-Path $RunDir "$Name.pid"
  if (-not (Test-Path $path)) { return $null }
  $raw = Get-Content $path -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($raw -match '^\d+$') { return [int]$raw }
  return $null
}

function Write-Pid([string]$Name, [int]$ProcessId) {
  Set-Content -Path (Join-Path $RunDir "$Name.pid") -Value $ProcessId -NoNewline
}

function Remove-Pid([string]$Name) {
  $path = Join-Path $RunDir "$Name.pid"
  if (Test-Path $path) {
    Remove-Item $path -Force
  }
}

function Test-Alive([int]$ProcessId) {
  if (-not $ProcessId) { return $false }
  return [bool](Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Get-PortProcessId([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($conn) { return [int]$conn.OwningProcess }
  return $null
}

function Wait-ForPort([int]$Port, [int]$TimeoutSeconds = 20) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Get-PortProcessId $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Start-Backend {
  $path = Join-Path $HostDir 'backend.exe'
  $stdout = Join-Path $RunDir 'backend.out.log'
  $stderr = Join-Path $RunDir 'backend.err.log'
  $process = Start-Process `
    -FilePath $path `
    -WorkingDirectory $BackendDir `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru
  if (Wait-ForPort 8080) {
    Write-Pid 'backend' (Get-PortProcessId 8080)
    Write-Log "backend started pid=$($process.Id)"
  } else {
    Write-Pid 'backend' $process.Id
    Write-Log "backend started without port confirmation pid=$($process.Id)"
  }
}

function Start-Frontend {
  $script = Join-Path $HostDir 'frontend-host.cjs'
  $stdout = Join-Path $RunDir 'frontend.out.log'
  $stderr = Join-Path $RunDir 'frontend.err.log'
  $process = Start-Process `
    -FilePath 'node.exe' `
    -ArgumentList @($script) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru
  if (Wait-ForPort 5173) {
    Write-Pid 'frontend' (Get-PortProcessId 5173)
    Write-Log "frontend started pid=$($process.Id)"
  } else {
    Write-Pid 'frontend' $process.Id
    Write-Log "frontend started without port confirmation pid=$($process.Id)"
  }
}

function Update-TunnelUrl {
  foreach ($logName in @('tunnel.out.log', 'tunnel.err.log')) {
    $logPath = Join-Path $RunDir $logName
    if (-not (Test-Path $logPath)) { continue }
    $content = Get-Content $logPath -Raw -ErrorAction SilentlyContinue
    if ([string]::IsNullOrWhiteSpace($content)) { continue }
    # cloudflared prints: https://xxx.trycloudflare.com
    $m = [regex]::Match($content, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) {
      Set-Content -Path $PublicUrlFile -Value $m.Value -NoNewline
      return
    }
  }
}

function Start-Tunnel {
  $cfExe = Join-Path $HostDir 'cloudflared.exe'
  $stdout = Join-Path $RunDir 'tunnel.out.log'
  $stderr = Join-Path $RunDir 'tunnel.err.log'
  $process = Start-Process `
    -FilePath $cfExe `
    -ArgumentList @('tunnel', '--url', 'http://localhost:5173', '--no-autoupdate') `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr `
    -WindowStyle Hidden `
    -PassThru
  Write-Pid 'tunnel' $process.Id
  Write-Log "cloudflared tunnel started pid=$($process.Id)"
}

function Stop-Managed([string]$Name) {
  $processId = Read-Pid $Name
  if (Test-Alive $processId) {
    Stop-Process -Id $processId -Force
  }
  Remove-Pid $Name
}

function Ensure-Backend {
  $processId = Read-Pid 'backend'
  $portProcessId = Get-PortProcessId 8080

  if ((-not $processId) -and $portProcessId) {
    Write-Pid 'backend' $portProcessId
    return
  }

  if ((-not (Test-Alive $processId)) -or (-not $portProcessId)) {
    Stop-Managed 'backend'
    Start-Backend
  }
}

function Ensure-Frontend {
  $processId = Read-Pid 'frontend'
  $portProcessId = Get-PortProcessId 5173

  if ((-not $processId) -and $portProcessId) {
    Write-Pid 'frontend' $portProcessId
    return
  }

  if ((-not (Test-Alive $processId)) -or (-not $portProcessId)) {
    Stop-Managed 'frontend'
    Start-Frontend
  }
}

function Ensure-Tunnel {
  $processId = Read-Pid 'tunnel'
  if (-not (Test-Alive $processId)) {
    Stop-Managed 'tunnel'
    Start-Tunnel
  }
  Update-TunnelUrl
}

function Stop-All {
  Stop-Managed 'tunnel'
  Stop-Managed 'frontend'
  Stop-Managed 'backend'
}

Write-Log 'supervisor boot'

try {
  while (-not (Test-Path $StopFlag)) {
    try {
      Ensure-Backend
      Ensure-Frontend
      Ensure-Tunnel
    } catch {
      Write-Log "loop error: $($_.Exception.Message)"
    }
    Start-Sleep -Seconds 5
  }
} finally {
  Write-Log 'supervisor shutdown'
  Stop-All
}
