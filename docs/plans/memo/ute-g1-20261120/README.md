# UTE G1 / UTE-0 — the frozen implementation contract (2026-11-20)

**Dated:** 2026-11-20 (session calendar). **Work package:** UTE-0 of the UTE G1
"Native Execution Consolidation" round — the first of five (UTE-0 contract →
UTE-1 FS native binding → UTE-2 execution settlement → UTE-3 per-family
migration → UTE-4 old implementation retirement).
**Branch:** `task/ute0-contract-20261120` (one branch, one writer).
**Base:** `origin/master` = `ef7e3af0088bf3af8fc765ce27951f9dbad92892`.
**Deliverable:** this memo + `scripts/ute-retirement-gate.mjs` (and its test
suite) + `dev/agent-workflow/ledgers/ute-retirement.json` + one evidence
directory + an additive census-lane argv wiring. See §7.
**Design input:** PR #765, draft head `9ec44189108510edbc58f3a63d8ef47307ccd843`
(`docs/plans/memo/unified-tool-execution-dsh-022-20261114/` 11 chapters and
`docs/plans/memo/ute-prep-20261116/` 7 files). #765 remains the owner's to merge;
this memo neither edits nor depends on its branch (§3).
**Design authority it consumes (does not replace):**
`docs/plans/memo/alpha5-sandbox-first-20261101/` (ADR / ARCHITECTURE /
IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN) and the active plan
set under `docs/plans/active/alpha5-sandbox-first/`.

> **Status: FROZEN IMPLEMENTATION CONTRACT for UTE-1…UTE-4, subject to the
> marker discipline below.** It is not an active plan, not an Authority change,
> not a release guarantee, and not a safety verdict. Freezing an interface is
> how later work packages avoid re-litigating it in code review; it is not a
> claim that the interface is implemented.

<!-- no-evidence-needed: this memo records decisions and proposals; every measured statement cites its source file or evidence path inline. -->

## 0. How to read every statement (marker discipline)

Every normative line in this directory carries exactly one marker. A proposal is
never presented as a decision, and a measurement is never presented as a policy.

| marker | meaning | who may change it |
|---|---|---|
| `[OWNER-DECIDED]` | The owner said this. It is an input, not an option. Changing it needs a new owner ruling. | owner only |
| `[PROPOSED-BY-MEMO]` | This memo's engineering proposal. It becomes binding only by the mechanism named in the sentence (owner approval, or the UTE work package that adopts it). | owner / the named work package |
| `[MEASURED]` | Observed in the current tree at the stated path/symbol. Falsifiable by re-reading that path. | whoever measures it again |
| `[UNKNOWN]` | Not measured, not decided, or measured on one generation only. Never to be read as a pass. | — |

## 1. What this memo freezes

| # | frozen item | where |
|---|---|---|
| F1 | The **single tool definition authority**: who owns a tool's name/schema/description today, and what the new path must consume instead of redefining | [`CONTRACT.md`](./CONTRACT.md) §1 |
| F2 | The **execution boundary**: where admission ends and execution begins, and what the new binding may and may not decide | [`CONTRACT.md`](./CONTRACT.md) §2 |
| F3 | The **settlement writer contract** as an interface (one canonical fact per physical execution; `UNKNOWN` first-class; no second Grant authority) — the interface UTE-2 implements | [`CONTRACT.md`](./CONTRACT.md) §3 |
| F4 | **Per-family retirement** as the owner's four-term predicate, with the evidence gate that proves each term and the named refusal codes | [`RETIREMENT.md`](./RETIREMENT.md) §1–§3, §6 |
| F5 | The two **currently blocking semantic differences** carried forward, and the compatibility-interface question that must be owner-approved before switching | [`RETIREMENT.md`](./RETIREMENT.md) §4 |
| F6 | **Non-goals** (no host upgrade, no Authority change, no ControlService rewrite, no fork) and the governance change a fork would require | [`CONTRACT.md`](./CONTRACT.md) §6, this file §5 |

## 2. Decision register

The register is the single place a reviewer checks "is this a decision or a
proposal?". Nothing below is presented as decided unless it says so.

### 2.1 Owner decisions (inputs)

| id | statement | marker | source |
|---|---|---|---|
| D1 | The UTE G1 round runs in the order **UTE-0 → UTE-1 → UTE-2 → UTE-3 → UTE-4**. | `[OWNER-DECIDED]` | round instruction, 2026-11-20 |
| D2 | `RetireAllowed = OldBaseline ∧ NewPathVerified ∧ SemanticDifferencesResolved ∧ NegativeControlsPass`. | `[OWNER-DECIDED]` | round instruction, 2026-11-20 |
| D3 | `SemanticDifferencesResolved` may be an **approved semantic change**, not byte equality. | `[OWNER-DECIDED]` | round instruction, 2026-11-20 |
| D4 | Retirement is **per family and incremental**; FS may retire before Web/PTY. | `[OWNER-DECIDED]` | round instruction, 2026-11-20 |
| D5 | `ControlService` remains the **sole** approval / Grant / Stop authority. | `[OWNER-DECIDED]` | round instruction, 2026-11-20; also `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md` §0 invariant 4 |
| D6 | G1 development is authorised only as **additive, isolated, coexisting paths**: not replacing the governed production path, not deleting ToolPlane/Family Body, not changing production Authority, not enabling a fork. | `[OWNER-DECIDED]` | PR #765 owner review 2026-11-16, quoted verbatim in `ute-prep-20261116/04-FIRST-SLICES-G0-G1.md` §1.5 |
| D7 | `CORE PATCH BUDGET = 0`; the `AGENTS.md` fork prohibition stands as-is. Lifting it needs a **governance ruling**, not an engineering PR. | `[OWNER-DECIDED]` | `AGENTS.md` 红线; `docs/ROUTER_RULES.md` §0.3, §0.1 |

### 2.2 Measurements this contract is built on

| id | statement | marker | source (re-read it; do not trust this line) |
|---|---|---|---|
| M1 | The model-visible `ToolDefinition` / toolSet / executor selection authority is the **host's** `ToolsService`; the Team repository does not own a parallel executable definition catalogue for native tool names on the new path. | `[MEASURED]` | `scripts/eb3-tool-acceptance.mjs` header ("THE CLAIM SET IS READ STATICALLY…"); `docs/plans/memo/ute-prep-20261116/03-RULINGS-AUTHORITY-BINDING-SETTLEMENT.md` 裁决 1 and `unified-tool-execution-dsh-022-20261114/02-MODULES-AND-AUTHORITY.md` §2 |
| M2 | The **legacy governed path** does own a second definition channel: FamilyAssembly descriptors build row definitions (`buildReadRowDefinition`, `buildWriteRowDefinition`, `buildEditRowDefinition`, `buildImageRowDefinition`) and the plane registers governed definitions (`createGovernedToolDefinitions`). | `[MEASURED]` | `packages/tools/families/manifest.json`; `packages/runtime/src/plugin/live/family-assembly.mjs`; `packages/tools/fs-family/src/{read,write,edit,image}-row.mjs`; `packages/tools/a5p5-tools/src/register.ts:325` |
| M3 | The **new native path** attaches upstream modules: `mountMemberA5sfRealm` / `attachA5sfNativeToolModules` mount the upstream module on an isolated scope, so name/schema/description come from the upstream `ToolDefinition`. | `[MEASURED]` | `packages/runtime/src/plugin/live/a5sf-realm-row.mjs:846` (`mountMemberA5sfRealm`), `:1516` (`attachA5sfNativeToolModules`); `packages/runtime/team-services/src/mount.ts:814` (`mountA5sfRealm`) |
| M4 | One Team seam arms the whole pipeline: `installScopedToolGuard` registers the `tools.guard`, `tools/pre-execute`, `tools/post-execute`, `tools/result` and `tools/execute` arms. | `[MEASURED]` | `packages/runtime/tool-dispatch/install.ts:356` (`installScopedToolGuard`), arms at `:365`, `:791`, `:812`, `:831`, `:982` |
| M5 | A durable execution-result fact already exists, per ControlRequest, written by `ControlService.recordExecutionResult({rootSessionId, callId, instanceId?, outcome: 'succeeded'\|'failed'\|'unknown'})`, idempotent per request, fact type `control-execution-result`, and explicitly *lifecycle observation, never an approval / consumption / replay authorization*. | `[MEASURED]` | `packages/runtime/control/service.ts:3572`; `packages/runtime/control/types.ts:2427`; call sites `packages/runtime/src/plugin/live/agent-bindings.mjs:3259` (fire-and-forget `void`) and `packages/runtime/operation-permission/pre-execute-adapter.ts:1248–1280` |
| M6 | The rc.5 `tool-fs` `mapError` dereferences `policy.mode` when it sees `FS_SANDBOX_DENIED`; a lane-only provider raising that code crashes the write tool. | `[MEASURED]` | `tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md` (entry 1) and `tests/ute-g1-fs/lib/semantic-differences.mjs`, both asserted by `tests/ute-g1-fs/lane-suite.test.mjs` |
| M7 | The FS prototype's measured record is 10/10 vectors green on the pinned next host, with 4/4 negative controls green — **and** both semantic differences printed as `blocking=yes` on every run. | `[MEASURED]` | `dev/agent-workflow/evidence/ute-g1-fs-20261119/new-path-run.txt`, `.../negative-controls.txt` |
| M8 | The FS prototype does **not** prove read confinement; the witness is snapshot-based and a successful `read()` leaves no detectable change. | `[MEASURED]` / owner-vetoed claim | `tests/ute-g1-fs/README.md` §7.1; `ute-prep-20261116/04-FIRST-SLICES-G0-G1.md` §2 G1-S1 |

### 2.3 Proposals this memo makes (binding only where §3/§4 say so)

| id | proposal | marker | becomes binding when |
|---|---|---|---|
| P1 | The new path **consumes** the host's `ToolDefinition` and must not register a Team-defined native replacement; a Team "definition receipt" is verification data, not a definition catalogue. | `[PROPOSED-BY-MEMO]` | UTE-1 implements it and review accepts; conflicts with M1/M3 would be a `CONTRACT_CHANGE_REQUEST` |
| P2 | The admission/execution line is the `tools.guard` return: nothing after it may re-decide approval, and nothing before it may claim an effect exists. | `[PROPOSED-BY-MEMO]` | UTE-2 implements the settlement boundary at that line |
| P3 | The settlement writer interface in `CONTRACT.md` §3 (`ExecutionSettlementWriter.record(fact)`) is the interface UTE-2 implements; the existing `recordExecutionResult` survives as a **read-compatible projection**, not as a second writer. | `[PROPOSED-BY-MEMO]` | UTE-2 lands; until then the measured writer is the only one (M5) |
| P4 | An approval of a retirement-blocking semantic difference is signed by the **owner** and recorded as a committed, dated approval file naming the approver; the Integration Owner may transcribe but may not grant it. | `[PROPOSED-BY-MEMO]` | owner confirms the signature convention; the *requirement* of approval is already D3 |
| P5 | `SemanticDifferencesResolved` is derived from the difference list (every `blocking:true` difference needs an approval), never asserted as a bare boolean. | `[PROPOSED-BY-MEMO]` | this memo's gate implements it today; changing the derivation is a contract change |
| P6 | A per-family retirement ledger plus the machine gate `scripts/ute-retirement-gate.mjs` is the only route to UTE-4; the gate refuses a row whose evidence is untracked or does not state the claimed verdict. | `[PROPOSED-BY-MEMO]` | this PR; the gate is additive and gates nothing else |

## 3. Relation to PR #765 (draft, owner's to merge)

#765 is the design source for the UTE thesis. This contract **adopts, sharpens
or defers** — it never silently rewrites.

| #765 element | disposition here |
|---|---|
| `ToolsService` as the single ToolDefinition/Executor authority (UTE-01/02) | **Adopted verbatim** as `CONTRACT.md` §1's first sentence, with the measured symbol table (M1–M3) added. |
| No second Grant authority (UTE-13); ControlService owns approval/Grant/Stop | **Adopted verbatim** (D5), and stated as a hard "may not" for the new binding. |
| One physical execution, one canonical fact; `unknown` first-class (UTE-15/16) | **Adopted**, and **sharpened** into an implementable interface (`CONTRACT.md` §3) with the measured existing writer (M5) as its compatibility floor. |
| S1 hard guarantee (fact-or-unknown per dispatch) / S2 separate stronger gate (commit-before-return) from `ute-prep-20261116/03` 裁决 2 | **Adopted verbatim**; S2 remains *not* a G1 precondition and is not claimed here. |
| Retirement ordering rule R-S3.1 ("no family retires before equivalence is proven or the semantic change is recorded and owner-approved") | **Adopted verbatim** as the four-term predicate (D2/D3) and **sharpened** into named evidence gates + refusal codes (`RETIREMENT.md`). |
| UTE-12 read-axis honesty: `CLAIM_NOT_OBSERVABLE`, read-confinement UNPROVEN | **Adopted verbatim**; recorded as a standing limit, not a TODO to be waved away. |
| G0–G5 horizontal gates and the G1-S1…S5 slices | **Referenced, not re-cut.** UTE-0…UTE-4 is the owner's *work-package* ordering; it is not a replacement for #765's gate table, and where they differ the owner's ordering governs scope while #765's gate text governs evidence quality. |
| The five-way `ExecutionAttempt` / `ExecutionObservation` data model | **Sharpened**: this memo fixes only the writer interface and the fact's required axes; it does not freeze field names beyond that, because UTE-2 needs room to match the host's actual shapes. |
| The Chapter-8 asset-by-asset migration table | **Deferred to UTE-3** per family. This memo freezes the predicate, not the deletion list. |
| The Chapter-9 fork boundary (limited, named, per-instance approval) | **Deferred and fenced**: D7 stands. The fork exception text is recorded in #765 (`ute-prep-20261116/06`) but is **not applied**; applying it is a governance ruling (see §5). |
| The `web_search` `llmProvider` routing change (G1-S2) | **Deferred to UTE-3/Web**; it is a semantic change requiring owner approval and is out of UTE-0/1/2 scope. |

## 4. The two carried-forward blockers

Both are `retirement-blocking YES` in
`tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md` and both are printed on every
prototype run. They are **not** closed by this memo; `RETIREMENT.md` §4 records
the compatibility-interface question the owner must answer before the FS path is
switched, and the ledger's `semanticDifferencesResolved` term is `false` because
of them. Do not restate this as "FS is equivalent".

## 5. Non-goals (explicit, and why)

| non-goal | marker | consequence if someone tries it |
|---|---|---|
| **No host upgrade.** The legacy pin `0.2.0-rc.2 @ 639ed01539` and the second pinned tree `0.2.2-rc.5 @ 9c2670d3…` stay two coexisting trees; the new path is validated **on the pinned next host**, not by replacing the legacy pin. | `[OWNER-DECIDED]` (D6; #765 R1.1–R1.4) | A pin move is a separate, named ruling (`ute-prep-20261116/03` R1.2/R1.3), not a side effect of UTE work. |
| **No Authority change.** `dev/engineering/current-authority.json` and the six-field contract do not move for UTE-0…UTE-4. | `[OWNER-DECIDED]` (D6) | Authority migration is its own PR (`publish` → `switch`) with rollback, per `current-implementation-plan.md` §5. |
| **No `ControlService` rewrite.** The settlement work extends how facts are **keyed** and **when they land**; it does not replace ControlCase/Grant/Stop, does not create a second approval ledger, and does not re-decide approval inside the executor. | `[OWNER-DECIDED]` (D5) | A second Grant authority is a UTE-13 violation and a hard block, not a review finding. |
| **No fork.** The `AGENTS.md` prohibition ("不得 vendored 修改过的 upstream 副本"; `CORE PATCH BUDGET = 0`) stands. Lifting it needs a **governance ruling** that writes the exception into `AGENTS.md`; the draft patch text exists (#765 `ute-prep-20261116/06` 补丁 B) and is deliberately **not applied** here. | `[OWNER-DECIDED]` (D7) | A `packages/**` copy of an upstream plugin without a dated governance ruling is an unauthorised vendor drop. |

`docs/ROUTER_RULES.md` §0.1 (shared-file ownership) is unchanged: `install.ts`,
`mount.ts`, the product row, the Authority pointer and member lifecycle remain
Integration Owner files. This memo proposes no change to them.

## 6. UNKNOWNs (stated, not hidden)

1. `[UNKNOWN]` Whether UTE-2 can implement `ExecutionSettlementWriter` **without**
   a fork of any upstream executor. S2 (commit-before-return) is the specific
   place where #765 already predicts a possible `CORE_SEAM_BLOCKER`; this memo
   does not pre-judge it.
2. `[UNKNOWN]` Whether the two blocking FS differences will be closed by (a)
   adopting the `fs-sandbox` protocol or (b) keeping a non-sandbox refusal code.
   Both are compatibility-interface choices; neither is decided.
3. `[UNKNOWN]` Whether the owner will sign semantic-change approvals under the
   record convention proposed in P4. The requirement to approve is decided (D3);
   the convention is not.
4. `[UNKNOWN]` Whether any *other* family's old path has a definition channel
   beyond the FS/Web/PROCESS families measured for M2. UTE-3 must measure per
   family; this memo does not extrapolate.
5. `[UNKNOWN]` Live-boot behaviour of the FS prototype inside a real agent
   composition (G1-S1 §2.1 in #765). The contract does not require it for
   *contract* purposes, and no safety verdict may cite the C1 record as if it
   were a boot.

## 7. What this PR changes (and what it deliberately does not)

New files:

- `docs/plans/memo/ute-g1-20261120/{README.md,CONTRACT.md,RETIREMENT.md}` — this contract.
- `scripts/ute-retirement-gate.mjs` — the machine gate.
- `scripts/ute-retirement-gate.test.mjs` — positive + negative controls and mutation transcript.
- `dev/agent-workflow/ledgers/ute-retirement.json` — the per-family ledger, seeded with `fs` = `NOT_RETIREABLE`.
- `dev/agent-workflow/evidence/ute0-contract-20261120/` — verbatim gate transcripts.

Additive edits (the census lane must execute the new suite, and the mirrored
manifest leg must byte-match):

- `.github/workflows/census-runtime.yml` — one token on the existing "next host
  lane" `run:` argv.
- `dev/ci/eb3-ci-manifest.json` — the same token in the mirrored `check[]`.

**Not touched:** `AGENTS.md`, `docs/ROUTER_RULES.md`, `docs/TEST_METHODS.md`,
any governance document, any active plan, `dev/engineering/**`, `packages/**`,
`tests/paths.mjs`, PR #765's branch, dispatch legs, parity evidence and
`scripts/test-catalog.test.mjs`.

## 8. Local gates observed for UTE-0

Verbatim transcripts: `dev/agent-workflow/evidence/ute0-contract-20261120/README.md`.
A gate that was not run is reported as `NOT RUN`, never as green.
