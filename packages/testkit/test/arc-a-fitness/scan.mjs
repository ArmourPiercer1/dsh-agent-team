/**
 * U6 PR5 — the ARC-A fitness scanners (the slice plan §C: architecture
 * fitness gate). Pure scan functions over caller-supplied file maps, with
 * thin git/fs loaders on top: the FITNESS TEST supplies real tracked files,
 * and every law's planted-counterexample leg supplies a mutated MAP (never
 * a mutated disk) — the §10.5-6 sensitivity law needs the scanner to be a
 * function someone can point at a lie.
 *
 * THE FOUR LAWS:
 *  L1 protected-center digest lock — the center files that must NEVER move
 *     for a family addition (tool-dispatch/**, tool-admission/**,
 *     control/**, operation-permission/**, pa-mount-registry.mjs,
 *     agent-bindings.mjs, the governance-center kernel/registry/
 *     host-adapter/contribution-schema/index) are digest-pinned in a
 *     tracked ledger; drift or a new protected file without a ledger entry
 *     is a violation UNLESS the ledger names a center-interface PR
 *     (path + pr + reason) — a family-addition PR never may.
 *  L2 no-tool-name-branch law — the Governance Center's source carries ZERO
 *     tool-name string literals: the Kernel decides by CANDIDATES, never
 *     by names (the runtime mirror is u6-pr5-kernel-flow S4).
 *  L3 family census — every family contribution on the tree (product lanes
 *     AND test-only lanes) is booked in the tracked census ledger with its
 *     familyId, lane, and mount kind; a new family without a census entry,
 *     or a booked family that vanished, is a violation.
 *  L4 contribution closedness — a contribution is registrable ONLY when
 *     its source is a reviewed lane path, its familyId is a literal, and
 *     every visibility.nativeNames entry is a STRING LITERAL or a
 *     `<ident>.name` bound-definition (the CI-04 definition-mint edge);
 *     a computed name is reported `not-verified` (the registry closedness
 *     law's scan twin: names the scanner cannot read are names no review
 *     bound).
 *
 * @module @dsh-agent-team/testkit/test/arc-a-fitness/scan
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const sha256Text = (text) => createHash('sha256').update(text, 'utf8').digest('hex')

/** L1 — the protected center set (globs over repo-relative POSIX paths). */
export const PROTECTED_CENTER_SET = Object.freeze([
  'packages/runtime/tool-dispatch/',
  'packages/runtime/tool-admission/',
  'packages/runtime/control/',
  'packages/runtime/operation-permission/',
  'packages/runtime/src/plugin/live/pa-mount-registry.mjs',
  'packages/runtime/src/plugin/live/agent-bindings.mjs',
  'packages/runtime/governance-center/kernel.ts',
  'packages/runtime/governance-center/registry.ts',
  'packages/runtime/governance-center/host-adapter.ts',
  'packages/runtime/governance-center/contribution-schema.ts',
  'packages/runtime/governance-center/index.ts',
])

export const isProtectedPath = (p) =>
  PROTECTED_CENTER_SET.some((g) => (g.endsWith('/') ? p.startsWith(g) : p === g))

/** Tracked files under the protected set (git index = tracked truth). */
export function trackedProtectedFiles(repoRoot) {
  const out = execFileSync('git', ['ls-files', '-z', 'packages/runtime'], { cwd: repoRoot, encoding: 'utf8' })
  return out.split('\0').filter((p) => p.length > 0 && isProtectedPath(p)).sort()
}

export function readTreeMap(repoRoot, paths) {
  const map = new Map()
  for (const p of paths) map.set(p, readFileSync(join(repoRoot, p), 'utf8'))
  return map
}

/**
 * L1 scan: current digests vs the ledger.
 * @returns {{ violations: Array<{path, kind, detail}> }} kind:
 *   'ledger-missing' (protected file not booked), 'digest-drift' (content
 *   differs from the booked digest, no named override), 'ledger-stale'
 *   (booked path no longer tracked).
 */
export function scanProtectedLedger({ current, ledger, tracked }) {
  const violations = []
  const booked = new Map(ledger.files.map((f) => [f.path, f.sha256]))
  const overrides = new Map((ledger.overrides ?? []).map((o) => [`${o.path}\u0000${o.sha256}`, o]))
  for (const path of tracked) {
    if (!booked.has(path)) {
      violations.push({ path, kind: 'ledger-missing', detail: 'protected file is not digest-booked' })
      continue
    }
    const now = current.get(path)
    if (now === undefined) continue
    const digest = sha256Text(now)
    if (digest !== booked.get(path) && !overrides.has(`${path}\u0000${digest}`)) {
      violations.push({ path, kind: 'digest-drift', detail: `booked ${booked.get(path).slice(0, 12)}… now ${digest.slice(0, 12)}… — a family addition must not move the center` })
    }
  }
  for (const path of booked.keys()) {
    if (!tracked.includes(path)) violations.push({ path, kind: 'ledger-stale', detail: 'booked protected path is no longer tracked' })
  }
  return { violations }
}

/** L2 — the exact tool-name literals the Kernel must never branch on. */
export const TOOL_NAME_LITERALS = Object.freeze([
  'grep', 'glob', 'read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh',
  'team_grep', 'team_glob', 'team_bash',
])
const nameLiteralRx = new RegExp(`(['"\`])(${TOOL_NAME_LITERALS.join('|')})\\1`, 'g')

/**
 * L2 scan: quoted tool-name literals in the center's own source files.
 * Comments count too — the scan is dumb on purpose (a comment naming a
 * tool in the Kernel is a smell worth a review line; the law needs zero
 * ambiguity about what the center knows).
 */
export function scanNameLiterals({ files }) {
  const hits = []
  for (const [path, text] of files) {
    for (const m of text.matchAll(nameLiteralRx)) {
      const line = text.slice(0, m.index).split('\n').length
      hits.push({ path, line, literal: m[2] })
    }
  }
  return { hits }
}

/** L3/L4 scan over CONTRIBUTION modules: every tracked file under
 *  packages/tools/**\/src/*contribution*.mjs or tests/**\/*contribution*.mjs
 *  is a family contribution; classify source review, familyId, names.
 *  NAME CLASSIFICATION (the honest three):
 *    'literal'          — quoted string in the source (the strongest form;
 *                         the test-only probe lane uses this);
 *    'bound-definition' — `<ident>.name` where the builder takes the
 *                         definition as an INPUT (the reviewed product-law
 *                         form: the name is bound by the host-validated
 *                         definition mint — CI-04 owns that edge);
 *    'dynamic'          — anything else: a name no review can read. */
export function scanContributions({ paths, files }) {
  const contributions = []
  for (const path of paths) {
    const text = files.get(path)
    if (text === undefined) continue
    const reviewedSource = /^packages\/tools\/[a-z0-9-]+-family\/src\//.test(path) || path.startsWith('tests/')
    const familyIds = [...text.matchAll(/familyId:\s*(['"])([^'"]+)\1/g)].map((m) => m[2])
    const namesBlock = /nativeNames:\s*\[([\s\S]*?)\]/.exec(text)
    /** @type {Array<{entry: string, kind: 'literal'|'bound-definition'|'dynamic'}>|null} */
    let nativeNames = null
    if (namesBlock !== null) {
      const entries = namesBlock[1].split(',').map((s) => s.trim()).filter((s) => s.length > 0 && !s.startsWith('//'))
      nativeNames = entries.map((entry) => ({
        entry,
        kind: /^(['"]).*\1$/.test(entry)
          ? 'literal'
          : /^[A-Za-z_$][\w$]*\.name$/.test(entry)
            ? 'bound-definition'
            : 'dynamic',
      }))
    }
    contributions.push({
      path,
      reviewedSource,
      familyIds: [...new Set(familyIds)],
      nativeNames,
      dynamic: nativeNames !== null && nativeNames.some((n) => n.kind === 'dynamic'),
      testOnly: path.startsWith('tests/'),
    })
  }
  return { contributions }
}

/** L3 census diff: scanned contributions vs the booked census ledger. */
export function scanCensus({ contributions, ledger }) {
  const violations = []
  const bookedByPath = new Map(ledger.families.flatMap((f) => f.contributionPaths.map((p) => [p, f])))
  const seen = new Set()
  for (const c of contributions) {
    seen.add(c.path)
    const booked = bookedByPath.get(c.path)
    if (booked === undefined) {
      violations.push({ path: c.path, kind: 'census-missing', detail: `family ${c.familyIds.join(',') ?? '?'} is not booked in the census` })
      continue
    }
    if (!c.familyIds.includes(booked.familyId)) {
      violations.push({ path: c.path, kind: 'census-familyId-drift', detail: `booked ${booked.familyId}, scanned ${c.familyIds.join(',')}` })
    }
    if (booked.mount === 'test-only' && !c.testOnly) {
      violations.push({ path: c.path, kind: 'census-mount-drift', detail: 'booked test-only but the lane is NOT under tests/' })
    }
  }
  for (const f of ledger.families) {
    for (const p of f.contributionPaths) {
      if (!seen.has(p)) violations.push({ path: p, kind: 'census-stale', detail: `booked contribution of ${f.familyId} vanished from the tree` })
    }
  }
  return { violations }
}

/** L4 closedness verdict over the scan result. */
export function scanClosedness({ contributions }) {
  const violations = []
  for (const c of contributions) {
    if (!c.reviewedSource) violations.push({ path: c.path, kind: 'unreviewed-source', detail: 'contribution outside packages/tools/*-family/src or tests/**' })
    if (c.dynamic) violations.push({ path: c.path, kind: 'not-verified', detail: 'nativeNames carries a NON-literal — a name no review bound' })
    if (c.nativeNames === null) violations.push({ path: c.path, kind: 'not-verified', detail: 'no readable nativeNames block' })
    if (c.familyIds.length !== 1) violations.push({ path: c.path, kind: 'not-verified', detail: `expected exactly one familyId literal, found ${String(c.familyIds.length)}` })
  }
  return { violations }
}

/** Loader: the tree's contribution modules (git index truth). */
export function trackedContributionPaths(repoRoot) {
  const out = execFileSync('git', ['ls-files', '-z', 'packages/tools', 'tests'], { cwd: repoRoot, encoding: 'utf8' })
  return out
    .split('\0')
    .filter((p) => p.includes('/src/') ? /\/src\/[^/]*contribution[^/]*\.mjs$/.test(p) : /(^|\/)[^/]*contribution[^/]*\.mjs$/.test(p))
    .filter((p) => !p.includes('/dist/'))
    .sort()
}
