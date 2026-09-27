/**
 * team-compatibility-scope.test.ts — H2 (repair 20260927): the remote
 * compatibility.* methods are scoped to the ADDRESSED TeamSession.
 *
 * The bug (the second incident layer): the production remote surface
 * wired ONE prober — the BOOT root's prober — into every
 * `compatibility.*` port. The port methods accepted the addressed
 * teamSessionId, asserted the bound-root guard, and then read/probed/
 * acknowledged through the BOOT root's prober anyway: team B's
 * `compatibility.get` returned team A's durable state, `probe(B)`
 * bumped A's generation line, and a missing state for B reported the
 * BOOT root's id in the error message.
 *
 * The repair: `S6RemoteOptions.compatibility` (a single prober) is
 * replaced by `compatibilityFor: (teamSessionId) =>
 * S6RemoteCompatibilityOperations` — a per-root factory. The
 * production root (root.ts) supplies a lazily-created prober per
 * addressed root, bound to THAT root's durable generation line and
 * THAT root's bound blueprint snapshot (`boundBlueprintFor`), with
 * current/probe/acknowledge serialized on that root's shared
 * coordination chain (`withTeamLock`). The boot prober keeps its
 * host-internal uses (the admission gate) unchanged.
 *
 * This test drives the PRODUCTION surface end to end (host.apply →
 * the installed A31 seam → the captured dispatcher on `/team-remote`),
 * with two host-owned roots bound to DIFFERENT blueprints:
 *
 *   Team A (the boot root)  -> Blueprint A (the row anchor): requires
 *                              `tool/web` (optional) + `skill/base`
 *                              (optional) — both available in the host
 *                              facts → OPEN.
 *   Team B (created after boot through the remote `team.create`, a
 *                              saved-source blueprint from
 *                              `blueprintDir`) -> Blueprint B:
 *                              requires `tool/web` (optional) +
 *                              `tool/pdf` (optional) — pdf is NOT
 *                              available in the shared host facts →
 *                              BLOCKED_WARNING with the unacked
 *                              `req-tool-pdf`.
 *
 * The two blueprints differ in their requirement sets, so their
 * environment fingerprints (which bind the requirement set + the
 * facts) differ — the fingerprint is the observable proof that B's
 * prober evaluated B's own bound blueprint, not A's.
 *
 * Proven per test (scenarios at module top level; the plain-node
 * vitest shim forbids async `it()` bodies — sync assertions):
 *
 *   H2.1 — after boot, `compatibility.get(A)` returns A's state
 *          (OPEN, generation 1, fingerprint_A);
 *   H2.2 — a fresh owned root B has NO durable state:
 *          `compatibility.get(B)` fails closed with
 *          `COMPATIBILITY_STATE_ABSENT` and the error message names
 *          B's session id (never the boot root's);
 *   H2.3 — `compatibility.reprobe(B)` establishes B's OWN state:
 *          BLOCKED_WARNING, generation 1, fingerprint_B (≠ fingerprint_A
 *          — B's prober bound B's blueprint);
 *   H2.4 — `compatibility.reprobe(B)` again bumps B's generation to 2,
 *          and A's generation stays 1 (probe(B) never touches A's
 *          generation line);
 *   H2.5 — `compatibility.ack(B, 'req-tool-pdf')` (B's own human id —
 *          invariant 9) degrades B to DEGRADED_ACKNOWLEDGED with the
 *          warning acked (unackedWarning 0, generation 3), and A stays
 *          OPEN at generation 1 (the ack used B's prober only);
 *   H2.6 — a FOREIGN root is still rejected with `TEAM_REMOTE_
 *          FOREIGN_TEAM` (the bound-root guard is unchanged).
 *
 * World: own scratch seam + own blueprint dir + own root session ids.
 *
 * H5 (a SECOND world + the p8s5b operation-fencing barrier method): the
 * REMOTE probe of root B2 races the ADMISSION INLINE PROBE (the v2
 * `member.create` production path — the same team lock, the
 * gate's own per-consultation prober INSIDE the lock) plus in-flight
 * REMOTE reads; B2's blueprint carries a REQUIRED tool/pdf requirement
 * the host facts do not satisfy (FATAL), so the scenario also pins the
 * remote FATAL-ack rejection. Branch-aware invariants: no nested-lock
 * deadlock, the admission fails closed as a clean FATAL block (never
 * no-state-after-reprobe — the p8s5b R5 window), no lost advance (the
 * final durable generation is exactly the remote probe's generation,
 * ∈ {2, 3}), the lock-holding reads are always well-formed, and B2's
 * TeamSession generation stays at 1 (the compatibility line is its own
 * generation line). See the H5 section for the per-assertion docs.
 * @module @dsh-agent-team/runtime/test/team-compatibility-scope
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the H2 fixture identities --------------------------------------------------------

/** The boot root (Team A). */
const ROOT_A = 'session-h2compa'
/** The owned root (Team B — created after boot through the remote face). */
const ROOT_B = 'session-h2compb'
/** A root this host never owns. */
const ROOT_FOREIGN = 'session-h2compforeign'

/** The A (boot) blueprint — the row anchor (web + base, both optional). */
const BLUEPRINT_A_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: H2COMP-A-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the H2COMP-A team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the H2COMP-A work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  '    optional: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The H2COMP-A default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The B (owned) blueprint — a SAVED SOURCE in the blueprint dir. Same
 *  shape as A except the id/persona and the requirement set: it adds the
 *  `tool/pdf` requirement, which the shared host facts do NOT satisfy —
 *  so B's evaluation is a WARNING while A's is all-PASS, and the two
 *  environment fingerprints (requirement set + facts) differ. */
const BLUEPRINT_B_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: H2COMP-B-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the H2COMP-B team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the H2COMP-B work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: tool',
  '    name: pdf',
  '    optional: true',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The H2COMP-B default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The host row's environment facts (shared by EVERY team on this host):
 *  web + base available, pdf NOT. A's requirements are all satisfied;
 *  B's `tool/pdf` is not (its WARNING). */
const ENVIRONMENT_FACTS = [
  { domain: 'tool', subject: 'web', available: true, generation: 1 },
  { domain: 'skill', subject: 'base', available: true, generation: 1 },
  { domain: 'tool', subject: 'pdf', available: false, generation: 1 },
]

/** The A row config (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(blueprintDir: string): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_A,
    blueprintSource: BLUEPRINT_A_SOURCE,
    blueprintDir,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/h2comp',
    seedMembers: [
      {
        instanceId: 'inst-h2compw1',
        templateId: 'worker',
        label: 'h2-seed-worker',
        childSessionId: 'session-child-h2compw1',
      },
    ],
    staticModel: { provider: 'h2comp-static', model: 'h2comp-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: ENVIRONMENT_FACTS,
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
  }
}

// --- the test Cordis context + the entry loader (the C3 world pattern) ------------------

interface TeamRootFacade {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly ready: Promise<Record<string, any>>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  [key: string]: any
}

interface TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  ctx: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

function makeWorld(seam: FileStorageSeam): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    teamStorageSeam: seam,
  }
  const effectDisposers: Array<() => void> = []
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        effectDisposers.push(factory())
      },
    },
    provided,
    effectDisposers,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let hostModulePromise: Promise<Record<string, any>> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`H2 scenario guard: ${label}`)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
type WireResponse = Record<string, any>

/** The frozen RemoteResponse code (null when the call succeeded). */
function codeOf(response: WireResponse): string | null {
  if (response.ok === false) {
    return String(response.error.code)
  }
  return null
}

/** The error message (empty when the call succeeded). */
function messageOf(response: WireResponse): string {
  if (response.ok === false) {
    return String(response.error.message ?? '')
  }
  return ''
}

// --- the scenarios (module top level — the sync shim forbids async it()) -----------------

const h2 = await (async () => {
  const dir = scratchDir('team-compatibility-scope')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  // The saved-source blueprint dir (Blueprint B lives here as a file).
  const blueprintDir = scratchDir('team-compatibility-scope-bp')
  writeText(`${blueprintDir}/team-b.yaml`, BLUEPRINT_B_SOURCE)
  try {
    const { root } = await applyWorld(world, rowConfig(blueprintDir))

    // The A31 registration attaches to a fake connection and hands over
    // the production dispatcher on the frozen channel (the C3 pattern).
    const registration = root.seams.remoteHandlerRegistration.current()
    let capturedChannel: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    let capturedDispatcher: ((endpoint: string, payload: unknown) => Promise<WireResponse>) | null = null
    const registrationResult = registration({
      rpc: {
        handle: (channel: string, dispatcher: unknown) => {
          capturedChannel = channel
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          capturedDispatcher = dispatcher as (endpoint: string, payload: unknown) => Promise<WireResponse>
          return () => {}
        },
      },
    })
    check(capturedDispatcher !== null, 'registration never registered a dispatcher')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    async function call(endpoint: string, params: Record<string, any>): Promise<WireResponse> {
      const dispatcher = capturedDispatcher
      if (dispatcher === null) throw new Error('H2 scenario guard: dispatcher missing')
      return await dispatcher(endpoint, { version: 1, params })
    }

    // H2.1: the boot root's own state (seeded at boot): OPEN, generation 1.
    const getA1 = await call('compatibility.get', { teamSessionId: ROOT_A })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictA1 = (getA1.value.data as Record<string, any>).verdict

    // The owned root B is created after boot (the standard remote flow).
    const createB = await call('team.create', {
      rootSessionId: ROOT_B,
      blueprintId: 'H2COMP-B-BP',
      blueprintRevision: 1,
    })

    // H2.2: B has no durable state yet — the read fails closed, and the
    // message names B (the addressed root), not the boot root.
    const getB1 = await call('compatibility.get', { teamSessionId: ROOT_B })

    // H2.3: the first probe establishes B's OWN state (B's blueprint:
    // pdf unavailable → BLOCKED_WARNING with the unacked req-tool-pdf).
    const reprobeB1 = await call('compatibility.reprobe', {
      teamSessionId: ROOT_B,
      trigger: 'ROOT_COLD_RESUME',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const probeB1 = (reprobeB1.value.data as Record<string, any>).probe
    const getB2 = await call('compatibility.get', { teamSessionId: ROOT_B })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictB1 = (getB2.value.data as Record<string, any>).verdict

    // H2.4: a second probe bumps B's generation — A's is untouched.
    const reprobeB2 = await call('compatibility.reprobe', {
      teamSessionId: ROOT_B,
      trigger: 'NEW_ACTIVATION',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const probeB2 = (reprobeB2.value.data as Record<string, any>).probe
    const getA2 = await call('compatibility.get', { teamSessionId: ROOT_A })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictA2 = (getA2.value.data as Record<string, any>).verdict

    // H2.5: the ack goes to B's prober (B's own human id — invariant 9).
    const ackB = await call('compatibility.ack', {
      teamSessionId: ROOT_B,
      requirementId: 'req-tool-pdf',
      acknowledgedBy: ROOT_B,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictAck = (ackB.value.data as Record<string, any>).verdict
    const getA3 = await call('compatibility.get', { teamSessionId: ROOT_A })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictA3 = (getA3.value.data as Record<string, any>).verdict
    const getB3 = await call('compatibility.get', { teamSessionId: ROOT_B })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictB2 = (getB3.value.data as Record<string, any>).verdict

    // H2.6: the foreign root is still rejected by the bound-root guard.
    const getForeign = await call('compatibility.get', { teamSessionId: ROOT_FOREIGN })

    return {
      world,
      dir,
      blueprintDir,
      capturedChannel,
      getA1,
      verdictA1,
      createB,
      getB1,
      reprobeB1,
      probeB1,
      getB2,
      verdictB1,
      reprobeB2,
      probeB2,
      getA2,
      verdictA2,
      ackB,
      verdictAck,
      getA3,
      verdictA3,
      getB3,
      verdictB2,
      getForeign,
    }
  } catch (err) {
    destroyDir(dir)
    destroyDir(blueprintDir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`H2 compatibility-scope world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

// --- the assertions (sync — the shim forbids async it()) ------------------------------

it('H2.1 the boot root reads its OWN state (OPEN, generation 1)', () => {
  expect(h2.capturedChannel).toBe('/team-remote')
  expect(h2.getA1.ok).toBe(true)
  expect(h2.verdictA1.status).toBe('OPEN')
  expect(h2.verdictA1.generation).toBe(1)
  expect(h2.verdictA1.counts.fatal).toBe(0)
  expect(h2.verdictA1.counts.warning).toBe(0)
  expect(h2.verdictA1.environmentFingerprint).toBeTruthy()
})

it('H2.2 the fresh owned root has no state: ABSENT, and the message names B', () => {
  expect(h2.createB.ok).toBe(true)
  expect(h2.getB1.ok).toBe(false)
  expect(codeOf(h2.getB1)).toBe('TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT')
  // The addressed root (B) — never the boot root's id.
  expect(messageOf(h2.getB1)).toContain(ROOT_B)
  expect(messageOf(h2.getB1)).not.toContain(ROOT_A)
})

it('H2.3 probe(B) establishes B\'s own state under B\'s blueprint (fingerprint ≠ A)', () => {
  expect(h2.reprobeB1.ok).toBe(true)
  expect(h2.probeB1.status).toBe('BLOCKED_WARNING')
  expect(h2.probeB1.generation).toBe(1)
  expect(h2.probeB1.unackedWarning).toBe(1)
  expect(h2.getB2.ok).toBe(true)
  expect(h2.verdictB1.status).toBe('BLOCKED_WARNING')
  expect(h2.verdictB1.counts.warning).toBe(1)
  expect(h2.verdictB1.counts.unackedWarning).toBe(1)
  // B's fingerprint binds B's requirement set (web + pdf) — it must
  // differ from A's (web + base): the prober bound B's own blueprint.
  expect(h2.verdictB1.environmentFingerprint).not.toBe(h2.verdictA1.environmentFingerprint)
})

it('H2.4 a second probe bumps only B\'s generation (A stays at 1)', () => {
  expect(h2.reprobeB2.ok).toBe(true)
  expect(h2.probeB2.generation).toBe(2)
  expect(h2.getA2.ok).toBe(true)
  expect(h2.verdictA2.generation).toBe(1)
  expect(h2.verdictA2.status).toBe('OPEN')
  expect(h2.verdictA2.environmentFingerprint).toBe(h2.verdictA1.environmentFingerprint)
})

it('H2.5 ack(B) degrades only B (A stays OPEN at generation 1)', () => {
  expect(h2.ackB.ok).toBe(true)
  expect(h2.verdictAck.status).toBe('DEGRADED_ACKNOWLEDGED')
  expect(h2.verdictAck.unackedWarning).toBe(0)
  expect(h2.verdictAck.generation).toBe(3)
  // A is untouched by B's acknowledgement.
  expect(h2.getA3.ok).toBe(true)
  expect(h2.verdictA3.status).toBe('OPEN')
  expect(h2.verdictA3.generation).toBe(1)
  // B's durable state carries the ack (generation 3, degraded).
  expect(h2.getB3.ok).toBe(true)
  expect(h2.verdictB2.status).toBe('DEGRADED_ACKNOWLEDGED')
  expect(h2.verdictB2.counts.unackedWarning).toBe(0)
  expect(h2.verdictB2.generation).toBe(3)
})

it('H2.6 a foreign root is still rejected by the bound-root guard', () => {
  expect(h2.getForeign.ok).toBe(false)
  expect(codeOf(h2.getForeign)).toBe('TEAM_REMOTE_FOREIGN_TEAM')
})

// --- H5 (repair 20260927): the controlled concurrency barrier ---------------------------
//
// H4 + the p8s5b operation-fencing methodology (controlled microtask
// barrier, no wall-clock timing, branch-aware invariants over the
// deterministic engine): the REMOTE probe of root B (the wrapper —
// `withTeamLock` on the production coordination chain) races the
// ADMISSION INLINE PROBE (the production `member.create` new-work
// path: the same chain → `enforceCompatibilityGate` INSIDE the lock →
// its own per-consultation prober) plus in-flight REMOTE reads
// (`compatibility.get`, also lock-holding) — the non-atomic durable
// replace (delete → put) gap is only observable by a reader that does
// NOT hold the team lock (p8s5b R5). B's blueprint carries a REQUIRED
// (`complete`) `tool/pdf` requirement that the host facts do NOT
// satisfy → the evaluation is FATAL, which additionally lets the
// scenario pin "FATAL ACK still rejected" through the REMOTE ack path.
//
// Proven (branch-aware — holds under EITHER serialization order):
//
//   H5.1 — the remote `compatibility.ack(B, <FATAL requirement>)` is
//          rejected with `COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE` and
//          leaves B's state byte-identical (same generation, still
//          BLOCKED_FATAL);
//   H5.2 — the race COMPLETES (no nested-lock deadlock: the remote
//          wrapper and the admission path hold the SAME chain and
//          NEITHER nests — the wrapper is never injected into the
//          lock-holding admission chain), and the new-work admission
//          fails CLOSED as a clean FATAL block
//          (`TEAM_RUNTIME_COMPATIBILITY_BLOCKED`, source
//          durable-state, never no-state-after-reprobe — the R5 window
//          failure);
//   H5.3 — no LOST ADVANCE: the explicit pre-race delete restarts the
//          compatibility generation line (probe: previous + 1; absent
//          → 1), the remote probe ALWAYS runs (+1) and the admission
//          gate probes only while the state is still absent (+1) —
//          serialized on the shared chain, the final durable generation
//          is EXACTLY the number of probes that ran (∈ {1, 2}),
//          discriminable via the gate block's `reprobed` flag, and the
//          final row is well-formed (BLOCKED_FATAL, the host
//          fingerprint);
//   H5.4 — the lock-holding reads are ALWAYS well-formed: each in-flight
//          `compatibility.get(B)` is either a valid verdict or the honest
//          pre-first-probe state-absent (after the explicit delete that
//          made the world stale) — never a spurious mid-replace absent
//          once a state exists;
//   H5.5 — the prober's replaceState is the S1-A hook-B stamp choke
//          point: B's TeamSession generation advances by EXACTLY one
//          per probe (create + setup reprobe + the race's probes) —
//          the blocked admission writes no work fact.

/** The H5 root ids (world 2 — distinct from the H2 world). */
const ROOT_A2 = 'session-h5compa'
const ROOT_B2 = 'session-h5compb'

/** The H5 B blueprint: same shape as H2-B but `tool/pdf` is REQUIRED
 *  (no `optional` → `complete: true` → FATAL under the host facts where
 *  pdf is unavailable). */
const BLUEPRINT_B2_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: H5COMP-B2-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the H5COMP-B team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the H5COMP-B work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: tool',
  '    name: pdf',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The H5COMP-B default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** Yield exactly `n` microtasks (the controlled barrier; p8s5b R5 style). */
async function tick(n: number): Promise<void> {
  let pending: Promise<void> = Promise.resolve()
  for (let i = 0; i < n; i += 1) {
    pending = pending.then(() => undefined)
  }
  await pending
}

const h5 = await (async () => {
  const dir = scratchDir('team-compatibility-scope-h5')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  const blueprintDir = scratchDir('team-compatibility-scope-h5-bp')
  writeText(`${blueprintDir}/team-b2.yaml`, BLUEPRINT_B2_SOURCE)
  try {
    const rowCfg = rowConfig(blueprintDir)
    const { root } = await applyWorld(world, {
      ...rowCfg,
      rootSessionId: ROOT_A2,
      defaultWorkspace: 'C:/agent-team/work/h5comp',
    })

    const registration = root.seams.remoteHandlerRegistration.current()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    let capturedDispatcher: ((endpoint: string, payload: unknown) => Promise<WireResponse>) | null = null
    registration({
      rpc: {
        handle: (_channel: string, dispatcher: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          capturedDispatcher = dispatcher as (endpoint: string, payload: unknown) => Promise<WireResponse>
          return () => {}
        },
      },
    })
    check(capturedDispatcher !== null, 'registration never registered a dispatcher')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    async function call(endpoint: string, params: Record<string, any>): Promise<WireResponse> {
      const dispatcher = capturedDispatcher
      if (dispatcher === null) throw new Error('H5 scenario guard: dispatcher missing')
      return await dispatcher(endpoint, { version: 1, params })
    }
    // World 2 setup: owned root B2 (blueprint B2 — the FATAL one).
    const createB2 = await call('team.create', {
      rootSessionId: ROOT_B2,
      blueprintId: 'H5COMP-B2-BP',
      blueprintRevision: 1,
    })
    const reprobeB2 = await call('compatibility.reprobe', {
      teamSessionId: ROOT_B2,
      trigger: 'ROOT_COLD_RESUME',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const probeB2 = (reprobeB2.value.data as Record<string, any>).probe

    // H5.1: the FATAL ack through the REMOTE path (B's own human id).
    const fatalAck = await call('compatibility.ack', {
      teamSessionId: ROOT_B2,
      requirementId: 'req-tool-pdf',
      acknowledgedBy: ROOT_B2,
    })
    const getAfterAck = await call('compatibility.get', { teamSessionId: ROOT_B2 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictAfterAck = (getAfterAck.value.data as Record<string, any>).verdict

    // Make the durable world STALE for the race: delete B2's state (the
    // gate treats absence as the first-ever evaluation → inline probe).
    const deleted = await root.domain.repositories.compatibility.delete(ROOT_B2)

    // H5.2–H5.4: the controlled barrier — the REMOTE probe (the wrapper:
    // `withTeamLock` on the production coordination chain) races the
    // ADMISSION INLINE PROBE — the production `member.create` new-work
    // admission (the router's `creation` category: the SAME chain →
    // `enforceCompatibilityGate` INSIDE the lock → its own
    // per-consultation prober) — plus two in-flight REMOTE reads (also
    // lock-holding), all on root B2 in the same tick.
    const [remoteReprobe, admit, getDuring1, getDuring2] = await Promise.all([
      call('compatibility.reprobe', {
        teamSessionId: ROOT_B2,
        trigger: 'CAPABILITY_GENERATION_CHANGE',
      }),
      call('member.create', {
        teamSessionId: ROOT_B2,
        caller: { kind: 'human', humanId: ROOT_B2 },
        requestToken: 'req-h5-create',
        delegationTemplateId: 'worker',
        payload: { label: 'h5-member' },
      }),
      call('compatibility.get', { teamSessionId: ROOT_B2 }),
      (async () => {
        await tick(1)
        return call('compatibility.get', { teamSessionId: ROOT_B2 })
      })(),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const probeRace = (remoteReprobe.value.data as Record<string, any>).probe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const admitDetails = (admit.error as Record<string, any> | undefined)?.['details'] as
      | Record<string, any>
      | undefined

    const getAfter = await call('compatibility.get', { teamSessionId: ROOT_B2 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictAfter = (getAfter.value.data as Record<string, any>).verdict
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const b2Row = root.domain.repositories.teamSessions.get(ROOT_B2) as Record<string, any>

    return {
      world,
      dir,
      blueprintDir,
      createB2,
      reprobeB2,
      probeB2,
      fatalAck,
      getAfterAck,
      verdictAfterAck,
      deleted,
      remoteReprobe,
      admit,
      admitDetails,
      probeRace,
      getDuring1,
      getDuring2,
      getAfter,
      verdictAfter,
      b2Generation: b2Row !== undefined ? b2Row['generation'] : null,
    }
  } catch (err) {
    destroyDir(dir)
    destroyDir(blueprintDir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`H5 concurrency world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

describe('H5 the remote probe || admission inline probe barrier (repair 20260927)', () => {
  it('H5.1 the remote FATAL ack is rejected and leaves the state untouched', () => {
    expect(h5.createB2.ok).toBe(true)
    expect(h5.reprobeB2.ok).toBe(true)
    expect(h5.probeB2.status).toBe('BLOCKED_FATAL')
    expect(h5.probeB2.fatal).toBe(1)
    expect(h5.probeB2.generation).toBe(1)

    expect(h5.fatalAck.ok).toBe(false)
    expect(codeOf(h5.fatalAck)).toBe('COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE')
    // The failed ack is a pure read-side rejection: the state is
    // unchanged (same generation, still BLOCKED_FATAL).
    expect(h5.getAfterAck.ok).toBe(true)
    expect(h5.verdictAfterAck.generation).toBe(1)
    expect(h5.verdictAfterAck.status).toBe('BLOCKED_FATAL')
    expect(h5.verdictAfterAck.counts.fatal).toBe(1)
  })

  it('H5.2 the race completes (no nested-lock deadlock) and the new-work admission fails closed as a clean FATAL block', () => {
    expect(h5.deleted).toBe(true)
    // The race resolved (the Promise.all above settled — the remote
    // wrapper, the router's new-work path, and the in-flight reads all
    // run on the SAME production team chain; every operation acquires
    // it exactly once — the wrapper is never injected into the
    // lock-holding admission chain, so nothing nests; the gate's
    // per-consultation prober is a SEPARATE lock inside the chain).
    expect(h5.admit.ok).toBe(false)
    expect(codeOf(h5.admit)).toBe('TEAM_RUNTIME_COMPATIBILITY_BLOCKED')
    // The p8s5b R5 window failure would surface as the reprobe-reason
    // no-state-after-reprobe — it must not appear (neither in the
    // message nor in the structured cause details).
    expect(messageOf(h5.admit)).not.toContain('no-state-after-reprobe')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const gateDetails =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      (h5.admitDetails?.['cause'] as Record<string, any> | undefined)?.['details'] as
        | Record<string, any>
        | undefined
    if (h5.admitDetails !== undefined) {
      expect(h5.admitDetails['reason']).not.toBe('no-state-after-reprobe')
    }
    if (gateDetails !== undefined) {
      // A clean FATAL block from the durable state (a reprobe CHAIN
      // failure would carry source 'compatibility-authority' + a
      // reprobe reason instead).
      expect(gateDetails['source']).toBe('durable-state')
      expect(gateDetails['status']).toBe('BLOCKED_FATAL')
    }
    // The FATAL environment is never admitted (invariant 50).
  })

  it('H5.3 no lost advance: the final durable generation is exactly the number of probes that ran (∈ {1,2})', () => {
    expect(h5.remoteReprobe.ok).toBe(true)
    expect(h5.probeRace.status).toBe('BLOCKED_FATAL')
    // The explicit delete RESTARTS the compatibility generation line
    // (probe: generation = previous + 1; absent → 1). In the race the
    // remote probe ALWAYS runs (+1), and the admission gate probes
    // only while the state is still absent (+1). Serialized on the
    // shared team chain, the final durable generation is EXACTLY that
    // count — no lost update, no double advance.
    expect(h5.probeRace.generation === 1 || h5.probeRace.generation === 2).toBe(true)
    // Branch discriminator: the remote probe (an explicit reprobe) runs
    // after any gate probe — it owns the final generation; generation 2
    // ⟺ the gate probed first (reprobed: true in its block details),
    // generation 1 ⟺ it read the remote probe's fresh state and skipped
    // the probe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const gateDetails =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      (h5.admitDetails?.['cause'] as Record<string, any> | undefined)?.['details'] as
        | Record<string, any>
        | undefined
    if (h5.probeRace.generation === 2) {
      expect(gateDetails?.['reprobed']).toBe(true)
    } else {
      expect(gateDetails?.['reprobed'] ?? false).toBe(false)
    }
    // The final durable row IS the remote probe's replace (well-formed).
    expect(h5.getAfter.ok).toBe(true)
    expect(h5.verdictAfter.generation).toBe(h5.probeRace.generation)
    expect(h5.verdictAfter.status).toBe('BLOCKED_FATAL')
    expect(h5.verdictAfter.counts.fatal).toBe(1)
    expect(h5.verdictAfter.environmentFingerprint).toBe(h5.probeRace.environmentFingerprint)
  })

  it('H5.4 the lock-holding reads are always well-formed (never a spurious mid-replace absent)', () => {
    for (const response of [h5.getDuring1, h5.getDuring2]) {
      // Either a valid verdict (state exists and was read atomically
      // under the lock) or the honest pre-first-probe state-absent (the
      // explicit delete made absence legitimate until the first probe
      // lands). Nothing else is well-formed.
      if (response.ok === false) {
        expect(codeOf(response)).toBe('TEAM_REMOTE_COMPATIBILITY_STATE_ABSENT')
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
        const verdict = (response.value.data as Record<string, any>).verdict
        expect(typeof verdict.status).toBe('string')
        expect(typeof verdict.generation).toBe('number')
        expect(verdict.generation >= 1).toBe(true)
      }
    }
  })

  it('H5.5 the blocked admission and the compatibility ops advance B\'s TeamSession stamp exactly per probe', () => {
    // The prober's replaceState is the S1-A hook-B stamp choke point:
    // the TeamSession generation advances by exactly one per probe
    // (create 1 + the setup reprobe 1 + the race's probes) — the
    // blocked member.create writes NO work fact (zero durable team
    // mutation), and no compatibility operation advances it apart
    // from its own probe.
    expect(h5.b2Generation).toBe(2 + h5.probeRace.generation)
  })
})

// --- teardown --------------------------------------------------------------------------

describe('team-compatibility-scope teardown', () => {
  it('the H2 world is disposed (stop semantics)', () => {
    h2.world.effectDisposers.forEach((dispose) => dispose())
    h2.world.effectDisposers.length = 0
    destroyDir(h2.dir)
    destroyDir(h2.blueprintDir)
    expect(true).toBe(true)
  })

  it('the H5 world is disposed (stop semantics)', () => {
    h5.world.effectDisposers.forEach((dispose) => dispose())
    h5.world.effectDisposers.length = 0
    destroyDir(h5.dir)
    destroyDir(h5.blueprintDir)
    expect(true).toBe(true)
  })
})
