# R431-R2 — Dimension 2 (台账叙事) independent review

Reviewer: read-only gate reviewer (d2). Subject: PR #431 @ d5c340cb5. Brief: `.artifacts/briefs/R431-R2-review-brief.md`.

## Worktree self-check (pre-flight)

```
$ cd .worktrees/rr-431 && pwd && git rev-parse --short HEAD && git status --porcelain | wc -l
/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/rr-431
d5c340cb5
0
```

CONFIRMED: detached @ d5c340cb5, clean (0 porcelain lines), no checkout performed.

## Check 1 — equivalence claim recomputation (R-G3-1 / R-REM-1 re-open)

Command (verbatim, in `.worktrees/rr-431` @ d5c340cb5):

```
$ for r in 1e3ec41a6 72e51b1f9 c2b03fc34; do echo $r $(git diff --name-only d8f40c0d $r -- packages scripts | wc -l); done
1e3ec41a6 34
72e51b1f9 34
c2b03fc34 34
```

Named refs + `origin/master` support:

```
$ for r in d8f40c0d origin/master 1e3ec41a6 72e51b1f9 c2b03fc34; do printf '%s ' $r; git rev-parse --verify -q $r^{commit} | cut -c1-9 || echo MISSING; done
d8f40c0d d8f40c0da
origin/master c2b03fc34
1e3ec41a6 1e3ec41a6
72e51b1f9 72e51b1f9
c2b03fc34 c2b03fc34
$ git diff --name-only d8f40c0d origin/master -- packages scripts 2>&1 | wc -l
34
```

FINDING (confirmed true): the row's claim "= 34 files for X = origin/master, 1e3ec41a6, 72e51b1f9" reproduces exactly. `origin/master` is `c2b03fc34`, so the brief's third ref is the same object as `origin/master` — the row names the ref both ways and neither figure is inflated. No ref was fetched; all four commits resolve locally.

## Check 2 — R-G4R-2 re-characterisation vs the ruling file

Ruling `RULING-B-G4R-3.md:33-46` and `:126-127`:

```
33: 1. **`R-G4R-2` was misattributed.** The carried risk reads "this host cannot create unprivileged
34:    user namespaces ⇒ every native workspace-write leg is ENV_BLOCK here". Measured:
35:    `bwrap` is indeed unusable, but the host's Landlock launcher works — from the main runtime
36:    checkout `probe()` returns `partial`. The G4-R phase-2 worktree returned `unusable` because
37:    `native/system/packages/*/bin/` is **gitignored** (`native/system/.gitignore: packages/*/bin/`)
38:    and the documented fresh-worktree provisioning (`git clone --local --no-hardlinks`,
39:    TEST_METHODS §2) does not copy untracked files. The same leg genuinely PASSED on 2026-10-26
42:    A provisioning gap was recorded as a product-level FAIL.
46:    why the fresh worktree's runtime clone lacked the launcher binaries.)*
126: **If the Jobs native leg still cannot run after the provisioning fix**, it is recorded as
127: `ENV_BLOCK` with the probe receipt and referred to the promotion reviewer as the explicit ruling
```

Ledger row re-characterisation (git show HEAD, added line):

```
**R-G4R-2 re-scoped**: measured FALSE as stated — `bwrap` is unusable here but the host's Landlock
launcher works (`probe()` = `partial` in the main runtime tree); the recorded `u74a:native-ctl-unaffected`
FAIL came from a **gitignored native asset absent in a fresh worktree's runtime clone**
(`native/system/.gitignore:4 packages/*/bin/` + `git clone --local --no-hardlinks`), not a host limit;
fixed in #429 (pinned manifest + provisioning + pre-flight into every run record + ENV_BLOCK only on
probe∧typed-refusal)
```

NO CONTRADICTION. Element-by-element: (a) falsified premise = "host cannot create unprivileged user namespaces ⇒ ENV_BLOCK" — identical in both; (b) `bwrap` unusable but Landlock works, `probe()` = `partial` on the main runtime tree — identical; (c) real cause = gitignored `packages/*/bin/` absent from the fresh worktree's `clone --local --no-hardlinks` runtime tree — identical, same `native/system/.gitignore` line cited; (d) "provisioning gap recorded as product-level FAIL" (ruling:42) matches the row's "recorded `u74a:native-ctl-unaffected` FAIL came from … not a host limit". Only wording variance: row condenses the ruling's "ENV_BLOCK with the probe receipt + referred to the promotion reviewer" (ruling:126-127) into "ENV_BLOCK only on probe∧typed-refusal"; the ruling's two conditions (probe receipt, reviewer referral) are preserved in substance, the row's "typed-refusal" is its summary of the referral gate. Not a factual conflict — P3 wording note only.

## Check 3 — new evidence rule text

Ruling `:76-78`:

```
76:    **New evidence rule adopted with this ruling:** an equivalence row must cite the record's own
77:    `teamSha` read out of the JSON, name the reference commit, and carry the verbatim diff output;
78:    a prose "is empty" is not evidence.
```

Ledger row: `**New evidence rule adopted**: an equivalence row must cite the record's own teamSha read from the JSON, the reference commit, and the verbatim diff output; prose "is empty" is not evidence.`

Rule text is a faithful condensation: all three required elements (record's own teamSha **from the JSON**, named reference commit, verbatim diff output) and the negative clause are present, none weakened. Provenance of the cited teamSha verified against the JSON itself:

```
$ grep -o '"teamSha":[^,]*' dev/agent-workflow/evidence/u7-g4t-20261027/live/crash-reclaim-1/run-u5-crash-2026-10-28T05-53-32-928Z.json | head -3
"teamSha": "d8f40c0daeaa513dbb0cb98a875df5c2ceb8e8b4"
```

The row's cited record is the JSON the ruling says holds teamSha `d8f40c0d` — the rule is stated and instantiated consistently, and the ruling itself demonstrates compliance (recomputation block at `:60-68`, all three counts 34, matching my run).

## Findings

- P3 — `GATE-LEDGER.md` (G4-R takeover row), ENV_BLOCK clause: row says "ENV_BLOCK only on probe∧typed-refusal" where `RULING-B-G4R-3.md:126-127` says ENV_BLOCK requires the probe receipt **and** referral to the promotion reviewer. Substance preserved; "typed-refusal" is an unglossed paraphrase of the referral gate, mildly less precise than the ruling. Evidence: quotes above.
- P3 — `RULING-B-G4R-3.md:58` says the counts were "re-checked … in the worktree that produced this PR, where master = `a23f11a3b`", while `origin/master` in rr-431 is `c2b03fc34`. Not a defect (34 holds for every reference point I measured, including both), but the ledger row says "origin/master" without pinning which commit — recommend pinning the SHA next time, per the row's own new evidence rule.

## Verdict

**PASS-WITH-FINDINGS** — dimension 2 (台账叙事) is factually sound. All recomputable claims reproduce (34/34/34, plus `origin/master` = `c2b03fc34` = 34); the R-G4R-2 re-characterisation does not contradict the ruling file's account on any of its four elements; the new evidence rule is stated faithfully and instantiated against the real JSON (`teamSha` = `d8f40c0daeaa…`). Findings are P3 documentation-precision only; none blocks the ruling or the ledger row.
