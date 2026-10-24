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
  // A5-M2 independent-group round (root order 12:27, 2026-10-23, booked by the
  // CENTER integrator on this face): the G2 CONNECTOR adapter module consumes
  // the lane's effect-grammar face DIRECTLY (`parseRequestedEffectSet`, the
  // canonical one-shot effect set — the SAME reuse pattern booked for
  // ptc-escalation-row above; effects fail closed through the real parser,
  // never a re-derivation). Shipped UNWIRED by this round (registration/
  // placement stay CENTER); zero lane edits; its six-path census booking rides
  // SCANNED_PATHS_A5M2J in the p4t6 scanner ledger.
  'runtime/src/plugin/live/governed-families/g2-connector-adapters.mjs',
  // A5-M2 G1 round-2 (root real-interface card 13:2x, booked by the CENTER
  // integrator): the G1 surface module consumes the SAME canonical effect
  // grammar faces (parseRequestedEffectSet for the emitted per-record effect sets
  // AND parseResourceRef for present's path legality — the lane's OWN resource
  // grammar, never an invented path rule) to VALIDATE its
  // effect sets at the row — the ptc-escalation-row / g2-connector pattern;
  // effects are never hand-validated against a private grammar. Shipped
  // UNWIRED; zero lane edits; census rides SCANNED_PATHS_A5M2J (no new file).
  'runtime/src/plugin/live/governed-families/g1-surface-adapters.mjs',
  // A5M2 (census run 40014719612 red, booked by the center): the G6 row pair and
  // the B-TEAM control wiring - each consumes ONLY parseRequestedEffectSet, the
  // closed requested-effects grammar at the row, the g2-connector / ptc pattern;
  // effects fail closed through the real parser, zero lane edits.
  'runtime/src/plugin/live/governed-families/g6-session-query.mjs',
  'runtime/src/plugin/live/governed-families/g6-session-query-wiring.mjs',
  'runtime/src/plugin/live/governed-families/team-wiring.mjs',
  // A5M2 census run 40056814591 (head 5a8c6d052) NEW-RED attribution, booked
  // by the CENTER integrator 2026-10-24: the five governed-family wiring/assembly
  // modules merged through their signed lane batches (root narrow signs; center
  // re-verified on int at f48218bf8/dc02689b6 gates) each consume ONLY
  // parseRequestedEffectSet — the SAME reviewed canonical requested-effects
  // grammar at the row (the g2-connector-adapters / ptc-escalation-row pattern),
  // effects fail closed through the real parser, zero lane edits, zero new faces.
  'runtime/src/plugin/live/governed-families/g1-query-assembly.mjs',
  'runtime/src/plugin/live/governed-families/g3-terminal-wiring.mjs',
  // A5M2 census run 40063499790 (head 447e14ac2) NEW-RED attribution, booked
  // by the CENTER integrator 2026-10-24: the B-PTC run_code GUARD wiring module
  // merged through the root narrow-signed FINAL timing card (93e4a7a64, int
  // merge 861b8465b; D1-D4 root-narrow-signed at 10f69dbea). It consumes ONLY
  // parseRequestedEffectSet (g3-ptc-wiring.mjs:78) - the SAME reviewed
  // canonical requested-effects grammar at the row (the g3-terminal-wiring
  // pattern), effects fail closed through the real parser, zero lane edits.
  'runtime/src/plugin/live/governed-families/g3-ptc-wiring.mjs',
  'runtime/src/plugin/live/governed-families/g5-goal-wiring.mjs',
  'runtime/src/plugin/live/governed-families/subagent-spawn-wiring.mjs',
  'runtime/src/plugin/live/governed-families/subagent-wiring.mjs',
  // A5M2 census run 40083884439 (candidate 17c55b01e) NEW-RED attribution, booked
  // by the CENTER integrator 2026-10-24: FIVE more governed-family wiring/provider
  // modules reached the reviewed tree through their signed lane batches merged on
  // this candidate (job trio via e97d38f8c slice-2; pwsh/g3-lsp/workflow/
  // team-governed-provider via earlier root-narrow-signed merges - the audit
  // rounds before this candidate simply never walked them together). Each imports
  // ONLY parseRequestedEffectSet at its own line (g3-lsp-wiring.mjs:54,
  // job-wiring.mjs:29, pwsh-wiring.mjs:30, team-governed-provider.mjs:72,
  // workflow-wiring.mjs:36) - the SAME reviewed canonical requested-effects
  // grammar at the row (the ptc-escalation-row / g3-ptc pattern), effects fail
  // closed through the real parser, zero lane edits, zero new faces.
  'runtime/src/plugin/live/governed-families/g3-lsp-wiring.mjs',
  'runtime/src/plugin/live/governed-families/job-wiring.mjs',
  'runtime/src/plugin/live/governed-families/pwsh-wiring.mjs',
  'runtime/src/plugin/live/governed-families/team-governed-provider.mjs',
  'runtime/src/plugin/live/governed-families/workflow-wiring.mjs',
  // PR2 (plan §5) reviewed addition — see the block comment.
  'runtime/tool-admission/',
  // PR3/PR5 (Alpha.5) reviewed additions — provenance in the block comment.
  'runtime/controlled-fs/src/',
  'tools/a5p5-tools/src/',
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
  // The governed effect backends row: src/plugin/live/plane-effect-backends
  // .mjs:64 imports `parseRequestedEffectSet` (VALUE) and uses it at :1050 to
  // parse the READ row's requested effects into the frozen closed resource
  // vocabulary BEFORE any backend is reached — the read face's effect
  // resolution (its window caps are its own READ_ROW_* constants, no lane
  // symbol). One named symbol, not a barrel-wide reach; the sibling live rows
  // (agent-bindings / team-tool-plane / ptc-escalation-row) were booked the
  // same way by their own rounds.
  'runtime/src/plugin/live/plane-effect-backends.mjs',
  // A5-M2 B-WEB (a5m2w) - booked by the CENTER integration round (the PR #360 face),
  // NOT by the lane: the web connector lane package consumes the frozen gateway and
  // effect faces for its destination envelope and the literal-IP belt; its production
  // row mounts through agent-bindings (listed above) and reaches the host web service
  // only through the additive deps.web accessor in plugin/host.ts. Zero host edits,
  // zero new ledger, gate keys read RAW and refused typed inside the assembly.
  'runtime/web-gateway/',
  // A5-M2 B-IMAGE (governed read_image arm) - booked by the CENTER integration round
  // (the PR #360 face), NOT by the lane: the arm consumes the frozen effect grammar
  // only (parseRequestedEffectSet, for its own I+F classify self-check). Its mount -
  // the takeover-table row plus the imageEnabled key - is deliberately NOT applied,
  // so no production face reaches it yet; the attachment adapter reaches the store
  // through injected ports only. Zero lane edits, zero new ledger.
  'runtime/src/plugin/live/governed-families/image.mjs',
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
