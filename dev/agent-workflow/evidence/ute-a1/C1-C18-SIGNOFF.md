# C1–C18 sign-off — the 06 capability contract, itemised (round 113)

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, PR #822 (DRAFT). This file is the
independent, evidence-bound sign-off the review `20261125-0058` Stage C asks for: **one row per
contract item**, with what the contract requires, the evidence that it survived, the level that
evidence actually supports, the limitation, and whether Required CI carries it.

It is not a restatement of `D-ACCEPTANCE-REPORT.md` §2.2. Where the two disagree, the disagreement
is named in §5 below and this file's measurement wins. **Round 117 (2026-11-25) changed the top level's
DEFINITION, not any row's level**: the candidate gate is a VERSION gate (required at a frozen candidate SHA,
never a per-PR required context), so the "gate" column now reads `REQ` (Required CI) and `VG` (coverage by the
version gate's 31 judges) instead of `CAND`, and §3.1 states which rows the gate covers and which it never
will. No row is PRODUCT-PROVEN, and the definition in force is `VERSION-GATE.md` §1.

## 1. The authoritative list (not reconstructed)

`docs/plans/memo/ute-p0-20261121/06-CAPABILITY-CONTRACT.md`, section **"The list (A1 must dispose of
every row)"**, lines 30–52. The rule that makes it enforceable is at `:86-90` ("A1 may not merge
while a row is blank … 'dropped' must name the owner ruling"); the phase split is `:16-28`; the
C14/C14b split is `:54-63`.

The table has **19 rows**: C1…C18 plus **C14b**, because the owner split C14 into "drop the
implementations" and "preserve the safety invariants". C14b is a sub-row of the same frozen
contract, not a nineteenth criterion. C13 is additionally split here into its **base face set** and
its **two ruled-out arms** (PTC, per-call process ask) so that the two owner rulings are visible
rather than buried in a mixed row. No new capability id is invented: the split rows are labelled
`C13 (PTC arm)` and `C13 (process-ask arm)`.

## 2. Level vocabulary (closed, not interchangeable)

| level | what it means | what it does **not** mean |
| --- | --- | --- |
| **MECHANISM** | the centre-side guarantee is implemented and has passing arms executed by **Required CI** | not a boot, not a product assembly, not a model |
| **DEV-LIVE** | additionally measured on a real booted host by a named live judge that is PROVEN on ≥2 agreeing boots | **not** a gate: no version has been frozen, so the version gate cannot upgrade a row (owner ruling 2026-11-25) |
| **ENV-LIMITED** | the guarantee is implemented and proven on a capable host, but the measured runner lacks the physical capability, so the runner's only admissible evidence is the product's fail-closed refusal | never counted as proven |
| **UNSUPPORTED BY PRODUCT RULING** | the capability is deliberately **not offered** by this generation under a named owner ruling; the refusal is the product | not "incomplete", not a pending fix, not "missing tests" |
| **NOT PROVEN** | there is no admissible evidence for the row at all | — |

No row is **PRODUCT-PROVEN**; that word does not appear as a level here. **Definition in force** (owner
ruling 2026-11-25): PRODUCT-PROVEN means *gate-backed at the frozen candidate SHA of a version, with the
version gate Required and green at that SHA and its `version-gate-receipt.json` verified there* — **not**
"covered by every PR's Required CI". See `VERSION-GATE.md` §1 and `CANDIDATE-REPORT.md` §1.1.

## 3. Gate coverage key

The merge gate is the synthetic `ci-required` context over the five `ci-*` layers
(`dev/ci/eb3-ci-manifest.json`). Two independent layers matter to this sign-off:

- **REQ** — the ute A1 population in Required CI:
  - `ute-vnext-a1` node:test leg (`ci-census` layer; 7 suites, pinned host):
    `packages/runtime/test/vnext-{realm-lane,fs-slice,admission,os-probe,work-turn-reader,template-binding,b-probe-ladder}.test.mjs`
    (`dev/ci/eb3-ci-manifest.json:834-853`);
  - the 15 migrated vitest suites (`ci-integration` layer,
    `tests/checks/eb3-ute-migrated-suites.txt`, 238/238);
  - the static closure legs (`ute-cut-closure`, `ute-p0-assets`).
- **VG** — the **VERSION gate** (owner ruling 2026-11-25): `scripts/candidate-acceptance-gate.mjs`,
  `.github/workflows/candidate-acceptance.yml`, declared `knownNonRequired` **with an explicit
  version-gate classification** in the manifest (asserted by `scripts/eb3-ci-required.mjs`). It runs the
  four D drivers on both pinned hosts, 2 boots each: **31 judges per host / 62 per dual-host run, 60
  PROVEN / 2 known-refuted / 0 env-limited** at head `92be91dfb`
  (`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T23-43-47-693Z/verdict.json`).
  It is **Required only at a frozen candidate SHA** and is **never** a per-PR required context. A row
  covered only here is **DEV-LIVE**; it becomes PRODUCT-PROVEN only through the freeze
  (`VERSION-GATE.md` §1/§6), which has not happened.

### 3.1 What the 31 judges cover — and what they never will

The **VG** column below is a **coverage** token, not a level: `VG` means a judge in the 31-judge population
can speak to that row; `—` means no judge does, so no freeze can ever promote the row through this gate.

| which rows | VG? | why |
| --- | --- | --- |
| C2, C3, C5, C6, C8, C9, C12, C13 (fs/subprocess base) | **yes** | the drivers' judges execute them (`d2:remote-delivery`, `d3:work-delivery`, `d4:ask-*`/`sticky-stop`, `d2:stop`, `d9`/`d2` remote judges, `d:centre-facts`/`guard-facts`, `d3:persistent-subprocess`) |
| C7 | **partial** | `d4:wake-delivered` is the live delivery; the **cold-wake** half is not judged |
| C13 (process-ask arm) | **only as the enumerated REFUTED** | `d4:ask-execute-process` is the single `KNOWN_REFUTED`; the gate never proves the positive |
| C14b | **partial** | path bounds / Control / Stop carriers are touched; the **network-deny** invariant is never judged live (ENV-LIMITED on the hosted runner) |
| C1, C4, C10, C11, C13 (PTC arm), C13 (web/terminals/userQuestions faces), C14, C15, C16, C17, C18 | **never** | no judge in the population asserts the row's proposition |

**No blanket coverage may be inferred from a green gate.** "The gate is green" speaks to the rows in the
first three rows of that table, never to the rest of C1–C18.

**Evidence binding, stated honestly.** The candidate-gate verdict named in §3 names head `92be91dfb`, not
this file's head. `git diff --stat 92be91dfb..HEAD -- 'packages/*/src'` is **empty** for the product code the
judges execute, so the live judges describe the same product code; the machine record is nevertheless bound to
`92be91dfb`, and **no receipt exists for this head** — that is disclosed, not smoothed over. (An earlier
revision of this file cited the round-109 verdict at `41d579119`; `92be91dfb` is the newer dual-host run.)

## 4. The sign-off table

| # | capability (06 contract) | what the contract requires | evidence | level | limitation | gate |
| --- | --- | --- | --- | --- | --- | --- |
| **C1** | the **15** `team_*` tools (member/template/delegation/control board) | **preserve**; the earlier draft wrongly credited the retired plane | Closed list `CENTRE_TOOL_NAMES` (`packages/runtime/src/plugin/vnext/admission.ts:86-102`). `ADM-31` pins it against `createTeamTools` **in both directions**; `ADM-89` admits all 15 on `team.control`; `ADM-90` refuses all 15 unbound with zero bodies; `ADM-91` refuses an unlisted name. A live boot listing the model-visible surface is recorded at `ESCALATION-centre-row-creation-entrance.md:8-9` | **MECHANISM** | The live surface listing is an observation, not a judged arm; no candidate-gate judge asserts the 15-tool closed set. Some tools are exercised live only as substrate of `d3:work-delivery` / `d4:*` | **REQ** |
| **C2** | member create / resume / archive | **preserve**; lifecycle suite | `ADM-92` (create records the authority fact and installs the member's own centre), `ADM-93` (archive CLOSES the centre; a later call is `ADMISSION_MEMBER_CLOSED`, settlement `REFUSED`/`not-started`); migrated `d2-s6-ensure-root-live.test.ts`; live: `d2:remote-delivery` records archive accepted `ARCHIVED` → send to ARCHIVED typed `TEAM_RUNTIME_WORK_STATE_REJECTED` → restore accepted `SETTLED` (round 109), and `d3:work-delivery` creates the worker | **DEV-LIVE** | **resume** has no dedicated live judge (cold re-open is covered by `a2-canonical-operation`/`d3:crash-cold-recovery` for state, not for the `member.resume` verb); archive/restore live evidence rides the `d2:remote-delivery` judge | **REQ + VG** |
| **C3** | work delegation + delivery receipts | **preserve**; delivery suite | `ADM-94` (delegate→collect delivers the unit, and the collected work's own member calls are judged by the member's centre), `ADM-95` (negative: a refused delegation delivers NOTHING, admits no work); live `d3:work-delivery` PROVEN on both hosts / 2 boots | **DEV-LIVE** | The receipt ledger is asserted in-process; the live judge reads the same durable facts but does not assert every ledger field | **REQ + VG** |
| **C4** | Blueprint binding + identity generation | **preserve** (KEEP module); identity suite | `TB-1…TB-6` (`packages/runtime/test/vnext-template-binding.test.mjs`) — durable row resolution, one row/many roots, fresh-member-only bridge, four typed refusals with no legacy degradation, legacy anchor, factory refusal; `ADM-26` (compiled member maps onto a binding by reference, never by re-interpretation); migrated `bound-blueprint-persona-root.test.ts`, `a4p7-v3-cutover-acceptance.test.ts` | **MECHANISM** | No live judge asserts the identity chain as its proposition; the boot path is exercised by every D driver but not judged there | **REQ** |
| **C5** | Control: ask / grant / deny / consume | **preserve** (KEEP module), fed by the three contracts; `ute2-settlement` + new contract arms | `ADM-46` (ask needs BOTH binder and recorded approval), `ADM-47/48/49` (denied / expired / faulting approval each its own refusal), `ADM-50` (the REAL Control service), `ADM-56…ADM-62` (Stop/authority), `ADM-112` (C14b Control authority); live `d4:ask-execute` PROVEN (durable ask → Leader allow → one-shot consume → 27 bytes → `COMPLETED`), `d4:ask-denied`, `d4:ask-stopped`, `d2:stop` | **DEV-LIVE** | Live grant consumption is proven for `write`/`writeText` only; the other operation kinds keep in-process receipt arms (`ADM-154…ADM-173`) | **REQ + VG** |
| **C6** | Officer assignment + ReviewCapability routing | **preserve** (KEEP module); alpha6 suite; if not wired, the paths must be *explicitly disabled*, never a silent Leader fallback (`06:95-98`) | `ADM-34/99` (incoherent opt-in refused piece-by-piece; coherent row admitted), `ADM-149` (durable case through the existing leg writer), `ADM-150` (real router selects the Officer), `ADM-151` (non-qualifying ask keeps the plain Leader path), `ADM-152/153` (typed refusal / self-review refused); live `d4:routed-wake` + `d4:case-created`, `d4:router-officer`, `d4:wake-delivered`, `d4:officer-decides`, `d4:ask-executes-after-review`, `d4:duplicate-route`, `d4:sticky-stop` all PROVEN on both hosts, 2 agreeing boots | **DEV-LIVE** | The live evidence is the **version gate** (non-required on PRs; not frozen); and the driver's own `d4/README.md` is stale (it still reports `d4:routed-wake` REFUTED — see §5 F-1) | **REQ + VG** |
| **C7** | durable Wake intents + cold wake | **preserve**; cold-wake kit | `ADM-98` (on the only row shape where Alpha.6 is reachable, the ONE router takes a real decision and the durable wake record is written/consumed); migrated `a6-root-wiring.test.ts`, `a6-boot-settlement-lanes.test.ts`; live `d4:wake-delivered` PROVEN (the governed wake reaches the Officer's own session) | **MECHANISM** | The **cold-wake** half — a wake intent written before a restart and consumed after a cold start — is not a live judge. `d3:crash-cold-recovery` proves state recovery, not wake consumption; `ADM-98` is in-process | **REQ + VG** (partial: `d4:wake-delivered` only — never the cold half) |
| **C8** | Stop (sticky, durable, non-replaying) | **preserve**; Stop must work in the first executable version; stop-fence + SIGKILL arms | `ADM-56…ADM-62` (stop before body, stop during approval, closed member, replay), `ADM-113` (C14b STOP, durable across a fresh reader), `ADM-84` (open settlement after crash classifies UNKNOWN, no invented terminal state); live `d2:stop` PROVEN, `d4:sticky-stop` PROVEN, `d4:ask-stopped` PROVEN | **DEV-LIVE** | In-flight Stop settles `UNKNOWN` when the body aborts without a terminal observation (`dispatch-settlement.ts:815-848`); that is honest but means an in-flight Stop is not a `CANCELLED` claim unless the Stop evidence exists | **REQ + VG** |
| **C9** | remote entry (`s6-remote`, remote control surface) | **preserve**; remote suite | migrated `d2-s6-ensure-root-live.test.ts`; live `d:remote-creation` PROVEN (a Team minted at runtime through `POST /team-remote/team.create`) and `d2:remote-delivery` PROVEN (archive/send/restore full typed replies) on both hosts | **DEV-LIVE** | Not every `s6-remote` verb has a live judge; the two entrances that matter for A1 (create, delivery) do | **REQ + VG** |
| **C10** | MCP catalog + initial grant + live loss | **preserve**; may land in C but must never be on by default while unmanaged | `ADM-96` (a REAL mounted MCP server's tool call is admitted by the ONE centre on `net.mcp`, and its real body answers), `ADM-97` (member lane decides a mounted call; tool restriction narrows; bare prefix is not a permission); migrated `f15-mcp-live-loss.test.ts`; the live MCP mount is a declared non-run (env) in `vnext-b-probe-ladder` | **MECHANISM** | No live booted MCP server in the measured set; the `ADM-96` mount is in-process over a real server object, not a boot | **REQ** |
| **C11** | state projections (`sessionProjections`) | **preserve** (native services); projection suite | `ADM-107` (projection derives from the real durable TeamDomain, field-by-field; a real `team_create_member` is what the next reader sees, including after cold reopen), `ADM-108` (a refusal at the ONE centre moves nothing), `ADM-109` (live overlay is not a second authority; absent TeamSession fails closed; a pass writes nothing); migrated `a3p5-permission-read-wiring.test.ts` | **MECHANISM** | The host's own `sessionProjections.stateOf` half is preserved **by construction** (zero references in both the retired and new entries), not measured live; no live `todo`/`goal` projection read | **REQ** |
| **C12** | tool admission (guard, builtin deny, selector) | **preserve** (KEEP module); guard suites | `ADM-1…ADM-45` (lanes, deny precedence, unbound refusal, closed axes, tool restriction narrows before the ceiling), `ADM-29/30/31/35/44`; live `d:centre-facts` PROVEN (2 `fs.read` admissions — `allow` + `DENY/LANE_DENY` — and 2 execution facts read back from disk), `d:guard-facts` PROVEN | **DEV-LIVE** | The live policy is passed as a compiled input, not compiled at runtime from a live authority change; the model is scripted | **REQ + VG** |
| **C13** *(base faces)* | confined I/O faces (fs/web/subprocess/terminals/userQuestions) | **replace** with provider lanes; probe ladder rungs 1–6 | fs: `SLICE-1…SLICE-36`, `ADM-110` (path bounds at the centre **and** on the resolved provider path), live `d:guard-facts`; subprocess: `ADM-125…ADM-131`, `ADM-133`, live `d3:persistent-subprocess` PROVEN (the second turn reuses the same shell; out-of-lane write refused by the OS profile); web: `ADM-67/74`, `SLICE-31/32`; terminals/userQuestions: `SLICE-33` (PTY-owner refusal), the PTY face is live through the persistent shell | **DEV-LIVE** | **web is in-process only** (no live `web_fetch`); `terminals`/`userQuestions` beyond the PTY-owner refusal have no live judge; the OS `network: deny` arm is ENV-LIMITED (see C14b) | **REQ + VG** (partial: fs/subprocess only; web/terminals/userQuestions are never judged) |
| **C13** *(PTC arm)* | PTC — `run_code` | contract row C13 includes the faces; the **product ruling** excludes PTC | `ADM-76/79/87` (typed `ADMISSION_PTC_UNAVAILABLE` before the body, status `unsupported-by-product-ruling` on fact + settlement, zero worker/effect), `ADM-69/147/148` (`NOT APPLICABLE — PRODUCT UNSUPPORTED`, machine-visible, never silently skipped). Ruling: `docs/reviews/20261124-0151.txt` §PTC; amendment `ADR-ptc-unsupported.md`; declaration `ptc-product-ruling.mjs` | **UNSUPPORTED BY PRODUCT RULING** | The capability is not offered. The **refusal** is proven; a working `run_code` is not a goal of this generation | **REQ** (the refusal arms; never VG — the gate has no PTC judge) |
| **C13** *(process-ask arm)* | per-call `ask` for **process execution** | allow/deny are promised for Subprocess/PTY; per-call ask is **not** | `d4:ask-execute-process` is **REFUTED** on both hosts and is the single enumerated `KNOWN_REFUTED` in the candidate gate (`candidate-acceptance-gate.mjs:104-116`): the real ask→allow→consumed grant ran, then the persistent-bash lookup failed with the host's `NO_BACKEND` because the v5 per-tool bash binding realm carries no PTY terminal spec — spawn failed before any process, zero bytes, settlement `FAILED`, verifier never reached. Ruling: `SCOPE-subprocess-ask.md` §2/§4 (owner, 2026-11-24); review `20261124-2120.txt` ruling 1 | **UNSUPPORTED BY PRODUCT RULING** | The refusal is preserved as REFUTED, never rewritten as a positive test and never softened to REFUSED/not-started; `allow`/`deny` remain the promised scope and are mechanism-proven (`ADM-126/127`) | **VG** (as the single enumerated REFUTED only; the required arms prove the fail-closed receipt laws, not support — this row can never become PRODUCT-PROVEN through the gate) |
| **C14** | **old governed-family execution implementations**: each family's own tool body, its duplicated policy computation, and the historical per-family semantic-equivalence requirement | **drop** (A0 frozen); census §2 | `ute-cut-closure --check` → `cut(0/148)` (`deleted=148 prodRefs=0 distResiduals=0 dupNames=0`); `ute-p0-assets --check` → `37/180/69512 cut(148/148)`; `CUT-BOUNDARY-ADDITIONS.md`; `03-RETIRE-KEEP.md`; contract ruling `06:47` | **UNSUPPORTED BY PRODUCT RULING** (dropped as ruled) | Not a gap: the implementations are gone and the equivalence criterion is retired. A drop is complete when closure is green and the ruling is named | **REQ** (`ute-cut-closure`, `ute-p0-assets`) |
| **C14b** | the safety invariants those families enforced: path read/write upper bounds, network allow/deny, Control authority, Stop | **preserved** — never implied by C14's drop; probe ladder rungs 1–6 + P1–P5 | `ADM-110` PATH BOUNDS (centre + resolved provider path), `ADM-111` NETWORK (allow/deny decides; no fs lane authorises the network), `ADM-112` CONTROL AUTHORITY (the ONE durable Control plane adjudicates every ask), `ADM-113` STOP (one host signal, `REFUSED`/`not-started`, durable across a fresh reader), `ADM-114` PROCESS (an unjudgeable shell refused, never run unconfined); `OS-1/2/3` (Landlock ABI + negative/positive kernel controls), `SLICE-28` (grep confined inside ceiling/refused outside); live `d:guard-facts`, `d2:stop`, `d3:persistent-subprocess` | **ENV-LIMITED** | The **network-deny OS enforcement** (`ADM-66`, `ADM-70`, `SLICE-28`, `OS-2`, `OS-3`) cannot be proven on the hosted `ci-census` runner: netns creation succeeds but `/proc/self/uid_map` write is refused, so the deny child connects tcp/delivers udp. The product refuses fail-closed (`NETWORK_DENY_UNPROVEN`); the local host proves it (`NET-DENY-CONFIRMED`). Evidence: `ENV-LIMITED-CAPABILITY-20261123.md`; the leg emits `DSH-TEST-DISPATCH-ENV-LIMITED` | **REQ + VG** (partial: never the network-deny invariant) |
| **C15** | `team_skill` | **preserve, re-homed** — Team skill provider into a host-shaped row; new row test | `ADM-32` (preserved host capabilities stay usable and are bound on `host.service`); `skill` is in `HOST_CAPABILITY_TOOL_NAMES` (`admission.ts:143-153`); governed preset mounts `a5sf-skill-provider` (`scripts/dist-placements/190-a5sf-pd29-service-seam.json:5-6`) | **MECHANISM** | No live skill invocation; the host-capability lane is an admission allow with **no fs/net lane** (a stated boundary, see the security review's second-authority note) | **REQ** |
| **C16** | `subagent_fork` | **preserve, re-homed** — row over `subagent-fork-in-process`; new row test | `ADM-32`; bound as host capabilities (`subagent`, `send_message`, `interrupt_agent`); the **child's own** binding governs the child's tools | **MECHANISM** | No live fork; the parent's ceiling is explicitly **not** a claim about the child | **REQ** |
| **C17** | Team's own `exit_plan_mode` tool (not DSH plan mode, not the goal tools) | **dropped by owner ruling**; `get_goal`/`create_goal`/`update_goal` untouched | Provable by absence: zero `exit_plan_mode` references under `packages/runtime/src`; `ute-cut-closure`; contract ruling `06:51` | **UNSUPPORTED BY PRODUCT RULING** (dropped as ruled) | Not a gap. The host's `claude-code-mods` name mapping is not a Team plan-mode state machine | **REQ** (closure/absence) |
| **C18** | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | **drop** (deleted in A1); dormant audit | `packages/tools/a5p5-tools` absent; the cut deleted 148 sources with `prodRefs=0`; `ute-cut-closure --check` green; absent from the migrated population; contract ruling `06:52` | **UNSUPPORTED BY PRODUCT RULING** (dropped as ruled) | Not a gap: dormant, nothing dispatched | **REQ** (`ute-cut-closure`) |

## 5. Summary counts

Counted over the **21 sign-off rows** in §4 (C1–C18, the contract's C14b split row, and C13's two
ruled-out arms):

| level | count | rows |
| --- | --- | --- |
| **MECHANISM** | **7** | C1, C4, C7, C10, C11, C15, C16 |
| **DEV-LIVE** | **8** | C2, C3, C5, C6, C8, C9, C12, C13 (base faces) |
| **ENV-LIMITED** | **1** | C14b |
| **UNSUPPORTED BY PRODUCT RULING** | **5** | C13 (PTC arm), C13 (process-ask arm), C14, C17, C18 |
| **NOT PROVEN** | **0** | — |
| **PRODUCT-PROVEN** | **0** | — (no row claims it; the definition in force is "gate-backed at the frozen candidate SHA of a version, version gate Required and green there", **not** "covered by every PR's Required CI" — `VERSION-GATE.md` §1) |

If the two split arms are folded back into one C13 row and C14b is counted as the 19th contract
row, the same measurement reads: **18 numbered criteria + C14b** = 7 MECHANISM, 8 DEV-LIVE,
1 ENV-LIMITED, 4 UNSUPPORTED (C13 contains both ruled-out arms, C14, C17, C18), 0 NOT PROVEN.

**The two rulings, explicitly (not "incomplete"):**

1. **PTC** — `run_code` is `UNSUPPORTED BY PRODUCT RULING` (owner, 2026-11-24,
   `docs/reviews/20261124-0151.txt` §PTC; `ADR-ptc-unsupported.md`;
   `ptc-product-ruling.mjs`). The refusal is typed, durable and machine-reported.
2. **Per-call process `ask`** — `UNSUPPORTED BY PRODUCT RULING` (owner, 2026-11-24,
   `SCOPE-subprocess-ask.md` §2/§4; review `20261124-2120.txt` ruling 1). `allow`/`deny` for
   Subprocess/PTY are the promised scope; the ask fails closed and is preserved as the candidate
   gate's single enumerated `KNOWN_REFUTED`.

## 6. Corrections to the earlier checklist (found in this round, not smoothed over)

- **F-1 (evidence hygiene).** `dev/agent-workflow/evidence/d-boot-feasibility/d4/README.md:104-133`
  still describes `d4:routed-wake` as **REFUTED** and lists `wake-delivered`/`case-created` as ❌.
  The machine artifacts from the same evidence tree (`d4/results.json`, the candidate-gate
  `verdict.json`) prove all seven routed sub-judges **PROVEN** on both hosts. The README is a
  round-87 snapshot that was never updated; citing it as the live verdict inverts C6. This
  sign-off uses the machine artifacts, not the README. **Not fixed in this round** (evidence-only
  round; the stale file is named here so a reader cannot be misled).
- **F-2 (stale checklist text).** `D-ACCEPTANCE-REPORT.md` §2.2's C6/C7 rows still say the live
  routed wake is "NOT proven" / "remaining gap is a LIVE routed wake"; that stopped being true when
  the routed sub-judges went PROVEN. §5 above re-measures it as **DEV-LIVE** (C6) and **MECHANISM**
  (C7, cold-wake half only).
- **F-3 (no PRODUCT-PROVEN promotion).** The candidate gate's pass does **not** move any row. The
  gate is a **VERSION gate** (owner ruling 2026-11-25): Required at a frozen candidate SHA, never a per-PR
  required context, and declared as such in `dev/ci/eb3-ci-manifest.json` with a classification
  `scripts/eb3-ci-required.mjs` asserts. No version has been frozen, so a green gate is DEV-LIVE at most.

## 7. What would move a row

- **C1/C4/C10/C11/C15/C16 → DEV-LIVE**: a named candidate-gate judge that asserts the row's
  proposition (the 15-tool closed set / the identity chain / a booted MCP mount / a host
  `sessionProjections.stateOf` read / a live skill call / a live fork).
- **C7 cold wake → DEV-LIVE**: a driver that writes a wake intent, restarts the same home, and
  asserts the intent is consumed exactly once with no replay.
- **C13 (base) web → DEV-LIVE**: a live `web_fetch` at a boot through the confined face.
- **C14b network → PRODUCT-level**: a CI runner whose netns actually enforces `network: deny`
  (the hosted runner's uid_map refusal is the measured blocker).
- **Any row → PRODUCT-PROVEN**: the **version-freeze procedure** (`VERSION-GATE.md` §6) at a frozen
  candidate SHA — the version gate Required and green there, its receipt verified there — **and** a row
  whose proposition one of the 31 judges actually asserts (§3.1). A row outside that coverage can never
  become PRODUCT-PROVEN through this gate, however many times it is frozen. Today no version is frozen, no
  protection rule is applied, and every model in every boot is scripted.
