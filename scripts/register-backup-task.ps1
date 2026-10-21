# Registers the nightly database backup in Windows Task Scheduler (for the current user).
# Run once:  powershell -ExecutionPolicy Bypass -File scripts\register-backup-task.ps1 [-At 23:00]
# Remove:    Unregister-ScheduledTask -TaskName "SmartSchool DB Backup" -Confirm:$false
param([string]$At = '23:00')

$backend = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source

$action = New-ScheduledTaskAction -Execute $node -Argument '"scripts\db-backup.js"' -WorkingDirectory $backend
$trigger = New-ScheduledTaskTrigger -Daily -At $At
# StartWhenAvailable: if the computer was off at backup time, run as soon as it is on again.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName 'SmartSchool DB Backup' -Description 'Smart School: nightly MySQL backup (backend/scripts/db-backup.js)' `
  -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null

Get-ScheduledTask -TaskName 'SmartSchool DB Backup' | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime
