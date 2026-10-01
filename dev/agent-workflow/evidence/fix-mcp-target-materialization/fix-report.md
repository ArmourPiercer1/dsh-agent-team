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

**GREEN**: 2 files / 10 tests, TRUE-EXIT=0 (`gate-focused-matrix.log`; the
post-incident verification run on the 06:59 tree: `matrix-after-0659-writes.log`).

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

**Merged head `5e599790`**:

| gate | result | log |
| --- | --- | --- |
| full suite | **20F\|4737P (4757) = exact 19-failure debt set + 1 p6t1-parallel flake** (documented 0–2 envelope; isolated re-run 9/9 green — zero NEW) | `gate-fullsuite-merged.log` |
| check:artifacts | **OK 1372, TRUE-EXIT=0** | `gate-check-artifacts-merged.log` |
| typecheck | **9/9, TRUE-EXIT=0** | `gate-typecheck-merged.log` |
| lint file-aware | **136 fingerprints, NEW = 0** (143 − 6 my removals − 1 removed by their side) | `gate-lint-merged.log` + fp |
| p4t6 | **10/10 @ 900** | (recomputed; pin asserts 900) |
| focused 13 + F 2 + their new shipped-dist-smoke | **16 files / 165 tests green** | (merged-head run) |

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
  assertions are preserved verbatim.

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
