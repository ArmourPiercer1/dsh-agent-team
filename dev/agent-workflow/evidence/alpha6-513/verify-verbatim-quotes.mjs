#!/usr/bin/env node
/**
 * Alpha.6 #513 — a pinned quote is what the renderer publishes; this file checks that and nothing else.
 *
 * Rounds 3–9 kept the same claim — two renderings in the addendum are byte-exact copies of two source
 * lines — and each fix widened a raw-line pattern while the claim stayed. Round 9 (3 BLOCKER / 3 MAJOR /
 * 3 MINOR / 1 INFO, all ten accepted) replaced the pattern with a different instrument: run the repo's
 * own CommonMark parser over the PUBLISHING document and assert on its rendered output. The only raw-text
 * rules left are the two source lines' content hashes. Parser: micromark 4.0.2, a direct devDependency
 * since this rewrite, imported bare — resolves from the repo root of any installed checkout (CI already
 * runs `pnpm install --frozen-lockfile` before the gate in .github/workflows/pr-gate.yml); no absolute
 * paths into node_modules/.pnpm, which is how round 9's harness could only run the old file by hand.
 *
 * PER PINNED QUOTE: (1) the source line still equals its pinned sha256, else `source-moved` (content
 * hashes are the key since round 5; line numbers are locators, never keys); (2) the label binds at the
 * RENDER, not the source: the fence info string must START with `dsh-quote:<name>` — CommonMark puts the
 * first info word into the HTML class `class="language-dsh-quote:<name>"` — and exactly one visible
 * labelled block may carry it: none ⇒ `designated-missing`, more ⇒ `label-duplicated`; (3) that block's
 * rendered text, entity-decoded, is byte-equal to the pinned source line, else `drift` (reported by the
 * block's own sha256); (4) reachability is asked AFTER HTML comments are removed from the render — closed
 * and unclosed alike, because an unterminated `<!--` runs to end-of-file exactly as browsers hide it — so
 * a quote inside a comment, behind an unclosed opener, nested in another fence, or deleted simply has no
 * visible labelled block, `designated-missing` (kills F-R9-3), while a one-line `<!-- … -->` and a prose
 * `-->` wrap nothing in a parse tree and block nothing (kills F-R9-4's false positive); (5) no restyled
 * copy: no visible text of the render — soft-wrap joined, other code blocks included, the labelled block
 * excluded — shares a reader-view run ≥ NEAR with the pinned line, else `quote-restyled` (kills F-R9-1:
 * the row published as six ≤23-character soft-wrapped lines the old per-line rule waved through).
 *
 * READER VIEW, because raw comparison collides: markdown CONSUMES the row's backticks when rendering a
 * prose copy — a code span's visible text carries no backticks — so comparing rendered text against the
 * RAW line caps the round-9 split attack at 44, exactly where this document's biggest legitimate path
 * citation also sits: no threshold separates them. Both sides are measured after stripping whitespace and
 * the characters the renderer consumes (backticks, emphasis markers, escapes); the labelled block's own
 * byte-equality stays raw (rule 3). NEAR = 56, bounds pinned by this round's harness against this
 * document: clean max run 24; `file:line` citation 23; measured citation ceiling 44 (the whole
 * packages/…/index.ts path — F-R9-5's class); fragment citation 36; attack floor 68 (separator swap);
 * field reorder 70; corrupted copy 112; soft-wrap split 123. A future legitimate citation sharing ≥56
 * reader-visible characters of these lines goes red, and the answer is a re-pin with a written reason or
 * a reviewer-blessed reword — never a quiet threshold edit.
 *
 * NOT CHECKED — stated because each line cost a round to discover. A visually-identical Unicode rewrite
 * (o→U+03BF, T→U+0422, k→U+043A break every shared run to ~13) and any paraphrase: visual equivalence is
 * reviewer judgment, not a byte tool's threshold, and round 9's 15-entry homoglyph table proved the cost
 * of pretending otherwise (F-R9-2, disclosed, not fixed). The scratch-pointer log check is DELETED whole:
 * what stops being checked is the enumeration of log lines designating gitignored scratch paths (80-line
 * window + 6 raw-line pins + fold-class scan of SESSION_ROUTER_LOG.md); what replaces it is review
 * judgment, because F-R9-6 showed the window was bypassable by exactly the rewrite class above while
 * F-R9-9 showed it charged CRLF re-pin events against three files. The ACCOUNTED_BLOCKS census, the
 * anchor-line uniqueness rule and the never-reachable `mode:'quote'` blockquote branch are deleted too: a
 * block re-publishing the row goes red under rule 5 whatever its spelling, and a block not re-publishing
 * it owes no one a hash. CR bytes: either graded file containing one makes this tool REFUSE to judge
 * (`unlocatable`, and the reason string carries the recovery); the honest cost, said in one line: a CR
 * sitting only inside a fenced sample — where the renderer normalises it away — is refused too, because
 * the carve-out would need the hand-rolled position scanner this rewrite deleted (F-R9-9).
 *
 * RETIRED FORWARD, 2026-10-31: round 8's "restyling is probed by two folded 30-character probes" with
 * threshold 24, the hand-rolled comment-range scan, and the PR body's "It is still not a gate: nothing
 * executes this file" — superseded. The probe is now the reader-view run above; reachability is rule 4;
 * and the gate leg `verbatim-quotes` in scripts/ci-pr-gate.mjs fails unless this run prints verdict=ok.
 * `grep -rn verify-verbatim-quotes` over tracked content, re-run at this rewrite (F-R9-10 caught the last
 * header quoting a grep it had not run): the append-only log entries that name it, round7-report.md,
 * round8-report.md, that gate leg, and this file. Verdict lines are pinnable: the summary prints HEAD's
 * sha and the sha256 of every file read (verifier included), and every printed finding increments
 * drift= and moves the exit code — no finding ever ships with rc=0.
 *
 *   node dev/agent-workflow/evidence/alpha6-513/verify-verbatim-quotes.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { micromark } from 'micromark'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const SOURCE_DOC = 'docs/plans/memo/alpha6-review-separation/s0-revalidation-20261030.md'
const RENDERING_DOC = 'docs/plans/memo/alpha6-review-separation/s0-addendum-timed-wake-carrier-20261031.md'
const CASES = [
  { name: 'S0:75', line: 75, sha: '8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca' },
  { name: 'S0:79', line: 79, sha: '8021a192438cc566cf6d4a5819e3ee41ac913220b007076d9e979ea097166149' },
]
const NEAR = 56
const sha256 = (v) => createHash('sha256').update(v).digest('hex')
const visible = (v) => v.replace(/[\s`*_~\\]/g, '') // reader view; header explains why both sides need it
const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&#x09': '\t' }
const decode = (t) => t.replace(/&(?:amp|lt|gt|quot|#39|#x27|#x09);/g, (m) => ENTITIES[m])
const labelOf = (attrs) => (attrs.match(/class="language-dsh-quote:([^"]+)"/) ?? [, null])[1]

function longestRun(a, b) { // longest common substring, as [length, content]
  let best = 0, at = 0
  const widths = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = 0
    for (let j = 1; j <= b.length; j += 1) {
      const saved = widths[j]
      widths[j] = a[i - 1] === b[j - 1] ? diagonal + 1 : 0
      if (widths[j] > best) { best = widths[j]; at = i - best }
      diagonal = saved
    }
  }
  return [best, a.slice(at, at + best)]
}

function readGraded(rel) { // raw bytes; CR refusal carries its recovery; content digest
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) throw new Error(`no-such-file:${rel}`)
  const bytes = readFileSync(abs)
  if (bytes.includes(0x0d)) {
    throw new Error(`contains-CR:${rel};renderer-normalises-but-this-tool-refuses;recovery=re-save LF-only (git add --renormalize ${rel}) or escape the CR in samples (&#x0D;), then re-run`)
  }
  return { text: bytes.toString('utf8'), digest: sha256(bytes) }
}

function headSha() {
  if (!existsSync(join(ROOT, '.git'))) return 'not-a-git-checkout'
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return 'git-unavailable' }
}

try {
  let source, rendering
  try {
    source = readGraded(SOURCE_DOC)
    rendering = readGraded(RENDERING_DOC)
  } catch (error) { // refusal to grade (absent file / CR bytes) is stated per quote, never silent
    const reason = String(error.message ?? error).replace(/\s+/g, ' ').slice(0, 240)
    for (const c of CASES) console.log(`DSH-VERBATIM name=${c.name} verdict=unlocatable reason=${reason}`)
    console.log('DSH-VERBATIM-VERDICT quotes=' + CASES.length + ' drift=' + CASES.length +
      ' verdict=unlocatable head=' + headSha() +
      ' verifier_sha256=' + sha256(readFileSync(new URL(import.meta.url))))
    process.exit(1)
  }
  const sourceLines = source.text.split('\n')
  // Render, then hide comment content: closed comments end at `-->`, an unclosed `<!--` runs to EOF.
  const html = micromark(rendering.text, { allowDangerousHtml: true }).replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  const blocks = [...html.matchAll(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g)]
    .map((m) => ({ attrs: m[1], raw: m[2], text: decode(m[2]) }))
  const visibleStream = visible(decode(blocks.reduce(
    (h, b) => (labelOf(b.attrs) ? h.split(b.raw).join('\n') : h), html,
  ).replace(/<[^>]*>/g, '\n')))

  let drift = 0
  const findings = []
  const emit = (c, verdict, extra) => { findings.push(`DSH-VERBATIM name=${c.name} verdict=${verdict}${extra ? ' ' + extra : ''}`) }
  const lines = new Map()
  for (const c of CASES) {
    const srcLine = sourceLines[c.line - 1]
    lines.set(c.name, srcLine)
    if (srcLine === undefined || sha256(Buffer.from(srcLine, 'utf8')) !== c.sha) {
      drift += 1
      emit(c, 'source-moved', `sha256=${sha256(Buffer.from(srcLine ?? '', 'utf8'))} expected=${c.sha} recovery=restore ${SOURCE_DOC}:${c.line} to the pinned bytes, or re-pin with a written reason`)
      continue
    }
    const named = blocks.filter((b) => labelOf(b.attrs) === c.name)
    if (named.length > 1) {
      drift += 1
      emit(c, 'label-duplicated', `count=${named.length} recovery=exactly one visible labelled block may carry dsh-quote:${c.name}`)
      continue
    }
    if (named.length === 0) {
      drift += 1
      const raw = (rendering.text.match(new RegExp('dsh-quote:' + c.name.replace(':', '\\:'), 'g')) ?? []).length
      emit(c, 'designated-missing', `raw-label-occurrences=${raw} recovery=a visible fenced block whose info string starts dsh-quote:${c.name}; a label inside a comment or behind an unclosed <!-- does not render`)
      continue
    }
    const text = named[0].text.replace(/\n$/, '')
    if (text !== srcLine) {
      drift += 1
      emit(c, 'drift', `chars=${text.length} bytes=${Buffer.byteLength(text)} source_bytes=${Buffer.byteLength(srcLine)} sha256=${sha256(Buffer.from(text, 'utf8'))}`)
      continue
    }
    emit(c, 'byte-equal', `chars=${srcLine.length} bytes=${Buffer.byteLength(srcLine)} source_bytes=${Buffer.byteLength(srcLine)} sha256=${c.sha}`)
  }
  for (const c of CASES) { // asked after soft-wrap joining, on the visible render stream
    const srcLine = lines.get(c.name)
    if (srcLine === undefined) continue
    const [run, probe] = longestRun(visibleStream, visible(srcLine))
    if (run >= NEAR) {
      drift += 1
      emit(c, 'quote-restyled', `run=${run} threshold=${NEAR} shared=${JSON.stringify(probe.slice(0, 24))}`)
    }
  }
  console.log(findings.join('\n'))
  console.log('DSH-VERBATIM-VERDICT quotes=' + CASES.length + ' drift=' + drift +
    ' verdict=' + (drift === 0 ? 'ok' : 'drift') + ' head=' + headSha() +
    ' source_sha256=' + source.digest + ' rendering_sha256=' + rendering.digest +
    ' verifier_sha256=' + sha256(readFileSync(new URL(import.meta.url))) +
    ' source=' + SOURCE_DOC + ' rendering=' + RENDERING_DOC)
  process.exit(drift === 0 ? 0 : 1)
} catch (error) {
  console.log('DSH-VERBATIM-VERDICT quotes=0 drift=1 verdict=unrunnable reason=' +
    String(error).replace(/\s+/g, ' ').slice(0, 240))
  process.exit(1)
}
