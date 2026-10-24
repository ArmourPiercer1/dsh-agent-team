/**
 * pwsh-arm.mjs — THE GOVERNED PWSH ARM CLASS (CENTER source card, root FIXED
 * scope 2026-10-24: "pwsh = win32 shell; WHEN DECLARED-MOUNTED it must be
 * REAL foreground/background PowerShell execution").
 *
 * M0 citations (read before writing, per the card):
 *  - TOOL-CAPABILITY-MATRIX-9b2.md :33 (pwsh M-07 row): no takeover evidence,
 *    no tested SHA; win32-condition leg host availability 2026-10-23 measured
 *    ENV-NOT-AVAILABLE on the Linux pin639 host (no pwsh/powershell/
 *    pwsh-preview, no binfmt_misc Windows Interop, no wine); static entry
 *    map at pin639 (loader gates disabled-unless-win32; registration
 *    tool-pwsh/src/index.ts:383-384,595-605; resolution pwsh-local/
 *    resolve.ts:67-79 — win32 install-path probes, else bare `pwsh` PATH
 *    fallback); OUR plane: 'pwsh' ∈ PLANE_RESERVED_NATIVE
 *    (team-tool-plane.mjs:506-508), takeover table :465-479 has NO pwsh arm,
 *    shell CLASS membership {bash,pwsh} at :686.
 *  - route-records-v3c.json FC-SHL-P ("pwsh not mounted"): name pwsh,
 *    scope host-preset-conditional-win32, effects CLOSED vocabulary
 *    `shell-exec-powershell-win32` + `bg-jobs` (NO invented kinds), gap
 *    UNMANAGED_INHERITED_LIVE, target GOVERNED_TAKEOVER_HOST_BODY,
 *    req REQ-COND-win32 ("win32 组合内=REQ"); root ruling 06:43Z: the
 *    bash-row never covers pwsh.
 *
 * Law surfaces honored (census/observer/envelope/intent):
 *  - envelope double-gate already tokens bash/pwsh (agent-bindings
 *    leaderExecEnvelopeOps, :543-547 region): this arm NEVER re-implements it;
 *    the envelope is an EXTERNAL pre-condition of any dispatch reaching here.
 *  - S6RemotePermissionExecIntent tool:'bash'|'pwsh' (s6-remote.ts:489) —
 *    the closed intent spelling this arm answers to.
 *  - spill observer covers SUCCESSFUL FOREGROUND bash/pwsh only
 *    (agent-bindings :528-536): the arm hands its settled foreground
 *    artifact to deps.spillObserver on success ONLY, and never for a
 *    background or refused call.
 *
 * The arm mirrors the sibling governed families (the B-SCHEDULE bind law as
 * the shape reference): classify → plan with a closed effect set → the SAME
 * PA seat (paAdmit open→edge→consumedProof closure supplied by the wiring;
 * a boolean is never a witness) → REAL execution only after the edge was
 * consumed. Environment refusals (not win32 / no binary / background without
 * a jobs mount) fire BEFORE the PA entry — a grant is never spent on an
 * environment this world cannot honor. Post-consume cancellation is a REAL
 * side effect (sideEffectPossible true), never rolled back.
 *
 * Tier: 接线未测 (no boot). The production mount/census wiring is a SEPARATE
 * card; this file is the arm CLASS the card named, plus its honest test face.
 */

import { existsSync } from 'node:fs'

export const PWSH_FAMILY_ID = 'a5m2.b-pwsh'
export const PWSH_ADAPTER_REVISION = 1
export const PWSH_PROVIDER_ID = 'a5p5-plane'
/** CLOSED effect vocabulary (route-records FC-SHL-P) — nothing else exists. */
export const PWSH_EFFECT_FOREGROUND = Object.freeze(['shell-exec-powershell-win32'])
export const PWSH_EFFECT_BACKGROUND = Object.freeze(['shell-exec-powershell-win32', 'bg-jobs'])

const CLOSE = Object.freeze({
  ENV_UNSUPPORTED_PLATFORM: 'PWSH_ENV_UNSUPPORTED_PLATFORM',
  ENV_BINARY_UNRESOLVED: 'PWSH_ENV_BINARY_UNRESOLVED',
  ENV_JOBS_UNMOUNTED: 'PWSH_ENV_JOBS_UNMOUNTED',
  INPUT_KEYS_UNKNOWN: 'PWSH_INPUT_KEYS_UNKNOWN',
  INPUT_COMMAND_MISSING: 'PWSH_INPUT_COMMAND_MISSING',
  PA_EDGE_REFUSED: 'PWSH_PA_EDGE_REFUSED',
  PA_CONSUME_FAULT: 'PWSH_PA_CONSUME_FAULT',
})

function isRecord (value) { return value !== null && typeof value === 'object' && !Array.isArray(value) }
function deny (code, detail, extra = {}) { return Object.freeze({ kind: 'deny', code, detail, ...extra }) }

/**
 * The win32 resolution law mirrored from pwsh-local/resolve.ts:67-79: probe
 * the installed locations first, fall back to a bare `pwsh` PATH lookup —
 * and ONLY on win32. `fsExists` is injectable for the unit face; the default
 * is the real `node:fs` probe.
 */
const WIN32_CANDIDATES = Object.freeze([
  'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
  'C:\\Program Files\\PowerShell\\preview\\pwsh-preview.exe',
  'C:\\Users\\Public\\Documents\\powerShell\\pwsh.exe',
])

/**
 * @param {object} deps
 *   declared        : () => boolean — the MOUNT declaration (config law both
 *                    directions: not declared = this factory is never built;
 *                    built = declared. Guarded again at construction.)
 *   platform        : () => string (default: the real process.platform)
 *   fsExists        : (path) => boolean (default: real node:fs existsSync)
 *   which           : (binary) => string | undefined (PATH probe; real face
 *                    uses `where.exe` through deps.probeWhich; unit face
 *                    injects the answer)
 *   jobsFace        : () => boolean — background capability (the jobs mount)
 *   consumePaAtBody : (exec, plan) => answer — the plane's paAdmit open→edge
 *                    closure (same seat as every sibling family)
 *   spawnForeground : (argv, opts) => Promise<{ok, exitCode, stdout, stderr, movedToBackground?}>
 *   startBackground : (argv, opts) => Promise<{jobId}>
 *   spillObserver   : (artifact) => void — successful foreground ONLY
 *                    (agent-bindings :528-536 law)
 */
export function createGovernedPwshArm (deps = {}) {
  if (typeof deps.declared === 'function' && deps.declared() !== true) {
    throw Object.assign(new Error('pwsh arm factory called while the pwsh mount is NOT declared — config law: no declared mount, no arm'), { code: 'PWSH_NOT_DECLARED' })
  }
  const platform = () => (typeof deps.platform === 'function' ? deps.platform() : globalThis.process.platform)
  const jobsMounted = () => (typeof deps.jobsFace === 'function' ? deps.jobsFace() === true : false)

  function classify (raw) {
    if (!isRecord(raw)) return deny('PWSH_INPUT_NOT_OBJECT', 'the pwsh arm accepts an argument OBJECT only')
    const backgroundCapable = jobsMounted()
    const allowed = new Set(['command', 'description', 'timeoutMs', 'workdir', ...(backgroundCapable ? ['run_in_background'] : [])])
    const keys = Object.keys(raw)
    const unknown = keys.filter((k) => !allowed.has(k))
    if (unknown.length > 0) return deny(CLOSE.INPUT_KEYS_UNKNOWN, `closed key set for THIS mount shape (${backgroundCapable ? 'jobs mounted' : 'foreground-only'}); unknown: ${unknown.join(',')}`)
    if (typeof raw.command !== 'string' || raw.command.length === 0) return deny(CLOSE.INPUT_COMMAND_MISSING, 'command (non-empty string) is required')
    const background = backgroundCapable && raw.run_in_background === true
    return Object.freeze({
      ok: true,
      plan: Object.freeze({
        toolName: 'pwsh',
        command: raw.command,
        description: typeof raw.description === 'string' ? raw.description : '',
        workdir: typeof raw.workdir === 'string' ? raw.workdir : undefined,
        timeoutMs: typeof raw.timeoutMs === 'number' && Number.isInteger(raw.timeoutMs) && raw.timeoutMs > 0 ? raw.timeoutMs : undefined,
        background,
        effects: Object.freeze([...(background ? PWSH_EFFECT_BACKGROUND : PWSH_EFFECT_FOREGROUND)]),
        parametersFingerprint: fingerprint(raw, backgroundCapable),
      }),
    })
  }

  async function execute (exec, plan) {
    // ENV legs BEFORE any PA entry — a grant is never spent on a world that
    // cannot honor it (honest negative class, never a silent pass).
    if (platform() !== 'win32') {
      return deny(CLOSE.ENV_UNSUPPORTED_PLATFORM, `pwsh is a win32 shell; this host platform is "${String(platform())}" — ENV-NOT-AVAILABLE, not a pass`, { sideEffectPossible: false })
    }
    const resolved = resolvePwsh(deps)
    if (resolved === undefined) {
      return deny(CLOSE.ENV_BINARY_UNRESOLVED, 'no pwsh binary resolved through the win32 install-path law (pwsh-local/resolve.ts:67-79 mirror) nor a PATH fallback — ENV-NOT-AVAILABLE', { sideEffectPossible: false })
    }
    if (plan.background && !jobsMounted()) {
      return deny(CLOSE.ENV_JOBS_UNMOUNTED, 'run_in_background requires the jobs mount; background capability absent', { sideEffectPossible: false })
    }
    // THE PA SEAT: the same open→edge→consumedProof closure every sibling
    // governed family walks. Bool is never a witness (sibling law).
    let answer
    try {
      answer = await Promise.resolve(deps.consumePaAtBody?.(exec, plan))
    } catch (error) {
      return deny(CLOSE.PA_CONSUME_FAULT, `plane-edge walk threw: ${String(error?.message ?? error).slice(0, 140)}`, { sideEffectPossible: false })
    }
    if (!isRecord(answer) || answer.kind !== 'allow' || answer.cancelled === true) {
      return deny(CLOSE.PA_EDGE_REFUSED, isRecord(answer) ? `edge answered ${String(answer.kind ?? 'shape')}${answer.code === undefined ? '' : ` code ${String(answer.code)}`}` : `edge answered ${typeof answer}`, { sideEffectPossible: false })
    }
    if (typeof answer.consumedProof?.grant?.grantId !== 'string') {
      return deny(CLOSE.PA_EDGE_REFUSED, 'allow WITHOUT the one-shot consume witness (consumedProof.grant.grantId) — never self-attested consumption', { sideEffectPossible: false })
    }
    // REAL execution — foreground AND background PowerShell, win32 only.
    const argv = Object.freeze([resolved, '-NoProfile', '-NoLogo', '-Command', plan.command])
    const opts = Object.freeze({
      cwd: plan.workdir,
      // promote law (upstream mirror): with jobs mounted, a timeout MOVES the
      // command to a background job instead of killing it.
      timeoutMs: plan.background ? undefined : plan.timeoutMs,
      promoteOnTimeout: jobsMounted() && !plan.background,
      signal: exec?.signal,
    })
    if (plan.background) {
      const job = await Promise.resolve(deps.startBackground(argv, opts))
      return Object.freeze({ kind: 'allow', mode: 'background', jobId: job?.jobId, sideEffectPossible: true })
    }
    const run = await Promise.resolve(deps.spawnForeground(argv, opts))
    if (exec?.signal?.aborted === true) {
      // post-consume/late cancellation: the process was real; the side effect
      // stands and is reported, never rolled back, never claimed zero.
      return Object.freeze({ kind: 'allow', mode: 'foreground', sideEffectPossible: true, cancelledAfterStart: true, exitCode: run?.exitCode ?? null })
    }
    const settled = Object.freeze({
      kind: 'allow',
      mode: 'foreground',
      sideEffectPossible: true,
      exitCode: run?.exitCode ?? null,
      stdout: typeof run?.stdout === 'string' ? run.stdout : '',
      stderr: typeof run?.stderr === 'string' ? run.stderr : '',
      ...(run?.movedToBackground === true ? { movedToBackground: true } : {}),
    })
    // spill observer: SUCCESSFUL FOREGROUND ONLY (agent-bindings :528-536).
    if (settled.exitCode === 0 && settled.movedToBackground !== true && typeof deps.spillObserver === 'function') {
      try { deps.spillObserver(Object.freeze({ tool: 'pwsh', mode: 'foreground', command: plan.command, stdout: settled.stdout, stderr: settled.stderr, exitCode: 0 })) } catch { /* observation never owns the result */ }
    }
    return settled
  }

  return Object.freeze({
    name: 'pwsh',
    familyId: PWSH_FAMILY_ID,
    adapterRevision: PWSH_ADAPTER_REVISION,
    providerId: PWSH_PROVIDER_ID,
    classify,
    execute,
    drain: async () => Object.freeze({ ok: true }),
    refusalVocabulary: CLOSE,
  })
}

function resolvePwsh (deps) {
  if (typeof deps.resolveBinary === 'function') return deps.resolveBinary()
  const exists = typeof deps.fsExists === 'function' ? deps.fsExists : (p) => existsSync(p)
  for (const candidate of WIN32_CANDIDATES) {
    try { if (exists(candidate) === true) return candidate } catch { /* probe is best-effort */ }
  }
  if (typeof deps.which === 'function') return deps.which('pwsh')
  return undefined
}

function fingerprint (raw, backgroundCapable) {
  const norm = JSON.stringify(Object.keys(raw).sort().map((k) => [k, k === 'command' || k === 'description' || k === 'workdir' ? raw[k] : raw[k] === undefined ? null : raw[k]]))
  return `pwsh:${String(backgroundCapable)}:${fnv1a(norm)}`
}
function fnv1a (text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(16)
}
