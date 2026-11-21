#!/usr/bin/env node
/**
 * ute-p0-assets.mjs — the P0 asset ledger and its gate.
 *
 * WHY THIS EXISTS. The P0 inventory's failure mode is not being wrong on day
 * one; it is going stale on day three. A hand-written list of "the old
 * execution system" that nobody re-derives becomes a document that says a file
 * is deletable after somebody has already deleted it, or misses a file that a
 * later PR added to the same directory. So the ledger is GENERATED from git and
 * GRADED against git, and the prose inventory is generated from the ledger.
 *
 * The unit is the WHOLE MODULE (owner ruling, 2026-11-21: whole-module delete or
 * whole-module keep, never "fix the old thing first"). A module is a directory
 * or a single file; its file list is every tracked file under it.
 *
 * Buckets (see docs/plans/memo/ute-p0-20261121/02-SERVING-CENSUS.md):
 *   A — the capability is already served by the retained path and this module
 *       carries no governance of its own: deleting it changes no observable
 *       behaviour and needs no paired work.
 *   B — the capability is served by the retained path but this module is the
 *       only enforcement TODAY: it may only be deleted in the same PR that
 *       binds the provider lane (`deleteWith`), never alone.
 *   C — at least one booked name has no retained counterpart, so the module is
 *       not deletable at all until that name has a home (used only while such a
 *       name is genuinely unresolved).
 *   D — the same situation, but the owner has RULED: the name gets a home in the
 *       same PR or is dropped. A D module is therefore deletable in wave 1,
 *       paired with that ruling, and never kept for its own sake.
 *   KEEP — a module the new architecture builds ON (admission, guard, deny,
 *       selector, provider binding), not a route to retire.
 *
 * Usage:
 *   node scripts/ute-p0-assets.mjs --check   # gate: ledger vs tree vs prose
 *   node scripts/ute-p0-assets.mjs --write   # regenerate ledger + prose table
 *   node scripts/ute-p0-assets.mjs --json    # machine-readable ledger
 *
 * Exit: 0 pass, 1 findings, 2 usage.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const LEDGER_PATH = 'dev/agent-workflow/ledgers/ute-p0-assets.json'
const INVENTORY_PATH = 'docs/plans/memo/ute-p0-20261121/01-ASSET-INVENTORY.md'

const SCHEMA = 'ute-p0-assets/1'
const BUCKETS = new Set(['A', 'B', 'C', 'D', 'KEEP'])
const VERDICTS = new Set(['delete', 'keep', 'replace'])
const KINDS = new Set(['old-execution', 'central', 'shared', 'dormant'])

/**
 * THE MODULE SET. `roots` are repo-relative paths (directory or file); the
 * file list is derived from git, never typed. Order is the retirement order.
 */
export const MODULES = Object.freeze([
  {
    id: 'family-fs',
    title: 'FS governed family body — four executors over ONE controlled root',
    kind: 'old-execution',
    roots: ['packages/tools/fs-family'],
    names: ['read', 'write', 'edit', 'read_image'],
    hostCounterpart: ['tool-fs: read, write, edit, read_image (+apply_patch)'],
    providerFaces: ['ctx.fs'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the fs provider lane on the Member realm (promoted from packages/tools/src/native-fs-binding.ts)'],
    note: 'The four rows are ONE candidate: a partial mount is refused as PLANE_FS_FAMILY_INCOMPLETE. This body is the only write containment today, so it may not go before the lane is bound — and the lane is this same decision moved in front of the host provider.',
  },
  {
    id: 'family-search',
    title: 'Search governed family body — grep/glob executor + presentation',
    kind: 'old-execution',
    roots: ['packages/tools/search-family'],
    names: ['grep', 'glob'],
    hostCounterpart: ['tool-fs-search: grep, glob'],
    providerFaces: ['ctx.fs', 'ctx.subprocess', 'ctx.shell'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the search faces (ctx.fs + ctx.subprocess) on the Member realm'],
    note: 'SD-SEARCH-1 (a path-less grep returns zero hits) is a defect of THIS body, not a semantic difference to sign: deleting the body deletes the defect, and the host row never had it.',
  },
  {
    id: 'family-web',
    title: 'Web governed family body — fetch/search + redirect ownership',
    kind: 'old-execution',
    roots: ['packages/tools/web-family'],
    names: ['web_fetch', 'web_search'],
    hostCounterpart: ['tool-web: web_fetch, web_search'],
    providerFaces: ['ctx.web'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the ctx.web lane on the Member realm'],
    note: 'Network ownership lives in this body today; the host rows already call ctx.web, so the ownership moves to the provider, never to a second definition.',
  },
  {
    id: 'family-process',
    title: 'Process governed family body — bash, plus a pwsh the shipped wiring never routes',
    kind: 'old-execution',
    roots: ['packages/tools/process-family'],
    names: ['bash', 'pwsh'],
    hostCounterpart: ['tool-bash: bash', 'tool-pwsh: pwsh', 'tool-bash-persistent: bash over ctx.terminals'],
    providerFaces: ['ctx.shell', 'ctx.terminals'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the ctx.shell and ctx.terminals lanes on the Member realm (the terminal lane pins the OS boundary at creation)'],
    note: 'The preset removes the pwsh row and no route registers it, so this body never had a two-member unit; the ledger records the unit as 1 of 2 rather than shrinking it quietly.',
  },
  {
    id: 'family-ui',
    title: 'UI governed family body — ask_user_question + present',
    kind: 'old-execution',
    roots: ['packages/tools/ui-family'],
    names: ['ask_user_question', 'present'],
    hostCounterpart: ['interaction/tool-ask-user: ask_user_question', 'deliverables/tool-present: present'],
    providerFaces: ['ctx.userQuestions', 'ctx.fs', 'ctx.agents'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the userQuestions passthrough and the present receipt face on the Member realm'],
    note: 'PD-25 removes tool-ask-user from the shipping preset while the host row still exists; this body is a second declarant of both names.',
  },
  {
    id: 'family-inspect',
    title: 'Inspect governed family body — team_skill + the two team_cordis_inspect rows',
    kind: 'old-execution',
    roots: ['packages/tools/inspect-family'],
    names: ['team_skill', 'team_cordis_inspect_list', 'team_cordis_inspect_query'],
    hostCounterpart: ['extensions/tool-cordis: cordis_inspect_list, cordis_inspect_query — DIFFERENT spellings, no team_ prefix'],
    providerFaces: ['ctx.cordisInspect'],
    bucket: 'D',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['a Team skill provider served into a host-shaped row (team_skill)', 'the cordis rows re-pointed at the host spellings, which is a model-visible rename and therefore an explicit owner decision'],
    note: 'Owner ruling 2026-11-21: team_skill gets a home instead of being kept for its own sake; the two cordis rows are served already and only the spelling is ours.',
  },
  {
    id: 'family-agent-control',
    title: 'Agent-control governed family body — the seven subagent/orchestration rows',
    kind: 'old-execution',
    roots: ['packages/tools/agent-control-family'],
    names: ['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow'],
    hostCounterpart: ['subagent/tool-subagent: subagent', 'subagent/tool-subagent-control: send_message, interrupt_agent, list_agents, list_subagent_models (+wait_agent)', 'workflow/tool-workflow: workflow'],
    providerFaces: ['ctx.subagents', 'ctx.sessions', 'ctx.workflowEngine'],
    bucket: 'D',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['subagent_fork exposed as a row over the host subagent-fork-in-process provider, or dropped by ruling'],
    note: 'Six of seven names are served by the host; subagent_fork exists only as a provider. Owner ruling 2026-11-21: give it a row, do not keep the body to preserve it.',
  },
  {
    id: 'family-agent-state',
    title: 'Agent-state governed family body — todo_write + the four goal rows',
    kind: 'old-execution',
    roots: ['packages/tools/agent-state-family'],
    names: ['todo_write', 'get_goal', 'create_goal', 'update_goal', 'exit_plan_mode'],
    hostCounterpart: ['todo/tool-todo: todo_write', 'goal/tool-goal: get_goal, create_goal, update_goal'],
    providerFaces: ['ctx.sessionProjections', 'ctx.goals'],
    bucket: 'D',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['exit_plan_mode dropped: the host has only a claude-code-mods name mapping, never a native tool'],
    note: 'Four of five names are served. Owner ruling 2026-11-21: plan mode is not a Team capability, so the one unserved name is dropped rather than given a body.',
  },
  {
    id: 'row-fs',
    title: 'FamilyAssembly row — dsh.fs-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/fs.mjs'],
    names: ['read', 'write', 'edit', 'read_image'],
    hostCounterpart: ['tool-fs'],
    providerFaces: ['ctx.fs'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-fs (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-search',
    title: 'FamilyAssembly row — dsh.search-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/search.mjs'],
    names: ['grep', 'glob'],
    hostCounterpart: ['tool-fs-search'],
    providerFaces: ['ctx.fs', 'ctx.subprocess'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-search (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-web',
    title: 'FamilyAssembly row — dsh.web-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/web.mjs'],
    names: ['web_fetch', 'web_search'],
    hostCounterpart: ['tool-web'],
    providerFaces: ['ctx.web'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-web (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-process',
    title: 'FamilyAssembly row — dsh.process-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/process.mjs'],
    names: ['bash', 'pwsh'],
    hostCounterpart: ['tool-bash', 'tool-pwsh'],
    providerFaces: ['ctx.shell'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-process (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-ui',
    title: 'FamilyAssembly row — dsh.ui-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/ui.mjs'],
    names: ['ask_user_question', 'present'],
    hostCounterpart: ['interaction/tool-ask-user', 'deliverables/tool-present'],
    providerFaces: ['ctx.userQuestions', 'ctx.fs', 'ctx.agents'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-ui (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-inspect',
    title: 'FamilyAssembly row — dsh.inspect-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/inspect.mjs'],
    names: ['team_skill', 'team_cordis_inspect_list', 'team_cordis_inspect_query'],
    hostCounterpart: ['new Team skill provider row'],
    providerFaces: ['ctx.cordisInspect'],
    bucket: 'D',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-inspect (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-agent-control',
    title: 'FamilyAssembly row — dsh.agent-control-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/agent-control.mjs'],
    names: ['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow'],
    hostCounterpart: ['host subagent/agent-control/workflow rows'],
    providerFaces: ['ctx.subagents'],
    bucket: 'D',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-agent-control (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'row-agent-state',
    title: 'FamilyAssembly row — dsh.agent-state-family',
    kind: 'old-execution',
    roots: ['packages/tools/families/agent-state.mjs'],
    names: ['todo_write', 'get_goal', 'create_goal', 'update_goal', 'exit_plan_mode'],
    hostCounterpart: ['host todo/goal rows'],
    providerFaces: ['ctx.sessionProjections', 'ctx.goals'],
    bucket: 'D',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['family-agent-state (the row and the body are one unit)'],
    note: 'The row is the descriptor the plane drives; deleting the body without the row leaves a dangling import.',
  },
  {
    id: 'rows-barrel',
    title: 'Generated family barrel — index.mjs, index.d.mts, manifest.json',
    kind: 'old-execution',
    roots: ['packages/tools/families/index.mjs', 'packages/tools/families/index.d.mts', 'packages/tools/families/manifest.json'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the last row (the barrel is generated from whatever rows exist)'],
    note: 'Generated by node scripts/gen-family-index.mjs from the rows; when the last row goes the generator has nothing to emit and the barrel goes with it.',
  },
  {
    id: 'shadow-fs',
    title: 'Confined FS shadow — re-declares read/write/edit/read_image over a confined fs face',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/confined-fs-tool.mjs'],
    names: ['read', 'write', 'edit', 'read_image'],
    hostCounterpart: ['tool-fs (the same rows, on the preset scope)'],
    providerFaces: ['ctx.fs'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the fs provider lane (the shadow exists BECAUSE the preset scope resolves the inherited, unconfined fs service)'],
    note: 'The shadow was the right diagnosis and the wrong mechanism: it answers "the preset row resolves the wrong fs" by declaring the name a second time. The target answers it by making the Member realm the place ctx.fs resolves.',
  },
  {
    id: 'shadow-search',
    title: 'Confined search shadow — re-declares grep/glob',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/confined-search-tool.mjs'],
    names: ['grep', 'glob'],
    hostCounterpart: ['tool-fs-search'],
    providerFaces: ['ctx.fs', 'ctx.subprocess'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the search faces on the Member realm'],
    note: 'The shadow was the right diagnosis and the wrong mechanism: it answers "the preset row resolves the wrong fs" by declaring the name a second time. The target answers it by making the Member realm the place ctx.fs resolves.',
  },
  {
    id: 'shadow-web',
    title: 'Confined web shadow — re-declares web_fetch/web_search',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/confined-web-tool.mjs'],
    names: ['web_fetch', 'web_search'],
    hostCounterpart: ['tool-web'],
    providerFaces: ['ctx.web'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the ctx.web lane on the Member realm'],
    note: 'The shadow was the right diagnosis and the wrong mechanism: it answers "the preset row resolves the wrong fs" by declaring the name a second time. The target answers it by making the Member realm the place ctx.fs resolves.',
  },
  {
    id: 'shadow-bash',
    title: 'Confined bash shadow — re-declares bash',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/confined-bash-tool.mjs'],
    names: ['bash'],
    hostCounterpart: ['tool-bash'],
    providerFaces: ['ctx.shell'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the ctx.shell lane on the Member realm'],
    note: 'The shadow was the right diagnosis and the wrong mechanism: it answers "the preset row resolves the wrong fs" by declaring the name a second time. The target answers it by making the Member realm the place ctx.fs resolves.',
  },
  {
    id: 'shadow-terminal',
    title: 'Confined terminal shadow — re-declares the persistent shell face',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/confined-terminal-tool.mjs'],
    names: ['bash (persistent)'],
    hostCounterpart: ['tool-bash-persistent over ctx.terminals'],
    providerFaces: ['ctx.terminals'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the ctx.terminals lane, which must pin the OS boundary at creation (UTE-10)'],
    note: 'The shadow was the right diagnosis and the wrong mechanism: it answers "the preset row resolves the wrong fs" by declaring the name a second time. The target answers it by making the Member realm the place ctx.fs resolves.',
  },
  {
    id: 'team-tool-plane',
    title: 'The ToolPlane itself — 2,300 lines that mount, guard and own the governed rows',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/team-tool-plane.mjs'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the new binding assembler (one verified binding per Scope x ToolName x Generation)'],
    note: 'The assembly that names every row, owns the guard consult and publishes the PA mount facts. Its admission edge is the one part that survives as a pattern: the new slot keeps the same shape (keyed by the runtime Agent, not by scope).',
  },
  {
    id: 'seam-family-assembly',
    title: 'family-assembly.mjs — the generic seam the plane drives descriptors through',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/family-assembly.mjs'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the new binding assembler'],
    note: 'No independent capability of its own: it exists only to drive descriptors that are all being deleted with it.',
  },
  {
    id: 'pa-mount-registry',
    title: 'pa-mount-registry.mjs — the per-session table of live PA mounts and call facts',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/pa-mount-registry.mjs'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the new ExecutionFact interface (Control reads facts from the centre, not from a mount table)'],
    note: 'This is coupling #2: root.ts builds createPaEffectsVerifier from it. Deleting it is only safe once Control can ask the centre for the fact of a call instead of reading the plane\'s table.',
  },
  {
    id: 'native-tool-admission',
    title: 'native-tool-admission.mjs — the publication slot that lets a NATIVE definition consult admission',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/native-tool-admission.mjs'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the new admission slot, which MUST keep its one hard-won property: address by the runtime Agent object, never by scope (a second dsh-scope instance reads undefined)'],
    note: 'Holds no policy of its own, but it is published by agent-bindings and consumed by native-bash-tool, both replaced in A1. Delete the file, carry the finding in writing.',
  },
  {
    id: 'native-bash-shadow',
    title: 'Native bash preservation — re-declares bash to wrap the pinned host row with admission',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/native-bash-tool.mjs'],
    names: ['bash'],
    hostCounterpart: ['tool-bash'],
    providerFaces: ['ctx.shell'],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['admission carried by the binding assembler, so no second bash declaration is needed'],
    note: 'This is the ADMISSION pattern the target wants (wrap the host row, do not replace it) with the wrong mount: it declares bash a second time.',
  },
  {
    id: 'governance-closed-world',
    title: 'Governance kernel + closed-world guard + scoped dispatcher (ONE module group)',
    kind: 'old-execution',
    roots: ['packages/runtime/governance-center', 'packages/runtime/tool-dispatch'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the closed-world semantics moved into the new centre FIRST (a model cannot see an undeclared tool, and a call to an undeclared name is refused) — the move is its own commit, before the deletion'],
    note: '11 files / 4,766 lines, and NOT pure old execution: packages/domain/tool-governance and runtime/jobs-gateway/cancellation-boundary import it in production. Deleting it without moving the semantics is a capability regression, not a cleanup.',
  },
  {
    id: 'pa-control-bridge',
    title: 'pa-control-bridge.ts — the A5/PA-to-Control approval bridge',
    kind: 'old-execution',
    roots: ['packages/runtime/operation-permission/pa-control-bridge.ts'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['the new centre Invocation/Binding/ExecutionFact interface, which Control consumes instead of a PA kernel'],
    note: 'Coupling #1 and #2 both live here: createPaControlLeg feeds the plane, createPaEffectsVerifier reads the plane. Delete-and-reimplement, never port.',
  },
  {
    id: 'pre-execute-adapter',
    title: 'pre-execute-adapter.ts — the tools/pre-execute enforcement listener (2,822 lines)',
    kind: 'old-execution',
    roots: ['packages/runtime/operation-permission/pre-execute-adapter.ts'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['a minimal deny-by-default admission point shipped IN A1, so the model-visible tools are never unguarded while the full centre is built'],
    note: 'The largest single risk in A1: this file IS the enforcement listener. Deleting it without a replacement turns "confined" into "unguarded" for as long as B takes, which is why A1 carries a fail-closed stub rather than an empty slot. paReadHandoff is the part that belongs to the old route and simply goes.',
  },
  {
    id: 'a5p5-tools',
    title: 'Alpha.5 PR5 lane barrel — search/shell arg parsing, effects, render, spill (DORMANT)',
    kind: 'dormant',
    roots: ['packages/tools/a5p5-tools'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'A',
    verdict: 'delete',
    wave: 1,
    deleteWith: ['nothing — it has no runtime effect'],
    note: 'Nothing registers and nothing dispatches (a5p5-dormant-audit enforces that). Deleting it changes no behaviour at all, which is exactly why it must never be presented as progress.',
  },
  {
    id: 'assembly-agent-bindings',
    title: 'agent-bindings.mjs — 7,138 lines of production assembly (replaced, not split)',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/live/agent-bindings.mjs'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'replace',
    wave: 1,
    deleteWith: ['a NEW entry module: fresh file, no reuse of its local functions, old file deleted in the same PR'],
    note: 'Its tool-execution part is deleted; its team-lifecycle, member-management and control-wiring parts must be re-authored in the new entry. That re-authoring is the real cost of A1, and it is the cost the owner accepted.',
  },
  {
    id: 'assembly-root',
    title: 'root.ts — 5,243 lines of top-level Team assembly (replaced, not split)',
    kind: 'old-execution',
    roots: ['packages/runtime/src/plugin/root.ts'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'B',
    verdict: 'replace',
    wave: 1,
    deleteWith: ['a NEW root entry that wires the retained domains (TeamDomain, Control, Alpha.6) to the new centre'],
    note: 'Coupling #2 lives here (createPaEffectsVerifier over the mount registry). Same rule as agent-bindings: new file, same PR, no old/new dual entry across PRs.',
  },
  {
    id: 'central-tools-src',
    title: 'Admission layer — guard consult, builtin deny, tool selector, tokens, native FS binding',
    kind: 'central',
    roots: ['packages/tools/src'],
    names: [],
    hostCounterpart: [],
    providerFaces: ['ctx.fs'],
    bucket: 'KEEP',
    verdict: 'keep',
    wave: null,
    deleteWith: [],
    note: 'Not the old route: it is the layer the new route CALLS. guard/builtin-deny/tool-selector decide what is visible and callable, and native-fs-binding.ts is already the target provider shape (subclass the host provider, one lane decision, delegate to super).',
  },
  {
    id: 'central-control',
    title: 'ControlService — the sole Grant/Stop authority (5 files, 10,526 lines)',
    kind: 'central',
    roots: ['packages/runtime/control'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'KEEP',
    verdict: 'keep',
    wave: null,
    deleteWith: [],
    note: 'Verified independent of the old execution route at the type level: its only mention of pa-control-bridge is a comment. Its authority does not move in A1; only its feed changes, from the plane mount table to the centre fact interface.',
  },
  {
    id: 'central-alpha6',
    title: 'Alpha.6 — review routing, officer facts, wake intents (12 files, 3,362 lines)',
    kind: 'central',
    roots: ['packages/runtime/alpha6'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'KEEP',
    verdict: 'keep',
    wave: null,
    deleteWith: [],
    note: 'Zero references to team-tool-plane, governance-center, pa-mount-registry or a5p5-tools (measured). It keeps its core and loses only the adapters that reached into the plane.',
  },
  {
    id: 'central-permission-algebra',
    title: 'Permission algebra — canonical operation, resolver, coverage, approval routing (7 files)',
    kind: 'central',
    roots: ['packages/runtime/operation-permission/approval-routing.ts', 'packages/runtime/operation-permission/canonical-operation.ts', 'packages/runtime/operation-permission/errors.ts', 'packages/runtime/operation-permission/index.ts', 'packages/runtime/operation-permission/permission-coverage.ts', 'packages/runtime/operation-permission/permission-resolver.ts', 'packages/runtime/operation-permission/types.ts'],
    names: [],
    hostCounterpart: [],
    providerFaces: [],
    bucket: 'KEEP',
    verdict: 'keep',
    wave: null,
    deleteWith: [],
    note: 'Policy algebra, not execution: these decide what an operation MEANS and whether it is allowed. Only the two adapters that reached into the plane (pa-control-bridge, pre-execute-adapter) are deleted.',
  },
])

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()
const tracked = (root) => {
  const out = git(['ls-files', '--', root])
  return out === '' ? [] : out.split('\n').filter(Boolean).sort()
}
const linesOf = (rel) => {
  try {
    return readFileSync(join(ROOT, rel), 'utf8').split('\n').length - 1
  } catch {
    return null
  }
}

/** Derive the ledger from MODULES + the tree. */
export function derive () {
  const modules = MODULES.map((m) => {
    const files = [...new Set(m.roots.flatMap((r) => tracked(r)))].sort()
    const lines = files.reduce((n, f) => n + (linesOf(f) ?? 0), 0)
    return { ...m, roots: [...m.roots], files, lines }
  })
  const claimed = new Map()
  for (const m of modules) for (const f of m.files) claimed.set(f, [...(claimed.get(f) ?? []), m.id])
  return {
    schema: SCHEMA,
    derivedFrom: 'git ls-files over the module roots in scripts/ute-p0-assets.mjs',
    totals: {
      modules: modules.length,
      files: modules.reduce((n, m) => n + m.files.length, 0),
      lines: modules.reduce((n, m) => n + m.lines, 0),
      deleteFiles: modules.filter((m) => m.verdict === 'delete').reduce((n, m) => n + m.files.length, 0),
      replaceFiles: modules.filter((m) => m.verdict === 'replace').reduce((n, m) => n + m.files.length, 0),
      keepFiles: modules.filter((m) => m.verdict === 'keep').reduce((n, m) => n + m.files.length, 0),
      wave1Files: modules.filter((m) => m.verdict === 'delete' && m.wave === 1).reduce((n, m) => n + m.files.length, 0),
      wave2Files: modules.filter((m) => m.wave === 2 && m.verdict === 'delete').reduce((n, m) => n + m.files.length, 0),
      wave1Lines: modules.filter((m) => m.wave === 1 && m.verdict !== 'keep').reduce((n, m) => n + m.lines, 0),
      deleteLines: modules.filter((m) => m.verdict === 'delete').reduce((n, m) => n + m.lines, 0),
    },
    duplicateClaims: [...claimed].filter(([, ids]) => ids.length > 1).map(([file, ids]) => ({ file, modules: ids })),
    modules,
  }
}

/** Grade the ledger: schema, coverage, bucket/verdict coherence, prose drift. */
export function checkLedger (ledger, { root = ROOT, inventoryText = null } = {}) {
  const findings = []
  const push = (code, detail) => findings.push({ code, detail })
  if (ledger?.schema !== SCHEMA) push('UTE_P0_ASSETS_SCHEMA', `schema must be ${JSON.stringify(SCHEMA)}, got ${JSON.stringify(ledger?.schema)}`)
  const modules = Array.isArray(ledger?.modules) ? ledger.modules : []
  if (modules.length === 0) push('UTE_P0_ASSETS_SCHEMA', 'no modules')
  const ids = new Set()
  const fileOwner = new Map()
  for (const m of modules) {
    if (typeof m.id !== 'string' || m.id === '') push('UTE_P0_ASSETS_SCHEMA', 'module id missing')
    else if (ids.has(m.id)) push('UTE_P0_ASSETS_SCHEMA', `duplicate module id ${m.id}`)
    else ids.add(m.id)
    if (!BUCKETS.has(m.bucket)) push('UTE_P0_ASSETS_BUCKET', `${m.id}: bucket ${JSON.stringify(m.bucket)} not in A|B|C|KEEP`)
    if (!VERDICTS.has(m.verdict)) push('UTE_P0_ASSETS_VERDICT', `${m.id}: verdict ${JSON.stringify(m.verdict)} not in delete|keep`)
    if (!KINDS.has(m.kind)) push('UTE_P0_ASSETS_KIND', `${m.id}: kind ${JSON.stringify(m.kind)} not in old-execution|central|shared|dormant`)
    if ((m.verdict === 'delete' || m.verdict === 'replace') && !(m.wave === 1 || m.wave === 2 || m.wave === 3)) {
      push('UTE_P0_ASSETS_WAVE', `${m.id}: a module that goes must name the wave it goes in, got ${JSON.stringify(m.wave)}`)
    }
    if (m.verdict === 'replace' && (!Array.isArray(m.deleteWith) || m.deleteWith.length === 0)) {
      push('UTE_P0_ASSETS_PAIRED', `${m.id}: a replaced module must name its replacement`)
    }
    if (m.verdict === 'keep' && m.wave !== null && m.wave !== undefined) {
      push('UTE_P0_ASSETS_WAVE', `${m.id}: a kept module must not claim a deletion wave, got ${JSON.stringify(m.wave)}`)
    }
    if (m.bucket === 'B') {
      if (!Array.isArray(m.deleteWith) || m.deleteWith.length === 0) {
        push('UTE_P0_ASSETS_PAIRED', `${m.id}: bucket B means "only enforcement today" — it must name the paired work in deleteWith, got ${JSON.stringify(m.deleteWith)}`)
      }
      if (m.verdict !== 'delete' && m.verdict !== 'replace') push('UTE_P0_ASSETS_PAIRED', `${m.id}: bucket B implies delete or replace, got ${m.verdict}`)
    }
    if (m.bucket === 'D') {
      if (!Array.isArray(m.names) || m.names.length === 0) {
        push('UTE_P0_ASSETS_UNBACKED', `${m.id}: bucket D exists for a name that had no home — it must list the name(s)`)
      }
      if (!Array.isArray(m.deleteWith) || m.deleteWith.length === 0) {
        push('UTE_P0_ASSETS_PAIRED', `${m.id}: bucket D is an owner ruling, so it must say what the name becomes (home or drop)`)
      }
      if (m.verdict !== 'delete') push('UTE_P0_ASSETS_PAIRED', `${m.id}: bucket D implies delete, got ${m.verdict}`)
    }
    if (m.bucket === 'C') {
      const names = Array.isArray(m.names) ? m.names : []
      const blockedBy = Array.isArray(m.blockedBy) ? m.blockedBy : []
      if (names.length === 0 && blockedBy.length === 0) {
        push('UTE_P0_ASSETS_UNBACKED', `${m.id}: bucket C means "not deletable yet" — it must say why: either the booked names without a retained counterpart, or the modules it is blocked on`)
      }
    }
    for (const b of (Array.isArray(m.blockedBy) ? m.blockedBy : [])) {
      if (!modules.some((x) => x.id === b)) push('UTE_P0_ASSETS_UNBACKED', `${m.id}: blockedBy names an unknown module ${JSON.stringify(b)}`)
    }
    if (m.verdict === 'keep') {
      const hasNames = Array.isArray(m.names) && m.names.length > 0
      const hasDeps = Array.isArray(m.blockedBy) && m.blockedBy.length > 0
      if (m.bucket !== 'KEEP' && !(m.bucket === 'C' && (hasNames || hasDeps))) {
        push('UTE_P0_ASSETS_KEEP', `${m.id}: a kept module must be KEEP (built on) or C with a stated reason — got bucket ${m.bucket}`)
      }
      if (m.bucket === 'B') push('UTE_P0_ASSETS_KEEP', `${m.id}: bucket B is "only enforcement, delete with the pairing" — it cannot be kept`)
    }
    if (m.bucket === 'KEEP' && m.kind === 'old-execution') {
      push('UTE_P0_ASSETS_KEEP', `${m.id}: a KEEP module cannot be classed as old-execution`)
    }
    if (!Array.isArray(m.files) || m.files.length === 0) {
      push('UTE_P0_ASSETS_EMPTY', `${m.id}: module lists no files (an empty module is either a typo or already deleted)`)
    }
    for (const f of m.files ?? []) {
      if (!existsSync(join(root, f))) push('UTE_P0_ASSETS_MISSING', `${m.id}: listed file does not exist: ${f}`)
      const seen = fileOwner.get(f)
      if (seen) push('UTE_P0_ASSETS_DOUBLE', `${f} is claimed by both ${seen} and ${m.id}`)
      else fileOwner.set(f, m.id)
    }
  }
  // Coverage: every tracked file under every root must be listed by that module.
  for (const m of modules) {
    for (const r of m.roots ?? []) {
      for (const f of trackedFrom(root, r)) {
        if (!(m.files ?? []).includes(f)) push('UTE_P0_ASSETS_UNLISTED', `${m.id}: tracked file under ${r} is not in the ledger: ${f}`)
      }
    }
  }
  // Totals must be derived, never typed.
  const t = ledger?.totals
  const expect = {
    modules: modules.length,
    files: modules.reduce((n, m) => n + (m.files?.length ?? 0), 0),
    lines: modules.reduce((n, m) => n + (m.lines ?? 0), 0),
    deleteFiles: modules.filter((m) => m.verdict === 'delete').reduce((n, m) => n + (m.files?.length ?? 0), 0),
    replaceFiles: modules.filter((m) => m.verdict === 'replace').reduce((n, m) => n + (m.files?.length ?? 0), 0),
    keepFiles: modules.filter((m) => m.verdict === 'keep').reduce((n, m) => n + (m.files?.length ?? 0), 0),
  }
  for (const [k, v] of Object.entries(expect)) {
    if (t?.[k] !== v) push('UTE_P0_ASSETS_TOTALS', `totals.${k} says ${JSON.stringify(t?.[k])} but the rows sum to ${v}`)
  }
  // Prose must not drift from the ledger.
  if (typeof inventoryText === 'string') {
    for (const m of modules) {
      if (!inventoryText.includes(`\`${m.id}\``)) push('UTE_P0_ASSETS_PROSE', `01-ASSET-INVENTORY.md does not mention module ${m.id} — regenerate it with --write`)
    }
  }
  return findings
}

function trackedFrom (root, rel) {
  try {
    const out = execFileSync('git', ['ls-files', '--', rel], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()
    return out === '' ? [] : out.split('\n').filter(Boolean).sort()
  } catch {
    return []
  }
}

/** Render the prose inventory from the ledger (the ONLY writer of that table). */
export function renderInventory (ledger) {
  const t = ledger.totals
  const wave = (m) => (m.wave === null || m.wave === undefined ? '—' : String(m.wave))
  const rows = ledger.modules.map((m) => {
    const verdict = m.verdict === 'delete' ? `DELETE (wave ${m.wave})` : m.verdict === 'replace' ? `REPLACE (wave ${m.wave})` : 'KEEP'
    return `| \`${m.id}\` | ${m.title} | ${m.kind} | ${m.bucket} | ${verdict} | ${m.files.length} | ${m.lines} |`
  })
  const detail = ledger.modules.map((m) => {
    const files = m.files.map((f) => `  - \`${f}\``).join('\n')
    const paired = m.deleteWith.length > 0 ? m.deleteWith.map((d) => `\`${d}\``).join(', ') : '—'
    return [
      `### \`${m.id}\` — ${m.title}`,
      '',
      `- **kind** ${m.kind} · **bucket** ${m.bucket} · **verdict** ${m.verdict} · **wave** ${wave(m)}`,
      `- **booked names** ${m.names.length > 0 ? m.names.map((n) => `\`${n}\``).join(', ') : '—'}`,
      `- **retained counterpart** ${m.hostCounterpart.length > 0 ? m.hostCounterpart.join('; ') : '— none —'}`,
      `- **provider faces** ${m.providerFaces.length > 0 ? m.providerFaces.map((f) => `\`${f}\``).join(', ') : '—'}`,
      `- **delete with** ${paired}`,
      `- **note** ${m.note}`,
      `- **files** (${m.files.length}, ${m.lines} lines)`,
      files,
      '',
    ].join('\n')
  })
  return [
    '# 01 — Asset inventory (generated from the git tree; do not hand-edit)',
    '',
    '> Generated by `node scripts/ute-p0-assets.mjs --write` from `MODULES` + `git ls-files`.',
    '> `node scripts/ute-p0-assets.mjs --check` reds if any listed file is missing, any tracked file',
    '> under a module root is unlisted, any file is claimed twice, a bucket/verdict/wave combination',
    '> is incoherent, the totals stop summing, or this table stops mentioning a module.',
    '',
    `**Totals:** ${t.modules} modules · ${t.files} files · ${t.lines} lines · delete ${t.deleteFiles} files (${t.wave1Files} wave 1, ${t.wave2Files} wave 2) · replace ${t.replaceFiles} · keep ${t.keepFiles}.`,
    '',
    `**Deletion budget:** ${t.deleteLines} lines deleted, ${t.wave1Lines} of them (delete + replace) in wave 1.`,
    '',
    '| module | what it is | kind | bucket | verdict | files | lines |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    '## Per-module detail',
    '',
    ...detail,
  ].join('\n')
}

const usage = () => {
  console.error('usage: node scripts/ute-p0-assets.mjs --check|--write|--json')
  process.exit(2)
}
// Importable: the test suite imports derive/checkLedger, so the CLI only runs
// when this file IS the process entry point.
const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!isMain) {
  // no-op: module consumers get the exported functions only
} else {
const argv = process.argv.slice(2)
if (argv.includes('--json')) {
  process.stdout.write(JSON.stringify(derive(), null, 2) + '\n')
  process.exit(0)
}
if (argv.includes('--write')) {
  const ledger = derive()
  writeFileSync(join(ROOT, LEDGER_PATH), JSON.stringify(ledger, null, 2) + '\n')
  writeFileSync(join(ROOT, INVENTORY_PATH), renderInventory(ledger) + '\n')
  console.log(`UTE-P0-ASSETS write modules=${ledger.totals.modules} files=${ledger.totals.files} lines=${ledger.totals.lines}`)
  process.exit(0)
}
if (!argv.includes('--check')) usage()

const ledgerPath = join(ROOT, LEDGER_PATH)
if (!existsSync(ledgerPath)) {
  console.log(`UTE-P0-ASSETS fail findings=1 (${LEDGER_PATH} is missing)`)
  process.exit(1)
}
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'))
const invPath = join(ROOT, INVENTORY_PATH)
const inventoryText = existsSync(invPath) ? readFileSync(invPath, 'utf8') : ''
const findings = checkLedger(ledger, { inventoryText: existsSync(invPath) ? inventoryText : null })
for (const f of findings) console.error(`${f.code} ${f.detail}`)
const t = ledger.totals ?? {}
console.log(
  `UTE-P0-ASSETS ${findings.length === 0 ? 'pass' : 'fail'} modules=${t.modules} files=${t.files} ` +
  `lines=${t.lines} delete=${t.deleteFiles} replace=${t.replaceFiles} keep=${t.keepFiles} wave1=${t.wave1Files} wave2=${t.wave2Files} findings=${findings.length}`,
)
process.exit(findings.length === 0 ? 0 : 1)
}
