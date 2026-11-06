/**
 * tests/world-factory/a5sf-debt-register.test.mjs — docs-integrity guard for the
 * Alpha.5 product-debt register.
 *
 * The register (docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md)
 * is a decision document: it claims that a specific list of product findings is
 * still open, and it points at the evidence line and the source line that
 * establish each one. That kind of file rots silently — a fix lands, a finding id
 * is deleted, a refactor moves the line, and the register keeps asserting the old
 * world. This test is the cheap tripwire, not a behaviour test:
 *
 *   (a) every finding id in a row's heading is still present in the evidence
 *       file that originated it. The id is compared after normalising case and
 *       punctuation, because evidence files write the same finding as prose
 *       ("no read axis") and as a register id ("READ-AXIS"). A row whose
 *       evidence is NOT yet on master must instead be declared in the
 *       register's §6 table with the same id, path, branch and PR; the moment
 *       that path appears in the tree the declaration reds, so a row cannot
 *       keep pointing at a branch after the branch landed;
 *   (b) every anchor `path#Lstart-Lend` still resolves and still contains the
 *       substring the row claims (a coarse existence check, not semantics);
 *   (c) ids are unique and contiguous `PD-1…PD-n` in document order, and the
 *       summary table and the detail blocks agree on each id and consequence;
 *   (d) every row carries all required fields, and the consequence class is one
 *       of the closed set.
 *
 * It reads one markdown file plus a handful of repository sources: no host, no
 * port, no DSH_HOME, no child process, no git, no clock. Anchors are tracked
 * files only; the gitignored pinned host tree is cited in prose and never
 * asserted here.
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

/**
 * §6 — rows whose evidence is not yet on master.
 *
 * `| PD-12 | Q5 | \`task/branch\` | #635 | \`dev/…/README.md\` | §Q5 |`
 *
 * Deliberately its own table shape: the id cell carries no parenthesised finding
 * id, so `parseSummary` cannot mistake these rows for register rows.
 */
function parseUnmerged(doc) {
  const out = []
  for (const line of doc.split('\n')) {
    const m = /^\|\s*(PD-\d+)\s*\|\s*([A-Za-z][A-Za-z0-9_.:-]*)\s*\|\s*`([^`]+)`\s*\|\s*(#\d+)\s*\|\s*`([^`]+\.md)`\s*\|\s*([^|]+?)\s*\|$/.exec(line)
    if (m) out.push({ id: m[1], sourceId: m[2], branch: m[3].trim(), pr: m[4], path: m[5].trim(), section: m[6].trim() })
  }
  return out
}

/** Compare a finding id to evidence prose: case and punctuation are presentation. */
function idKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

const unmerged = parseUnmerged(text)
const unmergedById = new Map(unmerged.map((u) => [u.id, u]))

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
    const repoRelative = token[1].replace(/^(?:\.\.\/)+/, '')

    if (!existsSync(relPath)) {
      // Not on this tree: the row must declare where the evidence actually is.
      const decl = unmergedById.get(row.id)
      assert.ok(
        decl,
        `${row.id}: source file ${repoRelative} does not exist and the row is not declared in §6 — either the evidence moved or the row points at nothing`,
      )
      assert.equal(decl.path, repoRelative, `${row.id}: §6 declares ${decl.path}, the row cites ${repoRelative}`)
      assert.equal(decl.sourceId, row.sourceId, `${row.id}: §6 declares finding "${decl.sourceId}", the row says "${row.sourceId}"`)
      assert.match(decl.branch, /^task\/[a-z0-9-]+$/, `${row.id}: §6 branch "${decl.branch}" is not a task branch`)
      assert.match(decl.pr, /^#\d+$/, `${row.id}: §6 PR "${decl.pr}" is not a PR number`)
      assert.ok(decl.section.length > 0, `${row.id}: §6 must name the section a reviewer should read`)
      assert.ok(
        row.body.includes(decl.branch),
        `${row.id}: the row itself must name its unmerged evidence branch (${decl.branch}) so a reader cannot miss it`,
      )
      continue
    }

    // The path is on this tree. A §6 declaration that outlived it is stale.
    assert.ok(
      !unmergedById.has(row.id),
      `${row.id}: §6 still declares ${repoRelative} as unmerged, but the file is on this tree — delete the declaration`,
    )

    const evidence = readFileSync(relPath, 'utf8')
    assert.ok(
      idKey(evidence).includes(idKey(row.sourceId)),
      `${row.id}: finding "${row.sourceId}" is no longer mentioned in ${token[1]} — a fix landed without updating the register`,
    )
  }
})

test('§6 declarations map one-to-one onto live register rows', () => {
  const ids = new Set(rows.map((r) => r.id))
  assert.equal(new Set(unmerged.map((u) => u.id)).size, unmerged.length, '§6 declares the same row twice')
  for (const decl of unmerged) {
    const row = rows.find((r) => r.id === decl.id)
    assert.ok(row, `§6 declares ${decl.id}, which is not a register row`)
    assert.equal(row.sourceId, decl.sourceId, `§6 says ${decl.id} carries finding "${decl.sourceId}", the row says "${row.sourceId}"`)
    assert.ok(
      /^[A-Za-z0-9][A-Za-z0-9_.:/-]*$/.test(decl.branch),
      `${decl.id}: §6 branch "${decl.branch}" is not a plain branch name`,
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

test('PD-9: the PTY layer-B arms never claim a byte channel for the product registry', () => {
  // `PtyHandle` is pid/backend/descendants()/kill() — no write, no read. The
  // product P1 property is a command gate plus a descendant audit. The pinned
  // host service DOES have a channel, so its explicitly `*-HOST-*` arms may say
  // so; a product-registry arm that grows WRITE/READ in its title would revive
  // the exact citation defect PD-9 removed.
  const ptyTest = readFileSync(join(ROOT, 'tests/world-factory/a5sf-pty-contract.test.mjs'), 'utf8')
  const ptyReadme = readFileSync(join(ROOT, 'dev/agent-workflow/evidence/a5sf-pty-face/README.md'), 'utf8')

  const productTitles = [...ptyTest.matchAll(/title: '(P[1-5]-[^']+)'/g)]
    .map((m) => m[1])
    .filter((title) => !title.startsWith('P1-HOST-') && !title.startsWith('P2-HOST-') && !title.startsWith('P3-HOST-') && !title.startsWith('P5-HOST-'))
  assert.ok(productTitles.length >= 10, `expected the product-registry PTY arms, found ${productTitles.length}`)
  for (const title of productTitles) {
    assert.doesNotMatch(title, /\b(?:WRITE|READ)\b/i, `PD-9: arm "${title}" names a byte channel the product PtyHandle does not have`)
  }
  assert.ok(
    productTitles.some((title) => title.startsWith('P1-COMMAND-REQUEST-GATE-')),
    'PD-9: the P1 gate arm must name the command gate (P1-COMMAND-REQUEST-GATE-…)',
  )
  assert.ok(
    ptyReadme.includes('`PtyHandle` has no write or read channel; "write"/"read" in earlier revisions of this face meant the command gate and the descendant audit.'),
    'PD-9: a5sf-pty-face/README.md must state the retired vocabulary once',
  )
  assert.match(
    rows.find((row) => row.id === 'PD-9').body,
    /^- \*\*status\*\*: FIXED — /m,
    'PD-9 must stay FIXED with its branch/commit evidence',
  )
})

test('PD-1: the revocation row is FIXED with the 2026-11-09 generation-scoped ruling', () => {
  // PD-1 changed the public `revoke` signature, so its status and the ruling
  // semantics are pinned here as well as in the acceptance arms. The earlier
  // "blocked by: an owner API ruling" deferral must survive ANNOTATED, not be
  // deleted: the ruling supersedes it, it does not erase the history.
  const SEMANTICS =
    "Revocation is generation-scoped: `revoke` takes the trusted member identity (teamId, memberInstanceId, instanceGeneration) and records that generation's revocation key unconditionally, even when the member owns no live domain; a new generation of the same member may acquire, and a spawn that completes after the revoke is reaped before publication."
  const row = rows.find((candidate) => candidate.id === 'PD-1')
  assert.ok(row, 'the register lost its PD-1 row')
  assert.match(row.body, /^- \*\*status\*\*: FIXED — /m, 'PD-1 must be FIXED with its evidence')
  assert.ok(row.body.includes(SEMANTICS), 'PD-1 must carry the 2026-11-09 generation-scoped semantics sentence')
  assert.match(row.body, /superseded 2026-11-09/, 'the earlier owner-ruling deferral must be annotated as superseded, not deleted')
  const summaryRow = summary.find((candidate) => candidate.id === 'PD-1')
  assert.ok(summaryRow, 'the summary table lost its PD-1 row')
  assert.equal(summaryRow.consequence, 'governance hole', 'the historical consequence class stays for the fixed row')
})
