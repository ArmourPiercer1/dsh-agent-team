import { scanSessionEventVocabulary } from '../../../../packages/testkit/fault-injection/session-event-scan.mjs'
const r = scanSessionEventVocabulary()
console.log('filesScanned=' + r.filesScanned)
for (const h of r.hits) {
  console.log(h.kind + '|' + h.file + ':' + h.line + ':' + h.column + '|' + h.token)
}
