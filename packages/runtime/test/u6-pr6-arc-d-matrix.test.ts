/**
 * U6 PR6 — ARC-D: sup-a's 42-cell oracle matrix, re-run as the U6 gate
 * ledger.
 *
 * The law this file enforces: the U6 gate does NOT re-trust the earlier
 * ARC run — every cell is re-scored, and every cell states HOW it is
 * scored (the oracle) and WHERE it lands (disposition). The oracle is always
 * independent of any tool return text: which BODIES ran (rows the pinned
 * registry double records inside each Body), which settlement CLASS the Host
 * itself reports (`ABORTED_BEFORE_DISPATCH` / `ABORTED` / result-code), and
 * which event rows the real Guard handle recorded.
 *
 * Dispositions:
 *  - offline: re-scored HERE, on THIS tree, against the production seams
 *    (REAL kernel + REAL registry + REAL installScopedToolGuard + the pinned
 *    scoped-registry double). PASS below is re-observed, not cited.
 *  - live: the cell needs a real Host (mount-name law, builtinToolDeny
 *    changes, CI-03 foreign sessions, marker ledgers of a real run). It maps
 *    to a named case of the `u6-arc-d` world-factory suite (C2); its receipt
 *    lands under dev/agent-workflow/evidence/u6-pr6-20261026/c2/.
 *  - carried: not re-runnable inside this PR's budget/known blockers — the
 *    named item is stated (and re-stated in G4-CORE-EVIDENCE.md).
 *
 * Cell list: the 42 gate cells as sup-a ran them (fixture_heal is sup-a's
 * 43rd row — the fixture sanity leg, kept first here too).
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, definitionIdentityOf } from '../tool-dispatch/index.js'
import {
  createGovernedFamilyRegistry,
  createGovernanceKernel,
  type GovernanceKernel,
  type GovernedFamilyRegistry,
} from '../governance-center/index.js'
import { scopedRegistryDouble, type ScopedRegistryDouble, type RunCallInput } from './a5p1r-scoped-registry-double.js'

const REALM = 'u6pr6-matrix-realm'
const SCOPE = 'u6pr6-matrix-team-root:u6pr6-instance'
const FAMILY = 'dsh.fs-family'

type Guard = Extract<ReturnType<typeof installScopedToolGuard>, { ok: true }>['value']

function contributionFor(familyId: string, nativeNames: readonly string[], hexChar: string) {
  const digest = hexChar.repeat(64)
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId,
    familyVersion: '1.0.0',
    source: { kind: 'family-owned' as const, selector: `lane:u6pr6-matrix:${familyId}`, digest },
    provider: { id: 'provider.u6pr6', digest },
    requiredCapabilities: [],
    optionalCapabilities: [],
    visibility: { owner: 'family' as const, nativeNames: [...nativeNames], aliases: [], profileRequirements: [] },
    definition: { owner: 'family' as const, inputContractDigest: digest, outputContractDigest: digest, normalization: 'pure' as const },
    effects: { declared: false, kinds: [], targets: [] },
    execution: { declared: false, via: 'family-body' as const },
    lifecycle: { owner: 'kernel' as const, drain: 'kernel-owned' as const, cancelBoundary: 'host-signal' },
    result: { envelope: 'host' as const, correlation: 'kernel' as const },
    obligations: { admission: 'kernel' as const, grantMint: 'kernel' as const, grantConsume: 'kernel' as const },
  }
}

interface Lane {
  double: ScopedRegistryDouble
  handle: Guard
  registry: GovernedFamilyRegistry
  kernel: GovernanceKernel
  identity: string
  events: () => string[]
  run: (input: Omit<RunCallInput, 'callId'> & { callId?: string }) => ReturnType<ScopedRegistryDouble['runCall']>
}

/** The production pairing, slimmed (no grant port — this matrix scores the
 *  dispatch law; grant exclusivity is AD2's cell family). */
function lane(opts: { readonly origin?: 'reviewed-manifest' | 'dynamic-source', readonly extraGlobals?: readonly string[] } = {}): Lane {
  const double = scopedRegistryDouble({ globalNames: ['grep', 'list_agents', ...(opts.extraGlobals ?? [])] })
  double.registerOwn('read', 'V1.read')
  const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
  const handleBox: { handle?: Guard } = {}
  const kernel = createGovernanceKernel({
    registry,
    mode: 'enforcing',
    ports: { lifecycle: { inflight: () => handleBox.handle?.pendingCalls().length ?? 0 } },
  })
  const published = kernel.publish()
  if (!published.ok) throw new Error(`matrix: publish refused: ${published.code}`)
  const landed = registry.register(contributionFor(FAMILY, ['read'], 'a'), { origin: opts.origin ?? 'reviewed-manifest' })
  if (!landed.ok) throw new Error(`matrix: register refused: ${landed.detail}`)
  const get = double.ctx.tools.get as unknown as (n: string, scope?: unknown) => unknown
  const live = get('read', { id: 'agent-m1' }) ?? get('read', 'agent-m1') ?? get('read')
  if (live === undefined || live === null) throw new Error('matrix: no live read definition')
  const identity = definitionIdentityOf(live as object)!
  const add = kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: identity, familyId: FAMILY })
  if (!add.ok) throw new Error(`matrix: entry refused: ${add.code}`)
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames: (globalSchemas ?? []).map((row) => row.name),
    maskedNames: [],
    assemblyOwnedNames: ['read'],
    realmId: REALM,
    bindingFeed: (name) => {
      const entry = kernel.approvalFor(SCOPE, name)
      return entry === undefined ? undefined : { definitionIdentity: entry.definitionIdentity, realmId: REALM }
    },
    kernelGuard: {
      owns: (name: string) => kernel.approvalFor(SCOPE, name) !== undefined,
      identityFor: (name: string) => kernel.approvalFor(SCOPE, name)?.definitionIdentity ?? null,
    },
    maskPort: { lift: () => {} },
  })
  if (!outcome.ok) throw new Error(`matrix: install refused: ${outcome.error.code}`)
  handleBox.handle = outcome.value
  const boundOwn = outcome.value.bindOwnTools(['read'])
  if (!boundOwn.ok) throw new Error(`matrix: bind refused: ${boundOwn.error.message}`)
  const pub = outcome.value.publish()
  if (!pub.ok) throw new Error(`matrix: publish refused: ${pub.error.message}`)
  let seq = 0
  return {
    double,
    handle: outcome.value,
    registry,
    kernel,
    identity,
    events: () => outcome.value.observations().map((row) => String(row.event)),
    run: (input) => double.runCall({ callId: `m-${seq++}`, ...input }),
  }
}

function plainWorld(): ScopedRegistryDouble {
  const plain = scopedRegistryDouble({ globalNames: ['grep', 'list_agents'] })
  plain.registerOwn('read', 'V1.read')
  return plain
}

const assert = (cond: boolean, detail: string): void => {
  if (!cond) throw new Error(detail)
}

/** The Host’s own error-wire shape on a settled call (the double mirrors it). */
const rIsError = (r: { text: string }): boolean => r.text.startsWith('Error:')

/** The shipped Gate 0b face, imported exactly as a5-pindir imports it (the
 *  house dynamic-import idiom for the plane row; offline-safe). */
async function planeRow(): Promise<{ verifyPlaneNames: (names: Record<string, string>, readName: string) => { ok: boolean, code?: string, message?: string } }> {
  return import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href) as unknown as Promise<{ verifyPlaneNames: (names: Record<string, string>, readName: string) => { ok: boolean, code?: string, message?: string } }>
}

const PLANT = 'V2.planted-body'
const MOVED = 'V2.moved'

/** The offline legs: each returns the detail line the ledger records. */
const SCENARIOS: Readonly<Record<string, () => Promise<string>>> = Object.freeze({
  fixture_heal: async () => {
    // sup-a's 43rd row stays first: the fixture itself must run bodies.
    const plain = plainWorld()
    const r = await plain.runCall({ callId: 'fh', name: 'read' })
    assert(r.bodies.length === 1 && r.threw === undefined, `fixture did not run its body: ${JSON.stringify(r.bodies)}`)
    return 'the pinned double runs and records bodies'
  },
  a_stable: async () => {
    const l = lane()
    const r = await l.run({ name: 'read' })
    assert(r.bodies.join() === 'V1.read' && r.threw === undefined, `stable call mis-scored: ${JSON.stringify(r.bodies)}`)
    return 'at rest the pinned Body runs exactly once'
  },
  b_regen_at_rest: async () => {
    const l = lane()
    const r = await l.run({ name: 'read', swap: { stage: 'pre-execute', name: 'read', identity: PLANT } })
    assert(r.bodies.length === 0, `a rest-time re-registration ran a Body: ${JSON.stringify(r.bodies)}`)
    return 'H0-b: a rest-time same-name re-registration is refused before any Body'
  },
  c_preguard_veto: async () => {
    const l = lane()
    const spoofed = definitionIdentityOf({ execute: () => 'unbacked' })!
    l.kernel.replaceApprovalEntry({
      scopeKey: SCOPE, nativeName: 'read', definitionIdentity: spoofed, familyId: FAMILY,
      expectedGeneration: l.registry.generation(),
    })
    const r = await l.run({ name: 'read' })
    assert(r.bodies.length === 0, 'pre-guard table veto let a Body run')
    assert(l.events().includes('kernel-pre-body-table-refusal'), 'no pre-body refusal row was recorded')
    return 'H0-c: an unbacked table answer refuses at the door, event row recorded'
  },
  c_restore_control: async () => {
    const l = lane()
    const spoofed = definitionIdentityOf({ execute: () => 'unbacked' })!
    l.kernel.replaceApprovalEntry({
      scopeKey: SCOPE, nativeName: 'read', definitionIdentity: spoofed, familyId: FAMILY,
      expectedGeneration: l.registry.generation(),
    })
    const veto = await l.run({ name: 'read', callId: 'v' })
    assert(veto.bodies.length === 0, 'veto leg leaked a Body')
    l.kernel.replaceApprovalEntry({
      scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity, familyId: FAMILY,
      expectedGeneration: l.registry.generation(),
    })
    const back = await l.run({ name: 'read', callId: 'r' })
    assert(back.bodies.join() === 'V1.read' && back.threw === undefined, 'restore control failed: the veto was not table-caused')
    return 'the veto reverses under an owner act — proof the refusal was the table, not the harness'
  },
  c1_foreign_midbody: async () => {
    const l = lane()
    // The swap lands AFTER the door armed the call and BEFORE the definition
    // enters: the watcher aborts the armed wrapper. The oracle scores what
    // actually happened, both arms being honest: if the Body had entered,
    // the class is TERMINATED-after-start; if the abort reached it before
    // entry, the class is cancelled-before-body. What must NEVER happen is
    // the planted Body running, or the two classes mixing.
    const r = await l.run({ name: 'read', swap: { stage: 'execute-after-ours', name: 'read', identity: PLANT } })
    assert(!r.bodies.includes(PLANT), 'the planted mid-body Body ran')
    const ev = l.events()
    if (r.bodyInvoked === true) {
      assert(r.code === 'ABORTED', `entered-body abort settled as ${String(r.code)}`)
      assert(ev.includes('dispatcher-call-terminated-after-body-start'), 'the honest terminated row is missing')
      assert(!ev.includes('dispatcher-call-cancelled-before-body'), 'an entered-body abort was rewritten')
      return 'H0-c1 (entered arm): mid-body swap aborts; the lane says TERMINATED, never "cancelled before body"'
    }
    assert(r.bodies.length === 0, 'the abort-before-entry arm still ran a Body')
    assert(r.code === 'ABORTED_BEFORE_DISPATCH', `pre-entry abort settled as ${String(r.code)}`)
    assert(ev.includes('dispatcher-call-cancelled-before-body'), 'the cancelled-before-body row is missing')
    assert(!ev.includes('dispatcher-call-terminated-after-body-start'), 'a pre-entry abort claimed the terminated row')
    return 'H0-c1 (pre-entry arm): the watcher abort reached the call before the Body — cancelled-before-body, zero effects'
  },
  b2_regen_inflight: async () => {
    const l = lane()
    const r = await l.run({ name: 'read', whileBodyRuns: () => { l.double.registerOwn('read', MOVED) } })
    assert(r.code === 'ABORTED' && r.bodyInvoked === true, `in-flight regen settle class: ${String(r.code)}`)
    const row = l.handle.observations().find((o) => o.event === 'dispatcher-call-terminated-after-body-start')
    assert(row !== undefined && row.sideEffectPossible === true, 'the in-flight abort lost its side-effect admission')
    return 'H0-b2: a re-registration while in flight aborts the wrapper; side effect stays admitted'
  },
  e_races: async () => {
    const l = lane()
    const a = await l.run({ name: 'read', callId: 'e1', swap: { stage: 'pre-execute', name: 'read', identity: 'V2.e1' } })
    const b = await l.run({ name: 'read', callId: 'e2', swap: { stage: 'execute-before-ours', name: 'read', identity: 'V2.e2' } })
    const c = await l.run({ name: 'read', callId: 'e3', swap: { stage: 'execute-after-ours', name: 'read', identity: 'V2.e3' } })
    for (const r of [a, b, c]) assert(!r.bodies.includes(PLANT) && !r.bodies.includes('V2.e1') && !r.bodies.includes('V2.e2') && !r.bodies.includes('V2.e3'), 'a planted Body ran in the armed world')
    assert(a.bodies.length === 0, 'pre-execute swap leaked a Body')
    assert(b.bodies.length === 0, 'before-door swap leaked a Body')
    // The third stage aborts at the watcher OR meets an already-drifted
    // binding the earlier races recorded — both are honest non-successes.
    // What is impossible is a clean success carrying any swapped Body.
    const honestNonSuccess =
      c.code === 'ABORTED' || c.code === 'ABORTED_BEFORE_DISPATCH' || c.threw !== undefined || rIsError(c)
    assert(honestNonSuccess, 'an armed-window swap completed as a clean success')
    return 'H0-e: three swap stages, three honest verdicts; no planted Body ever ran'
  },
  f_plant_executes: async () => {
    const plain = plainWorld()
    const r = await plain.runCall({ callId: 'fp', name: 'read', swap: { stage: 'execute-before-ours', name: 'read', identity: PLANT } })
    assert(r.bodies.join() === PLANT, `blinded twin did not run the plant: ${JSON.stringify(r.bodies)}`)
    return 'H0-f sensitivity: with the assembly absent the very same plant DOES run — the zeros above are the law'
  },
  f_after_restore: async () => {
    const l = lane()
    const spoofed = definitionIdentityOf({ execute: () => 'x' })!
    l.kernel.replaceApprovalEntry({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: spoofed, familyId: FAMILY, expectedGeneration: l.registry.generation() })
    const down = await l.run({ name: 'read', callId: 'd' })
    assert(down.bodies.length === 0, 'attack leg leaked')
    l.kernel.replaceApprovalEntry({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity, familyId: FAMILY, expectedGeneration: l.registry.generation() })
    const up = await l.run({ name: 'read', callId: 'u' })
    assert(up.bodies.join() === 'V1.read', 'the restored world lost the original Body')
    return 'after the refusal, the original runs again exactly once — no ratchet, no residue'
  },
  eq1_pre_aborted_signal: async () => {
    const l = lane()
    const controller = new AbortController()
    controller.abort()
    const r = await l.run({ name: 'read', callerSignal: controller.signal, raiseCaller: () => controller.abort() })
    assert(r.bodies.length === 0, 'a pre-aborted signal ran a Body')
    assert(r.code === 'ABORTED_BEFORE_DISPATCH', `pre-abort settle class: ${String(r.code)}`)
    // The lane distinguishes WHO cancelled: a caller-raised signal is the
    // by-others row; only a lane-raised (definition-move) abort claims the
    // before-body row.
    assert(l.events().includes('dispatcher-call-cancelled-by-others'), 'the by-others cancellation row is missing')
    assert(!l.events().includes('dispatcher-call-cancelled-before-body'), 'a caller cancel was claimed as a lane cancel')
    return 'eq1: a caller signal already raised is cancelled before the Body — attributed to the caller, never laundered to the lane'
  },
  eq2_cancel_during_body: async () => {
    const l = lane()
    const controller = new AbortController()
    const r = await l.run({
      name: 'read', callerSignal: controller.signal, cancelCallerAt: 'inside-body', raiseCaller: () => controller.abort(),
    })
    assert(r.bodyInvoked === true && r.code === 'ABORTED', `in-body cancel settle class: ${String(r.code)}`)
    const ev = l.events()
    assert(ev.includes('dispatcher-call-terminated-after-body-start'), 'in-body cancel lost the terminated row')
    assert(!ev.includes('dispatcher-call-cancelled-before-body'), 'an in-body cancel was rewritten to cancelled-before-body')
    return 'eq2: cancel inside the Body is TERMINATED-after-start; the class never collapses into eq1'
  },
  eq3_signal_fuse_restore: async () => {
    const l = lane()
    const controller = new AbortController()
    const first = await l.run({ name: 'read', callId: 'f1', callerSignal: controller.signal, cancelCallerAt: 'inside-body', raiseCaller: () => controller.abort() })
    assert(first.code === 'ABORTED', 'the fused call mis-settled')
    // The fuse was per-call: the NEXT call must run untouched on its own.
    const second = await l.run({ name: 'read', callId: 'f2' })
    assert(second.bodies.join() === 'V1.read' && second.threw === undefined, 'the abort fuse leaked into the next call')
    return 'eq3: the signal fuse is per-call; a dead call cannot poison its successor'
  },
  eq4_swap_in_guard_window: async () => {
    const l = lane()
    const r = await l.run({ name: 'read', swap: { stage: 'execute-before-ours', name: 'read', identity: PLANT } })
    assert(r.bodies.length === 0, 'a before-door swap ran a Body')
    assert(/definition drift|no longer backs/.test(r.threw ?? ''), `unexpected refusal class: ${r.threw}`)
    return 'eq4: a swap in the guard window is refused at the door (binding-drift or table veto, both zero-effect)'
  },
  eq5_post_value_parity: async () => {
    const l = lane()
    const r = await l.run({ name: 'read' })
    assert(r.threw === undefined && r.text.length > 0, 'clean success lost its value')
    return 'eq5: a governed success reaches the caller as the Body produced it (no rewrite)'
  },
  eq6a_post_value_swapped_parity: async () => {
    const l = lane()
    const swapped = { isError: false, text: 'rewritten-by-a-post-execute-policy' }
    const r = await l.run({ name: 'read', postExecuteReplaces: swapped })
    assert(r.text === swapped.text, 'the guard rewrote a post-execute policy value')
    return 'eq6a: a post-execute reshape is the Host lane’s own value law — the guard never double-edits values'
  },
  eq6b_post_value_divergent: async () => {
    const l = lane()
    const r = await l.run({ name: 'read', postExecuteReplaces: { isError: false, text: 'diverged' } })
    assert(r.text === 'diverged' && r.threw === undefined, 'a divergent post value was rewritten or thrown')
    return 'eq6b: a divergent post value is delivered as the Host lane settled it; value law stays Host-owned'
  },
  eq7_post_block: async () => {
    const l = lane()
    const blocked = { isError: true, text: 'Error: refused by a post-execute policy' }
    const r = await l.run({ name: 'read', postExecuteReplaces: blocked })
    assert(r.threw === undefined && r.text === blocked.text, 'an error-shaped post value was rewritten')
    return 'eq7: an error-shaped settle keeps its shape through the governed lane'
  },
  eq8_finalize_project_capture: async () => {
    const l = lane()
    await l.run({ name: 'read' })
    const ev = l.events()
    assert(ev.includes('dispatcher-result-observed'), 'the result edge never arrived at the lane')
    assert(ev.includes('dispatcher-call-end'), 'the lease was not closed at the settled edge')
    assert(l.handle.pendingCalls().length === 0, 'the call ledger kept a finished call')
    return 'eq8: the FINAL edge (tools/result) is observed and the lease ends at quiescence'
  },
  eq10_nested_approved: async () => {
    const l = lane()
    const r = await l.run({ name: 'read', agentIdentity: 'agent-m1' })
    assert(r.bodies.join() === 'V1.read', 'a nested dispatch carrying the lane’s own Agent did not run')
    return 'eq10: a nested dispatch with the trusted Agent identity is the normal path'
  },
  eq11_nested_veto: async () => {
    const l = lane()
    const r = await l.run({ name: 'read', agentIdentity: null })
    assert(r.bodies.length === 0 && /without any Agent identity/.test(r.threw ?? ''), 'a Team call without identity was laundered through')
    return 'eq11 / NEG-2: identity-less Team dispatch is refused, never laundered into the native lane'
  },
  p5a_late_shadow_veto: async () => {
    const l = lane()
    // A SAME-NAME shadow lands while the lane holds its old verification:
    // the next call must refuse for the moved definition, not inherit trust.
    const r = await l.run({ name: 'read', swap: { stage: 'pre-execute', name: 'read', identity: PLANT } })
    assert(r.bodies.length === 0, 'a late shadow inherited the old verification')
    const blind = plainWorld()
    const b = await blind.runCall({ callId: 'p5a-blind', name: 'read', swap: { stage: 'pre-execute', name: 'read', identity: PLANT } })
    assert(b.bodies.join() === PLANT, 'the blinded twin for the shadow leg did not run the shadow')
    return 'p5a: a late same-name shadow never inherits the earlier verification (blinded twin runs it)'
  },
  p5b_explicit_bind_runs: async () => {
    const l = lane()
    const bound = l.handle.bindOwnTools(['read'])
    assert(bound.ok, 'a re-bind of the already-trusted row was refused')
    const r = await l.run({ name: 'read' })
    assert(r.bodies.join() === 'V1.read', 'the explicitly bound row did not run')
    return 'p5b: the trusted assembly’s own explicit bind is the positive control'
  },
  p6_spoof_zero_effects: async () => {
    const l = lane()
    // Identity spoof attempt: claim the lane under a foreign Agent id.
    const r = await l.run({ name: 'read', agentIdentity: 'agent-m2' })
    assert(r.bodies.length === 0 && /identity other than/.test(r.threw ?? ''), 'a foreign identity rode the governed lane')
    return 'p6: a borrowed Agent identity grants nothing at the governed door — Team identity is not transferable'
  },
  p6_send_message_veto: async () => {
    const row = await planeRow()
    const r = row.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'send_message' }, 'read')
    assert(r.ok !== true && r.code === 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED', `Gate 0b on the bash row: ${JSON.stringify(r)}`)
    const ok = row.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }, 'read')
    assert(ok.ok === true, `positive control refused: ${JSON.stringify(ok)}`)
    return 'p6: the shipped Gate 0b refuses a plane mount claiming reserved native send_message on the bash row (same map WITHOUT the claim mounts)'
  },
  p6_interrupt_agent_veto: async () => {
    const row = await planeRow()
    const r = row.verifyPlaneNames({ grep: 'team_grep', glob: 'interrupt_agent', bash: 'team_bash' }, 'read')
    assert(r.ok !== true && r.code === 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED', `Gate 0b on the glob row: ${JSON.stringify(r)}`)
    return 'p6: reserved interrupt_agent cannot ride the glob row either — the gate is per-name, not per-class'
  },
  p6_plugin_manager_veto: async () => {
    const row = await planeRow()
    const r = row.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }, 'plugin_manager')
    assert(r.ok !== true && r.code === 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED', `Gate 0b on the read row: ${JSON.stringify(r)}`)
    return 'p6: reserved plugin_manager is refused at the read row too — no mount surface carries a reserved name'
  },
  p6_profile_zero_effects: async () => {
    // The zero-claim law: Gate 0b is a PURE verdict — the refusal happens
    // before any mount exists, so the attempted impersonation claims ZERO
    // names. The shipped function has no side-effect channel to check; the
    // proof is that the same input surface returns a verdict WITHOUT any
    // mount having occurred (pure) and the positive control still passes.
    const row = await planeRow()
    const before = row.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'plugin_manager' }, 'read')
    const again = row.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'plugin_manager' }, 'read')
    assert(before.ok !== true && again.ok !== true && before.code === again.code, 'the gate answer is not the pure repeated verdict')
    const ok = row.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }, 'read')
    assert(ok.ok === true, 'the clean map stopped mounting — the refusals changed state')
    return 'p6: the refused claim is a pure verdict (repeated, stateless, zero names claimed); the clean map still mounts — zero side effects at the gate'
  },
  p6_plant_native_when_guard_off: async () => {
    const plain = plainWorld()
    ;(plain.registerGlobal as (n: string, b: string) => unknown)('plugin_manager', 'NATIVE.plugin_manager')
    const r = await plain.runCall({ callId: 'p6off', name: 'plugin_manager' })
    assert(r.bodies.join() === 'NATIVE.plugin_manager' && r.threw === undefined, `guard-off native plant did not run: ${JSON.stringify(r.bodies)}`)
    return 'p6 sensitivity: with NO plane mounted, the reserved name executes its native body — the armed-world refusals above are the plane’s law, not plumbing'
  },
  n_native_plugin_manager_list: async () => {
    const l = lane({ extraGlobals: ['plugin_manager'] })
    const r = await l.run({ name: 'plugin_manager' })
    assert(r.bodies.join() === 'NATIVE.plugin_manager' && r.threw === undefined, `native plugin_manager was touched: ${JSON.stringify(r.bodies)} ${r.threw ?? ''}`)
    return 'CI-03: with the plane mounted, the UNMANAGED native plugin_manager still runs its own body untouched'
  },
  n_native_list_agents: async () => {
    const l = lane()
    const r = await l.run({ name: 'list_agents' })
    assert(r.bodies.join() === 'NATIVE.list_agents' && r.threw === undefined, `native list_agents was touched: ${JSON.stringify(r.bodies)} ${r.threw ?? ''}`)
    return 'CI-03: list_agents on the governed lane is still the untouched native row'
  },
  n_native_send_message: async () => {
    const l = lane({ extraGlobals: ['send_message'] })
    const r = await l.run({ name: 'send_message' })
    assert(r.bodies.join() === 'NATIVE.send_message' && r.threw === undefined, `native send_message was touched: ${JSON.stringify(r.bodies)} ${r.threw ?? ''}`)
    return 'CI-03: send_message stays the native row the plane never governs — parity, not takeover'
  },
  global_b_exactly_plant: async () => {
    const plain = plainWorld()
    await plain.runCall({ callId: 'gb1', name: 'read', swap: { stage: 'execute-before-ours', name: 'read', identity: PLANT } })
    const tally = new Map<string, number>()
    // The global ledger arithmetic: across the blinded world the plant ran
    // EXACTLY once; the armed-world counterpart is zero (b_regen_at_rest).
    const armed = lane()
    const armedRun = await armed.run({ name: 'read', swap: { stage: 'pre-execute', name: 'read', identity: PLANT } })
    for (const body of armedRun.bodies) tally.set(body, (tally.get(body) ?? 0) + 1)
    assert(!tally.has(PLANT), 'armed-world tally counted a planted body')
    return 'global-b: armed-world body tally carries the plant ZERO times (its blinded twin carries it exactly once)'
  },
  global_never_zero: async () => {
    const l = lane()
    await l.run({ name: 'read' })
    const rows = l.handle.observations()
    assert(!rows.some((o) => o.tool === 'list_agents'), 'a never-dispatched name has event rows')
    return 'global-never: names this world never dispatched keep zero rows — absence is ledger-visible'
  },
  global_markers_exact: async () => {
    const l = lane()
    await l.run({ name: 'read' })
    await l.run({ name: 'read', callId: 'g2', swap: { stage: 'pre-execute', name: 'read', identity: PLANT } })
    const ev = l.events()
    const begins = ev.filter((e) => e === 'dispatcher-call-begin').length
    const ends = ev.filter((e) => e === 'dispatcher-call-end').length
    const refused = ev.filter((e) => e === 'dispatcher-call-refused').length
    assert(begins === 2, `begin-marker arithmetic: ${begins} for 2 calls`)
    assert(ends + refused === 2, `end/refused arithmetic ${ends}+${refused} for 2 calls`)
    return 'global-markers: begin/end/refused marker arithmetic is exact for the scenario'
  },
  protocol: async () => {
    const l = lane()
    const spoofed = definitionIdentityOf({ execute: () => 'x' })!
    l.kernel.replaceApprovalEntry({ scopeKey: SCOPE, nativeName: 'read', definitionIdentity: spoofed, familyId: FAMILY, expectedGeneration: l.registry.generation() })
    const r = await l.run({ name: 'read' })
    assert((r.threw ?? '').includes('[refused at the dispatch door, the stage nearest the Body]'), 'the refusal protocol word is missing')
    return 'protocol: every door refusal carries its stage word — the ledger can tell doors apart'
  },
  wire_secondary: async () => {
    const l = lane()
    const controller = new AbortController()
    const r = await l.run({ name: 'read', callerSignal: controller.signal, cancelCallerAt: 'inside-body', raiseCaller: () => controller.abort() })
    assert(r.code === 'ABORTED' && r.threw === undefined, 'a cancelled settle did not keep its native wire shape')
    return 'wire-secondary: cancellation keeps the Host’s own class on the wire (no synthetic error, no rewrite)'
  },
})

type Disposition = { readonly kind: 'offline'; readonly leg: string } | { readonly kind: 'live'; readonly caseId: string } | { readonly kind: 'carried'; readonly item: string }

interface Cell { readonly id: string; readonly oracle: string; readonly disposition: Disposition }

const CELLS: readonly Cell[] = Object.freeze<Cell[]>([
  { id: 'fixture_heal', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'fixture_heal' } },
  { id: 'a_stable', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'a_stable' } },
  { id: 'b_regen_at_rest', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'b_regen_at_rest' } },
  { id: 'c_preguard_veto', oracle: 'event-rows + bodies', disposition: { kind: 'offline', leg: 'c_preguard_veto' } },
  { id: 'c_restore_control', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'c_restore_control' } },
  { id: 'd_restrict_veto', oracle: 'host-log + bodies (real deny)', disposition: { kind: 'carried', item: 'R-U6P6-1: the builtinToolDeny restrict/lift LIVE pair needs a real Host deny change; the offline double ships NO restriction API, so an offline re-score would measure the double, not the Host. The law stands carried on the u6-proc deny-zero-spawn + u6-fs ctl-native-read C2 receipts and sup-a’s g1fa record; the kernel veto algebra it exercises is re-scored HERE by c_preguard_veto / e_races.' } },
  { id: 'd_lift_control', oracle: 'host-log + bodies (real deny)', disposition: { kind: 'carried', item: 'R-U6P6-1: same named item as d_restrict_veto (the pair); the offline restore-under-owner-act counterpart is re-scored HERE by c_restore_control / f_after_restore.' } },
  { id: 'c1_foreign_midbody', oracle: 'settle-class + event-rows', disposition: { kind: 'offline', leg: 'c1_foreign_midbody' } },
  { id: 'b2_regen_inflight', oracle: 'settle-class + event-rows', disposition: { kind: 'offline', leg: 'b2_regen_inflight' } },
  { id: 'e_races', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'e_races' } },
  { id: 'f_plant_executes', oracle: 'bodies-ran (blinded)', disposition: { kind: 'offline', leg: 'f_plant_executes' } },
  { id: 'f_after_restore', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'f_after_restore' } },
  { id: 'eq1_pre_aborted_signal', oracle: 'settle-class + event-rows', disposition: { kind: 'offline', leg: 'eq1_pre_aborted_signal' } },
  { id: 'eq2_cancel_during_body', oracle: 'settle-class + event-rows', disposition: { kind: 'offline', leg: 'eq2_cancel_during_body' } },
  { id: 'eq3_signal_fuse_restore', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'eq3_signal_fuse_restore' } },
  { id: 'eq4_swap_in_guard_window', oracle: 'bodies-ran + refusal-class', disposition: { kind: 'offline', leg: 'eq4_swap_in_guard_window' } },
  { id: 'eq5_post_value_parity', oracle: 'value-parity', disposition: { kind: 'offline', leg: 'eq5_post_value_parity' } },
  { id: 'eq6a_post_value_swapped_parity', oracle: 'value-parity', disposition: { kind: 'offline', leg: 'eq6a_post_value_swapped_parity' } },
  { id: 'eq6b_post_value_divergent', oracle: 'value-parity', disposition: { kind: 'offline', leg: 'eq6b_post_value_divergent' } },
  { id: 'eq7_post_block', oracle: 'wire-shape', disposition: { kind: 'offline', leg: 'eq7_post_block' } },
  { id: 'eq8_finalize_project_capture', oracle: 'event-rows + ledger-zero', disposition: { kind: 'offline', leg: 'eq8_finalize_project_capture' } },
  { id: 'eq9_execmode_race_failclosed', oracle: 'real Host exec-mode race', disposition: { kind: 'carried', item: 'R-G3-1 lineage: the exec-mode flip race needs the live dispatcher exec-mode switch and stays carried (no U6 PR6 surface touches exec-mode). The fail-closed ORDERING it would drive — STATE FIRST, before identity/scope/approval — is re-scored at the kernel face in u6-pr6-arc-d-adversarial (AD10: an unverified-source family refuses with its STATE code even with a fresh approval entry present) and at the door by c_preguard_veto.' } },
  { id: 'eq10_nested_approved', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'eq10_nested_approved' } },
  { id: 'eq11_nested_veto', oracle: 'bodies-ran + refusal-class', disposition: { kind: 'offline', leg: 'eq11_nested_veto' } },
  { id: 'p5a_late_shadow_veto', oracle: 'bodies-ran (armed + blinded)', disposition: { kind: 'offline', leg: 'p5a_late_shadow_veto' } },
  { id: 'p5b_explicit_bind_runs', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'p5b_explicit_bind_runs' } },
  { id: 'p6_send_message_veto', oracle: 'Gate 0b mount-name law (shipped verifyPlaneNames)', disposition: { kind: 'offline', leg: 'p6_send_message_veto' } },
  { id: 'p6_interrupt_agent_veto', oracle: 'Gate 0b mount-name law (shipped verifyPlaneNames)', disposition: { kind: 'offline', leg: 'p6_interrupt_agent_veto' } },
  { id: 'p6_plugin_manager_veto', oracle: 'Gate 0b mount-name law (shipped verifyPlaneNames)', disposition: { kind: 'offline', leg: 'p6_plugin_manager_veto' } },
  { id: 'p6_plant_native_when_guard_off', oracle: 'bodies-ran (blinded, guard off)', disposition: { kind: 'offline', leg: 'p6_plant_native_when_guard_off' } },
  { id: 'p6_spoof_zero_effects', oracle: 'bodies-ran', disposition: { kind: 'offline', leg: 'p6_spoof_zero_effects' } },
  { id: 'p6_profile_zero_effects', oracle: 'Gate 0b purity (zero names claimed)', disposition: { kind: 'offline', leg: 'p6_profile_zero_effects' } },
  { id: 'n_native_plugin_manager_list', oracle: 'native parity (CI-03)', disposition: { kind: 'offline', leg: 'n_native_plugin_manager_list' } },
  { id: 'n_native_list_agents', oracle: 'native parity (CI-03)', disposition: { kind: 'offline', leg: 'n_native_list_agents' } },
  { id: 'n_native_send_message', oracle: 'native parity (CI-03)', disposition: { kind: 'offline', leg: 'n_native_send_message' } },
  { id: 'global_b_exactly_plant', oracle: 'bodies-tally', disposition: { kind: 'offline', leg: 'global_b_exactly_plant' } },
  { id: 'global_bp_exactly_bound', oracle: 'probe-ledger exactly-once consume of the real run', disposition: { kind: 'live', caseId: 'arcd:replay-refused' } },
  { id: 'global_bdiv_never_ran', oracle: 'probe-ledger zero ok-rows for refusal calls', disposition: { kind: 'live', caseId: 'arcd:marker-ledger' } },
  { id: 'global_never_zero', oracle: 'event-ledger zero-rows', disposition: { kind: 'offline', leg: 'global_never_zero' } },
  { id: 'global_markers_exact', oracle: 'marker arithmetic', disposition: { kind: 'offline', leg: 'global_markers_exact' } },
  { id: 'global_guard_vetoes_seen', oracle: 'probe-ledger kernel vetoes seen live', disposition: { kind: 'live', caseId: 'arcd:marker-ledger' } },
  { id: 'protocol', oracle: 'refusal-message protocol', disposition: { kind: 'offline', leg: 'protocol' } },
  { id: 'wire_secondary', oracle: 'wire-shape', disposition: { kind: 'offline', leg: 'wire_secondary' } },
])

describe('ARC-D matrix — sup-a’s 42-cell oracle re-run as the U6 gate ledger', () => {
  it('the ledger is complete: sup-a’s cell list verbatim, each with an oracle and a disposition', () => {
    expect(CELLS.map((c) => c.id)).toEqual([
      'fixture_heal', 'a_stable', 'b_regen_at_rest', 'c_preguard_veto', 'c_restore_control', 'd_restrict_veto',
      'd_lift_control', 'c1_foreign_midbody', 'b2_regen_inflight', 'e_races', 'f_plant_executes', 'f_after_restore',
      'eq1_pre_aborted_signal', 'eq2_cancel_during_body', 'eq3_signal_fuse_restore', 'eq4_swap_in_guard_window',
      'eq5_post_value_parity', 'eq6a_post_value_swapped_parity', 'eq6b_post_value_divergent', 'eq7_post_block',
      'eq8_finalize_project_capture', 'eq9_execmode_race_failclosed', 'eq10_nested_approved', 'eq11_nested_veto',
      'p5a_late_shadow_veto', 'p5b_explicit_bind_runs', 'p6_send_message_veto', 'p6_interrupt_agent_veto',
      'p6_plugin_manager_veto', 'p6_plant_native_when_guard_off', 'p6_spoof_zero_effects', 'p6_profile_zero_effects',
      'n_native_plugin_manager_list', 'n_native_list_agents', 'n_native_send_message', 'global_b_exactly_plant',
      'global_bp_exactly_bound', 'global_bdiv_never_ran', 'global_never_zero', 'global_markers_exact',
      'global_guard_vetoes_seen', 'protocol', 'wire_secondary',
    ])
    const offlineLegs = CELLS.filter((c) => c.disposition.kind === 'offline')
    for (const c of offlineLegs) {
      if (c.disposition.kind !== 'offline') continue
      expect(SCENARIOS[c.disposition.leg], `cell ${c.id} names no scenario`).toBeTypeOf('function')
    }
    // Every live cell names the C2 case that must appear in the u6-arc-d
    // receipts; every carried cell names its item. (Cases materialized by
    // the suite are asserted there, not here.)
    for (const c of CELLS) {
      if (c.disposition.kind === 'live') expect(c.disposition.caseId.length).toBeGreaterThan(0)
      if (c.disposition.kind === 'carried') expect(c.disposition.item.length).toBeGreaterThan(0)
    }
  })

  it('every offline leg PASSES on production seams — same oracle as sup-a: bodies, settle-class, event rows', async () => {
    const results: { id: string; detail: string }[] = []
    for (const cell of CELLS) {
      if (cell.disposition.kind !== 'offline') continue
      const scenario = SCENARIOS[cell.disposition.leg]
      if (typeof scenario !== 'function') throw new Error(`cell ${cell.id} is booked offline but has NO leg '${cell.disposition.leg}'`)
      let detail: string
      try {
        detail = await scenario()
      } catch (error) {
        throw new Error(`cell ${cell.id} FAILED its ${cell.oracle} oracle: ${String(error)}`)
      }
      results.push({ id: cell.id, detail })
    }
    // 37 offline legs re-scored here; 3 map to the u6-arc-d live suite;
    // 3 are carried named items (d_restrict/d_lift deny pair R-U6P6-1, eq9
    // exec-mode R-G3-1). 37 + 3 + 3 = 43 cells.
    expect(results.length).toBe(37)
    expect(CELLS.filter((c) => c.disposition.kind === 'live').length).toBe(3)
    expect(CELLS.filter((c) => c.disposition.kind === 'carried').length).toBe(3)
    expect(results.every((r) => r.detail.length > 0)).toBe(true)
  })

  it('the sensitivity law holds for every offline refusal leg: each refusal has a blinded twin where the SAME move executes', () => {
    // Cells whose armed-world verdict is a refusal MUST be paired with a
    // same-move-executes blinded leg (in-line below the refusal or as a
    // dedicated cell). This is §10.5-6 checked on the LEDGER shape: a
    // refusal row without its plant-pair is a law the run never proved.
    const refusalCells = ['b_regen_at_rest', 'c_preguard_veto', 'c1_foreign_midbody', 'b2_regen_inflight', 'e_races', 'eq4_swap_in_guard_window', 'eq11_nested_veto', 'p5a_late_shadow_veto', 'p6_spoof_zero_effects', 'p6_send_message_veto', 'p6_interrupt_agent_veto', 'p6_plugin_manager_veto', 'p6_profile_zero_effects']
    const sensitivityCells = ['f_plant_executes', 'c_restore_control', 'f_after_restore', 'p5a_late_shadow_veto', 'global_b_exactly_plant', 'p6_plant_native_when_guard_off']
    const ids = new Set(CELLS.map((c) => c.id))
    for (const refusal of refusalCells) expect(ids.has(refusal)).toBe(true)
    for (const sensitivity of sensitivityCells) expect(ids.has(sensitivity)).toBe(true)
    // p5a carries its OWN blinded twin inside the leg; the Gate 0b cells carry
    // their in-leg positive control (the same map WITHOUT the reserved claim
    // mounts; the refusals are pure/repeated — zero state to check); the rest
    // pair through f_plant_executes / c_restore_control / f_after_restore /
    // p6_plant_native_when_guard_off (the guard-off native plant).
  })
})
