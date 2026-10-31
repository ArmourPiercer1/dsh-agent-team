# Round-7 independent records review — PR #513 (attack the round-6 closures and the corrections just published)

Read-only. No tracked file was modified at any point: every mutation ran against a mirror built from
`git show <ref>:<path>` blobs under `.artifacts/alpha6-s0/rev7-513/mir/<case>/` (gitignored —
`.gitignore:118:.artifacts/`), executed with `cwd` inside the mirror. `git status --porcelain` empty at both ends.

## Head verification

```
start  HEAD=975822b5617b7c0695f03c1153140a5ae2fc685f  branch=alpha6/lane2-governance-20261031  porcelain=0 lines
end    HEAD=3dddba2b24649f8a146234ee90f3fabe000ab152  branch=alpha6/lane2-governance-20261031  porcelain=0 lines
```

**The branch moved under this review.** A concurrent writer committed `3dddba2b2` at 18:33:30
("the two decisions that were only on their own branches", `23 0` — SESSION_ROUTER_LOG.md only) while I was
building mirrors, which is why my first mirror was wrong and every number below is re-materialised from explicit
blobs. PR #513 is now `head=3dddba2b2`, `state=open`, `draft=true`, title still `DO-NOT-MERGE`-prefixed, body
**37501 bytes** (the 36,400 figure in my brief is stale — the body is rewritten per head).
The verifier blob: `363` lines / `42518638c4c4…` at `091a085bc`; `370` lines / `70f44b292e0b…` at `975822b56`
and unchanged at `3dddba2b2`.

**VERDICT: 1 BLOCKER / 1 MAJOR / 3 MINOR / 1 INFO**

Escalation rule used, stated because round 6 graded the same outcome MAJOR: the outcome "the instrument reads a
copy while the published quote rots" is F-R6-1. It was found, fixed, and declared closed in the file header in
`091a085bc`. This round reproduces the same outcome with `rc=0` against the fixed version, using nothing but
CommonMark syntax and no edit to the instrument. A defect in a hole is MINOR/MAJOR; a defect in a sentence that
says the hole is closed is what round 6 itself named as *the* defect, and it is now the fifth consecutive round
that header sentence has been false on arrival.

---

## F-R7-1 (BLOCKER) — `blocksOfKind` recognises blocks by the byte-spelling of the marker, so the round-6 closure covers a subset of markdown; the check still reads a copy while the published quote rots

**Command:**
```
R7REF=975822b56 python3 attack.py A1_tilde_with_invisible_plant          # rc=0
R7REF=975822b56 python3 attack.py A1b_label_extra_with_invisible_plant   # rc=0
R7REF=975822b56 python3 attack.py A1c_backtick4_with_invisible_plant     # rc=0
R7REF=975822b56 python3 attack.py A1e_plain_three_backtick_invisible_plant  # rc=0
R7REF=975822b56 python3 attack.py A2_gt_nospace_with_invisible_plant     # rc=0
R7REF=975822b56 python3 attack.py A20_delete_the_quote_keep_an_invisible_plant  # rc=0
R7REF=975822b56 python3 attack.py A21_ordinary_tilde_sample_is_invisible # rc=1, only for the backtick sample
```
(two ingredients per attack: the corrupted quote published in a marker the scanner does not know, and the correct
bytes planted in a ` ```text ` fence inside an HTML comment, which renders as nothing.)

**Result:** every one of them prints

```
DSH-VERBATIM name=S0:75 verdict=byte-equal chars=137 bytes=161 … sha256=8ba2ab061ffb
DSH-VERBATIM name=S0:79 verdict=byte-equal chars=232 bytes=356 … sha256=8021a192438c
DSH-VERBATIM-VERDICT quotes=2 drift=0 verdict=ok …
DSH-SCRATCH-POINTER-VERDICT found=5 pinned=6 window=80 findings=0 verdict=ok
```
with **rc=0**, while the reader-visible rendering of §1 under the anchor 「第 75 行，逐字（围栏内为源文件该行的原始
字节…）」 is (markdown-it, `commonmark` preset, on the mutated file):

```
<pre><code class="language-text">| 调度器持久状态 | … KvTable（CAS/条件写、租约）+ `domain/changed` | … |
</code></pre>
```

— the word `租约` is not in source line 75. The planted correct copy is inside `<!-- … -->`, so it is present for
a raw-line scanner and absent for a reader. `A20` is the limit case: **delete the published quote entirely**, keep
only the HTML-comment copy, and the document — which now publishes no quote at all — still reports
`verdict=byte-equal`.

`A21` shows the asymmetry without any hostile intent: two code samples added side by side in §4, one ```` ```text ````
one `~~~text`, render to byte-identical block types (`<pre><code class="language-text">` twice). The backtick one
is `verdict=unaccounted-block count=1 lines=68 sha256=8753d2f07ea5`; the tilde one does not exist.

Mechanism, from the source at `975822b56`: a fence block is a line whose `trim() === '```text'`
([verify-verbatim-quotes.mjs:176](dev/agent-workflow/evidence/alpha6-513/verify-verbatim-quotes.mjs#L176)) and a
quote block is a line whose `trimStart().startsWith('> ')` (line 188). CommonMark-equivalent spellings that render
identically and are therefore invisible to all three new rules — `~~~text`, `~~~`, `` ```text quote ``,
`` ``` TEXT ``, `` ````text ``, bare ```` ``` ````, `>text`, `>\ttext`, lazy continuation, and a fence inside an
HTML comment or `<pre>` block. Anything outside the recognised spelling is not "a block of that kind", so
`section-block-count` cannot count it, `unaccounted-block` cannot demand a reason for it, and `quote-duplicated`
cannot see the second copy. And nothing ties the *designated* block to the *rendered* block, so a plant that is
invisible to readers satisfies the section rule exactly.

Falsified sentences in the instrument's own header (written this round, `091a085bc`/`975822b56`):
- :32–34 "a second copy of the quote planted anywhere in the publishing document, so the check reads the copy while
  the published quote rots (round 6 F-R6-1 …) → `section-block-count` / `unaccounted-block`" — the closure is listed
  under "WHAT IS ACTUALLY CLOSED".
- :77–79 "Every block of a pinned kind in the publishing document must be accounted for … it is an unaccounted
  block **in a document whose blocks are all named**."

Not in the "WHAT STAYS OPEN" list (:39–47), which names three boundaries and not this one.

Attack surface: `git diff` of the verifier is empty for all of these; every edit is inside the published document,
i.e. the file whose trustworthiness the check is the witness for. Fix direction, if the lane wants one: parse the
document (any CommonMark parser is already a dependency-free `node_modules` away, and `markdown-it` is present in
this environment) and bind `designated` to the block that *renders* under the anchor, then require the render tree,
not a line scan, to enumerate blocks — or drop the closure sentence and add the hole to the open list.

Still working at the real PR head: `R7REF=3dddba2b2 … A1_tilde_with_invisible_plant` → `rc=0`,
`DSH-VERBATIM-VERDICT … verdict=ok`, `found=5 pinned=6 findings=0`.

## F-R7-2 (MAJOR) — the invisible-character closure covers 11 code points; 8 more invisible categories walk a new designation straight past the detector

**Command:**
```
R7REF=975822b56 python3 attack.py A4_softhyphen A4_arabic_mark A4_mongolian A4_invisible_op \
  A4_vs15 A4_tagchar A4_hangul_fill A4_interlinear A4_word_joiner A4_zwsp A4_lro A4_bom \
  A4_zero_width_nbsp A4_object_repl
R7REF=975822b56 python3 attack.py A5_cyrillic_a A5_fullwidth_dot
```
each appending one new log line inside the live window: 「本轮记录正本落盘于 `<injected>.artifacts/…planted.md`」
with the invisible code point spliced inside `.artifacts`.

**Result:**

| injected | category | rc | verdict token |
| --- | --- | --- | --- |
| U+00AD SOFT HYPHEN | Cf | **0** | `found=5 pinned=6 findings=0 verdict=ok` |
| U+061C ARABIC LETTER MARK | Cf | **0** | `findings=0` |
| U+180E MONGOLIAN VOWEL SEPARATOR | Cf | **0** | `findings=0` |
| U+2061 FUNCTION APPLICATION | Cf | **0** | `findings=0` |
| U+FE0E VARIATION SELECTOR-15 | Mn | **0** | `findings=0` |
| U+E0041 TAG LATIN CAPITAL A | Cf | **0** | `findings=0` |
| U+FFA0 HALFWIDTH HANGUL FILLER | Lo | **0** | `findings=0` |
| U+FFF9 INTERLINEAR ANNOTATION ANCHOR | Cf | **0** | `findings=0` |
| U+202F NARROW NO-BREAK SPACE | Zs | **0** | `findings=0` |
| U+FFFC OBJECT REPLACEMENT | So | **0** | `findings=0` |
| U+2060 WORD JOINER | Cf | 1 | `found=6 … findings=1 verdict=regression` |
| U+200B ZWSP / U+202D LRO / U+FEFF BOM | Cf | 1 | `findings=1 verdict=regression` |
| `.аrtifacts` (U+0430 Cyrillic a) | — | **0** | `findings=0` |
| `．artifacts` (U+FF0E full-width stop) | — | **0** | `findings=0` |

Header :30–31 claims "a zero-width character inside `.artifacts` so the mention stops matching (round 6) →
detection runs on a normalised copy while the hash stays raw, so the line is **still found**" — true for exactly
`[\u200B-\u200F\u2028-\u202E\u2060\uFEFF]` (line 65) and false for the rest. The result is the same defect round 4
graded MAJOR (a durable record designating a gitignored scratch path as a resting place), added in the window where
records are being written, undetected. The look-alike rows are the cheaper version: `.аrtifacts` with a Cyrillic
`а` reads as the path to every human reviewer and matches no regex.

## F-R7-3 (MINOR) — `scope: 'window'` cannot tell "aged out of the window" from "deleted", so an accepted designation can be retired silently

**Command:** `R7REF=975822b56 python3 attack.py A6_window_pin_then_delete_line A6b_permanent_pin_for_absent_line A6c_duplicate_a_pinned_line A6g_log_grows_out_of_window A6h_grow_until_permanent_pin_named_only`

**Result:** pin a designation line with `scope: 'window'` and a reason, and do not keep the line —
`DSH-SCRATCH-POINTER-VERDICT found=5 pinned=7 window=80 findings=0 verdict=ok`, **rc=0**. The pin becomes a hash
of nothing with a reason asserting it was a reviewed mention, and the only visible trace is `pinned > found`.
Control: the same with `scope: 'permanent'` → `accepted=false reason=pinned-line-no-longer-present sha256=611f1a377084`,
`findings=1`, rc=1, so the mechanism works; the `window` scope just resolves every ambiguity in the permissive
direction. Header :43–45 and :98–100 disclose *why* window scope exists (a growing log must not force anyone to
delete history) but not this consequence: nothing any longer proves a `window`-pinned line was ever removed by
growth rather than by removal. Duplicating a pinned line *is* caught —
`reason=pinned-designation-duplicated sha256=165093eb9530`, rc=1.

## F-R7-4 (MINOR) — the published remediation "paste what the tool prints" cannot produce a valid pin: the tool never prints more than 12 hex digits

**Command:** `R7REF=975822b56 python3 attack.py A16_pin_with_truncated_hash A17_addenddum_accounted_from_printed_hash`
plus `node ver-975822b56.mjs | grep -oE '[0-9a-f]{64}'`

**Result:** no output line of the instrument contains a 64-hex digest — all ten digest sites are `.slice(0, 12)`
(lines 240, 279, 286, 315, 323, 331). Doing exactly what round 6's law says ("**a pin is pasted from output or it is
not a pin**") produces:

```
DSH-SCRATCH-POINTER line=7510 accepted=false trigger=window sha256=03857ece0804
DSH-SCRATCH-POINTER-VERDICT found=6 pinned=7 window=80 findings=1 verdict=regression    rc=1
DSH-VERBATIM  name=S0:75 verdict=unaccounted-block count=1 lines=68 sha256=94464eea3440  rc=1
```

i.e. the author pastes the printed value, and stays red, with a token that does not say why. Recoverable in one
step (hash the line externally), so MINOR — but it is the fifth-round disease in procedure form, and it also means
the sentence in the commit message and body, "Replaced with what the tool prints", cannot literally be how the two
real `ACCOUNTED_BLOCKS` hashes were obtained. The pinned values themselves are genuine: recomputed this session —
lines 3–5 → `52783fdb2231711b33a4…07d5`, line 35 → `8c5ca70ef005a2e34eac…92dd`, source :75 → `8ba2ab061ffb…e8ca`,
source :79 → `8021a192438c…6149`. All four match the constants at :70–90. No fabrication survives at head.

## F-R7-5 (MINOR) — two fail-closed costs that are not in the disclosed-open list

**Command / Result:** see "LEGITIMATE-CORRECTION COSTS" below. Two of the measured costs are undisclosed and one is
not recoverable by editing forward:
- **CRLF re-save of the log** → `pinned-line-no-longer-present` ×3, all three for **permanent** pins, `findings=3`,
  rc=1. Permanent pins are raw-line hashes, so a line-ending change on a permanently pinned line can only be fixed
  by restoring the exact bytes or by moving a permanent pin — the exact move the header warns is history repair.
  Header :44–45 discloses only "a formatter pass … by a **single trailing space**", which is recoverable by
  deleting the space; the permanent-pin version is a different cost and is not stated.
- **a `#` line inside a fenced code sample** placed between the anchor and the quote (an ordinary "add a config
  sample" edit) → `section-block-count expected=1 found=0 section_lines=7-19` **and** `expected=1 found=2
  section_lines=20-82`, both quotes red, rc=1. `levelOf` scans `^(#{1,6})\s` on raw lines and does not skip fences
  or blockquotes, so a comment line inside a sample silently re-draws the section the quote lives in.

## F-R7-6 (INFO) — the sentence about the window rule catching its own entry names the wrong clause

**Command:** `git show 975822b56:dev/agent-workflow/SESSION_ROUTER_LOG.md | sed -n '7491p'` → token position check
**Result:** the body says "it caught **the sentence describing the window rule** (`trigger=window`,
`accepted=false`)". Line 7491 is one bullet with two clauses; the `.artifacts` token is at char 29 of 70, inside
「剥掉零宽/bidi 的副本上跑、哈希仍用原始行 ⇒ 往 `.artifacts` 里塞零宽字符…」 — the **zero-width normalisation**
rule. The window-rule clause (「最后 80 行…」) follows it and carries no token. The verifier's own pin reason is
correct: "the round-6 entry explaining zero-width normalisation". Substantively right (same log line, caught by the
window rule, answered with a pin), wrong in the clause it names, in a sentence about the instrument's own
behaviour — the class that has now failed five rounds.

---

## MUTATIONS (attack → expected → actual → restore)

Every row: fresh mirror from `git show 975822b56:<path>` (or `091a085bc` where the row says so), mutation applied
to the mirror copy only, `node <verifier>` run with `cwd` in the mirror, mirror deleted. Tracked tree never
written; `git status --porcelain` = 0 lines at the end, `git diff --stat` empty.

| # | attack (one line) | expected | actual token + rc |
| --- | --- | --- | --- |
| base | clean mirror, no mutation | green | `quotes=2 drift=0 verdict=ok` + `found=5 pinned=6 window=80 findings=0` **rc=0** |
| A1 | corrupted quote in `~~~text`, correct bytes in ` ```text ` inside `<!-- -->` | red (F-R6-1 closed?) | `S0:75 verdict=byte-equal`, `verdict=ok` **rc=0** |
| A1b | same, visible copy uses `` ```text quote `` | red | **rc=0** |
| A1c | same, visible copy uses a 4-backtick fence | red | **rc=0** |
| A1d | same, visible copy in `> ```text ` | red | `S0:79 section-block-count expected=1 found=2` rc=1 (caught by the *other* quote's rule, by accident) |
| A1e | same, visible copy in a bare ```` ``` ```` fence (one character deleted from the opener) | red | **rc=0** |
| A2 | corrupted S0:79 quote as `>text` (no space), correct bytes in HTML comment | red | `S0:79 verdict=byte-equal` **rc=0** |
| A2b | corrupted quote with lazy continuation | red | rc=1 (`found=2`) |
| A20 | published quote deleted; only an HTML-comment copy remains | red | **rc=0** |
| A21 | new ```` ```text ```` + new `~~~text` sample in §4 | same verdict for equivalent blocks | backtick → `unaccounted-block` rc=1; tilde → invisible |
| A3 | duplicate an already-`ACCOUNTED` blockquote twice more | listed once, counted once | `verdict=ok` **rc=0** (allow-list is content-hash only, no count, no position) |
| A4 ×14 | invisible code point inside `.artifacts` on a new in-window designation | red | **10 of 14 rc=0** (see F-R7-2 table) |
| A5 | `.аrtifacts` (Cyrillic a) / `．artifacts` (full-width dot) / path folded across two lines / `artifacts/` without the dot | red | **all rc=0** |
| A6 | window-pin a designation, drop the line | red | `found=5 pinned=7 findings=0` **rc=0** |
| A6b | permanent pin for a line not in the log (control) | red | `pinned-line-no-longer-present` rc=1 |
| A6c | copy a pinned designation line byte-for-byte | red | `pinned-designation-duplicated` rc=1 |
| A6g/A6h | append 100 / 2000 filler lines | green, no pin turns red | `found=3 pinned=6 findings=0` **rc=0** both |
| R6_1…R6_9 | round 6's published nine-attack matrix, re-run | 9/9 red | **9/9 rc=1** at `975822b56` *and* 9/9 at `091a085bc` |
| FAB | re-create the alleged draft: `ACCOUNTED_BLOCKS` = real 16-hex heads + invented tails | — | reproduces the published token exactly: `unaccounted-block count=2 lines=3,35 sha256=52783fdb2231,8c5ca70ef005` |
| A16/A17 | pin / account using the 12-hex digest the tool actually prints | green | rc=1, no diagnostic naming the cause |
| A18/A19 | 80-col wrap breaking `.art` / `ifacts` vs after `.artifacts` | red | break **inside** the token **rc=0**; after the token rc=1 |

Restore proof: no tracked file was ever written, so there is nothing to `sha256sum -c`. Proof of that instead:
`git -C .worktrees/alpha6-gov status --porcelain | wc -l` → `0`, `git diff --stat | wc -l` → `0`, at the end.

## WHAT NOW HOLDS (attacked and did not break)

- **Round 6's published matrix: 9/9 rc=1, reproduced independently, at both heads.** Planted anchor
  (`anchor … ambiguous: 2 occurrences at line(s) 15,16`), coordinated source+rendering edit
  (`verdict=source-moved pinned=8ba2ab061ffb actual=190a0d28539b`), duplicated designation, trailing space
  (at `091a085bc` the pinned window line is 7414, not 7491 — the entry that names 7491 landed later), decoy fence in
  the same section (`unaccounted-block count=1 lines=16`), decoy elsewhere with the quote corrupted
  (`count=2 lines=16,69`), exact copy planted (`quote-duplicated count=2 lines=16,69`), U+200B in `.artifacts`,
  split designation in the window (`trigger=window accepted=false`). This is the first round's fix in five that I
  could not immediately re-open by *its own* attack list.
- **Clean run reproduces exactly**, from blob-pinned mirrors, at `975822b56` and `3dddba2b2`: the two
  `DSH-VERBATIM` lines (`chars=137 bytes=161 sha256=8ba2ab061ffb`, `chars=232 bytes=356 sha256=8021a192438c`),
  `found=5 pinned=6 window=80 findings=0`, rc=0. At `091a085bc`: `found=5 pinned=5` as the log entry states.
- **`pinned=6 > found=5` is sound, and it is sound for the reason the design says.** All three `permanent` pins are
  `trigger=named`, so they are found forever and cannot be aged out; the sixth pin `e686905678d9` (scope `window`)
  is line 7414, which hashes exactly to that value and sits outside the window at both heads
  (7508−80+1 = 7429; 7531−80+1 = 7452). Growing the log by 100 and by 2000 lines keeps rc=0 and never turns a
  permanent pin into a finding — **no permanent pin requires deleting history to satisfy**. Caveat is F-R7-3.
- **The fabricated-hash story is mechanically reproducible and is not "committed then fixed".**
  `git log --all -S` for `52783fdb2231711b3d1d` and `8c5ca70ef005a2e30497` → **empty**: those strings exist in no
  commit on any ref and in no tracked file at HEAD, and `ACCOUNTED_BLOCKS` was introduced *by* `091a085bc`
  (`git log -S'ACCOUNTED_BLOCKS'` → that commit alone). So the brief's hypothesis is refuted: the fabricated pair was
  never committed (and cannot have been "fixed in the same commit" — a commit is immutable). What *is* verifiable is
  the mechanism: substituting real-16-hex heads with invented tails into the pre-fix constants makes the tool print
  precisely the published token, `sha256=52783fdb2231,8c5ca70ef005`. The disclosure says "in the first draft", which
  is consistent with an uncommitted draft; the event itself is unverifiable from git, and the record does not claim
  otherwise.
- **Every published aggregate re-measured this session, all exact at `975822b56`** against the PR base
  `7b906b4322` (the PR base is *not* `master`: merge-base with master is `12cc9843e`, 25 commits):
  **11 commits, `+850 −0` over 7 paths net, per-commit sum `+1041 −191`, `0` paths under `packages/**`**.
  At the real head `3dddba2b2`: 12 commits, `+873 −0`, `+1064 −191`, still 0 packages. GitHub's own
  `pulls/513` agrees: `commits=12 changed=7 add=873 del=0`.
- **Gates reproduce.** `EB3`: the guard grades `git diff --diff-filter=A <since>...HEAD` under the evidence root —
  `base=HEAD~2` → `added=0` and `base=HEAD~9` → `added=1` (`…/alpha6-513/verify-verbatim-quotes.mjs`), at both
  heads, confirming both the corrected `added=0` and the origin of the wrong `added=1`: the verifier landed at
  `e1171d505`, so it is "new" only from a base ≥4 commits back. `docs-sync --check` →
  `docs=106 notes=4 plans=69(0 declaring) findings=0 blocking=0 contracts=20 pairs compared`, rc=0.
  Settlement → `DSH-SETTLEMENT-VERDICT BLOCKED-BY-MARKER marker=title-prefix matches=0 candidates=0`, **rc=1**;
  with the stale `--expected-head 975822b56…` it refuses first:
  `HEAD_DRIFT: event says head 975822b56…, API says 3dddba2b2…`, rc=2 — the gate caught the same drift I hit.
- **Zero-rejection history holds exactly as corrected.** Round 1 `every finding taken`; round 2 `All six findings
  accepted`; round 3 `all 12 findings accepted … Nothing was argued away`; round 5 `Nothing rejected this round`;
  round 4's disposition title itself says `one MAJOR is rejected as filed`. So "rounds 1/2/3/5 zero-rejection,
  round 4 had rejections" — the claim that replaced the "first such round" superlative — is true.
- **The 363-vs-370 disclosure is accurate and its explanation is verified.** `363` at `091a085bc`, `370` at
  `975822b56`; `git show --numstat 975822b56` = `31` log lines + `7` verifier lines, and those 7 lines *are* the
  `scope: 'window'` pin for log line 7491 — the body's stated reason, checked line by line, not just consistent.
- **Pointer-detection robustness that did hold:** a pinned designation copied byte-for-byte; a trailing space
  (window and permanent); two wrapped log lines joined; U+2060, U+200B, U+202D, U+FEFF inside `.artifacts`; a wrap
  *after* the `.artifacts` token; vocabulary present with no path; path present with no dot outside the window
  (correctly not a designation).
- **`unaccounted-block` / `quote-duplicated` do hold inside the recognised marker spelling** — every plant I built
  with ` ```text ` or `> ` was caught. The hole in F-R7-1 is the marker universe and the render/scan split, not the
  counting logic.

## LEGITIMATE-CORRECTION COSTS (measured, not reasoned)

| future edit (all ordinary) | token + rc | what it takes to go green | steps | disclosed? |
| --- | --- | --- | --- | --- |
| a review-record line in the log mentioning `` `.artifacts/…` `` inside the window | `accepted=false trigger=named … findings=1` rc=1 | add one `PINNED_SCRATCH_POINTERS` entry with hash + reason (hash must be computed outside the tool — F-R7-4) **or** drop the dot (`artifacts/…`) → `rc=0` | 1 edit either way | **yes** (header :35–37, :43–45) |
| new ` ```text ` sample anywhere in the addendum | `unaccounted-block count=1 lines=68` rc=1 | `ACCOUNTED_BLOCKS` entry + reason | 1 edit | yes in shape (:77–79), not in volume (any sample, anywhere, forever) |
| new blockquote anywhere in the addendum | `unaccounted-block count=1 lines=68` rc=1 | same | 1 edit | same |
| trailing space on a **window**-pinned log line | `accepted=false … sha256=0e6ddd9ab5a7` rc=1 | delete the space | 1 char | **yes** (:44–45) |
| trailing space on a **permanent**-pinned line (6916) | 2 findings, `pinned-line-no-longer-present sha256=7a65186074fb` rc=1 | restore the byte **or** move a permanent pin (= history repair per :98–100) | 1 char, or a move the record calls repair | partially — same sentence as the recoverable case |
| log re-saved CRLF | `pinned-line-no-longer-present` ×3 (all three permanent pins), `findings=3` rc=1 | byte-exact restoration; the pin universe is the whole log | unrecoverable forward | **no** |
| addendum re-saved CRLF | `quotes=2 drift=2` rc=1 | restore endings | 1 op | no |
| `## ` heading inserted between anchor and quote | `section-block-count expected=1 found=0 section_lines=7-15` rc=1 | move the heading below the quote | 1 move | no |
| `### ` heading in the same place | `verdict=ok` rc=0 | nothing | 0 | n/a (level ≤ anchor level is what binds) |
| `# 这是注释` inside a new fenced sample between anchor and quote | **both** quotes red (`found=0` on 7-19, `found=2` on 20-82) rc=1 | move the sample out of §1 | 1 move | **no** (F-R7-5) |
| correction to source line 75, rendering untouched | `source-moved pinned=8ba2ab061ffb actual=b89e18c5deb8` rc=1 | — | — | **yes** (:27, :67–68) |
| correction to source 75 **and** the published fence, pin not moved | same `source-moved` rc=1 | move the hash | 1 | yes |
| all three moved together (source, rendering, pin hash) | `verdict=byte-equal chars=148 bytes=178 … sha256=b89e18c5deb8`, `verdict=ok` **rc=0** | done | 3 files, 1 run | yes |

Reading: the common costs are one edit each and are disclosed; the two undisclosed ones (CRLF on permanently pinned
lines, `#`-inside-a-fence redrawing the section) are the ones a future author will hit without the header telling
them it was coming, and the first has no fix that is not byte archaeology. Nothing here is *permanently*
unverifiable in the sense of "no reachable green" — every row above reaches rc=0 in ≤3 edits except the CRLF-on-log
case, which needs the original bytes back.

## MY LIMITS (not passes)

- **Renderer evidence is python `markdown-it` 3.0.0 at the `commonmark` preset**, not GitHub's actual renderer.
  No `cmark`, `cmark-gfm`, `pandoc`, `commonmark`, `mistune` or node `markdown-it` binary/package is available in
  this environment. GFM adds constructs to CommonMark (tables, autolinks, strikethrough, task lists) and does not
  remove tilde fences or the optional space after `>`, which is why I treat the equivalence as safe — but I did not
  prove `~~~text` renders identically *on github.com*, only that it is CommonMark-valid.
- **No browser/GitHub render of the HTML comment hiding the plant.** `A1`'s invisibility rests on the standard fact
  that a CommonMark HTML block is emitted raw; I verified markdown-it emits it raw, not that GitHub hides it.
- **`scope` abuse is demonstrated on a synthetic pin**, not on the real pin list: I did not rewrite
  `PINNED_SCRATCH_POINTERS` in a tracked file to retire a real mention, so F-R7-3's "silent retirement" is proven
  for the rule, not observed in this PR's history.
- **I did not test the pointer detector's treatment of the log at sizes beyond 2000 appended filler lines**, nor
  the interaction of the 80-line window with a `.artifacts` mention that is itself the *last* line (edge case not
  attempted).
- **Settlement gate graded live against the real PR**, so `matches=0 candidates=0` is the state of the PR *now*
  (`head=3dddba2b2`), not a blob-pinned reproduction of the token the body published at `975822b56`; the published
  invocation now returns `HEAD_DRIFT` rc=2 by design and I could not reproduce it at its own head because the gate
  refuses a moving target and `--expected-head` cannot be pointed at a non-head commit.
- **The fabricated-hash draft state is unrecoverable from git** (see F-R7-1/F-R7-4 discussion): I reproduced the
  *mechanism* and proved the strings were never committed; I cannot prove the author's first draft existed or that
  the run output was as quoted. Absence of evidence here is structural, not a pass or an accusation.
- **PR body comparison is against the live body only** (37501 bytes at `3dddba2b2`). I did not diff it against the
  body as published at `975822b56` — I never captured that version, and it is not retrievable (bodies are not
  versioned). The brief's 36,400 figure is therefore unverifiable, not refuted.
- **I did not audit the other four tracked files' prose** (PENDING-GATES.md, the blocker doc, the execution plan,
  the rulings doc) — out of scope for this round; `docs-sync` and `grep` say nothing about their numbers.
- **`found=5 pinned=6` was checked at four heads only** (`02738256c`, `091a085bc`, `975822b56`, `3dddba2b2`) plus
  synthetic growth. I did not sweep history.
- Nothing in this review was run under root vitest, `pnpm build`/`install`, `ci-pr-gate --full`, against :3080,
  inside Lane 1's worktree, or against `/home/armourpiercer/deepseek-harness`. No delegation was used.
- **Concurrent writer active on this branch.** Between my start and end checks the head advanced by one commit. Any
  number in this report that names `975822b56` was measured on blobs pinned at that ref; anything measured "live"
  (settlement gate, PR metadata, `docs-sync`) was measured at `3dddba2b2`.
