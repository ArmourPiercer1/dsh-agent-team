#!/usr/bin/env node
/**
 * lint-g-g-wording.mjs — the G-g support contract §3/G-5: the machine-checkable
 * form of P8 (the positioning clause). A repo-level scan of `dev/agent-workflow/**`
 * markdown — the support-matrix / contract context the contract names.
 *
 * The rule (deliberately NARROW — "宁窄勿宽": a miss is a TODO for the wording
 * owner, a false positive would make the gate un-runnable):
 *
 *   A line is a VIOLATION iff, on that same line,
 *     1. it carries a closure claim:  fail-closed / silent-safe / 已合规 / compliant, AND
 *     2. it carries the SILENT-CHANNEL context — the configuration this contract
 *        is about ("订阅成功但永不投递"): 静默通道/静默配置/静默时/静默观察/
 *        订阅成功但/永不投递/永不送达/never-deliver/never arrives/silent channel/
 *        accepted-but-silent/订阅存活, or `swallow` ONLY when the same line also
 *        speaks of a subscription/channel/通道/tools-change (the swallow the
 *        contract means is the emission-swallowing injection, not any code that
 *        swallows an exception), AND
 *     3. it carries NO qualifier or retraction marker: UNSUPPORTED / UNTESTED /
 *        待证 / NO-EVIDENCE / RETRACTION / retract / 撤回 / 禁则 / 禁用 / 禁止 /
 *        不得 / 证伪.
 *
 *   Lines inside a registered RETRACTION/quoted-context window are exempt
 *   (contract G-5: 引注/RETRACTION 上下文进 allowlist; the anchor of record is
 *   seam-record-post-door-resolution.md:99-122).
 *
 * Second clause (§3/G-5, and PASS(P8) in §4.1): when `dev/agent-workflow/
 * PENDING-GATES.md` exists, the G-g row and the G-a row may not be judged closed
 * in the same revision (the G-a ruling does not close G-g — PENDING-GATES 边界②).
 * The file is not on this baseline yet; the check engages when it lands, and says
 * so in the output meanwhile — it never vacuously passes without saying so.
 *
 * Walker robustness (a5-docs-matrix hardening, 2026-10-19): the census runs
 * 458/459/460 went red on the evidence branch because an accidentally
 * committed DANGLING symlink in a fixture tree made the walker's `statSync`
 * throw an uncaught ENOENT — the lint process crashed instead of reporting
 * (dangling-link × statSync, root-cause registered in COORDINATION 2026-10-19
 * 02:0xZ/02:2xZ). The walker now lstats first: a symlink whose target is
 * missing (ENOENT) is SKIPPED and disclosed — named on stdout and counted in
 * `skippedDangling` — never silently swallowed, and never a crash. Anything
 * else (ELOOP, EACCES, a plain file that vanished mid-walk, …) still throws:
 * hardening the known failure shape must not launder other walker errors into
 * skips. Symlinks that RESOLVE are followed exactly as before, so the verdict
 * surface of the wording rule on any given tree is unchanged (same tree with
 * and without dangling links: identical violations and filesScanned; the only
 * delta is the honest `skipped=` disclosure).
 *
 * Usage:  node scripts/lint-g-g-wording.mjs [repoRoot]
 * EXIT:   0 = clean (violations printed as `file:line:` — none), 1 = violations.
 *         Dangling-link skips do NOT set the exit code; they are disclosed.
 *
 * @module scripts/lint-g-g-wording
 */
import { existsSync, readFileSync } from 'node:fs'
import { lstatSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const CLAIM_RE = /fail[-\s]?closed|silent[-\s]?safe|已合规|\bcompliant\b/i
const CHANNEL_CONTEXT_RE =
  /静默通道|静默配置|静默时|静默观察|订阅成功但|永不投递|永不送达|never[-\s]deliver|never arrives|silent[-\s]channel|accepted-but-silent|订阅存活/i
const SWALLOW_RE = /swallow/i
const CHANNEL_SIDE_RE = /订阅|通道|subscription|channel|tools\/change|listener/i
const QUALIFIER_RE =
  /UNSUPPORTED|UNTESTED|待证|NO-EVIDENCE|RETRACTION|retract|撤回|禁则|禁用|禁止|不得|证伪/i

/** Registered quoted/RETRACTION windows: `<relative path>` -> inclusive line range. */
const RETRACTION_ALLOWLIST = [
  // The contract's own anchor: the retraction of the "fail-closed, exposure = one
  // call" claim, quoted verbatim so the record stays unambiguous.
  { file: 'dev/agent-workflow/evidence/alpha5-pr1r/seam-record-post-door-resolution.md', from: 99, to: 122 },
]

/**
 * @param {string} relPath repo-relative path (for allowlist matching and output).
 * @param {string} text full file text.
 * @returns {{ line: number, text: string, claims: string[] }[]}
 */
export function lintMarkdownText (relPath, text) {
  const violations = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const claim = CLAIM_RE.exec(line)
    if (claim === null) continue
    const inContext = CHANNEL_CONTEXT_RE.test(line)
      || (SWALLOW_RE.test(line) && CHANNEL_SIDE_RE.test(line))
    if (!inContext) continue
    if (QUALIFIER_RE.test(line)) continue
    const no = i + 1
    if (RETRACTION_ALLOWLIST.some((w) => w.file === relPath && no >= w.from && no <= w.to)) continue
    violations.push({ line: no, text: line.trim().slice(0, 300), claims: [claim[0]] })
  }
  return violations
}

/**
 * The PENDING-GATES clause: the G-g row and the G-a row may not BOTH be judged
 * closed. A row counts as closed when its line marks it CLOSED/已关闭/✅closed.
 * @returns {{ line: number, text: string }[]} empty when the file is absent
 * (callers must record that the clause did not engage).
 */
export function lintPendingGatesText (text) {
  const violations = []
  const lines = text.split(/\r?\n/)
  const closedOn = (row) => lines
    .map((l, i) => ({ l, no: i + 1 }))
    .filter(({ l }) => new RegExp(`\\b${row}\\b`).test(l) && /(CLOSED|已关闭|✅\s*closed)/i.test(l))
  const gg = closedOn('G-g')
  const ga = closedOn('G-a')
  if (gg.length > 0 && ga.length > 0) {
    violations.push({
      line: gg[0].no,
      text: `G-g (line ${String(gg[0].no)}) and G-a (line ${String(ga[0].no)}) are judged closed in the same revision — the G-a ruling does not close G-g (support contract P8 / PENDING-GATES 边界②)`,
    })
  }
  return violations
}

function walkMarkdown (dir, out, skipped) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let st = lstatSync(p)
    if (st.isSymbolicLink()) {
      try {
        st = statSync(p)
      } catch (err) {
        // Only a missing target (ENOENT) is a dangling link: skip + disclose.
        // Every other lstat/stat error rethrows — the skip lane is for the one
        // shape we characterised (census 458/459/460), not a general muffle.
        if (err.code === 'ENOENT') { skipped.push(p); continue }
        throw err
      }
    }
    if (st.isDirectory()) walkMarkdown(p, out, skipped)
    else if (name.endsWith('.md')) out.push(p)
  }
  return out
}

export function lintRepo (repoRoot) {
  const root = join(repoRoot, 'dev', 'agent-workflow')
  const results = { violations: [], filesScanned: 0, pendingGates: 'absent', skippedDangling: [] }
  if (!existsSync(root)) return results
  const dangling = []
  for (const file of walkMarkdown(root, [], dangling)) {
    const rel = relative(repoRoot, file).split(/[\\/]/).join('/')
    if (rel.endsWith('PENDING-GATES.md')) {
      results.pendingGates = 'checked'
      for (const v of lintPendingGatesText(readFileSync(file, 'utf8'))) {
        results.violations.push({ file: rel, ...v, claims: ['G-g/G-a same-revision closed'] })
      }
      continue
    }
    results.filesScanned += 1
    for (const v of lintMarkdownText(rel, readFileSync(file, 'utf8'))) {
      results.violations.push({ file: rel, ...v })
    }
  }
  results.skippedDangling = dangling.map(
    (p) => relative(repoRoot, p).split(/[\\/]/).join('/'))
  return results
}

const isMain = process.argv[1] !== undefined && process.argv[1].endsWith('lint-g-g-wording.mjs')
if (isMain) {
  const repoRoot = process.argv[2] ?? process.cwd()
  const results = lintRepo(repoRoot)
  for (const v of results.violations) console.log(`VIOLATION ${v.file}:${String(v.line)}: ${v.text}`)
  for (const p of results.skippedDangling) console.log(`SKIPPED-DANGLING ${p}`)
  console.log(`scanned=${String(results.filesScanned)} md files; PENDING-GATES=${results.pendingGates}; skipped=${String(results.skippedDangling.length)}; violations=${String(results.violations.length)}`)
  process.exitCode = results.violations.length === 0 ? 0 : 1
}
