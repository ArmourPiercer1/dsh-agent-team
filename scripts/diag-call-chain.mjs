#!/usr/bin/env node
/**
 * diag-call-chain.mjs — EB4-B safe call-chain diagnosis (U7-3).
 *
 * Given ONE governed tool refusal (the `a5p5-refused kind=… code=… detail=…` line a governed row
 * returns, a center shadow-ledger `shadow-verdict` JSONL row, or a bare refusal code), report the
 * decision chain this repository's SOURCE can attribute to it:
 *
 *   stage  — which pipeline step produced the refusal kind (packages/tools/a5p5-tools/src)
 *   face   — which admission / coverage / assurance / control / provider face emits that code
 *   code   — the refusal code, verbatim
 *   effect fingerprint — the canonical RequestedEffectSet digest when the refusal kind carries it
 *
 * WHAT IT IS NOT (printed on every run as LIMIT lines, so a clean answer cannot be quoted as more):
 *   - a STATIC attribution over source vocabulary. It never boots a Host, never reads a live
 *     ledger it was not handed, never contacts a port, and never re-runs the call;
 *   - not an authority. It writes nothing, mints nothing, and its output is not a Grant, a
 *     ControlDecision or an approval of any kind (EB4-B: "日志不承载 Grant/新的权限授权");
 *   - not a proof of `body = 0`. Whether the Body ran is a C1/C2 question for the suite that owns
 *     the face, never inferable from the wording of a refusal;
 *   - the full EB4-B chain `invocationCorrelation → Binding → PA/Control → Provider → settlement`
 *     is NOT reconstructable from a refusal line at this tree: the line carries no correlation id,
 *     binding revision or Control request id. Those links are reported `NOT_OBSERVABLE_FROM_INPUT`
 *     rather than guessed. Carrying them would be a product change and is out of this lane.
 *
 * FAIL-CLOSED RULES (each pinned by tests/diag-call-chain/diag-call-chain.test.mjs):
 *   1. a code that is not in FACE_TABLE is `UNKNOWN_CODE`, exit 1 — never a nearest match;
 *   2. a code emitted by more than one face for the given kind is `AMBIGUOUS` with every candidate
 *      named — never the first one (the U7-6 forensics showed the same code arriving from the
 *      coverage gate where the assurance face had been assumed);
 *   3. no parseable refusal in the input, an oversize input, or a non-regular file is `REFUSED`,
 *      exit 2 — an empty answer is never "nothing wrong";
 *   4. every free-text field (detail, scopeKey, callId, tool name) passes through the ONE
 *      redaction vocabulary (`scripts/redaction-patterns.mjs`, shared with sanitize-evidence) and
 *      is cut to DETAIL_CAP characters; the effect fingerprint is printed only when it has the exact
 *      `sha256:<64 lowercase hex>` shape (a digest, not a secret);
 *   5. the rendered output is re-scanned with the same vocabulary before it is printed; any
 *      surviving credential-shaped substring refuses the WHOLE output (exit 2, nothing printed but
 *      the refusal) — a redactor that missed something must not get a second chance on stdout.
 *
 * BOUNDS (declared, enforced — see `BOUNDS`): input ≤ 1 MiB; ≤ 12 refusals reported (the rest
 * counted, flagged `truncated`); each free-text field ≤ 160 chars; total stdout ≤ 24 KiB (refused
 * beyond). Time: one read + string work, measured ≈ 80 ms per invocation on this host. Pure
 * in-process: no child process, no network, no file writes.
 *
 * Usage:
 *   node scripts/diag-call-chain.mjs --text '<refusal line or JSONL row>' [--json]
 *   node scripts/diag-call-chain.mjs --file <transcript-or-jsonl> [--json]
 *   node scripts/diag-call-chain.mjs --code <REFUSAL_CODE> [--kind <kind>] [--json]
 *   node scripts/diag-call-chain.mjs --self-test     # FACE_TABLE citations still hold at this tree
 * Exit: 0 every refusal attributed (single face or named AMBIGUOUS) · 1 at least one UNKNOWN_CODE /
 *       UNKNOWN_KIND / NO_PRODUCTION_EMITTER, or a stale self-test citation · 2 REFUSED (usage, no refusal, oversize, unsafe output).
 */
import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PATTERNS, redactAll } from './redaction-patterns.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Declared + enforced bounds, and they must be MUTUALLY consistent: the worst case of
 * `maxRefusals` blocks (3 candidate faces each) has to fit inside `outputBytes`, or the tool
 * would refuse the largest input it advertises it can report. Measured worst case
 * at these values is 15486 B (text) and 10599 B (--json), measured with 35 three-face
 * admission refusals; such an input reports 12 and counts the rest (`truncated`).
 */
export const BOUNDS = Object.freeze({ inputBytes: 1024 * 1024, maxRefusals: 12, detailCap: 160, outputBytes: 24 * 1024 })

const PIPE = 'packages/tools/a5p5-tools/src/pipeline.ts'
const REG = 'packages/tools/a5p5-tools/src/register.ts'
const PLANE = 'packages/runtime/src/plugin/live/team-tool-plane.mjs'
/**
 * FamilyAssembly descriptors (u7-w0b, PR #400). A family's registration refusal code is the
 * `refusalCode:` literal in ITS descriptor; the plane returns `entry.descriptor.refusalCode` and
 * names no family. Those codes are therefore RESOLVED, not listed: the reviewed manifest's
 * `families[]` is scanned (only a listed module mounts, so only a listed module is an emitter;
 * a descriptor on disk that the manifest does not list attributes nothing). A hardcoded path here
 * is what drifted when #399/#400 moved the three plane-registration literals out of the plane.
 */
const FAMILY_DIR = 'packages/tools/families'
const FAMILY_MANIFEST = `${FAMILY_DIR}/manifest.json`
const FAMILY_TOKEN = 'refusalCode:'
const FAMILY_CODE_RE = /refusalCode:\s*'(PLANE_[A-Z_]+_REFUSED)'/g

/** Refusal kind → the pipeline stage that produces it (source-cited, line numbers at this tree). */
export const KIND_STAGES = Object.freeze({
  'refused-schema': { stage: 'argument schema parse (before any effect is derived)', cites: [[`${REG}:200`, "refusalText('refused-schema'"], [`${PIPE}:107`, "kind: 'refused-schema'"]], carriesFingerprint: false, faces: ['schema'] },
  'refused-replay': { stage: 'host execution-token replay fence (before the pipeline runs)', cites: [[`${REG}:216`, "refusalText('refused-replay'"]], carriesFingerprint: false, faces: ['replay'] },
  'refused-admission': { stage: 'admission: lane decide verdict OR the PA (admission kernel / Control) edge — the line alone cannot say which', cites: [[`${PIPE}:112`, "kind: 'refused-admission'"], [`${PIPE}:159`, "kind: 'refused-admission'"], [`${REG}:280`, "result.kind === 'refused-admission'"]], carriesFingerprint: true, faces: ['lane-decide', 'pa-control-edge', 'pa-default-deny-coverage', 'admission-kernel', 'assurance', 'closed-world-guard'] },
  'refused-spill': { stage: 'spill lease open / settle (after admission)', cites: [[`${PIPE}:168`, "kind: 'refused-spill'"], [`${PIPE}:184`, "kind: 'refused-spill'"], [`${REG}:281`, "result.kind === 'refused-spill'"]], carriesFingerprint: false, faces: ['spill'] },
  'backend-failed': { stage: 'effect backend / provider run, or renderer closed-set violation', cites: [[`${PIPE}:188`, "kind: 'backend-failed'"], [`${PIPE}:203`, "kind: 'backend-failed'"], [`${REG}:282`, 'result.failure.code']], carriesFingerprint: false, faces: ['shut-backend', 'provider', 'renderer'] },
})

/** Face id → what it is and where it lives. */
export const FACES = Object.freeze({
  schema: 'a5p5 argument schema (refused before effect derivation)',
  replay: 'per-execution token ledger (register.ts row execution state)',
  'lane-decide': 'template lane decide (Blueprint deny lane / default-deny) — team-tool-plane createLaneDecide',
  'pa-control-edge': 'PA ↔ durable Control edge in the plane (approval plan, Control leg, grant staleness)',
  'admission-kernel': 'runtime/tool-admission admission kernel (finite clock, identity/realm/binding, expansion, grant mint/consume)',
  assurance: 'runtime/tool-admission assurance runtime (H2: level vs derived demand, record vs probe)',
  'closed-world-guard': 'runtime/tool-dispatch closed-world Guard + scoped dispatcher',
  coverage: 'operation-permission coverage gate (bind/mount time, not per call)',
  'pa-default-deny-coverage': 'PA production admission default-deny COVERAGE gate (admitCall: template default=deny and no rule covers an effect arm) — refuses BEFORE the kernel and before any assurance check',
  canonicalization: 'operation-permission canonical operation (argument canonicalization)',
  'center-kernel': 'governance-center GovernanceKernel (enforcing for kernel-owned names; SHADOW rows are audit-only)',
  'plane-mount': 'team-tool-plane mount/config, incl. a FamilyAssembly descriptor refusing registration (assembly time — no call reached a Body)',
  spill: 'a5p5 spill store',
  'shut-backend': 'plane typed shut effect face (the production adapter is absent; never a capability)',
  provider: 'sandbox provider / confined process / dispatcher termination',
  renderer: 'a5p5 renderer closed-set guard',
})

const AK = 'packages/runtime/tool-admission/admission-kernel.ts'
const AR = 'packages/runtime/tool-admission/assurance-runtime.ts'
const CWG = 'packages/runtime/tool-dispatch/closed-world-guard.ts'
const SD = 'packages/runtime/tool-dispatch/scoped-dispatcher.ts'
const INST = 'packages/runtime/tool-dispatch/install.ts'
const GK = 'packages/runtime/governance-center/kernel.ts'
const OPE = 'packages/runtime/operation-permission/errors.ts'
const PROV = 'packages/runtime/sandbox-provider/provider.ts'
const GRANT = 'packages/domain/tool-governance/src/grant.ts'

/**
 * Code → [face, emitter file, optional site token] rows. Every emitter file must contain the code
 * as a string literal (and the site token, when given) —
 * `--self-test` re-checks that at the current tree, so a moved or renamed code turns the self-test
 * red instead of silently attributing to a file that no longer emits it. Vocabulary-only files
 * (errors.ts enumerations, the sandbox contract stub mirror) are deliberately NOT emitters.
 */
const STATIC_FACE_TABLE = Object.freeze({
  // §5 frozen vocabulary (domain/tool-governance/src/errors.ts)
  TOOL_BINDING_UNVERIFIED: [['admission-kernel', AK], ['assurance', AR], ['closed-world-guard', CWG], ['closed-world-guard', SD], ['closed-world-guard', INST], ['admission-kernel', GRANT], ['pa-control-edge', PLANE]],
  APPROVAL_STALE: [['admission-kernel', AK], ['admission-kernel', 'packages/runtime/tool-admission/approval-case.ts'], ['admission-kernel', 'packages/runtime/tool-admission/clock.ts'], ['admission-kernel', GRANT]],
  IO_POLICY_UNSUPPORTED: [['pa-default-deny-coverage', AK, "refusal: 'template-default-deny'"], ['assurance', AR], ['admission-kernel', AK], ['closed-world-guard', INST], ['shut-backend', PLANE], ['provider', PROV]],
  TEAM_TOOL_UNGOVERNED: [['closed-world-guard', CWG], ['closed-world-guard', SD]],
  SANDBOX_UNAVAILABLE: [['provider', PROV]],
  ADAPTER_DRAINING: [['admission-kernel', AK], ['closed-world-guard', CWG], ['closed-world-guard', SD]],
  EXECUTION_TERMINATION_UNCONFIRMED: [['admission-kernel', AK], ['provider', SD], ['provider', INST], ['provider', 'packages/runtime/sandbox-provider/phases.ts']],
  DOMAIN_DENIED: [], // vocabulary-only at this tree: no production emitter (errors.ts + contract-stub mirror only)
  // operation-permission
  OPERATION_CANONICALIZATION_FAILED: [['canonicalization', OPE]],
  'alpha2-permission-coverage-unmanaged-tools': [['coverage', OPE]],
  // lane decide
  'template-deny-lane': [['lane-decide', PLANE]],
  'template-default-deny': [['lane-decide', PLANE]],
  // PA ↔ Control edge
  APPROVAL_PLAN_REFUSED: [['pa-control-edge', PLANE]],
  APPROVAL_REQUEST_UNAVAILABLE: [['pa-control-edge', PLANE]],
  APPROVAL_DENIED: [['pa-control-edge', PLANE]],
  APPROVAL_NOT_RESOLVED: [['pa-control-edge', PLANE]],
  APPROVAL_LEG_INCOMPLETE: [['pa-control-edge', PLANE]],
  GRANT_STALE: [['pa-control-edge', PLANE]],
  PA_HANDOFF_UNBOUND: [['pa-control-edge', PLANE], ['pa-control-edge', 'packages/tools/fs-family/src/read-executor.mjs']],
  // governance-center kernel (FIX-K fail-closed list)
  KERNEL_NOT_ACTIVE: [['center-kernel', GK]],
  SCOPE_UNVERIFIED: [['center-kernel', GK]],
  NOT_VERIFIED_SOURCE: [['center-kernel', GK]],
  CANDIDATE_REVOKED: [['center-kernel', GK]],
  STALE_GENERATION: [['center-kernel', GK]],
  NO_CANDIDATE: [['center-kernel', GK]],
  IDENTITY_UNVERIFIED: [['center-kernel', GK]],
  IDENTITY_MISMATCH: [['center-kernel', GK]],
  DUP_APPROVAL_ENTRY: [['center-kernel', GK]],
  NO_APPROVAL_ENTRY: [['center-kernel', GK]],
  GRANT_REPLAY: [['center-kernel', GK]],
  GRANT_IN_FLIGHT: [['center-kernel', GK]],
  NO_CONSUME_PORT: [['center-kernel', GK]],
  LIFECYCLE_PORT_MISSING: [['center-kernel', GK]],
  // plane mount / config (assembly time)
  NOT_GOVERNED: [['plane-mount', PLANE]],
  PLANE_CONFIG_INCOMPLETE: [['plane-mount', PLANE]],
  PLANE_NAMES_INVALID: [['plane-mount', PLANE]],
  PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED: [['plane-mount', PLANE]],
  PLANE_KERNEL_UNAVAILABLE: [['plane-mount', PLANE]],
  PLANE_PLACEMENT_CONFLICT: [['plane-mount', PLANE]],
  PLANE_JOBS_REGISTRATION_REFUSED: [['plane-mount', PLANE]],
  // family registration refusals (PLANE_READ_/PROCESS_/SEARCH_REGISTRATION_REFUSED at this tree)
  // are NOT listed: they are resolved from the family descriptors — see familyRefusalRows below.
  CONFINE_CONFIG_INCOMPLETE: [['plane-mount', PLANE]],
  TRUST_ROOT_SHA_MISMATCH: [['plane-mount', PLANE]],
  CFS_PROVIDER_REFUSED: [['provider', PLANE]],
  // replay / renderer (a5p5)
  'exec-token-replay': [['replay', REG]],
  'outcome-outside-closed-set': [['renderer', PIPE]],
})

/**
 * Scan the reviewed family manifest at `root` for registration refusal codes.
 * Returns { rows: { CODE: [[face, file, token]] }, problems: [string] }; never throws. An
 * unreadable manifest, an unlisted-but-absent module, or a listed descriptor without a
 * `refusalCode:` literal is a PROBLEM (the self-test reds) and contributes no row (attribution
 * then says UNKNOWN_CODE — fail closed, never a guess).
 */
export function familyRefusalRows(root = REPO_ROOT) {
  const rows = {}
  const problems = []
  let manifest
  try { manifest = JSON.parse(readFileSync(join(root, FAMILY_MANIFEST), 'utf8')) } catch (e) {
    problems.push(`family manifest ${FAMILY_MANIFEST} unreadable (${String(e?.code ?? e?.message ?? e)}) — no family refusal code is attributable`)
    return { rows, problems }
  }
  const listed = Array.isArray(manifest?.families) ? manifest.families : []
  if (listed.length === 0) problems.push(`family manifest ${FAMILY_MANIFEST} lists no families`)
  for (const entry of listed) {
    const mod = typeof entry?.module === 'string' ? entry.module : null
    if (mod === null || !/^[a-z0-9-]+\.mjs$/.test(mod)) { problems.push(`family manifest entry ${JSON.stringify(entry)} has no plain module name`); continue }
    const rel = `${FAMILY_DIR}/${mod}`
    let text
    try { text = readFileSync(join(root, rel), 'utf8') } catch { problems.push(`missing file ${rel} (listed in ${FAMILY_MANIFEST})`); continue }
    const codes = [...new Set([...text.matchAll(FAMILY_CODE_RE)].map((m) => m[1]))]
    if (codes.length === 0) problems.push(`${rel}: family descriptor carries no \`${FAMILY_TOKEN} 'PLANE_*_REFUSED'\` literal — its registration refusal is unattributable`)
    for (const code of codes) (rows[code] ??= []).push(['plane-mount', rel, FAMILY_TOKEN])
  }
  return { rows, problems }
}

/** Static rows + family rows resolved at `root`. A code in both keeps both (rows appended). */
function buildFaceTable(root) {
  const table = Object.fromEntries(Object.entries(STATIC_FACE_TABLE).map(([k, v]) => [k, [...v]]))
  for (const [code, rows] of Object.entries(familyRefusalRows(root).rows)) (table[code] ??= []).push(...rows)
  return Object.freeze(Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Object.freeze(v)])))
}

/** Code → [face, emitter, token] — the static table plus the family codes resolved at this tree. */
export const FACE_TABLE = buildFaceTable(REPO_ROOT)

/** The center shadow row's verdict record (audit-only), cited + self-tested like the stages. */
const SHADOW_CITE = ['packages/runtime/src/plugin/live/center-shadow-row.mjs:203', "leg: 'shadow-verdict'"]

/** Spill refusal codes are a closed set in their own lane; matched by prefix and verified by self-test. */
const SPILL_SRC = 'packages/tools/a5p5-tools/src/spill.ts'
/** Read the CLOSED spill set from source (never a prefix guess: an invented `spill-x` is UNKNOWN). */
let spillCodes = null
function spillCodeSet(root = REPO_ROOT) {
  if (spillCodes !== null) return spillCodes
  spillCodes = new Set()
  try {
    const t = readFileSync(join(root, SPILL_SRC), 'utf8')
    const start = t.indexOf('SPILL_REFUSAL_CODES = [')
    const block = start < 0 ? '' : t.slice(start, t.indexOf('] as const', start))
    for (const m of block.matchAll(/'(spill-[a-z-]+)'/g)) spillCodes.add(m[1])
  } catch { /* unreadable source = empty set = every spill code UNKNOWN (fail closed) */ }
  return spillCodes
}
const isSpillCode = (code) => spillCodeSet().has(code)

export const LIMITS = Object.freeze([
  'STATIC attribution over source vocabulary at this tree: no Host boot, no live ledger read beyond the given input, no re-run',
  'not an authority: output is never a Grant, ControlDecision or approval; nothing is written',
  'not a proof of body=0 — whether the Body ran is a C1/C2 question for the owning suite',
  'invocationCorrelation / Binding revision / Control request id are NOT carried by the refusal line at this tree: reported NOT_OBSERVABLE_FROM_INPUT, never guessed',
  'a face listed as AMBIGUOUS is ambiguous in the SOURCE: resolving it needs the owning C1/C2 receipt, not this tool',
])

const REFUSAL_RE = /a5p5-refused kind=([a-z-]+) code=([A-Za-z0-9_.-]+) detail=([^\r\n"\\]*)/g
const FINGERPRINT_RE = /^sha256:[0-9a-f]{64}$/

/** Redact, then cut. The cut is after redaction so a secret can never be split past the window. */
export function safeField(value) {
  if (value === undefined || value === null) return null
  const { text } = redactAll(String(value))
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > BOUNDS.detailCap ? `${flat.slice(0, BOUNDS.detailCap)}…(+${String(flat.length - BOUNDS.detailCap)} chars cut)` : flat
}

/** Face attribution for one (kind, code). Pure: drivable without a tree. */
export function attribute(kind, code) {
  const stage = kind === null ? null : KIND_STAGES[kind] ?? null
  if (kind !== null && stage === null) return { verdict: 'UNKNOWN_KIND', candidates: [] }
  let rows
  if (Object.hasOwn(FACE_TABLE, code)) rows = FACE_TABLE[code]
  else if (isSpillCode(code)) rows = [['spill', SPILL_SRC]]
  else return { verdict: 'UNKNOWN_CODE', candidates: [] }
  if (rows.length === 0) return { verdict: 'NO_PRODUCTION_EMITTER', candidates: [] }
  // Narrow to the faces the refusal KIND can arrive through; never widen.
  const allowed = stage === null ? null : new Set(stage.faces)
  const narrowed = allowed === null ? rows : rows.filter(([face]) => allowed.has(face))
  const pool = narrowed.length > 0 ? narrowed : rows
  const faces = [...new Set(pool.map(([face]) => face))]
  const candidates = faces.map((face) => ({ face, what: FACES[face], emitters: [...new Set(pool.filter(([f]) => f === face).map(([, file, token]) => (token === undefined ? file : `${file} (${token})`)))] }))
  return {
    verdict: faces.length === 1 ? 'ATTRIBUTED' : 'AMBIGUOUS',
    kindFaceMismatch: narrowed.length === 0 && allowed !== null,
    candidates,
  }
}

/** Extract refusals from text: a5p5 refusal lines, shadow-verdict JSONL rows. */
export function extractRefusals(text) {
  const found = []
  let total = 0
  for (const m of text.matchAll(REFUSAL_RE)) {
    total += 1
    if (found.length < BOUNDS.maxRefusals) found.push({ source: 'a5p5-refusal-line', kind: m[1], code: m[2], detail: m[3].trim() })
  }
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('shadow-verdict')) continue
    let row
    try { row = JSON.parse(line) } catch { continue }
    // kernel outcomes: allow | defer | refuse (governance-center/kernel.ts). Only `refuse` is a refusal.
    if (row?.leg !== 'shadow-verdict' || typeof row.code !== 'string' || row.outcome !== 'refuse') continue
    total += 1
    if (found.length < BOUNDS.maxRefusals) {
      found.push({ source: 'center-shadow-ledger-row', kind: null, code: row.code, detail: null, shadow: { name: row.name, scopeKey: row.scopeKey, callId: row.callId, outcome: row.outcome, generation: row.generation } })
    }
  }
  return { found, total, truncated: total > found.length }
}

function describe(ref) {
  const att = attribute(ref.kind, ref.code)
  const stage = ref.kind === null ? null : KIND_STAGES[ref.kind] ?? null
  let fingerprint = { state: 'not carried by this refusal kind' }
  if (stage?.carriesFingerprint) {
    fingerprint = ref.detail !== null && FINGERPRINT_RE.test(ref.detail)
      ? { state: 'present', value: ref.detail }
      : { state: 'ABSENT_OR_MALFORMED (refused-admission should carry sha256:<64 hex>; not printed)' }
  }
  const out = {
    source: ref.source,
    kind: ref.kind,
    stage: stage ? stage.stage : ref.source === 'center-shadow-ledger-row' ? 'governance-center SHADOW verdict (audit-only: the shadow row ALWAYS takes next(); this refused nothing)' : null,
    stageCites: stage ? stage.cites.map(([c]) => c) : ref.source === 'center-shadow-ledger-row' ? [SHADOW_CITE[0]] : [],
    code: safeField(ref.code),
    verdict: att.verdict,
    candidates: att.candidates,
    ...(att.kindFaceMismatch ? { note: 'no emitter of this code sits on a face this kind arrives through; all emitters listed' } : {}),
    effectFingerprint: fingerprint,
    detail: stage?.carriesFingerprint ? undefined : safeField(ref.detail),
    chain: {
      invocationCorrelation: 'NOT_OBSERVABLE_FROM_INPUT',
      binding: 'NOT_OBSERVABLE_FROM_INPUT',
      paControl: att.candidates.some((c) => c.face === 'pa-control-edge') ? 'candidate face (see candidates)' : 'NOT_OBSERVABLE_FROM_INPUT',
      provider: att.candidates.some((c) => c.face === 'provider' || c.face === 'shut-backend') ? 'candidate face (see candidates)' : 'NOT_OBSERVABLE_FROM_INPUT',
      settlement: 'NOT_OBSERVABLE_FROM_INPUT',
    },
  }
  if (ref.shadow) out.shadow = Object.fromEntries(Object.entries(ref.shadow).map(([k, v]) => [k, typeof v === 'number' ? v : safeField(v)]))
  return out
}

/** Backstop (rule 5): does rendered output still hold a credential-shaped substring? */
export function residualHits(rendered) {
  const hits = []
  for (const [name, re, , pathOnly] of PATTERNS) {
    if (pathOnly) continue
    for (const m of rendered.matchAll(re)) {
      const v = m[0]
      if (/<REDACTED|<ABSOLUTE_PATH>/.test(v)) continue
      hits.push(name)
    }
  }
  return [...new Set(hits)]
}

function render(report, json) {
  if (json) {
    // Dictionaries once per report; each refusal carries ids + emitters only (keeps the
    // worst case of maxRefusals inside outputBytes — measured, see BOUNDS).
    const faces = {}
    const stages = {}
    const refusals = report.refusals.map((r) => {
      for (const c of r.candidates) faces[c.face] = c.what
      if (r.kind !== null && r.stage) stages[r.kind] = { stage: r.stage, cites: r.stageCites }
      const { stage: _s, stageCites: _c, ...rest } = r
      return { ...rest, candidates: r.candidates.map(({ face, emitters }) => ({ face, emitters })), ...(r.kind === null && r.stage ? { stage: r.stage, stageCites: r.stageCites } : {}) }
    })
    return `${JSON.stringify({ ...report, faces, stages, refusals })}\n`
  }
  const lines = [`diag-call-chain: refusals=${String(report.reported)} seen=${String(report.seen)} truncated=${String(report.truncated)} verdict=${report.verdict}`]
  report.refusals.forEach((r, i) => {
    lines.push(`[${String(i + 1)}] source=${r.source} kind=${String(r.kind)} code=${String(r.code)} attribution=${r.verdict}`)
    if (r.stage) lines.push(`    stage: ${r.stage}${r.stageCites.length ? ` (${r.stageCites.join(', ')})` : ''}`)
    for (const c of r.candidates) lines.push(`    face: ${c.face} [${c.emitters.join(', ')}]`)
    if (r.candidates.length > 0) lines.push(`    faces: ${r.candidates.map((c) => `${c.face} = ${c.what}`).join(' | ')}`)
    if (r.note) lines.push(`    note: ${r.note}`)
    lines.push(`    effectFingerprint: ${r.effectFingerprint.state}${r.effectFingerprint.value ? ` ${r.effectFingerprint.value}` : ''}`)
    if (r.detail) lines.push(`    detail (redacted, ≤${String(BOUNDS.detailCap)}): ${r.detail}`)
    if (r.shadow) lines.push(`    shadow: ${JSON.stringify(r.shadow)}`)
    lines.push(`    chain: ${Object.entries(r.chain).map(([k, v]) => `${k}=${v}`).join(' | ')}`)
  })
  for (const l of LIMITS) lines.push(`LIMIT ${l}`)
  return `${lines.join('\n')}\n`
}

/** The whole run as a pure function of (input text, options): returns {exit, stdout}. */
export function diagnose(text, { json = false, kind = null } = {}, codeOnly = null) {
  let refs
  if (codeOnly !== null) refs = { found: [{ source: 'code-argument', kind, code: codeOnly, detail: null }], total: 1, truncated: false }
  else refs = extractRefusals(text)
  if (refs.found.length === 0) return { exit: 2, stdout: 'REFUSED NO_REFUSAL_FOUND: input holds no `a5p5-refused kind=… code=…` line and no shadow-verdict refusal row — an empty answer is not "nothing wrong"\n' }
  const refusals = refs.found.map(describe)
  const unknown = refusals.filter((r) => r.verdict === 'UNKNOWN_CODE' || r.verdict === 'UNKNOWN_KIND' || r.verdict === 'NO_PRODUCTION_EMITTER')
  const report = {
    tool: 'scripts/diag-call-chain.mjs',
    verdict: unknown.length > 0 ? 'UNATTRIBUTABLE_PRESENT' : 'ATTRIBUTED_OR_NAMED_AMBIGUOUS',
    seen: refs.total,
    reported: refusals.length,
    truncated: refs.truncated,
    bounds: BOUNDS,
    refusals,
    limits: LIMITS,
  }
  const out = render(report, json)
  const residual = residualHits(out)
  if (residual.length > 0) return { exit: 2, stdout: `REFUSED UNSAFE_OUTPUT: rendered output still matched ${residual.join(',')} after redaction — nothing printed\n` }
  if (Buffer.byteLength(out) > BOUNDS.outputBytes) return { exit: 2, stdout: `REFUSED OUTPUT_OVER_BOUND: ${String(Buffer.byteLength(out))} bytes > ${String(BOUNDS.outputBytes)} — narrow the input\n` }
  return { exit: unknown.length > 0 ? 1 : 0, stdout: out }
}

/** --self-test: every FACE_TABLE / KIND_STAGES citation still holds at this tree. */
export function selfTest(root = REPO_ROOT, moved = []) {
  const problems = []
  const read = (rel) => {
    const abs = join(root, rel)
    if (!existsSync(abs)) { problems.push(`missing file ${rel}`); return null }
    return readFileSync(abs, 'utf8')
  }
  // FACE_TABLE was resolved at REPO_ROOT; re-resolve the family rows at `root`, and grade BOTH
  // tables' citations at `root`: a code the shipped table attributes to a descriptor that no
  // longer carries it is a red that NAMES the code (the table is the claim, the tree the fact).
  const fam = familyRefusalRows(root)
  problems.push(...fam.problems)
  const graded = { ...FACE_TABLE }
  for (const [code, rows] of Object.entries(buildFaceTable(root))) if (!Object.hasOwn(graded, code)) graded[code] = rows
  for (const [code, rows] of Object.entries(graded)) {
    for (const [face, file, token] of rows) {
      if (!Object.hasOwn(FACES, face)) problems.push(`${code}: unknown face ${face}`)
      const t = read(file)
      if (t !== null && !t.includes(`'${code}'`) && !t.includes(`"${code}"`)) problems.push(`${code}: ${file} no longer contains the literal`)
      if (t !== null && token !== undefined && !t.includes(token)) problems.push(`${code}/${face}: ${file} no longer carries ${JSON.stringify(token)}`)
    }
  }
  // Each stage site is located by its TOKEN, not trusted by its line number: the line is a reading
  // hint that drifts with every unrelated edit (measured: a rebase moved all 12 by 6–11 lines).
  // A token that vanished is a real finding; a token that moved is only reported as `moved`.
  for (const [kind, st] of Object.entries(KIND_STAGES)) {
    for (const [cite, token] of st.cites) {
      const [file, line] = cite.split(':')
      const t = read(file)
      if (t === null) continue
      const lines = t.split('\n')
      if ((lines[Number(line) - 1] ?? '').includes(token)) continue
      const at = lines.findIndex((l) => l.includes(token))
      if (at < 0) problems.push(`${kind}: ${file} no longer carries ${JSON.stringify(token)} anywhere`)
      else moved.push(`${kind}: ${cite} → ${file}:${String(at + 1)}`)
    }
  }
  {
    const [file, line] = SHADOW_CITE[0].split(':')
    const t = read(file)
    if (t !== null) {
      const lines = t.split('\n')
      if (!(lines[Number(line) - 1] ?? '').includes(SHADOW_CITE[1])) {
        const at = lines.findIndex((l) => l.includes(SHADOW_CITE[1]))
        if (at < 0) problems.push(`shadow: ${file} no longer carries ${JSON.stringify(SHADOW_CITE[1])} anywhere`)
        else moved.push(`shadow: ${SHADOW_CITE[0]} → ${file}:${String(at + 1)}`)
      }
    }
  }
  // The frozen §5 vocabulary must be covered entirely (a new §5 code without a row is drift).
  const errors = read('packages/domain/tool-governance/src/errors.ts')
  if (errors !== null) {
    const block = errors.slice(errors.indexOf('GOVERNANCE_ERROR_CODES'), errors.indexOf('] as const'))
    for (const m of block.matchAll(/'([A-Z_]+)'/g)) if (!Object.hasOwn(FACE_TABLE, m[1])) problems.push(`§5 code ${m[1]} has no FACE_TABLE row`)
  }
  const spill = read(SPILL_SRC)
  if (spill !== null) {
    spillCodes = null
    if (spillCodeSet(root).size === 0) problems.push(`${SPILL_SRC}: SPILL_REFUSAL_CODES table not found or empty`)
  }
  return problems
}

function usage(msg) {
  process.stdout.write(`${msg ? `REFUSED USAGE: ${msg}\n` : ''}usage: diag-call-chain.mjs (--text <s> | --file <path> | --code <CODE> [--kind <k>]) [--json] | --self-test\n`)
  process.exit(2)
}

function runCli(argv) {
  const opt = { json: false }
  let text = null, file = null, code = null, kind = null, self = false
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--json') opt.json = true
    else if (a === '--text') text = argv[(i += 1)] ?? usage('--text needs a value')
    else if (a === '--file') file = argv[(i += 1)] ?? usage('--file needs a path')
    else if (a === '--code') code = argv[(i += 1)] ?? usage('--code needs a value')
    else if (a === '--kind') kind = argv[(i += 1)] ?? usage('--kind needs a value')
    else if (a === '--self-test') self = true
    else usage(`unknown argument ${JSON.stringify(String(a).slice(0, 40))}`)
  }
  if (self) {
    const moved = []
    const problems = selfTest(REPO_ROOT, moved)
    const note = moved.length === 0 ? '' : `\n  NOTE ${String(moved.length)} line hint(s) drifted (token still present; refresh the hint):\n${moved.map((m) => `    ${m}`).join('\n')}`
    if (problems.length === 0) { process.stdout.write(`diag-call-chain --self-test: OK ${String(Object.keys(FACE_TABLE).length)} codes, ${String(Object.keys(KIND_STAGES).length)} kinds, every cited site still carries its token at this tree${note}\n`); process.exit(0) }
    process.stdout.write(`diag-call-chain --self-test: FAIL ${String(problems.length)}\n${problems.map((p) => `  ${p}`).join('\n')}\n`)
    process.exit(1)
  }
  const given = [text, file, code].filter((x) => x !== null).length
  if (given !== 1) usage('exactly one of --text, --file, --code')
  if (kind !== null && code === null) usage('--kind only qualifies --code')
  if (file !== null) {
    const abs = resolve(file)
    if (!existsSync(abs)) usage(`no such file ${JSON.stringify(file.slice(0, 80))}`)
    const st = lstatSync(abs)
    if (!st.isFile()) usage('--file must be a regular file (symlinks and directories refused)')
    if (st.size > BOUNDS.inputBytes) { process.stdout.write(`REFUSED INPUT_OVER_BOUND: ${String(st.size)} bytes > ${String(BOUNDS.inputBytes)} — cut the transcript to the call in question\n`); process.exit(2) }
    text = readFileSync(abs, 'utf8')
  }
  if (text !== null && Buffer.byteLength(text) > BOUNDS.inputBytes) { process.stdout.write('REFUSED INPUT_OVER_BOUND\n'); process.exit(2) }
  const r = diagnose(text ?? '', { json: opt.json, kind }, code)
  process.stdout.write(r.stdout)
  process.exit(r.exit)
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) runCli(process.argv.slice(2))
