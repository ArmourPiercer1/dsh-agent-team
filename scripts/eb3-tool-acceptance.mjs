#!/usr/bin/env node
/**
 * eb3-tool-acceptance.mjs — the per-tool four-level acceptance ledger checker.
 *
 * WHY. PR #404 merged with its live C2 RUN record at `overall: FAIL` (3 PASS /
 * 3 FAIL: u7f:inspect-list, u7f:refusal-zero-effect, u7f:approval-leg) while
 * every CI layer was green. Nothing machine-checked separated "the Definition
 * passes" from "the real positive effect ran on a Host". This file makes that
 * separation a per-tool ledger the merge gate reads:
 *
 *   dev/agent-workflow/ledgers/u7-tool-acceptance.json  (schema u7-tool-acceptance/1)
 *
 * One row per model-visible tool name claimed by a family in
 * packages/tools/families/manifest.json, plus the named-bridge jobs trio. Each
 * row carries four levels — L1-definition, L2-mounted, L3-refusal,
 * L4-positive — each PROVEN | DISCLOSED | NOT_VERIFIED.
 *
 * WHAT IS REFUSED (merge gate = the ledger is HONEST):
 *   ACCEPT_ROW_MISSING          a claimed tool has no row
 *   ACCEPT_ROW_DUPLICATE        a claimed tool has more than one row
 *   ACCEPT_ROW_STALE            a row names a tool no family claims
 *   ACCEPT_ROW_FAMILY_MISMATCH  a row's familyId is not the claiming family
 *   ACCEPT_PROVEN_UNBACKED      a PROVEN L2-L4 whose record is absent, untracked,
 *                               unparseable, not a finalised u5-run-record/1
 *                               (overall + finishedAt), or whose case is absent or
 *                               not PASS; a PROVEN L1 whose suite is absent or does
 *                               not name the tool
 *   ACCEPT_DISCLOSED_UNREASONED a DISCLOSED level with an empty reason or no `#N` pr
 *   ACCEPT_DISCLOSED_UNSOURCED  a DISCLOSED level whose `source` does not contain the
 *                               reason verbatim (whitespace-normalised: a prose file
 *                               wraps a sentence across lines, and the WORDS are what
 *                               must be verbatim, not the author's line breaks)
 *   ACCEPT_SCHEMA               wrong schema, unknown status, missing level
 *
 * WHAT IS NOT REFUSED: DISCLOSED and NOT_VERIFIED. Honesty is enforced at merge;
 * completeness (every L4 PROVEN) is the G5 release gate, not a CI colour.
 *
 * THE CLAIM SET IS READ STATICALLY. The descriptors import family lanes that
 * import the BUILT controlled-fs (`packages/runtime/controlled-fs/src/index.js`),
 * which the host-free ci-integration layer does not build. Importing them would
 * make this leg depend on build order; instead each descriptor's
 * `claims: (cap) => [ … ]` array is resolved token by token: string literals,
 * identifiers bound to a string / frozen string array literal in the descriptor
 * or in a module it imports (bounded alias/import hops), and the two
 * CONFIGURABLE spellings. A configurable spelling (`cap.readName`,
 * `cap.names.<k>`) is not one name: it is every spelling the plane's Gate 0b
 * (`verifyPlaneNames`) can admit for that class without a source change — the
 * DEFAULT_PLANE_NAMES alias PLUS every native takeover the
 * PLANE_SUPPORTED_NATIVE_TAKEOVERS ledger records for that class. So
 * `cap.names.bash` claims both `team_bash` and `bash` (the background-jobs
 * worlds mount the native spelling), and a future takeover booked in that
 * ledger adds its row requirement here automatically. Any other free-form
 * alias a config could pick is not reserved and not enumerable; the rows track
 * every spelling the tree itself can name. A token that does not resolve is a
 * could-not-grade refusal (exit 2), never a silently shorter claim set.
 *
 * WHY SOURCE AND NOT THE DIST MIRROR. `packages/runtime/dist/packages/tools/
 * families/*` imports cleanly, but its parity with src is graded only by the
 * non-Required pr-gate artifacts leg; the src descriptors are what the manifest
 * digests pin and what reviewers read. Every manifest entry is enumerated, so a
 * new family cannot be missed; a descriptor whose claims stop being statically
 * readable refuses (exit 2) instead of shrinking the set.
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs:
 *   checkToolAcceptance({ ledger, claims, readFile, isTracked }) → { findings, counts }
 *   readClaims(root), loadLedger(root), LEDGER_REL, LEVELS
 *
 *   node scripts/eb3-tool-acceptance.mjs [--json]
 *
 * Exit: 0 honest | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-tool-acceptance
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const LEDGER_REL = 'dev/agent-workflow/ledgers/u7-tool-acceptance.json'
export const LEDGER_SCHEMA = 'u7-tool-acceptance/1'
export const LEVELS = Object.freeze(['L1-definition', 'L2-mounted', 'L3-refusal', 'L4-positive'])
export const STATUSES = Object.freeze(['PROVEN', 'DISCLOSED', 'NOT_VERIFIED'])
const FAMILIES_DIR = 'packages/tools/families'
const PLANE_REL = 'packages/runtime/src/plugin/live/team-tool-plane.mjs'
/** The named bridges whose rows are model-visible but not FamilyAssembly claims. */
export const NAMED_BRIDGES = Object.freeze([
  { rel: 'packages/runtime/src/plugin/live/jobs-family-bridge.mjs', namesConst: 'JOBS_MANAGEMENT_NAMES' },
])

// ─────────────────────────────────────────────────────────── static claim reader
const STR = /^\s*(['"])([^'"\\]*)\1\s*$/

/** `const|export const NAME = <rhs>` → rhs text (up to the matching end), or null. */
function constRhs(text, name) {
  const m = new RegExp(`(?:^|\\n)\\s*(?:export\\s+)?const\\s+${name}\\s*=\\s*`).exec(text)
  if (m === null) return null
  const start = m.index + m[0].length
  if (text.startsWith('Object.freeze(', start) || text[start] === '[') {
    const open = text.indexOf('[', start)
    const close = text.indexOf(']', open)
    return close === -1 ? null : text.slice(start, close + 1) + (text.startsWith('Object.freeze(', start) ? ')' : '')
  }
  const end = text.indexOf('\n', start)
  return text.slice(start, end === -1 ? undefined : end).trim()
}

/** Imported bindings of a module: name → resolved repo-relative path. */
function importsOf(text, fromRel) {
  const out = new Map()
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const target = join(dirname(fromRel), m[2]).split('\\').join('/')
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/)
      if (orig) out.set((alias ?? orig).trim(), { rel: target, name: orig.trim() })
    }
  }
  for (const m of text.matchAll(/export\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)) {
    const target = join(dirname(fromRel), m[2]).split('\\').join('/')
    for (const part of m[1].split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/)
      if (orig) out.set((alias ?? orig).trim(), { rel: target, name: orig.trim() })
    }
  }
  return out
}

/** Resolve an identifier to string[] by following const/alias/import (bounded). */
function resolveIdent(read, rel, name, depth = 0) {
  if (depth > 6) throw new Error(`claim identifier ${name} did not resolve within 6 hops (from ${rel})`)
  const text = read(rel)
  if (text === null) throw new Error(`claim identifier ${name}: module ${rel} is absent`)
  const rhs = constRhs(text, name)
  if (rhs !== null) {
    const s = STR.exec(rhs)
    if (s !== null) return [s[2]]
    const arr = /^(?:Object\.freeze\(\s*)?\[([\s\S]*)\]\s*\)?\s*$/.exec(rhs)
    if (arr !== null) return parseList(read, rel, arr[1], depth + 1)
    if (/^[A-Za-z_$][\w$]*$/.test(rhs)) return resolveIdent(read, rel, rhs, depth + 1)
    throw new Error(`claim identifier ${name} in ${rel} is bound to a non-literal (${rhs.slice(0, 60)})`)
  }
  const imp = importsOf(text, rel).get(name)
  if (imp !== undefined) return resolveIdent(read, imp.rel, imp.name, depth + 1)
  throw new Error(`claim identifier ${name} is neither a const nor an import in ${rel}`)
}

function parseList(read, rel, body, depth, cap = null) {
  const out = []
  for (const raw of body.split(',').map((t) => t.trim()).filter(Boolean)) {
    const tok = raw.replace(/^\.\.\./, '')
    const s = STR.exec(tok)
    if (s !== null) { out.push(s[2]); continue }
    if (tok === 'cap.readName') {
      if (cap === null) throw new Error('cap.readName outside a claims body')
      out.push(...new Set([cap.readName, ...(cap.takeovers.read ?? [])]))
      continue
    }
    const nm = /^cap\.names\.([A-Za-z_$][\w$]*)$/.exec(tok)
    if (nm !== null) {
      const v = cap?.names?.[nm[1]]
      if (typeof v !== 'string') throw new Error(`${rel}: cap.names.${nm[1]} has no plane default`)
      out.push(...new Set([v, ...(cap.takeovers[nm[1]] ?? [])]))
      continue
    }
    if (/^[A-Za-z_$][\w$]*$/.test(tok)) { out.push(...resolveIdent(read, rel, tok, depth)); continue }
    throw new Error(`${rel}: claim token \`${tok}\` is not statically readable`)
  }
  return out
}

/** The plane defaults the claims are read under (the mount the C2 worlds run). */
function planeDefaults(read) {
  const text = read(PLANE_REL)
  if (text === null) throw new Error(`${PLANE_REL} is absent`)
  const m = /DEFAULT_PLANE_NAMES\s*=\s*Object\.freeze\(\{([^}]*)\}\)/.exec(text)
  if (m === null) throw new Error(`${PLANE_REL}: DEFAULT_PLANE_NAMES literal not found`)
  const names = {}
  for (const p of m[1].matchAll(/([A-Za-z_$][\w$]*)\s*:\s*'([^']+)'/g)) names[p[1]] = p[2]
  const rn = /const readName = input\.plane\?\.readName \?\? '([^']+)'/.exec(text)
  if (rn === null) throw new Error(`${PLANE_REL}: the readName default literal was not found`)
  // The native-takeover ledger for the CONFIGURABLE classes (Gate 0b's closed
  // domain: grep/glob/bash + read). Each must be present as a literal array.
  const ledgerAt = text.indexOf('PLANE_SUPPORTED_NATIVE_TAKEOVERS = Object.freeze({')
  if (ledgerAt === -1) throw new Error(`${PLANE_REL}: PLANE_SUPPORTED_NATIVE_TAKEOVERS literal not found`)
  const block = text.slice(ledgerAt)
  const takeovers = {}
  for (const k of ['grep', 'glob', 'bash', 'read']) {
    const m2 = new RegExp(`\\n\\s*${k}:\\s*Object\\.freeze\\(\\[([^\\]]*)\\]\\)`).exec(block)
    if (m2 === null) throw new Error(`${PLANE_REL}: PLANE_SUPPORTED_NATIVE_TAKEOVERS.${k} is not a literal array`)
    takeovers[k] = [...m2[1].matchAll(/'([^']+)'/g)].map((x) => x[1])
  }
  return { readName: rn[1], names, takeovers }
}

/**
 * The claim set: Map tool → { familyId, source }.
 * @param {(rel:string)=>string|null} read
 */
export function readClaimsWith(read) {
  const manifest = JSON.parse(read(`${FAMILIES_DIR}/manifest.json`) ?? 'null')
  if (manifest === null || !Array.isArray(manifest.families)) throw new Error(`${FAMILIES_DIR}/manifest.json is absent or has no families[]`)
  const cap = planeDefaults(read)
  const claims = new Map()
  const add = (tool, familyId, source) => {
    if (claims.has(tool)) throw new Error(`tool ${tool} is claimed twice (${claims.get(tool).source} and ${source})`)
    claims.set(tool, { familyId, source })
  }
  for (const f of manifest.families) {
    const rel = `${FAMILIES_DIR}/${f.module}`
    const text = read(rel)
    if (text === null) throw new Error(`manifest family ${rel} is absent`)
    const fid = [...text.matchAll(/^\s*familyId:\s*'([^']+)'/gm)].map((m) => m[1])
    if (fid.length !== 1) throw new Error(`${rel}: expected exactly one literal familyId, found ${fid.length}`)
    const cm = /^\s*claims:\s*\([^)]*\)\s*=>\s*\[([^\]]*)\]/m.exec(text)
    if (cm === null) throw new Error(`${rel}: no \`claims: (…) => [ … ]\` array literal`)
    for (const t of parseList(read, rel, cm[1], 0, cap)) add(t, fid[0], rel)
  }
  for (const b of NAMED_BRIDGES) {
    const text = read(b.rel)
    if (text === null) throw new Error(`named bridge ${b.rel} is absent`)
    const fid = [...text.matchAll(/^\s*familyId:\s*'([^']+)'/gm)].map((m) => m[1])
    if (fid.length !== 1) throw new Error(`${b.rel}: expected exactly one literal familyId, found ${fid.length}`)
    for (const t of resolveIdent(read, b.rel, b.namesConst)) add(t, fid[0], b.rel)
  }
  return claims
}

/** Verbatim, line-wrapping forgiven: the WORDS must match, the source's line breaks
 *  are its own formatting. Any other difference (a re-worded quote) still fails. */
export function containsVerbatim(haystack, needle) {
  if (haystack.includes(needle)) return true
  return normalizeSpace(haystack).includes(normalizeSpace(needle))
}
const normalizeSpace = (t) => String(t).replace(/\s+/g, ' ').trim()

const diskReader = (root) => (rel) => {
  const abs = join(root, rel)
  return existsSync(abs) ? readFileSync(abs, 'utf8') : null
}
export const readClaims = (root = ROOT) => readClaimsWith(diskReader(root))
export const loadLedger = (root = ROOT) => JSON.parse(readFileSync(join(root, LEDGER_REL), 'utf8'))

/** Tracked = in the git index (a PROVEN level must cite a COMMITTED record). */
export function trackedSet(root = ROOT) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z', 'dev/agent-workflow/evidence', 'packages', 'tests'], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
  return new Set(out.split('\0').filter(Boolean))
}

// ─────────────────────────────────────────────────────────────────── the check
/**
 * @param {object} p
 * @param {object} p.ledger                         the parsed ledger
 * @param {Map<string,{familyId:string}>} p.claims  readClaims()
 * @param {(rel:string)=>string|null} p.readFile    repo-relative read
 * @param {(rel:string)=>boolean} p.isTracked        committed-file predicate
 */
export function checkToolAcceptance({ ledger, claims, readFile, isTracked }) {
  const findings = []
  const add = (code, detail) => findings.push({ code, detail })
  const counts = Object.fromEntries(LEVELS.map((l) => [l, { PROVEN: 0, DISCLOSED: 0, NOT_VERIFIED: 0 }]))
  if (ledger?.schema !== LEDGER_SCHEMA || !Array.isArray(ledger.rows)) {
    add('ACCEPT_SCHEMA', `${LEDGER_REL}: schema=${JSON.stringify(ledger?.schema)} / rows not an array — this checker grades ${LEDGER_SCHEMA}`)
    return { findings, counts, tools: 0 }
  }
  const byTool = new Map()
  for (const r of ledger.rows) {
    const t = r?.tool
    if (typeof t !== 'string' || t === '') { add('ACCEPT_SCHEMA', 'a row has no tool name'); continue }
    byTool.set(t, (byTool.get(t) ?? 0) + 1)
  }
  for (const [tool, c] of claims) {
    const n = byTool.get(tool) ?? 0
    if (n === 0) add('ACCEPT_ROW_MISSING', `${tool} is claimed by ${c.familyId} (${c.source ?? 'claims'}) but has no row in ${LEDGER_REL} — a family PR adds its rows in the same PR`)
    else if (n > 1) add('ACCEPT_ROW_DUPLICATE', `${tool} has ${n} rows — exactly one is allowed`)
  }
  for (const tool of byTool.keys()) {
    if (!claims.has(tool)) add('ACCEPT_ROW_STALE', `${tool} has a row but no manifest family or named bridge claims it`)
  }
  const recordCache = new Map()
  const loadRecord = (rel) => {
    if (recordCache.has(rel)) return recordCache.get(rel)
    let v
    const text = readFile(rel)
    if (text === null) v = { why: 'the record does not exist' }
    else if (!isTracked(rel)) v = { why: 'the record is not committed (not in the git index)' }
    else {
      try {
        const r = JSON.parse(text)
        if (r?.schema !== 'u5-run-record/1') v = { why: `schema=${JSON.stringify(r?.schema)} is not u5-run-record/1` }
        else if (typeof r.overall !== 'string' || typeof r.finishedAt !== 'string') v = { why: 'the record is not finalised (no overall/finishedAt)' }
        else if (!Array.isArray(r.cases)) v = { why: 'cases is not an array' }
        else v = { record: r }
      } catch (e) {
        v = { why: `does not parse (${String(e?.message ?? e).slice(0, 80)})` }
      }
    }
    recordCache.set(rel, v)
    return v
  }
  for (const r of ledger.rows) {
    const tool = r?.tool
    if (typeof tool !== 'string') continue
    const c = claims.get(tool)
    if (c !== undefined && r.familyId !== c.familyId) add('ACCEPT_ROW_FAMILY_MISMATCH', `${tool}: row familyId=${JSON.stringify(r.familyId)} but the claiming family is ${c.familyId}`)
    for (const lvl of LEVELS) {
      const L = r[lvl]
      const at = `${tool} ${lvl}`
      if (L === null || typeof L !== 'object' || !STATUSES.includes(L.status)) {
        add('ACCEPT_SCHEMA', `${at}: status=${JSON.stringify(L?.status)} is not one of ${STATUSES.join('|')}`)
        continue
      }
      counts[lvl][L.status] += 1
      if (L.status === 'PROVEN') {
        const ev = L.evidence ?? {}
        if (lvl === 'L1-definition') {
          const suite = ev.suite
          const text = typeof suite === 'string' ? readFile(suite) : null
          if (typeof suite !== 'string' || !/\.test\.(ts|mjs)$/.test(suite)) add('ACCEPT_PROVEN_UNBACKED', `${at}: PROVEN without evidence.suite naming a *.test.(ts|mjs) C1 suite`)
          else if (text === null || !isTracked(suite)) add('ACCEPT_PROVEN_UNBACKED', `${at}: suite ${suite} is absent or not committed`)
          else if (!new RegExp(`['"\`]${tool.replace(/[$]/g, '\\$')}['"\`]`).test(text)) add('ACCEPT_PROVEN_UNBACKED', `${at}: suite ${suite} never names '${tool}' — it cannot be this tool's definition suite`)
          continue
        }
        if (typeof ev.record !== 'string' || typeof ev.case !== 'string') {
          add('ACCEPT_PROVEN_UNBACKED', `${at}: PROVEN without evidence {record, case} — no level is PROVEN on prose`)
          continue
        }
        const lr = loadRecord(ev.record)
        if (lr.record === undefined) { add('ACCEPT_PROVEN_UNBACKED', `${at}: ${ev.record}: ${lr.why}`); continue }
        const hit = lr.record.cases.find((k) => k?.id === ev.case)
        if (hit === undefined) add('ACCEPT_PROVEN_UNBACKED', `${at}: ${ev.record} has no case ${ev.case}`)
        else if (hit.verdict !== 'PASS') add('ACCEPT_PROVEN_UNBACKED', `${at}: ${ev.record} case ${ev.case} verdict=${hit.verdict} — only PASS backs PROVEN`)
      } else if (L.status === 'DISCLOSED') {
        const reason = typeof L.reason === 'string' ? L.reason.trim() : ''
        if (reason === '' || typeof L.pr !== 'string' || !/^#\d+$/.test(L.pr)) {
          add('ACCEPT_DISCLOSED_UNREASONED', `${at}: DISCLOSED needs a non-empty verbatim reason and pr '#N' (reason=${JSON.stringify(L.reason ?? null)}, pr=${JSON.stringify(L.pr ?? null)})`)
          continue
        }
        if (L.source !== undefined) {
          // `source` is OPTIONAL because some disclosures exist only in the merged
          // PR's body (a review artefact GitHub keeps, not a tree file); when it IS
          // named, the reason must be findable in it word for word.
          const text = typeof L.source === 'string' ? readFile(L.source) : null
          if (text === null) add('ACCEPT_DISCLOSED_UNSOURCED', `${at}: source ${JSON.stringify(L.source)} is absent`)
          else if (!containsVerbatim(text, reason)) add('ACCEPT_DISCLOSED_UNSOURCED', `${at}: source ${L.source} does not contain the reason verbatim`)
        }
      }
    }
  }
  return { findings, counts, tools: claims.size }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  let out
  try {
    const tracked = trackedSet(ROOT)
    const read = diskReader(ROOT)
    out = checkToolAcceptance({ ledger: loadLedger(ROOT), claims: readClaims(ROOT), readFile: read, isTracked: (rel) => tracked.has(rel) })
  } catch (e) {
    console.error(`EB3-TOOL-ACCEPTANCE refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  const l4 = out.counts['L4-positive']
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    for (const l of LEVELS) console.log(`  ${l}: PROVEN=${String(out.counts[l].PROVEN)} DISCLOSED=${String(out.counts[l].DISCLOSED)} NOT_VERIFIED=${String(out.counts[l].NOT_VERIFIED)}`)
    console.log(`EB3-TOOL-ACCEPTANCE ${out.findings.length === 0 ? 'pass' : 'fail'} tools=${String(out.tools)} L4-proven=${String(l4.PROVEN)} L4-disclosed=${String(l4.DISCLOSED)} L4-unverified=${String(l4.NOT_VERIFIED)}${out.findings.length === 0 ? '' : ` findings=${String(out.findings.length)}`}`)
    console.log('LIMIT honesty, not completeness: DISCLOSED and NOT_VERIFIED never fail this leg; every L4 PROVEN is the G5 release gate')
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
