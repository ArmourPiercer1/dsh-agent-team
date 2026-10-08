# BASELINE-CLASSES — what the zero-new-failures rule is exempting, identity by identity

lane: `a4-pr7 / baseline-classes` (evidence-only) · branch `docs-a4-baseline-classes` · base `master = 606a0be7`
worktree `.worktrees/a4-baseline-classes` (fresh, `pnpm install` + `pnpm setup` run here; `check-artifacts-committed compared=1508 … OK`)
written: 2026-10-09 · author: delegated evidence lane, sole writer · **no source, test, manifest, config or gate file was modified by this lane** (see §9)

---

## 0. Why this document exists

The merge gate (`alpha4-implementation-plan.md` §7.6, line 853) accepts a code merge on
**"zero NEW failure identities against a published baseline"**, and the published baseline
(`../population-baseline/nine-root-2162f6a7.md`, with its dated corrections) carries **19 titled red legs
+ 3 collection-error files = 22 exempted identities**. That rule is honest — it never claims the suite is
green — but it never asks *which* of those 22 sit on the planes this stage exists to protect.
External review put the line to answer as:

> failures that bear on this stage's permission-security or storage-integrity semantics must not stay
> baseline-exempt; unrelated historical debt should be registered as debt. Otherwise "zero new failures"
> quietly becomes evidence of overall reliability.

This document is one row per exempted identity, read at the body level, plus the two things a count-based
baseline never shows: **the assertions that are dead inside a red leg** (§5) and **the legs that are green
for the wrong reason** (§6).

## 1. The census this table is built on

Nine roots **by name**, exactly as published: `packages/{contracts,domain,legacy,remote,runtime,storage,testkit,tools,client}/test`.
Capture tool `scratch/census.sh` → `scripts/fail-set.mjs capture`; every id list is diffed against the
published 22-id set `../7-6-closure/scratch/baseline-2162f6a7.ids.txt`.

| capture | files | registered legs | titled reds | collection files | id-set vs published |
| --- | --- | --- | --- | --- | --- |
| `full-1` | 505 | 6288 | 19 | 3 | `baseline=22 current=22 NEW 0 FIXED 0` |
| `full-2` | 505 | 6288 | 19 | 3 | `NEW 0 FIXED 0` |
| `load-1` / `load-2` / `load-3` (parallel load) | 505 | 6288 | 19 | 3 | `NEW 0 FIXED 0` |

All five captures were taken under `CI=true`, private `XDG_CACHE_HOME`, one capture at a time, and every
header records `HEAD=606a0be7 dirty=0 pids=0`. Raw JSON: `raw/full-{1,2}.json`, `raw/load-{1,2,3}.json`;
id sets: `scratch/*.ids.txt`; transcripts: `transcripts/*.txt`.

**Escalation check required by the lane brief — result: none needed on set membership.**

* no census identity is absent from the published baseline (`NEW 0`, five of five);
* no published red stopped being red (`FIXED 0`, five of five);
* **no titled red resolved into a collection error** and **no leg disappeared from the registry** — the two
  moves that would have been findings rather than improvements;
* counts moved only in the documented ways: `+3 files / +3 legs` over the `ac54ffb8` correction
  (505/6288 vs 505/6285) and `+3 files / +11 legs` over `7-6-closure/ROOT-CENSUS.md` (502/6277) — registry
  growth from commits after those captures, identity set unchanged. Counts are reported for arithmetic; the
  comparison was made on identities.

**Determinism, so nothing below is a load artifact.** The six red files run **solo in 1.30 s** produce
`Test Files 6 failed (6)`, `Tests 19 failed | 47 passed (66)`, and the same 19 identities
(`raw/solo-reds.json`, `scratch/solo-reds.ids.txt`). The three collection errors reproduce **solo in 1.12 s**
with byte-identical causes (`raw/collection-errors.json`). These are properties of the tree.

### 1.1 p6t1-parallel — reported as a rate, not as a label

The baseline's published correction (round 38) says this family is **not** a known-green flake before
PR #194; `../p6t1-flake/FINDINGS.md` records the verdict *"The family was not flaky. The product was
racy"* with 4/20 + 4/10 red at `ac54ffb8` and 0/20 + 0/10 after the fix `de18a7bc`.
`de18a7bc` is confirmed an ancestor of `606a0be7`. Re-observed here (`scratch/p6t1-solo-runs.tsv`):

> **p6t1-parallel: 0 red in 13 runs** — 8 solo runs × 12 legs plus the 5 full census captures = 156
> leg-executions, zero failures at `606a0be7`.

Green, with the rate quoted. The "usual flake" label is retired for this base: if it turns red again it is
a new identity, not noise.

## 2. How each identity was classified (stated so the rows can be argued with)

1. **Plane** = the property the leg *guards*, read from the leg body — never the wording of the failure.
   A leg that guards an authority, ceiling, approval, revocation, or durable-state property is
   `permission-governance` / `storage-integrity` / `concurrency-persistence` **even when its failure
   message looks stale**. Staleness is a reason to fix the leg, never a reason to downgrade its plane.
2. **`MUST-NOT-STAY-EXEMPT`** = the guarded property is on one of the three stage planes **and no green leg
   pins it**. The gate diffs identities, so a regression inside an already-red leg cannot create a new
   identity: an exempt red leg protects nothing, not even its passing prefix. That is the verdict test —
   *"is this law pinned in a green leg?"* — and it is checked per row with a citation.
3. **`REGISTERED-DEBT`** = the law is pinned green elsewhere (the green citation is named), or the property
   is off the stage planes. Register it with owner and repair; exemption is then harmless.
4. **`INSTRUMENT-DEFECT`** = the instrument cannot fail or cannot run, and this document says how.
   Instrument defects are marked where found; they never move a plane.
5. For every `MUST-NOT-STAY-EXEMPT` row, the smallest honest next step is a one-sentence lane scope. All 13
   are test-only; none needs a product change, and none is claimed as fixed here.

## 3. The table — 22 exempted identities

`VERDICT`: **MNE** = MUST-NOT-STAY-EXEMPT · **DEBT** = REGISTERED-DEBT · **INSTR→DEBT** = registered debt whose
proximate cause is a broken instrument (the law itself is pinned in a green leg, so the exemption costs no
coverage today, but the leg cannot fail as written).
Plane abbreviations: **PG** permission-governance · **SI** storage-integrity · **CP** concurrency/persistence.

| # | identity (`describe > test`) | file:line | what the leg actually asserts (body, not title) | why it is red now — first failure line, then cause | plane | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `T1: Blueprint Capability Schema > 1. Legacy fixture parses without capabilities field` | `packages/domain/test/t1-capability-schema.test.ts:150` (failing :152) | a document that declares **no** `capabilities` parses, and `leader.capabilities` is absent so the member has no static template policy | `TeamContractError: unsupported blueprint schema version 1; this build supports [3]` — the fixture writes `schemaVersion: 1`; §7.3 made v3 the only supported version (stale premise) | PG | DEBT |
| 2 | `… 2. Leader with full capabilities parses and validates` | `t1-capability-schema.test.ts:161` (failing :163) | a leader's **non-empty** `teamTools`/`builtinToolDeny`/`skills`/`mcp` declarations parse and the parsed values equal what was declared | `TeamContractError: blueprint frontmatter is not valid YAML (line 10): Unexpected block-seq-ind on same line with key` — the file's own YAML writer (:113-140) cannot emit a non-empty array; it never reaches the validator (instrument defect) | PG | **MNE** |
| 3 | `… 3. Members can have different capabilities` | `t1-capability-schema.test.ts:176` (failing :181) | two member templates carrying different capability sets each keep their own after parse (no cross-contamination) | same invalid-YAML fixture defect (instrument defect) | PG | DEBT |
| 4 | `… 7. Changing capability fields changes the hash` | `t1-capability-schema.test.ts:256` (failing :257) | mutating `teamTools` / `builtinToolDeny` / `skills` / `mcp` each changes the blueprint `contentHash` | same invalid-YAML fixture defect; **all 10 assertions dead (0 run)** | SI | **MNE** |
| 5 | `… 8. Static source returns selective mode for Leader with capabilities` | `t1-capability-schema.test.ts:312` (failing :316) | `staticCapabilitiesOf(blueprint, leader).mode === 'selective'` and its fields are the declared ones | same invalid-YAML fixture defect (instrument defect) | PG | INSTR→DEBT |
| 6 | `… 9. Static source returns selective mode for MemberTemplate with capabilities` | `t1-capability-schema.test.ts:328` (failing :335) | same fork for member templates (capsA/capsB both selective, own values) | same invalid-YAML fixture defect | PG | INSTR→DEBT |
| 7 | `… 10. Static source returns legacy mode when capabilities absent` | `t1-capability-schema.test.ts:348` (failing :352) | a document without capabilities resolves to the **legacy** static-capability mode, i.e. the selective/legacy fork | `unsupported blueprint schema version 1` (stale premise) | PG | **MNE** |
| 8 | `… 11. Selective source maps to TemplatePolicy values correctly` | `t1-capability-schema.test.ts:358` (failing :367) | selective `teamTools`/`skills`/`mcp` map into `TemplatePolicy` values | invalid-YAML fixture defect | PG | INSTR→DEBT |
| 9 | `… 11b. Selective source maps deny entries to values correctly` | `t1-capability-schema.test.ts:375` (failing :384) | **deny** entries map to values (deny is not silently dropped) | `unsupported blueprint schema version 1` (stale premise) | PG | INSTR→DEBT |
| 10 | `t2 hash: hashable projection > projects absent optional singles as explicit null` | `packages/domain/test/t2-blueprint-hash.test.ts:108` (failing :116) | the hashable projection of a leader template contains exactly these keys, absent optional fields appearing as explicit `null` | `AssertionError: expected { templateId: 'leader', …(6) } to deeply equal { templateId: 'leader', …(5) }` — `toHashableTemplate` (`validate.ts:1616-1637`) always emits `capabilities: … ?? null`; the literal was never refreshed (stale premise) | SI | **MNE** |
| 11 | `D3 the member identity context block … > D3-4 FAIL CLOSED: wrong/missing rootSessionId stays rejected at the closed tool layer; a foreign-root setup rejects without installing a block` | `packages/runtime/test/d3-member-identity-context.test.ts:423` (failing :451) | a foreign/mismatched `rootSessionId` is refused **and no identity block is installed** | `AssertionError: expected 'agent-bindings: capability template unresolved for 'session-child-p6t2-w1' (reason=template-id-missing …) (code: capability-template-unresolved)' to contain 'fail closed'` — the fail-closed capability-template guard now fires *before* the persona-install guard; the `foreignCtxPersonaEntries.length === 0` check on :452 never runs (premise moved) | PG | **MNE** |
| 12 | `P6-T3 member→member mediation … > 1. no grant → MEDIATED via the leader: input on the leader session, nothing on the peer, the coordination fact keeps the intended recipient` | `packages/runtime/test/p6t3-mediation.test.ts:327` (failing :334) | with no direct grant the send is mediated through the leader, the peer session stays silent, and the recorded coordination fact names the intended recipient | `AssertionError: expected 'session-root-p6t1' to be 'session-child-p6t3-leader'` — `3be0de1f` ("fix messaging relay to root leader", `coordinator.ts:449`) routes leader-directed relays to the **root** session; only `p6t3-send-delivery` + `f3c-messaging-sibling` were updated then (stale premise) | PG | DEBT |
| 13 | `… 3. grants are PER-SENDER: worker2 holds no grant of its own → still mediated` | `p6t3-mediation.test.ts:394` (failing :399) | a grant held by one worker does not authorise another sender; and the mediated envelope text carries `intended-for=` the real recipient | `TypeError: Cannot read properties of undefined (reading 'sessionId')` — the module-scope probe reads `port.inputsFor(leader.childSessionId)[1]` (:228), empty since the relay moved to the root session (premise moved; capture now undefined) | PG | **MNE** |
| 14 | `… 4. a newer overlay generation without the grant revokes it (latest generation wins, fail closed → mediated again)` | `p6t3-mediation.test.ts:410` (failing :415) | revocation is by latest overlay generation and fails **closed** back to mediated; the re-mediated text still names `intended-for=` | `TypeError: Cannot read properties of undefined (reading 'sessionId')` — probe at :259 (premise moved) | PG | **MNE** |
| 15 | `… 5. authority beats mediation: the scout envelope denies send-message, so the facade rejects it — zero writes, no coordination fact` | `p6t3-mediation.test.ts:423` (failing :429) | an envelope denial beats mediation: typed refusal, error name, **zero durable writes**, no coordination fact | `AssertionError: expected 4 to be 1` — `inputCount` sums the leader+scout inboxes while relay inputs land on the root session (premise moved). The code / error-name / `newWrites===0` assertions do run; `intentFacts` is dead | PG | DEBT |
| 16 | `… 7. the relay text + attribution carry the correlation and the intended-for identity (mediated and direct)` | `p6t3-mediation.test.ts:468` (failing :471) | the delivered text is exactly `[team-relay:mediated via leader] from=… intended-for=…` / `[team-relay] from=… to=…` and the attribution object carries the correlation + the real intended recipient | `TypeError: Cannot read properties of undefined (reading 'attribution')` (premise moved) | PG | **MNE** |
| 17 | `P6-T3 restart durability + pending-delivery recovery > 2. the pending MEDIATED intent is recovered onto the LEADER session (the plan is re-derived from the fresh state)` | `packages/runtime/test/p6t3-restart.test.ts:396` (failing :404) | after a restart, a pending **mediated** delivery is reconstructed from durable facts, re-derived against fresh state, delivered in mediated mode with the mediated text and full attribution | `TypeError: Cannot read properties of undefined (reading 'sessionId')` (premise moved: relay target is now the root session) | CP | **MNE** |
| 18 | `… 5. recovery aborts on the first hard failure (R5): earlier confirmations stay durable; the clean retry recovers ONLY the remainder` | `p6t3-restart.test.ts:450` (failing :451; fault injected at :186) | a mid-recovery port failure aborts the run with the typed error, already-confirmed deliveries stay durable, and the retry recovers only what is left (partial durability across restart) | `Error: assertMessagingCode: expected MessagingError 'MESSAGING_DELIVERY_FAILED', got undefined` — the fault is injected with `port2.setFailSession(P6T3_SEEDS.leader.childSessionId)` (:186), a session recovery no longer writes to, so **the injection never fires: 0 of 12 assertions run** (silent no-op instrument) | SI | **MNE** + INSTR |
| 19 | `P6-T6 tool set — delegated actions (unit level) > messaging: worker -> leader is delivered direct to the leader bound session` | `packages/tools/test/p6t6-actions.test.ts:879` (failing :893) | the tool layer addresses a worker→leader message to the leader's bound session with `team-relay` attribution naming sender and intended recipient | `AssertionError: expected 'session-root-p6t1' to be 'session-child-p6t2-leader'` (same `3be0de1f` premise) | PG | DEBT |
| 20 | `FILE packages/runtime/test/p8s3b-result-effects.test.ts::COLLECTION-OR-UNHANDLED` | `p8s3b-result-effects.test.ts:629` (throw site; seam at `agent-bindings.mjs:887-890`) | 16 legs (`G1:1122 … G11:1231`, `E1:1244 … E7:1295`) on the member-result truth contract: a completed turn with no assistant body is **unavailable, never succeeded**; a delivered turn is read through the public session-log seam; a replayed token synthesises the **same** result | `Error: agent-bindings: sessionPersistence.exists public seam is unavailable` — the file's own `sessionPersistence` double (:393-468) lacks the `exists` method the product made mandatory; the suite never collects and **all 16 legs are red without appearing as red** | SI/CP | **MNE** + INSTR |
| 21 | `FILE packages/runtime/test/t12a-b2-child-identity.test.ts::COLLECTION-OR-UNHANDLED` | `t12a-b2-child-identity.test.ts:88` (throw; bridge `t12a-live-bridge.mjs:870`) | 4 legs (`B2-1:100`, `B2-2:108`, `B2-3:113`, `B2-4:121`): child session identity is derived root-aware (the same instance under two roots must not collide) and a restart **resumes** the existing child rather than creating a second one | `agent-bindings: capability template unresolved for 'session-team-child-0921004bd8be78e1e76cb9359d5805b4' (reason=template-id-missing instanceId=inst-t12ab2member)` — the durable fixture row written for the restart carries no `templateId`, and the fail-closed template guard refuses the resumed handle | CP | **MNE** + INSTR |
| 22 | `FILE packages/runtime/test/t12a-glue-handoff-ports.test.ts::COLLECTION-OR-UNHANDLED` | `t12a-glue-handoff-ports.test.ts:206` (throw; override at :204) | 12 legs (`GLUE-1:243 … GLUE-12:321`): handoff-port wiring, **leader persona installed under the target root identity**, a scoped persona shadowing a global one, no effective persona ⇒ a clean start, and a durable root re-attaching through `agents.resume` | `TeamContractError: blueprint document must start with a --- frontmatter delimiter line` — the file builds "no persona" with `configOverrides: { blueprintSource: '' }` (:204); an empty document is now refused at bind time by `parseBlueprint` (premise moved) | PG | **MNE** + INSTR |

**Verdict counts (22 rows):** `MUST-NOT-STAY-EXEMPT` **13** (rows 2, 4, 7, 10, 11, 13, 14, 16, 17, 18, 20, 21,
22 = 10 titled reds + all 3 collection files) · `REGISTERED-DEBT` **9** (rows 1, 3, 5, 6, 8, 9, 12, 15, 19; four
of them — 5, 6, 8, 9 — are also broken instruments, marked `INSTR→DEBT`) · pure `INSTRUMENT-DEFECT` **0** — and
that zero is itself the answer to the review: **no exempted identity is a merely-broken instrument that loses
nothing.** An instrument defect is the mechanism in 11 of the 22 rows (2, 3, 4, 5, 6, 8, 9, 18, 20, 21, 22): in
**6** of those (2, 4, 18, 20, 21, 22) the broken instrument also leaves a stage-bearing property with no live
assertion anywhere, and in the other 5 the law survives in a green leg, so there the instrument is debt rather
than exposure.

**Plane counts (22 rows):** `permission-governance` **16** (rows 1, 2, 3, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15,
16, 19, 22) · `storage-integrity` **3** (rows 4, 10, 18) · `concurrency/persistence` **3** (rows 17, 20, 21)
· `remote-wire` **0** · `client-UI` **0** · **`unrelated-historical` 0.** Row 20 is dual-plane (member-result
durability and restart replay) and is counted once, under `concurrency/persistence`.

There is no unrelated historical debt in this baseline. Every one of the 22 sits on a plane this stage works
on — 16 of them on `permission-governance` itself — which is exactly why blanket exemption is the wrong
instrument: exempting the set is exempting the stage's own subject matter.

## 4. Why the 22 rows collapse into three real causes

* **One commit, eight legs** — `3be0de1f` *"fix messaging relay to root leader"* changed
  `coordinator.ts:449` to `const deliveredToSessionId = isLeaderTarget ? rootSessionId : String(target.childSessionId)`
  and updated **two** test files. Rows 12-19 (8 legs) are all that one premise move. Their exemptions are a
  bookkeeping failure, not a semantics failure: the product got stricter (a root leader is addressed as the
  root session) and the observers were not carried along.
* **A v3-only cutover that left a fixture behind** — §7.3 retired schema versions 1 and 2
  (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`, `validate.ts:1196`; YAML decode happens first, at
  `parse.ts:127`, which is why the YAML defect *masks* the version defect). Rows 1-9 and row 10 are one
  stale test fixture plus one stale projection literal. The honest model already exists in the tree:
  `packages/domain/test/blueprint-v1-frozen-resume.test.ts` is **green** on frozen v1 bytes and asserts the
  typed refusal (`SCHEMA_VERSION_MISMATCH`) instead of pretending a v1 document parses.
* **Four instruments that cannot execute** — rows 18, 20, 21, 22: a fault injector aimed at a session the
  product no longer writes to, a double missing a now-mandatory public seam, a durable fixture row without a
  `templateId`, and a "no persona" world built from an empty document.

## 5. The dead-assertion tail — what the exemption actually deletes

Vitest stops a red leg at its first failing assertion, so every `expect(` after it never executes. The gate
diffs identities, so a regression behind that point cannot create a new identity. Measured over
`raw/solo-reds.json` (`scratch/dead-tail.mjs`):

| leg | `expect(` sites | run | **dead** | first dead line |
| --- | --- | --- | --- | --- |
| `t1` 1 | 2 | 0 | 2 | :154 |
| `t1` 2 | 5 | 0 | 5 | :166 |
| `t1` 3 | 4 | 0 | 4 | :184 |
| `t1` 7 | 10 | 0 | **10** | :265 |
| `t1` 8 | 5 | 0 | 5 | :316 |
| `t1` 9 | 4 | 0 | 4 | :335 |
| `t1` 10 | 1 | 0 | 1 | :352 |
| `t1` 11 | 5 | 0 | 5 | :367 |
| `t1` 11b | 4 | 0 | 4 | :384 |
| `t2` projection | 11 | 5 | 6 | :116 |
| `D3-4` | 12 | 10 | 2 | :451 (**the "no block installed" check, :452**) |
| `mediation` 1 | 13 | 3 | 10 | :334 |
| `mediation` 3 | 6 | 3 | 3 | :399 |
| `mediation` 4 | 5 | 3 | 2 | :415 |
| `mediation` 5 | 5 | 3 | 2 | :429 |
| `mediation` 7 | 7 | 0 | **7** | :471 |
| `restart` 2 | 7 | 4 | 3 | :404 |
| `restart` 5 | 12 | **0** | **12** | :455 (whole leg) |
| `p6t6` messaging | 11 | 5 | 6 | :893 |
| **total (19 legs)** | **129** | **36** | **93** | |

**72 % of the assertions written inside the 19 exempted legs never execute**, and the exemption cannot see
the difference between "no one changed that law" and "that law was broken while nobody was looking".

## 6. Two findings the census cannot see at all

### 6.1 Five *green* legs in the same file pass on a YAML syntax error

The gate counts only red identities, so these are invisible to `NEW 0`. `t1-capability-schema.test.ts`
contains five **green** negative legs — `4`, `4b`, `5`, `6a`, `6b` (:194, :204, :217, :230, :241) — whose
purpose is "a malformed capability block is rejected". Measured with `scratch/probe-t1-yaml.mjs`, which runs
each leg's fixture through the *real* `yaml` parser this repo depends on:

```
1  (RED)  legacy fixture     YAML OK  -> reaches the version fence: schemaVersion=1 (supported [3]) -> capabilities key present: false
2  (RED)  leader full caps   YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
3  (RED)  two members        YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 8, column 12:
4  (GREEN) malformed allow   YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 14, column 22:
4b (GREEN) non-string item   YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
5  (GREEN) deny with items   YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
6a (GREEN) unknown field     YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
6b (GREEN) unknown top field YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
7  (RED)  hash: caps A       YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
10 (RED)  legacy static      YAML OK  -> reaches the version fence: schemaVersion=1 (supported [3]) -> capabilities key present: false
11 (RED)  selective map      YAML REFUSED before any schema check: Unexpected block-seq-ind on same line with key at line 11, column 22:
11b(RED)  deny map           YAML OK  -> reaches the version fence: schemaVersion=1 (supported [3]) -> capabilities key present: true
```

`expect(() => parseBlueprint(src)).toThrow()` is satisfied by the fixture builder's own syntax error at
`decodeYamlFrontmatter` (`parse.ts:127`), **before** `validateBlueprintDocument` (`validate.ts:1196`) ever
runs. So the five green negatives prove only that the test's own emitter is broken. Consequence: the
closed-vocabulary rejection of a malformed `teamTools` / `skills` / `mcp` / unknown-field capability block —
the single most permission-governance-shaped rule in `packages/domain` — has **no working assertion
anywhere**: `validateAllowDenyEntry` is referenced by no test file, and `a1-permission-policy.test.ts`
covers only the `permissions` sub-policy. Recorded here as an `INSTRUMENT-DEFECT` finding on *green* legs;
no fix attempted (evidence-only lane).

### 6.2 Thirty-two legs are hidden behind the three collection errors, and one of them is load-bearing for the plan

`it.skip` / `it.todo` / `it.each` count is **0** in all three files, so the hidden set is exactly the file's
`it()` declarations: **16 + 4 + 12 = 32 legs that exist in source and are not in the 6288 registered
total**. The real leg universe is **6320**.

* **Would all be red:** the 16 `p8s3b` legs — the throw is the *first* world build (`:629`), which every leg
  depends on. Red, but not reportable as an identity: the suite reports one `FILE` entry.
* **Would be red:** `B2-3` (restart-resume) and `GLUE-11` + `GLUE-12` — their data is captured after the
  throw (`t12a-b2:88`; `t12a-glue:206`, and world D is built after world C).
* **Collateral greens:** `B2-1/2/4` and `GLUE-1…10` capture their data before the throw, so they would
  likely pass. That is the number that matters: **a deterministic collection error is silently deleting 32
  legs from the registry, of which ≈19 are red and ≈13 are green legs the census is not counting.** A
  genuine regression inside any of the 13 cannot produce a new identity today.
* **And it is not merely coverage debt:** `alpha4-implementation-plan.md` §7.2 **line 791** instructs a
  lane to *"Reuse the existing zero-creates mechanism: `createScriptedAgentsDouble`"* — at
  `packages/runtime/test/p8s3b-result-effects.test.ts:293`, i.e. inside a file that does not collect. The
  plan's prescribed reuse mechanism for another lane lives in an exempted file. The file itself already
  documents a `RE-RUN DUTY` at :420-431: *"whoever unblocks that seam re-runs this file and re-verifies this
  document end to end."*

## 7. Smallest honest next step for each `MUST-NOT-STAY-EXEMPT` row

All 13 are test-only; each is one lane-sized task; none requires a product change.

| rows | lane scope (one sentence) |
| --- | --- |
| 2, 4 (`t1` 2, `t1` 7) | Repair `toYamlFrontmatter` (or hand-write v3 YAML the way `a1-permission-policy.test.ts` already does, from `packages/domain/blueprint/testdata/fixtures.ts`) so a v3 document with **non-empty** `teamTools`/`builtinToolDeny`/`skills`/`mcp` parses, then re-assert the four fields and the four `contentHash` deltas. |
| row 7 (`t1` 10) | Re-ride the same fixture on a v3 document with capabilities absent and re-assert the `legacy` resolution, so the selective/legacy fork has one live leg. |
| row 10 (`t2` projection) | Re-pin the `hashable.leader` literal to the shipped key set, with a comment naming `toHashableTemplate`'s unconditional `capabilities: … ?? null`, so the canonicalization that feeds `contentHash` is asserted rather than assumed. |
| row 11 (`D3-4`) | Retarget the text assertion to the surviving typed code `capability-template-unresolved` and let line :452 (`no identity block installed`) actually execute — this is the leg `7-6-closure/SCENARIOS.md:360` already discloses as debt, not coverage. |
| rows 13, 14, 16 (`mediation` 3, 4, 7) | Repoint the mediation captures from `port.inputsFor(leader.childSessionId)` to the root session and re-assert per-sender mediation, latest-generation revocation, and the exact `[team-relay:mediated via leader] from=… intended-for=…` envelope text. |
| row 17 (`restart` 2) | Re-pin restart recovery of a pending **mediated** intent onto the root session, including the mediated envelope text — no green leg reconstructs a mediated delivery today. |
| row 18 (`restart` 5) | Retarget `setFailSession` (and `setFailures`) to the sessions recovery actually writes now, re-fire the R5 injection, and re-assert abort-with-typed-error / earlier confirmations durable / retry-recovers-only-the-remainder. Today 0 of 12 assertions run. |
| row 20 (`p8s3b`) | Add `exists` to the file's own `sessionPersistence` double, honour the file's declared `RE-RUN DUTY`, re-verify its §7.4 v3 witness (currently parse-proven only), and name an owner — this also unblocks the mechanism plan §7.2:791 tells another lane to reuse. |
| row 21 (`t12a-b2`) | Carry `templateId` in the restart fixture row (or pass the resume hint) so the fail-closed template guard accepts the resumed handle, then re-verify all four child-identity legs. |
| row 22 (`t12a-glue`) | Express "no effective persona" with a legal v3 document whose leader declares no persona — or invert the leg to assert the new strict frontmatter refusal — so world C, world D and the other 11 legs collect. |

**Suggested registration wording for the 9 `REGISTERED-DEBT` rows** (each is one relabel or one literal, with
its green duplicate named so the exemption is provably harmless):

| row | green pin that keeps the law alive today |
| --- | --- |
| 1 (`t1` 1) | `a1-permission-policy.test.ts:186` (a no-capabilities document parses; no static template policy) + `blueprint-v1-frozen-resume.test.ts` (v1 bytes refuse with a typed code) |
| 3 (`t1` 3) | `bp1-dual-team-gate.test.ts:471` *("the A member gets ONLY A: persona + the A teamTools allowlist + the A builtinToolDeny + a permission listener")* and `:485` *("A-only-A / B-only-B: the two members share the template id but never the other team tools or the other deny")* |
| 5, 6 (`t1` 8, 9) | `model-activation-step8.test.ts:162`, `a2c3-inspect-operation-permission.test.ts:461`, `a6a-production-wiring.test.ts` FACT 3a, `p8s4b-mcp-facet.test.ts:428` (`staticCapabilitiesOf` over real v3 sources) |
| 8, 9 (`t1` 11, 11b) | the same file's own green legs `11c/11d/11e` (:390, :402, :422) call the mapper directly, with no YAML in the path |
| 12 (`mediation` 1) | `p6t3-send-delivery.test.ts:199,571` (+ coordination fields `:498,506,523`) and `f3c-messaging-sibling.test.ts:404,437-448` |
| 15 (`mediation` 5) | `p6t3-send-delivery.test.ts:661-666` *"the muted member sends: facade ENVELOPE_OUT_OF_BOUNDS (authority beats mediation), zero writes"* |
| 19 (`p6t6`) | `p6t3-send-delivery.test.ts:539-548,586-595,614-623,694-703` (delivery addressing + `[team-relay]` attribution text) |

## 8. Does today's "zero new failures" understate the risk, and by how much?

**Yes — materially, and almost entirely on the permission-governance and storage-integrity planes.** The
rule is not dishonest, and the census confirms its bookkeeping: five captures, two of them under parallel
load, produced byte-identical identity sets with `NEW 0 FIXED 0` against the published baseline, no red
drifted into a collection error, and the one family the baseline flags as load-sensitive (`p6t1-parallel`)
is reported here as **green at a measured 0/13 runs** rather than as "the usual flake". What the rule
understates is *protection*. All 22 exempted identities sit on this stage's planes —
`permission-governance` 16, `storage-integrity` 3, `concurrency/persistence` 3, `unrelated-historical` **0**
— and **13 of them have no green leg standing in for them**. Concretely, at this base the gate would still
report `NEW 0` if someone: stopped folding `teamTools`/`skills`/`mcp`/`builtinToolDeny` into the blueprint
`contentHash` (row 4, 10 dead assertions); changed the leader projection that the durable identity is
computed from (row 10); let a foreign-root setup install an identity block (row 11, the only check for it is
dead); dropped or rewrote the `intended-for` attribution on a mediated relay — the exact text
`[team-relay:mediated via leader]` is asserted in **no green file** (rows 13, 14, 16); stopped reconstructing
a pending **mediated** delivery on restart (row 17); or broke the partial-durability discipline of an
aborted recovery, where the fault injection is now a silent no-op and **0 of 12 assertions run** (row 18).
Beyond the 19 titled reds, three deterministic collection errors hide **32 legs** (true universe 6320, not
6288) of which ≈19 would be red and ≈13 green legs the registry never counts — including the
`createScriptedAgentsDouble` mechanism plan §7.2 line 791 tells another lane to reuse — and, invisible to any
red-identity diff, **five green legs pass on their own fixture's YAML syntax error**, so the closed-vocabulary
rejection of a malformed capability block currently has no working assertion anywhere in the nine roots.
Net: 93 of the 129 assertions inside the exempted legs are dead (72 %), the exemption covers zero unrelated
historical debt, and 13 rows need only a test-only re-pin. The honest fix is not to relax the gate but to
stop letting `baseline-exempt` double as `not-this-stage's-problem`: retire the 13 exemptions by lane, keep
the 9 green-duplicated ones as named debt, and record §6.1 and §6.2 as findings the identity-diff cannot
express.

## 9. Scope, honesty and evidence index

**Evidence-only.** No source, test, manifest, config, or merge-gate file was modified. After every capture the
worktree was `porcelain dirty=1` with only this evidence directory untracked;
`check-artifacts-committed` reported `compared=1508 … OK`. `pnpm run lint` is red at base and is out of scope
for this lane. Nothing was pushed. No red observed in this document was caused by this lane.

```
dev/agent-workflow/evidence/a4-pr7/baseline-classes/
  BASELINE-CLASSES.md              this document
  raw/full-{1,2}.json              nine-root census captures (vitest --reporter=json)
  raw/load-{1,2,3}.json            census under parallel load (load discipline check)
  raw/solo-reds.json               the 6 red files run solo (19 identities, 1.30 s)
  raw/collection-errors.json       the 3 collection errors run solo (1.12 s)
  raw/p6t1-solo-{1..8}.json         the 8 solo p6t1 resamples
  scratch/census.sh                nine-root-by-name capture wrapper
  scratch/solo-reds.sh             solo-red capture
  scratch/collection-errors.sh     solo collection-error capture
  scratch/p6t1-resample.sh         the 8 solo p6t1 runs
  scratch/dead-tail.mjs            dead-assertion-tail instrument (§5)   usage: node scratch/dead-tail.mjs <vitest-json>
  scratch/probe-t1-yaml.mjs        fixture-vs-real-YAML probe (§6.1)
  scratch/dump-failures.mjs        per-identity failure dump
  scratch/*.ids.txt                identity sets, one per capture (all 22-id identical)
  scratch/p6t1-solo-runs.tsv       the 0/13 rate table
  scratch/failure-lines.txt        261 lines: per-root shape + every failure head
  transcripts/*.txt                raw transcripts incl. pnpm setup
```

Reproduce:

```bash
cd .worktrees/a4-baseline-classes
export CI=true XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
rm -rf packages/testkit/test/.tmp-fault           # stale fault state inflates counts
bash dev/agent-workflow/evidence/a4-pr7/baseline-classes/scratch/census.sh rerun 1   # <label> <n-captures>
node scripts/fail-set.mjs diff \
  dev/agent-workflow/evidence/a4-pr7/7-6-closure/scratch/baseline-2162f6a7.ids.txt \
  dev/agent-workflow/evidence/a4-pr7/baseline-classes/scratch/rerun-1.ids.txt      # expect: NEW 0 FIXED 0
```

One capture at a time; compare identities, never counts; a red that becomes a collection error, or a leg that
disappears from the registry, is a finding — not an improvement.


---

## Dated errata and outcomes — 2026-10-08 (round 42, coordinator)

Three corrections to this document, all of them supplied by lanes rather than by me, and one of them about my own
artifact. They are appended rather than edited in place because a classification that silently rewrites itself is not
a classification.

1. **§6.1 said five green legs passed on a YAML syntax error. Measured per leg, it is three** (`4` at `:201`, `4b` at
   `:211`, `6b` at `:250`). Legs `5` and `6a` emit only `[]`, so the broken serializer branch never touched them: they
   reached the validator, got a **real** refusal, and asserted bare `toThrow()` — no identity. **Two different ways of
   learning nothing from the same fixture, and the distinction matters for the repair**: the first needs the fixture
   fixed, the second needs the assertion fixed. Instrumented proof: 9 decode refusals at base, 0 at tip.
2. **Row 22 prescribed an UNWRITABLE repair.** It told the lane to build a legal v3 document whose leader declares no
   persona — there is no such document, `persona` is required (`domain/blueprint/src/validate.ts:350`). The lawful
   carrier is `presetSubstrate.personaKind: 'absent'` (precedent `t12a-m2-persona.test.ts:187`). **A prescription that
   cannot be executed is a defect in the prescription**, and the lane said so instead of silently inventing a
   substitute. Rows 20 and 21 were right and are discharged.
3. **The ledger moved: exemptions 22 → 10, `MUST-NOT-STAY-EXEMPT` 13 → 1.** The one survivor is row 11 (`D3-4`), whose
   only check never executes (`:452`) — the same leg my §7.6 traceability map had disclosed too generously, corrected
   in PR #201. The 9 `REGISTERED-DEBT` rows are unchanged and each still names its green pin.
4. **0 reds on the un-masked 32 was proven, not celebrated** (six transient product mutations, each reverted and
   porcelain-verified). That is also how the new gap was found: mutation A red-lines `G2` while `E4` stays green, and
   mutation E red-lines `E3/E4/E6/E7` while `G2` stays green ⇒ **no leg covers the mapping→carrier composition**
   (backlog 17). A visibility lane that had reported only "0 new reds" would have hidden it.
