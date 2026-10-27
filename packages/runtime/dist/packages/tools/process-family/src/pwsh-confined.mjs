/**
 * process-family/src/pwsh-confined — the governed PWSH row's confined
 * execution backend (U7-F). The sibling of `confined-shell-executor.mjs`
 * for the shell-class second row: the SAME confined Process provider (the
 * Landlock launcher, the byte-pin double gate, the one-shot plan, the lease
 * states, the terminate escalation — every law owned by
 * `packages/runtime/sandbox-provider/`), the SAME settle/cancel/drain
 * mechanics (`raceShellSettle` / `shellCancelled` / `drainShellStdio`, the
 * closed tie law exited > timedOut > aborted, the drain-answers-complete-
 * only-on-EOF law), and the SAME B2 exit-code fidelity law
 * (`exitPassthrough: true` — the payload's own exit status rides the
 * launcher's exit status; a timeout/abort never sees a fabricated code).
 *
 * What differs from the bash row is ONLY the command form (the host-faithful
 * pwsh argv/env/paths of `pwsh-mechanics.mjs`) and the executable
 * resolution arm (deviation 3: the confined launcher `execve`s `argv[0]`, so
 * the row resolves an absolute path POST-CONSUME and refuses
 * `pwsh-executable-not-found` BEFORE probe and BEFORE spawn — zero
 * provider touches, zero spawns, when the executable does not exist).
 *
 * No background arm here: the U7-4a governed background arm is the BASH
 * row's creation lane (its attribution producer pins `names.bash`); the
 * closed parameter law already refuses `run_in_background: true` by name
 * before any authority touch, so this backend never sees one.
 *
 * @module process-family/pwsh-confined
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
import { buildPwshSpawnRequest, resolvePwshExecutable, PWSH_DEFAULT_TIMEOUT_MS } from './pwsh-mechanics.mjs'

/**
 * The confined pwsh backend over the NAMED, REVIEWED confined process
 * provider (CI-07: never a family self-attestation; the pairing gate
 * trustRoot ⇄ launcher digest stays the trusted mount's law and its
 * validated config enters through `confined` unchanged).
 *
 * @param {object} input
 * @param {string} input.realmId
 * @param {string} [input.templateId]
 * @param {string} [input.instanceId]
 * @param {string | undefined} input.cwdRoot - the governed anchor (the SAME
 *   fsInstance root the bash row anchors at — no second anchor law).
 * @param {object} input.confined - the mount's validated confined provider
 *   config, unchanged (plus its optional `pwshPath` pin, trusted assembly).
 * @param {(line: string) => void} [input.observe]
 * @returns {{backendId: string, execCount: () => number, lastRuns: object[],
 *   lastStageTrace: string[], run: (call: object, io: object) => Promise<object>}}
 */
export function createConfinedPwshBackend({ realmId, templateId, instanceId, cwdRoot, confined, observe = () => {} }) {
  const scratchRoot = confined.scratchRoot ?? cwdRoot ?? confined.workingDir
  const provider = createConfinedProcessProvider({
    realmId,
    trustRoot: confined.trustRoot ?? null,
    scratchRoot,
    ...(confined.runnerCommand === undefined ? {} : { runnerCommand: confined.runnerCommand }),
    assembly: confined.assembly ?? {},
    // TEST-SEAM PASS-THROUGH — the provider's existing `deps` face, forwarded
    // verbatim when present and NOTHING when absent (the bash row's law: the
    // production construction stays byte-identical).
    ...(confined.deps === undefined ? {} : { deps: confined.deps }),
  })
  let probed = null
  let executed = 0
  let trace = []
  const lastRuns = []
  return {
    backendId: 'u7f-confined-exec-pwsh',
    get lastStageTrace() { return trace },
    execCount: () => executed,
    lastRuns,
    async run(call, io) {
      const parsed = call.parsedArgs
      if (parsed.tool !== 'pwsh') {
        return { ok: false, failure: { class: 'denied', code: 'wrong-tool-for-backend', detail: 'the pwsh backend got a non-pwsh call' } }
      }
      const base = cwdRoot ?? confined.workingDir
      if (base === undefined) {
        return { ok: false, failure: { class: 'denied', code: 'cwd-unavailable', detail: 'no governed cwd root is configured (the assembly never invents one)' } }
      }
      // The bash row's cwd anchor law, workdir field for field: absent/blank
      // anchors at '.' inside the governed root; an escaping workdir is
      // refused BEFORE probe/spawn (the out-of-scope arm, zero spawns). The
      // descriptor form is a5p5 `args.ts` law (POSIX/Windows absolutes ride
      // `absolute-path`, UNC is refused, everything else is `workspace`).
      const workdir = typeof parsed.workdir === 'string' ? parsed.workdir.trim() : ''
      let descriptor = { placement: 'workspace', locator: '.' }
      if (workdir.length > 0) {
        if (workdir.startsWith('\\')) {
          return { ok: false, failure: { class: 'denied', code: 'workdir-locator-rejected', detail: 'UNC/leading-` workdir targets are refused (use an explicit absolute path inside the governed root)' } }
        }
        descriptor = /^\/|^[A-Za-z]:[\\/]/.test(workdir)
          ? { placement: 'absolute-path', locator: workdir }
          : { placement: 'workspace', locator: workdir }
      }
      const anchored = resolveAnchored(base, descriptor)
      if (!anchored.ok) {
        return { ok: false, failure: { class: 'denied', code: anchored.code, detail: `workdir: ${anchored.detail}` } }
      }
      const cwd = anchored.path
      // Deviation 3 — the executable arm, BEFORE probe and BEFORE spawn: the
      // provider is not touched when no pwsh stands at a lawful path, so the
      // unavailable world measures ZERO spawns and stays unprobed.
      const resolved = resolvePwshExecutable(confined)
      if (resolved.path === null) {
        trace = ['resolve']
        observe(`confined-pwsh executable NOT-FOUND realm=${realmId} tried=${resolved.tried.join(',')}`)
        return {
          ok: false,
          failure: {
            class: 'denied',
            code: 'pwsh-executable-not-found',
            detail: `no pwsh executable exists at ${resolved.tried.join(', ')} — refused before probe and before spawn (the row never fabricates an unavailable shell)`,
          },
        }
      }
      trace = ['probe']
      if (probed === null) {
        probed = await provider.probe()
        if (probed.ok !== true) {
          trace = ['probe', 'terminate']
          observe(`confined-pwsh capability REFUSED realm=${realmId} code=${probed.error?.code}`)
          return { ok: false, failure: { class: 'denied', code: `confined-unavailable:${String(probed.error?.code ?? 'probe-refused')}`, detail: String(probed.error?.message ?? 'probe refused').slice(0, 240) } }
        }
        observe(`confined-pwsh capability OK realm=${realmId} rows=${probed.value.length}`)
      }
      trace = ['probe', 'prepare', 'execute']
      // The per-call anchored workspace grant, SAME face as the bash row
      // (default: the anchor's own rw bits; assembly-declared `allowPaths`:
      // READ_DIR on the anchored root only — zero new write lanes).
      const anchorGrant = confined.allowPaths === undefined
        ? { path: cwd, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } }
        : { path: cwd, accessBits: { readDir: true } }
      const request = {
        ...buildPwshSpawnRequest({
          realmId,
          grantFingerprint: `u7f-pwsh:${realmId}:${templateId}:${call.callId}`,
          bindingId: `u7f-pwsh-row:${templateId}`,
          memberScope: instanceId,
          pwshPath: resolved.path,
          cwd,
          command: parsed.command,
        }),
        allowPaths: [
          // The bash row's core rx grants (the launcher boots under these);
          // a pwsh binary outside the cores adds ONLY its own directory's
          // rx entry (never a wider root).
          ...(confined.allowPaths ?? [
            SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
            ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
          ]),
          ...pwshRxEntries(resolved.path),
          anchorGrant,
        ],
      }
      const handle = await provider.spawnStreaming(request)
      if (handle.ok !== true) {
        trace = ['probe', 'prepare', 'terminate']
        observe(`confined-pwsh spawn REFUSED realm=${realmId} call=${call.callId} code=${handle.error?.code}`)
        return { ok: false, failure: { class: 'denied', code: `confined-refused:${String(handle.error?.code ?? 'spawn-refused')}`, detail: String(handle.error?.message ?? 'spawn refused').slice(0, 240) } }
      }
      executed += 1
      const h = handle.value
      let stdout = ''
      let stderr = ''
      let timedOut = false
      h.stdout.on('data', (c) => { const s = String(c); stdout += s; if (io.sink) io.sink.write(s) })
      h.stderr.on('data', (c) => { const s = String(c); stderr += s; if (io.sink) io.sink.write(s) })
      const timeoutMs = typeof parsed.timeoutMs === 'number' && parsed.timeoutMs > 0 ? parsed.timeoutMs : PWSH_DEFAULT_TIMEOUT_MS
      // THE SETTLE RACE — the bash row's ONE cancel input and closed tie law
      // exited > timedOut > aborted (a5b3-cancel-leg pins this shared
      // mechanics leg-for-leg; this row adds no new settle shape).
      const signal = call.signal
      const exit = await raceShellSettle({ exited: h.exited, timeoutMs, signal })
      let aborted = false
      if (exit.timedOut === true) {
        timedOut = true
        await h.terminate()
      } else if (exit.aborted === true) {
        aborted = true
        await h.terminate()
      } else {
        await h.terminate()
      }
      // B4 DRAIN-ON-EXIT — same law, same bound: the terminate above CONFIRMED
      // the payload dead; both pipes are EOF-bound; the last chunks land
      // before any captured byte is read; an incomplete drain is REPORTED
      // (`truncated: true`), never passed off as the whole answer.
      const drained = await drainShellStdio({ stdout: h.stdout, stderr: h.stderr, boundMs: SHELL_STREAM_DRAIN_MS })
      trace = ['probe', 'prepare', 'execute', 'terminate']
      const cancelled = shellCancelled({ timedOut, aborted, reason: aborted ? signal?.reason : undefined })
      lastRuns.push({ callId: call.callId, pid: h.pid, exit: exit.code ?? null, timedOut, cancelled, stdoutBytes: stdout.length, stderrBytes: stderr.length })
      observe(`confined-pwsh ran realm=${realmId} call=${call.callId} pid=${String(h.pid)} exit=${String(exit.code ?? 'not-observed')} timedOut=${String(timedOut)} cancelled=${String(cancelled)}`)
      if (drained.complete !== true) observe(`confined-pwsh DRAIN-INCOMPLETE realm=${realmId} call=${call.callId} pid=${String(h.pid)} shortOf=${String(drained.shortOf)}`)
      return {
        ok: true,
        outcome: {
          // B2 exit-code fidelity: the code the launcher measured through
          // `--exit-passthrough`; timed-out and never-observed answers keep
          // `null`, never a fabricated 0.
          exitCode: timedOut ? null : (typeof exit.code === 'number' && exit.code >= 0 ? exit.code : null),
          stdout,
          stderr,
          timedOut,
          cancelled,
          truncated: drained.complete !== true,
        },
        settlement: timedOut || aborted
          ? { kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' }
          : { kind: 'completed' },
      }
    },
  }
}

/** @param {string} pwshPath - the resolved absolute executable path.
 *  @returns {object[]} the rx grant for the binary's own directory when it
 *  sits outside the core paths (the mechanics law, exact-dir only). */
function pwshRxEntries(pwshPath) {
  const dir = pwshPath.slice(0, pwshPath.lastIndexOf('/') || 1)
  if (dir === '/bin' || dir === '/usr' || dir === '/lib' || dir === '/lib64') return []
  return [SYSTEM_RX(dir)]
}
