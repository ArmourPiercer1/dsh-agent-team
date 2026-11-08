/**
 * PD-34 (MEMBER-STOP) — host-free pins for the entry the live pair cannot keep
 * honest on its own.
 *
 * The live evidence (`dev/agent-workflow/evidence/a5sf-pd34-member-stop/`) is
 * the acceptance: a real Host, a real governed Member running an unbroken goal,
 * and the UI's own four RPCs (`goals/get` -> `goals/pause` -> `session/cancel`
 * -> `goals/get`) stopping it with zero rounds / tool calls / model requests in
 * a 20 000 ms window. This suite is the cheap guard that keeps that shape from
 * rotting:
 *
 *   PD34-MODEL-SEQUENCE  the pure model issues the four calls in the measured
 *                        order, and nothing else (no archive, no local patch).
 *   PD34-INJECT          the mount injects the two PUBLIC namespaces the
 *                        sequence rides (`remote.goals`, `remote.session`) —
 *                        the goal bar's own — and adds no private endpoint.
 *   PD34-VIEW-ENTRY      the Team view renders a per-Member control AND a
 *                        distinct Leader-turn control, with different copy.
 *   PD34-DRIVER-WIRE     the live driver issues the same four calls in the same
 *                        order (the evidence cannot drift from the model).
 *   PD34-NO-SIMULATION    the stop handler never touches the projection or the
 *                        §40 lifecycle command state (no optimistic patch).
 *   PD34-MUTATION        a copy of the model with the `pause` call deleted
 *                        reddens PD34-MODEL-SEQUENCE (the arm has teeth).
 *
 * No boot, no Host, no policy compiler: `CORE PATCH BUDGET = 0`, and nothing
 * here imports the upstream tree.
 *
 * @module tests/world-factory/a5sf-pd34-member-stop.test
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const HERE = fileURLToPath(new URL('.', import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const MODEL = 'packages/client/src/model/member-stop.ts'
const MOUNT = 'packages/client/src/plugin/team-mount-core.ts'
const VIEW = 'packages/client/src/ui/TeamMembers.tsx'
const DRIVER = 'tests/world-factory/drivers/a5sf-pd34-member-stop/run-boot.mjs'
const README = 'dev/agent-workflow/evidence/a5sf-pd34-member-stop/README.md'

function read(rel) {
  return readFileSync(join(REPO_ROOT, rel), 'utf8')
}

/**
 * Ordered positions of every needle, searched SEQUENTIALLY from the previous
 * hit (so a repeated needle — the closing `get` — must occur again AFTER the
 * earlier ones, not match the first one twice).
 * @param source - the text to search.
 * @param needles - the ordered substrings.
 * @returns the positions.
 */
function ordered(source, needles) {
  const positions = []
  let from = 0
  for (const needle of needles) {
    const at = source.indexOf(needle, from)
    assert.notEqual(at, -1, `missing ${needle} (after offset ${from})`)
    positions.push(at)
    from = at + needle.length
  }
  return positions
}

/** The stop sequence as the model spells it: the seam call sites, in order. */
const SEQUENCE = [
  'goals.get(memberSessionId)',
  'goals.pause(memberSessionId',
  'cancelTurn(seams, memberSessionId)',
  'goals.get(memberSessionId)',
]

test('PD34-MODEL-SEQUENCE: the model issues get -> pause -> cancel -> get, and owns no archive', () => {
  const source = read(MODEL)
  const start = source.indexOf('export async function stopMember')
  assert.notEqual(start, -1, 'stopMember must exist')
  const body = source.slice(start)
  assert.ok(source.includes('session.cancel({ sessionId })'), 'the turn abort must ride session/cancel')
  ordered(body, SEQUENCE)
  // The second read is what the UI reports; the model must not fake a phase.
  assert.ok(source.includes('observedPhase'), 'the outcome must carry the OBSERVED phase')
  // Stop is not archive: the model may not mention the lifecycle command.
  assert.equal(body.includes('member.archive'), false, 'the per-Member stop must not reach archive')
  assert.equal(/\.archive\(|archiveMember|memberArchive/u.test(source), false, 'the model owns no archive call')
  // MAX one pause: a second pause would mean a retry loop with no new read.
  assert.equal(body.split('goals.pause(memberSessionId').length - 1, 1, 'exactly one pause call site')
})

test('PD34-INJECT: the mount injects the public goals/session namespaces, no private endpoint', () => {
  const source = read(MOUNT)
  assert.ok(source.includes("'remote.goals'"), 'inject must carry remote.goals')
  assert.ok(source.includes("'remote.session'"), 'inject must carry remote.session')
  assert.ok(source.includes('memberStop'), 'the command face must expose memberStop')
  assert.ok(source.includes('leaderStopTurn'), 'the command face must expose leaderStopTurn')
  // The stop rides the public namespaces, not a new team-remote method.
  assert.equal(/team-remote[^\n]*stop/iu.test(source), false, 'no private stop endpoint')
})

test('PD34-VIEW-ENTRY: a per-Member control and a DISTINCT Leader-turn control', () => {
  const source = read(VIEW)
  assert.ok(source.includes('data-member-stop'), 'the per-Member stop control must render')
  assert.ok(source.includes('data-leader-stop'), 'the Leader-turn control must render')
  // The two semantics must not share copy: the Leader hint says it does NOT
  // stop delegated Members, and it is a different locale key.
  assert.ok(source.includes("t('member.stop.leader.hint')"), 'the Leader control must carry its own hint')
  assert.ok(source.includes("t('member.stop.hint')"), 'the Member control must carry the per-Member hint')
  assert.notEqual(
    source.indexOf("t('member.stop.hint')"),
    source.indexOf("t('member.stop.leader.hint')"),
    'the two controls must not share the same hint',
  )
  // The per-Member control is rendered only for live rows with a bound child.
  assert.ok(source.includes('canStopMember'), 'the lifecycle gate must exist')
  assert.ok(source.includes("instance.childSessionId !== ''"), 'the control requires a bound child session')
})

test('PD34-DRIVER-WIRE: the live driver issues the same four calls in the same order', () => {
  const source = read(DRIVER)
  const uiStart = source.indexOf('S1-UISTOP: the TEAM VIEW')
  assert.notEqual(uiStart, -1, 'the driver must carry the UI arm')
  const block = source.slice(uiStart, source.indexOf('The explicit authorised restore', uiStart))
  ordered(block, [
    'goalGet(origin, cookie, sessionOf.s1)',
    "goalRpc(origin, cookie, 'pause'",
    'apiSessionCancel(origin, cookie, sessionOf.s1',
    'goalGet(origin, cookie, sessionOf.s1)',
  ])
})

test('PD34-NO-SIMULATION: the stop handler patches nothing locally', () => {
  const source = read(VIEW)
  const start = source.indexOf('const runStopMember = ')
  const end = source.indexOf('const runStopLeaderTurn = ', start)
  assert.notEqual(start, -1, 'the handler must exist')
  assert.notEqual(end, -1, 'the Leader handler must exist')
  const handler = source.slice(start, end)
  // No optimistic authority patch and no §40 command bookkeeping: the row's
  // lifecycle stays projection-driven until a new frame lands.
  assert.equal(handler.includes('pullProjection'), false, 'the stop handler must not pull as a local patch')
  assert.equal(handler.includes('setPending('), false, 'the stop must not ride the §40 command pending map')
  assert.equal(handler.includes('setErrors('), false, 'the stop must not ride the §40 command error map')
  // It reports what the face returned, not a constant.
  assert.ok(handler.includes('setStopOutcomes'), 'the handler must store the observed outcome')
})

test('PD34-EVIDENCE: the evidence README names the source id and the honest UI limit', () => {
  const source = read(README)
  assert.ok(source.includes('MEMBER-STOP'), 'the README must carry the lane id')
  assert.ok(source.includes('PD-34'), 'the README must carry the register id')
  assert.ok(
    source.includes('NOT clicked') || source.includes('was NOT performed') || source.includes('未点击'),
    'the README must disclose that the headless browser click was not performed',
  )
})

test('PD34-MUTATION: deleting the pause call reddens the sequence pin', () => {
  const source = read(MODEL)
  const mutated = source.replace('goals.pause(memberSessionId, { id: current.id, revision: current.revision })', 'undefined')
  assert.notEqual(mutated, source, 'the mutation must actually delete the pause call')
  const dir = mkdtempSync(join(tmpdir(), 'pd34-mutation-'))
  try {
    const path = join(dir, 'member-stop.ts')
    writeFileSync(path, mutated)
    const copy = readFileSync(path, 'utf8')
    let reddened = false
    try {
      ordered(copy.slice(copy.indexOf('export async function stopMember')), SEQUENCE)
    } catch {
      reddened = true
    }
    assert.equal(reddened, true, 'the arm must have teeth: the mutated copy must fail the order pin')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('PD34-PIN: the entry did not exist at the lane base', () => {
  const base = process.env.A5SF_PD34_BASE ?? '3101ca08f'
  let exists = true
  try {
    execFileSync('git', ['cat-file', '-e', `${base}:${MODEL}`], { cwd: REPO_ROOT, stdio: 'ignore' })
  } catch {
    exists = false
  }
  assert.equal(exists, false, `the model must not already exist at ${base}`)
})
