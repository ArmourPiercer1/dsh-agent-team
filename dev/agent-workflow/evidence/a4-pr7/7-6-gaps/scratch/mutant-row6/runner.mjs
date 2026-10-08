/**
 * MUTANT RUNNER (throwaway, NEVER committed): `bind-then-current-descendants`.
 *
 * THE FORBIDDEN IMPLEMENTATION this lane's Row-6 leg must catch, named by the
 * document line the leg derives from — spec §6.2 of
 * alpha4-permission-governance-spec.md: "A subtree proposal does not bind to
 * the then-current descendants." The mutant makes the approved rise digest stop
 * being a digest of the RISES and become a digest of every cell the mutation
 * region currently reaches, with its before/after answers — a snapshot of the
 * descendant census taken at approval time. Under it a pending proposal dies
 * the moment a descendant appears under its root, even when no approved rise
 * moved, which is precisely what spec §6.3 / §21.3 and ADR §8 forbid.
 *
 * Edits, all in the production governance lane (see blocks/*.from|to):
 *   permission-mutation.ts — classifyPermissionRise also collects a census row
 *     for EVERY cell it answers (rising or not) and returns it.
 *   permission-approval.ts — riseDigestOf folds that census into the digest.
 *   service.ts             — the census travels on the ask, and BOTH digest
 *     sites (the approval-time summary and the commit-boundary revalidation)
 *     bind it.
 *
 * Each edit lives in `blocks/NNN.<name>.from` / `.to` as literal text, so no
 * quoting can corrupt it: an earlier revision of this runner inlined the blocks
 * in JS string literals and wrote a literal `NaN` into permission-mutation.ts
 * (a `'-'` inside a single-quoted string). Anchors must match exactly once.
 *
 * usage: node runner.mjs apply | restore | hash
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../..')
const BACKUP = join(HERE, 'backup.json')
const FILES = [
  resolve(ROOT, 'packages/runtime/governance/permission-mutation.ts'),
  resolve(ROOT, 'packages/runtime/governance/permission-approval.ts'),
  resolve(ROOT, 'packages/runtime/governance/service.ts'),
]

const sha = (text) => createHash('sha256').update(text).digest('hex')
const hashAll = () => {
  for (const file of FILES) console.log(`${sha(readFileSync(file, 'utf8'))}  ${file.slice(ROOT.length + 1)}`)
}

const blocks = readdirSync(join(HERE, 'blocks'))
  .filter((name) => name.endsWith('.from'))
  .map((name) => name.replace(/\.from$/, ''))
  .sort()

const mode = process.argv[2]
if (mode === 'apply') {
  const backup = {}
  for (const file of FILES) backup[file] = readFileSync(file, 'utf8')
  writeFileSync(BACKUP, JSON.stringify(backup))
  for (const block of blocks) {
    const target = resolve(ROOT, readFileSync(join(HERE, 'blocks', `${block}.file`), 'utf8').trim())
    const from = readFileSync(join(HERE, 'blocks', `${block}.from`), 'utf8')
    const to = readFileSync(join(HERE, 'blocks', `${block}.to`), 'utf8')
    const text = readFileSync(target, 'utf8')
    const count = text.split(from).length - 1
    if (count !== 1) throw new Error(`block ${block}: anchor matched ${count} times (expected exactly 1)`)
    writeFileSync(target, text.replace(from, () => to))
    console.log(`applied ${block} -> ${target.slice(ROOT.length + 1)}`)
  }
  hashAll()
} else if (mode === 'restore') {
  const backup = JSON.parse(readFileSync(BACKUP, 'utf8'))
  for (const [file, text] of Object.entries(backup)) writeFileSync(file, text)
  hashAll()
} else {
  hashAll()
}
