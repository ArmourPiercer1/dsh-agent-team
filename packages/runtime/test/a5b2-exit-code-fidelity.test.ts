/**
 * a5b2-exit-code-fidelity.test.ts — B2: the confined STREAM arm must be able to
 * carry what the payload actually did, and must keep NOT carrying it everywhere
 * it never asked.
 *
 * THE DEFECT, in the words of the captures it was booked from (the two files
 * this spec re-reads and never rewrites, `natexe/glue7-rerun-run1-E2-drift-before-commit.log:19`
 * and `natexe/glue7-rerun-run2-GREEN-24-24.log:19`, plus the live wire capture
 * `runtime-base-narrow/runs/2026-10-17T23-06-13Z/wire-digests-assembled.jsonl`
 * seq 10-11): a confined child asked to read a file outside every allowPath
 * answered the kernel refusal and the wire still opened
 *
 *   bash · exit=0
 *   > (empty stdout)
 *   stderr:
 *   > cat: ../outside/secret.txt: Permission denied
 *
 * Confinement did its job — the bytes never appeared, which is what those legs
 * were guarding — and the exit code contradicted the sentence two lines below
 * it. `exit=0` beside `Permission denied` is not a harmless default: it is the
 * completion state of a run that did not complete, reported as a number, on the
 * face the model reads. It came from `landlock-prelauncher.py`'s stream arm
 * exiting 0 whatever the payload did (the true rc went to `exit.json` as
 * bookkeeping) and every consumer above inheriting that 0.
 *
 * THE PATH, and what it deliberately is NOT: the fix is an ADDITIVE flag
 * (`--exit-passthrough`) on the stream arm, requested per SpawnRequest, set by
 * exactly one consumer — the shell row. Nothing is "fixed" by making every
 * stream consumer see a code:
 *  - the glob and search rows carry NO payload exit code on their face and prove
 *    completion from the stream instead (`alpha5-search-backend.test.ts` P8b pins
 *    that law); their flag stays unset, so the launcher bytes they spawn with are
 *    the same bytes, and the same argv, they always had;
 *  - the code is taken from the waitpid status and from nothing else — no stderr
 *    is ever parsed for a number, and a failure is never flattened to 0;
 *  - the renderer and the host contract are untouched (`renderShellResult` still
 *    prints `bash · exit=<n>` and `not-observed` for null).
 *
 * Legs A1-A4 measure the provider seam with the REAL launcher on THIS host;
 * X1-X6 measure the shipped shell row end to end (real plane assembly, real
 * kernel refusal). Worlds live under `tests/homes/` and self-remove.
 */
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import type { ProviderResult, SpawnRequest, StreamingSpawnHandle } from '../sandbox-provider/index.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5b2-unit-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root') // the governed root / shell cwd
const OUTSIDE_DIR = join(WORLD, 'outside') // never inside any allowPath
const SLOW = 120_000

/** The two captures the defect was booked from. Read here, NEVER rewritten. */
const EVIDENCE_LOGS = [
  'dev/agent-workflow/evidence/alpha5/natexe/glue7-rerun-run1-E2-drift-before-commit.log',
  'dev/agent-workflow/evidence/alpha5/natexe/glue7-rerun-run2-GREEN-24-24.log',
]
const RECORDED_REFUSION = 'cat: ../outside/secret.txt: Permission denied'

const REALM = 'a5b2-realm'
const SYSTEM_RX = (path: string) => ({ path, accessBits: { execute: true, readFile: true, readDir: true } })
const ANCHOR = { path: ROOT_DIR, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } }
const grant = () => [
  SYSTEM_RX('/bin'), SYSTEM_RX('/usr'), SYSTEM_RX('/lib'),
  ...(existsSync('/lib64') ? [SYSTEM_RX('/lib64')] : []),
  ANCHOR,
]

type Exec = (raw: unknown) => Promise<{ text: string }>
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

const ALLOW_ALL = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

function buildPlane() {
  const built = row.createTeamToolPlaneAssembly({
    controlLeg: approvingControlLeg(),
    permissionPolicy: ALLOW_ALL,
    realmId: REALM,
    templateId: 'a5b2-tpl',
    role: 'member',
    instanceId: 'a5b2-instance',
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'a5b2-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        // step-B hygiene (disclosed): without this key the shell row's documented
        // `cwdRoot` fallback put provider plans/out/probe scratch in the process
        // cwd — the repo root during test runs (the same leak 104b4991 committed
        // as fixtures). The shell row itself is untouched; the scratch location
        // is not what any leg here asserts, and WORLD is self-removed below.
        scratchRoot: WORLD,
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
    grantFingerprint: `a5b2:${command}:${Math.random().toString(36).slice(2)}`,
    realmId: REALM,
    bindingId: 'a5b2-binding',
    memberScope: 'a5b2-instance',
    argv: ['/bin/sh', '-c', command],
    cwd: ROOT_DIR,
    env: [['PATH', '/usr/bin:/bin']],
    allowPaths: grant(),
    ...over,
  }
}

/** Every launcher bookkeeping record written under this world so far. */
function exitRecords(dir: string, found: string[] = []): string[] {
  if (!existsSync(dir)) return found
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) exitRecords(abs, found)
    else if (entry.name === 'exit.json') found.push(abs)
  }
  return found
}

/** The ONE record a just-finished spawn added (asserted as one, never guessed). */
function recordAddedSince(before: Set<string>): { pid: number; rc: number } {
  const fresh = exitRecords(join(WORLD, 'out')).filter((f) => !before.has(f))
  expect(fresh.length, `expected exactly one new exit.json, saw ${String(fresh.length)}`).toBe(1)
  return JSON.parse(readFileSync(fresh[0] as string, 'utf8')) as { pid: number; rc: number }
}

/** Run one payload on the stream arm and report the settle, pipes drained. */
async function settle(handle: ProviderResult<StreamingSpawnHandle>): Promise<{ code: number | null; signal: string | null; stdout: string; stderr: string }> {
  // A refusal here is a fact worth reading, not a shape error to trip over.
  if (!handle.ok) throw new Error(`stream spawn refused: ${String(handle.error?.code)} — ${String(handle.error?.message ?? '')}`)
  const h = handle.value
  let stdout = ''
  let stderr = ''
  h.stdout.on('data', (c) => { stdout += String(c) })
  h.stderr.on('data', (c) => { stderr += String(c) })
  const info = await h.exited
  await h.terminate()
  return { code: info.code, signal: info.signal, stdout, stderr }
}

beforeAll(async () => {
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'data', 'needle.txt'), 'A5B2-INSIDE-TOK\nnoise line\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'A5B2-OUTSIDE-SECRET-42\n')
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
})

afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('B2 A — the stream arm at the provider seam (REAL launcher, real waitpid)', () => {
  it('A1 flag OFF keeps the historical law on this very payload: a child that exits 3 still settles as code 0', async () => {
    // The additive half of the change: what every consumer that never asked for a
    // code still sees. Same launcher bytes, same argv as before the flag existed.
    const provider = await realProvider()
    const settled = await settle(await provider.spawnStreaming(request('exit 3')))
    expect(settled.code, 'flag OFF must keep the constant-completion law').toBe(0)
  }, SLOW)

  it('A2 flag ON is per-request: the same command settles as the code it returned', async () => {
    const provider = await realProvider()
    const settled = await settle(await provider.spawnStreaming(request('exit 3', { exitPassthrough: true })))
    expect(settled.code).toBe(3)
  }, SLOW)

  it('A3 a payload killed by a signal has no exit code, so the mapping carries 128 plus signum', async () => {
    // waitpid reports -15 here. There IS no exit code to carry, and null would mean
    // "no end was observed" — which is false: the end was observed, a signal caused
    // it. 128+signum is what /bin/sh itself reports for this case (the mapping
    // decision and its reasoning are at the launcher stream arm).
    const provider = await realProvider()
    const settled = await settle(await provider.spawnStreaming(request('kill -TERM $$', { exitPassthrough: true })))
    expect(settled.code, 'SIGTERM death must read 143, not 0 and not null').toBe(143)
  }, SLOW)

  it('A5 the 128-range number does NOT identify a cause of death: a payload that exits 137 and a payload killed by SIGKILL are the same number here', async () => {
    // Constructive witness against a claim an earlier revision of this lane made in a
    // launcher comment — that 128+signum was "a number the caller can distinguish
    // from any code a payload could have returned". It is not: the mapping is
    // constructive and one-way, so `exit 137` and a SIGKILL death agree exactly. What
    // DOES separate them is the launcher's bookkeeping record, whose rc is the raw
    // waitpid value (137 for a return, -9 for a kill). Pinned so the honest wording is
    // checked rather than merely asserted, and so nobody re-adds the stronger claim.
    const provider = await realProvider()

    const beforeReturn = new Set(exitRecords(join(WORLD, 'out')))
    const returned = await settle(await provider.spawnStreaming(request('exit 137', { exitPassthrough: true })))
    const returnedRecord = recordAddedSince(beforeReturn)

    const beforeKill = new Set(exitRecords(join(WORLD, 'out')))
    const killed = await settle(await provider.spawnStreaming(request('kill -KILL $$', { exitPassthrough: true })))
    const killedRecord = recordAddedSince(beforeKill)

    expect(returned.code).toBe(137)
    expect(killed.code, 'a SIGKILL death maps to 128+9, the same number 137').toBe(137)
    expect(killed.code, 'the exit code alone cannot tell the two apart — that is the point')
      .toBe(returned.code as number)
    expect(returnedRecord.rc, 'the record keeps the returned code as-is').toBe(137)
    expect(killedRecord.rc, 'the record keeps the kill as a negative waitpid result').toBe(-9)
    expect(killedRecord.rc).not.toBe(returnedRecord.rc)
  }, SLOW)

  it('A4 the terminate path lands on a signal death too: the code stays a 128-range number, never a fabricated 0', async () => {
    const provider = await realProvider()
    const handle = await provider.spawnStreaming(request('sleep 30', { exitPassthrough: true }))
    expect(handle.ok).toBe(true)
    if (!handle.ok) return
    const h = handle.value
    let stderr = ''
    h.stderr.on('data', (c) => { stderr += String(c) })
    const pending = h.exited
    await new Promise((r) => setTimeout(r, 250)) // let the payload actually start
    const term = await h.terminate()
    expect(term.ok, JSON.stringify(term)).toBe(true)
    const info = await pending
    expect(stderr).toBe('') // nothing ran, nothing complained: the code is the only evidence
    expect(info.code, 'a terminated payload must not report success').not.toBe(0)
    expect(info.code, 'a terminated payload must not be reported as unobserved').not.toBeNull()
    expect(info.code! >= 128 && info.code! <= 128 + 31,
      `expected a 128+signum mapping, got ${String(info.code)} (signal=${String(info.signal)})`).toBe(true)
  }, SLOW)
})

describe('B2 X — the shipped shell row, end to end (real plane, real kernel refusal)', () => {
  it('X1 THE RECORDED SHAPE, CLOSED: the outside secret now answers exit 1 with the kernel sentence verbatim', async () => {
    // First: the historical captures still say what they said. This leg reads them
    // and changes nothing in them — the pre-fix form stays on the record, which is
    // the only reason this leg can say what changed.
    for (const rel of EVIDENCE_LOGS) {
      const body = readFileSync(join(REPO, rel), 'utf8')
      expect(body, `${rel} must stay the byte-stable record of the pre-fix form`).toContain('bash · exit=0')
      expect(body).toContain(RECORDED_REFUSION)
    }
    const plane = buildPlane()
    const res = await def(plane, 'team_bash').execute({ command: 'cat ../outside/secret.txt' })
    const meta = metaOf(res.text)
    expect(meta.exitCode, `the fix is that this is 1, where the record above says 0: ${res.text}`).toBe(1)
    expect(res.text).toContain(RECORDED_REFUSION) // the kernel sentence, verbatim, unchanged
    expect(res.text).not.toContain('A5B2-OUTSIDE-SECRET-42') // the refusal still refuses
    expect(meta.timedOut).toBe(false)
    expect(meta.cancelled).toBe(false)
    expect(res.text).toContain('bash · exit=1') // the rendered head line follows the code, as before
  }, SLOW)

  it('X2 positive control: a command that succeeds still settles as exit 0', async () => {
    const plane = buildPlane()
    const res = await def(plane, 'team_bash').execute({ command: 'true' })
    expect(metaOf(res.text).exitCode).toBe(0)
    expect(res.text).toContain('bash · exit=0')
  }, SLOW)

  it('X3 negative controls: 1, 7, 126 and 127 come back as exactly those numbers, each from its own waitpid status', async () => {
    const plane = buildPlane()
    for (const code of [1, 7, 126, 127]) {
      const res = await def(plane, 'team_bash').execute({ command: `exit ${String(code)}` })
      expect(metaOf(res.text).exitCode, `exit ${String(code)} must not be flattened or guessed`).toBe(code)
    }
  }, SLOW)

  it('X4 anti-collateral in the same round: the glob and search rows still carry no exit code anywhere on their wire', async () => {
    // The other two stream consumers did not ask for a code, so they must not grow
    // one — neither on the meta object nor as a rendered exit anywhere.
    const plane = buildPlane()
    const grep = await def(plane, 'team_grep').execute({ pattern: 'A5B2-INSIDE-TOK', path: '.', output_mode: 'content' })
    expect(grep.text).toContain('A5B2-INSIDE-TOK')
    expect(grep.text).not.toContain('exit=')
    expect(JSON.stringify(metaOf(grep.text))).not.toContain('exitCode')
    const glob = await def(plane, 'team_glob').execute({ pattern: '*.txt' })
    expect(glob.text).toContain('needle.txt')
    expect(glob.text).not.toContain('exit=')
    expect(JSON.stringify(metaOf(glob.text))).not.toContain('exitCode')
  }, SLOW)

  it('X5 the timeout leg is unchanged: no code was ever seen, so null and not-observed plus timed-out stay on the wire', async () => {
    const plane = buildPlane()
    const res = await def(plane, 'team_bash').execute({ command: 'sleep 15', timeout: 1 })
    const meta = metaOf(res.text)
    expect(meta.timedOut).toBe(true)
    expect(meta.exitCode, 'a timed-out run never produced a code; inventing one is the defect this file exists for').toBeNull()
    expect(res.text).toContain('bash · exit=not-observed · timed-out')
  }, SLOW)

  it('X6 re-scoped by B3, judgment and bytes unchanged: the ONE-argument caller path injects no signal, so this leg stays cancelled-false — while the row itself now HAS a cancel channel', async () => {
    // The fact in two layers, per the root's 15:14Z ① (this prose is the only
    // thing updated; the judgment below is byte-identical to B2's pin).
    // LAYER 1 — what B2 booked: at that time the shell row genuinely had no
    // cancel input — its only stop was its own timeout (X5) — so the
    // `bash · cancelled` line in `renderShellResult` (packages/tools/a5p5-tools/
    // src/render.ts:183-184) was unreachable through this row, and the
    // `cancelled: false` the row returned was not a lie but "never asked".
    // LAYER 2 — what B3 changed and what it did not: B3 wired the row's cancel
    // channel (the host's cooperative signal, carried on the TWO-argument
    // execute path — `a5b3-cancel-leg.test.ts` pins it end to end). So the
    // B2-era wording "the shell row has no cancel input" is superseded prose:
    // the row HAS a signal surface now. What this leg still pins, load-bearing
    // and unchanged, is the other half: the ONE-argument caller path — this
    // very call, no exec argument, no signal — is NOT a cancellation path.
    // No signal, no leg (`register.ts`'s optional second parameter keeps it
    // byte-identical; `raceShellSettle` grows no abort leg it was never given),
    // so the honest report stays the honest report: `cancelled: false`, the
    // cancelled word out of this wire. "This leg injects no signal" is the
    // pinned fact; "the row has no signal surface" was stale prose — the two
    // must not be conflated. Whether non-user stops (hook/disposed, provider
    // terminate) should ever RENDER as cancellation is owned elsewhere (A4
    // measures the terminate arm; B3's C3 pins the death form). Recorded
    // here, judgment UNCHANGED: a register single-arg compatibility pin.
    const plane = buildPlane()
    const res = await def(plane, 'team_bash').execute({ command: 'sleep 15', timeout: 1 })
    expect(metaOf(res.text).cancelled).toBe(false)
    expect(res.text).not.toContain('bash · cancelled')
  }, SLOW)
})
