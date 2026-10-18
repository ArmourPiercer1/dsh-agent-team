/**
 * a5rbn-runtime-base-narrow.test.ts — the runtime-base narrowing pins
 * (bug-fix round; root ruling 22:43Z: the provider's '/' READ_DIR grant was
 * an IMPLEMENTATION DEVIATION from the established boundary, not pending
 * semantics — see dev/agent-workflow/evidence/alpha5/glue7/
 * runtime-base-probe/README.md for the authorizing-sentence audit).
 *
 * THE LAW THIS FILE PINS:
 *  1. BYTE PIN — the launcher's confined ruleset enumerates the trusted base
 *     EXPLICITLY (/usr, /etc, /proc = architecture.md:77 interpreter/
 *     libraries face; devices carry no FS rule because fs_mask() handles no
 *     device bit). NO `odir("/")` READ_DIR rule remains anywhere in the file
 *     (production builder AND the selective probe leg).
 *  2. POLICY SURFACE — `prepare()` writes `runtime_base: true` plus EXACTLY
 *     the caller's per-call allow entries; the provider never injects "/"
 *     into `allow`.
 *  3. REAL KERNEL (this host, Landlock ABI v4) — across the confinement
 *     boundary: whole-tree directory NAME enumeration is EACCES (`ls /home`,
 *     `ls /`), outside names never surface; the base enumeration survives
 *     (`ls /usr/bin`, `cat /etc/hostname`); the per-call anchored grant reads
 *     and writes INSIDE its root; writes OUTSIDE it stay kernel-refused.
 *
 * World prefix `a5rbn-*` under tests/homes/ (TEST_METHODS §7); self-removed.
 *
 * @module packages/runtime/test/a5rbn-runtime-base-narrow
 */
import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, existsSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createConfinedProcessProvider, type SpawnRequest } from '../sandbox-provider/provider.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5rbn-unit-${Date.now().toString(36)}`)
const ANCHOR = join(WORLD, 'anchor')
const OUTSIDE = join(WORLD, 'outside')

const hostAbi = (): number => {
  // the bare GET_VERSION answer of THIS host through the SAME production ABI
  const r = spawnSync('python3', [LAUNCHER, '--abi-probe'], { encoding: 'utf8', timeout: 5_000 })
  try {
    const line = String(r.stdout).trim().split('\n').filter(Boolean).pop() ?? ''
    const j = JSON.parse(line) as { abi_version?: number | null }
    return typeof j.abi_version === 'number' ? j.abi_version : -1
  } catch {
    return -1
  }
}
const ABI = hostAbi()

function makeRequest(overrides: Partial<SpawnRequest> = {}): SpawnRequest {
  return {
    grantFingerprint: `a5rbn:${Math.random().toString(36).slice(2)}`,
    realmId: 'a5rbn-realm',
    bindingId: 'a5rbn-binding',
    memberScope: 'a5rbn-member',
    argv: ['/bin/sh', '-c', 'true'],
    cwd: ANCHOR,
    env: [['PATH', '/usr/bin:/bin']],
    allowPaths: [
      { path: ANCHOR, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } },
    ],
    ...overrides,
  } as SpawnRequest
}

function makeProvider() {
  return createConfinedProcessProvider({
    realmId: 'a5rbn-realm',
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(WORLD, 'scratch'),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
}

/** One-shot confined run through the production provider face. */
async function confinedRun(command: string): Promise<{ out: string; err: string }> {
  const provider = makeProvider()
  const r = await provider.spawn(makeRequest({ argv: ['/bin/sh', '-c', command] }))
  if (!r.ok) throw new Error(`provider refused: ${String(r.error.code)} ${String(r.error.message ?? '')}`)
  return { out: r.value.output.stdout, err: r.value.output.stderr }
}

afterAll(() => {
  try { rmSync(WORLD, { recursive: true, force: true }) } catch { /* best effort */ }
})

describe('runtime-base narrowing (bug fix): explicit base enumeration, no "/" READ_DIR', () => {
  it('N0 world fixture lands (anchor + outside with marker names)', () => {
    mkdirSync(join(ANCHOR, 'data'), { recursive: true })
    mkdirSync(OUTSIDE, { recursive: true })
    writeFileSync(join(ANCHOR, 'data', 'inside.txt'), 'A5RBN-UNIT-INSIDE-13\n')
    writeFileSync(join(OUTSIDE, 'a5rbn-unit-marker-77'), 'A5RBN-UNIT-SECRET-99\n')
    expect(existsSync(join(OUTSIDE, 'a5rbn-unit-marker-77'))).toBe(true)
  })

  it('N1 byte pin: the ruleset builder carries NO root-tree rule; the base is the explicit :77 trio', () => {
    const src = readFileSync(LAUNCHER, 'utf8')
    const code = src.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n')
    expect(code.includes('odir("/")')).toBe(false) // the drift is GONE from every code path
    // explicit enumeration: /usr rx+, /etc rr — exactly once per confined
    // builder (production build_ruleset + the selective probe leg mirror it);
    // /proc appears a third time in the SEPARATE `--fd-close` probe ruleset
    // (scratch + /proc, never had "/" — the fd-closure instrument).
    const usr = code.match(/add_rule\(rs, odir\("\/usr"\), FS\['READ_DIR'\] \| FS\['READ_FILE'\] \| FS\['EXECUTE'\], abi\)/g) ?? []
    const etc = code.match(/add_rule\(rs, odir\("\/etc"\), FS\['READ_DIR'\] \| FS\['READ_FILE'\], abi\)/g) ?? []
    const proc = code.match(/add_rule\(rs, odir\("\/proc"\), FS\['READ_DIR'\] \| FS\['READ_FILE'\], abi\)/g) ?? []
    expect(usr.length).toBe(2)
    expect(etc.length).toBe(2)
    expect(proc.length).toBe(3)
  })

  it('N2 policy surface: runtime_base true, allow == the caller entries, never a "/" injection', async () => {
    const provider = makeProvider()
    const prepared = await provider.prepare(makeRequest())
    expect(prepared.ok, JSON.stringify(prepared)).toBe(true)
    if (!prepared.ok) return
    const policy = JSON.parse(readFileSync(prepared.value.policyPath, 'utf8')) as {
      runtime_base: boolean
      allow: Array<{ path: string }>
    }
    expect(policy.runtime_base).toBe(true)
    expect(policy.allow.map((a) => a.path).includes('/')).toBe(false)
    expect(policy.allow.map((a) => a.path)).toEqual([ANCHOR])
  })

  // REAL kernel legs (this host's Landlock; skipped honestly where absent).
  const real = ABI >= 3 ? it : it.skip
  real('N3 REAL: whole-tree NAME enumeration is kernel-refused (`ls /home`, `ls /`); outside names never surface', async () => {
    const home = await confinedRun('ls /home 2>&1 1>/dev/null; ls /home')
    expect(/Permission denied/.test(home.err + home.out), `stderr=${home.err.slice(0, 200)}`).toBe(true)
    const root = await confinedRun('ls /')
    expect(/Permission denied/.test(root.err + root.out)).toBe(true)
    expect(root.out.split(/\s+/).filter((n) => ['usr', 'etc', 'var', 'tmp', 'home'].includes(n))).toEqual([])
    const outside = await confinedRun(`ls ${OUTSIDE}`)
    expect(/Permission denied/.test(outside.err + outside.out)).toBe(true)
    expect(outside.out + outside.err).not.toContain('a5rbn-unit-marker-77')
  })

  real('P1 REAL: the base enumeration survives (interpreter/libraries/config face)', async () => {
    const base = await confinedRun('ls /usr/bin | wc -l; cat /etc/hostname | wc -c; ls /proc/self | head -1')
    expect(base.err).toBe('')
    expect(Number(base.out.split('\n')[0])).toBeGreaterThan(10) // /usr enumerates
  })

  real('P2 REAL: the per-call anchored grant reads and writes inside its root', async () => {
    const r = await confinedRun(`cat ${join(ANCHOR, 'data', 'inside.txt')}; echo A5RBN-UNIT-WRITTEN > ${join(ANCHOR, 'written.txt')}; cat ${join(ANCHOR, 'written.txt')}`)
    expect(r.out).toContain('A5RBN-UNIT-INSIDE-13')
    expect(r.out).toContain('A5RBN-UNIT-WRITTEN')
    expect(existsSync(join(ANCHOR, 'written.txt'))).toBe(true)
  })

  real('P3 REAL: writes OUTSIDE the anchored root stay EACCES (the write lane is untouched)', async () => {
    const r = await confinedRun(`touch ${join(WORLD, 'escape-sentinel')}`)
    expect(/Permission denied/.test(r.err + r.out)).toBe(true)
    expect(existsSync(join(WORLD, 'escape-sentinel'))).toBe(false)
  })

  real('P4 REAL: outside BYTES stay kernel-refused even with the right name (byte law holds)', async () => {
    const r = await confinedRun(`cat ${join(OUTSIDE, 'a5rbn-unit-marker-77')}`)
    expect(/Permission denied/.test(r.err + r.out)).toBe(true)
    expect(r.out + r.err).not.toContain('A5RBN-UNIT-SECRET-99')
  })
})
