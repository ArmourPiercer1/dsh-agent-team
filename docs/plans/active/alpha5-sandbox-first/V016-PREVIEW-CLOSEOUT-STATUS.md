# V016-PREVIEW-CLOSEOUT-STATUS — what the four audits and the joint driver actually established

> **UPDATE — 2026-11-12 (Integration Owner). The joint surface is GREEN.** The verdict below is the record of
> the NO-GO round and stands as written; what changed since is a small, named set of product commits and one
> re-measurement, so the honest current state is stated here first and the original text kept intact.
>
> **Joint acceptance: 11 PASS / 0 FAIL / 0 NOT_REACHED, twice, field-by-field identical**
> (`dev/agent-workflow/evidence/joint-acceptance/`, README = a three-way record):
>
> | tree | verdict | product delta |
> | --- | --- | --- |
> | `d8490f74d` + PD41 | 8 PASS / 2 FAIL / 1 NOT_REACHED | the falsifier: #730's adopted-native `bash` was owned but never placed |
> | `4075c67ad` | 10 PASS / 1 FAIL / 0 NOT_REACHED | #734 — ownership and placement became one fact |
> | `6ea7d8dd4` | **11 PASS / 0 FAIL / 0 NOT_REACHED** | #736 — a cold boot owns the `parameter-permission` lane |
>
> Both failures were **product defects found by measurement on a real Host, not by the host-free suite**, and
> both are now fixed with host-free pins (`u7-w0b-approval-entry-law.test.ts` P+1 with a negative control;
> `a6-boot-settlement-lanes.test.ts` 3 clauses). No arm was relaxed, no clause was weakened, no kit change was
> needed to consume either fix.
>
> **Still NO-GO, for two reasons that are not the joint surface:** (1) the **C2 gate has not been re-run** on
> the fixed tree — no new candidate has been frozen, and `cand-v0.1.6-1`/`-2` do not contain these fixes;
> (2) one disclosed product finding remains open — a governed ask minted by a member whose first turn is a
> human `member.send` relay is refused to the assigned Officer (`CONTROL_RESOLVER_NOT_AUTHORIZED`, asking row
> `lifecycle: CREATED` vs the gate at `packages/runtime/alpha6/assigned-officer-facts.ts:444`), re-measured on
> the final tree via `JOINT_J10_RELAY=1`. Authority pointer `as20261109r1` still unmoved; no tag; no RC.

**Written:** 2026-11-11 (real UTC clock) by the Integration Owner, after the four read-only audits
(A: Alpha.5 surface, B: Alpha.6 lifecycle, C: plane/realm ownership, D: release truth + candidates) and the
first run of the joint acceptance driver. This file is the honest state, not a plan: **every row below was
measured or read in the code by a named lane**, and nothing here is inherited from an earlier report.

**Integration baseline at writing:** `origin/master` @ `b29e10582` (PD-42 gate, #720 merged; PD-41, #719 merged).
**Authority pointer:** `as20261109r1`, unmoved. **Candidates:** `cand-v0.1.6-1`/`-2` immutable, `VERIFIED PASS=145`.
**No new candidate exists.** No tag. **Verdict: NO-GO for `v0.1.6-preview`.**

---

## 1. The single most important finding — and it is not the one we thought

The round began believing the open question was "the Alpha.6 execute plane displaces the Alpha.5 realm".
The audits and the joint driver showed something larger:

**Alpha.5 had been meeting the native-tool invariant by re-implementing the tools.** Three self-implemented
`bash` paths shipped as the product's governed bash — PD-12 `confined-bash-tool.mjs`, PD-13
`confined-terminal-tool.mjs` (which documents "It is not a PTY" and therefore loses `cd`/`export`/interactive
stdin), and the Team Tool Plane's `process-family` row (`/bin/sh -c`, its own parameter set
`{command, cwd, timeout, background}`). None is the pinned Host's `dsh-tool-bash-persistent` definition.
That violates A5-NATIVE-01/02 and A5-BOUNDARY-01: governance belongs in a trusted provider or the OS
execution boundary, not in a re-implemented body that happens to share the name and schema.

The measured consequence in the PD-42 junction: the approved `bash` "succeeded" (bytes on disk, one durable
`succeeded` fact) while the Alpha.5 realm sink held **0** guard facts — the call never touched the Member's
compiled ceiling. That is the worst possible shape: a governed success with no governance evidence.

**Current state of that fix (PR #730, unmerged):** the governed Member's `bash` is now the **pinned native
definition** with only `execute` wrapped; the backend is a governed persistent-PTY `terminals` face built on
the pinned `terminal-bash` through its own `apply`; the Member ceiling enters where the host already reads it
(`sandboxPolicy.resolve` → `sandbox.confine`). Host-free, over real `/dev/pts`: definition identity deep-equal
to the host's, one PTY shared across calls with `cd`/`export` preserved, a second Member gets a different PTY,
a **prefix** of the bound session id is refused (`PTY_OWNER_MISMATCH`) with zero PTYs, `danger-full-access` is
clamped to the Member ceiling, a policy-revision change kills the session, allow-once/deny-zero hold.
**All of that is host-free.** The live arms are NOT MET — and, importantly, not for the reason the lane first
gave: the joint driver now exists and reaches them; what fails is a **mount defect** (below).

PD-12/PD-13/the plane shell row are **retired from the product path additively** (banners, suites kept,
nothing deleted), and a governed Member can no longer silently fall back to the inherited base terminal.

## 2. The joint driver exists now, ran twice, agreed — and answers NO

`tests/kits/joint-acceptance-20261111/` (PR #731) is one Team, one `schemaVersion: 5` blueprint carrying both
`memberIoCeilings` and `reviewRouting`, governed realm + Alpha.6 route + plane takeover, gated by the shared
`boot-preflight.mjs` before the Host starts. Two fresh `DSH_HOME` runs, field-by-field agreement.

| arm | result | why |
| --- | --- | --- |
| J01 Team + routing (v5 both families) | **PASS** | the PD-42 gate fix is real |
| J02 I/O inside ceiling | NOT_REACHED | blocked by J04 in the native composition; **PASS** in the fs-only diagnostic control (ALLOW fact) |
| J03 I/O outside ceiling | NOT_REACHED | same; **PASS** in the control (`IO_WRITE_DENIED`, zero bytes) |
| **J04 native bash governed** | **FAIL** | Member activation dies: `SERVICE_MOUNT_FAILED: native tool module re-mount failed: Cannot read properties of undefined (reading 'validate')` — `native-bash-tool.mjs` exports `Config = Object.freeze({})`, and the Cordis loader validates via `Config["~standard"].validate` |
| J05 approval lifecycle | NOT_REACHED (native) / **FAIL** (fs-only control) | allow consumed exactly once, body ran, **zero `control-execution-result` facts** on the `parameter-permission` lane |
| J06 Officer identity (F-3) | **FAIL** | the `parameter-permission` leg routes to the **Leader**; Officer `wakes=0`; **no `team-tool-execute` leg exists at all** |
| J07 Goal from human input | NOT_REACHED | driver gap (declared, not driven) |
| J08 relay refusal | NOT_REACHED | driver gap |
| J09 Sticky Stop on review wake | NOT_REACHED | driver gap |
| J10 cold recovery | NOT_REACHED | driver gap |
| J11 no replay | NOT_REACHED / **PASS** in control | consumed allow cannot be re-dispatched; late allow refused |

Three of those are product defects with known, small fixes, and one is instrument work:

- **J04** is a config-schema export bug (PR #730 owner is fixing it, with a loader-path test so the class cannot recur).
- **J05** is the audit-B P1-2 defect: `recordExecutionResult` matches by `reviewPayload.callId`, which only the
  PA plane carries; the permission lane has no such payload field. Being fixed in the approval-lane
  work package with PD-41 semantics (`succeeded` only on observed completion; refused dispatch writes a fact that says so).
- **J06** is F-3, and it is **not a one-field fix**: the route/wake gate needs four fields
  (`blueprintContentHash`, `blueprintRevision`, `operationToolOwner`, `operationToolName`) and the
  decision/escalation gate seven (plus `operationOwnerTemplateId`, `operationToolDefinitionIdentity`, frozen
  `authorityGeneration`). Supplying only the hash is a measured no-op. The code even documents the carve-out
  (`alpha6/notifier.ts:174-186`: the permission ask "carries no Alpha.6 ordinary-tool facts … legally the
  Leader's to settle"), which is why the blueprint's `ordinaryToolApprovals.default: officer` and
  `whenOfficerUnavailable: hold` were both contradicted at runtime. The owner's authorised fix (carry the
  immutable bound identity through the existing seam; typed refusal where a field genuinely cannot be
  supplied) is in flight.
- **J07–J10** are driver gaps, not measured failures — recorded as NOT_REACHED, never as PASS.

## 3. What the audits established that changes the release text (all being corrected)

- **PD-42/F-1 and PD-41/F-4 were never disclosed on master.** PR #715's message claimed §4.8/§4.9; its diff was
  one anchor line. A docs lane has now landed the disclosures and a PD-42 register row (grep proves 13 matches,
  was 0), plus a closeout plan and the two next-phase work packages.
- **The typed refusal reaches only the Team process.** `tools.guard` is still `string | undefined`; the host
  `toolErrorResult()` emits `error.message` only and `ToolDispatchRefusalError` is not a `HarnessError`. The
  notes must not claim Host-UI machine readability, and the docs lane has been told exactly that.
- **PD-41's "`succeeded` only on observed completion" was false on one arm** (cancelled with a
  non-`user`/`parent` cause was recorded `succeeded`). Fixed by #729: only `settlement.kind === 'completed'`
  is a completion; every other settlement is `unknown`; abort-shaped throws are `unknown`. Falsified live with
  a `hook`-cause abort (n=1 decisive, 3 boots at the shape).
- **"Every dispatch refusal is typed" remains false by one**, deliberately: the host execution object cannot
  hold a cancellable signal, and no §5 code truthfully names that failure. `isToolBindingRefusal()` has no
  production caller and is reported as the package's public predicate rather than given a fake one.
- **`ToolRestriction` is `null` on every shipped Preview guard fact** — the derived path compiles ceilings only,
  and the restriction family appears solely in fixture evidence. This is a disclosure gap (the ceiling is real;
  the intersection claim is not demonstrated on the shipped preset).
- **The coverage gate is absent, not lenient**, on the governed Member: it only runs when
  `capabilities.permissions` is declared, and the PD-33 blueprint declares none.
- **Release notes overclaimed bash admission**: out-of-lane `bash` is not refused "before a process exists";
  only the spawn root/cwd is admitted and the shell body runs, with the OS profile as the backstop.
- **Candidate/authority bookkeeping is clean**: both manifests `VERIFIED PASS=145`, blobs unchanged since
  freeze, refs frozen, `as20261109r1` unmoved, no this-round commit touched `dev/engineering/`.

## 4. Why the answer is NO-GO, stated plainly

Not because the work is unfinished — it is unfinished — but because the two things the Preview promises are
not yet both true on one Host: (i) an approved Alpha.6 call **executes through the Alpha.5 confined provider**
(blocked by J04, then J05/J06), and (ii) the Alpha.5 governed `bash` is the **native** tool (true in code, not
yet proven live). Everything else — the v5 gate, the realm ceiling enforcement on I/O, the Officer arc for
`team-tool-execute`, PD-41's consumption semantics, Sticky Stop on the review-wake path, the packaged install
path — has real evidence behind it, most of it two agreeing runs.

## 5. Minimal ordered path to a GO (and nothing else)

1. **J04** — config schema / loader-path test in #730; re-run the joint driver. (small)
2. **J05** — one truthful `control-execution-result` on the permission lane + correlation matcher. (small)
3. **J06** — carry the bound identity through the seam; Officer default routing, `hold`/`leader` honoured,
   typed refusal where a field cannot be supplied. (medium, authorised)
4. **J07–J10** — drive the four declared arcs in the same Team: Goal from human input with ≥2 rounds then Stop;
   relay `GOAL_TOOL_AUTHORITY_REQUIRED`; Sticky Stop across SIGKILL; cold recovery with no duplicate execution.
   (instrument work on an existing driver)
5. Re-run the joint driver twice; require agreement on every arm.
6. Then, and only then: freeze `cand-v0.1.6-3`, run independent C2-A + C2-B on that exact SHA/tarball/Host,
   apply the doc set, and ask the owner for the GO decision.

**Not in that list, deliberately:** the Agent Execution Realm (Root/Leader scope) — disclosed, next phase;
F-2 single-Member Goal+Bash — disclosed, next phase; session-scoped/Team-wide Stop — out of scope; per-host
network ACL — out of scope. None of them is a condition of this Preview.

## 6. Infrastructure note for the owner

GitHub Actions is badly congested on this repo right now: a dozen `pull_request` runs have sat **queued** for
over an hour while newer runs are graded, and the six evidence/docs PRs (#722, #724, #725, #727, #729, #723)
currently report **zero checks** because their runs were superseded by `update-branch` and never re-ran. They
are content-complete and settled; they need a re-trigger (empty commit) or a queue drain, not more work. Any
merge gate that depends on Required CI should be planned around that, not fought.

---

## 8. Update of 2026-11-12 — what the fixes were, and what is still owed

**The two product defects the joint acceptance found (and their fixes).**

1. **#730 shipped a governed `bash` nobody could call.** It adopted the pinned Host definition and excluded it
   from placement, but left the name in the plane's ownership set, so the centre approval entry could never
   bind and the dispatch door refused every call *before the body ran*
   (`team-tool-plane.mjs` placement vs `owns:` predicates → `install.ts` binder). Measured: J04 `bashCalls=1
   realmTerminalFacts=0`, and the door sentence `table unbound, resolving def#34` in two consecutive runs.
   Fixed by #734: an adopted native name is not the plane's to own — one predicate, both claim sites, pinned by
   a test that mounts the real assembly with the shipped spelling and is negative-controlled (with the fix
   removed it fails `expected true to be false`).
2. **A cold boot lost the permission lane's settlement.** Boot recovery owned `pa:`-correlated rows and
   `team-tool-execute` only; the `parameter-permission` lane's correlation *is* the exec call id, so a consumed
   allow whose in-memory settlement died with the process left **no result and no abandon** — the J10 clause
   `noSilentAbsence` caught it (`ppConsumed=1→1`, `ppFacts=0`). Fixed by #736: `isExecutionAskLane()` names the
   three execution ask lanes and `settlementCallIdOf()` reads `reviewPayload.callId` then the durable
   correlation (never the `pa:` namespace), which is the carrier the live matcher already uses.

**What is still owed to close `v0.1.6-preview`** (unchanged in shape from §5, minus what is now done):

1. Freeze `cand-v0.1.6-3` from the fixed tree, and run **C2-A and C2-B independently on that one SHA/tarball/
   host** — the joint acceptance is DEV-LIVE evidence and is never CANDIDATE-C2 evidence.
2. Decide the status of the second finding (relayed-member authorisation). It is disclosed in the README and
   the PR; it blocks no acceptance arm, but a shipped operator path hits it.
3. Release notes must separate the stable surface from the Alpha.6 opt-in experimental surface, and must not
   claim the typed refusal is machine-readable in the Host UI (`tools.guard` is `string | undefined`).
4. Then, and only then, the GO/NO-GO question goes to the owner. No tag, no RC, no Authority move before that.
