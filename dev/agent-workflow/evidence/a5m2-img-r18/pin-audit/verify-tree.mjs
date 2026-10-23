// READ-ONLY: per-file proof that the delivered package == the COMMITTED TREE at the pin SHA.
// git cat-file --batch over STDIN (argv would overflow), one blob per path.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const [SHA, X, ENTRY, REPO = '/srv/workspace/dsh-plugins/dsh-agent-team'] = process.argv.slice(2)
const paths = readFileSync(ENTRY, 'utf8').trim().split('\n').map((e) => e.replace(/^package\//, ''))
const stdin = paths.map((p) => `${SHA}:${p}`).join('\n') + '\n'
const r = spawnSync('git', ['-C', REPO, 'cat-file', '--batch'], { input: stdin, maxBuffer: 1024 * 1024 * 1024 })
if (r.status !== 0) { console.error('git cat-file failed', r.status, String(r.stderr).slice(0, 400)); process.exit(1) }
// parse: "<oid> blob <len>\n<bytes>\n" repeated; missing = "<path> missing\n"
const buf = r.stdout
let off = 0, drift = [], missing = [], compared = 0
const nl = (i) => buf.indexOf(0x0a, i)
for (const p of paths) {
  const headEnd = nl(off); const head = buf.subarray(off, headEnd).toString('utf8')
  if (head.endsWith(' missing')) { missing.push(p); off = headEnd + 1; continue }
  const [, type, lenS] = head.split(' '); const len = Number(lenS)
  const body = buf.subarray(headEnd + 1, headEnd + 1 + len)
  off = headEnd + 1 + len + 1
  if (type !== 'blob') { missing.push(`${p} (type ${type})`); continue }
  compared++
  const a = createHash('sha256').update(body).digest('hex')
  const b = createHash('sha256').update(readFileSync(`${X}/${p}`)).digest('hex')
  if (a !== b) drift.push(p)
}
console.log(JSON.stringify({ sha: SHA, compared, missingBlobs: missing.length, missing: missing.slice(0, 5), drift: drift.length, driftPaths: drift }, null, 1))
