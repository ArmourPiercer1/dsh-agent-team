/**
 * A5M2-G5 MOUNT-ARM (root 01:34 card): the plane carries the G5 goal face and
 * the `backends.goal` reader; WITHOUT an arm in `agent-bindings.mjs` nothing
 * ever feeds it — the census rows exist, no row mounts, and the natives stay
 * native. int measured exactly that gap (the plane imports the G5 modules and
 * walks `A5_G5_GOAL_TOOL_NAMES`, while the bindings carried zero G5 bytes).
 *
 * `createAgentBindings` needs a live Host agent ctx (the a5m2-g1-wire-c1 /
 * a5m2-provider-identity-c1 FP-B disclosure, verbatim law): no in-repo spec
 * has ever driven it. So the arm's OWN code is pinned at SOURCE level here
 * (the a5p7 pinned-edge class, the G3 transport pins at
 * a5m2-g3-terminal-wiring.test.ts:570-580 are the precedent shape), and its
 * runtime behavior on a real Host mount stays a Host verification point —
 * nothing here claims 已测试.
 *
 * What the pins hold:
 *  - TRANSPORT (the G3 root-G3A760 lesson): the guard AND the conditional
 *    spread must both carry `a5G5GoalInject`, and the plane must read exactly
 *    the key the union writes. A guard without the spread is the regression
 *    shape that refused every terminal session.
 *  - ZERO LITERAL GOAL FACTS in the arm: the block reads no tool name, no
 *    operation, no record index, no adapterRevision, no family literal, and
 *    imports nothing from the G5 lane modules — every goal fact comes from a
 *    live read (the public `goals` service, the member-scoped native capture,
 *    the durable family registry).
 *  - GATE SHAPE (G1/G3 precedent): the config carries the INTENT bit ONLY; a
 *    config VALUE that tries to inject supply is refused, so an externally
 *    supplied stand-in can never be called production-complete.
 *  - SUPPLY: the goals port rides the Host's lazy public `goals` accessor
 *    (`ctx.get('goals')`) end to end — no mirror, no second store, no cache.
 *  - FACTS ARE READ, NEVER ASSUMED: `readExecutionFacts` IS supplied — a
 *    trusted per-member producer that mirrors the host's own derivation
 *    (tool-goal/src/authority.ts:33-118 @639) over public faces the arm
 *    already holds (the live `agents` service, the `turnBoundary`
 *    projection, the public `snapshotEvents()`, the member's own `goals`
 *    service). It answers ONLY the adapter's closed kinds; every unreadable
 *    face or fact-free window lands as the adapter's honest UNOBSERVED —
 *    never a guessed kind, never a silent pass. The port-side law (the
 *    native requireDirectHuman/completionAuthority re-checks) is untouched:
 *    this pre-admission mirror never REPLACES a native check.
 * @module @dsh-agent-team/runtime/test/a5m2-g5-mount-arm
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const repoRoot = findTestRepoRoot(HERE)
if (repoRoot === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')

const BINDINGS = readFileSync(join(repoRoot, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
const PLANE = readFileSync(join(repoRoot, 'packages', 'runtime', 'src', 'plugin', 'live', 'team-tool-plane.mjs'), 'utf8')
const HOST = readFileSync(join(repoRoot, 'packages', 'runtime', 'src', 'plugin', 'host.ts'), 'utf8')
const WIRING_SRC = readFileSync(join(repoRoot, 'packages', 'runtime', 'src', 'plugin', 'live', 'governed-families', 'g5-goal-wiring.mjs'), 'utf8')

/** The arm's own text: its header through the closing brace, cut at the next
 *  lane block. Pinned on the block's two unique comment lines so a moved or
 *  deleted block fails CLOSED (an empty slice would silently pass regexes). */
function armBlock(): string {
  const start = BINDINGS.indexOf('A5M2 G5 GOAL SERVICE MOUNT-ARM')
  expect(start, 'the G5 mount-arm block exists in the bindings').toBeGreaterThan(-1)
  const rest = BINDINGS.slice(start)
  const end = rest.indexOf('// ── A5M2-B-TEAM-WIRE')
  expect(end, 'the G5 arm block is terminated by the next lane block').toBeGreaterThan(-1)
  return rest.slice(0, end)
}

describe('A5M2-G5 mount-arm — backends transport (the G3 root-G3A760 pinned-edge class)', () => {
  it('the bindings backends union carries the goal spread (not just the guard)', () => {
    expect(BINDINGS).toContain('...(a5G5GoalInject === null ? {} : { goal: a5G5GoalInject }),')
    // the guard alone (without the spread) was the terminal regression shape:
    expect(BINDINGS).toContain('a5G3TerminalInject === null && a5G5GoalInject === null')
  })
  it('the plane reads exactly input.backends?.goal', () => {
    expect(PLANE).toContain('const goalInjectRaw = input.backends?.goal')
  })
  it('the arm is DECLARED before the union reads it and the registration writer runs after publish', () => {
    const decl = BINDINGS.indexOf('let a5G5GoalInject = null')
    const union = BINDINGS.indexOf('...(a5G5GoalInject === null ? {} : { goal: a5G5GoalInject }),')
    const writer = BINDINGS.indexOf('g5GoalPlane.familyRegistrations()')
    const publish = BINDINGS.indexOf('const placed = built.value.mount(agentCtx)')
    expect(decl).toBeGreaterThan(-1)
    expect(decl).toBeLessThan(union)
    expect(publish).toBeGreaterThan(-1)
    expect(publish).toBeLessThan(writer)
  })
})

describe('A5M2-G5 mount-arm — zero literal goal facts, gate shape, and the real supply lines', () => {
  const arm = armBlock()

  it('the block carries NO goal fact of its own: no tool name, operation, record index, family or adapter revision', () => {
    for (const forbidden of [
      'get_goal', 'create_goal', 'update_goal',
      'goal-read', 'goal-create', 'goal-action-dispatch',
      'B-SESSION', 'A5_G5_GOAL',
    ]) {
      expect(arm.includes(forbidden), `arm carries the literal '${forbidden}'`).toBe(false)
    }
    // field NAMES in the live pairing read are legal; a goal fact VALUE is
    // not: no numeric adapter revision, no hand-written record index, no
    // re-typed familyId anywhere in the block.
    expect(arm).not.toMatch(/adapterRevision:\s*\d/)
    expect(arm).not.toMatch(/recordIndex:\s*\d/)
    expect(arm).not.toContain('familyId:')
    // …and it imports nothing from the G5 lane modules (the census lives in
    // the adapter; the arm reads it live or not at all).
    expect(BINDINGS).not.toMatch(/from '\.\/governed-families\/g5-goal/)
  })

  it('the gate is the config INTENT bit and NOTHING else; a config VALUE carrying supply is refused', () => {
    expect(arm).toContain('const g5GoalCfg = planeCfg?.g5Goal')
    expect(arm).toContain('if (g5GoalCfg !== undefined && g5GoalCfg !== null && g5GoalCfg !== false)')
    // the arm never reads a value off the gate: no `g5GoalCfg.` property read
    expect(arm.includes('g5GoalCfg.')).toBe(false)
    expect(arm.includes('g5GoalCfg[')).toBe(false)
    // …and the arm's bag keys are exactly the plane's closed known set (minus
    // the two optional facts this seam cannot supply), verified against the
    // PLANE's own g5Known — one closed key set, no drift.
    const known = PLANE.match(/const g5Known = new Set\(\[([^\]]*)\]\)/)?.[1] ?? ''
    const planeKeys = known.split(',').map((k) => k.trim().replace(/^'|'$/g, '')).filter((k) => k !== '').sort()
    expect(planeKeys).toEqual(['blockedAfterConsecutiveRounds', 'goals', 'providerId', 'readExecutionFacts', 'readNative', 'registrationOf'].sort())
    for (const supplied of ['providerId:', 'readNative:', 'goals:', 'registrationOf:']) {
      expect(arm).toContain(supplied)
    }
    // The facts producer IS carried now (root 02:51 P2): the arm mints the
    // per-member reader and hands it over. The threshold must NOT be carried
    // by the arm (root 05:5x): the blocked floor is the HOST TOOL's CONFIG
    // VALUE (tool-goal Config :32-40,:126-131 — the default 3 is the tool's
    // own fallback, not a fact this assembly read), the arm never read it,
    // and the adapter never defaults it: absent = UNTRUSTED, which closes
    // ONLY the goal-round blocked arm (pinned in the service spec).
    expect(arm).toContain('readExecutionFacts: g5ReadExecutionFacts,')
    expect(arm).not.toContain('blockedAfterConsecutiveRounds:')
  })

  it('the arm mints a TRUSTED per-member facts producer that mirrors authority.ts:33-118 over public faces — and never invents a kind', () => {
    const mint = arm.slice(arm.indexOf('const g5ReadExecutionFacts'))
    expect(mint.length).toBeGreaterThan(0)
    // driver gate (authority.ts:48-58): live-agent identity + running status
    // + the CURRENT initiator — ambient presence is never authority.
    expect(mint).toContain("runtimeAgent.status !== 'running'")
    expect(mint).toContain('agents.get(runtimeAgent.id) !== runtimeAgent')
    expect(mint).toContain('agents.currentInitiator() !== runtimeAgent')
    // the open-turn boundary (authority.ts:33-41): the host's OWN
    // 'turnBoundary' projection read, same face authority.ts reads.
    expect(mint).toContain("'turnBoundary'")
    expect(mint).toContain('stateOf(runtimeAgent.session')
    expect(mint).toContain('goal tools require an open model turn')
    // the window loop is the host's own (authority.ts:64-70): the snapshot
    // read from openTurnStartSeq + 1, the SAME two event predicates.
    expect(mint).toContain('for (let seq = g5Boundary.openTurnStartSeq + 1; seq < g5Events.length; seq += 1)')
    expect(mint).toContain("event.type === 'user/message' && event.data?.source?.kind === 'user'")
    expect(mint).toContain("event.data?.source?.kind === 'goal'")
    expect(mint).toContain('event.data.source.round === g5Goal.roundsStarted')
    // direct-human needs ROOT membership too (authority.ts:80-86).
    expect(mint).toContain('agents.roots().includes(runtimeAgent)')
    // a driver-less / boundary-less read THROWS (the adapter lands honest
    // UNOBSERVED); a fact-free window answers NO closed kind — `{}` — which
    // the adapter reports as unobserved, never as a pass.
    expect(mint).toContain("throw new Error('GOAL_TOOL_DRIVER_REQUIRED mirror")
    expect(mint).toContain('return {}\n            }')
    // the ZERO-LITERAL law still holds across the mint (no goal vocabulary):
    for (const forbidden of ['get_goal', 'create_goal', 'update_goal', 'goal-read', 'goal-create', 'goal-action-dispatch', 'B-SESSION', 'A5_G5_GOAL']) {
      expect(mint).not.toContain(forbidden)
    }
    // …and the ONLY closed kinds the producer can answer are the contract's
    // two bytes, each returned as a bare {kind} with nothing invented:
    const kinds = mint.match(/return \{ kind: '([a-z-]+)' \}/g) ?? []
    expect(kinds).toEqual(["return { kind: 'direct-human' }", "return { kind: 'goal-round' }"])
  })

  it('the goals port is the Host public `goals` service, read lazily end to end', () => {
    // host: the lazy public accessor, additive optional (never hard-injected)
    expect(HOST).toContain("goals: () => ctx.get('goals'),")
    // bindings: the accessor is a dep, resolved at mount moment and handed to
    // the plane as `goals` — the live face, not a mirror of it
    expect(BINDINGS).toContain('goals: goalServiceBackend } = deps')
    expect(arm).toContain('typeof goalServiceBackend === \'function\' ? goalServiceBackend() : undefined')
    expect(arm).toContain('goals: g5GoalsService,')
    // an absent service is an honest census, never an invented port
    expect(arm).toContain('family UNARMED')
  })

  it('the natives are the MEMBER-SCOPED capture (the global face is not a fallback); an unreadable Agent refuses', () => {
    expect(arm).toContain('agentCtx.tools.get(name, runtimeAgent)')
    expect(arm).toContain("const error = new Error(\n              `agent-bindings: alpha.5 governed G5 goal mount refused for '${sessionId}': ${why}`,")
    expect(arm).toContain("error.code = 'alpha5-g5-arm-mount-refused'")
  })

  it('registrationOf reads the durable registry LIVE (no getter, no second store), and its bytes match the familyRegistrations entry the writer registers', () => {
    expect(arm).toContain('const entry = a5GovernedFamilyFor(key)')
    expect(arm).toContain('return { adapterRevision: entry.adapterRevision, providerIdentity: entry.providerIdentity }')
    // the registration entry the wiring hands the writer carries exactly the
    // three fields the durable registry requires — the pairing read compares
    // the same two fields the wiring claims against (root ⑤ law)
    expect(WIRING_SRC).toContain('adapterRevision: rowEntry.row.adapterRevision')
    expect(WIRING_SRC).toContain('providerIdentity: providerId')
    expect(WIRING_SRC).toContain('familyId: rowEntry.row.familyId')
    // the claim the wiring compares against is the SAME adapter revision and
    // provider identity the arm can read back
    expect(WIRING_SRC).toContain('current.adapterRevision !== A5_G5_ADAPTER_REVISION || current.providerIdentity !== providerId')
  })

  it('ABSENCE IS NOT FALSE (the port law the arm\'s supply must satisfy): the adapter ACCEPTS a missing facts reader (rows then report UNOBSERVED) and refuses a non-function supply rather than reading it as unchecked-but-passed', async () => {
    const adapter = await import(new URL('../src/plugin/live/governed-families/g5-goal-service.mjs', import.meta.url).href) as {
      createG5GoalServiceAdapter: (input: Record<string, unknown>) => unknown
    }
    const goals = { get: () => undefined, create: () => undefined, edit: () => undefined, pause: () => undefined, resume: () => undefined, complete: () => undefined, block: () => undefined }
    const base = { realmId: 'r-arm', providerId: 'p-arm', readNative: () => undefined, goals }
    // missing supply: the port law ACCEPTS it (the rows then report UNOBSERVED
    // with the named gap — a5m2-g5-goal-service-c1 pins those bytes)
    expect(() => adapter.createG5GoalServiceAdapter({ ...base })).not.toThrow()
    // supplied-but-not-a-function is an assembly defect, never a silent pass
    for (const bad of [null, false, 0, 'direct-human']) {
      expect(() => adapter.createG5GoalServiceAdapter({ ...base, readExecutionFacts: bad }), String(bad)).toThrow(/readExecutionFacts/)
    }
  })
})

describe('A5M2-G5 mount-arm — zero flip when the gate is closed', () => {
  it('no config evidence, no inject: the arm is a gated block keyed solely on the gate read', () => {
    const arm = armBlock()
    // the whole arm sits inside the gate; nothing outside it touches the union
    expect(arm.startsWith('A5M2 G5 GOAL SERVICE MOUNT-ARM')).toBe(true)
    expect(arm.match(/planeCfg\?\.g5Goal/g)?.length).toBe(1)
    // the spread is the ONLY way the goal key can reach the plane
    expect(BINDINGS.match(/\{ goal: a5G5GoalInject \}/g)?.length).toBe(1)
    // …and there is exactly one hoist of the inject face
    expect(BINDINGS.match(/let a5G5GoalInject = null/g)?.length).toBe(1)
  })
})
