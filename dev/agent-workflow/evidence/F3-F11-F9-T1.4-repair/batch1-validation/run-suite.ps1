# batch1-validation generic suite driver (repair-r1 workflow-focused validation)
# Usage:
#   pwsh -NoProfile -File batch1-validation\run-suite.ps1 <out-file> <cmd0> [cmd1 ...]
# Runs <cmd0> <cmd1> ... from the repo root, tees all output to <out-file>,
# writes a header (exact command, cwd, timestamps) and footer (exit code, elapsed).
# The .ps1-file form is used because the session harness wrapper corrupts
# bare $-variable ASSIGNMENTS in inline pwsh command strings (f3c/NOTES.md
# "Re-run notes", documented for this repo).
param(
  [Parameter(Mandatory = $true)][string]$Out,
  [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)][string[]]$Cmd
)
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('cmd: ' + ($Cmd -join ' '))
[void]$sb.AppendLine('cwd: ' + (Get-Location).Path)
[void]$sb.AppendLine('ps: ' + $PSVersionTable.PSVersion.ToString())
[void]$sb.AppendLine('started: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
[void]$sb.AppendLine('---')
$t0 = Get-Date
$rest = @($Cmd | Select-Object -Skip 1)
& $Cmd[0] @rest 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
$code = $LASTEXITCODE
$elapsed = ((Get-Date) - $t0).TotalSeconds
[void]$sb.AppendLine('---')
[void]$sb.AppendLine('exit: ' + $code)
[void]$sb.AppendLine('elapsed-seconds: ' + [math]::Round($elapsed, 1))
[void]$sb.AppendLine('finished: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
Set-Content -Path $Out -Value $sb.ToString() -Encoding utf8
Write-Host ("wrote " + $Out + " (exit " + $code + ")")
exit $code
