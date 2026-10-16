# Review — Alpha.5 PR2 (`#256`) Operation Admission + multi-effect ApprovalCase + one-shot ExecutionGrant

- **Reviewer**: independent (≠ implementer), model `qwen3.8-flash-next`; powered-by (verbatim): `DeepSeek Harness`.
- **Code object**: `7ab7599d` (code head = `4f2dfd08` + evidence commit). **Branch tip reviewed**: `7a2998bb` — the one commit after `7ab7599d` is **docs-only** (`git diff --name-status 7ab7599d..7a2998bb` = 5 files, all `.md`: router log, manifest, PR body, s12 map, lane README; **zero `.ts`/`.mjs`/`.json`/test touched** — verified).
- **Base**: `45425a30` (`origin/alpha5-pr1-onto-master`). Diff reviewed: `45425a30..7ab7599d` (62 files; code delta `45425a30..4f2dfd08` = 45 files / +4634 / −16, as declared).
- **Method**: independent reads of the six lane sources + all eight test artifacts + the four amended pins; tests, audits, typecheck, lint-universe and a `tsc` rebuild **run** in a detached review worktree; two throwaway probe specs executed against the lane (deleted after the run, never committed). No merge, no push to any base branch.
- **三值 per item**: `PASS` / `可裁` (record or supplement, non-blocking) / `FAIL` (must close).

## 0. Verdict

**补充内容** (one supplement request F-1 + five record-level items). Nothing found blocks the lane's semantics: H1 and H2 are landed and test-pinned as claimed, the one-shot edge is real, the algebra is imported and not restated, the lane is DORMANT, and every headline number reproduces. F-1 is a genuine hole in a law this lane states about itself, is currently unreachable in production (zero consumers), and is closed by a small plan-compatible addition — so it is a supplement, not a blocker, and it must land before PR3 wires the presenter.

## 1. H1 — clock finiteness owned by Admission: **PASS**

Read order, not prose order:

| leg | code | what runs before anything else |
| --- | --- | --- |
| `admit` | `admission-kernel.ts:304-310` | `clockGate` is the **first** statement; on refusal the only action is `observe({event:'admission-clock-refused'})` and `denied` — identity (`:312`), assurance (`:315`), expansion (`:318`), mint (`:347`) are all after it |
| `issueApprovedGrant` | `admission-kernel.ts:353-359` | same first-leg shape before identity/assurance/verify/mint |
| `consumeForExecution` | `admission-kernel.ts:397-399` | gate before the cancel check and before the ledger |
| ledger edge (re-gate) | `grant-mint.ts:132-139` | `requireFiniteClock` runs **before** `validateGrantForCall` (`:144`), so the PR0 expiry leg never sees a non-finite `now`, and `consumed` is untouched |

- Gate itself: `clock.ts:42-48` (`classifyClock`: non-number / NaN / +∞ / −∞) and `clock.ts:57-70` (typed `APPROVAL_STALE`, `details.refusal='clock-not-finite'`, returns the *same* number back — a gate, not a converter).
- **body=0 is pinned with counters, not adjectives**: `a5p2-kernel-harness.ts:69-122` instruments probe/register/consume + an ordered `sequence`; `a5p2-admission-clock.test.ts:76-103` asserts `probeCalls 0`, `registrations 0`, `consumptions 0`, `sequence: []` for NaN/+∞/−∞ with a policy that *would* allow and a probe that *would* answer. `:105-136` pins the consumption-edge gate *and* that the refused grant is still spendable with a finite clock.
- **PR0 strict `>` untouched**: `packages/domain/**` appears in the diff only as `test/a5p0-layer-audit.test.ts`; `grant.ts` is not in the diff. The `>` semantics are re-pinned, not restated: `a5p2-admission-clock.test.ts:165-172` (`now === expiresAt` → ok, `5001` → `grant-expired`).
- Mint-side hygiene: `admission-kernel.ts:226-235` refuses a non-finite/pre-issuance expiry (`grant-expiry-policy-defective`), pinned at `a5p2-admission-kernel.test.ts:338-345`.

**Independent reproduction**: 6 specs → `Test Files 6 passed / Tests 73 passed`; RED-first reproduced by removing the lane sources → `Test Files 6 failed (6) / Tests no tests`, exactly the shape of `runs/red-first-a5p2.log`.

## 2. H2 — assurance runtime verification before hard-profile: **PASS** (with F-5 on the demand seam)

- `assurance-runtime.ts:117-189`: per demanded dimension — missing record `:129-133`; **level below demand → `IO_POLICY_UNSUPPORTED`** `:135-143`; **level claims enough but mechanism/trustRoot/evidence null-or-blank → `TOOL_BINDING_UNVERIFIED`** `:146-148` (this is the `enforced`+null example, verbatim); probe cannot observe `:150-154`; claim contradicts the probe on **any** field including `realmId` `:155-161`; every failure reported, never just the first `:171-186`.
- Kernel position: `admission-kernel.ts:315` — assurance before the expansion plane (`:318`) and before any mint (`:347`); `:358-359` the same at issue time. Ordering is test-pinned by trace, not by narrative: `a5p2-admission-kernel.test.ts:179-192` asserts `sequence === ['probe:content-read', 'register']`, and `:161-177` pins "enforced claim with no probe observation → denied, `probeCalls 1`, `registrations 0`".
- `enforced`+null = refusal has a test in both directions of the field (`a5p2-assurance-probe.test.ts:42-59`), plus realm mismatch / blank strings / every-failing-dimension (`:70-114`).
- Stub port shape and PR4 replacement contract: `assurance-runtime.ts:58-84` (`AssuranceProbe = (binding, dimension) => answer`, unobserved dimension → `{ok:false}`) vs README `## Stub probe semantics` items 1–3 (`README.md:56-71`) — **code and README agree**, and the per-call-with-binding contract is pinned at `a5p2-assurance-probe.test.ts:132-141`.

## 3. Grant one-shot: **PASS**

- `grant-mint.ts:132-157`: validate (PR0 `validateGrantForCall`, frozen precedence, frozen `grantRefusalErrorCode` mapping) → **mark in the same synchronous step**; the typed signature `consume(grantId, call) => ConsumeOutcome` (`:101`) makes an `await` between validate and mark *unrepresentable in the type*, which is stronger than the interleaving test alone. The race is nonetheless pinned behaviourally: `a5p2-grant-oneshot.test.ts:162-177` (two interleaved async consumers → exactly one winner, loser reason `grant-consumed`).
- Replay surfaces: reuse of a spent grant (`:81-95`), reuse under a *better-matching* second call (`:97-107`, PR0 precedence intact: fingerprint leg fires before consumption), grantId re-issue refused (`:179-187`, `grant-id-reuse`), stranger ledger refused (`:189-197`), cross-Member theft (`:109-121`), effect-outside-grant keeps the frozen `TOOL_BINDING_UNVERIFIED` (`:135-146`).
- `grantIdForCall` determinism (`admission-kernel.ts:143-156`) means a double mint is a refused re-register, pinned at `a5p2-grant-oneshot.test.ts:200-216`.
- Cancel before/during/after rides PR0's lease algebra with the one-shot never refunded (`a5p2-admission-kernel.test.ts:287-335`), and a post-consume lease failure says `sideEffectUnknown: true` instead of pretending (`admission-kernel.ts:425-437`).
- **ONE-case-many-effects is not bypassed by a whole-set approval**: `approval-case.ts:276-347` re-derives, per effect, `evaluateAuthorityCeiling` + both `mayReview` legs + `grantCeiling`, and any single failure refuses the WHOLE set; the batch opening at the max rung never substitutes for legality (`:223-227` uses the imported `authorityRank`, and the verify path never sees a max). Tests: partial coverage refuses all while effect-0-alone passes (`a5p2-approval-case.test.ts:148-168`), escalated rung defeats the old reviewer (`:207-225`), self-approval refused (`:188-205`), foreign fingerprint / moved generation / unreadable doc (`:227-284`).

## 4. Reuse, not a second algebra: **PASS**

- `deny<ask<allow` exists once in source: `packages/domain/authority-envelope/src/authority-envelope.ts:71-74`; the lane only *imports* it (`approval-case.ts:49`, used at `:91-92`). Repo-wide grep for a second ordering table finds only that definition and build artifacts under `dist/`.
- The dual plane is used as two functions: expansion via `evaluateToolPolicyExpansionAuthority` (`approval-case.ts:131`), approval via Alpha.4's `evaluateAuthorityCeiling` (`:196`, `:299`), ladder/legality via `mayReview`/`grantCeiling`/`authorityRank` (`:60-68`). No local ceiling walk, no local ladder, no local reason→code table (`grant-mint.ts:39-49` imports PR0's).
- The repo's own amendment mechanisms were used, not bypassed: `a3p3-governance-lane-hygiene.test.ts:826-832, 841-901, 1098-1110` extends the SURFACE rows **per symbol** with reviewed-amendment comments; `a5p0-layer-audit.test.ts:36-46` pins the consumer set at 9 files. Both green in my run (4 + 21 tests).
- `node scripts/audit-a5-tool-governance-imports.mjs` → `OK … 9 consumer file(s)` (run at head).

## 5. DORMANT + diff discipline: **PASS**

- Zero production importers: grep over `packages/*/src` finds no `tool-admission` reference; the only outside mentions are the lane's own tests, `a5p0-layer-audit` allow-list, the hygiene rows, the p4t6 named list, and the audit script. `runtime/src/plugin/live/agent-bindings.mjs` untouched.
- Diff surface reconciles file-by-file with §12: 21 non-dist artifacts (6 sources + README + 8 test artifacts + 2 tsconfigs + audit script + layer-audit + hygiene + p4t6) + 24 `dist/` files = the declared 45; the evidence commit adds the declared 17 captures; the docs tip adds 5 `.md`.
- **The committed `dist` is a faithful build, not a hand-edit**: my `tsc -p packages/runtime/tsconfig.build.json` rebuild reproduces all 12 committed `.js`/`.d.ts` **byte-identically**; only the 12 `.map` files differ, and only in their `sources` paths (an artifact of my `--outDir`). Committing lane `dist` follows the existing repo state (base tree already carries `packages/runtime/dist/**`).
- **p4t6 扩账程序合规**: 14 named paths (6 sources + 6 specs + fixtures + harness), each asserted present *by path*, and **both endpoints measured** — `runs/p4t6-PRE-EXTEND-RED.log` carries `expected 1087 to be 1073`, the tie asserts `1087 - 1073`, and the suite is 10/10 green in my run.
- Typecheck (my run, `pnpm -r run typecheck`): **exit 0**, all 9 packages Done.

## 6. Baseline claims: **PASS** with one attribution defect (F-3)

- Census arithmetic matches: base log `22 failed / 6651 passed (522 files)`, head log `21 failed / 6725 passed (528 files)`, and both JSON censuses carry the same numbers; `only_in_after = []`.
- Three head identities spot-checked against the **base** capture: `rc2-persona-probe::PP3` (both legs), `plugin-dsh-compat::F1` (all six legs), `p6t3-mediation::1/3/4/5/7` — all `FAIL` in `runs/base-suite.log` too, i.e. pre-existing, not PR2-attributable.
- Lint corroboration **re-measured independently**: `node scripts/lint-identities.mjs --diff runs/lint-identities-base.txt` at head → `universe: 1172 file(s) linted`, `new 0, resolved 0` (1158 → 1172 = exactly the 14 added files).

## 7. Findings

| # | severity | file:line | finding | three-value |
| --- | --- | --- | --- | --- |
| **F-1** | MAJOR (supplement, pre-PR3) | `approval-case.ts:276-283`, `admission-kernel.ts:353-395` | **The presented approval is never tied to the member whose case it is.** `verifyEffectSetApproval` takes no member input and `issueApprovedGrant` never compares `approval.approvalCaseId` with `toolAskApprovalCaseId({teamSessionId, instanceId, effectSetFingerprint, authorityGeneration})` — so the identity this lane defines as *(member, fingerprint, generation)* is enforced only on 2 of its 3 legs at the execution boundary. Probe (throwaway spec, then deleted): member `inst-A`'s leader-leg approval, presented unchanged on member `inst-B`'s identical call at the same generation, returns `ok` and mints a grant. The lane's own tests make this visible: they pass arbitrary case ids (`'tadm-case-1'`, `'case-1'`) and nothing rejects them. Alpha.4's comparable path does not trust a presentation — `governance/permission-approval.ts:358-407` resolves the durable case via `findApprovalCaseByIdentity` + `readApprovalCaseState`. **Minimal close (either)**: (i) recompute the case id from `request.member` + the already-checked fingerprint/generation and refuse on mismatch (+ a "foreign member's case refuses" test); or (ii) take an Alpha.4-style case-read port and resolve rather than trust. Until then README/plan §5 should state that `PresentedApproval` is trusted assembly input — note the asymmetry with the clock, which this lane deliberately treats as hostile. | **FAIL → must close before PR3 wires the presenter** (not a blocker now: lane DORMANT, zero consumers, no shipped surface) |
| **F-2** | MINOR | `approval-case.ts:333-344` | The **envelope-coverage half** of the A3-2 equation has no test that isolates it. Both existing whole-set refusals fire the rung leg (probe output: `effect 1: the required rung rose to human-user …`), so "`grantCeiling` short while the rung passes" is unpinned — while plan §5 names both halves ("reviewer 的批准位置 **与** Envelope 覆盖"). Add one fixture where the reviewer's rung is high enough and only the ceiling on that effect's realm-qualified scope falls short (the docs combination that produces it is an Alpha.4 question — my probes reached the rung leg or acceptance in every combination I could build). | 可裁 (test gap; pre-PR3 recommended) |
| **F-3** | MINOR | `s12-delivery-map.md` §(e), router log | The FIXED attribution for `a4p7-merge-gate`'s scratch-lint leg over-claims its mechanism: "base had no built dist → this round rebuilt the committed dist → self-greened" cannot be the cause — `eslint.config.mjs:16` ignores `**/dist/**`, and my own head run measures `universe: 1172` = base `1158` + exactly the 14 added source/test files, i.e. the committed `dist` contributes **0** to the measured universe. The substance survives (another instrument's build-state leg, `a4p7-merge-gate.test.ts` untouched by this diff, base raw message preserved verbatim at `base-suite.log:1683`, no PR2 code path under it). Reword to "build-state leg of another instrument, green again at head, cause not established". | 可裁 (attribution wording) |
| **F-4** | MINOR | `runs/fail-set-diff.json` vs `runs/fail-set-diff.txt` | Two same-stem captures shipped side by side, one stale: the `.json` is the **pre-tie** state (`NEW 1` = the p4t6 count leg, `baseline=22 current=22 NEW=1 FIXED=1`), the `.txt` is the final gate result (`NEW=0 FIXED=1`). Read alone, the `.json` shows a NEW red at head. Rename to `fail-set-diff.pre-tie.json` or add a one-line label + a manifest note. | 可裁 (evidence hygiene) |
| **F-5** | MINOR | `admission-kernel.ts:85-87, 216-221`, harness default `:130` | H2's **demand side** is a new seam: `RequiredAssuranceReader` is assembly-supplied and no derivation law for it exists in the tree (PR0 exports only `assuranceSatisfies`, `domain/tool-governance/src/index.ts:56-63`). With an empty reader — the harness default — a contract claiming `enforced` with null evidence passes, because nothing is demanded. PR2 cannot invent the domain law, so this is not a defect; but the README should state that the assembly owes a policy→demanded-dimension derivation, and PR3/PR4 must pin it with a test, or H2 is starvable by wiring. | 可裁 (record + PR3 obligation) |
| **F-6** | NIT | `s12-delivery-map.md` §(b) | "head = `4f2dfd08`" while the PR head is `7ab7599d` (docs tip `7a2998bb`); the tip addendum already half-fixes this. Label it "code head". | 可裁 |

**Observation, outside PR2's scope** (no PR2 law involved, flagging for PR3/PR4 or an Alpha.4 question): with a Team hard envelope carrying a `deny` cap on an effect's scope and reviewer `human-admin`, `verifyEffectSetApproval` accepts (probe output `ACCEPTED`), because the ceiling walk PR0/Alpha.4 owns lets the top rung sign and the issue-time re-run checks the **policy document**, not the hard envelope. PR2 imports that behaviour verbatim and adds nothing; if the behaviour is unintended it is an Alpha.4 finding, not a PR2 one.

## 8. Suggested user spot checks

1. `packages/runtime/tool-admission/approval-case.ts:276-347` + `admission-kernel.ts:353-395` — decide F-1 close (i) vs (ii); it is the only place where a presented approval's identity could bind.
2. `packages/runtime/tool-admission/admission-kernel.ts:304-320` — confirm to your own taste that the H1 leg precedes every side-effecting leg and that H2 precedes the expansion plane and the mint.
3. `packages/testkit/test/p4t6-session-event-scan.test.ts:2224-2252, 2555-2566` — the tie form you asked for (named files + both endpoints measured).
4. `dev/agent-workflow/evidence/alpha5/pr2/runs/fail-set-diff.json` vs `.txt` — F-4; and §(e)'s FIXED sentence if you care about attribution wording.
5. The lane README's new `NOT FROZEN` section (tip `7a2998bb`): the PR1r residual-boundaries hold is recorded as prose — confirm you want the freeze-hold carried this way.
