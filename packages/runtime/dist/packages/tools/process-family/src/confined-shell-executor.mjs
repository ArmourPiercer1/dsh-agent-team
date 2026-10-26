/**
 * process-family/src/confined-shell-executor — the governed shell row's
 * CONFINED EXECUTION backend (U6 PR3). Moved VERBATIM from the center file
 * (`plane-effect-backends.mjs` `createConfinedShellBackend`) at master
 * cd54f3b7c. The provider owns every law (probe capture, launcher
 * byte-pin double gate, one-shot plan, lease states, terminate escalation
 * — `packages/runtime/sandbox-provider/`); this adapter only shapes the
 * a5p5 call into a `SpawnRequest` and the streaming handle back into a
 * `ShellOutcome`. CI-07: the provider is the NAMED, REVIEWED confined
 * process provider — never a family self-attestation; the pairing gate
 * (trustRoot ⇄ launcher digest, Gate 0c) stays the trusted mount's law
 * and its validated config enters through `confined` unchanged.
 *
 * @module process-family/confined-shell-executor
 */
import { existsSync } from 'node:fs'
import { createConfinedProcessProvider } from '../../../runtime/sandbox-provider/index.js'
import { resolveAnchored } from '../../fs-family/src/index.mjs'
import {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  SYSTEM_RX,
} from './shell-mechanics.mjs'

/**
 * U7-4a (user ruling 2026-10-26, item 2 — governed background spawn IS an
 * approved Alpha.5 capability): the optional `background` collaborator is
 * the EXPLICITLY-CONFIGURED governed background arm, injected by the trusted
 * plane assembly ONLY when the closed `jobsEnabled` + `backgroundJobs` keys
 * are both on and the named jobs bridge with its live gateway row exists on
 * this mount (`background = { enabled: true, accept }`). It is the SAME
 * confined provider, not a bypass: the arm shares this row's cwd anchoring,
 * probe gate, per-call grant set and `spawnStreaming` request verbatim —
 * `accept` receives a thunk over THIS provider's spawn and never a raw
 * process of its own. Without the collaborator the by-name refusal below
 * answers byte-identically to every prior master (refused before probe,
 * before spawn, never reinterpreted as foreground).
 *
 * @param {object} [input.background] - `{ enabled: true, accept(ctx) }` from
 *   the plane assembly; ctx = `{ call, request, spawn }` with `request` the
 *   exact confined SpawnRequest and `spawn()` the provider call.
 */
export function createConfinedShellBackend({ realmId, templateId, instanceId, cwdRoot, confined, observe = () => {}, background }) {
  const scratchRoot = confined.scratchRoot ?? cwdRoot ?? confined.workingDir
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined.trustRoot ?? null,
    scratchRoot,
    ...(confined.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined.assembly ?? {},
    // TEST-SEAM PASS-THROUGH (B4 drain legs): the provider's `deps` face is its
    // EXISTING test surface — the a5p4-provider / a5lsp2-streaming / a5-cancel
    // families already drive fakes through it against this very provider. The
    // row forwards it verbatim when the factory input carries one and NOTHING
    // when absent, so the production construction is byte-identical to before.
    // The mount wiring is the same trusted input that already names the launcher
    // binary (`launcherPath`), so a deps fake widens no trust surface beyond
    // what an assembly already holds.
    ...(confined.deps === undefined ? {} : { deps: confined.deps }),
  })
  let probed = null
  let executed = 0
  let trace = []
  const lastRuns = []
  return {
    backendId: 'a5g7-confined-exec-shell',
    get lastStageTrace() { return trace },
    execCount: () => executed,
    lastRuns,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'bash') {
        return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'the shell backend got a non-bash call' } }
      }
      // Refusals with ZERO side effects, before probe/spawn of any kind:
      // the UNCONFIGURED shape (byte-identical to every prior master — the
      // background request is refused BY NAME, never reinterpreted). When an
      // explicit governed background arm is configured the request instead
      // rides the SAME gates below and branches at the spawn edge (see the
      // U7-4a note above).
      if (parsed.background === true && (background === undefined || background === null || background.enabled !== true)) {
        return { ok: false, failure: { class: 'denied', code: 'background-not-supported', detail: 'background spawn is not implemented by the confined-exec row (refused by name, never reinterpreted as a foreground run)' } }
      }
      const base = cwdRoot ?? confined.workingDir
      if (base === undefined) {
        return { ok: false, failure: { class: 'denied', code: 'cwd-unavailable', detail: 'no governed cwd root is configured (the assembly never invents one)' } }
      }
      let cwd = base
      if (parsed.cwd !== undefined) {
        const anchored = resolveAnchored(base, parsed.cwd)
        if (!anchored.ok) {
          return { ok: false, failure: { class: 'denied', code: anchored.code, detail: `cwd: ${anchored.detail}` } }
        }
        cwd = anchored.path
      } else {
        const anchored = resolveAnchored(base, { placement: 'workspace', locator: '.' })
        if (!anchored.ok) return { ok: false, failure: { class: 'denied', code: anchored.code, detail: anchored.detail } }
        cwd = anchored.path
      }
      trace = ['probe']
      if (probed === null) {
        probed = await provider.probe()
        if (probed.ok !== true) {
          trace = ['probe', 'terminate']
          observe(`confined-shell capability REFUSED realm=${realmId} code=${probed.error?.code}`)
          return { ok: false, failure: { class: 'denied', code: `confined-unavailable:${String(probed.error?.code ?? 'probe-refused')}`, detail: String(probed.error?.message ?? 'probe refused').slice(0, 240) } }
        }
        observe(`confined-shell capability OK realm=${realmId} rows=${probed.value.length}`)
      }
      trace = ['probe', 'prepare', 'execute']
      // runtime-base-narrow DYNAMIC GRANT: the per-call anchored workspace
      // root enters the plan EXPLICITLY — the provider base no longer shadows
      // it with a '/' READ_DIR (bug fix, glue7 §4b name-class leak). Default
      // face: the SAME entry bits this row has always carried for its anchor
      // (read/rw inside, nothing outside). Assembly-declared `allowPaths`
      // face: a READ_DIR grant on the anchored root only — strict parity
      // with what the removed '/' READ_DIR incidentally provided there
      // (that rule never granted READ_FILE), zero new write lanes.
      const anchorGrant = confined.allowPaths === undefined
        ? { path: cwd, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } }
        : { path: cwd, accessBits: { readDir: true } }
      const request = {
        grantFingerprint: `glue7:${realmId}:${templateId}:${call.callId}`,
        realmId,
        bindingId: `glue7-plane:${templateId}`,
        memberScope: instanceId,
        argv: ['/bin/sh', '-c', parsed.command],
        cwd,
        env: [['PATH', '/usr/bin:/bin']],
        allowPaths: [
          ...(confined.allowPaths ?? [
            SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
            ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
          ]),
          anchorGrant,
        ],
        // B2 EXIT-CODE FIDELITY — the SHELL ARM ONLY, and the reason it is this arm
        // and not the others: a shell row's whole answer is "what did the command
        // do", and `exit=0` next to `cat: …: Permission denied` is a sentence that
        // contradicts itself on the wire (the recorded shape this closes reads
        // `bash · exit=0` over `> cat: ../outside/secret.txt: Permission denied`).
        // The flag is opt-in per REQUEST, so asking for it here changes this row and
        // nothing else: the glob and search rows keep the flag unset and therefore
        // keep the constant-0 completion law they pin (their face carries no payload
        // exit code at all, and their legs prove completion from the stream — a law
        // this edit must not and does not weaken).
        exitPassthrough: true,
      }
      // THE GOVERNED BACKGROUND ARM (U7-4a): reached only on an explicitly
      // configured mount, after the SAME wrong-tool / cwd-anchor / probe
      // gates and with the SAME request object the foreground arm spawns
      // with. The producer (`background.accept`) owns the host-job creation
      // through the host's PUBLIC `JobRegistry.start` seam and the Team
      // attribution through the existing gateway law; it spawns nothing of
      // its own — it runs the thunk below. This point is only ever reached
      // from `runToolCall` AFTER the kernel decided and the PA edge consumed
      // the grant exactly once (refusal/replay never call the backend).
      if (parsed.background === true) {
        executed += 1
        trace = ['probe', 'prepare', 'execute']
        observe(`confined-shell background-ARM realm=${realmId} call=${call.callId} (same provider, same request; registration+attribution are the producer's)`)
        return await background.accept({
          call,
          request,
          spawn: () => provider.spawnStreaming(request),
        })
      }
      const handle = await provider.spawnStreaming(request)
      if (handle.ok !== true) {
        trace = ['probe', 'prepare', 'terminate']
        observe(`confined-shell spawn REFUSED realm=${realmId} call=${call.callId} code=${handle.error?.code}`)
        return { ok: false, failure: { class: 'denied', code: `confined-refused:${String(handle.error?.code ?? 'spawn-refused')}`, detail: String(handle.error?.message ?? 'spawn refused').slice(0, 240) } }
      }
      executed += 1
      const h = handle.value
      let stdout = ''
      let stderr = ''
      let timedOut = false
      h.stdout.on('data', (c) => { const s = String(c); stdout += s; if (io.sink) io.sink.write(s) })
      h.stderr.on('data', (c) => { const s = String(c); stderr += s; if (io.sink) io.sink.write(s) })
      const timeoutMs = typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0 ? parsed.timeoutMs : 60_000
      // B3 CANCEL LEG — the shell row's ONE cancel input: the host's
      // cooperative signal, carried on the call (register.ts forwards
      // `exec?.signal`; the host's public ToolExecutionInput law makes async
      // work observe it). Additive in both directions: NO signal, NO leg (the
      // pre-B3 rows and B2's X6 keep exactly what they had), and a signal that
      // never fires cannot move the outcome either. The settle race, its tie
      // law, and the cancelled law are the two module-level exports above
      // (`raceShellSettle`, `shellCancelled` — pinned leg-for-leg by
      // a5b3-cancel-leg.test.ts C8/C9/C10 with deterministic injection); the
      // terminate below is the SAME frozen C-PROC arm every stop uses, and
      // terminate itself carries no cancel meaning (A4 measured it; leg C6
      // keeps the conflation out of the rendering).
      const signal = call.signal
      const exit = await raceShellSettle({ exited: h.exited, timeoutMs, signal })
      let aborted = false
      if (exit.timedOut === true) {
        timedOut = true
        await h.terminate()
      } else if (exit.aborted === true) {
        aborted = true
        await h.terminate() // the host ended the call; the payload leaves through the same frozen arm
      } else {
        await h.terminate() // normal end: the lease settles through the SAME frozen arm (terminated state)
      }
      // B4 DRAIN-ON-EXIT: the terminate above CONFIRMED the payload dead, so both
      // pipes are now EOF-bound (the payload was their only writer); this await
      // lets the last `data` chunks land — into `stdout`/`stderr` AND into
      // `io.sink`, whose late-chunk ordering this same race broke — before a
      // single captured byte is read. Every arm takes it: a timed-out or aborted
      // answer keeps its already-settled shape (the settle race above decided the
      // form and the drain never re-decides it) while its partial bytes stop
      // being a delivery lottery. See `drainShellStdio` for the law + the bound.
      const drained = await drainShellStdio({ stdout: h.stdout, stderr: h.stderr, boundMs: SHELL_STREAM_DRAIN_MS })
      trace = ['probe', 'prepare', 'execute', 'terminate']
      const cancelled = shellCancelled({ timedOut, aborted, reason: aborted ? signal?.reason : undefined })
      lastRuns.push({ callId: call.callId, pid: h.pid, exit: exit.code ?? null, timedOut, cancelled, stdoutBytes: stdout.length, stderrBytes: stderr.length })
      observe(`confined-shell ran realm=${realmId} call=${call.callId} pid=${String(h.pid)} exit=${String(exit.code ?? 'not-observed')} timedOut=${String(timedOut)} cancelled=${String(cancelled)}`)
      // AN INCOMPLETE DRAIN IS REPORTED, NEVER PASSED OFF (root narrow-review
      // ruling, B4 pins): the drain answers complete ONLY on the real EOF of
      // every stream. A bound expiry (a writer this row never owns still holds a
      // pipe) OR a teardown/error before EOF means the capture MAY BE SHORTER THAN
      // WHAT THE PAYLOAD WROTE — the outcome says exactly that on its data face
      // (`truncated: true`, the contract's existing "this is not the whole answer"
      // bit; the presentation renders it as the truncation marker) and the audit
      // line repeats it WITH THE CAUSE (shortOf distinguishes the two). The bytes
      // stay as captured (honest partial), the settle race's answer stays as
      // settled, and nothing in this row may claim a complete capture it did not
      // observe.
      if (drained.complete !== true) observe(`confined-shell DRAIN-INCOMPLETE realm=${realmId} call=${call.callId} pid=${String(h.pid)} shortOf=${String(drained.shortOf)}`)
      return {
        ok: true,
        outcome: {
          // B2: the code the launcher measured (the shell arm asked for it). The two
          // null arms are the contract's own NOT-OBSERVED cases and neither is
          // flattened into a 0: a timeout never saw an end (`types.ts:144-151`), and
          // a code that is not a non-negative number cannot be reported as one —
          // 128+signum is produced by the launcher for signal death, so anything
          // negative reaching here would be a bug on the way up, and a bug is
          // reported as "not observed" rather than as a number nobody measured.
          // B3 adds no new null case: an aborted run reaches the same not-observed
          // reading (the payload never reported an end to this race).
          exitCode: timedOut ? null : (typeof exit.code === 'number' && exit.code >= 0 ? exit.code : null),
          stdout,
          stderr,
          timedOut,
          cancelled,
          // B4: a drain that reached the real EOF on BOTH streams keeps the
          // historical `false`; ANY other settle point — bound expiry, an early
          // destroy, a close without end, an error — flips the existing "not the
          // whole answer" bit (the drain answers complete ONLY on EOF). A stream
          // that ended and was destroyed AFTER still counts complete, so a healthy
          // run's post-end teardown never downgrades it. See `drainShellStdio`.
          truncated: drained.complete !== true,
        },
        settlement: timedOut || aborted
          ? { kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' }
          : { kind: 'completed' },
      }
    },
  }
}
