$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$runtime = Join-Path $projectRoot 'Launcher\.runtime'
$statePath = Join-Path $runtime 'processes.json'
if (Test-Path -LiteralPath $statePath) { throw 'Refusing to replace existing launcher state. Stop the system first.' }
New-Item -ItemType Directory -Path $runtime -Force | Out-Null
$testScript = Join-Path $runtime 'ownership-test.cjs'
Set-Content -LiteralPath $testScript -Value 'setInterval(() => {}, 1000);'
$nodePath = (Get-Command node).Source
$started = @()
try {
  for ($index = 0; $index -lt 2; $index++) {
    $started += Start-Process -FilePath $nodePath -ArgumentList ('"' + $testScript + '"') -WindowStyle Hidden -PassThru
  }
  $details = Get-CimInstance Win32_Process -Filter "ProcessId = $($started[0].Id)"
  $state = @(
    @{ pid = $started[0].Id; created = $details.CreationDate.ToUniversalTime().Ticks.ToString(); script = $testScript },
    @{ pid = $started[1].Id; created = '1900-01-01T00:00:00.0000000Z'; script = $testScript }
  )
  ConvertTo-Json -InputObject $state | Set-Content -LiteralPath $statePath
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $projectRoot 'Launcher\scripts\system.ps1') -Action Stop
  if ($LASTEXITCODE -ne 0) { throw 'STOP launcher failed.' }
  Start-Sleep -Milliseconds 300
  if (Get-Process -Id $started[0].Id -ErrorAction SilentlyContinue) { throw 'Owned process was not stopped.' }
  if (!(Get-Process -Id $started[1].Id -ErrorAction SilentlyContinue)) { throw 'Mismatched-identity process was incorrectly stopped.' }
  Write-Host 'PASS: STOP terminated the verified owned process and preserved a mismatched-identity process.'
} finally {
  foreach ($process in $started) {
    if (!$process.HasExited) { $process.Kill(); $process.WaitForExit() }
  }
  if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath }
  Remove-Item -LiteralPath $testScript -ErrorAction SilentlyContinue
}
