/**
 * U7-F C1 — the governed PWSH shell-class row, offline: the closed
 * parameter law, the GOLDEN fidelity table for the argv/env/command form
 * (pinned from the host tree `tests/deepseek-harness-test-use` @
 * 639ed01539 — `packages/shell/pwsh-local/src/index.ts` `argv()`/
 * `ENV_OVERRIDES`, copied as a RECORDING, never read at test time), the
 * family-body executor lifecycle (deny-before-backend, the pwsh-class
 * coverage belt, the PA edge, the token ledger, the pre-abort leg), the
 * confined backend legs over the REAL provider through its documented
 * `deps` test seam (zero-spawn arms + a scripted launcher run), the row
 * renderer, and the descriptor units (the `pwshEnabled` config law, the
 * shut-face precedence).
 *
 * ZERO Host boots, ZERO ports, ZERO real spawns: the only child-process
 * surface is the provider's injected fake.
 *
 * @module packages/runtime/test/u7f-pwsh-row-c1.test
 */
import { afterAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync, chmodSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { normalizeShellProjection } from '../../tools/process-family/src/bash-normalizer.js'
import { canonicalJsonFingerprint } from '../../domain/tool-governance/src/index.js'

// The lane .mjs faces arrive through the dynamic-import law the TS tests
// carry for un-declared lane modules (u6-pr3-kernel-flow / u74a pattern).
const {
  parseGovernedPwshArgs,
  resolvePwshExecutable,
  buildPwshSpawnRequest,
  renderPwshResult,
  createConfinedPwshBackend,
  createGovernedPwshExecutor,
  buildPwshRowDefinition,
  PWSH_ROW_PARAMS,
  PWSH_ROW_PARAMETERS,
  PWSH_ARGV_FLAGS,
  PWSH_ENCODING_PREAMBLE,
  PWSH_SPAWN_ENV,
  PWSH_CANDIDATE_PATHS,
  PWSH_DEFAULT_TIMEOUT_MS,
} = await import(new URL('../../tools/process-family/src/index.mjs', import.meta.url).href)
const { familyAssembly } = await import(new URL('../../tools/families/process.mjs', import.meta.url).href)

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)

// ── THE GOLDEN FIDELITY RECORDING (the U7-F golden-vector table) ──────────
// Copied VERBATIM from the pinned host @ 639ed01539 (path:line recorded at
// copy time): packages/shell/pwsh-local/src/index.ts argv() (:194),
// ENV_OVERRIDES (:34), ENCODING_PREAMBLE (:48). This is a RECORDING, not a
// live read (the host tree is gitignored and absent on census runners); a
// host-side drift is re-adopted by a reviewed lane edit that changes these
// constants AND this digest together — the same law the shell golden corpus
// (u6-pr3) carries for the projection.
const HOST_RECORDED_FLAGS = ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command']
const HOST_RECORDED_PREAMBLE
  = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); '
const HOST_RECORDED_ENV_PAIRS = [['PATH', '/usr/bin:/bin'], ['NO_COLOR', '1'], ['PAGER', 'cat'], ['GIT_PAGER', 'cat']]
const FIDELITY_RECORDING_DIGEST = createHash('sha256')
  .update(JSON.stringify({ flags: HOST_RECORDED_FLAGS, preamble: HOST_RECORDED_PREAMBLE, env: HOST_RECORDED_ENV_PAIRS }), 'utf8')
  .digest('hex')

/** Command SHAPES for the quoting law: every entry must ride `-Command` as
 *  ONE argv element, byte-identical behind the preamble (the quoting law of
 *  the confined provider: `execve` argv, never a re-parsed string). */
const QUOTING_COMMANDS: readonly string[] = [
  'Get-ChildItem',
  'Write-Output "two words"',
  "Write-Output 'single quoted'",
  'echo `backtick `  continuation',
  '$env:PATH -split ";"',
  'Write-Output "$(Get-Date -Format o)"',
  'Write-Output "${env:COMPUTERNAME}"',
  'curl https://example.test/a?b=1&c=2',
  "git log --format='%h %s'",
  '$x = "a|b"; $x -split \'\\|\'',
  'Get-Process | Where-Object CPU -gt 100',
  'python -c "print(1)"',
  'echo "unicode: 你好 🚀 ‮rtl‬ no space"',
  'multi\nline\nscript',
  'tab\there and CR\rhere',
  'quote-imbalance " unclosed',
  "apostrophe ' unclosed",
  'dollar-sign $literal $$ $@',
  'x'.repeat(8192),
  'echo ' + 'y'.repeat(262_144),
]

describe('u7f golden fidelity: the recorded host form is the lane form', () => {
  it('the recording itself is pinned (flags + preamble + env pairs digest)', () => {
    expect(FIDELITY_RECORDING_DIGEST).toBe('adb67d42653a0df890d9e0bef9675453b60c480d94f0f4f9584bccc9028d9184')
  })
  it('the lane constants equal the recording byte-for-byte', () => {
    expect([...PWSH_ARGV_FLAGS]).toEqual(HOST_RECORDED_FLAGS)
    expect(PWSH_ENCODING_PREAMBLE).toBe(HOST_RECORDED_PREAMBLE)
    expect(PWSH_SPAWN_ENV.map((p: readonly string[]) => [...p])).toEqual(HOST_RECORDED_ENV_PAIRS)
  })
  it('the request builder: closed key set, exit-passthrough ON, and EVERY command rides -Command verbatim', () => {
    for (const command of QUOTING_COMMANDS) {
      const req = buildPwshSpawnRequest({
        realmId: 'realm-f', grantFingerprint: 'gf-1', bindingId: 'b-1', memberScope: 'm-1',
        pwshPath: '/usr/bin/pwsh', cwd: '/root', command,
      })
      expect(Object.keys(req).sort()).toEqual(['argv', 'bindingId', 'cwd', 'env', 'exitPassthrough', 'grantFingerprint', 'memberScope', 'realmId'])
      expect(req.exitPassthrough).toBe(true)
      expect(req.argv[0]).toBe('/usr/bin/pwsh')
      expect(req.argv.slice(1, 5)).toEqual(HOST_RECORDED_FLAGS)
      expect(req.argv).toHaveLength(6)
      // THE QUOTING LAW: argv[5] is exactly preamble+command — no shell
      // layer, no escaping, no re-write, whatever the command contains.
      expect(req.argv[5]).toBe(`${HOST_RECORDED_PREAMBLE}${command}`)
    }
  })
  it('the closed parameter set is the host tool surface minus the conditional arms (disclosed)', () => {
    expect([...PWSH_ROW_PARAMS]).toEqual(['command', 'description', 'workdir', 'timeoutMs', 'run_in_background'])
    expect(PWSH_ROW_PARAMETERS.required).toEqual(['command', 'description'])
    expect(PWSH_ROW_PARAMETERS.additionalProperties).toBe(false)
    // The two disclosed absences: escalation pair + background never ride
    // the wire schema of a governed row that assembles neither.
    expect(PWSH_ROW_PARAMETERS.properties.sandbox_permissions).toBeUndefined()
    expect(PWSH_ROW_PARAMETERS.properties.justification).toBeUndefined()
    expect(PWSH_ROW_PARAMETERS.properties.run_in_background).toBeUndefined()
  })
  it('the single-bad-field refusals share the CENTER closed pwsh-* vocabulary', () => {
    // For every field the frozen center projection reads, a single bad
    // field must refuse with the SAME closed code on both faces (the A2
    // vocabulary law — one shell-class vocabulary, no dialects).
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ description: 'd' }, 'pwsh-command-missing'],
      [{ command: 42, description: 'd' }, 'pwsh-command-not-a-string'],
      [{ command: '   ', description: 'd' }, 'pwsh-command-empty'],
      [{ command: 'x', description: 'd', workdir: 7 }, 'pwsh-workdir-not-a-string'],
      [{ command: 'x', description: 'd', timeoutMs: 0 }, 'pwsh-timeout-ms-invalid'],
      [{ command: 'x', description: 'd', timeoutMs: 'soon' }, 'pwsh-timeout-ms-invalid'],
      [{ command: 'x', description: 'd', timeoutMs: Number.NaN }, 'pwsh-timeout-ms-invalid'],
      [{ command: 'x', description: 'd', run_in_background: 'yes' }, 'pwsh-run-in-background-not-boolean'],
    ]
    for (const [args, code] of cases) {
      const mine = parseGovernedPwshArgs(args)
      expect(mine.ok, JSON.stringify(args)).toBe(false)
      if (mine.ok === true) continue
      expect(mine.refusal.code, JSON.stringify(args)).toBe(code)
      // THE SHARED-VOCABULARY LEG: the CENTER projection sees the SAME args
      // and closes on the SAME code.
      const center = normalizeShellProjection('pwsh', args)
      expect(center.ok, `center agrees on ${code}`).toBe(false)
      if (center.ok === false) expect(center.reason, `center code for ${code}`).toBe(code)
    }
  })
})

// ── The closed parameter law ──────────────────────────────────────────────
describe('u7f closed parameter law (host validatePwshArgs field-for-field)', () => {
  it('the description field keeps the HOST model-facing law (required, non-blank)', () => {
    expect(parseGovernedPwshArgs({ command: 'x' }).ok).toBe(false)
    const missing = parseGovernedPwshArgs({ command: 'x' }) as { refusal: { code: string; text: string } }
    expect(missing.refusal.code).toBe('pwsh-description-missing')
    expect((parseGovernedPwshArgs({ command: 'x', description: '  ' }) as { refusal: { code: string } }).refusal.code).toBe('pwsh-description-empty')
    expect((parseGovernedPwshArgs({ command: 'x', description: 5 }) as { refusal: { code: string } }).refusal.code).toBe('pwsh-description-not-a-string')
    // the center projection ignores description (not a canonicalization
    // field) — the row being STRICTER than the projection is disclosed.
    expect(normalizeShellProjection('pwsh', { command: 'x' }).ok).toBe(true)
  })
  it('unknown parameters (including the escalation pair) refuse BEFORE any authority touch', () => {
    for (const key of ['sandbox_permissions', 'justification', 'timeout', 'cwd', 'evil']) {
      const r = parseGovernedPwshArgs({ command: 'x', description: 'd', [key]: 'v' }) as { refusal: { code: string; text: string } }
      expect(r.refusal.code, key).toBe('pwsh-unknown-parameter')
      expect(r.refusal.text).toContain('closed parameter set')
    }
  })
  it('run_in_background:true refuses BY NAME, never reinterpreted as foreground', () => {
    const r = parseGovernedPwshArgs({ command: 'x', description: 'd', run_in_background: true }) as { refusal: { code: string } }
    expect(r.refusal.code).toBe('background-not-supported')
    expect(parseGovernedPwshArgs({ command: 'x', description: 'd', run_in_background: false }).ok).toBe(true)
  })
  it('a valid call parses the lossless record + the executor facts', () => {
    const ok = parseGovernedPwshArgs({ command: '  x  ', description: 'd', workdir: 'sub', timeoutMs: 250 }) as { ok: true; parsed: Record<string, unknown>; fields: Record<string, unknown> }
    expect(ok.parsed).toEqual({ tool: 'pwsh', command: '  x  ', description: 'd', workdir: 'sub', timeoutMs: 250 })
    expect(ok.fields.workdir).toBe('sub')
    expect(ok.fields.timeoutMs).toBe(250)
    const bare = parseGovernedPwshArgs({ command: 'x', description: 'd' }) as { ok: true; parsed: Record<string, unknown>; fields: Record<string, unknown> }
    expect(bare.parsed.workdir).toBeUndefined()
    expect(bare.parsed.timeoutMs).toBeUndefined()
    expect(bare.fields.workdir).toBe('.')
    expect(bare.fields.timeoutMs).toBeNull()
    expect(PWSH_DEFAULT_TIMEOUT_MS).toBe(60_000)
  })
  it('the front is PURE: a refusal carries no side-effect surface and never a stack', () => {
    const r = parseGovernedPwshArgs(null) as { refusal: Record<string, unknown>; } & Record<string, unknown>
    expect(r.ok).toBe(false)
    expect(Object.keys(r)).toEqual(['ok', 'refusal'])
    expect(typeof r.refusal.text).toBe('string')
    expect(r.refusal.text).not.toContain('at ')
  })
})

// ── The executable arm (deviation 3) ──────────────────────────────────────
describe('u7f pwsh executable resolution (post-consume, pre-probe, fail closed)', () => {
  it('a pin that is not an absolute existing file refuses with exactly that tried list', () => {
    expect(resolvePwshExecutable({ pwshPath: '/definitely/not/here/pwsh' })).toEqual({ path: null, tried: ['/definitely/not/here/pwsh'] })
    expect(resolvePwshExecutable({ pwshPath: 'relative/pwsh' }).path).toBeNull()
    expect(resolvePwshExecutable({ pwshPath: 42 }).path).toBeNull()
  })
  it('the candidate list is the pinned POSIX install law; first existing regular file wins', () => {
    expect([...PWSH_CANDIDATE_PATHS]).toEqual(['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/opt/microsoft/powershell/7/pwsh'])
    const world = scratchWorld('resolve')
    const fake = join(world, 'pwsh')
    writeFileSync(fake, '#!/bin/sh\nexit 0\n')
    chmodSync(fake, 0o755)
    expect(resolvePwshExecutable({ pwshPath: fake })).toEqual({ path: fake })
    // a DIRECTORY wearing the name is not an executable file (fail closed)
    expect(resolvePwshExecutable({ pwshPath: world }).path).toBeNull()
  })
})

// ── The executor lifecycle (family body over injected forces) ─────────────
interface PaCall { realmId: string; callId: string; parametersFingerprint: string; requestedEffects: unknown; signal?: { aborted?: boolean } }
function fakePa(answer: (call: PaCall) => Record<string, unknown>) {
  const calls: PaCall[] = []
  const pa = async (call: PaCall) => { calls.push(call); return answer(call) }
  return { pa, calls }
}
const scriptedBackend = (answer: Record<string, unknown>, opts: { gate?: Promise<void>; count?: { n: number } } = {}) => {
  const count = opts.count ?? { n: 0 }
  return {
    backendId: 'scripted',
    count,
    run: async () => {
      count.n += 1
      if (opts.gate !== undefined) await opts.gate
      return answer
    },
  }
}
const ALLOW_DECIDE = () => ({ kind: 'allow' })
const DENY_DECIDE = () => ({ kind: 'deny', code: 'template-deny-lane' })
const GOOD = { command: 'Get-Date', description: 'stamp the file' }
function executorWith(over: Record<string, unknown> = {}) {
  const fake = fakePa(() => ({ kind: 'allow' }))
  const backend = scriptedBackend({ ok: true, outcome: { exitCode: 0, stdout: 'done', stderr: '', timedOut: false, cancelled: false, truncated: false } })
  const ex = createGovernedPwshExecutor({
    realmId: 'realm-u7f', templateId: 'tpl', instanceId: 'inst', callIdPrefix: 'u7f',
    decide: ALLOW_DECIDE, pa: fake.pa, policy: { default: 'allow', allow: [], ask: [], deny: [] },
    backend, observe: () => {},
    ...(over as object),
  })
  return { ex, fake, backend }
}

describe('u7f executor lifecycle: deny BEFORE backend, consume ONCE, effect once', () => {
  it('governed POSITIVE: the PA edge is entered with the parsed-record fingerprint, the backend runs exactly once, the answer renders', async () => {
    const { ex, fake, backend } = executorWith()
    const out = await ex(GOOD, {}) as Record<string, unknown>
    expect(out.kind).toBe('ok')
    expect(out.text).toContain('pwsh · exit=0')
    expect(backend.count.n).toBe(1)
    expect(fake.calls).toHaveLength(1)
    const call = fake.calls[0]
    if (call === undefined) throw new Error('PA edge never entered')
    expect(call.realmId).toBe('realm-u7f')
    // THE H2 FINGERPRINT LAW: the fingerprint binds the PARSED record.
    const ok = parseGovernedPwshArgs(GOOD) as { ok: true; parsed: Record<string, unknown> }
    expect(call.parametersFingerprint).toBe(canonicalJsonFingerprint(ok.parsed))
    // PR #390 law: the REQUESTED effect set carries the very arm the row
    // declares — tool-invoke:pwsh, and never the bash authority.
    const effects = JSON.stringify(call.requestedEffects)
    expect(effects).toContain('pwsh')
    expect(effects).not.toContain('"bash"')
  })
  it('two DIFFERENT commands fingerprint DIFFERENTLY (the effect-set fingerprint would not)', async () => {
    const fake = fakePa(() => ({ kind: 'allow' }))
    const ex = createGovernedPwshExecutor({
      realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: fake.pa,
      policy: { default: 'allow' }, backend: scriptedBackend({ ok: true, outcome: { exitCode: 0, stdout: '', stderr: '', timedOut: false, cancelled: false, truncated: false } }),
    })
    await ex(GOOD, {})
    await ex({ command: 'Remove-Item *', description: 'different command' }, {})
    expect(fake.calls).toHaveLength(2)
    const c0 = fake.calls[0]
    const c1 = fake.calls[1]
    if (c0 === undefined || c1 === undefined) throw new Error('PA calls missing')
    expect(c0.parametersFingerprint).not.toBe(c1.parametersFingerprint)
  })
  it('the lane verdict denies → typed refusal, ZERO PA touch, ZERO backend', async () => {
    const { ex, fake, backend } = executorWith({ decide: DENY_DECIDE })
    const out = await ex(GOOD, {}) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'refused', refusalClass: 'admission', code: 'template-deny-lane' })
    expect(fake.calls).toHaveLength(0)
    expect(backend.count.n).toBe(0)
  })
  it('the pwsh-class belt: a deny-lane pwsh rule and a default-deny template both refuse BEFORE the PA edge', async () => {
    const denyLane = executorWith({ policy: { default: 'allow', allow: [], ask: [], deny: [{ tool: 'pwsh', resource: { kind: 'any' } }] } })
    expect((await denyLane.ex(GOOD, {}) as Record<string, unknown>).code).toBe('template-deny-lane')
    expect(denyLane.fake.calls).toHaveLength(0)
    const defaultDeny = executorWith({ policy: { default: 'deny', allow: [], ask: [], deny: [] } })
    expect((await defaultDeny.ex(GOOD, {}) as Record<string, unknown>).code).toBe('template-default-deny')
    expect(defaultDeny.fake.calls).toHaveLength(0)
  })
  it('A2C-1: a BASH allow rule never covers pwsh (bash authority != pwsh authority)', async () => {
    const onlyBash = executorWith({ policy: { default: 'deny', allow: [{ tool: 'bash', resource: { kind: 'any' } }], ask: [], deny: [] } })
    expect((await onlyBash.ex(GOOD, {}) as Record<string, unknown>).code).toBe('template-default-deny')
    const withPwsh = executorWith({ policy: { default: 'deny', allow: [{ tool: 'pwsh', resource: { kind: 'any' } }], ask: [], deny: [] } })
    expect((await withPwsh.ex(GOOD, {}) as Record<string, unknown>).kind).toBe('ok')
  })
  it('a schema refusal never reaches decide/PA/backend', async () => {
    const { ex, fake, backend } = executorWith()
    const out = await ex({ command: 'x' }, {}) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'refused', refusalClass: 'schema', code: 'pwsh-description-missing' })
    expect(fake.calls).toHaveLength(0)
    expect(backend.count.n).toBe(0)
  })
  it('PA deny passes its code through, backend untouched', async () => {
    const fake = fakePa(() => ({ kind: 'deny', code: 'NO_AUTHORITY', detail: 'no rule covers this fingerprint' }))
    const backend = scriptedBackend({ ok: true, outcome: {} })
    const ex = createGovernedPwshExecutor({ realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: fake.pa, policy: { default: 'allow' }, backend })
    const out = await ex(GOOD, {}) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'refused', refusalClass: 'admission', code: 'NO_AUTHORITY' })
    expect(backend.count.n).toBe(0)
  })
  it('PA cancelled settles cancelled — no backend, refusal-free vocabulary', async () => {
    const fake = fakePa(() => ({ kind: 'allow', cancelled: true }))
    const backend = scriptedBackend({ ok: true, outcome: {} })
    const ex = createGovernedPwshExecutor({ realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: fake.pa, policy: { default: 'allow' }, backend })
    const out = await ex(GOOD, {}) as Record<string, unknown>
    expect(out.kind).toBe('cancelled')
    expect(String(out.text)).toContain('pwsh · cancelled')
    expect(backend.count.n).toBe(0)
  })
  it('an ALREADY-aborted call settles cancelled BEFORE the PA edge (9e fix-1: zero PA touch)', async () => {
    const { ex, fake, backend } = executorWith()
    const out = await ex(GOOD, { signal: { aborted: true, reason: 'host-cancel', addEventListener: () => {}, removeEventListener: () => {} } }) as Record<string, unknown>
    expect(out.kind).toBe('cancelled')
    expect(fake.calls).toHaveLength(0)
    expect(backend.count.n).toBe(0)
  })
  it('a settled exec token re-used answers cancelled — never a second execution, never a second PA entry', async () => {
    const token = { t: 1 }
    const fake = fakePa(() => ({ kind: 'allow' }))
    const count = { n: 0 }
    const ex = createGovernedPwshExecutor({
      realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: fake.pa, policy: { default: 'allow' },
      backend: scriptedBackend({ ok: true, outcome: { exitCode: 0, stdout: '', stderr: '', timedOut: false, cancelled: false, truncated: false } }, { count }),
    })
    const first = await ex(GOOD, { token }) as Record<string, unknown>
    expect(first.kind).toBe('ok')
    const replay = await ex(GOOD, { token }) as Record<string, unknown>
    expect(replay.kind).toBe('cancelled')
    expect(count.n).toBe(1)
    // The replay never reaches the PA edge at all: the settled-token face
    // rides the already-aborted signal, and the pre-abort arm (9e fix-1)
    // settles it cancelled BEFORE the edge — one grant, consumed ONCE.
    expect(fake.calls).toHaveLength(1)
  })
  it('an IN-FLIGHT token replay is refused outright (zero PA touch)', async () => {
    const token = { t: 2 }
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => { release = r })
    const fake = fakePa(() => ({ kind: 'allow' }))
    const ex = createGovernedPwshExecutor({
      realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: fake.pa, policy: { default: 'allow' },
      backend: scriptedBackend({ ok: true, outcome: { exitCode: 0, stdout: '', stderr: '', timedOut: false, cancelled: false, truncated: false } }, { gate }),
    })
    const first = ex(GOOD, { token })
    const second = await ex(GOOD, { token }) as Record<string, unknown>
    expect(second).toMatchObject({ kind: 'refused', refusalClass: 'admission', code: 'exec-token-replay' })
    expect(fake.calls).toHaveLength(1)
    release()
    expect((await first as Record<string, unknown>).kind).toBe('ok')
  })
  it('no PA edge → PA_EDGE_UNAVAILABLE (fail closed, nothing runs)', async () => {
    const backend = scriptedBackend({ ok: true, outcome: {} })
    const ex = createGovernedPwshExecutor({ realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: undefined as never, policy: { default: 'allow' }, backend })
    const out = await ex(GOOD, {}) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'refused', code: 'PA_EDGE_UNAVAILABLE' })
    expect(backend.count.n).toBe(0)
  })
  it('a refused backend answer (the shut face) refuses with its own class/code, and never spawns', async () => {
    const shut = { run: async () => ({ ok: false, failure: { class: 'denied', code: 'a5-pwsh-config-disabled', detail: 'pwshEnabled is off for this mount' } }) }
    const ex = createGovernedPwshExecutor({ realmId: 'r', callIdPrefix: 'u7f', decide: ALLOW_DECIDE, pa: async () => ({ kind: 'allow' }), policy: { default: 'allow' }, backend: shut })
    const out = await ex(GOOD, {}) as Record<string, unknown>
    expect(out).toMatchObject({ kind: 'refused', refusalClass: 'denied', code: 'a5-pwsh-config-disabled' })
  })
  it('callId: the exec correlation wins, else the token-ledger/mount-unique seq face', async () => {
    const fake = fakePa(() => ({ kind: 'allow' }))
    const ex = createGovernedPwshExecutor({ realmId: 'r', callIdPrefix: 'pre', decide: ALLOW_DECIDE, pa: fake.pa, policy: { default: 'allow' }, backend: scriptedBackend({ ok: true, outcome: { exitCode: 0, stdout: '', stderr: '', timedOut: false, cancelled: false, truncated: false } }) })
    await ex(GOOD, { correlation: 'tok-key-1' })
    await ex(GOOD, {})
    expect(fake.calls).toHaveLength(2)
    const k0 = fake.calls[0]
    const k1 = fake.calls[1]
    if (k0 === undefined || k1 === undefined) throw new Error('PA calls missing')
    expect(k0.callId).toBe('tok-key-1')
    expect(String(k1.callId).startsWith('pre-pwsh-')).toBe(true)
  })
})

// ── The confined backend over the REAL provider, fake launcher ───────────
const scratchRoots: string[] = []
function scratchWorld(tag: string): string {
  const dir = join(REPO, 'tests', 'homes', `u7fpwsh-${tag}-${Date.now().toString(36)}-${scratchRoots.length}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, '.u7f-owned.json'), JSON.stringify({ created: new Date().toISOString(), lane: 'u7f-pwsh-c1' }))
  scratchRoots.push(dir)
  return dir
}
afterAll(() => {
  for (const dir of scratchRoots) rmSync(dir, { recursive: true, force: true })
})
/** The provider's prepare() writes <root>/plans/<planId>.json whose `argv`
 *  is the EXACT payload argv the confined launcher will execve — reading it
 *  measures the fidelity bytes at the last seam before the sandbox edge. */
function readPlanPayload(root: string): string[] {
  const plans = readdirSync(join(root, 'plans'))
  expect(plans).toHaveLength(1)
  const only = plans[0]
  if (only === undefined) throw new Error('plan file missing')
  const policy = JSON.parse(readFileSync(join(root, 'plans', only), 'utf8')) as { argv: string[] }
  return policy.argv
}

interface StreamCall { argv: string[] }
interface AvailabilityRows { rows: Array<{ subject: string; present: boolean; note: string }> }
function launcherFakes(opts: {
  exit?: { code: number | null; signal: string | null } | 'hold'
  stdout?: string
  stderr?: string
  spawnRefuse?: { code: string; message: string }
  availability?: () => AvailabilityRows
  probeFacts?: () => { abiVersion: number | null; legs: Record<string, unknown> }
} = {}) {
  const counters = { runCalls: 0, probes: 0, stream: [] as StreamCall[], signals: [] as string[] }
  const mkStream = (text: string): Readable => {
    const s = new Readable({ read() {} })
    if (text.length > 0) s.push(text)
    s.push(null)
    return s
  }
  let resolveExit: (v: { code: number | null; signal: string | null }) => void = () => {}
  const exit = new Promise<{ code: number | null; signal: string | null }>((r) => { resolveExit = r })
  // the simulated payload is ALIVE until it dies (the provider signals only
  // live payloads and confirms only on exited && !pidAlive).
  let alive = true
  const markDead = (signal: string) => {
    alive = false
    resolveExit({ code: null, signal })
  }
  const fixedExit = opts.exit === 'hold' ? null : opts.exit ?? { code: 0, signal: null }
  if (fixedExit !== null) {
    queueMicrotask(() => {
      alive = false
      resolveExit(fixedExit)
    })
  }
  const deps = {
    availability: () => { counters.probes += 1; return opts.availability !== undefined ? opts.availability() : { rows: [{ subject: 'python3', present: true, note: 'u7f fake' }] } },
    run: () => { counters.runCalls += 1; throw new Error('u7f: the one-shot arm must never run for a row call') },
    probeFacts: () => opts.probeFacts !== undefined
      ? opts.probeFacts()
      : {
        abiVersion: 4,
        legs: {
          selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
          denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
          badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
        },
      },
    spawnStream: (argv: readonly string[]) => {
      counters.stream.push({ argv: [...argv] })
      if (opts.spawnRefuse !== undefined) return { ok: false, error: opts.spawnRefuse }
      const handshake = new Readable({ read() {} })
      handshake.push('{"stream":true,"pid":434343}\n')
      return {
        ok: true,
        value: {
          pid: 434343,
          stdin: { write: (_c: unknown, _e: unknown, cb: () => void) => cb() },
          stdout: mkStream(opts.stdout ?? ''),
          stderr: mkStream(opts.stderr ?? ''),
          handshake,
          kill: (signal?: string | number) => {
            counters.signals.push(String(signal ?? 'SIGTERM'))
            // the payload DIES at the signal (u74a fake law): the provider's
            // terminate loop confirms on run.exited && !pidAlive.
            markDead(String(signal ?? 'SIGTERM'))
            return true
          },
          exit,
        },
      }
    },
    signalProcess: (pid: number, signal: string) => { counters.signals.push(`${signal}:${pid}`); markDead(String(signal)); return true },
    pidAlive: () => alive,
  }
  return { deps, counters, settle: () => markDead('SIGKILL') }
}
function backendWith(root: string, confined: Record<string, unknown>) {
  return createConfinedPwshBackend({
    realmId: 'realm-u7f-be', templateId: 'tpl', instanceId: 'inst', cwdRoot: root,
    confined: { workingDir: root, ...confined }, observe: () => {},
  })
}

describe('u7f confined backend (real provider pipeline, launcher faked — zero real spawns)', () => {
  it('NO pwsh on the lawful path refuses BEFORE probe and BEFORE spawn — zero provider touches measured', async () => {
    const root = scratchWorld('noexec')
    const fakes = launcherFakes()
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: '/definitely/not/here/pwsh' })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'x' } }, { sink: null }) as { ok: boolean; failure?: { code: string } }
    expect(r.ok).toBe(false)
    expect(r.failure?.code).toBe('pwsh-executable-not-found')
    expect(fakes.counters.probes).toBe(0)
    expect(fakes.counters.stream).toHaveLength(0)
    expect(fakes.counters.runCalls).toBe(0)
    expect(backend.execCount()).toBe(0)
    expect(backend.lastStageTrace).toEqual(['resolve'])
  })
  it('an escaping workdir refuses with ZERO provider touches (out-of-scope arm)', async () => {
    const root = scratchWorld('escape')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes()
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'x', workdir: '../outside' } }, { sink: null }) as { ok: boolean; failure?: { code: string } }
    expect(r.ok).toBe(false)
    expect(fakes.counters.probes).toBe(0)
    expect(fakes.counters.stream).toHaveLength(0)
  })
  it('a wrong-tool call is refused by the backend itself', async () => {
    const root = scratchWorld('wrongtool')
    const backend = backendWith(root, { deps: launcherFakes().deps })
    const r = await backend.run({ callId: 'c', parsedArgs: { tool: 'bash', command: 'x' } }, { sink: null }) as { ok: boolean; failure?: { code: string } }
    expect(r.failure?.code).toBe('wrong-tool-for-backend')
  })
  it('probe refusal lands a typed refusal and a terminate trace — no spawn', async () => {
    const root = scratchWorld('proberefuse')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({
      // the provider's probe() refuses on an absent subject (SANDBOX_UNAVAILABLE)
      availability: () => ({ rows: [{ subject: 'python3', present: false, note: 'landlock launcher runtime absent (fake)' }] }),
    })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'x' } }, { sink: null }) as { ok: boolean; failure?: { code: string } }
    expect(r.ok).toBe(false)
    expect(r.failure?.code).toBe('confined-unavailable:SANDBOX_UNAVAILABLE')
    expect(backend.lastStageTrace).toEqual(['probe', 'terminate'])
    expect(fakes.counters.stream).toHaveLength(0)
  })
  it('no landlock ABI on the host (probe abiVersion null) refuses at prepare — the unconfined fallback does not exist', async () => {
    const root = scratchWorld('noabi')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({ probeFacts: () => ({ abiVersion: null, legs: {} }) })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'x' } }, { sink: null }) as { ok: boolean; failure?: { code: string } }
    expect(r.ok).toBe(false)
    expect(r.failure?.code).toBe('confined-refused:SANDBOX_UNAVAILABLE')
    expect(backend.lastStageTrace).toEqual(['probe', 'prepare', 'terminate'])
    expect(fakes.counters.stream).toHaveLength(0)
  })
  it('the POSITIVE leg: the launcher argv the provider built carries the pwsh form + --exit-passthrough; the exit code rides out verbatim', async () => {
    const root = scratchWorld('positive')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({ exit: { code: 7, signal: null }, stdout: 'hello-out', stderr: 'hello-err' })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'Get-ChildItem' } }, { sink: null }) as {
      ok: boolean; outcome: Record<string, unknown>; settlement: { kind: string }
    }
    expect(r.ok).toBe(true)
    expect(r.outcome).toMatchObject({ exitCode: 7, stdout: 'hello-out', stderr: 'hello-err', timedOut: false, cancelled: false, truncated: false })
    expect(r.settlement.kind).toBe('completed')
    expect(backend.execCount()).toBe(1)
    expect(fakes.counters.stream).toHaveLength(1)
    const streamCall = fakes.counters.stream[0]
    if (streamCall === undefined) throw new Error('launcher never entered')
    const launcherArgv = streamCall.argv.join(' ')
    // the provider's launcher argv carries the exit-passthrough law…
    expect(launcherArgv).toContain('--exit-passthrough')
    // …and the PLAN file it boots carries the faithful PAYLOAD argv — the
    // exact bytes the confined launcher will execve (fidelity end-to-end).
    expect(readPlanPayload(root)).toEqual([
      fakeExe, ...HOST_RECORDED_FLAGS, `${HOST_RECORDED_PREAMBLE}Get-ChildItem`,
    ])
    expect(backend.lastStageTrace).toEqual(['probe', 'prepare', 'execute', 'terminate'])
  })
  it('the timeout leg: an unsettled payload is TERMINATED, the exit code is reported not-observed, settlement cancelled', async () => {
    const root = scratchWorld('timeout')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({ exit: 'hold' })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'Start-Sleep 999', timeoutMs: 150 } }, { sink: null }) as {
      ok: boolean; outcome: Record<string, unknown>; settlement: { kind: string; event?: string }
    }
    expect(r.ok).toBe(true)
    // THE B3 CLOSED-CANCELLED LAW: a TIMEOUT is NOT a cancellation —
    // shellCancelled mints `cancelled` only for aborted+{user,parent}.
    expect(r.outcome).toMatchObject({ exitCode: null, timedOut: true, cancelled: false })
    expect(r.settlement).toMatchObject({ kind: 'cancelled', event: 'dispatcher-call-terminated-after-body-start' })
    expect(fakes.counters.signals.length).toBeGreaterThan(0)
    fakes.settle()
  }, 20_000)
  it('the abort leg: an aborted signal settles cancelled through the SAME terminate arm', async () => {
    const root = scratchWorld('abort')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({ exit: 'hold' })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const controller = new AbortController()
    const run = backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'x', timeoutMs: 5_000 }, signal: controller.signal }, { sink: null })
    // the closed AgentCancelCause shape: kind 'user' mints `cancelled`
    setTimeout(() => controller.abort({ kind: 'user' }), 30)
    const r = await run as { ok: boolean; outcome: Record<string, unknown>; settlement: { kind: string } }
    expect(r.outcome).toMatchObject({ exitCode: null, timedOut: false, cancelled: true })
    expect(r.settlement.kind).toBe('cancelled')
  }, 20_000)
  it('a spawn refusal answers the typed confined-refused arm with the provider code; execCount stays 0', async () => {
    const root = scratchWorld('spawnrefuse')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({ spawnRefuse: { code: 'SANDBOX_UNAVAILABLE', message: 'landlock unavailable' } })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const r = await backend.run({ callId: 'c1', parsedArgs: { tool: 'pwsh', command: 'x' } }, { sink: null }) as { ok: boolean; failure?: { code: string } }
    expect(r.ok).toBe(false)
    expect(r.failure?.code).toBe('confined-refused:SANDBOX_UNAVAILABLE')
    expect(backend.execCount()).toBe(0)
    expect(backend.lastStageTrace).toEqual(['probe', 'prepare', 'terminate'])
  })
  it('END-TO-END row leg: executor + real provider pipeline (launcher faked) renders the faithful argv and the exit sentence', async () => {
    const root = scratchWorld('e2e')
    const fakeExe = join(root, 'pwsh')
    writeFileSync(fakeExe, '#!/bin/sh\nexit 0\n')
    chmodSync(fakeExe, 0o755)
    const fakes = launcherFakes({ exit: { code: 3, signal: null }, stdout: 'ran' })
    const backend = backendWith(root, { deps: fakes.deps, pwshPath: fakeExe })
    const ex = createGovernedPwshExecutor({
      realmId: 'realm-u7f-be', templateId: 'tpl', instanceId: 'inst', callIdPrefix: 'u7f',
      decide: ALLOW_DECIDE, pa: async () => ({ kind: 'allow' }), policy: { default: 'allow' }, backend,
    })
    const out = await ex({ command: 'Write-Output "two words"', description: 'echo' }, {}) as Record<string, unknown>
    expect(out.kind).toBe('ok')
    expect(String(out.text)).toContain('pwsh · exit=3')
    expect(String(out.text)).toContain('> ran')
    // the PLAN payload bytes prove the faithful form survived
    // parse→lane→PA→backend→provider intact, all the way to the launcher's
    // execve input (the quoting law measured at the last lawful seam).
    expect(readPlanPayload(root)).toEqual([
      fakeExe, ...HOST_RECORDED_FLAGS, `${HOST_RECORDED_PREAMBLE}Write-Output "two words"`,
    ])
  }, 20_000)
})

// ── The renderer (the row's own presentation grammar) ─────────────────────
describe('u7f renderer (the shell-row sentence grammar, pwsh header)', () => {
  it('exit / timed-out / cancelled headers + quoted stdout + stderr block + meta footer', () => {
    const clean = renderPwshResult({ exitCode: 0, stdout: 'one\ntwo', stderr: '', timedOut: false, cancelled: false, truncated: false })
    const lines = clean.text.split('\n')
    expect(lines[0]).toBe('pwsh · exit=0')
    expect(lines[1]).toBe('> one')
    expect(lines[2]).toBe('> two')
    expect(lines[3]).toBe('pwsh-meta ' + JSON.stringify({ kind: 'shell', tool: 'pwsh', exitCode: 0, timedOut: false, cancelled: false, truncated: false }))
    const timed = renderPwshResult({ exitCode: null, stdout: '', stderr: 'partial', timedOut: true, cancelled: false, truncated: false })
    expect(timed.text.split('\n')[0]).toBe('pwsh · exit=not-observed · timed-out')
    expect(timed.text).toContain('> (empty stdout)')
    expect(timed.text).toContain('stderr:')
    expect(timed.text).toContain('> partial')
    const killed = renderPwshResult({ exitCode: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false })
    expect(killed.text.split('\n')[0]).toBe('pwsh · cancelled')
  })
  it('truncation is REPORTED, never hidden; the 64KiB cap cuts each stream', () => {
    const capped = renderPwshResult({ exitCode: 0, stdout: 'x'.repeat(70_000), stderr: '', timedOut: false, cancelled: false, truncated: false }, { maxChars: 100 })
    expect(capped.text).toContain('… output truncated …')
    expect(capped.presentationMeta.truncated).toBe(true)
    const flagged = renderPwshResult({ exitCode: 0, stdout: '', stderr: '', timedOut: false, cancelled: false, truncated: true })
    expect(flagged.text).toContain('… output truncated …')
  })
})

// ── The descriptor units (the pwshEnabled config law) ─────────────────────
describe('u7f descriptor: claims + the pwshEnabled shut precedence', () => {
  const mkCap = (over: Record<string, unknown> = {}) => ({
    realmId: 'realm-d', templateId: 'tpl', instanceId: 'inst',
    planeConfig: { pwshEnabled: true, ...(over.planeConfig as object ?? {}) },
    confinedCfg: null, fsInstance: null,
    names: { bash: 'team_bash' },
    logBackend: () => () => {},
    createShutBackend: (id: string) => ({ backendId: id, run: async () => ({ ok: false, failure: { class: 'denied', code: id, detail: id } }) }),
    injected: {},
    ...(over as object),
  })
  it('claims: the mount bash spelling + the FIXED pwsh native spelling; config carries the closed boolean', () => {
    expect(familyAssembly.config).toEqual({ pwshEnabled: 'boolean' })
    expect(familyAssembly.claims(mkCap() as never)).toEqual(['team_bash', 'pwsh'])
  })
  it('no confined provider → the pending shut face (the row still mounts)', () => {
    const b = familyAssembly.backends(mkCap() as never)
    expect(b.pwsh.backendId).toBe('a5-effect-face-pending')
  })
  it('pwshEnabled:false builds NO backend — and its shut face OUTRANKS kit injection (globEnabled law)', () => {
    const cap = mkCap({ planeConfig: { pwshEnabled: false }, injected: { pwsh: { backendId: 'kit-injected', run: async () => ({ ok: true }) } } })
    const b = familyAssembly.backends(cap as never)
    expect(b.pwsh.backendId).toBe('a5-pwsh-config-disabled')
  })
  it('with a confined provider the real backend mounts; injection still wins when enabled', () => {
    const real = familyAssembly.backends(mkCap({ confinedCfg: { workingDir: '/tmp', deps: launcherFakes().deps } }) as never)
    expect(real.pwsh.backendId).toBe('u7f-confined-exec-pwsh')
    const injected = familyAssembly.backends(mkCap({
      confinedCfg: { workingDir: '/tmp', deps: launcherFakes().deps },
      injected: { pwsh: { backendId: 'kit', run: async () => ({ ok: true }) } },
    }) as never)
    expect(injected.pwsh.backendId).toBe('kit')
  })
})

// ── The contribution (ONE candidate, BOTH rows) ───────────────────────────
describe('u7f contribution: the one-candidate-two-rows digests', () => {
  it('a half-family contribution throws fail-closed (never a silently-degraded single row)', async () => {
    const mod = await import(new URL('../../tools/process-family/src/bash-contribution.mjs', import.meta.url).href)
    expect(() => mod.buildProcessShellContribution({
      definition: { name: 'team_bash', parameters: { type: 'object' }, execute: async () => ({ text: '' }) },
      cancelBoundary: 'unit',
    })).toThrow(/PROCESS_CONTRIBUTION_PWSH_REQUIRED/)
  })
  it('the two-row digest binds the pwsh CODE: a mechanics edit flips it', async () => {
    const mod = await import(new URL('../../tools/process-family/src/bash-contribution.mjs', import.meta.url).href)
    const row = (name: string) => ({ name, parameters: { type: 'object' }, execute: async () => ({ text: '' }) })
    const build = () => mod.buildProcessShellContribution({
      definition: row('team_bash'),
      cancelBoundary: 'a',
      pwsh: { definition: row('pwsh'), cancelBoundary: 'b' },
    })
    const first = build()
    expect(first.visibility.nativeNames).toEqual(['team_bash', 'pwsh'])
    expect(first.lifecycle.cancelBoundary).toContain('pwsh:')
    expect(first.effects.kinds).toEqual(['tool-invoke', 'process-spawn'])
    expect(first.obligations).toEqual({ admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' })
    expect(first.definition.inputContractDigest).toBe(build().definition.inputContractDigest)
  })
})

// ── The row Definition ────────────────────────────────────────────────────
describe('u7f row Definition: fixed name, honest description, refusals are answers', () => {
  it('the row places at the fixed native spelling and never throws across the transport', async () => {
    const row = buildPwshRowDefinition({
      pwshName: 'pwsh',
      pwshExecutor: async (raw: unknown) => {
        if ((raw as { command?: string }).command === 'boom') throw new Error('executor exploded')
        return { kind: 'refused', text: 'refused-schema pwsh-command-missing — command is required' }
      },
    })
    expect(row.name).toBe('pwsh')
    expect(row.description).toContain('Foreground only')
    expect(row.parameters).toBe(PWSH_ROW_PARAMETERS)
    const refused = await row.execute({ command: 'x', description: 'd' }, {})
    expect(refused).toEqual({ text: 'refused-schema pwsh-command-missing — command is required' })
    // an executor that THROWS is the row's own failure surface: the host
    // dispatcher sees the rejected promise exactly like the bash sibling.
    await expect(row.execute({ command: 'boom', description: 'd' }, {})).rejects.toThrow('executor exploded')
  })
  it('an unanswered executor still returns a stable text answer, never undefined', async () => {
    const row = buildPwshRowDefinition({ pwshName: 'pwsh', pwshExecutor: async () => ({ kind: 'ok' }) })
    const out = await row.execute({ command: 'x', description: 'd' }, {})
    expect(out.text).toContain('pwsh-row-unanswered')
  })
})

// ── MUTATION CONTROLS: the golden table must catch its own planted bugs ──
describe('u7f mutation controls: the golden table goes RED on planted drift', () => {
  const mechanicsPath = fileURLToPath(new URL('../../tools/process-family/src/pwsh-mechanics.mjs', import.meta.url).href)
  async function mechanicsRewritten(from: string, to: string) {
    const source = readFileSync(mechanicsPath, 'utf8')
    const planted = source.replace(from, to)
    if (planted === source) throw new Error(`mutation control: pattern not found (${from}) — the control itself went stale`)
    return import(`data:text/javascript;base64,${Buffer.from(planted, 'utf8').toString('base64')}`) as Promise<Record<string, unknown>>
  }
  it('M1 dropping the encoding preamble from the command arm is CAUGHT', async () => {
    const planted = await mechanicsRewritten('${PWSH_ENCODING_PREAMBLE}${command}', '${command}')
    const build = planted.buildPwshSpawnRequest as (i: Record<string, unknown>) => { argv: string[] }
    const req = build({ realmId: 'r', grantFingerprint: 'g', bindingId: 'b', memberScope: 'm', pwshPath: '/usr/bin/pwsh', cwd: '/', command: 'Get-Date' })
    expect(req.argv[5]).not.toBe(`${PWSH_ENCODING_PREAMBLE}Get-Date`)
  })
  it('M2 flipping exit-passthrough OFF is CAUGHT', async () => {
    const planted = await mechanicsRewritten('exitPassthrough: true,', 'exitPassthrough: false,')
    const build = planted.buildPwshSpawnRequest as (i: Record<string, unknown>) => { exitPassthrough: boolean }
    expect(build({ realmId: 'r', grantFingerprint: 'g', bindingId: 'b', memberScope: 'm', pwshPath: '/p', cwd: '/', command: 'x' }).exitPassthrough).toBe(false)
  })
  it('M3 softening the background-not-supported refusal to a pass-through is CAUGHT', async () => {
    const planted = await mechanicsRewritten(
      'if (runInBackground === true) {',
      'if (false && runInBackground === true) {',
    ) as Record<string, unknown> & { parseGovernedPwshArgs: (r: unknown) => { ok: boolean } }
    const r = planted.parseGovernedPwshArgs({ command: 'x', description: 'd', run_in_background: true })
    // the planted build WRONGLY accepts — the shipped build refuses; the
    // golden vector pins the shipped behavior, so this control going red
    // means the table is watching this exact leg.
    expect(r.ok).toBe(true)
    expect(parseGovernedPwshArgs({ command: 'x', description: 'd', run_in_background: true }).ok).toBe(false)
  })
})
