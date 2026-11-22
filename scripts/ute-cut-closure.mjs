#!/usr/bin/env node
/**
 * ute-cut-closure.mjs — the A1 deletion's DEPENDENCY CLOSURE, computed against a FROZEN
 * boundary rather than against whatever happens to be on disk.
 *
 * WHY THIS EXISTS. A deletion inventory is not a closure. `ute-p0-assets` answers "which files
 * belong to the modules we are retiring"; it cannot answer "what still points at them". The
 * first review of A0 found four live references a `git ls-files` inventory cannot see —
 *
 *   - `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` reaches five shadows through
 *     `new URL('./confined-*.mjs', import.meta.url)` (dynamic; invisible to a static scan);
 *   - `packages/runtime/operation-permission/index.ts` RE-EXPORTS `pre-execute-adapter.ts`,
 *     so a module we marked KEEP would dangle;
 *   - `scripts/dist-placements/*.json` still place retired shadows into the built tree;
 *   - committed dist artifacts still ship the deleted modules.
 *
 * WHY IT RESOLVES AGAINST THE SNAPSHOT. The first version resolved a specifier with
 * `existsSync` and gave up when nothing was there. That is exactly backwards for a post-
 * deletion check: once A1 deletes `confined-fs-tool.mjs`, a surviving
 * `new URL('./confined-fs-tool.mjs', …)` would resolve to null and vanish from the report —
 * the check would go green *because* the deletion worked. Resolution is therefore textual
 * (candidate paths), and membership is decided against the FROZEN delete set from the A0
 * snapshot, where a deleted target is still a target.
 *
 * CLASSIFICATION. A reference only matters when the REFERRER survives the cut:
 *
 *   production  `packages/**` sources, `apps/**` — enumerated, each with a declared disposition
 *   exempt      a named test/evidence file registered in `ute-cut-closure.allow.json` with a
 *               reason. No directory gets a blanket exemption: registering a file is a
 *               reviewed act, and an unregistered referrer is a finding.
 *   tooling     `scripts/**`, `dev/ci/**` — generators and placements that name retired files
 *   dist        committed build output for a deleted source — must be deleted with it
 *
 * Usage:
 *   node scripts/ute-cut-closure.mjs --check    # report agreement + exemptions + cut zeros
 *   node scripts/ute-cut-closure.mjs --write    # regenerate the report
 *   node scripts/ute-cut-closure.mjs --json
 *   node scripts/ute-cut-closure.mjs --check --root <dir>   # another checkout (negative control)
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const REPORT_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.json'
const LEDGER_PATH = 'dev/agent-workflow/ledgers/ute-p0-assets.json'
const SNAPSHOT_PATH = 'dev/agent-workflow/ledgers/ute-p0-assets.snapshot.json'
const EXEMPTIONS_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.allow.json'
const DISPOSITIONS_PATH = 'dev/agent-workflow/ledgers/ute-cut-closure.dispositions.json'

/**
 * DISPOSITIONS. The closure is only useful if every surviving production reference has a
 * DECLARED fate. A production referrer with no entry turns `--check` red, so "we will deal
 * with it during the cut" cannot be the answer for a file nobody looked at.
 */
export const DISPOSITIONS = Object.freeze({
  'packages/runtime/operation-permission/canonical-operation.ts': {
    disposition: 'rewire',
    note: 'Imports bash-normalizer / read-normalizer from the retired process and fs families. Those normalizers are text normalization, not execution: they move into the kept algebra at the cut, so the permission result for a bash/read operation is unchanged.',
  },
  'packages/runtime/operation-permission/index.ts': {
    disposition: 'rewire',
    note: 'Re-exports pa-control-bridge and pre-execute-adapter. The two re-export lines are removed with the modules; the algebra surface stays.',
  },
  'packages/runtime/src/plugin/host.ts': {
    disposition: 'replace',
    note: 'Holds the lazy accessors that reach the old assembly (agent-bindings/root). Replaced by the new entry host surface in the A1 swap.',
  },
  'packages/runtime/src/plugin/types.ts': {
    disposition: 'replace',
    note: 'Re-declares the assembly types of the replaced entries; rewritten with them.',
  },
  'packages/runtime/src/plugin/live/center-shadow-row.mjs': {
    disposition: 'replace',
    note: 'A shadow row over the old assembly; the new binding assembler is its replacement, and it exists only to compensate for the preset-scope resolution problem the provider lane now fixes.',
  },
  'packages/runtime/src/plugin/live/a5sf-realm-row.mjs': {
    disposition: 'replace',
    note: 'Reaches five confined shadows through `new URL(..., import.meta.url)` — a dynamic reference a static scan cannot see. It is the realm mount itself: the new provider-lane realm replaces it wholesale.',
  },
  'packages/tools/test/u7f-ask-port-agent-binding.test.ts': {
    disposition: 'delete-with-group',
    note: 'Exercise of the retired ask port lane; retired with its subject.',
  },
})

const git = (args, cwd = ROOT) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28 }).trim()
const isText = (p) => /\.(mjs|cjs|js|ts|mts|cts|json|ya?ml|md|sh|txt)$/.test(p)
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const bookedNames = (ledger) => [...new Set(ledger.modules.flatMap((m) => m.names ?? []))].sort()

/** The frozen boundary: every path A0 declared deletable, plus the names it covered. */
export function loadFrozen (root = ROOT) {
  const ledger = JSON.parse(readFileSync(join(root, LEDGER_PATH), 'utf8'))
  const ledgerDeleted = new Set(
    ledger.modules.filter((m) => m.verdict === 'delete' || m.verdict === 'replace').flatMap((m) => m.files),
  )
  const snapPath = join(root, SNAPSHOT_PATH)
  if (existsSync(snapPath)) {
    const snap = JSON.parse(readFileSync(snapPath, 'utf8'))
    const snapDeleted = new Set(
      (snap.modules ?? []).filter((m) => m.verdict === 'delete' || m.verdict === 'replace').flatMap((m) => m.files),
    )
    // The snapshot is the attestation. If it and the ledger disagree the assets gate is
    // already red; resolving against the snapshot keeps a deletion from shrinking the target.
    if (snapDeleted.size !== 0) return { deleted: snapDeleted, names: bookedNames(ledger), from: SNAPSHOT_PATH }
  }
  return { deleted: ledgerDeleted, names: bookedNames(ledger), from: LEDGER_PATH }
}

/** Resolve a relative specifier to the candidate repo-relative paths it could denote. */
export function resolveCandidates (fromFile, spec) {
  if (!spec.startsWith('.')) return []
  const base = normalize(join(dirname(fromFile), spec)).replace(/\\/g, '/')
  const stem = base.replace(/\.(mjs|js|mts|ts)$/, '')
  const out = [
    base,
    `${stem}.ts`, `${stem}.mjs`, `${stem}.js`, `${stem}.mts`, `${stem}.d.mts`, `${stem}.json`,
    `${stem}/index.ts`, `${stem}/index.mjs`, `${stem}/index.js`,
  ]
  return [...new Set(out)]
}

/** Convenience: the first candidate that exists right now (unit arms, ad-hoc inspection). */
export function resolveSpecifier (fromFile, spec, root = ROOT) {
  for (const c of resolveCandidates(fromFile, spec)) if (existsSync(join(root, c))) return c
  return null
}

/** Extract module specifiers from one file's text. */
export function specifiersOf (text) {
  const out = new Set()
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /^\s*import\s+['"]([^'"]+)['"]/gm, // side-effect import: no `from`, still a reference
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /new\s+URL\s*\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url\s*\)/g,
  ]
  for (const re of patterns) for (const m of text.matchAll(re)) out.add(m[1])
  return [...out]
}

const isTestPath = (file) =>
  file.startsWith('tests/') ||
  file.startsWith('dev/agent-workflow/evidence/') ||
  /(^|\/)(test|__tests__|tests)\//.test(file) ||
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(file)

const classOf = (file) => {
  if (file.startsWith('packages/') && file.includes('/dist/')) return 'dist'
  // Role, not directory: a test file that happens to live under a package is a test, and a
  // test is never silently exempt — see the registration requirement in --check.
  if (isTestPath(file)) return 'test'
  if (file.startsWith('packages/') || file.startsWith('apps/')) return 'production'
  if (file.startsWith('scripts/') || file.startsWith('dev/ci/')) return 'tooling'
  return 'other'
}

/**
 * The committed disposition registry. It lives in a file, not only in this script, so that a
 * reviewer can see every surviving production reference and its fate in one diff, and so that
 * a checkout other than this one (the negative-control repos in the tests) can declare its own.
 */
export function loadDispositions (root = ROOT) {
  const p = join(root, DISPOSITIONS_PATH)
  if (!existsSync(p)) return DISPOSITIONS
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  const out = {}
  for (const [path, d] of Object.entries(raw.entries ?? {})) out[path] = d
  return out
}

/** Committed exemption registry: exact paths, each with a reason and a subject. */
export function loadExemptions (root = ROOT) {
  const p = join(root, EXEMPTIONS_PATH)
  if (!existsSync(p)) return new Map()
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  const m = new Map()
  for (const e of raw.entries ?? []) m.set(e.path, e)
  return m
}

// ─────────────────────────────────────────── A0 retired surfaces (round 80)
/**
 * THE SUBJECT-LEVEL RETIREMENT RECORD. Round 72 recorded retired *suites* per file
 * (`retiredSubjects`); A0 also retired whole SURFACES that four instruments still graded
 * (the Family Contribution census arm, the UTE-3 inventory, the family-lane boundary law and
 * the per-tool acceptance claim set). Those instruments cannot be repaired by editing the
 * old modules back into the tree, and they cannot be silenced: each surface needs a per-subject
 * disposition that says (a) WHAT was retired, (b) the FROZEN evidence that licenses it, and
 * (c) WHICH successor carries the guarantee now.
 *
 * This is a LICENCE, not a silence. `validateRetiredSurfaces` refuses:
 *   A0_RETIRED_SCHEMA             the record is missing a schema/frozenTree/subjects
 *   A0_RETIRED_TREE_UNKNOWN       `frozenTree` is not a commit object in this checkout
 *   A0_RETIRED_SUBJECT_INVALID    a row lacks id/kind/disposition, or repeats an id
 *   A0_RETIRED_KIND_UNKNOWN       a `kind` outside the closed set
 *   A0_RETIRED_MODULE_UNKNOWN     a `frozenModules` id is not in the A0 snapshot
 *   A0_RETIRED_MODULE_NOT_CUT     a named module is `keep` — a keep module can never retire a surface
 *   A0_RETIRED_CITATION_UNTRACKED a cited path is not a tracked file (the citation must be auditable)
 *   A0_RETIRED_SUCCESSOR_MISSING  a named successor path is not tracked (the handoff must be real)
 *
 * The surface itself (which files the subject owned) is NOT copied here: it is derived from the
 * ledgers that recorded it, and each consumer grades it against the frozen set + the tree. A
 * surface whose files reappear is a resurrection finding in the consumer, never a retirer.
 */
export const RETIRED_SURFACES_KEY = 'retiredSurfaces'
export const RETIRED_SURFACES_SCHEMA = 'ute-a0-retired-surfaces/1'
export const RETIRED_SUBJECT_KINDS = Object.freeze([
  'family-contribution',
  'test-only-family-lane',
  'tool-acceptance-claims',
  'family-lane-edges',
  'family-inventory-records',
])

/** Read the retirement record out of the allow ledger. Absent is `null` (data, not an exemption). */
export function loadRetiredSurfaces (root = ROOT) {
  const p = join(root, EXEMPTIONS_PATH)
  if (!existsSync(p)) return null
  const raw = JSON.parse(readFileSync(p, 'utf8'))
  const record = raw[RETIRED_SURFACES_KEY]
  return record === undefined ? null : record
}

/** Tracked paths that look like a repo path (a successor may also be a command starting with `node`). */
const SUCCESSOR_PATH_RE = /^(scripts|tests|packages|apps|dev|docs)\S*$/

/**
 * Validate the retirement record against the frozen snapshot, the git index and the docs.
 * Returns `{ findings, subjects }`; `subjects` is the id → row map a consumer filters by.
 */
export function validateRetiredSurfaces ({ record, root = ROOT, trackedPaths } = {}) {
  const findings = []
  const subjects = new Map()
  const add = (code, detail) => findings.push({ code, detail })
  if (record === null || typeof record !== 'object') {
    add('A0_RETIRED_SCHEMA', `the A0 retirement record is absent from ${EXEMPTIONS_PATH} — a surface that was retired must still be booked, or its instrument is either silent or red`)
    return { findings, subjects }
  }
  if (record.schema !== RETIRED_SURFACES_SCHEMA) {
    add('A0_RETIRED_SCHEMA', `schema is ${JSON.stringify(record.schema)}, expected ${JSON.stringify(RETIRED_SURFACES_SCHEMA)}`)
    return { findings, subjects }
  }
  const tracked = trackedPaths ?? new Set(git(['ls-files'], root).split('\n').filter(Boolean))
  const commitExists = (rev) => {
    try {
      execFileSync('git', ['-C', root, 'cat-file', '-e', `${rev}^{commit}`], { stdio: ['ignore', 'ignore', 'ignore'] })
      return true
    } catch { return false }
  }
  if (typeof record.frozenTree !== 'string' || !/^[0-9a-f]{40}$/.test(record.frozenTree) || !commitExists(record.frozenTree)) {
    add('A0_RETIRED_TREE_UNKNOWN', `frozenTree ${JSON.stringify(record.frozenTree)} is not a 40-hex commit present in this checkout — the frozen claim set / fixture tree cannot be read`)
  }
  let snapshot = null
  const snapPath = join(root, SNAPSHOT_PATH)
  if (existsSync(snapPath)) snapshot = JSON.parse(readFileSync(snapPath, 'utf8'))
  const moduleById = new Map((snapshot?.modules ?? []).map((m) => [m.id, m]))
  const subjectsRaw = record.subjects
  if (!Array.isArray(subjectsRaw) || subjectsRaw.length === 0) {
    add('A0_RETIRED_SCHEMA', '`subjects` must be a non-empty array — an empty record retires nothing and cannot be validated')
    return { findings, subjects }
  }
  for (const row of subjectsRaw) {
    const id = row?.id
    if (typeof id !== 'string' || id.length === 0 || row?.disposition !== 'retired-by-a0-cut') {
      add('A0_RETIRED_SUBJECT_INVALID', `a subject row needs a non-empty id and disposition "retired-by-a0-cut": ${JSON.stringify(row)?.slice(0, 160)}`)
      continue
    }
    if (subjects.has(id)) {
      add('A0_RETIRED_SUBJECT_INVALID', `subject ${JSON.stringify(id)} is booked twice`)
      continue
    }
    subjects.set(id, row)
    if (!RETIRED_SUBJECT_KINDS.includes(row.kind)) {
      add('A0_RETIRED_KIND_UNKNOWN', `subject ${id}: kind ${JSON.stringify(row.kind)} is not one of ${RETIRED_SUBJECT_KINDS.join('|')}`)
    }
    if (!Array.isArray(row.frozenModules) || row.frozenModules.length === 0) {
      add('A0_RETIRED_SUBJECT_INVALID', `subject ${id}: \`frozenModules\` must name at least one A0 snapshot module — a retirement with no frozen evidence is an assertion`)
    } else {
      for (const mid of row.frozenModules) {
        const mod = moduleById.get(mid)
        if (mod === undefined) add('A0_RETIRED_MODULE_UNKNOWN', `subject ${id}: frozen module ${JSON.stringify(mid)} is not in ${SNAPSHOT_PATH}`)
        else if (mod.verdict !== 'delete' && mod.verdict !== 'replace') add('A0_RETIRED_MODULE_NOT_CUT', `subject ${id}: frozen module ${JSON.stringify(mid)} is verdict=${JSON.stringify(mod.verdict)} — only a delete/replace module can license a retirement`)
      }
    }
    if (!Array.isArray(row.citations) || row.citations.length === 0) {
      add('A0_RETIRED_SUBJECT_INVALID', `subject ${id}: at least one citation is required`)
    } else {
      for (const citation of row.citations) {
        if (citation === null || typeof citation !== 'object' || typeof citation.path !== 'string' || citation.path.length === 0) {
          add('A0_RETIRED_SUBJECT_INVALID', `subject ${id}: a citation is \`{ "path": <tracked file>, "note": <why> }\`, got ${JSON.stringify(citation)}`)
          continue
        }
        if (!tracked.has(citation.path)) add('A0_RETIRED_CITATION_UNTRACKED', `subject ${id}: citation path ${JSON.stringify(citation.path)} is not a tracked file`)
      }
    }
    if (!Array.isArray(row.successors) || row.successors.length === 0) {
      add('A0_RETIRED_SUBJECT_INVALID', `subject ${id}: at least one successor is required — where the guarantee lives now`)
    } else {
      for (const successor of row.successors) {
        const trimmed = String(successor).trim()
        const path = trimmed.startsWith('node ') ? trimmed.split(/\s+/)[1] : trimmed.split(/\s+/)[0]
        if (!SUCCESSOR_PATH_RE.test(path) || !tracked.has(path)) {
          add('A0_RETIRED_SUCCESSOR_MISSING', `subject ${id}: successor ${JSON.stringify(successor)} does not name a tracked file (${path})`)
        }
      }
    }
  }
  return { findings, subjects }
}

/** Is a committed dist artifact the build output of a deleted source? */
export function distCounterpartsOf (source) {
  const m = /^packages\/([^/]+)\/(.+)$/.exec(source)
  if (m === null) return []
  const [, pkg, rest] = m
  if (rest.startsWith('dist/')) return []
  const stem = rest.replace(/\.(ts|mts|tsx|mjs)$/, '')
  const dir = `packages/${pkg}/dist/packages/${pkg}/${stem}`
  return [`${dir}.js`, `${dir}.d.ts`, `${dir}.js.map`, `${dir}.d.ts.map`]
}

/**
 * Static pre-filter for duplicate model-visible declarations. The authoritative check is the
 * binding assembler's refusal at B; A1 should still not ship a realm where a booked name has
 * two declarants, so this counts surviving files that define a tool AND name it.
 */
export function duplicateDeclarants (root, names) {
  const tracked = git(['ls-files'], root).split('\n').filter(Boolean)
  const counts = new Map()
  for (const file of tracked) {
    if (!isText(file)) continue
    // Production only. Test files mention booked names inside fixtures and expectations, and
    // evidence files quote PR bodies; counting those as declarants would make the arm noise.
    if (classOf(file) !== 'production') continue
    let text
    try { text = readFileSync(join(root, file), 'utf8') } catch { continue }
    if (!/\bdefineTool\s*\(|\bToolDefinition\b/.test(text)) continue
    for (const n of names) {
      if (new RegExp(`name:\\s*['"\`]${esc(n)}['"\`]`).test(text)) {
        counts.set(n, [...(counts.get(n) ?? []), file])
      }
    }
  }
  return [...counts].filter(([, files]) => files.length > 1).map(([name, files]) => ({ name, files }))
}

export function deriveClosure ({ root = ROOT } = {}) {
  const frozen = loadFrozen(root)
  const exemptions = loadExemptions(root)
  const tracked = git(['ls-files'], root).split('\n').filter(Boolean)
  const findings = []
  for (const file of tracked) {
    if (!isText(file)) continue
    if (frozen.deleted.has(file)) continue // goes with the cut
    if (classOf(file) === 'dist') continue // the dist arm below covers it
    let text
    try { text = readFileSync(join(root, file), 'utf8') } catch { continue }
    for (const spec of specifiersOf(text)) {
      const target = resolveCandidates(file, spec).find((c) => frozen.deleted.has(c))
      if (target === undefined) continue
      const exempt = exemptions.get(file)
      findings.push({
        referrer: file,
        target,
        spec,
        class: classOf(file),
        ...(exempt === undefined ? {} : { exemptBy: exempt.reason }),
      })
    }
  }
  // A NAME-CLASS reference a specifier scan cannot see (round 58): a retired module can still be named by
  // path in the package's `exports` map or as a preset row's plugin `name`, and that reference is invisible
  // to every `import`/`require` scan while it makes the product UNLOADABLE (WorldFactory refused EVERY world
  // with A5SF_PROFILE_GRAPH_UNRESOLVED while this gate stayed green). Same law, wider net: a retired file
  // must not be reachable by NAME either.
  const namedRefs = []
  const nameCarriers = ['package.json', 'cordis.patch.yml']
  for (const carrier of nameCarriers) {
    if (!tracked.includes(carrier)) continue
    let text
    try { text = readFileSync(join(root, carrier), 'utf8') } catch { continue }
    for (const source of frozen.deleted) {
      const bare = source.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // STRUCTURAL references only, never prose: a comment that explains the retirement must be free to NAME
      // the retired file (round 58: the first version flagged its own explanation). `exports` maps carry a
      // quoted path; a preset row carries `name: '<pkg>/<file>'`.
      // the `/` before the file name is required: `a5sf-web-transport.mjs` must NOT satisfy a reference to
      // the retired `web-transport.mjs` (measured false positive, round 58).
      const pattern = carrier === 'package.json'
        ? new RegExp(`"["]?[^"]*/${bare}"`)
        : new RegExp(`name:\\s*'[^']*/${bare}'`)
      if (pattern.test(text)) namedRefs.push({ referrer: carrier, target: source })
    }
  }
  const distResiduals = []
  for (const source of frozen.deleted) {
    for (const d of distCounterpartsOf(source)) {
      if (tracked.includes(d)) distResiduals.push({ source, artifact: d })
    }
  }
  const onDisk = [...frozen.deleted].filter((f) => existsSync(join(root, f)))
  // pending: nothing deleted yet; cut: everything gone; partial: in between (a named RED).
  const state = onDisk.length === frozen.deleted.size ? 'pending' : onDisk.length === 0 ? 'cut' : 'partial'
  return {
    frozenFrom: frozen.from,
    deletedCount: frozen.deleted.size,
    findings,
    namedRefs,
    distResiduals,
    cut: {
      state,
      retiredSourcesOnDisk: onDisk.length,
      survivingProductionRefs: findings.filter((f) => f.class === 'production').length,
      retiredDistArtifacts: distResiduals.length,
      duplicateDeclarants: duplicateDeclarants(root, frozen.names),
    },
  }
}

const groupOf = (f) => {
  if (f.class === 'production') return 'production'
  if (f.class === 'tooling') return 'tooling'
  return f.exemptBy === undefined ? 'exempt:UNREGISTERED' : 'exempt'
}

const summarise = (findings) => {
  const g = new Map()
  for (const f of findings) {
    const k = groupOf(f)
    if (!g.has(k)) g.set(k, [])
    g.get(k).push(f)
  }
  return [...g].sort((a, b) => b[1].length - a[1].length)
}

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (!isMain) {
  // importable: tests use the exported derivations
} else {
  const argv = process.argv.slice(2)
  const rootArg = argv.indexOf('--root')
  const root = rootArg === -1 ? ROOT : resolve(argv[rootArg + 1])
  const out = deriveClosure({ root })
  const reportPath = join(root, REPORT_PATH)

  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify(out, null, 2) + '\n')
    process.exit(0)
  }
  if (argv.includes('--write')) {
    writeFileSync(reportPath, JSON.stringify({
      schema: 'ute-cut-closure/1',
      derivedFrom: 'textual specifier resolution vs the FROZEN A0 delete set',
      frozenFrom: out.frozenFrom,
      deletedCount: out.deletedCount,
      groups: summarise(out.findings).map(([k, v]) => ({ group: k, count: v.length, referrers: [...new Set(v.map((x) => x.referrer))].sort() })),
      dispositions: loadDispositions(root),
      distResiduals: out.distResiduals,
      cut: { state: out.cut.state, retiredSourcesOnDisk: out.cut.retiredSourcesOnDisk },
    }, null, 2) + '\n')
    console.log(
      `UTE-CUT-CLOSURE write deleted=${out.deletedCount} references=${out.findings.length} ` +
      `distResiduals=${out.distResiduals.length} cut=${out.cut.state} dupNames=${out.cut.duplicateDeclarants.length}`,
    )
    process.exit(0)
  }
  if (!argv.includes('--check')) {
    console.error('usage: node scripts/ute-cut-closure.mjs --check|--write|--json [--root <dir>]')
    process.exit(2)
  }

  const findings = []
  // THE SUBJECT-LEVEL RETIREMENT RECORD (round 80). Validated here because this check is the one
  // that owns the allow ledger; the consumers (family definitions / inventory / tool acceptance)
  // import the same loader, so a row cannot mean one thing to one gate and another to the next.
  // Validated when PRESENT: a record that exists must be earned. When it is ABSENT this
  // check stays silent (planted ute-cut-closure fixtures carry a minimal allow ledger);
  // absence is refused by the CONSUMERS, which cannot grade a retired surface without it
  // (scripts/eb3-family-definitions.mjs, scripts/eb3-tool-acceptance.mjs, scripts/ute-family-inventory.mjs).
  const retiredRecord = loadRetiredSurfaces(root)
  const retiredValidation = retiredRecord === null
    ? { findings: [], subjects: new Map() }
    : validateRetiredSurfaces({ record: retiredRecord, root })
  findings.push(...retiredValidation.findings)
  if (!existsSync(reportPath)) {
    findings.push({ code: 'UTE_CLOSURE_REPORT_MISSING', detail: `${REPORT_PATH} is missing — run --write` })
  } else {
    const committed = JSON.parse(readFileSync(reportPath, 'utf8'))
    const fresh = summarise(out.findings).map(([k, v]) => ({ group: k, count: v.length }))
    const stored = (committed.groups ?? []).map(({ group: k, count }) => ({ group: k, count }))
    if (JSON.stringify(fresh) !== JSON.stringify(stored)) {
      findings.push({ code: 'UTE_CLOSURE_STALE', detail: `closure report drifted: stored ${JSON.stringify(stored)} fresh ${JSON.stringify(fresh)}` })
    }
    if (out.namedRefs.length > 0) {
      findings.push({ code: 'UTE_CLOSURE_NAMED_REF', detail: `a retired file is still reachable by NAME: ${out.namedRefs.map((r) => `${r.referrer} -> ${r.target}`).join(', ')}` })
    }
    if ((committed.distResiduals ?? []).length !== out.distResiduals.length) {
      findings.push({ code: 'UTE_CLOSURE_DIST_STALE', detail: `dist residuals stored ${committed.distResiduals?.length} fresh ${out.distResiduals.length}` })
    }
  }

  // THE BUILD'S OWN INPUTS. A cut that moves the production entry must move everything that NAMES it,
  // or `place-dist-glue` dies on a missing source and the product cannot be built at all - while every
  // source-tree test stays green, which is precisely how this went unnoticed once (2026-11-22: 99 of
  // 119 placement sources were files the cut had already deleted, and the glue path still pointed at
  // packages/runtime/src/plugin/live/agent-bindings.mjs).
  // The module EVALUATES its list at import time, and the loader refuses a list whose first entry is
  // not the glue — so a moved entry surfaces as a THROW from the import itself. That is still a
  // finding, not a crash: a gate that dies with a stack trace tells the operator nothing about which
  // invariant broke.
  // THE BUILD FACE BELONGS TO THE REPOSITORY THAT DECLARES IT. place-dist-glue's placement
  // list and GLUE_SRC describe THIS product's shipped face; grading a `--root` fixture with
  // them reported every real placement source as missing in a tree that never declared one
  // (three stale controls, round 80). A foreign root has no build face to grade, and the
  // summary says so instead of quietly passing: `placements=self|fixture`.
  const placementsSelf = resolve(root) === resolve(ROOT)
  let placementLoader
  let placements = []
  if (placementsSelf) {
    try {
      placementLoader = await import('./place-dist-glue.mjs')
      placements = placementLoader.loadPlacements()
    } catch (error) {
      findings.push({ code: 'UTE_CLOSURE_DIST_PLACEMENTS_UNREADABLE', detail: `the dist placement list cannot be loaded: ${error instanceof Error ? error.message : String(error)}` })
    }
    if (placementLoader !== undefined && !existsSync(join(root, placementLoader.GLUE_SRC))) {
      findings.push({ code: 'UTE_CLOSURE_GLUE_PATH', detail: `place-dist-glue's GLUE_SRC ${placementLoader.GLUE_SRC} does not exist — the production entry moved and the build was not told` })
    }
    for (const placement of placements) {
      if (!existsSync(join(root, placement.src))) {
        findings.push({ code: 'UTE_CLOSURE_DIST_PLACEMENT_MISSING', detail: `${placement.src} is a declared dist placement but does not exist; place-dist-glue cannot build the shipped face from it` })
      }
    }
  }

  // Every non-production referrer must be REGISTERED by path. A directory is not a reason.
  const exemptions = loadExemptions(root)
  for (const f of out.findings) {
    if (f.class === 'production' || f.class === 'tooling') continue
    if (!exemptions.has(f.referrer)) {
      findings.push({ code: 'UTE_CLOSURE_UNREGISTERED_EXEMPTION', detail: `${f.referrer} refers to ${f.target} but is not registered in ${EXEMPTIONS_PATH}` })
    }
  }
  const used = new Set(out.findings.map((f) => f.referrer))
  for (const path of exemptions.keys()) {
    if (!used.has(path)) findings.push({ code: 'UTE_CLOSURE_STALE_EXEMPTION', detail: `${path} is registered but no longer refers to the delete set — remove it` })
  }
  const dispositions = loadDispositions(root)
  for (const referrer of [...new Set(out.findings.filter((f) => f.class === 'production').map((f) => f.referrer))].sort()) {
    const d = dispositions[referrer]
    if (d === undefined) {
      findings.push({ code: 'UTE_CLOSURE_UNDISPOSED', detail: `${referrer} references the delete set but has no disposition (rewire | replace | delete-with-group + a note)` })
    } else if (!['rewire', 'replace', 'delete-with-group'].includes(d.disposition) || typeof d.note !== 'string' || d.note.length < 40) {
      findings.push({ code: 'UTE_CLOSURE_WEAK_DISPOSITION', detail: `${referrer}: a disposition needs rewire|replace|delete-with-group and a real note` })
    }
  }

  // Cut completion: four zeros — but only once the cut has started. `pending` is a legitimate
  // state (A0 freezes the plan); `partial` is a named RED, because a half-cut realm declares
  // every name twice.
  const { cut } = out
  if (cut.state === 'partial') {
    findings.push({
      code: 'UTE_CLOSURE_PARTIAL',
      detail: `half-cut: ${cut.retiredSourcesOnDisk} retired source(s) still on disk — a half-cut realm declares names twice`,
    })
  }
  if (cut.state === 'cut') {
    if (cut.retiredSourcesOnDisk !== 0) findings.push({ code: 'UTE_CLOSURE_RETIRED_SOURCE', detail: `${cut.retiredSourcesOnDisk} retired source(s) still on disk` })
    if (cut.survivingProductionRefs !== 0) findings.push({ code: 'UTE_CLOSURE_PRODUCTION_REF', detail: `${cut.survivingProductionRefs} production reference(s) still resolve into the delete set` })
    if (cut.retiredDistArtifacts !== 0) findings.push({ code: 'UTE_CLOSURE_DIST_ARTIFACT', detail: `${cut.retiredDistArtifacts} committed dist artifact(s) still ship a retired source` })
    if (cut.duplicateDeclarants.length !== 0) {
      findings.push({ code: 'UTE_CLOSURE_DUPLICATE_DECLARANT', detail: cut.duplicateDeclarants.map((d) => `${d.name}: ${d.files.join(', ')}`).join(' | ') })
    }
  }

  for (const f of findings) console.error(`${f.code} ${f.detail}`)
  console.log(
    `UTE-CUT-CLOSURE ${findings.length === 0 ? 'pass' : 'fail'} deleted=${out.deletedCount} references=${out.findings.length} ` +
    `prodRefs=${cut.survivingProductionRefs} distResiduals=${out.distResiduals.length} ` +
    `cut=${cut.state}(${cut.retiredSourcesOnDisk}/${out.deletedCount}) dupNames=${cut.duplicateDeclarants.length} ` +
    `retiredSurfaces=${retiredRecord === null ? 'absent' : String(retiredValidation.subjects.size)} ` +
    `placements=${placementsSelf ? 'self' : 'fixture'} findings=${findings.length}`,
  )
  process.exit(findings.length === 0 ? 0 : 1)
}
