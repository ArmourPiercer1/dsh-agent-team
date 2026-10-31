# Round-8 independent records review — PR #513 (attack the label convention, the block scanner's own edges, the pointer rules, and the unread prose)

**VERDICT: 3 BLOCKER / 2 MAJOR / 3 MINOR / 3 INFO**

Read-only. No tracked file was written at any point: `git status --porcelain | wc -l` → `0` and `git diff --stat | wc -l` → `0` in `.worktrees/alpha6-gov` at both start and end (measured below); every mutation ran on copies under `/home/armourpiercer/projects/dsh-agent-team-lane-2/.artifacts/alpha6-s0/rev8-513/` with `cwd` inside the copy. The mirror at `…/rev8-513/minimal/` is byte-identical to the `ed4dc5ae3` blobs (sha256 `04f1481a…` verifier, `ddf004ae…` addendum, `073a0cfb…` source, `eb13a404…` log) and the clean run reproduces exactly: `verdict=byte-equal` ×2, `found=3 pinned=6 window=80 findings=0 verdict=ok`, rc=0 — note `found=3` at this head (the three `permanent` pins only; round 7's `found=5` was at its own heads).

**Renderer evidence, named:** python `markdown-it 3.0.0`, `commonmark` preset (same implementation round 7 used), plus `micromark 4.0.2` from this repo's `node_modules/.pnpm` as a second CommonMark-family parser. No live GitHub rendering was observed; nothing below claims GitHub-specific behaviour beyond what these two implementations show, except where flagged as a limit.

**Escalation rule, inherited from round 6/7 and used unchanged:** the outcome "the document publishes no quote a reader can see, or publishes a corrupted rendering, while the tool prints `verdict=byte-equal` rc=0" was graded BLOCKER in round 7 (F-R7-1 and its A20 limit case). Round 8 reproduces that exact outcome with only document edits against the fixed version, and the `.mjs` header sentence claiming it is closed is false on arrival for the sixth consecutive round. That makes the finding class BLOCKER again, not a new severity invention.

---

## F-R8-1 (BLOCKER) — the accounting covers only blocks the scanner's line-regex can see; a corrupted publication of the pinned row sits in plain view — as a paragraph, as a lazy continuation of an already-accounted blockquote, or as a whole fenced block whose fence lines end in a lone CR — and the run prints `verdict=byte-equal` rc=0

**Claim it breaks** (header of `verify-verbatim-quotes.mjs` @ `ed4dc5ae3`):
- :33–:37 “Every block in the document, in **every** marker spelling this file can see — ` ``` `, `~~~`, longer runs, with or without an info string, plus every `>`-prefixed run — must be accounted for: the designated quote, or byte-equal to a pinned source line, or named in `ACCOUNTED_BLOCKS` with a reason.”
- :39–:42 the restyle probe: “Two 30-character probes from the head and tail … Publish the row as an indented code block, a table cell or a paragraph and something still contains those 30 characters ⇒ `quote-restyled`.”
- :20–:22 / round-7 disposition: “The round-7 attacks all relied on the check reading a block other than the one it was told to read; there is no longer such a read.” — true, and irrelevant: nothing needs to read the wrong block when the corrupted publication is invisible to both block-accounting and to two probes that look only at the head and the tail of the line.

The corruption used in every variant changes one word inside the head-30 (`调度器持久状态 → 调度器持久態`) and one token inside the tail-30 (`index.ts → index.js`). Between the two probes the corrupted row is byte-identical to the source line for ≈100 consecutive characters — far above the header's disclosed open boundary (“a restyle reproducing no 30 consecutive source characters … is not detected as one”, :48–:49, repeated in the round-7 disposition). The disclosure does not cover this: this publication **does** reproduce 30+ consecutive source characters and is still not detected.

**Variant a — corrupted row as a plain paragraph after the fence.** Mutation (copy of `minimal/`): insert `CORRUPT75` immediately after the `dsh-quote:S0:75` fence closer. Command: `node dev/agent-workflow/evidence/alpha6-513/verify-verbatim-quotes.mjs` with cwd in the copy. Verbatim:

```
DSH-VERBATIM name=S0:75 verdict=byte-equal chars=137 bytes=161 source_bytes=161 sha256=8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca
DSH-VERBATIM-VERDICT quotes=2 drift=0 verdict=ok
DSH-SCRATCH-POINTER-VERDICT found=3 pinned=6 window=80 findings=0 verdict=ok
```
rc=0. markdown-it renders the corrupt row as a visible `<p>` (`reader sees 持久態/index.js row: YES`). Paragraph lines are not in the scanner's block taxonomy at all (only fences and `>` runs are blocks), and the probe misses because both probes were corrupted.

**Variant b — corrupted row as a CommonMark lazy continuation of an already-accounted blockquote.** Mutation: insert `CORRUPT75` (no `>` prefix) directly after line 5 (last `>` line of the banner blockquote, the block accounted by hash `52783fdb2231…`). The scanner's quote run stops at the last `>` line, so the block's text — and its hash — are unchanged, still matches `ACCOUNTED_BLOCKS`; the reader's blockquote is four lines, not three. Verbatim rc=0 (same three verdict lines as above), with render evidence:

```
RENDER: corrupt row renders inside the SAME blockquote the check accounted by hash: True
```
This falsifies the accounting claim in its own words: the block is “accounted” by a hash of text that is not what the block contains for a reader.

**Variant c — an entire fenced block invisible to the scanner because its opener/closer lines end in a lone CR.** Mutation: append to the addendum
```
**§1 附注（另一渲染）**：

```text␍
<CORRUPT75>
```␍
```
where `␍` is a single `\r` at line end (`doc += '\n```text\r\n' + corrupt + '\n```\r\n'`). Scanner: `FENCE_LINE = /^\s*(`{3,}|~{3,})(.*)$/` cannot match a CR-terminated line because JS `.` excludes `\r` and `$` then fails — the opener is not a fence, the closer is not a fence, the row inside is not a block. CommonMark treats `\r` as a line ending, so both renderers show exactly what a reader sees:
```
<pre><code class="language-text">| 调度器持久態 | `storageDomain.open(defineDomain(...))` KvTable（CAS/条件写）+ `domain/changed` | `packages/storage/storage-domain/src/index.js` |
```
(markdown-it; micromark agrees). Check output: `quotes=2 drift=0 verdict=ok`, `findings=0`, rc=0. A second code block publishing a corrupted copy of the pinned row, in the same visual style as the quote itself, with zero bookkeeping. The same `\r` quirk is why re-saving the whole addendum as CRLF turns `designated-missing` (measured, rc=1, fail-safe) — the scanner's fence recognition silently depends on LF-only line endings while the renderer does not.

**Reproduces at the live head:** yes — all three variants run against the `ed4dc5ae3` blobs (`$D/attacks/r8_1_corrupt_paragraph`, `r8_4_lazy_continuation`, `r8_11_cr_fence`, all rc=0).

## F-R8-2 (BLOCKER) — the scanner's fence closer accepts ≥4-space indentation that CommonMark does not: re-indenting the published quote's closer from two spaces to four makes the reader's quote block swallow the parenthetical, the anchor line and the *next* labelled fence, while both cases print `verdict=byte-equal` rc=0

**Claim it breaks:** header :27–:32 “the labelled block IS the quote and must be byte-equal to the pinned source line” — i.e. the equivalence between the scanner's designated block and the block the document publishes. Closer regex: `` /^\s*`{3,}\s*$/ `` matches a closer at any indentation; CommonMark closes a fence only with an indented-≤3-spaces marker. The published document's closers are indented exactly **two** spaces — one edit away from the divergence.

**Mutation (single whitespace edit, nothing else):** line 18 ``  ``` `` → ``    ``` ``. Command: copy of `minimal/`, edit that one line, run the verifier. Verbatim:

```
DSH-VERBATIM name=S0:75 verdict=byte-equal chars=137 bytes=161 … sha256=8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca
DSH-VERBATIM name=S0:79 verdict=byte-equal chars=232 bytes=356 …
DSH-VERBATIM-VERDICT quotes=2 drift=0 verdict=ok
DSH-SCRATCH-POINTER-VERDICT found=3 pinned=6 window=80 findings=0 verdict=ok
```
rc=0. Render evidence, markdown-it: one `<pre><code>` block of 1020 characters containing the quote row **and** the fake-closer line **and** the round-3 parenthetical **and** the S0:79 anchor text **and** the literal ```` ```text dsh-quote:S0:79 ```` line, closed at the original two-space closer:
```
RENDER: one rendered code block swallows fake-closer+parenthetical+anchor+S0:79 fence (len=1020): True
```
Micromark 4.0.2 independently: `code blocks rendered: 1`, `first block swallows S0:79 fence line: true`. With a corrupt row inserted after the fake closer (`r8_3b_indented_closer_corrupt`), the corrupt row renders **inside the code block that carries the label** (`RENDER: corrupt row renders INSIDE the code block that carries the label: True`) and the run still prints `verdict=byte-equal` rc=0 — the reader's quote is not the pinned line; the scanner's quote is. This is the `end`/`start` line-range attack from the brief, realised via the closer-indentedness edge: the scanner's block range and the rendered block diverge, and the probe's skip-range logic is keyed to the scanner's ranges.

**Reproduces at the live head:** yes (`$D/attacks/r8_3_indented_closer`, `r8_3b_indented_closer_corrupt`, rc=0 at `ed4dc5ae3` blobs).

## F-R8-3 (BLOCKER) — “HTML comments are NOT skipped … the hiding place became a finding instead of an invisibility cloak” holds only for plants; the labelled quote itself can wear the cloak: wrap it in `<!-- -->` and the document publishes no quote at all to a reader while the run prints `verdict=byte-equal` rc=0

**Claim it breaks:** header :35–:37 (“a fence inside a comment is still a block that exists, so the hiding place became a finding instead of an invisibility cloak”) and the round-7 disposition's fix of round 7's A20 limit case (“`r7-delete-published-fence designated-missing`”, “Delete the quote and the label goes with it ⇒ `designated-missing`”). Hiding the quote is not deleting it.

**Mutation:** insert `<!--` before line 16 and `-->` after the S0:75 closer. Verbatim rc=0:
```
DSH-VERBATIM name=S0:75 verdict=byte-equal chars=137 bytes=161 … sha256=8ba2ab061ffb557639cb6b397c1eb0392294cd33f109a629ea35a70ebd47e8ca
DSH-VERBATIM-VERDICT quotes=2 drift=0 verdict=ok
```
Render proof (markdown-it, `commonmark` preset — it emits the HTML comment raw, i.e. browser-invisible; this is the same evidence class round 7 used): the full pinned row occurs **only inside the raw comment** — `quote bytes hidden in raw HTML comment (reader-invisible under markdown-it): True`. Combined with a corrupt paragraph after `-->` (`r8_2c_comment_wrap_corrupt`, rc=0): `FULL pinned row visible outside comment? False`, `CORRUPT row visible? True`. That is round 7's BLOCKER outcome, re-derived: a document whose only reader-visible rendering of the row is the corrupt one reports `verdict=byte-equal`. Note the asymmetry the check has now baked in: the comment is invisible to readers but visible to the scanner, so the label + correct bytes exist for the machine only.

micromark 4.0.2 with default settings escapes raw HTML (`&lt;!--`), under which the hidden fence renders as visible text — one reason the invisibility claim is pinned to markdown-it/CommonMark here; live GitHub comment-hiding was not re-verified (limits).

**Reproduces at the live head:** yes (`$D/attacks/r8_2_comment_wrap`, `r8_2c_comment_wrap_corrupt`, rc=0).

## F-R8-4 (MAJOR) — the invisible-fold set is wider, not closed: every Mn combining code point walks a new designation past the detector (U+FE0F VS16, U+FE0E VS15, U+E0100 VS17, U+034F CGJ), which is exactly round 7's `A4_vs15` class surviving the fix

**Claim it breaks:** header :50–:55 “the fold has to **see** them instead of hiding them, so detection runs on a copy normalised by NFKC, invisible marks removed, whitespace collapsed … the set of things an editor could type has to be closed, and the only way to close it is to say what **classes** of character it removes. … the code point at log :7496 is invisible in exactly the way round 6's list was” — `INVISIBLE = [\p{Cf}\p{Zl}\p{Zp}\p{Cs}…]` names four classes and omits **Mn** (nonspacing marks), which NFKC does not strip either.

**Command:** copy of `minimal/`, append one log line inside the live window
`- round-8 探针：本轮记录正本落盘于 \`.artif<U+FE0F>acts/alpha6-s0/rev8-513/planted.md\``
(the invisible point spliced inside the token; the line carries 「正本」「落盘」 so a working detector would red it by name), then run the verifier. Verbatim:
```
### r8_5_ufeff  cp=U+FE0F  rc=0  DSH-SCRATCH-POINTER-VERDICT found=3 pinned=6 window=80 findings=0 verdict=ok
### r8_5_vs15  cp=U+FE0E  rc=0  found=3 … findings=0 verdict=ok
### r8_5_vs17  cp=U+E0100 rc=0  found=3 … findings=0 verdict=ok
### r8_5_cgj   cp=U+034F  rc=0  found=3 … findings=0 verdict=ok
```
Controls confirming the detector works: `U+00AD → findings=1 verdict=regression`, `U+2060 → findings=1`, `U+200B → findings=1` (Cf class). Round 7 measured `U+FE0E … findings=0` as a finding against the *old* code; the round-7 fix explicitly moved from enumeration to classes — and Mn is still outside every class used. A durable log line can still designate a gitignored scratch path invisibly to the machine and visibly to every reviewer (VS16 renders zero-width after most glyphs). Same mechanism applies inside the publishing document: the quote-restyle probe's fold shares the same INVISIBLE set, so a restyled copy with Mn marks inside its probe-strings also evades `quote-restyled` (not separately measured; same code path, `checkQuote`'s `fold`).

Round 7 graded the identical outcome (a new designation walking past) **MAJOR**; graded MAJOR here for the same reason, not BLOCKER, because the damaged record is the log-pointer guarantee rather than the quote verdict line.

**Reproduces at the live head:** yes — ran against `ed4dc5ae3` blobs (`$D/attacks/r8_5_*`).

## F-R8-5 (MAJOR) — “round 5 — a designation copied byte-for-byte … (fixed: duplicates red)” is false for pinned designations: a byte-identical duplicate of a permanent pinned line prints `reason=pinned-designation-duplicated accepted=false` and `findings=0 verdict=ok` rc=0

**Claim it breaks:** header :15–:16 (“fixed: duplicates red”); and any reading under which the verdict line is the answer — the output simultaneously prints `accepted=false` for the duplicate and `verdict=ok`. The findings arithmetic (`verify-verbatim-quotes.mjs:299` `findings: unaccepted.length + absent.length`) never counts the duplicated-duplicate lines it pushed at :295–:297.

**Command:** copy of `minimal/`, append to the log a byte-identical copy of the line whose raw sha256 is `7a65186074fb99b06ba0610ba7295fcfd7038f73474989a3efabb2206a9303f3` (a `permanent` pin, log line 6916), run the verifier. Verbatim:
```
DSH-SCRATCH-POINTER accepted=false reason=pinned-designation-duplicated sha256=7a65186074fb99b06ba0610ba7295fcfd7038f73474989a3efabb2206a9303f3
DSH-SCRATCH-POINTER-VERDICT found=4 pinned=6 window=80 findings=0 verdict=ok
```
rc=0. Two durable records now designate the same fact in two places — round 5's exact defect — and the machine's verdict is ok. (Unpinned duplicates do red, via `trigger=window → unaccepted`; that is presumably what “duplicates red” was measured against, but the diagnostic that exists specifically for pinned duplicates is decorative.)

**Reproduces at the live head:** yes (`$D/attacks/r8_6_dup_pinned`).

## F-R8-6 (MINOR) — the disclosed CRLF cost `found=0 findings=6` does not reproduce at any measurable head; the real cost is `found=4 findings=10` at the commit the claim was written (`960b1886b`) and `found=3 findings=9` at the live head

**Claims it breaks:** header :57–:60 “Re-saving the log as CRLF prints `found=0 findings=6 verdict=regression`”; the round-7 disposition comment (“CRLF on the log measures `found=0 findings=6` (all six pins …)”); the round-7 log entry at `ed4dc5ae3` (“CRLF 重存的代价量成 `found=0 findings=6`”). `found=0` is unreachable: CRLF cannot hide `artifacts/` from the mention regex, and the three `named` permanent pins are found at any window position.

**Command:** copy of `minimal/` with the log blob at `960b1886b` (`git show 960b1886b:dev/agent-workflow/SESSION_ROUTER_LOG.md`) re-saved CRLF and the verifier blob from the same commit; same for the `ed4dc5ae3` pair. Verbatim:
```
r8_16 (log+verifier @ 960b1886b, log CRLF): rc=1  DSH-SCRATCH-POINTER-VERDICT found=4 pinned=6 window=80 findings=10 verdict=regression
r8_7  (log @ ed4dc5ae3, CRLF):                  rc=1  DSH-SCRATCH-POINTER-VERDICT found=3 pinned=6 window=80 findings=9 verdict=regression
```
Understatement direction matters: the raw-hash pins also break the **in-window found lines** (each ends in `\r` now), so the true repair cost of one EOL accident is 9–10 findings, not 6. Fail-safe red either way, so MINOR — but it is a published measurement that no measurement at any reachable commit reproduces, which is the defect this PR has been trying to legislate out of existence.

## F-R8-7 (MINOR) — the body's newest “Retired forward” row, the round-7 disposition comment, and the round-7 log entry all attach the aggregate set `+856 −0 / 7 paths / 14 commits / per-commit +1299 −443` to head `01a3ff68d`; that set is exactly the value at `960b1886b`, and the true set at `01a3ff68d` is `+1203 −0 / 8 paths / 15 commits / +1646 −443`

**Re-measurement (local git at these refs, and GitHub `pulls/513` for the live head):**
```
3dddba2b2: net=+873 −0 paths=7 commits=12 per-commit-sum=+1064 −191   (body head row, true — re-verified)
960b1886b: net=+856 −0 paths=7 commits=14 per-commit-sum=+1299 −443   ← the claimed “01a3ff68d” set matches THIS commit
01a3ff68d: net=+1203 −0 paths=8 commits=15 per-commit-sum=+1646 −443
ed4dc5ae3: net=+1227 −0 paths=8 commits=16 per-commit-sum=+1670 −443  (GitHub: commits=16 changed=8 additions=1227 deletions=0 — agrees)
```
The mislabelled row is self-incriminating in a way the author cannot have intended: the missing path is `dev/agent-workflow/evidence/alpha6-513/round7-report.md` (+347) — the file `01a3ff68d` **itself** committed; and the parenthetical “this round rewrote the verifier in place: 443 deleted lines” describes `960b1886b`, not the report-landing commit. This is precisely the violation class the body itself enumerates (F-R5-2 “numbers labelled with a head they were not measured at”) and it is published in three durable records (PR body addendum, disposition comment `6542508128`, log entry at `ed4dc5ae3`). MINOR because the numbers are true at the adjacent commit and arithmetic-only; it is not INFO because the whole subject of this PR is that published measurement sentences must be pinned to the head they were measured at.

## F-R8-8 (MINOR) — header claim “removing it ⇒ `# 围栏内注释行` currently measures `rc=0`” reproduces only for a bare line; the fenced sample that generated the round-7 false positive (F-R7-5) still measures rc=1

**Command:** two copies; (a) insert the line `# 围栏内注释行` between the anchor and the quote fence (not inside any fence); (b) insert ```` ```sh / # 围栏内注释行 / ``` ```` at the same place. (a) → rc=0. (b) → rc=1:
```
DSH-VERBATIM name=S0:75 verdict=unaccounted-block count=1 line=19 sha256=355794c12fcd8e859871bfd1983b2b98be5eed525ce21ec…
```
The section rule's false positive was indeed deleted, but a fenced sample is red again immediately, now via accounting — and the header's chosen token literally contains 围栏内 (“inside a fence”), so under its own name the claim does not reproduce. A reader of the header learns “fenced `#` samples are fine” and is wrong; they are fine only once added to `ACCOUNTED_BLOCKS`, which the very next sentence of the header says is the normal cost.

## F-R8-9 (INFO) — label-convention edges that are inert or fail closed, measured for completeness

- **Label twice in one info string** (```` ```text dsh-quote:S0:75 dsh-quote:S0:75 ````): green, `labelOf` reads only the first regex hit — no effect, no double-count.
- **One block bearing both names** (```` ```text dsh-quote:S0:79 dsh-quote:S0:75 ```` after deleting the S0:75 fence): cannot certify both — `S0:75 designated-missing found=0` rc=1. The “make two quotes share one probe/block” attack fails as designed.
- **Label nested in another fence**: the inner labelled opener is consumed as outer-block content → `designated-missing` ×2 rc=1. **Label on a fence that renders empty** → `drift chars=0 … sha256=e3b0c44298fc…` (empty-string hash is even visible) rc=1. **4-space-indented labelled fence** → `drift chars=141` rc=1 (indent is part of the body hash; also the reader sees list-continuation text, but the drift closes it first). **Rename label+quote together** → `designated-missing` rc=1 (disclosed cost, holds).
- **Two quotes sharing a probe is arithmetically impossible for these pins:** longest common substring of source :75 and :79 measured at `ed4dc5ae3` = **4 chars** (`" 调度器"`), < 30; no line in the source doc fold-contains either line's probes except its own.
- **Anchor duplicated on a separate line** → `unlocatable reason=Error: anchor "第 75 行，逐字" found 2 times, at line(s) 15,16` rc=1; on one line → rc=0 (disclosed rc=0, holds).

## F-R8-10 (INFO) — the blockquote label path is dead code while the header describes it as a live binding mode

`CASES` hard-codes `mode: 'fence'` for both quotes; the `mode === 'quote'` branch (label = `<!-- dsh-quote:<name> -->` directly above a `> ` run) can never execute for the two pinned quotes, so its own correctness (including its off-by-one-free `lines[block.start - 2]` lookup) is untestable by this document. Header :28–:29 presents it as part of the closed mechanism. A blockquote publishing a quote today is simply `unaccounted-block`. Not exploitable (it can only red, never green), but the header overstates what exists.

## F-R8-11 (INFO) — the false-positive side of the fold is real and widens the cost of ordinary log prose; and “nothing runs this file” is still true

Measured: an in-window log line mentioning a **tracked, non-scratch** path `evidence/artifacts/r8/notes.md` → `found=4 findings=1 verdict=regression` rc=1; the same with a full-width `／` (`artifacts／r8b/…`) → rc=1 (NFKC folds it back). So the rule “any fold-mention of any `artifacts/` anything inside the last 80 lines needs a permanent hash-pin” now governs ordinary prose — including this round's own evidence paths. Fail-safe by design and honestly disclosed as “a record, not a wall”, recorded here as a measured cost. Separately: `grep -rn "verify-verbatim-quotes"` at `ed4dc5ae3` matches only the file itself, `SESSION_ROUTER_LOG.md` and the now-tracked `round7-report.md` (the header's “only this file and the log entries” predates the report's landing) — no gate, workflow or test invokes the verifier; a red verdict blocks nothing mechanically.

---

## What I attacked and could NOT break (each: the command used, all at `ed4dc5ae3` blobs unless stated)

1. **Round 7's own six attacks, spot-rerun:** corrupted `~~~text` publication + correct bytes planted in a ```` ```text ```` fence inside an HTML comment (unlabelled) → `verdict=designated-missing … found=0` rc=1 (`r8_15_r7a_tilde_comment`). The disposition's enumerated rc=1 list is truthful for the variants as filed — the hole (F-R8-1/2/3) is in what they did not file.
2. **Block scanner edges (all fail closed):** unterminated fence → `verdict=unlocatable reason=Error: unterminated fence opened at line …` rc=1; one-giant-fence doc → `unlocatable` rc=1; `~~~` fence containing backtick lines → counted and `unaccounted-block` rc=1 (tildes are recognised); `> ` line inside a fence → consumed as body, `drift` rc=1; tilde closer `~~~~` cannot close a backtick block (matches CommonMark); CRLF addendum → `designated-missing` rc=1 (fail-safe; mechanism in F-R8-1c).
3. **Pointer aging vs deletion vs duplication:** growing the log 100 lines → rc=0 (aging works); deleting a `window`-scope pinned line → `findings=1 verdict=regression` rc=1 (`pin-deleted` now caught at any scope — round 7 F-R7-3 is genuinely fixed); trailing space on a `permanent` pinned line → `findings=2` rc=1 (header's formatter claim holds); the duplication hole is F-R8-5 only.
4. **Gates re-run in a full copy of the worktree (`$D/wt`, `cp -a`, cwd inside the copy):** `node scripts/docs-sync.mjs --check` → `docs=106 notes=4 plans=69(0 declaring) findings=0 blocking=0 contracts=20 pairs compared` rc=0; `node scripts/eb3-evidence-guard.mjs --new-since HEAD~3` → `EB3-EVIDENCE-GUARD pass added=1 bound=1048576 exempted=0 findings=0 base=HEAD~3` rc=0; `GITHUB_TOKEN="$(gh auth token)" node scripts/pr-settlement-gate.mjs --pr 513 --repo ArmourPiercer1/dsh-agent-team --expected-head ed4dc5ae3…` → `DSH-SETTLEMENT-VERDICT BLOCKED-BY-MARKER marker=title-prefix matches=0 candidates=0` rc=1 (statement, not malfunction; **no HEAD_DRIFT** — gate's API head equals `ed4dc5ae3…`).
5. **PR-body arithmetic, re-measured and TRUE at the heads they name:** per-commit table rows `2231ef67e +290 −0 (6 paths)`, `477d39311 +51 −15`, `dc6f14f5e +37 −11 (log line: +22 −0)`, `6937dd32b +6 −4 (1 path)`, `59f1f8132 +36 −9 (5 paths)`, `git diff --shortstat 7b906b432 59f1f8132` = `6 files +381 −0`; head row `3dddba2b2 +873 −0 / 7 paths / 12 commits / +1064 −191`; comment `6539962144` length = **20,282** chars; the `.artifacts` token at log :7491 sits at code-point 29 (byte offset 70 = code-point 29 of a CJK line — holds under code-point counting); PR #509 head `ff7f4b48b` has exactly 4 tracked `packages/runtime/review-defer/` files; `45211aa1f`, `98c25a091` exist; referenced `arc-a-protected-center.json` and `u6-arc-a-fitness.test.ts` exist; the addendum's structural claims on the source doc hold verbatim (§0 heading at :8, §1 at :18, :17 blank; the one-sentence conclusion at :115).
6. **The four other tracked files' prose** (PENDING-GATES.md delta, blocker doc, execution plan, rulings doc): read end-to-end; internally consistent with each other and with the addendum (scope wording, DORMANT, explicit-refusal rule, ENV_BLOCK, non-exhaustive-proof disclosure); every file:line and commit anchor I could reach from this box exists and says what is claimed; host-side file:line claims — see limits.

## Head-drift

Start: `git rev-parse HEAD` → `ed4dc5ae35e6e08d59e36f653e4d0135c2c2d8ff`, `git status --porcelain` → 0 lines, branch `alpha6/lane2-governance-20261031`; GitHub `pulls/513` `.head.sha` = same 40-hex, `state=open`. End: HEAD identical, `git status --porcelain | wc -l` → `0`, `git diff --stat | wc -l` → `0`. **No drift during this review**; no concurrent writer landed while I worked. Every number above names its commit; the only refs used besides the live head are `960b1886b`, `01a3ff68d`, `3dddba2b2`, `35166a30e`, `dc6f14f5e`, `59f1f8132`, `6937dd32b`, `477d39311`, `2231ef67e`, `ff7f4b48b`, all read via `git show`/`git diff` blobs into the copy.

## Legitimate-correction costs I measured (all on copies, verifier @ `ed4dc5ae3`)

| Legitimate edit | Result | Repair |
| --- | --- | --- |
| Add new fenced example anywhere in the addendum | `unaccounted-block` rc=1 | one `ACCOUNTED_BLOCKS` entry with reason (disclosed) |
| Bare `#` line anywhere | rc=0 | — (section rule genuinely gone) |
| One trailing space on any pinned log line | `findings=2` rc=1 | re-pin or revert (disclosed) |
| Re-save log CRLF | `found=3 findings=9` rc=1 | re-paste all 6 pins + re-verify 3 found lines — cost understated in header (F-R8-6) |
| Re-save addendum CRLF | `designated-missing` rc=1 | convert back to LF (fence recognition silently LF-dependent) |
| Any in-window mention of any `artifacts/` path (incl. tracked dirs, incl. full-width `／`) | `findings=1` rc=1 | new permanent pin |
| Anchor sentence quoted anywhere else in the addendum | `unlocatable` rc=1 | reword |
| Label renamed together with quote (disclosed) | `designated-missing` rc=1 | — record cost only |
| Log grows 100 lines / permanent pins age | rc=0 | aging works as designed |

## Limits — what I did NOT prove

- **Host file:line claims** (`profile.ts:209/213-218/:217`, `runtime.ts:101→118→119-121→123` and `:101-145`, `index.ts:396`, `types.ts:471`, storage-domain events) — the shared pristine baseline `/srv/workspace/dsh-stable-3-0.2.0-rc.2` **does not exist on this box** (the execution plan itself discloses this): **ENV-REFUSED**, neither verified nor refuted, my round adds nothing to the “two independent reviews” claim.
- **Reader-invisibility claims rest on markdown-it 3.0.0 (commonmark preset) and, where noted, micromark 4.0.2 defaults.** Live GitHub rendering (comment hiding, 4-space closer, CR line endings) was not observed; both my renderers are CommonMark-spec-faithful for the constructs used, and F-R8-1c/F-R8-2 stand on the CommonMark spec as implemented by both, not on GitHub behaviour.
- Mn-evaded `quote-restyled` probe (F-R8-4 last sentence) is mechanism-level, not separately measured.
- PR #507/#509 content claims (DORMANT face, zero consumers, `ALLOWED_CONSUMERS=[]`) not audited beyond the `ff7f4b48b` file count. No history sweep of `found/pinned` beyond three refs; no sweep of the SCRATCH_WORDS closed list beyond the pins that exist; window-size behaviour spot-checked at growth +100 only.
- The disclosure narrative that round 6's byte-equal was measured on trimmed text: taken from the record (round 7 verified the mechanism); not re-derived from history.
- Environment: did not run root vitest, `pnpm build`, `ci-pr-gate --full`, anything on :3080, in Lane 1, or in `/home/armourpiercer/deepseek-harness`; no delegation; `gh` used read-only (GETs only); no GitHub writes. `GET /issues/513/comments/{id}` 404s on this API — comments fetched via `issues/comments/{id}`.
