/**
 * a5b3-cancel-leg.test.ts — B3: the shell row's ONE cancel input is the host's
 * cooperative signal, and the row renders a cancel only when a cancel actually
 * happened, for a cause that actually means one.
 *
 * THE GAP THIS CLOSES, and its exact shape. The host carries a public,
 * documented cancellation channel on every tool call: `ToolExecutionInput.signal`
 * (api-catalog.ts:7621-7622; host dispatch invokes `tool.execute(exec.arguments, exec)`
 * at core/tools/src/index.ts:1581, and the same file's law at :228 says async work
 * MUST observe or forward `exec.signal`). Its abort reason is the closed
 * `AgentCancelCause` union — user | parent | hook(reason) | disposed — (session/src/types.ts
 * :189-193; api-catalog.ts:4469-4470; the cause object is what the turn's controller aborts
 * with: core/agent-loop/src/agent.ts:180 `abort(cause)`). Until this round the lane's
 * registration face simply DROPPED the second parameter — `makeExecute` was
 * `(raw) => …` (packages/tools/a5p5-tools/src/register.ts, the pre-B3 form), and the shell
 * row therefore had no cancel input at all: it always reported `cancelled: false`, so the
 * renderer's `bash · cancelled` branch (packages/tools/a5p5-tools/src/render.ts:183-184)
 * was UNREACHABLE through the shipped row. That unreachability was booked as a known gap,
 * not a guarantee — `a5b2-exit-code-fidelity.test.ts` X6, whose own text says the gap's
 * owner is "that face", and 根 13:50Z booked it as an independent item: provider terminate
 * is NOT a user cancel, and no rendering may ever conflate the two.
 *
 * WHAT THIS ROUND CONNECTS, minimally and additively (the approved (a) path):
 *  - `register.ts` accepts the host's execution context and carries `exec?.signal`
 *    down the call (`BackendCall.signal?: ToolCancelSignal`, the lane's own STRUCTURAL
 *    view — the lane names neither node nor host types, same purity law as its closed
 *    shapes); absent signal = "this row was never asked to cancel", which is exactly
 *    what every pre-B3 caller (and B2's X6) keeps seeing.
 *  - the shell arm of the plane backends grows ONE abort leg in its settle race, and
 *    the cancelled fact follows a closed rule:
 *        cancelled = !timedOut && aborted && cause.kind ∈ {user, parent}
 *    `hook` and `disposed` DO honor the abort (the payload is terminated — the
 *    cooperative law) but keep the death form: `exit=not-observed`, `cancelled:
 *    false`. A hook firing or a teardown is not a user pressing cancel, and the
 *    renderer must never claim it was.
 *  - the provider's `terminate()` stays what B2 measured it to be: the frozen C-PROC
 *    stage arm, reached by the row's own timeout (or by this abort leg), carrying the
 *    128+signum waitpid law. It never passes through the signal, so it cannot mint a
 *    cancelled — leg C6 pins exactly that conflation out of existence.
 *  - the settlement reuses the CLOSED vocabulary verbatim: an abort-terminated body
 *    settles `{ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' }`
 *    (spill.ts SETTLEMENT_EVENTS, six names, no new word).
 *  - render.ts, types.ts, the glob row and the search row are ZERO-MOTION: making
 *    `bash · cancelled` reachable IS the fix; the glob/search rows grow no abort leg
 *    (C7, copied in B2 X4's form plus the pre-aborted case), and the timeout leg keeps
 *    its recorded form (C5).
 *
 * Worlds live under `tests/homes/` and self-remove. The launcher is the REAL one.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { findTestRepoRoot, testUseTree } from '../../../tests/paths.mjs'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import type { SpawnRequest } from '../sandbox-provider/index.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
/**
 * MONOTONIC stopwatch for every "did it stop in time?" assertion in this spec.
 * The wall clock is NOT usable here: while this round was written, a live
 * forward clock step turned a 432ms run into a `Date.now()` delta of 27176ms
 * (caught in the wild, green-fixed-v2 run #2). The runtime lane's node-min
 * shim deliberately types only `process.cwd`, so the clock is taken through a
 * local structural view — the same discipline as `SettleMod` below, and it
 * touches no shared shim.
 */
const nowMs = (): number =>
  Number((globalThis as unknown as { process: { hrtime: { bigint(): bigint } } }).process.hrtime.bigint()) / 1_000_000

const WORLD = join(REPO, 'tests/homes', `a5b3-unit-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root') // the governed root / shell cwd
const SLOW = 120_000

/**
 * The execution context this round's row reads. Structural, exactly like the
 * lane's `ToolCancelSignal`: the test holds it open so the legs can hand it a
 * REAL AbortController, and a plain object carrying nothing is the ABSENT case.
 */
interface ExecLike { readonly signal?: AbortSignal }
type Exec = (raw: unknown, exec?: ExecLike) => Promise<{ text: string }>
interface PlaneValue {
  definitions: ReadonlyArray<{ name: string; execute: Exec }>
  ownNames: readonly string[]
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) =>
    | { ok: true; value: PlaneValue }
    | { ok: false; code: string; message: string }
}
let row: PlaneRow

const REALM = 'a5b3-realm'
const SYSTEM_RX = (path: string) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const ANCHOR = { path: ROOT_DIR, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } }
const grant = () => [
  SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
  ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
  ANCHOR,
]

const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane() {
  const built = row.createTeamToolPlaneAssembly({
    permissionPolicy: ALLOW_ALL,
    realmId: REALM,
    templateId: 'a5b3-tpl',
    role: 'member',
    instanceId: 'a5b3-instance',
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'a5b3-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        // #337 closing round (review-B item 5 law): provider scratch is a LAW,
        // not an option — the provider refuses an absent/relative scratchRoot
        // (it would otherwise land the plans/out/probe trees in the process
        // cwd). Fixture-side key; the rows this leg pins stay zero-motion.
        scratchRoot: join(WORLD, 'scratch-confined'),
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
    },
  })
  expect(built.ok, JSON.stringify(built)).toBe(true)
  if (!built.ok) throw new Error('unreachable')
  return built.value
}

function def(value: PlaneValue, name: string) {
  const d = value.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no def named ${name} on the plane (ownNames=${value.ownNames.join(',')})`)
  return d
}

/** The `a5p5-meta {...}` tail the renderer appends — the wire-visible truth. */
function metaOf(text: string): Record<string, unknown> {
  const at = text.lastIndexOf('a5p5-meta ')
  expect(at, `no a5p5-meta tail on the wire: ${text}`).toBeGreaterThan(-1)
  return JSON.parse(text.slice(at + 'a5p5-meta '.length)) as Record<string, unknown>
}

/** Abort the controller with a cause shaped exactly like the host's closed union arm. */
function abortWith(controller: AbortController, cause: Record<string, unknown>, afterMs: number): void {
  setTimeout(() => { controller.abort(cause) }, afterMs)
}

/** A provider on the REAL launcher (no fakes anywhere in this file). */
async function realProvider() {
  const provider = createConfinedProcessProvider({
    realmId: REALM,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: WORLD,
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const probed = await provider.probe()
  expect(probed.ok, JSON.stringify(probed)).toBe(true)
  return provider
}

function request(command: string, over: Partial<SpawnRequest> = {}): SpawnRequest {
  return {
    grantFingerprint: `a5b3:${command}:${Math.random().toString(36).slice(2)}`,
    realmId: REALM,
    bindingId: 'a5b3-binding',
    memberScope: 'a5b3-instance',
    argv: ['/bin/sh', '-c', command],
    cwd: ROOT_DIR,
    env: [['PATH', '/usr/bin:/bin']],
    allowPaths: grant(),
    exitPassthrough: true,
    ...over,
  }
}

beforeAll(async () => {
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
  writeFileSync(join(ROOT_DIR, 'data', 'needle.txt'), 'A5B3-INSIDE-TOK\nnoise line\n')
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
})

afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('B3 C — the shell row honors the host cancel signal, and only for the causes that mean it', () => {
  it('C1 user cancel: mid-run abort with cause {kind:\'user\'} renders `bash · cancelled` and settles fast (covers 根①-input; the dedicated PRE-aborted leg is C1b)', async () => {
    // The RED leg of this round: pre-B3 this line could never appear through the
    // shipped row (the second execute() parameter was dropped at the registration
    // face, so the row never learned a cancel existed). The elapsed bound is part
    // of the leg: a cancel must STOP the payload, not relabel it after the fact.
    const plane = buildPlane()
    const controller = new AbortController()
    abortWith(controller, { kind: 'user' }, 400)
    const started = nowMs()
    const res = await def(plane, 'team_bash').execute({ command: 'sleep 12' }, { signal: controller.signal })
    const elapsed = nowMs() - started
    const meta = metaOf(res.text)
    expect(res.text).not.toContain('a5p5-refused') // the abort-settlement stays inside the six-name closed vocabulary
    expect(res.text, `a user cancel must render the cancelled shape: ${res.text}`).toContain('bash · cancelled')
    expect(meta.cancelled).toBe(true)
    expect(meta.timedOut, 'a cancel is not a timeout').toBe(false)
    expect(elapsed, `the payload must actually be stopped (took ${String(elapsed)}ms of its 12000ms)`).toBeLessThan(10_000)
  }, SLOW)

  it('C1b abort ALREADY fired before the call (根①): a pre-aborted signal cancels at once, no race with the payload', async () => {
    // 根① gets its own leg: the signal arrives with `aborted === true` already.
    // The abort leg must settle at race setup — deterministic, no dependence on
    // event ordering — and the row must terminate the payload immediately.
    // What that termination honestly preserves (spawned-first, controlled,
    // fast; payload-statement execution recorded, not asserted) is witnessed
    // by C11 — no invented "pre-abort means un-executed" semantics live
    // anywhere in this row.
    const plane = buildPlane()
    const done = new AbortController()
    done.abort({ kind: 'user' })
    const started = nowMs()
    const res = await def(plane, 'team_bash').execute({ command: 'sleep 12' }, { signal: done.signal })
    const elapsed = nowMs() - started
    expect(res.text).toContain('bash · cancelled')
    expect(metaOf(res.text).cancelled).toBe(true)
    expect(elapsed, `a pre-aborted call must not wait for its payload (took ${String(elapsed)}ms)`).toBeLessThan(10_000)
  }, SLOW)
  it('C11 根①-boundary witness (root 16:30Z ③): a pre-aborted call reaches this row AFTER the provider spawned; the row acts by immediate controlled termination; whether the payload executed any statement is RECORDED, never bet', async () => {
    // Evidence-first wording (先证据后措辞), and the evidence corrected an
    // assumption before it could ship. This arm SPAWNS, THEN races — the row
    // cannot un-spawn. The spawn-side witness is deterministic and asserted:
    // the provider mkdir's the per-plan outDir during stream spawn
    // (provider.ts:607-608), so the scratchRoot's out/ existing proves this call really
    // reached spawn, payload timing irrelevant. What the PAYLOAD manages to
    // execute before the kill is NOT row-determined: measured, terminate's
    // first-tick SIGTERM (provider.ts:400-412) landed BEFORE the payload's
    // first statement ran — the witness write (the script's first statement)
    // did not land and the row settled in ~240ms. So this leg RECORDS whether
    // the payload's own side
    // effect landed (and stamps its order vs the abort if it did) without
    // asserting a direction — a leg betting on either side would be exactly
    // the timing bet the root banned. The honest boundary stands: SPAWNED
    // FIRST, terminated under control and fast; no wording here or in the
    // README may rewrite the measured "settles in ~250ms of controlled
    // termination" into "never started" — nor, for the same reason, into
    // "always ran". Scope: the HOST never routes such a call here (dispatch
    // pre-check, core/tools/src/index.ts:1572-1574 in the pinned test-use
    // checkout, answers toolAbortedBeforeDispatchResult before `execute`);
    // this seam is the belt for direct/non-host callers.
    const plane = buildPlane()
    const witness = join(ROOT_DIR, `c11-witness-${Date.now().toString(36)}`)
    const outs = join(WORLD, 'scratch-confined', 'out') // the fixture's explicit scratchRoot (added by the #337 closing round); the provider's out tree rides the scratchRoot it was given (provider.ts:607-608)
    const outCount = () => (existsSync(outs) ? readdirSync(outs).length : 0)
    const outBefore = outCount()
    const done = new AbortController()
    const abortAt = Date.now() // stamped BEFORE the call: anything this call
    done.abort({ kind: 'user' }) // spawns is therefore after the abort
    const started = nowMs()
    const res = await def(plane, 'team_bash').execute(
      { command: `echo ran > '${witness}'; sleep 8`, timeout: 10 },
      { signal: done.signal },
    )
    const elapsed = nowMs() - started
    expect(res.text).toContain('bash · cancelled')
    expect(metaOf(res.text).cancelled).toBe(true)
    expect(outCount(), 'this very call must have reached spawn — the provider mkdir\'s a fresh per-plan outDir during stream-spawn prep (provider.ts:607-608), so a pre-aborted call reaching THIS row was spawned first, by construction').toBeGreaterThanOrEqual(outBefore + 1)
    const landed = existsSync(witness)
    console.info(`[a5b3 C11] pre-abort boundary observed: payload-side-effect-landed=${String(landed)} settled-in=${String(Math.round(elapsed))}ms abort-at=${String(abortAt)}`)
    if (landed) {
      const st = statSync(witness) as unknown as { mtimeMs: number } // the lane shim types statSync structurally; mtimeMs read like the hrtime cast above
      expect(Math.floor(st.mtimeMs), 'whatever the payload wrote necessarily postdates the abort').toBeGreaterThanOrEqual(abortAt)
    }
    expect(elapsed, `the controlled terminate must confirm fast, not after the 8s payload (took ${String(elapsed)}ms)`).toBeLessThan(10_000)
  }, SLOW)

  it('C2 parent cancel: cause {kind:\'parent\'} is the same cancelled shape (a parent tearing down its child\'s call IS a cancel)', async () => {
    // RED pre-B3 for the same reason as C1. 'parent' is the second arm of the
    // host's two "someone asked for this to stop" causes; the row treats them
    // identically because the RENDERED fact ("cancelled") does not name the
    // requester — the closed union lives in the settlement plane, not the wire.
    const plane = buildPlane()
    const controller = new AbortController()
    abortWith(controller, { kind: 'parent' }, 400)
    const started = nowMs()
    const res = await def(plane, 'team_bash').execute({ command: 'sleep 12' }, { signal: controller.signal })
    const elapsed = nowMs() - started
    expect(res.text, `a parent cancel must render the cancelled shape: ${res.text}`).toContain('bash · cancelled')
    expect(metaOf(res.text).cancelled).toBe(true)
    expect(elapsed, `the payload must actually be stopped (took ${String(elapsed)}ms of its 12000ms)`).toBeLessThan(10_000)
  }, SLOW)

  it('C3 hook/disposed: the abort is HONORED (payload terminated) but the death form stands — never `bash · cancelled`', async () => {
    // The other two arms of AgentCancelCause are NOT someone pressing cancel:
    // 'hook' is policy firing under it, 'disposed' is teardown. The row stops
    // the payload (the cooperative law — the host asked the call to end), but
    // what the model reads is the honest death: `exit=not-observed`, timedOut
    // false, cancelled FALSE. Rendering these as cancelled would mint a user
    // intent that never existed; that is precisely the conflation 根 13:50Z
    // booked this round to keep out. RED pre-B3 for a different reason than
    // C1/C2: with no cancel input the payload simply ran to its natural
    // `exit=0` — completion reported for a call the host had already ended.
    const plane = buildPlane()
    for (const cause of [{ kind: 'hook', reason: 'a5b3-policy-hook' }, { kind: 'disposed' }]) {
      const controller = new AbortController()
      abortWith(controller, cause, 400)
      const started = nowMs()
      const res = await def(plane, 'team_bash').execute({ command: 'sleep 12' }, { signal: controller.signal })
      const elapsed = nowMs() - started
      const meta = metaOf(res.text)
      expect(res.text, `cause ${JSON.stringify(cause)} must NOT be rendered as a cancel: ${res.text}`).not.toContain('bash · cancelled')
      expect(meta.cancelled, `cause ${JSON.stringify(cause)} must not mint a cancel`).toBe(false)
      expect(meta.timedOut).toBe(false)
      expect(meta.exitCode, `an aborted payload never reported an end; inventing one is B2's defect class`).toBeNull()
      expect(res.text).toContain('bash · exit=not-observed')
      expect(elapsed, `cause ${JSON.stringify(cause)}: the abort must still STOP the payload (took ${String(elapsed)}ms)`).toBeLessThan(10_000)
    }
  }, SLOW)

  it('C4 positive control with a LIVE signal: a normal run still reports the code it measured (the wiring is additive)', async () => {
    // This leg is green BEFORE the change on purpose: it pins that threading a
    // signal that never fires changes nothing — the exact B2 X3 numbers, now
    // carried past a signal the row is watching.
    const plane = buildPlane()
    const controller = new AbortController() // never aborted
    const res = await def(plane, 'team_bash').execute({ command: 'exit 7' }, { signal: controller.signal })
    const meta = metaOf(res.text)
    expect(meta.exitCode).toBe(7)
    expect(meta.cancelled).toBe(false)
    expect(meta.timedOut).toBe(false)
    expect(res.text).toContain('bash · exit=7')
  }, SLOW)

  it('C5 the timeout leg keeps its recorded form past a live signal: exit=not-observed · timed-out, cancelled false', async () => {
    // B2 X5, re-pinned WITH the cancel input present. A timeout is the row's own
    // budget, not a cancel — and the guard `!timedOut` means even a cancel
    // landing around the terminate window cannot rewrite a timed-out outcome
    // into a cancelled one.
    const plane = buildPlane()
    const controller = new AbortController() // never aborted
    const res = await def(plane, 'team_bash').execute({ command: 'sleep 15', timeout: 1 }, { signal: controller.signal })
    const meta = metaOf(res.text)
    expect(meta.timedOut).toBe(true)
    expect(meta.cancelled, 'a timeout is not a cancel').toBe(false)
    expect(meta.exitCode, 'a timed-out run never produced a code').toBeNull()
    expect(res.text).toContain('bash · exit=not-observed · timed-out')
    expect(res.text).not.toContain('bash · cancelled')
  }, SLOW)

  it('C6 provider terminate is NOT a cancel (根 13:50Z booked this as its own leg): terminate carries the waitpid death, never the cancelled word', async () => {
    // Two halves, neither touching an AbortSignal at all.
    // (1) The provider seam, B2 A4 re-measured: terminate() is the frozen
    //     C-PROC stage arm; the payload it stops settles as a 128+signum
    //     waitpid death — a number the launcher MEASURED, not a fabricated 0
    //     and not a null.
    const provider = await realProvider()
    const handle = await provider.spawnStreaming(request('sleep 30'))
    expect(handle.ok).toBe(true)
    if (!handle.ok) return
    const h = handle.value
    const pending = h.exited
    await new Promise((r) => setTimeout(r, 250)) // let the payload actually start
    const term = await h.terminate()
    expect(term.ok, JSON.stringify(term)).toBe(true)
    const info = await pending
    expect(info.code, 'a terminated payload must not report success').not.toBe(0)
    expect(info.code, 'a terminated payload must not be reported as unobserved').not.toBeNull()
    expect(info.code! >= 128 && info.code! <= 128 + 31,
      `expected a 128+signum mapping, got ${String(info.code)} (signal=${String(info.signal)})`).toBe(true)
    // (2) The row, signal-free: a payload whose own death-by-signal reaches the
    //     same waitpid law reads as the NUMBER (B2 A3's 143), never as a
    //     cancel. If terminate could ever arrive through the cancel path, this
    //     is the leg that would catch the conflation.
    const plane = buildPlane()
    const res = await def(plane, 'team_bash').execute({ command: 'kill -TERM $$' })
    expect(metaOf(res.text).exitCode).toBe(143)
    expect(metaOf(res.text).cancelled, 'signal death is not a cancel').toBe(false)
    expect(res.text).not.toContain('bash · cancelled')
  }, SLOW)

  it('C7 zero-motion next door, in B2 X4\'s own form: the glob and search rows carry neither an exit code nor a cancelled word — WITH a live signal and with one already aborted', async () => {
    // The signal now travels on every BackendCall, so the anti-collateral pin
    // needs both cases: (i) B2 X4 verbatim — a live, never-aborted signal
    // changes nothing on either row's wire; (ii) a signal ALREADY aborted when
    // the call arrives — these two rows deliberately did NOT grow an abort
    // leg, so they finish the work that was admitted and settle `completed`.
    // Zero-motion is a two-sided claim; pinning only case (i) would let a
    // copy-paste of the shell arm's abort leg into either row pass it.
    const plane = buildPlane()
    const live = new AbortController() // never aborted — B2 X4's own case
    const pre = new AbortController()
    pre.abort({ kind: 'user' }) // already cancelled when the call arrives
    for (const controller of [live, pre]) {
      const exec = { signal: controller.signal }
      const grep = await def(plane, 'team_grep').execute({ pattern: 'A5B3-INSIDE-TOK', path: '.', output_mode: 'content' }, exec)
      expect(grep.text).toContain('A5B3-INSIDE-TOK')
      expect(grep.text).not.toContain('exit=')
      expect(grep.text).not.toContain('cancelled')
      expect(JSON.stringify(metaOf(grep.text))).not.toContain('exitCode')
      expect(JSON.stringify(metaOf(grep.text))).not.toContain('cancelled')
      const glob = await def(plane, 'team_glob').execute({ pattern: '*.txt' }, exec)
      expect(glob.text).toContain('needle.txt')
      expect(glob.text).not.toContain('exit=')
      expect(glob.text).not.toContain('cancelled')
      expect(JSON.stringify(metaOf(glob.text))).not.toContain('exitCode')
      expect(JSON.stringify(metaOf(glob.text))).not.toContain('cancelled')
    }
  }, SLOW)

  // 根 14:13Z 覆盖面加令: the two RACE legs use deterministic injection — a
  // controlled deferred for `exited`, an injected fake `sleep` for the timeout —
  // never a sleep-timing bet. They exercise the production settle seam itself
  // (`raceShellSettle`, which the shell arm calls), so what they pin is the
  // code that ships, not a spec-side reimplementation. The tie law is the race
  // array's registration order — `exited > timedOut > aborted` — and it is the
  // ONLY ordering claim any leg is allowed to make.

  interface SettleMod {
    raceShellSettle: (o: { exited: Promise<unknown>; timeoutMs: number; signal?: AbortSignal; sleep: (cb: () => void, ms: number) => unknown }) => Promise<Record<string, unknown>>
    shellCancelled: (o: { timedOut: boolean; aborted: boolean; reason: unknown }) => boolean
  }
  async function settleMod(): Promise<SettleMod> {
    return (await import(new URL('../src/plugin/live/plane-effect-backends.mjs', import.meta.url).href)) as unknown as SettleMod
  }

  it('C8 根② exit-vs-cancel, deterministic: whichever fact settles the race is the SINGLE truth; if both already exist, the payload\'s own end OUTRANKS the cancel (tie law exited > timedOut > aborted)', async () => {
    const mod = await settleMod()
    // Case 1 — the payload ends first, the cancel is late: the winner is the
    // process report; a later abort can never rewrite a settled exit.
    let resolveExited: ((v: Record<string, unknown>) => void) | null = null
    const exited = new Promise<Record<string, unknown>>((r) => { resolveExited = r })
    const controller = new AbortController()
    const w1p = mod.raceShellSettle({ exited, timeoutMs: 60_000, signal: controller.signal, sleep: () => undefined }) // timer HELD forever
    resolveExited!({ code: 7, signal: null, timedOut: false }) // a real launcher report: timedOut false IS part of the shape; the row law reads === true
    const w1 = await w1p
    expect(w1.timedOut, 'a settled exit is not a timeout').not.toBe(true)
    expect(w1.aborted, 'a settled exit is not an abort').toBeUndefined()
    expect(w1.code).toBe(7)
    controller.abort({ kind: 'user' }) // the late cancel: the race already settled exactly once
    expect((await w1p).code, 'the winner is settled for good — no dual truth').toBe(7)

    // Case 2 — the cancel lands first, the exit is late: the winner is the
    // abort; a later exit can never rewrite it into an exit code.
    let resolveLate: ((v: Record<string, unknown>) => void) | null = null
    const late = new Promise<Record<string, unknown>>((r) => { resolveLate = r })
    const controller2 = new AbortController()
    const w2p = mod.raceShellSettle({ exited: late, timeoutMs: 60_000, signal: controller2.signal, sleep: () => undefined })
    controller2.abort({ kind: 'user' })
    const w2 = await w2p
    expect(w2.aborted).toBe(true)
    resolveLate!({ code: 0, signal: null, timedOut: false }) // the payload DID finish later — irrelevant now
    expect((await w2p).aborted, 'the abort settled the race for good').toBe(true)
    expect((await w2p).code, 'no exit code may ride the aborted winner').toBeUndefined()

    // Case 3 — the TIE the root ordered pinned: at race construction BOTH facts
    // already exist (exited resolved + signal already aborted). The law is the
    // race array's registration order: the payload's own end outranks the
    // cancel, and it is deterministic BY CONSTRUCTION, not by scheduling luck.
    const preAborted = new AbortController()
    preAborted.abort({ kind: 'user' })
    const already = Promise.resolve({ code: 3, signal: null, timedOut: false })
    const w3 = await mod.raceShellSettle({ exited: already, timeoutMs: 60_000, signal: preAborted.signal, sleep: () => undefined })
    expect(w3.code, 'both facts exist: the measured end wins the tie (pinned law)').toBe(3)
    expect(w3.aborted, 'the tie is decided ONCE: cancelled cannot also be true').toBeUndefined()
  }, SLOW)

  it('C9 根③ timeout-vs-cancel, deterministic: a same-tick timeout OUTRANKS the abort (timedOut > aborted); an abort with the timer held is an abort — no timing luck', async () => {
    const mod = await settleMod()
    // Case 1 — same-tick: the timeout leg is settled AT CONSTRUCTION (injected
    // immediate sleep) and the signal is already aborted. Array order settles
    // it: timed-out owns the form; and the cancelled law refuses to mint a
    // cancel on top (the guard, at the pure law). This is the pinned
    // `timedOut > aborted` precedence, exercised through the production race.
    const preAborted = new AbortController()
    preAborted.abort({ kind: 'user' })
    const w1 = await mod.raceShellSettle({
      exited: new Promise<Record<string, unknown>>(() => { /* never — only the two racing facts exist */ }),
      timeoutMs: 60_000,
      signal: preAborted.signal,
      sleep: (cb) => { cb() }, // the timeout leg settles synchronously at construction
    })
    expect(w1.timedOut, 'timeout wins the same-tick tie (array order)').toBe(true)
    expect(w1.aborted, 'and the abort is decided out — no dual truth').toBeUndefined()
    expect(mod.shellCancelled({ timedOut: w1.timedOut === true, aborted: w1.aborted === true, reason: preAborted.signal.reason }), 'the composed law: timed-out form, no cancelled on top').toBe(false)

    // Case 2 — the reverse window: timer HELD (never fires), abort lands.
    // The winner is the abort; the pinned order does not invent a timeout.
    // (The promise is taken BEFORE the abort is fired and only awaited after —
    // awaiting a race whose only remaining leg is the signal would otherwise
    // deadlock the leg itself, which is exactly the injection discipline this
    // pair of legs is for.)
    const controller = new AbortController()
    const w2p = mod.raceShellSettle({ exited: new Promise<Record<string, unknown>>(() => {}), timeoutMs: 60_000, signal: controller.signal, sleep: () => undefined })
    controller.abort({ kind: 'parent' })
    const w2 = await w2p
    expect(w2.aborted).toBe(true)
    expect(w2.timedOut, 'a held timer cannot fabricate a timeout').toBeUndefined()
  }, SLOW)

  it('C10 根⑤ cause range, measured not imagined: the union has EXACTLY user|parent|hook|disposed at the baseline, and the cancelled law maps ONLY the first two to true (every other input, junk included, is false)', async () => {
    // (a) the MEASURED union, resolved through the ONE sanctioned source: the
    // checkout lives where `tests/paths.mjs` — the repo's only path authority
    // (TEST_METHODS: 路径唯一来源) — says it lives, so there is no private
    // candidate list to drift. And absence FAILS: an acceptance environment
    // carries the pristine checkout at the pinned baseline BY DEFINITION, so a
    // checkout that cannot be resolved is an unqualified environment, and a
    // fail-closed red is the honest verdict — a silent skip here would let a
    // gate packet tally "cause range verified" out of zero verification
    // (root 16:15Z ①; the rejected alternative was it.skip + visible skip
    // count, which still cannot be tallied as done, so it buys nothing).
    const repoRoot = findTestRepoRoot(fileURLToPath(new URL('.', import.meta.url).href))
    expect(repoRoot, "tests/paths.mjs resolved no repo root carrying tests/deepseek-harness-test-use — environment unqualified; this leg FAILS CLOSED and must not be tallied as a verified cause range (root 16:15Z ①)").not.toBeNull()
    const anchor = join(testUseTree(repoRoot as string), 'packages', 'core', 'session', 'src', 'types.ts')
    expect(existsSync(anchor), `the resolved checkout carries no packages/core/session/src/types.ts at ${anchor} — environment unqualified; FAIL-CLOSED (root 16:15Z ①)`).toBe(true)
    const src = readFileSync(anchor, 'utf8')
    // (c) the acceptance receipt, printed into the run log (root 16:15Z ①c):
    // the exact bytes measured, named the way git itself names them (blob sha)
    // next to the path they were read from. Cross-checkable with
    // `git -C tests/deepseek-harness-test-use hash-object packages/core/session/src/types.ts`.
    const blobSha = createHash('sha1')
      .update(`blob ${readFileSync(anchor).length}\u0000${src}`)
      .digest('hex')
    console.info(`[a5b3 C10] baseline union read: path=${anchor} git-blob-sha=${blobSha}`)
    {
      const m = /export type AgentCancelCause =([\s\S]*?)\n\n/.exec(src)
      expect(m, `AgentCancelCause declaration not found in ${anchor}`).not.toBeNull()
      const kinds = [...(m![1] as string).matchAll(/kind: '(\w+)'/g)].map((x) => x[1])
      expect([...kinds].sort(), `the union arms moved — re-derive the law before shipping it: ${JSON.stringify(kinds)}`).toEqual(['disposed', 'hook', 'parent', 'user'])
    }
    // (b) the LAW as a pure function over that range — the shell arm calls the
    // SAME export, so this table IS the shipped mapping:
    const law = (await settleMod()).shellCancelled
    expect(typeof law, 'shellCancelled must be exported by the production row module').toBe('function')
    expect(law({ timedOut: false, aborted: true, reason: { kind: 'user' } }), 'user → cancelled').toBe(true)
    expect(law({ timedOut: false, aborted: true, reason: { kind: 'parent' } }), 'parent → cancelled').toBe(true)
    expect(law({ timedOut: false, aborted: true, reason: { kind: 'hook', reason: 'policy' } }), 'hook is NOT a user cancel').toBe(false)
    expect(law({ timedOut: false, aborted: true, reason: { kind: 'disposed' } }), 'disposed is NOT a user cancel').toBe(false)
    // everything OUTSIDE the closed union is not a cause at all:
    expect(law({ timedOut: false, aborted: true, reason: { kind: 'maintenance' } }), 'a kind outside the union cannot mint a cancel').toBe(false)
    expect(law({ timedOut: false, aborted: true, reason: 'user' }), 'a bare string is not the union').toBe(false)
    expect(law({ timedOut: false, aborted: true, reason: undefined }), 'a signal with no reason is not the union').toBe(false)
    expect(law({ timedOut: false, aborted: true, reason: null })).toBe(false)
    expect(law({ timedOut: false, aborted: true, reason: { kind: 'USER' } }), 'the discriminator is exact, not case-folded').toBe(false)
    // the guard arms (the races these compose with are C8/C9's own territory):
    expect(law({ timedOut: true, aborted: true, reason: { kind: 'user' } }), 'timedOut owns its form — no cancel on top (根③ at the law)').toBe(false)
    expect(law({ timedOut: false, aborted: false, reason: { kind: 'user' } }), 'a never-fired signal is not a cancel').toBe(false)
  }, SLOW)
})
