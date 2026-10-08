/**
 * a4p7-ceiling-port-assembly-pin.test.ts — the shipped composition's authority
 * ceiling gate does not depend on one unpinned line of wiring.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 * ---------------------------------------------------------------------------
 * The ceiling gate in `governance/service.ts` runs ONLY when the lane carries
 * an `authorityCeiling` port (`if (lane.authorityCeiling !== undefined)`), and
 * the production root spreads that port ONLY when the plugin host injected it
 * (`root.ts`: `...(permissionAuthorityCeiling === undefined ? {} : { authorityCeiling })`).
 * In the shipped product EXACTLY ONE LINE supplies it: the host's
 * `permissionAuthorityCeiling: createAuthorityCeilingReader({ facts })` inside
 * `apply()`. Delete that line — or assemble a lane through any path that does
 * not go through it — and the gate silently stops consulting a ceiling while
 * every other permission law keeps answering happily.
 *
 * The corpus already holds a STATIC pin of that line (a source-text regex in
 * `a4p2-dual-envelope-mutation.test.ts`). A regex pins a SPELLING, not an
 * EFFECT: it reddens on a rename and stays green on a semantically-absent but
 * textually-present injection. This file pins the EFFECT: it builds the REAL
 * shipped composition in-process — the actual plugin-host entry `apply(ctx,
 * config)` over real P4 storage, the same harness `p8s5a-production-assembly`
 * uses — and drives an authority-widening mutation through it.
 *
 * ---------------------------------------------------------------------------
 * THE MEASUREMENT (one drive, four worlds — A/B/D through the host entry, C
 * root-direct; each pair differs in exactly one collaborator)
 * ---------------------------------------------------------------------------
 * Both worlds boot through the real host entry with a v3 blueprint whose
 * `permissionMutationEnvelope` (the Leader's carrier) FULLY COVERS the claimed
 * rise — so the Alpha.3 coverage law passes in both, at the host entry, exactly
 * as `a3p4-pr4-production-entry-regression` proves it does when no ceiling
 * exists. The worlds differ in ONE document, the `teamHardEnvelope`, which has
 * exactly ONE consumer in the whole plane: the ceiling reader.
 *
 *   CEILING-EMPTY world: teamHardEnvelope declares no rule → on the expansion
 *     plane "no match" is `no-authority` (authority-envelope law), so the
 *     ceiling ANSWERS "this rise exceeds the ceiling".
 *   CEILING-OPEN world: the same scope, maximumEffect allow → the ceiling
 *     ANSWERS "allowed".
 *
 * With the port injected (the shipped tree): the empty-ceiling rise is refused
 * (or diverted into the durable proposal lane — either way it does NOT commit),
 * and the open-ceiling rise commits. The verdict FOLLOWS the hard document.
 * If `host.ts`'s injection line is deleted, the gate is skipped in BOTH worlds
 * and the CEILING-EMPTY rise COMMITS — leg 1 goes red with the refusal it
 * asserts missing. That is the required mutation: the line is load-bearing for
 * a verdict, not just for a regex.
 *
 * Leg 3 is the deliberately-pinned HAZARD: the same lane assembled root-direct
 * (the way most of the test corpus assembles it) has NO port and the same rise
 * COMMITS. That fail-open is the fact the §7.5 follow-up ruling must decide
 * about; this leg pins it as today's law so the day fail-closed lands, THIS leg
 * goes red and forces the record to be read, not silently upgraded.
 *
 * Leg 4 (labelled weak, kept as a census witness, not as the instrument): the
 * production tree contains exactly ONE producer of the reader. It is a
 * source-text leg; leg 1 is what makes the wiring semantical.
 *
 * Leg 5 is the ATTRIBUTION leg (added post-§7.3 on the coordinator's request):
 * a fourth world — world B stripped of exactly the `fs` public-service double,
 * COVERING ceiling intact — measures whether zero-authority-by-absent-fs can
 * be told from zero-authority-by-ceiling. Measured answer: yes, at identity
 * level (fs-less dies at the carrier law as a typed EXPANSION_DENIED throw;
 * the ceiling's zero is the durable proposal shape) — the leg pins the
 * separation and names the drift that would erase it.
 *
 * ---------------------------------------------------------------------------
 * STATUS after the §7.3 version flip landed (merged master 8ab22407)
 * ---------------------------------------------------------------------------
 * All six legs re-run green on the merged tree; the flip touched NONE of
 * host.ts / root.ts / permission-plane.ts / governance/service.ts (empty
 * diff), so the port's three root.ts consumers are byte-identical to the
 * state this file was written against. §7.3 closed the OTHER fail-open way —
 * v1/v2 documents now refuse at the parser, so the reader's version-abstention
 * branch is unreachable — and leg 3 measures that the PORT-ABSENT way, which
 * runs on v3 documents, survived the narrowing intact: the fail-open lever at
 * the root seam still exists post-flip.
 *
 * @module @dsh-agent-team/runtime/test/a4p7-ceiling-port-assembly-pin
 */

import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isAbsolute, join, relative, resolve, sep, dirname } from 'node:path'
import {
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import { createTeamDomain } from '../../storage/repositories/index.js'
import { openPermissionOverlayStore } from '../../storage/repositories/permission-overlays.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import { createPermissionOverlayRepositoryPort } from '../permission-governance/index.js'
import * as hostEntry from '../src/plugin/host.js'
import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import type { CanonicalKeyContains } from '../src/plugin/permission-plane.js'
import { PERMISSION_MUTATION_ERROR_CODES } from '../governance/permission-mutation.js'
import { agentPresetsStandardDouble } from './agent-presets-double.mjs'
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// ---------------------------------------------------------------------------
// fixture identity (own ids; never reuse another suite's)
// ---------------------------------------------------------------------------

const PIN_ROOT = 'session-a476pinroot'
const PIN_WORKER = 'inst-a476pinwork1'
const PIN_WORKER_CHILD = 'session-child-a476pinwork1'
const SCRATCH_BASE = 'a4-76-ceiling-pin'

// ---------------------------------------------------------------------------
// the blueprint: E2's covered-carrier skeleton promoted to a v3 document
// ---------------------------------------------------------------------------

/**
 * A v3 blueprint whose carrier COVERS the claimed rise (exact write allow at
 * `target`) in every world. `hardRulesYaml` supplies the one difference:
 * the empty hard document (`rules: []` — expansion-plane no-authority) versus
 * the covering one (`maximumEffect: allow` — expansion-plane allow).
 */
function pinBlueprintSource(target: string, hardRulesYaml: string): string {
  return [
    '---',
    'schemaVersion: 3',
    'permissionMutationEnvelope:',
    '  rules:',
    '    - operationClass: write',
    '      matcher:',
    '        kind: exact',
    `        path: "${target}"`,
    '      maximumEffect: allow',
    hardRulesYaml,
    'blueprintId: A476-PIN-BP',
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: You lead the A476 pin team.',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_send_message',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: deny',
    '      allow:',
    '        - tool: write',
    '          resource:',
    '            kind: exact',
    `            path: "${target}"`,
    '      ask: []',
    '      deny: []',
    'members:',
    '  - templateId: worker',
    '    displayName: Worker',
    '    persona: You do the A476 pin work.',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items:',
    '          - team_send_message',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: deny',
    '        allow: []',
    '        ask: []',
    '        deny: []',
    'teamEnvelope:',
    '  allow:',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '    - archive-member',
    '    - restore-member',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: The A476 pin default state.',
    'quotas:',
    '  team:',
    '    maxInstances: 4',
    '    maxConcurrent: 4',
    '  members:',
    '    maxInstances: 2',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
  ].join('\n')
}

/** The honest zero: expansion-plane no-match is `no-authority`. */
const HARD_ZERO_YAML = [
  'teamHardEnvelope:',
  '  rules: []',
].join('\n')

/** The covering hard document: the same scope, allow. */
const HARD_OPEN_YAML = (target: string): string => [
  'teamHardEnvelope:',
  '  rules:',
  '    - operationClass: write',
  '      matcher:',
  '        kind: exact',
  `        path: "${target}"`,
  '      maximumEffect: allow',
].join('\n')

// ---------------------------------------------------------------------------
// the in-process host world (same structural-context harness as p8s5a T1)
// ---------------------------------------------------------------------------

interface PinWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly scratch: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  apply(blueprintSource: string): Promise<any>
  dispose(): Promise<void>
}

async function makePinWorld(dirName: string): Promise<PinWorld> {
  const dir = scratchDir(dirName)
  destroyDir(dir) // idempotent start-state (a prior aborted run may have stamped the domain)
  mkdirSync(`${dir}/workspace`, { recursive: true })
  const seam = new FileStorageSeam(dir)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    teamStorageSeam: seam,
    agentPresets: agentPresetsStandardDouble(),
    // The fs public-service double in the host-authorized PLAIN-ABSOLUTE-KEY
    // convention (the E2 fixture's double, same shape): a permissions-bearing
    // row consults it for the authority-facts canonicalization. WITHOUT it the
    // fact readers ABSTAIN → the envelope reader answers its typed UNKNOWN
    // (`NO_ENVELOPE`, zero authority) — a fail-open of a different name, which
    // is a discovery of this lane recorded in the FINDINGS, not something this
    // pin may silently depend on.
    fs: {
      resolve: async (path: string, options?: { cwd?: string }) => {
        const joined = path.startsWith('/') ? path : resolve(options?.cwd ?? dir, path)
        return { targetKey: joined, displayPath: joined }
      },
      contains: (parent: unknown, child: unknown) => {
        const p = (parent as { targetKey?: string }).targetKey ?? ''
        const c = (child as { targetKey?: string }).targetKey ?? ''
        const rel = relative(resolve(p), resolve(c))
        return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
      },
    },
  }
  const disposers: Array<() => void> = []
  const ctx = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void, _label?: string) => {
      disposers.push(factory())
    },
  }
  return {
    provided,
    scratch: dir,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    async apply(blueprintSource: string): Promise<any> {
      await hostEntry.apply(ctx as never, {
        bootPhase: 'create',
        rootSessionId: PIN_ROOT,
        blueprintSource,
        generation: 1,
        remoteMountWaitMs: 0,
        defaultWorkspace: `${dir}/workspace`,
        seedMembers: [
          {
            instanceId: PIN_WORKER,
            templateId: 'worker',
            label: 'a476-pin-worker',
            childSessionId: PIN_WORKER_CHILD,
          },
        ],
        staticModel: { provider: 'a476-pin', model: 'a476-pin-model' },
        deniedSelection: null,
        mcpServer: null,
        environmentFacts: [],
        externalPolicyFacts: { hard: {}, capabilityExists: {} },
        glueUrl: stubGlueUrl(),
      })
      const facade = provided.teamRoot
      if (facade === undefined) throw new Error('apply resolved but never provided teamRoot')
      return await facade.ready
    },
    async dispose(): Promise<void> {
      for (const dispose of disposers) dispose()
      destroyDir(dir)
    },
  }
}

/** mutatePermission refuses by THROWING the typed PermissionMutationError;
 *  the fully-wired approval lane converts a DECIDED-insufficient ceiling rise
 *  into a durable PROPOSAL result (A4-PR5). Normalize both into one verdict,
 *  keeping the resolved object whole — the proposal identity fields are part
 *  of what PIN-1b asserts. */
async function settleMutation(run: Promise<unknown>): Promise<Record<string, unknown> & { changed?: boolean; code?: string; reason?: string }> {
  try {
    return (await run) as Record<string, unknown> & { changed?: boolean }
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { changed: false, code: String(e.code ?? ''), reason: String(e.message ?? '') }
  }
}

/** The SAME authority-widening rise in every world: the carrier covers it in
 *  all of them, so ONLY the ceiling document can answer differently. */
function riseDrive(mutationId: string, target: string) {
  return {
    authority: { kind: 'leader' },
    teamSessionId: PIN_ROOT,
    memberInstanceId: PIN_WORKER,
    kind: 'grant_instance',
    mutationId,
    reason: 'a476 pin: leader rise whose carrier covers and whose hard ceiling differs per world',
    rules: [
      { operationClass: 'write', matcher: { kind: 'exact', resource: target }, effect: 'allow' },
    ],
  } as never
}

// ---------------------------------------------------------------------------
// the measurement
// ---------------------------------------------------------------------------

type Verdict = Record<string, unknown> & {
  readonly changed?: boolean
  readonly code?: string
  readonly reason?: string
}

interface Measured {
  /** Verdict of the covered rise in the CEILING-EMPTY shipped world. The
   *  whole resolved object is kept: the proposal identity fields ARE the
   *  ceiling-shaped signature PIN-1b asserts. */
  readonly emptyVerdict: Verdict
  /** Verdict of the SAME rise in the CEILING-OPEN shipped world. */
  readonly openVerdict: Verdict
  /** Verdict of the SAME rise on the root-direct lane WITHOUT the port. */
  readonly rootDirectVerdict: Verdict
  /** Verdict of the SAME rise in the CEILING-OPEN shipped world with the `fs`
   *  public service ABSENT from the provided bundle (world D): the ceiling
   *  would allow, the canonicalization partner is missing. */
  readonly noFsVerdict: Verdict
}

const measured: Measured = await (async () => {
  // World A — the REAL shipped assembly, v3, carrier covers, hard ceiling ZERO.
  const worldA = await makePinWorld(`${SCRATCH_BASE}-empty`)
  let emptyVerdict: Measured['emptyVerdict']
  try {
    const targetA = `${worldA.scratch}/workspace/ledger-out.tsv`
    const rootA = await worldA.apply(pinBlueprintSource(targetA, HARD_ZERO_YAML))
    emptyVerdict = await settleMutation(
      rootA.mutation.governance.mutatePermission(riseDrive('mut-a476-pin-empty', targetA)),
    )
  } finally {
    await worldA.dispose()
  }

  // World B — identical EXCEPT the hard document covers the same scope.
  const worldB = await makePinWorld(`${SCRATCH_BASE}-open`)
  let openVerdict: Measured['openVerdict']
  try {
    const targetB = `${worldB.scratch}/workspace/ledger-out.tsv`
    const rootB = await worldB.apply(pinBlueprintSource(targetB, HARD_OPEN_YAML(targetB)))
    openVerdict = await settleMutation(
      rootB.mutation.governance.mutatePermission(riseDrive('mut-a476-pin-open', targetB)),
    )
  } finally {
    await worldB.dispose()
  }

  // World C — the SAME root factory the host calls, assembled root-direct
  // WITHOUT the ceiling port (what every root-direct test world today is).
  // No host entry involvement at all: this is the hazard, isolated.
  const rootDirectVerdict = await settleRootDirectRise()

  // World D — world B stripped of ONE collaborator: the `fs` public service.
  // Same shipped host entry, same COVERING hard ceiling (the world where the
  // drive COMMITS), only the canonicalization partner absent from the bundle.
  // If a rise can die here too, its death must name a DIFFERENT law than the
  // ceiling's — else "no authority" carries no attribution (a4-76 PIN-5).
  const worldD = await makePinWorld(`${SCRATCH_BASE}-nofs`)
  let noFsVerdict: Measured['noFsVerdict']
  try {
    const targetD = `${worldD.scratch}/workspace/ledger-out.tsv`
    delete (worldD.provided as Record<string, unknown>).fs
    const rootD = await worldD.apply(pinBlueprintSource(targetD, HARD_OPEN_YAML(targetD)))
    noFsVerdict = await settleMutation(
      rootD.mutation.governance.mutatePermission(riseDrive('mut-a476-pin-nofs', targetD)),
    )
  } finally {
    await worldD.dispose()
  }

  return { emptyVerdict, openVerdict, rootDirectVerdict, noFsVerdict }
})()

/** Build the permission-lane world through the production root factory with
 *  everything a lane needs EXCEPT the ceiling port, and drive the rise. This
 *  is the shape the root-direct corpus uses: real storage, real overlay port,
 *  the real root factory — simply no `permissionAuthorityCeiling` key (which
 *  is exactly what `host.ts:2703` is the only producer of). */
async function settleRootDirectRise(): Promise<Measured['rootDirectVerdict']> {
  const dir = scratchDir(`${SCRATCH_BASE}-root-direct`)
  destroyDir(dir)
  try {
    const seam = new FileStorageSeam(dir)
    const domain = await createTeamDomain(seam)
    const NOW = '2026-10-08T00:00:00.000Z'
    await domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(PIN_ROOT),
      instanceId: parseInstanceId(PIN_WORKER),
      templateId: parseTemplateId('worker'),
      label: 'a476 pin root-direct worker',
      childSessionId: parseChildSessionId(PIN_WORKER_CHILD),
      lifecycle: 'SETTLED',
      createdAt: NOW,
      activityVersion: 1,
    })
    const target = `${dir}/workspace/ledger-out.tsv`
    const overlayStore = await openPermissionOverlayStore(new FileStorageSeam(dir))
    const overlay = createPermissionOverlayRepositoryPort({ repository: overlayStore.repository })
    const config: TeamPluginConfig = {
      bootPhase: 'create',
      rootSessionId: PIN_ROOT,
      blueprintSource: pinBlueprintSource(target, HARD_ZERO_YAML),
      generation: 1,
      defaultWorkspace: `${dir}/workspace`,
      seedMembers: [],
      staticModel: { provider: 'a476-pin', model: 'a476-pin-model' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
    }
    const teamToolsRef = { current: undefined }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- stub-glue world hands the root the real TeamDomain (structurally satisfied), per the a3p4 production-plane pattern
    const live: any = createStubBindings({ config, teamToolsRef, domain })
    // The containment double over real directories (production injects the
    // pinned public `FileSystem.contains`), the a3p4 helper's relation.
    const fsContainsKeys: CanonicalKeyContains = (parentKey, childKey) => {
      const rel = relative(resolve(parentKey), resolve(childKey))
      return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))
    }
    const root = createTeamProductionRoot({
      config,
      domain: domain as never,
      storageSeam: seam,
      live,
      now: () => NOW,
      teamToolsRef,
      controlServiceRef: { current: undefined },
      legacyInspect: (() => {
        throw new Error('a476 pin world: legacy inspect is unused')
      }) as never,
      // THE POINT OF THE LEG: the SAME fact readers the host injects, authored
      // the way the a4p7 no-context suite authors them (carrier covering the
      // claimed cell so Alpha.3 has nothing to say; static facts deny-everything
      // so the grant is a rise) — and NO permissionAuthorityCeiling. That is
      // exactly what "the host line is absent" means at this seam, with every
      // other variable held constant.
      permissionOverlay: overlay,
      fsContainsKeys,
      permissionEnvelope: () => ({
        rules: [
          { operationClass: 'write', matcher: { kind: 'exact', resource: target }, maximumEffect: 'allow' },
        ],
      }),
      permissionStaticLayers: () => ({
        layers: [{ label: 'worker', default: 'deny', rules: [] }],
      }),
      permissionCanonicalize: async (path: string) => path,
    } as never)
    return await settleMutation(
      root.mutation.governance.mutatePermission(riseDrive('mut-a476-pin-root-direct', target)),
    )
  } finally {
    destroyDir(dir)
  }
}

describe('a4-76 — the shipped composition consults the authority ceiling; the wiring line is load-bearing for a verdict', () => {
  it('PIN-1 TRIPWIRE: through the REAL host entry, a carrier-covered rise against a zero hard ceiling does NOT commit (delete the host injection line and this leg reddens — the rise commits instead)', () => {
    expect(
      measured.emptyVerdict.changed,
      `carrier-covered rise COMMITTED against a no-authority hard ceiling: the ceiling gate was not ` +
        `consulted. This is the shipped composition WITHOUT the host's authorityCeiling injection — ` +
        `verdict: ${JSON.stringify(measured.emptyVerdict)}`,
    ).toBe(false)
  })

  it('PIN-1b: the non-commit is the CEILING speaking, not an unrelated earlier refusal — measured shipped truth: the fully-wired host converts a DECIDED-insufficient ceiling rise into the durable PROPOSAL (service.ts approvalWired, which itself requires the ceiling port)', () => {
    const verdict = measured.emptyVerdict
    expect(verdict.changed).toBe(false)
    const ceilingOwned =
      verdict.code === PERMISSION_MUTATION_ERROR_CODES.AUTHORITY_CEILING_INSUFFICIENT ||
      (verdict.reason === 'mutation-proposal-pending' && verdict.requiredAuthority === 'leader')
    expect(
      ceilingOwned,
      `the refusal was not ceiling-shaped: ${JSON.stringify(verdict)} — an earlier law (carrier, context) owns this ` +
        `verdict and the fixture has stopped measuring the ceiling`,
    ).toBe(true)
    // The proposal is durable AND zero-write: no snapshot, a case id exists.
    expect(verdict.snapshot, `a pending proposal must not carry a committed snapshot: ${JSON.stringify(verdict)}`).toBeUndefined()
    expect(typeof verdict.approvalCaseId).toBe('string')
  })

  it('PIN-2 counter-control: the IDENTICAL drive against a covering hard ceiling commits (the non-commit in PIN-1 is the hard document, not a fixture that refuses everything)', () => {
    expect(
      measured.openVerdict.changed,
      `expected the same rise to commit where the hard ceiling covers it — a false red here means the ` +
        `fixture, not the ceiling, owns the verdict: ${JSON.stringify(measured.openVerdict)}`,
    ).toBe(true)
  })

  it('PIN-3 the pinned hazard: the SAME root factory assembled WITHOUT the port commits the zero-ceiling rise (fail-open today at the root seam; this leg turns red the day the fail-closed ruling lands — read dev/agent-workflow/evidence/a4-pr7/7-6-ceiling-pin/FINDINGS.md before changing it)', () => {
    expect(
      measured.rootDirectVerdict.changed,
      `root-direct rise no longer commits: the root seam stopped failing open ` +
        `(verdict: ${JSON.stringify(measured.rootDirectVerdict)}) — if this is the fail-closed ruling ` +
        `landing, this leg must be RETITLED to the new law, not deleted`,
    ).toBe(true)
  })

  it('PIN-5 attribution: zero-authority-by-absent-fs and zero-authority-by-ceiling are TOLD APART at the verdict — the absent `fs` public service zeroes authority through the CARRIER law (typed EXPANSION_DENIED throw), never through the ceiling\'s proposal shape (world D = world B minus exactly the fs double, same COVERING ceiling that commits in PIN-2)', () => {
    // The disclosure this leg repays: the E2-pattern world doubles hide that
    // the permission fact readers canonicalize through the `fs` PUBLIC SERVICE;
    // without it every canonicalized fact abstains and the envelope reads as
    // UNKNOWN — a collaborator-absence that FAILS CLOSED, but by the same
    // "gate satisfied by an absent thing" shape as the missing ceiling port.
    // Measured (raw pin-5-POSTFLIP-GREEN.log): world D does NOT commit — but
    // its refusal is NOT ceiling-shaped:
    //   world A (ceiling zero, fs present): {changed:false, reason:
    //     'mutation-proposal-pending', requiredAuthority:'leader', approvalCaseId}
    //   world D (ceiling OPEN, fs absent):  {changed:false, code:
    //     'PERMISSION_ENVELOPE_EXPANSION_DENIED', problem expansion-region-uncovered}
    // so the two zeros are distinguishable at identity level TODAY. What this
    // leg does NOT claim: that the distinction is structural. It holds because
    // Alpha.3's coverage law consults the same abstaining envelope reader and
    // runs BEFORE the ceiling gate — if envelope reading ever detaches from fs
    // canonicalization, world D's verdict would move toward the ceiling's
    // shape, and a fs-less root-direct world would commit with nobody
    // consulted. That drift is the hazard; this leg is the tripwire.
    const d = measured.noFsVerdict
    expect(d.changed, `fs-less world must NOT commit: ${JSON.stringify(d)}`).toBe(false)
    expect(String(d.code)).toBe('PERMISSION_ENVELOPE_EXPANSION_DENIED')
    expect(String(d.reason)).toContain('expansion-region-uncovered')
    expect(d.reason).not.toBe('mutation-proposal-pending')
    expect(d.approvalCaseId).toBeUndefined()
    expect(d.requiredAuthority).toBeUndefined()
    // …and the ceiling's own zero, from world A, keeps its OWN signature.
    expect(measured.emptyVerdict.reason).toBe('mutation-proposal-pending')
    expect(measured.emptyVerdict.code ?? '').not.toBe('PERMISSION_ENVELOPE_EXPANSION_DENIED')
  })

  it('PIN-4 (WEAK, labelled census): the production tree contains exactly one producer of the ceiling reader', () => {
    // A source-text census — the WEAK kind, kept only so that a SECOND silent
    // production assembly (or a relocation that leaves leg PIN-1 watching the
    // old spelling) moves a count. PIN-1 is the instrument; this is the trip
    // wire on the census itself.
    // NOTE: the URL ctor type-collides with this project's lib URL under the
    // runtime tsconfig, so the census paths are joined off this file's path.
    const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin')
    const prod = readFileSync(join(srcDir, 'host.ts'), 'utf8')
    const root = readFileSync(join(srcDir, 'root.ts'), 'utf8')
    expect(prod.match(/permissionAuthorityCeiling:\s*createAuthorityCeilingReader\(/g) ?? []).toHaveLength(1)
    expect(root.match(/\{ authorityCeiling: permissionAuthorityCeiling \}/g) ?? []).toHaveLength(1)
  })
})
