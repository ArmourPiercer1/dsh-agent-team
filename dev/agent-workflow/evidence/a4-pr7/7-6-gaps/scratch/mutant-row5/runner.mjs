/**
 * MUTANT RUNNER (throwaway, NEVER committed) for A4-PR7 §7.6 ROW 5.
 *
 * Two counterfactuals of the same forbidden implementation, named by the
 * document line the legs derive from — ADR-alpha4-hard-governance.md §7.3:
 * "This is a logical runtime intersection, not a precomputed path/resource set.
 * No implementation may expand the envelopes into a startup-time list of
 * currently existing descendants and use that list as authority."
 *
 *   blocks-census — `startup-time-descendant-census`: the forbidden construction
 *     in the flesh. The shipped decision lane is given a directory-listing
 *     import, expands a granted subtree root into the set of descendants that
 *     EXIST at first sight, and answers every later authority question from
 *     that list.
 *   blocks-memo  — `materialized-covered-pairs-as-authority`: the same law
 *     without needing a listing API. The containment verdict for a
 *     (root, resource) pair is computed once and replayed forever, i.e. the
 *     covered set is materialized lazily and becomes the authority.
 *
 * Both live in `blocks-<set>/NNN.<file|from|to>` as literal text: an earlier
 * revision of this runner family inlined blocks in JS string literals and
 * corrupted a production file through a `$`-substitution. Anchors must match
 * exactly once; `restore` writes back the byte-exact backup taken by `apply`.
 *
 * usage: node runner.mjs <census|memo> apply | restore | hash
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../..')
const SET = process.argv[2]
if (SET !== 'census' && SET !== 'memo') throw new Error('usage: runner.mjs <census|memo> apply|restore|hash')
const BLOCKS = join(HERE, `blocks-${SET}`)
const BACKUP = join(HERE, `backup-${SET}.json`)
const FILES = [resolve(ROOT, 'packages/runtime/permission-lifecycle/decision-lane.ts')]

const sha = (text) => createHash('sha256').update(text).digest('hex')
const hashAll = () => {
  for (const file of FILES) console.log(`${sha(readFileSync(file, 'utf8'))}  ${file.slice(ROOT.length + 1)}`)
}

const blocks = readdirSync(BLOCKS)
  .filter((name) => name.endsWith('.from'))
  .map((name) => name.replace(/\.from$/, ''))
  .sort()

const mode = process.argv[3]
if (mode === 'apply') {
  const backup = {}
  for (const file of FILES) backup[file] = readFileSync(file, 'utf8')
  writeFileSync(BACKUP, JSON.stringify(backup))
  for (const block of blocks) {
    const target = resolve(ROOT, readFileSync(join(BLOCKS, `${block}.file`), 'utf8').trim())
    const from = readFileSync(join(BLOCKS, `${block}.from`), 'utf8')
    const to = readFileSync(join(BLOCKS, `${block}.to`), 'utf8')
    const text = readFileSync(target, 'utf8')
    const count = text.split(from).length - 1
    if (count !== 1) throw new Error(`block ${block}: anchor matched ${count} times (expected exactly 1)`)
    writeFileSync(target, text.replace(from, () => to))
    console.log(`applied ${SET}/${block} -> ${target.slice(ROOT.length + 1)}`)
  }
  hashAll()
} else if (mode === 'restore') {
  const backup = JSON.parse(readFileSync(BACKUP, 'utf8'))
  for (const [file, text] of Object.entries(backup)) writeFileSync(file, text)
  hashAll()
} else {
  hashAll()
}
