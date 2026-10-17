/**
 * alpha5-g1-deny-lane.test.ts — GAP PROBE G1: the template deny lane must
 * speak ONE naming namespace for the plane tools.
 *
 * THE LAW THIS FILE PINS (semantics unchanged — this is what the lane header
 * in `team-tool-plane.mjs` already promises):
 *  - a member template that DENIES the shell class answers the plane `bash`
 *    call in the deny-lane fast path (`code=template-deny-lane`) BEFORE any
 *    backend runs — the derived effect of that call is spelled with the
 *    NATIVE class name (a5p5 `effects-schema`: `toolName = parsed.tool`),
 *    exactly like the lane rules of the template policy are;
 *  - an invoked plane tool with NO rule coverage under a `deny` default is
 *    answered by the default-deny gate (`code=template-default-deny`);
 *  - the mounted ALIAS spelling (`team_bash`) resolves through the SAME
 *    single mapping point and keeps answering identically — the fix unifies
 *    the two namespaces, it does not move the decision into one of them;
 *  - the allow lane of the SAME configuration reaches the backend with its
 *    success path intact (over-tightening guard);
 *  - everything OUTSIDE the plane namespace (file classes, non-plane tool
 *    names, the `ask` default) decides EXACTLY as before (Δ = []).
 *
 * THE DEFECT THIS FILE REDS ON (GAP PROBE G1, recorded by the GLUE-6 kit at
 * `dev/agent-workflow/evidence/alpha5/glue6/`): `createLaneDecide` keyed its
 * fast-path membership sets on the MOUNTED ALIASES (`team_bash`/`team_grep`/
 * `team_glob`) while the effect declaration speaks the native classes, so
 * both lane fast paths were inert for the plane tools and every denied call
 * fell through to the backend face (the shut face answers
 * `IO_POLICY_UNSUPPORTED` — a backend landing, NEVER deny evidence).
 *
 * Loading law: the row is imported DYNAMICALLY from the production src path
 * (the same plain-`.mjs` live-row discipline the F15 suite uses); the kit
 * re-runs the same shapes against the committed dist mirror bytes.
 */
import { describe, beforeAll, afterAll, expect, it } from 'vitest'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

type LaneVerdict = { kind: 'allow' } | { kind: 'deny'; code: string }
type Decide = (effectSet: unknown) => LaneVerdict
interface PlaneRow {
  createLaneDecide: (permissionPolicy: unknown, planeNames: Record<string, string>, subtreeContains?: unknown) => Decide
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => {
    ok: boolean
    code?: string
    message?: string
    value?: {
      definitions: ReadonlyArray<{ name: string; execute: (raw: unknown) => Promise<{ text: string }> }>
      ownNames: readonly string[]
      decide: Decide
    }
  }
  DEFAULT_PLANE_NAMES: Record<string, string>
}

let row: PlaneRow
beforeAll(async () => {
  row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as PlaneRow
})

/** The member-shaped policy of the G1 world (GLUE-6 blueprint, verbatim arms). */
const DENY_BASH_POLICY = Object.freeze({
  default: 'deny',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [],
  deny: [{ tool: 'bash', resource: { kind: 'any' } }],
})

// Effect shapes exactly as `deriveToolEffectSet` builds them (toolName =
// parsed.tool, the NATIVE class — a5p5 effects-schema effectArms()).
const bashInvoke = { effects: [{ kind: 'tool-invoke', toolName: 'bash', resource: null }] }
const grepArms = (locator: string) => ({
  effects: [
    { kind: 'tool-invoke', toolName: 'grep', resource: null },
    { kind: 'list', resource: { realmId: 'a5g1-realm', kind: 'directory', canonicalLocator: locator, rights: ['list'] } },
    { kind: 'read', resource: { realmId: 'a5g1-realm', kind: 'file', canonicalLocator: locator, rights: ['read'] } },
  ],
})
const globArms = (locator: string) => ({
  effects: [
    { kind: 'tool-invoke', toolName: 'glob', resource: null },
    { kind: 'list', resource: { realmId: 'a5g1-realm', kind: 'directory', canonicalLocator: locator, rights: ['list'] } },
  ],
})

describe('alpha5-g1 — the lane decide answers in ONE namespace (default alias mount)', () => {
  it('G1-core: a native-spelled bash effect meets the template deny of the shell class (deny BEFORE backend)', () => {
    const decide = row.createLaneDecide(DENY_BASH_POLICY, row.DEFAULT_PLANE_NAMES, undefined)
    expect(decide(bashInvoke)).toEqual({ kind: 'deny', code: 'template-deny-lane' })
  })

  it('the deny fast path is default-independent: same deny under an ask default too', () => {
    const decide = row.createLaneDecide({ ...DENY_BASH_POLICY, default: 'ask' }, row.DEFAULT_PLANE_NAMES, undefined)
    expect(decide(bashInvoke)).toEqual({ kind: 'deny', code: 'template-deny-lane' })
  })

  it('G1-core: an uncovered plane grep/glob invoke is answered by the default-deny gate', () => {
    const decide = row.createLaneDecide({ default: 'deny', allow: [], ask: [], deny: [] }, row.DEFAULT_PLANE_NAMES, undefined)
    expect(decide(grepArms('/a5g1/target.txt'))).toEqual({ kind: 'deny', code: 'template-default-deny' })
    expect(decide(globArms('/a5g1/target.txt'))).toEqual({ kind: 'deny', code: 'template-default-deny' })
  })

  it('the SAME configuration keeps the allow lane open: read-covered grep reaches the decision allow', () => {
    const decide = row.createLaneDecide(DENY_BASH_POLICY, row.DEFAULT_PLANE_NAMES, undefined)
    expect(decide(grepArms('/a5g1/target.txt'))).toEqual({ kind: 'allow' })
  })

  it('both namespaces answer through the ONE mapping: the mounted-alias spelling keeps deciding as the native one', () => {
    const decide = row.createLaneDecide(DENY_BASH_POLICY, row.DEFAULT_PLANE_NAMES, undefined)
    // The alias namespace decided correctly BEFORE the fix (the sets held the
    // aliases); the fix must PRESERVE that while it repairs the native
    // namespace — one mapping, two spellings, one verdict.
    expect(decide({ effects: [{ kind: 'tool-invoke', toolName: 'team_bash', resource: null }] }))
      .toEqual({ kind: 'deny', code: 'template-deny-lane' })
    expect(decide({ effects: [{ kind: 'tool-invoke', toolName: 'team_grep', resource: null }, ...grepArms('/x').effects.slice(1)] }))
      .toEqual({ kind: 'allow' })
  })

  it('a native-name takeover mount (no alias) decides identically — the alias was never the decision namespace', () => {
    const native = { grep: 'grep', glob: 'glob', bash: 'bash' }
    const decide = row.createLaneDecide(DENY_BASH_POLICY, native, undefined)
    expect(decide(bashInvoke)).toEqual({ kind: 'deny', code: 'template-deny-lane' })
    expect(decide(grepArms('/x'))).toEqual({ kind: 'allow' })
  })

  it('Δ=[] outside the plane namespace: file-class denies, non-plane invokes and the ask default decide unchanged', () => {
    const decide = row.createLaneDecide(
      {
        default: 'deny',
        allow: [{ tool: 'read', resource: { kind: 'any' } }],
        ask: [{ tool: 'write', resource: { kind: 'exact', path: '/a5g1/asked.txt' } }],
        deny: [{ tool: 'read', resource: { kind: 'exact', path: '/a5g1/denied.txt' } }],
      },
      row.DEFAULT_PLANE_NAMES,
      undefined,
    )
    // file-effect deny (already class-keyed pre-fix): unchanged
    expect(decide({ effects: [{ kind: 'read', resource: { kind: 'file', locator: '/a5g1/denied.txt' } }] }))
      .toEqual({ kind: 'deny', code: 'template-deny-lane' })
    // a non-plane invoked name stays outside BOTH plane namespaces: unchanged
    expect(decide({ effects: [{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }] })).toEqual({ kind: 'allow' })
    // the ask-default keeps the default-deny gate switched off (gate reads
    // `deny` only): unchanged
    const askDecide = row.createLaneDecide({ default: 'ask', allow: [], ask: [], deny: [] }, row.DEFAULT_PLANE_NAMES, undefined)
    expect(askDecide(grepArms('/x'))).toEqual({ kind: 'allow' })
  })
})

// ── assembly level: the deny must land BEFORE the backend face ─────────────
interface FixtureBackendOptions { readonly sentinel: string; readonly kind: 'shell' | 'search' }

/** A ToolEffectBackend whose success path is REAL and observable: reaching it
 * writes the sentinel file and bumps the counter; the presented text carries
 * the marker. This is the positive control the shut production face cannot
 * give (its IO_POLICY_UNSUPPORTED answers WITHOUT ever being a deny). */
function createFixtureBackend(opts: FixtureBackendOptions) {
  let n = 0
  return {
    backendId: `a5g1-fixture-${opts.kind}`,
    run: async () => {
      n += 1
      writeFileSync(opts.sentinel, `reached-${String(n)}`)
      const settlement = { kind: 'completed' as const }
      if (opts.kind === 'shell') {
        return {
          ok: true as const,
          settlement,
          outcome: { exitCode: 0, stdout: 'A5G1_BACKEND_RAN', stderr: '', timedOut: false, cancelled: false, truncated: false },
        }
      }
      return {
        ok: true as const,
        settlement,
        outcome: {
          outputMode: 'content' as const,
          matches: [{ path: '/a5g1/target.txt', line: 2, text: 'A5G1_GREP_HIT' }],
          counts: [],
          files: [],
          totalMatches: 1,
          truncated: false,
        },
      }
    },
    execCount: () => n,
    lastStageTrace: Object.freeze([]),
  }
}

function exists(p: string): boolean {
  try {
    statSync(p)
    return true
  } catch {
    return false
  }
}

describe('alpha5-g1 — the assembly answers the deny lane BEFORE any backend runs', () => {
  const scratch = scratchDir('a5g1-deny')

  beforeAll(() => {
    mkdirSync(scratch, { recursive: true })
  })

  afterAll(() => {
    destroyDir(scratch)
  })

  it('denied team_bash: typed template-deny-lane refusal, backend execCount 0, ZERO fs write', async () => {
    const shellSentinel = join(scratch, 'shell-reached.sentinel')
    const searchSentinel = join(scratch, 'search-reached.sentinel')
    const shell = createFixtureBackend({ sentinel: shellSentinel, kind: 'shell' })
    const search = createFixtureBackend({ sentinel: searchSentinel, kind: 'search' })
    const built = row.createTeamToolPlaneAssembly({
      permissionPolicy: DENY_BASH_POLICY,
      realmId: 'a5g1-realm',
      templateId: 'wa',
      role: 'member',
      instanceId: 'a5g1-instance',
      backends: { search, shell },
    })
    expect(built.ok).toBe(true)
    const defs = built.value!.definitions
    expect(defs.map((d) => d.name)).toEqual(['team_grep', 'team_glob', 'team_bash'])

    const bash = await defs.find((d) => d.name === 'team_bash')!.execute({ command: 'echo a5g1' })
    expect(bash.text).toContain('a5p5-refused')
    expect(bash.text).toContain('code=template-deny-lane')
    expect(bash.text).not.toContain('A5G1_BACKEND_RAN')
    expect(shell.execCount()).toBe(0)
    expect(exists(shellSentinel)).toBe(false)

    // same world, same configuration: the ALLOW lane reaches the backend with
    // its success path intact (over-tightening guard).
    const grep = await defs.find((d) => d.name === 'team_grep')!.execute({ pattern: 'A5G1_GREP_TARGET', path: '/a5g1/target.txt', output_mode: 'content' })
    expect(grep.text).toContain('A5G1_GREP_HIT')
    expect(search.execCount()).toBe(1)
    expect(exists(searchSentinel)).toBe(true)
  })

  it('production (shut) face shape: the denied call is refused by the LANE, not by the backend; the allowed call still lands on the backend face', async () => {
    const built = row.createTeamToolPlaneAssembly({
      permissionPolicy: DENY_BASH_POLICY,
      realmId: 'a5g1-realm',
      templateId: 'wa',
      role: 'member',
      instanceId: 'a5g1-instance',
    })
    expect(built.ok).toBe(true)
    const defs = built.value!.definitions
    const bash = await defs.find((d) => d.name === 'team_bash')!.execute({ command: 'echo a5g1' })
    // deny BEFORE backend: the refusal names the lane, and the shut backend's
    // landing code is ABSENT (its presence would mean the call reached the
    // backend — landing evidence, never deny evidence).
    expect(bash.text).toContain('code=template-deny-lane')
    expect(bash.text).not.toContain('IO_POLICY_UNSUPPORTED')
    // the allow lane lands on the shut face (the disclosed GLUE-4 follow-up
    // gap): the call REACHES the backend and the backend answers it.
    const grep = await defs.find((d) => d.name === 'team_grep')!.execute({ pattern: 'x', path: '/a5g1/target.txt', output_mode: 'content' })
    expect(grep.text).toContain('code=IO_POLICY_UNSUPPORTED')
  })

  it('default-deny gate at the assembly: an uncovered plane grep is refused before the shut backend answers', async () => {
    const built = row.createTeamToolPlaneAssembly({
      permissionPolicy: { default: 'deny', allow: [], ask: [], deny: [] },
      realmId: 'a5g1-realm',
      templateId: 'wa',
      role: 'member',
      instanceId: 'a5g1-instance',
    })
    expect(built.ok).toBe(true)
    const defs = built.value!.definitions
    const grep = await defs.find((d) => d.name === 'team_grep')!.execute({ pattern: 'x', path: '/a5g1/target.txt', output_mode: 'content' })
    expect(grep.text).toContain('code=template-default-deny')
    expect(grep.text).not.toContain('IO_POLICY_UNSUPPORTED')
  })
})
