// @ts-check
/**
 * Alpha.5 PR0 — import-cycle & cross-layer audit for the `tool-governance`
 * lane (implementation plan §3: "循环依赖/跨层 imports 审计").
 *
 * Run:  node scripts/audit-a5-tool-governance-imports.mjs          (exit 1 on findings)
 * Used by: packages/domain/test/a5p0-layer-audit.test.ts (the gate that runs it)
 *
 * THE LAW AUDITED:
 *  1. `packages/domain/tool-governance/**` is PURE DOMAIN: no `node:*`, no
 *     `@deepseek-ai/*`, no other workspace package (contracts/storage/runtime/
 *     …). Its only outward domain edges are the two sanctioned leaves:
 *     `domain/authority-envelope` (the shared Alpha.4 lattice — REUSE, not a
 *     second algebra) and `domain/blueprint/src/hash.ts` (sha256Hex).
 *  2. NO CYCLE: the module graph (including the visited leaf edges) must be
 *     acyclic.
 *  3. THE CONSUMER SET IS THE REVIEWED SET. PR0 froze the lane DORMANT (zero
 *     consumers, plan §3 "零生产行为变化"); PR1 (plan §4) is the reviewed wiring
 *     step, so the law is now a NAMED allow-list instead of a blank: the PR1
 *     runtime lane `runtime/tool-dispatch/**` (the closed-world Guard + the
 *     Scoped Dispatcher, which import the frozen §5 vocabulary and the
 *     transition table) and the ONE production assembly point that installs
 *     them, `runtime/src/plugin/live/agent-bindings.mjs`. Anything else that
 *     mentions the lane is a finding — a second consumer is a design change,
 *     not an import accident. (PR2/PR3/PR4 add theirs as their PRs land; each
 *     addition is a reviewed edit to THIS list, never a silent one.)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGES = join(REPO_ROOT, 'packages')
const LANE = join(PACKAGES, 'domain', 'tool-governance')

/** Specifiers the lane may point at outside itself. */
const PERMITTED_OUTSIDE = [
  'domain/authority-envelope/src/index.js',
  'domain/blueprint/src/hash.js',
]

/**
 * The reviewed consumers (repo-root/`packages`-relative). A prefix entry
 * (ending in `/`) allows the whole subtree. PR1: the runtime lane
 * `runtime/tool-dispatch/**` (the closed-world Guard + the Scoped Dispatcher,
 * which import the frozen §5 vocabulary and the transition table) and the ONE
 * production assembly point that installs them,
 * `runtime/src/plugin/live/agent-bindings.mjs`. PR2 (plan §5): the admission
 * lane `runtime/tool-admission/**` (Operation Admission, the multi-effect Ask
 * on the one ApprovalCase, the one-shot grant — the frozen §5 vocabulary, the
 * grant algebra and the plane functions, imported not restated; live wiring
 * rides with the first PR that executes through it, PR3/PR4). PR3 (Alpha.5
 * C-FS lane, merged 74d947a3; review provenance PR #259 review 23dc3bd1): the
 * ControlledFs lane `runtime/controlled-fs/src/**` (4 consumer files) imports
 * the frozen §5 vocabulary and the C-FS error classes. PR5 (Alpha.5 tools
 * lane, merged d69bfc4b; review provenance PR #260 review 5ccc5839): the
 * Search/Shell schema + pipeline `tools/a5p5-tools/src/**` (6 consumer
 * files), same posture. Both registrations book a REAL ledger debt (the
 * merges landed the imports without paying the consumer set — an earlier
 * round's "audit IDENTICAL to baseline" preserved the red, it did not clear
 * it); registered per the integration coordinator's instruction. Exceptions
 * stay reserved for name-appears-without-reference forms, never consumers.
 * Anything else that mentions the lane is a finding — a second consumer is a
 * design change, not an import accident. The exact FILE set is pinned
 * independently by packages/domain/test/a5p0-layer-audit.test.ts, so a
 * subtree prefix cannot smuggle a new file past review.
 */
const PR1_CONSUMERS = Object.freeze([
  'runtime/tool-dispatch/',
  'runtime/src/plugin/live/agent-bindings.mjs',
  // GLUE-7 (alpha5-glue7-backend): the plane row consumes the §6 feed face
  // (`definitionIdentityOf` from tool-dispatch) to mint placement-binding
  // rows for the Guard — the #313 入参面's first production caller.
  'runtime/src/plugin/live/team-tool-plane.mjs',
  // U6 PR2 (the PR1-disclosed minter rebind): the SHADOW row now consumes
  // the SAME §6 feed face — `definitionIdentityOf` — so its audit identities
  // are the identities the Guard binds (PR1's local `gc-def#N` stand-in was
  // deliberate inertness; with the read kernel mounted, a shadow auditing a
  // DIFFERENT identity than the Guard sees would be a lying audit). One
  // pure function imported, zero state, zero authority (the row still only
  // records and takes next()).
  'runtime/src/plugin/live/center-shadow-row.mjs',
  // alpha5-ptc-fs (branch `alpha5-ptc-pr` off master 1962f879; review
  // provenance 独审 PASS — the round's 独审 id 7f0e5d6e, booked by the
  // integration coordinator on the #334 census red): the PTC fs escalation
  // adjudication row consumes the lane's effect-grammar face DIRECTLY
  // (packages/runtime/src/plugin/live/ptc-escalation-row.mjs:66 —
  // `parseRequestedEffectSet`, the canonical one-shot effect set the grant
  // carries), and reaches the frozen grant algebra only through the
  // ALREADY-REVIEWED PR2 consumer
  // packages/runtime/src/plugin/live/ptc-escalation-row.mjs:65 —
  // `../../../tool-admission/grant-mint.js` (mintOperationGrant/
  // createGrantLedger — grant-mint.ts is in this list via the PR2 prefix;
  // the row imports the RUNTIME module, never the lane barrel for grants).
  // Zero lane edits; scope-gated production consumer by the :2412 face.
  'runtime/src/plugin/live/ptc-escalation-row.mjs',
  // PR2 (plan §5) reviewed addition — see the block comment.
  'runtime/tool-admission/',
  // PR3/PR5 (Alpha.5) reviewed additions — provenance in the block comment.
  'runtime/controlled-fs/src/',
  'tools/a5p5-tools/src/',
  // U6 PR2 (FS family lane) booked FILE-BY-FILE, single thin face:
  // `tools/fs-family/src/read-executor.mjs` imports
  // `parseRequestedEffectSet` (domain/tool-governance effect grammar) — the
  // same face `runtime/src/plugin/live/plane-effect-backends.mjs` carried
  // until this move (its booking retired with the retirement note below).
  // The file IS that plane file's moved governed-read executor (U6
  // slice plan PR2: the Family owns the read body; the effect grammar stays
  // the domain's); zero lane edits. The lane's other modules import only
  // contracts/controlled-fs mechanics, and the plane re-exports nothing of
  // the governance lane onward (owner role: packages/tools/fs-family/README.md).
  'tools/fs-family/src/read-executor.mjs',
  // U7-9a (FS family mutation slice) booked FILE-BY-FILE, SAME single thin
  // face as read-executor above: each of the three governed mutation/
  // executors imports ONLY `parseRequestedEffectSet` (domain/tool-governance
  // effect grammar) to mint the PA operation fingerprint pre-authority —
  // exactly the face the read executor carries; no other lane export is
  // reachable from these files (verified by this audit itself: a different
  // face stays a finding). Zero lane edits; the mechanics/rows/contribution
  // modules of the same slice import nothing of the governance lane.
  'tools/fs-family/src/write-executor.mjs',
  'tools/fs-family/src/edit-executor.mjs',
  'tools/fs-family/src/image-executor.mjs',
  // U7-f (web family lane) booked FILE-BY-FILE, SAME single thin face as
  // every executor above: both governed executors import ONLY
  // `parseRequestedEffectSet` (domain/tool-governance effect grammar) to
  // declare the family body's [tool-invoke + connect@origin] effect set
  // pre-authority — no other lane export is reachable from these files
  // (the audit itself enforces that; a different face stays a finding).
  // Zero lane edits; web-mechanics / web-transport / web-search-provider /
  // rows / contribution / index import NOTHING of the governance lane
  // (network confinement is the admission plane per DECISION-3 — this
  // family carries no sandbox claim), matching the fs-family slice shape.
  'tools/web-family/src/fetch-executor.mjs',
  'tools/web-family/src/search-executor.mjs',
  // U7-F (agent-control family) booked FILE-BY-FILE, SAME single thin face:
  // `tools/agent-control-family/src/agent-control-executor.mjs` imports ONLY
  // `parseRequestedEffectSet` (domain/tool-governance effect grammar) to
  // canonicalize the DERIVED per-call effect set at the PA edge; no other
  // family module imports anything of the governance lane (mechanics/rows/
  // port/contribution verified), and a different face stays a finding, as
  // every booking above states.
  'tools/agent-control-family/src/agent-control-executor.mjs',
  // U7-F (inspect-family lane: skill / cordis_inspect_list /
  // cordis_inspect_query) booked FILE-BY-FILE, SAME single thin face as the
  // fs-family executors above: each governed executor imports ONLY
  // `parseRequestedEffectSet` (domain/tool-governance effect grammar) to
  // validate its admitted effect set at the PA boundary — skill-executor
  // reads anchored SKILL.md files, inspect-executor reaches ONLY the
  // read-only inspect-provider face, and neither grants anything. Zero lane
  // edits; the mechanics/rows/contribution/descriptor modules of the same
  // slice import nothing of the governance lane.
  'tools/inspect-family/src/inspect-executor.mjs',
  'tools/inspect-family/src/skill-executor.mjs',
  // U7-F (process-family governed PWSH row) booked FILE-BY-FILE.
  // `tools/process-family/src/pwsh-executor.mjs` imports
  // `parseRequestedEffectSet` (the SAME thin effect-grammar face the fs
  // executors carry — it mints the call's closed `tool-invoke:pwsh`
  // requested-effect set) AND `canonicalJsonFingerprint` (VALUE, the
  // control/service.ts precedent face) for the PA `parametersFingerprint`:
  // the shell-class H2 law says the OPAQUE COMMAND is the security-relevant
  // field, so the fingerprint binds the PARSED parameter record, not the
  // per-call-uniform effect-set digest (fs-row form) — an effect-set
  // fingerprint would make every pwsh command fingerprint-identical. No
  // other lane export is reachable from the file; the row/mechanics/
  // confined/contribution modules of the same slice import nothing of the
  // governance lane.
  'tools/process-family/src/pwsh-executor.mjs',
  // u7-f (UI family) booked FILE-BY-FILE, SAME single thin face: the two
  // governed executors (ask/present bodies) import ONLY
  // `parseRequestedEffectSet` (domain/tool-governance effect grammar) to
  // mint the PA operation fingerprint pre-authority — exactly the face the
  // read/fs executors carry; no other lane export is reachable from these
  // files (verified by this audit itself). Zero lane edits; the mechanics/
  // rows/port/contribution modules of the same slice import nothing of the
  // governance lane (owner role: packages/tools/ui-family/README.md).
  'tools/ui-family/src/ask-executor.mjs',
  'tools/ui-family/src/present-executor.mjs',
  // U7-F B (agent-state family) booked FILE-BY-FILE, thin faces only:
  // `tools/agent-state-family/src/executors.mjs` imports ONLY
  // `parseRequestedEffectSet` (the SAME effect-grammar face the fs-family
  // executors carry) to validate the five rows' per-call PA arm sets;
  // `tools/agent-state-family/src/contribution.mjs` imports ONLY
  // `canonicalJsonStringify` (the deterministic canonical serialization the
  // contribution provider-digest needs — a pure function, zero authority,
  // the face the shadow-row booking above carries for its digest documents).
  // No other lane export is reachable from these files (a different face
  // stays a finding by this audit's own rule); zero lane edits.
  'tools/agent-state-family/src/executors.mjs',
  'tools/agent-state-family/src/contribution.mjs',
  // A5-M1 (PR358) additions, booked FILE-BY-FILE by the census CI-only round
  // at headSha efecfe2b4 (census run 39866646962 listed exactly these four
  // as un-listed). Each entry states WHICH SYMBOL it imports and WHAT FOR:
  // the law this list enforces is not "who may import" but "which thin
  // center-interface face each consumer was reviewed for", so a listed file
  // reaching for a DIFFERENT face of the lane stays a design change, and a
  // new file stays a finding. Nothing here touches the lane's pure-domain law
  // or the reverse-edge prohibition — no entry lets `domain/tool-governance`
  // import anything, and no entry widens a subtree prefix.
  //
  // The Control lane's WRITE-side fingerprint: control/service.ts:183 imports
  // `canonicalJsonFingerprint` (VALUE) and uses it at :2311, where
  // `requestControl` recomputes the PA operation-manifest digest and refuses
  // a `reviewPayloadDigest` / `operationFingerprint` pair that is not the
  // SERVICE-computed digest of the payload it pairs with (malformed → NO row
  // written). The Control lane already rode this exact domain edge (its own
  // types.ts names service.ts as the precedent); A5-M1 adds the use sites,
  // zero lane edits.
  'runtime/control/service.ts',
  // The Control lane's READ-side fingerprint plus its call-facts TYPES:
  // control/types.ts:136 imports `canonicalJsonFingerprint` (VALUE) for the
  // PR358 f5 item-4 read-back VALUE check at :1285 (a payload that stayed
  // schema-valid but no longer hashes to the row's pairing re-reads as the
  // damage it is), and :153 is `import type { RequestedEffectSet, ToolBinding,
  // ToolPolicyDocument }` — the durable-owner types the call-facts slots carry
  // at :1407 / :1414 / :1423. The type half is erased at emit (ADR X7-R3):
  // the Control plane gains no runtime edge from it.
  'runtime/control/types.ts',
  // The PA↔Control bridge: operation-permission/pa-control-bridge.ts:91
  // imports `canonicalJsonFingerprint` (VALUE — the manifest digest it writes
  // at :394, the assurance-snapshot compare at :752) and :93-98 is `import
  // type { AdmissionRequest, GovernanceResult, OperationGrant,
  // RequestedEffectSet }`, the closed vocabulary its admit/guard ports are
  // typed against rather than restate. Direction is the reviewed one (runtime
  // lane → domain leaf, no storage, no plugin). NOTE for the record: this file
  // ALSO consumes the Alpha.4 ladder (`authorityRank` / `mayReview` /
  // `RuntimeAuthority`); that edge is booked on the a3p3 governance-lane rows
  // and this list says nothing about it.
  'runtime/operation-permission/pa-control-bridge.ts',
  // The governed effect backends row's booking RETIRED at U6 PR2: its one
  // lane edge (`parseRequestedEffectSet`, used by the governed READ row's
  // effect parsing) MOVED with the read executor to
  // `tools/fs-family/src/read-executor.mjs` (booked just above); the file
  // itself now imports nothing from the lane (the read sections are family
  // imports/re-exports, the surviving search/glob/shell backends never had
  // a lane edge). Retiring the entry is the honest state, not a widening:
  // the symbol's consumer SET is unchanged in count, only in location.

])

const SPECIFIER_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*import\s+['"]([^'"]+)['"]/gm,
]

/** Comment stripper with a3p3's over-stripping direction (line comments
 *  first, then block comments whose opener starts a line): prose may stop
 *  counting as an edge, an edge can never be erased. */
function codeOnly(source) {
  return source.replace(/^\s*\/\/.*$/gm, ' ').replace(/^\s*\/\*[\s\S]*?\*\//gm, ' ')
}

/** @param {string} source @returns {string[]} */
function specifiersIn(source) {
  /** @type {string[]} */
  const out = []
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of codeOnly(source).matchAll(pattern)) {
      const spec = match[1]
      if (typeof spec === 'string') out.push(spec)
    }
  }
  return out
}

/** @param {string} dir @returns {string[]} */
function walkTs(dir, into = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('dist.')) continue
      walkTs(full, into)
      continue
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.endsWith('.test.ts')) continue
    into.push(full)
  }
  return into
}

/** Resolve a relative specifier (with `.js` → `.ts` rewriting) to a repo path. */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  let target = join(fromFile, '..', specifier)
  if (target.endsWith('.js')) target = `${target.slice(0, -3)}.ts`
  return target
}

/**
 * @returns {{ findings: string[]; edgeCount: number; laneFiles: number; consumers: string[] }}
 */
export function auditA5ToolGovernanceImports() {
  /** @type {string[]} */
  const findings = []
  const laneFiles = walkTs(LANE, [])
  if (laneFiles.length === 0) return { findings: ['tool-governance lane has no sources — the audit is vacuous'], edgeCount: 0, laneFiles: 0, consumers: [] }

  /** @type {Map<string, string[]>} */
  const graph = new Map()
  let edgeCount = 0

  const visit = /** @type {(file: string) => void} */ (file => {
    if (graph.has(file)) return
    const deps = /** @type {string[]} */ ([])
    graph.set(file, deps)
    const source = readFileSync(file, 'utf8')
    for (const specifier of specifiersIn(source)) {
      const resolved = resolveSpecifier(file, specifier)
      if (resolved === null) {
        // Non-relative: what remains must be nothing at all.
        if (specifier.startsWith('node:')) findings.push(`${relative(REPO_ROOT, file)} -> ${specifier} (node: is not pure domain)`)
        else findings.push(`${relative(REPO_ROOT, file)} -> ${specifier} (bare specifiers are forbidden in the lane)`)
        continue
      }
      // Which sanctioned-outside entry does this resolve to (if any)?
      const resolvedRelFromPackages = relative(PACKAGES, resolved).split(sep).join('/')
      const insideLane = resolved.startsWith(LANE)
      const permitted = PERMITTED_OUTSIDE.some((p) => p.replace(/\.js$/, '.ts') === resolvedRelFromPackages)
      if (!insideLane && !permitted) {
        findings.push(`${relative(REPO_ROOT, file)} -> ${resolvedRelFromPackages} (cross-layer edge)`)
        continue
      }
      edgeCount += 1
      deps.push(resolved)
      if (insideLane) visit(resolved)
      // Sanctioned OUTSIDE targets are TERMINAL nodes of this graph: their own
      // imports belong to their lanes (authority-envelope's leaf law is pinned
      // by `a3p3-governance-lane-hygiene`; `blueprint/src/hash.ts` reaches only
      // contracts, which never imports back into domain).
    }
  })
  for (const file of laneFiles) visit(file)

  // Cycle detection over the whole visited graph (DFS colours).
  const WHITE = 0, GRAY = 1, BLACK = 2
  /** @type {Map<string, number>} */
  const colour = new Map()
  /** @type {(file: string, stack: string[]) => void} */
  const dfs = (file, stack) => {
    colour.set(file, GRAY)
    for (const dep of graph.get(file) ?? []) {
      const c = colour.get(dep) ?? WHITE
      if (c === GRAY) {
        findings.push(`cycle: ${[...stack.slice(stack.indexOf(file)), file, dep].map(f => relative(REPO_ROOT, f)).join(' -> ')}`)
      } else if (c === WHITE && graph.has(dep)) {
        dfs(dep, [...stack, file])
      }
    }
    colour.set(file, BLACK)
  }
  for (const file of graph.keys()) if ((colour.get(file) ?? WHITE) === WHITE) dfs(file, [])

  // THE CONSUMER SET (law 3). `.mjs` IS scanned on purpose: the Team trusted
  // assembly point is plain JS, and a law that only sees `.ts` would miss the
  // one production caller that matters most.
  /** @type {string[]} */
  const consumers = []
  const consumerWalk = /** @type {(dir: string) => void} */ (dir => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'test' || entry === 'dist' || entry.startsWith('dist.')) continue
        if (full === LANE) continue
        consumerWalk(full)
        continue
      }
      if (entry.endsWith('.d.ts') || entry.endsWith('.test.ts') || entry.endsWith('.test.mjs')) continue
      if (!entry.endsWith('.ts') && !entry.endsWith('.mjs')) continue
      const source = readFileSync(full, 'utf8')
      // Law 3 sees BOTH edges into the frozen lane (`tool-governance`) and
      // edges into the PR1 runtime lane that consumes it (`tool-dispatch`):
      // the assembly point imports only the latter, and it is the caller that
      // matters. Comments are stripped first, so prose never counts.
      if (!/tool-governance|tool-dispatch/.test(codeOnly(source))) continue
      const fromPackages = relative(PACKAGES, full).split(sep).join('/')
      consumers.push(fromPackages)
      if (!PR1_CONSUMERS.some((allowed) => (allowed.endsWith('/') ? fromPackages.startsWith(allowed) : fromPackages === allowed))) {
        findings.push(`un-listed production consumer of tool-governance: ${fromPackages} (the consumer set is the reviewed PR1_CONSUMERS list)`)
      }
    }
  })
  for (const pkg of readdirSync(PACKAGES)) consumerWalk(join(PACKAGES, pkg))

  // Non-vacuity of law 3: the allow-list must have actually MATCHED
  // something. An empty consumer set after PR1 means the wiring disappeared
  // (or the walk stopped seeing files), which is exactly as bad as a finding.
  for (const expected of PR1_CONSUMERS) {
    const seen = consumers.some((c) => (expected.endsWith('/') ? c.startsWith(expected) : c === expected))
    if (!seen) findings.push(`expected PR1 consumer never found: ${expected} (the wiring is gone or the walk is blind)`)
  }

  return { findings, edgeCount, laneFiles: laneFiles.length, consumers: consumers.sort() }
}

if (process.argv[1] !== undefined && relative(REPO_ROOT, process.argv[1]).replace(/\\/g, '/') === 'scripts/audit-a5-tool-governance-imports.mjs') {
  const { findings, edgeCount, laneFiles, consumers } = auditA5ToolGovernanceImports()
  console.log(`tool-governance audit: ${laneFiles} lane files, ${edgeCount} edges, ${consumers.length} consumer file(s)`)
  if (findings.length > 0) {
    for (const f of findings) console.error(`FINDING: ${f}`)
    process.exitCode = 1
  } else {
    console.log(`OK: pure-domain lane, no cycles, consumers = ${consumers.join(', ')}`)
  }
}
