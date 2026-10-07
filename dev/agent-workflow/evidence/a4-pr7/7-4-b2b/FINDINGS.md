# §7.4 lane B-runtime-semantics-B (second half) — FINDINGS

* Roster: **35 files** — 34 `packages/runtime/test/*.test.ts` + `packages/runtime/test/t12a-live-bridge.mjs`.
* Base: `a4ef2a6b` (`origin/master` at dispatch; `origin/master` has since moved to `62488ce5`, which touches none of these 35 paths — see §9). Branch: `feat/a4-74-b2b-fixtures`.
* Code commit: **`9c3da3ad`** (the 35 files of §2). This evidence directory is committed on top of it.
* Transcripts: `transcripts/` in this directory; every number quoted here is in one of them.

## 0. Result in six numbers

| | |
| --- | --- |
| roster files changed | **34 of 35** (`t12a-live-bridge.mjs` STOPped, §6) |
| fence sites cleared in this lane | **42 of my 43** |
| dirty class | `(110 files, 213 sites)` → **`(76, 171)`** |
| refused / adjudicated / prose / advisory / unknown | **`(52,115)` / `(16,24)` / `(5,5)` / `(9,14)` / `(0,0)` — all unchanged** |
| tests in the 34 touched specs | **370 passed**, identical per-file counts to the base run |
| gates | wrapper **58/58**, p4t6 **10/10**, typecheck **0 errors**, eslint **no new problem**, lint-identities **new 0 / resolved 0**, fence **byte-identical across two runs** |

## 1. What the lane did

Every one of the 43 sites was read for what its digit was actually claiming, then treated by that reading rather than by a rule about digits:

* **27 files (31 sites)** carried a plain fixture document whose version was **decoration** — the file asserts boot/projection/remote/handoff/capability behaviour that a v1, v2 or v3 document all serve. Those documents moved to **v3 with both authority documents declared** (`permissionMutationEnvelope: {rules: []}`, `teamHardEnvelope: {rules: []}`), and the migration was *measured*, not assumed: the same mutation run as an experiment left all 27 files fully green (`transcripts/06-sweep-v1-to-v3.txt`).
* **6 files (7 sites)** are documents in the closed **§E.2 structured-requirement grammar**, and there the digit is **the subject**: production reads `teamRequirements` and per-template `requirements` only behind `blueprint.schemaVersion === 2`. Promoting them does not migrate the claim, it **deletes** it — measured red (§4.3). Those digits stayed 2 and moved onto a `TeamBlueprint['schemaVersion']`-typed named constant with the YAML bytes unchanged, so §7.3's narrowing turns each one into a compile error that names its own file (the mechanism C-domain introduced and the coordinator ratified).
* **1 file (1 site)** was **probe-green**: the "document" is a row-config placeholder nothing parses. The digit asserted nothing any reader consults, so it was **dropped**, not migrated (`pbf-default-artifact-urls.test.ts`, §4.1).
* **1 file (1 site)** — `t12a-live-bridge.mjs` — is **STOPped**: the wrapper pins that exact path as its own `packages/*/test` by-path positive control, so cleaning it is a coupled wrapper edit this lane does not own (§6).
* **1 file** is mixed: `requirement-d1-d3-decision-scoping.test.ts` — four flat-requirement fixtures promoted, its §E.2 document carried, and its test-side mirror of production's `=== 2` gate annotated (§5).

No file in this lane was inverted to a refusal, nothing was padded to move a fence class, and `packages/domain/blueprint/**` (`fixtures.ts`, `schema.ts`, `types.ts`), production version comparisons, and every foreign version axis are untouched: `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` is still `[1, 2, 3]` (`grep`-checked, `git diff` empty for that path), and the refused/adjudicated class lines are unchanged in count and membership.

## 2. Per-file table

`claim` = what the digit was claiming in that file. `disposition`: **PROMOTE** (self-owned v3 fixture) / **CARRY** (digit is the subject, byte-identical YAML) / **DROP** (probe-green placeholder) / **STOP**.

| file | claim of the digit | disposition |
| --- | --- | --- |
| p8s5a-production-assembly | "a closed Blueprint the shipped production host assembles"; subject = T1 assembly of a 3-member team | PROMOTE ×1 |
| p8s6-pagination | same decoration; subject = C6 pagination over projections | PROMOTE ×1 |
| p8s6-principal | decoration; subject = C3 principal boundary | PROMOTE ×1 |
| p8s6-projection | decoration; subject = C2 projection surface. Its `schemaVersion` assertions are the **member-record** axis — untouched | PROMOTE ×1 |
| p8s6-push-reconnect | decoration; subject = C5 push/reconnect | PROMOTE ×1 |
| p8s6-remote-commands | decoration; subject = C4 remote dispatch. Its `L389` v2 site is the governance-override axis (REFUSED) — untouched | PROMOTE ×1 |
| p8s7r2-effective-config | the `blueprintSource()` builder behind **nine** documents; subject = the R2-2 resolved effective-config view. R22.5b's "projection stamps 2" is the projection family axis — untouched | PROMOTE ×1 (nine docs inherit) |
| p8s7r2-model-state | same builder; subject = R2-3 model-state view | PROMOTE ×1 |
| p8s7r2-policy-state-durable | decoration; subject = R2-1 durable policy-state facts (their own v1 row track untouched) | PROMOTE ×1 |
| p8s7r4-fork-describe | decoration; subject = BQ-18 read-only fork/describe. Five session-binding v1 sites (REFUSED) untouched | PROMOTE ×1 |
| p8s7r4-handoff-wiring | decoration; subject = A28 three handoff kinds | PROMOTE ×1 |
| pbf-default-artifact-urls | **nothing** — the string is a `validateTeamPluginConfig` placeholder, never parsed (probe-green) | DROP ×1 |
| persona-kind-provider-preflight | **the §E.2 grammar itself**: persona-kind requirement at TEAM scope vs MEMBER-TEMPLATE scope | CARRY ×2 |
| prf-inspect-same-source | decoration; subject = PR-F inspect-same-source static permission reads. Its v2 governance-ledger site (REFUSED) untouched | PROMOTE ×1 |
| rc2a1-fs-containment | decoration; subject = RC2-A1 production fs containment (static allow/deny, T6 typed setup failure — no mutation lane) | PROMOTE ×1 |
| requirement-d1-d3-decision-scoping | four flat-requirement fixtures: decoration (D1/D3 decision scoping). `V2_SOURCE`: **the §E.2 grammar is the subject** | PROMOTE ×4 + CARRY ×1 |
| requirement-probe-blueprint-scoping | decoration; subject = PF-1 probe-vs-preflight two-worlds identity over **flat** requirements (read at every version) | PROMOTE ×2 |
| rmr-create-or-open-boot | decoration; subject = root-cause-B create-or-open boot | PROMOTE ×1 |
| rmr-remote-mount-race | decoration; subject = the bounded wait for the `connection` service | PROMOTE ×1 |
| startup-all-templates-real-authority | **the §E.2 grammar**: all-template preflight with real authority | CARRY ×1 |
| startup-consent-production | **the §E.2 grammar**: consent-required refusal whose ack binds a contentHash | CARRY ×1 |
| startup-preflight-production-create | **the §E.2 grammar**: boot-create refuses typed (fatal / fixOrDisable / consentRequired) | CARRY ×1 |
| startup-template-disable-production | **the §E.2 grammar**: a disabled template scope blocks the boot create | CARRY ×1 |
| t12a-h1-nullable-mcp | decoration; subject = zero-MCP supply side vs the policy side saying "mount" | PROMOTE ×1 |
| t12b1-real-create | decoration; subject = the normal production create | PROMOTE ×1 |
| t12b2-resume-separation | decoration; subject = create/resume separation | PROMOTE ×1 |
| t12b6-handoff-agent-start | decoration; subject = the handoff must start the agent | PROMOTE ×1 |
| t12m4-remote-mount | decoration; subject = the production Remote mount (the Remote wire-contract v1/v6 sites untouched) | PROMOTE ×1 |
| t14h-probe-merge | decoration; subject = the host-completed pre-creation probe merge | PROMOTE ×1 |
| t4a-capability-wiring | decoration; subject = production per-template capability wiring (its own document; the bridge default is separate, §6). Prose corrected: the four sub-fields are required by the `capabilities` grammar at **every** version | PROMOTE ×1 |
| tcm-m2-workspace-attach | decoration; subject = M2 host-side workspace attach | PROMOTE ×1 |
| team-compatibility-scope | decoration (measured): subject = H2 per-blueprint compatibility scope + fingerprints across A/B/B2. The dispatch's cross-version caution did not bite — the three documents differ by **requirement set and revision**, not by version; the promotion stayed 13/13 green | PROMOTE ×3 |
| team-session-startup-fence | decoration; subject = H1/H2 host startup race | PROMOTE ×1 |
| template-disable-no-requirements-gate | **the §E.2 grammar**: finding I — the durable disable must block regardless of the (empty) requirement set | CARRY ×1 |
| t12a-live-bridge.mjs | the harness's **default bound Blueprint** — live: consumers assert on its personas and its member set | **STOP** (§6) |

Every promoted file also got a short comment stating *why* both documents are `rules: []` (§3), and the three places whose prose had become false after promotion ("v1 bridge", "the closed-v1 schema requires…") were corrected — prose that is still **true** (the many `v1`/`v2` mentions on foreign axes, and the §E.2 files' own "schema v2" descriptions) was deliberately left alone.

## 3. Why `rules: []` on both documents is the honest zero here, not padding

Per b1's ceiling law (§7.4-b1 FINDINGS §2), applied to this lane's worlds and re-checked here:

* `runtime/src/plugin/host.ts:2703` is the only production producer of `permissionAuthorityCeiling`; `root.ts:2899` threads it only when injected, and `governance/service.ts:1215-1220` opens the v3 ceiling gate only when `ceilingContext !== undefined`. All 34 touched specs boot through `hostEntry.apply`, so for them **the gate is live** — a declared hard document is therefore load-bearing in a way it is not in a root-direct world.
* It is inert *for these fixtures* for two measured reasons: (a) **no file in this roster reaches the permission-mutation lane** — every `permission` occurrence in the 35 files is a static read, a document field, or a projection/projection-family assertion (enumerated per file; the mutation lane lives in `governance/service.ts` behind `lane.authorityCeiling`), and (b) with a leader carrier of `{rules: []}` there is no claim for `compareEnvelopes` (`governance-warning/service.ts:181-227`) to compare: its point set is empty, so the verdict is CONSISTENT and, per its own comment, a passing check writes nothing durable. A hard envelope with no rules also **narrows nothing** — `service.ts:209-210` reads a hard `none` as allow-identity.
* So `{rules: []}` is exactly what these documents always meant (an absent pre-v3 carrier already reads as `{rules: []}` — `PERMISSION_MUTATION_ENVELOPE_ABSENT_READ_AS`), and it is enforced now instead of merely unread. **No fixture needed a hard mirror**, because none of them asks for expansion authority; the mirror b1 needed for its permission-rise witnesses does not arise in this lane.
* One v3 side effect was checked and is empty: `host.ts:887` moves governance-warning documents from `stage: 'pre-v3'` to the v3 comparison. The only consumer of `buildGovernanceWarningDocs` in the tree is `a4p6-governance-warning-host-adapter.test.ts`, which is not in this roster; no touched file asserts on governance warnings (grep over all 35).

## 4. The measurements behind those calls

### 4.1 Probe pass (is the digit read by anything?)
Each site's digit was set to `9` (a version this build does not run), the file run, and the file restored **from the commit** (`git show HEAD:<path>`) with a sha256 check — never from a working copy. Result: **33 of 34 spec files probe-RED** (live: a retained assertion parses the document; typically `TeamContractError: unsupported blueprint schema version 9` or the bootstrap `TeamPluginError: the bootstrap Blueprint declares a schema version this build does not run`). **1 probe-GREEN: `pbf-default-artifact-urls.test.ts`** (`Tests 9 passed (9)` with a version nobody runs) — the string exists only to satisfy a non-empty-string check. Receipts: `05-probe-receipt.txt`.

### 4.2 v1 → v3 sweep (the promotion is a migration, not a wrecking ball)
All 27 plain-fixture files, one at a time, document promoted to 3 with both documents declared `rules: []`: **27/27 green, identical test counts** (`06-sweep-v1-to-v3.txt`). This is the pre-edit experiment; the committed edits are the same mutation plus comments, re-verified per file in §8.

### 4.3 v2 → v3 sweep (where a promotion deletes the claim)
The six §E.2 files went **red** (`06b-sweep-v2-to-v3.txt`), with the failures naming the requirement legs, e.g.:

* `startup-preflight-production-create`: **6/6 red** — "the boot create rejects with the typed creation-preflight refusal (outcome fatal)", "…the blocked template scope + the down requirement", "…the consent-required requirement id", plus their zero-durable-effect pairs.
* `template-disable-no-requirements-gate`: "premise: the fixture worker template produces NO requirement inputs / verdicts" red.
* `requirement-d1-d3-decision-scoping`: exactly the four §E.2 legs red (C7, C8, D3c, E6); the 38 flat-requirement legs stayed green.
* `startup-consent-production`, `startup-all-templates-real-authority`, `startup-template-disable-production`: module-scope assertion `expected null to be an instance of TeamRuntimeError` — the world setup asserts a refusal that stops happening.

Cause, read at source: `requirements/scope-requirements.ts:108`, `requirements/creation-preflight.ts:217`, `admission/requirement-gate.ts:460`, `compatibility/blueprint.ts:81`, `activation/provider.ts:821` all evaluate the structured grammar **only when the document says 2**. A v3 document with `teamRequirements` is legal YAML whose structured scopes are never evaluated.

### 4.4 `t12a-live-bridge.mjs`, measured anyway (§6)
`07a`: with the bridge's default document stamped `9`, **three consumers go red** (`t12a-m2-persona`, `t12a-h1-nullable-mcp`, `t4a-capability-wiring`) ⇒ live document, not decoration. `07b`: with it promoted to v3 + `rules: []` both, **5/5 measurable consumers green (58 tests)**; the sixth file in that set (`t12a-b2-child-identity`) is red at base independently of anything here (§9).

### 4.5 Byte-identity proof for the seven carried digits
`15-byte-identity-proof.txt`: for each carried file the final text was normalized by deleting this lane's comments, the added type import, the constant declaration, and by swapping the equivalent expression back — the residual diff against the commit bytes is **empty** for five files, and for the two mixed cases the *only* non-comment changes are the import, the typed constant, and `'schemaVersion: 2'` → `` `schemaVersion: ${V2_DOCUMENT_VERSION}` ``. Types erase at runtime, so the emitted token is `2`; nothing else in the emitted YAML moved.

## 5. Handed to §7.3 (decisions this lane refused to make)

1. **The §E.2 grammar's version.** After the flip no document may say 2, so the five `=== 2` comparisons above become dead or non-compiling, and the six carried fixture families (7 sites) plus their production legs lose their home. Either those comparisons widen to v3 (the field names *are* in the v3 closed set — v3 is "the v2 document plus one key") or the structured requirement scopes retire and these files become delete-or-invert per plan §7.3. §4.3 is the measurement that makes this a real choice rather than a rename.
2. **`requirement-d1-d3-decision-scoping.test.ts`** — the unlisted §7.3 casualty my dispatch flagged. Its `preflight()` helper passes `templateEnvironmentFactsRead` only when `bp.schemaVersion === 2`, i.e. the test mirrors production's gate. It is now annotated in place: the flip must decide the same question as (1), and the annotation says it is not fixture decoration to edit.
3. **`team-compatibility-scope` / `requirement-probe-blueprint-scoping`.** The dispatch preferred keeping a digit as the subject for these; measurement said otherwise and I promoted them: both speak through the **flat** `requirements` list, which `compatibility/blueprint.ts` reads at every version, and the compatibility differences in both files come from requirement sets/revisions, not from versions (the promoted set is green at identical counts, including the fingerprint-difference legs). If the coordinator wants a version digit kept as a *subject* there, it has to be introduced deliberately — today there is no such claim to preserve, and inventing one would be a new test, not a migration.
4. **Nothing in this lane is a retirement/refusal test**, so nothing was inverted; all such files belong to other lanes.

## 6. STOP: `packages/runtime/test/t12a-live-bridge.mjs` (both readings)

The wrapper carries this exact path as its positive control that the `packages/*/test` scope reaches the dirty set:

```
// a4p7-blueprint-version-clean.test.ts:474-481
// t12a-live-bridge.mjs:1347 is the unambiguous member (a .mjs test-tree emitter, dirty in any classification).
expect(dirtyPaths).toContain('packages/runtime/test/t12a-live-bridge.mjs')
```

Cleaning the file therefore requires **choosing a new positive control** — a semantic edit to the wrapper beyond "delete my own DEFERRALS rows", which this lane does not own. Its DEFERRALS row stays, with its justification rewritten to name the blocker (path key unchanged).

* **Reading A — the pin moves (then this file is a normal migration).** In today's dirty set `t12a-live-bridge.mjs` is the **only** `.mjs` emitter under `packages/*/test`; every other dirty `.mjs` lives under `*/harness/`, `scripts/`, or `tests/kits/`, so a retarget is not a one-line substitution inside the same class — it needs a new in-scope emitter or a scope-class decision. §4.4 already hands the owner the facts: the default document is live, and a v3 + `rules: []` promotion keeps all five measurable consumers green, so the work would be small once the pin moves.
* **Reading B — the pin stays.** Then this file is *by design* a permanently-dirty positive control, and its DEFERRALS row is the record; no lane should be scored on it. Note the trap for whoever owns it: this file is imported by **38** specs, so its default document is the most-shared fixture in the runtime tree — a migration there should be its own PR with the consumer list run, not a ride-along.

## 7. DEFERRALS bookkeeping

34 rows deleted (exactly the paths that left the dirty set — the wrapper's early-delete leg names them), 1 row's **justification text** rewritten with its **path key unchanged**, no other line of the wrapper touched: `21-wrapper-deferrals-diff.txt` (35 deleted row lines, 1 added). No reflow, no reorder.

The ratchet was reproduced rather than assumed: re-adding a single deleted row makes exactly one leg fail — `× every deferred path is still dirty (a migrated path must leave the list)` — and removing it returns 58/58 (`12-wrapper-ratchet-then-green.txt`).

`p4t6` needed **no** new counted path: this lane created no file under a scanned root (its `SCANNED_PATHS_*` lists enumerate `packages/**`; zero `dev/` entries), and every roster path is an *edit* to an already-counted file. The derived total is untouched and the suite is 10/10 (`13-p4t6.txt`).

## 8. Gates — all run inside the lane worktree

| gate | result | transcript |
| --- | --- | --- |
| 34 touched specs, each run individually | **34 files / 370 tests passed**, rc=0 each; per-file counts identical to the base run | `10-per-spec-final.txt`, base `11-base-spec-run.txt` |
| wrapper `a4p7-blueprint-version-clean` | **58 passed (58)** | `12-wrapper-ratchet-then-green.txt` |
| `p4t6-session-event-scan` | **10 passed (10)** | `13-p4t6.txt` |
| fence, run twice | **byte-identical** (both `sha256 009a848c2504db57…`, exit 1 = verdict `dirty-or-unknown`, which is expected while other lanes' paths remain) | `02-`, `03-` |
| fence class lines | dirty `(110,213)`→**(76,171)**; unknown `(0,0)`; advisory `(9,14)`; **refused `(52,115)`**; prose `(5,5)`; **adjudicated `(16,24)`** | `01-`, `08-` |
| fence by-path diff | 34 paths left, **all of them roster paths**; **0 added**; 42 sites removed, **0 added anywhere**; only roster path still dirty = the STOPped `.mjs` | `08-fence-by-path-diff.txt`, `09-` |
| `pnpm -r run typecheck` | **exit 0, 0 `error TS`** (also proves the typed carriers compile) | `20-typecheck.txt` |
| `npx eslint` on the 35 touched files | **33 problems (11 errors, 22 warnings)** — the rule+message multiset is **identical to the base run on the same files**, i.e. no new problem from this lane; all 33 are pre-existing (`no-explicit-any`, unused `eslint-disable` directives, two unused vars) | `17-`, `18-` |
| `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `160 identity lines, 76 distinct; baseline … 76 distinct; **new 0, resolved 0**` | `19-` |
| `node --check packages/runtime/test/t12a-live-bridge.mjs` | exit 0 (file unchanged) | `14-node-check.txt` |

## 9. Disclosed residuals and limits

* **Base-control for eslint** was taken in a separate pristine worktree at `a4ef2a6b` (`.worktrees/a4-74-b2b-base`) because my worktree already carries the edits; both trees were then deleted/left as noted in §10.
* **`t12a-b2-child-identity.test.ts` is red at base** (`Tests no tests`; `the "connection" public service is malformed: expected connection.rpc.handle to be a function`) in this environment, reproduced in the pristine base worktree. It is **not** in this roster and none of my edits touch it; it appears in §4.4's consumer set only because the bridge imports it. Reported so nobody reads it as lane damage.
* **Measurement hazard worth the router log:** a crashed run leaves `packages/testkit/test/.tmp-fault/` behind, and the next run of a `scratchDir()` world then dies with `team_domain already exists` — a *false* red. Two of my early experiment reds (`p8s7r4-fork-describe`, `p8s7r4-handoff-wiring`) were that pollution, not semantics; after clearing the dir the same files were green. Every run in this lane clears the dir before executing.
* **Merge caution:** `origin/master` moved to `62488ce5` after my base. It touches **none** of my 35 roster paths (checked), but it deleted **38 other DEFERRALS rows** in the same map region, so my 34 deletions will conflict textually on merge. The merge owner should re-apply them **by path** and re-run fence + wrapper; the row set on master still contains all 35 of my paths, so no deletion of mine is stale.
* **Not verified here, by scope:** no root `pnpm test`, no other lane's suite, no boot of anything and no port use (31xx untouched); no rendered-string capture for the carried digits (the byte-identity argument is source-level, §4.5); whether the promoted fixtures would *also* be green if the two documents were omitted is deliberately not tested — v3 requires them, so the question is moot.
* Only `dev/agent-workflow/evidence/a4-pr7/7-4-b2b/` (this directory, excluded from the fence by `EXCLUDED_PREFIXES`) and the 35 files of §2 changed. No push.

## 10. Reproduction

```bash
cd .worktrees/a4-74-b2b
node scripts/verify-blueprint-version-clean.mjs        # classes; compare with transcripts/01
npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts   # 58/58
npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts        # 10/10
pnpm -r run typecheck
npx eslint $(git diff --name-only | tr '\n' ' ')       # compare multiset with transcripts/17
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
```
Experiment harnesses (probe, sweeps, bridge measurement, restore-with-hash-check) are in
`.tmp-faultscratch/{probe,probe.py,promote2.py,migrate.py,carrier.py,bridge-exp.py}` while the
worktree lives; their outputs are the `0x`–`1x` transcripts here.
