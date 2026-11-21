#!/usr/bin/env node
/**
 * negative-controls.mjs — the AGENT-CONTROL lane's negative controls.
 *
 * Two families of controls, both with REAL mutations:
 *   NC-MEMBER <m> × 7  — for every member, two mutations of its success vector
 *                        (a deny-default template and a port-less run) must turn
 *                        the golden comparison RED. A row that stays green under
 *                        either mutation is not load-bearing.
 *   NC-F* × 10         — family/seam controls: the design-claim checker, the
 *                        closed refusal vocabulary (unmapped ⇒ incomplete, no
 *                        residual bucket), the route-C absence detector, the
 *                        two-implementation detector, byte-identical capture,
 *                        host-shape leakage, and the census unit coverage.
 *
 * Every control prints one line; `NC-VERDICT GREEN controls=<n> failed=0` is the
 * only passing verdict, and the transcript is committed so a later run cannot
 * silently shrink the battery.
 *
 * @module tests/ute-g1-agentctl/negative-controls
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import { CORPUS, COVERED_MEMBERS } from './lib/corpus.mjs'
import { compareRecord, checkDesignClaim, parseGolden, serializeGolden } from './lib/compare.mjs'
import {
  AGENT_CONTROL_REFUSAL_CATEGORY,
  CATEGORY_IDS,
  RefusalVocabularyError,
  RUNTIME_REFUSAL_CATEGORY,
  classifyRefusal,
  selfCheckRefusalVocabulary,
} from './lib/effect-oracle.mjs'
import { DENY_POLICY } from './lib/world.mjs'
import { EVIDENCE_ROOT } from './lib/paths.mjs'
import { captureVector } from './lib/old-path.mjs'

const golden = parseGolden(readFileSync(join(import.meta.dirname, 'golden', 'old-path.tsv'), 'utf8'))
const vector = (id) => {
  const found = CORPUS.find((candidate) => candidate.id === id)
  if (found === undefined) throw new Error(`no corpus vector ${id}`)
  return found
}
const goldenRow = (id) => {
  const found = golden.find((row) => row.id === id)
  if (found === undefined) throw new Error(`no golden row ${id}`)
  return found
}

let controls = 0
let failed = 0
const lines = []
const say = (line) => { lines.push(line); console.log(line) }

/** Run one control; `body` returns a reason string when the control FAILS. */
async function control(id, body) {
  controls += 1
  let reason
  let detail
  try {
    const settled = await body()
    if (settled !== null && typeof settled === 'object') { reason = settled.reason; detail = settled.detail } else reason = settled
  } catch (error) {
    reason = `threw: ${error?.message ?? String(error)}`
  }
  if (reason === undefined || reason === null) {
    say(`NC ${id} ok${detail === undefined ? '' : ` (${detail})`}`)
    return true
  }
  failed += 1
  say(`NC ${id} FAIL ${reason}`)
  return false
}

/** A mutated arm must reproduce the golden row; anything else is DRIFT. */
async function expectRed(id, mutation) {
  const observed = await captureVector(vector(id), mutation)
  const failures = compareRecord(goldenRow(id), observed)
  return failures.length === 0
    ? `mutation ${JSON.stringify(mutation)} left ${id} GREEN (${observed.outcome})`
    : null
}

/* ────────────────────────── per member (2 each) ──────────────────────────── */

const MEMBER_VECTORS = Object.freeze({
  subagent: 'AC-SUB-1-spawn',
  subagent_fork: 'AC-FORK-1-inherit',
  send_message: 'AC-MSG-1-steer',
  interrupt_agent: 'AC-INT-1-interrupt',
  list_agents: 'AC-LIST-1-enumerate',
  list_subagent_models: 'AC-MODELS-1-list',
  workflow: 'AC-WF-1-run',
})

for (const member of COVERED_MEMBERS) {
  const id = MEMBER_VECTORS[member]
  if (id === undefined) throw new Error(`no success vector declared for member ${member}`)
  let red = 0
  if (await control(`NC-MEMBER-${member}-policy-deny`, async () => expectRed(id, { policy: DENY_POLICY }))) red += 1
  if (await control(`NC-MEMBER-${member}-port-absent`, async () => expectRed(id, { noPort: true }))) red += 1
  say(`NC-MEMBER ${member} controls=2 red=${red} vector=${id}`)
}

/* ──────────────────────────── family controls ────────────────────────────── */

await control('NC-F1-design-claim', async () => {
  const observed = await captureVector(vector('AC-SUB-1-spawn'), {})
  const mutated = { ...vector('AC-SUB-1-spawn'), expect: { outcome: 'deny', refusal: 'cancelled', calls: 99, control: 99 } }
  const failures = checkDesignClaim(mutated, observed)
  return failures.length < 3 ? { reason: `the design-claim checker reported ${failures.length} failure(s) for 3 wrong claims` } : { detail: `${failures.length} claims red` }
})

await control('NC-F2-vocabulary-incomplete', async () => {
  try {
    classifyRefusal(new Error('refused-agent-control a-made-up-code — invented for this control'))
    return { reason: 'an unmapped refusal code was accepted instead of raising REFUSAL_VOCABULARY_INCOMPLETE' }
  } catch (error) {
    if (error instanceof RefusalVocabularyError && error.code === 'REFUSAL_VOCABULARY_INCOMPLETE') return { detail: 'REFUSAL_VOCABULARY_INCOMPLETE' }
    return { reason: `expected REFUSAL_VOCABULARY_INCOMPLETE, got ${String(error?.code ?? error)}` }
  }
})

await control('NC-F3-no-residual-bucket', async () => {
  const mapped = [...Object.values(AGENT_CONTROL_REFUSAL_CATEGORY), ...Object.values(RUNTIME_REFUSAL_CATEGORY)]
  const bad = mapped.filter((category) => !CATEGORY_IDS.includes(category) || category === 'unknown')
  const check = selfCheckRefusalVocabulary()
  if (bad.length > 0) return { reason: `categories outside the imported set (or the residual bucket): ${bad.join(',')}` }
  if (!check.ok) return { reason: `shared-vocabulary self-check failed: ${JSON.stringify(check.findings)}` }
  const outcome = classifyRefusal(new Error('Error: unknown tool "nope"'))
  if (outcome.category !== 'route-unresolved') return { reason: `unknown tool classified as ${outcome.category}` }
  return { detail: 'no code maps to unknown; the shared three tokens agree' }
})

await control('NC-F4-route-c-detector', async () => {
  const source = readFileSync(join(import.meta.dirname, '..', '..', 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
  const hasSpec = (text) => /const appended = \[[^\]]*agent[-_]?control/iu.test(text)
  if (hasSpec(source)) return { reason: 'the shipped attach now appends an agent-control spec — the probe conclusion changed and the lane must be re-measured' }
  if (!hasSpec(`${source}\nconst appended = [shellSpec, agentControlSpec]`)) return { reason: 'the detector cannot see a mutated spec (vacuous control)' }
  return { detail: 'absent in the shipped source, detected in the mutation' }
})

await control('NC-F5-two-implementation-detector', async () => {
  const census = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
  const unit = census.families.find((family) => family.familyId === 'dsh.agent-control-family')
  const members = unit.nativeNames.map((name) => name.replace('(bound-definition) ', ''))
  const plane = readFileSync(join(import.meta.dirname, '..', '..', 'packages', 'runtime', 'src', 'plugin', 'live', 'team-tool-plane.mjs'), 'utf8')
  const block = plane.slice(plane.indexOf('export const PLANE_RESERVED_NATIVE = Object.freeze(['))
  const reserved = [...block.slice(0, block.indexOf('\n])')).matchAll(/'([a-z0-9_]+)'/gu)].map((match) => match[1])
  const dual = (list) => members.filter((member) => list.includes(member))
  if (dual(reserved).length !== members.length) return { reason: `only ${dual(reserved).length}/${members.length} members are reserved native spellings` }
  if (dual(reserved.filter((name) => name !== 'workflow')).length === members.length) return { reason: 'dropping workflow did not turn the detector red (vacuous control)' }
  return { detail: `${members.length}/${members.length} dual (governed row + reserved native)` }
})

await control('NC-F6-byte-identical', async () => {
  const first = await import('./lib/old-path.mjs').then((module) => module.captureCorpus())
  const second = await import('./lib/old-path.mjs').then((module) => module.captureCorpus())
  const a = serializeGolden(first)
  const b = serializeGolden(second)
  if (a !== b) return { reason: 'two captures are not byte-identical' }
  const mutated = first.map((record, index) => index === 0 ? { ...record, state: `${record.state}#mutated` } : record)
  if (serializeGolden(mutated) === a) return { reason: 'a mutated record did not change the serialization (vacuous control)' }
  return { detail: 'identical captures, mutation detected' }
})

await control('NC-F7-no-host-shaped-path', async () => {
  const text = readFileSync(join(import.meta.dirname, 'golden', 'old-path.tsv'), 'utf8')
  const forbidden = [import.meta.dirname, '/home/', '.artifacts/tmp', 'w-AC-']
  const leaks = (value) => forbidden.filter((token) => value.includes(token))
  if (leaks(text).length > 0) return { reason: `the golden contains host-shaped path(s): ${leaks(text).join(',')}` }
  if (leaks(`${text}\n${import.meta.dirname}/x`).length === 0) return { reason: 'the leak scanner missed an injected repo path (vacuous control)' }
  return { detail: 'clean fixture, injected path detected' }
})

await control('NC-F8-census-unit-coverage', async () => {
  const census = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
  const unit = census.families.find((family) => family.familyId === 'dsh.agent-control-family')
  const members = unit.nativeNames.map((name) => name.replace('(bound-definition) ', ''))
  const missing = members.filter((member) => !COVERED_MEMBERS.includes(member))
  if (missing.length > 0) return { reason: `census member(s) with no corpus vector: ${missing.join(',')}` }
  const dropped = COVERED_MEMBERS.filter((member) => member !== 'workflow')
  if (dropped.length === members.length) return { reason: 'dropping a member left the coverage check green (vacuous control)' }
  return { detail: `${members.length}/${members.length} covered` }
})

await control('NC-F9-control-ask-witness', async () => {
  const allowRows = golden.filter((row) => row.outcome === 'allow')
  if (allowRows.length === 0) return { reason: 'no allow row to witness the PA ask' }
  const unasked = allowRows.filter((row) => !/(?:^|;)control=1(?:;|$)/u.test(row.facts))
  if (unasked.length > 0) return { reason: `admitted row(s) without a PA ask: ${unasked.map((row) => row.id).join(',')}` }
  const mutated = allowRows[0].facts.replace(/(?:^|;)control=1(?:;|$)/u, ';control=0;')
  if (/(?:^|;)control=1(?:;|$)/u.test(mutated)) return { reason: 'the ask detector did not see a control=0 mutation (vacuous control)' }
  return { detail: `${allowRows.length} admitted rows, each with one ask and an approve decision` }
})

await control('NC-F10-fixture-header', async () => {
  try {
    parseGolden('id\tentry\twrong\nAC-X\tX\tY\n')
    return { reason: 'a drifted header was accepted' }
  } catch {
    return { detail: 'the exact `id`/`entry` header is enforced' }
  }
})

/* ─────────────────────────────── the verdict ─────────────────────────────── */

say(`NC-VERDICT ${failed === 0 ? 'GREEN' : 'RED'} controls=${controls} failed=${failed}`)
mkdirSync(EVIDENCE_ROOT, { recursive: true })
const transcript = join(EVIDENCE_ROOT, 'negative-controls.txt')
writeFileSync(transcript, `${lines.join('\n')}\n`, 'utf8')
console.log(`NC-TRANSCRIPT ${relative(join(import.meta.dirname, '..', '..'), transcript)}`)
if (failed > 0) process.exit(1)
