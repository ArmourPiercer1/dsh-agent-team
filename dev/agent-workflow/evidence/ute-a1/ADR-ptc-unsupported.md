# ADR — PTC / `run_code` is NOT SUPPORTED this generation (owner ruling)

- **Status:** ACCEPTED — owner ruling, 2026-11-24 (`docs/reviews/20261124-0151.txt` §PTC).
- **Applies to:** DSH Agent Team vNext, the governed Team Member plane (`packages/runtime`), the A0
  functional contract (as AMENDED here, never edited in place), PR #821's acceptance scope and PR
  #822's capability matrix.
- **Supersedes:** the round-85 disposition of PTC as a `CORE_SEAM_BLOCKER` / delivery blocker. It does
  NOT supersede the round-85 *measurements* — it cites them and closes them as a ruled scope
  reduction.
- **Does not touch:** the pristine DSH upstream (CORE PATCH BUDGET = 0), the DSH host's own PTC
  capability, native `bash`, persistent bash, PTY, Control (asks/grants) or Stop.
- **Machine declaration:** `packages/runtime/src/plugin/vnext/ptc-product-ruling.mjs`
  (`PTC_PRODUCT_RULING`, `reportProductUnsupported`, `productUnsupportedReport`).
- **Durable vocabulary:** `ADMISSION_PTC_UNAVAILABLE` + status `unsupported-by-product-ruling`
  (`packages/runtime/src/plugin/vnext/host-surface-refusal.mjs`, `admission.ts`).

## 1. The ruling

The owner ruled that this generation formally does NOT support PTC / `run_code` for a governed Team
Member, that the DSH upstream must not be forked or patched for it, and that PTC stops being a
delivery blocker. The ruling's operational half is a table, and every row is implemented here:

| Requirement (ruling) | Implementation | Evidence |
| --- | --- | --- |
| a governed Member's `run_code` is explicitly unsupported | `run_code` is refused typed at the ONE centre, before the body | `ADM-87`, `ADM-76`, `ADM-79` |
| the model-visible tool set does not offer it | the shipped presentation (`native`) projects no `run_code`; the governed preset declares no PTC row | `ADM-79` (1), `a5sf-governed-preset.test.mjs` G0, `cordis.patch.yml` |
| an accidental call through the host-retained entry is a TYPED refusal, zero worker start | the reserved transport stays registered where PTC is presented; the call is refused before any worker/sandbox | `ADM-79` (2) |
| PTC-only Team wiring is cleaned of dead code | audited; the two candidates were shown to be SHARED controls and stay (§6) | `ADR` §6 |
| DSH host PTC is untouched | no upstream file changed, no fork; host PTC smokes stay green | `tests/next-host/native-api.test.mjs` A4 (unchanged) |
| native Bash / Persistent Bash / PTY keep being accepted | untouched; the B ladder's bash rung and `d3:persistent-subprocess` evidence are unchanged | `ADM-125…132`, round-76 evidence |
| future PTC support is an independent feature | revisit path with acceptance criteria (§7) | this ADR |

**Hiding the tool is explicitly NOT the completion criterion.** The refusal must be reachable through
the host-retained entry and must be typed; that is why `ADM-79` drives BOTH halves — absence from the
offered set in the shipped presentation, and a typed refusal with zero worker through the entry point
in a PTC-presenting deployment.

## 2. Measured basis (why the capability cannot be delivered this generation)

The round-85 four-part finding (`PTC-FOUR-PART-FINDING.md`) measured PTC in four parts. Three hold;
one does not:

- **nested calls** re-enter the host tool pipeline on the Member agent's scope and therefore the ONE
  centre (`tool-executor-ptc/src/ptc.ts:538-625`, `core/tools/src/index.ts:1504-1508`);
- **Control escalation** goes through the durable ask + one-shot grant row
  (`escalation.ts:171-226`, `user-approval/src/index.ts:270-285`);
- **Stop** follows `exec.signal` → `runController` → the runtime signal → `handle.terminate()`
  (`ptc.ts:412-414/:553-554/:697-705`);
- **the WORKER's OS profile FAILS.**

The failing part, restated against rc.5 (the ruling asked for this correction — the blocker report
measured rc.2, and rc.5 moved the transport to `tool-executor-ptc` and added
`additionalWritableRoots`):

1. rc.5 resolves the worker policy from the **HOST session**:
   `tests/deepseek-harness-next/packages/core/tool-executor-ptc/src/ptc.ts:262-264`
   (`sandboxPolicy.resolve({ session: exec.agent.session })`).
2. `SandboxExecutionPolicy` can express only
   `{ mode, workspaceRoot, additionalWritableRoots?, sessionId? }`
   (`tests/deepseek-harness-next/packages/sandbox/sandbox-policy/src/index.ts:208-224`), and
   `additionalWritableRoots` is a set of EXTRA **WRITABLE** directories
   (`tests/deepseek-harness-next/packages/sandbox/sandbox/src/index.ts`). It cannot express a Member's
   independent READ-only, WRITE and DENY subtrees — the three-lane ceiling the Member profile compiles
   (`packages/runtime/team-sandbox/src/profile.ts:56,:118-127`, `allowPaths` with per-path accessBits).
3. Under `danger-full-access` the worker skips confinement entirely
   (`tests/deepseek-harness-next/packages/core/ptc-runtime-node/src/worker.ts:287`).

So a worker launched for a governed Member would run under a policy that is **not** the Member's
compiled ceiling — wider than authorized, with no per-path read/write/deny expression. Admitting it
would be a second, weaker execution authority. The public seam has no per-execution policy injection
point; obtaining one requires an upstream change, which the CORE PATCH BUDGET forbids. The ruling
converts that permanent gap into an explicit product boundary instead of a waiting blocker.

## 3. What is NOT supported

- `run_code` as a tool of a governed Team Member — no execution, no worker, no effect, ever.
- PTC as an execution mode for a governed Member's tool calls (the Member's process authority is the
  compiled `toolBindings[].authorization` + `execution.executionBoundary` declaration, running through
  the confined-subprocess face — `bash`, not PTC).
- Any claim that the A0 contract's original six-rung B ladder was fully delivered. It is AMENDED
  (§5); the frozen documents are cited, not edited.

## 4. What is NOT affected

- **DSH host PTC**: the upstream module, its registration and its host-level smoke tests are
  untouched. The host registry still registers its reserved `run_code` transport whenever the host is
  configured to present PTC (measured in `ADM-79`); the product simply never offers it to a governed
  Member and refuses it if reached.
- **Native `bash`, persistent bash, PTY**: unchanged (round 76 evidence and `ADM-125…132` stand).
- **ControlService asks/grants and Stop**: unchanged; the escalation row stays (§6).
- **Other invariants**: no invariant is relaxed. The refusal is fail-closed; the status is additive.

## 5. Contract amendment (A0 frozen documents are NOT edited)

The frozen A0 evidence is read-only in this repository. This ADR is the amendment instrument: it
CITES the frozen B-ladder contract, records the owner's ruling, and the matrix/report reference this
ADR. No frozen file is modified, and no test is deleted.

**B Probe Ladder — amended:**

- supported positive verification scope: `read → write → grep → web_fetch → bash`
  (unchanged mechanics; the bash positive remains proven at `ADM-125` and in the realm-shaped
  world it is disclosed as `ADM-68`, exactly as before);
- PTC is verified ONLY as `run_code → typed refusal → zero worker execution → REFUSED/not-started`
  (`ADM-76`, `ADM-79`, `ADM-87`);
- the machine summary line the acceptance report quotes is now
  `VNEXT-B-LADDER rungs=read,write,grep,web_fetch,bash,run_code negatives=6/6 positives=4/5
  bash-positive=ADM-68-blocked-in-this-world-ADM-125-proves-it
  ptc=ADM-69-NOT-APPLICABLE-product-unsupported amendment=ADR-ptc-unsupported.md`.

**The two PTC positive tests** (the ruling's "原来两项 PTC 正向测试") are converted, not deleted and not
left as "skipped pending a fix":

| Arm | Was | Now |
| --- | --- | --- |
| `ADM-69` (B ladder rung 6, `vnext-b-probe-ladder.test.mjs`) | positive: `run_code` executes and its effect is observed | `NOT APPLICABLE — PRODUCT UNSUPPORTED`: asserts the declaration, emits `VNEXT-PTC-PRODUCT-UNSUPPORTED`, skips WITH the marker |
| `ADM-147` (`vnext-admission.test.mjs`) | the declared-world governed PTC positive the suite header described as "needs a world whose blueprint declares the binding" | `NOT APPLICABLE — PRODUCT UNSUPPORTED`: builds that declared world, proves the declaration cannot make PTC supported, emits the marker, skips WITH the marker |

Each marker is asserted by a companion arm in the SAME suite (`ADM-80`, `ADM-148`): the machine line
must exist with `marker`, `status=unsupported-by-product-ruling`, `verdict=NOT_APPLICABLE` and the ADR
path, the arm list is CLOSED (a new skipped positive cannot borrow the status — the reporter throws),
and the refusal controls must still be registered. A silent skip cannot pass; neither can a deletion.

The REFUSAL negative controls are kept and strengthened: `ADM-76` (out-of-lane), `ADM-79` (retained
entry on the real composition), `ADM-87` (one centre), plus the declared-world probe inside `ADM-147`.

**What stays: the DSH host's own PTC positives.** The host smoke
(`tests/next-host/native-api.test.mjs` A4, `tool/ptc-dispatch-start` + `tool/ptc-dispatch`) and the
standard-preset leader `workflow` positive (`tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs`)
are NOT governed-Member `run_code` claims; the ruling preserves host PTC, so they are untouched.

## 6. Wiring audit — what was PTC-only, what stays, and why

A repo-wide audit of Team-side PTC references (`packages/runtime/src/**`) found FOUR pieces. Nothing
was deleted, because each is either the enforcement itself or a SHARED control:

1. `vnext/host-surface-refusal.mjs` — the `ptc` row of the CLOSED refusal table. **Stays: it IS the
   enforcement** (code, axis, reason, status) and the reason carries `unsupported-by-product-ruling`.
2. `vnext/admission.ts` — the `run_code` refusal branch. **Stays: it IS the enforcement.**
3. `vnext/ptc-product-ruling.mjs` — NEW: the machine declaration of the ruling (test-facing mirror of
   the table; `ADM-148` asserts the two agree).
4. `live/ptc-escalation-row.mjs` + its host plumbing
   (`plugin/host.ts` install line, `vnext/agent-bindings.mjs` re-export). **Stays, and is NOT
   PTC-only:** the row adjudicates the public `approval/request` waterfall for EVERY sandbox
   escalation ask (`escalate sandbox to <mode>: …`), including asks raised by the host bash/pwsh
   process tools; deleting it would remove a shared second-authority control and let an `ask` fall
   through to the next listener. The ruling closed the PTC TOOL, not escalation governance, and
   explicitly protects Control/Stop. Header notes were added in all three files so a future reader
   does not mistake the row for dead wiring.

No other Team-side PTC-only consumer exists (the governed preset declares no PTC row; `run_code` was
never on its surface).

## 7. Revisit path (how PTC could become supported, later, as its own feature)

Re-open only if the upstream publicly provides a **per-execution, execution-scoped policy seam** for
the PTC worker — one that can carry the Member's compiled three-lane profile (independent read/write/
deny subtrees), not only `{mode, workspaceRoot, additionalWritableRoots}`. Acceptance criteria for a
future round, in order:

1. the seam is public API in the pinned baseline (no fork, no patch, CORE PATCH BUDGET = 0);
2. a worker started for a governed Member is verified to consume the Member's compiled profile (an
   out-of-lane write attempted INSIDE the worker is refused by the OS, with the same `d3`-style live
   evidence);
3. the refusal branch is removed/rewritten in ONE place and `ADMISSION_PTC_UNAVAILABLE` +
   `unsupported-by-product-ruling` disappear from the durable vocabulary together (no mixed state);
4. the two NOT APPLICABLE arms are converted back to real positives, and their marker companions are
   removed in the same change;
5. the matrix/report/PR-body statements are superseded by a NEW dated ADR — this one is not edited.

Until then, `run_code` remains refused, and the refusal is reported as the product ruling it is.

## 8. Counts that moved, and why

Measured at the settlement HEAD (see the dated settlement comment for the exact SHA):

- `ute-vnext-a1` node:test leg: `tests 211 → 215` (+4 arms: `ADM-79`, `ADM-80`, `ADM-147`,
  `ADM-148`), `pass 209 → 212`, `skipped 2 → 3`. The one added skip is `ADM-147`, the second ruled
  NOT APPLICABLE marker; `ADM-69` was already the other. `ADM-68` (bash positive not run in the
  realm-shaped world, disclosed) is pre-existing and unchanged. **No other skip was widened.** Suite
  file set unchanged (7 files), so the leg set digest is unchanged.
- Test catalog counts are unchanged in KIND (no test FILE added or removed); the numbers are stated in
  the settlement comment with their bounds.
- No frozen A0 evidence file changed; no upstream file changed.
