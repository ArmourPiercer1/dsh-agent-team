# batch1-validation env + pre-run git status capture (no $-assignments inline: .ps1 form)
$root = 'D:\AgentDev\dsh-plugins\dsh-agent-team'
$ev = Join-Path $root 'dev\agent-workflow\evidence\F3-F11-F9-T1.4-repair\batch1-validation'
Set-Location $root
$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('date: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
[void]$sb.AppendLine('node: ' + (& node --version 2>&1 | Out-String).Trim())
[void]$sb.AppendLine('node-source: ' + (Get-Command node).Source)
[void]$sb.AppendLine('branch: ' + (git rev-parse --abbrev-ref HEAD))
[void]$sb.AppendLine('head: ' + (git rev-parse HEAD))
[void]$sb.AppendLine('head-subject: ' + (git log -1 --format=%s))
[void]$sb.AppendLine('--- git status --porcelain (BEFORE) ---')
git status --porcelain 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
[void]$sb.AppendLine('--- end ---')
Set-Content -Path (Join-Path $ev '00-env-baseline.txt') -Value $sb.ToString() -Encoding utf8
Write-Host 'wrote 00-env-baseline.txt'
