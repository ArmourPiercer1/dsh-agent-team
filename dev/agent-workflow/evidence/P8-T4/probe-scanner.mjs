import {
  buildP8T4MirrorLogControlText,
  buildP8T4SpecifierControlText,
  buildP8T4VocabularyControlText,
  matchP8T4RulesInText,
  scanP8T4OwnedFiles,
} from '../../../../packages/remote/test/p8t4-negative-scan.mjs'

const scan = scanP8T4OwnedFiles()
console.log('files', scan.files.length)
for (const f of scan.fileResults) {
  console.log(f.file, 'violations', f.violations.length, 'specifiers', f.importSpecifiers.length)
}
console.log('total', scan.totalViolations)
if (scan.violations.length > 0) {
  for (const v of scan.violations) console.log('HIT', v.file, v.rule, v.line, v.column, v.detail)
}

const spec = matchP8T4RulesInText(buildP8T4SpecifierControlText())
console.log('specifier-control', spec.violations.map((v) => v.rule).join(','))
const mirror = matchP8T4RulesInText(buildP8T4MirrorLogControlText())
console.log('mirror-control', mirror.violations.map((v) => v.rule).join(','))
const vocab = matchP8T4RulesInText(buildP8T4VocabularyControlText())
console.log('vocab-control', vocab.violations.map((v) => v.rule).join(','))
