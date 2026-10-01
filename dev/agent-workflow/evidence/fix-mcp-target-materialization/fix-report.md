# Finding F (P1) — target-specific MCP materialization masked by aggregate results: fix report

**Branch**: `fix/mcp-target-materialization` (worktree `.worktrees/fix-mcp-materialization`)
**Base**: `31ad828d06b5bcca858532f1930ac10c51c0f1bb` (master at dispatch; PR base)
**Final HEAD**: `5e599790504d7072f5697f756884dcb536f655f4` (merge commit onto origin/master `8e18819c`)
**Commits** (31ad828d..HEAD, this branch's 7 + the merge):

| SHA | Round | Subject |
| --- | --- | --- |
| `30ed0d68` | 0 (predecessor) | repro (Finding F P1): RED regression matrix T1–T5 (real chain) + T6 unit (provider + 2-state engine + real repositories) |
| `9162e0f1` | 1 (pick) | fix(finding A / Blocker-1): the template scope carries its role identity — the leader is judged by its OWN (root) observation — **cherry-pick with -x of the #46 contract commit `1461a6f2bf2a5dc18f1a16b671b6ea5bf552e3fb`** |
| `a8ac28e8` | 1 (predecessor) | fix(F) increment (a): scoped-identity plumbing — the boundary scope carries its owning root + target instance; the gate performs the target's OWN boundary read |
| `8dddab74` | 2 (writer-of-record) | fix(finding F): target-specific MCP materialization — increment (b) + T4/T5 completion (T1–T6 RED→GREEN) — **recovered WIP base + the original's post-stash continuation, both (see DOUBLE-WRITER INCIDENT & RECOVERY)** |
| `66591aab` | 2 (writer-of-record) | test(p4t6): recompute the session-event-scan file pin 896 → 899 |
| `3725a203` | 2 (writer-of-record) | chore(lint): remove dead imports/constants/params — file-aware fingerprint zero-new vs baseline |
| `9063c671` | 2 (writer-of-record) | build(finding F): ship the rebuilt dist artifacts (34 files) |
| `5e599790` | 3 (sync) | Merge origin/master (8e18819c, post PR #46) — conflict resolutions below |

---

## 1. The finding (verified defect at base)

The requirement-facts gate evaluates MCP **materialization** per *scope*, but the
materialization view it read was an **aggregate** across all member instances of a
row — while the action being gated is TARGETED at one specific instance. Concretely:
instance A on a session whose fiber is mounted can mask instance B's failed/absent
mount (and cross-root instances conflate because the host row is multi-root):

- a target whose own materialization slot is `failed` still passes the gate (its
  failure is averaged away) → the 2-state engine feed then reports the member
  AVAILABLE for a boundary read that must be DOWN;
- a target on a DIFFERENT team root than the entry's boot root is judged against
  the boot root's instances;
- a target that is cold and INACTIVE (never materialized by design) was treated
  like a cold-but-resuming failure (blocking) instead of NOT-APPLICABLE.

**Design (fixed during the fix)**: the action gate performs the target's **OWN
boundary read** (per-instance / per-server — never an aggregate); the scope-level
verdict + incident/recovery bookkeeping stay **template-level CONSERVATIVE worst
case** (the scope cannot see per-target truth, so it folds worst).

## 2. The fix (production chain, no test weakening)

Production chain exercised by the matrix: `hostEntry.apply`
(`packages/runtime/src/plugin/host.ts`) + production glue
(`agent-bindings.mjs`) + the bridge double (`createAgentsDouble`,
`t12a-live-bridge.mjs`) + fiber doubles (`withdrawTools()` = the F15 supervisor
effect). Worlds build in ~2s on the double base — NOT a speed artifact (workload
identity vs the prior RED run was verified before the GREEN claim).

- **`host.ts` — `memberMaterialization` port** (increment (b)): the host answers a
  template scope with the TARGET's own view — v2 leaders resolve through their OWN
  root session (discriminated by the runtime plan's `schemaVersion`; the documented
  type lie is carried in the port's JSDoc), scope fold = conservative worst case.
  The 06:59:16 re-touch (post-incident) = `sessionOf` reworked to a block body with
  an explicit `raw` cast + comment — behavior-identical, type-safe (re-diffed vs the
  06:39 provenance patch: `wip-increment-b-diff.patch`; coherent continuation, no
  corruption — parent condition 1).
- **`provider.ts`** (increment (b) + T4): `deriveEngineFact` — materialization
  `failed` = DOWN (`available:false`) as the FIRST check, beating readiness + seed;
  pending/mounted/not-applicable never flip the feed (liveness adjudication: PENDING
  must never be a state only the blocked action can settle). **T4 (view-after-probe
  ordering)**: the materialization view is resolved per-subject INSIDE the
  `mcpServer` branch AFTER that subject's readiness probe — the aggregate probe of
  this very resolution may have just retired the fiber and stamped the slot
  `failed`; the view must read the POST-stamp truth (template scopes only; port
  absent → `undefined` → the legacy cold default).
- **`pending.ts`** (increment (b)): the 3-state `materializationFailed` flag is
  ORTHOGONAL to readiness (a masked failure = reachable + failed at once); the down
  fold = `unreachable || materializationFailed`.
- **`router.ts`** — `dispatchRecoveryIfOffered` (T1): the recovery OFFER is an
  offer, never a precondition — a rejected offer (ENVELOPE_OUT_OF_BOUNDS — the
  caller envelope lacks `request-control`) returns `undefined` and the original
  typed block stands; zero durable effect.
- **`types.ts` / `root.ts` / `admission/*`** (increment (a)): the scope carries its
  owning root + target instance as ORTHOGONAL optional coordinates (absent = the
  legacy single-root / template-only shape, byte-identical for every pre-fix
  caller); the gate reads the target's own boundary; the scope bookkeeping folds
  conservatively.

## 3. T1–T6: before → after

**Committed RED evidence**: `gate-red-matrix.log` (this evidence dir) — FRESH
capture @ `30ed0d68` in a temporary detached worktree (CMD-first line + full
output + TRUE-EXIT=1): `Test Files 2 failed (2)` / `Tests 4 failed | 1 passed
(5)` — the unit leg U1–U4 RED (U5 guard green) + the real-chain leg's RED
signature thrown during suite setup: "the action was ALLOWED — the
target-specific block is missing (the Finding F false OPEN)" (T1 follow-up B —
the pre-fix tree admits the target action the gate must block; T2–T5 share the
same pre-fix world construction, which throws at T1 before their `it` legs
execute — the RED-frozen shape). The original 06:15 scratch run of the same
matrix shows the identical totals (that capture lacked the CMD-first line and
was gitignored — the fresh capture is the committed evidence; substance
identical).

| Test | World / leg | BEFORE (RED @ 30ed0d68) | AFTER (GREEN @ 8dddab74+) |
| --- | --- | --- | --- |
| T1 | recovery OFFER on the blocked path | offer rejection REPLACED the typed block with ENVELOPE_OUT_OF_BOUNDS | offer rejected → `undefined` → the original typed block (COMPATIBILITY_BLOCKED) stands; zero durable effect |
| T2 | world A incident bookkeeping | scope incident recorded on the wrong (aggregate) state | scope verdict + incident/recovery bookkeeping = conservative template-level fold; target verdict = its own boundary truth |
| T3 | two instances, OPPOSITE slots (world A/B) | target's own slot masked by the aggregate | target judged by its OWN slot; the other instance's state never enters the target verdict |
| T4 | v2 leader, own root (world C) | pre-probe view stale (`mounted`) while the target verdict saw `failed` — same boundary, two truths, one passage | view-after-probe per subject: both verdicts read the same post-stamp boundary state |
| T5 | cold-inactive guard (world D) | direct double-handle dispose bypassed the glue registry → stale "live" = a state the guard never sees in production | fixture corrected to the production seam `world.root.live.dropResidency(instC.childSessionId)` (+assert `dropped === true`) — the ONLY test-file change in the fix commit; T5 assertions byte-identical (slot undefined at boot / followup admitted / resumed / slot mounted) |
| T6 | U1–U5 unit matrix (real provider + real 2-state engine + real repositories) | RED at base | GREEN |

**The four explicitly pinned worlds** (parent condition 2, confirmed): T1 =
world (1) the opposite-slot two instances; T3 = world (2) different roots, same
templateId; T4 = world (3) the v2 leader judged by its OWN (root) observation;
T5 = world (4) cold-inactive NOT-APPLICABLE. T2 = the world-A incident
bookkeeping leg (not a fifth world).

**Second test-hunk disclosure (reviewer r2 finding, verified)**: beyond the
T5 world-D fixture correction, the real-chain test carries ONE further change —
the **T2 `closeRows` query precision fix, committed in `a8ac28e8` (increment (a),
verified by per-commit diff: the RED-frozen 30ed0d68 call
`incidentsOf(world, A_ROOT, 'template:worker')` passed a scope argument to a
2-argument helper that SILENTLY IGNORED it — the scope filter was never applied
at RED); `a8ac28e8` replaced it with
`incidentsOf(world, A_ROOT).filter((row) => row.scope === 'template:worker')`
(+ a `firstClose` toBeDefined guard on the assertion). This is strictly
STRICTER than the RED baseline (the filter is now actually applied; the added
guard), matches the leg's intent, and T2 is GREEN-verified at the tip — a
precision correction, NOT a weakening. The +18 world-D fixture correction
(8dddab74) remains the only FIX-COMMIT fixture change; the `a8ac28e8` hunk is
disclosed here and in the PR body as the second test change on the branch.

**GREEN**: 2 files / 10 tests, TRUE-EXIT=0 (`gate-focused-matrix.log`; the
post-incident verification run on the 06:59 tree: `matrix-after-0659-writes.log`
— annotated: that capture predates the CMD-first log standard (no command line
in the file); its substance = the 10/10 post-incident GREEN matrix run, the
authoritative CMD-first GREEN capture is `gate-focused-matrix.log`).

## 4. The A-contract pick (content-verified)

`9162e0f1` = `git cherry-pick -x 1461a6f2bf2a5dc18f1a16b671b6ea5bf552e3fb`
(the #46 Blocker-1 contract — mandatory `role` on template fact scopes).

- **vs the contract commit `1461a6f2`: all 10 files byte-IDENTICAL.**
- **vs the post-sync tree `a6e2d90c`: identical EXCEPT `provider.ts`** — Blocker-3
  `7a4d7d60` landed on the #46 branch between `1461a6f2` and the sync;
  `1461a6f2` IS an ancestor of `a6e2d90c`. The sync merge (this branch) brings
  `7a4d7d60` in via origin/master — no re-pick needed.
- **One disclosed post-pick edit**: `requirement-d1-d3-decision-scoping.test.ts`
  drops the dead constant `SIGNAL_ID` (lint gate — pre-existing repo debt, present
  in the `1461a6f2`/master copy too; see §5). After the sync merge, my copy's
  deletion also won the auto-merge (their tree keeps the dead line — pre-existing
  debt on master, disclosed here, not re-introduced by this branch).

## 5. DOUBLE-WRITER INCIDENT & RECOVERY

**Full record (parent-authored, main-session, read-only):
`evidence/fix-mcp-target-materialization/double-writer-incident.md`** (tracked copy
of the scratch record; the scratch dir is gitignored).

Summary: the original builder (02e1512b) was misjudged dead after a failed
`send_message`; a replacement (this writer) was dispatched 06:44 while the original
was still live — undisclosed double-writer state until 06:51. The original's final
write burst 06:59:16–06:59:45 completed the T4 fix + the T5 fixture correction;
parent interrupt #3 at ~06:59:50; STOP confirmed ~07:00 ("was stopped before it
finished. It left no closing message."); quiescence verified 07:04:53 (mtimes
unchanged since 06:59:45). Parent then confirmed THIS writer as the single writer
of record, with the provenance condition quoted verbatim in commit `8dddab74`:
the committed increment-(b) work is **recovered WIP base (the 06:39/06:41 stash
patches — provenance snapshots preserved as evidence) + the original's post-stash
continuation, both** — not purely one writer's or the other's.

**Retention (no code lost — parent-confirmed 5-point verification)**: the stop
interrupted the original's TURN, not the files — the 06:59 writes landed on disk
before the stop and were carried into `8dddab74` intact; per-file provenance
(table in the incident record) was re-diffed against the stash patches (host.ts:
coherent continuation, behavior-identical). The throwaway
`zz-mtm-engine-check.test.ts` (original's, 06:53:33) was deleted per parent order
before any commit.

**NEW UNREVIEWED CHANGES disclosure**: the increment-(b) product hunks
(recovered WIP base + the original's continuation) and the T5 fixture correction
in `8dddab74` were authored OUTSIDE this writer's verified session — they entered
the branch under parent supervision and the T1–T6 GREEN produced on this tree;
any review pass that did not inspect them must be re-run over them.

## 6. Lint gate + the 8 dead-code removals (`3725a203`)

Pre-sync gate (file-aware fingerprint vs `baseline-lint-fp-fileaware.txt`, the
31ad828d reference — recipe: awk `file|line:col|rule`, `comm -23` = NEW): the first
run reported **8 NEW** no-unused-vars fingerprints (145 vs 143). Provenance was
established BEFORE fixing (identifier-count identity at `a8ac28e8` vs the working
tree — ZERO introduced by the fix WIP):

- **six are pre-existing at the baseline itself** — the baseline carries them at
  adjacent lines (router.ts 83:15 / provider.ts 87:8, 96:8, 442:32 / host.ts
  1790:37 / d1-d3 test 340:7); this branch's committed increments (the pick +
  increment (a)) shifted the lines → the line-based fingerprint surfaced them as
  "new" (line-shift artifact, not new debt);
- **two sit in the RED-matrix commit's new test files** (which postdate the
  baseline): the dead world constant in `mcp-target-materialization.test.ts` + the
  unused `TeamBlueprint` import in the unit test.

Removals: zero behavior change; no assertion touched; verified by the 15-file /
163-test focused re-run + full typecheck. Result: **137 = 143 − 6, NEW = 0**
(`gate-lint-postfix.log` + `gate-lint-fp-postfix.txt`). Repo-wide `pnpm run lint`
still exits 1 on the pre-existing baseline debt (the baseline's own run shows the
identical ELIFECYCLE exit 1 — `baseline-lint.log`; the gate is the zero-new
fingerprint comparison).

## 7. SYNC ROUND — controlled MERGE onto origin/master (NEW UNREVIEWED CHANGES)

**origin/master MOVED past the work-order's `2bfbca12`**: sync target = current
tip `8e18819c4e589f685b99a86769251565ee4fc7ec` = "Merge pull request #46 from
ArmourPiercer1/fix/persona-kind-preflight" — **the A contract (mandatory `role`)
is now ON MASTER** (the #46-integration warning's trigger). MERGE strategy (merge
commit `5e599790`, NO rebase, NO force-push; the subsequent push is PLAIN).
Divergence: 16 theirs (PR #46 + PR #47 effective-policy-reset-fallback) vs 7 mine;
merge-base `31ad828d` (clean fork point).

**15 conflicted paths — every resolution** (all are NEW UNREVIEWED CHANGES; any
review pass predating this merge does not cover them):

| file | resolution |
| --- | --- |
| `requirement-facts/types.ts` | **OURS** — origin/master's copy is byte-identical to the pick of `1461a6f2`; OURS = that + increment-(a) scoped-identity plumbing = strict superset (diff-verified) |
| `src/plugin/root.ts` | **OURS** — same shape: theirs == pure pick; OURS = pick + increment-(a) TemplateFeedContext plumbing |
| `test/persona-kind-provider-preflight.test.ts` (add/add) | **THEIRS** — OURS == pure pick; theirs = pick + their post-sync adjustments (+52 changed lines); contract marker `role:'member'` verified intact |
| `requirement-facts/provider.ts` | **UNION** — single conflicted hunk (types import): `type MemberMaterializationView` dropped (unused in the merged body — T4 computes the view per-subject; Blocker-3's persona lane uses `deriveMaterializationStatus`). ALL other hunks auto-merged cleanly: the T1–T6 WIP hunks and Blocker-3's persona-lane hunk are disjoint and coexist (verified in-tree) |
| `test/requirement-d1-d3-decision-scoping.test.ts` | **AUTO-merged** — my dead-constant removal (SIGNAL_ID) wins over their kept copy (their tree carries the same dead line — pre-existing master debt, §4) |
| `p4t6-session-event-scan.test.ts` | **RECOMPUTED on the merged tree**: 899 (mine) / 898 (theirs) → **900** = 898 + my two finding-F test files; the preflight file (both sides) counted once — no double count; justification block composed in the pin; scanner byte-identical; 10/10 green @ 900 |
| 10 dist files (provider/types/root `.js`/`.d.ts`/`.map`) | **REGENERATED** — fresh `pnpm build` 9/9 + `pnpm build:composition` on the MERGED tree (house rule: never keep stale artifacts — the fresh build defines the install surface); `check:artifacts` OK 1372 EXIT=0 |

`SESSION_ROUTER_LOG.md`: no conflict (their append only; this bookkeeping's own
append lands in the bookkeeping commit — both sides kept, union by append).

## 8. Gate totals (final)

**Pre-sync tip `9063c671`** (all logs in this evidence dir, legible standard:
command line first line + full stdout + TRUE exit):

| gate | result | log |
| --- | --- | --- |
| focused matrix (the 2 F files) | **10/10, TRUE-EXIT=0** | `gate-focused-matrix.log` |
| full suite | **9F\|4724P (4743) files/tests — EXACT debt-set match, zero new** (19 = t1 9 / t2 1 / d3 1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1; +3 file-level collections 0 tests; p6t1 flake 0) | `gate-fullsuite-final.log` |
| lint file-aware | **137 = 143 − 6 removed, NEW = 0** | `gate-lint-postfix.log` + fp |
| typecheck | **9/9, TRUE-EXIT=0** | `gate-typecheck.log` |
| check:artifacts | **OK 1372, TRUE-EXIT=0** (post-build, dist staged) | `gate-check-artifacts-postbuild.log` |
| p4t6 | **10/10 @ 899, TRUE-EXIT=0** | `gate-p4t6.log` |
| build | **9/9, EXIT=0** + dist delta 34 files co-committed (`9063c671`) | `gate-build.log` |
| combined tests w/ A contract | **15 files / 163 tests green** (focused 13 + F 2) | (in the focused-matrix run) |

**Log annotation (reviewer r2 finding, S3)**: `gate-fullsuite.log` (the
INTERMEDIATE full-suite run @ 66591aab, kept for the record) ends
`TRUE-EXIT=0` although 19 tests failed — a piped-capture artifact in its exit
line (the command's exit was captured through a pipe). It is NOT rewritten (no
history rewrite); the **authoritative pre-sync full-suite log is
`gate-fullsuite-final.log` (TRUE-EXIT=1, exact debt-set match)**.

**Merged head `5e599790`**:

| gate | result | log |
| --- | --- | --- |
| full suite | **20F\|4737P (4757) = exact 19-failure debt set + 1 p6t1-parallel flake** (documented 0–2 envelope; isolated re-run 9/9 green — zero NEW; committed isolated capture: `gate-p6t1-isolated-merged.log`, CMD-first + TRUE-EXIT=0) | `gate-fullsuite-merged.log` |
| check:artifacts | **OK 1372, TRUE-EXIT=0** | `gate-check-artifacts-merged.log` |
| typecheck | **9/9, TRUE-EXIT=0** | `gate-typecheck-merged.log` |
| lint file-aware | **136 fingerprints, NEW = 0** (143 − 6 my removals − 1 removed by their side) | `gate-lint-merged.log` + fp |
| p4t6 | **10/10 @ 900** (recomputed; pin asserts 900; fresh re-verification at the final tip `e45d22fe`: 10/10, TRUE-EXIT=0 — the evidence `.log` additions are not scannable `packages/**` files, no pin impact) | (recomputed; pin asserts 900) |
| focused 13 + F 2 + their new shipped-dist-smoke (combined A-contract + finding-F set) | **16 files / 165 tests green** — fresh CMD-first capture at the final tip | `gate-combined-a-contract-f.log` |

**Test-count arithmetic (corrected, S4)**: merged-head total 4757 =
**4719** (base `31ad828d` full-suite total) **+ 12** (PR #47:
governance-reset-tombstone 7→10 tests, remote-override-expected-generation
14→23 — per-suite counts verified against both trees) **+ 16** (PR #46:
persona-kind-provider-preflight 14 + persona-kind-shipped-dist-smoke 2) **+ 10**
(finding-F matrix: 5 real-chain + 5 unit) = 4757. Pre-sync tip total 4743 =
4719 + 14 (the pick carried only the preflight suite — the shipped-dist-smoke
arrived via the sync merge, not the pick) + 10 (F matrix). A reviewer's
decomposition using "+13" for the #47 delta was wrong; the verified delta is
+12, and no editable surface of this branch (fix-report / PR body / the
bookkeeping log entry) carried the "+13" form — this decomposition is the
recorded correction.

**shipped-dist smoke over the public export path (`composition-smoke.mjs`)**: RUN
(`gate-composition-smoke.log`) — **both legs fail PRE-EXISTING, not a regression of
this branch**: (host) the committed BASE dist (31ad828d) already carries the C1
fence `ctx.on` registrations (agent/created + agent/disposed + internal/get) that
the smoke's no-listeners expectation predates — the script is byte-identical on
master, last updated P9-S9, before the 0.1.7-rc.1 host upgrade round (the
production entry registers the fence BEFORE the config-validation rejection by
design — the authoritative install-surface gate is `check:artifacts`, green
above); (client) `clsx` node_modules resolution gap (zero client files changed by
this branch). Repairing the stale smoke is a separate authorized task.

## 9. No code lost / no test weakened (PR verification claims)

- **No code lost**: the double-writer incident record §Timeline — the stop
  interrupted the original's turn, not the files; the 5-point retention
  verification is parent-confirmed; per-file provenance re-diffed vs the stash
  patches (coherent continuation, behavior-identical).
- **No test weakened**: the ONLY test-file change in the fix commit = the T5
  fixture correction (world D): a production-seam fix (glue `dropResidency`
  instead of a direct double-handle dispose that bypassed the glue registry — it
  simulated a state the guard never sees in production) with the T5 assertions
  BYTE-IDENTICAL; T5 was RED before the correction (there is no weaker prior
  pass). The dead-code lint removals touch zero assertions. All RED matrix
  assertions are preserved verbatim. Plus the T2 `closeRows` query precision
  fix (committed in `a8ac28e8`, the increment-(a) commit — verified by
  per-commit diff): the RED-frozen 3-arg `incidentsOf` call silently ignored
  its scope argument (2-arg helper); replaced with an explicit filter —
  stricter than the RED baseline, T2 GREEN verified; the +18 world-D fixture
  correction remains the only FIX-COMMIT fixture change (see §3, the second
  test-hunk disclosure).

## 10. Post-#46 integration readiness (the role audit — parent's warning)

Audited ALL template-scope fact-scope constructions for the mandatory `role`
(post-#46 integration would otherwise emit MALFORMED_DTO at `$.role`): **ZERO
fixes needed** — every production `resolveFacts` call site (root.ts via the
pick) carries `role: requirementFactScopeRoleOf(leaderTemplateId, templateId)`;
the T6 unit matrix carries it via the same helper (with the Blocker-1 comment);
the real-chain tests go through production code; the legacy role-less
`templateScope()` (requirements/types.ts) is the DIFFERENT `RequirementScope`
contract (for ActionImpact — not a fact scope); `ControlSubject` (router.ts) is a
third, legitimately role-less type. Re-verified in-tree at the merged head (§7:
their Blocker-3 lane + my hunks coexist; the role audit holds on the union).

## 11. Unrun items (never claimed)

- **Real-host / browser verification: UNRUN** — all worlds run on the
  double-based production chain (host entry + production glue + bridge/fiber
  doubles); no live DSH instance, no browser, no :3080/:3180/~/.dsh touch (red
  line). The matrix is a regression matrix, not a live-host proof.
- composition-smoke: run with pre-existing failures (§8) — not green.

## 12. Residual debt + unblock conditions

- The 19-failure debt set + 3 file-level collections (0 tests each) + p6t1
  flake 0–2 = pre-existing at base `31ad828d`, unchanged by this branch
  (full-suite set-diff vs base = empty; merged head = same set + 1 in-envelope
  flake). Each has its own finding/task — none are this branch's to fix; unblock
  conditions live in their respective records.
- Predecessor-baseline extras (a2c7-subtree-matcher, plugin-dsh-compat): the
  predecessor's earlier baseline run flagged them; they PASS in this branch's
  runs (predecessor-baseline extras now green — no action).
- The stale `composition-smoke.mjs` (both legs) — separate authorized task.
- The dead `SIGNAL_ID` line in master's copy of
  `requirement-d1-d3-decision-scoping.test.ts` — pre-existing master debt
  (disclosed §4/§7; this branch's merge carries the deletion forward).

## 13. Red-line compliance

CORE PATCH BUDGET = 0 (upstream/test-use zero touch); zero :3080/:3180/~/.dsh
touch, no instance started; single worktree single writer (after the incident —
the incident itself is recorded §5); ZERO force-push (the sync is a MERGE commit;
the push is PLAIN fast-forward of the remote branch tip); `graph.yaml` untouched
(the parent owns the graph); no model/config changes.
## 14. RESIDUAL-F ROUND — external review of e45d22fe: R1 first-mount PENDING window + R2 initial-work cross-root read (NEW UNREVIEWED CHANGES — CHECKPOINT)

**CHECKPOINT — this section is the DRAFT-CHECKPOINT state of the residual-F
round, NOT the final ready HEAD.** The coherent fix (RED-first reproduction +
fix + rebuilt dist) is pushed as a Draft-branch checkpoint on the parent's
authorization; the remaining list at the end of this section is still open.
Any review pass predating the FINAL HEAD does not cover the remaining items.

The external review of `e45d22fe` (this branch's earlier Finding-F closure)
confirmed the ordinary follow-up path fixed and ruled **two residuals**:
**R1** (the first-mount PENDING window on member work delivery) and **R2**
(the initial-work gate's cross-root template-scope read, + two sibling
root-context read seams). Both are closed at this checkpoint by a
RED-first reproduction (committed at the pre-fix head) + the minimal fix.

### 14.1 R1 — the first-mount PENDING window (T7, world R1)

**The ruling (verbatim contract):**

> PENDING phase: attempting the prepare (the mount attempt) is ALLOWED (this
> is the bootstrap path — never blanket-block pending). BEFORE ACTUAL INPUT
> (real work delivery): the materialization SUCCESS must be verified. I.e.
> the gate sits before actual input, not before the prepare attempt.

**The defect (verified mechanism at base):** admission allows a fresh (never-
mounted) target whose template scope reads masked-pending-reachable (the
bootstrap shape, U4 — correct, unchanged). The delivery's
`prepareAgentForRequest` runs the target's own boundary `reconcileMcpSet`; a
first-mount rejection is caught per-server, stamps the slot `failed`, and is
swallowed (the C.6 per-server transaction). The `workDelivery.deliver` port
then called `handle.agent.followup(message)` **unconditionally** — real work
was delivered on the very passage that just failed the first mount.

**RED signature** (`gate-red-matrix-residual-f.log`, @ 698468d7, T7):

> AssertionError: the same-passage delivery was NOT blocked after B's own
> first-mount failure (the external residual-1 window: real work delivered on
> the failed-mount passage): expected undefined to be an instance of
> TeamRuntimeError

**The fix — contract-placement match (design placement stated):** the gate
sits AFTER the prepare attempt (the mount attempt stays ALLOWED — the PENDING
bootstrap is never blanket-blocked) and BEFORE ACTUAL INPUT (the throw is in
`deliver`, immediately before `handle.agent.followup`, the only model-visible
work input on that passage). This is the exact placement the ruling requires.
Mechanics:

- `prepareAgentForRequest` (`agent-bindings.mjs` L3126–3194) now returns the
  SAME-PASSAGE truth `{ mcpFailedApplicable }`: the APPLICABLE (target-set)
  servers whose slot is `failed` because **this passage's** mount attempt just
  failed — detected by the attempt clock (`lastAttemptAt`) advancing during
  the prepare (L3171–3189). A pre-passage failure is NOT reported: the
  cooldown skip leaves the slot untouched, an existing failed slot is already
  gated at admission (the feed's failed → DOWN, the ordinary Finding-F fix),
  and the human-reviewed recovery re-run MUST run its boundary (frozen T2
  leg, unchanged).
- `deliver` (L3465–3468) throws the plain boundary Error when the set is
  non-empty, BEFORE the followup. The work chain settles fail-closed
  (`workOutcome: 'delivery-failed'`, durable) and throws the typed
  `WORK_DELIVERY_FAILED` after settle (N3); zero model-visible input reaches
  the member on that passage. No new error code (zero contract change). The
  L3375–3389 message port (`send-message` style) is intentionally unchanged —
  outside the ruling's work-delivery scope (disclosed here).
- **T7 GREEN shape** (`gate-green-matrix-residual-f-a49bc5ec.log` @ a49bc5ec):
  B admitted (masked pending) → B's own first mount fails on its first
  passage → the same-passage delivery throws `WORK_DELIVERY_FAILED` with
  zero followup delta, the durable settle is `delivery-failed`, B's slot =
  the failed boundary truth, the NEXT passage is gated as failed at admission
  (T1 shape, `requiredScopeDown: ['template:worker']`), A keeps working.

### 14.2 R2 — the initial-work cross-root read + the two sibling root-context seams (T8, world R2)

**The ruling:** every consumer of the template-scope read seams must forward
the complete feed context (the target team's OWNING root). Three named seams:
(1) the `root-initial-work.ts` wrappers, (2) the activation fresh-create
`provider.ts` reads, (3) the CREATION PREFLIGHT `root.ts` reads. Pre-fix,
each wrapper/read dropped the context and the host port's legacy boot-root
fallback (`scope.rootSessionId ?? bootRoot`, `host.ts` L2085) let a cross-
root healthy boot instance stand in for the target root's own
materialization — the cross-root false OPEN (ADR 334–347 affected scopes
only; ADR 188–199 applicable materialization before work).

**RED signature** (`gate-red-matrix-residual-f.log`, @ 698468d7, T8 — driven
through the PRODUCTION v2 remote command `team.admitInitialWork` over the
captured S6 dispatcher, the exact production wiring):

> AssertionError: B's initial work was PERMITTED via the boot root's
> materialization (the external residual-2 cross-root false OPEN): expected
> true to be false

**The fix surface (file:line at a49bc5ec):**

| seam | fix |
| --- | --- |
| (1) `action-router/root-initial-work.ts` | L164 `TemplateFeedContext` import; L854 + L879 closure-input port types extended with optional `context?: TemplateFeedContext`; L995–997 the D-1 template-feed wrapper FORWARDS the gate's context (the gate passes `{ rootSessionId }` / `{ rootSessionId, instanceId }` from its own input — the target team's OWNING root); L1021–1023 the D-3 full-resolution read wrapper forwards the same. Initial work has no target instance → the root-only context is the complete one. |
| (2) `activation/provider.ts` fresh-create (+ `activation/types.ts`) | L745–770 both template read ports now carry `{ rootSessionId }` (L758, L765 — the activation's target root; no target instance exists yet: root-only is the correct scope for a not-yet-minted member). L65 import + L269/L303 `ActivationPorts` port types extended (optional context — pre-fix callers byte-identical). |
| (3) `src/plugin/root.ts` creation preflight | L1385–1391 `preflightTemplateFacts` scope now carries `rootSessionId: input.rootSessionId` (the future root — the pre-bind read resolves to ITS OWN root's not-applicable/seed truth, never the boot root's); L1419–1425 the D-3 read wrapper forwards `context ?? { rootSessionId: input.rootSessionId }` (the preflight classifier passes no gate context of its own — the default stands; a future context-bearing classifier wins). |

Per-seam ADR compliance: 334–347 (affected scopes only) — each seam forwards
only the target root's scope; no cross-root/cross-scope bleed remains on any
consumer of these reads. 188–199 (applicable materialization before work) —
initial work (Phase A gate), member creation (fresh-create), and team
creation (preflight) all now read the TARGET root's own materialization
before admitting work. Single-root worlds are byte-identical (the target
root = the boot root there — the legacy fallback and the forwarded context
agree).

**T8 GREEN shape** (@ a49bc5ec): two owned roots, same leader template; A's
leader mounted at boot (healthy), B's leader resident + FAILED (its own root
agent's first mount failed). B's initial work via `team.admitInitialWork`
v2 → the typed failure envelope `TEAM_RUNTIME_COMPATIBILITY_BLOCKED` with
gate details `{ status: 'BLOCKED_FATAL', blockedScopes: ['template:leader'],
unavailableSubjects: [B's server], recoveryDispatchAvailable: true }` (the
details ride under `error.details.cause.details` — the dispatcher's domain-
error passthrough, invariant 7 never rejects); zero delivery to B's root
(no root input, no terminal root-work fact); B's recovery NOT closed by A's
health (no incident closure under B, A's ledger untouched); A unchanged.

### 14.3 U4 pin update (disclosed)

`mcp-target-materialization-unit.test.ts` U4: **title + contract prose only
moved** — the title now states the corrected same-passage delivery-gate
contract (the mount attempt is admissible — bootstrap; the gate sits before
ACTUAL INPUT, not before the prepare attempt) and the body comment carries
the ruling's placement. **Zero assertion changes** (`u4Gate.kind ===
'allowed'`, `u4Read` defined, `obs.materialization === 'pending'` — the
bootstrap-liveness contract is intact); no other matrix leg changed (T1–T5,
U1–U3, U5 byte-identical between the RED and GREEN commits — the only test
diffs in `1b99ef40` are the two new legs, the two helpers/constants, the
`mcpFailures` boot param, and the U4 prose).

### 14.4 The ordinary follow-up path — already-fixed record + consumer state

The ordinary member follow-up path (`router.ts` `performAction`, the L621–
660 blueprint-seam region) ALREADY forwards the gate's feed context through
both blueprint seams — that exact-scope fix landed earlier on this branch
(§1–§3; the external review's "ordinary follow-up fixed" confirmation). It
is recorded here as the reference consumer for the residual round.
`reDriveActivation` (`activation/provider.ts` L482) was audited for the
sweep: it re-drives an already-admitted operation (replay/retry) and
performs NO template read-seam calls (blueprint config resolution only) —
no context to forward. The end-to-end CONSUMER SWEEP TABLE (every consumer
of the three seams + the ordinary follow-up, full-context verification, the
anti-partial-wiring proof) lands with the final batch (see remaining list).

### 14.5 T5 no-weakening (evidence note)

The T5 correction from the double-writer round (world-D fixture) remains
byte-identical in assertions; the external review recorded **NO WEAKENING**
— this checkpoint records that as the external reviewer confirmation (the
5-point parent-confirmed incident recovery, §5, is unchanged).

### 14.6 Pre-sync gate totals at `d0712695` (dist co-shipped)

| gate | result | log |
| --- | --- | --- |
| focused matrix (2 files) RED @ 698468d7 | 2 failed / 10 passed (T7+T8 named signatures) | `gate-red-matrix-residual-f.log` |
| focused matrix GREEN @ a49bc5ec (AUTHORITATIVE, clean tree) | 12/12, EXIT=0 | `gate-green-matrix-residual-f-a49bc5ec.log` |
| focused matrix @ 1b99ef40 + uncommitted fix (08:38 capture) | 12/12 — superseded as label by the re-capture, kept as evidence (annotated in-file) | `gate-green-matrix-residual-f.log` |
| full suite (all packages) | 4759 total = 4737 passed + 22 failed: the 19-failure debt set EXACTLY (t1-capability-schema 9 / t2-blueprint-hash 1 / d3-member-identity-context 1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1) + 3 p6t1-parallel flakes in this run + 3 zero-test file-level collections (debt §12); ZERO new failures from this round | `full-suite-a49bc5ec.log` |
| p6t1-parallel isolated re-run | green, EXIT=0 (the documented flake, §12) | `p6t1-isolated-a49bc5ec.log` |
| lint fingerprint (file-aware vs 31ad828d reference + 137-line base set, normalized line:col) | **NEW = 0** (111 current fingerprints, all pre-existing) | `lint-a49bc5ec.log` |
| typecheck | 9/9, EXIT=0 | `typecheck-d0712695.log` |
| check:artifacts | OK 1372, EXIT=0 (dist rebuilt: 13 tsc outputs + the agent-bindings.mjs glue placement, committed `d0712695`) | `check-artifacts-d0712695.log`, `build-composition-a49bc5ec.log` |

Provenance notes: the authoritative GREEN re-capture was demanded after the
parent caught the 08:38 capture's HEAD label (it ran at `1b99ef40` + the
uncommitted fix); both captures are kept. The first lint capture (08:41:39Z)
raced a concurrent full-suite temp dir (eslint walk crash, zero output) and
was replaced by the clean re-run (disclosed in-file; it carried no results).
The full suite ran at `a49bc5ec` (source-identical to `d0712695`; the dist
commit adds install-surface artifacts only — tests run from source).

### 14.7 CHECKPOINT — remaining before final HEAD

1. **CONSUMER SWEEP TABLE** (the main remaining reviewable content): every
   consumer of the three seams + the ordinary follow-up, end-to-end
   full-context verification (the anti-partial-wiring proof) — table to be
   appended to this section.
2. **S6 client-smoke unchanged-base capture** at the merge base (exact
   two-outcome wording; evidence only — S6 is never a functional block).
3. **Full gates vs the 31ad828d debt set at the MERGED head** (full suite +
   lint fp + typecheck + check:artifacts + dist if drifted) — the pre-sync
   totals above (14.6) do not cover the post-merge tree.
4. **Controlled sync onto the ACTUAL origin/master tip** (fetch to confirm —
   `621fdba1` as of 08:07Z, carries #46 + #48): MERGE, no rebase/force;
   **p4t6 MUST be recomputed from real A-lines on the merged tree** (the 900
   pin goes stale — #48 added scannable files; compute, don't assume);
   #48 touched `root-initial-work.ts` — expect overlap with seam (1),
   classify every resolution.
5. **Post-merge role re-audit** (role contract + #48 role suites; zero
   MALFORMED_DTO).
6. **Merged-head re-test** (closed arithmetic vs the debt set).
7. **Bookkeeping** (this section FINAL + sweep table + S6 outcome + sync
   record + all logs) — ONE bookkeeping commit; product/test/dist files are
   already in their own commits (`1b99ef40` RED, `a49bc5ec` fix, `d0712695`
   dist).
8. **ONE plain push of the FINAL HEAD + full report to the parent.**

Until the final HEAD lands, PR #50 stays **NO-MERGE** (Draft, checkpoint
banner).
