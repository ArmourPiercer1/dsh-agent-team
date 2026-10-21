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
import { createGovernedToolDefinitions } from '../../../../tools/a5p5-tools/src/index.js'
import { createProductionAdmissionAssembly } from '../../../tool-admission/index.js'
import { createProductionControlledFsProvider } from '../../../controlled-fs/src/index.js'
import { definitionIdentityOf } from '../../../tool-dispatch/index.js'
import { createAnchoredSearchBackend, createConfinedShellBackend, createGovernedReadExecutor, READ_ROW_LINE_CAP } from './plane-effect-backends.mjs'
import { createAnchoredGlobBackend } from './glob-backend.mjs'

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

// ── The read row's OWN presentation face (Alpha.5 READ slice, plan T1) ─────
// The trio face above is untouched; the `read` row moves to the pin639
// native result contract, mirrored LOCALLY (no host import — the same law the
// host `read` tool carries at packages/fs/tool-fs/src/read.ts:86-105 (schema),
// :107-120 (render-state recomputation), :173-192 (presentResult), :230-245
// (readMetaFromMeta) and read-render.ts:152-170 (formatReadOutput footers)).
// Mirror, not import: the host module sits behind its own public tool, and
// the governed row's face must stay a plugin-local artifact.
const READ_ROW_ENVELOPE = /^<path>[^\n]*<\/path>\n<type>file<\/type>\n<content>\n([\s\S]*)\n<\/content>$/u

/** Mirror of formatReadOutput (read-render.ts:152-170), byte-verbatim
 *  footers: the capped state carries NO "of Z"; partial shows "of T"; EOF
 *  says "End of file - total T lines". */
function formatReadRowOutput(displayPath, outcome) {
  const endLine = outcome.lines.at(-1)?.number ?? Math.max(0, outcome.offset - 1)
  let footer
  if (outcome.truncatedByBytes === true) {
    footer = `(Output capped. Showing lines ${String(outcome.offset)}-${String(endLine)}. Use offset=${String(endLine + 1)} to continue.)`
  } else if (endLine < outcome.totalLines) {
    footer = `(Showing lines ${String(outcome.offset)}-${String(endLine)} of ${String(outcome.totalLines)}. Use offset=${String(endLine + 1)} to continue.)`
  } else {
    footer = `(End of file - total ${String(outcome.totalLines)} lines)`
  }
  const body = outcome.lines.length > 0
    ? `${outcome.lines.map((line) => `${String(line.number)}: ${line.text}`).join('\n')}\n\n${footer}`
    : footer
  return `<path>${displayPath}</path>\n<type>file</type>\n<content>\n${body}\n</content>`
}

/** The render-side effective limit (replay-tolerant mirror of the executor's
 *  E2 law clamped to the cap; NEVER throws on a hostile replay — the refusal
 *  law was the executor's at call time; the face only re-derives display
 *  state). */
function readRowEffectiveLimit(args) {
  const raw = args?.limit
  if (typeof raw === 'number' && Number.isFinite(raw) && Number.isInteger(raw) && raw >= 1 && raw <= READ_ROW_LINE_CAP) return raw
  return READ_ROW_LINE_CAP
}

/** Mirror of readMetaFromMeta (read.ts:230-245): every malformed shape —
 *  non-object, bad scalars, non-increasing or out-of-range line numbers, a
 *  non-string lang — DECLINES to undefined. Never throws. */
function readRowMetaFromMeta(meta) {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const { path, offset, lines, totalLines, lang } = meta
  if (typeof path !== 'string' || typeof offset !== 'number' || typeof totalLines !== 'number') return undefined
  if (!Number.isInteger(offset) || offset < 1) return undefined
  if (!Number.isInteger(totalLines) || totalLines < 0) return undefined
  if (!Array.isArray(lines) || !lines.every((line) => typeof line === 'object' && line !== null && !Array.isArray(line)
    && typeof line.number === 'number' && Number.isInteger(line.number) && line.number >= 1
    && typeof line.text === 'string')) return undefined
  if (lang !== undefined && typeof lang !== 'string') return undefined
  let previous = offset - 1
  for (const { number } of lines) {
    if (number <= previous || number > totalLines) return undefined
    previous = number
  }
  return { path, offset, lines, totalLines, ...(lang === undefined ? {} : { lang }) }
}

const READ_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      path: Object.freeze({ type: 'string' }),
      offset: Object.freeze({ type: 'integer' }),
      lines: Object.freeze({
        type: 'array',
        items: Object.freeze({
          type: 'object',
          properties: Object.freeze({
            number: Object.freeze({ type: 'integer' }),
            text: Object.freeze({ type: 'string' }),
          }),
          required: Object.freeze(['number', 'text']),
          additionalProperties: false,
        }),
      }),
      totalLines: Object.freeze({ type: 'integer' }),
    }),
    required: Object.freeze(['path', 'offset', 'lines', 'totalLines']),
    additionalProperties: false,
  }),
  /** Render the four-field window into the pin639 read envelope. The
   *  capped/partial/EOF state is RECOMPUTED here exactly as the host render
   *  does (read.ts:107-120): `truncatedByBytes = lines.length <
   *  effectiveLimit && endLine < totalLines` — the executor's result never
   *  carries the flag (S6), so a stale flag can never lie. */
  render: (args, value) => {
    const lines = Array.isArray(value?.lines) ? value.lines : []
    const offset = typeof value?.offset === 'number' ? value.offset : 1
    const totalLines = typeof value?.totalLines === 'number' ? value.totalLines : 0
    const path = typeof value?.path === 'string' ? value.path : ''
    const effectiveLimit = readRowEffectiveLimit(args)
    const endLine = lines.length > 0 ? Number(lines[lines.length - 1]?.number ?? offset) : Math.max(0, offset - 1)
    const truncatedByBytes = lines.length < effectiveLimit && endLine < totalLines
    return [{
      type: 'text',
      text: formatReadRowOutput(path, {
        offset, lines, totalLines, ...(truncatedByBytes ? { truncatedByBytes: true } : {}),
      }),
    }]
  },
  /** The card meta (read.ts presentationMeta): exactly the four fields —
   *  NO lang (the governed row never sniffs a language; honest elision,
   *  plan S7). */
  presentationMeta: (_args, value) => ({
    path: value.path,
    offset: value.offset,
    lines: value.lines.map(({ number, text }) => ({ number, text })),
    totalLines: value.totalLines,
  }),
})

/** The read row's presentResult (mirror of read.ts:173-192): declines
 *  (undefined) on an error result, a malformed meta, anything but ONE text
 *  content block, or text outside the read envelope — so legacy `{text}`
 *  refusals and foreign replays fall back to the generic card instead of a
 *  lying read card. Never throws. */
function readRowPresentResult(_args, result) {
  if (result?.isError === true) return undefined
  const meta = readRowMetaFromMeta(result?.meta)
  if (meta === undefined) return undefined
  const only = Array.isArray(result.content) && result.content.length === 1 ? result.content[0] : undefined
  const text = only?.type === 'text' && typeof only.text === 'string' ? only.text : undefined
  if (text === undefined) return undefined
  const body = READ_ROW_ENVELOPE.exec(text)?.[1]
  if (body === undefined) return undefined
  return {
    card: 'read',
    path: meta.path,
    offset: meta.offset,
    lines: meta.lines,
    totalLines: meta.totalLines,
    ...(meta.lang === undefined ? {} : { lang: meta.lang }),
    content: [{ type: 'text', text: body }],
  }
}

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
  // B-ACT-1-PR C2: the jobs management trio mounts at FIXED native spellings
  // under the closed `jobsEnabled` consumption key (never the configurable
  // `names` map — no config-driven spelling, no Gate 0b surface). The
  // same-name, same-meaning implementation this ledger exists to record is
  // now ASSEMBLED (createGovernedJobsBridge over the host JobRegistry
  // public face @639ed01539 — caller fence preserved, Team owner fence
  // layered above); recording the claim here keeps the natexe ledger the
  // complete truth of what this install may mount.
  jobs: Object.freeze(['job_output', 'job_list', 'job_kill']),
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
      return { ok: false, code: 'PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED', message: `plane row '${cls}' cannot mount under reserved native name '${spelling}' — this install surface assembles no same-name, same-meaning implementation for that pair (supported: bash row at 'bash', read row at 'read'); coarse permission class is not tool-implementation equivalence` }
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
    const locator = typeof effect?.resource?.locator === 'string' ? effect.resource.locator : undefined
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
 * Create the per-agent governed tool plane. `input`:
 *  { permissionPolicy, realmId, templateId, role, instanceId,
 *    fs?: { canonicalizeResource?, subtreeContains? },
 *    plane?: { realmId, names?, confinedProvider?, definitionOwnerAuthority?, fsInstance?, globEnabled? },
 *    backends?: { search?, glob?, shell? },            // wiring-kit override point
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
  // Gate 0b: the closed mount-name domain, checked BEFORE any construction
  // (natexe ③; see verifyPlaneNames — anomalous names never reach a mount).
  const namesCheck = verifyPlaneNames(names, readName)
  if (namesCheck.ok !== true) return { ok: false, code: namesCheck.code, message: namesCheck.message }

  // Gate 0c (root ruling 20:31Z, a5-globoff): `planeCfg.globEnabled` is a
  // CLOSED CONSUMPTION KEY, validated here before anything is constructed.
  //  - ABSENT = true: every existing world keeps the production glob row
  //    byte-for-byte (the zero-flip law).
  //  - false: the glob row lands on the EXISTING typed shut face (same code,
  //    same refusal grammar — zero new error surface), and the gate holds
  //    over the kit `backends` injection seam too (④: no fallback bypass).
  //  - a non-boolean value is a config defect and fails closed on the
  //    existing PLANE_CONFIG_INCOMPLETE refusal — never silently coerced to
  //    true. Unknown plane keys keep their historical silent-ignore law;
  //    this single key is the one the assembly now consumes.
  const globEnabledRaw = input.plane?.globEnabled
  if (globEnabledRaw !== undefined && typeof globEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: `planeCfg.globEnabled must be a boolean when present — got ${JSON.stringify(globEnabledRaw) ?? String(globEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const globEnabled = globEnabledRaw !== false

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
    authorityGeneration: () => 0, // same generation the PR1 guard publishes with (rev.0 until the overlay feeds revisions)
    beneficiaryAuthority: role === 'leader' ? 'leader' : 'member',
    ...(input.fs?.subtreeContains === undefined ? {} : { subtreeContains: input.fs.subtreeContains }),
    onObserve: (row) => observe(`a5p2prod: ${String(row?.event ?? row)}`),
  })
  if (built.ok !== true) {
    return { ok: false, code: String(built.error?.code ?? 'ADMISSION_ASSEMBLY_REFUSED'), message: String(built.error?.message ?? 'production admission assembly refused construction') }
  }
  const assembly = built.value

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
  // INT-R3 FLIP 1/3 — the srgp lane shipped the rg row behind `confined` and left the
  // mount as the integration owner's one line (evidence/alpha5/srgp/README.md
  // "Gap for the integration owner"): WITHOUT `confined` the production search row is
  // still the grep(1) port and the rg row only exists where a caller passes the
  // provider conf. Same shape as the shell row below (`confined: confinedCfg`), so the
  // governed rg face is what a configured world actually runs; an fsInstance-only
  // world still gets the disclosed grep port (legs G1/G1b/G2/G9 stay green by design).
  const realSearch = fsInstance !== null && typeof fsInstance.rootDir === 'string'
    ? createAnchoredSearchBackend({
      realmId,
      rootDir: fsInstance.rootDir,
      confined: confinedCfg,
      observe: logBackend('a5g7-search'),
    })
    : null
  // INT-R3 FLIP 2/3 — the glob row leaves the typed shut face for the anchored rg
  // backend, on the SAME provider and launcher as its two siblings and with the SAME
  // allowPaths shape (system rx dirs + the rg bin dir + a READ_DIR/READ_FILE grant on
  // the anchored root: glob-backend.mjs:837-842 is byte-for-byte the search row's
  // list at search-backend.mjs:746-751; the rw lane stays exclusively the shell row's).
  // CANDIDATE-A'S RESIDUAL EXPOSURE, IN PAST TENSE WITH PRESENT VALUES (round-14
  // ruling): the confined-rg glob candidate FAILED its 2026-10-17/18 security re-review
  // for a NAME-CLASS leak — the `verify` -> launcher string-`chdir` window plus the
  // then-current provider `runtime_base '/'` READ_DIR grant, measured 3/10700 there.
  // That launcher is gone: on the narrowed baseline the same round reports 0/1400 on the
  // probe base with the race leg and all 19 weapon arms zero (re-runnable through
  // evidence/alpha5/runtime-base-narrow/'s own kit + witness; THIS DOCS PASS DID NOT
  // RE-MEASURE — the values are restated from that round's receipts per the ruling).
  // REACHABILITY, kept as honest disclosure rather than deleted: the historical reading
  // is only reopened by deliberately pinning the historical launcher bytes — the
  // pairing gate at the row above governs launcher INTEGRITY/byte-pinning, NOT the
  // narrowing content, so pairing passing is not evidence that the base is narrowed.
  // The walk root is the child's cwd, so no swappable path string rides argv (what the
  // CANDIDATE-A note credits this row with).
  // Gate 0c enforcement, part 2 (a5-globoff ②/④): `globEnabled:false` builds
  // NO glob backend at all — the row is the existing typed shut face from the
  // FIRST branch, never the rg row, so nothing can spawn. The shut instance
  // carries its own honest backendId; the refusal grammar and the code are
  // the existing ones (zero new error surface).
  const realGlob = globEnabled === false ? null
    : fsInstance !== null && typeof fsInstance.rootDir === 'string' && confinedCfg !== null
    ? createAnchoredGlobBackend({
      realmId,
      rootDir: fsInstance.rootDir,
      confined: confinedCfg,
      templateId: String(templateId),
      instanceId: String(input.instanceId ?? templateId),
      observe: logBackend('a5glb-glob'),
    })
    : null
  const realShell = confinedCfg !== null
    ? createConfinedShellBackend({
      realmId,
      templateId: String(templateId),
      instanceId: String(input.instanceId ?? templateId),
      cwdRoot: typeof fsInstance?.rootDir === 'string' ? fsInstance.rootDir : input.plane?.workingDir,
      confined: confinedCfg,
      observe: logBackend('a5g7-shell'),
    })
    : null
  // Gate 0c enforcement, part 3 (a5-globoff ④): the disabled form's shut face
  // — its own honest backendId, the EXISTING refusal bytes (code/class/detail
  // verbatim). It WINS over the kit `backends` injection seam: the mount gate
  // is config law, not wiring, so no injected glob/search backend can carry
  // the glob class while the key says off.
  const globDisabledShut = globEnabled === false ? createShutBackend('a5-glob-config-disabled') : null
  const productionBackends = Object.freeze({
    search: realSearch ?? shut,
    glob: globDisabledShut ?? realGlob ?? shut,
    shell: realShell ?? shut,
  })
  const hostedSearch = input.backends?.search ?? productionBackends.search
  // Kit-compat law (a5p5 register.ts:118 — globBackend ABSENT reuses the
  // search backend): an injected fixture search keeps carrying glob exactly
  // as before. PRODUCTION search never does — the glob row has no existing
  // implementation and lands on the honest typed shut face.
  const hostedGlob = globDisabledShut ?? input.backends?.glob ?? input.backends?.search ?? productionBackends.glob
  const hostedShell = input.backends?.shell ?? productionBackends.shell
  // The host REGISTRATION law (packages/core/tools: every registerable tool
  // must declare output { schema, render }) is an INSTALLER face: the a5p5
  // lane deliberately ships name/description/parameters/execute ONLY (its
  // execute returns the closed { text } envelope — lane law, untouched).
  // The assembly adds exactly that missing presentation face — additive,
  // no change to any reviewed logic; the pinned object is THIS wrapper.
  const defs = Object.freeze(createGovernedToolDefinitions({
    realmId,
    decide,
    searchBackend: hostedSearch,
    globBackend: hostedGlob,
    shellBackend: hostedShell,
    names,
    callIdPrefix: `team-${String(input.instanceId ?? templateId)}`,
  }).map((def) => Object.freeze({ ...def, output: PLANE_PRESENTATION_FACE })))

  // GLUE-7 fs-class row: the governed `read` over the SAME controlled-fs
  // instance root (no second fs algebra). PLACED ONLY when the row declares
  // an fsInstance — the native `read` spelling is takeover-mounted exactly
  // like the G1 takeover vector the lane rules already speak, so dispatch
  // resolves to THIS placement and the §6 binding feed below can hand the
  // Guard the placement identity (int-a5b T5: `BINDING_UNVERIFIED` was the
  // gap; a feed entry names the placement, it never bypasses the Guard).
  // Deny-lane and template-default-deny re-check BEFORE any byte is read.
  // (readName is hoisted to Gate 0b above — the same value, validated there.)
  const readExecutor = fsInstance !== null && typeof fsInstance.rootDir === 'string'
    ? createGovernedReadExecutor({
      realmId,
      rootDir: fsInstance.rootDir,
      policy: permissionPolicy,
      decide,
      ...(input.fs?.subtreeContains === undefined ? {} : { subtreeContains: input.fs.subtreeContains }),
      observe: logBackend('a5g7-read'),
    })
    : null
  // GLUE-5/C2 JOBS-MANAGEMENT ROW (B-ACT-1-PR): the three host `job_*`
  // management tools, takeover-mounted at FIXED native spellings behind the
  // closed `jobsEnabled` key (ABSENT = no rows at all — zero flip). The
  // effect body is the INJECTED bridge (glue wires gateway fence → host
  // `ctx.get('jobs')` public face; see plane-effect-backends.mjs); with no
  // bridge the rows land on the honest typed shut face (existing
  // IO_POLICY_UNSUPPORTED grammar, zero new error surface — the mount gate
  // is config law, not wiring). The descriptions/schemas below are the host
  // tool-jobs spellings AT THE PIN (packages/jobs/tool-jobs/src/index.ts
  // :311-400 @639ed01539) — same-name SAME-MEANING is the natexe claim law
  // this row satisfies; the dispatch-provided caller (`exec.agent?.id`,
  // exactly what the host tool passes) never gets invented: an unnamed
  // caller is refused by the bridge, never queried unfiltered.
  const jobsBridge = input.backends?.jobs ?? null
  const jobsShut = createShutBackend('a5-jobs-bridge-pending')
  const shutJobsText = async () => {
    const r = await jobsShut.run({})
    return { text: `refused: ${String(r.failure.code)} — ${String(r.failure.detail)}` }
  }
  const jobsDefs = jobsEnabled === true ? [
    Object.freeze({
      name: 'job_output',
      description: 'Read a background job: output since the previous read for stream jobs, or the result of a finished final-output job.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'Job id returned by the tool that started the background work.' },
          wait: { type: 'boolean', description: 'Block until the job finishes or the timeout expires; a timed-out wait leaves the job running. Defaults to false.' },
          timeout_ms: { type: 'number', description: 'Max wait in milliseconds with wait: true.' },
        },
        required: ['job_id'],
      },
      execute: async (args, exec) => (jobsBridge !== null ? jobsBridge.jobOutput(args ?? {}, exec?.agent?.id, exec?.signal) : await shutJobsText()),
      output: PLANE_PRESENTATION_FACE,
    }),
    Object.freeze({
      name: 'job_list',
      description: 'List your background jobs (running and finished) with their ids, kinds, and statuses.',
      parameters: { type: 'object', properties: {} },
      execute: async (_args, exec) => (jobsBridge !== null ? jobsBridge.jobList(exec?.agent?.id) : await shutJobsText()),
      output: PLANE_PRESENTATION_FACE,
    }),
    Object.freeze({
      name: 'job_kill',
      description: 'Request cancellation of a running background job.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'Job id returned by the tool that started the background work.' },
          reason: { type: 'string', description: 'Optional short reason, recorded in the log and forwarded to the job.' },
        },
        required: ['job_id'],
      },
      execute: async (args, exec) => (jobsBridge !== null ? jobsBridge.jobKill(args ?? {}, exec?.agent?.id) : await shutJobsText()),
      output: PLANE_PRESENTATION_FACE,
    }),
  ] : []

  const baseDefs = readExecutor === null ? defs : Object.freeze([
    ...defs,
    Object.freeze({
      name: readName,
      description: 'Read one governed text file inside this member\'s admitted file root. Paths resolve against that root; escaping targets are refused.',
      parameters: {
        type: 'object',
        // The native spelling, on purpose: the frozen operation-permission
        // canonicalizer keys `read` to its `file_path` extractor (live run-8
        // measured 'canonicalization failed for tool "read":
        // file-path-missing' on a {path} schema — the takeover row must
        // satisfy the same canonical law the native name carries).
        // offset/limit ride the SAME canonical projection
        // (canonical-operation.ts:674-675) and are now truly CONSUMED by the
        // executor (plan T2/E2); descriptions mirror the pin639 read schema.
        properties: {
          file_path: { type: 'string', description: 'path relative to the governed root, or an absolute path inside it' },
          offset: { type: 'number', description: 'The line number to start reading from. Only provide if the file is too large to read at once.' },
          limit: { type: 'number', description: `The number of lines to read. Only provide if the file is too large to read at once. Defaults to ${String(READ_ROW_LINE_CAP)}.` },
        },
        required: ['file_path'],
      },
      // S2 transfer law: SUCCESS hands the native four-field window through
      // untouched; a refusal (the executor's tagged union object) becomes a
      // THROW of its verbatim refusal text — the same transport the host
      // read row uses, so the envelope/decline contract downstream stays
      // honest. The trio rows keep their `{ text }` face unchanged.
      execute: async (raw) => {
        const outcome = await readExecutor(raw)
        if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
          return { path: outcome.path, offset: outcome.offset, lines: outcome.lines, totalLines: outcome.totalLines }
        }
        const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
          ? outcome.text
          : 'refused-io executor-unavailable — the governed read executor produced no outcome'
        throw new Error(text)
      },
      output: READ_ROW_PRESENTATION_FACE,
      presentResult: readRowPresentResult,
    }),
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
  const placementFeed = (name) => {
    const d = placedByName.get(name)
    if (d === undefined) return undefined
    const identity = definitionIdentityOf(d)
    return identity === null ? undefined : Object.freeze({ definitionIdentity: identity, realmId })
  }

  return {
    ok: true,
    value: {
      assembly,
      fsProvider,
      definitions: allDefs,
      /** The mounted model-facing names — the own-layer bind list. */
      ownNames: Object.freeze(allDefs.map((d) => d.name)),
      decide,
      /** GLUE-7: the plane's realm (the feed's pairing key) and the real
       *  backend handles (diagnostics: execCount / lastRuns / lastOutcomes). */
      realmId,
      backends: Object.freeze({
        search: hostedSearch, glob: hostedGlob, shell: hostedShell,
        ...(readExecutor === null ? {} : { read: readExecutor }),
      }),
      /** pb §6 provider-side feed: (name) -> {definitionIdentity, realmId} (the seam's flat BindingFeedEntry). */
      placementFeed,
      placementNames: Object.freeze(allDefs.map((d) => d.name)),
      /**
       * RA ② invariant 1+3: THIS function performs the placement. Any
       * register failure rolls back what it already placed and returns the
       * typed failure — the caller MUST fail the assembly.
       */
      mount: (agentCtx) => {
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
