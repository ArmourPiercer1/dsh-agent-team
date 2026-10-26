/**
 * U7-6 review R1 F2 — MUTATION PROBES for the row-class ride law.
 *
 * Each probe mutates ONE clause of the ride implementation in
 * `packages/runtime/tool-admission/admission-kernel.ts` (the file under
 * test, restored byte-identically after every run), re-runs the focused
 * vitest law tests, and records the RED result. A probe PASSES only when
 * the mutation is CAUGHT (vitest exits non-zero). The transcripts in this
 * directory are the committed output of `node run-mutation-probes.mjs`.
 *
 * Companion red evidence for the F1 law itself: f1-red-before-fix.txt —
 * the two R1-F1 tests, run against the PRE-FIX implementation, verbatim.
 *
 * Run from the worktree root:
 *   node dev/agent-workflow/evidence/u7-6-glue4-20261026/mutation-probes/run-mutation-probes.mjs
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..', '..')
const kernel = join(repoRoot, 'packages', 'runtime', 'tool-admission', 'admission-kernel.ts')
const TEST = 'packages/runtime/test/a5p2-admission-kernel.test.ts'
const sha = (b) => createHash('sha256').update(b).digest('hex')

const PROBES = [
  {
    id: 'M1-deny-mirror-removed',
    reviewItem: 'R1 F2(a): removing the deny-source mirroring must break a test',
    old: "      if (lane === 'deny') denySources.push({ effectKind: 'tool-invoke', matcher: rideMatcher, ruleIndex: index })\n",
    new: '',
    titleFilter: 'projects the class arm',
  },
  {
    id: 'M2-unknown-class-accepted',
    reviewItem: 'R1 F2(b): relaxing the unknown-class (inventory membership) handling must break a test',
    old: "      if (!inventory.includes(effectClass)) {",
    new: "      if (false && !inventory.includes(effectClass)) {",
    titleFilter: 'typed refusal at both real faces',
  },
  {
    id: 'M3-nameable-class-rides',
    reviewItem: 'R1 F2(c): letting a grammar-class (or any non-inventoried shortcut) through the key law must break a test — here the nameable-class guard is dropped',
    old: "      if (!/^[a-z][a-z0-9_]{0,63}$/.test(effectClass) || PERMISSION_TOOL_NAMES.includes(effectClass)) {",
    new: "      if (!/^[a-z][a-z0-9_]{0,63}$/.test(effectClass)) {",
    titleFilter: 'validated fail-closed',
  },
  {
    id: 'M4-ride-ceiling-relaxed-to-allow',
    reviewItem: 'R1 recommended (c): relaxing the ride ceiling (deny/ask lane rides at allow) must break a test',
    old: "      entries.push({ ceiling, effectKinds: Object.freeze(['tool-invoke'] as const), matcher: rideMatcher })",
    new: "      entries.push({ ceiling: 'allow', effectKinds: Object.freeze(['tool-invoke'] as const), matcher: rideMatcher })",
    titleFilter: 'projects the class arm',
  },
]

const pristine = readFileSync(kernel)
const pristineSha = sha(pristine)
const manifest = []
let allCaught = true
for (const probe of PROBES) {
  const source = readFileSync(kernel, 'utf8')
  const hits = source.split(probe.old).length - 1
  if (hits !== 1) throw new Error(`${probe.id}: mutation anchor matched ${String(hits)}x — probe script drifted from the source, refusing to guess`)
  writeFileSync(kernel, source.replace(probe.old, probe.new))
  const run = spawnSync('npx', ['vitest', 'run', TEST, '--root', '.', '-t', probe.titleFilter], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  writeFileSync(kernel, pristine) // restore FIRST, judge after
  if (sha(readFileSync(kernel)) !== pristineSha) throw new Error(`${probe.id}: restore mismatch`)
  const caught = run.status !== 0
  if (!caught) allCaught = false
  const tail = `${run.stdout ?? ''}\n${run.stderr ?? ''}`
    .split('\n')
    .filter((line) => /×|✓|Tests |AssertionError|expected/.test(line))
    .join('\n')
  const transcript = [
    `# ${probe.id}`,
    `# ${probe.reviewItem}`,
    `# vitest -t "${probe.titleFilter}" exit=${String(run.status)} => ${caught ? 'MUTANT CAUGHT (tests went RED)' : 'MUTANT SURVIVED (LAW NOT PROVEN)'}`,
    '',
    tail,
  ].join('\n')
  writeFileSync(join(here, `${probe.id}.txt`), transcript + '\n')
  manifest.push(`${probe.id}: ${caught ? 'CAUGHT' : 'SURVIVED'} (exit ${String(run.status)})`)
  console.log(manifest[manifest.length - 1])
}
writeFileSync(join(here, 'manifest.txt'), manifest.join('\n') + `\nall-mutants-caught=${String(allCaught)}\nkernel restored byte-identical: ${pristineSha}\n`)
if (!allCaught) process.exitCode = 1
