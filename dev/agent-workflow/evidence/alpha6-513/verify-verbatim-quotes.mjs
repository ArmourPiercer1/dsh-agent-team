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
 * block's own sha256); (4) reachability: no raw HTML may appear in either graded document at all (see
 * RAW HTML below), so no construct the renderer interprets can stand between a reader and the quote —
 * once the category is refused, the only way a labelled block fails to be visible is that it is not there
 * (deleted, nested inside another fence, moved behind a construct that made it stop being a fenced block),
 * which is `designated-missing`; (5) no restyled copy: no visible text of the render — soft-wrap joined,
 * other code blocks included, the labelled block excluded — shares a reader-view run ≥ NEAR with the
 * pinned line, else `quote-restyled` (kills F-R9-1: the row published as six ≤23-character soft-wrapped
 * lines the old per-line rule waved through).
 *
 * RAW HTML IS REFUSED AS A CATEGORY, in either graded document, because a renderer — not this file —
 * decides what a reader of the page ends up seeing: a raw node is a directive to the renderer about
 * visibility, and eleven rounds proved that asking about constructs one at a time (comments in round 9,
 * then `template`/`div style=display:none` in round 11, F-R11-1 BLOCKER) always names one fewer spelling
 * than the next round finds. So the rule asks the parser's own question instead: does it emit a raw-HTML
 * node (`htmlFlow`/`htmlText`) or would allowing dangerous HTML change the render? Either ⇒ REFUSE
 * (`unlocatable`, reason carries the recovery), and the two detectors cross-check each other. This
 * retires the comment scanner whole (F-R11-4): `<!--` is a raw node, so closed comments, unclosed `<!--`,
 * and the HTML5 `--!>` close all refuse rather than being half-parsed by a regex that disagreed with
 * browsers about where a comment ends — the round-11 MINOR was this file calling a well-formed document
 * `designated-missing`. What is NOT raw HTML is unaffected, measured: `<` in text, in autolinks, in
 * character references, and inside fenced / indented / inline code (including inside a `dsh-quote` fence)
 * all stay legal, because the parser escapes them and the reader sees the bytes. Honest cost, measured on
 * this repository's own text: the two governed documents contain 0 raw nodes today (addendum 0 `<`,
 * source 5, all inside code), so the clean run is unchanged; a FUTURE legitimate correction that writes
 * any HTML into a governed document — an HTML comment as an authoring note above a quote, a `<br>` to
 * force a break, an inline `<img>` — now needs the HTML removed or a human decision recorded in the PR,
 * which is the same trade the CR refusal already makes and is cheaper than reasoning about each construct.
 *
 * READER VIEW, because raw comparison collides: markdown CONSUMES the row's backticks when rendering a
 * prose copy — a code span's visible text carries no backticks — so comparing rendered text against the
 * RAW line caps the round-9 split attack at 44, exactly where this document's biggest legitimate path
 * citation also sits: no threshold separates them. Both sides are measured after stripping whitespace, the
 * characters the renderer consumes (backticks, emphasis markers, escapes), and every code point Unicode
 * says a font does not paint — general categories (`Cc`/`Cf`/`Cs`/`Zl`/`Zp`/`Mn`/`Me`/`Mc` plus
 * `Default_Ignorable_Code_Point` and `Variation_Selector`), never a code-point list: round 7's U+00AD and
 * round 11's U+2060 (F-R11-2 MAJOR) were one bug, invisible insertion, and a list of names would have been
 * the eleventh enumeration in this file's history. The categories leave the gap that the shipped number
 * always claimed — the labelled block's own byte-equality stays raw (rule 3). NEAR = 56, bounds re-measured
 * at this rewrite against this document by this round's harness, same case geometry as round 11 (evidence
 * stays out of tracked content by lane convention; the numbers are published here so any reader can re-derive them):
 * clean max run 24; `file:line` citation 24; fragment citation 27; measured citation ceiling 44 (the whole
 * packages/…/index.ts path, F-R9-5's class) — legitimate ceiling 44; attack floor 70 (field reorder),
 * corrupted copy 112, separator swap 122, soft-wrap split 123, and the whole invisible-insertion family
 * (soft hyphen, word joiner, ZWSP, BOM, combining marks, mixed, U+3164) 123 rather than the 24–46 that
 * F-R11-2 measured under the old fold. The gap (44, 70) is measured, not asserted — 12 characters of slack
 * below the threshold and 14 above it — and insertion can no longer tune a run into it because the inserted
 * characters are gone from both sides before measuring. A future legitimate
 * citation sharing ≥56 reader-visible characters of these lines goes red, and the answer is a re-pin with a
 * written reason or a reviewer-blessed reword — never a quiet threshold edit.
 *
 * NOT CHECKED — stated because each line cost a round to discover. A visually-identical Unicode rewrite
 * (o→U+03BF, T→U+0422, k→U+043A break every shared run to ~13) and any paraphrase: visual equivalence is
 * reviewer judgment, not a byte tool's threshold, and round 9's 15-entry homoglyph table proved the cost
 * of pretending otherwise (F-R9-2, disclosed, not fixed). The same family now has two measured siblings:
 * code points whose GLYPH paints blank while Unicode classes them as visible (U+2800 BRAILLE PATTERN BLANK,
 * private-use U+E000) hold a dense-insert run at 24 and stay green, because what a font paints is not a
 * category; `Default_Ignorable_Code_Point` does catch the ones the standard does class that way (U+3164
 * HANGUL FILLER now measures 123 → red). The scratch-pointer log check is DELETED whole: what stops being
 * checked is the enumeration of log lines designating gitignored scratch paths (80-line window + 6 raw-line
 * pins + fold-class scan of SESSION_ROUTER_LOG.md); what replaces it is review judgment, because F-R9-6
 * showed the window was bypassable by exactly the rewrite class above while F-R9-9 showed it charged CRLF
 * re-pin events against three files, and round 11's Priority-3 accepted the deletion (the laundering it
 * policed already fails closed: a document untracked or gitignored makes the read here throw). The ONE
 * machine check round 11 kept from that window is in: both governed document paths must still be `git
 * ls-files`-tracked in the checkout, printed as `tracked=ok` and refused as `unlocatable` otherwise. The
 * ACCOUNTED_BLOCKS census, the anchor-line uniqueness rule and the never-reachable `mode:'quote'`
 * blockquote branch are deleted too: a block re-publishing the row goes red under rule 5 whatever its
 * spelling, and a block not re-publishing it owes no one a hash. CR bytes: either graded file containing
 * one makes this tool REFUSE to judge (`unlocatable`, and the reason string carries the recovery); the
 * honest cost, said in one line: a CR sitting only inside a fenced sample — where the renderer normalises
 * it away — is refused too, because the carve-out would need the hand-rolled position scanner this rewrite
 * deleted (F-R9-9).
 *
 * RESIDUAL RISK, ACCEPTED AND NAMED (F-R11-3, round 11 MAJOR) — written here, in the leg's comment in
 * scripts/ci-pr-gate.mjs, and in the 修订记录 of the lane-2 execution-plan memo, because a risk only held
 * in a review report is one force-push away from being lost: this verifier is switchable off by the same
 * commit it grades. Raising NEAR, deleting the leg, or replacing this file with a stub that prints
 * `quotes=2 drift=0 verdict=ok` all pass, and `verifier_sha256=` verifies against nothing — it is the hash
 * of whatever bytes are being run, so it pins a verdict, never a judgment. Round 11's conclusion, accepted:
 * no in-repo protection exists, because any check inside the PR is editable by the PR (infinite regress),
 * and self-hashing or signature checks run by this same file would be theatre, not a control. The only
 * realistic controls are OUT OF BAND — branch protection and `CODEOWNERS` review on `scripts/ci-pr-gate.mjs`
 * and on `dev/agent-workflow/evidence/alpha6-513/` — which are OPERATOR ACTIONS ON THE HOSTED REMOTE that
 * this lane has NOT taken and does not claim are in place. What the tool does own is determinism: the same
 * bytes always produce the same verdict, so a green is reproducible by anyone who re-runs it.
 *
 * RETIRED FORWARD, 2026-10-31: round 8's "restyling is probed by two folded 30-character probes" with
 * threshold 24, the hand-rolled comment-range scan (retired again, this time in favour of the raw-HTML
 * category above), and the PR body's "It is still not a gate: nothing executes this file" — superseded. The
 * probe is now the reader-view run above; reachability is rule 4; and the gate leg `verbatim-quotes` in
 * scripts/ci-pr-gate.mjs fails unless this run prints verdict=ok. `grep -rn verify-verbatim-quotes` over
 * tracked content, re-run at this rewrite (F-R9-10 caught the last header quoting a grep it had not run):
 * the append-only log entries that name it, round7-report.md, round8-report.md, that gate leg, the lane-2
 * execution-plan memo's 修订记录 R-5 (this round's residual-risk record), and this file. Verdict lines are
 * pinnable: the summary prints HEAD's sha and the sha256 of every file read
 * (verifier included), and every printed finding increments drift= and moves the exit code — no finding
 * ever ships with rc=0.
 *
 *   node dev/agent-workflow/evidence/alpha6-513/verify-verbatim-quotes.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { micromark, parse, postprocess, preprocess } from 'micromark'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const SOURCE_DOC = 'docs/plans/memo/alpha6-review-separation/s0-revalidation-20261030.md'
const RENDERING_DOC = 'docs/plans/memo/alpha6-review-separation/s0-addendum-timed-wake-carrier-20261031.md'
const CASES = [
  { name: 'S0:75', line: 75, sha: '8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca' },
  { name: 'S0:79', line: 79, sha: '8021a192438cc566cf6d4a5819e3ee41ac913220b007076d9e979ea097166149' },
]
const NEAR = 56
const sha256 = (v) => createHash('sha256').update(v).digest('hex')
// Reader view (header): renderer-consumed characters + every UNPAINTED code point, as CATEGORIES.
// Safe to reuse: String.replace with a /g regex resets lastIndex, unlike the .test() this file avoids.
const UNPAINTED = /[\s`*_~\\\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}\p{Mn}\p{Me}\p{Mc}\p{Default_Ignorable_Code_Point}\p{Variation_Selector}]/gu
const visible = (v) => v.replace(UNPAINTED, '') // both sides get it; the labelled block's bytes stay raw (rule 3)
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

function rawHtmlNodes(text) { // the parser's own answer to "did a raw node reach the renderer", by category
  const events = postprocess(parse({ allowDangerousHtml: true }).document().write(preprocess()(text, 'utf8', true)))
  return events
    .filter((e) => e[0] === 'enter' && (e[1].type === 'htmlFlow' || e[1].type === 'htmlText'))
    .map((e) => `${e[1].type}@${String(e[1].start?.line ?? '?')}:${String(e[1].start?.column ?? '?')}`)
}

function readGraded(rel) { // raw bytes; refusals carry their recovery; content digest
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) throw new Error(`no-such-file:${rel}`)
  const bytes = readFileSync(abs)
  if (bytes.includes(0x0d)) {
    throw new Error(`contains-CR:${rel};renderer-normalises-but-this-tool-refuses;recovery=re-save LF-only (git add --renormalize ${rel}) or escape the CR in samples (&#x0D;), then re-run`)
  }
  const text = bytes.toString('utf8')
  // Raw HTML, refused as a category (header): either instrument firing is enough; they cross-check.
  const nodes = rawHtmlNodes(text)
  if (nodes.length > 0 || micromark(text, { allowDangerousHtml: true }) !== micromark(text)) {
    throw new Error(`contains-raw-html:${rel};nodes=${String(nodes.length)} first=${nodes.slice(0, 3).join(',') || 'render-differs-by-allowDangerousHtml'};a-raw-node-is-a-visibility-directive-to-the-renderer-so-this-tool-cannot-certify-what-a-reader-sees;recovery=take the raw HTML out of the governed document (fenced, indented and inline code samples are legal and stay legal) or have a human read the rendered page and record that decision in the PR`)
  }
  return { text, digest: sha256(bytes) }
}

function headSha() {
  if (!existsSync(join(ROOT, '.git'))) return 'not-a-git-checkout'
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return 'git-unavailable' }
}

function trackedState() { // round-11 Priority-3's surviving one-liner: an untracked doc certifies nothing
  if (!existsSync(join(ROOT, '.git'))) return 'unchecked-not-a-git-checkout'
  const untracked = [SOURCE_DOC, RENDERING_DOC].filter((rel) => {
    try { execFileSync('git', ['ls-files', '--error-unmatch', '--', rel], { cwd: ROOT, stdio: 'ignore' }); return false } catch { return true }
  })
  return untracked.length === 0 ? 'ok' : 'untracked:' + untracked.join(',')
}

try {
  // One refusal channel for "this tool declines to grade": absent file, CR bytes, raw HTML, untracked
  // document. All four are statements about the DOCUMENTS, so they print per-quote findings and the
  // `unlocatable` summary; `unrunnable` (the catch below) is reserved for the tool itself failing.
  const refuse = (reason) => {
    const r = String(reason).replace(/\s+/g, ' ').slice(0, 320)
    for (const c of CASES) console.log(`DSH-VERBATIM name=${c.name} verdict=unlocatable reason=${r}`)
    console.log('DSH-VERBATIM-VERDICT quotes=' + CASES.length + ' drift=' + CASES.length +
      ' verdict=unlocatable head=' + headSha() +
      ' verifier_sha256=' + sha256(readFileSync(new URL(import.meta.url))))
    process.exit(1)
  }
  const tracked = trackedState()
  if (tracked !== 'ok' && tracked !== 'unchecked-not-a-git-checkout') {
    refuse(`document-not-tracked:${tracked};recovery=a governed document that is gitignored or untracked is not the document CI graded; git add it or restore the tracked path`)
  }
  let source, rendering
  try {
    source = readGraded(SOURCE_DOC)
    rendering = readGraded(RENDERING_DOC)
  } catch (error) { // refusal to grade is stated per quote, never silent
    refuse(error.message ?? error)
  }
  const sourceLines = source.text.split('\n')
  // No comment stripping here on purpose: raw HTML is refused above, so none of it can reach this line.
  const html = micromark(rendering.text, { allowDangerousHtml: true })
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
      emit(c, 'designated-missing', `raw-label-occurrences=${raw} recovery=a visible fenced block whose info string starts dsh-quote:${c.name}; a label that is not rendered (deleted, nested in another fence) does not publish`)
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
    ' tracked=' + tracked +
    ' source_sha256=' + source.digest + ' rendering_sha256=' + rendering.digest +
    ' verifier_sha256=' + sha256(readFileSync(new URL(import.meta.url))) +
    ' source=' + SOURCE_DOC + ' rendering=' + RENDERING_DOC)
  process.exit(drift === 0 ? 0 : 1)
} catch (error) {
  console.log('DSH-VERBATIM-VERDICT quotes=0 drift=1 verdict=unrunnable reason=' +
    String(error).replace(/\s+/g, ' ').slice(0, 240))
  process.exit(1)
}
