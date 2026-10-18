// Render the leg table for the README from a recorded run's criteria.json.
// Usage: node render-table.mjs runs/<stamp>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2]
const c = JSON.parse(readFileSync(join(dir, 'criteria.json'), 'utf8')).criteria
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').slice(0, n)
const rows = c.map((x) => {
  const verdict = x.pass === true ? 'PASS' : (x.pass === null || x.pass === undefined ? 'BOOK' : '**FAIL**')
  return `| \`${x.id}\` | ${verdict} | ${clip(x.claim, 118)} | ${clip(x.observed, 150)} |`
})
console.log('| 腿 | 判定 | 断言（kit 原文，截断） | 实测（证据同值） |')
console.log('| --- | --- | --- | --- |')
console.log(rows.join('\n'))
const graded = c.filter((x) => x.pass !== null && x.pass !== undefined)
console.log(`\n<!-- graded=${graded.length} pass=${graded.filter((x) => x.pass).length} fail=${graded.filter((x) => !x.pass).length} booked=${c.length - graded.length} -->`)
