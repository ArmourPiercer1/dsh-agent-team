#!/usr/bin/env node
/**
 * eb3-trusted-sources.mjs — EB3-A/D: the trusted-source ledger check for MCP
 * tool names, and the source/evidence binding the plan asks a RUN Manifest to carry.
 *
 * WHY A LEDGER FOR MCP NAMES AT ALL. Under the Alpha.5 dynamic-source law an MCP
 * server's tools arrive at RUNTIME from configuration, so no review ever sees the
 * list; the law's answer is that an unadmitted source is UNKNOWN and UNKNOWN is
 * never an authorization. Compiled-in `mcp__<server>__<tool>` spellings are the
 * opposite case and just as dangerous in the other direction: a name hardcoded in
 * product code is a tool the dynamic admission record never gets to classify. So
 * every concrete spelling found anywhere in the tree must be booked in
 * `dev/ci/eb3-trusted-tool-sources.json` with where it lives, and an unbooked one
 * is `MCP_TOOL_UNKNOWN`.
 *
 * WHAT A BOOKING IS AND IS NOT. It records that a name exists on purpose and where;
 * it grants no runtime authority, mints no grant and admits no call — the Kernel
 * still decides every call. Deleting a booking for a name that still appears is
 * exactly the mutation the C2 control stages.
 *
 * THE BARE PREFIX IS NOT A TOOL. `mcp__` alone is the family prefix the Guard's
 * trust exclusion and the plane's reserved-prefix list are written in; requiring a
 * `<server>__<tool>` pair keeps those legitimate uses out of the ledger without an
 * exemption list.
 *
 * OTHER FILE CLASSES. `.md` documentation, `dev/agent-workflow/evidence/**` captures
 * and the append-only router log are historical/prescriptive text, not source: a
 * document naming a tool example is not a source of one. `SOURCE_ROOTS` says which
 * trees are scanned; a spelling in a scanned tree that is not booked is a finding
 * regardless of which subdirectory it sits in (product and fixtures share the
 * ledger's two sections so a promotion is a visible diff).
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs (C2):
 *   checkTrustedSources({ files, ledger?, scope? }) → { findings }
 *   SOURCE_ROOTS, LEDGER_REL, loadLedger()
 *
 *   node scripts/eb3-trusted-sources.mjs [--json]
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-trusted-sources
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const LEDGER_REL = 'dev/ci/eb3-trusted-tool-sources.json'

/** The trees whose files are SOURCE for this check. */
export const SOURCE_ROOTS = Object.freeze(['packages', 'tests', 'scripts'])

/** Directories inside a source root that are captures/build output, not source. */
const NOT_SOURCE = [
  /\/dist\//,
  /\/node_modules\//,
  /^dev\//,
  // captured runs and prose: a document or a recorded transcript that NAMES a tool
  // is not a source of one (tests/mock/evidence/** is a capture directory).
  /\/evidence\//,
  /\.md$/,
]

/** A concrete MCP tool spelling: `mcp__<server>__<tool>`. The server segment must
 *  be a real identifier (a dash or underscore inside it is legal; a `*`, `$` or `{`
 *  means the source is writing a pattern, not naming a tool). The tool segment may
 *  be exactly `*` because `mcp__server__*` is how the reserved-prefix filter and the
 *  agent-scope selector spell "every tool of this server" — that is namespace
 *  policy on a BOOKED server, so it is required to name a booked server instead of
 *  being ignored. */
const MCP_TOOL_RE = /\bmcp__([A-Za-z0-9][A-Za-z0-9_-]*)__(\*|[A-Za-z0-9_][A-Za-z0-9_-]*)/g

export function loadLedger(root = ROOT) {
  const abs = join(root, LEDGER_REL)
  if (!existsSync(abs)) throw new Error(`EB3 trusted-source ledger absent: ${LEDGER_REL}`)
  const l = JSON.parse(readFileSync(abs, 'utf8'))
  if (l.schema !== 'eb3-trusted-tool-sources/1') throw new Error(`${LEDGER_REL}: unknown schema ${String(l.schema)}`)
  return l
}

/** `mcp__server__*` is a namespace claim; the bookable identity is the SERVER. */
const serverOf = (name) => name.slice('mcp__'.length, name.indexOf('__', 'mcp__'.length))

/**
 * @param {object} p
 * @param {Map<string,string>} p.files  repo-relative path → file text
 * @param {object} [p.ledger]           defaults to the tracked ledger
 */
export function checkTrustedSources({ files, ledger = loadLedger() }) {
  const findings = []
  const bookedTools = new Set([
    ...(ledger.product?.tools ?? []).map((t) => t.name),
    ...(ledger.fixtures?.tools ?? []).map((t) => t.name),
  ])
  const bookedServers = new Set([...bookedTools].map(serverOf))

  for (const [path, text] of files) {
    if (NOT_SOURCE.some((rx) => rx.test(path))) continue
    const seen = new Set()
    for (const m of text.matchAll(MCP_TOOL_RE)) {
      const name = m[0]
      if (seen.has(name)) continue
      seen.add(name)
      if (bookedTools.has(name)) continue
      const server = serverOf(name)
      const wildcard = name.endsWith('*')
      if (wildcard && bookedServers.has(server)) continue // namespace policy on a booked server
      const line = text.slice(0, m.index).split('\n').length
      findings.push({
        code: 'MCP_TOOL_UNKNOWN',
        detail: `${path}:${String(line)}: "${name}" is not in ${LEDGER_REL} — an MCP tool name no review admitted (dynamic sources are UNKNOWN until an admission record exists)`,
        path,
        name,
      })
    }
  }
  return { findings }
}

/** Tracked source files, when a git index is available (the CI path). */
export function trackedSourcePaths(root = ROOT) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z', ...SOURCE_ROOTS], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter((p) => p.length > 0)
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  let out
  try {
    const files = new Map()
    for (const p of trackedSourcePaths(ROOT)) {
      if (NOT_SOURCE.some((rx) => rx.test(p))) continue
      files.set(p, readFileSync(join(ROOT, p), 'utf8'))
    }
    out = { files: files.size, ...checkTrustedSources({ files }) }
  } catch (e) {
    console.error(`EB3-TRUSTED-SOURCES refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    console.log(`EB3-TRUSTED-SOURCES ${out.findings.length === 0 ? 'pass' : 'fail'} files=${String(out.files)} findings=${String(out.findings.length)}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
