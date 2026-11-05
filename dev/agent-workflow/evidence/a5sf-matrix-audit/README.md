# a5sf-matrix-audit — P4 consistency audit of `TOOL-ACCEPTANCE-MATRIX.md`

**Date:** 2026-11-05
**Base:** `origin/master` @ `a636a00c5` (#600, `fix(a5sf): close the boot PUBLISH window`)
**Branch:** `task/a5sf-matrix-audit-20261105`
**Scope:** the three current plan documents (`TOOL-ACCEPTANCE-MATRIX.md`,
`ALPHA5-SANDBOX-BACKLOG.md`, `current-implementation-plan.md`) and every evidence pointer /
commit / sha256 / section they cite. **No Host boot, no product-code change, no grade or
`V@B` change.** Evidence-file edits are limited to the coordinator-approved F-16 sha
attribution correction and F-17 interval-name normalisation (no verdict, number or measured
result changed).

## 1. Method (mechanically reproducible)

1. Extracted every `dev/agent-workflow/evidence/a5sf-*` and `evidence/a5sf-*` token from the
   three documents, brace-expanded (`a5sf-p1-0{1..8}`), split comma-joined lists, and resolved
   the short form against `dev/agent-workflow/` exactly as `ci-pr-gate` Q5 does.
2. Existence at HEAD; for each `tested=` / `证据 HEAD` commit: `git cat-file -t`, then
   `git cat-file -e <commit>:<artifact>` for the artifact the row names.
3. Recomputed every cited digest from the object it names:
   `git show <commit>:packages/runtime/src/plugin/live/agent-bindings.mjs | sha256sum`, and
   `git rev-parse <commit>:packages` for the tree-equality claims.
4. Recomputed Q7 product-surface drift:
   `git diff --name-only <baseline> HEAD -- packages scripts tests/paths.mjs package.json pnpm-lock.yaml`.
5. Resolved every `§n`, `BL-nn` and `M-nn` against the headings / IDs of the file it names.
6. Cross-checked, per row: the prose claim (⑥/⑦) against its ⑧ grade and ⑨ `V@B`; backlog
   statuses against matrix rows and plan; and the archive-boundary vocabulary in
   `a5sf-archived-gate`, `a5sf-boot-seam`, `a5sf-boot-publish` against the matrix.

## 2. Pointer table

Legend: **OK** = exists and the named artifact is present in the cited commit; **OK(hist)** =
commit exists and is the run-time HEAD recorded by the evidence, not the evidence's own commit;
**MISS** = no such path at HEAD. Counts: **47 distinct evidence pointers, 46 resolve, 1 does
not** (the one MISS is a planned output of the BLOCKED BL-21, not a broken evidence claim).
Four backlog *entry* filenames (`a5sf-bash.mjs` etc.) are planned and absent (see F-15).

| # | Pointer (cited by) | Verdict |
|---|---|---|
| 1 | `a5sf-preflight/README.md` (M-01, M-02, §3 G2) | **OK**; `44babbfcf` contains it; §13 = 8/8 PASS; §12.8.3 = RULING |
| 2 | `a5sf-fs-tools/README.md` (M-03) | **OK**; `93b007cd2` contains it |
| 3 | `a5sf-deferred/green-probe.log`, `all-a5sf-node-suites.log` (M-04) | **OK** |
| 4 | `a5sf-assembly/README.md` (M-04) | **OK**; `84e9348fc` contains it |
| 5 | `a5sf-p0/README.md` (M-04) | **OK**; `6d1b7a1fb` contains it |
| 6 | `a5sf-acceptance/README.md` (M-04) | **OK**; recorded run HEAD `6d1b7a1fb` **OK(hist)** (the README itself lands later) |
| 7 | `a5sf-g1/G1-GATE-REPORT.md` (M-05/M-08..M-21) | **OK** |
| 8 | `a5sf-p1-07/OS-RUNNER-EVIDENCE.md`, `a5sf-p1-08/TERMINAL-LIFECYCLE-EVIDENCE.md` | **OK** |
| 9 | `a5sf-p1-01/` … `a5sf-p1-08/` (§3 G1, backlog) | **OK** (all eight) |
| 10 | `a5sf-product-assembly/README.md` (M-06, §0-B1) | **OK**; §10-B1 exists |
| 11 | `a5sf-bl16-grep/{README.md,arms.json,grep-arms.mjs}` | **OK** |
| 12 | `a5sf-archived-gate/archive-race-arms.test.mjs` | **OK**; `61554ae1d` contains it |
| 13 | `a5sf-rg-ancestors/README.md` | **OK** |
| 14 | `a5sf-search-live/` + `README.md` (M-06/M-07) | **OK**; run record is `run-record.as20261102r1.json` (renamed by #597), `overall=PASS`, 6/6 PASS, `teamSha=c658d974d` |
| 15 | `a5sf-search-live/row6-diagnosis.md` (backlog BL-16) | **OK** |
| 16 | `a5sf-r1/` … `a5sf-r5/` (backlog R1–R5) | **OK** (all five) |
| 17 | `a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md` (plan §6) | **OK** |
| 18 | `a5sf-p3/inventory/` (backlog BL-21 planned output) | **MISS** — planned only; BL-21 is blocked (F-19) |

Commit/digest checks:

| Claim | Verdict |
|---|---|
| `tested=44babbfcff…` (M-01/M-02) | commit **OK**, contains `a5sf-preflight/README.md` |
| `tested=93b007cd2…` (M-03) | commit **OK**, contains `a5sf-fs-tools/README.md` |
| `tested=c658d974d…` (M-06/M-07) | commit **OK**, contains `a5sf-search-live/README.md`; `packages` tree `9609403c…` = baseline `1fd0d9fca` `packages` tree; `scripts`/`tests/paths.mjs`/`package.json`/`pnpm-lock.yaml`/glue all equal |
| `44babbfcf` vs baseline `1fd0d9fca` (M-01/M-02) | `packages/**` diff = **116 paths**, exactly as claimed; named files present; glue `df9b46af…` ≠ `6d256096…` |
| `#598`/`#599`/`#600` artifacts | commits **OK**; each contains the README/arm file it adds |
| `639ed01539` (pinned host) | not a Team commit (expected); matches `tests/paths.mjs#TEST_USE_BASELINE_SHA` |
| `§41.6` / `§30.2` / `§29.4` | exist in the frozen Architecture (`## 41.6`, `## 30.2`, `## 29.4`) |
| `§9.2` in `a5sf-acceptance/README.md` (M-04) | **MISSING** — the README has §9 items 1–6, no §9.2 (F-09) |
| `b17cb939b` glue = `df9b46af…` (`a5sf-archived-gate` §5) | **WRONG** — at `b17cb939b` it is `6d256096…`; `df9b46af…` is `44babbfcf` / pre-#594 (F-16; evidence file, not edited) |

Q7 drift today: baseline `1fd0d9fca` → HEAD = **36** product-surface paths (the M-06/M-07 cell
had said 34, the #598-time value).

## 3. Findings

Severity: **H** = a reader can take a false current claim from it; **M** = document-to-document
contradiction or unresolvable pointer; **L** = stale count/wording/section number.

| ID | Sev | File:line (pre-fix) | Claim | Contradiction | Minimal fix | Applied? |
|---|---|---|---|---|---|---|
| F-01 | H | matrix §1.1:79–87 | re-cut reset M-06/M-07 to `V@B=yes` | the two rows are `V@B=no`; #598/#599/#600 moved the surface again (36 Q7 paths) | split the paragraph into "at re-cut" vs "now"; all four rows now `no` | **yes** |
| F-02 | H | matrix:45,46 (M-06/M-07 cells) | "重切后复位为当前断言 … `ENFORCE-PARTIAL` / `V@B=yes`", "故本行按 §1.1 记 … `V@B=yes`", "本行等级 … `V@B=yes` 与 live 证据均不变" | the ⑨ cell is `no`, and the same cell's appended correction says "本行 `V@B` 于同日退回 `no`" | make every sentence say the reset was historical and the row is now `V@B=no` | **yes** |
| F-03 | H | matrix §3:142,152 | "重切后 `V@B=yes`" / "已复位为 `V@B=yes`" | same as F-01 | same past-tense correction | **yes** |
| F-04 | H | backlog:54 (BL-16) | "重切后复位为 `ENFORCE-PARTIAL` / `V@B=yes`" | matrix M-06/M-07 are `ENFORCE-PARTIAL` / `V@B=no` | same correction, plus "needs a new-tree live run" | **yes** |
| F-05 | M | matrix:45,46 | "仍不覆盖：boot resume loop 与 child factory …（非工具下发路径）" | `#599`/`#600` close the boot loop (BS1–BS5); BS4 proves a mid-boot publish **is** reachable from a tool dispatch | name only child factory + cross-process; say the boot loop is covered | **yes** |
| F-06 | M | plan:37 | "矩阵全部 `NOT_WIRED`" | 4 rows are `NEEDS_REVALIDATION`, 3 `ENFORCE-PARTIAL`, 1 `BOUNDED-DEFER` | state the actual partial wiring | **yes** |
| F-07 | H | plan:38 | "R1/R3 未开始（BL-09 / BL-11）" | backlog BL-09 and BL-11 are `DONE` (PR #541 / #545) | mark R1/R3 DONE; only BL-37 open | **yes** |
| F-08 | M | plan §3:60–63 | ready queue starts with BL-09/BL-10, then BL-14..BL-18 | BL-09/BL-10 are DONE; BL-16 live is stale; BL-17..20 READY | rewrite the queue's first three items to current status without re-ordering work | **yes** |
| F-09 | L | matrix:43 (M-04) | "acceptance §1/§9.2" | `a5sf-acceptance/README.md` has no §9.2; the cited fact is §9 item 2 | `§9（第 2 条）` | **yes** |
| F-10 | L | matrix:40 (M-01) | "授权 baseline 早于 63 个产品面路径" | the baseline was re-cut; the sentence reads as current | "重切前 baseline …" | **yes** |
| F-11 | L | matrix:45,46 | "Q7 因此在 34 条路径面上拒绝" | now 36 paths at #600 | "#598 时点 34 条；至 #600 为 36 条" | **yes** |
| F-12 | M | backlog:53 (BL-15) | "PARTIAL（写轴 live 已证…）" | matrix M-02 is `NEEDS_REVALIDATION` / `V@B=no` for the same evidence | name the stale tree and the matrix state | **yes** |
| F-13 | M | backlog:110 (BL-21) | `BLOCKED（需真实 Host boot）` | the source-evidenced half is DONE (`NATIVE-SOURCE-INVENTORY.md`) and the matrix cites "BL-21 库存已查明" | status `IN-PROGRESS` (source half DONE, runtime half BLOCKED) | **yes**（coordinator decision） |
| F-14 | M | backlog:113–114 (BL-22/BL-23) | `BLOCKED（依赖 BL-21）` | matrix shows BL-22 (FS group) and BL-23 (search group) partially met (M-01..M-04, M-06/M-07) | `IN-PROGRESS` / `PARTIAL`, not blanket `BLOCKED` | **yes**（coordinator decision） |
| F-15 | L | backlog:55–58 (BL-17..BL-20) | entry files `a5sf-bash.mjs`, `a5sf-web.mjs`, `a5sf-ptc.mjs`, `a5sf-new-cli.mjs` | none exists at HEAD; they are planned filenames from the memo | mark as "planned, not yet created" or point at the memo row | **yes**（marked planned, not created） |
| F-16 | M | `a5sf-archived-gate/README.md:248` | "before (origin/master `b17cb939b`): `df9b46af…`" | `b17cb939b`'s glue is `6d256096…`; `df9b46af…` is `44babbfcf` / pre-#594 | relabel the commit (or the digest) | **yes**（dated correction; numbers unchanged） |
| F-17 | L | evidence READMEs + matrix | `drop→commit` (archived-gate, matrix) vs `quiesce→commit` (boot-seam, boot-publish); `commit → post-commit re-drop` vs `… residency re-drop` | same two intervals, two names each | one canonical name per interval | **yes**（canonical names; CORRECTION blocks untouched） |
| F-18 | M | matrix §0 / §1.1 | grade vocabulary is listed but not defined; the brief's `ENFORCE` and `N/A` are not in the closed enum | a reader cannot derive `ENFORCE-PARTIAL` / `NEEDS_REVALIDATION` semantics from the table; only `ci-pr-gate` Q5/Q7 encodes the pairing | add a one-line definition per grade (or cite the gate law) | **yes**（definitions added; ⑧ cells untouched） |
| F-19 | L | backlog:110 | output `evidence/a5sf-p3/inventory/` | absent (planned output of a blocked item) | leave as planned; do not pre-create | **no** (expected) |
| F-20 | L | matrix:142 | `evidence/a5sf-p1-0{1..8}/` | a brace expression, not a literal path | list the eight paths or keep the brace as documented shorthand | **yes**（eight literals） |
| F-21 | L | backlog:52–54 | status words "**live G2 已取得**" / `PARTIAL` | §0's closed status set is `DONE / IN-PROGRESS / READY / BLOCKED / DEFERRED` | map prose to the closed set | **yes**（closed-set status word; prose kept） |
| F-22 | H | backlog:120,123 (BL-30, BL-33) | `BLOCKED（依赖 BL-09/BL-11）` / `BLOCKED（依赖 BL-11）` | BL-09 and BL-11 are both `DONE` in the same table (PR #541 / #545) — a blocker on a met dependency is stale, and BL-33 has no remaining named blocker | `READY` (or name the actual remaining dependency, e.g. G3) | **yes**（coordinator decision） |

## 4. Fixes applied (this branch)

Round A — P4 audit (no grade, `V@B`, or evidence content changed):

1. `TOOL-ACCEPTANCE-MATRIX.md` §1: heading date 11-04 → 11-05; §1.1 distinguishes "at the
   re-cut" from "at HEAD" and states all four rows are `V@B=no`; §3 G1 cell and closing
   paragraph use the same past tense. Reason: F-01/F-03.
2. `TOOL-ACCEPTANCE-MATRIX.md` rows M-06/M-07: three "reset / `V@B=yes`" sentences made
   historical; the "boot resume loop + child factory" residual corrected to "child factory +
   cross-process, boot loop closed by #599/#600"; 34 → "34 at #598, 36 at #600". Reason:
   F-02/F-05/F-11.
3. `TOOL-ACCEPTANCE-MATRIX.md` M-04: `§9.2` → `§9（第 2 条）`; M-01: "授权 baseline" →
   "重切前 baseline". Reason: F-09/F-10.
4. `ALPHA5-SANDBOX-BACKLOG.md` BL-16: reset claim made historical and `V@B=no` stated; BL-15:
   names the `44babbfcf` tree and the matrix's `NEEDS_REVALIDATION` / `V@B=no`. Reason:
   F-04/F-12.
5. `current-implementation-plan.md` §1: "全部 `NOT_WIRED`" → the actual grade mix; "R1/R3 未开始"
   → `DONE`; §3 items 1–3 rewritten to the current backlog statuses. Reason: F-06/F-07/F-08.

Round B — coordinator decisions (2026-11-05, same branch):

6. **F-22**: BL-30 → `READY（原记 BLOCKED（依赖 BL-09/BL-11，二者已 DONE））`; BL-33 →
   `READY（原记 BLOCKED（依赖 BL-11，已 DONE））`.
7. **F-13/F-14**: BL-21 → `IN-PROGRESS（源半已 done、runtime 半被 boot 阻；原记 BLOCKED…）`;
   BL-22/BL-23 → `IN-PROGRESS（原记 BLOCKED（依赖 BL-21）；矩阵 M-01..M-04 / M-06..M-07 的
   部分覆盖 in prose）`. No `PARTIAL` status word invented.
8. **F-18**: §0 now defines `ENFORCE`, `ENFORCE-PARTIAL`, `NEEDS_REVALIDATION`, `N/A` and
   `NOT_WIRED`, and states `V@B` is orthogonal. `ENFORCE`/`N/A` are explicitly not admitted
   into the ⑧ machine enum until `ci-pr-gate`'s ENUM is extended (not this PR).
9. **F-17**: canonical interval names in the three evidence READMEs and the matrix:
   `quiesce → commit` and `commit → post-commit residency re-drop`. Dated `CORRECTION` blocks
   were left verbatim.
10. **F-16**: archived-gate §5 first bullet relabelled to the pre-#594 `44babbfcf` tree; the
    `b17cb939b` value `6d256096…` stays in the second bullet; a dated correction says the old
    attribution was wrong. No digest, verdict or measured number changed.
11. **F-15**: four backlog entry names marked `（planned, not created）`.
12. **F-20**: `evidence/a5sf-p1-0{1..8}/` replaced with the eight literal directories.
13. **F-21**: BL-14/BL-15/BL-16 status words mapped to the closed set (`IN-PROGRESS`), prose kept.

## 5. What I did not change, and why

- **No grade and no `V@B` cell changed.** `ENFORCE-PARTIAL` without `V@B` is the documented
  host-free grade (M-03 uses it); `NEEDS_REVALIDATION` is the Q7 answer for an expired live
  tree. **No grade change is recommended.**
- **F-19** (`evidence/a5sf-p3/inventory/`) is left as a planned output; pre-creating it would
  fake BL-21's runtime half.
- **`ENFORCE`/`N/A` are still not ⑧ machine values.** Adding them to the table's prose
  vocabulary is safe; adding them to the ⑧ closed set without extending `ci-pr-gate`'s ENUM
  would create a gate trap, so the gate change is deliberately deferred to its own PR.

## 6. Gates

| Gate | Command | Result |
|---|---|---|
| Document checks | `node scripts/doc-checks.mjs` | **rc=0** |
| Whitespace | `git diff --check origin/master...HEAD` | **rc=0** |
| Matrix validator | `node scripts/ci-pr-gate.mjs --only state-freshness` | **pass** — 21 rows, 0 claimed, drift 36 (Q5/Q7 green) |
| Full merge gate | `node scripts/ci-pr-gate.mjs` | **fail only on environment legs**: `install` (`ERR_SQLITE_ERROR`, no pnpm store), `typecheck` (no `node_modules`), `artifacts-at-head` (`not-run reason=install`); `graph-parse`, `kit-home-guard`, `state-freshness`, `blueprint-fence`, `citability` pass; `census` skip. Not a pass. |

The matrix path comes from the authority contract; the Q5/Q7 grading lives in
`scripts/ci-pr-gate.mjs` (~246–392) and is reached by the `state-freshness` leg.

## 7. Can the table be trusted?

**Before this audit: M-06 and M-07 were the rows whose grade looked defensible only because
nobody re-read the sentence next to it.** Their ⑧ `ENFORCE-PARTIAL` is legitimate (host-free
half, like M-03), but the cell simultaneously said "重切后复位为当前断言 … `V@B=yes`" and
"本行等级 … `V@B=yes` 与 live 证据均不变" while the ⑨ column — and the very end of the same
cell — said `no`. After the fixes, every row's `V@B` is consistent with its prose, and the four
stale rows say why they are stale (M-01/M-02 now name both path layers: the 116-path
`44babbfcf` vs baseline gap, and the 36-path baseline..HEAD gap).

**No row has a ⑧/⑨ contradiction under the new §0 definitions.** `V@B` is orthogonal by
construction: `ENFORCE-PARTIAL` asserts a mechanism measurement, `V@B=no` says the *current*
baseline tree was not the measured one. The closest cases are M-06/M-07 (`ENFORCE-PARTIAL` /
`no`), and they are consistent.

**One definitional edge, left as a grade decision:** M-19 (`state tools`) and M-20
(`present`/`skill`/`attachment`) are encoded `NOT_WIRED`, but the new definition says
`NOT_WIRED` = "the mechanism applies but the surface is not bound", while those tools have no
data-plane I/O and might belong in `N/A`. They are not a ⑧/⑨ contradiction (⑨ is `no` either
way); re-encoding them is a grade decision, so it is reported rather than changed.
