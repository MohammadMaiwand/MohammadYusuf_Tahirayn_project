param([ValidateSet('Start','Stop')][string]$Action = 'Start')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runtime = Join-Path $projectRoot 'Launcher\.runtime'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
$statePath = Join-Path $runtime 'processes.json'
$lock = $null
$owned = @()

function Test-OwnedProcess($entry) {
  $candidate = Get-CimInstance Win32_Process -Filter "ProcessId = $($entry.pid)" -ErrorAction Stop
  if (!$candidate) { return $false }
  return ($candidate.CreationDate.ToUniversalTime().Ticks.ToString() -eq [string]$entry.created -and $candidate.CommandLine -and $candidate.CommandLine.IndexOf([string]$entry.script, [StringComparison]::OrdinalIgnoreCase) -ge 0)
}
function Stop-OwnedProcesses($entries) {
  foreach ($entry in $entries) {
    if (Test-OwnedProcess $entry) { Stop-Process -Id $entry.pid -ErrorAction Stop }
  }
}
function Assert-FreePort([int]$portNumber) {
  if (Get-NetTCPConnection -State Listen -LocalPort $portNumber -ErrorAction SilentlyContinue) { throw "Port $portNumber is already in use. No process was stopped." }
}
function Wait-Http([string]$url, [int]$processId) {
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if (!(Get-Process -Id $processId -ErrorAction SilentlyContinue)) { throw 'A server exited. Inspect Launcher/.runtime logs.' }
    try { $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2; if ($response.StatusCode -eq 200) { return } } catch { }
    Start-Sleep -Milliseconds 500
  }
  throw 'Server readiness timed out. Inspect Launcher/.runtime logs.'
}
function Start-OwnedNode([string]$nodePath, [string]$scriptPath, [string]$workingPath, [string]$label, [string]$extraArguments = '') {
  $process = Start-Process -FilePath $nodePath -ArgumentList ('"' + $scriptPath + '" ' + $extraArguments) -WorkingDirectory $workingPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime "$label.out.log") -RedirectStandardError (Join-Path $runtime "$label.err.log") -PassThru
  $details = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
  if (!$details) { throw "The $label process exited immediately. Inspect logs." }
  return @{ pid = $process.Id; created = $details.CreationDate.ToUniversalTime().Ticks.ToString(); script = $scriptPath }
}
function Invoke-NodeConfig([string]$nodePath, [string]$mode = '') {
  $outputPath = Join-Path $runtime 'config.out.log'
  $process = Start-Process -FilePath $nodePath -ArgumentList ('"' + (Join-Path $PSScriptRoot 'config.mjs') + '" ' + $mode) -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $outputPath -RedirectStandardError (Join-Path $runtime 'config.err.log') -Wait -PassThru
  return @{ exitCode = $process.ExitCode; output = [IO.File]::ReadAllText($outputPath) }
}
try {
  try { $lock = [IO.File]::Open((Join-Path $runtime 'launcher.lock'), 'OpenOrCreate', 'ReadWrite', 'None') } catch { throw 'Another launcher operation is running.' }
  $previous = @()
  if (Test-Path -LiteralPath $statePath) { $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json }
  if ($Action -eq 'Stop') {
    Stop-OwnedProcesses $previous
    if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath }
    Write-Host 'Stopped verified launcher-owned servers. MongoDB service state was unchanged.'
    exit 0
  }
  foreach ($entry in $previous) { if (Test-OwnedProcess $entry) { throw 'A launcher-owned server is already running. Use STOP_SYSTEM.bat first.' } }
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (!$node) { throw 'Node.js LTS is required. Install Node.js 26 LTS and reopen the launcher.' }
  & $node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
  if ($LASTEXITCODE -ne 0) { throw 'Node.js 24 or newer is required; Node.js 26 LTS is recommended.' }
  if (!(Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is missing from PATH.' }
  if (!(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\.package-lock.json'))) { throw 'Dependencies are missing. Run npm ci from the project root.' }
  Push-Location $projectRoot
  try {
    Write-Host 'Building and checking the foundation. Build log: Launcher/.runtime/build.log'
    $buildProcess = Start-Process -FilePath $env:ComSpec -ArgumentList '/d /s /c "npm.cmd run build"' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'build.log') -RedirectStandardError (Join-Path $runtime 'build.err.log') -Wait -PassThru
    if ($buildProcess.ExitCode -ne 0) { throw 'Build failed. See Launcher/.runtime/build.log and build.err.log.' }
    $configResult = Invoke-NodeConfig $node
    if ($configResult.exitCode -ne 0) { throw 'Environment validation failed. See Launcher/.runtime/config.err.log.' }
    $config = $configResult.output | ConvertFrom-Json
    Assert-FreePort $config.port
    Assert-FreePort $config.frontendPort
    if ($config.port -eq $config.frontendPort) { throw 'Frontend and backend must use different ports.' }
    $databaseProbe = Invoke-NodeConfig $node 'probe'
    if ($databaseProbe.exitCode -ne 0 -and $config.devMongo) {
      Write-Host 'Starting explicitly enabled isolated development replica set. Existing service data is unchanged.'
      $databaseProcess = Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $projectRoot 'scripts\development\local-mongo.mjs') + '" start') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtime 'mongodb.out.log') -RedirectStandardError (Join-Path $runtime 'mongodb.err.log') -PassThru
      # -Wait follows descendants on Windows, including the deliberately detached mongod.
      # Wait only for the helper; the database must remain running after it exits.
      $null = $databaseProcess.Handle
      $databaseProcess.WaitForExit()
      if ($databaseProcess.ExitCode -ne 0) { throw 'Development MongoDB failed. See Launcher/.runtime/mongodb.err.log.' }
      $databaseProbe = Invoke-NodeConfig $node 'probe'
    }
    if ($databaseProbe.exitCode -ne 0) {
      if (!$config.localMongo -or !$config.serviceName) { throw 'MongoDB is unavailable. Remote connections never trigger service startup. Configure a local service name only for local MongoDB.' }
      $service = Get-Service -Name $config.serviceName -ErrorAction SilentlyContinue
      if (!$service) { throw 'The configured MongoDB service does not exist.' }
      if ($service.Status -ne 'Running') { Start-Service -InputObject $service }
      $databaseProbe = Invoke-NodeConfig $node 'probe'
      if ($databaseProbe.exitCode -ne 0) { throw 'MongoDB remains unavailable after service startup. See Launcher/.runtime/config.err.log.' }
    }
    $owned += Start-OwnedNode $node (Join-Path $projectRoot 'backend\dist\server.js') (Join-Path $projectRoot 'backend') 'backend'
    ConvertTo-Json -InputObject @($owned) | Set-Content -LiteralPath $statePath
    Wait-Http "http://$($config.host):$($config.port)/api/v1/ready" $owned[0].pid
    $owned += Start-OwnedNode $node (Join-Path $projectRoot 'node_modules\vite\bin\vite.js') (Join-Path $projectRoot 'frontend') 'frontend' "--host 127.0.0.1 --port $($config.frontendPort) --strictPort"
    ConvertTo-Json -InputObject @($owned) | Set-Content -LiteralPath $statePath
    Wait-Http "http://127.0.0.1:$($config.frontendPort)" $owned[1].pid
    Start-Process $config.frontendUrl
    Write-Host 'System is ready. Logs are available in Launcher/.runtime. Use STOP_SYSTEM.bat to stop.'
  } finally { Pop-Location }
} catch {
  Stop-OwnedProcesses $owned
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
} finally { if ($lock) { $lock.Dispose() } }
