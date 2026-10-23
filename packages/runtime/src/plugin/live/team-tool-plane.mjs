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
import { createProductionAdmissionAssembly, evaluateEffectSetExpansion } from '../../../tool-admission/index.js'
import { createProductionControlledFsProvider } from '../../../controlled-fs/src/index.js'
import { definitionIdentityOf, untestedAssurance } from '../../../tool-dispatch/index.js'
import { canonicalJsonFingerprint, parseRequestedEffectSet, parseToolBinding } from '../../../../domain/tool-governance/src/index.js'
import { createAnchoredSearchBackend, createConfinedShellBackend, createGovernedReadExecutor, READ_ROW_LINE_CAP } from './plane-effect-backends.mjs'
import { createAnchoredGlobBackend } from './glob-backend.mjs'
// A5-M2 G1 (root ruling 15:28, wiring no longer waits for the center): the
// closed G1 record law lives in the committed module ITSELF — this plane
// imports the frozen dispatch-index table instead of restating it, so a
// mount can never carry a name the frozen 14-record index does not own.
// The rows are INJECTED over this table (mountG1SurfaceAdapter output); the
// plane imports no arm authority, only the closed index it validates
// placements against. Import law (pc §3): the relative specifier resolves
// inside the committed dist mirror exactly like ./plane-effect-backends.mjs.
import { A5_G1_RECORD_SPECS, A5_G1_ADAPTER_REVISION } from './governed-families/g1-surface-adapters.mjs'

/** The lane-default plane names (GLUE-5 alias ruling; see header). */
export const DEFAULT_PLANE_NAMES = Object.freeze({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' })

/** A5-M2 B-SESSION: the FIXED native spelling the governed todo row mounts at
 *  (closed key + injected arm; never a config spelling — see the todo entry in
 *  PLANE_SUPPORTED_NATIVE_TAKEOVERS and the todo gate in the assembly). */
export const A5_TODO_MOUNT_NAME = 'todo_write'
export const A5_WRITE_MOUNT_NAME = 'write'
// A5-M2 B-IMAGE (CENTER vertical): the governed image-read row mounts at the
// FIXED native spelling 'read_image' (a PLANE_RESERVED_NATIVE name, pinned to
// the 639 host face) behind the closed `imageEnabled` key.
export const A5_IMAGE_MOUNT_NAME = 'read_image'

/** A5-M2 G1 PURE-QUERY (root 15:2x ruling): the FIXED native spellings of the
 *  three READ-SIDE records of the frozen dispatch index that this round wires
 *  behind the closed `g1Enabled` key plus the injected mounted adapter rows:
 *  record 53 `cordis_inspect_list`, record 54 `cordis_inspect_query` and
 *  record 85 `team_list_pending_control`. The set is CLOSED and it is not a
 *  slice of the 14 by preference — it is the slice whose adapter needs NO
 *  mount-time authority that this tree cannot observe (no sandbox-escalation
 *  chain, no durable commit witness, no exported install path, no live Client):
 *  53/54 classify + delegate over the injected TRUSTED inspect-registry port
 *  and the captured native face, 85 is the pure read of the Team pending-
 *  control queue. The remaining eleven G1 records (skill,
 *  load_workspace_dependencies, ask_user_question, exit_plan_mode, present,
 *  plugin_manager, team_request_control, team_resolve_control,
 *  team_grant_permission, team_revoke_permission, surface:domain_family) stay
 *  declared/INACTIVE exactly as `g1-surface-adapters.mjs` spells them; Gate 0f
 *  refuses any mount that tries to place them. */
export const A5_G1_PURE_QUERY_MOUNT_NAMES = Object.freeze([
  'cordis_inspect_list',
  'cordis_inspect_query',
  'team_list_pending_control',
])

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
  // PR358-A2: the cancelled read carries NO path/line card — it is not a
  // read result; the generic card renders its honest cancelled line instead
  // of a lying zero-lines read card.
  if (result?.cancelled === true) return undefined
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
  // A5-M2 B-SESSION (CENTER vertical): the governed todo_write row mounts at the
  // FIXED native spelling 'todo_write' behind the closed `todoEnabled` key plus an
  // injected arm (never the configurable `names` map - no config-driven spelling,
  // same law as the jobs trio). The same-name, same-meaning implementation this
  // ledger records: the row classifies through the injected governed arm, walks
  // THIS plane's own PA admission, and runs the captured native definition's own
  // `execute` through the arm's bind-time snapshot - 保留原生 (M0-B §B-SESSION);
  // the plane re-implements no host law and holds no authority of its own.
  todo: Object.freeze(['todo_write']),
  // A5-M2 B-WRITE (CENTER vertical): the governed existing-file write row
  // mounts at the FIXED native spelling 'write' behind the closed
  // `writeEnabled` key plus an injected arm (same law as the todo row). The
  // same-name, same-meaning implementation this ledger records: classify is
  // pure-lexical, admission walks THIS plane's PA, and the BODY is the
  // reviewed post-consume execution closure (verify-before-truncate, no
  // O_CREAT — the new-file path stays HELD); no native body is re-entered
  // and no authority lives below this line.
  write: Object.freeze(['write']),
  // A5-M2 B-IMAGE (CENTER vertical): the governed image row mounts at the
  // FIXED native spelling 'read_image' behind the closed `imageEnabled` key
  // plus an injected arm. Same-name, same-meaning: classify is pure-lexical,
  // admission walks THIS plane's PA, and the BODY is the reviewed consumption
  // arm (real final edge first, one port read cap+1 on the consumed
  // credential, commit through the injected attachment adapter). No native
  // body is re-entered; no authority lives below this line.
  read_image: Object.freeze(['read_image']),
  // A5-M2 G1 PURE-QUERY (root 15:2x ruling: 工具适配不等待中心接线): the three
  // read-side rows of the frozen dispatch index mount at their FIXED native
  // spellings behind the closed `g1Enabled` key plus the injected mounted rows
  // (never the configurable `names` map - same law as the trio above):
  // `cordis_inspect_list` (record 53), `cordis_inspect_query` (record 54) and
  // `team_list_pending_control` (record 85). The same-name, same-meaning
  // implementation this ledger records: the row classifies through the
  // COMMITTED G1 captured-native-delegate adapter
  // (`governed-families/g1-surface-adapters.mjs`), walks THIS plane's ONE PA
  // admission (same token ledger, same open/edge, same durable row), and the
  // BODY is the captured native definition's OWN face entered by that
  // adapter's delegate through its bind-time snapshot - 保留原生, with the
  // family's own read-side laws (current-facts re-verify, the inspect
  // topology filter, the pending-control read) kept closed in the adapter.
  // The other eleven G1 records are NOT claimed here: they stay
  // declared/INACTIVE (four-tier law, Gate 0f), and the gate refuses any
  // mount that tries to place them.
  g1_pure_query: Object.freeze(['cordis_inspect_list', 'cordis_inspect_query']),
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

  // Gate 0c (A5-M2 B-SESSION, CENTER vertical): `planeCfg.todoEnabled` is the
  // SAME-shaped CLOSED CONSUMPTION KEY. ABSENT = FALSE (zero-flip law by
  // absence: every shipped world keeps the pre-M2 mount shape byte-for-byte);
  // a non-boolean value is a config defect and fails closed on the SAME
  // existing PLANE_CONFIG_INCOMPLETE refusal. The mount needs the trusted arm
  // the ASSEMBLY OWNER built (bind-time captured native definition, REAL
  // member/session-header identity, the injected binding-generation reader -
  // see governed-families/todo.mjs): `backends.todo` is the injection seam and
  // the pairing is enforced BOTH directions, so neither half can mount alone
  // (the glob gate's ④ law: config law, not wiring; no silent fallback).
  // The injected `description` is the CAPTURED NATIVE definition's own
  // description bytes - same-name, same-meaning by identity, never a
  // plane-invented wording (the host varies it with the parallel policy).
  const todoEnabledRaw = input.plane?.todoEnabled
  if (todoEnabledRaw !== undefined && typeof todoEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: `planeCfg.todoEnabled must be a boolean when present — got ${JSON.stringify(todoEnabledRaw) ?? String(todoEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const todoEnabled = todoEnabledRaw === true
  const todoInjectRaw = input.backends?.todo
  const todoInjectInvalid = (why) => ({ ok: false, code: 'TODO_ARM_INJECT_INVALID', message: `backends.todo: ${why}` })
  if (todoEnabled && todoInjectRaw === undefined) {
    return todoInjectInvalid('todoEnabled is true but no governed todo arm is injected - the mount would mask the native name with nothing behind it; there is no fallback row and no silent disable')
  }
  if (!todoEnabled && todoInjectRaw !== undefined) {
    return todoInjectInvalid('an arm is injected while todoEnabled is off - the gate is config law, not wiring (the glob-gate ④ discipline): refuse the mount instead of mounting around its own key')
  }
  let todoInject = null
  if (todoInjectRaw !== undefined) {
    const arm = todoInjectRaw.arm
    const bad = arm === null || typeof arm !== 'object'
      ? 'the arm is missing (the governed-families/todo arm object is the injected face)'
      : (typeof arm.familyId !== 'string' || arm.familyId.length === 0)
        ? 'arm.familyId is not a non-empty string'
        : (!Number.isInteger(arm.adapterRevision) || arm.adapterRevision < 0)
          ? 'arm.adapterRevision is not a non-negative integer'
          : (typeof arm.providerId !== 'string' || arm.providerId.length === 0)
            ? 'arm.providerId is not a non-empty string'
            : !['classify', 'prepare', 'execute', 'cancel', 'drain'].every((m) => typeof arm[m] === 'function')
              ? 'the arm does not carry the full classify/prepare/execute/cancel/drain face'
              : (typeof todoInjectRaw.description !== 'string' || todoInjectRaw.description.length === 0)
                ? 'the captured native description is missing (the row mounts the HOST description bytes verbatim - same-name, same-meaning)'
                : undefined
    if (bad !== undefined) return todoInjectInvalid(bad)
    todoInject = Object.freeze({ arm, description: todoInjectRaw.description })
  }

  // Gate 0d (A5-M2 B-WRITE, CENTER vertical): the SAME-shaped CLOSED
  // CONSUMPTION KEY for the governed existing-file write row. ABSENT = FALSE
  // (zero-flip law by absence); a non-boolean is a config defect refused on
  // the existing PLANE_CONFIG_INCOMPLETE surface. `backends.write` carries
  // the arm the assembly owner built over the reviewed POST-CONSUME WRITE
  // CLOSURE (governed-families/write.mjs) plus the CAPTURED native
  // description bytes; the pairing is enforced BOTH directions (the glob
  // gate's ④ law: config law, not wiring — no half mount, no silent
  // fallback, no re-entrant native body anywhere below).
  const writeEnabledRaw = input.plane?.writeEnabled
  if (writeEnabledRaw !== undefined && typeof writeEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CONFIG_INCOMPLETE',
      message: `planeCfg.writeEnabled must be a boolean when present — got ${JSON.stringify(writeEnabledRaw) ?? String(writeEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const writeEnabled = writeEnabledRaw === true
  const writeInjectRaw = input.backends?.write
  const writeInjectInvalid = (why) => ({ ok: false, code: 'WRITE_ARM_INJECT_INVALID', message: `backends.write: ${why}` })
  if (writeEnabled && writeInjectRaw === undefined) {
    return writeInjectInvalid('writeEnabled is true but no governed write arm is injected - the mount would mask the native name with nothing behind it; there is no fallback row and no silent disable')
  }
  if (!writeEnabled && writeInjectRaw !== undefined) {
    return writeInjectInvalid('an arm is injected while writeEnabled is off - the gate is config law, not wiring (the glob-gate ④ discipline): refuse the mount instead of mounting around its own key')
  }
  let writeInject = null
  if (writeInjectRaw !== undefined) {
    const arm = writeInjectRaw.arm
    const bad = arm === null || typeof arm !== 'object'
      ? 'the arm is missing (the governed-families/write arm object is the injected face)'
      : (typeof arm.familyId !== 'string' || arm.familyId.length === 0)
        ? 'arm.familyId is not a non-empty string'
        : (!Number.isInteger(arm.adapterRevision) || arm.adapterRevision < 0)
          ? 'arm.adapterRevision is not a non-negative integer'
          : (typeof arm.providerId !== 'string' || arm.providerId.length === 0)
            ? 'arm.providerId is not a non-empty string'
            : !['classify', 'prepare', 'execute', 'cancel', 'drain'].every((m) => typeof arm[m] === 'function')
              ? 'the arm does not carry the full classify/prepare/execute/cancel/drain face'
              : (typeof writeInjectRaw.description !== 'string' || writeInjectRaw.description.length === 0)
                ? 'the captured native description is missing (the row mounts the HOST description bytes verbatim - same-name, same-meaning)'
                : undefined
    if (bad !== undefined) return writeInjectInvalid(bad)
    writeInject = Object.freeze({ arm, description: writeInjectRaw.description })
    if (readName === A5_WRITE_MOUNT_NAME) {
      return writeInjectInvalid(`the read row already mounts under '${A5_WRITE_MOUNT_NAME}' (planeCfg.readName) - one name, one placement (the verifyPlaneNames law, carried to the fixed-spelling rows)`)
    }
  }

  // Gate 0e (A5-M2 B-IMAGE, CENTER vertical): the SAME-shaped CLOSED boolean
  // gate as the write row (root authorization @10:25Z: 实际接线; constraints
  // restated @ the port round): pairing law BOTH directions — `imageEnabled`
  // with no injected arm refuses (the mount would mask the reserved native
  // name with nothing behind it), an injected arm with the gate off refuses
  // (config is law, not wiring — the glob-gate ④ discipline). The arm's own
  // construction (port × attachment adapter × governed root namespace) sits
  // in the placing assembly (agent-bindings.mjs): a mount that cannot
  // honestly build the triple builds NO arm, and a gate-on mount then
  // refuses HERE — never a half-wired row.
  const imageEnabledRaw = input.plane?.imageEnabled
  if (imageEnabledRaw !== undefined && typeof imageEnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CFG_INVALID',
      message: `planeCfg.imageEnabled must be a boolean when present — got ${JSON.stringify(imageEnabledRaw) ?? String(imageEnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const imageEnabled = imageEnabledRaw === true
  const imageInjectRaw = input.backends?.image
  const imageInjectInvalid = (why) => ({ ok: false, code: 'IMAGE_ARM_INJECT_INVALID', message: `backends.image: ${why}` })
  if (imageEnabled && imageInjectRaw === undefined) {
    return imageInjectInvalid('imageEnabled is true but no governed image arm is injected - the mount would mask the reserved native name with nothing behind it; there is no fallback row and no silent disable')
  }
  if (!imageEnabled && imageInjectRaw !== undefined) {
    return imageInjectInvalid('an arm is injected while imageEnabled is off - the gate is config law, not wiring (the glob-gate ④ discipline): refuse the mount instead of mounting around its own key')
  }
  let imageInject = null
  if (imageInjectRaw !== undefined) {
    // THE IDENTITY TIMING (root central card on 6c354, item ②): the arm
    // CANNOT be constructed at glue time from a captured native definition —
    // `definitionIdentityOf` is the pb §6 WeakMap algebra (the id is minted
    // off the def's OWN execute function and the seam mints placement ids
    // AFTER plane construction), so a native snapshot would carry a
    // different id than the eventual placement and the arm's strict
    // three-way tie (durable row / this call / arm) would refuse every
    // call. The injection therefore carries a FACTORY: the plane calls it
    // at the real placement moment with the def it actually placed, and
    // the factory binds `definitionIdentityOf(that def)` — the same
    // identity the Guard reads and the placement feed reports (never a
    // guessed def#, never a loosened check; todo/write could not be
    // analogized because neither performs this three-way tie).
    const bad = typeof imageInjectRaw.createArm !== 'function'
      ? 'backends.image.createArm must be a function (def) -> the governed B-IMAGE arm — the arm binds its definitionIdentity off the definition THIS plane actually places, so the construction belongs to the placement moment, not to glue time'
      : (typeof imageInjectRaw.description !== 'string' || imageInjectRaw.description.length === 0)
        ? 'backends.image.description must be a non-empty string (the CAPTURED native description bytes)'
        : (imageInjectRaw.parameters === undefined || imageInjectRaw.parameters === null || typeof imageInjectRaw.parameters !== 'object')
          ? 'backends.image.parameters must be the CAPTURED native parameters schema — the three-way definitionIdentity tie (durable row / this call / arm) can only hold when the mount IS the native definition face; a plane-invented schema drifts the identity'
          : undefined
    if (bad !== undefined) return imageInjectInvalid(bad)
    imageInject = Object.freeze({ createArm: imageInjectRaw.createArm, description: imageInjectRaw.description, parameters: imageInjectRaw.parameters })
    if (readName === A5_IMAGE_MOUNT_NAME || writeInject !== null && A5_WRITE_MOUNT_NAME === A5_IMAGE_MOUNT_NAME) {
      return imageInjectInvalid(`'${A5_IMAGE_MOUNT_NAME}' is already claimed on this mount - one name, one placement (the verifyPlaneNames law, carried to the fixed-spelling rows)`)
    }
  }

  // ── GATE 0f (A5-M2 G1, root ruling 15:28: 工具适配不等待中心接线) ──────
  // `planeCfg.g1Enabled` is the SAME-shaped CLOSED CONSUMPTION KEY. ABSENT =
  // FALSE (zero-flip law by absence: every shipped world keeps the pre-G1
  // mount shape byte-for-byte); a non-boolean value is a config defect refused
  // on the image gate's existing PLANE_CFG_INVALID spelling. `backends.g1` is
  // the injection seam and the pairing is enforced BOTH directions (the
  // glob-gate ④ discipline: config law, not wiring; no silent fallback).
  //
  // THE INJECTED ROWS ARE THE COMMITTED MODULE'S OWN OUTPUT. `backends.g1.rows`
  // is a NON-EMPTY array of `{ row, output }` entries where `row` is a frozen
  // row returned by `mountG1SurfaceAdapter()` of the committed
  // `governed-families/g1-surface-adapters.mjs` — the plane validates each row
  // against the FROZEN DISPATCH INDEX it imports (`A5_G1_RECORD_SPECS`: the
  // name, family and recordIndex law lives in that module, never restated
  // here), and against the PLACEMENT TABLE `A5_G1_PURE_QUERY_MOUNT_NAMES`:
  //  · a name outside the frozen 14-record index → refused (no guessed names);
  //  · `capturePresent === false` → refused: that is the module's
  //    DECLARED/INACTIVE posture (a no-capture row refuses every call), and a
  //    declared row placed as a tool would mask the native name behind an
  //    always-refusing row — the four-tier law forbids wiring a declared row
  //    as if it were live;
  //  · a captured row OUTSIDE the pure-query placement set → refused, named:
  //    its facts (the host escalation chain, the durable append witness, the
  //    exported install path, the live Client handle, the prompt/plan-mode
  //    write faces) are not observable at this wiring point, so it stays
  //    exactly as the module spells it — declared/INACTIVE;
  //  · `output` is the integrator-supplied captured `{ schema, render }` face:
  //    the host register law demands output and the adapter row carries none
  //    (it captures description/parameters, not output) — the plane invents
  //    no face.
  const g1EnabledRaw = input.plane?.g1Enabled
  if (g1EnabledRaw !== undefined && typeof g1EnabledRaw !== 'boolean') {
    return {
      ok: false,
      code: 'PLANE_CFG_INVALID',
      message: `planeCfg.g1Enabled must be a boolean when present — got ${JSON.stringify(g1EnabledRaw) ?? String(g1EnabledRaw)} (a non-boolean gate is a config defect: the mount is refused rather than silently defaulting)`,
    }
  }
  const g1Enabled = g1EnabledRaw === true
  const g1InjectRaw = input.backends?.g1
  const g1InjectInvalid = (why) => ({ ok: false, code: 'G1_ROW_INJECT_INVALID', message: `backends.g1: ${why}` })
  if (g1Enabled && g1InjectRaw === undefined) {
    return g1InjectInvalid('g1Enabled is true but no governed G1 rows are injected - the mount would mask native names with nothing behind them; there is no fallback row and no silent disable')
  }
  if (!g1Enabled && g1InjectRaw !== undefined) {
    return g1InjectInvalid('rows are injected while g1Enabled is off - the gate is config law, not wiring (the glob-gate ④ discipline): refuse the mount instead of mounting around its own key')
  }
  let g1Inject = null
  if (g1InjectRaw !== undefined) {
    if (!Array.isArray(g1InjectRaw.rows) || g1InjectRaw.rows.length === 0) {
      return g1InjectInvalid('backends.g1.rows must be a NON-EMPTY array of { row, output } entries — an empty array would mount the gate with no rows behind it (no fallback row, no silent disable)')
    }
    const g1Taken = new Set([readName, ...Object.values(names ?? {})])
    if (todoInject !== null) g1Taken.add(A5_TODO_MOUNT_NAME)
    if (writeInject !== null) g1Taken.add(A5_WRITE_MOUNT_NAME)
    if (imageInject !== null) g1Taken.add(A5_IMAGE_MOUNT_NAME)
    const g1Entries = []
    for (const entryRaw of g1InjectRaw.rows) {
      const row = entryRaw?.row
      const name = typeof row?.name === 'string' ? row.name : ''
      const spec = A5_G1_RECORD_SPECS[name]
      const why = spec === undefined
        ? `'${name === '' ? String(row) : name}' is not one of the 14 frozen G1 records — the closed dispatch index is the ONLY name source (the mounted module owns it); a guessed or re-spelled name is a config defect`
        : (typeof row.classify !== 'function' || typeof row.delegate !== 'function')
          ? `record ${String(spec.recordIndex)} '${name}' answers no classify/delegate face — rows are mounted through mountG1SurfaceAdapter of the committed module, never hand-assembled beside it`
          : (row.familyId !== spec.family || row.recordIndex !== spec.recordIndex)
            ? `record ${String(spec.recordIndex)} '${name}' carries family '${String(row.familyId)}' / recordIndex ${String(row.recordIndex)} — the row must MATCH the frozen index entry it names (a mismatched row is a config defect, never a re-mount to paper over)`
            : row.capturePresent !== true
              ? `record ${String(spec.recordIndex)} '${name}' is a DECLARED/INACTIVE row (capturePresent is not true: the module spells this as a row with no native capture, refusing every call with P_G1_NATIVE_CAPTURE_ABSENT) — a declared row is never placed as a live tool; mount the capture or leave the record declared (four-tier law: 未接线 stays 未接线, it is not wired as if live)`
              : !A5_G1_PURE_QUERY_MOUNT_NAMES.includes(name)
                ? `record ${String(spec.recordIndex)} '${name}' is outside this round's CLOSED PURE-QUERY placement set (${A5_G1_PURE_QUERY_MOUNT_NAMES.join(', ')}): its facts are not observable at the wiring point (the host escalation chain, the durable append witness, the exported install path, the live Client, the prompt/plan-mode write faces), so the record stays declared/INACTIVE exactly as the module spells it — wiring it live would be the fake interface the four-tier law forbids`
                : (typeof row.description !== 'string' || row.description.length === 0)
                  ? `record ${String(spec.recordIndex)} '${name}' carries no captured native description — the same-name, same-meaning mount has no other source for it (never a plane-invented wording)`
                  : (row.parameters === null || row.parameters === undefined || typeof row.parameters !== 'object')
                    ? `record ${String(spec.recordIndex)} '${name}' carries no captured native parameters face — the plane invents no schema face`
                    : (entryRaw.output === null || typeof entryRaw.output !== 'object' || (entryRaw.output.schema === null || typeof entryRaw.output.schema !== 'object') || typeof entryRaw.output.render !== 'function')
                      ? `record ${String(spec.recordIndex)} '${name}' has no output face { schema, render } — the host register law demands one, the adapter row carries none (it captures description/parameters only), and the integrator supplies the captured native pair; the plane invents none`
                      : (g1Taken.has(name))
                        ? `'${name}' is already claimed on this mount - one name, one placement (the verifyPlaneNames law, carried to the G1 rows)`
                        : undefined
      if (why !== undefined) return g1InjectInvalid(why)
      g1Taken.add(name)
      g1Entries.push(Object.freeze({
        row,
        output: Object.freeze({ schema: entryRaw.output.schema, render: entryRaw.output.render }),
      }))
    }
    g1Inject = Object.freeze({ rows: Object.freeze(g1Entries) })
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
    // THE RESOURCE-CANONICALIZATION FORWARD (root ruling after r7): the plane
    // has always accepted `input.fs.canonicalizeResource` (its own mount law)
    // but this assembly only ever passed `subtreeContains` down, so the kernel
    // fell back to its absolute-only default and a WORKSPACE-RELATIVE deny
    // (`read subtree runtime`) refused the whole mount as uncanonicalizable —
    // the mount never gave the kernel the plane's lexical resolver. Now the
    // injected seam is forwarded when present; ABSENT stays byte-identical
    // (the kernel keeps its own fallback, no root is invented here).
    ...(input.fs?.canonicalizeResource === undefined ? {} : { canonicalizeResource: input.fs.canonicalizeResource }),
    ...(input.fs?.subtreeContains === undefined ? {} : { subtreeContains: input.fs.subtreeContains }),
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
  const paPlacementNameOf = (name) => {
    const spelling = String(name ?? '')
    if (spelling.length === 0) return undefined
    if (spelling === readName) return readName
    // A5-M2 B-SESSION: the governed todo row mounts at the FIXED native
    // spelling (closed key, not the `names` map) - the same readName treatment,
    // and ONLY when this mount actually placed it: an unmounted world answers
    // undefined here exactly as before (zero flip).
    if (todoInject !== null && spelling === A5_TODO_MOUNT_NAME) return A5_TODO_MOUNT_NAME
    if (writeInject !== null && spelling === A5_WRITE_MOUNT_NAME) return A5_WRITE_MOUNT_NAME
    if (imageInject !== null && spelling === A5_IMAGE_MOUNT_NAME) return A5_IMAGE_MOUNT_NAME
    // A5-M2 G1 PURE-QUERY: the three fixed spellings resolve to themselves,
    // ONLY when this mount actually placed them (zero flip otherwise).
    if (g1Inject !== null && A5_G1_PURE_QUERY_MOUNT_NAMES.includes(spelling)) return spelling
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
  // A5-M2 fix-1 (root ruling 09:19): the governed todo row's OWN token→
  // correlation ledger — the SAME single-flight law the read row carries
  // (plane-effect-backends `readTokenLedger`): ONE correlation per registry
  // execution token for its whole life, and a settled token is never re-armed.
  // `exec.tokenKey` is NOT a public Host field (fixed 639 `ToolExecution` =
  // token/callId/rootCallId/signal/agent; the trio runner derives its own
  // local name from `exec.token` and nothing else), and the todo row registers
  // directly with the registry — so the row keys identity on the REAL
  // `exec.token` (object|symbol, never stringified) and allocates its own
  // correlation string for the PA walk. No name/model-call field is ever
  // composed into an identity here.
  const governedTokenLedger = new Map() // token(object|symbol) -> { correlation, settled }
  let todoCorrSeq = 0
  let writeCorrSeq = 0
  let imageCorrSeq = 0
  // A5-M2 G1 PURE-QUERY: ONE sequence for the whole G1 trio of this mount —
  // the durable row identity must be unique per FLIGHT, and one token runs one
  // flight across the shared ledger, so a per-name counter could hand the same
  // id to two flights of two different G1 names inside one mount.
  let g1CorrSeq = 0
  // A5-M2: `family` (optional) is the governed-family review block THIS call
  // carries, sourced ONLY from the arm's classify output the row drove (never
  // model input, never a plane invention). It rides to the durable Control leg
  // as `PaControlLegInput.family` — the bridge composes the manifest from it and
  // checks it against the mount's own registration; an unbound call omits the
  // key entirely and its manifest stays byte-for-byte unchanged.
  const paAdmit = async ({ realmId: callRealm, callId, parametersFingerprint, requestedEffects, toolName = requestedEffects.effects.find((e) => e.kind === 'tool-invoke')?.toolName ?? 'unknown', signal, family }) => {
    try {
      return await paAdmitBody({ realmId: callRealm, callId, parametersFingerprint, requestedEffects, toolName, signal, ...(family === undefined ? {} : { family }) })
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
  const paAdmitPartA = async ({ realmId: callRealm, callId, parametersFingerprint, requestedEffects, toolName, signal, family }) => {
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
      const leg = await controlLeg({ realmId: callRealm, member: paMember, callId, request, plan: planned.value, assembly, ...(signal === undefined ? {} : { signal }), ...(family === undefined ? {} : { family }) })
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
    const edge = assembly.consumeForExecution(grant, {
      ...(signal === undefined ? {} : { cancelRequested: signal.aborted === true }),
      currentAuthorityGeneration: freshGeneration,
      member: paMember,
      callId,
      realmId: callRealm,
      bindingId: grant.bindingId,
      bindingRevision: freshRevision,
      parametersFingerprint,
      requestedEffects,
    })
    if (edge.ok !== true) {
      return { kind: 'deny', code: String(edge.error?.code ?? 'GRANT_CONSUMPTION_REFUSED'), detail: String(edge.error?.message ?? '') }
    }
    // A5-M2: the ONE-SHOT consume witness travels to the row additively (the
    // kernel's consumed-proof struct: the spent grant + lease) so a governed
    // family row can demand it. The witness is emitted ONLY on this success
    // branch — the one place `assembly.consumeForExecution` answered ok — and
    // never reconstructed here from a non-deny outcome: a row that proceeds
    // without the proof is refusing, not self-attesting. Existing rows ignore
    // the field byte-identically.
    return edge.value === undefined || edge.value === null
      ? { kind: 'allow' }
      : { kind: 'allow', consumedProof: edge.value }
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
    pa: paAdmit,
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
      pa: paAdmit,
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

  // A5-M2 B-SESSION GOVERNED TODO ROW (CENTER vertical). The presentation face
  // mirrors the pinned host todo_write output schema + render (tool-todo
  // index.ts:155-191 @639ed01539) — same-name, same-meaning; refusals ride the
  // THROW transport (the read row's S2 law), so `render` only ever sees the
  // native body's own { todos, counts } return.
  // r9 CANONICAL LAW (root ruling 12:29): the mirror rides the COMPILED
  // canonical JSON Schema — the shape `tools.register` actually validates with
  // the host's own assertSupportedJsonSchema (json-schema.ts: property-level
  // `required: true` is the host's PRIVATE authored DSL, consumed by
  // valueSchemaSpecToJsonSchema at defineTool time; a hand-mirror of the
  // authored text is not a registration face). Same semantics, lifted: every
  // authored `required: true` becomes its parent's `required` member — the
  // constraints are kept, never loosened (the fixed point proves both: the
  // REAL host validator accepts the shape AND still rejects a missing member).
  const TODO_ROW_PRESENTATION_FACE = Object.freeze({
    schema: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: {
        todos: Object.freeze({
          type: 'array',
          items: Object.freeze({
            type: 'object',
            additionalProperties: false,
            properties: {
              content: Object.freeze({ type: 'string' }),
              status: Object.freeze({ type: 'string', enum: ['pending', 'in_progress', 'completed'] }),
            },
            required: Object.freeze(['content', 'status']),
          }),
        }),
        counts: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: {
            pending: Object.freeze({ type: 'integer' }),
            inProgress: Object.freeze({ type: 'integer' }),
            completed: Object.freeze({ type: 'integer' }),
          },
          required: Object.freeze(['pending', 'inProgress', 'completed']),
        }),
      },
      required: Object.freeze(['todos', 'counts']),
    }),
    render: (_args, value) => [{
      type: 'text',
      text: `Updated todo list: ${String(value.counts.pending)} pending, ${String(value.counts.inProgress)} in progress, ${String(value.counts.completed)} completed.`,
    }],
  })
  const todoDefs = todoInject === null ? [] : [Object.freeze({
    name: A5_TODO_MOUNT_NAME,
    // The CAPTURED native description bytes (Gate 0c-todo) — the host varies
    // this text with the parallel policy; mounting the captured value keeps the
    // model-facing meaning identical to the world this row took over.
    description: todoInject.description,
    parameters: Object.freeze({
      type: 'object',
      properties: {
        todos: {
          type: 'array',
          description: 'The COMPLETE task list, replacing any previous list.',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              content: { type: 'string', description: 'What the task is — a short imperative line.' },
              status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'pending (not started) | in_progress (now) | completed (done).' },
            },
            required: ['content', 'status'],
          },
        },
      },
      required: ['todos'],
    }),
    // THE vertical: classify (pure, snapshot) → this plane's ONE PA walk
    // (Part A: binding facts, admitCall, the durable Control leg whose guard
    // consumption mints the grant; the family block rides the leg input) →
    // arm.prepare(grant) (internal state only) → the execution edge (the
    // kernel's one-shot consume, its witness carried back) → arm.execute,
    // which enters the CAPTURED native body through bind-time snapshots only.
    // There is no native fallback anywhere below: the refusal paths all end in
    // a typed throw, and a cancelled call stops with zero append by the same
    // law the PA walk already states.
    execute: async (raw, exec) => {
      const arm = todoInject.arm
      // fix-1 (root ruling 09:19): the identity is the registry-assigned
      // execution token — the fixed-639 public contract (`ToolExecution.token`,
      // the one identity the guard, the hand-off and the result observers share
      // for one flight). `exec.tokenKey` is NOT a public Host field (639
      // ToolExecution = token/callId/rootCallId/signal/agent; the trio runner
      // derives only its OWN local name from `exec.token`), and this row
      // registers straight with the registry — so an absent token is a typed
      // front refusal: zero classify, zero plan fact, zero walk, zero row.
      // The row invents no identity from name or model-call fields.
      const execToken = exec?.token
      const tokenKey = (typeof execToken === 'object' && execToken !== null) || typeof execToken === 'symbol' ? execToken : undefined
      if (tokenKey === undefined) {
        throw new Error('refused-todo exec-token-unbound — this execution carries no registry token (object|symbol); the row keys its single-flight and its correlation on the REAL exec.token and composes no identity from name or model-call fields')
      }
      const priorFlight = governedTokenLedger.get(tokenKey)
      if (priorFlight !== undefined) {
        throw new Error(`refused-todo exec-token-replay — this execution token already ${priorFlight.settled ? 'owns a settled' : 'owns an in-flight'} governed todo_write call; one token runs one governed flight and a settled token is never re-armed (the read row's single-flight law, verbatim)`)
      }
      todoCorrSeq += 1
      // The allocation carries the mount's OWN realm (one flight, one id —
      // durable rows live in a service shared by mounts, so a per-mount seq
      // alone could collide across mounts; the read lane's nonce plays the
      // same role there).
      const correlation = `plane-todo:${realmId}-${String(todoCorrSeq)}`
      governedTokenLedger.set(tokenKey, { correlation, settled: false })
      const signal = exec?.signal
      let abortListener
      try {
      // fix-4 (root ruling 09:19): OWNER-CURRENT BEFORE THE FREEZE. The arm
      // freezes the binding generations into the plan AT classify; the very same
      // authority leg paAdmitPartA runs ("bring this scope's governed bindings
      // onto the generation THIS call just read") is asked HERE, before that
      // freeze — a revision that moves mid-call then legitimately republishes
      // BEFORE the plan captures one, not after the grant was minted against it
      // (a post-freeze republish paired a pre-refresh plan against a
      // post-refresh grant and refused a legal call with P_TODO_GRANT_MISMATCH).
      // A faulting leg is OBSERVED, never absorbed (the kernel's identity leg
      // answers that call itself); the row never re-stamps a generation.
      if (typeof paEnsureAuthorityCurrent === 'function' && typeof paGenerationReader === 'function') {
        const freshAuthority = await paReadGenerationFresh()
        if (freshAuthority.ok === true) {
          try {
            await paEnsureAuthorityCurrent(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''), freshAuthority.value)
          } catch (error) {
            observe(`a5m2-todo-row: ensure-current(g=${String(freshAuthority.value)}) threw (${String(error?.message ?? error).slice(0, 160)}) — the call continues on the live tuple and the kernel identity leg answers it`)
          }
        }
      }
      let classified
      try {
        // fix-1: the correlation is THIS mount's ledger-allocated string for this
        // execution token (the read row's law) — every identity derived from it
        // (the plan fingerprint, the walk, the live-plan key, the durable row)
        // then speaks ONE identity for ONE flight.
        classified = arm.classify(raw, exec, correlation)
      } catch (error) {
        throw new Error(`refused-todo arm-unavailable — the governed todo arm could not classify this call (${String(error?.message ?? error).slice(0, 160)}); there is no native fallback to fall back to`)
      }
      if (classified.ok !== true || classified.plan === undefined) {
        throw new Error(`refused-todo ${classified.code ?? 'P_TODO_CLASSIFY_INVALID_ARGUMENTS'} — ${classified.detail ?? 'the governed classify refused this call before admission'}`)
      }
      // fix-3 (root ruling 09:19, the belt): once a PLAN exists, an abort landing
      // in any later wait is linked to the arm's own cancel law (the cancelled
      // call is the arm's zero-append settle, never a row-side guess). The
      // listener is removed in the finally at the end of this call — it never
      // outlives the flight it guards (the B-WEB lane's per-call leak finding,
      // not repeated here).
      if (signal !== undefined && typeof signal.addEventListener === 'function') {
        abortListener = () => { arm.cancel(classified.plan) }
        signal.addEventListener('abort', abortListener, { once: true })
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw new Error(`refused-todo effects-unparsable — the arm's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})`)
      }
      const walk = {
        realmId,
        callId: correlation,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName: A5_TODO_MOUNT_NAME,
        // The family block: the arm's review payload's four P-adds at FULL
        // VALUE (载荷法). The bridge composes the durable manifest from this and
        // checks it against the mount's own registration — and the arm's
        // payload NEVER becomes a second approval anywhere on this path.
        family: Object.freeze({
          familyId: classified.reviewPayload.familyId,
          adapterRevision: classified.reviewPayload.adapterRevision,
          providerIdentity: classified.reviewPayload.providerIdentity,
          targetManifest: classified.reviewPayload.targetManifest,
        }),
        ...(signal === undefined ? {} : { signal }),
      }
      const opened = await paAdmit.open(walk)
      if (opened.kind === 'deny') {
        const settled = arm.cancel(classified.plan)
        throw new Error(`refused-todo ${opened.code ?? 'ADMISSION_REFUSED'} — ${opened.detail ?? 'the admission refused this call'} (arm settle: ${String(settled.settled ?? settled.code ?? 'n/a')})`)
      }
      if (opened.cancelled === true) {
        const settled = arm.cancel(classified.plan)
        throw new Error(`todo_write · cancelled — the call was cancelled at the PA edge before admission (${String(settled.appendOutcome ?? 'zero append')})`)
      }
      if (opened.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        arm.cancel(classified.plan)
        throw new Error(`refused-todo APPROVAL_NOT_LANDED — the admission answered ${String(opened.kind ?? 'unsettled')} without a landed grant; internal arm state never substitutes for the kernel answer`)
      }
      let prepared
      try {
        prepared = arm.prepare(classified.plan, opened.grant)
      } catch (error) {
        // An approved walk that dies before the edge still owns its plan fact:
        // it closes HERE (the split-path law paAdmit.closePlan carries for
        // every early hand-off exit — an exception is one of them).
        paAdmit.closePlan(walk.callId)
        arm.cancel(classified.plan)
        throw new Error(`refused-todo arm-unavailable — the arm threw while preparing the grant (${String(error?.message ?? error).slice(0, 160)}); the plan fact was closed and nothing ran`)
      }
      if (prepared.ok !== true) {
        // The plan fact of a walk that never proceeds ends HERE (the split-path
        // law paAdmit.closePlan carries for every early hand-off exit).
        paAdmit.closePlan(walk.callId)
        throw new Error(`refused-todo ${prepared.code ?? 'P_TODO_NOT_ADMITTED'} — ${prepared.detail ?? 'the arm refused the kernel grant'}`)
      }
      const edge = await paAdmit.edge({
        ...walk,
        grant: opened.grant,
        paDurableMint: opened.paDurableMint,
        request: opened.request,
        placementName: opened.placementName,
        paConstructionBinding: opened.paConstructionBinding,
      })
      if (edge.kind === 'deny') {
        const settled = arm.cancel(classified.plan)
        throw new Error(`refused-todo ${edge.code ?? 'GRANT_STALE'} — ${edge.detail ?? 'the execution edge refused this call'} (arm settle: ${String(settled.settled ?? settled.code ?? 'n/a')})`)
      }
      if (edge.cancelled === true) {
        const settled = arm.cancel(classified.plan)
        throw new Error(`todo_write · cancelled — the call was cancelled at the execution edge (${String(settled.appendOutcome ?? 'zero append')}; the approval stays unspent and is never replayed)`)
      }
      // `consumed: true` is produced ONLY from the REAL final edge's success
      // branch: the witness `edge.consumedProof` is emitted solely where THIS
      // call's `assembly.consumeForExecution` answered ok (the one-shot kernel
      // ledger), and the row DEMANDS it — an allow shape without its witness
      // refuses (the arm never receives a self-attested "consumed", never a
      // grant backfilled from the pre-edge copy). The arm then pairs against
      // the SPENT grant the witness carries, never a re-minted copy.
      const proof = edge.consumedProof
      if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string') {
        const settled = arm.cancel(classified.plan)
        throw new Error(`refused-todo CONSUME_PROOF_MISSING — the execution edge answered allow without its one-shot consume witness; the row never self-attests consumption from a missing denial and the body does not run (arm settle: ${String(settled.settled ?? settled.code ?? 'n/a')})`)
      }
      // fix-3 (root ruling 09:19, the NAMED race): between the edge's REAL
      // consume and the body's first microtask an abort can still land. The
      // consumed grant is ledger truth and NEVER rolls back; the body that never
      // started appends ZERO — the row links the abort to the arm's cancel law
      // and stops with the cancelled fact, and no native entry runs.
      if (signal?.aborted === true) {
        const settled = arm.cancel(classified.plan)
        throw new Error(`todo_write · cancelled — the call was aborted after the execution edge consumed the grant and before the body began (the consumption is a settled fact and is never rolled back; ${String(settled.appendOutcome ?? 'zero append')})`)
      }
      const ran = await arm.execute(classified.plan, { consumed: true, grant: proof.grant })
      if (ran.ok !== true) {
        throw new Error(`refused-todo ${ran.code ?? 'P_TODO_NOT_ADMITTED'} — ${ran.detail ?? 'the governed execution edge refused the body'}`)
      }
      return ran.value
      } finally {
        // fix-3: the abort listener never outlives this call.
        if (abortListener !== undefined && typeof signal?.removeEventListener === 'function') {
          signal.removeEventListener('abort', abortListener)
        }
        // fix-1: every path (success, typed refusal, throw) settles the token's
        // flight — a settled token is never re-armed. The entry is the MINIMAL
        // used-identity record (correlation + settled flag): the plan, the
        // body result and every temporary reference live in the call's own
        // scope and die with it; NOTHING large rides the ledger. Used token
        // identities are NEVER evicted to bound the map's size (root ruling
        // @ 9c817: eviction would resurrect an old exec.token as fresh,
        // defeating the whole single-flight law — the ledger's whole point is
        // "this token has been spent"); the map is released when the mount is
        // disposed, which is the only legal end of the memory obligation.
        governedTokenLedger.set(tokenKey, { correlation, settled: true })
      }
    },
    output: TODO_ROW_PRESENTATION_FACE,
    presentCall: (args) => ({ card: 'generic', title: 'Update todo list', kind: 'other', rawInput: args?.todos }),
  })]

  // ── A5-M2 WRITE PA HAND-OFF (root 13:38 MIN product fix, write C2 step 2) ──
  // The pre-dispatch leg of the governed WRITE row, built on the audited M1
  // READ hand-off's laws and the SAME port shape — this is what the adapter's
  // second port (`paWriteHandoff`, step 1 @ 4acfa81b8) exists to receive. No
  // new ledger is invented here:
  //   * the token identity, the single-flight law and the terminal law ride
  //     the SAME `governedTokenLedger` the todo and write rows already share;
  //   * `writePaHandoffs` is the flight record (the read row's `paHandoffs`
  //     twin): a pending placeholder while Part A walks, the UNSPENT claim
  //     after `approved`. The body takes it synchronously and ONCE; a close
  //     or the teardown drops whatever is left.
  // `open` runs the row's OWN Part A complete — owner-current leg, pure-lexical
  // classify, the parsed effect set, the full PA walk (call-level facts, plan,
  // the real Control ask when the policy asks, `issueApprovedGrant`) — asks the
  // effect-set question at PA, resolves nothing, consumes nothing and writes
  // no byte. The row's BODY re-classifies FRESH and redeems through
  // `paAdmit.edge`, which runs the fresh recheck and the ONE consume; the
  // pre-dispatch plan is settled zero-byte at the hold (the body prepares only
  // a plan IT classified). The port answers only for the ONE name THIS mount
  // placed — never a name guess, never a native fallback anywhere here.
  const writePaHandoffs = new Map() // token(object|symbol) -> placeholder | unspent claim
  let writeHandoffSeq = 0
  let writeRowMounted = true
  /** The `tools/result` terminal close (mirrors the read law): idempotent,
   *  synchronous, terminal never re-armed. Returns the correlation whose plan
   *  fact this close still owes the mount — only an UNSPENT flight or an
   *  in-flight placeholder does; a redeemed one was closed by its own edge. */
  const writeHandoffClose = (token) => {
    if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) return undefined
    const flight = writePaHandoffs.get(token)
    writePaHandoffs.delete(token)
    const prior = governedTokenLedger.get(token)
    if (prior !== undefined && !prior.settled) {
      governedTokenLedger.set(token, { correlation: prior.correlation, settled: true })
    }
    return flight?.callId
  }
  /** Mount teardown: no write hand-off survives its mount, claimed or not —
   *  the flight, the unspent grant and the plan fact die with the placement
   *  (the read row's teardown law, independent of the terminal observer). */
  const writeHandoffCloseAll = () => {
    writeRowMounted = false
    for (const token of [...writePaHandoffs.keys()]) {
      const callId = writeHandoffClose(token)
      if (typeof callId === 'string') paAdmit.closePlan(callId)
    }
  }
  const writeHandoffOpen = async (exec) => {
    if (exec === null || typeof exec !== 'object') return { kind: 'no-match' }
    if (exec.name !== A5_WRITE_MOUNT_NAME) return { kind: 'no-match' }
    const token = exec.token
    if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) {
      // The name IS this mount's governed write, so the effect-set question
      // belongs to PA: with no execution identity the call REFUSES, it never
      // falls back to the pre-hand-off lane.
      return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_UNBOUND', detail: 'this governed write carries no execution token, so no PA hand-off can be opened or redeemed for it' }
    }
    if (!writeRowMounted) {
      return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_MOUNT_GONE', detail: 'the mount was torn down before the hand-off opened; nothing is asked and nothing is authorized' }
    }
    const prior = governedTokenLedger.get(token)
    if (prior !== undefined) {
      // A TERMINAL token is never re-armed, and a token that already owns a
      // flight never takes a second open: a side-effect-free refusal that
      // reuses nothing (an authorization is not transferable, and the first
      // leg's state is not touched).
      return {
        kind: 'refused',
        ownsHandoff: false,
        code: prior.settled === true ? 'PA_HANDOFF_TERMINAL' : 'PA_HANDOFF_IN_FLIGHT',
        detail: prior.settled === true
          ? 'this execution token is already terminal, so no PA hand-off may be opened on it again'
          : 'a governed flight already owns this execution token; a second open is refused without touching the in-flight state and no answer is reused',
      }
    }
    const arm = writeInject.arm
    const signal = exec.signal
    writeCorrSeq += 1
    const correlation = `plane-write:${realmId}-${String(writeCorrSeq)}`
    writeHandoffSeq += 1
    const mySeq = writeHandoffSeq
    // The ledger entry and the pending placeholder are taken BEFORE the first
    // await: a close landing mid-walk must find this leg, and the re-check
    // after the walk must find it GONE. (The placeholder carries its own
    // callId so a close can still drop this call's plan fact.)
    governedTokenLedger.set(token, { correlation, settled: false })
    writePaHandoffs.set(token, Object.freeze({ pending: true, seq: mySeq, callId: correlation }))
    const releasePlaceholder = () => {
      if (writePaHandoffs.get(token)?.seq === mySeq) writePaHandoffs.delete(token)
    }
    const settleToken = () => {
      const now = governedTokenLedger.get(token)
      if (now !== undefined && !now.settled) governedTokenLedger.set(token, { correlation: now.correlation, settled: true })
    }
    let abortListener
    try {
      // OWNER-CURRENT BEFORE THE FREEZE (the fix-4 leg VERBATIM from the row
      // body): Part A asks the whole question, including the fresh-authority
      // walk; a faulting leg is OBSERVED, never absorbed.
      if (typeof paEnsureAuthorityCurrent === 'function' && typeof paGenerationReader === 'function') {
        const freshAuthority = await paReadGenerationFresh()
        if (freshAuthority.ok === true) {
          try {
            await paEnsureAuthorityCurrent(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''), freshAuthority.value)
          } catch (error) {
            observe(`a5m2-write pa-handoff: ensure-current(g=${String(freshAuthority.value)}) threw (${String(error?.message ?? error).slice(0, 160)}) — the walk continues on the live tuple and the kernel identity leg answers it`)
          }
        }
      }
      let classified
      try {
        classified = arm.classify(exec.arguments, exec, correlation)
      } catch (error) {
        releasePlaceholder()
        settleToken()
        return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_FAULT', detail: `the governed write arm could not classify this call at the pre-dispatch leg (${String(error?.message ?? error).slice(0, 160)}); there is no native fallback to fall back to` }
      }
      if (classified.ok !== true || classified.plan === undefined) {
        releasePlaceholder()
        settleToken()
        return { kind: 'refused', ownsHandoff: true, code: String(classified.code ?? 'P_WRITE_CLASSIFY_INVALID_ARGUMENTS'), detail: String(classified.detail ?? 'the governed classify refused this call before admission') }
      }
      if (signal !== undefined && typeof signal.addEventListener === 'function') {
        abortListener = () => {
          try { arm.cancel(classified.plan) } catch { /* best-effort settle; the refusals below carry the verdict */ }
        }
        signal.addEventListener('abort', abortListener, { once: true })
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        releasePlaceholder()
        settleToken()
        return { kind: 'refused', ownsHandoff: true, code: 'EFFECTS_UNPARSABLE', detail: `the arm's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})` }
      }
      const walk = {
        realmId,
        callId: correlation,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName: A5_WRITE_MOUNT_NAME,
        family: Object.freeze({
          familyId: classified.reviewPayload.familyId,
          adapterRevision: classified.reviewPayload.adapterRevision,
          providerIdentity: classified.reviewPayload.providerIdentity,
          targetManifest: classified.reviewPayload.targetManifest,
        }),
        ...(signal === undefined ? {} : { signal }),
      }
      let opened
      try {
        opened = await paAdmit.open(walk)
      } catch (error) {
        // A Part A that THREW handed nothing off (its own finally closed the
        // plan fact); the placeholder is released only if it is still this
        // leg's, then the call refuses in place.
        releasePlaceholder()
        settleToken()
        paAdmit.closePlan(correlation)
        try { arm.cancel(classified.plan) } catch { /* best-effort */ }
        return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_FAULT', detail: `Part A threw and is never treated as an authorization: ${String(error?.message ?? error).slice(0, 180)}` }
      }
      // AFTER the await the world is RE-CHECKED, not assumed: the mount must
      // still stand and this leg must still own its placeholder — a close or a
      // teardown landing while PA was being asked voids the leg; its grant, if
      // one landed, is dropped and NOTHING is registered.
      const held = writePaHandoffs.get(token)
      if (!writeRowMounted) {
        releasePlaceholder()
        settleToken()
        paAdmit.closePlan(correlation)
        const settled = arm.cancel(classified.plan)
        observe('a5m2-write pa-handoff dropped — mount torn down during the walk')
        return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_MOUNT_GONE', detail: `the mount was torn down while PA was being asked; the answer is dropped and nothing is authorized (arm settle: ${String(settled?.settled ?? settled?.code ?? 'n/a')})` }
      }
      if (held === undefined || held.seq !== mySeq) {
        settleToken()
        paAdmit.closePlan(correlation)
        const settled = arm.cancel(classified.plan)
        observe('a5m2-write pa-handoff dropped — the leg was closed while PA was being asked')
        return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_CLOSED', detail: `this hand-off leg was closed while PA was being asked; the answer is dropped and nothing is authorized (arm settle: ${String(settled?.settled ?? settled?.code ?? 'n/a')})` }
      }
      if (opened.cancelled === true) {
        // CANCELLATION IS NOT PERMISSION: zero consumption, zero body, and the
        // adapter's cancelled branch denies without ever reaching the row.
        releasePlaceholder()
        settleToken()
        const settled = arm.cancel(classified.plan)
        return { kind: 'cancelled', detail: `the PA walk answered this invocation cancelled before dispatch (arm settle: ${String(settled?.writeOutcome ?? settled?.settled ?? 'zero write')})` }
      }
      if (opened.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        releasePlaceholder()
        settleToken()
        const settled = arm.cancel(classified.plan)
        observe(`a5m2-write pa-handoff refused code=${String(opened.code ?? opened.kind ?? 'unknown')}`)
        return { kind: 'refused', ownsHandoff: true, code: String(opened.code ?? 'PA_HANDOFF_REFUSED'), detail: `${String(opened.detail ?? 'the pre-dispatch PA walk refused this write')} (arm settle: ${String(settled?.settled ?? settled?.code ?? 'n/a')})` }
      }
      // THE HOLD. 'approved' says ONLY that the full PA effect-set question
      // was answered and a real Control guard consumed the Ask — it is NOT a
      // consumption: the grant stays UNSPENT and rides the flight to the body,
      // which still owes the whole fresh recheck and the single edge. The
      // plan fact STAYS (the redemption edge re-reads it; its finally closes
      // it, idempotent with the terminal close). The pre-dispatch PLAN settles
      // zero-byte here — the arm never prepares a plan the body did not
      // classify fresh.
      writePaHandoffs.set(token, Object.freeze({
        callId: correlation,
        parametersFingerprint: String(classified.parametersFingerprint),
        grant: opened.grant,
        paDurableMint: opened.paDurableMint,
        request: opened.request,
        placementName: opened.placementName,
        paConstructionBinding: opened.paConstructionBinding,
      }))
      governedTokenLedger.set(token, { correlation, settled: false, handedOff: true })
      try { arm.cancel(classified.plan) } catch { /* best-effort: never prepared, never writes */ }
      observe(`a5m2-write pa-handoff OPEN call=${correlation}`)
      return { kind: 'authorized', correlation }
    } finally {
      if (abortListener !== undefined && typeof signal?.removeEventListener === 'function') {
        signal.removeEventListener('abort', abortListener)
      }
    }
  }

  // A5-M2 B-WRITE: the governed existing-file write row. THE vertical, same
  // law as the todo row above (classify pure → ONE PA walk with the family
  // block → arm.prepare(grant) → the kernel's one-shot execution edge → the
  // arm's consumed-proof entry), with ONE body difference the root ruling
  // demands: below the edge NOTHING re-enters a native definition — the arm
  // mints THE private ZERO-ARGUMENT post-consume write closure from the
  // frozen plan facts alone and calls it. Identity is the shared token
  // ledger's allocation; consumed tokens are never re-armed until dispose.
  // A5-M2 hand-off: when the pre-dispatch port holds an UNSPENT claim on this
  // token, the body's walk SKIPS its own Part A (the question is already
  // answered) and redeems the claim through the SAME fresh edge — never a
  // re-approval, never a fallback lane, never the native face.
  const writeDefs = writeInject === null ? [] : [Object.freeze({
    name: A5_WRITE_MOUNT_NAME,
    // The CAPTURED native description bytes (Gate 0d) — same-name,
    // same-meaning, never a plane-invented wording.
    description: writeInject.description,
    parameters: Object.freeze({
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to write, resolved against this member\'s admitted file root.' },
        content: { type: 'string', description: 'Full UTF-8 text content to write.' },
      },
      required: ['file_path', 'content'],
    }),
    execute: async (raw, exec) => {
      const arm = writeInject.arm
      // Identity law (fix-1, shared ledger): the REAL registry token; absent
      // is a typed front refusal — zero classify, zero walk, zero row.
      const execToken = exec?.token
      const tokenKey = (typeof execToken === 'object' && execToken !== null) || typeof execToken === 'symbol' ? execToken : undefined
      if (tokenKey === undefined) {
        throw new Error('refused-write exec-token-unbound — this execution carries no registry token (object|symbol); the row keys its single-flight and its correlation on the REAL exec.token and composes no identity from name or model-call fields')
      }
      const priorFlight = governedTokenLedger.get(tokenKey)
      // A5-M2 WRITE HAND-OFF redemption (the read row's take law, verbatim):
      // the ONE in-flight HANDED-OFF flight on this token IS this body's
      // redemption — the ledger's single-flight law holds, because the flight
      // was opened FOR this exact execution at pre-dispatch. The take is
      // SYNCHRONOUS and SINGLE: a re-entrant second redemption finds no flight
      // and fails closed there (Part A is never re-run, no fallback lane serves
      // this write). Any other prior stays the typed replay refusal.
      let writeClaim
      let correlation
      if (priorFlight !== undefined && !priorFlight.settled && priorFlight.handedOff === true) {
        writeClaim = writePaHandoffs.get(tokenKey)
        writePaHandoffs.delete(tokenKey)
        if (writeClaim === undefined) {
          throw new Error('refused-write PA_HANDOFF_LOST — the pre-dispatch PA hand-off of this execution is gone (closed, torn down, or already spent); Part A is never re-run and no fallback lane serves this write')
        }
        // ONE correlation per token for its whole life: the redemption runs
        // under the ORIGINAL id Part A asked with, never a fresh one.
        correlation = priorFlight.correlation
      } else if (priorFlight !== undefined) {
        throw new Error(`refused-write exec-token-replay — this execution token already ${priorFlight.settled ? 'owns a settled' : 'owns an in-flight'} governed plane call (todo/write share ONE token ledger: a registry token spans exactly one flight of one row); one token runs one governed flight and a settled token is never re-armed (the read row's single-flight law, verbatim)`)
      } else {
        writeCorrSeq += 1
        correlation = `plane-write:${realmId}-${String(writeCorrSeq)}`
        governedTokenLedger.set(tokenKey, { correlation, settled: false })
      }
      // The plan fact this call owns from the pre-dispatch hold; the edge's
      // finally closes it, and this net closes it on EVERY exit BEFORE the
      // edge (mismatch, classify faults, prepare refusals) — idempotent with
      // the explicit closes below, never a leak.
      let writeEdgeRan = false
      const signal = exec?.signal
      let abortListener
      try {
      // OWNER-CURRENT BEFORE THE FREEZE (fix-4 law, same authority leg as the
      // todo row and paAdmitPartA): a legitimate mid-call revision
      // republishes BEFORE the plan freezes its generations, not after the
      // grant was minted. A faulting leg is OBSERVED, never absorbed.
      if (typeof paEnsureAuthorityCurrent === 'function' && typeof paGenerationReader === 'function') {
        const freshAuthority = await paReadGenerationFresh()
        if (freshAuthority.ok === true) {
          try {
            await paEnsureAuthorityCurrent(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''), freshAuthority.value)
          } catch (error) {
            observe(`a5m2-write-row: ensure-current(g=${String(freshAuthority.value)}) threw (${String(error?.message ?? error).slice(0, 160)}) — the call continues on the live tuple and the kernel identity leg answers it`)
          }
        }
      }
      let classified
      try {
        classified = arm.classify(raw, exec, correlation)
      } catch (error) {
        throw new Error(`refused-write arm-unavailable — the governed write arm could not classify this call (${String(error?.message ?? error).slice(0, 160)}); there is no native fallback to fall back to`)
      }
      if (classified.ok !== true || classified.plan === undefined) {
        throw new Error(`refused-write ${classified.code ?? 'P_WRITE_CLASSIFY_INVALID_ARGUMENTS'} — ${classified.detail ?? 'the governed classify refused this call before admission'}`)
      }
      // Once a PLAN exists, an abort in any later wait links to the arm's
      // cancel law; the listener is removed in the finally (never outlives
      // the flight).
      if (signal !== undefined && typeof signal.addEventListener === 'function') {
        abortListener = () => { arm.cancel(classified.plan) }
        signal.addEventListener('abort', abortListener, { once: true })
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw new Error(`refused-write effects-unparsable — the arm's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})`)
      }
      const walk = {
        realmId,
        callId: correlation,
        parametersFingerprint: classified.parametersFingerprint,
        requestedEffects: parsedEffects.value,
        toolName: A5_WRITE_MOUNT_NAME,
        family: Object.freeze({
          familyId: classified.reviewPayload.familyId,
          adapterRevision: classified.reviewPayload.adapterRevision,
          providerIdentity: classified.reviewPayload.providerIdentity,
          targetManifest: classified.reviewPayload.targetManifest,
        }),
        ...(signal === undefined ? {} : { signal }),
      }
      if (writeClaim !== undefined) {
        // BODY FRESH RECHECK (exact-match law, the read row's, verbatim): the
        // redemption must answer the SAME question Part A asked — the same
        // call identity and the same full-values digest over the body's OWN
        // fresh classify. Drift (argument bytes moved, the fact vanished) is a
        // REFUSAL, never a re-approval: the front door opened NOTHING for this
        // call, so an old Ask could not authorize it even if one were minted.
        if (writeClaim.parametersFingerprint !== classified.parametersFingerprint || writeClaim.callId !== correlation) {
          const settled = arm.cancel(classified.plan)
          throw new Error(`refused-write PA_HANDOFF_MISMATCH — the redemption does not ask the question the pre-dispatch PA walk was approved for; nothing ran (arm settle: ${String(settled.settled ?? settled.writeOutcome ?? settled.code ?? 'n/a')})`)
        }
      }
      // A redeemed walk SKIPS its own Part A — a second walk would be a second
      // question (a second Ask waiting on the human). The unspent grant and
      // its construction tuple ride to the execution edge exactly as Part A
      // handed them over; the edge re-reads the facts FRESH and performs the
      // ONE consume. The non-hand-off path keeps the walk below byte-for-byte.
      const opened = writeClaim !== undefined
        ? {
            kind: 'approved',
            grant: writeClaim.grant,
            paDurableMint: writeClaim.paDurableMint,
            request: writeClaim.request,
            placementName: writeClaim.placementName,
            paConstructionBinding: writeClaim.paConstructionBinding,
          }
        : await paAdmit.open(walk)
      if (opened.kind === 'deny') {
        const settled = arm.cancel(classified.plan)
        throw new Error(`refused-write ${opened.code ?? 'ADMISSION_REFUSED'} — ${opened.detail ?? 'the admission refused this call'} (arm settle: ${String(settled.settled ?? settled.code ?? 'n/a')})`)
      }
      if (opened.cancelled === true) {
        const settled = arm.cancel(classified.plan)
        throw new Error(`write · cancelled — the call was cancelled at the PA edge before admission (${String(settled.writeOutcome ?? 'zero write')})`)
      }
      if (opened.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        arm.cancel(classified.plan)
        throw new Error(`refused-write APPROVAL_NOT_LANDED — the admission answered ${String(opened.kind ?? 'unsettled')} without a landed grant; internal arm state never substitutes for the kernel answer`)
      }
      let prepared
      try {
        prepared = arm.prepare(classified.plan, opened.grant)
      } catch (error) {
        paAdmit.closePlan(walk.callId)
        arm.cancel(classified.plan)
        throw new Error(`refused-write arm-unavailable — the arm threw while preparing the grant (${String(error?.message ?? error).slice(0, 160)}); the plan fact was closed and nothing ran`)
      }
      if (prepared.ok !== true) {
        paAdmit.closePlan(walk.callId)
        throw new Error(`refused-write ${prepared.code ?? 'P_WRITE_NOT_ADMITTED'} — ${prepared.detail ?? 'the arm refused the kernel grant'}`)
      }
      // From this line on, the call's plan fact belongs to the edge's own
      // finally (it closes on every outcome); before it, the net below closes.
      writeEdgeRan = true
      const edge = await paAdmit.edge({
        ...walk,
        grant: opened.grant,
        paDurableMint: opened.paDurableMint,
        request: opened.request,
        placementName: opened.placementName,
        paConstructionBinding: opened.paConstructionBinding,
      })
      if (edge.kind === 'deny') {
        const settled = arm.cancel(classified.plan)
        throw new Error(`refused-write ${edge.code ?? 'GRANT_STALE'} — ${edge.detail ?? 'the execution edge refused this call'} (arm settle: ${String(settled.settled ?? settled.code ?? 'n/a')})`)
      }
      if (edge.cancelled === true) {
        const settled = arm.cancel(classified.plan)
        throw new Error(`write · cancelled — the call was cancelled at the execution edge (${String(settled.writeOutcome ?? 'zero write')}; the approval stays unspent and is never replayed)`)
      }
      // The witness law (todo ruling): `consumed: true` comes ONLY from the
      // REAL final edge's consumedProof; the row never self-attests.
      const proof = edge.consumedProof
      if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string') {
        const settled = arm.cancel(classified.plan)
        throw new Error(`refused-write CONSUME_PROOF_MISSING — the execution edge answered allow without its one-shot consume witness; the row never self-attests consumption from a missing denial and the closure is never minted (arm settle: ${String(settled.settled ?? settled.code ?? 'n/a')})`)
      }
      // The NAMED race (fix-3 law): an abort landing between the REAL
      // consume and the closure's first microtask — the consumed grant is
      // ledger truth and NEVER rolls back; the closure that was never
      // claimed writes ZERO.
      if (signal?.aborted === true) {
        const settled = arm.cancel(classified.plan)
        throw new Error(`write · cancelled — the call was aborted after the execution edge consumed the grant and before the closure began (the consumption is a settled fact and is never rolled back; ${String(settled.writeOutcome ?? 'zero write')})`)
      }
      // THE private closure call: the consumed proof, the plan, and the
      // call's own signal (the closure's multi-chunk cancellation law) — no
      // other argument crosses the approval line.
      const ran = await arm.execute(classified.plan, { consumed: true, grant: proof.grant, signal })
      if (ran.ok !== true) {
        // Error protocol (root ruling @10:25, the 2291 follow-up): the row's
        // refusal surface to the caller — and the ONLY string the model ever
        // reads — is the plain Error MESSAGE, so the arm's structured risk
        // facts from `mapClosureRefusal` (cfClass / cfReason /
        // sideEffectPossible: the closed C-FS classes riding `cfsDenial`
        // details) ride this message VERBATIM. Dropping them meant the most
        // consequential refusal class — a possible side effect past the
        // truncation edge — arrived stripped of exactly its classification.
        // Same Error, same protocol: no new code, no new gate, nothing for
        // the row to decide — only facts it already received, delivered.
        const risk = []
        if (typeof ran.cfClass === 'string') risk.push(`cf-class=${ran.cfClass}`)
        if (typeof ran.cfReason === 'string') risk.push(`cf-reason=${ran.cfReason}`)
        if (ran.sideEffectPossible === true) risk.push('side-effect-possible=true')
        const error = new Error(`refused-write ${ran.code ?? 'P_WRITE_NOT_ADMITTED'} — ${ran.detail ?? 'the governed execution edge refused the closure'}${risk.length > 0 ? ` · ${risk.join(' · ')}` : ''}`)
        if (typeof ran.cfClass === 'string') error.cfClass = ran.cfClass
        if (typeof ran.cfReason === 'string') error.cfReason = ran.cfReason
        if (ran.sideEffectPossible === true) error.sideEffectPossible = true
        throw error
      }
      return ran.value
      } finally {
        if (abortListener !== undefined && typeof signal?.removeEventListener === 'function') {
          signal.removeEventListener('abort', abortListener)
        }
        // A redeemed call owns the plan fact the pre-dispatch Part A left
        // standing; the edge's finally closes it once the edge RAN, and this
        // net closes it on every exit BEFORE the edge. Idempotent with the
        // explicit closes above — never a leak, never a double verdict.
        if (writeClaim !== undefined && !writeEdgeRan) paAdmit.closePlan(correlation)
        // Every path settles the token (shared ledger, root ruling @ 9c817:
        // used identities are NEVER evicted; the map dies with the mount).
        governedTokenLedger.set(tokenKey, { correlation, settled: true })
      }
    },
    output: Object.freeze({
      schema: Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: {
          canonicalLocator: Object.freeze({ type: 'string' }),
          writtenFingerprint: Object.freeze({ type: 'string' }),
          existingFileOnly: Object.freeze({ type: 'boolean' }),
        },
        // r9 canonical law (same-source scan of the write face): property-level
        // `required: true` is the host's authored DSL, not a registration
        // face; every property of this receipt is REQUIRED, said once at the
        // parent exactly like the host's compiled output form.
        required: Object.freeze(['canonicalLocator', 'writtenFingerprint', 'existingFileOnly']),
      }),
      // r12 ROOT MIN FIX (13:10): `render` lives INSIDE `output` — the real
      // tools.register contract (index.ts:1063 throws unless output.render is
      // a function; `output { schema, render, presentationMeta? }`), the SAME
      // shape the read/todo/image rows already use. The body is UNCHANGED:
      // same result/risk fields, same execution logic, pure text projection of
      // one validated canonical value (the image row's structure reused).
      render: (_args, value) => [{
        type: 'text',
        text: `Wrote ${String(value?.canonicalLocator ?? 'the approved target')} (existing-file governed write, ${String(value?.writtenFingerprint ?? '')}).`,
      }],
    }),
    // presentCall stays at the definition's TOP level — its real Host contract
    // position (ToolDefinition.presentCall, the pending-state presenter), not
    // inside output; the write result/risk fields and execute logic are
    // untouched.
    presentCall: (args) => ({ card: 'generic', title: 'Write file (governed)', kind: 'other', rawInput: args?.file_path }),
  })]

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
      execute: async (raw, exec) => {
        // fix-2b: read RECEIVES the host exec. 9e fix-1: the REAL token
        // rides (object | symbol, exactly like the shell row) — the plane
        // NEVER stringifies it (`String(symbol)` throws; stringify was the
        // A1 violation). The correlation is the a5p5 LEDGER's allocated
        // string (`exec.tokenKey`), the same identity the trio rows carry.
        const corr = {
          ...(exec?.token === undefined ? {} : { token: exec.token }),
          ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
          ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
        }
        const outcome = await readExecutor(raw, corr)
        if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
          return { path: outcome.path, offset: outcome.offset, lines: outcome.lines, totalLines: outcome.totalLines }
        }
        if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
          // PR358-A2: the cancelled read is a PRESENTED row-form fact, not
          // a refusal — zero byte read, honest word carried (mirrors the
          // shell row's own `· cancelled` law; no resolver ever ran).
          return { cancelled: true, content: [{ type: 'text', text: 'read · cancelled' }], meta: { cancelled: true } }
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
  // A5-M2 B-IMAGE (CENTER vertical): the governed read_image row. Same
  // machinery as todo/write: the SHARED token ledger (one registry token,
  // one governed flight across the rows), THIS plane's PA admission (open →
  // REAL final edge → consumedProof), and the reviewed B-IMAGE arm as the
  // BODY. The arm owns the consumption-context law (ask receipt vs all-allow
  // REAL grant, the five-way binding, the required family carrier, full
  // typed-plan equality, the ONE port read and the commit); the ROW owns the
  // single flight, the walk, the final edge, and the trusted this-call facts
  // the arm re-ties against — every callFacts field is taken from OUTSIDE
  // the arm (the provider-side placement record, the plane's confirmed fresh
  // generation read, the kernel-admitted member), never self-attested. The
  // arm's structured fields (sideEffectPossible where present) ride the
  // plain-Error in-band protocol, write-row shape verbatim: no new code, no
  // new gate.
  let imageArm = null
  const imageDef = imageInject === null ? null : Object.freeze({
    name: A5_IMAGE_MOUNT_NAME,
    // The CAPTURED native description + parameters bytes (Gate 0e): same
    // name, same meaning — never a plane-invented wording or schema.
    description: imageInject.description,
    parameters: imageInject.parameters,
    execute: async (raw, exec) => {
      const arm = imageArm
      // Identity law (fix-1, SHARED ledger): the REAL registry token; absent
      // is a typed front refusal — zero classify, zero walk, zero row.
      const execToken = exec?.token
      const tokenKey = (typeof execToken === 'object' && execToken !== null) || typeof execToken === 'symbol' ? execToken : undefined
      if (tokenKey === undefined) {
        throw new Error('refused-image exec-token-unbound — this execution carries no registry token (object|symbol); the row keys its single-flight and its correlation on the REAL exec.token and composes no identity from name or model-call fields')
      }
      const priorFlight = governedTokenLedger.get(tokenKey)
      // A5-M2 IMAGE HAND-OFF redemption (the write row's take law, verbatim):
      // the ONE in-flight HANDED-OFF flight on this token IS this body's
      // redemption — the ledger's single-flight law holds, because the flight
      // was opened FOR this exact execution at pre-dispatch. The take is
      // SYNCHRONOUS and SINGLE: a re-entrant second redemption finds no flight
      // and fails closed there (Part A is never re-run, no fallback lane serves
      // this read_image). Any other prior stays the typed replay refusal.
      let imageClaim
      let correlation
      if (priorFlight !== undefined && !priorFlight.settled && priorFlight.handedOff === true) {
        imageClaim = imagePaHandoffs.get(tokenKey)
        imagePaHandoffs.delete(tokenKey)
        if (imageClaim === undefined) {
          throw new Error('refused-image PA_HANDOFF_LOST — the pre-dispatch PA hand-off of this execution is gone (closed, torn down, or already spent); Part A is never re-run and no fallback lane serves this read_image')
        }
        // ONE correlation per token for its whole life: the redemption runs
        // under the ORIGINAL id Part A asked with, never a fresh one.
        correlation = priorFlight.correlation
      } else if (priorFlight !== undefined) {
        throw new Error(`refused-image exec-token-replay — this execution token already ${priorFlight.settled ? 'owns a settled' : 'owns an in-flight'} governed plane call (todo/write/image share ONE token ledger: a registry token spans exactly one flight of one row); one token runs one governed flight and a settled token is never re-armed (the read row's single-flight law, verbatim)`)
      } else {
        imageCorrSeq += 1
        correlation = `plane-image:${realmId}-${String(imageCorrSeq)}`
        governedTokenLedger.set(tokenKey, { correlation, settled: false })
      }
      // The plan fact this call owns from the pre-dispatch hold; the edge's
      // finally closes it, and this net closes it on EVERY exit BEFORE the
      // edge (mismatch, classify faults) — idempotent, never a leak.
      let imageEdgeRan = false
      const signal = exec?.signal
      try {
      // OWNER-CURRENT BEFORE THE FREEZE (fix-4 law, the same authority leg
      // as todo/write and paAdmitPartA): a faulting leg is OBSERVED, never
      // absorbed. The fresh read ALSO refreshes the plane's confirmed
      // generation — the value handed to the arm as a trusted fact below.
      if (typeof paEnsureAuthorityCurrent === 'function' && typeof paGenerationReader === 'function') {
        const freshAuthority = await paReadGenerationFresh()
        if (freshAuthority.ok === true) {
          try {
            await paEnsureAuthorityCurrent(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''), freshAuthority.value)
          } catch (error) {
            observe(`a5m2-image-row: ensure-current(g=${String(freshAuthority.value)}) threw (${String(error?.message ?? error).slice(0, 160)}) — the call continues on the live tuple and the kernel identity leg answers it`)
          }
        }
      }
      let classified
      try {
        classified = arm.classify(raw)
      } catch (error) {
        throw new Error(`refused-image arm-unavailable — the governed image arm could not classify this call (${String(error?.message ?? error).slice(0, 160)}); there is no native fallback to fall back to`)
      }
      if (classified.ok !== true || classified.targetManifest === undefined) {
        // Pure-lexical refusals (outside-root, undeclared mediaType, closed
        // argument set) land HERE with zero fs calls and zero admission —
        // there is no plan to cancel: the image arm is stateless pre-edge
        // by design (the design card's 9-leg law, leg 9).
        throw new Error(`refused-image ${classified.code ?? 'P_IMAGE_CLASSIFY_INVALID'} — ${classified.detail ?? 'the governed classify refused this call before admission'}`)
      }
      const parsedEffects = parseRequestedEffectSet(classified.effects)
      if (parsedEffects.ok !== true) {
        throw new Error(`refused-image effects-unparsable — the arm's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})`)
      }
      const walk = {
        realmId,
        callId: correlation,
        // SEAM #1 CLOSED (root ruling 10:37Z 收接缝) + CENTRAL-CARD ③
        // (10:5xZ): the digest is INDEPENDENT and COMPLETE over the
        // ORIGINAL parameters — the raw `file_path` value rides it in full,
        // so two different spellings of the same governed file are two
        // different fingerprints (a canonicalTarget-only digest would
        // MERGE them; the kernel never recomputes this — pa-control-bridge
        // carries the string verbatim into the durable manifest (:483) and
        // re-verifies equality at the edge (:1119), so the same walk object
        // across open→edge IS the pairing consistency). The
        // operationFingerprint stays the manifest's own independent field.
        parametersFingerprint: canonicalJsonFingerprint({
          realmId,
          toolName: A5_IMAGE_MOUNT_NAME,
          parameters: raw,
          effects: classified.effects,
          targetManifest: classified.targetManifest,
        }),
        requestedEffects: parsedEffects.value,
        toolName: A5_IMAGE_MOUNT_NAME,
        family: Object.freeze({
          familyId: arm.familyId,
          adapterRevision: arm.adapterRevision,
          providerIdentity: arm.providerId,
          targetManifest: classified.targetManifest,
        }),
        ...(signal === undefined ? {} : { signal }),
      }
      if (imageClaim !== undefined) {
        // BODY FRESH RECHECK (exact-match law, the write row's, verbatim): the
        // redemption must answer the SAME question Part A asked — the same
        // call identity and the same full-values digest over the body's OWN
        // fresh classify. Drift is a REFUSAL, never a re-approval: the front
        // door opened NOTHING for this call, so an old Ask could not authorize
        // it even if one were minted. (No arm-side settle: the image arm is
        // stateless pre-edge — nothing was prepared to cancel.)
        if (imageClaim.parametersFingerprint !== walk.parametersFingerprint || imageClaim.callId !== correlation) {
          throw new Error('refused-image PA_HANDOFF_MISMATCH — the redemption does not ask the question the pre-dispatch PA walk was approved for; nothing ran (zero port calls, zero attachment writes)')
        }
      }
      // A redeemed walk SKIPS its own Part A — a second walk would be a second
      // question (a second Ask waiting on the human). The unspent grant and
      // its construction tuple ride to the execution edge exactly as Part A
      // handed them over; the edge re-reads the facts FRESH and performs the
      // ONE consume. The non-hand-off path keeps the walk below byte-for-byte.
      const opened = imageClaim !== undefined
        ? {
            kind: 'approved',
            grant: imageClaim.grant,
            paDurableMint: imageClaim.paDurableMint,
            request: imageClaim.request,
            placementName: imageClaim.placementName,
            paConstructionBinding: imageClaim.paConstructionBinding,
          }
        : await paAdmit.open(walk)
      if (opened.kind === 'deny') {
        throw new Error(`refused-image ${opened.code ?? 'ADMISSION_REFUSED'} — ${opened.detail ?? 'the admission refused this call'} (zero port calls, zero attachment writes)`)
      }
      if (opened.cancelled === true) {
        throw new Error('read_image · cancelled — the call was cancelled at the PA edge before admission (zero port calls, zero attachment writes)')
      }
      if (opened.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        throw new Error(`refused-image APPROVAL_NOT_LANDED — the admission answered ${String(opened.kind ?? 'unsettled')} without a landed grant; internal arm state never substitutes for the kernel answer`)
      }
      // From this line on, the call's plan fact belongs to the edge's own
      // finally (it closes on every outcome); before it, the net below closes.
      imageEdgeRan = true
      const edge = await paAdmit.edge({
        ...walk,
        grant: opened.grant,
        paDurableMint: opened.paDurableMint,
        request: opened.request,
        placementName: opened.placementName,
        paConstructionBinding: opened.paConstructionBinding,
      })
      if (edge.kind === 'deny') {
        throw new Error(`refused-image ${edge.code ?? 'GRANT_STALE'} — ${edge.detail ?? 'the execution edge refused this call'} (zero port calls, zero attachment writes)`)
      }
      if (edge.cancelled === true) {
        throw new Error('read_image · cancelled — the call was cancelled at the execution edge (the approval stays unspent and is never replayed)')
      }
      // `consumed: true` is produced ONLY from the REAL final edge's success
      // witness (write-row law verbatim): an allow shape without its
      // one-shot consume witness refuses; the arm never receives a
      // self-attested consumption, never a grant backfilled from the
      // pre-edge copy.
      const proof = edge.consumedProof
      if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string') {
        throw new Error('refused-image CONSUME_PROOF_MISSING — the execution edge answered allow without its one-shot consume witness; the row never self-attests consumption from a missing denial and the body does not run')
      }
      // The NAMED race (fix-3 law): between the REAL consume and the body's
      // first microtask an abort can still land. The consumed grant is
      // ledger truth and NEVER rolls back; the body that never started did
      // ZERO port calls and ZERO attachment writes. The image arm is
      // stateless pre-edge (no cancel law to link — the write arm's cancel
      // belongs to its pending-write fact, which has no image analogue).
      if (signal?.aborted === true) {
        throw new Error('read_image · cancelled — the call was aborted after the execution edge consumed the grant and before the body began (the consumption is a settled fact and is never rolled back; zero port calls, zero attachment writes)')
      }
      // SEAM #2 CLOSED (root ruling 10:37Z 收接缝): the two legal worlds are
      // told apart by the DURABLE FACT of a Control row — `paDurableMint
      // .requestId` exists only where the ask lane's durable request was
      // really created (paAdmitPartA sets it from the leg answer and
      // NOWHERE else); the all-allow lane never carries one. The receipt is
      // a pure VIEW of the leg's own durable bytes (requestId + manifest +
      // the consumed credential): NOTHING synthesized. If the durable
      // manifest lacks a field the arm checks, the arm refuses that world
      // honestly — the row supplies no stand-in. Every callFacts field is
      // trusted and EXTERNAL to the arm: member from the kernel-admitted
      // request facts, definition identity from the PROVIDER-SIDE placement
      // record, the generation from the plane's confirmed fresh read, the
      // provider identity being the plane's own constant (the same one the
      // request-binding projection carries).
      const placement = placementFeed(A5_IMAGE_MOUNT_NAME)
      const durableRequestId = typeof opened.paDurableMint?.requestId === 'string' ? opened.paDurableMint.requestId : ''
      const askWorld = durableRequestId.length > 0
      const callFacts = Object.freeze({
        approval: askWorld ? 'ask' : 'all-allow',
        ...(askWorld ? {} : { grant: proof.grant }),
        member: Object.freeze({ teamSessionId: String(input.teamSessionId ?? ''), instanceId: String(input.instanceId ?? '') }),
        callId: correlation,
        definitionIdentity: placement?.definitionIdentity,
        providerIdentity: 'a5p5-plane',
        authorityGeneration: paAuthorityGeneration(),
      })
      const receipt = askWorld
        ? Object.freeze({
          decision: 'approve',
          requestId: durableRequestId,
          manifest: opened.paDurableMint.manifest,
          grant: proof.grant,
        })
        : undefined
      const ran = await arm.execute(raw, receipt, callFacts, signal)
      if (ran.ok !== true) {
        // The in-band risk protocol (f609c1b law): the arm's structured
        // fields ride the message VERBATIM — the side-effect class must not
        // be truncated away from the model-facing surface.
        const risk = []
        if (ran.sideEffectPossible === true) risk.push('side-effect-possible=true')
        if (typeof ran.cfClass === 'string') risk.push(`cf-class=${ran.cfClass}`)
        if (typeof ran.cfReason === 'string') risk.push(`cf-reason=${ran.cfReason}`)
        const error = new Error(`refused-image ${ran.code ?? 'P_IMAGE_NOT_ADMITTED'} — ${ran.detail ?? 'the governed execution edge refused the body'}${risk.length > 0 ? ` · ${risk.join(' · ')}` : ''}`)
        if (ran.sideEffectPossible === true) error.sideEffectPossible = true
        if (typeof ran.cfClass === 'string') error.cfClass = ran.cfClass
        if (typeof ran.cfReason === 'string') error.cfReason = ran.cfReason
        throw error
      }
      return ran.value
      } finally {
        // A redeemed call owns the plan fact the pre-dispatch Part A left
        // standing; the edge's finally closes it once the edge RAN, and this
        // net closes it on every exit BEFORE the edge. Idempotent — never a
        // leak, never a double verdict.
        if (imageClaim !== undefined && !imageEdgeRan) paAdmit.closePlan(correlation)
        // Every path settles the token (shared ledger, root ruling @ 9c817:
        // used identities are NEVER evicted; the map dies with the mount).
        governedTokenLedger.set(tokenKey, { correlation, settled: true })
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Read image (governed)', kind: 'other', rawInput: args?.file_path }),
    // CENTRAL-CARD ① (root on 6c354): the render lives in `output` (the
    // read row's READ_ROW_PRESENTATION_FACE pattern) and returns the
    // NATIVE two-block shape — the envelope text AND the image block
    // (read-image.ts:190-195: text + {type:'image', attachment: ref}). A
    // text-only render dropped the model-facing visual content; the shapes
    // are the host's own (mirrored locally, exactly how the read row
    // mirrors formatReadRowOutput — no host-internal import). THE REF FIELDS
    // (root narrow review on ea12, item ①): the attachment block mirrors the
    // HOST ref field set — `width`/`height` are the STORE receipt's
    // coordinates (the stored, normalized object), and `originalDimensions`
    // rides through WHEN PRESENT (pin639: present only when normalization
    // reduced the raster) so original-frame coordinate mapping survives to
    // the consumer. Pass-through is the coincidence of a 1:1 store, not the
    // rule; the render never re-derives or re-reads anything.
    output: Object.freeze({
      schema: Object.freeze({
        type: 'object',
        additionalProperties: false,
        properties: {
          path: Object.freeze({ type: 'string' }),
          image: Object.freeze({ type: 'object' }),
        },
        // r9 canonical law (same-source scan of the image face): the parent
        // says the two members once — property-level markers are the host's
        // authored DSL and never reach a registration face.
        required: Object.freeze(['path', 'image']),
      }),
      render: (_args, value) => {
        const image = value?.image ?? {}
        // THE TEXT CLAUSE (root proof 12:04: the Host serializers ride the
        // dimensions INSIDE the text envelope — dropping them there loses the
        // original frame even when the attachment block carries it). NATIVE
        // SEMANTICS REUSED VERBATIM (read-image.ts formatImageReadOutput
        // :167-181): a downscaled read names the original dimensions and the
        // multiplier mapping attached-image coordinates back onto the
        // original file; one multiplier only when both axes round equal.
        // Guard per root ruling: the clause appears when the ORIGINAL frame
        // EXISTS AND DIFFERS from the preview dims the block shows.
        const original = Number.isInteger(image.originalDimensions?.width) && Number.isInteger(image.originalDimensions?.height)
          ? image.originalDimensions
          : undefined
        let scaled = ''
        if (original !== undefined && Number.isInteger(image.width) && Number.isInteger(image.height)
          && (original.width !== image.width || original.height !== image.height)) {
          const x = (original.width / image.width).toFixed(2)
          const y = (original.height / image.height).toFixed(2)
          const advice = x === y
            ? `multiply coordinates by ${x}`
            : `multiply x coordinates by ${x} and y coordinates by ${y}`
          scaled = ` (downscaled from ${original.width}x${original.height} px; ${advice} to locate features in the original file)`
        }
        const blocks = [{
          type: 'text',
          text: `<path>${String(value?.path ?? '')}</path>\n<type>image</type>\n<content>\n${String(image.mediaType ?? 'image')} image, ${String(image.width ?? '?')}x${String(image.height ?? '?')} px, ${String(image.bytes ?? '?')} bytes${scaled}\n</content>`,
        }]
        if (typeof image.attachmentId === 'string' && image.attachmentId.length > 0
          && typeof image.mediaType === 'string' && Number.isInteger(image.bytes) && Number.isInteger(image.width) && Number.isInteger(image.height)) {
          blocks.push({
            type: 'image',
            attachment: Object.freeze({
              attachmentId: image.attachmentId,
              mediaType: image.mediaType,
              bytes: image.bytes,
              width: image.width,
              height: image.height,
              ...(typeof image.name === 'string' && image.name.length > 0 ? { name: image.name } : {}),
              ...(Number.isInteger(image.originalDimensions?.width) && Number.isInteger(image.originalDimensions?.height)
                ? { originalDimensions: Object.freeze({ width: image.originalDimensions.width, height: image.originalDimensions.height }) }
                : {}),
            }),
          })
        }
        return blocks
      },
    }),
  })
  // A5-M2 IMAGE HAND-OFF (root 14:44, the SYMMETRIC third port): the pre-
  // dispatch face of the governed read_image row. The write hand-off's law
  // carried VERBATIM where the image row agrees with it, with exactly ONE
  // disclosed structural difference: the image arm is stateless pre-edge
  // (the design card's 9-leg law — classify is pure-lexical and mints NO
  // plan, so there is nothing to cancel and NO arm-cancel leg anywhere in
  // this face; the shared token ledger, the placeholder-before-await, the
  // after-await re-check, the single synchronous take and the fresh edge
  // redemption are byte-for-byte the same law).
  const imagePaHandoffs = new Map() // token(object|symbol) -> placeholder | unspent claim
  let imageHandoffSeq = 0
  let imageRowMounted = true
  /** The `tools/result` terminal close (mirrors the read/write law):
   *  idempotent, synchronous, terminal never re-armed. Returns the
   *  correlation whose plan fact this close still owes the mount — only an
   *  UNSPENT flight or an in-flight placeholder does; a redeemed one was
   *  closed by its own edge. */
  const imageHandoffClose = (token) => {
    if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) return undefined
    const flight = imagePaHandoffs.get(token)
    imagePaHandoffs.delete(token)
    const prior = governedTokenLedger.get(token)
    if (prior !== undefined && !prior.settled) {
      governedTokenLedger.set(token, { correlation: prior.correlation, settled: true })
    }
    return flight?.callId
  }
  /** Mount teardown: no image hand-off survives its mount, claimed or not —
   *  the flight, the unspent grant and the plan fact die with the placement
   *  (the read/write rows' teardown law, independent of the terminal
   *  observer; the close lands BEFORE the arm's drain, same ordering). */
  const imageHandoffCloseAll = () => {
    imageRowMounted = false
    for (const token of [...imagePaHandoffs.keys()]) {
      const callId = imageHandoffClose(token)
      if (typeof callId === 'string') paAdmit.closePlan(callId)
    }
  }
  const imageHandoffOpen = async (exec) => {
    if (exec === null || typeof exec !== 'object') return { kind: 'no-match' }
    if (exec.name !== A5_IMAGE_MOUNT_NAME) return { kind: 'no-match' }
    const token = exec.token
    if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) {
      // The name IS this mount's governed read_image, so the effect-set
      // question belongs to PA: with no execution identity the call REFUSES,
      // it never falls back to the pre-hand-off lane.
      return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_UNBOUND', detail: 'this governed read_image carries no execution token, so no PA hand-off can be opened or redeemed for it' }
    }
    if (!imageRowMounted || imageArm === null) {
      return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_MOUNT_GONE', detail: 'the mount was torn down (or the image arm was never placed) before the hand-off opened; nothing is asked and nothing is authorized' }
    }
    const prior = governedTokenLedger.get(token)
    if (prior !== undefined) {
      // A TERMINAL token is never re-armed, and a token that already owns a
      // flight never takes a second open: a side-effect-free refusal that
      // reuses nothing (an authorization is not transferable, and the first
      // leg's state is not touched).
      return {
        kind: 'refused',
        ownsHandoff: false,
        code: prior.settled === true ? 'PA_HANDOFF_TERMINAL' : 'PA_HANDOFF_IN_FLIGHT',
        detail: prior.settled === true
          ? 'this execution token is already terminal, so no PA hand-off may be opened on it again'
          : 'a governed flight already owns this execution token; a second open is refused without touching the in-flight state and no answer is reused',
      }
    }
    const arm = imageArm
    const signal = exec.signal
    imageCorrSeq += 1
    const correlation = `plane-image:${realmId}-${String(imageCorrSeq)}`
    imageHandoffSeq += 1
    const mySeq = imageHandoffSeq
    // The ledger entry and the pending placeholder are taken BEFORE the first
    // await (write law verbatim): a close landing mid-walk must find this leg,
    // and the re-check after the walk must find it GONE.
    governedTokenLedger.set(token, { correlation, settled: false })
    imagePaHandoffs.set(token, Object.freeze({ pending: true, seq: mySeq, callId: correlation }))
    const releasePlaceholder = () => {
      if (imagePaHandoffs.get(token)?.seq === mySeq) imagePaHandoffs.delete(token)
    }
    const settleToken = () => {
      const now = governedTokenLedger.get(token)
      if (now !== undefined && !now.settled) governedTokenLedger.set(token, { correlation: now.correlation, settled: true })
    }
    // OWNER-CURRENT BEFORE THE FREEZE (the fix-4 leg VERBATIM): Part A asks
    // the whole question, including the fresh-authority walk; a faulting leg
    // is OBSERVED, never absorbed.
    if (typeof paEnsureAuthorityCurrent === 'function' && typeof paGenerationReader === 'function') {
      const freshAuthority = await paReadGenerationFresh()
      if (freshAuthority.ok === true) {
        try {
          await paEnsureAuthorityCurrent(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''), freshAuthority.value)
        } catch (error) {
          observe(`a5m2-image pa-handoff: ensure-current(g=${String(freshAuthority.value)}) threw (${String(error?.message ?? error).slice(0, 160)}) — the walk continues on the live tuple and the kernel identity leg answers it`)
        }
      }
    }
    let classified
    try {
      classified = arm.classify(exec.arguments)
    } catch (error) {
      releasePlaceholder()
      settleToken()
      return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_FAULT', detail: `the governed image arm could not classify this call at the pre-dispatch leg (${String(error?.message ?? error).slice(0, 160)}); there is no native fallback to fall back to` }
    }
    if (classified.ok !== true || classified.targetManifest === undefined) {
      // Pure-lexical refusals pass their code through (the row body's own
      // refusal shape, carried to the hand-off leg): zero admission asked,
      // nothing to settle — the arm is stateless pre-edge.
      releasePlaceholder()
      settleToken()
      return { kind: 'refused', ownsHandoff: true, code: String(classified.code ?? 'P_IMAGE_CLASSIFY_INVALID'), detail: String(classified.detail ?? 'the governed classify refused this call before admission') }
    }
    const parsedEffects = parseRequestedEffectSet(classified.effects)
    if (parsedEffects.ok !== true) {
      releasePlaceholder()
      settleToken()
      return { kind: 'refused', ownsHandoff: true, code: 'EFFECTS_UNPARSABLE', detail: `the arm's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})` }
    }
    // The SAME independent, COMPLETE digest the row body computes over its
    // OWN raw parameters (SEAM #1 law): two spellings of one file are two
    // fingerprints; the redemption re-derives it and must match exactly.
    const parametersFingerprint = canonicalJsonFingerprint({
      realmId,
      toolName: A5_IMAGE_MOUNT_NAME,
      parameters: exec.arguments,
      effects: classified.effects,
      targetManifest: classified.targetManifest,
    })
    const walk = {
      realmId,
      callId: correlation,
      parametersFingerprint,
      requestedEffects: parsedEffects.value,
      toolName: A5_IMAGE_MOUNT_NAME,
      family: Object.freeze({
        familyId: arm.familyId,
        adapterRevision: arm.adapterRevision,
        providerIdentity: arm.providerId,
        targetManifest: classified.targetManifest,
      }),
      ...(signal === undefined ? {} : { signal }),
    }
    let opened
    try {
      opened = await paAdmit.open(walk)
    } catch (error) {
      releasePlaceholder()
      settleToken()
      paAdmit.closePlan(correlation)
      return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_FAULT', detail: `Part A threw and is never treated as an authorization: ${String(error?.message ?? error).slice(0, 180)}` }
    }
    // AFTER the await the world is RE-CHECKED, not assumed (write law
    // verbatim): a close or a teardown landing while PA was being asked
    // voids the leg; its grant, if one landed, is dropped and NOTHING is
    // registered. No arm-side settle exists here — the image arm mints no
    // pre-dispatch plan, so the dropped answer has nothing to cancel.
    const held = imagePaHandoffs.get(token)
    if (!imageRowMounted) {
      releasePlaceholder()
      settleToken()
      paAdmit.closePlan(correlation)
      observe('a5m2-image pa-handoff dropped — mount torn down during the walk')
      return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_MOUNT_GONE', detail: 'the mount was torn down while PA was being asked; the answer is dropped and nothing is authorized' }
    }
    if (held === undefined || held.seq !== mySeq) {
      settleToken()
      paAdmit.closePlan(correlation)
      observe('a5m2-image pa-handoff dropped — the leg was closed while PA was being asked')
      return { kind: 'refused', ownsHandoff: true, code: 'PA_HANDOFF_CLOSED', detail: 'this hand-off leg was closed while PA was being asked; the answer is dropped and nothing is authorized' }
    }
    if (opened.cancelled === true) {
      // CANCELLATION IS NOT PERMISSION: zero consumption, zero body; the
      // adapter's cancelled branch denies without ever reaching the row.
      releasePlaceholder()
      settleToken()
      return { kind: 'cancelled', detail: 'the PA walk answered this invocation cancelled before dispatch (zero port calls, zero attachment writes)' }
    }
    if (opened.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
      releasePlaceholder()
      settleToken()
      observe(`a5m2-image pa-handoff refused code=${String(opened.code ?? opened.kind ?? 'unknown')}`)
      return { kind: 'refused', ownsHandoff: true, code: String(opened.code ?? 'PA_HANDOFF_REFUSED'), detail: String(opened.detail ?? 'the pre-dispatch PA walk refused this read_image') }
    }
    // THE HOLD (write law verbatim): 'approved' buys ONLY release — the
    // grant stays UNSPENT and rides the flight to the body, which still owes
    // the whole fresh recheck and the single edge. The plan fact STAYS (the
    // redemption edge re-reads it and closes it).
    imagePaHandoffs.set(token, Object.freeze({
      callId: correlation,
      parametersFingerprint: String(parametersFingerprint),
      grant: opened.grant,
      paDurableMint: opened.paDurableMint,
      request: opened.request,
      placementName: opened.placementName,
      paConstructionBinding: opened.paConstructionBinding,
    }))
    governedTokenLedger.set(token, { correlation, settled: false, handedOff: true })
    observe(`a5m2-image pa-handoff OPEN call=${correlation}`)
    return { kind: 'authorized', correlation }
  }
  if (imageDef !== null) {
    // THE PLACEMENT MOMENT (central-card ②): the arm is constructed HERE,
    // over the def THIS plane actually placed — the factory binds
    // definitionIdentityOf(that def), the WeakMap id the seam mints for the
    // registered body, the Guard compares, and placementFeed reports. A
    // surface that answers less than the reviewed B-IMAGE contract, or a
    // factory that throws, refuses the ASSEMBLY (never a half-wired row).
    try {
      imageArm = imageInject.createArm(imageDef)
    } catch (error) {
      return { ok: false, code: 'IMAGE_ARM_INJECT_INVALID', message: `backends.image.createArm refused the placed definition: ${String(error?.message ?? error).slice(0, 200)}` }
    }
    const armBad = imageArm === undefined || imageArm === null
      ? 'the factory answered no arm'
      : (typeof imageArm.classify !== 'function' || typeof imageArm.execute !== 'function' || typeof imageArm.reference !== 'function' || typeof imageArm.drain !== 'function'
              || imageArm.familyId !== 'B-IMAGE' || typeof imageArm.adapterRevision !== 'number'
              || typeof imageArm.definitionIdentity !== 'string' || imageArm.definitionIdentity.length === 0
              || typeof imageArm.providerId !== 'string' || imageArm.providerId.length === 0)
        ? 'the answered arm is not the governed B-IMAGE surface (classify/execute/reference/drain + family facts + a bound definitionIdentity)'
        : undefined
    if (armBad !== undefined) return { ok: false, code: 'IMAGE_ARM_INJECT_INVALID', message: `backends.image: ${armBad}` }
  }
  const imageDefs = imageDef === null ? [] : [imageDef]
  // ── A5-M2 G1 PURE-QUERY rows (Gate 0f) ─────────────────────────────────
  // Each row is a DEFINITION THIS plane places at the record's FIXED native
  // spelling, and its body is ONE vertical: the injected COMMITTED adapter row
  // classifies (effects + full-value parameters fingerprint + its own typed
  // plan) → THIS plane's ONE PA admission walks (Part A + the durable Control
  // leg) → the ONE-shot execution edge (the kernel's consumption, its witness
  // carried back) → the SAME adapter row's `delegate` enters the CAPTURED
  // native definition's own face through its bind-time snapshot (保留原生).
  // There is no native fallback anywhere below: every refusal path is a typed
  // throw with zero native entry, and no second authority is invented — the
  // row's identity is the shared token ledger's allocation, the plan identity
  // is the adapter's own frozen plan, and the family's read-side laws (CURRENT
  // facts re-verify, the inspect topology filter, the pending-control read)
  // stay closed INSIDE the adapter module, which this plane does not patch.
  //
  // WHY NO FAMILY BLOCK RIDES THE LEG (disclosed, not hidden): the committed
  // Control grammar validates a family target against `PA_FAMILY_TARGET_RULES`,
  // which registers structures for B-SESSION / B-WRITE / B-IMAGE ONLY. The G1
  // families (B-INSPECT / B-CONTROL …) have no registered target structure
  // there, so a family claim on these rows would be refused by the leg as
  // `family-target-invalid` and the durable verifier would then answer DRIFT.
  // Registering the family in the ONE mount table is therefore NOT done by
  // this round either: a registration without a leg claim is the same DRIFT,
  // and adding rows to that shared table is the integrator's merge, not a
  // wiring lane's. What DOES ride here is the full adapter review payload —
  // the plane OBSERVES it per call (`a5m2-g1-row: review …`) so the approved
  // question, the family and its target manifest are on the record, and the
  // spec pins both halves (the observation present; no family field on the
  // durable manifest). No generic pseudo-governance row is invented: the
  // durable row is the ordinary PA row this plane already mints for every
  // governed call, carrying the adapter's effect set verbatim.
  const g1RowPresentFace = Object.freeze({
    card: 'generic',
    title: 'Governed G1 pure-query row',
    kind: 'other',
  })
  const g1Defs = g1Inject === null ? [] : g1Inject.rows.map(({ row, output }) => Object.freeze({
    name: row.name,
    // The CAPTURED native description + parameters bytes carried by the
    // adapter row itself (Gate 0f refused anything else) — same name, same
    // meaning, never a plane-invented wording or schema.
    description: row.description,
    parameters: row.parameters,
    execute: async (raw, exec) => {
      // Identity law (fix-1, SHARED ledger): the REAL registry token; absent
      // is a typed front refusal — zero classify, zero walk, zero row, zero
      // native entry.
      const execToken = exec?.token
      const tokenKey = (typeof execToken === 'object' && execToken !== null) || typeof execToken === 'symbol' ? execToken : undefined
      if (tokenKey === undefined) {
        throw new Error(`refused-g1 exec-token-unbound — '${row.name}' carries no registry token (object|symbol) on this execution; the row keys its single-flight and its correlation on the REAL exec.token and composes no identity from name or model-call fields`)
      }
      const priorFlight = governedTokenLedger.get(tokenKey)
      if (priorFlight !== undefined) {
        throw new Error(`refused-g1 exec-token-replay — this execution token already ${priorFlight.settled ? 'owns a settled' : 'owns an in-flight'} governed plane call (${row.name}): the G1 rows share the ONE token ledger with todo/write/image/read, so a registry token spans exactly one governed flight and a settled token is never re-armed`)
      }
      g1CorrSeq += 1
      const correlation = `plane-g1:${realmId}-${row.name}-${String(g1CorrSeq)}`
      governedTokenLedger.set(tokenKey, { correlation, settled: false })
      const signal = exec?.signal
      try {
        // OWNER-CURRENT BEFORE THE FREEZE (fix-4 law, the SAME authority leg
        // the todo/write/image rows and paAdmitPartA run): the adapter freezes
        // the CURRENT binding generations into its plan at classify, so the
        // owner republish leg must answer BEFORE that freeze. A faulting leg is
        // OBSERVED, never absorbed — the kernel's own identity leg still
        // answers this call.
        if (typeof paEnsureAuthorityCurrent === 'function' && typeof paGenerationReader === 'function') {
          const freshAuthority = await paReadGenerationFresh()
          if (freshAuthority.ok === true) {
            try {
              await paEnsureAuthorityCurrent(String(input.teamSessionId ?? ''), String(input.instanceId ?? ''), freshAuthority.value)
            } catch (error) {
              observe(`a5m2-g1-row: ensure-current(g=${String(freshAuthority.value)}) threw (${String(error?.message ?? error).slice(0, 160)}) — the call continues on the live tuple and the kernel identity leg answers it`)
            }
          }
        }
        let classified
        try {
          // The adapter's OWN classify over the CLOSED argument grammar + the
          // CURRENT facts it consults (the trusted topology read for
          // B-INSPECT, the bindingFacts() reader for the bound generations).
          // The callId law has TWO identities and the plane renames NEITHER:
          // the DURABLE identity of this flight is the ledger-allocated
          // correlation (the walk, the live-plan key and the Control row all
          // speak it, the todo row's law verbatim), while the adapter's plan
          // carries the host's OWN call identity when the execution has one —
          // that is the identity the module's swapped-execution guard re-
          // compares below the edge (delegate: exec.callId !== plan.callId is
          // P_G1_NOT_OWN_PLAN, zero native entry). An execution with no host
          // callId falls back to the correlation, so both halves stay ONE
          // identity exactly as in the assembly worlds.
          const planCallId = typeof exec?.callId === 'string' && exec.callId.length > 0 ? exec.callId : correlation
          classified = row.classify(raw, planCallId)
        } catch (error) {
          throw new Error(`refused-g1 row-unavailable — the committed adapter row could not classify this call (${String(error?.message ?? error).slice(0, 200)}); there is no native fallback to fall back to`)
        }
        if (classified.ok !== true || classified.plan === undefined) {
          throw new Error(`refused-g1 ${classified.code ?? 'P_G1_CLASSIFY_INVALID'} — ${classified.detail ?? 'the committed adapter refused this call before admission'}`)
        }
        // The adapter's own review payload — family, adapter revision,
        // provider identity and the FULL-VALUE target manifest — is put on the
        // record for this call (the review line below) AND, for the ENABLED
        // B-INSPECT pair (root 17:55 INSPECT ENABLEMENT over the strict
        // variant grammar 7529218e5; adapter revision 7), it rides the walk as
        // the family block: the four P-adds at FULL VALUE, the todo-row
        // carrier law verbatim, never a second approval. ONE classify call is
        // the single origin — block, fingerprint and plan all come from THIS
        // call's answer; the bridge compares the block against the CURRENT
        // registration keyed by the PLACED definition identity (a claim on an
        // unregistered identity, a moved provider or a moved revision refuses
        // BEFORE the durable row, and the execution edge re-checks the same
        // tuple — a retired revision drifts the consumption, it is never
        // silently translated). team_list_pending_control (B-CONTROL) is NOT
        // in the authorized enablement set: its walk stays the plain PA row,
        // zero movement, until the paired B-CONTROL enablement lands.
        observe(`a5m2-g1-row: review call=${correlation} row=${row.name} family=${String(classified.reviewPayload?.familyId ?? 'unsettled')} rev=${String(classified.reviewPayload?.adapterRevision ?? 'unsettled')} effects=${String((classified.effects ?? []).length)}`)
        const parsedEffects = parseRequestedEffectSet(classified.effects)
        if (parsedEffects.ok !== true) {
          throw new Error(`refused-g1 effects-unparsable — the adapter's effect set is not the frozen closed vocabulary (${JSON.stringify(parsedEffects.problems ?? null).slice(0, 200)})`)
        }
        const enabledFamilyBlock = row.familyId === 'B-INSPECT' && classified.reviewPayload !== undefined
          && typeof classified.reviewPayload.familyId === 'string'
          && typeof classified.reviewPayload.adapterRevision === 'number'
          && typeof classified.reviewPayload.providerIdentity === 'string'
          && classified.reviewPayload.targetManifest !== null && typeof classified.reviewPayload.targetManifest === 'object'
          ? Object.freeze({
              familyId: classified.reviewPayload.familyId,
              adapterRevision: classified.reviewPayload.adapterRevision,
              providerIdentity: classified.reviewPayload.providerIdentity,
              targetManifest: classified.reviewPayload.targetManifest,
            })
          : undefined
        const walk = {
          realmId,
          callId: correlation,
          parametersFingerprint: classified.parametersFingerprint,
          requestedEffects: parsedEffects.value,
          toolName: row.name,
          ...(enabledFamilyBlock === undefined ? {} : { family: enabledFamilyBlock }),
          ...(signal === undefined ? {} : { signal }),
        }
        const opened = await paAdmit.open(walk)
        if (opened.kind === 'deny') {
          throw new Error(`refused-g1 ${opened.code ?? 'ADMISSION_REFUSED'} — ${opened.detail ?? 'the admission refused this call'} (zero native entry)`)
        }
        if (opened.cancelled === true) {
          throw new Error(`${row.name} · cancelled — the call was cancelled at the PA edge before admission (zero native entry)`)
        }
        if (opened.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
          paAdmit.closePlan(walk.callId)
          throw new Error(`refused-g1 APPROVAL_NOT_LANDED — the admission answered ${String(opened.kind ?? 'unsettled')} without a landed grant; no adapter state substitutes for the kernel answer`)
        }
        const edge = await paAdmit.edge({
          ...walk,
          grant: opened.grant,
          paDurableMint: opened.paDurableMint,
          request: opened.request,
          placementName: opened.placementName,
          paConstructionBinding: opened.paConstructionBinding,
        })
        if (edge.kind === 'deny') {
          throw new Error(`refused-g1 ${edge.code ?? 'GRANT_STALE'} — ${edge.detail ?? 'the execution edge refused this call'} (zero native entry)`)
        }
        if (edge.cancelled === true) {
          throw new Error(`${row.name} · cancelled — the call was cancelled at the execution edge; nothing ran (zero native entry)`)
        }
        // `consumed: true` is produced ONLY from the REAL final edge's success
        // witness (todo/write/image law verbatim): the one-shot consume
        // witness rides as `consumedProof`; the row never self-attests.
        const proof = edge.consumedProof
        if (proof === undefined || proof === null || typeof proof.grant !== 'object' || proof.grant === null || typeof proof.grant.grantId !== 'string') {
          throw new Error(`refused-g1 CONSUME_PROOF_MISSING — the execution edge answered allow without its one-shot consume witness; the consumed credential is the ONLY thing this body executes under (the todo row's CONSUME_PROOF_MISSING law, verbatim)`)
        }
        let ran
        try {
          // THE BODY: the committed adapter's delegate, which re-ties the plan
          // to THIS call (its own plan table), re-verifies the CURRENT facts
          // for the second time (the edge law it spells), honours the pre-
          // abort refusal, and only then enters the CAPTURED native face.
          ran = await row.delegate(classified.plan, { exec })
        } catch (error) {
          throw new Error(`refused-g1 delegate-unavailable — the committed adapter could not run this consumed plan (${String(error?.message ?? error).slice(0, 200)})`)
        }
        if (ran === undefined || ran === null || ran.ok !== true) {
          throw new Error(`refused-g1 ${ran?.code ?? 'P_G1_DELEGATE_INVALID'} — ${ran?.detail ?? 'the committed adapter refused to enter the native face on this consumed plan'}`)
        }
        observe(`a5m2-g1-row: settled call=${correlation} row=${row.name} settled=${String(ran.settled ?? 'native')}`)
        return ran.value
      } finally {
        const now = governedTokenLedger.get(tokenKey)
        if (now !== undefined && now.correlation === correlation) {
          governedTokenLedger.set(tokenKey, { correlation, settled: true })
        }
      }
    },
    output,
    presentCall: (args) => ({ ...g1RowPresentFace, rawInput: args }),
  }))
  // The jobs rows ride the SAME placement/feed/dispose machinery as every
  // other row (their def#N identities mint through the seam's install pass
  // like the rest); zero-flip law: with the key off this is byte-identical
  // to `allDefs = baseDefs`. The todo row joins the same machinery under the
  // same zero-flip law (todoEnabled absent = no row = baseDefs returned as-is).
  const allDefs = jobsDefs.length === 0 && todoDefs.length === 0 && writeDefs.length === 0 && imageDefs.length === 0 && g1Defs.length === 0
    ? baseDefs
    : Object.freeze([...baseDefs, ...jobsDefs, ...todoDefs, ...writeDefs, ...imageDefs, ...g1Defs])

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
      ...(readExecutor === null ? {} : { paReadHandoff: Object.freeze({
        open: async (exec) => {
          if (exec === null || typeof exec !== 'object') return { kind: 'no-match' }
          if (exec.name !== readName) return { kind: 'no-match' }
          const token = exec.token
          if (!((typeof token === 'object' && token !== null) || typeof token === 'symbol')) {
            // The name IS this mount's governed read, so the effect-set question
            // belongs to PA: with no execution identity the call REFUSES, it
            // never falls back to the pre-hand-off lane.
            return { kind: 'refused', ownsHandoff: false, code: 'PA_HANDOFF_UNBOUND', detail: 'this governed read carries no execution token, so no PA hand-off can be opened or redeemed for it' }
          }
          return await readExecutor.paHandoffOpen(exec.arguments, {
            token,
            ...(exec.signal === undefined ? {} : { signal: exec.signal }),
          })
        },
        close: (exec) => {
          const correlation = readExecutor.paHandoffClose(exec === null || typeof exec !== 'object' ? undefined : exec.token)
          if (typeof correlation === 'string') livePaPlan.delete(correlation)
        },
      }) }),
      /** A5-M2: the governed-WRITE hand-off face for THIS mount — the SAME
       *  audited port shape as `paReadHandoff` (the adapter's hand-off arm
       *  runs over EVERY supplied port, read first then write, and each port
       *  answers ONLY for the one name its own mount placed; 'no-match' for
       *  everything else, so the old front-door path stays byte-identical for
       *  every other name and world). A mount that carries NO governed write
       *  row does not declare the field at all — it is omitted, NOT set to
       *  `undefined` — and a mount that DOES declare it keeps the fail-closed
       *  law: whatever it holds reaches the adapter and a broken one refuses
       *  the install (`pa-read-handoff-malformed`, R6 discipline). */
      ...(writeInject === null ? {} : { paWriteHandoff: Object.freeze({
        open: (exec) => writeHandoffOpen(exec),
        close: (exec) => {
          const correlation = writeHandoffClose(exec === null || typeof exec !== 'object' ? undefined : exec.token)
          if (typeof correlation === 'string') livePaPlan.delete(correlation)
        },
      }) }),
      /** A5-M2 (root 14:44): the governed-IMAGE hand-off face for THIS mount —
       *  the THIRD port, the SAME audited shape and the SAME presence law:
       *  no governed read_image row = the field is OMITTED (never
       *  `undefined`); a declared one rides fail-closed to the adapter; every
       *  other name and world keeps the pre-hand-off path byte-identically. */
      ...(imageInject === null ? {} : { paImageHandoff: Object.freeze({
        open: (exec) => imageHandoffOpen(exec),
        close: (exec) => {
          const correlation = imageHandoffClose(exec === null || typeof exec !== 'object' ? undefined : exec.token)
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
        search: hostedSearch, glob: hostedGlob, shell: hostedShell,
        ...(readExecutor === null ? {} : { read: readExecutor }),
        ...(todoInject === null ? {} : { todo: todoInject.arm }),
        // A5-M2 G1 PURE-QUERY: the placed COMMITTED adapter rows (diagnostics
        // only — the placement authority is the mount, never this face).
        ...(g1Inject === null ? {} : { g1: Object.freeze(g1Inject.rows.map((entry) => entry.row)) }),
      }),
      /**
       * A5-M2 G1 (root ruling 15:28): the four-tier truth of the closed G1
       * dispatch index AS THIS MOUNT STANDS, read against the frozen index the
       * committed adapter module owns (this face copies no table of its own).
       * Every one of the 14 records answers exactly one state:
       *  · `placed` — this mount placed the row (the pure-query trio only).
       *    The four-tier label of a placed row is 接线未测 until the Host
       *    acceptance runs; assembly-level legs never mint 已测试.
       *  · `unplaced` — a pure-query record this mount did not place
       *    (未接线 for this mount: the gate is off or the row was not injected).
       *  · `declared` — the record exists in the committed adapter module and
       *    is NOT wired here (the other eleven), with the unobservable fact
       *    named; Gate 0f refuses any mount that would place one.
       * The states are read back from the definitions this assembly built and
       * nothing else — no second authority, no cached fact.
       */
      g1PlacementTruth: () => Object.freeze(Object.keys(A5_G1_RECORD_SPECS).map((recordName) => {
        const spec = A5_G1_RECORD_SPECS[recordName]
        if (allDefs.some((d) => d.name === recordName)) {
          return Object.freeze({ recordName, familyId: spec.family, recordIndex: spec.recordIndex, adapterRevision: A5_G1_ADAPTER_REVISION, state: 'placed' })
        }
        if (A5_G1_PURE_QUERY_MOUNT_NAMES.includes(recordName)) {
          return Object.freeze({
            recordName,
            familyId: spec.family,
            recordIndex: spec.recordIndex,
            state: 'unplaced',
            why: 'pure-query record this mount did not place (planeCfg.g1Enabled off, or this adapter row was not injected) — 未接线 for this mount',
          })
        }
        return Object.freeze({
          recordName,
          familyId: spec.family,
          recordIndex: spec.recordIndex,
          state: 'declared',
          why: spec.capture === 'surface'
            ? 'a SURFACE capture, not a model-invoked tool row: the facts it governs ride the effect-commit boundary, and the committed module spells it UNWIRED by ruling — this mount wires nothing'
            : 'the facts this row must consult at its edge are not observable at the wiring point (the host escalation chain, the durable append witness, the exported controlled-install path, the live Client session, the prompt or plan-mode write faces); the row stays exactly as g1-surface-adapters.mjs spells it and Gate 0f refuses any mount that would place it',
        })
      })),
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
            // A5-M2: no hand-off survives its mount — claimed or not, the
            // flight, the unspent grant and the plan fact die with the
            // placement (teardown law, independent of the terminal observer).
            readExecutor?.paHandoffCloseAll?.()
            // A5-M2 WRITE hand-off: the SAME teardown law — no write flight
            // survives its mount, placeholder or unspent claim. The plan facts
            // die through their own correlations, the shared ledger marks the
            // tokens terminal (a later body redemption then refuses — Part A is
            // never re-run and there is no native fallback), and the late
            // hand-off legs' after-await re-check drops any answer that lands
            // after this point.
            if (writeInject !== null) writeHandoffCloseAll()
            // A5-M2 IMAGE hand-off (root 14:44): the SAME teardown law, the
            // SAME ordering — before the arm's drain, so a late leg's
            // after-await re-check drops any answer that lands after this.
            if (imageInject !== null) imageHandoffCloseAll()
            // A5-M2 B-SESSION: DRAINING is the arm's teardown half — after it,
            // no NEW call reaches any body (an entered body is not rewound,
            // and there is no native to fall back to; the row mask is disposed
            // with the mount regardless).
            if (todoInject !== null) todoInject.arm.drain()
            // A5-M2 B-WRITE: the write arm drains with the SAME teardown law
            // (root review @1a399): the drain lands BEFORE any ledger/plan
            // state is cleared, so a call that has not entered its closure
            // yet is refused DRAINING (zero write; an entered body is not
            // rewound and no native fallback exists), and a call whose token
            // already settled can never be re-armed by the later clear.
            if (writeInject !== null) writeInject.arm.drain()
            // A5-M2 B-IMAGE: same teardown law — drain BEFORE any state
            // clears; an entered body is not rewound, no native fallback.
            // The arm is the placement-moment construction (central-card ②),
            // so the drain reaches the SAME arm the rows drove.
            if (imageArm !== null) imageArm.drain()
            livePaPlan.clear()
            // The token ledger's ONE release point (root ruling @ 9c817):
            // used exec.token identities live for the WHOLE life of the
            // mount — dispose is the only legal end of that obligation.
            governedTokenLedger.clear()
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
