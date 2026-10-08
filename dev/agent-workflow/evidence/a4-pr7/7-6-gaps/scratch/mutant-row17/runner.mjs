/**
 * MUTANT RUNNER (throwaway, NEVER committed) for A4-PR7 §7.6 ROW 17.
 *
 * `acknowledgement-lives-in-the-heap` — the fault the row-17 finding says the
 * PR6 family cannot see. The acknowledgement is still APPENDED durably (the
 * ledger row is unchanged, so every write-shape assertion in the family stays
 * green), but the fold reads the acknowledgement back out of a process-local
 * Map instead of out of those rows. Pre-restart behaviour is identical; only a
 * second store opened over the same directory can tell, which is precisely what
 * spec §21.10 "warning acknowledgement reconstructs" requires and what
 * `7-6-closure/SCENARIOS.md` row 17 found unasserted.
 *
 * Blocks live in `blocks-inmemory-ack/NNN.<file|from|to>` as literal text (an
 * earlier runner family inlined blocks in JS strings and corrupted a source
 * file through a `$`-substitution). Anchors must match exactly once; `restore`
 * writes back the byte-exact backup `apply` took.
 *
 * usage: node runner.mjs apply | restore | hash
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../..')
const BLOCKS = join(HERE, 'blocks-inmemory-ack')
const BACKUP = join(HERE, 'backup.json')
const FILES = [resolve(ROOT, 'packages/runtime/governance-warning/service.ts')]
const sha = (t) => createHash('sha256').update(t).digest('hex')
const hashAll = () => {
  for (const f of FILES) console.log(`${sha(readFileSync(f, 'utf8'))}  ${f.slice(ROOT.length + 1)}`)
}
const blocks = readdirSync(BLOCKS).filter((n) => n.endsWith('.from')).map((n) => n.replace(/\.from$/, '')).sort()
const mode = process.argv[2]
if (mode === 'apply') {
  const backup = {}
  for (const f of FILES) backup[f] = readFileSync(f, 'utf8')
  writeFileSync(BACKUP, JSON.stringify(backup))
  for (const block of blocks) {
    const target = resolve(ROOT, readFileSync(join(BLOCKS, `${block}.file`), 'utf8').trim())
    const from = readFileSync(join(BLOCKS, `${block}.from`), 'utf8')
    const to = readFileSync(join(BLOCKS, `${block}.to`), 'utf8')
    const text = readFileSync(target, 'utf8')
    const count = text.split(from).length - 1
    if (count !== 1) throw new Error(`block ${block}: anchor matched ${count} times (expected exactly 1)`)
    writeFileSync(target, text.replace(from, () => to))
    console.log(`applied ${block} -> ${target.slice(ROOT.length + 1)}`)
  }
  hashAll()
} else if (mode === 'restore') {
  const backup = JSON.parse(readFileSync(BACKUP, 'utf8'))
  for (const [f, t] of Object.entries(backup)) writeFileSync(f, t)
  hashAll()
} else {
  hashAll()
}
