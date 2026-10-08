# FINDINGS — lane `fix-a4-collection-errors-32` (the three collection errors that hid 32 legs)

lane: `fix-a4-collection-errors-32` · worktree `.worktrees/a4-collection-errors-32` · base `1d706917` (master)
scope: **test-only**. `git status --porcelain -- 'packages/*/src'` is empty at hand-back: no production file was
changed, so no rebuild and no `check:artifacts:head` drift claim is needed. Evidence dir:
`dev/agent-workflow/evidence/a4-pr7/collection-errors/`.

---

## 0. VERDICT

1. **All three collection errors reproduced at base and each is named to its cause** (§1). There were **four**
   causes, not three: `p8s3b` had two gaps stacked, the second invisible until the first was served. Every one of
   them is a **test double that stopped honouring a production law that moved under it** — no product defect was
   found, and no product file was touched.
2. **32 in, 32 accounted for: 32 green, 0 red, 0 deleted.** They now register and they run.
   Registered identity went **6288 → 6321**: the **+33** is the 32 unmasked legs plus exactly one leg this lane
   added on purpose (`M1`, §5) to discharge the plan's reuse instruction. Nothing else moved (§4 table).
3. **The prior estimate of "≈19 red among the 32" is wrong: the measured number is 0.** That is reported as an
   estimate correction, not as a win — a collection error that un-masks into 32 silent greens is exactly the case
   the brief warns about ("legs that silently disappear" has a mirror image: "legs that reappear without biting").
   Six mutation witnesses (§3) are the counter-evidence: the re-appearing legs do bite, each on its own plane.
4. **The failing identity set went 22 → 19: `NEW 0 / FIXED 3`**, the three `FILE …::COLLECTION-OR-UNHANDLED`
   identities, and the 19 titled reds are **byte-for-byte the published identities** (checked with `diff`).
   Collection-error files: **3 → 0**. Files: 505, unchanged (this lane added no test file).
5. **`createScriptedAgentsDouble` is a SOUND mechanism and the plan's instruction pointing at it is BROKEN in
   four ways** (§5). It is now exported and one leg proves by execution what it does and does not witness. The
   lane-B RED should consume the bridge's `records.creates`, or a lifted helper — not import a `.test.ts`.
6. **`BASELINE-CLASSES.md` §7 row 22 prescribes a repair that cannot be written** (§2.3): there is no "legal v3
   document whose leader declares no persona", because `persona` is required on the leader
   (`packages/domain/blueprint/src/validate.ts:350`). The lawful carrier of "no effective persona" is the preset
   substrate (`personaKind: 'absent'`). Correction block for the coordinator: `BASELINE-CORRECTION.md` here.
7. **The nine-root census ran EXACTLY ONCE** (§6). Gates: merge gate 29/29, typecheck clean, lint at the standing
   128 errors, `lint-identities --diff … → new 0`, derived `p4t6 filesScanned = 1039` (unchanged: no new file in
   scan scope, so no named-list extension). Full battery: `FINAL-BATTERY.txt`.
8. **Handed back unmerged, no push.** Findings the coordinator owns are in §7.

---

## 1. The three collection errors, by CAUSE (Task 1)

Base capture: `raw/base-collection-errors.json`, `transcripts/base-collection-errors.txt` — vitest 4.1.11 reports
`Test Files 3 failed (3)` / **`Tests no tests`** and the JSON carries **0 assertionResults for all three files**.
That is the mechanism by which a "zero new failures" rule cannot see them: the identity grammar records one
`FILE …::COLLECTION-OR-UNHANDLED` line per file, so 32 legs are worth three lines, and those three lines were
already in the published baseline.

| # | file | throwing evaluation | the missing thing | why it throws now |
|---|---|---|---|---|
| 1 | `packages/runtime/test/p8s3b-result-effects.test.ts` | the **first module-level world block** (G1, base `:629`) calls `binding.createRootAgent(rootSessionId)` → `agent-bindings.mjs:3897` → `durableSessionExists` **`:886-890` throws** `agent-bindings: sessionPersistence.exists public seam is unavailable` | `exists()` on **the file's own inline `sessionPersistence` double** (base `:393-468`). This file does **not** use `createLiveWorld`, so the bridge's compliant `createSessionPersistenceDouble` never runs — the private double is what the product sees. | C1: the public `sessionPersistence.exists` seam is mandatory (guide §5.1/§5.2; the physical-layout probe was deleted). A double without `exists` is now a hard refusal, at module scope. |
| 2 | same file, **revealed only after #1 was served** | the same world's setup → `agent-bindings.mjs:2142` → `rootBaseToolsUnavailable` **`:4278` throws** `root base tools unavailable for 'session-p8s3b-g1': the agentPresets service is absent from the glue deps (or lacks a callable mount) (code: root-base-tools-unavailable)` | `agentPresets` in `glue.createAgentBindings({ … })` | D1: a v3 root bind **must** mount presets (root or member preset id). `createGlueWorld` never passed the service. |
| 3 | `packages/runtime/test/t12a-b2-child-identity.test.ts` | module-level restart block (base `:88`) → `resumeTeamAgent` cold-member → `locateTemplate` **`:1845-1900` throws** `capability template unresolved for 'session-team-child-0921004bd8be78e1e76cb9359d5805b4' (reason=template-id-missing instanceId=inst-t12ab2member)` | a durable **`MemberInstance` row** in the restart world's domain double | P0-1 §3.4 fail-closed: the fresh-create `templateIdHint` is **not** an authorization fallback for a `cold-member` resume. The fixture carried the SESSION artifact but no member row, so the resume had nothing to resolve against — a correct refusal. |
| 4 | `packages/runtime/test/t12a-glue-handoff-ports.test.ts` | **world C** (`configOverrides: { blueprintSource: '' }` at base `:204`, built at `:206`) → `locateTemplate` → `getBoundBlueprint` `:1802-1812` → bridge default `resolveBoundBlueprint` (`t12a-live-bridge.mjs:1469`) → `parseBlueprint('')` → `TeamContractError: blueprint document must start with a --- frontmatter delimiter line` (`packages/domain/blueprint/src/parse.ts:77`) | nothing is missing from a double — the file's **premise moved**: it expressed "no effective persona" as an **empty blueprint document** | §7.3 v3-only cutover: `parseBlueprint` hard-refuses a non-document. An empty anchor is no longer a legal way to say "no persona". World **D** is built after C, so `GLUE-12` died as collateral even though its own premise was fine. |

The four throws are all **fail-closed productions of laws the plan itself installed** (C1 `exists`, D1 preset
mount, P0-1 §3.4 template resolution, §7.3 v3-only parse). The frozen fixtures predate the laws. Nothing in the
product behaved wrongly; four test doubles were asserting against a world that no longer exists.

---

## 2. The repair (Task 2) — minimum, test-only

`grep -c 'expect('` base → tip: `p8s3b` 57 → 67 (+10, all inside the new `M1` leg), `t12a-b2` 17 → 17, `t12a-glue`
47 → 47. The removal scan in `scratch/expect-count.txt` shows **no base assertion is absent at tip**: no
assertion was rewritten, weakened or deleted, and **no leg was deleted** (`it.skip/todo/each` is 0 at base and 0
at tip; `it(` counts 16→17, 4→4, 12→12).

### 2.1 `p8s3b-result-effects.test.ts` — serve the two moved seams on the file's own doubles
* `createGlueWorld`'s private `sessionPersistence` double gained `exists(sessionId) → Promise.resolve(false)`
  (plus `existsCalls`), with a dated comment naming the cause. `false` is the honest answer for these worlds:
  none of them materializes a durable session before the create.
* `createGlueWorld` passes `agentPresets: createAgentPresetsDouble()` (the bridge's double, already used by 38
  other files) into `glue.createAgentBindings`.
* The stale §7.4 comment ("This file is RED AT BASE by name…") is now a dated HISTORY + **RE-RUN DUTY —
  DISCHARGED** block pointing at the green captures, and it records the second gap.

### 2.2 `t12a-b2-child-identity.test.ts` — the restart world carries what a real restart has
`worldA2` (the restart) now seeds `members: [{ childSessionId: idA, instanceId: INSTANCE, templateId: 'tpl-t12a' }]`
and an `agentPresets` double. That row is precisely the durable fact a restarted process would read from the
domain store; deleting it restores the `capability template unresolved` refusal (verified, then reverted). The
alternative reading — "invert the leg to assert the refusal" — would have thrown away the file's actual law
(*a restart re-derives the same child id and resumes it, never a second create*) to pin a guard already pinned
elsewhere (§3 pins).

### 2.3 `t12a-glue-handoff-ports.test.ts` — say "no persona" with the mechanism that means it
World C's `configOverrides: { blueprintSource: '' }` became
`configOverrides: { presetSubstrate: { presetId: 't12a-absent-preset', personaKind: 'absent' } }`; the GLUE-11
header doc was updated to name the substrate instead of "empty blueprint".
* **Why not BASELINE-CLASSES §7 row 22's suggestion** ("a legal v3 document whose leader declares no persona"):
  `packages/domain/blueprint/src/validate.ts:350` makes leader `persona` **required**, so that document does not
  exist. Attempting it re-introduces a different refusal, not a green.
* `personaKind: 'absent'` is not a lane invented here: `apply()` in `packages/runtime/agent-setup/persona/adapter.ts`
  is the production path that installs no scoped identity and raises no error, and
  `packages/runtime/test/t12a-m2-persona.test.ts:187` already uses it for exactly this purpose (and `:105` is the
  precedent for the `members: [{…}]` row shape used in 2.2).
* **Neither moved premise is now unpinned** — the refusals the old fixtures used to slip past are asserted by
  named green legs in this same census, so nothing was hidden by these repairs:
  `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts::D1 — the bright line: a version refusal degrades, a
  non-document still fails the constructor an anchor that is not a document at all still throws (fail-closed
  construction)` and its `D4 — … the degraded anchor value refuses every read (it is never an empty document)`
  family pin the empty/non-document anchor;
  `packages/runtime/test/mcp-blueprint-initial-grant.test.ts::D2 — a bound-blueprint resolution fault FAILS LOUD
  (P1-B) the created root setup rejects with the typed capability-template-unresolved error (no half-state)` pins
  the template-resolution refusal that `t12a-b2` tripped over;
  `packages/runtime/test/p5t6-cold-member.test.ts::P5-T6 C1/C2` pin cold-member resume integrity.

---

## 3. The 32 legs: red classification, and why zero reds is not a shrug (Task 3)

**Classification: 0 reds. `MUST-NOT-STAY-EXEMPT` — none remaining; `REGISTERED-DEBT` — none; `INSTRUMENT-DEFECT`
— two observations, §3.2.** All 33 legs (32 + `M1`) are green in the single census; per-leg statuses extracted
from that capture are in `scratch/three-files-leg-status.txt`.

A zero-red result is the *suspicious* outcome for a set that had been invisible for weeks, so it was tested
rather than accepted. Six transient **product mutations** (each reverted with `git checkout --` and confirmed by
empty porcelain) show each leg bites on its own plane:

| witness | product mutation (transient) | legs that went RED | what the leg therefore actually pins |
|---|---|---|---|
| `probe-A-no-body-succeeded` | glue maps a completed-without-body turn to `succeeded` | **G2** (1 of 17) | "no body ⇒ `unavailable`, NEVER succeeded" is asserted, not decorative |
| `probe-A2-token-blind-correlation` | delivered-turn read ignores the request-token prefix | **G3, G4/G5/G6, G7, G8** | token correlation and the failure-code mapping |
| `probe-B-root-blind-identity` | child id derived without the root | **B2-2** | root-aware identity: same instance under two roots must not collide |
| `probe-B2-no-resume-branch` | restart takes the create branch | **B2-3** | "a restart resumes; never a second create" |
| `probe-C-standard-substrate` | world C substrate forced to `standard` persona | **GLUE-11** | "no effective persona starts clean" really turns on the absent substrate |
| `probe-E-carrier-status-forced` | `action-router/effects.ts:857` forces `memberResult.status = 'succeeded'` | **E3, E4, E6, E7** | the effect carriers do bite — on the carrier plane |

**3.1 What the witnesses also expose (a real hole, named precisely).** Probe A red-lined `G2` while leaving `E4`
green; probe E red-lined `E3/E4/E6/E7` while leaving `G2` green. The file therefore pins **two separate planes** —
the glue's delivered-turn *mapping* (G) and the Leader-facing effect *carrier* (E) — and **no leg covers the
composition**: a regression inside the mapping never reaches the carrier legs, because the E-family arms the
delivery port with an already-normalized result (`delivery.armResult({ status: 'unavailable', … })`).
Verdict: **`INSTRUMENT-DEFECT`, on the composition, not on any of these legs.** How it is a defect: an
end-to-end regression in `agent-bindings.mjs`'s turn mapping would be caught only by the G plane, so a carrier
that starts lying to the Leader stays invisible while its own legs stay green. Fixing it means driving the real
glue behind the real `workDelivery` port in a new leg — i.e. writing new coverage, which is outside a repair
lane's remit ("you are here to make them visible"), and it is handed back in §7.3.

**3.2 The second instrument observation.** The plan's `RE-RUN DUTY` for `p8s3b` (§7.4 witness) is discharged —
but note what discharged it: the v3 document is now parsed **at bind time inside the run** (no
`resolveBoundBlueprint` is injected in this file, so `getBoundBlueprint` takes the row-global
`parseBlueprint(config.blueprintSource)` arm). Before this lane, that claim rested on a parse-only probe.
The §7.4 three-key delta itself is unchanged.

---

## 4. The registered universe, by identity (Task 4 support)

**ONE capture** (`scratch/tip-census.sh` → `raw/tip-census.json`), nine roots named, sequential, `CI=true`,
`XDG_CACHE_HOME` in-workspace, `.tmp-fault` cleared first. Driver: `scratch/census.sh`; the leg-identity
extractor is `scratch/leg-set.mjs` (same identity grammar as `scripts/fail-set.mjs`).

| root | files | registered legs |
|---|---|---|
| contracts | 13 | 150 |
| domain | 26 | 523 |
| legacy | 7 | 100 |
| remote | 15 | 232 |
| runtime | 353 | 4046 |
| storage | 23 | 287 |
| testkit | 29 | 372 |
| tools | 12 | 129 |
| client | 27 | 482 |
| **total** | **505** | **6321** |

Zero-leg (collection-error) files: **0**.

Failing identity set vs the published baseline
(`dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/baseline-2162f6a7.ids.txt`, 22 ids):

```
[fail-set] baseline=22 current=19 NEW=0 FIXED=3
FIXED FILE packages/runtime/test/p8s3b-result-effects.test.ts::COLLECTION-OR-UNHANDLED
FIXED FILE packages/runtime/test/t12a-b2-child-identity.test.ts::COLLECTION-OR-UNHANDLED
FIXED FILE packages/runtime/test/t12a-glue-handoff-ports.test.ts::COLLECTION-OR-UNHANDLED
```

and the 19 `TEST …` identities at tip **equal the published 19 verbatim** (`diff` empty). Arithmetic of the
universe: `6321 − 6288 = +33` = 32 unmasked + 1 added (`M1`); no other file's legs moved — the three files
contributed **0** registered legs at base (proven by `raw/base-collection-errors.json`: all three
`assertionResults: []`) and contribute 33 at tip, and `git diff --name-only` names only those three test files,
so the identity set of every other file is a function of unchanged bytes.

**Capture-integrity note (recorded because the lane owes exactly one census):** the census read
`p8s3b-result-effects.test.ts` at blob `sha256 66844ae8…` (reproduced byte-for-byte as
`scratch/p8s3b-as-read-by-the-census.ts`); two **comment-only** edits landed afterwards, and with comment lines
stripped the capture blob and the tip file are the same 1376 lines in the same order
(`scratch/capture-vs-tip-proof.txt`). The measured identity set is the tip identity set.

The correction block for the coordinator — in the dated-correction form the published file uses, ready to
append, **not applied here** — is `BASELINE-CORRECTION.md`.

---

## 5. `createScriptedAgentsDouble` — is the plan pointing the next lane at something sound? (Task 5)

**Verdict: the mechanism is sound; the instruction as written is not usable, in four specific ways. Two are
fixed by this lane, two need a one-line plan correction.**

Proof by execution: **`M1: the exported double IS the §7.2 zero-creates witness — truthful about the CALL,
silent about survival`** (foot of `p8s3b-result-effects.test.ts`, green in the census). It asserts on the
helper's own output:

* a refusal **before** the service call (`createRootAgent('')` through the real glue) leaves
  `{ creates: 0, resumes: 0, materialized: 0 }` — the exact shape §7.2 prescribes;
* the refused start does **not** wedge the binding (the same live binding creates afterwards: `{1, 0, 1}`) —
  §7.2 plane 1, degrade and do not die;
* a refusal raised **inside** the `setup` callback is still **recorded** (`creates === 1`). So the counter
  counts the *call*: `records.creates.length === 0` is evidence only if the refusal sits ahead of
  `agents.create`, which is exactly where §7.2 says to put it ("between the row read and the first durable
  write"). A lane that puts the check behind the create will read `1` and must not blame the instrument;
* the records themselves are real (`{ sessionId, meta, setupProvided: true }`, `setupProvided: false` on
  resume) and the scripted log is readable through the **public** `ownEvents()` seam the delivered-turn mapper
  uses; with `sessionWithoutOwnEvents: true` the seam is absent, which is what `G11` pins as explicit
  `unavailable`.

What was wrong with the instruction (`alpha4-implementation-plan.md` §7.2, the "Fix the lane-B RED wording"
paragraph, line 791):

1. **The symbol was module-private.** `function createScriptedAgentsDouble(...)` at `:293` — not exported, so no
   other file could import it at all. **Fixed: it is exported (now `:301`)** with a dated doc comment naming the
   plan sentence it serves.
2. **It lived in a file that did not collect** (BASELINE-CLASSES §6.2 had already noticed). A lane following
   line 791 at `1d706917` would have aimed at a module no run could load. **Fixed by §2.1.**
3. **The consumption path the plan names is the OTHER mechanism's.** `records.creates` is the surface of the
   shared bridge (`createLiveWorld(…).records.creates`, used by `t4a-capability-wiring.test.ts:459/488`);
   `createScriptedAgentsDouble` exposes `creates` directly (this file reads `world.agents.creates`). The plan's
   "as at `t4a-capability-wiring.test.ts:476`" also points eight lines off — the assertion is at **:488** — and
   `worldResume` there comes from `buildCapabilityWorld('resume')` (`:322` → `createLiveWorld` at `:258`), which
   never touches this helper. **Needs a plan correction, not a test correction.**
4. **Cross-file reuse by importing this file is a hazard, measured.** `probe-D-cross-file-import.txt`: a scratch
   file importing `{ createScriptedAgentsDouble }` from `./p8s3b-result-effects.test` ran **18 tests** — its own
   one plus this file's **17** re-registered under the importer, on top of ~20 module-level world builds. Vitest's
   include is `packages/*/test/**/*.test.ts`, so a spec module imported for one helper drags its whole suite and
   duplicates its identities under a second file name.

**Recommendation for the next lane (and for the plan text):** for a whole-world zero-creates RED, consume
`createLiveWorld({ … }).records.creates` — it is exported, it is what the plan's own example uses, and it costs
one world build. Reuse `createScriptedAgentsDouble` only for the narrow thing it is better at: scripting the
**session log** behind the glue (`scriptEvents`, and the `sessionWithoutOwnEvents` defensive arm). If the plan
wants it reused across files, lift it into a non-spec helper module (`t12a-live-bridge.mjs` or a
`p8s3b-helpers.ts`) rather than importing a `.test.ts`; this lane deliberately did **not** lift it — the bridge
is shared by 38 files and moving it is not a minimum repair.

---

## 6. Gates and resource discipline

| gate | result |
|---|---|
| nine-root census | **captured ONCE**, 114.4 s, `raw/tip-census.json`. No other lane's file was touched; the census was not re-run for any reason. |
| `packages/testkit/test/a4p7-merge-gate.test.ts` (off-limits) | **29 passed (29)** — run, never edited |
| `pnpm --no-bail -r run typecheck` | clean, 9 packages, no errors |
| `pnpm run lint` | **128 errors / 32 warnings** — the standing number, unchanged |
| `lint-identities --diff …lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0` (1118 files linted) |
| derived `p4t6` | `scanSessionEventVocabulary({}).filesScanned = 1039`, measured on this tree; **unchanged** because this lane adds no file and the scan counts files in scope, so the named list needs no extension |
| neighbourhood (the two shared bridges' consumers: 11 files) | **82 passed (82)** |
| production source | untouched: porcelain empty under `packages/*/src`; six probe mutations reverted; `check:artifacts:head` not applicable |
| `grep -c 'expect('` base → tip | 57→67 / 17→17 / 47→47, **zero removals** |
| environment | `CI=true`, `XDG_CACHE_HOME` inside the workspace, `.tmp-fault` cleared before every vitest, captures strictly one at a time, port `:3080` never touched |

Load caveat, stated rather than hidden: three other lanes were measuring failure rates on this machine during
this lane. It cannot make the 0-red result less deterministic (a collection error and a mutation witness are
load-independent), but the census totals are load-adjacent and are therefore reported as **identity sets**, with
counts only as a derived reading.

---

## 7. Findings handed back (the coordinator owns these; this lane did not act on them)

1. **Apply the baseline correction** (`BASELINE-CORRECTION.md`): universe 6288 → **6321**, failing set 22 → **19
   by identity**, collection-error files 3 → **0**. If the published file keeps "3 collection files", the referee
   will keep treating a resolved collection error as the expected state, which is the trap that hid these 32 legs.
2. **Correct plan §7.2 line 791** (§5 items 3 and 4): the consumption path is the bridge's `records.creates`, the
   cited line is `t4a-capability-wiring.test.ts:488`, and importing a `.test.ts` for a helper duplicates its leg
   identities. The helper is exported at `p8s3b-result-effects.test.ts:301` if a lift is preferred.
3. **New lane-sized task: the mapping↔carrier composition is uncovered** (§3.1). Cheapest honest shape: one `p8s3b`
   leg that drives the real glue behind the real `workDelivery` port for a body-less turn, asserting
   `unavailable` on the **effect** (not on the armed port), then re-run probes A and E — under a correct
   implementation both planes must go red together.
4. **Latent class, lead not defect: 17 runtime test files (plus one shared helper module,
   `p8s5a-stub-glue.mjs`) reference `sessionPersistence` and contain no `exists` method**
   (`scratch/sessionpersistence-no-exists.txt`, which also marks the two that drive the glue directly). None
   fails today — the census reports zero zero-leg files — because most of them never reach
   `durableSessionExists`. Anyone touching that seam should expect the `p8s3b` pattern if they start driving
   it: a refusal at module scope, and one `FILE` identity for a whole file of legs.
5. **`BASELINE-CLASSES.md` §7 row 22 prescribed an unwritable repair** (§2.3). Rows 20/21's prescriptions were
   correct and are now discharged.

---

## 8. Hand-back manifest

Branch `fix-a4-collection-errors-32`, **unmerged, never pushed**. Code commit `91087636` (three test files +
this evidence dir); the FINDINGS wording fix lands in the commit after it.

| artifact | what it is |
|---|---|
| `FINDINGS.md` | this file — verdict first, cause per file, the 32 accounted for, the red classification, the baseline correction, the `createScriptedAgentsDouble` verdict |
| `BASELINE-CORRECTION.md` | the dated-correction block for the coordinator to append to `population-baseline/nine-root-2162f6a7.md` (22 → 19 identity set), plus the two mechanical edits it implies. **Not applied here.** |
| `FINAL-BATTERY.txt` | every gate run against the committed content, with its assertion (`BATTERY RESULT: ALL GATES OK`) |
| `raw/base-collection-errors.json` + `transcripts/base-collection-errors.txt` | the reproduction: `Tests no tests`, three files, zero `assertionResults` |
| `raw/tip-census.json`, `scratch/tip-census.{ids,legs,roots}.txt` | the ONE nine-root census: 505 files / 6321 legs / 19 reds / 0 zero-leg files |
| `scratch/leg-set.mjs` | the registered-universe extractor (identity grammar of `scripts/fail-set.mjs`, applied to ALL legs, plus the zero-leg-file list) — worth keeping: `fail-set.mjs` alone cannot answer "did legs disappear?" |
| `transcripts/probe-{A,A2,B,B2,C,E}-*.txt` | the six mutation witnesses of §3 (each mutation reverted; porcelain verified clean) |
| `transcripts/probe-D-cross-file-import.txt` | the §5 reuse hazard, measured: 18 tests in a file that imported the helper |
| `scratch/capture-vs-tip-proof.txt`, `scratch/p8s3b-as-read-by-the-census.ts` | proof that the single census measured the committed identity set, not a stale one |
| `scratch/{census,final-battery}.sh` | the reproduction drivers, in the form the previous lane's evidence used |

Not done, on purpose: no assertion rewritten, no leg deleted, no product file touched, no baseline file
edited, no `it.skip` introduced, no push. The two things this lane deliberately left for the coordinator are
§7.1 (apply the correction) and §7.2 (fix plan §7.2 line 791); §7.3 is the one genuinely new lane-sized task
this work found.
