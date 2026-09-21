/**
 * shell-result-observer.test.ts — Strict-read + Core-spill Phase D: the
 * `tools/result` adapter over a FAKE agent ctx + the REAL
 * TeamArtifactAuthority on INJECTED fakes (implementation guide §13):
 *
 *  - S1: foreground success with BOTH streams spilled → one
 *    recordShellArtifact per stream (durable facts + registry), source
 *    provenance `{kind:'shell-foreground', toolName, callId, stream}`,
 *    and the read-time vertical (authorizeRead → valid) round-trips;
 *  - S2: no spillPath (absent fields, empty strings) → zero records;
 *  - S3: a failed tool execution (isError) → ignored (no canonical
 *    value is consulted);
 *  - S4: a non-foreground value (the background handle) → ignored;
 *  - S5: a non-shell tool (and a malformed exec) → ignored;
 *  - S6: rendered text (result.content) is NEVER read — a locator-looking
 *    string inside content mints nothing (invariant 2);
 *  - S7: a record fault (ineligible lifecycle) → contained: the
 *    listener settles, the guarded onFault hook fires per stream, zero
 *    durable facts (fail-closed: the read stays denied);
 *  - S8: malformed payloads are inert (no throw, no record, no fault
 *    hook);
 *  - S9: the disposer removes the listener (cold-resume re-setup
 *    reinstalls — the same toolDisposers drain as the permission lane);
 *  - S10: a non-zero exit / timed-out SUCCESS value is recorded (R1:
 *    the isError discriminant of the RESULT bounds the observation —
 *    the command outcome is not a decision input) + the toolNames seam.
 *
 * @module @dsh-agent-team/runtime/test/shell-result-observer
 */
import { describe, expect, it } from 'vitest'
import {
  ArtifactRecordError,
  SHELL_OBSERVER_DEFAULT_TOOLS,
  TeamArtifactAuthority,
  installShellResultObserver,
  targetKeyDigest,
  versionDigest,
} from '../artifact-read/index.js'
import {
  memberIdentityKey,
  type InstanceId,
  type RootSessionId,
} from '../../contracts/src/index.js'

/**
 * The test's identity constants are plain strings; `memberIdentityKey`
 * consumes the branded domain ids. This is the test-side mirror of the
 * authority's single branding boundary (type-only — the brand is a
 * nominal marker over the same string).
 */
function mkKey(rootSessionId: string, instanceId: string): string {
  return memberIdentityKey({
    rootSessionId: rootSessionId as RootSessionId,
    instanceId: instanceId as InstanceId,
  })
}
import type {
  AgentShellResultCtx,
  ArtifactFsInfo,
  ArtifactFsPort,
  ArtifactFsTarget,
  ArtifactIdentityPort,
  ArtifactInstanceLifecycle,
  ArtifactLedgerEntry,
  ArtifactLedgerPort,
  ForegroundShellValueMirror,
  ForegroundStreamMirror,
  ShellExecMirror,
  ShellObserverFaultContext,
  ShellResultMirror,
} from '../artifact-read/index.js'

// --- constants -------------------------------------------------------------------

const ROOT = 'team-root-A'
const MEMBER = 'inst-worker-1'
const SPILL_OUT = '/dsh/spill/out-1'
const SPILL_ERR = '/dsh/spill/err-1'

// --- fakes (the same seam-free mirror fakes as the Phase A suite) -----------------

interface FsWorld {
  readonly files: Map<string, { targetKey: string; version: string; type: 'file' | 'directory' | 'other' }>
}

function makeFsWorld(): FsWorld {
  return { files: new Map<string, { targetKey: string; version: string; type: 'file' | 'directory' | 'other' }>() }
}

function seedFile(world: FsWorld, locator: string, version = 'v1', type: 'file' | 'directory' | 'other' = 'file'): void {
  world.files.set(locator, { targetKey: `tk:${locator}`, version, type })
}

function fsPort(world: FsWorld): ArtifactFsPort {
  return {
    async resolve(path: string): Promise<ArtifactFsTarget> {
      const file = world.files.get(path)
      if (file === undefined) throw new Error(`FS_NOT_FOUND: ${path}`)
      return { targetKey: file.targetKey, displayPath: path }
    },
    async stat(target: ArtifactFsTarget): Promise<ArtifactFsInfo | undefined> {
      for (const [, file] of world.files) {
        if (file.targetKey === target.targetKey) {
          return { version: file.version, type: file.type, size: 100 }
        }
      }
      return undefined
    },
  }
}

interface IdentityWorld {
  readonly lifecycles: Map<string, ArtifactInstanceLifecycle | undefined>
}

function makeIdentityWorld(): IdentityWorld {
  return { lifecycles: new Map<string, ArtifactInstanceLifecycle | undefined>() }
}

const lifecycleKey = (rootSessionId: string, instanceId: string) => `${rootSessionId}::${instanceId}`

function identityPort(world: IdentityWorld): ArtifactIdentityPort {
  return {
    instanceForSession() {
      // The shell observer path passes the composite identity from the
      // durable setup context (recordShellArtifact) — the session
      // binding resolution is the spill-store path's concern (Phase C).
      return undefined
    },
    lifecycleOf(rootSessionId: string, instanceId: string) {
      return world.lifecycles.get(lifecycleKey(rootSessionId, instanceId))
    },
  }
}

interface LedgerWorld {
  readonly entries: ArtifactLedgerEntry[]
  readonly appended: Array<{ rootSessionId: string; payload: Record<string, unknown> }>
}

function makeLedgerWorld(): LedgerWorld {
  return { entries: [], appended: [] }
}

function ledgerPort(world: LedgerWorld): ArtifactLedgerPort {
  return {
    async appendGranted(rootSessionId: string, payload: Record<string, unknown>) {
      world.appended.push({ rootSessionId, payload })
      world.entries.push({
        schemaVersion: 2,
        sequence: world.entries.length + 1,
        rootSessionId,
        factType: 'artifact-read-granted',
        payload,
        createdAt: '2026-09-20T00:00:00.000Z',
      })
    },
    async listGranted() {
      return [...world.entries]
    },
  }
}

// --- the fake agent ctx (the structural registration surface) ----------------------

interface CtxWorld {
  listener: ((exec: ShellExecMirror, result: ShellResultMirror) => void | Promise<void>) | undefined
  event: string | undefined
  onCalls: number
}

function makeAgentCtxWorld(): CtxWorld {
  return { listener: undefined, event: undefined, onCalls: 0 }
}

function asAgentCtx(world: CtxWorld): AgentShellResultCtx {
  return {
    on(event, listener) {
      world.onCalls++
      world.event = event
      world.listener = listener
      // TS 6.0.3 parser quirk: a trailing comma after a `return`
      // expression followed by the object-method closing brace is a
      // parse error (TS1109) — the disposer return stays comma-free.
      return () => {
        world.listener = undefined
      }
    },
  }
}

/** Dispatch one observation through the installed listener. */
async function dispatch(world: World, exec: ShellExecMirror, result: ShellResultMirror): Promise<void> {
  const listener = world.ctx.listener
  if (listener === undefined) return
  await listener(exec, result)
}

/**
 * PR #26 P1 — drain the in-flight records: the barrier design means the
 * listener returns BEFORE the record settles (the emitter never awaits
 * the observer), so a test that started a record must await the pending
 * table draining before asserting on durable state (the same wait the
 * permission pipeline performs through the barrier).
 */
async function settleRecords(world: World): Promise<void> {
  for (let i = 0; i < 200 && world.authority.pendingShellGrants.size > 0; i++) {
    await new Promise((resolve) => setImmediate(resolve))
  }
  // One more turn: the finally-removal + fault reporting land after the
  // record settles (both are chained on the record's promise).
  await new Promise((resolve) => setImmediate(resolve))
  expect(world.authority.pendingShellGrants.size).toBe(0)
}

// --- the fixture --------------------------------------------------------------------

interface World {
  fs: FsWorld
  identity: IdentityWorld
  ledger: LedgerWorld
  authority: TeamArtifactAuthority
  ctx: CtxWorld
  faults: Array<{ fault: unknown; context: ShellObserverFaultContext }>
  toolNames?: readonly string[]
  dispose: () => void
}

function makeWorld(toolNames?: readonly string[]): World {
  const fs = makeFsWorld()
  const identity = makeIdentityWorld()
  // The fixture agent is a RUNNING member (the standard case); individual
  // tests override the lifecycle (S7 — the terminal DISPOSED fault case).
  identity.lifecycles.set(lifecycleKey(ROOT, MEMBER), 'RUNNING')
  const ledger = makeLedgerWorld()
  const authority = new TeamArtifactAuthority({ fs: fsPort(fs), identity: identityPort(identity), ledger: ledgerPort(ledger) })
  const ctx = makeAgentCtxWorld()
  const faults: Array<{ fault: unknown; context: ShellObserverFaultContext }> = []
  const dispose = installShellResultObserver(asAgentCtx(ctx), {
    authority,
    rootSessionId: ROOT,
    instanceId: MEMBER,
    ...toolNames !== undefined ? { toolNames } : {},
    onFault: (fault, context) => {
      faults.push({ fault, context })
    },
  })
  return { fs, identity, ledger, authority, ctx, faults, ...toolNames !== undefined ? { toolNames } : {}, dispose }
}

/** A foreground success value (the structured canonical result). */
function foregroundValue(partial: Partial<ForegroundShellValueMirror> = {}): ForegroundShellValueMirror {
  return { kind: 'foreground', ...partial }
}

const bashExec: ShellExecMirror = { name: 'bash', callId: 'call-1' }
const okResult = (value: unknown): ShellResultMirror => ({ isError: false, value })

// --- the suite ----------------------------------------------------------------------

describe('installShellResultObserver (Phase D — tools/result adapter)', () => {
  it('installs on the AGENT-SCOPED tools/result event (one registration)', () => {
    const world = makeWorld()
    expect(world.ctx.onCalls).toBe(1)
    expect(world.ctx.event).toBe('tools/result')
    expect(world.ctx.listener).toBeTypeOf('function')
    expect(SHELL_OBSERVER_DEFAULT_TOOLS).toEqual(['bash', 'pwsh'])
  })

  it('S1: a foreground success with BOTH streams spilled records two grants (the full vertical round-trips)', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    seedFile(world.fs, SPILL_ERR)
    const result = okResult(
      foregroundValue({
        stdout: { text: 'head…', truncated: true, spillPath: SPILL_OUT },
        stderr: { text: 'warn…', truncated: true, spillPath: SPILL_ERR },
      }),
    )

    await dispatch(world, bashExec, result)
    // PR #26 P1 — the record runs off the critical path: drain the
    // pending table before asserting on durable state.
    await settleRecords(world)

    // Two durable facts (stdout first — the OBSERVED_STREAMS order),
    // each under the agent's durable composite identity.
    expect(world.ledger.appended).toHaveLength(2)
    expect(world.ledger.appended.map((a) => a.rootSessionId)).toEqual([ROOT, ROOT])
    const payloads = world.ledger.appended.map((a) => a.payload)
    const outPayload = payloads[0]!
    const errPayload = payloads[1]!
    expect(outPayload['locator']).toBe(SPILL_OUT)
    expect(errPayload['locator']).toBe(SPILL_ERR)
    const source = (payload: Record<string, unknown>) => {
      const s = payload['source']
      expect(s).toBeTypeOf('object')
      return s as Record<string, unknown>
    }
    expect(source(outPayload)).toEqual({ kind: 'shell-foreground', toolName: 'bash', callId: 'call-1', stream: 'stdout' })
    expect(source(errPayload)).toEqual({ kind: 'shell-foreground', toolName: 'bash', callId: 'call-1', stream: 'stderr' })
    // The runtime registry holds both grants for the composite identity
    // (invariant 18 keying).
    expect(world.authority.registry.listForIdentity(mkKey(ROOT, MEMBER))).toHaveLength(2)

    // The read-time vertical: the SAME agent reading back its own spill
    // (exact locator + fresh fs identity) → valid.
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT,
      instanceId: MEMBER,
      locator: SPILL_OUT,
      target: { targetKey: `tk:${SPILL_OUT}`, displayPath: SPILL_OUT },
    })
    expect(verdict).toEqual({ valid: true })
    const verdictErr = await world.authority.authorizeRead({
      rootSessionId: ROOT,
      instanceId: MEMBER,
      locator: SPILL_ERR,
      target: { targetKey: `tk:${SPILL_ERR}`, displayPath: SPILL_ERR },
    })
    expect(verdictErr).toEqual({ valid: true })
  })

  it('S2: no spillPath (absent fields, empty strings) → zero records', async () => {
    const world = makeWorld()
    // Neither stream spilled: no spillPath keys at all.
    await dispatch(world, bashExec, okResult(foregroundValue({ stdout: { text: 'small', truncated: false }, stderr: { text: '', truncated: false } })))
    // Empty-string spillPaths are not locators.
    await dispatch(world, bashExec, okResult(foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: '' } })))
    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(0)
  })

  it('S3: a FAILED tool execution (isError) → ignored (no canonical value consulted)', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    const result: ShellResultMirror = {
      isError: true,
      // Even a value-shaped payload on a failure must not be observed.
      value: foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: SPILL_OUT } }),
    }
    await dispatch(world, bashExec, result)
    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(0)
  })

  it('S4: a non-foreground value (the background handle) → ignored', async () => {
    const world = makeWorld()
    await dispatch(world, bashExec, okResult({ kind: 'background', jobId: 'job-1' }))
    // A value that is not the foreground discriminant (null / primitive /
    // other-object) is inert too.
    await dispatch(world, bashExec, okResult(null))
    await dispatch(world, bashExec, okResult('foreground-looking-text'))
    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(0)
  })

  it('S5: a non-shell tool (and a malformed exec) → ignored', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    const value = foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: SPILL_OUT } })
    await dispatch(world, { name: 'read', callId: 'call-2' }, okResult(value))
    await dispatch(world, { name: 'grep', callId: 'call-3' }, okResult(value))
    await dispatch(world, { name: '', callId: 'call-4' }, okResult(value))
    await dispatch(world, { name: 'bash', callId: '' }, okResult(value))
    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(0)
  })

  it('S6: rendered text (result.content) is NEVER read — invariant 2', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    // The rendered text CARRIES a locator-looking string (it looks exactly
    // like the spill notice) but the structured value has no spillPath.
    const result = {
      isError: false,
      value: foregroundValue({ stdout: { text: 'head…', truncated: true }, stderr: { text: '', truncated: false } }),
      content: [
        { type: 'text', text: `Output too large; full text at ${SPILL_OUT} — read it back with the read tool.` },
      ],
    } as unknown as ShellResultMirror
    await dispatch(world, bashExec, result)
    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(0)
  })

  it('S7: a record fault (ineligible lifecycle) → contained: the listener settles, onFault fires per stream, zero durable facts', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    seedFile(world.fs, SPILL_ERR)
    // The instance is TERMINAL: recordShellArtifact throws (fail-closed).
    world.identity.lifecycles.set(lifecycleKey(ROOT, MEMBER), 'DISPOSED')
    const result = okResult(
      foregroundValue({
        stdout: { text: 'x', truncated: true, spillPath: SPILL_OUT },
        stderr: { text: 'y', truncated: true, spillPath: SPILL_ERR },
      }),
    )

    // The listener must SETTLE (never reject into the pipeline).
    await expect(dispatch(world, bashExec, result)).resolves.toBeUndefined()

    // PR #26 P1 — the fault reporting now rides the barrier (the record
    // rejects → the pending settles failure → the guarded hook fires):
    // drain before asserting.
    await settleRecords(world)

    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(2)
    expect(world.faults.map((f) => f.context.stream)).toEqual(['stdout', 'stderr'])
    expect(world.faults.every((f) => f.fault instanceof ArtifactRecordError)).toBe(true)
    expect(world.faults[0]?.context.toolName).toBe('bash')
    expect(world.faults[0]?.context.callId).toBe('call-1')
  })

  it('S8: malformed payloads are inert (no throw, no record, no fault hook)', async () => {
    const world = makeWorld()
    const value = foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: 42 as unknown as string } })
    // A non-string spillPath (42) is not a locator.
    await dispatch(world, bashExec, okResult(value))
    // Non-object exec / result (the pinned upstream invariants make them
    // plain frozen objects, but the observer never assumes).
    await dispatch(world, null as unknown as ShellExecMirror, okResult(foregroundValue()))
    await dispatch(world, bashExec, null as unknown as ShellResultMirror)
    // A stream object that is not an object.
    await dispatch(world, bashExec, okResult(foregroundValue({ stdout: 'nope' as unknown as ForegroundStreamMirror })))
    expect(world.ledger.appended).toHaveLength(0)
    expect(world.faults).toHaveLength(0)
  })

  it('S9: the disposer removes the listener (the toolDisposers drain pair)', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    world.dispose()
    expect(world.ctx.listener).toBeUndefined()
    await dispatch(world, bashExec, okResult(foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: SPILL_OUT } })))
    expect(world.ledger.appended).toHaveLength(0)
  })

  it('S10: a non-zero exit / timed-out SUCCESS value is recorded (R1: the command outcome is not a decision input) + the toolNames seam', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT)
    const result = {
      isError: false,
      value: {
        kind: 'foreground',
        exitCode: 2,
        signal: null,
        timedOut: true,
        aborted: false,
        stdout: { text: 'partial…', truncated: true, spillPath: SPILL_OUT },
        stderr: { text: '', truncated: false },
      },
    } as unknown as ShellResultMirror
    await dispatch(world, bashExec, result)
    await settleRecords(world)
    expect(world.ledger.appended).toHaveLength(1)
    expect(world.ledger.appended[0]?.payload['locator']).toBe(SPILL_OUT)

    // The toolNames seam: a custom shell class (a test double name) is
    // observed instead of the frozen default.
    const custom = makeWorld(['myshell'])
    seedFile(custom.fs, SPILL_ERR)
    await dispatch(custom, bashExec, okResult(foregroundValue({ stderr: { text: 'x', truncated: true, spillPath: SPILL_ERR } })))
    expect(custom.ledger.appended).toHaveLength(0)
    await dispatch(custom, { name: 'myshell', callId: 'call-9' }, okResult(foregroundValue({ stderr: { text: 'x', truncated: true, spillPath: SPILL_ERR } })))
    await settleRecords(custom)
    expect(custom.ledger.appended).toHaveLength(1)
  })

  it('the digests bind the grant to the fs identity (a retargeted file is inert at use)', async () => {
    const world = makeWorld()
    seedFile(world.fs, SPILL_OUT, 'v1')
    await dispatch(world, bashExec, okResult(foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: SPILL_OUT } })))
    await settleRecords(world)
    // A same-path retarget: the file's targetKey changes (the symlink /
    // replacement class) → the fresh targetKey digest mismatches → the
    // grant is inert (no-candidate for the NEW identity).
    world.fs.files.set(SPILL_OUT, { targetKey: 'tk:retargeted', version: 'v2', type: 'file' })
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT,
      instanceId: MEMBER,
      locator: SPILL_OUT,
      target: { targetKey: 'tk:retargeted', displayPath: SPILL_OUT },
    })
    expect(verdict).toEqual({ valid: false, reason: 'no-candidate' })
    // The ORIGINAL digests are what was recorded (the issue-time identity).
    expect(world.ledger.appended[0]?.payload['targetKeyDigest']).toBe(targetKeyDigest('tk:/dsh/spill/out-1'))
    expect(world.ledger.appended[0]?.payload['versionDigest']).toBe(versionDigest('v1'))
  })

  // --- PR #26 P1 — the pending grant barrier (through the observer entry) ---

  /** A ledger port whose Nth `appendGranted` awaits the Nth gate. */
  function makeGatedLedgerPort(ledger: LedgerWorld, gates: Array<Promise<void>>) {
    let call = 0
    return {
      async appendGranted(rootSessionId: string, payload: Record<string, unknown>) {
        await gates[call++]
        ledger.appended.push({ rootSessionId, payload })
        ledger.entries.push({
          schemaVersion: 2,
          sequence: ledger.entries.length + 1,
          rootSessionId,
          factType: 'artifact-read-granted',
          payload,
          createdAt: '2026-09-20T00:00:00.000Z',
        })
      },
      async listGranted() {
        return [...ledger.entries]
      },
    } satisfies ArtifactLedgerPort
  }

  it('B1 (PR #26 P1): the observer registers the pending SYNCHRONOUSLY; an immediate read AWAITs it; release → valid (the pending never authorizes by itself)', async () => {
    // A world with a GATED ledger put (the record stalls at the durable
    // stage — exactly the in-flight window the barrier bridges).
    const fs = makeFsWorld()
    const identity = makeIdentityWorld()
    identity.lifecycles.set(lifecycleKey(ROOT, MEMBER), 'RUNNING')
    const ledger = makeLedgerWorld()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const authority = new TeamArtifactAuthority({
      fs: fsPort(fs),
      identity: identityPort(identity),
      ledger: makeGatedLedgerPort(ledger, [gate]),
    })
    const ctx = makeAgentCtxWorld()
    const faults: Array<{ fault: unknown; context: ShellObserverFaultContext }> = []
    installShellResultObserver(asAgentCtx(ctx), {
      authority,
      rootSessionId: ROOT,
      instanceId: MEMBER,
      onFault: (fault, context) => { faults.push({ fault, context }) },
    })
    seedFile(fs, SPILL_OUT)

    // The observation: the (synchronous) listener returns BEFORE the
    // record settles — the emitter never awaits it.
    ctx.listener!(bashExec, okResult(foregroundValue({ stdout: { text: 'x', truncated: true, spillPath: SPILL_OUT } })))

    // The pending is registered (synchronously) while the record is in
    // flight; NO durable grant exists yet.
    expect(authority.pendingShellGrants.size).toBe(1)
    expect(authority.registry.size).toBe(0)
    expect(ledger.appended).toHaveLength(0)

    // The immediate read must NOT settle while the record is in flight —
    // it awaits the EXACT pending (same identity, same locator).
    let settled = false
    const readP = authority.authorizeRead({
      rootSessionId: ROOT,
      instanceId: MEMBER,
      locator: SPILL_OUT,
      target: { targetKey: `tk:${SPILL_OUT}`, displayPath: SPILL_OUT },
    }).then((v) => { settled = true; return v })
    await new Promise((resolve) => setImmediate(resolve))
    expect(settled).toBe(false)

    // Release → the issuance completes → the read RE-RUNS the durable
    // verification → valid (the pending itself never authorized it).
    release()
    const verdict = await readP
    expect(verdict).toEqual({ valid: true })
    expect(authority.pendingShellGrants.size).toBe(0)
    expect(ledger.appended).toHaveLength(1)
    expect(faults).toHaveLength(0)
  })

  it('B2 (PR #26 P1): a re-issuance for the same (identity, locator) replaces the pending entry; the older record cannot remove the newer one', async () => {
    const fs = makeFsWorld()
    const identity = makeIdentityWorld()
    identity.lifecycles.set(lifecycleKey(ROOT, MEMBER), 'RUNNING')
    const ledger = makeLedgerWorld()
    let release1!: () => void
    const gate1 = new Promise<void>((resolve) => { release1 = resolve })
    let release2!: () => void
    const gate2 = new Promise<void>((resolve) => { release2 = resolve })
    const authority = new TeamArtifactAuthority({
      fs: fsPort(fs),
      identity: identityPort(identity),
      ledger: makeGatedLedgerPort(ledger, [gate1, gate2]),
    })
    seedFile(fs, SPILL_OUT)
    const args = {
      rootSessionId: ROOT,
      instanceId: MEMBER,
      source: { kind: 'shell-foreground', toolName: 'bash', callId: 'call-1', stream: 'stdout' },
      locator: SPILL_OUT,
    } as const

    // Issuance #1 (latched at its put).
    authority.beginShellArtifactRecord(args)
    const pending1 = authority.pendingShellGrants.lookup(mkKey(ROOT, MEMBER), SPILL_OUT)
    expect(pending1).toBeDefined()
    // Issuance #2 (a re-spill of the same locator) REPLACES the entry.
    authority.beginShellArtifactRecord(args)
    const pending2 = authority.pendingShellGrants.lookup(mkKey(ROOT, MEMBER), SPILL_OUT)
    expect(pending2).toBeDefined()
    expect(pending2!.promise).not.toBe(pending1!.promise)

    // The OLDER record settles first: its `finally` must NOT remove the
    // newer entry (removeIfSame compares the promise identity).
    release1()
    await new Promise((resolve) => setImmediate(resolve))
    await new Promise((resolve) => setImmediate(resolve))
    expect(authority.pendingShellGrants.size).toBe(1)
    expect(authority.pendingShellGrants.lookup(mkKey(ROOT, MEMBER), SPILL_OUT)?.promise).toBe(pending2!.promise)

    // The newer record settles → the table drains.
    release2()
    for (let i = 0; i < 200 && authority.pendingShellGrants.size > 0; i++) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    await new Promise((resolve) => setImmediate(resolve))
    expect(authority.pendingShellGrants.size).toBe(0)
    // Both durable facts landed (the re-spill supersedes at the registry,
    // but the ledger is append-only — the frozen vocabulary has no revoke).
    expect(ledger.appended).toHaveLength(2)
  })
})
