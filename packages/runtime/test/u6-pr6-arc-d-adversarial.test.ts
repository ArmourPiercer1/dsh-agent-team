/**
 * U6 PR6 — ARC-D: the adversarial suite against the PRODUCTION seams.
 *
 * Every law below is exercised through the same three real pieces the
 * governed plane wires together (`u6-pr2-rrem2-read-lane` is the wiring
 * precedent): the REAL `installScopedToolGuard` door, the REAL
 * governance-center kernel + registry, and the PINNED scoped-registry
 * double (real listener-chain order, the Host's two cancellation shapes).
 *
 * §10.5-6 law: EVERY leg ships with its plant and its blinded twin — the
 * same world without the assembly, proving the refusal is caused by the
 * law under test, not by the harness. The oracle is independent of any
 * tool return text: which BODIES ran (rows the pinned double records
 * inside the Body), which kernel/dispatcher event rows the handle
 * recorded, and the settlement CLASS the Host itself reports
 * (`RunCallResult.code`).
 *
 * The task-listed attack families, one describe each:
 *   AD1 grant mint/consume exclusivity (CI-06);
 *   AD2 replayed-grant refusal + outcome-independent burn + in-flight race;
 *   AD3 re-approval of a previously refused call (only an owner act re-arms);
 *   AD4 the second-ledger detector (one approval authority, planted twin);
 *   AD5 direct center-edit fitness (the protected-set scan must go red);
 *   AD6 TOCTOU swap before the Body (refusal, zero effects);
 *   AD7 TOCTOU swap while armed (watcher abort; TERMINATED honesty);
 *   AD8 post-body table move (success vetoed, honest shapes kept);
 *   AD9 drain/teardown order (NEG-1: mask NEVER lifted, and an
 *     after-teardown settlement makes the armed stop FOREVER honest);
 *   AD10 dynamic MCP add/remove/drift refusals (H0-e, §10.4);
 *   AD11 agent-identity law on the governed lane (CI-03 / NEG-2).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, definitionIdentityOf } from '../tool-dispatch/index.js'
import {
  createGovernedFamilyRegistry,
  createGovernanceKernel,
  type GovernedFamilyRegistry,
  type GovernanceKernel,
  type GrantConsumePort,
} from '../governance-center/index.js'
import { scopedRegistryDouble, type ScopedRegistryDouble, type RunCallInput } from './a5p1r-scoped-registry-double.js'
import {
  scanProtectedLedger,
  scanNameLiterals,
  trackedProtectedFiles,
  readTreeMap,
} from '../../testkit/test/arc-a-fitness/scan.mjs'

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url).href)
const REALM = 'u6pr6-arc-d-realm'
const SCOPE = 'u6pr6-arc-d-team-root:u6pr6-instance'
const FAMILY = 'dsh.fs-family'

type Guard = Extract<ReturnType<typeof installScopedToolGuard>, { ok: true }>['value']

/** Closed-schema contribution (FIX-K fixture form; digest per hex char so a
 *  re-registration is digest-different). */
function contributionFor(familyId: string, nativeNames: readonly string[], hexChar: string) {
  const digest = hexChar.repeat(64)
  return {
    schemaVersion: { major: 1, minor: 0, patch: 0 },
    familyId,
    familyVersion: '1.0.0',
    source: { kind: 'family-owned' as const, selector: `lane:u6pr6:${familyId}`, digest },
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

function liveDefinition(double: ScopedRegistryDouble, name: string): object {
  const get = double.ctx.tools.get as unknown as (n: string, scope?: unknown) => unknown
  const found = get(name, { id: 'agent-m1' }) ?? get(name, 'agent-m1') ?? get(name)
  if (found === undefined || found === null) throw new Error(`arc-d: tools.get resolved no ${name} definition`)
  return found as object
}

interface PortHolder {
  readonly port: GrantConsumePort
  calls: { grant: unknown; facts: Readonly<Record<string, unknown>> }[]
  answer: { ok: boolean; reason?: string }
  /** Resolve every pending consume (the port parks each call until opened). */
  open: () => void
}

function consumePort(): PortHolder {
  const calls: PortHolder['calls'] = []
  let open!: () => void
  const gate = new Promise<void>((resolve) => { open = resolve })
  const holder: PortHolder = {
    calls,
    answer: { ok: true },
    open: () => open(),
    port: {
      consumeForExecution: async (grant, facts) => {
        calls.push({ grant, facts })
        await gate
        return holder.answer
      },
    },
  }
  return holder
}

const newGate = () => {
  let open!: () => void
  const promise = new Promise<void>((resolve) => { open = resolve })
  return { promise, open: () => open() }
}

interface Lane {
  double: ScopedRegistryDouble
  handle: Guard
  registry: GovernedFamilyRegistry
  kernel: GovernanceKernel
  port: PortHolder
  maskEvents: string[]
  identity: string
  events: () => readonly string[]
}

/**
 * The production pairing (plane feed + kernel guard BOTH answer from the ONE
 * table), with the lifecycle port reading the Guard handle's OWN pending
 * ledger — the agent-bindings wiring (`inflight: () =>
 * guardHandle.pendingCalls().length`).
 */
function lane(opts: {
  readonly names?: readonly { readonly name: string; readonly label: string }[]
  readonly ownedNames?: readonly string[]
  readonly origin?: 'reviewed-manifest' | 'dynamic-source'
} = {}): Lane {
  const rows = opts.names ?? [{ name: 'read', label: 'V1.read' }]
  const double = scopedRegistryDouble({ globalNames: ['grep', 'list_agents'] })
  for (const row of rows) double.registerOwn(row.name, row.label)
  const registry = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
  const port = consumePort()
  const handleBox: { handle?: Guard } = {}
  const kernel = createGovernanceKernel({
    registry,
    mode: 'enforcing',
    ports: {
      lifecycle: { inflight: () => handleBox.handle?.pendingCalls().length ?? 0 },
      grantConsume: port.port,
    },
  })
  const published = kernel.publish()
  if (!published.ok) throw new Error(`arc-d: kernel publish refused: ${published.code}`)
  const landed = registry.register(
    contributionFor(FAMILY, rows.map((r) => r.name), 'a'),
    { origin: opts.origin ?? 'reviewed-manifest' },
  )
  if (!landed.ok) throw new Error(`arc-d: register refused: ${landed.detail}`)
  const first = rows[0]
  if (first === undefined) throw new Error('arc-d: lane needs at least one name')
  const identity = definitionIdentityOf(liveDefinition(double, first.name))!
  const maskEvents: string[] = []
  const add = kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: first.name, definitionIdentity: identity, familyId: FAMILY })
  if (!add.ok) throw new Error(`arc-d: entry refused: ${add.code}`)
  const owned = opts.ownedNames ?? rows.map((r) => r.name)
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames: (globalSchemas ?? []).map((row) => row.name),
    maskedNames: [],
    assemblyOwnedNames: [...owned],
    realmId: REALM,
    bindingFeed: (name) => {
      const entry = kernel.approvalFor(SCOPE, name)
      return entry === undefined ? undefined : { definitionIdentity: entry.definitionIdentity, realmId: REALM }
    },
    kernelGuard: {
      owns: (name: string) => kernel.approvalFor(SCOPE, name) !== undefined,
      identityFor: (name: string) => kernel.approvalFor(SCOPE, name)?.definitionIdentity ?? null,
    },
    maskPort: { lift: () => { maskEvents.push('lift') } },
  })
  if (!outcome.ok) throw new Error(`arc-d: install refused: ${outcome.error.code}`)
  handleBox.handle = outcome.value
  const boundOwn = outcome.value.bindOwnTools([...owned])
  if (!boundOwn.ok) throw new Error(`arc-d: bind refused: ${boundOwn.error.message}`)
  const pub = outcome.value.publish()
  if (!pub.ok) throw new Error(`arc-d: publish refused: ${pub.error.message}`)
  return {
    double,
    handle: outcome.value,
    registry,
    kernel,
    port,
    maskEvents,
    identity,
    events: () => outcome.value.observations().map((row) => String(row.event)),
  }
}

const run = (double: ScopedRegistryDouble, input: Omit<RunCallInput, 'callId'> & { callId?: string }) =>
  double.runCall({ callId: `c-${Math.random().toString(16).slice(2)}`, ...input })

/** The same world with NO assembly at all (sup-a's f_plant form): the
 *  oracle's blinded twin — if the planted Body does not run HERE, the zero
 *  observed in the armed world proves nothing. */
function plainWorld(): ScopedRegistryDouble {
  const plain = scopedRegistryDouble({ globalNames: ['grep', 'list_agents'] })
  plain.registerOwn('read', 'V1.read')
  return plain
}

describe('ARC-D AD1 — grant authority is the center alone (CI-06)', () => {
  it('the family face carries ZERO authority surface; the registry is not an authorizer', () => {
    const l = lane()
    const face = l.kernel.familyFace()
    // CI-06: a Family may not mint, approve, consume, or reuse a Grant —
    // concretely, the face it is handed has no members at all.
    expect(Object.keys(face)).toEqual([])
    expect(Object.isFrozen(face)).toBe(true)
    for (const stolen of ['decide', 'consumeOnce', 'addApprovalEntry', 'replaceApprovalEntry', 'approvalFor']) {
      expect((face as Record<string, unknown>)[stolen]).toBeUndefined()
      expect(l.registry as unknown as Record<string, unknown>).not.toHaveProperty(stolen)
    }
    // The registry's own surface is closed (§3 "非授权者"): nothing admits a
    // call, mints, or consumes.
    expect(Object.keys(l.registry).sort()).toEqual(['candidateFor', 'generation', 'register', 'revoke', 'view'])
  })
})

describe('ARC-D AD2 — a presented Grant never re-arms', () => {
  it('consume presents EXACTLY ONCE; concurrent presentation is GRANT_IN_FLIGHT; a replay is refused; a FAILED consume burns too', async () => {
    const l = lane()
    // in-flight race: while the first presentation is inside the port, a
    // second is refused synchronously WITHOUT reaching the port (FIX-K K2).
    const first = l.kernel.consumeOnce({ grantId: 'g1' }, 'g1', { scopeKey: SCOPE })
    const second = await l.kernel.consumeOnce({ grantId: 'g1' }, 'g1', { scopeKey: SCOPE })
    expect(second.ok).toBe(false)
    expect(second.code).toBe('GRANT_IN_FLIGHT')
    expect(second.portCalled).toBe(false)
    l.port.open()
    const settled = await first
    expect(settled.ok).toBe(true)
    expect(l.port.calls.length).toBe(1)
    // replay AFTER settlement: refused, port untouched.
    const replay = await l.kernel.consumeOnce({ grantId: 'g1' }, 'g1')
    expect(replay).toMatchObject({ ok: false, code: 'GRANT_REPLAY', portCalled: false })
    expect(l.port.calls.length).toBe(1)
    // OUTCOME-INDEPENDENT BURN: a port-side refusal is not proof the grant
    // survived THERE — the id burns anyway and can never be re-presented.
    l.port.answer = { ok: false, reason: 'admission refused' }
    const refused = await l.kernel.consumeOnce({ grantId: 'g2' }, 'g2')
    expect(refused.ok).toBe(false)
    expect(refused.portCalled).toBe(true)
    const retryAfterRefusal = await l.kernel.consumeOnce({ grantId: 'g2' }, 'g2')
    expect(retryAfterRefusal).toMatchObject({ ok: false, code: 'GRANT_REPLAY', portCalled: false })
    expect(l.port.calls.length).toBe(2)
  })
})

describe('ARC-D AD3 — a refusal is not a ratchet toward approval', () => {
  it('a table move to an unbacked identity refuses every attempt until a fresh owner act re-binds the live identity', async () => {
    const l = lane()
    // The plant: an owner act re-binds the entry to an identity nobody
    // placed — the condition-6 shape (an approval that does not back the
    // live Body). The refusal lands per call, from the table; repeating
    // the call never self-approves.
    const spoofed = definitionIdentityOf({ execute: () => 'nobody-placed-this' })!
    const moved = l.kernel.replaceApprovalEntry({
      scopeKey: SCOPE, nativeName: 'read', definitionIdentity: spoofed, familyId: FAMILY,
      expectedGeneration: l.registry.generation(),
    })
    expect(moved.ok).toBe(true)
    const r1 = await run(l.double, { name: 'read', callId: 'refused-1' })
    expect(r1.bodies).toEqual([])
    expect(r1.threw ?? '').toMatch(/kernel-owned and the center approval table no longer backs/)
    expect(l.events()).toContain('kernel-pre-body-table-refusal')
    const r2 = await run(l.double, { name: 'read', callId: 'refused-2' })
    expect(r2.bodies).toEqual([])
    expect(r2.threw ?? '').toMatch(/no longer backs/)
    // The ONLY re-approval path: a fresh owner act rebinding the CURRENT
    // live identity at the current generation.
    const restored = l.kernel.replaceApprovalEntry({
      scopeKey: SCOPE, nativeName: 'read', definitionIdentity: l.identity, familyId: FAMILY,
      expectedGeneration: l.registry.generation(),
    })
    expect(restored.ok).toBe(true)
    const r3 = await run(l.double, { name: 'read', callId: 'after-owner-act' })
    expect(r3.bodies).toEqual(['V1.read'])
    expect(r3.threw).toBeUndefined()
  })
})

describe('ARC-D AD4 — one approval ledger, detector proven by a planted twin', () => {
  const MUTATOR_RX = /\b(addApprovalEntry|replaceApprovalEntry|dropApprovalsForFamily)\s*[(:]/g
  const ALLOWED = [
    'packages/runtime/governance-center/',
    'packages/runtime/src/plugin/live/team-tool-plane.mjs',
  ]
  /** The detector: every call of the kernel-OWNER mutators outside the
   *  center itself and the single reviewed composition glue is a second
   *  ledger claiming authority. Pure over an input map, so it can be aimed
   *  at a lie (the §10.5-6 form). */
  function secondLedgerScan(files: ReadonlyMap<string, string>) {
    const violations: { path: string; line: number; mutator: string }[] = []
    for (const [path, text] of files) {
      if (ALLOWED.some((p) => path.startsWith(p))) continue
      for (const m of text.matchAll(MUTATOR_RX)) {
        violations.push({ path, line: text.slice(0, m.index).split('\n').length, mutator: m[1] ?? '?' })
      }
    }
    return violations
  }
  function productionTree(): Map<string, string> {
    const listed = execFileSync(
      'git', ['-C', REPO_ROOT, 'ls-files', 'packages/runtime', 'packages/tools'],
      { encoding: 'utf8' },
    ).split('\n').filter((p) => /\.(m?js|ts)$/.test(p) && !p.includes('/test/') && !p.includes('/dist/') && !p.endsWith('.d.mts'))
    const tree = new Map<string, string>()
    for (const p of listed) {
      // git ls-files is INDEX-based: a path deleted in the work-tree (this
      // PR removed plane-effect-backends.mjs) stays listed until commit. The
      // second-ledger scan measures the WORK TREE, so skip entries that do
      // not exist on disk — a planted twin is a real file and still lands.
      if (!existsSync(`${REPO_ROOT}${p}`)) continue
      tree.set(p, readFileSync(`${REPO_ROOT}${p}`, 'utf8'))
    }
    return tree
  }
  it('the tree as it stands has ONE owner of approval state; a planted twin family that claims approval state is caught', () => {
    const tree = productionTree()
    expect(secondLedgerScan(tree)).toEqual([])
    // PLANT: a second family lane that thinks it may keep approval state.
    tree.set('packages/tools/evil-family/src/approve.mjs', 'const seat = kernel.addApprovalEntry({ scopeKey, nativeName: "read" })\n')
    const caught = secondLedgerScan(tree)
    expect(caught.length).toBe(1)
    expect(caught[0]?.mutator).toBe('addApprovalEntry')
  })
})

describe('ARC-D AD5 — a direct center edit fails the fitness gate (must go red)', () => {
  it('L1 digest lock: editing governance-center/kernel.ts in the scanned map is a violation; the honest tree passes; L2 catches the name branch too', () => {
    const tracked = trackedProtectedFiles(REPO_ROOT) as string[]
    const ledger = JSON.parse(readFileSync(`${REPO_ROOT}dev/agent-workflow/ledgers/arc-a-protected-center.json`, 'utf8')) as {
      files: { path: string; sha256: string }[]
      overrides: { path: string; sha256: string; pr: string; reason: string }[]
    }
    const current = readTreeMap(REPO_ROOT, tracked) as Map<string, string>
    expect(scanProtectedLedger({ current, ledger, tracked }).violations).toEqual([])
    // PLANT: a family PR reaches for the center directly (a name branch
    // added to the kernel source) — the digest lock must catch it.
    const kernelPath = 'packages/runtime/governance-center/kernel.ts'
    const mutated = new Map(current)
    mutated.set(kernelPath, `${current.get(kernelPath) ?? ''}\nconst SPECIAL = (name: string) => name === 'team_bash'\n`)
    const violations = scanProtectedLedger({ current: mutated, ledger, tracked }).violations as { path: string; kind: string }[]
    expect(violations.some((v) => v.path === kernelPath && v.kind === 'digest-drift')).toBe(true)
    // L2: the same edit is ALSO a tool-name literal in center source.
    const hits = scanNameLiterals({ files: new Map([[kernelPath, mutated.get(kernelPath) ?? '']]) }).hits as { literal: string }[]
    expect(hits.some((h) => h.literal === 'team_bash')).toBe(true)
    // and it does NOT fire on the honest file.
    expect(scanNameLiterals({ files: new Map([[kernelPath, current.get(kernelPath) ?? '']]) }).hits).toEqual([])
  })
})

describe('ARC-D AD6 — the definition moved before the Body: refused, zero effects', () => {
  it('a same-name re-registration before the door is refused before any Body; with the assembly absent the PLANTED body runs', async () => {
    const l = lane()
    const r = await run(l.double, {
      name: 'read',
      callId: 'toc-pre',
      swap: { stage: 'execute-before-ours', name: 'read', identity: 'V2.whoever-registered-this' },
    })
    // The plant: a legal re-registration lands after the Guard stage and
    // before the door. Whichever of the two table-backed checks is reached
    // first (the binding-drift revision the change notification records, or
    // the kernel table at the door), the call is refused and NO Body runs.
    expect(r.bodies).toEqual([])
    expect(r.threw ?? '').toMatch(/definition drift|no longer backs/)
    expect(l.events().some((e) => e === 'guard-denial' || e === 'kernel-pre-body-table-refusal')).toBe(true)
    expect(r.bodies).not.toContain('V2.whoever-registered-this')
    // BLINDED TWIN: the same world with no assembly — the planted Body runs
    // and the oracle sees it. The zero above is the assembly's law.
    const plain = plainWorld()
    const rBlind = await run(plain, {
      name: 'read',
      callId: 'blind-pre',
      swap: { stage: 'execute-before-ours', name: 'read', identity: 'V2.whoever-registered-this' },
    })
    expect(rBlind.bodies).toEqual(['V2.whoever-registered-this'])
  })
})

describe('ARC-D AD7 — the definition moved WHILE ARMED: watcher abort, TERMINATED honesty', () => {
  it('a mid-call re-registration aborts the fused signal; the lane reports TERMINATED-after-body-start, never cancelled-before-body', async () => {
    const l = lane()
    const r = await run(l.double, {
      name: 'read',
      callId: 'toc-armed',
      whileBodyRuns: () => { l.double.registerOwn('read', 'V2.moved-mid-body') },
    })
    // The pinned Body was already resolved and ran (its side effect is
    // real); the tools/change notification aborts the armed wrapper, so the
    // Host settles the call as ABORTED (bodyInvoked true) — and the lane
    // says so out loud instead of claiming a clean cancel.
    expect(r.code).toBe('ABORTED')
    expect(r.bodyInvoked).toBe(true)
    expect(r.bodies).toEqual(['V1.read'])
    const events = l.events()
    expect(events).toContain('dispatcher-change-abort-issued')
    expect(events).toContain('dispatcher-call-terminated-after-body-start')
    expect(events).not.toContain('dispatcher-call-cancelled-before-body')
    // TERMINATED honesty (§5 cond 7/9, CI-09): the observation carries the
    // side-effect admission and never claims the effect did not happen.
    const row = l.handle.observations().find((o) => o.event === 'dispatcher-call-terminated-after-body-start')
    expect(row).toMatchObject({ sideEffectPossible: true })
    expect(JSON.stringify(row)).toContain('NOT reported as un-executed')
  })
})

describe('ARC-D AD8 — the table moved after the Body: success is vetoed, honest shapes kept', () => {
  it('a success no longer backed by the table is refused fail-closed at the gate', async () => {
    const l = lane()
    // Mid-call, an owner act re-binds the table to another identity: the
    // settled success is no longer table-backed.
    const moved = definitionIdentityOf({ execute: () => 'moved-while-running' })!
    const r = await run(l.double, {
      name: 'read',
      callId: 'post-drift',
      whileBodyRuns: () => {
        l.kernel.replaceApprovalEntry({
          scopeKey: SCOPE, nativeName: 'read', definitionIdentity: moved, familyId: FAMILY,
          expectedGeneration: l.registry.generation(),
        })
      },
    })
    expect(r.threw ?? '').toMatch(/moved while the call ran|refused fail-closed/)
    expect(l.events()).toContain('kernel-post-success-drift-veto')
    // The vetoed success never reaches the caller — but the BODY ran, and
    // the lane does not pretend otherwise: the body row stands.
    expect(r.bodies).toEqual(['V1.read'])
  })
  it('a cancelled-shaped settle keeps its native shape — the veto never rewrites an honest ABORTED', async () => {
    const l = lane()
    const moved = definitionIdentityOf({ execute: () => 'moved-while-running' })!
    const controller = new AbortController()
    const r = await run(l.double, {
      name: 'read',
      callId: 'cancel-shape',
      callerSignal: controller.signal,
      cancelCallerAt: 'inside-body',
      raiseCaller: () => controller.abort(),
      whileBodyRuns: () => {
        l.kernel.replaceApprovalEntry({
          scopeKey: SCOPE, nativeName: 'read', definitionIdentity: moved, familyId: FAMILY,
          expectedGeneration: l.registry.generation(),
        })
      },
    })
    // The Body was cancelled after it started: that is already an honest
    // non-success, and the drift law leaves it exactly as the Host shaped
    // it (no rewrite, no second refusal).
    expect(r.code).toBe('ABORTED')
    expect(r.threw).toBeUndefined()
    expect(l.events()).not.toContain('kernel-post-success-drift-veto')
  })
})

describe('ARC-D AD9 — teardown keeps the mask (NEG-1 order)', () => {
  it('the clean order releases at a self-counted zero and lifts the mask EXACTLY ONCE, at RELEASED', () => {
    const l = lane()
    const done = l.handle.disposeOrdered()
    expect(done.ok).toBe(true)
    expect(l.maskEvents).toEqual(['lift'])
    const liftRow = l.handle.observations().find((o) => o.event === 'mask-lifted')
    expect(liftRow).toMatchObject({ at: 'RELEASED' })
    // A second teardown is a no-op — it never reports a second lift.
    const again = l.handle.disposeOrdered()
    expect(again.ok).toBe(true)
    expect(l.maskEvents.length).toBe(1)
    expect(l.events()).toContain('dispose-noop')
  })
  it('dispose with a call in flight stops ARMED forever: LEASE_OPEN, EXECUTION_TERMINATION_UNCONFIRMED, mask never lifts, a late settle only alarms', async () => {
    const l = lane()
    const hold = newGate()
    const inflight = run(l.double, { name: 'read', callId: 'inflight', whileBodyRuns: () => hold.promise })
    // let the door arm the call before tearing down
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(l.handle.pendingCalls().some((c) => c.callId === 'inflight' && c.state === 'watched')).toBe(true)
    // The kernel refuses its own release on the lane's REAL ledger —
    // reached through the legal state order, so the ledger answers, not
    // the transition matrix.
    l.kernel.beginDrain()
    l.kernel.tombstone()
    const early = l.kernel.release()
    expect(early.ok).toBe(false)
    expect(early.ok === false && early.code).toBe('LEASE_OPEN')
    // The ordered teardown stops BEFORE release: mask stays armed, and it
    // says the honest thing — side effect UNKNOWN.
    const stopped = l.handle.disposeOrdered()
    expect(stopped.ok).toBe(false)
    if (!stopped.ok) expect(stopped.error.code).toBe('EXECUTION_TERMINATION_UNCONFIRMED')
    expect(l.maskEvents).toEqual([])
    // The call settles AFTER the teardown stopped: the lane does not
    // resurrect the lease — a late settle is an alarm, and the mask stays
    // armed forever. (The hazard NEG-1 exists for: claiming a clean
    // teardown over an unsettled call.)
    hold.open()
    const settled = await inflight
    expect(settled.bodies).toEqual(['V1.read'])
    const late = l.handle.disposeOrdered()
    expect(late.ok).toBe(false)
    expect(l.maskEvents).toEqual([])
    expect(l.events()).toContain('dispatcher-late-settled-after-teardown')
    // The honest split: the late settlement PROVES quiescence, so the
    // KERNEL may now release at a self-counted zero (the count is the
    // lane's own pending ledger — CI-08's "counted, never assumed"). What
    // the GUARD never does is take the late settle back as its own clean
    // teardown: disposeOrdered stays refused and the mask stays armed.
    expect(l.kernel.release().ok).toBe(true)
    expect(l.handle.disposeOrdered().ok).toBe(false)
    expect(l.maskEvents).toEqual([])
  })
})

describe('ARC-D AD10 — a dynamic source is never trusted by arrival (H0-e, §10.4)', () => {
  it('dynamic registration is not_verified (no verdict); an unbound dynamic name is refused before any Body; removal/drift refuse; only a reviewed re-registration + re-bind re-earns the seat', async () => {
    // (a) a dynamically DISCOVERED name is refused at the door: observed,
    // never on the trusted native list, bound by nobody.
    const l = lane()
    l.double.registerOwn('mcp__srv__tool', 'V.dyn')
    const r = await run(l.double, { name: 'mcp__srv__tool', callId: 'mcp-new' })
    expect(r.bodies).toEqual([])
    // (b) a dynamic-source REGISTRATION lands not_verified and can never be
    // allowed — even with an entry, the provenance law precedes it (§10.4:
    // discovery ≠ trust).
    const registry2 = createGovernedFamilyRegistry({ kernelManifest: { capabilities: {} } })
    const kernel2 = createGovernanceKernel({ registry: registry2, ports: { lifecycle: { inflight: () => 0 } }, mode: 'enforcing' })
    kernel2.publish()
    const dyn = registry2.register(contributionFor('dsh.mcp-dyn', ['mcp__srv__tool'], 'b'), { origin: 'dynamic-source' })
    expect(dyn.ok).toBe(true)
    if (dyn.ok) expect(dyn.value.state).toBe('not_verified')
    const entry = kernel2.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'mcp__srv__tool', definitionIdentity: 'whatever', familyId: 'dsh.mcp-dyn' })
    expect(entry.ok).toBe(true)
    const verdict = kernel2.decide({ nativeName: 'mcp__srv__tool', scopeKey: SCOPE, definitionIdentity: 'whatever' })
    expect(verdict.outcome).toBe('refuse')
    expect(verdict.code).toBe('NOT_VERIFIED_SOURCE')
    // (c) removal/drift after a reviewed registration: the old binding reads
    // GONE and the next call is refused with zero effects.
    const l3 = lane({ names: [{ name: 'mcp__governed__t', label: 'V.gen1' }] })
    const before = await run(l3.double, { name: 'mcp__governed__t', callId: 'before-drift' })
    expect(before.bodies).toEqual(['V.gen1'])
    // the MCP server vanishes the tool and re-adds a different generation
    l3.registry.revoke(FAMILY, 'server removed the tool')
    l3.kernel.dropApprovalsForFamily(FAMILY)
    l3.double.unregisterOwn('mcp__governed__t')
    l3.double.registerOwn('mcp__governed__t', 'V.gen2-drifted')
    const after = await run(l3.double, { name: 'mcp__governed__t', callId: 'after-drift' })
    expect(after.bodies).toEqual([])
    // (d) re-earning the seat: a reviewed re-registration + a fresh owner
    // act + an explicit re-bind by the trusted assembly (the refuse-and-
    // rebind law).
    const reReg = l3.registry.register(contributionFor(FAMILY, ['mcp__governed__t'], 'c'), { origin: 'reviewed-manifest' })
    expect(reReg.ok).toBe(true)
    const id2 = definitionIdentityOf(liveDefinition(l3.double, 'mcp__governed__t'))!
    const add2 = l3.kernel.addApprovalEntry({ scopeKey: SCOPE, nativeName: 'mcp__governed__t', definitionIdentity: id2, familyId: FAMILY })
    expect(add2.ok).toBe(true)
    const rebound = l3.handle.bindOwnTools(['mcp__governed__t'])
    expect(rebound.ok).toBe(true)
    const revived = await run(l3.double, { name: 'mcp__governed__t', callId: 're-reviewed' })
    expect(revived.bodies).toEqual(['V.gen2-drifted'])
  })
})

describe('ARC-D AD11 — the governed lane never launders identity (CI-03 / NEG-2)', () => {
  it('a foreign Agent identity is refused on governed AND native names; a no-identity call is refused; the lane’s own Agent keeps native names native', async () => {
    const l = lane()
    // Team identity is not transferable: a foreign identity cannot borrow
    // this lane (and through it, the Team's governance) for ANY name —
    // governed or native. Zero effects both times.
    const foreignGoverned = await run(l.double, { name: 'read', callId: 'foreign-read', agentIdentity: 'agent-m2' })
    expect(foreignGoverned.bodies).toEqual([])
    expect(foreignGoverned.threw ?? '').toMatch(/identity other than the one this Binding is scoped to/)
    const foreignNative = await run(l.double, { name: 'grep', callId: 'foreign-grep', agentIdentity: 'agent-m2' })
    expect(foreignNative.bodies).toEqual([])
    expect(foreignNative.threw ?? '').toMatch(/identity/)
    // NEG-2: a Team-scope call that lost its Agent identity is refused,
    // never laundered into the global native lane.
    const agentless = await run(l.double, { name: 'read', callId: 'agentless', agentIdentity: null })
    expect(agentless.bodies).toEqual([])
    expect(agentless.threw ?? '').toMatch(/without any Agent identity/)
    // CI-03 positive parity: a native name for the lane's own Agent is
    // untouched governance-wise — its own native Body answers, no veto.
    const native = await run(l.double, { name: 'grep', callId: 'native-grep' })
    expect(native.threw).toBeUndefined()
    expect(native.bodies).toEqual(['NATIVE.grep'])
    expect(l.events().some((e) => e === 'guard-denial' && /veto/.test(e))).toBe(false)
    // And without any assembly (blinded twin), the SAME names resolve to
    // their native Bodies for ANY identity — the refusals above belong to
    // the assembly, not the Host. `read` is global here so a foreign and a
    // no-identity Agent both resolve it (no Guard to refuse them).
    const plain = scopedRegistryDouble({ globalNames: ['grep', 'list_agents'] })
    plain.registerGlobal('read', 'NATIVE.read')
    const plainForeign = await run(plain, { name: 'read', callId: 'plain-read', agentIdentity: 'agent-m2' })
    expect(plainForeign.bodies).toEqual(['NATIVE.read'])
    const plainNoId = await run(plain, { name: 'read', callId: 'plain-anon', agentIdentity: null })
    expect(plainNoId.bodies).toEqual(['NATIVE.read'])
  })
})
