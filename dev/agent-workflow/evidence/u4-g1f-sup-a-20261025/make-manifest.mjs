/**
 * G1F-SUP-A evidence manifest: sha256 + size for every file under this directory,
 * with the run-scoped summary/ledger/marker files first. Machine-generated;
 * regenerate after each sealed addition, never hand-edit.
 * Usage: node make-manifest.mjs
 * @module dev/agent-workflow/evidence/u4-g1f-sup-a-20261025/make-manifest
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SKIP_NAMES = new Set(['manifest.json', 'make-manifest.mjs'])

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.isFile() && !SKIP_NAMES.has(relative(HERE, p))) yield p
  }
}

const files = [...walk(HERE)].sort()
const entries = files.map((p) => {
  const buf = readFileSync(p)
  return { path: relative(HERE, p), bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') }
})
const aggregate = createHash('sha256')
for (const e of entries) aggregate.update(`${e.sha256}  ${e.path}\n`)
const manifest = {
  generated_at: new Date().toISOString(),
  host_pin: '639ed015397290b3745d163aafe02ffee4aa3f84',
  files: entries,
  aggregate_sha256: aggregate.digest('hex'),
}
writeFileSync(join(HERE, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`manifest.json: ${entries.length} files, aggregate ${manifest.aggregate_sha256}`)
