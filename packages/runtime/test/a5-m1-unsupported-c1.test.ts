/**
 * a5-m1-unsupported-c1 — M1 UNSUPPORTED-FAIL-CLOSED vertical slice, C1 level.
 * Law source (frozen): index `e1b8b29a…` + GATES §2.3 B6 semantics carried by
 * planb §3.2; the closed name domain + shut-landing already in code
 * (team-tool-plane verifyPlaneNames / shut rows / drift pin) — this suite
 * ACCEPTS them against BASE.C1 (unknown operation refused, no native
 * fallback, un-governed agent = zero mount), implementing no new law.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `a5-m1-unsup-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const REALM = 'a5-m1-unsup-realm'

interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: boolean; code?: string; message?: string; value?: { definitions: ReadonlyArray<{ name: string }> } }
  verifyPlaneNames: (names: Record<string, string>, readName: string) => { ok: boolean; code?: string; message?: string }
  PLANE_RESERVED_NATIVE: readonly string[]
  PLANE_RESERVED_NATIVE_HOST_PIN: string
  DEFAULT_PLANE_NAMES: Record<string, string>
}
let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
  mkdirSync(ROOT_DIR, { recursive: true })
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const confinedProvider = () => ({
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
})
const POLICY = Object.freeze({ default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [] as unknown[], deny: [] as unknown[] })
const baseInput = (extra: Record<string, unknown> = {}) => ({
  permissionPolicy: POLICY, realmId: REALM, templateId: 't', role: 'member', instanceId: 'i',
  plane: { fsInstance: { fs: 'c', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' }, confinedProvider: confinedProvider() },
  teamSessionId: 'a5m1-test-team-root',
  ...extra,
})

describe('a5-m1-unsupported-c1 — closed world: unknown names never mount, never fall back', () => {
  it('U-C1-1 native CLAIM of a reserved non-accepted name is refused at the name gate (no silent native takeover)', () => {
    const r = row.verifyPlaneNames({ grep: 'grep', glob: 'team_glob', bash: 'team_bash' }, 'read')
    expect(r.ok).toBe(false)
    expect(r.code ?? '').toMatch(/NATIVE_CLAIM_UNSUPPORTED|NATIVE/)
  })

  it('U-C1-2 the drift pin DERIVES from tests/paths.mjs — a host-baseline move turns the mount RED, never stale-green', () => {
    expect(row.PLANE_RESERVED_NATIVE_HOST_PIN).toBe(`${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA.slice(0, 10)}`)
  })

  it('U-C1-3 an un-governed template (no permissions) gets ZERO mount (NOT_GOVERNED), not a defaulted policy', () => {
    const built = row.createTeamToolPlaneAssembly(baseInput({ permissionPolicy: undefined }))
    expect(built.ok).toBe(false)
    expect(built.code).toBe('NOT_GOVERNED')
  })

  it('U-C1-4 closed mount domain: ONLY the four governed names exist; no pwsh/job/web/tool names leak in, and NO native name beyond the accepted spellings exists', () => {
    const built = row.createTeamToolPlaneAssembly(baseInput())
    expect(built.ok).toBe(true)
    const names = (built.value?.definitions ?? []).map((d) => d.name).sort()
    expect(names).toEqual(['read', 'team_bash', 'team_glob', 'team_grep'])
    expect(names).not.toContain('bash') // default names mount the ALIAS; native bash claim is a wiring flip with its own acceptance
  })

  it('U-C1-5 mcp__ prefix reserved: a plane name in the connector namespace is refused', () => {
    const r = row.verifyPlaneNames({ grep: 'mcp__evil', glob: 'team_glob', bash: 'team_bash' }, 'read')
    expect(r.ok).toBe(false)
  })

  it('U-C1-6 no-fs-root world: without a governed fsInstance the fs-class row is NOT MOUNTED at all (the closed world invents no root — the STRONGER shut landing: absent face, never a native fallback)', async () => {
    const built = row.createTeamToolPlaneAssembly({
      teamSessionId: 'a5m1-test-team-root',
      permissionPolicy: POLICY, realmId: REALM, templateId: 't', role: 'member', instanceId: 'i',
      plane: { confinedProvider: confinedProvider() },
    })
    expect(built.ok).toBe(true)
    const rd = built.value?.definitions.find((d) => d.name === 'read')
    expect(rd).toBeUndefined() // no invented root, no shut-passthrough, no native proxy
    // and the mount stays alive for the rows that DO have their backends:
    expect(built.value?.definitions.some((d) => d.name === 'team_bash')).toBe(true)
  })

  it('U-C1-7 unknown operation spelling: asking the mount for a name it never declared answers from the closed set (the kit finds NOTHING, never proxies to native)', () => {
    const built = row.createTeamToolPlaneAssembly(baseInput())
    const names = new Set((built.value?.definitions ?? []).map((d) => d.name))
    for (const stranger of ['pwsh', 'run_code', 'web_fetch', 'grep', 'glob', 'todo_write']) {
      expect(names.has(stranger), `stranger ${stranger} must NOT be mounted`).toBe(false)
    }
  })
})
