# batch1-validation typecheck driver (client/remote/runtime)
# Direct in-process tsc (node node_modules/typescript/lib/tsc.js) — the
# spawn-free equivalent of `npx tsc -p <pkg>/tsconfig.json --noEmit`
# (npx/child spawn is EPERM in this sandbox; f9/run-recipe.md constraint 2).
# The .ps1-file form avoids the session wrapper's inline-argument mangling
# (PowerShell ate a bare `-p` flag from the inline invocation).
$root = 'D:\AgentDev\dsh-plugins\dsh-agent-team'
$ev = Join-Path $root 'dev\agent-workflow\evidence\F3-F11-F9-T1.4-repair\batch1-validation'
Set-Location $root
$pkgs = @('client', 'remote', 'runtime')
foreach ($pkg in $pkgs) {
  $out = Join-Path $ev ("18-typecheck-{0}.txt" -f $pkg)
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.AppendLine('cmd: node node_modules/typescript/lib/tsc.js -p packages/' + $pkg + '/tsconfig.json --noEmit')
  [void]$sb.AppendLine('cwd: ' + (Get-Location).Path)
  [void]$sb.AppendLine('started: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
  [void]$sb.AppendLine('---')
  $t0 = Get-Date
  & node (Join-Path $root 'node_modules/typescript/lib/tsc.js') '-p' ('packages/' + $pkg + '/tsconfig.json') '--noEmit' 2>&1 | ForEach-Object { [void]$sb.AppendLine(("$_")) }
  $code = $LASTEXITCODE
  $elapsed = ((Get-Date) - $t0).TotalSeconds
  [void]$sb.AppendLine('---')
  [void]$sb.AppendLine('exit: ' + $code)
  [void]$sb.AppendLine('elapsed-seconds: ' + [math]::Round($elapsed, 1))
  [void]$sb.AppendLine('finished: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss zzz'))
  Set-Content -Path $out -Value $sb.ToString() -Encoding utf8
  Write-Host ($pkg + ': exit ' + $code + ' -> ' + $out)
}
