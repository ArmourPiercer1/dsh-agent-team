# V016-PREVIEW-CLOSEOUT-BASELINE — the real state at the start of the v0.1.6-preview closeout

**Written:** 2026-11-11 (real UTC clock) by the Integration Owner, before any product change of this
round. **Every claim below was re-derived from the repository and GitHub at that moment**, not carried
over from a plan: `git fetch`, `gh pr list`, `verify-candidate.mjs`, `git log`. Where a number could not
be re-derived, the row says so.

**Integration baseline:** `origin/master` @ `9e1c493b6` ("WP2-A6-GOVERNED-GOAL … (#716)").
**Authority pointer:** `as20261109r1` (`content_digest sha256:d85fdc1a…398b3`), **unmoved** this round.
**Frozen candidates:** `cand-v0.1.6-1` @ `168266dbf`, `cand-v0.1.6-2` @ `bb3c158eb` — both immutable.
`verify-candidate.mjs --manifest cand-v0.1.6-2.json` → **VERIFIED, PASS=145** on this baseline.

Preview is **not** GO. `v0.1.6-preview` is the release target of this round; no RC tag exists and none
may be created by the developer agent.

---

## 1. What the repository actually contains today

### 1.1 Merged this round (all on `origin/master`)

| PR | commit | what it established |
| --- | --- | --- |
| #710 | `bb3c158eb` | **A6-STOP-FENCE** (owner ruling A): one sync abort check inside the per-Team lock, immediately before the durable `control-allow-consumed` write; on trip → no consumption, exactly one `control-request-abandoned` (`invocation-cancelled-before-consumption`), allow row untouched, sequence deliberately burned. Wired in four lanes (PA bridge, A4/A5 ask lane, `team_*` guarded tools, `consultGuard`). The residual window (sub-ms between probe and write) is disclosed, not closed. |
| #711 | `cbf1c1df6` | `cand-v0.1.6-2` frozen (manifest + candidate ref). |
| #712 | `b079d1b95` | **C2 round 2** on cand-v0.1.6-2: **C2-A PASS** (2/2 agreeing), **C2-B NOT PASS** (Stop arm clean but mechanism-attribution incomplete; Sticky Stop and the A6-on+governed Goal conjunction not established). |
| #713 | `11e62d00d` | **Packaged acceptance**: real `pnpm pack` → `dsh plugin --profile web add` → Team → 3 Members → human approval (1 consumption / 1 execution) → Goal 3 rounds → Stop (0/0) → collection → SIGKILL cold recovery, **2 runs, 37/37 each, agreeing**. Found **F-1…F-6** (PD-42, PD-41, F-2, F-3, F-5, F-6). |
| #715 | `8ebb68b6f` | Docs: F-1 → PD-42, F-4 → PD-41 disclosed in §4.8/§4.9; PD-20 anchor moved with the fence round. |
| #714 | `1d8bdb92b` | **WP3**: the A6-12 Stop placed on the guard's existing 250 ms poll grid (env-gated, default byte-identical, `tests/**` only). 29 boots → **11 fence-reached**, 3/3 at one offset; residual window **not hit** and reported as an instrument limit, not as proof of unreachability. |
| #718 | `1dfc6d37c` | Docs: Sticky Stop governs **review wakes**, not all traffic; `ownerRootSessionId` is the mount/boot root. PD-40 stays open. |
| #717 | `94d5293ef` | **WP1**: Sticky Stop measured on both sides of the latch. Arm A (latch) 6/6×2 — marker written, byte-identical across SIGKILL+cold boot, consulted (new legs, zero new wakes), relays cannot clear it. Arm B (no latch) 4/4×2 — no marker, no false claim, reviewer reactivated after one human turn. |
| #716 | `9e1c493b6` | **WP2**: Goal × A6 × governed, two provenances. Direct human input: goal rev1→2→3, 2 rounds, Stop → durable paused, 0 continuation. Machine relay: `create_goal` refused `GOAL_TOOL_AUTHORITY_REQUIRED`; governed `bash` on that turn still ran. **The literal single-Team conjunction was found impossible** (PD-42) and that impossibility is reported, not hidden. |

### 1.2 Open PRs that matter to this closeout

| PR | state | what it is | what it still needs |
| --- | --- | --- | --- |
| **#720** | open, CI re-running | **PD-42 gate fix**: `derivedMembersOf()` accepts `[4,5]`; family still from the same bound/hashed document; three typed refusals. Real Host: one v5 Team with **both** families admitted, Officer wakes 3 / Leader 0, 2 legs each consumed once, approved call executed once. | The **ceiling arm is not proven**: the A6 execute leg dispatches the Team tool plane, which owns `bash` and displaces the realm's confined terminal (`read`/`write` → `TOOL_BINDING_UNVERIFIED`, 0 a5sf guard facts). Goal/Stop/relay arms in that Team were **not attempted**. |
| **#719** | open, CI re-running | **PD-41**: consumption order kept; `succeeded` only on observed completion, cancelled/timed-out → `unknown` (this fixed a **real mis-report**: a cancelled confined shell had been durably recorded `succeeded`); typed `ToolDispatchRefusalError` (`TOOL_BINDING_UNVERIFIED`); no replay; preflight **deferred**. | Owner asks for the typed refusal's **observable scope** on a real Host dispatch path before the notes may claim Host UI machine-readability. |
| #708 | open, draft | A6 deny diagnosis: the deny arm's missing request is a **kit precondition**, not a product defect. | Decide whether to merge as evidence or close as superseded by #712's corrected deny arm. |
| #696 | open, draft | Independent review of `c66fa8b03` (pre-fence): no P0, 3 P1. | Re-adjudicate the P1s against post-fence evidence, or retire as superseded. |
| #564–#571, #595 | open, draft | The Alpha.6 integration stack slices and older lanes. | Keep as history; confirm nothing here is required by the Preview. |

### 1.3 What is proven, by evidence class

- **CANDIDATE-C2 on `bb3c158eb`**: C2-A (Alpha.5/A6-off, pd33 pair 2/2, FS 2 boots 14/14 identical), the packaged acceptance (2/2, 37/37), WP1 (2×2 arms), WP2 (2×2 arms), WP3 (3 boots at one offset + 29-boot map).
- **DEV-LIVE / instrument**: everything else (kits, audits, budget probes).
- **Not measured anywhere yet**: the same-Team ceiling enforcement; `read_image` on an image route; the ~74 typed-exception cells (D9); BL-17 network clause; BL-15 native write-outside-ceiling; BL-34 perf (excluded by ruling).

---

## 2. Blocking problems, each with its code site

**P0-1 — Approved execution bypasses the governed realm (the central integration defect).**
Site: `packages/runtime/team-services/src/product-assembly.ts` (realm mount), `packages/runtime/tool-dispatch/*` (plane binding + dispatch door), `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (realm terminal). Evidence: `dev/agent-workflow/evidence/pd42-v5-cellings/README.md`. Consequence: the Preview's headline promise — "Alpha.6 approval never bypasses the Alpha.5 confined provider" — is **not demonstrated**.

**P0-2 — Officer does not receive `parameter-permission` asks (F-3).**
The pre-execute adapter builds the parameter-permission leg without `blueprintContentHash`/`blueprintRevision`, so `resolveAssignedOfficer` refuses and the wake goes to the Leader. Site: `packages/runtime/operation-permission/pre-execute-adapter.ts` (~:1948 request creation) + the officer resolver. Consequence: `ordinaryToolApprovals.default = officer` does not hold for the most common governed ask (a `bash` ask).

**P0-3 — PD-42 acceptance incomplete.** One v5 Team with both families now boots and routes, but the ceiling arm, Goal, Stop, relay and cold recovery were not run in that Team. (See #720's "not proven" list.)

**P0-4 — PD-41 observable scope of the typed refusal is unverified on a real Host.** If the error is only visible inside the Team process, the notes must not claim Host-UI machine-readability.

**P1-1 — F-5 policy honouring unmeasured.** A second governed ask on the same root is refused by the review-facts port; the owner accepts a human fallback **only if** `hold` stays `hold`, `leader` may hand off, the original stays discoverable, and authority is never silently changed. No measurement yet.

**P1-2 — Preview release gate is undefined in the repo.** The owner proposed a separate `v0.1.6 Joint Preview Release Gate` distinct from the full G2–G5 phase completion. **This needs the owner's written approval; the developer agent must not rewrite D12 unilaterally.** Until then the existing gates stand.

**P1-3 — Release-doc truth sweep.** Several statements predate the last three rounds ("one bundle, both planes", Officer coverage, F-2/F-3/F-5/F-6, PD-42's effect on the "disjoint modes" disclosure). Audit D is checking each one.

---

## 3. What this round must deliver (owner's list, unchanged)

1. Alpha.5 Preview surface verified against the contract (10 governed I/O tools, same-family tools, `read_image` by route modality, Goal trio, 15 `team_*`, deferred tools still fail-closed).
2. Alpha.6 approval lifecycle verified end to end on a real Host: request → wake → decision → consumption → **execution through the confined provider** → durable facts → cold recovery with no duplicate execution.
3. **The conjunction in one Team, one v5 Blueprint carrying both families.**
4. PD-41 merged with its observable-scope check; PD-42 completed including the ceiling arm.
5. New candidate `cand-v0.1.6-3` frozen **only after** the product diff is final; `cand-v0.1.6-2` and `cand-v0.1.6-1` untouched; Authority pointer unmoved.
6. Independent C2-A and C2-B on the same candidate SHA/tarball/host.
7. `V016-PREVIEW-CLOSEOUT-PLAN.md`, updated Preview Contract/Readiness, Release Notes, `docs/STATUS.md`, and the two next-phase work packages (**Agent Execution Realm** replacing the Member-scoped decision; **F-2 Goal Domain Authority**).
8. GO/NO-GO recommendation. A NO-GO with a minimal fix list is an acceptable outcome; a rewritten acceptance criterion is not.

## 4. Explicitly out of scope for this round

Complete Alpha.5 tool surface; malicious-agent OS escape defence; session-scoped Sticky Stop; Team-wide Stop; per-host network ACL; a new execution-attempt state machine; a new permission compiler or approval authority; large DSH Core changes; the Agent Execution Realm implementation itself; the F-2 coverage-gate redesign.

## 5. The four audits now running (read-only, no product change)

- **A** — Alpha.5 Preview surface vs contract, evidence levels, doc-vs-code overclaims.
- **B** — Alpha.6 lifecycle: request kinds, Officer routing (F-3 verdict), wake/latch, decision→execution ordering, deny/cancel, cold recovery.
- **C** — Tool-plane vs realm ownership: precedence vs missing registration, the existing seam, the minimal fix, risk to exactly-once.
- **D** — PD-41/PD-42 claim checks, release-notes truth sweep, candidate/authority immutability, and the list of documents the closeout must update.

Product edits are **frozen until the audits land**; the one in-flight lane that had begun the P0-1 fix was stopped and converted to an audit report. One file, one owner, one fix per problem — as the round's discipline requires.
