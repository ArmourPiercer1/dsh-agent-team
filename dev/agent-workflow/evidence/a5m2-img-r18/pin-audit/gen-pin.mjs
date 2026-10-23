// Pin generator (deterministic, parameterized): every hash REGENERATED from the given
// tarball bytes; formats mirror the r17 ROOT pin + the 34c helper pin file sets:
//   manifest-tgz-entries-C.txt          FILE records, code-unit (== LC_ALL=C) sorted, `package/`-prefixed
//   manifest-tgz-dist-hashes.txt        "<sha256>  package/<path>" for EVERY file, same order
//   manifest-installsurface-hashes.txt  the same lines restricted to the executable surface (.js/.mjs/.json)
//   plugin.mjs                          git blob packages/tools/harness/plugin.mjs @<SHA>
// Usage: node gen-pin.mjs <SHA> <tgz-src> <extraction-root> <out-dir>
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
const [SHA, TGZ, X, OUT] = process.argv.slice(2)
const REPO = '/srv/workspace/dsh-plugins/dsh-agent-team'
const h = (b) => createHash('sha256').update(b).digest('hex')
const hf = (p) => h(readFileSync(p))
mkdirSync(OUT, { recursive: true })
const tgz = readFileSync(TGZ)
writeFileSync(join(OUT, 'dsh-agent-team-0.1.1-alpha.2.tgz'), tgz)
const plugin = execFileSync('git', ['-C', REPO, 'show', `${SHA}:packages/tools/harness/plugin.mjs`], { maxBuffer: 32e6 })
writeFileSync(join(OUT, 'plugin.mjs'), plugin)
const raw = execFileSync('tar', ['-tzf', join(OUT, 'dsh-agent-team-0.1.1-alpha.2.tgz')], { encoding: 'utf8', maxBuffer: 64e6 }).trim().split('\n')
const entries = raw.filter((p) => !p.endsWith('/'))
const entriesC = [...entries].sort()
writeFileSync(join(OUT, 'manifest-tgz-entries-C.txt'), entriesC.join('\n') + '\n')
const lines = entriesC.map((p) => {
  const abs = join(X, p.replace(/^package\//, ''))
  if (!existsSync(abs)) throw new Error(`extraction missing entry: ${p}`)
  return `${hf(abs)}  ${p}`
})
writeFileSync(join(OUT, 'manifest-tgz-dist-hashes.txt'), lines.join('\n') + '\n')
const surf = lines.filter((l) => /\.(js|mjs|json)$/.test(l.slice(66)))
writeFileSync(join(OUT, 'manifest-installsurface-hashes.txt'), surf.join('\n') + '\n')
console.log(JSON.stringify({
  sha: SHA, tgzSha: h(tgz), tgzBytes: tgz.length, pluginSha: h(plugin),
  rawRecords: raw.length, dirRecords: raw.length - entries.length, files: entries.length, installSurface: surf.length,
  entriesDigest: h(Buffer.from(`${entriesC.join('\n')}\n`)),
  treeDigest: hf(join(OUT, 'manifest-tgz-dist-hashes.txt')),
  surfaceDigest: hf(join(OUT, 'manifest-installsurface-hashes.txt')),
  cordisPatchSha: hf(join(X, 'cordis.patch.yml')), packageJsonSha: hf(join(X, 'package.json')),
}, null, 1))
