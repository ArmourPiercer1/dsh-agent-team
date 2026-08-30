$ErrorActionPreference = 'Stop'
$ev = $PSScriptRoot
$root = (Get-Item $PSScriptRoot).Parent.Parent.Parent.Parent.FullName
Set-Location $root
$rt = node node_modules/typescript/bin/tsc -p packages/runtime/tsconfig.json 2>&1
$re = $LASTEXITCODE
$tk = node node_modules/typescript/bin/tsc -p packages/testkit/tsconfig.json 2>&1
$te = $LASTEXITCODE
$rtOut = if ($rt) { ($rt -join "`n") } else { '(none)' }
$tkOut = if ($tk) { ($tk -join "`n") } else { '(none)' }
"tsc -p packages/runtime/tsconfig.json`nexit: $re`noutput: $rtOut" | Set-Content -Path (Join-Path $ev 'tsc-runtime-final.txt') -Encoding utf8
"tsc -p packages/testkit/tsconfig.json`nexit: $te`noutput: $tkOut" | Set-Content -Path (Join-Path $ev 'tsc-testkit-final.txt') -Encoding utf8
Write-Output "runtime=$re testkit=$te"
