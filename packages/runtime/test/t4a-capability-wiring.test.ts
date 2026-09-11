/**
 * t4a-capability-wiring.test.ts — alpha.1 T4: the PRODUCTION capability
 * wiring on the REAL live glue (agent-bindings.mjs over the t12a-live-bridge
 * doubles). This is the "different teammates get different capabilities"
 * acceptance for the 0.1.1-alpha.1 minimal capability wiring plan.
 *
 * What the plan wires (and this file pins at the REAL glue boundary):
 *
 *   1. TEAM TOOLS (T2 selector): a template's `capabilities.teamTools`
 *      entry selects the catalog sub-set for that member's agent ctx
 *      (allow = name membership, catalog order, dedup; deny = zero).
 *   2. BUILT-IN TOOL DENY (T2 adapter): a template's `capabilities.
 *      builtinToolDeny` is applied through the Agent-scoped public
 *      `tools.restrict({ deny })` seam ONLY (sibling-inert; empty = no-op).
 *   3. TEAM SKILLS (T3 adapter): a template's `capabilities.skills` entry
 *      registers the catalog skill definitions in Agent scope (allow =
 *      catalog lookup; deny = none).
 *   4. TEAM MCP (T3 filter): a template's `capabilities.mcp` entry ADDS to
 *      the durable MCP decision — the configured server mounts only when
 *      the durable policy allows AND the template's mcp entry admits it.
 *
 * The three facets are asserted for THREE distinct identities (the leader
 * + two members, each with a different capability declaration), so a single
 * shared/wired capability would fail:
 *
 *   - LEADER (root session): teamTools allow [team_send_message,
 *     team_list_members]; builtinToolDeny [bash]; skills allow
 *     [leader-skill]; mcp allow [the configured server] -> MCP MOUNTS
 *     (the durable human-override allows it too).
 *   - MEMBER A: teamTools allow [team_delegate]; builtinToolDeny [write];
 *     skills allow [a-skill]; mcp deny -> NO MCP mount (the template denies
 *     it even though the durable override allows).
 *   - MEMBER B: teamTools deny (zero team tools); builtinToolDeny [] (no-op);
 *     skills deny (no skills); mcp allow [a DIFFERENT, unconfigured server]
 *     -> NO MCP mount (the template allows a server that is not configured).
 *
 * Durability (plan §10.9 — survives create / cold resume / dispose):
 *   - the CREATE phase (the production boot create: the seed MemberInstance
 *     rows are committed before the glue boots) resolves a member's
 *     capabilities through its DURABLE row (childSessionId -> templateId);
 *   - the COLD-RESUME phase (a host restart) RE-READS the same durable rows
 *     and re-derives the SAME capabilities (the backend truth is never a
 *     caller claim; the fresh-create templateId hint is the crash-window
 *     fallback when a row is not yet committed);
 *   - close() disposes every registration (tools, skills, the MCP fiber).
 *
 * Legacy regression (plan §10.3 — the legacy Blueprint does not regress):
 *   - a world whose blueprint has NO `capabilities` (the bridge default)
 *     keeps the 0.1.0-rc.1 behavior EXACTLY: the leader receives the full
 *     eleven-tool catalog, no built-in deny, no Team skills, and the MCP mount
 *     follows the durable decision alone (the human-override allow -> mount).
 *
 * Sibling isolation: every agent ctx is a separate scope; one member's
 * builtinToolDeny never leaks to a sibling (asserted per-ctx).
 *
 * The DSH core side (an agent-scoped tools.register / restrict / skill
 * registration flows into that agent's model-visible assembly) is upstream
 * behavior; this file pins the plugin-side half: the glue composes the
 * static template declaration into the right per-agent wiring on both boot
 * phases and disposes it.
 */
import { describe, expect, it } from 'vitest'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
  type AgentCtxDouble,
} from './t12a-live-bridge.mjs'
import { destroyP6T1World } from './p6t1-helpers.js'
import { createP6T6World } from '../../tools/test/p6t6-helpers.js'

// ── the frozen eleven-tool team vocabulary (guards the catalog input) ─────────
const EXPECTED_TOOL_NAMES = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_collect',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
]

const ROOT = 'session-t4a-root'
const CHILD_A = 'session-t4a-child-a'
const CHILD_B = 'session-t4a-child-b'
const INST_A = 'inst-t4aa'
const INST_B = 'inst-t4ab'
const SERVER = 't12a-mini-mcp' // the bridge's default configured mcpServer.name

// ── the fixture blueprint (leader + tpl-a + tpl-b, all selective) ──────────
// Each template declares all four capability sub-fields (the closed-v1
// schema requires all four when `capabilities` is present). The three
// templates declare DIFFERENT capabilities so a single shared wiring fails.
const CAPABILITY_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.t4a',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the t4a test team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_send_message',
  '        - team_list_members',
  '    builtinToolDeny:',
  '      - bash',
  '    skills:',
  '      kind: allow',
  '      items:',
  '        - leader-skill',
  '    mcp:',
  '      kind: allow',
  '      items:',
  `        - ${SERVER}`,
  'members:',
  '  - templateId: tpl-a',
  '    persona: "You are member A of the t4a test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_delegate',
  '      builtinToolDeny:',
  '        - write',
  '      skills:',
  '        kind: allow',
  '        items:',
  '          - a-skill',
  '      mcp:',
  '        kind: deny',
  '  - templateId: tpl-b',
  '    persona: "You are member B of the t4a test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: deny',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: deny',
  '      mcp:',
  '        kind: allow',
  '        items:',
  '          - some-other-server',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// The durable MemberInstance rows (the backend truth the cold-resume path
// re-reads; each row's templateId names the bound-blueprint template).
const memberRowA = { childSessionId: CHILD_A, instanceId: INST_A, templateId: 'tpl-a' }
const memberRowB = { childSessionId: CHILD_B, instanceId: INST_B, templateId: 'tpl-b' }

// The durable governance override that ALLOWs the configured MCP server
// (team scope, human authority): without it the durable decision is
// fail-closed `unspecified` and even the leader's mcp-allow template entry
// would not mount. With it, the durable side allows and the TEMPLATE's mcp
// entry is what differentiates the three identities.
const mcpAllow: GovernanceOverrideRecord = parseGovernanceOverride({
  schemaVersion: 1,
  kind: 'human-override',
  recordId: 't4a-mcp-allow',
  scope: 'team',
  rootSessionId: ROOT,
  values: { mcp: { kind: 'allow', items: [SERVER] } },
  generation: 1,
  updatedAt: '2026-08-31T00:00:00.000Z',
})

// The row's TeamSkillCatalog input (the narrowest production point: the row
// config's teamSkills list). Both templates' skills entries name skills that
// are in this catalog; member B's template denies skills entirely.
const teamSkills = [
  { name: 'leader-skill', description: 'Leader skill', content: 'Leader skill content' },
  { name: 'a-skill', description: 'Member A skill', content: 'Member A skill content' },
]

// ── the REAL eleven-tool stack (the same factory the production root fills ────
// teamToolsRef.current with) — shared by every world of this file.
const p6t6 = await createP6T6World('t4a-capability-wiring')

// ── assertion helpers (the ctx doubles are separate scopes per agent) ──────
function toolNames(ctx: AgentCtxDouble): string[] {
  return ctx.registeredTools.map((def) => String((def as { name?: string }).name ?? ''))
}
function denyLists(ctx: AgentCtxDouble): string[][] {
  return ctx.toolRestrictions.map((r) => [...r.deny])
}
function skillNames(ctx: AgentCtxDouble): string[] {
  return ctx.registeredSkills.map((entry) => String((entry.def as { name?: string }).name ?? ''))
}
function skillSources(ctx: AgentCtxDouble): (string | undefined)[] {
  return ctx.registeredSkills.map((entry) => {
    const s = (entry.def as { source?: unknown }).source
    return typeof s === 'string' ? s : undefined
  })
}
function skillsAllDisposed(ctx: AgentCtxDouble): boolean {
  return ctx.registeredSkills.every((entry) => entry.disposed === true)
}
/** The number of recorded plugin fibers that mount the configured MCP server. */
function mcpMounts(ctx: AgentCtxDouble): number {
  return ctx.plugins.filter(
    (fiber) =>
      fiber !== null &&
      typeof fiber === 'object' &&
      (fiber as { options?: { serverName?: unknown } }).options?.serverName === SERVER,
  ).length
}
function mcpAllDisposed(ctx: AgentCtxDouble): boolean {
  return ctx.plugins.every(
    (fiber) =>
      fiber === null || typeof fiber !== 'object' || (fiber as { disposed?: boolean }).disposed === true,
  )
}

/**
 * Build one capability world. `create` seeds members via config.seedMembers
 * (the fresh-create window: no durable rows, capabilities resolve through
 * the templateId hint). `resume` drives the members from the durable
 * MemberInstance rows (the cold-resume path: capabilities re-derived from
 * the backend truth). Both use the same blueprint / override / catalog.
 */
async function buildCapabilityWorld(bootPhase: 'create' | 'resume') {
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    teamTools: { tools: p6t6.tools },
    agentPresets: createAgentPresetsDouble(),
    // The durable rows are present for BOTH phases (the production create
    // flow commits them before the glue boots; the resume flow re-reads
    // them). The CREATE phase's member capabilities still resolve through
    // the durable row (childSessionId match) — identical to the hint path's
    // value; the hint path is exercised by the fresh-create window when no
    // row exists (see the note below the assertions).
    members: [memberRowA, memberRowB],
    overrides: [mcpAllow],
    configOverrides: {
      bootPhase,
      blueprintSource: CAPABILITY_BLUEPRINT,
      teamSkills,
      // The create phase seeds the two members (the leader IS the root).
      seedMembers:
        bootPhase === 'create'
          ? [
              { instanceId: INST_A, templateId: 'tpl-a', label: 'Member A', childSessionId: CHILD_A },
              { instanceId: INST_B, templateId: 'tpl-b', label: 'Member B', childSessionId: CHILD_B },
            ]
          : [],
    },
  })
  if (bootPhase === 'resume') {
    // The cold-resume restart: every bound session is durable on disk under
    // the fake DSH_HOME (the glue's sessionIsDurable gate sees them).
    const home = `${WORKTREE_ROOT}/.tmp-t4a-resume-home`
    await withDshHome(home, async () => {
      writeDurableFixture(home, ROOT)
      writeDurableFixture(home, CHILD_A)
      writeDurableFixture(home, CHILD_B)
      await world.binding.boot()
    })
    removeFixtureHome(home)
  } else {
    await world.binding.boot()
  }
  return world
}

// ── world 1: the CREATE phase (fresh-create window) ────────────────────────
const worldCreate = await buildCapabilityWorld('create')
const createLeader = worldCreate.agents.handles.get(ROOT)!.agent.ctx
const createA = worldCreate.agents.handles.get(CHILD_A)!.agent.ctx
const createB = worldCreate.agents.handles.get(CHILD_B)!.agent.ctx

// Snapshot the create-phase state (before close disposes the registrations).
const cLeaderTools = toolNames(createLeader)
const cLeaderDeny = denyLists(createLeader)
const cLeaderSkills = skillNames(createLeader)
const cLeaderMcp = mcpMounts(createLeader)
const cATools = toolNames(createA)
const cADeny = denyLists(createA)
const cASkills = skillNames(createA)
const cAMcp = mcpMounts(createA)
const cBTools = toolNames(createB)
const cBDeny = denyLists(createB)
const cBSkills = skillNames(createB)
const cBMcp = mcpMounts(createB)

// ── world 2: the COLD-RESUME phase (restart re-derives from durable rows) ──
const worldResume = await buildCapabilityWorld('resume')
const resumeLeader = worldResume.agents.handles.get(ROOT)!.agent.ctx
const resumeA = worldResume.agents.handles.get(CHILD_A)!.agent.ctx
const resumeB = worldResume.agents.handles.get(CHILD_B)!.agent.ctx
const rLeaderTools = toolNames(resumeLeader)
const rLeaderDeny = denyLists(resumeLeader)
const rLeaderSkills = skillNames(resumeLeader)
const rLeaderMcp = mcpMounts(resumeLeader)
const rATools = toolNames(resumeA)
const rADeny = denyLists(resumeA)
const rASkills = skillNames(resumeA)
const rAMcp = mcpMounts(resumeA)
const rBTools = toolNames(resumeB)
const rBDeny = denyLists(resumeB)
const rBSkills = skillNames(resumeB)
const rBMcp = mcpMounts(resumeB)

// ── world 3: the LEGACY regression (the bridge default blueprint — NO ─────
// `capabilities` field on any template -> legacy mode: the 0.1.0-rc.1
// behavior, the full eleven-tool catalog, no deny, no skills, MCP = durable).
const LEGACY_ROOT = 'session-t4a-legacy-root'
// A legacy-rooted durable mcp allow (so the durable decision is genuinely
// allow for the legacy root — the durable facet is resolved under the boot
// root, LEGACY_ROOT, so the override must be rooted there).
const legacyMcpAllow: GovernanceOverrideRecord = parseGovernanceOverride({
  schemaVersion: 1,
  kind: 'human-override',
  recordId: 't4a-legacy-mcp-allow',
  scope: 'team',
  rootSessionId: LEGACY_ROOT,
  values: { mcp: { kind: 'allow', items: [SERVER] } },
  generation: 1,
  updatedAt: '2026-08-31T00:00:00.000Z',
})
const worldLegacy = await createLiveWorld({
  rootSessionId: LEGACY_ROOT,
  teamTools: { tools: p6t6.tools },
  overrides: [legacyMcpAllow],
  // The bridge default blueprintSource (NO capabilities) -> legacy mode.
  configOverrides: { seedMembers: [] },
})
await worldLegacy.binding.boot()
const legacyRoot = worldLegacy.agents.handles.get(LEGACY_ROOT)!.agent.ctx
const legacyTools = toolNames(legacyRoot)
const legacyDeny = denyLists(legacyRoot)
const legacySkills = skillNames(legacyRoot)
const legacyMcp = mcpMounts(legacyRoot)

// ── close the capability worlds (the dispose path) + cleanup ───────────────
await worldCreate.binding.close()
await worldResume.binding.close()
await worldLegacy.binding.close()
const closedLeaderTools = toolNames(createLeader)
const closedLeaderSkillsDisposed = skillsAllDisposed(createLeader)
const closedLeaderMcpDisposed = mcpAllDisposed(createLeader)
const closedATools = toolNames(createA)
const closedAMcpDisposed = mcpAllDisposed(createA)
await destroyP6T1World(p6t6.world)

describe('alpha.1 T4 — the production capability wiring on the REAL live glue', () => {
  describe('the create phase (fresh-create window) wires each identity distinctly', () => {
    it('leader: the teamTools allow-selects the catalog sub-set (catalog order)', () => {
      // allow [team_send_message, team_list_members] -> catalog order:
      // team_list_members (idx 0) before team_send_message (idx 6).
      expect(cLeaderTools).toEqual(['team_list_members', 'team_send_message'])
    })
    it('leader: builtinToolDeny [bash] is applied through tools.restrict (one call)', () => {
      expect(cLeaderDeny).toEqual([['bash']])
    })
    it('leader: skills allow [leader-skill] registers the catalog skill', () => {
      expect(cLeaderSkills).toEqual(['leader-skill'])
    })
    it('leader: mcp allow [configured server] + durable allow -> the MCP MOUNTS', () => {
      expect(cLeaderMcp).toBe(1)
    })

    it('member A: the teamTools allow-selects [team_delegate] (a different sub-set)', () => {
      expect(cATools).toEqual(['team_delegate'])
    })
    it('member A: builtinToolDeny [write] is applied (sibling-inert: NOT bash)', () => {
      expect(cADeny).toEqual([['write']])
    })
    it('member A: skills allow [a-skill] registers the catalog skill', () => {
      expect(cASkills).toEqual(['a-skill'])
    })
    it('member A: mcp deny -> NO MCP mount (the durable override allows, the template wins)', () => {
      expect(cAMcp).toBe(0)
    })

    it('member B: teamTools deny -> ZERO team tools', () => {
      expect(cBTools).toEqual([])
    })
    it('member B: builtinToolDeny [] -> no tools.restrict call (the no-op path)', () => {
      expect(cBDeny).toEqual([])
    })
    it('member B: skills deny -> no skills registered', () => {
      expect(cBSkills).toEqual([])
    })
    it('member B: mcp allow [unconfigured server] -> NO MCP mount (configured ∩ allow = ∅)', () => {
      expect(cBMcp).toBe(0)
    })

    it('sibling isolation: no identity sees another identity builtin deny', () => {
      // The leader denies bash; members A/B never see it. Member A denies
      // write; the leader and member B never see it. Member B denies nothing.
      const aFlat = cADeny.flat()
      const bFlat = cBDeny.flat()
      const leaderFlat = cLeaderDeny.flat()
      expect(aFlat.includes('bash')).toBe(false)
      expect(bFlat.includes('bash')).toBe(false)
      expect(bFlat.includes('write')).toBe(false)
      expect(leaderFlat.includes('write')).toBe(false)
    })

    it('all three agents were created, each with the shared setup', () => {
      expect(worldCreate.records.creates.length).toBe(3)
      expect(worldCreate.records.creates.every((c) => c.setupProvided)).toBe(true)
    })
  })

  describe('the cold-resume phase re-derives the SAME capabilities from the durable rows', () => {
    it('leader: the same team tools, the same builtin deny, the same skill, the MCP still mounts', () => {
      expect(rLeaderTools).toEqual(['team_list_members', 'team_send_message'])
      expect(rLeaderDeny).toEqual([['bash']])
      expect(rLeaderSkills).toEqual(['leader-skill'])
      expect(rLeaderMcp).toBe(1)
    })
    it('member A: the same distinct sub-set (team_delegate / write / a-skill / no mcp)', () => {
      expect(rATools).toEqual(['team_delegate'])
      expect(rADeny).toEqual([['write']])
      expect(rASkills).toEqual(['a-skill'])
      expect(rAMcp).toBe(0)
    })
    it('member B: the same zero-tools / no-deny / no-skill / no-mcp wiring', () => {
      expect(rBTools).toEqual([])
      expect(rBDeny).toEqual([])
      expect(rBSkills).toEqual([])
      expect(rBMcp).toBe(0)
    })
    it('the restart RESUMED every bound session (never re-created them)', () => {
      expect(worldResume.records.creates.length).toBe(0)
      expect(worldResume.records.resumes.length).toBe(3) // root + member A + member B
      expect(worldResume.records.resumes.every((r) => r.setupProvided)).toBe(true)
    })
  })

  describe('the legacy Blueprint (no `capabilities`) does not regress (0.1.0-rc.1 behavior)', () => {
    it('the leader receives the FULL eleven-tool catalog (no selection)', () => {
      expect(legacyTools).toEqual(EXPECTED_TOOL_NAMES)
    })
    it('no builtin tool deny (legacy: the restrict seam is never called)', () => {
      expect(legacyDeny).toEqual([])
    })
    it('no Team-managed skills (legacy: the skill seam is never called)', () => {
      expect(legacySkills).toEqual([])
    })
    it('the MCP mount follows the durable decision alone (the human-override allow -> mount)', () => {
      expect(legacyMcp).toBe(1)
    })
  })

  describe('close() disposes every capability registration (the dispose path)', () => {
    it('the leader tools are unregistered and its skills + MCP are disposed', () => {
      expect(closedLeaderTools).toEqual([])
      expect(closedLeaderSkillsDisposed).toBe(true)
      expect(closedLeaderMcpDisposed).toBe(true)
    })
    it('member A tools are unregistered and its MCP scope is disposed', () => {
      expect(closedATools).toEqual([])
      expect(closedAMcpDisposed).toBe(true)
    })
  })

  describe('alpha.1 hardening — P0-3 (setup ordering) + P0-1 (fail-closed)', () => {
    it('P0-3 F3: the builtin deny (restrict) is applied BEFORE the team tool registrations (register)', () => {
      // The leader declares builtinToolDeny [bash] + teamTools allow
      // [team_send_message, team_list_members]. The frozen ordering:
      // builtin deny (restrict) BEFORE the team tool registrations (register)
      // — the deny masks the preset-inherited base tools while the team tools
      // (registered in the agent's own scope) remain visible.
      const ops = createLeader.opLog
      const restrictIdx = ops.findIndex((e) => e.op === 'restrict')
      const registerIdx = ops.findIndex((e) => e.op === 'register')
      // (plain-node shim matcher surface: toBe/toEqual/toBeGreaterThan/toThrow.)
      expect(restrictIdx >= 0).toBe(true)
      expect(registerIdx >= 0).toBe(true)
      expect(restrictIdx < registerIdx).toBe(true)
    })
    it('P0-3 F1: member A denies [write] (a base tool) while its team tool [team_delegate] stays registered', () => {
      // Member A's builtinToolDeny is [write] (a base/preset tool, NOT a team
      // tool). The team tool [team_delegate] is registered in A's own scope
      // (visible, not masked by the deny). The opLog: restrict(write) BEFORE
      // register(team_delegate).
      const ops = createA.opLog
      const restrictIdx = ops.findIndex((e) => e.op === 'restrict')
      const registerIdx = ops.findIndex((e) => e.op === 'register')
      expect(restrictIdx >= 0).toBe(true)
      expect(registerIdx >= 0).toBe(true)
      expect(restrictIdx < registerIdx).toBe(true)
      // The deny is [write] (a base tool), NOT the team tool.
      expect(cADeny).toEqual([['write']])
      // The team tool [team_delegate] is registered (the deny did not mask it).
      expect(cATools).toEqual(['team_delegate'])
    })
  })

  describe('alpha.1 hardening — P2.3 (skill registration load-time completeness)', () => {
    it('P2.3 F1: the registered team skill definitions carry the source string the registry load-time validation requires', () => {
      // The registry's validateDefinition (get()) throws "loaded skill X
      // source must be a string" for a runtime registration without `source`
      // (register() defaults invocation + provider but not source). The live
      // closure smoke hit exactly this: the skill registered in the member
      // scope but was unloadable through the model-facing `skill` tool. The
      // adapter defaults the source bucket to 'runtime' for row-config team
      // skills (a catalog-provided source wins).
      expect(skillSources(createA)).toEqual(['runtime'])
      expect(skillSources(createLeader)).toEqual(['runtime'])
      // Member B denies skills: nothing registered, no source to carry.
      expect(skillSources(createB)).toEqual([])
    })
  })
})
