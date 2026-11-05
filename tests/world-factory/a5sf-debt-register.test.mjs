/**
 * tests/world-factory/a5sf-debt-register.test.mjs — docs-integrity guard for the
 * Alpha.5 product-debt register.
 *
 * The register (docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md)
 * is a decision document: it claims that ten specific product findings are still
 * open, and it points at the evidence line and the source line that establish
 * each one. That kind of file rots silently — a fix lands, a finding id is
 * deleted, a refactor moves the line, and the register keeps asserting the old
 * world. This test is the cheap tripwire, not a behaviour test:
 *
 *   (a) every finding id in a row's heading is still present in the evidence
 *       file that originated it;
 *   (b) every anchor `path#Lstart-Lend` still resolves and still contains the
 *       substring the row claims (a coarse existence check, not semantics);
 *   (c) ids are unique and contiguous `PD-1…PD-n` in document order, and the
 *       summary table and the detail blocks agree on each id and consequence;
 *   (d) every row carries all required fields, and the consequence class is one
 *       of the closed set.
 *
 * It reads one markdown file plus a handful of repository sources: no host, no
 * port, no DSH_HOME, no child process, no clock. Anchors are tracked files only;
 * the gitignored pinned host tree is cited in prose and never asserted here.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const REGISTER_REL = 'docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md'

/** The closed consequence set, narrowest last; order is not a ranking here. */
const CONSEQUENCES = ['none', 'evidence-quality', 'behavioural divergence', 'governance hole']

/** Every row must carry every one of these labels, once each. */
const FIELDS = [
  'source',
  'true today',
  'not true',
  'security consequence',
  'current backstop',
  'smallest honest fix',
  'proof',
  'blocked by',
  'anchors',
]

const text = readFileSync(join(ROOT, REGISTER_REL), 'utf8')

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** `### PD-1 (F3) — title` → { id, sourceId, title, body } in document order. */
function parseRows(doc) {
  const head = /^### (PD-\d+) \(([A-Z][A-Z0-9-]*)\) — (.+)$/gm
  const heads = []
  let m
  while ((m = head.exec(doc))) heads.push({ id: m[1], sourceId: m[2], title: m[3].trim(), at: m.index, end: m.index + m[0].length })
  return heads.map((h, i) => ({
    ...h,
    body: doc.slice(h.end, i + 1 < heads.length ? heads[i + 1].at : doc.length),
  }))
}

/** The at-a-glance table: id cell, face, debt, consequence, decision. */
function parseSummary(doc) {
  const rows = []
  for (const line of doc.split('\n')) {
    if (!/^\|\s*PD-\d+ \(/.test(line)) continue
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    const idm = /^(PD-\d+) \(([A-Z][A-Z0-9-]*)\)$/.exec(cells[0] ?? '')
    if (!idm) continue
    rows.push({ id: idm[1], sourceId: idm[2], face: cells[1], debt: cells[2], consequence: cells[3], decision: cells[4] })
  }
  return rows
}

const rows = parseRows(text)
const summary = parseSummary(text)

test('the register parses into rows and a summary table', () => {
  assert.ok(rows.length >= 5, `expected the register to define rows, parsed ${rows.length}`)
  assert.equal(summary.length, rows.length, 'the summary table and the detail blocks must have the same number of rows')
})

test('(c) ids are unique and contiguous PD-1…PD-n in document order', () => {
  const ids = rows.map((r) => r.id)
  assert.deepEqual(ids, [...new Set(ids)], 'duplicate PD id')
  const expected = ids.map((_, i) => `PD-${i + 1}`)
  assert.deepEqual(ids, expected, `ids must be PD-1…PD-n in consequence order, got ${ids.join(', ')}`)
  assert.deepEqual(summary.map((r) => r.id), ids, 'the summary table must list the rows in the same order')
  assert.deepEqual(summary.map((r) => r.sourceId), rows.map((r) => r.sourceId), 'summary and detail must name the same source id per row')
})

test('(d) every row has all required fields exactly once', () => {
  for (const row of rows) {
    for (const field of FIELDS) {
      const re = new RegExp(`^- \\*\\*${escapeRe(field)}\\*\\*: (.+)$`, 'gm')
      const hits = [...row.body.matchAll(re)]
      assert.equal(hits.length, 1, `${row.id}: field "${field}" must appear exactly once, found ${hits.length}`)
      assert.ok(hits[0][1].trim().length > 0, `${row.id}: field "${field}" must not be empty`)
    }
  }
})

test('(d) every row declares one consequence class from the closed set, and the table agrees', () => {
  const byId = new Map(summary.map((r) => [r.id, r]))
  for (const row of rows) {
    const hit = /^- \*\*security consequence\*\*: (.+)$/m.exec(row.body)
    assert.ok(hit, `${row.id}: no security-consequence field`)
    // The prose bolds the class name ("**governance hole** — …"): emphasis is
    // presentation, so strip it before matching the closed set.
    const value = hit[1].replace(/\*/g, '').trim().toLowerCase()
    const cls = CONSEQUENCES.find((c) => value === c || value.startsWith(`${c} `) || value.startsWith(`${c}—`) || value.startsWith(`${c}-`))
    assert.ok(cls, `${row.id}: consequence "${hit[1].trim()}" is not one of ${CONSEQUENCES.join(' / ')}`)
    const tableRow = byId.get(row.id)
    assert.ok(tableRow, `${row.id}: missing from the summary table`)
    assert.equal(tableRow.consequence.toLowerCase(), cls, `${row.id}: summary table says "${tableRow.consequence}", detail says "${cls}"`)
    assert.ok(['semantics', 'correctness'].includes(tableRow.decision.toLowerCase()), `${row.id}: decision must be "semantics" or "correctness", got "${tableRow.decision}"`)
  }
})

test('(a) every finding id is still present in the evidence file that originated it', () => {
  for (const row of rows) {
    const src = /^- \*\*source\*\*: (.+)$/m.exec(row.body)
    assert.ok(src, `${row.id}: no source field`)
    // Accepts a plain repo-relative path or a markdown link target; a `../`
    // target is resolved from the register's own directory like the renderer does.
    const token = /((?:\.\.\/)+dev\/agent-workflow\/evidence\/[^\s`)\]]+\.md|dev\/agent-workflow\/evidence\/[^\s`)\]]+\.md)/.exec(src[1])
    assert.ok(token, `${row.id}: source must name a dev/agent-workflow/evidence/**.md file`)
    const relPath = token[1].startsWith('..') ? resolve(ROOT, dirname(REGISTER_REL), token[1]) : join(ROOT, token[1])
    assert.ok(existsSync(relPath), `${row.id}: source file ${token[1]} does not exist`)
    const evidence = readFileSync(relPath, 'utf8')
    assert.ok(
      evidence.includes(row.sourceId),
      `${row.id}: finding "${row.sourceId}" is no longer mentioned in ${token[1]} — a fix landed without updating the register`,
    )
  }
})

test('(b) every anchor resolves and still contains the symbol the row claims', () => {
  const anchorRe = /`([^`\n]+)#L(\d+)(?:-L(\d+))?`\s+(?:contains|names)\s+`([^`\n]+)`/g
  for (const row of rows) {
    const field = /^- \*\*anchors\*\*: (.+)$/m.exec(row.body)
    assert.ok(field, `${row.id}: no anchors field`)
    const value = field[1]
    const anchors = [...value.matchAll(anchorRe)]
    assert.ok(anchors.length > 0, `${row.id}: anchors field has no parsable "path#Lx[-Ly] contains \`symbol\`" entry`)

    // Every backticked `…#L…` token must be consumed by the parser above: an
    // anchor the test cannot read is an anchor it cannot defend.
    const tokenCount = [...value.matchAll(/`[^`\n]+#L\d+(?:-L\d+)?`/g)].length
    assert.equal(anchors.length, tokenCount, `${row.id}: ${tokenCount - anchors.length} anchor(s) do not use the "path#Lx[-Ly] contains \`symbol\`" form`)

    for (const [, relPath, startRaw, endRaw, symbol] of anchors) {
      const start = Number(startRaw)
      const end = endRaw === undefined ? start : Number(endRaw)
      assert.ok(start >= 1 && end >= start, `${row.id}: bad line range ${relPath}#L${startRaw}-${endRaw ?? startRaw}`)
      const abs = join(ROOT, relPath)
      assert.ok(existsSync(abs), `${row.id}: anchor file ${relPath} does not exist (anchors must be tracked files)`)
      const lines = readFileSync(abs, 'utf8').split('\n')
      assert.ok(end <= lines.length, `${row.id}: anchor ${relPath}#L${start}-${end} is past the end of the file (${lines.length} lines)`)
      const slice = lines.slice(start - 1, end).join('\n')
      assert.ok(
        slice.includes(symbol),
        `${row.id}: anchor ${relPath}#L${start}-${end} no longer contains ${JSON.stringify(symbol)} — the register describes a line that moved or changed`,
      )
    }
  }
})

test('the register names the evidence it digests and does not claim a boot', () => {
  // A cheap honesty check on the header: this round is 0 boots and the register
  // must say so where the evidence boundary is stated.
  assert.match(text, /0 boots/, 'the register must state the 0-boot boundary')
  for (const face of ['a5sf-fs-face', 'a5sf-subprocess-face', 'a5sf-pty-face', 'a5sf-web-face']) {
    assert.ok(text.includes(`evidence/${face}/README.md`), `the register no longer cites ${face}`)
  }
})
