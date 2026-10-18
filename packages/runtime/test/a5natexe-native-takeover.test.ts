/**
 * a5natexe-native-takeover.test.ts — the NATIVE-SPELLING TAKEOVER row rides
 * the pb §6 placement feed: the unit face of "execute after approval" for
 * native `bash` (natexe round; the live face is
 * `dev/agent-workflow/evidence/alpha5/natexe/run-natexe-live.mjs`).
 *
 * THE FACT THIS PINS (root 02:44Z ③ gap, u1 README ④.2): in the web profile
 * the trusted GLOBAL face is EMPTY (bind-diag law), so a governed Agent's
 * native `bash` rides the inherited-native lane with no trusted side to
 * compare against — bound `unattributed`, refused at EVERY call, including
 * after a durable approval was consumed (GLUE-8 assembled A4.4 measured
 * exactly this landing). The closure is the EXISTING law: a Definition the
 * trusted assembly PLACES under that name (the plane shell row's takeover
 * spelling — the governed `read` row already ships this exact pattern,
 * int-a5b T5) rides the placement feed, and the Guard verifies the
 * placement identity (def#N), not a name.
 *
 * THE FOUR SEMANTICS:
 *   N1  the unfed landing STANDS VERBATIM (zero-regression law: a scope
 *       without the placement row keeps the GLUE-8 refusal byte-for-byte;
 *       this is the expectation the GLUE-8 two-mode kit still asserts);
 *   N2  the takeover row rides the feed ⇒ verified ⇒ the call ABSTAINS and
 *       the PLACED Body answers (the execute-after-approval landing);
 *   N3  the three feed gates govern the takeover row like any other
 *       (realm pairing; placement attribution is the ONLY feed authority —
 *       an un-owned name with a feed row is a refusal, never a binding;
 *       placement->bind continuity);
 *   N4  the lane re-check speaks the NATIVE spelling of the takeover row
 *       (deny-lane denies before any backend; ask coverage does not deny —
 *       the approval lane is UNCHANGED semantics).
 *
 * @module test/a5natexe-native-takeover
 */
import { describe, expect, it } from 'vitest'
import {
  definitionIdentityOf,
  installScopedToolGuard,
  type BindingFeedEntry,
  type ScopedGuardAgentCtx,
} from '../tool-dispatch/index.js'

/** The live row is an untyped .mjs (no declaration sidecar, by design);
 *  the tree's unit convention is the computed-specifier dynamic import +
 *  local cast (same shape as alpha5-glue7-plane-backends.test.ts). */
interface PlaneLaneDecide {
  decide: (effects: unknown) => { kind: string; code?: string }
}
async function loadCreateLaneDecide(): Promise<
  (policy: unknown, planeNames: Record<string, string>, extra?: unknown) => PlaneLaneDecide['decide']
> {
  const row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
    createLaneDecide: (policy: unknown, planeNames: Record<string, string>, extra?: unknown) => PlaneLaneDecide['decide']
  }
  return row.createLaneDecide
}

type PlaneNamesVerdict = { ok?: boolean; code?: string; message?: string }
async function loadVerifyPlaneNames(): Promise<
  (names: Record<string, string>, readName: string) => PlaneNamesVerdict
> {
  const row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
    verifyPlaneNames: (names: Record<string, string>, readName: string) => PlaneNamesVerdict
  }
  return row.verifyPlaneNames
}

/** The row module face the drift pin reads (exports shipped by the 06:43Z
 *  exhaustion round): the pinned host baseline + the reserved-native registry. */
async function loadPlaneNamesModule(): Promise<{
  PLANE_RESERVED_NATIVE: readonly string[]
  PLANE_RESERVED_NATIVE_PREFIXES: readonly string[]
  PLANE_RESERVED_NATIVE_HOST_PIN: string
}> {
  return (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
    PLANE_RESERVED_NATIVE: readonly string[]
    PLANE_RESERVED_NATIVE_PREFIXES: readonly string[]
    PLANE_RESERVED_NATIVE_HOST_PIN: string
  }
}

/** The refusal the GLUE-8 assembled A4.4 pinned for native bash, byte-for-byte. */
const VERBATIM_BASH_REFUSAL =
  'team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)'

const REALM = 'a5natexe-realm'

/** The measured web-profile registry double (same shape as a5pbr2): the
 *  trusted GLOBAL face is EMPTY; the scoped read answers with what the
 *  assembly placed. */
function webProfileWorld() {
  const surface = ['read', 'bash']
  const definitions = new Map<string, { name: string; execute: () => unknown }>()
  for (const name of surface) definitions.set(name, { name, execute: () => `native:${name}` })
  const guards: ((exec: { name: string; agent?: unknown }) => string | undefined)[] = []
  let bodyExecs = 0
  const ctx = {
    tools: {
      guard: (guard: (exec: { name: string; agent?: unknown }) => string | undefined) => {
        guards.push(guard)
        return () => {
          const at = guards.indexOf(guard)
          if (at >= 0) guards.splice(at, 1)
        }
      },
      schemas: (scope?: unknown) => (scope === undefined ? [] : surface).map((name) => ({ name })),
      get: (name: string, scope?: unknown) => (scope === undefined ? undefined : definitions.get(name)),
    },
    on: () => () => { /* no events needed */ },
  } as unknown as ScopedGuardAgentCtx
  return {
    ctx,
    guards,
    bodyExecs: () => bodyExecs,
    place: (name: string, marker: string) => {
      const def = { name, execute: () => marker }
      definitions.set(name, def)
      if (!surface.includes(name)) surface.push(name)
      return def
    },
    swapDefinition: (name: string, marker: string) => {
      definitions.set(name, { name, execute: () => marker })
    },
    runCall: (name: string) => {
      const exec = { name, callId: `c-${name}`, agent: { id: 'agent-m1' } }
      const denial = guards.reduce<string | undefined>(
        (acc, guardFn) => (acc !== undefined ? acc : guardFn(exec as { name: string; agent?: unknown })),
        undefined,
      )
      if (denial !== undefined) return { denial }
      bodyExecs += 1
      return { result: { text: String(definitions.get(name)?.execute()) } }
    },
  }
}

function install(world: ReturnType<typeof webProfileWorld>, over: Record<string, unknown> = {}) {
  return installScopedToolGuard({
    agentCtx: world.ctx,
    runtimeAgent: { id: 'agent-m1', session: { header: { id: 'session-m1' } } },
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1', 'agent-m1'],
    nativeNames: [], // the measured web-profile fact: the trusted global face is EMPTY
    ...over,
  })
}

describe('natexe N1 — the unfed native-bash landing stands VERBATIM (GLUE-8 zero-regression)', () => {
  it('an un-placed native bash is bound unattributed and refused byte-for-byte, body never runs', () => {
    const world = webProfileWorld()
    const outcome = install(world)
    if (!outcome.ok) throw new Error(outcome.error.message)
    const published = outcome.value.publish()
    if (!published.ok) throw new Error(published.error.message)
    const entry = outcome.value.dispatcher.surface.entryOf('bash')
    expect(entry?.verified).toBe(false)
    expect(entry?.unverifiedReason).toBe('unattributed')
    // Even a consumed durable approval cannot move this: the Guard has no
    // allow result — the landing GLUE-8 assembled A4.4 pinned (kit 953-959).
    expect(world.guards[0]!({ name: 'bash', agent: { id: 'agent-m1' } })).toBe(VERBATIM_BASH_REFUSAL)
    expect(world.runCall('bash')).toEqual({ denial: VERBATIM_BASH_REFUSAL })
    expect(world.bodyExecs()).toBe(0)
  })
})

describe('natexe N2 — the takeover row rides the feed: verified, abstains, the PLACED body answers', () => {
  it('placed bash (native spelling) + assemblyOwnedNames + feed row ⇒ bindOwnTools verifies and the call executes the placed body', () => {
    const world = webProfileWorld()
    const placed = world.place('bash', 'confined-shell:placed-body')
    const identity = definitionIdentityOf(placed)
    expect(typeof identity).toBe('string')
    const observations: Record<string, unknown>[] = []
    const outcome = install(world, {
      realmId: REALM,
      // the takeover fact: the assembly PLACED the row under the native name
      // (a5PlaneOwnedNames carries it; the inherited lane never credits it).
      assemblyOwnedNames: ['team_grep', 'team_glob', 'bash', 'read'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'bash' ? { definitionIdentity: identity!, realmId: REALM } : undefined,
      onObserve: (row: Record<string, unknown>) => observations.push(row),
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const handle = outcome.value
    expect(handle.bindOwnTools(['bash']).ok).toBe(true)
    expect(observations.some((o) => o.event === 'binding-feed-verified' && o.tool === 'bash')).toBe(true)
    const entry = handle.dispatcher.surface.entryOf('bash')
    expect(entry?.verified).toBe(true)
    expect(entry?.binding.definitionIdentity).toBe(identity)
    expect(entry?.binding.implementationOrigin).toBe('team-trusted-extension') // audit honesty: never a fake dsh-native
    const published = handle.publish()
    if (!published.ok) throw new Error(published.error.message)
    // THE post-approval landing: the Guard abstains and the PLACED body runs.
    const call = world.runCall('bash')
    expect(call).toEqual({ result: { text: 'confined-shell:placed-body' } })
    expect(world.bodyExecs()).toBe(1)
  })
})

describe('natexe N3 — the three feed gates govern the takeover row', () => {
  it('G-a cross-realm feed entry ⇒ typed refusal at bind (Realm 不可混淆)', () => {
    const world = webProfileWorld()
    const placed = world.place('bash', 'placed')
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: ['bash'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'bash' ? { definitionIdentity: definitionIdentityOf(placed)!, realmId: 'other-realm' } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['bash'])
    expect(bound.ok).toBe(false)
    expect(bound.ok === false ? bound.error.code : '').toBe('TOOL_BINDING_UNVERIFIED')
  })
  it('G-b a feed row for a name this assembly did NOT place is a refusal, never a binding (the ONLY feed authority)', () => {
    const world = webProfileWorld()
    const placed = world.place('bash', 'placed')
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: [], // <-- the attribution lie
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'bash' ? { definitionIdentity: definitionIdentityOf(placed)!, realmId: REALM } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['bash'])
    expect(bound.ok).toBe(false)
    expect(bound.ok === false ? bound.error.message : '').toContain('placement attribution is the only feed authority')
  })
  it('G-c placement->bind drift (the scoped read resolves ANOTHER body) ⇒ refusal', () => {
    const world = webProfileWorld()
    const placed = world.place('bash', 'placed')
    world.swapDefinition('bash', 'someone-elses-body') // a same-name takeover after placement
    const outcome = install(world, {
      realmId: REALM,
      assemblyOwnedNames: ['bash'],
      bindingFeed: (name: string): BindingFeedEntry | undefined =>
        name === 'bash' ? { definitionIdentity: definitionIdentityOf(placed)!, realmId: REALM } : undefined,
    })
    if (!outcome.ok) throw new Error(outcome.error.message)
    const bound = outcome.value.bindOwnTools(['bash'])
    expect(bound.ok).toBe(false)
    expect(bound.ok === false ? bound.error.message : '').toContain('the Body moved between placement and bind')
  })
})

describe('natexe N4 — the lane re-check speaks the native spelling of the takeover row', () => {
  const asBash = { effects: [{ kind: 'tool-invoke', toolName: 'bash', resource: { kind: 'any' } }] }
  it('deny-lane bash denies the takeover row BEFORE any backend (template-deny-lane)', async () => {
    const createLaneDecide = await loadCreateLaneDecide()
    const decide = createLaneDecide(
      { default: 'ask', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] },
      { grep: 'team_grep', glob: 'team_glob', bash: 'bash' },
      undefined,
    )
    expect(decide(asBash)).toEqual({ kind: 'deny', code: 'template-deny-lane' })
  })
  it('ask-covered bash is NOT lane-denied (the durable-approval lane is UNCHANGED semantics)', async () => {
    const createLaneDecide = await loadCreateLaneDecide()
    const decide = createLaneDecide(
      { default: 'ask', allow: [], ask: [{ tool: 'bash', resource: { kind: 'any' } }], deny: [] },
      { grep: 'team_grep', glob: 'team_glob', bash: 'bash' },
      undefined,
    )
    expect(decide(asBash)).toEqual({ kind: 'allow' })
  })
  it('the default ALIAS shape (team_bash) keeps its judgement byte-for-byte (zero-drift law)', async () => {
    const createLaneDecide = await loadCreateLaneDecide()
    const decide = createLaneDecide(
      { default: 'deny', allow: [], ask: [], deny: [{ tool: 'bash', resource: { kind: 'any' } }] },
      { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' },
      undefined,
    )
    expect(decide({ effects: [{ kind: 'tool-invoke', toolName: 'team_bash', resource: { kind: 'any' } }] }))
      .toEqual({ kind: 'deny', code: 'template-deny-lane' })
  })
})

describe('natexe N5 — the mount-name domain is CLOSED (③ anti-spoofing, root 04:34Z)', () => {
  const D = { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }
  const UNSUPPORTED = 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED'
  it('every adversarial names shape is REFUSED with its typed code, never mounted', async () => {
    const verify = await loadVerifyPlaneNames()
    // (id, names, readName, expected code, verbatim message tail) — the code
    // split (PLANE_NAMES_INVALID vs _NATIVE_CLAIM_UNSUPPORTED) is the 06:43Z
    // ruling: reserved native names die on the ASSEMBLED-PAIRING law, not on
    // coarse permission class.
    const refused: Array<[string, Record<string, string>, string, string, string]> = [
      ['row-name collision (shell row under the grep row)', { ...D, bash: 'team_grep' }, 'read', 'PLANE_NAMES_INVALID', "both mount under 'team_grep'"],
      ['shell row under reserved read', { ...D, bash: 'read' }, 'read', UNSUPPORTED, "assembles no same-name, same-meaning implementation"],
      ['shell row under reserved pwsh', { ...D, bash: 'pwsh' }, 'read', UNSUPPORTED, "reserved native name 'pwsh'"],
      ['file row claiming the shell native', { ...D, grep: 'bash' }, 'read', UNSUPPORTED, "reserved native name 'bash'"],
      ['shell row claiming a file-tool native', { ...D, bash: 'write' }, 'read', UNSUPPORTED, "reserved native name 'write'"],
      ['reader row as the writer (readName=write)', D, 'write', UNSUPPORTED, "reserved native name 'write'"],
      ['reader row as the editor (readName=edit)', D, 'edit', UNSUPPORTED, "reserved native name 'edit'"],
      ['reader row as the image reader (readName=read_image)', D, 'read_image', UNSUPPORTED, "reserved native name 'read_image'"],
      ['reader row as the lsp (readName=lsp)', D, 'lsp', UNSUPPORTED, "reserved native name 'lsp'"],
      ['grep row claiming its own native (no assembled pairing)', { ...D, grep: 'grep' }, 'read', UNSUPPORTED, "reserved native name 'grep'"],
      ['grep row under web_search (host native, exhaustive face)', { ...D, grep: 'web_search' }, 'read', UNSUPPORTED, "reserved native name 'web_search'"],
      ['glob row under todo_write', { ...D, glob: 'todo_write' }, 'read', UNSUPPORTED, "reserved native name 'todo_write'"],
      ['bash row under present', { ...D, bash: 'present' }, 'read', UNSUPPORTED, "reserved native name 'present'"],
      ['read row under send_message', D, 'send_message', UNSUPPORTED, "reserved native name 'send_message'"],
      ['grep row under skill', { ...D, grep: 'skill' }, 'read', UNSUPPORTED, "reserved native name 'skill'"],
      ['grep row under cordis_inspect_list (preset-gated native)', { ...D, grep: 'cordis_inspect_list' }, 'read', UNSUPPORTED, "reserved native name 'cordis_inspect_list'"],
      ['glob row under cordis_inspect_query', { ...D, glob: 'cordis_inspect_query' }, 'read', UNSUPPORTED, "reserved native name 'cordis_inspect_query'"],
      ['mcp dynamic family (prefix law)', { ...D, grep: 'mcp__host__read' }, 'read', UNSUPPORTED, "reserved native name 'mcp__host__read'"],
      ['empty-string mount', { ...D, bash: '' }, 'read', 'PLANE_NAMES_INVALID', 'must match'],
      ['prototype-ish mount', { ...D, bash: '__proto__' }, 'read', 'PLANE_NAMES_INVALID', 'must match'],
      ['foreign class key', { ...D, foo: 'x' }, 'read', 'PLANE_NAMES_INVALID', 'closed to its own classes'],
      ['readName colliding with a mounted row', D, 'team_grep', 'PLANE_NAMES_INVALID', "both mount under 'team_grep'"],
    ]
    for (const [id, names, read, code, needle] of refused) {
      const v = verify(names, read)
      expect(v.ok, id).not.toBe(true)
      expect(v.code, id).toBe(code)
      expect(v.message ?? '', id).toContain(needle)
    }
  })
  it('every legitimate shape stays accepted (zero-regression: defaults, the two SUPPORTED takeover pairs, custom aliases)', async () => {
    const verify = await loadVerifyPlaneNames()
    expect(verify(D, 'read').ok).toBe(true)
    // The supported pairs — bash row at 'bash' (live-verified takeover), read
    // row at 'read' (the shipped readName default):
    expect(verify({ ...D, bash: 'bash' }, 'read').ok).toBe(true)
    // Non-reserved custom aliases are always mountable (no native identity claimed):
    expect(verify({ ...D, bash: 'myshell' }, 'read').ok).toBe(true)
    expect(verify({ grep: 'mygrep', glob: 'myglob', bash: 'myshell' }, 'myread').ok).toBe(true)
  })
  it('the reserved-native surface is pinned to the host release (drift pin reds when the host baseline moves)', async () => {
    const mod = await loadPlaneNamesModule()
    const paths = (await import('../../../tests/paths.mjs')) as unknown as { DSH_BASELINE_VERSION: string; TEST_USE_BASELINE_SHA: string }
    const live = `${paths.DSH_BASELINE_VERSION}@${paths.TEST_USE_BASELINE_SHA.slice(0, 10)}`
    expect(mod.PLANE_RESERVED_NATIVE_HOST_PIN, 'host baseline moved: re-derive the reserved-native registry from the new host release, then move the pin').toBe(live)
    for (const n of ['read', 'write', 'edit', 'read_image', 'glob', 'grep', 'bash', 'pwsh', 'web_search', 'web_fetch', 'todo_write', 'skill', 'present', 'send_message', 'subagent_fork', 'team_task_create', 'exit_plan_mode', 'cordis_inspect_list', 'cordis_inspect_query']) {
      expect(mod.PLANE_RESERVED_NATIVE, `host native '${n}' must stay reserved`).toContain(n)
    }
    expect(mod.PLANE_RESERVED_NATIVE_PREFIXES).toContain('mcp__')
  })
  it('mixed defects hit FIRST-HIT by check order (shape -> reserved claim -> collision)', async () => {
    const verify = await loadVerifyPlaneNames()
    // reserved claim AND a lurking collision on the same shape: the reserved
    // check fires first, so the code is UNSUPPORTED, not the collision INVALID
    // (docs/INSTALL.md 3.5 states the precedence; 'PLANE_NAMES_INVALID for
    // the rest' holds only of PURE single-defect shapes):
    const v = verify({ grep: 'bash', glob: 'bash', bash: 'team_bash' }, 'read')
    expect(v.ok).not.toBe(true)
    expect(v.code).toBe('PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED')
    // pure single-defect collision still reports INVALID:
    expect(verify({ ...D, bash: 'team_grep' }, 'read').code).toBe('PLANE_NAMES_INVALID')
  })
})
