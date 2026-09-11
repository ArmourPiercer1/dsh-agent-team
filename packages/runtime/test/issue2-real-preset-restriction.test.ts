/**
 * issue2-real-preset-restriction.test.ts — I2-P1 (plan §10) PERMANENT
 * REAL-SEAM regression for the alpha.2 Issue #2 permission repair:
 * `builtinToolDeny` must restrict, per Team member, the tools the member
 * INHERITS from its joined agent preset — through the real seam:
 *
 *   createAgentBindings-equivalent setup
 *     -> AgentPresets.mount()            (REAL, over preset cordis.yml files
 *                                          loaded by the REAL Loader)
 *     -> ToolRuntime                     (REAL registry; the model-facing
 *                                          surface is read through
 *                                          `ctx.tools.schemas(agent)`)
 *     -> applyBuiltInToolDeny()          (the REAL adapter from
 *                                          @dsh-agent-team/tools)
 *
 * A fake-agentCtx unit test of `applyBuiltInToolDeny` alone is NOT
 * sufficient (plan §10.1): the B2 production defect was a failure of the
 * COMBINATION (mount + standing scope + restrict), not of the adapter.
 *
 * Cross-platform fixture leg (plan §10.2): the fixture preset
 * `i2-standard` (test/issue2-fixtures) contributes `fixture-shell` (the
 * deny subject) and `fixture-base` (the precision control). Two members:
 * expert deny=[], researcher deny=[fixture-shell]. Assertions: expert
 * sees fixture-shell; researcher does not; the researcher's surface is
 * the expert's surface minus EXACTLY {fixture-shell}; direct dispatch of
 * the denied tool fails as an unknown tool (registry-level proof); the
 * denial is precise (fixture-base and the sibling's tools are untouched);
 * an unrestrictable deny name FAILS CLOSED (the agent creation is rolled
 * back — plan §11 "restriction cannot be applied -> setup fail closed");
 * the restriction is agent-scoped (sibling-inert); the LIFECYCLE matrix
 * (plan §14) is pinned: fresh member (S1), sibling inertness (S3),
 * cold member with dispose (S4), an already-joined adopted root (S5),
 * fresh root on its own preset id + deny subject (S8), and cold root
 * rebuild (S9) — restriction rebuilt on resume, no stale disposer/state,
 * siblings untouched; an already-joined agent keeps its composition and
 * the deny still applies to the inherited preset tools (plan §12.1/§12.3).
 *
 * Windows live leg (plan §10.3, real standard preset + real pwsh): the
 * shipped `standard` preset references the full production tool-package
 * closure (shell executors, sandbox, jobs, skills, compaction, workflow),
 * which is not part of this repository's dependency surface; that leg is
 * covered by the recorded live-world evidence in
 * dev/agent-workflow/evidence/alpha2-issue2-permission/ (issue2-phase-c
 * JSON, both legs GREEN at the pinned artifact). This file is the
 * permanent in-repo seam regression.
 *
 * RUNNER CONSTRAINTS (this repo's plain-node shim — see the a5a header):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous assertions.
 * Shim matchers used: toBe / toEqual (+.not) only.
 *
 * SELF-CLEANLINESS: this file is inside the P4-T6 whole-tree scanner's
 * scope (`packages/**`), so no legacy Team SessionEvent denylist token
 * may appear in this source — none does.
 *
 * @module @dsh-agent-team/runtime/test/issue2-real-preset-restriction
 */
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import Group from '@deepseek-ai/cordis-plugin-group'
import LlmRuntime from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import AgentPresets from '@deepseek-ai/dsh-agent-presets'
import type { Config } from '@deepseek-ai/dsh-agent-presets'
import { applyBuiltInToolDeny } from '../../tools/src/index.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'issue2-fixtures')
const PRESET_ROOTS: Config['roots'] = [
  { path: join(FIXTURES, 'presets'), trust: 'user' },
]

/**
 * The real upstream composition (the upstream mount.spec.ts recipe, the
 * standing registries a preset contributes to, plus the preset roster).
 */
async function harness(
  roster: Config = {
    default: 'i2-standard',
    roots: PRESET_ROOTS,
    includeShippedRoot: false,
    includeUserRoot: false,
  },
): Promise<Context> {
  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(FIXTURES).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  ctx.loader.builtins.group = Group
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt, { persona: '' })
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(AgentPresets, roster)
  return ctx
}

/** The model-facing tool surface visible to one agent (sorted names). */
function toolNames(ctx: Context, agent: { ctx: Context }): string[] {
  return ctx.tools.schemas(agent as never).map((schema) => schema.name).sort()
}

interface GlueOutcome {
  /** The already-joined guard fired (the second mount was skipped). */
  mountSkipped: boolean
  /** The preset id the agent's composition reports (undefined = unjoined). */
  composed: string | undefined
}

/**
 * The Team glue's base-tool block (the agent-bindings.mjs L1084-1121
 * sequence, mirrored 1:1): the already-joined probe -> the preset mount
 * (root or member preset id, ABSENT = the deployment default) -> the
 * built-in tool deny (the REAL adapter; its disposer would ride the
 * glue's toolDisposers drain at agent close).
 */
async function glueBaseTools(
  ctx: Context,
  agentCtx: Context,
  presetId: string | undefined,
  deny: readonly string[],
): Promise<GlueOutcome> {
  const presets = ctx.agentPresets
  let mountSkipped = false
  if (typeof presets.composedPreset === 'function' && presets.composedPreset(agentCtx) !== undefined) {
    mountSkipped = true
  } else {
    await presets.mount(agentCtx, presetId)
  }
  applyBuiltInToolDeny(agentCtx, deny)
  return { mountSkipped, composed: presets.composedPreset(agentCtx) }
}

/** Create one agent whose setup runs the glue base-tools block. */
async function agentOnGlue(
  ctx: Context,
  id: string,
  presetId: string | undefined,
  deny: readonly string[],
): Promise<{ handle: { agent: { ctx: Context }; dispose(): Promise<void> }; outcome: GlueOutcome }> {
  let outcome: GlueOutcome | undefined
  const handle = await ctx.agents.create({
    sessionId: SessionId(id),
    setup: async (agentCtx: Context) => {
      outcome = await glueBaseTools(ctx, agentCtx, presetId, deny)
    },
  })
  return { handle, outcome: outcome as GlueOutcome }
}

// ===========================================================================
// WORLD MAIN (module level — the shim constraint).
// ===========================================================================

const W = await (async () => {
  const ctx = await harness()
  const out: Record<string, unknown> = {}

  // ── S1 — fresh member: mount + deny (plan §12.2) ────────────────────
  const expert = await agentOnGlue(ctx, 'i2-expert', 'i2-standard', [])
  const researcher = await agentOnGlue(ctx, 'i2-researcher', 'i2-standard', ['fixture-shell'])
  out.expertSurface = toolNames(ctx, expert.handle.agent)
  out.researcherSurface = toolNames(ctx, researcher.handle.agent)
  out.expertOutcome = expert.outcome
  out.researcherOutcome = researcher.outcome

  // ── S2 — fail closed: an unrestrictable deny name (plan §11) ────────
  let s2Message: string | null = null
  try {
    await agentOnGlue(ctx, 'i2-broken', 'i2-standard', ['no-such-tool'])
  } catch (error: unknown) {
    s2Message = error instanceof Error ? error.message : String(error)
  }
  out.s2Message = s2Message
  out.s2RolledBack = ctx.agents.get(SessionId('i2-broken')) === undefined

  // ── S3 — sibling-inert: a THIRD agent on the same preset, deny [] ───
  const sibling = await agentOnGlue(ctx, 'i2-sibling', 'i2-standard', [])
  out.siblingSurface = toolNames(ctx, sibling.handle.agent)

  // ── S4 — cold resume: dispose the researcher, rebuild on a fresh
  //      session with the SAME preset + SAME deny (plan §14) ───────────
  const siblingBeforeCold = toolNames(ctx, sibling.handle.agent)
  await researcher.handle.dispose()
  const researcherCold = await agentOnGlue(ctx, 'i2-researcher-cold', 'i2-standard', ['fixture-shell'])
  out.researcherColdSurface = toolNames(ctx, researcherCold.handle.agent)
  out.siblingAfterCold = toolNames(ctx, sibling.handle.agent)
  out.siblingStable = JSON.stringify(siblingBeforeCold) === JSON.stringify(out.siblingAfterCold)
  out.disposedGone = ctx.agents.get(SessionId('i2-researcher')) === undefined

  // ── S5 — already-joined (plan §12.1/§12.3): the agent's composition
  //      is established BEFORE the glue block (the adopted web-session
  //      root shape); the guard must skip the second mount and the deny
  //      must still apply to the inherited preset tools. ───────────────
  const adopted: Record<string, unknown> = {}
  const adoptedHandle = await ctx.agents.create({
    sessionId: SessionId('i2root-adopted'),
    setup: async (agentCtx: Context) => {
      // The web/session composition joined the preset before the Team row
      // adopted this session:
      await ctx.agentPresets.mount(agentCtx, 'i2-standard')
      // The glue block (the real guard + the real deny):
      adopted.outcome = await glueBaseTools(ctx, agentCtx, 'i2-standard', ['fixture-shell'])
    },
  })
  // The surface is read off the REAL agent object (schemas are keyed by the
  // agent's scope identity, not by a bare context):
  adopted.surface = toolNames(ctx, adoptedHandle.agent)
  out.adopted = adopted

  // ── S6 — the guard's rationale (documented glue invariant): a second
  //      explicit mount on an already-joined agent context rejects (the
  //      roster's mount is the ONE bind). Captured on a throwaway agent. ─
  let s6Message: string | null = null
  try {
    await ctx.agents.create({
      sessionId: SessionId('i2-double'),
      setup: async (agentCtx: Context) => {
        await ctx.agentPresets.mount(agentCtx, 'i2-standard')
        await ctx.agentPresets.mount(agentCtx, 'i2-standard')
      },
    })
  } catch (error: unknown) {
    s6Message = error instanceof Error ? error.message : String(error)
  }
  out.s6Message = s6Message
  out.s6RolledBack = ctx.agents.get(SessionId('i2-double')) === undefined

  // ── S7 — dispatch-level proof: a DIRECT execution of the denied tool
  //      on the researcher COLD agent (the live post-resume handle — the
  //      original was disposed in S4, and dispose unwinds the
  //      agent-scoped restrict mask by design) fails as an unknown tool
  //      (the mask is at the registry level, not only in the schemas),
  //      while the SAME execution on the expert succeeds (the deny is
  //      scoped, not global). (The live-world kit drives the same probes
  //      over the production dispatch endpoint; this is the in-repo
  //      twin.) ─────────────────────────────────────────────────────────
  const controllerA = new AbortController()
  const deniedDispatch = await ctx.tools.execute({
    signal: controllerA.signal,
    callId: `i2-s7-denied` as never,
    name: 'fixture-shell',
    arguments: {},
    agent: researcherCold.handle.agent as never,
  })
  out.s7DeniedIsError = deniedDispatch.isError === true
  out.s7DeniedText = deniedDispatch.content[0]?.type === 'text' ? deniedDispatch.content[0].text : JSON.stringify(deniedDispatch.content)
  const controllerB = new AbortController()
  const allowedDispatch = await ctx.tools.execute({
    signal: controllerB.signal,
    callId: `i2-s7-allowed` as never,
    name: 'fixture-shell',
    arguments: {},
    agent: expert.handle.agent as never,
  })
  out.s7AllowedIsError = allowedDispatch.isError
  out.s7AllowedText = allowedDispatch.content[0]?.type === 'text' ? allowedDispatch.content[0].text : JSON.stringify(allowedDispatch.content)

  // ── S8/S9 — the ROOT lifecycle (plan §14: fresh root, cold root):
  //      the root (leader) carries its OWN preset id (the glue's
  //      rootPresetId) and its OWN deny list — here denying
  //      fixture-base (a DIFFERENT subject than the researcher's
  //      fixture-shell, proving per-role denies are independent). ────
  const root = await agentOnGlue(ctx, 'i2root', 'i2-standard', ['fixture-base'])
  out.rootSurface = toolNames(ctx, root.handle.agent)
  out.rootOutcome = root.outcome
  // Cold root: dispose, rebuild on a fresh session (same preset + deny):
  const expertBeforeColdRoot = toolNames(ctx, expert.handle.agent)
  await root.handle.dispose()
  const rootCold = await agentOnGlue(ctx, 'i2root-cold', 'i2-standard', ['fixture-base'])
  out.rootColdSurface = toolNames(ctx, rootCold.handle.agent)
  out.expertAfterColdRoot = toolNames(ctx, expert.handle.agent)
  out.expertStableAcrossRoots =
    JSON.stringify(expertBeforeColdRoot) === JSON.stringify(out.expertAfterColdRoot)
  out.rootDisposedGone = ctx.agents.get(SessionId('i2root')) === undefined

  return out
})()

// ===========================================================================
// ASSERTIONS (synchronous `it` bodies — the shim constraint).
// ===========================================================================

describe('I2-P1 real-seam preset restriction (plan §10.2 fixture leg)', () => {
  it('S1: the expert (deny []) sees the preset tools after the real mount', () => {
    const surface = W['expertSurface'] as string[]
    expect(surface.includes('fixture-shell')).toBe(true)
    expect(surface.includes('fixture-base')).toBe(true)
  })

  it('S1: the researcher (deny [fixture-shell]) does NOT see fixture-shell', () => {
    const surface = W['researcherSurface'] as string[]
    expect(surface.includes('fixture-shell')).toBe(false)
  })

  it('S1: the deny is EXACT — researcher surface = expert surface minus exactly {fixture-shell}', () => {
    const expert = new Set(W['expertSurface'] as string[])
    const researcher = new Set(W['researcherSurface'] as string[])
    const symmetric = [...expert].filter((t) => !researcher.has(t))
      .concat([...researcher].filter((t) => !expert.has(t)))
    expect(symmetric.sort()).toEqual(['fixture-shell'])
  })

  it('S1: the fixture-base tool survives the deny (the mask is not a composition loss)', () => {
    expect((W['researcherSurface'] as string[]).includes('fixture-base')).toBe(true)
  })

  it('S1: the real mount reports its preset (the composedPreset contract)', () => {
    expect((W['expertOutcome'] as GlueOutcome).composed).toBe('i2-standard')
    expect((W['researcherOutcome'] as GlueOutcome).composed).toBe('i2-standard')
    expect((W['expertOutcome'] as GlueOutcome).mountSkipped).toBe(false)
    expect((W['researcherOutcome'] as GlueOutcome).mountSkipped).toBe(false)
  })

  it('S2: an unrestrictable deny name FAILS CLOSED — the agent creation rejects and rolls back (plan §11)', () => {
    const message = W['s2Message'] as string | null
    expect(typeof message).toBe('string')
    expect(message !== null && message.includes('no-such-tool')).toBe(true)
    expect(W['s2RolledBack']).toBe(true)
  })

  it('S3: the restriction is agent-scoped — the sibling (deny []) on the same preset is untouched', () => {
    expect((W['siblingSurface'] as string[]).includes('fixture-shell')).toBe(true)
    expect((W['siblingSurface'] as string[]).includes('fixture-base')).toBe(true)
  })

  it('S4: a cold resume rebuilds the restriction (fresh session, same preset + deny)', () => {
    const cold = W['researcherColdSurface'] as string[]
    expect(cold.includes('fixture-shell')).toBe(false)
    expect(cold.includes('fixture-base')).toBe(true)
    expect(W['siblingStable']).toBe(true)
    expect(W['disposedGone']).toBe(true)
  })

  it('S5: an already-joined agent keeps its composition (the guard skips the second mount) and the deny still applies to the inherited preset tools (plan §12.1/§12.3)', () => {
    const adopted = W['adopted'] as Record<string, unknown>
    const outcome = adopted['outcome'] as GlueOutcome
    expect(outcome.mountSkipped).toBe(true)
    expect(outcome.composed).toBe('i2-standard')
    const surface = adopted['surface'] as string[]
    expect(surface.includes('fixture-shell')).toBe(false)
    expect(surface.includes('fixture-base')).toBe(true)
  })

  it('S6: a second explicit mount on an already-joined context rejects (the guard\'s documented rationale; the throwaway agent rolls back)', () => {
    const message = W['s6Message'] as string | null
    expect(typeof message).toBe('string')
    expect(W['s6RolledBack']).toBe(true)
  })

  it('S7: direct dispatch of the denied tool fails on the researcher (registry-level mask) and executes on the expert (scoped, not global)', () => {
    expect(W['s7DeniedIsError']).toBe(true)
    expect(W['s7AllowedIsError']).toBe(false)
    expect(W['s7AllowedText']).toBe('fixture-shell-ok')
  })

  it('S8: a FRESH ROOT on its own preset id (the glue rootPresetId) gets the preset composition first and its OWN deny active (fixture-base hidden, fixture-shell visible — per-role denies are independent, plan §14)', () => {
    const root = W['rootSurface'] as string[]
    expect(root.includes('fixture-base')).toBe(false)
    expect(root.includes('fixture-shell')).toBe(true)
    expect((W['rootOutcome'] as GlueOutcome).composed).toBe('i2-standard')
    expect((W['rootOutcome'] as GlueOutcome).mountSkipped).toBe(false)
  })

  it('S9: a COLD ROOT rebuilds its restriction on a fresh session (restriction rebuilt, no stale state; the expert is untouched across the root lifecycle, plan §14)', () => {
    const cold = W['rootColdSurface'] as string[]
    expect(cold.includes('fixture-base')).toBe(false)
    expect(cold.includes('fixture-shell')).toBe(true)
    expect(W['expertStableAcrossRoots']).toBe(true)
    expect(W['rootDisposedGone']).toBe(true)
  })
})
