/**
 * team-tool-plane.mjs — the GLUE-5 production assembly entry for the
 * governed Team TOOL PLANE (GLUE-4 contract, Q4-approved R1 PLACEMENT route;
 * glue4-prodentry README AMENDMENT + RA-REVIEW `4ba92b77` ②).
 *
 * THE LAW THIS FILE IMPLEMENTS (RA-REVIEW ② invariants, verbatim mapping):
 *  1. PLACEMENT ATTRIBUTION — the assembly itself executes the successful
 *     `tools.register` of each reviewed Definition into the governed Agent's
 *     OWN layer, and every dispatch compares the object IT placed (the
 *     guard's bindAll pins the scoped read of the object the placement put
 *     there). Verification verifies the PLACEMENT, never a discovery.
 *  2. PER-SCOPE JUDGEMENT — everything here is scoped to one governed Agent
 *     setup closure. There is no global mount (Q3 stays REJECTED; the
 *     measured `minimal`-preset expansion is the standing evidence). A
 *     non-team session never enters this module: the mount point in
 *     agent-bindings.mjs sits behind `permissionPolicy !== undefined`.
 *  3. UNKNOWN ATTRIBUTION FAILS CLOSED — a failed placement (same-layer
 *     duplicate or any register throw) FAILS THE ASSEMBLY (the caller
 *     refuses the Agent, the AgentSetup rollback); it never falls back to a
 *     discovery-style pin.
 *  4. SAME-NAME DIVERGENCE — placement rides the own layer, which chains
 *     LAST; an ancestor same-name never inherits this verification (the
 *     per-call identity compare fails it as drift). Alias names keep the
 *     plane out of the inherited lane entirely.
 *  5. AUDIT HONESTY — these bindings carry `implementationOrigin:
 *     'team-trusted-extension'` (install.ts stamping) — never a fake
 *     `dsh-native`.
 *
 * The reviewed Definitions come from the PR5 lane's registration face
 * (`createGovernedToolDefinitions`, pb-CONTRACT §2: `decide` REQUIRED —
 * "registered ungated" is not expressible through this face). Names default
 * to the `team_*` aliases (GLUE-5 ruling, disclosed): native same-name
 * take-over would collide with the preset-realm mount of the SAME agent
 * scope (duplicate = fail closed, RA ② NC-1) — aliases never collide, never
 * ride the inherited lane, and are honest about the body that answers.
 *
 * Admission wiring (pa-CONTRACT §4): the per-agent production admission
 * assembly (`createProductionAdmissionAssembly` over the REAL template
 * policy) is constructed here; a construction refusal is a mount refusal.
 * The lane-level `decide` the a5p5 pipeline consumes is a SYNCHRONOUS
 * re-check of the template's static policy (the face is sync by contract):
 *   - a deny-lane rule that matches the effect (tool class + resource
 *     matcher, subtree via the injected containment seam)  -> deny;
 *   - no covering rule and the template default is `deny`   -> deny;
 *   - otherwise                                              -> allow,
 *     because the ASYNC kernel/guard chain (the A5 pre-execute listener,
 *     the Coverage Gate, the bindOwnTools-verified dispatcher) already
 *     admitted this call before its body could run — the lane re-check is
 *     defense-in-depth, its own refusals are the ONLY lane-level gate, and
 *     it never widens what the upstream chain allowed (tool-granularity
 *     note: resource-granular ALLOW semantics stay with the kernel; the
 *     lane only ever tightens).
 *
 * Effect-face honesty (pb-CONTRACT §6, disclosed): the production
 * ToolEffectBackend adapter bodies over C-FS (PR3) and the confined
 * provider (PR4) are the registered GLUE-4 follow-up. This entry therefore
 * mounts the gated SURFACE (placement + verified bindings + admission
 * chain), and the default backends are a typed `IO_POLICY_UNSUPPORTED`
 * refusal — the effect face is shut with a name, never faked. A caller
 * that has a real backend (the wiring rounds' kit rows) injects `backends`.
 *
 * trustRoot pairing (pb-CONTRACT §1.3, fail-closed): when the row carries
 * `confinedProvider`, `trustRoot` MUST equal
 * `sha256:<launcherSha256[0..16]>#<declared trusted path>` — a mismatch or
 * half-configured pair refuses the whole mount (typed), the same discipline
 * as `alpha5-tool-dispatcher-not-published`. The provider's own byte gate
 * (probe/spawn re-hash) stays the SECOND gate, never a replacement.
 *
 * Import law (pc-CONTRACT §3 checklist 1): every production lane enters
 * through the committed dist mirror (the relative specifiers below resolve
 * inside `packages/runtime/dist/packages/...` from the placed copy).
 *
 * @module runtime/plugin/live/team-tool-plane
 */
import { createGovernedShellRowDefinition, createGovernedToolDefinitions } from '../../../../tools/a5p5-tools/src/index.js'
import { createProductionAdmissionAssembly, evaluateEffectSetExpansion } from '../../../tool-admission/index.js'
import { createProductionControlledFsProvider } from '../../../controlled-fs/src/index.js'
import { definitionIdentityOf, untestedAssurance } from '../../../tool-dispatch/index.js'
import { canonicalJsonFingerprint, parseToolBinding } from '../../../../domain/tool-governance/src/index.js'
// U6 PR3 (U6 slice plan PR3 — ARC-B part 2): the governed SHELL row joins
// the SAME Kernel as the read row. The process family lane owns the shell
// mechanics, the confined executor (CI-07 named provider), the pure shell
// normalizer, the row Definition and the contribution descriptor (owner
// role: that lane's README). The plane remains the TRUSTED ASSEMBLY POINT:
// it validates the provider pairing (Gate 0c, unchanged), builds the ONE
// kernel over BOTH families' contributions, feeds the table with the
// placement identities, and routes BOTH names' one-shot consume through
// the SAME consumeOnce edge — one ledger, no dual path (ARC-B).
import {
  buildBashRowDefinition,
  buildProcessShellContribution,
  createConfinedShellBackend,
} from '../../../../tools/process-family/src/index.mjs'
import {
  createGovernanceKernel,
  createGovernedFamilyRegistry,
} from '../../../governance-center/index.js'
// U6 PR4 (ARC-C): the governed JOBS trio joins the SAME Kernel as the
// read/shell families — as the first NAMED BRIDGE. The bridge module owns
// the moved-VERBATIM bridge body (byte-identity sha-pinned by
// u6-pr4-jobs-bridge.test), the trio row Definitions, the fixed name list
// (natexe ledger + kernel-ownership + contribution visibility all quote
// THIS data), and the closed-schema contribution descriptor. The plane
// remains the TRUSTED ASSEMBLY POINT: registration is fail-closed, the
// trio's approval entries bind on the ONE table with the read/shell
// bind-ONCE law, and the one-shot consume edge stays the ONLY consume path
// (no second ledger anywhere on this lane).
import {
  buildJobsBridgeContribution,
  buildJobsManagementRowDefs,
  JOBS_MANAGEMENT_NAMES,
} from './jobs-family-bridge.mjs'
import { claimTableOf, createApprovalEntryBinder } from './approval-entry-binder.mjs'
// u7-w0b S3: the generic FamilyAssembly seam. The families that mount
// through it are NOT named here: the reviewed manifest and its generated
// static index enumerate them, the seam verifies the set, and the plane
// drives every descriptor through the same phases.
import {
  checkBuiltFamily,
  checkFamilyConfig,
  makeFamilyCapabilities,
  verifyReviewedFamilies,
} from './family-assembly.mjs'
import { FAMILY_INDEX, FAMILY_MANIFEST_URL } from '../../../../tools/families/index.mjs'

/** The lane-default plane names (GLUE-5 alias ruling; see header). */
export const DEFAULT_PLANE_NAMES = Object.freeze({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })

/**
 * The host registration law (measured at the pinned host: core tools
 * `register()` throws `must declare output { schema, render }` without it)
 * applied to the lane's closed execute envelope `{ text }`.
 *
 * THE RENDER CONTRACT (GLUE-6): the host declares
 * `render(args, value): ContentBlock[]`
 * (`packages/core/tools/src/index.ts:217` at the pinned 0.2.0-rc.2 host) and
 * CONSUMES the return value AS the tool result's model-facing content:
 * `createSuccessResult` snapshots it (`…index.ts:1839-1843`) and the result
 * travels onward as `content`, which every downstream consumer walks as an
 * ARRAY (`packages/llm/llm/src/content.ts:126-127` `contentHasImage` →
 * `content.some(…)`). Returning a bare `String` — the pre-GLUE-6 shape — is
 * therefore not a presentation choice but a contract violation: the host
 * threw `content.some is not a function` while assembling the result, so
 * EVERY live trio dispatch died in the host's result assembly and neither a
 * computed refusal nor a future effect body could ever reach the model
 * (measured LIVE: alpha5/install-entry run 2026-10-17T17-06-56Z, world
 * `team`, member tool_results [1]/[2] = `Error: content.some is not a
 * function`; synth cannot see this — the value only becomes `content` inside
 * the host scheduler).
 *
 * The contract shape, one block per outcome the lane can produce: the lane's
 * `execute` returns `{ text }` for BOTH lanes (register.ts: a presented
 * result carries the renderer's text, a refusal carries
 * `REFUSAL_PREFIX kind=… code=… detail=…`), so both become exactly one
 * `{ type: 'text', text }` block — the same shape the host's own `bash` tool
 * renders (`packages/shell/tool-bash/src/index.ts:471`). Text stays verbatim:
 * the lane's control-byte law already escaped anything structural, and the
 * block carries no markup, so nothing is re-interpreted on the way out.
 */
const PLANE_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({ text: Object.freeze({ type: 'string' }) }),
    required: Object.freeze(['text']),
    additionalProperties: false,
  }),
  /**
   * Project the closed envelope onto typed model content.
   * @param _args - the validated call arguments (unused: the envelope is self-describing).
   * @param value - the lane's `{ text }` envelope (refusal or result).
   * @returns {Array<{ type: 'text', text: string }>} one legal text block.
   */
  render: (_args, value) => [{
    type: 'text',
    text: typeof value?.text === 'string' ? value.text : '',
  }],
})

// ── The read row's OWN presentation face MOVED (U6 PR2) ─────────────────
// The Alpha.5 READ-slice presentation law (the pin639 read-envelope mirror,
// the render/presentationMeta contract, the decline-on-anything-dishonest
// presentResult) now lives in the FS family lane —
// `packages/tools/fs-family/src/read-presentation.mjs` — placed through the
// family row builder at the mount (the sole home; U6 PR6 deleted the legacy
// plane-effect-backends re-export once C1/C2 were green). Mirror-not-import still holds: the host module
// sits behind its own public tool; the governed row's face is a
// family-owned plugin artifact.

/**
 * pb-CONTRACT §1.3 fail-closed pairing check. Returns { ok: true } when the
 * block is ABSENT (no provider mounted) or the pair is exactly consistent;
 * a typed { ok: false, code, message } otherwise.
 */
export function verifyConfinedProviderPairing(confined) {
  if (confined === undefined || confined === null) return { ok: true }
  const trustRoot = typeof confined.trustRoot === 'string' ? confined.trustRoot : ''
  const sha = typeof confined.assembly?.launcherSha256 === 'string' ? confined.assembly.launcherSha256 : ''
  const declaredPath = typeof confined.assembly?.launcherPath === 'string' ? confined.assembly.launcherPath : ''
  if (trustRoot === '' || sha === '' || declaredPath === '') {
    return {
      ok: false,
      code: 'CONFINE_CONFIG_INCOMPLETE',
      message: 'confinedProvider carries only part of the trustRoot/sha256/launcherPath trio — a half-configured trust pair is a config defect, the mount is refused',
    }
  }
  if (!/^[0-9a-f]{64}$/.test(sha)) {
    return { ok: false, code: 'CONFINE_CONFIG_INCOMPLETE', message: 'assembly.launcherSha256 must be 64 lowercase hex characters' }
  }
  const expectPrefix = `sha256:${sha.slice(0, 16)}#`
  if (!trustRoot.startsWith(expectPrefix)) {
    return {
      ok: false,
      code: 'TRUST_ROOT_SHA_MISMATCH',
      message: `trustRoot must be "sha256:<launcherSha256[0..16]>#<trusted path>" — got "${trustRoot.slice(0, 80)}" against pin "${sha.slice(0, 16)}"`,
    }
  }
  return { ok: true }
}

/**
 * Gate 0b (natexe ③ audit, root ruling 04:34Z): the CLOSED value domain of
 * the plane's mount names. `names`/`readName` are ROW-CONFIG input (the
 * install-level surface — the blueprint grammar is closed and carries no
 * field reaching the plane), and a half-valid mount spelling is the same
 * class of config defect as a half-configured trust pair: refuse the mount,
 * never guess. Three laws, measured adversarial shapes in
 * dev/agent-workflow/evidence/alpha5/natexe/ (probe legs A1-A4):
 *  - SHAPE: every mount name is a tool-name-shaped string
 *    (`^[a-z][a-z0-9_]{0,63}$` — rejects '', '__proto__', whitespace,
 *    uppercase);
 *  - KEYS: the names map is exactly the plane's own classes
 *    (grep/glob/bash — a foreign key pre-seeds the lane's class map with a
 *    class that has no row);
 *  - DISTINCT: the four mount names (grep/glob/bash/read) are pairwise
 *    distinct (one name, one placement);
 *  - RESERVED NATIVE CLAIM (tightened by the root ruling 06:43Z — the
 *    first cut keyed this off the COARSE permission class and thereby
 *    accepted readName 'write'/'edit'/'lsp'/'read_image' and names.bash
 *    'pwsh'; coarse class is not tool-implementation equivalence): a
 *    reserved host/native spelling may be mounted ONLY where this install
 *    surface assembles a same-name, same-meaning implementation for that
 *    row — the supported pairs are the bash row at 'bash' (live-verified
 *    takeover) and the read row at 'read' (the shipped `readName`
 *    default). Every other reserved pairing (write/edit/read_image/lsp/
 *    pwsh/grep/glob spellings on any row — and EVERY other host native
 *    spelling (the exhaustive pinned-release registry + the mcp__ prefix
 *    family) — is refused as PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED before
 *    any construction. Mixed defects hit FIRST-HIT by check order
 *    (shape -> reserved claim -> collision): a shape-valid reserved claim on
 *    a colliding name reports UNSUPPORTED, not the collision INVALID.
 *    PLANE_RESERVED_NATIVE is pinned to PLANE_RESERVED_NATIVE_HOST_PIN; a
 *    unit drift pin reds when the host baseline in tests/paths.mjs moves.
 * Legitimate configs are untouched: DEFAULT_PLANE_NAMES + readName 'read'
 * pass, and every takeover spelling already live-verified passes.
 */
const PLANE_NAME_SHAPE = /^[a-z][a-z0-9_]{0,63}$/
// Reserved host/native tool spellings a plane row must NOT silently mount
// under. The criterion is the ASSEMBLED face, NOT the coarse permission
// class (the first cut of this gate got that wrong — read_image/write/edit/
// lsp share the read FILE CLASS with `read`, pwsh shares the shell CLASS
// with `bash`, and coarse class is not tool-implementation equivalence;
// root ruling 06:43Z). A reserved spelling may be claimed only where this
// install surface actually assembles a same-name, same-meaning
// implementation for that row. Measured pre-fix impostor face:
// dev/agent-workflow/evidence/alpha5/natexe/measure-native-claims-pre-fix.
// log — a governed READER mounted as 'write' MASKS the host writer, answers
// with a read schema (file_path, no content face), returns file content
// while writing zero bytes, and the placement feed hands the Guard its
// identity to ABSTAIN (a VERIFIED impostor); the plane lane judges it by
// effect CLASS while the durable permission-lifecycle face keys the
// DISPATCHED name (permission-lifecycle/decision-lane.ts:174-184) — one
// call, two verdict identities.
// The exhaustive reserved-native name surface of the pinned host release,
// derived from the host RELEASE registry — the tests/deepseek-harness-test-use
// tool-* package registrations at the baseline pin — NOT from any
// assembly-time face: the plane's row-config assembly input is exactly
// {backends, fs, instanceId, plane} (createTeamToolPlaneAssembly below), so
// the host tool face is unreachable where mount names harden, and the
// mounted instance's dispatch face is empty for natives in the web profile
// (the very BINDING_UNVERIFIED world this plane rides) — derivation there
// would be vacuous (empty face = nothing reserved). Solo-review 06:43Z
// follow-up: the first static cut (9 names) left web_search/skill/todo_write/
// present/send_message mountable — the same own-mask + verified-abstain
// impostor face. The list below is the full registry (fs 6, shells 2,
// str_replace_editor, lsp, present, skill 2, todo, ask, web 2, goal 3, jobs
// 3, plan, subagent family 8, terminal 6, session-query 5, mcp-resource 3,
// ralph, experimental agent-team 6, cordis preset 2 — plus the C-16 second
// derivation (a5-pindir round): ptc reserved transport 1, plugin-manager 1,
// schedule 4, workflow 1, experimental browser-use stagehand 6), plus the dynamic
// `mcp__` family by
// prefix. Drift law: PLANE_RESERVED_NATIVE_HOST_PIN is pinned to the host
// baseline; the unit drift pin compares it against tests/paths.mjs — when
// the host baseline moves, the pin test goes RED and this list must be
// re-derived from the new host release before the pin moves with it.
// BIDIRECTIONAL drift law (C-16, root ruling 20:31Z): the registry is checked
// against the AUTHORITATIVE catalog harvest of the pinned host release — the
// generator `scripts/gen-tool-catalog.ts` boots every shipped tool package and
// its committed artifact `docs/tool-catalog.md` (verified fresh by the host's
// own guarantee test at the pinned commit) contributes the schemas column ∪
// the shippedNames column. A catalog name missing here is RED (the C-16 hole:
// the first derivation grepped `name: '<n>'` sources and missed names that
// reach the registry another way — run_code via the tool registry itself,
// schedule_*/plugin_manager via tools.ts maps, workflow/stagehand via the
// toolName-config route). A pinned name NOT in the catalog needs an explicit
// reason entry in the drift test — never silent (retire or keep-with-rationale,
// both lawful; the subagent_codex/subagent_claude_code reservations below are
// the worked examples: shipped native names, disabled by default, kept with
// the root 21:15Z rationale). Every pinned name must ALSO carry a real
// registration source at the pin (literal quote, `toolName:` route, or a
// named template loop) — a guessed name with no source is RED (root 21:15Z:
// "新增名都须真实注册来源，不能猜名扩表").
export const PLANE_RESERVED_NATIVE_HOST_PIN = '0.2.0-rc.2@639ed01539'
export const PLANE_RESERVED_NATIVE = Object.freeze([
  'read', 'read_image', 'write', 'edit', 'glob', 'grep',
  'bash', 'pwsh',
  'str_replace_editor',
  'lsp',
  'present',
  'skill', 'load_workspace_dependencies',
  'todo_write',
  'ask_user_question',
  'web_search', 'web_fetch',
  'create_goal', 'get_goal', 'update_goal',
  'job_kill', 'job_list', 'job_output',
  'exit_plan_mode',
  // subagent_fork disposition (root 20:31Z, checked against the pin): KEPT —
  // a live shipped registration at 639ed01539, not a forward guess. The
  // boot-harvest schemas column misses it (the fork route is a SECOND
  // bundle-composed instance of tool-subagent whose name comes from the
  // load-time toolName config), the release surface carries it: the generator
  // manifest ships `subagent_fork` in shippedNames (host
  // scripts/gen-tool-catalog.ts tool-subagent entry) and every shipped profile
  // mounts it ENABLED (packages/bundle/base/cordis.patch.yml tool-subagent-fork
  // + web-app presets cordis/ptc/standard `toolName: subagent_fork`, no
  // disabled flag). The sibling routes subagent_codex / subagent_claude_code
  // are PINNED TOO (root ruling 21:15Z, option (b)+(c)): they are shipped
  // native tool names — real route registrations at the pin (the same
  // tool-subagent toolName route, host packages/subagent/tool-subagent/src/
  // index.ts:108 `toolName: z.string().default('subagent')`; route instances
  // web-app presets cordis.patch.yml:107/:115, ptc.patch.yml:108/:116,
  // standard.patch.yml:108/:116) — and a shipped-default `disabled: true`
  // (standard :105/:113, cordis/ptc same-block) is NOT an impersonation
  // licence: one preset flip makes them mountable, the impostor face would be
  // identical. Preventive reservation only — this denies plane CLAIMS of the
  // two names, it enables nothing and widens no model permission (the tools
  // stay disabled exactly as shipped). The flip itself is drift-tested
  // (a5-pindir-subagent-flip): a disabled->enabled flip changes no pin state,
  // injections refuse in both directions.
  'subagent', 'subagent_fork', 'subagent_codex', 'subagent_claude_code',
  'list_subagent_models', 'list_agents', 'send_message', 'interrupt_agent',
  'terminal_open', 'terminal_close', 'terminal_list', 'terminal_read', 'terminal_send', 'terminal_signal',
  'session_event_read', 'session_event_search', 'session_event_trace', 'session_search', 'session_trace',
  'list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource',
  'ralph',
  'spawn_teammate', 'wait_agent', 'team_task_create', 'team_task_get', 'team_task_list', 'team_task_update',
  'cordis_inspect_list', 'cordis_inspect_query',
  // C-16 second derivation (a5-pindir round, root ruling 20:31Z): the names
  // the first source-grep derivation missed, each registered at the pin —
  // run_code is the tool registry's own reserved PTC transport (@deepseek-ai/
  // dsh-tools, catalog row `mode: ptc/both`), plugin_manager registers from
  // packages/boot/plugin-manager/src/tools.ts, the schedule_* four from
  // packages/schedule/schedule/src/tools.ts, workflow arrives under
  // tool-workflow's toolName-config default (packages/workflow/tool-workflow/
  // src/index.ts), and the stagehand_* six are the experimental browser-use
  // package (packages/experimental/browser-use-stagehand-native). Pre-fix the
  // assembly ACCEPTED plane rows mounted under these host names (negative
  // control: dev/agent-workflow/evidence/alpha5/pindir/).
  'run_code',
  'plugin_manager',
  'schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update',
  'workflow',
  'stagehand_act', 'stagehand_extract', 'stagehand_navigate', 'stagehand_observe', 'stagehand_screenshot', 'stagehand_tabs',
])
export const PLANE_RESERVED_NATIVE_PREFIXES = Object.freeze(['mcp__'])
const PLANE_SUPPORTED_NATIVE_TAKEOVERS = Object.freeze({
  bash: Object.freeze(['bash']),
  read: Object.freeze(['read']),
  grep: Object.freeze([]),
  glob: Object.freeze([]),
  // U7-9a (CA-01): the FS mutation rows + the image row mount at FIXED
  // native spellings (the jobs precedent: never the configurable `names`
  // map, no Gate 0b surface). The same-name same-meaning implementations
  // this ledger exists to record are ASSEMBLED: the fs-family lane's
  // governed write/edit bodies over the controlled-fs provider's
  // post-consume closures, and the governed read_image body over the
  // verified-handle bounded read port + the mount-resolved attachment
  // store (the dual realm-file + attachment-store effect is declared in
  // the family contribution — CI-07 names the provider, the family holds
  // no fs face of its own).
  write: Object.freeze(['write']),
  edit: Object.freeze(['edit']),
  read_image: Object.freeze(['read_image']),
  // B-ACT-1-PR C2: the jobs management trio mounts at FIXED native spellings
  // under the closed `jobsEnabled` consumption key (never the configurable
  // `names` map — no config-driven spelling, no Gate 0b surface). The
  // same-name, same-meaning implementation this ledger exists to record is
  // ASSEMBLED — U6 PR4 (ARC-C): the trio is a NAMED BRIDGE contribution,
  // `jobs-family-bridge.mjs`'s bridge body over the host JobRegistry public
  // face @639ed01539 (caller fence preserved, Team owner fence layered
  // above), registered on the ONE kernel through the closed schema. The
  // ledger quotes the bridge's OWN name list (name list C6 moved there —
  // one list; the contribution's native visibility and the kernel-ownership
  // set consume the same data); recording the claim here keeps the natexe
  // ledger the complete truth of what this install may mount.
  jobs: JOBS_MANAGEMENT_NAMES,
})
export function verifyPlaneNames(names, readName) {
  for (const key of Object.keys(names ?? {})) {
    if (key !== 'grep' && key !== 'glob' && key !== 'bash') {
      return { ok: false, code: 'PLANE_NAMES_INVALID', message: `names carries '${key}' — the plane map is closed to its own classes (grep/glob/bash)` }
    }
  }
  const rows = [['grep', names?.grep], ['glob', names?.glob], ['bash', names?.bash], ['read', readName]]
  const seen = new Map()
  for (const [cls, spelling] of rows) {
    if (typeof spelling !== 'string' || !PLANE_NAME_SHAPE.test(spelling)) {
      return { ok: false, code: 'PLANE_NAMES_INVALID', message: `plane mount name for '${cls}' must match ^[a-z][a-z0-9_]{0,63}$ — got ${JSON.stringify(spelling) ?? 'undefined'}` }
    }
    const reserved = PLANE_RESERVED_NATIVE.includes(spelling) || PLANE_RESERVED_NATIVE_PREFIXES.some((pf) => spelling.startsWith(pf))
    if (reserved && !(PLANE_SUPPORTED_NATIVE_TAKEOVERS[cls] ?? []).includes(spelling)) {
      return { ok: false, code: 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED', message: `plane row '${cls}' cannot mount under reserved native name '${spelling}' — this install surface assembles no same-name, same-meaning implementation for that pair (the PLANE_SUPPORTED_NATIVE_TAKEOVERS ledger is the complete truth of the pairs this surface assembles); coarse permission class is not tool-implementation equivalence` }
    }
    if (seen.has(spelling)) {
      return { ok: false, code: 'PLANE_NAMES_INVALID', message: `plane rows '${String(seen.get(spelling))}' and '${cls}' would both mount under '${spelling}' — one name, one placement` }
    }
    seen.set(spelling, cls)
  }
  return { ok: true }
}
function classifyEffectSet(effectSet) {
  const effects = Array.isArray(effectSet?.effects) ? effectSet.effects : []
  const invokes = effects.filter((e) => e?.kind === 'tool-invoke').map((e) => String(e.toolName ?? ''))
  const fileLike = effects.some((e) => e?.kind === 'read' || e?.kind === 'write' || e?.kind === 'list' || e?.kind === 'meta')
  return { invokes, fileLike, effects }
}

/**
 * Build the synchronous lane re-check (see header for its exact semantics).
 * `permissionPolicy` is the A1-normalized template policy; `planeNames`
 * maps the plane tools to their mounted names.
 *
 * THE JUDGEMENT SPEAKS ONE NAMESPACE (GAP PROBE G1 repair): lane rules are
 * keyed by the NATIVE tool class (PERMISSION_TOOL_NAMES) and the derived
 * effect set is keyed by the NATIVE class too (a5p5 effects-schema:
 * `toolName = parsed.tool`); the mounted alias (`team_*`, the GLUE-5 alias
 * ruling) is a mount spelling. All three fast paths resolve BOTH spellings
 * through the single `nativeOf` mapping below — never inside a compare — so
 * a rule and the effect it governs always meet in the same namespace.
 */
export function createLaneDecide(permissionPolicy, planeNames, subtreeContains) {
  const shellTools = new Set(['bash', 'pwsh'])
  // THE single mount-alias <-> native-class mapping point. The native
  // spelling is reserved first: an alias that ever shadowed another class's
  // native name is a config anomaly, and the effect-declaration namespace
  // (native) wins the compare by construction. Before this point existed
  // the fast-path sets below held the MOUNTED aliases while the effect
  // declaration spoke the native class — both fast paths were inert for
  // every plane tool, and a template DENY of the shell class answered
  // nothing: the call landed on the backend face (GAP PROBE G1; the shut
  // face's IO_POLICY_UNSUPPORTED is a LANDING, never deny evidence).
  const nativeClassOf = new Map()
  for (const nativeClass of Object.keys(planeNames ?? {})) nativeClassOf.set(nativeClass, nativeClass)
  for (const [nativeClass, mounted] of Object.entries(planeNames ?? {})) {
    if (typeof mounted === 'string' && mounted !== '' && !nativeClassOf.has(mounted)) nativeClassOf.set(mounted, nativeClass)
  }
  const nativeOf = (name) => {
    const spelling = String(name ?? '')
    return nativeClassOf.get(spelling) ?? spelling
  }
  const bashNames = new Set([nativeOf(planeNames.bash)])
  const fileNames = new Set([nativeOf(planeNames.grep), nativeOf(planeNames.glob)])
  const ruleMatchesResource = (rule, effect) => {
    const res = rule?.resource
    if (res === undefined || res === null || res.kind === 'any') return true
    // Authoritative locator (root mustfix ruling): `canonicalLocator` is the
    // domain's canonical field (domain/tool-governance/src/resource.ts:62;
    // a5p5 effects-schema; the read executor) — it decides the compare. A
    // legacy `locator` shape is read ONLY as a fallback when no canonical is
    // carried; when BOTH are present (even pointing apart), canonical wins
    // and the legacy spelling can never override it. No policy semantics
    // change: this only repairs the backend depth-check's blind spot where
    // canonical-vocabulary effects made an exact rule unmatchable.
    const canonical = typeof effect?.resource?.canonicalLocator === 'string' ? effect.resource.canonicalLocator : undefined
    const locator = canonical ?? (typeof effect?.resource?.locator === 'string' ? effect.resource.locator : undefined)
    if (locator === undefined) return res.kind === 'any'
    if (res.kind === 'exact') return locator === res.path
    if (typeof subtreeContains === 'function') {
      try {
        return subtreeContains(res.path, locator) === true
      } catch {
        return true // containment undeterminable on the deny fast-path = match (tighten, never widen)
      }
    }
    return true // no containment seam: a subtree deny cannot be disproved — match (fail closed)
  }
  const laneDenies = (lane, toolClass, effect) =>
    (Array.isArray(permissionPolicy?.[lane]) ? permissionPolicy[lane] : []).some(
      (rule) => rule?.tool === toolClass && ruleMatchesResource(rule, effect),
    )
  const covered = (lane, toolClass) =>
    (Array.isArray(permissionPolicy?.[lane]) ? permissionPolicy[lane] : []).some((rule) => rule?.tool === toolClass)

  return (effectSet) => {
    const { invokes, fileLike, effects } = classifyEffectSet(effectSet)
    // (a) deny-lane fast path, per effect.
    for (const effect of effects) {
      if (effect?.kind === 'tool-invoke') {
        const name = nativeOf(effect.toolName)
        const toolClass = bashNames.has(name) ? 'bash' : null
        if (toolClass !== null && laneDenies('deny', toolClass, effect)) {
          return { kind: 'deny', code: 'template-deny-lane' }
        }
      } else if (effect?.kind === 'read' || effect?.kind === 'write' || effect?.kind === 'list' || effect?.kind === 'meta') {
        const classes = effect.kind === 'write' ? ['write', 'edit'] : ['read', 'read_image']
        if (classes.some((c) => laneDenies('deny', c, effect))) {
          return { kind: 'deny', code: 'template-deny-lane' }
        }
      }
    }
    // (b) default-deny gate: an invoked plane tool with NO rule coverage at
    // all (neither allow nor ask lane) is unauthorized under a deny-default.
    if (permissionPolicy?.default === 'deny') {
      for (const invoked of invokes) {
        const name = nativeOf(invoked)
        if (bashNames.has(name) && !covered('allow', 'bash') && !covered('ask', 'bash') && !shellToolsDenyOnly()) {
          return { kind: 'deny', code: 'template-default-deny' }
        }
        if (fileNames.has(name) && !['read', 'read_image', 'write', 'edit'].some((c) => covered('allow', c) || covered('ask', c))) {
          return { kind: 'deny', code: 'template-default-deny' }
        }
      }
    }
    void fileLike
    return { kind: 'allow' }
  }

  function shellToolsDenyOnly() {
    const lanes = ['allow', 'ask'].map((lane) => (Array.isArray(permissionPolicy?.[lane]) ? permissionPolicy[lane] : []).some((r) => shellTools.has(String(r?.tool))))
    return lanes.every((x) => x === false)
  }
}

/** The typed shut effect face (see the header honesty note). */
function createShutBackend(backendId) {
  let n = 0
  return {
    backendId,
    run: async () => ({
      ok: false,
      failure: {
        class: 'denied',
        code: 'IO_POLICY_UNSUPPORTED',
        detail: 'the production effect-face adapter for this backend is the registered GLUE-4 follow-up (pb-CONTRACT §6); the gated surface is live, the effect body stays refused — never faked',
      },
    }),
    execCount: () => n,
    lastStageTrace: Object.freeze([]),
  }
}

/**
 * A5-M1-D (diagnostic delta, presentation ONLY): the short safe face of an
 * identity field for a refusal detail — presence, a 12-character prefix with
 * path separators folded, and the length. Never the whole value: a live
 * `bindingId` spans an opaque scope key and a `definitionIdentity` is a digest,
 * and this text is printed into observation streams.
 */
const paIdentityFace = (value) => {
  if (value === undefined) return 'absent'
  if (value === null) return 'null'
  if (typeof value !== 'string') return `non-string(${typeof value})`
  if (value.length === 0) return 'empty-string'
  return `${value.slice(0, 12).replace(/\//g, '\u2215')}\u2026(${String(value.length)} chars)`
}

/**
 * A5-M1-D: WHICH identity requirement the call-level entry actually failed. The
 * refusal it feeds keeps its exact `kind`/`code` and its exact zero side effects
 * — this only replaces a flat "could not be answered" with the arm that is TRUE.
 * `identity-gap=<code>` is the arm AT THIS EDGE (a shape law on the answer);
 * `entry-cause=<code>` is the code the READ itself reported at the source that
 * failed — a code list owned by `pa-mount-registry.mjs`, forwarded verbatim and
 * never re-derived here (this edge cannot see the mount, so it does not try).
 * `entry-cause=none` states the other fact: the read reported no failure of its
 * own, so the gap is in the ANSWER it returned, not in the read.
 * Nothing is invented: an absent answer is named as absent (`undefined`), and
 * WHY a source said nothing belongs to that source's own lane — the code says
 * which source, never a cause that was not observed.
 */
const paBindingIdentityGap = ({ admittedFacts, admittedFactsFault, admittedFactsCause, entryFacts, entryBinding }) => {
  // One face for the read's own report, used by every arm: the code the source
  // named, or the honest statement that it named nothing (which itself tells the
  // reader where to look — the answer, not the read).
  const entryCause = `entry-cause=${admittedFactsCause?.code
    ?? (admittedFacts === undefined ? 'read-reported-nothing' : 'read-reported-no-failure')}`
  const arm = (code, note) => ({
    gap: `identity-gap=${code}${note === undefined ? '' : ` (${note})`} ${entryCause}`,
    summary: '',
  })
  if (admittedFacts === undefined) {
    return admittedFactsFault === undefined
      ? arm('no-answer-object', 'the call-level facts entry returned NO answer object at all (undefined)')
      : arm('answer-threw', `the read THREW: ${admittedFactsFault}`)
  }
  if (admittedFacts.kind !== 'call-facts' && admittedFacts.kind !== 'no-approval-question') {
    return arm('answered-other-kind', `kind=${paIdentityFace(admittedFacts.kind)}; only call-facts / no-approval-question carry facts for a call`)
  }
  if (entryFacts === null || entryFacts === undefined) {
    return arm('facts-not-an-object', `the entry answered kind=${paIdentityFace(admittedFacts.kind)} with facts=${entryFacts === null ? 'null' : 'undefined'}`)
  }
  if (!('binding' in entryFacts)) return arm('binding-key-absent', 'the answered facts carry no binding key at all')
  if (entryBinding === undefined) return arm('binding-undefined', 'the binding key is present and its value is undefined')
  if (entryBinding === null) return arm('binding-null')
  if (typeof entryBinding !== 'object') return arm('binding-not-object', typeof entryBinding)
  const parts = []
  if (typeof entryBinding.bindingId !== 'string') parts.push(`binding-id-not-a-string(${entryBinding.bindingId === undefined ? 'absent' : typeof entryBinding.bindingId})`)
  else if (entryBinding.bindingId.length === 0) parts.push('binding-id-empty')
  if (typeof entryBinding.definitionIdentity !== 'string') parts.push(`definition-identity-not-a-string(${entryBinding.definitionIdentity === undefined ? 'absent' : typeof entryBinding.definitionIdentity})`)
  else if (entryBinding.definitionIdentity.length === 0) parts.push('definition-identity-empty')
  if (typeof entryBinding.revision !== 'number' || !Number.isInteger(entryBinding.revision) || entryBinding.revision < 1) {
    parts.push(`revision-not-in-range(${JSON.stringify(entryBinding.revision) ?? String(entryBinding.revision)})`)
  }
  if (entryBinding.status !== 'ACTIVE') parts.push(`status-not-active(${JSON.stringify(entryBinding.status) ?? String(entryBinding.status)})`)
  const summary = [
    `bindingId=${paIdentityFace(entryBinding.bindingId)}`,
    `definitionIdentity=${paIdentityFace(entryBinding.definitionIdentity)}`,
    `revision=${JSON.stringify(entryBinding.revision) ?? String(entryBinding.revision)}`,
    `status=${JSON.stringify(entryBinding.status) ?? String(entryBinding.status)}`,
    ...(typeof entryBinding.verified === 'boolean' ? [`verified=${String(entryBinding.verified)}`] : []),
    `authorityGeneration=${JSON.stringify(entryBinding.authorityGeneration) ?? String(entryBinding.authorityGeneration)}`,
  ].join(' ')
  return {
    gap: `identity-gap=${parts.join('+')} ${entryCause}`,
    summary,
  }
}

/**
 * Create the per-agent governed tool plane. `input`:
 *  { permissionPolicy, realmId, templateId, role, instanceId,
 *    fs?: { canonicalizeResource?, subtreeContains? },
 *    plane?: { realmId, names?, confinedProvider?, definitionOwnerAuthority?, fsInstance?, globEnabled? },
 *    backends?: { search?, glob?, shell? },            // wiring-kit override point
 *    authorityFacts?: {
 *      overlayGeneration?: (teamSessionId, memberInstanceId) => Promise<number>,   // THE one durable read
 *      ensureAuthorityCurrent?: (teamSessionId, memberInstanceId, generation) => void | Promise<void>, // NAMED assembly-write leg, a SIBLING of the reader — the mount's owner republishes this scope's governed bindings onto the generation the CURRENT admission just read, before its AdmissionRequest is captured
 *    },
 *    onObserve?: (row: string) => void }
 * Returns { ok:true, value: plane } | { ok:false, code, message }.
 * NEVER throws for a policy/config reason — refusals are typed (the mount
 * point maps them to the AgentSetup contract's fail-closed throw).
 */
export function createTeamToolPlaneAssembly(input = {}) {
  const { permissionPolicy, realmId, templateId, role, onObserve } = input
  const observe = (row) => {
    if (typeof onObserve === 'function') onObserve(row)
  }
  if (permissionPolicy === undefined || permissionPolicy === null) {
    return { ok: false, code: 'NOT_GOVERNED', message: 'the tool plane mounts only on a governed (capabilities.permissions-carrying) template — an un-governed agent gets zero mount' }
  }
  if (typeof realmId !== 'string' || realmId === '' || typeof templateId !== 'string' || templateId === '') {
    return { ok: false, code: 'PLANE_CONFIG_INCOMPLETE', message: 'realmId and templateId are required mount inputs' }
  }
  // Gate 0 (pb §1.3): the trust pair, checked BEFORE any construction.
  const pairing = verifyConfinedProviderPairing(input.plane?.confinedProvider)
  if (pairing.ok !== true) return { ok: false, code: pairing.code, message: pairing.message }

  const names = { ...DEFAULT_PLANE_NAMES, ...(input.plane?.names ?? {}) }
  const readName = input.plane?.readName ?? 'read'
  /** U6 PR3: the shell row's mount spelling (native 'bash' takeover or the
   *  managed `team_bash` alias — the SAME row, the SAME mechanism, ONE
   *  Kernel-owned name; Gate 0b validated it above). */
  const bashName = names.bash
  // Gate 0b: the closed mount-name domain, checked BEFORE any construction
  // (natexe ③; see verifyPlaneNames — anomalous names never reach a mount).
  const namesCheck = verifyPlaneNames(names, readName)
  if (namesCheck.ok !== true) return { ok: false, code: namesCheck.code, message: namesCheck.message }

  // u7-w0b S3: the reviewed family set — verified BEFORE any backend is
  // built; a refused set fails the whole mount closed (a silently dropped
  // governed family would let its native tool ride). Each descriptor's
  // closed-world config keys are checked here, in descriptor order, with
  // the refusal grammar the hand-written gates used (a5-globoff's closed
  // `globEnabled` key is now the search descriptor's declared config: absent
  // = true, false = the typed shut face, non-boolean = PLANE_CONFIG_INCOMPLETE).
  const reviewedFamilies = verifyReviewedFamilies({ manifestUrl: FAMILY_MANIFEST_URL, entries: FAMILY_INDEX })
  if (reviewedFamilies.ok !== true) {
    return { ok: false, code: 'PLANE_FAMILY_MANIFEST_REFUSED', message: `the reviewed family set refused: ${reviewedFamilies.detail} (fail closed — no governed family mounts)` }
  }
  for (const descriptor of reviewedFamilies.descriptors) {
    const configured = checkFamilyConfig(descriptor, input.plane)
    if (configured.ok !== true) return { ok: false, code: configured.code, message: configured.message }
  }

  // Gate 0c (jobs variant, B-ACT-1-PR C2): `planeCfg.jobsEnabled` is the
  // SAME-shaped CLOSED CONSUMPTION KEY. ABSENT = FALSE here (a NEW lane has
  // no existing world to keep enabled — the zero-flip law holds by absence:
  // every shipped world keeps the pre-C2 mount shape byte-for-byte); a
  // non-boolean value is a config defect and fails closed on the SAME
  // existing PLANE_CONFIG_INCOMPLETE refusal — never silently coerced.
  const jobsEnabledRaw = input.plane?.jobsEnabled
  if (jobsEnabledRaw !== undefined && typeof jobsEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: `planeCfg.jobsEnabled must be a boolean when present — got ${JSON.stringify(jobsEnabledRaw) ?? String(jobsEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const jobsEnabled = jobsEnabledRaw === true

  // U7-4a (user ruling 2026-10-26, item 2): `planeCfg.backgroundJobs` is the
  // SAME-shaped CLOSED CONSUMPTION KEY for the governed BACKGROUND SPAWN arm
  // on the shell row. ABSENT = FALSE (every shipped world keeps the
  // by-name `background-not-supported` refusal byte-for-byte — the zero-flip
  // law by absence). When TRUE it REQUIRES the closed trio: `jobsEnabled`
  // must be on (a background job the governed trio could not manage would
  // violate the CI-05 delivery law, so the mount is REFUSED, never half-
  // wired) and the trusted entry must have injected the producer at
  // `backends.backgroundJobs` (absent = config defect: the arm exists only
  // with its attribution producer, never as an anonymous spawn lane).
  const backgroundJobsRaw = input.plane?.backgroundJobs
  if (backgroundJobsRaw !== undefined && typeof backgroundJobsRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: `planeCfg.backgroundJobs must be a boolean when present — got ${JSON.stringify(backgroundJobsRaw) ?? String(backgroundJobsRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const backgroundJobs = backgroundJobsRaw === true
  const backgroundProducer = input.backends?.backgroundJobs ?? null
  if (backgroundJobs === true && jobsEnabled !== true) {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: 'planeCfg.backgroundJobs=true requires planeCfg.jobsEnabled=true: a governed background job that the job_list/job_output/job_kill trio could not manage must never be born (fail closed, U7-4a)',
    }
  }
  if (backgroundJobs === true && (backgroundProducer === null || typeof backgroundProducer.accept !== 'function')) {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: 'planeCfg.backgroundJobs=true requires the attribution producer at backends.backgroundJobs (the trusted entry wires it only with the named jobs bridge + live gateway row; an unattributed spawn lane is refused, never mounted — U7-4a)',
    }
  }
  if (backgroundJobs === true && (input.plane?.confinedProvider ?? null) === null) {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: 'planeCfg.backgroundJobs=true requires planeCfg.confinedProvider: the governed background arm is the SAME confined provider row (no provider = no arm to arm — the mount is refused instead of silently keeping the by-name refusal while the key says on — U7-4a)',
    }
  }
  if (backgroundJobs === true && (input.plane?.names?.bash ?? 'team_bash') !== 'bash') {
    // THE CREATING-LANE PIN LAW (frozen law, not renegotiable here): the
    // gateway's creation-lane pin feeds ONLY from the feed-readable name
    // 'bash' — the SHELL-TAKEOVER spelling (u6-pr4 D-group: "the creating
    // lane ('bash') is a placed, feed-readable lane — the law the gateway's
    // C-BIND checks"). A mount that keeps the `team_bash` alias has NO
    // 'bash' placement, so EVERY attribution its producer could attempt
    // would die `mapping-rejected` — jobs born unattributable. That is a
    // half-wired background lane, refused at the mount, never attempted.
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: 'planeCfg.backgroundJobs=true requires planeCfg.names.bash="bash" (the shell-takeover spelling): the creating-lane pin is feed-readable only under the native name, and jobs that could never be ATTRIBUTED must never be born (U7-4a)',
    }
  }

  // 9e fix-3 + A5-M1 (root ruling on the generation seam): ONE durable
  // generation read for this mount, asked FRESH at every point that needs an
  // authority generation — the mount kick, EACH admission's construction, and
  // the execution edge. `paGenerationConfirmed` is never a value that gets
  // CARRIED: it only ever holds what the most recent SUCCESSFUL read answered,
  // and a read that faults or answers a non-generation invalidates it
  // (`undefined`) instead of leaving the previous number in place — a new
  // admission never runs on a generation it did not read this time.
  let paGenerationConfirmed
  const paGenerationReader = input.authorityFacts?.overlayGeneration
  /** The ONE strict durable read. `{ ok: true, value }` only after a
   *  successful read (which also CONFIRMS that exact value for the assembly's
   *  own `authorityGeneration()`); `{ ok: false, detail }` when the read
   *  faulted or answered something that is not a generation — and then the
   *  previously confirmed value is WITHDRAWN, never reused. A mount with no
   *  overlay port has no overlay lane at all: the rev.0 lane, which the
   *  assembly itself answers 0 for (never a value invented here). */
  const paReadGenerationFresh = async () => {
    const read = paGenerationReader
    if (typeof read !== 'function') return { ok: true, value: undefined }
    let g
    try {
      g = await read(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''))
    } catch (error) {
      paGenerationConfirmed = undefined
      return { ok: false, detail: `the durable overlay generation read threw (${String(error?.message ?? error).slice(0, 160)})` }
    }
    if (typeof g !== 'number' || !Number.isFinite(g) || g < 0) {
      paGenerationConfirmed = undefined
      return { ok: false, detail: `the durable overlay generation answered ${JSON.stringify(g) ?? String(g)} — not a generation number (a malformed durable row is never read as generation 0)` }
    }
    paGenerationConfirmed = g
    return { ok: true, value: g }
  }
  const paAuthorityGeneration = () => paGenerationConfirmed
  // A5-M1 (root ruling on the same-turn gap): the NAMED assembly-write leg, a
  // SIBLING of `overlayGeneration` (a read) and never folded into it — a
  // scope-wide binding write arriving through a reader is exactly the disguised
  // write the ruling forbids.
  // WHY IT IS NEEDED: `paAdmitBody` is the ONE funnel every governed call in
  // production passes (the row paths mount `pa: paAdmit`; nothing else reads
  // the mount face), while the assembly boundary that legitimately owns writes
  // (`prepareAgentForRequest`) runs only where a NEW INPUT is delivered. So the
  // 2nd..N-th LLM step of one turn — and any wake that reaches `paAdmit`
  // without a delivery — would capture its AdmissionRequest on a binding the
  // Guard stamped with a generation the durable overlay has already moved past,
  // and the kernel's identity leg (`tool-admission/admission-kernel.ts:245-254`)
  // would refuse it until the next user input. This leg lets the mount's OWNER
  // (agent-bindings, which holds both the ScopedGuardHandle and this mount)
  // republish the generation at the call boundary. THE PLANE NEVER STAMPS A
  // BINDING: it asks, and if nothing is published the call stays unpaired and
  // the kernel refuses it — no re-stamping here to make a pair.
  // IT COSTS NO DURABLE READ: the leg is handed the generation THIS call just
  // read, so an admission still performs exactly one durable read (see
  // `paAdmitBody`), and no value an earlier call read is ever reused.
  // ABSENT leg = no owner mounted to publish (the unit worlds of this file and
  // any world without a Guard): nothing moves, and the identity leg answers.
  const paEnsureAuthorityCurrent = input.authorityFacts?.ensureAuthorityCurrent
  if (typeof paGenerationReader === 'function') {
    void paReadGenerationFresh()
  }
  // Gate 1 (pa §4): the production admission assembly over the REAL policy.
  const built = createProductionAdmissionAssembly({
    permissionPolicy,
    realmId,
    templateId: String(templateId),
    role: role === 'leader' ? 'leader' : 'member',
    // The Team-definition adoption rung (GLUE-5 ruling, pa §4: the blueprint
    // is adopted by the human operator who authored it).
    definitionOwnerAuthority: input.plane?.definitionOwnerAuthority ?? 'human-user',
    clock: () => Date.now(),
    // 9e fix-3: the REAL durable overlay generation. The plane mounts a
    // one-shot preflight read (the SAME `overlay.latest` the decision lane
    // treats as the authority); until it lands, admissions REFUSE (an
    // unanswerable generation is never answered with 0 — the constant here
    // was the fabricated generation the review named). The read resolves
    // once per assembly (a resolved promise keeps admit synchronous-ish);
    // a faulting read stays rejected until the next preflight tick.
    authorityGeneration: () => {
      if (paGenerationReader === undefined) return 0 // rev.0 lane: this world carries NO durable overlay port (the pre-B documented state; production always carries one)
      const g = paAuthorityGeneration()
      if (g === undefined) throw new Error('authority-generation unanswerable (durable overlay read pending/failed; never a constant)')
      return g
    },
    beneficiaryAuthority: role === 'leader' ? 'leader' : 'member',
    ...(input.fs?.subtreeContains === undefined ? {} : { subtreeContains: input.fs.subtreeContains }),
    // U7-6 GLUE-4 (named center-interface PR): the PLANE's row-class law as
    // trusted DATA for the admission projection. The governed SEARCH rows
    // invoke classes the closed rule grammar cannot NAME (grep/glob are not
    // rule tools), so their `tool-invoke` arm must be covered by the SAME
    // law the plane's own `createLaneDecide` already applies — a search row
    // is admitted by a `read`-class rule over its governed surface. Without
    // this the two faces of ONE policy answer the same question
    // differently (the lane allows, the default-deny coverage gate refuses
    // IO_POLICY_UNSUPPORTED). It INVENTS NOTHING: with no `read` rule the
    // search class stays refused; the center carries no tool-name literal —
    // the law lives HERE, in the trusted mount, and the projection consumes
    // it generically (TemplatePolicyProjectionInput.invokeClasses). Review R1
    // F1: the law is BOUNDED by the mount's declared closed row-class world —
    // `knownEffectClasses` lists the effect classes the plane's rows can ever
    // derive that are not nameable by the rule grammar (grep/glob; the shell
    // class bash IS a rule tool so it is named by its own rules and never
    // rides). Without this a stub/typo/attacker-shaped class key could ride a
    // valid read governor and acquire authority; the center now refuses any
    // law key outside this inventory (projection-invoke-class-unknown) and
    // refuses a class law whose world is undeclared (projection-inventory-
    // missing). The world lives HERE with the law, never in the center.
    invokeClasses: { grep: ['read'], glob: ['read'] },
    knownEffectClasses: ['grep', 'glob'],
    onObserve: (row) => observe(`a5p2prod: ${String(row?.event ?? row)}`),
  })
  if (built.ok !== true) {
    return { ok: false, code: String(built.error?.code ?? 'ADMISSION_ASSEMBLY_REFUSED'), message: String(built.error?.message ?? 'production admission assembly refused construction') }
  }
  const assembly = built.value

  // ── M1 CENTER PA WIRING (frozen A; PR355 thin center) ────────────────────
  // THE production admission edge, now ON the body path: every governed row
  // (read / team_bash / grep / glob) walks `admitCall` BEFORE its backend and
  // passes the one-shot execution edge (consumeForExecution: finite clock →
  // validate → consume → lease) before its body. This closes the 9b2 fact
  // "PA constructed, never entered the body".
  // The approval rung is honest about identity: `planApproval().approvalCaseId`
  // is the PA kernel's LOGICAL case id — NOT a durable Control row. A
  // requires-approval outcome is therefore only FUNCTIONAL through an
  // injected real Control leg (AUTH-owned): it must create/reuse the durable
  // request for THIS invocation, await the real decision, present through the
  // trusted presenter, and the returned PresentedApproval is spent via
  // `issueApprovedGrant` + consume below. Without a control leg the call
  // PENDING-REFUSES (zero body, zero backend, never a synchronous allow,
  // never a fake Control row).
  const controlLeg = typeof input.controlLeg === 'function' ? input.controlLeg : null
  // PR358 fix-2 (trusted durable attribution): the PA member identity is
  // the REAL TeamSession root supplied by the host wiring. A synthetic
  // `plane:<template>` fallback would let Control rows live under an id the
  // Control plane does not actually own — refused at mount instead.
  if (input.teamSessionId === undefined || input.teamSessionId === null || String(input.teamSessionId).length === 0) {
    return { ok: false, code: 'TOOL_BINDING_UNVERIFIED', message: 'the PA durable attribution needs the real teamSessionId (host TeamSession root); no synthetic plane:<template> identity is mounted' }
  }
  const paMember = Object.freeze({
    teamSessionId: String(input.teamSessionId),
    instanceId: String(input.instanceId ?? templateId),
  })
  // ── THE rev.0 ROW LANE ONLY (NOT the identity of a governed call) ──
  // Reachable ONLY where no call-level entry is mounted, i.e. worlds that
  // carry no dispatcher surface at all (this file's unit/lane fixtures). It is
  // a row-lane tuple the plane declares for itself — `plane-row:…` is exactly
  // the shape the Control plane does NOT own, so it is never the identity a
  // production call is admitted under: production wires `readCallFacts`
  // unconditionally (agent-bindings), and with that entry mounted the request
  // binding is read from the live surface above. When the live seam IS mounted
  // but the entry cannot answer, the call is refused (TOOL_BINDING_UNVERIFIED
  // at construction, GRANT_STALE at the execution edge) — this tuple is never
  // a fallback for a failed read.
  const bindingCache = new Map()
  const paRev0RowBindingFor = (toolName) => {
    if (!bindingCache.has(toolName)) {
      const parsed = parseToolBinding({
        bindingId: `plane-row:${templateId}:${toolName}`,
        agentScopeKey: `plane:${templateId}`,
        toolName,
        // The plane's own row identity — honest, not a native shadow.
        definitionIdentity: `plane:${templateId}:${toolName}`,
        providerId: 'a5p5-plane',
        implementationOrigin: 'team-trusted-extension',
        executionBoundary: 'confined-subprocess',
        assurance: untestedAssurance('team-trusted-extension', 'confined-subprocess', realmId),
        policyGeneration: 0,
        authorityGeneration: 0,
        revision: 1,
        status: 'ACTIVE',
      })
      if (parsed.ok !== true) throw new Error(`plane PA binding refused (${toolName}): ${JSON.stringify(parsed.problems).slice(0, 200)}`)
      bindingCache.set(toolName, parsed.value)
    }
    return bindingCache.get(toolName)
  }
  // ── A5-M1 (this round) readers: the ONE call-level facts entry ──
  // M1-A deleted the two self-attesting authorities that used to stand here:
  //   * `currentFacts.getPolicy` + the mount-time policy object compared by
  //     canonical JSON against the live PolicyReader (a whole-object JSON
  //     compare is not a call-level fact; the mount answering with its own
  //     closure proves nothing about the policy standing now), and
  //   * `readProviderIdentity()` compared with ITSELF (the same closure read
  //     twice in one expression — an identity that can never differ).
  // What answers instead is the registry's public call-level entry: the
  // CURRENT facts of THIS call (policy projection, deny sources, ceiling,
  // binding entry, durable overlay + authority generation), awaited on both
  // PA paths. `currentFacts` keeps ONLY the activation/placement rollback
  // epoch (M1 ruling: that check is a real fence, not a self-proof).
  const paCurrentFacts = input.currentFacts ?? {}
  // The injected call-level entry (`readPaCallFactsForCall`, agent-bindings
  // wires it): keyed by the CALL identity, so it answers with no Control row
  // too. Absent = this world carries no call-level authority = the final
  // edge refuses (see the execution edge below); it never falls back to a
  // scalar getter or a constant.
  const paReadCallFacts = input.readCallFacts
  // THE plane's own row-name mapping point (the same native-class ↔ mounted-
  // name law `createLaneDecide` documents at the lane face): a call's
  // tool-invoke name resolves to the row THIS plane placed, so a backend
  // spelling (`bash`) reaches the dispatcher placement (`team_bash`) instead
  // of being looked up as a dispatcher key it never was. An unknown spelling
  // answers undefined — the entry lookup then fails closed on the binding
  // family, and no name is ever guessed (M1-D).
  // u7-w0b S3: filled once the seam families are built (below), read at
  // call time — the fixed spellings seam families claim are their own
  // placement names (the U7-9a law, now family-blind).
  const seamPlacementNames = new Set()
  const paPlacementNameOf = (name) => {
    const spelling = String(name ?? '')
    if (spelling.length === 0) return undefined
    if (spelling === readName) return readName
    // U7-9a: the fs MUTATION + IMAGE family mounts at its OWN fixed native
    // spelling (the jobs precedent — never the renamable `names` map, see
    // the mount block below). Measured law (boot u7fsmut3): the read-only
    // special case predates the family — a write/edit/read_image call
    // answered undefined here, the call-level facts entry then refused
    // `no-placement-name`, and the governed call died TOOL_BINDING_
    // UNVERIFIED at the PA edge. Same law as readName above: the spelling
    // IS the placement name; an unmounted row still fails closed one step
    // later (no seed entry on the live surface) — no name is guessed.
    if (seamPlacementNames.has(spelling)) return spelling
    for (const [nativeClass, mounted] of Object.entries(names)) {
      if (nativeClass === spelling || mounted === spelling) return String(mounted)
    }
    return undefined
  }
  // computed lazily at first consume (the row consts initialize below
  // this declaration during mount)
  const paMountRollbackEpoch = typeof paCurrentFacts.getRollbackEpoch === 'function' ? paCurrentFacts.getRollbackEpoch() : undefined

  // PR358-B: the mount's LIVE PA plans (callId → the plan this call walked:
  // approvalCaseId / effect-set fingerprint / per-effect required rungs /
  // the requested effect set). Entries exist only while the call is in this
  // plane and are removed at settle; the map is bounded. This is the
  // `planSnapshot` + `effects` source for the call-level facts adapter —
  // the SAME canonical identity the approval walked, never a re-parse.
  const livePaPlan = new Map()
  const paAdmit = async ({ realmId: callRealm, callId, parametersFingerprint, requestedEffects, toolName = requestedEffects.effects.find((e) => e.kind === 'tool-invoke')?.toolName ?? 'unknown', signal }) => {
    try {
      return await paAdmitBody({ realmId: callRealm, callId, parametersFingerprint, requestedEffects, toolName, signal })
    } finally {
      // the plan fact ends with the call (the settled row's re-verification
      // is answered by its TERMINAL Control state, not by facts carried on)
      livePaPlan.delete(String(callId))
    }
  }
  // A5-M2: ONE PA walk, split at its natural seam so the pre-execute leg can
  // stop at the approval. `paAdmitPartA` is the full PA verification (fresh
  // generation, same-turn authority leg, call-level facts, admitCall, the
  // plan and the DURABLE Control leg whose guard consumption mints the grant);
  // `paAdmitEdge` is the execution edge that used to follow it inline, line
  // for line. `paAdmitBody` runs the two in sequence, exactly as before.
  const paAdmitPartA = async ({ realmId: callRealm, callId, parametersFingerprint, requestedEffects, toolName, signal }) => {
    // 9e-3: THIS call's durable mint (row id + the exact manifest bytes the
    // row carries, handed back by the AUTH leg). Per-call by construction:
    // concurrent calls never see each other's mint.
    let paDurableMint
    // 9e fix-3 + A5-M1: the generation is answerable BEFORE any admission
    // work, and it is read AGAIN for THIS call — never taken from what an
    // earlier call confirmed (the kernel's identity leg compares the binding's
    // generation against THIS assembly's answer, so a carried-over number
    // would admit a call under a generation nobody read for it). A read that
    // faults or answers a non-generation refuses the call here, before
    // admitCall, with zero grant and zero Control row.
    let paCallGeneration
    if (typeof paGenerationReader === 'function') {
      const freshAuthority = await paReadGenerationFresh()
      if (freshAuthority.ok !== true) {
        return {
          kind: 'deny',
          code: 'TOOL_BINDING_UNVERIFIED',
          detail: `this admission opens on no read authority generation — ${freshAuthority.detail}; the previously confirmed value is withdrawn rather than reused`,
        }
      }
      paCallGeneration = freshAuthority.value
    }
    // PR358 fix-4: an invocation ALREADY cancelled never enters governance at
    // all — zero PA consumption, zero Control row. It stays the BACKEND's
    // settled fact: the shell row's frozen spawn-then-terminate witness and
    // the search row's call-aborted refusal are the row's own invocation
    // laws (a5b3 C11/C7), untouched by admission. PA does not swallow or
    // re-render an invocation that stopped existing before it was asked.
    if (signal?.aborted === true) {
      // PR358-A2: a cancelled invocation answers CANCELLED at the PA edge —
      // zero backend, zero Control row, zero consumption. (The a5b3
      // spawn-then-terminate witness legs live BELOW this edge in the
      // backend's own laws; the governance edge no longer forwards a
      // dead invocation into a backend.)
      return { kind: 'allow', cancelled: true }
    }
    // A5-M1 same-turn boundary (root ruling, authorized): ask the mount's OWNER
    // to bring this scope's governed bindings onto the generation THIS call just
    // read — before the call-level entry is asked below, and therefore BEFORE
    // this call captures its `AdmissionRequest`. This is the whole reason the
    // leg exists: the 2nd..N-th LLM step of one turn and every non-delivery wake
    // reach this funnel without passing the request boundary, so a generation
    // that moved mid-turn must land here or the call is refused until the next
    // user input.
    // NO SECOND DURABLE READ: `paCallGeneration` is the number read at the top
    // of this function and nothing else — the leg is served from the read this
    // call already paid for, which is why this seam adds no cache and reuses no
    // value an earlier call confirmed.
    // A leg that faults is OBSERVED, never absorbed: the bindings then still
    // carry the older generation, so this call goes on UNPAIRED and the kernel's
    // identity leg answers it with its own typed refusal. The execution edge
    // further below never calls this leg — a verifier able to publish would
    // repair its own drift instead of reporting it.
    if (typeof paEnsureAuthorityCurrent === 'function' && paCallGeneration !== undefined) {
      try {
        await paEnsureAuthorityCurrent(
          String(input.teamSessionId ?? ''),
          String(input.instanceId ?? ''),
          paCallGeneration,
        )
      } catch (error) {
        observe(`a5m1-authority-leg: ensure-current(g=${String(paCallGeneration)}) threw (${String(error?.message ?? error).slice(0, 160)}) — this call continues UNPAIRED and the kernel identity leg refuses it`)
      }
    }
    // ── A5-M1 (root ruling on 091f56d37): the AdmissionRequest carries the
    // REAL binding this call stands on, read NOW through the ONE public
    // call-level entry — never a synthesized row identity.
    // The trust INPUT is the plane's OWN placement spelling (`paPlacementNameOf`
    // over this plane's `names`/`readName`); the registry resolves it to the
    // UNIQUE verified+ACTIVE carrier of that binding family and answers its
    // live tuple. The durable manifest is NEVER an input to this read (the
    // row's bindingId is only COMPARED at the final edge below): a correct
    // manifest may never be a precondition for reading the real binding —
    // that is the circularity the ruling forbids.
    // Unanswerable here = this call has NO verifiable binding identity at all,
    // so it is refused with the kernel's own identity code BEFORE any
    // admission work: zero admitCall, zero grant, zero Control row, zero body.
    // THE PAIRING LAW (root ruling, not bent here): the live tuple carries the
    // DISPATCHER's generations (`tool-dispatch/install.ts:1149-1164` — the real
    // number the Guard was installed with, and what a refresh republishes),
    // while the admission kernel's identity leg compares
    // `binding.authorityGeneration` against THIS assembly's durable overlay
    // generation (`tool-admission/admission-kernel.ts:245-254`, kept EXACT).
    // Both sides come from the ONE durable reader in agent-bindings, and the
    // owner republishes the bindings onto each call's fresh number through the
    // leg above. Where no owner published (no leg, or the leg faulted) the pair
    // simply does not hold and the kernel's own refusal
    // (`authority-generation-drift`) answers: the plane states the real tuple
    // verbatim and never re-stamps a generation to make a pair.
    const placementName = paPlacementNameOf(toolName)
    let paRequestBinding = paRev0RowBindingFor(toolName)
    let paConstructionBinding
    if (typeof paReadCallFacts === 'function') {
      let admittedFacts
      let admittedFactsFault
      let admittedFactsCause
      try {
        admittedFacts = await paReadCallFacts({
          rootSessionId: paMember.teamSessionId,
          instanceId: paMember.instanceId,
          realmId: callRealm,
          callId,
          requestedEffects,
          ...(placementName === undefined ? {} : { placementName }),
          // A5-M1-D: the read's CAUSE SINK. It is output-only by construction —
          // the source calls it on the arm it is already taking, and this edge
          // feeds it to nothing but the refusal text below: the admission inputs
          // are unchanged, the answer is unchanged, and the verdict is computed
          // from the answer exactly as before. `??=` keeps the FIRST (and only)
          // report so a sink cannot accumulate a story the read never told.
          diagnose: (cause) => { admittedFactsCause ??= cause },
        })
      } catch (error) {
        // The answer stays EXACTLY what it was (undefined ⇒ the refusal below,
        // same path, same verdict); only the FACT that the read itself faulted is
        // remembered, so the detail can say that instead of leaving "could not be
        // answered" ambiguous between a silent no-answer and a throw.
        admittedFacts = undefined
        admittedFactsFault = String(error?.message ?? error).slice(0, 180)
      }
      const entryFacts = admittedFacts?.kind === 'call-facts' || admittedFacts?.kind === 'no-approval-question'
        ? admittedFacts.facts
        : undefined
      const entryBinding = entryFacts?.binding
      if (
        entryBinding === null || typeof entryBinding !== 'object'
        || typeof entryBinding.bindingId !== 'string' || entryBinding.bindingId.length === 0
        || typeof entryBinding.definitionIdentity !== 'string' || entryBinding.definitionIdentity.length === 0
        || typeof entryBinding.revision !== 'number' || !Number.isInteger(entryBinding.revision) || entryBinding.revision < 1
        || entryBinding.status !== 'ACTIVE'
      ) {
        const { gap, summary } = paBindingIdentityGap({
          admittedFacts, admittedFactsFault, admittedFactsCause, entryFacts, entryBinding,
        })
        // Same facts, same words, one line earlier in the row's own stream: a
        // refusal that only exists in a wire the client may truncate is a refusal
        // nobody can attribute after the fact.
        observe(`a5m1-binding-refused: placement=${String(placementName ?? toolName ?? '?')} ${gap}`)
        return {
          kind: 'deny',
          code: 'TOOL_BINDING_UNVERIFIED',
          detail: `the live dispatcher binding behind this call (${String(placementName ?? toolName ?? '?')}) could not be answered by the call-level facts entry: ${gap}${summary === '' ? '' : ` [entry carried ${summary}]`} — no admission, no grant, and no Control row is opened on an identity that was never read (never a synthesized \`plane-row:\` stand-in)`,
        }
      }
      paConstructionBinding = entryBinding
      paRequestBinding = entryBinding
    }
    const request = Object.freeze({
      binding: paRequestBinding,
      member: paMember,
      callId,
      realmId: callRealm,
      parametersFingerprint,
      requestedEffects,
    })
    const admitted = await assembly.admitCall(request)
    if (admitted.ok !== true) {
      return { kind: 'deny', code: String(admitted.error?.code ?? 'ADMISSION_CALL_REFUSED'), detail: String(admitted.error?.message ?? 'admitCall refused') }
    }
    const decision = admitted.value
    if (decision.kind === 'denied') {
      return { kind: 'deny', code: String(decision.error?.code ?? 'ADMISSION_DENIED'), detail: String(decision.error?.message ?? '') }
    }
    let grant = null
    if (decision.kind === 'admitted') {
      grant = decision.grant
    } else {
      // requires-approval — only a durable Control leg makes this functional.
      const planned = assembly.planApproval(request)
      if (planned.ok !== true) {
        return { kind: 'deny', code: 'APPROVAL_PLAN_REFUSED', detail: String(planned.error?.message ?? '') }
      }
      livePaPlan.set(String(callId), Object.freeze({
        approvalCaseId: String(planned.value.approvalCaseId),
        effectSetFingerprint: String(planned.value.effectSetFingerprint),
        perEffectRequired: planned.value.perEffectRequired,
        requestedEffects,
      }))
      if (livePaPlan.size > 2000) livePaPlan.delete(livePaPlan.keys().next().value)
      if (controlLeg === null) {
        observe(`pa-ask pending-refused call=${callId} paCaseId=${planned.value.approvalCaseId} — logical case id is not a durable Control request; no control leg is mounted`)
        return { kind: 'deny', code: 'APPROVAL_REQUEST_UNAVAILABLE', detail: `PA logical case ${planned.value.approvalCaseId} needs a durable Control request; none is mounted (pending never runs)` }
      }
      // The leg implements the FROZEN obligations in full: durable Control
      // request create/reuse → real decision → trusted presenter →
      // `issueApprovedGrant` landing → durable `guardOperation` consumption —
      // and returns the MINTED grant. The center mints nothing on this path:
      // a bare decision boolean (or an approval without a landed grant) is a
      // contract violation, refused. Landing/verify ownership sits with the
      // AUTH bridge (operation-permission/pa-control-bridge.ts), not here.
      const leg = await controlLeg({ realmId: callRealm, member: paMember, callId, request, plan: planned.value, assembly, ...(signal === undefined ? {} : { signal }) })
      // fix-4: a cancellation that lands DURING the approval wait means the
      // invocation is gone — zero PA consumption, zero body. Whatever the
      // Control row already did stays truthfully as-is (never unwound,
      // never re-spent here).
      if (signal?.aborted === true) {
        // The invocation fact outranks the approval fact: a cancelled call
        // reports `cancelled`, not a governance refusal (it was not denied —
        // it stopped existing). Zero PA consumption either way.
        return { kind: 'allow', cancelled: true }
      }
      if (leg?.decision !== 'approve' || leg.approval === undefined || leg.approval === null) {
        return { kind: 'deny', code: leg?.decision === 'deny' ? 'APPROVAL_DENIED' : 'APPROVAL_NOT_RESOLVED', detail: `durable Control request ${String(leg?.requestId ?? 'uncreated')} answered ${String(leg?.decision ?? 'unsettled')}` }
      }
      if (leg.grant === undefined || leg.grant === null) {
        return { kind: 'deny', code: 'APPROVAL_LEG_INCOMPLETE', detail: `request ${String(leg.requestId ?? 'uncreated')} returned an approval without a landed+guard-consumed grant; the frozen Control/PA leg is more than a decision boolean` }
      }
      grant = leg.grant
      // 9e-3: the durable mint rides to the final edge (the row's exact
      // manifest identity — what the verifier will parse), plus the row id.
      paDurableMint = { requestId: String(leg.requestId ?? ''), manifest: leg.manifest }
    }
    // Part A is complete: a grant exists and (on the ask lane) a real Control
    // guard consumed the approval that minted it. Nothing past this line runs
    // on a pre-execute leg — the hand-off stops here with the grant in hand.
    return { ok: true, grant, paDurableMint, request, placementName, paConstructionBinding }
  }

  // U6 PR2 (read) / U6 PR3 (read + shell, ONE kernel): the plane's center
  // assembly (filled AFTER construction, before any call — the edge/guard
  // closures below read the binding at CALL time). `kernelPortAnswers` is
  // the per-call capture beside the consume port (see the port wrapper):
  // with ONE kernel owning BOTH the read and the shell placement, two
  // concurrent consumes (one per name) must never read each other's port
  // answer, so the capture is keyed by callId, not one shared slot (a PR3
  // correctness fix of the PR2 single-slot, which could only ever race
  // same-name calls).
  let centerKernel = null
  const kernelPortAnswers = new Map()

  const paAdmitEdge = async ({ grant, paDurableMint, request, placementName, paConstructionBinding, realmId: callRealm, callId, parametersFingerprint, requestedEffects, signal }) => {
    // THE execution edge (one-shot): fresh clock/generation recheck, consume,
    // optional lease. Every failure below is zero-body by construction.
    if (signal?.aborted === true) {
      return { kind: 'allow', cancelled: true }
    }
    let freshGeneration = 0
    let freshRevision = 1
    // ── A5-M1 C: the execution edge is answered ONLY by fresh call-level facts ──
    // After any approval wait (and on the all-allow path, which waits
    // nothing) the plane AWAITS the public call-level entry — the SAME read
    // the Control verifier's adapter shares — and verifies THIS call against
    // the whole answer, never a picked-out scalar:
    //  · row path (ask): the standing approval must still answer the
    //    question that was approved (the assembly's own plan/verify
    //    semantics re-run over the current policy: same case, same effect
    //    set, same per-effect rungs — anything else would widen the approval
    //    retroactively);
    //  · no-row path (all-allow): the FULL effect set must still be allow on
    //    the CURRENT projected policy (the pure-core expansion plane over
    //    the facts' policyDocument), not one generation number and not a
    //    whole-object JSON compare of a policy reader.
    // Any failure, drift, or unanswerable source is GRANT_STALE with zero
    // body. The grant never proves its own "current"; the last confirmed
    // generation is never carried over to this edge, and no constant (0/1)
    // ever answers (M1-A deleted the self-attesting getters, M1-D deleted
    // the single-name entry lookup).
    const stale = (detail) => ({ kind: 'deny', code: 'GRANT_STALE', detail })
    const paFactsSeamMounted = typeof paReadCallFacts === 'function'
    const paEpochSeamMounted = paCurrentFacts.getRollbackEpoch !== undefined
    if (paFactsSeamMounted || paEpochSeamMounted) {
      // (1) the activation/placement fence (retained per ruling: a real
      //      epoch read of the host's own fence, not a closure proving
      //      itself).
      if (paEpochSeamMounted) {
        const nowEpoch = typeof paCurrentFacts.getRollbackEpoch === 'function' ? paCurrentFacts.getRollbackEpoch() : paMountRollbackEpoch
        if (nowEpoch !== paMountRollbackEpoch) {
          return stale('the placement/activation epoch rolled between admission and execution; this call is stale and runs nothing')
        }
      }
      if (!paFactsSeamMounted) {
        return stale('no call-level facts entry is mounted for this plane, so the current authority of this call cannot be answered; the rev.0/revision-1 law is never applied to a governed mount that carries a live-facts seam')
      }
      // (2) the ONE durable generation source is re-read HERE, for this call:
      // a read that faults or answers nothing refuses the call — the last
      // CONFIRMED value is never carried over the execution edge.
      let durableGenerationNow
      if (typeof paGenerationReader === 'function') {
        const freshDurable = await paReadGenerationFresh()
        if (freshDurable.ok !== true) {
          return stale(`the durable authority generation could not be re-read at the execution edge (${freshDurable.detail}); the previously confirmed value is never carried over, and this call runs nothing`)
        }
        durableGenerationNow = freshDurable.value
      }
      // (3) await the CURRENT call-level facts for THIS call — the SAME read
      // the request's binding was taken from, asked the SAME question: the
      // call identity plus the plane's OWN placement spelling. Nothing from
      // the durable row is an input here (the row's bindingId is compared
      // AFTERWARDS, never used to go looking for the binding — reading the
      // real binding through the manifest would make the manifest the
      // authority and the read a formality).
      const rowBindingId = paDurableMint?.manifest?.binding?.bindingId
      let answer
      let answerCause
      try {
        answer = await paReadCallFacts({
          rootSessionId: paMember.teamSessionId,
          instanceId: paMember.instanceId,
          realmId: callRealm,
          callId,
          requestedEffects,
          ...(placementName === undefined ? {} : { placementName }),
          // Same output-only sink as the construction read: the STALE path below
          // says which source refused to answer NOW, which is the whole question
          // when a grant was minted and the world moved under it.
          diagnose: (cause) => { answerCause ??= cause },
        })
      } catch {
        answer = undefined
      }
      const facts = answer?.kind === 'call-facts' || answer?.kind === 'no-approval-question' ? answer.facts : undefined
      if (facts === undefined) {
        return stale(`no complete call-level facts could be read for this call (entry-cause=${answerCause?.code ?? (answer === undefined ? 'read-reported-nothing' : 'read-reported-no-failure')}) — the entry answers undefined for ANY missing or contradicting source, and coverage is never assumed`)
      }
      // (3a) the row's own manifest, COMPARED (post-read) against the live
      // family the entry answered: an approval written under another binding
      // family is not this call's approval.
      if (typeof rowBindingId === 'string' && rowBindingId.length > 0 && facts.binding?.bindingId !== rowBindingId) {
        return stale(`the Control row was written under binding '${rowBindingId}', but the live carrier of this call's placement is '${String(facts.binding?.bindingId)}' — the approval covers a binding this call does not stand on`)
      }
      // (3b) construction ↔ execution drift: the tuple the AdmissionRequest
      // was built from must still be the tuple standing now (the same
      // field-by-field law the Control verifier applies to a durable row).
      if (paConstructionBinding !== undefined) {
        for (const field of ['bindingId', 'agentScopeKey', 'toolName', 'definitionIdentity', 'providerId', 'implementationOrigin', 'executionBoundary', 'status', 'policyGeneration', 'authorityGeneration', 'revision']) {
          if (facts.binding?.[field] !== paConstructionBinding[field]) {
            return stale(`the binding behind this call moved between admission and execution (${field}: ${JSON.stringify(paConstructionBinding[field])} → ${JSON.stringify(facts.binding?.[field])}) — the call was admitted as the binding IT WAS, and a moved identity is re-assembly, not consumption`)
          }
        }
        if (canonicalJsonFingerprint(facts.binding?.assurance) !== canonicalJsonFingerprint(paConstructionBinding.assurance)) {
          return stale('the binding assurance cell moved between admission and execution — the assurance this call was admitted under is not the assurance standing now')
        }
      }
      if (facts.realmId !== callRealm) {
        return stale(`the call-level facts answer for realm '${String(facts.realmId)}', not this call's '${callRealm}' — these are not this call's facts`)
      }
      if (facts.member?.teamSessionId !== paMember.teamSessionId || facts.member?.instanceId !== paMember.instanceId) {
        return stale('the durable member attribution in the current facts is not this call\'s — a grant is never spendable for another member')
      }
      if (facts.effects?.fingerprint !== undefined && facts.effects.fingerprint !== requestedEffects.fingerprint) {
        return stale(`the effect set the facts carry (${String(facts.effects?.fingerprint)}) is not this call's (${String(requestedEffects.fingerprint)}) — the answer is about a different operation`)
      }
      if (!Number.isInteger(facts.authorityGeneration) || facts.authorityGeneration < 0) {
        return stale('the fresh facts carry a malformed authority generation — a constant or fractional generation is exactly the synthesized source the facts contract forbids')
      }
      if (durableGenerationNow !== undefined && facts.authorityGeneration !== durableGenerationNow) {
        return stale(`the plane's confirmed generation (${String(facts.authorityGeneration)}) and this call's durable re-read (${String(durableGenerationNow)}) disagree — sources that contradict each other answer no coverage question`)
      }
      if (typeof facts.binding?.revision !== 'number' || facts.binding.revision < 1) {
        return stale('the unique dispatcher binding behind this call carries no usable revision — the entry is unanswerable, so the call is stale (M1-D: never a name lookup, never the constant 1)')
      }
      if (answer.kind === 'call-facts') {
        // THE row path: the approval that exists must still be the approval
        // for the question standing NOW. `walked` is the identity THIS call
        // planned (the same canonical object the Control row was written
        // over); the facts' planSnapshot is the plane's current answer, and
        // the assembly's plan/verify semantics re-run over the CURRENT
        // projection — three views of one question, and any pair that
        // disagrees refuses.
        const walked = livePaPlan.get(String(callId))
        if (walked === undefined) {
          return stale('the approval this call waited on has no live plan any more — the question it answered is gone, and its grant is not spendable')
        }
        const snap = facts.planSnapshot
        if (snap === undefined || snap.approvalCaseId !== walked.approvalCaseId || snap.effectSetFingerprint !== walked.effectSetFingerprint) {
          return stale(`the approved question moved between the approval and this edge (approved ${String(walked.approvalCaseId)}/${String(walked.effectSetFingerprint)}, the plane now answers ${String(snap?.approvalCaseId)}/${String(snap?.effectSetFingerprint)}) — an approval covers the question AS APPROVED`)
        }
        let recheck
        try {
          recheck = assembly.planApproval(request)
        } catch (error) {
          recheck = { ok: false, error: { message: String(error?.message ?? error) } }
        }
        if (recheck.ok !== true) {
          return stale(`the approved effect set has no approvable path on the CURRENT authority any more (${String(recheck.error?.message ?? 'plan refused')}); consuming this grant would answer a question nobody approved`)
        }
        if (recheck.value.approvalCaseId !== walked.approvalCaseId || recheck.value.effectSetFingerprint !== walked.effectSetFingerprint) {
          return stale(`the approval case identity moved (${String(walked.approvalCaseId)} → ${recheck.value.approvalCaseId}) — the standing grant covers the question it was issued for, never its successor`)
        }
        if (recheck.value.perEffectRequired.length !== walked.perEffectRequired.length
          || recheck.value.perEffectRequired.some((rung, i) => rung !== walked.perEffectRequired[i])) {
          return stale('the per-effect rungs this approval covers are not the rungs standing now — consuming would widen the approval retroactively')
        }
        if (snap.perEffectRequired.length !== recheck.value.perEffectRequired.length
          || snap.perEffectRequired.some((rung, i) => rung !== recheck.value.perEffectRequired[i])) {
          return stale('the call-level sources disagree about the CURRENT question (the plane\'s live plan versus the assembly\'s re-derivation over the current policy) — no consumption happens on contradictory facts')
        }
      } else {
        // THE all-allow path (no Control row was ever minted): the WHOLE set
        // must still be allow under the CURRENT projected policy. The pure
        // core's expansion plane over the fresh facts answers exactly the
        // question "does the policy still decide every effect of this set as
        // allow" — a set that now needs an approval, or that went
        // undetermined, is stale by construction (a default flip included).
        let expansion
        try {
          expansion = input.fs?.subtreeContains === undefined
            ? evaluateEffectSetExpansion(facts.effects, facts.realmId, facts.policyDocument)
            : evaluateEffectSetExpansion(facts.effects, facts.realmId, facts.policyDocument, input.fs.subtreeContains)
        } catch (error) {
          return stale(`the current policy could not be re-evaluated over the fresh facts (${String(error?.message ?? error)}); fail closed without consuming`)
        }
        if (expansion.unapprovable !== null) {
          return stale(`the effect set is no longer decided by the current policy (effect ${String(expansion.unapprovable.effectIndex)}: ${String(expansion.unapprovable.detail)}) — an undetermined set is never an allowed set`)
        }
        if (expansion.needsApproval.length > 0) {
          return stale(`fresh policy re-verification moved ${String(expansion.needsApproval.length)} effect(s) of this set out of the allow lane; this call was admitted without an approval and none exists — it runs nothing`)
        }
      }
      freshGeneration = facts.authorityGeneration
      freshRevision = facts.binding.revision
    }
    if (signal?.aborted === true) {
      return { kind: 'allow', cancelled: true }
    }
    const consumeFacts = {
      ...(signal === undefined ? {} : { cancelRequested: signal.aborted === true }),
      currentAuthorityGeneration: freshGeneration,
      member: paMember,
      callId,
      realmId: callRealm,
      bindingId: grant.bindingId,
      bindingRevision: freshRevision,
      parametersFingerprint,
      requestedEffects,
    }
    // U6 PR2 (port binding, PR1-open-1) / U6 PR3 (ARC-B: the SAME edge for
    // BOTH owned families) / U6 PR4 (ARC-C: the trio rides the SAME edge —
    // ONE ownership predicate, no name-pair list here either): a
    // KERNEL-OWNED placement consumes its one-shot grant through the
    // kernel's consumeOnce — replay-guarded BEFORE the port (double replay:
    // kernel set + durable ledger, both refusals, neither ever un-spends),
    // and a kernel outside ACTIVE refuses the edge outright (drain/tombstone
    // semantics). The port wrapper captured the FULL legacy answer for THIS
    // call, so every live deny code (APPROVAL_STALE /
    // TOOL_BINDING_UNVERIFIED / …) rides the unchanged mapping below. A
    // name the kernel does not own keeps the direct edge byte-for-byte.
    let edge
    if (centerKernel !== null && centerKernel.guard.owns(placementName)) {
      const grantId = typeof grant?.grantId === 'string' ? grant.grantId : ''
      const captureKey = String(callId)
      kernelPortAnswers.delete(captureKey)
      const verdict = await centerKernel.kernel.consumeOnce(grant, grantId, consumeFacts)
      const captured = kernelPortAnswers.get(captureKey)
      kernelPortAnswers.delete(captureKey)
      edge = verdict.portCalled && captured !== undefined
        ? captured
        : {
            ok: false,
            error: {
              code: String(verdict.code ?? 'GRANT_CONSUMPTION_REFUSED'),
              message: String(verdict.detail ?? 'the kernel refused the one-shot consumption'),
            },
          }
    } else {
      edge = assembly.consumeForExecution(grant, consumeFacts)
    }
    if (edge.ok !== true) {
      return { kind: 'deny', code: String(edge.error?.code ?? 'GRANT_CONSUMPTION_REFUSED'), detail: String(edge.error?.message ?? '') }
    }
    return { kind: 'allow' }
  }

  const paAdmitBody = async (input) => {
    const opened = await paAdmitPartA(input)
    if (opened.ok !== true) return opened
    return await paAdmitEdge({
      ...input,
      grant: opened.grant,
      paDurableMint: opened.paDurableMint,
      request: opened.request,
      placementName: opened.placementName,
      paConstructionBinding: opened.paConstructionBinding,
    })
  }
  // A5-M2 lifecycle halves of the SAME walk, for the governed-read row's
  // pre-dispatch hand-off (the row owns the token→correlation law and the
  // one-shot flight; the plane owns the walk). A caller that does not use
  // them keeps `paAdmit` above, unchanged.
  // The same toolName normalization `paAdmit` itself applies — the hand-off
  // entries are the SAME walk, never a second vocabulary for the call.
  const paHandoffToolName = (requestedEffects) => requestedEffects?.effects?.find((e) => e.kind === 'tool-invoke')?.toolName ?? 'unknown'
  paAdmit.open = async (input) => {
    let opened
    try {
      opened = await paAdmitPartA({ ...input, toolName: input.toolName ?? paHandoffToolName(input.requestedEffects) })
    } catch (error) {
      // ② a Part A that THREW handed nothing off, so its plan fact dies with
      // it — the same law the non-approved return below carries. There was no
      // finally here, so a throw used to leave the fact in `livePaPlan` while
      // the mount kept serving calls.
      livePaPlan.delete(String(input.callId))
      throw error
    }
    if (opened.ok !== true) {
      // A leg that never handed off ends here: its plan fact dies with it,
      // exactly as `paAdmit`'s own finally ends the plan fact of a completed
      // call. An APPROVED leg must keep it — the execution edge re-reads it.
      livePaPlan.delete(String(input.callId))
      return opened
    }
    // 'approved' says ONLY: the full PA effect-set question was answered and a
    // real Control guard consumed the Ask. It is NOT a consumption — the grant
    // is unspent and the body still owes the whole execution edge.
    return {
      kind: 'approved',
      grant: opened.grant,
      paDurableMint: opened.paDurableMint,
      request: opened.request,
      placementName: opened.placementName,
      paConstructionBinding: opened.paConstructionBinding,
    }
  }
  // ② the redemption leg's own close handle: the row holds the correlation
  // after it takes the flight, and ends this call's plan fact from its own
  // finally (idempotent with the wrapper above).
  paAdmit.closePlan = (callId) => { livePaPlan.delete(String(callId)) }
  paAdmit.edge = async (state) => {
    try {
      return await paAdmitEdge({
        ...state,
        toolName: state.toolName ?? paHandoffToolName(state.requestedEffects),
        placementName: state.placementName,
        paConstructionBinding: state.paConstructionBinding,
      })
    } finally {
      // the redemption is the end of this call's plan fact (the same law
      // `paAdmit`'s finally carries for the un-split path)
      livePaPlan.delete(String(state.callId))
    }
  }

  // Gate 2: the C-FS production provider (pa §1.2/§4). ABSENT fsInstance
  // (no governed file root declared by the row) = no provider — the search
  // face stays behind its typed refusal, no implicit root is invented.
  let fsProvider
  if (input.plane?.fsInstance !== undefined && input.plane.fsInstance !== null) {
    try {
      fsProvider = createProductionControlledFsProvider({
        realmId,
        instances: [input.plane.fsInstance],
        clock: () => Date.now(),
        authorityGeneration: () => 0,
        consumed: assembly.consumed,
        ...(input.fs?.subtreeContains === undefined ? {} : { subtreeContains: input.fs.subtreeContains }),
      })
    } catch (error) {
      return { ok: false, code: 'CFS_PROVIDER_REFUSED', message: String(error?.message ?? error) }
    }
  }

  // The reviewed Definitions (pb §2: decide REQUIRED).
  const decide = createLaneDecide(permissionPolicy, names, input.fs?.subtreeContains)
  const shut = createShutBackend('a5-effect-face-pending')
  // GLUE-7 PRODUCTION BACKEND ASSEMBLY (glue only — `plane-effect-backends`
  // rides the implementations this repo already ships: the confined Process
  // provider for the shell class, the W5-round REAL read-only search for the
  // grep class, the governed anchored read for the fs class; GLOB has no
  // production-wired implementation and stays the typed shut row — never
  // smuggled onto the search backend. The confined-rg glob candidate of the
  // scope-probe round (createAnchoredGlobBackend, still exported for the
  // integration round) was assessed CANDIDATE-A and FAILED the security
  // re-review for a name-class leak (verify->launcher string-chdir window
  // + the provider runtime_base '/' READ_DIR grant: outside NAMES can
  // surface, bytes never — re-review measured 3/10700). HISTORICAL — that
  // reading is 2026-10-17's, against the PRE-#323 launcher whose `odir("/")`
  // stood at c2be086a:176/:331; that launcher is NOT in this tree, and the
  // current-state wording below carries the narrowed values. It ships NOTHING:
  // wiring removed, factory archived (glue7/glob/, marked 未入产); the glob
  // integration rides the standalone 093aaded face + a runtime_base
  // narrowing layer in its own round. A real backend appears ONLY where the row
  // configured its governed anchor: no `fsInstance` = no fs-class backend,
  // no `confinedProvider` = no shell backend — the closed world invents
  // nothing, and unconfigured rows keep the shut landing byte-for-byte.
  // An explicit `backends` row (the wiring-kit seam) still wins outright.
  const fsInstance = input.plane?.fsInstance ?? null
  const confinedCfg = input.plane?.confinedProvider ?? null
  // Backend-observation echo: production rows in this repo log their
  // assembly facts to stdout in the shipped `[dsh-agent-team]` style
  // (`remote mount: MOUNTED` is the precedent). The echo exists ONLY for
  // the configured real-backends rows — an unconfigured plane never
  // builds these handles, so every existing world stays byte-identical.
  const logBackend = (prefix) => (row) => {
    const line = `${prefix}: ${String(row)}`
    observe(line)
    // `.mjs` lint law: no ambient `console` global in this file family
    // (the shipped [dsh-agent-team] log lines live in host.TS); the
    // standard global object is the honest route.
    globalThis.console?.log(`[dsh-agent-team] ${line}`)
  }
  const realShell = confinedCfg !== null
    ? createConfinedShellBackend({
      realmId,
      templateId: String(templateId),
      instanceId: String(input.instanceId ?? templateId),
      cwdRoot: typeof fsInstance?.rootDir === 'string' ? fsInstance.rootDir : input.plane?.workingDir,
      confined: confinedCfg,
      observe: logBackend('a5g7-shell'),
      // U7-4a: the governed background arm — present ONLY when both closed
      // keys said on AND the trusted entry injected its producer (validated
      // above; absent otherwise, byte-for-byte). The arm is THIS SAME
      // provider row, not a second executor.
      ...(backgroundJobs === true
        ? { background: { enabled: true, accept: (ctx) => backgroundProducer.accept(ctx) } }
        : {}),
    })
    : null
  const hostedShell = input.backends?.shell ?? realShell ?? shut
  // u7-w0b S3: the capability object EVERY seam-mounted family receives —
  // enumerated in family-assembly.mjs (CAPABILITY_KEYS) and frozen; it
  // carries no kernel, registry, approval or grant handle. Families
  // contribute their backends first (shared set), then build rows over it.
  // The mount-resolved host services (the seam families reach them through `cap.hostService`). `mount(agentCtx)`
  // binds them; until then (and in worlds with no such service) every
  // lookup answers undefined and the row refuses with the native sentence.
  const hostServices = { ctx: undefined }
  const hostService = (name) => {
    try {
      return typeof hostServices.ctx?.get === 'function' ? hostServices.ctx.get(name) : undefined
    } catch {
      return undefined
    }
  }
  const familyBackends = { shell: hostedShell }
  const familyCapabilities = (backends) => makeFamilyCapabilities({
    realmId,
    templateId: String(templateId),
    instanceId: String(input.instanceId ?? templateId),
    callIdPrefix: `team-${String(input.instanceId ?? templateId)}`,
    planeConfig: Object.freeze({ ...(input.plane ?? {}) }),
    names,
    readName,
    fsInstance,
    confinedCfg,
    permissionPolicy,
    subtreeContains: input.fs?.subtreeContains,
    decide,
    pa: paAdmit,
    backends: Object.freeze({ ...backends }),
    presentationFace: PLANE_PRESENTATION_FACE,
    transport: Object.freeze({ createGovernedToolDefinitions, createGovernedShellRowDefinition }),
    logBackend,
    createShutBackend,
    hostService: (name) => hostService(name),
    hostPin: PLANE_RESERVED_NATIVE_HOST_PIN,
    injected: Object.freeze({ ...(input.backends ?? {}) }),
  })
  const seamFamilies = []
  for (const descriptor of reviewedFamilies.descriptors) {
    const cap = familyCapabilities(familyBackends)
    const enabled = descriptor.enabled(cap) === true
    seamFamilies.push({ descriptor, enabled })
    if (enabled && typeof descriptor.backends === 'function') Object.assign(familyBackends, descriptor.backends(cap))
  }
  for (const entry of seamFamilies) {
    if (!entry.enabled) continue
    const cap = familyCapabilities(familyBackends)
    const claims = entry.descriptor.claims(cap)
    const built = entry.descriptor.build(cap)
    if (built?.refused !== undefined) return { ok: false, code: built.refused.code, message: built.refused.message }
    const checked = checkBuiltFamily(entry.descriptor, claims, built)
    if (checked.ok !== true) {
      return { ok: false, code: entry.descriptor.refusalCode, message: `the ${entry.descriptor.familyId} assembly was refused before registration: ${checked.detail} (fail closed)` }
    }
    entry.claims = Object.freeze([...claims])
    entry.built = built
  }
  // The host REGISTRATION law (packages/core/tools: every registerable tool
  // must declare output { schema, render }) is an INSTALLER face: the a5p5
  // lane deliberately ships name/description/parameters/execute ONLY. The
  // assembly adds exactly that missing presentation face; seam families add
  // it through `cap.presentationFace`.
  // U6 PR3: the bash arm of the trio is NO LONGER the mounted path — the
  // shell row joins the Kernel as the process family's contribution, built
  // through the family row face (the a5p5 ONE makeExecute; byte-identical
  // execute behavior, own per-assembly ledger state exactly like a fresh
  // trio build). The lane's trio face stays untouched for every other
  // consumer; the CENTER only stops placing its bash arm (the old path —
  // a kernel-unowned shell row — is deleted here, no dual keep at any
  // slice). The filter is by the VALIDATED mount spelling, one name, one
  // placement (Gate 0b already refused any collision).
  const bashRowDef = Object.freeze({
    // U6 PR3 (dormancy law, a5p5-dormant-audit): the Family lane NEVER
    // touches the dormant a5p5 lane — the plane is that lane's ONE reviewed
    // consumer, so the row's execute transport is INJECTED here, through the
    // reviewed barrel edge (one line, form-pinned). The lane owns the
    // placement contract; the reviewed registration face owns the transport.
    ...buildBashRowDefinition({
      realmId,
      decide,
      pa: paAdmit,
      shellBackend: hostedShell,
      names: { bash: names.bash },
      callIdPrefix: `team-${String(input.instanceId ?? templateId)}`,
    }, createGovernedShellRowDefinition),
    output: PLANE_PRESENTATION_FACE,
  })
  // u7-w0b S3: the PA placement spelling of every seam-claimed name IS the
  // placement name; at most one family may offer the PA read hand-off.
  for (const entry of seamFamilies) {
    if (entry.enabled) for (const n of entry.claims) seamPlacementNames.add(n)
  }
  const seamHandoffs = seamFamilies.filter((e) => e.enabled && e.built.handoff !== undefined)
  if (seamHandoffs.length > 1) {
    return { ok: false, code: 'PLANE_FAMILY_MANIFEST_REFUSED', message: `more than one family offers the PA read hand-off (${seamHandoffs.map((e) => e.descriptor.familyId).join(', ')}) — fail closed` }
  }
  const seamHandoff = seamHandoffs[0]?.built.handoff
  // u7-w0b S3: seam rows place around the shell row in descriptor
  // `placement` order (historical: search rows, shell row, fs rows).
  const placedSeam = seamFamilies
    .filter((e) => e.enabled)
    .sort((a, b) => a.descriptor.placement - b.descriptor.placement)
  const SHELL_ROW_PLACEMENT = 20
  const seamDefsBefore = placedSeam.filter((e) => e.descriptor.placement < SHELL_ROW_PLACEMENT).flatMap((e) => e.built.definitions)
  const seamDefsAfter = placedSeam.filter((e) => e.descriptor.placement > SHELL_ROW_PLACEMENT).flatMap((e) => e.built.definitions)
  const defs = Object.freeze([
    ...seamDefsBefore,
    bashRowDef,
  ])

  // GLUE-5/C2 JOBS-MANAGEMENT ROW (B-ACT-1-PR): the three host `job_*`
  // management tools, takeover-mounted at FIXED native spellings behind the
  // closed `jobsEnabled` key (ABSENT = no rows at all — zero flip). The
  // effect body is the INJECTED bridge (glue wires gateway fence → host
  // `ctx.get('jobs')` public face); U6 PR4 (ARC-C) the row DEFINITIONS and
  // the bridge itself live in `jobs-family-bridge.mjs` — `buildJobsManagementRowDefs`
  // carries the moved-verbatim trio (the host tool-jobs spellings AT THE
  // PIN, packages/jobs/tool-jobs/src/index.ts :311-400 @639ed01539: same-name
  // SAME-MEANING is the natexe claim law this row satisfies; the
  // dispatch-provided caller (`exec.agent?.id`, exactly what the host tool
  // passes) never gets invented: an unnamed caller is refused by the bridge,
  // never queried unfiltered). With no bridge the rows land on the honest
  // typed shut face (existing IO_POLICY_UNSUPPORTED grammar, zero new error
  // surface — the mount gate is config law, not wiring); there is NO native
  // fallback lane and the shut rows are NOT registered on the kernel (a
  // bridgeless mount contributes no jobs candidate at all).
  const jobsBridge = input.backends?.jobs ?? null
  const jobsShut = createShutBackend('a5-jobs-bridge-pending')
  const shutJobsText = async () => {
    const r = await jobsShut.run({})
    return { text: `refused: ${String(r.failure.code)} — ${String(r.failure.detail)}` }
  }
  const jobsDefs = jobsEnabled === true
    ? buildJobsManagementRowDefs({ jobsBridge, shutJobsText, PLANE_PRESENTATION_FACE })
    : []

  const baseDefs = Object.freeze([
    ...defs,
    ...seamDefsAfter,
  ])
  // The jobs rows ride the SAME placement/feed/dispose machinery as every
  // other row (their def#N identities mint through the seam's install pass
  // like the rest); zero-flip law: with the key off this is byte-identical
  // to `allDefs = baseDefs`.
  const allDefs = jobsDefs.length === 0 ? baseDefs : Object.freeze([...baseDefs, ...jobsDefs])

  // THE PROVIDER-SIDE PLACEMENT RECORD (pb §6): one feed entry per placed
  // name, resolved LAZILY from the same definition objects that mount
  // below — the Guard's `bindingFeed` reads exactly this map. Resolution is
  // deliberately at LOOKUP time, not build time: the `def#N` identity is
  // minted by the public seam's fingerprint pass (install.ts), which runs
  // AFTER plane construction and per session — an eager snapshot was
  // measured (live kit run-5, TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED)
  // handing the Guard `undefined` and failing a legitimate team.create.
  // A name whose definition the seam has not minted (never installed
  // through it) has NO feed row — the Guard then lands its verbatim
  // no-feed refusal: fail closed, never a guessed identity.
  const placedByName = new Map(allDefs.map((d) => [d.name, d]))

  // ── U6 PR2/PR3/PR4: the CENTER ASSEMBLY for the governed families (ENFORCING)
  // ONE kernel owns this placement's approval table for ALL governed
  // families — the FS read row (PR2), the PROCESS shell row (PR3, ARC-B:
  // "read and bash share the same Kernel state transition trace… different
  // Executors but the same decision/settlement path",
  // center-assembly-architecture §10.2), and the JOBS named bridge (PR4,
  // ARC-C: the same trace extended to a PROVIDER-BACKED family — admission,
  // grant and consume through the SAME edges, the bridge body owning no
  // approval state at all). The kernel is built whenever the
  // plane assembles: the shell row ALWAYS mounts, so the enforcing kernel —
  // with the dispatcher's lifecycle port or nothing (FIX-K K3 / R-REM-2.2;
  // no self-count fallback, no native fallback) — is required by EVERY
  // governed mount. The FAMILY registers each row through the PR1 closed
  // schema (origin 'reviewed-manifest' — this plane is a reviewed assembly
  // point, not a dynamic source; cond 9); a registration refusal means that
  // row is NOT verifiable and the whole assembly FAILS CLOSED (the retired
  // center paths do not come back — dual-keep is forbidden). The kernel's
  // ports are bound HERE at the trusted seam (PR1-open-1); the family lanes
  // never see any of it (familyFace carries no authority, CI-06).
  const registry = createGovernedFamilyRegistry({
    kernelManifest: { capabilities: {
      'process-spawn': { backsExecution: 'family-body' },
      ...reviewedFamilies.kernelCapabilities,
      // U6 PR4 (ARC-C): the jobs-management capability is backed ONLY by a
      // named bridge — the schema refuses (CAPABILITY_UNBACKED /
      // NAMED_BRIDGE_REQUIRED) any contribution claiming a family body for
      // it. There is no self-attested jobs executor on this mount.
      'jobs-management': { backsExecution: 'named-bridge' },
    } },
  })
  const kernelFamilies = { shell: false, jobs: false }
  // u7-w0b S3: the seam-mounted families register in descriptor `order`,
  // around the families still hand-wired below (historical kernel-ledger
  // order: fs 10 → process 20 → search 30 → jobs 40). Origin is set by the
  // plane, never by a family; a refusal fails the whole assembly closed
  // with that family's own typed code.
  const SHELL_FAMILY_ORDER = 20
  const registerSeam = (inBand) => {
    for (const entry of [...seamFamilies].sort((a, b) => a.descriptor.order - b.descriptor.order)) {
      if (!entry.enabled || !inBand(entry.descriptor.order)) continue
      const registered = registry.register(entry.built.contribution, { origin: 'reviewed-manifest' })
      if (registered.ok !== true) {
        return {
          ok: false,
          code: entry.descriptor.refusalCode,
          message: `the ${entry.descriptor.familyId} contribution was refused by the closed schema (${registered.code}: ${registered.detail}) — an unverified family row mounts nowhere (fail closed; a retired center path does not come back)`,
        }
      }
    }
    return null
  }
  const seamRegisteredFirst = registerSeam((order) => order < SHELL_FAMILY_ORDER)
  if (seamRegisteredFirst !== null) return seamRegisteredFirst
  // U6 PR3: the process/shell contribution. CI-07: the descriptor NAMES the
  // reviewed confined process provider this row's execution drives, and the
  // mount's launcher pin rides the bound digests — a provider-pin change is
  // a DIFFERENT contribution (STALE on the next reviewed mount, never a
  // silently inherited approval). The Gate 0c trustRoot⇄launcher pairing
  // above stays the mount's law, validated BEFORE this point.
  {
    const shellContribution = buildProcessShellContribution({
      definition: bashRowDef,
      launcherPin: typeof confinedCfg?.assembly?.launcherSha256 === 'string'
        ? confinedCfg.assembly.launcherSha256
        : undefined,
      cancelBoundary: 'the confined shell executor terminates the payload through the provider\'s frozen lease arm on timeout and on the host abort signal; the settle race answers exactly one of {exit, timedOut, cancelled} (tie law exited > timedOut > aborted), the drain never re-decides it, and a payload whose stop could not be confirmed is reported UNCERTAIN (truncated/not-observed), never as a clean end (a5b3 laws, U6 PR3)',
    })
    const shellRegistered = registry.register(shellContribution, { origin: 'reviewed-manifest' })
    if (shellRegistered.ok !== true) {
      return {
        ok: false,
        code: 'PLANE_PROCESS_REGISTRATION_REFUSED',
        message: `the process family contribution was refused by the closed schema (${shellRegistered.code}: ${shellRegistered.detail}) — an unverified family row mounts nowhere (fail closed; the retired center shell path does not come back)`,
      }
    }
    kernelFamilies.shell = true
  }
  const seamRegistered = registerSeam((order) => order > SHELL_FAMILY_ORDER)
  if (seamRegistered !== null) return seamRegistered
  // U6 PR4 (ARC-C): the jobs contribution — the mount's FIRST named bridge.
  // Registered ONLY when the closed key says on AND a real bridge body is
  // injected: a bridgeless `jobsEnabled` mount keeps the honest typed shut
  // rows (zero-effect refusals) and contributes NO kernel candidate (a
  // shut face has no execution to back; registering one would be
  // self-attestation). With a bridge, registration is fail-closed like the
  // others; the descriptor's digests bind the bridge body, the trio rows
  // and the host pin, and `execution.via='named-bridge'` names THIS bridge.
  if (jobsEnabled === true && jobsBridge !== null) {
    const jobsContribution = buildJobsBridgeContribution({
      bridge: jobsBridge,
      definitions: jobsDefs,
      hostPin: PLANE_RESERVED_NATIVE_HOST_PIN,
      cancelBoundary: 'job management is REQUEST-only through the host public face: job_kill maps to JobRegistry.kill, which answers \'requested\' | \'already-finished\' @639ed01539 — the bridge marks the gateway REQUEST and never settles cancellation (the Host settles it; a job that keeps running is reported as still running); job_output\'s wait arm is abort-signal-aware and returns without settling on timeout; the trio performs no process termination of its own (B-ACT-1-PR C2 laws, U6 PR4)',
    })
    const jobsRegistered = registry.register(jobsContribution, { origin: 'reviewed-manifest' })
    if (jobsRegistered.ok !== true) {
      return {
        ok: false,
        code: 'PLANE_JOBS_REGISTRATION_REFUSED',
        message: `the jobs bridge contribution was refused by the closed schema (${jobsRegistered.code}: ${jobsRegistered.detail}) — an unverified bridge mounts nowhere (fail closed; the un-attributed host trio is left native, this governed lane does not come back)`,
      }
    }
    kernelFamilies.jobs = true
  }
  // u7-w0b S3: the names the seam families keep kernel-owned — the claims
  // of every ENABLED family, plus the declared `disabledOwned` names of a
  // DISABLED one (those refuse before the body, never ride native).
  const seamOwned = new Set(seamFamilies.flatMap((e) => (e.enabled
    ? e.claims
    : e.descriptor.disabledOwned(familyCapabilities(familyBackends)))))
  // The mount-time claim table (u7-w0b S2): which registered candidate
  // claims which native name, read once from the registered descriptors.
  const mountClaims = claimTableOf(registry)
  // FIX-K K4 (R-REM-2.1): every kernel call site below carries the
  // mount's scopeKey — the scoped resolution this plane IS (the same
  // `teamRoot:instanceId` law the shadow row audits under). Name-only
  // authority no longer exists anywhere on this path.
  const kernelScopeKey = `${String(input.teamSessionId ?? '')}:${String(input.instanceId ?? templateId ?? '')}`
  let kernel
  try {
    kernel = createGovernanceKernel({
      registry,
      // R-REM-2.2: ENFORCING, with the dispatcher's lifecycle port when
      // the assembly point wires one (production: the Guard handle's
      // pendingCalls ledger — the dispatcher's own in-flight count);
      // without any port the kernel FACTORY throws (FIX-K K3) and this
      // mount fails closed below — it never degrades to a shadow.
      mode: 'enforcing',
      ports: {
        lifecycle: input.dispatcherLifecycle,
        grantConsume: {
          // THE PR2 PORT BINDING (PR1-open-1), PR3-generalized: kernel →
          // tool-admission one-shot face. Synchronous under the wrapper (no
          // await between reading facts and consuming — the one-shot +
          // cancel-first laws depend on run-to-completion); the FULL legacy
          // answer is captured beside the call, KEYED BY CALLID, so the
          // live deny codes/messages survive the kernel's narrower verdict
          // shape (the kernel only reads ok/reason) even when the read row
          // and the shell row consume concurrently on the ONE kernel.
          consumeForExecution: async (grant, facts) => {
            const answer = assembly.consumeForExecution(grant, facts)
            kernelPortAnswers.set(String(facts?.callId ?? ''), answer)
            return answer.ok === true
              ? { ok: true }
              : {
                  ok: false,
                  reason: `${String(answer.error?.code ?? 'GRANT_CONSUMPTION_REFUSED')}:${String(answer.error?.details?.refusal ?? '')}`,
                }
          },
        },
      },
    })
  } catch (buildError) {
    return {
      ok: false,
      code: 'PLANE_KERNEL_UNAVAILABLE',
      message: `the center kernel refused to build (an enforcing kernel requires the lifecycle port — FIX-K K3): ${String(buildError?.message ?? buildError)} — no governed row mounts (fail closed; the retired center paths do not come back)`,
    }
  }
  const published = kernel.publish()
  if (published.ok !== true) {
    return {
      ok: false,
      code: 'PLANE_KERNEL_UNAVAILABLE',
      message: `the center kernel could not enter ACTIVE (${published.code}: ${published.detail}) — no approval entry can back the governed rows`,
    }
  }
  centerKernel = {
    registry,
    kernel,
    scopeKey: kernelScopeKey,
    families: Object.freeze(kernelFamilies),
    guard: Object.freeze({
      // ARC-B (PR2/PR3) + PR4/PR5: the kernel owns ALL governed mount names
      // on the ONE table — read, shell, BOTH search rows (grep + glob), and
      // the jobs trio when (and only when) the named-bridge contribution
      // registered on this mount; install.ts's pre-body table gate and
      // post-success drift veto then treat every name through the SAME
      // code path (data, not new branches; §10.2's trace law is family-
      // count independent by design).
      owns: (name) => typeof name === 'string' && (
        name === bashName || seamOwned.has(name)
        || (kernelFamilies.jobs === true && JOBS_MANAGEMENT_NAMES.includes(name))
      ),
      identityFor: (name) => {
        if (typeof name !== 'string') return null
        const entry = ensureApprovalEntry(name)
        return entry === null ? null : entry.definitionIdentity
      },
    }),
  }

  // The bind-ONCE law, scope- and candidate-bound (FIX-K K1/K4, R-REM-2.1),
  // written ONCE for every governed family (u7-w0b S2 — see
  // approval-entry-binder.mjs): the entry binds at the FIRST lookup-time
  // consult (the pb §6 mint law is untouched) as a (scopeKey, nativeName)
  // entry bound to the candidate that CLAIMS the name on this mount — the
  // familyId comes from the registered descriptor, never from a caller. The
  // kernel snapshots the binding's generation + source digest and
  // revalidates it on EVERY read; the attempt is never repeated within a
  // mount, so when that revalidation later invalidates the binding (revoke,
  // re-registration, generation or source-digest drift) the feed goes
  // SILENT and the Guard's no-feed refusal lands BEFORE the body. A lookup
  // never re-mints authority and a re-registration never resurrects one —
  // only the next reviewed assembly mount (a fresh kernel) approves.
  const ensureApprovalEntry = createApprovalEntryBinder({
    approvalFor: (scopeKey, name) => kernel.approvalFor(scopeKey, name),
    bindEntry: (entry) => kernel.addApprovalEntry(entry),
    scopeKey: kernelScopeKey,
    claimOf: (name) => mountClaims.get(name),
    placedDefinition: (name) => placedByName.get(name),
    identityOf: definitionIdentityOf,
  })

  const placementFeed = (name) => {
    const d = placedByName.get(name)
    if (d === undefined) return undefined
    if (centerKernel !== null && centerKernel.guard.owns(name)) {
      // U6 PR2 (cond 1/2/6), PR3-generalized (ARC-B), PR4-extended (ARC-C):
      // for EVERY kernel-OWNED name — read, shell, and the registered jobs
      // trio — the approval TABLE is the identity source. The entry binds
      // ONCE, lazily, at first consult — the def#N mint still rides the
      // seam's install pass (the pb §6 lookup-time law is untouched). It is
      // NEVER silently re-bound: when a later live resolution disagrees with
      // the table, this feed keeps answering the TABLE identity and the
      // Guard's own live-vs-feed comparison refuses (cond 6: an identity
      // mismatch never executes).
      const entry = ensureApprovalEntry(name)
      return entry === null
        ? undefined
        : Object.freeze({ definitionIdentity: entry.definitionIdentity, realmId })
    }
    const identity = definitionIdentityOf(d)
    return identity === null ? undefined : Object.freeze({ definitionIdentity: identity, realmId })
  }

  return {
    ok: true,
    value: {
      fsProvider,
      definitions: allDefs,
      /** The mounted model-facing names — the own-layer bind list. */
      ownNames: Object.freeze(allDefs.map((d) => d.name)),
      decide,
      /** M1 CENTER PA WIRING: the async production edge every row now walks
       *  (exposed for the acceptance kit's legs; the rows call it themselves). */
      paAdmit,
      /** A5-M2: the governed-read hand-off face for THIS mount. The plane
       *  stores nothing here: the row holds the token-keyed flight and the
       *  correlation law, and the adapter's `tools/result` observer is what
       *  drives open/close. A mount that carries NO governed read row does not
       *  declare the field at all — it is omitted, NOT set to `undefined`, so a
       *  consumer that decides by field presence reads "this plane never offers
       *  the capability" rather than "it offered one and broke". A mount that
       *  DOES declare it keeps the fail-closed law: whatever it holds reaches
       *  the adapter and a broken one refuses the install. Every other world
       *  and every other name keeps the old path. */
      ...(seamHandoff === undefined ? {} : { paReadHandoff: Object.freeze({
        open: async (exec) => {
          if (exec === null || typeof exec !== 'object') return { kind: 'no-match' }
          if (exec.name !== seamHandoff.name) return { kind: 'no-match' }
          const token = exec.token
          if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) {
            // The name IS this mount's governed read, so the effect-set question
            // belongs to PA: with no execution identity the call REFUSES, it
            // never falls back to the pre-hand-off lane.
            return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_UNBOUND', detail: 'this governed read carries no execution token, so no PA hand-off can be opened or redeemed for it' }
          }
          return await seamHandoff.open(exec.arguments, {
            token,
            ...(exec.signal === undefined ? {} : { signal: exec.signal }),
          })
        },
        close: (exec) => {
          const correlation = seamHandoff.close(exec === null || typeof exec !== 'object' ? undefined : exec.token)
          if (typeof correlation === 'string') livePaPlan.delete(correlation)
        },
      }) }),
      /** PR358-B: the mount's live PA plans (see `livePaPlan` above). */
      livePaPlan,
      /** 9e fix-3: the CONFIRMED durable generation reader (the root's
       *  currentFacts consumer answers through it; unconfirmed stays
       *  undefined — never a 0). */
      authorityGeneration: paAuthorityGeneration,
      /** The production admission assembly (planApproval/issueApprovedGrant
       *  are the AUTH-owned durable-Control landing edges; the plane mounts
       *  NO fake approvals — controlLeg is injected, never invented here). */
      governance: assembly,
      /** PR358-B: the SAME assembly under its real name (the call-level
       *  facts adapter reads policyDocument()/denySources() from it). */
      assembly,
      /** GLUE-7: the plane's realm (the feed's pairing key) and the real
       *  backend handles (diagnostics: execCount / lastRuns / lastOutcomes). */
      realmId,
      backends: Object.freeze({
        ...placedSeam.filter((e) => e.descriptor.placement < SHELL_ROW_PLACEMENT).reduce((acc, e) => ({ ...acc, ...(e.built.diagnostics ?? {}) }), {}),
        shell: hostedShell,
        ...placedSeam.filter((e) => e.descriptor.placement > SHELL_ROW_PLACEMENT).reduce((acc, e) => ({ ...acc, ...(e.built.diagnostics ?? {}) }), {}),
      }),
      /** pb §6 provider-side feed: (name) -> {definitionIdentity, realmId} (the seam's flat BindingFeedEntry). */
      placementFeed,
      placementNames: Object.freeze(allDefs.map((d) => d.name)),
      /**
       * U6 PR2 ENFORCEMENT WIRING (install.ts seam, no new Host hook): the
       * kernel guard port for kernel-owned names. The Guard's IDENTITY law
       * is NOT restated here — install.ts already (a) binds the placement
       * identity from the §6 feed (which for the owned name now answers from
       * the kernel's approval TABLE), (b) re-verifies live resolution against
       * the binding before dispatch, and (c) aborts in-flight calls on a
       * tools/change drift. This port adds exactly the two table-backed
       * verdicts the seam asks for: `owns(name)` selects the enforcing
       * posture (post-success drift becomes a fail-closed veto instead of the
       * armed-once alarm), `identityFor(name)` answers the ONE identity the
       * table binds (null = unbound name → nothing may execute under it).
       * A plane without the governed read row OMITS the field entirely —
       * presence is the capability signal, same law as paReadHandoff.
       */
      ...(centerKernel !== null
        ? { kernelGuard: centerKernel.guard }
        // REVIEW-R1 B2 (CI-05), PR3-generalized: a governed mount that
        // reached this line WITHOUT a center kernel is an impossible state
        // (the kernel is required by every mount and its build failure
        // refuses the assembly) — the defensive face stays for honesty:
        // the plane claims BOTH governed names with a table answering NULL
        // forever, so the Guard's pre-body table gate refuses every read
        // and every shell call BEFORE any effect. Never a silent native
        // ride.
        : {
            kernelGuard: Object.freeze({
              owns: (name) => typeof name === 'string' && (name === bashName || seamOwned.has(name)),
              identityFor: () => null,
            }),
          }),
      /** U6 PR2 diagnostics/tests: the plane's center assembly (kernel +
       *  registry faces; observation only — no authority crosses here). */
      ...(centerKernel === null ? {} : { centerKernel: Object.freeze({
        kernel: centerKernel.kernel,
        registry: centerKernel.registry,
        scopeKey: centerKernel.scopeKey,
        // U6 PR3 (ARC-B), PR4-extended (ARC-C), PR5-completed: ONE kernel,
        // up to FOUR registered families when all rows mounted. The PR2
        // surface's single `familyId` named the only family there was; the
        // honest generalization is the list of the families THIS mount
        // registered, in registration order.
        familyIds: Object.freeze(registry.view().candidates
          .filter((c) => c.state !== 'tombstoned')
          .map((c) => c.familyId)),
      }) }),
      /**
       * RA ② invariant 1+3: THIS function performs the placement. Any
       * register failure rolls back what it already placed and returns the
       * typed failure — the caller MUST fail the assembly.
       */
      mount: (agentCtx) => {
        // U7-9a: the governed read_image row's TWO host seams resolve
        // through the mount's agent ctx — `ctx.get('attachments')` /
        // `ctx.get('llm')` are the SAME public host seams the native tool
        // executes through (read-image.ts:125/251 @639ed01539). Binding
        // happens HERE (the mount owns the ctx lifecycle); lookups are
        // lazy per call; anything unanswerable stays undefined and the row
        // answers the native-shaped refusal — the family holds no store,
        // no delete face, and no bypass.
        hostServices.ctx = agentCtx
        const disposers = []
        for (const def of allDefs) {
          try {
            const disposer = agentCtx.tools.register(def)
            disposers.push(disposer)
          } catch (error) {
            for (const d of disposers.reverse()) {
              try {
                if (typeof d === 'function') d()
                else if (typeof d?.dispose === 'function') d.dispose()
              } catch {
                /* rollback best-effort: the assembly fails regardless */
              }
            }
            observe(`a5-plane: placement-REFUSED name=${def.name} (${String(error?.message ?? error).slice(0, 160)}) — unknown attribution fails closed`)
            return { ok: false, code: 'PLANE_PLACEMENT_CONFLICT', name: def.name, message: String(error?.message ?? error) }
          }
        }
        observe(`a5-plane: placed [${allDefs.map((d) => d.name).join(',')}]`)
        return {
          ok: true,
          dispose: () => {
            // A5-M2: no hand-off survives its mount — claimed or not, the
            // flight, the unspent grant and the plan fact die with the
            // placement (teardown law, independent of the terminal observer).
            for (const entry of seamFamilies) {
              if (entry.enabled) entry.built.teardown?.()
            }
            // U6 PR2: the kernel's lifecycle rides its mount — drain,
            // tombstone, revoke the candidate, release (observations of the
            // §5 state machine; every transition is best-effort and each
            // refusal leaves the state machine honest, never throws).
            if (centerKernel !== null) {
              try {
                centerKernel.kernel.beginDrain()
                centerKernel.kernel.tombstone()
                // U6 PR3 (ARC-B), PR5-completed: the ONE kernel drains ALL
                // family candidates it registered — each revoke/drop pair is
                // the deterministic invalidation that family's mount owes
                // (FIX-K K1: a later re-registration never resurrects an
                // approval).
                if (centerKernel.families.shell === true) {
                  centerKernel.registry.revoke('dsh.process-family', 'the governed shell mount was disposed')
                  centerKernel.kernel.dropApprovalsForFamily('dsh.process-family')
                }
                for (const entry of seamFamilies) {
                  if (!entry.enabled) continue
                  centerKernel.registry.revoke(entry.descriptor.familyId, `the governed ${entry.descriptor.familyId} mount was disposed`)
                  centerKernel.kernel.dropApprovalsForFamily(entry.descriptor.familyId)
                }
                // U6 PR4 (ARC-C): the jobs bridge family drains with the
                // SAME deterministic law — revoke the candidate, drop its
                // trio entries from the ONE table; a re-registration (the
                // next reviewed mount, a fresh kernel) never resurrects one.
                if (centerKernel.families.jobs === true) {
                  centerKernel.registry.revoke('dsh.jobs-family', 'the governed jobs bridge mount was disposed')
                  centerKernel.kernel.dropApprovalsForFamily('dsh.jobs-family')
                }
                centerKernel.kernel.release()
              } catch {
                /* idempotent drain best-effort — the plane tears down anyway */
              }
            }
            livePaPlan.clear()
            // U7-9a: the image row's host seams die with the mount — a
            // torn-down mount can no longer reach the store or the route.
            hostServices.ctx = undefined
            for (const d of disposers) {
              try {
                if (typeof d === 'function') d()
                else if (typeof d?.dispose === 'function') d.dispose()
              } catch {
                /* idempotent drain best-effort */
              }
            }
          },
        }
      },
    },
  }
}
