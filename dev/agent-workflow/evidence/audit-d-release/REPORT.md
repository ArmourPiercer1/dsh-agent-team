# AUDIT-D-RELEASE — PD-41/PD-42 claim check, release-note truth sweep, candidate/authority immutability

**Audit:** D of four (read-only). **Repository:** `/home/armourpiercer/projects/dsh-agent-team`.
**Baseline:** `origin/master` @ `9e1c493b6` (2026-11-11 real-UTC round).
**Worktree:** `.worktrees/audit-d`, branch `task/audit-d-release-20261111`.
**Subjects:** PR **#719** (`task/pd41-allow-semantics-20261111`, tip `7a5320e6e`, 4 commits) and PR
**#720** (`task/pd42-v5-cellings-20261111`, tip `bf73378db`, 3 commits); `RELEASE-NOTES-0.1.6.md` as it
stands on `master` and as amended by #719; `PRODUCT-DEBT-REGISTER.md` rows PD-40/41/42; the two frozen
candidates and the Authority pointer.

**Discipline:** no product/doc change, no Host boot, no merge, no push of anything except this report's
own branch. Only writes: this file.

**Gate tooling notes (found while auditing):**

- `node scripts/verify-candidate.mjs --check` **does not exist**. The script's CLI accepts
  `--manifest/--root/--record/--json`; `--check` exits **2** (`unknown argument: --check`). The
  verifications below therefore use `--manifest` (the only check form the tool has).
- `node scripts/doc-checks.mjs` is an **import-only library** (no `process.argv`, no CLI entry). Running
  it prints nothing and exits 0 by construction. The PR #719 gate table that lists
  “`node scripts/doc-checks.mjs` → PASS” is a **vacuous pass**, not a gate. The runnable document gate
  is `node scripts/docs-probe.mjs --worktree-only` (or `--base <ref>`); on all three trees it reports
  `blocking=0 non_blocking=0 advisories=0`.

---

## 0. Verdict in one line

**PD-42 is honestly scoped and does not claim the conjunction; PD-41 is mostly true but its absolute
“`succeeded` only on observed completion” is not yet true for one abort shape, and the typed refusal is
only observable inside the Team process.** The release notes on `master` **do not disclose F-1/PD-42 or
F-4/PD-41 at all** — commit `8ebb68b6f`'s message says they are in §4.8/§4.9, but that commit changed
**one anchor line** in the debt register and **no** release-note text. Candidates and Authority are
immutable and unmoved.

---

## 1. PD-41 (#719) — claim-by-claim

Diff read: `git diff origin/master...origin/task/pd41-allow-semantics-20261111` (66 files, +4175/−44).
Source changes: `packages/runtime/tool-dispatch/{closed-world-guard,index,install,scoped-dispatcher}.ts`,
`packages/tools/a5p5-tools/src/{pipeline,register}.ts`, two new test files, `pd41.json` booking, rebuilt
`dist`, evidence README, release-notes §9 + §2/§4/§5 appends, and the PD-41 register row.

| # | Claim (PR body / §9 / register row) | Verdict | What the code actually shows |
|---|---|---|---|
| 1 | `control-allow-consumed` means “authorisation consumed”, never “execution succeeded” | **PASS** | No consumption writer touched by the diff. The fact writer (`pipeline.ts:231/:240`) and the consumption writer are separate; root recovery (`packages/runtime/src/plugin/root.ts:2897-2910`) writes `unknown` for consumed-without-result and never promotes it to success. §9 item 1 and the PD-41 row state it correctly. |
| 2a | “`succeeded` only when completion was observed” | **OVERSTATED** | `executionOutcomeOfAnsweredCall` (`pipeline.ts:116-126`) tests only `outcome.cancelled === true \|\| outcome.timedOut === true`. The confined shell's `cancelled` flag is **not** total for aborts: `shellCancelled` (`packages/tools/process-family/src/shell-mechanics.mjs:114-117`) returns true only for `reason.kind ∈ {user,parent}`. An abort with any other reason (a forwarded host deadline `DOMException`, `inherited-signal`, a plain `AbortError` — all reachable because `install.ts:armWrapperSignal` forwards `incoming.reason` verbatim) produces `cancelled=false, timedOut=false, exitCode=null, settlement={kind:'cancelled'}` and is therefore classified **`succeeded`** by `pipeline.ts:125`. That is the same “completion nobody measured” class the PR says it fixed, on a narrower arm. The helper's signature even carries `settlement` but deliberately does not consult it. |
| 2b | “cancelled/timed-out unobserved → `unknown`” | **PASS-with-scope** | True for **answered** cancelled/timed-out bodies (the only shape measured, WP3 `run-residual-s373`). A cancellation delivered as a **throw** is caught at `pipeline.ts:231` and recorded **`failed`**, not `unknown` — the PR body says “answered failure/throw stays failed”, so this is disclosed, but §9's blanket “a cancelled or timed-out body reports `unknown`” is not true of throw-shaped cancellation. |
| 3 | Typed `TOOL_BINDING_UNVERIFIED` refusal exists and is distinguishable | **PASS (in-process only)** | `ToolDispatchRefusalError` + `isToolBindingRefusal()` + `dispatchRefusalOf()` at `closed-world-guard.ts:639-690`; three codes are kept distinct (`TOOL_BINDING_UNVERIFIED`, `TEAM_TOOL_UNGOVERNED`, `ADAPTER_DRAINING`) and the sentence stays byte-identical. Tests pin all three and assert the body never runs (`packages/runtime/test/pd41-allow-semantics.test.ts:139-206`). **Scope caveat in §5 below.** |
| 4 | A consumed allow is never auto-replayed | **PASS** | No retry/redelivery added or touched; root recovery only records `unknown` and moves on (`root.ts:2897-2910`). |
| 5 | The pre-approval preflight was **deferred**, not half-built | **PASS** | No preflight code in the diff; §4 of the evidence README and §9 give the cross-component reason (`pre-execute-adapter.ts:~1948` would need the closed-world Binding facts owned by `tool-dispatch/`). Nothing pretends it shipped. |

### 1.1 Two further PD-41 overstatements (minor, but they are in the row/docs)

1. **“every dispatch refusal a `ToolDispatchRefusalError`”** (register row “current backstop” +
   `ToolDispatchRefusalError` doc comment). Only **Guard-denial** refusals and the not-ACTIVE refusal are
   typed. The dispatch door still throws bare `Error` for: unreadable definition (`install.ts:1020`),
   kernel approval table no longer backing the definition (`install.ts:1043`), re-entry under one call id
   against two definitions (`install.ts:1058`), and the not-a-cancellable-definition arm (`install.ts:1068`).
   The honest sentence is “every **Guard-denial** refusal is typed”.
2. **“`isToolBindingRefusal()` is the one predicate a recovery path asks”** (PR body condition 2). There
   is **no production recovery path** that calls it; the only callers are the test file. It is a
   predicate a recovery path *may* ask, not one the product asks today.

### 1.2 PD-41 register row / §9 accuracy otherwise

The PD-41 register row, its anchors, and the append-only discipline all check out:
`node --test tests/world-factory/a5sf-debt-register.test.mjs` → **10/10 PASS** in `.worktrees/pd41`
(2026-11-11 run); `node scripts/docs-probe.mjs --worktree-only` → `blocking=0`. The row's only changed
existing text is PD-40's two anchor line numbers, and both anchors still resolve (the register test
enforces this).

---

## 2. PD-42 (#720) — claim-by-claim

Diff read: `git diff origin/master...origin/task/pd42-v5-cellings-20261111` (19 files, +1301/−30).
Product change is **one function**, `derivedMembersOf()` in
`packages/runtime/team-services/src/product-assembly.ts:737-775`; everything else is dist, tests, the
c1 kit mode, and evidence.

| # | Claim (PR body) | Verdict | Check |
|---|---|---|---|
| 1 | Gate now accepts **4 and 5** | **PASS** | `MEMBER_IO_CEILINGS_SCHEMA_VERSIONS = Object.freeze([4,5])` (`:716`), tested at `:742`. No other version gate added. |
| 2 | Family read from **the same validated/bound/content-hashed document** | **PASS** | `const core = bound as unknown as TeamBlueprintV4Core; const family = core.memberIoCeilings ?? []` — no re-parse, no default. Verified that `toHashableBlueprintV5()` delegates to `toHashableBlueprintV4()` (`blueprint-v5.ts:301-313`) and the v4 projection binds `memberIoCeilings` (`blueprint-v4.ts:627-635`), so the family really is inside a v5 content hash. |
| 3 | **Three typed, distinguishable refusals** | **PASS-with-note** | Three distinguishable **messages**, but **one** typed code: all three use `MEMBER_POLICY_WITHOUT_BLUEPRINT`; v3/other, v4-empty, v5-empty differ only in prose. “Typed, distinguishable” is defensible by message, not by machine-readable code. |
| 4 | **No other semantics changed** (no lane / `ToolRestriction` / Authority / realm-plan code) | **PASS** | Product diff is confined to `derivedMembersOf()`; the v5-empty wording is the only behavioural text change, and the v4-empty refusal text changed too (`empty memberIoCeilings family` → `declares no memberIoCeilings family`) — same code, same refusal, message only. |
| 5 | Does the PR **avoid claiming the conjunction is proven**? | **PASS** | The PR body's live-evidence bullet says explicitly: “**not proven there**: the same Member's fs calls governed by the v5 ceiling … This is a tool-plane/realm ownership gap, not the version gate”. The evidence README leads with a table where the ceiling arm is `NOT PROVEN on a real Host` and Goal/Stop/relay are `NOT RUN`. No “conjunction proven” sentence anywhere in the PR body. |
| 6 | “two fresh-HOME runs agreeing” | **PASS** | Committed `runs/run1|run2` manifests: same `productSha 955dc548a`, different `rootSessionId`/home path, both `team.create` 200 with v5 content hashes that differ only per run; `A6-27` durable `succeeded` ×1 each; ceiling arm FAIL ×4 each. The two runs agree on every asserted field. |

**Overstatement found in PD-42:** none material. The only wording to tighten is “three **typed**,
distinguishable refusals” → “three distinguishable refusals under one typed code”. The evidence README
is more careful than the PR body (it shows the single code and a three-row message matrix).

**Cross-check the PR body's own honesty:** it says the c1 kit is committed and lists every
accommodation (tool-web/tool-bash drops, coverage deny list, YAML indentation). That matches
`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` and the README's harness-disclosure
section. No product preset was changed.

---

## 3. Release-notes / register truth sweep

Read on `master` (`9e1c493b6`) and on `origin/task/pd41-allow-semantics-20261111` (where §9 and the
§2/§4/§5 appends live). #720 does **not** touch the release notes.

| Surface | Verdict | Finding |
|---|---|---|
| **§1 “What ships” / “One bundle, both planes”** | **UNDISCLOSED** (text itself not false) | The literal claims (“one tarball”, “not separate products”, “Alpha.6 does not become default”) are true. But the notes are **silent** on the composition limit: before #720 a v5 Team could not carry `memberIoCeilings` at all (F-1/PD-42), and after #720 the approved A6 execution still bypasses the governed realm (P0-1, tool-plane/realm ownership). Nothing in §1/§2 says “one Team cannot (yet) run both planes through the confined provider”. The text does **not** say the planes are disjoint — the only “`PLANES-DISJOINT`/one Team runs one plane” sentence is in `dev/agent-workflow/evidence/wp2-a6-governed-goal/README.md`, not in the notes. So the closeout must **add** the disclosure, not correct a false disjoint claim. |
| **§2.1 Stable (Goals row + F-2 clarification)** | **PASS** | The dated F-2 clarification and the §2.2 F-2 row match `dev/agent-workflow/evidence/v016-packaged-acceptance/README.md` §6 F-2 (the 19 unmanaged names, the third Member, “different Members for different capabilities”). No single-Member-capability promise remains. |
| **§2.2 Experimental — v5 row** | **UNDISCLOSED** | “v5 extends v4 and one blueprint still carries the v4 I/O ceilings” predates #720: it does not say a v5 document may now also carry `memberIoCeilings`, nor that a v5 document without the family refuses with v5-specific wording. The row is not false, but the #720 source-of-document widening is absent from the notes. |
| **§2.2 — F-3 “Officer approval is plane-leg only”** | **PASS** | Matches the packaged-acceptance F-3 finding and `pre-execute-adapter.ts` (parameter-permission leg lacks `blueprintContentHash`/`blueprintRevision`). The phrase “Officer approval” is correctly narrowed; no over-claim. |
| **§4.1–§4.8** | **PASS** (spot-checked) | Network-boolean, round-budget, BL-17 body attribution, Stop-not-instant, async delegate, “not a security boundary against a malicious Member”, PD-40 latch scope, relay/Goal authority — all still true and consistent with the measured evidence. The “not a security boundary” disclaimers are correctly present and must **not** be weakened by the closeout. |
| **§4.9 F-2 / §4.10 F-3 / §4.11 F-5 / §4.12 F-6** | **PASS-with-one-scope-note** | F-5 wording matches `v016-packaged-acceptance` F-5. F-6: the notes say “across runs” the Stop shape can be `already-decided` **or** an abandonment row; on **this candidate** both packaged runs ended `already-decided`, and the abandonment variant was measured on a *different candidate revision* (the evidence README says so). “Across runs” is true of the A6-12 family but reads as if the variance was observed on this artifact. |
| **§4 missing F-1/PD-42 and F-4/PD-41** | **UNDISCLOSED** | There is **no §4 item for F-1** (the two-planes/disjoint-mode constraint or its #720 relaxation) and **no §4 item for F-4** (allow consumed, then dispatch refused, 1 consumption / 0 executions / 0 side effects). Commit `8ebb68b6f` (#715) says both were “disclosed in §4.8/§4.9 and registered as PD-42/PD-41”, but its diff is **one anchor line** in `PRODUCT-DEBT-REGISTER.md`: `1 file changed, 1 insertion(+), 1 deletion(-)`. On `master` the strings `F-1`, `F-4`, `PD-41`, `PD-42` do not occur anywhere in the release notes. (F-4 is covered only on #719's branch, by §9's binding-failure paragraph.) |
| **§5 A6-GAPS-26 + appended F-5/F-6 block** | **PASS** | The abandonment defect is still correctly narrowed; the appended block correctly distinguishes F-5/F-6 from A6-26. Only defect: the appended block is not separated by a blank line from the following existing paragraph (“**Discoverable** does not mean…”), a formatting nit. |
| **§9 (PD-41, #719 only)** | **OVERSTATED** on item 3 | Items 1, 2, 4, 5 and the preflight/measurement paragraphs match the code. Item 3's absolute “`succeeded` is reserved for a body whose end was observed” is falsified by the abort-reason hole in §1 row 2a. §9 also inherits the “cancelled → `unknown`” over-generalisation (throw-shaped cancellation → `failed`). |
| **PD-40 register row** | **PASS (stale, not false)** | Status remains OPEN, disclosure matches §2.2/§4.7. WP1's two-arm measurement (`dev/agent-workflow/evidence/wp1-sticky-stop/`) is cited in §4.7 but **not** in the register row; the row should cite it when next edited. |
| **PD-41 register row** | **OVERSTATED** (exists only on #719) | Two sentences need narrowing: “only a body whose end was observed is `succeeded`” and “every dispatch refusal a `ToolDispatchRefusalError`” (see §1.1/§1.2). Everything else in the row, including the deferred-preflight statement and the DEV-LIVE class, is accurate. |
| **PD-42 register row** | **MISSING** | There is **no PD-42 index row and no PD-42 body entry** on `master` (register stops at PD-40). `dev/agent-workflow/evidence/wp2-a6-governed-goal/README.md` and `V016-PREVIEW-CLOSEOUT-BASELINE.md` both reference “PD-42”, so the id is in use with no registered row. This is a bookkeeping hole the closeout must fill (the #715 commit message's claim that PD-42 was “registered” is false). |

**Security-boundary claims:** the “not OS isolation” (§4.1), “not a security boundary against a
malicious Member / not isolation with non-escape” (§4.6) and “governance with attribution” statements
are preserved and still accurate. No new text in #719/#720 upgrades them. Keep them verbatim in the
closeout; do not let the Preview GO wording imply they were retired.

---

## 4. Candidate / Authority immutability — transcript

Working directory: repository root (main checkout; `git status --short -- dev/engineering` = empty).

### 4.1 Candidate verification

```
$ node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-2.json
...
PASS  candidate_commit.resolves: bb3c158eb1f76f8db429da01e9a4c5a0e118ca90 is a commit in this repository
PASS  candidate_ref.tip: refs/heads/candidate/v0.1.6-2 = bb3c158eb1f76f8db429da01e9a4c5a0e118ca90 (frozen)
PASS  content_digest: sha256:1fecf63404f8c8a8294239760d4b30313b3d58e9ae264c93f3d08f2a8111f8a8 (F0, digest fields removed)
PASS  product.trees.packages: 4ab3f55e7cbfb9d9d62118a01f2e92e43476c783
PASS  product.equality: product bb3c158eb… == candidate bb3c158eb… on every product path (exit 0)
PASS  product.judges.*: 122 judge/driver digest edges, all PASS (output truncated in this transcript)
PASS  authority.pointer: dev/engineering/current-authority.json
PASS  authority.snapshot_version: as20261109r1
PASS  authority.content_digest: sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3
PASS  authority.snapshot_baseline: cb2e41483af8447700fb3c2a25c2686705320692
PASS  dependencies.host_baseline_version: 0.2.0-rc.2
PASS  dependencies.host_sha: 639ed015397290b3745d163aafe02ffee4aa3f84
PASS  dependencies.host_checkout: tests/deepseek-harness-test-use HEAD=639ed015397290b3745d163aafe02ffee4aa3f84
PASS  ancestry.candidate_is_ancestor_of_origin_master: live merge-base --is-ancestor bb3c158eb… refs/remotes/origin/master => true (exit 0)
PASS  ancestry.product_is_ancestor_of_candidate: live … => true (exit 0)
PASS  evidence.records: no run record cited (vacuously satisfied, reported as such)
VERIFIED cand-v0.1.6-2 @ bb3c158eb1f76f8db429da01e9a4c5a0e118ca90 — PASS=145
EXIT=0

$ node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-1.json
... VERIFIED cand-v0.1.6-1 @ 168266dbfe7f2de091d998431bd56ce4dba0dbb5 — PASS=145
EXIT=0
```

Manifest bytes have not moved since freeze (blob at `HEAD` equals blob at the freeze commit):

```
cand-v0.1.6-1  log: f31e3d9e2 (#706) only
  blob@HEAD   9affa2f3b13b17259c9bf6ebd77037dc17c1149c
  blob@freeze 9affa2f3b13b17259c9bf6ebd77037dc17c1149c
cand-v0.1.6-2  log: cbf1c1df6 (#711) only
  blob@HEAD   db94b7e371f6ac2480a4d5c7b1d7b09a417d43c4
  blob@freeze db94b7e371f6ac2480a4d5c7b1d7b09a417d43c4
```

Refs are frozen and identical locally and on `origin`; reflogs have exactly one “branch created” entry
(no reset/amend/force-push record):

```
$ git ls-remote origin 'refs/heads/candidate/*'
168266dbfe7f2de091d998431bd56ce4dba0dbb5  refs/heads/candidate/v0.1.6-1
bb3c158eb1f76f8db429da01e9a4c5a0e118ca90  refs/heads/candidate/v0.1.6-2
$ git rev-parse candidate/v0.1.6-1 candidate/v0.1.6-2
168266dbfe7f2de091d998431bd56ce4dba0dbb5
bb3c158eb1f76f8db429da01e9a4c5a0e118ca90
$ git reflog show candidate/v0.1.6-2
bb3c158eb candidate/v0.1.6-2@{2026-11-11 18:43:33 +0800}: branch: Created from bb3c158eb
$ git reflog show candidate/v0.1.6-1
168266dbf candidate/v0.1.6-1@{2026-11-10 22:32:01 +0800}: branch: Created from 168266dbf
```

Nothing merged this round rewrote a candidate record. The last commits touching
`dev/engineering/` are #705/#706/#711, all **before** the `9e1c493b6` baseline; there are no commits
`9e1c493b6..origin/master` at all, and the working tree has no pending change under `dev/engineering/`:

```
$ git log --oneline --since=2026-11-10 -- dev/engineering
cbf1c1df6 CANDIDATE-V016-2: freeze v0.1.6 candidate at the Stop-fence head (#711)
f31e3d9e2 CANDIDATE-V016-1 freeze v0.1.6 candidate and add independent verification tooling (#706)
168266dbf authority: re-establish the integration baseline on cb2e41483 (owner ruling D7) (#705)
$ git log --oneline 9e1c493b6..origin/master        # (empty)
```

### 4.2 Authority pointer

```
$ cat dev/engineering/current-authority.json
{"content_digest":"sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3","snapshot_version":"as20261109r1"}
$ node scripts/current-authority.mjs
{"ok":true,"status":"POINTER","snapshot_version":"as20261109r1",
 "content_digest":"sha256:d85fdc1a78f055dc460799a6ff560daab541d0d7f96bb48294ff3dee76a398b3",
 "six":{"phase_id":"alpha5-sandbox-first","active_plan":"docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md",
        "backlog":"docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md",
        "matrix":"docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md",
        "baseline":"cb2e41483af8447700fb3c2a25c2686705320692","baseline_collected":"2026-11-10T14:00:12Z"}}
```

`:as20261109r1` is the pointer **and** the digest both candidate manifests pin, and it is **unmoved**
(last write `168266dbf` #705, i.e. before both freezes; the snapshot file's last write is the same
commit). No candidate / no this-round merge moved it. This is consistent with owner ruling D7: the
candidate claim travels per row as `verifiedFor`, not as a global baseline move.

### 4.3 Doc gate

```
$ node scripts/docs-probe.mjs --worktree-only        # master (audit-d worktree)
docs:probe base=(worktree-only) head=ed4a7ce13 changed=0 ... blocking=0 non_blocking=0 advisories=0 contracts=20 pairs compared  EXIT=0
$ (cd .worktrees/pd41 && node scripts/docs-probe.mjs --worktree-only)
... blocking=0 non_blocking=0 advisories=0 contracts=20 pairs compared  EXIT=0
$ (cd .worktrees/pd42 && node scripts/docs-probe.mjs --worktree-only)
... blocking=0 non_blocking=0 advisories=0 contracts=20 pairs compared  EXIT=0
$ node scripts/doc-checks.mjs                         # prints nothing, EXIT=0 by construction (library)
```

The probe proves document/id/path integrity only; it cannot see the §3 truth gaps (it says so itself:
“semantic equivalence of prose remains a Contract Owner judgement”).

---

## 5. PD-41 observable scope on a real Host dispatch path (the owner's extra question)

**Question:** does the typed refusal reach the Host / Host UI, or only the Team process?

**Answer: only the Team process.** The code supports the claim “typed refusal, programmatically
distinguishable **inside the Team process**”; it does **not** support “the Host UI exposes a
machine-readable code”.

Evidence chain:

1. **Throw site is inside the Team plugin's dispatch wrapper.** `install.ts:1000` (inside `a5p1GuardDispatchGate`, `:984-1008`) is the
   `a5p1GuardDispatchGate` (`tools/execute`) middleware; it throws `ToolDispatchRefusalError` after
   `dispatcher.denial(...)`. This runs in the plugin process that owns the Team tool surface.
2. **The public Host seam is unchanged and prose-only.** `scoped-dispatcher.ts:455`:
   `const guard = (exec) => denial(exec)?.message`, and the interface still documents
   `guard: (exec) => string | undefined` (`:118`). The host's own guard service is defined as
   `(exec) => string | undefined` (`tests/deepseek-harness-test-use/packages/core/tools/src/index.ts:1127-1145`),
   and the denial path materializes `{ message }` (`:1528`).
3. **The host error conversion drops the fields.** Host baseline @ `639ed01539`,
   `packages/core/tools/src/index.ts:1910-1917`: `toolErrorResult()` builds
   `{ content:[{type:'text', text:\`Error: ${message}\`}], isError:true, error:{message, ...info} }`;
   `errorInfo()` (`:662-668`) returns an `info` object **only for `HarnessError` instances**.
   `ToolDispatchRefusalError extends Error`, not `HarnessError`, so `error.info` is `undefined` and the
   only thing that crosses is the sentence. Therefore the model and the Host UI see
   `Error: team tool guard: … [refused at the dispatch door, …]` — no `code`, no `reason`, no `toolName`.
4. **No product consumer of the typed predicate.** `git grep` over the branch finds
   `isToolBindingRefusal` / `dispatchRefusalOf` / `ToolDispatchRefusalError` only in
   `closed-world-guard.ts`, `index.ts`, `install.ts`, and `packages/runtime/test/pd41-allow-semantics.test.ts`.
   There is no recovery path, daemon, RPC response or UI projection that reads them.
5. **The only machine-readable carrier is an observation string.** `denial()` writes
   `observe({event:'guard-denial', code: verdict.error.code, reason, state})`
   (`scoped-dispatcher.ts:442-453`); `install.ts:358-361` buffers it and forwards to `onObserve`; the
   product wire (`agent-bindings.mjs:2963-2965`) renders it as a **string**
   `a5p1-guard: guard-denial agent=… tool=… reason=binding-unverified code=TOOL_BINDING_UNVERIFIED`,
   via `guardObservationFace` (`:801-818`, which includes `code`). That is the instance-log /
   observations channel, not a Host UI field and not a typed RPC payload.

**Claim the code supports, verbatim for the closeout:** “A Tool Binding failure raises a typed
`ToolDispatchRefusalError` (`TOOL_BINDING_UNVERIFIED` + measured reason + governed name) inside the Team
process; it is distinguishable there from `TEAM_TOOL_UNGOVERNED` and `ADAPTER_DRAINING`; the Host's
`tools.guard` seam and the model/UI surface still receive only the byte-identical prose, and the code
appears in the plugin's guard-denial observation line as text.”

**Claim the notes must NOT make:** “the Host UI exposes a machine-readable `TOOL_BINDING_UNVERIFIED`
code” (or any equivalent). Today no Host UI field, ledger row, RPC result or `error.info` carries it.
§9 and the register row are careful enough to avoid this exact sentence, but the PR body's “An operator
could not tell, **programmatically**…” framing invites it; the closeout should state the scope
explicitly rather than leave it to inference.

---

## 6. Documents that need a dated update when Preview GO evidence lands

The GO evidence here means: a frozen `cand-v0.1.6-3` (after the product diff is final), independent
C2-A/C2-B on that SHA, and the P0‑1…P0‑4 findings either fixed or explicitly carried. The list is
ordered so the closeout does not miss one.

| # | File | Section(s) that must change | What must change |
|---|---|---|---|
| 1 | `docs/plans/active/alpha5-sandbox-first/PREVIEW-CONTRACT-2026-11-16.md` | §1 版本与范围标识; §2.3/§2.3.1/§2.3.2 (ordinary install proof); §3.1/§3.2 (Stop guarantees); §4 “明确不是” (explicit is-not); §7 (0.1.6 scope supersede) | Bump the scope identifier / date and append a dated §8 (or a new “Preview GO” clause) naming the frozen candidate and the contract revision. §4 must gain the **still-true** is-nots: if P0‑1 is not fixed, “an approved Alpha.6 execution does not yet run through the Alpha.5 confined provider”; keep “not a security boundary” verbatim. §2.3.x needs the packaged/no-plane boot number if the GO evidence re-runs it. |
| 2 | `docs/plans/active/alpha5-sandbox-first/PREVIEW-READINESS-2026-11-15.md` | §1.1 PR status; §1.3 product file list; §2 tool roster (if the surface changes); §6.1/§6.2 blockers; §7.2 verdict | Re-state the four-PR status (719/720 merged or not), append the PD-41/PD-42 product files, move P0‑1…P0‑4 from “blocking” to closed/carried with the new evidence, and rewrite §7.2 to GO/NO-GO **against the new candidate**, not the old tree. Do not rewrite the historical dated sections; append. |
| 3 | `docs/STATUS.md` | §1 一句话现状; §2 阶段总账; §3 当前基线 (disk truth); §4 待办/等待用户 | §1 is still a 2026-10-01 snapshot and must be replaced (not appended) by the current phase line: candidate id/SHA, C2 verdicts, GO/NO-GO, Authority pointer `as20261109r1`. §2 gains the closeout round row; §3 records the pointer/baseline **unchanged** and the new candidate; §4 drops the GO items. |
| 4 | `docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md` | §1; §2.1 F-2 block; §2.2 v5/F-2/F-3 rows; §4 (new F-1/PD-42 and F-4/PD-41 items); §4.12 F-6 wording; §5 header/last paragraph; §9 (PD-41) item 3 + scope sentence; “What these notes do not claim”; Evidence pointers | Add the **F-1/PD-42** item (pre-#720 v5 refused the family; #720 accepts 4/5; the ceiling-on-a-real-Host arm still not proven) and the **F-4/PD-41** item (1 consumption / 0 executions / 0 side effects). Fix §9 item 3's absolutes and the throw-shaped-cancellation wording; add the §5 observable-scope sentence. Add to “do not claim”: the conjunction is not proven, and no Host-UI machine-readable code exists. Add candidate-3 / C2 evidence pointers. |
| 5 | `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` | Index table (PD rows); PD-40 row; PD-41 row; **new PD-42 index row + body**; anchors | Create the missing PD-42 row (F-1: `MEMBER_POLICY_WITHOUT_BLUEPRINT` on v5; fixed by #720; residual tool-plane/realm gap named and linked to P0‑1). Narrow PD-41's “only observed completion” and “every dispatch refusal” sentences; cite WP1 in PD-40. Re-run the register test (`a5sf-debt-register.test.mjs`) after any anchor move. |
| 6 | `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` | Append a new dated §1.x block; do **not** edit the ⑧/⑨/V@B cells (owner asset) | Record the PD-41 fact-classification and PD-42 gate facts as dated evidence notes; state explicitly that no `V@B`/grade moved. If the GO evidence re-runs a matrix row on candidate-3, add the `verifiedFor` per row per plan §7.5/§7.6 — never global. |
| 7 | `docs/plans/active/alpha5-sandbox-first/ALPHA5-SANDBOX-BACKLOG.md` | §0.3 发布门位置 / §0.3.2 具名阻塞; face tables (FS, Subprocess) | Update the named blockers with the GO/NO-GO evidence and link the PD-42/PD-41 rows; do not close BL-39/BL-42 unless their own evidence lands. |
| 8 | `docs/plans/active/alpha5-sandbox-first/V016-PREVIEW-CLOSEOUT-BASELINE.md` | §1.1 merged table; §1.2 open PRs; §2 P0 list; §3 deliverables | This is a **snapshot at round start**. Append a dated “state changed since this baseline” block (or supersede it from the closeout plan): 719/720 status, P0‑1…P0‑4 disposition, candidate-3 freeze. Do not silently edit the historical rows. |
| 9 | `docs/plans/active/alpha5-sandbox-first/V016-PREVIEW-CLOSEOUT-PLAN.md` | whole file (does not exist yet) | Deliverable #7 of the owner's list: create it with the GO gate definition, the candidate-3 freeze record, the C2-A/C2-B assignment, and the explicit NO-GO fallback. |
| 10 | `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md` | §7.5/§7.6 (candidate track / `verifiedFor`); any phase-exit clause | Record candidate-3 as the frozen tree for the GO evidence and confirm the Authority pointer stays `as20261109r1` (D7); add the per-row `verifiedFor` obligation if any row is claimed on candidate-3. |
| 11 | `dev/engineering/candidates/cand-v0.1.6-3.json` (+ `freeze-candidate.mjs` run) | new file | Only after the product diff is final; it must pin the same host `639ed01539`, the same Authority `{as20261109r1, d85fdc1a…}`, and record the C2-A/C2-B scopes. **Do not move** `current-authority.json` (see §4.2). |
| 12 | `dev/agent-workflow/graph.yaml` + `dev/agent-workflow/SESSION_ROUTER_LOG.md` | `current_phase` / `state_pointers` / `ready` / `blocked`; append-only log | Close the audit round, record 719/720 and the GO/NO-GO verdict, and leave no stale `ready` entry naming a merged lane. Log only appends. |
| 13 | `docs/plans/active/alpha5-sandbox-first/LIVE-EVIDENCE-LEDGER.md` | §1 ledger, §5 DEV-LIVE arc (append) | Add the candidate-3 / C2-A / C2-B evidence rows with their evidence class; do not re-label DEV-LIVE rows as C2. |
| 14 | `docs/plans/active/alpha5-sandbox-first/RUNBOOK-CONTROL-ABANDONED.md` | only if the GO run changes A6-26 behaviour | If the closeout does not change A6-26, leave it; if it narrows the abandonment path, update the operator steps in the same commit. |

**Owner-edit boundary:** the matrix grades/`V@B`, the Preview Contract and the release decision are the
owner's assets. The developer closeout may **append dated evidence and disclosure**, but must not flip
a cell, delete a “not a security boundary” sentence, or move the Authority pointer to make a GO easier.

---

## 7. What I could not determine

1. **Whether the abort-reason hole in §1 row 2a is reachable in the exact Preview topology.** I read
   the code path (`shellCancelled` + `raceShellSettle` + `install.ts` reason forwarding), which proves
   the classification, but I did not boot a Host to observe a non-`user`/`parent` abort producing a
   `succeeded` fact. The falsifier is cheap: a WP3-style run whose abort reason is `inherited-signal` or
   a `DOMException`, then read the durable execution fact.
2. **The exact A2C-2 count of 19 unmanaged names.** I confirmed the number is cited in the packaged
   acceptance README and repeated in the notes; I did not re-derive the vocabulary myself.
3. **Whether `candidate/v0.1.6-2` was ever force-pushed before the local reflog existed.** The local
   reflog has one “branch created” entry and the remote tip equals the manifest SHA; I cannot prove
   server-side history beyond that from this clone. The manifest's own `candidate_ref.tip` and ancestry
   checks pass, which is the strongest available evidence.
4. **Whether the #715 author believed the disclosures landed.** I can prove the commit text and the
   diff disagree (one anchor line vs “both disclosed in §4.8/§4.9”); intent is not derivable from the
   repository.
5. **Host-UI rendering of the tool error text.** I proved the only field that crosses the Host tool
   boundary is `error.message` (host baseline `639ed01539`); I did not boot the Web UI to see the
   rendered string. The conclusion “no machine-readable code in the UI” follows from the payload, not
   from a screenshot.
6. **The PD-42 live runs' raw `.artifacts/tmp/…` directories** named in the README are gitignored and
   absent from this checkout; I verified the committed `runs/run1|run2` copies and the manifests, not
   the original scratch directories.
7. **Real-UTC vs session-date convention.** The repository's dated sections are written in the session
   calendar (real UTC = label − 1 day per `dev/agent-workflow/gates/CLOCK-ANCHOR-20261030.md` §3). The
   closeout must pick one convention and state it; I did not “correct” any existing date.

---

## 8. Quick reference — the overstatements only

| Where | Sentence to narrow | Why |
|---|---|---|
| PD-41 register row / §9 item 3 | “`succeeded` is reserved for a body whose end was observed” / “only a body whose end was observed is `succeeded`” | Abort with a reason other than `user`/`parent` yields `cancelled=false, timedOut=false, exitCode=null, settlement=cancelled` and is classified `succeeded` (`pipeline.ts:125`, `shell-mechanics.mjs:114-117`). |
| PD-41 register row | “every dispatch refusal a `ToolDispatchRefusalError`” | Four door refusals still throw bare `Error` (`install.ts:1020/1043/1058/1068`). |
| PD-41 PR body | “`isToolBindingRefusal()` is the one predicate a recovery path asks” | No production recovery path calls it; tests only. |
| PD-41 §9 / PR body | “A cancelled or timed-out body reports `unknown`” | Throw-shaped cancellation reports `failed` (`pipeline.ts:231`); disclosed elsewhere but not in this sentence. |
| PD-41 gate table | “`node scripts/doc-checks.mjs` → PASS” | The file is a library; the command is a no-op exit 0. |
| PD-42 PR body | “three **typed**, distinguishable refusals” | Three messages under one code (`MEMBER_POLICY_WITHOUT_BLUEPRINT`). |
| Release notes (master) | implicit “both planes documented” | F-1/PD-42 and F-4/PD-41 are **absent**; #715's message claims otherwise. |
| Release notes §4.12 | “Across runs the A6-12 family can end `already-decided` or with an abandonment row” | On this candidate both packaged runs ended `already-decided`; the abandonment variant is from a different candidate revision. |

---

*End of AUDIT-D-RELEASE report. Read-only; no product change, no Host boot, no merge.*
