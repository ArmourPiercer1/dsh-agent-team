$rc1 = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\RC1'
$pattern = "(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|[\w$]+\s*,\s*\{[^}]*\})?\s*from\s*['""](@deepseek-ai/[a-z0-9-]+)(?:/([a-z0-9._-]+))?['""]"
$lines = @()
Get-ChildItem $rc1\packages -Recurse -Include *.ts,*.tsx,*.mjs,*.js -File | Where-Object { $_.FullName -notmatch 'node_modules|dist|\\\.git\\' } | ForEach-Object {
  $f = $_.FullName
  $rel = $f.Replace("$rc1\packages\", '')
  $raw = Get-Content $f -Raw
  $imports = [regex]::Matches($raw, $pattern) | ForEach-Object {
    if ($_.Groups[2].Success) { "$($_.Groups[1].Value)/$($_.Groups[2].Value)" } else { $_.Groups[1].Value }
  } | Sort-Object -Unique
  # also catch side-effect imports: import '...' (no from)
  $side = [regex]::Matches($raw, "^\s*import\s+['""](@deepseek-ai/[a-z0-9-]+)(?:/([a-z0-9._-]+))?['""]") | ForEach-Object {
    if ($_.Groups[2].Success) { "$($_.Groups[1].Value)/$($_.Groups[2].Value)" } else { $_.Groups[1].Value }
  } | Sort-Object -Unique
  $all = @($imports) + @($side) | Sort-Object -Unique
  if ($all.Count -gt 0) { $lines += ($rel + ' :: ' + ($all -join ' | ')) }
}
$lines | Out-File -Encoding utf8 'D:\AgentDev\dsh-plugins\dsh-agent-team\dev\agent-workflow\evidence\upstream-rc1-compat\specifiers.txt'
$lines | Out-String -Width 300
