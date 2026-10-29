/**
 * make-manifest.mjs — sha256 every file in the G1F-SUP-B evidence package
 * (excluding runs/ subtrees listed per-run and this manifest itself) and
 * write manifest.json. H0 package pattern (u4-h0-20261025/make-manifest).
 * @module dev/agent-workflow/evidence/u4-g1f-sup-b-20261025/make-manifest
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const walk = (dir, acc = []) => {
  for (const ent of readdirSync(dir)) {
    const p = join(dir, ent)
    if (statSync(p).isDirectory()) walk(p, acc)
    else acc.push(p)
  }
  return acc
}
const files = walk(HERE)
  .filter((p) => !p.endsWith('manifest.json'))
  .map((p) => ({ path: relative(HERE, p).split('\\').join('/'), bytes: statSync(p).size, sha256: sha(p) }))
  .sort((a, b) => a.path.localeCompare(b.path))
const manifest = {
  package: 'u4-g1f-sup-b-20261025',
  executor: 'G1F-SUP-B',
  gate: 'G1-F round-1 supplement (feasibility PoCs)',
  generated_at: new Date().toISOString(),
  master_repo_head_at_build: process.argv[2] ?? 'unknown',
  htu_pin: '639ed015397290b3745d163aafe02ffee4aa3f84',
  file_count: files.length,
  files,
}
writeFileSync(join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest: ${String(files.length)} files`)
