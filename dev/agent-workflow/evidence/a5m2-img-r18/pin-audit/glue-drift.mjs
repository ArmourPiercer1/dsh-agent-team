// READ-ONLY artifact0-style gate for the 126b12cc pin: the D-leg (glue placement)
// of scripts/check-artifacts-committed.mjs, run against GIT BLOBS at the pinned
// SHA (never a live tree, never a build): committed src == committed dist? and
// does the PIN TARBALL carry the src-identical placement bytes?
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
const REPO = '/srv/workspace/dsh-plugins/dsh-agent-team'
const SHA = process.argv[2] ?? '126b12cce8c7d8b3b70bc605ec64c7429d6d0266'
const X = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-imgverify/.pinbuild-verify/x/package'
const src = execFileSync('git', ['-C', REPO, 'show', `${SHA}:scripts/place-dist-glue.mjs`], { encoding: 'utf8', maxBuffer: 32e6 })
const block = src.slice(src.indexOf('export const PLACEMENTS'))
const pairs = [...block.matchAll(/\{\s*\n?\s*src:\s*'([^']+)',[\s\S]{0,400}?dist:\s*'([^']+)'/g)].map((m) => ({ s: m[1], d: m[2] })).slice(0, 200)
const blob = (p) => { try { return createHash('sha256').update(execFileSync('git', ['-C', REPO, 'show', `${SHA}:${p}`], { maxBuffer: 64e6 })).digest('hex') } catch { return null } }
let headDrift = [], tgzDrift = [], missing = 0
for (const { s, d } of pairs) {
  const bs = blob(s), bd = blob(d)
  if (bs === null || bd === null) { missing++; continue }
  if (bs !== bd) headDrift.push(d)
  const t = join(X, d)
  if (!existsSync(t) || createHash('sha256').update(readFileSync(t)).digest('hex') !== bs) tgzDrift.push(d)
}
console.log(`placements=${pairs.length} missingBlobPairs=${missing}`)
console.log(`HEAD-dist-vs-src drift = ${headDrift.length}${headDrift.length ? ':\n  ' + headDrift.join('\n  ') : ''}`)
console.log(`TARBALL-dist-vs-committed-SRC drift = ${tgzDrift.length}${tgzDrift.length ? ':\n  ' + tgzDrift.join('\n  ') : ''}`)
