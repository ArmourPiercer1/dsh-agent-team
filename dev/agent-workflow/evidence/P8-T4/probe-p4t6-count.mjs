import { scanSessionEventVocabulary } from '../../../../packages/testkit/fault-injection/session-event-scan.mjs'

const r = scanSessionEventVocabulary()
console.log('filesScanned', r.filesScanned)
console.log('files.length', r.files.length)
const p8t4 = r.files.filter((f) => f.includes('/src/push/') || f.includes('p8t4-'))
console.log('p8t4 files', p8t4.length)
for (const f of p8t4) console.log(' ', f)
console.log('hits outside quarantine', r.hits.filter((h) => h.file !== 'packages/contracts/src/legacy-vocabulary.ts' && h.file !== 'packages/contracts/test/negative.test.ts').length)
