# CANDIDATE-AUDIT — adversarial audit of the D acceptance candidate (round 86)

> **Superseded in part by round 89 (`2026-11-23`).** This audit measured at `c29da52d3`. Rounds 87/88 then
> added two measured facts it could not know: **`d4:routed-wake` is REFUTED** (Alpha.6 has no case-bearing
> ordinary-ask producer) and **BL-30 means a granted `ask` still cannot execute in production**. The
> authoritative open-gap register is now `D-ACCEPTANCE-REPORT.md` **§10** (G1–G10), and the corrections
> made in round 89 are listed in its **§11**. Nothing in this file is deleted; its §1 "blocking reasons"
> gains those two items, and its §6 register's items 13/14.

**Worktree:** `.worktrees/vnext-a1-cut` · **Branch:** `vnext/a1-cut` · **HEAD audited:**
`c29da52d31ba52088eb58622b4858803031d060d` · **Base:** `a19d1df01` (frozen A0, PR #821, on `master`)
**Auditor role:** sole writer, sole adversarial gate before PR #822 is offered for review.
**Record class of this file:** audit record. It is not candidate evidence and not a gate.

**PR #822 remains DRAFT and unmerged. Nothing was released or deployed. `master` and `stable` were not
touched. This audit does not flip the PR to ready and does not merge it.**

## 0. Method, and the one accident in this audit

I re-ran every gate that produces a number in `D-ACCEPTANCE-REPORT.md` / `PR-BODY-draft.md`; re-measured
the git facts, the entry-file line counts, the test catalog, and the hosted verdicts through `gh`; read the
capability matrix and the supporting evidence against the code at this HEAD (`admission.ts`,
`s6-command-classification.ts`, `centre-config.ts`, `agent-bindings.mjs`, `root.ts`,
`ptc-escalation-row.mjs`); and re-derived every status cell from its named evidence. Where a claim and the
evidence disagreed, the **claim** was corrected. No evidence file, test, skip, negative control or A0
artefact was edited to fit a claim.

**Disclosed accident (no candidate fact changed).** My first `ci-pr-gate --full` run was started in the
background with its log redirected to `/tmp`, which this sandbox does not allow; I killed the job. The kill
landed inside the census leg's `a4p7-merge-gate` arm while it had `node_modules/.pnpm/node_modules/clsx`
moved aside, so the arm's `finally` never restored it. The next run therefore produced two NEW REDS
(`a4p7-merge-gate.test.ts`) on a precondition (`clsx` must exist) — a red **this audit caused**, not the
candidate. I restored the hoisted link (`mv …/clsx.held-by-7-6-gate …/clsx`), re-ran, and the accepted run
is green. Both comparison artefacts are committed (`…/scratch/census-comparison-20261123T053515Z-6.json` =
the self-inflicted red; `…T054128Z-5.json` = the accepted run) and neither is deleted.

---

## 1. Readiness verdict

**READY-FOR-REVIEW** (the document set is now accurate enough to review), **NOT ready to merge, NOT
ready to release, and no row is PRODUCT-PROVEN.**

Blocking reasons against "candidate complete" (all disclosed in the report; none is a documentation
defect any more):

1. **No capability row is PRODUCT-PROVEN** and every live claim is `DEV-LIVE` (not a gate).
2. **PTC (`run_code`) is REFUSED with `CORE_SEAM_BLOCKER`** on the worker OS-profile seam
   (`PTC-FOUR-PART-FINDING.md`; `admission.ts:421-423`); three of its four parts hold, part (a) does not.
3. **Two S6 root-work commands stay refused** (`team.admitInitialWork`, `team.ensureRootLive` —
   `s6-command-classification.ts:111-112`); no async root-work delivery seam exists.
4. **The pre-dispatch Stop observer is not wired into a booted rc.5 production turn**
   (`RC5-MIGRATION.md:492-501`).
5. **Owner rulings still open:** realm-less admission (item 4) and search-face shape A (item 5); the PTC
   upstream seam is an owner/escalation decision, not product work.
6. **Hosted `ci-required` is RED at this HEAD — solely because `ci-census` is SKIPPED on a draft PR**
   (`gh run view 45117815545`); the six layer jobs are green. `pr-settlement-gate` was red for lack of a
   settlement comment naming this head and is settled below. Marking the PR ready is what runs the census;
   that is the owner's act, and this audit does not perform it.
7. **`ci-census`'s population counts still differ from the published baseline** (599 files / 7,414 lines
   captured vs 626 / 7,936 declared); the gate passes on the **identity set** (identical), and the counts
   are context, not the verdict. Disclosed, not hidden.

---

## 2. Factual corrections (claim → reality → where it was made)

Every row was re-measured at `c29da52d3` in this session.

| # | claim (file:line) | reality at `c29da52d3` | disposition |
| --- | --- | --- | --- |
| 1 | Report §1 scope: HEAD `189d6cab`, 144 commits, 1,643 files, `+107,914/−79,603`, 1,199 A · 363 D · 76 M · 2 R060 · 1 R094 · 1 R095 · 1 R096 (`D-ACCEPTANCE-REPORT.md:4`, `:79-84`) | HEAD `c29da52d3`; **205** commits; **3,377** files, **+241,087/−160,719**; **2,548 A · 616 D · 210 M · 2 R094 · 1 R095** (git's exhaustive-rename warning: rename counts are a lower bound) | §1 remeasured |
| 2 | Closure paste shows `… dupNames=0 findings=0` (`:90`, `:435`) | The gate prints two more fields: `… dupNames=0 retiredSurfaces=12 placements=self findings=0` | §1.1/§4.3 pasted verbatim |
| 3 | `place-dist-glue` restores **28** live placements (`:112`, `:129`, `:458`) | **30** placement(s) (`place-dist-glue: done (30 placement(s))`); `artifacts-at-head` also reports 1,941 files / 30 glue placements | corrected everywhere |
| 4 | PR body: "**200** stale dist mirrors deleted" (`PR-BODY-draft.md:11`, `:22`) | A0 accounted **52** committed dist artefacts; the boundary completion found **150 more** stale mirrors **+ 1** (the retired row's mirror) = **151 additional**, 203 total (`CUT-BOUNDARY-ADDITIONS.md:27-32`) | PR body corrected to 52 + 151 |
| 5 | `ute-vnext-a1` leg `tests 206 / pass 204 / skipped 2` (`:292-293`, `:1029-1035`) | `tests 211 / pass 209 / fail 0 / skipped 2`, `exit=0`, `set=sha256:edd4f1c4…` | §3.1/§4.1/§9.4 corrected |
| 6 | Report §3.2 "All live judges" table has 13 rows; "All twelve judges are PROVEN on 0.2.2-rc.5" (`:336-350`) | **14** judges exist; `d2:remote-delivery` (round 83) is missing from the table. It is PROVEN on **rc.2 only** (`d-boot-feasibility/d2/driver.log:1214-1313`: `"host":"legacy"`); the rc.5 acceptance log predates it (`ute-a1/rc5/run-boot-d2.log` contains only 3 d2 judges) | 14th row added; rc.5 claim restated as 13/14 |
| 7 | §4.1 dispatch paste `tests=194 pass=192` (`:394-398`) | 211 / 209 / 0 / 2 | repasted fresh |
| 8 | §7 counts: "**ADM-1…ADM-124** … **186 pass**" (`:882-885`) | the leg now carries arms through `ADM-146` plus `SLICE-21…SLICE-38`; **209 pass** | corrected |
| 9 | §7 item 2 "**thirteen** at round 74" (`:886-887`) | fourteen (13 + `d2:remote-delivery`) | corrected |
| 10 | §8 checklist row 1 "measured at `189d6cab`" (`:944`) | measured at `c29da52d3` | corrected |
| 11 | §8 row 3 "dispatch 188/186/0/2 … 28 placements" (`:946`) | 211/209/0/2; 30 placements | corrected |
| 12 | §9.4 migrated-vitest row says 238 (`:1044`) | **confirmed** 238 (`suites=15 files=15 passed=238 failed=0`) | unchanged |
| 13 | `admission.ts` line citations throughout §2 (`:170`, `:182`, `:185`, `:186`, `:187`, `:211-220`) | round 85's PTC comment block shifted the file. Actual: `TOOL_AXES` `:61-74`; `CENTRE_TOOL_NAMES` `:86-102`; `HOST_CAPABILITY_TOOL_NAMES` `:143-153`; `DEFAULTED_LOCATORS` `:196`; PTC refusal `:421-423`; process branch `:424-466`; `net.fetch` `:468-476`; MCP-server refusal `:387`; host-service limit comment `:137` | all citations remapped |
| 14 | C1/C15/C16/C17 cite `admission.ts:57-73` / `:114-122` / `:32-41` (`:170`, `:185-187`) | `:86-102` / `:143-153` / `:61-74` | remapped |
| 15 | C11 cites `root.ts:4275-4279` as `createProjectionService` (`:180`) | `createProjectionService` is called at **`root.ts:4302`**; the current file is `packages/runtime/src/plugin/vnext/root.ts` (5,239 lines) | remapped |
| 16 | C6 cites `root.ts:2496-2510` for the Alpha.6 gate (`:175`) | the gate call is **`root.ts:2508`** (comment block `:2490-2507`) | remapped |
| 17 | C5 cites `agent-bindings.mjs:688-706` for the grant binder + approval port (`:174`) | binder **`:692`**, control approval port **`:707-710`** | remapped |
| 18 | §2.3/§6.9/ESCALATION cite `agent-bindings.mjs:1942-1944` for `memberCentreUnwiredViolation` (`:233-234`, `:740-744`; `ESCALATION-realmless-admission.md:8`) | the call is **`:1972`**; the centre install is `installMemberExecution` **`:2036`**; `mcpMountTarget` **`:2287`** | remapped |
| 19 | C9 status: `member.create` / `member.send` / `member.followup` are "REFUSED as agent-execution" (`:178`); C4 repeats it (`:173`); §6.2 says "`member.send` → `ADMISSION_REMOTE_UNAVAILABLE`" (`:586-588`) | Since round 83 all three are the **served `work-delivery` class** (`s6-command-classification.ts:125-130`); only `team.admitInitialWork` / `team.ensureRootLive` are `agent-execution` (`:111-112`). `d2:remote-delivery` is PROVEN on two boots. **The report understated its own newest capability while §9.3 already said so.** | C9/C4/§6.2 corrected |
| 20 | C6 status headline "**REFUSED-BY-DESIGN**, and that is the contract-compliant state" (`:175`) | Round 84 made the gate two-sided: a coherent row (v5 policy + centre + absolute wake-intent dir) is **admitted**; an incoherent row is refused *and recorded* (`root.ts:2508-2525`, `ADM-141`). The routed live wake is unproven | headline corrected to MECHANISM + live refusal |
| 21 | C8 "what would prove it": the post-`allow` Stop "cannot be `REFUSED` … (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md`)" (`:177`) | That request is **RESOLVED — owner Option A, round 73** (`CONTRACT-CHANGE-REQUEST-settlement-recheck.md:51`; `ADM-119`); only the rc.5 production wiring gap remains | C8 corrected |
| 22 | C11 "what would prove it": a product-entry projection "cannot reach today because the S6 plane is refused by design (C9)" (`:180`) | the S6 **management** plane was restored in round 74 (`team.getProjection` is a `control-plane-read` command, `s6-command-classification.ts:99`); what is missing is an **arm that measures it**, not reachability | corrected |
| 23 | C13 status "MECHANISM + DEV-LIVE for **fs, web and subprocess**" (`:182`) | `fs` and `subprocess` have live judges (`d:guard-facts`, `d3:persistent-subprocess`); **`web_fetch` has no booted measurement** — `SLICE-31/32` are in-process, and the row's own "what would prove it" says so | downgraded |
| 24 | C14b status "MECHANISM + DEV-LIVE" (`:184`) | the six invariant arms are in-process; the DEV-LIVE carriers are the live judges for fs/subprocess/Stop. The **network-deny OS control is a node-leg probe** (`ENV-LIMITED-CAPABILITY-20261123.md` §2/§3), ENV-LIMITED on an incapable runner | narrowed |
| 25 | C18 "148 sources gone with **zero residual references**" (`:188`) | closure reads `references=3 prodRefs=0` — three non-production references remain (and `retiredSurfaces=12`) | corrected to `references=3, prodRefs=0` |
| 26 | §6.1 "**Every row** is MECHANISM or UNPROVEN" (`:558`) | rows are also `DROPPED-AS-RULED` (C14, C17, C18), `REFUSED-BY-DESIGN` (C13/PTC), and `ENV-LIMITED` (five arms) | restated as "no row is PRODUCT-PROVEN" |
| 27 | §6.8 "`overall=FAIL` for both drivers" (`:732`) | since round 76 all three drivers are `overall=PASS` (`:373-377` already said so); the report contradicted itself | corrected |
| 28 | `OWNER-DECISIONS.md` items 1/2/3/6 (`:9-13`, `:29-33`, `:49-55`, `:75-81`) | item 1: `bash` proven live and the preset **does** mount `dsh-tool-bash-persistent` (round 76; only PTC is refused, by seam); item 2: `team.create` is served since round 74 (**not** 405); item 3: **resolved** round 73; item 6: formal routing **implemented** round 84. Only items 4 and 5 remain rulings | dated correction block added to the file |
| 29 | PR body gate table: dispatch 182/180, catalog `tests=889 uncollected=41` "zero headroom", closure `references=163`, `28 placement(s)` (`PR-BODY-draft.md:350-357`) | 211/209/0/2; catalog `tests=785 collected=733 excluded=14 uncollected=38` (3 under the 41 ceiling); closure `references=3`; 30 placements | table replaced with the fresh block |
| 30 | PR body "**nine** judges PROVEN and the refuted items named (`d3:persistent-subprocess`, `d2:revocation`, `d:member-read-denied`, 405)" (`:16-17`) | **fourteen** judges PROVEN (13 rc.5 + `d2:remote-delivery` rc.2); all three previously-refuted judges are now PROVEN; the 405 was removed in round 74 | corrected |
| 31 | PR body "**4,780** lines today" for `agent-bindings.mjs` (`:381`) | **4,967** lines; `root.ts` is **5,239** lines. `DECOMPOSITION-PLAN.md:4` (5,042 / 5,110) is also stale | corrected in both files |
| 32 | PR body: "Owner decisions needed (**six**, all consolidated)" (`:52`) | two open rulings (4, 5) + one blocked upstream seam (PTC) + one missing live proof (Alpha.6 routed wake) + the runtime-created-Member live proof | section rewritten |
| 33 | PR body "**16** migrated capability suites" heading (`:196` region) | **15** suites (the 16th bookkeeping entry is a helper; the list file itself says so) | heading corrected |
| 34 | Report §1 "HEAD measured at round 70 … the audit's own docs-only commits sit on top" (`:4-7`) | the candidate head is `c29da52d3`; round 85/86 commits are on top of the round-70 measurement | §1 states the audited head and records what the docs-only commit on top does |

---

## 3. Corrected capability table (matrix levels, as the evidence at this HEAD supports them)

Statuses: `MECHANISM` (in-process arms) · `DEV-LIVE` (a real host boot, not a gate) · `ENV-LIMITED`
(implemented, but the measured runner lacks the physical capability) · `REFUSED` (named refusal) ·
`DROPPED-AS-RULED` · `PRODUCT-PROVEN` (**no row**).

| row | capability | corrected status | decisive evidence | still missing |
| --- | --- | --- | --- | --- |
| C1 | 15 `team_*` tools | MECHANISM + DEV-LIVE (model-visible surface) | `ADM-31/89/90/91`; boot carries 43 tools incl. all 15 (`ESCALATION-centre-row-creation-entrance.md:13-14`) | a real model driving the board end to end |
| C2 | member create → archive | MECHANISM + DEV-LIVE (**create only**) | `ADM-92/93`; `d3:work-delivery` (`member-activated`) | live archive (refused earlier at the durable lifecycle gate) and live resume |
| C3 | delegate → collect | DEV-LIVE PROVEN (scripted model) | `d3:work-delivery`, two agreeing boots | real model; delivery at a product entrance |
| C4 | blueprint binding + identity | MECHANISM | `ADM-26`, `TB-1…TB-6`; round-60 boot binds v4 at boot | a **runtime-created** Member identity (`member.create` is served since round 83 but has no live proof) and a real-model identity |
| C5 | Control ask/grant/deny/consume | MECHANISM (+ live ask only to its Stop terminal) | `ADM-46…ADM-55`; `d2:stop` | a live approval and a live one-shot consume |
| C6 | Officer assignment + review routing | MECHANISM (formal routing, round 84) + DEV-LIVE refusal; a coherent row **is** admitted | `root.ts:2508`; `ADM-116…118`, `ADM-141…146`; `ALPHA6-FORMAL-ROUTING.md` | a **live routed wake** on a booted host |
| C7 | durable wake intents + cold wake | MECHANISM | `ADM-98/99`, `ADM-141/143` | the routed wake through the governed delivery seam, live |
| C8 | Stop | MECHANISM + **DEV-LIVE PROVEN** (`d2:stop`) | `ADM-56…62`, `SLICE-21/30/37` | post-`allow` Stop cell closed **in-process** only; the rc.5 pre-dispatch observer is **not production-wired** (`RC5-MIGRATION.md:492-501`) |
| C9 | remote entry / management plane | MECHANISM + in-process production-root arm + DEV-LIVE delivery boundary | `ADM-86`, `ADM-120…124`; `d2:remote-delivery` | **two root commands refused** (no async root-work seam); `member.create`/`member.followup` have **no live proof**; operator is per-DSH_HOME authenticated human, **not RBAC** |
| C10 | MCP catalog/grant/live loss | MECHANISM | `ADM-36`, `f15-mcp-live-loss` inside the 238 | a live mount and a live server loss |
| C11 | state projections (`sessionProjections`) | MECHANISM (Team-owned projection) | `ADM-107…109` | the **host** `sessionProjections.stateOf` half; a product-entry `team.getProjection` arm |
| C12 | tool admission (guard/deny/selector) | MECHANISM + DEV-LIVE | `d:centre-facts` (allow + `LANE_DENY`), `ADM-96` | UNSET/unreadable binding live |
| C13 | confined I/O faces | MECHANISM + DEV-LIVE for **fs and subprocess**; **web in-process only**; PTC **REFUSED / `CORE_SEAM_BLOCKER`** | `SLICE-1…30/35`, `d:guard-facts`, `d3:persistent-subprocess`; `PTC-FOUR-PART-FINDING.md` | live `web_fetch`; PTC worker OS profile (upstream seam); persistent-bash needs `@deepseek-ai/dsh-terminal` deployed or the host row is absent (`:629-635`) |
| C14 | old family bodies | **DROPPED-AS-RULED** | closure `deleted=148 prodRefs=0 references=3` | — |
| C14b | preserved safety invariants | MECHANISM + DEV-LIVE for fs/subprocess/Stop carriers; **network-deny ENV-LIMITED on an incapable runner** | `ADM-110…115`; `ENV-LIMITED-CAPABILITY-20261123.md` | PRODUCT-PROVEN; a network-capable runner for the five arms |
| C15 | `team_skill` | MECHANISM | `ADM-75`; `admission.ts:143-153` | nothing beyond the host service's own limit |
| C16 | `subagent_fork` | MECHANISM | `ADM-73/74` | — |
| C17 | Team `exit_plan_mode` | **DROPPED-AS-RULED** | no match in `packages/runtime/src` / `packages/tools/src` | — |
| C18 | `a5p5-tools` helpers | **DROPPED-AS-RULED** | `ls packages/tools/src` = 8 files; not in the migrated population | — |

**Level corrections carried into `CAPABILITY-MATRIX-C.md`:** the C-remote lead-in (which still opened with
"refused") and the C-alpha6 lead-in (which still opened with "explicitly unavailable") now carry a
superseded marker pointing at their round-74/83/84 sections; C13's web face and C14b's network arm are
stated at the level the evidence supports (in-process / ENV-LIMITED), not DEV-LIVE.

### 3.1 The ENV-LIMITED arms are five, named, and never counted as PASS

`OS-2`, `OS-3` (fail-closed controls) and `ADM-66`, `SLICE-28`, `ADM-70` (ENV-BLOCK) — one code
(`NETWORK_DENY_UNPROVEN`), aggregated as
`DSH-TEST-DISPATCH-ENV-LIMITED count=5 proven=0 env_blocks=3 fail_closed_controls=2`. On **this** host
the capability is present (`network-deny=present level=enforced`, `NET-DENY-CONFIRMED`, netns
`4026532326`) and the arms run their real kernel controls. On the hosted `ci-census` runner the capability
is absent and those five guarantees are UNPROVEN there. This is an environment absence, never a pass.

---

## 4. C1–C18 contract-table check (each row must be backed by its named evidence)

| row | status claimed | backed? | note |
| --- | --- | --- | --- |
| C1 | MECHANISM + DEV-LIVE surface | **yes** | citation corrected (`admission.ts:86-102`) |
| C2 | MECHANISM + DEV-LIVE (create) | **yes** | archive/resume explicitly not claimed |
| C3 | DEV-LIVE PROVEN | **yes** | scripted model named |
| C4 | MECHANISM | **yes, after correction** | the "member.create refused" clause was false |
| C5 | MECHANISM | **yes** | live approval/consume not claimed |
| C6 | MECHANISM (formal routing) | **yes, after correction** | headline no longer says unconditionally refused |
| C7 | MECHANISM | **yes** | |
| C8 | MECHANISM + DEV-LIVE PROVEN | **yes, after correction** | settlement-recheck clause was stale; wiring gap now named |
| C9 | MECHANISM + DEV-LIVE | **yes, after correction** | refused set narrowed to the two root commands |
| C10 | MECHANISM | **yes** | |
| C11 | MECHANISM | **yes, after correction** | "unreachable because S6 refused" was false |
| C12 | MECHANISM + DEV-LIVE | **yes** | |
| C13 | MECHANISM + DEV-LIVE (fs/subprocess); web in-process; PTC REFUSED | **yes, after correction** | web DEV-LIVE was unsupported |
| C14 | DROPPED-AS-RULED | **yes** | |
| C14b | MECHANISM + DEV-LIVE (fs/subprocess/Stop); network ENV-LIMITED | **yes, after narrowing** | |
| C15 | MECHANISM | **yes** | |
| C16 | MECHANISM | **yes** | |
| C17 | DROPPED-AS-RULED | **yes** | absence re-checked by grep |
| C18 | DROPPED-AS-RULED | **yes, after correction** | "zero residual references" → `references=3` |

**Unbacked rows found and fixed:** C4, C6, C8, C9, C11, C13, C14b, C18. **No row was upgraded.**

---

## 5. Headline-claim sweep ("proven / complete / guaranteed / enforced / closed / no gaps")

| claim | verdict |
| --- | --- |
| "not a completed product acceptance" (`:13-14`) | **kept** — accurate |
| "no capability row is PRODUCT-PROVEN" | **kept** — true at this HEAD |
| "Round 76 closed the last REFUTED judge" | **kept** — the three refuted judges are PROVEN |
| "Every live judge is PROVEN at two agreeing boots each" (`:884`) | **narrowed** — true for 14 judges; for `d2:remote-delivery` the two boots are rc.2 only |
| "no gaps" / "guaranteed" / "fully" | **no occurrence** in the report or PR body; nothing to delete |
| "enforced" | appears only in the OS-control context (`level=enforced` for `network-deny` on this host) and is accurate; the hosted runner is ENV-LIMITED |
| "the cut is closed at four zeros" | **kept** — `prodRefs=0 distResiduals=0 dupNames=0 findings=0`; but `references=3` is stated alongside so "closed" is not read as "zero references" |
| "all gates green" (PR body / §8) | **narrowed** — locally, 10/10; **hosted `ci-required` is red at this HEAD while the PR is a draft** (census skipped). Both facts are now stated |
| "Round 76 closed the last REFUTED judge; several product-entry gaps remain unreachable" | **kept**, with the entry gaps enumerated in §6 of the report and §6 below |

---

## 6. Known-open register (every still-open item is disclosed, with what closes it)

| # | open item | what closes it | disclosed at |
| --- | --- | --- | --- |
| 1 | root-work async seam — `team.admitInitialWork` / `team.ensureRootLive` refused | an async root-work delivery (enqueue + acknowledgement, no awaited turn) | report C9; `s6-command-classification.ts:94-112` |
| 2 | `member.create` / `member.followup` live evidence | a live management-plane run of both (only `member.send` was driven) | report §9.5; C9 |
| 3 | PTC worker OS-profile seam | upstream public seam or owner ruling to accept the refusal | `PTC-FOUR-PART-FINDING.md`; C13 |
| 4 | Alpha.6 live route | a booted routed wake through the governed delivery seam | report §6.5; C6/C7; `ALPHA6-FORMAL-ROUTING.md` |
| 5 | `{{cwd}}` persona change (rc.5 no longer registers `{{cwd}}`) | a ruling or a prompt-template migration; live on rc.5 the driver substitutes the literal | report §3.2 rc.5 limits; `RC5-ACCEPTANCE.md` |
| 6 | operator model is per-DSH_HOME authenticated human, **not RBAC** | an owner ruling on multi-operator isolation | report §6.2; §9.5 |
| 7 | census runner's five ENV-LIMITED arms | a runner permitting unprivileged user+net namespaces (no product change) | `ENV-LIMITED-CAPABILITY-20261123.md`; §3.1 |
| 8 | pre-dispatch abort not production-wired | wiring the exported observer at the host agent loop's `tools.execute` site | report C8; `RC5-MIGRATION.md:492-504` |
| 9 | realm-less admission ruling | owner item 4 (the code refuses today; the ruling decides the final answer) | `OWNER-DECISIONS.md` item 4 |
| 10 | search-face shape A (durable overlay cannot deny a search) | a subtree search face in the permission vocabulary (contract change) | `CONTRACT-CHANGE-REQUEST-search-face.md`; `OWNER-DECISIONS.md` item 5 |
| 11 | real model (all live records use the scripted mock) | the same judges with a real model | report §6.7 |
| 12 | hosted `ci-census` population counts vs published baseline (599/7,414 vs 626/7,936) | a baseline re-publication decision, out of this PR's scope; the identity set is identical today | §1.7 of this audit; census leg detail |

---

## 7. The four hard boundaries, verified mechanically

**(a) Candidate not merged to master.** `git merge-base --is-ancestor HEAD origin/master` → false;
`origin/master` is `a19d1df01` (the frozen A0 PR #821); 205 commits sit on the branch and none is on
`master`. `gh pr view 822` → `state=OPEN`, `isDraft=true`, `baseRefName=master`,
`headRefOid=c29da52d3…`. The audit did not merge, rebase or flip the draft.

**(b) No release / no deploy.** No tag points at HEAD (`git tag --points-at HEAD` empty; `git describe`
gives the inherited nearest tag only). No version field changed in the branch's `package.json` diff (the
only change is the removed `./web-tool` export, a retirement). No publish/deploy workflow was added; the
only workflow diffs are **added** job steps (`ci-integration.yml` +22 lines, `census-runtime.yml` +35
lines), no `continue-on-error`, no `--skip`, no weakened argv.

**(c) No compatibility layer / widened skips / removed negative controls / A0 frozen-evidence edits.**
- A0 frozen memo: `docs/plans/memo/ute-p0-20261121/01…06` are **unmodified**; the branch only **adds**
  `07-A1-SEAM-DECISION.md` and `08-CENTRE-COMPOSITION.md`.
- The two evidence re-records are explicit, not silent: `ute3-agentctl-b1-20261121/negative-controls.txt`
  (24 → 14 controls) and `ute3-process-b1-20261120/negative-controls.txt` (10 → 9) both open with
  `ACCEPTED-BY round81-a1-cut reason=re-record …` and each replacement pins *absence of the retired
  subject + its named successor* (`NC-RETIRED-*-ABSENT`, `NC-SUCCESSORS-EXIST`, `NC-GOLDEN-FROZEN`,
  `re-recorded=no`). The aggregate instrument is **35/35** (`eb3-ci-negative-controls.mjs`).
- `blueprint-fence` baseline was re-recorded in the open (line-shift only, "no literal added"); the gate
  passes with `unknown 0 files`, `new 0`.
- Skips: exactly **2** on the leg (`ADM-68` bash, `ADM-69` run_code), both disclosed, both
  `t.skip`-after-assertions; no skip was added or widened (`dispatch` reports `skipped 2`).
- No legacy fallback / compatibility shim was introduced: `CENTRE_TOOL_NAMES` and the S6 classification
  are closed tables; `ADMISSION_AXIS_UNSUPPORTED` / `ADMISSION_TOOL_UNBOUND` refusals remain.

**(d) UNKNOWN / ENV_BLOCK / skips are never counted as PASS.** `test-catalog` is
`UNCOLLECTED 38` / `EXCLUDED 14` (under the 41/7 ceilings, with reasons); the dispatcher prints
`skipped 2` and, on an incapable runner, `ENV-LIMITED count=5 proven=0`; the report and the matrix show
those cells as ENV-LIMITED; `ci-required` grades `skipped` as **not green** (that is why hosted
`ci-required` is red on the draft). No UNKNOWN was promoted.

---

## 8. Gate output block (re-run in this audit session, at `c29da52d3`)

```
$ node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1
A5SF-CAPABILITY network-deny=present level=enforced code=NET_DENY_ENFORCED ripgrep=present forced=false detail="runNetworkLeg verdict=NET-DENY-CONFIRMED mechanism=netns netns=4026532326/(host 4026531833)"
OS-1 measured landlock abiVersion=7
✔ OS-1 — the host answers the Landlock ABI the provider requires
✔ OS-2 — NEGATIVE CONTROL: a confined payload CANNOT read outside its allow set
✔ OS-3 — POSITIVE CONTROL: the same payload CAN read inside its allow set
ℹ tests 211  ℹ pass 209  ℹ fail 0  ℹ skipped 2
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975

$ node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7
  tests=785 instruments=3 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32
  DISCOVERED_AND_COLLECTED 733
  EXCLUDED_WITH_REASON     14
  UNCOLLECTED              38
  by runner: node=146 none=7 vitest=632
DSH-TEST-CATALOG tests=785 refused=0 findings=0

$ node scripts/ute-cut-closure.mjs --check
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0

$ node scripts/ute-p0-assets.mjs --check
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0

$ node scripts/docs-sync.mjs --check
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
AUTHORITY_SOURCE_BINDING {"kind":"authority-pointer","snapshot_version":"as20261109r1","pointer_digest_verified":true,"view_may_not_reverse_decide_authority":true}
LIMIT complete static check: no C1/C2/C3, no security negative, no runtime behaviour proof

$ node scripts/place-dist-glue.mjs
place-dist-glue: done (30 placement(s))          # every one byte-identical

$ node scripts/eb3-ci-required.mjs
EB3-CI-REQUIRED pass workflows=10 findings=0

$ node scripts/eb3-security-run.mjs --layer ci-security        # the bound vitest leg
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=61 passed=216 failed=0 clock_ms=20000

$ node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000

$ node --test --test-force-exit --test-timeout=480000 tests/ute1-fs/native-fs-binding.test.mjs \
    tests/ute-g1-fs/lane-suite.test.mjs tests/ute-g1-fs/lib/refusal-categories.test.mjs \
    tests/ute-g1-fs/product-route-image.test.mjs tests/ute-g1-search/lane-suite.test.mjs \
    tests/ute-g1-web/lane-suite.test.mjs tests/ute-g1-process/lane-suite.test.mjs \
    tests/ute-g1-agentctl/lane-suite.test.mjs tests/ute-g1-uistate/lane-suite.test.mjs
ℹ tests 89  ℹ pass 89  ℹ fail 0  ℹ skipped 0

$ node scripts/ci-pr-gate.mjs --full --census-captures 2
DSH-CI-LEG leg=graph-parse verdict=pass · kit-home-guard pass · state-freshness pass · append-only-log pass · install pass
DSH-CI-LEG leg=blueprint-fence verdict=pass  (dirty 20 files/54 sites, unknown 0, baseline 20 identities)
DSH-CI-LEG leg=typecheck verdict=pass · lint-identities pass (new 0, resolved 13)
DSH-CI-LEG leg=artifacts-at-head verdict=pass (1,941 files, drift=0, 30 glue placements)
DSH-CI-LEG leg=census verdict=pass (2 captures, identical identity sets; 599f/7414l vs declared 626/7936 — counts are context, the identity set is the verdict)
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=274.7

$ node scripts/eb3-ci-negative-controls.mjs
35/35 control(s) behaved as required

$ node scripts/ute-a1-window.mjs --check
UTE-A1-WINDOW pass branch=vnext/a1-cut red=0/0 cut=(148/52) findings=0
```

Raw transcripts: `dev/agent-workflow/evidence/ute-a1/round86-candidate-audit-gates.log` (fast gates) and
`round86-ci-pr-gate.log` (the full gate).

### 8.1 Hosted verdicts at `c29da52d3` (`gh` at audit time)

| check | verdict |
| --- | --- |
| `pr-gate / pr-gate` (10 legs, local argv) | **success** |
| `synthesize-merge-tree` | **success** |
| `ci-fast / ci-fast` | **success** (verdict=PASS) |
| `ci-integration / ci-integration` | **success** (verdict=PASS) |
| `ci-security / ci-security` | **success** (verdict=PASS) |
| `ci-product / ci-product` | **success** (verdict=PASS) |
| `ci-census` | **skipped** — the PR is a DRAFT |
| `ci-required` (grade job) | **failure** — `EB3-REQUIRED fail layers=6 green=5 nongreen=ci-census:skipped` (sole cause) |
| `pr-settlement-gate` | **failure** — no dated settlement comment carrying this head; settled by the round-86 comment |
| `candidate-protection` | **success** |

The hosted red is a **draft-state** red, not a product red; `ci-required` grades `skipped` as not green by
design. Marking the PR ready (owner act) runs the census and is what can turn it green. This audit does
**not** mark it ready.

---

## 9. What the owner must decide or provide

1. **Process lane / PTC** — accept the narrowed `CORE_SEAM_BLOCKER` refusal for this generation, or
   pursue the upstream seam (per-execution `SandboxExecutionPolicy` / the declared
   `confined-subprocess` executor). `bash`/PTY no longer need a ruling.
2. **Runtime team creation** — already answered and implemented (round 74); no action.
3. **Settlement recheck** — already answered (Option A, round 73); no action.
4. **Realm-less admission** — one sentence: is `MEMBER_CENTRE_UNWIRED` the final answer?
5. **Search face** — one sentence: is lane-only search governance final (shape B), or is shape A wanted?
6. **Alpha.6** — implemented formally (round 84); the remaining need is a **live routed-wake proof**, not a
   ruling. If a ruling is expected here, it is "is record-only approval fact enough?" — the report keeps it
   MECHANISM until a boot measures it.
7. **Merge/release** — only the owner can mark the PR ready (which runs `ci-census` and can turn hosted
   `ci-required` green) and only after a verdict of PRODUCT-PROVEN (none exists) plus the open rulings.

No item can be closed by re-enabling an ungoverned plane, inventing an axis, or widening an invariant.
