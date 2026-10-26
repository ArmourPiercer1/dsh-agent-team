# PR #386 independent review — U7-0 / EB2-A dynamic tool census (round 1)

- Reviewer: independent session. I did not take part in implementing this PR. I worked from the code, my own runs, and my own planted counterexamples, not from the author's summaries.
- Subject: `origin/task/u7-0-dynamic-census-20261026` @ `2f630e766`, merge-base `origin/master` @ `496a3980f`. Diff: 38 files, +12423/−6.
- Requirement under review (execution-plan.md:131, PR #364): *"EB2-A 完整动态 Census：`AuthoritativeToolSources→ExpectedToolObligations↔ObservedRuntimeInventory`，真实 Scope/Binding/Provider/Definition/Revision 身份与可信配置差集，来源新增自动 UNKNOWN 而非授权；固定 snapshot digest."* Verification clause (execution-plan.md:136): *"引入未知 MCP 工具、替换执行 Definition … 时必须被发现"*. U7-PLAN item 1: *C1 = schema/source-drift/UNKNOWN negative controls; C2 = one real inventory snapshot.*
- Reproduction: everything I ran is in this directory (`probes.mjs`, `probes2.mjs`, `schema-probe.mjs`, `logs/*`). Run from the review worktree root.

## VERDICT: BLOCKED

**EB2-A is only partly met.** The pieces that hold up: the expected↔observed diff, the literal `authorized:false` UNKNOWN for unseen names, the canonical digest, and a byte-replayable generator. Four required parts are missing or broken:

| EB2-A sub-requirement | status |
|---|---|
| `AuthoritativeToolSources → ExpectedToolObligations ↔ ObservedRuntimeInventory` three-way reconcile | **UNMET (source side is only an annotation)**: B3 |
| real **Scope** identity | partial: scope class only. `scope_id` is not in the digest, and a renamed lane does not move it (P7, D) |
| real **Binding** identity | **UNMET**: no field, schema, or column anywhere (probes2 C) |
| real **Provider** identity | **UNMET**: no field, schema, or column anywhere (probes2 C) |
| real **Definition** identity | **DEFECTIVE**: a same-boot replacement in any scope except the first is not detected (B2) |
| real **Revision** identity | degenerate live: `change_seq` is null on 26/26 and 36/36 product rows (M2). The `revision` drift kind has no test (M1) |
| **可信配置差集** (trusted-config difference set) | **UNMET**: nothing implements or mentions it (probes2 C) |
| new source ⇒ auto-UNKNOWN, never authorized | met for *observed new names* (P4c, PLANT 1). Not met for a known name appearing in a new scope (M3), and not met for a new entry in the sources artifact (B3) |
| fixed snapshot digest | met for canonical stability. It does **not** pin source attribution or scope identity (M5) |
| C1 source-drift negative control (U7-PLAN) | **ABSENT**: B3 |

---

## Findings

### BLOCKER

**B1 — EB2-A identity and trusted-config sub-requirements are not implemented (real gap, not a disclosure issue).**
`packages/testkit/census/inventory.mjs:28-49` (digest view) and `observed-runtime-inventory.schema.json` (toolRow keys: `name, definition_identity, schema_digest, identity_vs_global, change_seq, source_class, unresolved`). The expected artifact's obligation keys are `candidate_route … unknowns` (probes2 C). None of them carries **Binding** or **Provider** identity. No **trusted-config difference set** exists anywhere in the artifacts, reconciler, or verdict (`probes2.out.json` → `provider:false, binding:false, trusted_config:false`). The PR's README and evidence README present the work as "EB2-A" without saying these sub-requirements were left out. Needed to close: either implement those columns with planted controls, or get an explicit recorded ruling that narrows EB2-A. A PR description is not enough.

**B2 — "Replacing an execution Definition" is detected only when the swapped row is the first row of that name across all scopes (real defect).**
`packages/testkit/census/reconcile.mjs:177`: `identities` is a Map keyed by **name only**, first row wins (`if (!identities.has(t.name)) identities.set(...)`). Lines 205-211 compare that one per-name value and attach it to both scope classes. Consequences, reproduced (`logs/probes.out.json`):
- `P1_identity_swap_agent1_only`: same boot, `read` replaced in fixture `agent-1` → **drift 0**.
- `P1b_live_team_identity_swap_agent2`: on the **pinned live governed-team baseline**, `read` replaced in the native lane `agent-2` → **drift 0**.
- `P1c`: the same swap in `agent-1`, the first holder, → drift 2, and it is reported under **both** `native` and `team` even though only one lane changed. The scope attribution is wrong.
- `P3_crossboot_body_swap_same_shape`: across boots, a Body replaced while the model-facing shape is kept → snapshot digest unchanged and drift 0. The digest law discloses this by design, but it means cross-boot Definition replacement is invisible unless the schema text changes.

PLANT 2 (`u7-0-census-reconcile.test.ts:183-209`) mutates only the `global` scope, which is exactly the case that hides the defect. In the live baselines the global scope holds only `u5_canary`/`u7_census` (P8), so the first-holder row for product tools is an agent lane. This conflicts with the plan's verification clause (execution-plan.md:136). Needed to close: per-(scope, name) identity comparison, plus a planted swap in a non-first scope and in a second lane of the same class. The swap must be shown RED before the fix.

**B3 — The "three-way" reconcile is two-way plus an annotation. The sources side cannot produce a finding, and there is no source-drift negative control (real defect; the U7-PLAN C1 requirement is unmet).**
- `reconcile.mjs:70-71` (`inAuthoritative`) and `:73-79` (`sourceClassOf`): sources feed only the `in_authoritative_sources`/`source_class` annotation fields. No finding class is computed from the sources side.
- `P4_source_removed_obligation_kept`: removing `read` from AuthoritativeToolSources while it is still REQUIRED and observed → **counts identical, `verdict_digest` unchanged**.
- `P4b_new_source_unobserved`: adding a new host source row with no obligation and no observation → **counts identical, verdict digest unchanged, name absent from the output**.
- `probes2 A`: with `read` dropped from both sources and observation, the MISSING row merely flips `in_authoritative_sources` true→false. Counts are equal.
- Generator, upstream of the reconciler (`build-expected-tool-obligations.mjs:168-180`): deleting the `read` registration from the u1c seed and regenerating **succeeds (exit 0)**. It emits `read` REQUIRED with `source_registration: null`, and counts still pass 91/58/33 (`logs/scratch2.log`). Adding a brand-new host source row also regenerates cleanly, and the new row appears in no obligation and in no UNKNOWN (`logs/scratch.log` S2).
- The only source-related drift kind (`kind:'source'`, `reconcile.mjs:221-225`) requires `baseline` rows to carry `source_class`. It has **no test**: mutant M7, which deletes it, survives (`logs/mutations.log`).

Sources therefore can never disagree with expected or observed in a way that shows up in counts or the digest. U7-PLAN item 1 names "source-drift" as a required C1 negative control, and none exists. Needed to close: findings from the sources side (a REQUIRED obligation with no registration, a source row with no obligation becoming UNKNOWN, a registration that moved), each with a planted control shown RED first, and a generator that refuses (or marks UNKNOWN) a REQUIRED obligation that has lost its registration.

### MAJOR

**M1 — Two of the five DRIFT kinds have no test, and a third collapses into another kind (real defect plus a test-quality gap).**
- Mutation testing (`logs/mutations.log`): **M6** (removes the `revision` drift kind, `reconcile.mjs:214-218`) and **M7** (removes the `source` drift kind, `:223-225`) both leave **11/11 PASS**.
- `P6b_placement_signal_reachable`: changing only `identity_vs_global` same→differs in one agent lane is reported as **`definition-shape`**, not `placement-identity-signal`. Cause: `:196` compares the joined digest lists, and with two scopes in a class the list lengths differ (`X|same` vs `X|differs;X|same` → `X` vs `X;X`), so `shapeMoved` is true. The placement-identity class therefore collapses into the shape class. Mutant M5 is caught only for the shape side, never for the placement side.
- The MISSING/UNKNOWN/DRIFT top-level classes are separately identified, and each top-level mutant was killed (M2/M3/M4/M8/M9). Within DRIFT, though, `revision`, `source` and `placement-identity-signal` are untested or wrong. Needed to close: one planted control per DRIFT kind asserting the exact `kind`, each shown RED.

**M2 — In the live baselines, the identity columns the design relies on are degenerate (disclosure gap with real consequences).**
`tests/world-factory/canary/u7-census-probe-host.mjs:154, :179-185`. On both pinned live snapshots the global scope contains only the two test rows (P8), so every product row has `identity_vs_global: 'n/a'` (non-team 26/26, team 36/36) and `change_seq: null` (26/26, 36/36). Consequences:
- the `native-takeover-identity` team-lane signal (`:163`) cannot fire;
- `revision` and `placement-identity-signal` drift cannot be reached on real data;
- the governed `read`/`bash` takeover rows in the team lane are told apart only by name prefix (`team-names`).

The evidence README presents `identity_vs_global` as "the public, name-free signal the reconciler uses to see a governed same-name takeover row" (`inventory.mjs:10-12`). The real snapshot never supplies it. Needed to close: either observe a scope whose product rows carry global identities, or state plainly that this column is null in live data and that takeover detection is name-based only.

**M3 — A known name appearing in a new scope class is not reported at all (real defect against "来源新增自动 UNKNOWN").**
`reconcile.mjs:131-133`: the observed-side loop looks up obligations **by name only** and does nothing when the name is REQUIRED. `P5_known_name_new_scope`: injecting host `web_fetch` into the **governed team lane** of the live baseline gives counts identical to clean, and no UNKNOWN or other row is produced. A tool surfacing on a governed lane where no obligation places it is a capability expansion, and the census is silent about it. Needed to close: an obligation lookup keyed by (name, `expected_in`), so an observation outside its expected scope class becomes UNKNOWN, plus a planted control.

**M4 — The runner's `reconcile` case is unconditionally PASS, and `pickSnapshot` quietly drops its team-lane requirement (test-harness laundering pattern).**
- `tests/world-factory/u7-0-census-runner.mjs:241`: `record.addCase('reconcile', 'PASS', …)` is reached whenever the reconciler does not throw, whatever the counts or cross-boot drift are.
- `tests/world-factory/lib/u7-census-assembly.mjs:238-249`: with `requiresTeamLane: true`, if no lane-carrying snapshot exists it falls back to the tagged snapshot, then to the latest one.
- Evidence: RUN-1 (`run-receipts.json` → `run1`) has `c2-governed-team` **FAIL** (`teamLaneSnapshots: 0, agentLanes: 0`) and `reconcile` **PASS**, with `crossBootDrift: 2`. The raw RUN-1 "governed-team" inventory has a single `global` scope and no team lane, yet it was reconciled and passed. The overall run was FAIL, so nothing was promoted. The case-level PASS is still the pattern the plan forbids ("CI 伪绿"). Needed to close: `reconcile` asserts its preconditions (team lane present for governed-team, drift 0 on the pinned pair, MISSING set equal to a reviewed expected set), and `pickSnapshot` throws instead of falling back when `requiresTeamLane` is set.

### MINOR

**m1 — The cross-boot stability claim is overstated (disclosure).** The evidence README (RUN-RECEIPTS block) says the non-team digest was identical across RUN-1/RUN-2 "while per-boot fields moved". I compared the raw RUN-1 and RUN-2 non-team inventories under `.worktrees/u7-0/.artifacts/tmp/u7-0-census-live/`. **All 28/28 `definition_identity` values are identical** (for example `read` = `def#17` in both). Only `boot_id` and `captured_utc` differ. The identity counters are deterministic per boot sequence, so the live run does not show that the digest is insensitive to moved `def#N`. Only the synthetic test (`u7-0-census-reconcile.test.ts:107-121`) shows that.

**m2 — The snapshot digest does not cover source attribution or scope identity.** `inventory.mjs:28-49`. P7: changing `source_class` → digest unchanged; renaming `scope_id` → digest unchanged (probes2 D). Combined with B3, the "fixed snapshot digest" cannot record that a tool's authoritative attribution moved. That may be a defensible design choice, but it is not disclosed.

**m3 — Seed provenance cannot be reproduced from tracked history (disclosure).** `dev/engineering/tool-obligations/sources/u4-reviewed-obligations.seed.json` is byte-identical to the main checkout's `dev/agent-workflow/evidence/u4-obligations-20261025/expected-tool-obligations.json` (sha256 `0b4b480d…abb6d`, I verified IDENTICAL). That source is **untracked** (`git ls-files` = 0), and the generator does not check it. The u1c team pin refers to `.worktrees/u1-audit-master @ 4aaaa7b2a`, a worktree path rather than a ref. The README (`dev/engineering/tool-obligations/README.md:23-27`) lists three reviewed inputs "sha-pinned in the manifest", but `u4-unknown-dispositions.seed.json` has **no consumer and no manifest entry** (`grep` count 0).

**m4 — The RUN record is not bound to a Team SHA.** `u7-0-census-runner.mjs:126` gives `teamSha: process.env.U7C_TEAM_SHA ?? ''`. The pinned `RUN.20261026.json` has `"teamSha": ""`. U7-PLAN's exit evidence requires source digests.

**m5 — The PR tests do not pin canonical key-order or whitespace invariance.** It holds: I verified it in P7 (reordered keys/tools/scopes and re-whitespaced input give the same digest, and a semantic change moves it). But nothing in `u7-0-census-reconcile.test.ts` would fail if `canonicalJson` stopped sorting keys, since the fixture is generated in sorted order anyway.

**m6 — `team_lane_variant_expected` is computed by the generator (`build-expected-tool-obligations.mjs:58-87`) but never read by the reconciler** (grep count 0). It is a reviewed field with no effect.

**Info — commit `512d16485` (string reword to clear the a5p0 audit).** `scripts/audit-a5-tool-governance-imports.mjs:299` flags any `.ts/.mjs` under `packages/` whose comment-stripped text matches `tool-governance|tool-dispatch`, string literals included. `reconcile.mjs` imports only `./json-canonical.mjs` and `./inventory.mjs`, so it has no real lane edge, and the reword does not hide one. The real `tool-dispatch` consumer is the probe row (`tests/world-factory/canary/u7-census-probe-host.mjs`, via an env-injected file URL), which sits outside the audit's `packages/` walk. I accept this as a test row, but it is noted.

---

## Verified (command → result, verbatim tail)

1. **The PR's C1 suite passes.** `npx vitest run packages/testkit/test/u7-0-census-reconcile.test.ts` (`logs/census-test.log`)
   ```
   ✓ packages/testkit/test/u7-0-census-reconcile.test.ts (11 tests) 156ms
    Test Files  1 passed (1)
         Tests  11 passed (11)
   ```
2. **The generator replays byte-identically, and the replay can fail.** `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check` → `CHECK OK — committed artifacts are the byte-exact replay of the generator` / `exit=0`. Tampering one seed obligation in a scratch copy → `CHECK FAILED: … expected-tool-obligations.v1.json: byte-differs … manifest.json: expected-digest differs` / `exit=1` (`logs/scratch.log` S1).
3. **The negative controls are real (they go RED under mutation).** In `logs/mutations.log`, killed mutants:
   - M1 (`authorized:true`): 3 failed
   - M2 (identity drift off): PLANT 2 failed
   - M3 (dynamic → not-in-obligations): PLANT 1 failed
   - M4 (MISSING off): PLANT 3 failed
   - M5 (shape → placement): PLANT 2 failed
   - M8 (unattributed new names dropped from UNKNOWN): PLANT 1 failed
   - M9 (new non-dynamic name authorized): PLANT 1 failed

   **Surviving mutants:** M6 (revision drift removed) → `Tests 11 passed (11)`; M7 (source drift removed) → `Tests 11 passed (11)`.

   The PR itself shows only green for its plants. The only "RED" it records is the p4t6 booking, and no RED run of the census plants is recorded. That is a disclosure gap; my mutation runs supply the RED evidence for the plants that work.
4. **New observed name ⇒ UNKNOWN, `authorized:false`.** P4c: `{"name":"new_source_tool","classification":"not-in-obligations","authorized":false,"reason":"observed name has no ExpectedToolObligations entry — a NEW SOURCE is auto-UNKNOWN, never auto-authorized"}`. `authorized` is a literal at `reconcile.mjs:144` and `:158`. The observed schema rejects an injected `authorized` key (`schema-probe.out.json` → `inventory_authorized_field_rejected: true`). `NOT_VERIFIED` survives verbatim in the dynamic-instance reason string (`reconcile.mjs:146`).
5. **The digest is canonical.** P7: `reordered_keys_tools_scopes_equal: true`, `whitespace_equal: true`, `semantic_change_moves: true`. The pinned live snapshot digests recompute (P8 `recomputed_snapshot_equal: true` ×2).
6. **The live pinned reconcile replays.** P9: `nonTeam_digest_match: true`, `team_digest_match: true`. All 11 non-team MISSING names are profile-gated host tools; the team-world MISSING set is those 11 plus 13 team leader tools not granted by the anchor blueprint. This matches the evidence README.
7. **The baselines manifest digests match the files.** `sha256sum` of the four files in `baselines/` equals the values in `baselines.manifest.json` (38cc02f9…, 92c55875…, 10c24ae0…, e34b35f7…).
8. **Schema checker negatives** (`schema-probe.out.json`): bad enum, extra key, missing required field, and bad host_sha are all rejected. (The PR has no test for these. I ran them.)
9. **Protected set untouched.** `git diff --stat origin/master...HEAD -- packages/runtime/governance-center | wc -l` → `0`.
10. **No product, plan, or matrix files changed.** `git diff --name-only origin/master...HEAD -- docs/ packages/runtime packages/domain packages/contracts packages/tools packages/storage packages/remote packages/client packages/legacy .github` → empty. No matrix cell was re-coloured, and no FAIL/SKIP was converted. The modified existing files are test infrastructure only: `packages/testkit/test/p4t6-session-event-scan.test.ts` (a +12 scan booking with a by-path assertion; `npx vitest run …p4t6…` → `Tests 10 passed (10)`), `tests/world-factory/lib/world-factory.mjs` (additive `u7Census` world kind, mutually exclusive with the others), and an `eslint.config.mjs` node-globals glob.
11. **The evidence README discloses RUN-1 honestly** as overall FAIL. Its raw artifacts exist and match the stated digests. The RUN-1 non-team snapshot digest `e540b89b…` equals RUN-2's.

## Could NOT verify (and why)

- **Live C2 run.** Booting a Host was out of scope for this review, so I could not re-run `tests/world-factory/u7-0-census-runner.mjs`. I checked only the recorded artifacts, both the tracked baselines and the raw files in the author's worktree, `.worktrees/u7-0/.artifacts/…`.
- **CI receipts** (pr-gate / candidate-protection / census-runtime PASS on `512d164`). I did not query GitHub Actions and took them as claimed only.
- **"Zero new vitest reds vs pristine master."** I did not run the full root suite. I ran only the census test and the p4t6 suite. `a4p7-merge-gate` from a non-root worktree is a known pre-existing limitation and I did not count it.
- **Whether the 13 unmet team leader tools and 11 profile-gated host tools are the reviewed expectation, rather than an accident of the anchor blueprint and world profile.** Nothing in the PR pins the expected MISSING set, so any change to it passes silently (see M4).
- **Upstream file:line accuracy of the u1c seed rows** (75 host + 21 team). This would need the pinned host tree and the `4aaaa7b2a` Team tree. I did not re-verify it.

## Process note
I wrote nothing to product code. My mutations were applied to `packages/testkit/census/reconcile.mjs` one at a time and restored from a saved copy, and `git status --porcelain packages/` was empty afterwards. Generator experiments ran in scratch copies (`.review-scratch*`), which I deleted. No Host was booted, and neither :3080 nor `~/.dsh` was touched.
