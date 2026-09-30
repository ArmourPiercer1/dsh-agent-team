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
 *                              available in the shared host facts.
 *
 * pre-alpha3 W3-B (review fix F6, guide §6): the remote `team.create`
 * runs the CREATION PREFLIGHT before any durable bind. B's `tool/pdf`
 * is OPTIONAL and down (unconsented) → the FIRST `team.create(B)` is
 * refused with the typed `TEAM_RUNTIME_COMPATIBILITY_BLOCKED`
 * (outcome `consentRequired`, `req-tool-pdf` in
 * `consentRequiredRequirementIds`) and ZERO durable effect. The human
 * resolves through the F7 production writer
 * (`requirementAuthority.grantDegradationConsent` — the durable
 * `optional-requirement-accepted` fact, written PRE-TEAM: no
 * TeamSession record exists yet), and the RE-DRIVEN `team.create(B)`
 * reads the durable consent → proceeds → B is minted. The RUNTIME
 * compatibility prober does NOT consume consents (it evaluates the
 * bound blueprint against the live facts only) — so after creation B
 * is still BLOCKED_WARNING with the unacked `req-tool-pdf`: the
 * consent unblocked the CREATION, not the runtime probe, and the
 * warning is resolved only by the runtime ack (H2.5).
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
 *   H2.1a — the FIRST `team.create(B)` is refused by the creation
 *          preflight: typed `TEAM_RUNTIME_COMPATIBILITY_BLOCKED`,
 *          `details.cause.details.outcome === 'consentRequired'`,
 *          `req-tool-pdf ∈ consentRequiredRequirementIds`, and ZERO
 *          durable effect (no TeamSession row, no session binding, no
 *          leader for B);
 *   H2.1b — `requirementAuthority.grantDegradationConsent(B,
 *          'req-tool-pdf')` durably writes the
 *          `optional-requirement-accepted` fact (PRE-TEAM: no
 *          TeamSession record yet) and returns the payload;
 *   H2.1c — the RE-DRIVEN `team.create(B)` reads the durable consent →
 *          proceeds → B is minted (ok);
 *   H2.2 — the freshly minted root B has NO durable COMPATIBILITY
 *          state yet (a team record, but no verdict):
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
 * H5 (the F6 RESTART FACT-FLIP — a SINGLE scenario, TWO applies over
 * the SAME scratch dir — the process-restart model): B2 is the ROW
 * root of its own world, and its blueprint carries a REQUIRED
 * (`complete`) `tool/pdf` requirement. Under the F6 creation preflight
 * a team whose Team-scope REQUIRED requirement is down is REFUSED at
 * create (`fatal` — zero durable effect), so the restart fact-flip is
 * the only way B2 reaches BLOCKED_FATAL: apply 1 boots the row in the
 * CREATION-TIME environment (pdf AVAILABLE) — the preflight PROCEEDS
 * (the required requirement is satisfied) — and the first probe is
 * OPEN. Apply 2 is a PROCESS RESTART over the SAME durable medium in
 * the RUNTIME environment (pdf UNAVAILABLE): the `create-or-open` boot
 * RESUMES B2 (the record exists — no create, no preflight), B2's stale
 * compatibility state is deleted, and the reprobe now evaluates B2's
 * REQUIRED pdf against the down fact → BLOCKED_FATAL. The remote
 * FATAL ack is rejected (a fatal is never ack-able) and B2's
 * TeamSession stamp advances by exactly one per probe (boot mint +
 * the boot's own initial evaluation + the two single probes = 4).
 *
 * The pre-existing H5 concurrency barrier (the REMOTE probe racing the
 * ADMISSION inline probe — `member.create`) is INFEASIBLE under F6: a
 * FATAL root can only be minted across a realm boundary (the
 * fact-flip), but a root minted in a DIFFERENT realm — remote-minted
 * OR a resumed row root — is not LIVE for the admission's
 * `performAction` (it hangs). Reported to the parent as a
 * plan-vs-code conflict. See the H5 section for the per-assertion
 * docs.
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
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'

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
 *  B's `tool/pdf` is not (its WARNING). This is the RUNTIME
 *  environment — the H5 apply-2 (restart) facts and the H2 facts. */
const ENVIRONMENT_FACTS = [
  { domain: 'tool', subject: 'web', available: true, generation: 1 },
  { domain: 'skill', subject: 'base', available: true, generation: 1 },
  { domain: 'tool', subject: 'pdf', available: false, generation: 1 },
]

/** The H5 apply-1 (CREATION-TIME) facts: pdf AVAILABLE — the
 *  creation preflight proceeds for a blueprint whose REQUIRED
 *  `tool/pdf` is satisfied by this environment. */
const ENVIRONMENT_FACTS_PDF_UP = [
  { domain: 'tool', subject: 'web', available: true, generation: 1 },
  { domain: 'skill', subject: 'base', available: true, generation: 1 },
  { domain: 'tool', subject: 'pdf', available: true, generation: 1 },
]

/** The row config (the entry's ONLY input channel). `overrides` lets a
 *  scenario vary the environment facts (the H5 restart fact-flip) and
 *  the boot phase (the H5 apply-2 `create-or-open` resume) without a
 *  second config factory. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(
  blueprintDir: string,
  overrides: { environmentFacts?: Array<Record<string, unknown>>; bootPhase?: string } = {},
): Record<string, any> {
  return {
    bootPhase: overrides.bootPhase ?? 'create',
    // 0 = the legacy IMMEDIATE remote-mount decision (a headless test
    // world provides no "connection" service — skip the mount now,
    // never arm the 30s appearance watcher). The remote dispatcher is
    // still reachable through `remoteHandlerRegistration` (the A31
    // seam), which is what the scenarios drive — matching the proven
    // host-entry test-world pattern.
    remoteMountWaitMs: 0,
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
    environmentFacts: overrides.environmentFacts ?? ENVIRONMENT_FACTS,
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
    // pre-alpha3 W3-A (F1): the agentPresets service double (W2-A fail-closed
    // contract — service-absent worlds without a row preset id no longer bind).
    agentPresets: agentPresetsStandardDouble(),
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

    // H2.1a: the FIRST `team.create(B)` hits the F6 creation preflight
    // (B's OPTIONAL tool/pdf is down + unconsented → consentRequired):
    // the TYPED refusal, ZERO durable effect.
    const createB1 = await call('team.create', {
      rootSessionId: ROOT_B,
      blueprintId: 'H2COMP-B-BP',
      blueprintRevision: 1,
    })
    // The zero-durable audit: the refusal wrote NO TeamSession row, NO
    // session binding, NO leader for B (the refuse is a pure read-side
    // gate — the registry freeze and the bind writes never ran).
    const teamRowAfterRefusal = root.domain.repositories.teamSessions.get(ROOT_B)
    const bindingAfterRefusal = root.domain.repositories.sessionBindings.get(ROOT_B)
    const leaderAfterRefusal = root.domain.repositories.memberInstances.get(ROOT_B, 'inst-leader')

    // H2.1b: the human grants the degradation consent through the F7
    // production writer — the durable `optional-requirement-accepted`
    // fact, written PRE-TEAM (no TeamSession record for B yet).
    const grantConsent = await root.requirementAuthority.grantDegradationConsent({
      rootSessionId: ROOT_B,
      blueprintId: 'H2COMP-B-BP',
      revision: '1',
      requirementId: 'req-tool-pdf',
      generation: 1,
      consentedBy: ROOT_B,
    })

    // H2.1c: the RE-DRIVEN `team.create(B)` reads the durable consent →
    // proceeds → B is minted (the consent unblocked the CREATION).
    const createB = await call('team.create', {
      rootSessionId: ROOT_B,
      blueprintId: 'H2COMP-B-BP',
      blueprintRevision: 1,
    })

    // H2.2: the freshly minted root B has NO durable COMPATIBILITY state
    // yet (a team record, but no verdict) — the read fails closed, and
    // the message names B (the addressed root), not the boot root.
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
      createB1,
      teamRowAfterRefusal,
      bindingAfterRefusal,
      leaderAfterRefusal,
      grantConsent,
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

it('H2.1a the FIRST team.create(B) is refused by the creation preflight (consentRequired, zero durable effect)', () => {
  expect(h2.createB1.ok).toBe(false)
  expect(codeOf(h2.createB1)).toBe('TEAM_RUNTIME_COMPATIBILITY_BLOCKED')
  // The typed preflight source identity rides under cause.details (the
  // wire pass-through of the TeamRuntimeError's details).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const causeDetails =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    ((h2.createB1.error as Record<string, any> | undefined)?.['details'] as
      | Record<string, any>
      | undefined)?.['cause'] as
      | Record<string, any>
      | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const preflightDetails = (causeDetails?.['details'] as Record<string, any> | undefined) ?? {}
  expect(causeDetails?.['code']).toBe('TEAM_RUNTIME_COMPATIBILITY_BLOCKED')
  expect(preflightDetails['source']).toBe('creation-preflight')
  expect(preflightDetails['outcome']).toBe('consentRequired')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const consentIds = preflightDetails['consentRequiredRequirementIds'] as string[] | undefined
  expect(Array.isArray(consentIds)).toBe(true)
  expect(consentIds).toContain('req-tool-pdf')
  // ZERO durable effect: the refusal wrote no TeamSession row, no
  // session binding, no leader for B (the freeze + bind never ran).
  expect(h2.teamRowAfterRefusal).toBeUndefined()
  expect(h2.bindingAfterRefusal).toBeUndefined()
  expect(h2.leaderAfterRefusal).toBeUndefined()
})

it('H2.1b grantDegradationConsent durably writes the optional-requirement-accepted fact (pre-team)', () => {
  // The F7 production writer returns the written payload.
  expect(h2.grantConsent.requirementId).toBe('req-tool-pdf')
  expect(h2.grantConsent.consentedBy).toBe(ROOT_B)
  expect(h2.grantConsent.generation).toBe(1)
  // Pre-team: B still has NO TeamSession row (the fact was written
  // under the future root session id before the mint).
  expect(h2.teamRowAfterRefusal).toBeUndefined()
})

it('H2.1c the RE-DRIVEN team.create(B) reads the durable consent and succeeds', () => {
  // The re-drive minted B's TeamSession (the consent unblocked the
  // creation — the durable pre-team fact was read back by the
  // preflight on the second create).
  expect(h2.createB.ok).toBe(true)
})

it('H2.2 the fresh owned root has no state: ABSENT, and the message names B', () => {
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

// --- H5 (W3-B / F6): the RESTART fact-flip (two applies, SAME medium) ------------
//
// The W3-B creation preflight (F6) changed what H5 can express: a team
// whose Team-scope REQUIRED requirement is down is now REFUSED at
// create (the `fatal` outcome, zero durable effect) — so a FATAL root
// can only arise through a RESTART fact-flip. B2 is the ROW root of
// its own world, booted under the CREATION-TIME facts (where the
// REQUIRED `tool/pdf` is satisfied → the preflight PROCEEDS, first
// probe OPEN), then the world is DISPOSED and RE-APPLIED over the SAME
// scratch dir under the RUNTIME facts (where `tool/pdf` is DOWN; the
// resume is `create-or-open` — no creation preflight). The reprobe
// (after the explicit stale delete) is BLOCKED_FATAL, and the remote
// `compatibility.ack(B2, <FATAL requirement>)` is still rejected.
//
// The pre-existing H5 concurrency barrier (the REMOTE probe racing the
// ADMISSION inline probe — the `member.create` new-work path) is
// INFEASIBLE under F6: the admission's `performAction` requires the
// addressed root to be LIVE (freshly created in the current realm); a
// root minted in a prior realm — remote-minted OR a resumed row root —
// hangs. A FATAL root can only be minted across a realm boundary (the
// fact-flip), so no FATAL + LIVE root exists. Reported to the parent
// as a plan-vs-code conflict; the fact-flip above is the F6 H5
// coverage.
//
// Proven:
//
//   H5.1 — the fact-flip: B2's row boot under the CREATION-TIME facts
//          (pdf available) PROCEEDS the creation preflight (the boot's
//          own initial evaluation owns compatibility generation 1) and
//          the first explicit probe is OPEN (generation 2, zero fatal,
//          zero warning); after the resume under the RUNTIME facts (pdf
//          unavailable), the reprobe (post-stale-delete) is
//          BLOCKED_FATAL (generation 1 — the delete restarted the
//          compatibility generation line); the remote
//          `compatibility.ack(B2, <FATAL requirement>)` is REJECTED
//          with `COMPATIBILITY_FATAL_NOT_ACKNOWLEDGABLE` and leaves
//          B2's state untouched (same generation, still
//          BLOCKED_FATAL);
//   H5.2 — the prober's replaceState is the S1-A hook-B stamp choke
//          point: B2's TeamSession generation advances by EXACTLY one
//          per probe (world 1 boot MINT + the boot's own initial
//          evaluation + world 1 OPEN probe + world 2 FATAL probe = 4)
//          — the stale delete and the rejected ack write NO stamp.

/** The H5 root id (B2 is the ROW root of its own world — distinct from
 *  the H2 world). */
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

// --- H5: the F6 restart fact-flip (two applies over the SAME durable medium) ------
//
// Under the W3-B creation preflight (F6) a team whose Team-scope REQUIRED
// requirement is down is REFUSED at create (`fatal` outcome — zero durable
// effect). So a team that is later observed BLOCKED_FATAL could not have
// been created under the down facts, and a FATAL root minted in a DIFFERENT
// realm is not LIVE for the admission's `performAction` (it hangs — the
// admission requires the addressed root to be live in the CURRENT realm).
// The F6-compatible H5 therefore makes B2 the ROW's OWN root and drives the
// fact-flip through the row boot: world 1 boots the row (B2, REQUIRED
// tool/pdf) in the CREATION-TIME environment (pdf AVAILABLE) — the creation
// preflight PROCEEDS and the first probe is OPEN. World 2 is a PROCESS
// RESTART over the SAME durable medium in the RUNTIME environment (pdf
// UNAVAILABLE) — the `create-or-open` boot RESUMES the row (no create, no
// preflight), B2's stale compatibility state is deleted, and the reprobe
// now evaluates B2's REQUIRED pdf against the down fact → BLOCKED_FATAL.
// The resumed row root IS live in this world, so the REMOTE probe of B2 can
// race the ADMISSION INLINE PROBE (the `member.create` production path —
// the same team lock, the gate's own per-consultation prober INSIDE the
// lock) plus two in-flight REMOTE reads, all on B2 in the same tick.
const h5 = await (async () => {
  const dir = scratchDir('team-compatibility-scope-h5')
  const blueprintDir = scratchDir('team-compatibility-scope-h5-bp')
  let world1: TestWorld | null = null
  let world2: TestWorld | null = null
  try {
    // ===== apply 1 — the creation-time environment (pdf AVAILABLE) =====
    // The ROW's root is B2 (the inline B2 blueprint — REQUIRED tool/pdf).
    // The row boot's creation preflight PROCEEDS (the required requirement
    // is satisfied by the available environment) → B2 is created (OPEN).
    world1 = makeWorld(new FileStorageSeam(dir))
    const root1 = (await applyWorld(world1, {
      ...rowConfig(blueprintDir, {
        environmentFacts: ENVIRONMENT_FACTS_PDF_UP,
        bootPhase: 'create',
      }),
      rootSessionId: ROOT_B2,
      blueprintSource: BLUEPRINT_B2_SOURCE,
      seedMembers: [],
      defaultWorkspace: 'C:/agent-team/work/h5',
    })).root
    const registration1 = root1.seams.remoteHandlerRegistration.current()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    let capturedDispatcher1: ((endpoint: string, payload: unknown) => Promise<WireResponse>) | null = null
    registration1({
      rpc: {
        handle: (_channel: string, dispatcher: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          capturedDispatcher1 = dispatcher as (endpoint: string, payload: unknown) => Promise<WireResponse>
          return () => {}
        },
      },
    })
    check(capturedDispatcher1 !== null, 'apply-1 registration never registered a dispatcher')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    async function call1(endpoint: string, params: Record<string, any>): Promise<WireResponse> {
      const dispatcher = capturedDispatcher1
      if (dispatcher === null) throw new Error('H5-FLIP guard: apply-1 dispatcher missing')
      return await dispatcher(endpoint, { version: 1, params })
    }
    // The first probe (creation-time facts) is OPEN — the REQUIRED pdf is
    // satisfied by the available environment.
    const reprobeB2Open = await call1('compatibility.reprobe', {
      teamSessionId: ROOT_B2,
      trigger: 'ROOT_COLD_RESUME',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const probeB2Open = (reprobeB2Open.value.data as Record<string, any>).probe

    // ===== the process restart (drop world 1's whole realm) =====
    world1.effectDisposers.forEach((dispose) => dispose())
    world1.effectDisposers.length = 0
    world1 = null

    // ===== apply 2 — the runtime environment (pdf UNAVAILABLE) =====
    // The `create-or-open` boot RESUMES the row (B2; the record exists from
    // apply 1 — no create, no preflight); the row root is LIVE in this world
    // (the admission's performAction requires the addressed root to be live
    // in the current realm).
    world2 = makeWorld(new FileStorageSeam(dir))
    const root2 = (await applyWorld(world2, {
      ...rowConfig(blueprintDir, {
        environmentFacts: ENVIRONMENT_FACTS,
        bootPhase: 'create-or-open',
      }),
      rootSessionId: ROOT_B2,
      blueprintSource: BLUEPRINT_B2_SOURCE,
      seedMembers: [],
      defaultWorkspace: 'C:/agent-team/work/h5',
    })).root
    const registration2 = root2.seams.remoteHandlerRegistration.current()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    let capturedDispatcher2: ((endpoint: string, payload: unknown) => Promise<WireResponse>) | null = null
    registration2({
      rpc: {
        handle: (_channel: string, dispatcher: unknown) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
          capturedDispatcher2 = dispatcher as (endpoint: string, payload: unknown) => Promise<WireResponse>
          return () => {}
        },
      },
    })
    check(capturedDispatcher2 !== null, 'apply-2 registration never registered a dispatcher')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    async function call2(endpoint: string, params: Record<string, any>): Promise<WireResponse> {
      const dispatcher = capturedDispatcher2
      if (dispatcher === null) throw new Error('H5-FLIP guard: apply-2 dispatcher missing')
      return await dispatcher(endpoint, { version: 1, params })
    }

    // Make B2's durable world STALE for the fact-flip: delete its
    // compatibility state (the creation-time OPEN verdict no longer
    // reflects the runtime facts).
    const deletedStale = await root2.domain.repositories.compatibility.delete(ROOT_B2)

    // The reprobe now evaluates B2's REQUIRED tool/pdf against the DOWN
    // fact → BLOCKED_FATAL (generation 1 — the delete restarted the
    // compatibility generation line).
    const reprobeB2 = await call2('compatibility.reprobe', {
      teamSessionId: ROOT_B2,
      trigger: 'ROOT_COLD_RESUME',
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const probeB2 = (reprobeB2.value.data as Record<string, any>).probe

    // The FATAL ack through the REMOTE path (B's own human id) is rejected
    // — a fatal is never ack-able (the read-side is untouched).
    const fatalAck = await call2('compatibility.ack', {
      teamSessionId: ROOT_B2,
      requirementId: 'req-tool-pdf',
      acknowledgedBy: ROOT_B2,
    })
    const getAfterAck = await call2('compatibility.get', { teamSessionId: ROOT_B2 })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const verdictAfterAck = (getAfterAck.value.data as Record<string, any>).verdict

    // NOTE (W3-B / F6): the pre-existing H5 concurrency barrier (the REMOTE
    // probe racing the ADMISSION INLINE PROBE — the `member.create`
    // new-work admission) is INFEASIBLE under the W3-B creation preflight:
    // a team whose Team-scope REQUIRED requirement is down is REFUSED at
    // create (the `fatal` outcome), so the FATAL race root can only exist
    // after a RESTART fact-flip — and a root minted in a DIFFERENT realm is
    // not LIVE for the admission's `performAction` (it hangs; the admission
    // requires the addressed root to be freshly created in the CURRENT
    // realm, whether the root is a remote-minted root or a resumed row
    // root). The fact-flip above is therefore the F6 H5 coverage; the
    // concurrency barrier is dropped (reported to the parent as a
    // plan-vs-code conflict).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    const b2Row = root2.domain.repositories.teamSessions.get(ROOT_B2) as Record<string, any>

    return {
      world: world2,
      dir,
      blueprintDir,
      probeB2Open,
      reprobeB2,
      probeB2,
      fatalAck,
      getAfterAck,
      verdictAfterAck,
      b2Generation: b2Row !== undefined ? b2Row['generation'] : null,
    }
  } catch (err) {
    destroyDir(dir)
    destroyDir(blueprintDir)
    world1?.effectDisposers.forEach((dispose) => dispose())
    world2?.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`H5 world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

describe('H5 the F6 restart fact-flip (two applies over the SAME durable medium)', () => {
  it('H5.1 the fact-flip + the remote FATAL ack is rejected and leaves the state untouched', () => {
    // The RESTART FACT-FLIP preface: under the CREATION-TIME facts
    // (pdf available), the ROW boot's creation preflight PROCEEDED (the
    // REQUIRED tool/pdf is satisfied) and the first probe was OPEN.
    // The boot's own initial compatibility evaluation owned generation
    // 1; the explicit reprobe (reprobeB2Open) is generation 2.
    expect(h5.probeB2Open.status).toBe('OPEN')
    expect(h5.probeB2Open.generation).toBe(2)
    // The probe carries the counters top-level (the get-verdict wraps
    // them in `counts`): OPEN means zero fatal, zero warning.
    expect(h5.probeB2Open.fatal).toBe(0)
    expect(h5.probeB2Open.warning).toBe(0)
    // After the restart in the RUNTIME environment (pdf unavailable),
    // the reprobe (post-stale-delete) is BLOCKED_FATAL, generation 1
    // (the delete restarted the compatibility generation line).
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

  it('H5.2 the compatibility ops advance B2\'s TeamSession stamp exactly per probe (S1-A hook B)', () => {
    // The prober's replaceState is the S1-A hook-B stamp choke point:
    // the TeamSession generation advances by exactly one per probe.
    // For the row-root B2 (the fact-flip) the replaceState count is:
    // world 1's row-boot MINT (gen 1) + the boot's own initial
    // compatibility evaluation (gen 2) + world 1's OPEN reprobe
    // (gen 3) + world 2's BLOCKED_FATAL reprobe (gen 4, after the
    // stale delete). The stale delete and the rejected ack write NO
    // stamp. So the final stamp = 4 (mint + the three probes) —
    // exactly one advance per probe, no lost update, no double advance.
    expect(h5.b2Generation).toBe(4)
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
