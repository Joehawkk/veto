param(
  [ValidateSet('start', 'stop', 'restart', 'status', 'install-autostart', 'remove-autostart', 'prepare')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $RepoRoot '.codex-run'
$HostDir = Join-Path $RepoRoot '.host'
$FrontendDir = Join-Path $RepoRoot 'frontend'
$BackendDir = Join-Path $RepoRoot 'backend'
$SupervisorScript = Join-Path $RepoRoot 'host-supervisor.ps1'
$SupervisorPidFile = Join-Path $RunDir 'supervisor.pid'
$StopFlag = Join-Path $RunDir 'stop.flag'
$PublicUrlFile = Join-Path $RunDir 'public-url.txt'
$StartupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$StartupCmd = Join-Path $StartupDir 'VetoHost.cmd'

New-Item -ItemType Directory -Force -Path $RunDir | Out-Null
New-Item -ItemType Directory -Force -Path $HostDir | Out-Null

function Get-LocalHostIP {
  $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.InterfaceAlias -notmatch 'vEthernet|WSL|Hyper-V|Loopback|v2ray'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $ip) {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
      Select-Object -First 1 -ExpandProperty IPAddress
  }

  return $ip
}

function Get-PortProcessId([int]$Port) {
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if ($conn) {
    return [int]$conn.OwningProcess
  }
  return $null
}

function Test-ProcessAlive([int]$ProcessId) {
  if (-not $ProcessId) { return $false }
  return [bool](Get-Process -Id $ProcessId -ErrorAction SilentlyContinue)
}

function Read-ProcessId([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  $raw = (Get-Content $Path -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($raw -match '^\d+$') { return [int]$raw }
  return $null
}

function Stop-ByPath([string]$Path) {
  $processId = Read-ProcessId $Path
  if (Test-ProcessAlive $processId) {
    Stop-Process -Id $processId -Force
  }
  if (Test-Path $Path) {
    Remove-Item $Path -Force
  }
}

function Stop-TunnelProcesses {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq 'cloudflared.exe' } |
    ForEach-Object {
      try { Stop-Process -Id $_.ProcessId -Force } catch {}
    }
}

function Stop-PortProcess([int]$Port) {
  $processId = Get-PortProcessId $Port
  if (Test-ProcessAlive $processId) {
    Stop-Process -Id $processId -Force
  }
}

function Stop-AllChildren {
  Stop-ByPath (Join-Path $RunDir 'backend.pid')
  Stop-ByPath (Join-Path $RunDir 'frontend.pid')
  Stop-ByPath (Join-Path $RunDir 'tunnel.pid')
  Stop-PortProcess 5173
  Stop-PortProcess 8080
  Stop-TunnelProcesses
}

function Invoke-Prepare {
  # Ensure cloudflared.exe
  $cfExe = Join-Path $HostDir 'cloudflared.exe'
  if (-not (Test-Path $cfExe)) {
    Write-Output 'Скачиваем cloudflared...'
    $cfUrl = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe'
    try {
      Invoke-WebRequest -Uri $cfUrl -OutFile $cfExe -UseBasicParsing
      Write-Output 'cloudflared загружен.'
    } catch {
      throw "Не удалось скачать cloudflared: $($_.Exception.Message)"
    }
  }

  Write-Output 'Building backend binary...'
  Push-Location $BackendDir
  try {
    & go build -o (Join-Path $HostDir 'backend.exe') .
    if ($LASTEXITCODE -ne 0) { throw 'Backend build failed' }
  } finally {
    Pop-Location
  }

  Write-Output 'Building frontend assets...'
  Push-Location $FrontendDir
  try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
  } finally {
    Pop-Location
  }
}

function Start-Supervisor {
  if (Test-Path $StopFlag) {
    Remove-Item $StopFlag -Force
  }
  if (Test-Path $PublicUrlFile) {
    Remove-Item $PublicUrlFile -Force
  }

  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $SupervisorScript) `
    -WorkingDirectory $RepoRoot `
    -RedirectStandardOutput (Join-Path $RunDir 'supervisor.out.log') `
    -RedirectStandardError (Join-Path $RunDir 'supervisor.err.log') `
    -WindowStyle Hidden `
    -PassThru

  Set-Content -Path $SupervisorPidFile -Value $process.Id -NoNewline
  return $process.Id
}

function Stop-Supervisor {
  Set-Content -Path $StopFlag -Value 'stop' -NoNewline
  $processId = Read-ProcessId $SupervisorPidFile
  if (Test-ProcessAlive $processId) {
    Stop-Process -Id $processId -Force
  }
  if (Test-Path $SupervisorPidFile) {
    Remove-Item $SupervisorPidFile -Force
  }
  if (Test-Path $StopFlag) {
    Remove-Item $StopFlag -Force
  }
  Stop-AllChildren
}

function Get-PublicUrl {
  if (Test-Path $PublicUrlFile) {
    return (Get-Content $PublicUrlFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  }
  return $null
}

function Show-Status {
  $ip = Get-LocalHostIP
  $supervisorPid = Read-ProcessId $SupervisorPidFile
  $frontendPid = Get-PortProcessId 5173
  $backendPid = Get-PortProcessId 8080
  $publicUrl = Get-PublicUrl
  $autostart = Test-Path $StartupCmd

  Write-Output "Supervisor: $(if (Test-ProcessAlive $supervisorPid) { "running (PID $supervisorPid)" } else { 'stopped' })"
  Write-Output "Frontend: $(if ($frontendPid) { "running (PID $frontendPid)" } else { 'stopped' })"
  Write-Output "Backend: $(if ($backendPid) { "running (PID $backendPid)" } else { 'stopped' })"
  if ($ip) {
    Write-Output "Local URL: http://${ip}:5173"
  } else {
    Write-Output 'Local URL: IP not detected'
  }
  if ($publicUrl) {
    Write-Output "Public URL: $publicUrl"
  } else {
    Write-Output 'Public URL: preparing'
  }
  Write-Output "Autostart: $(if ($autostart) { 'enabled' } else { 'disabled' })"
  Write-Output "Logs: $RunDir"
}

switch ($Action) {
  'prepare' {
    Invoke-Prepare
  }
  'start' {
    if (Test-ProcessAlive (Read-ProcessId $SupervisorPidFile)) {
      Show-Status
      break
    }
    Invoke-Prepare
    Stop-AllChildren
    $supervisorPid = Start-Supervisor
    Start-Sleep -Seconds 5
    Write-Output "Supervisor started with PID $supervisorPid"
    Show-Status
  }
  'stop' {
    Stop-Supervisor
    Write-Output 'Host stopped'
    Show-Status
  }
  'restart' {
    Stop-Supervisor
    Invoke-Prepare
    $supervisorPid = Start-Supervisor
    Start-Sleep -Seconds 5
    Write-Output "Supervisor started with PID $supervisorPid"
    Show-Status
  }
  'status' {
    Show-Status
  }
  'install-autostart' {
    $command = "@echo off`r`npowershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$RepoRoot\host.ps1`" start`r`n"
    Set-Content -Path $StartupCmd -Value $command -Encoding ASCII
    Write-Output "Autostart enabled: $StartupCmd"
  }
  'remove-autostart' {
    if (Test-Path $StartupCmd) {
      Remove-Item $StartupCmd -Force
    }
    Write-Output 'Autostart disabled'
  }
}
