# U4 G1-F supplement — executor G1F-SUP-B: mechanism-group feasibility PoCs (public-seam route)

Gate: **G1-F round-1 verdict 补充内容**. Scope: **FEASIBILITY PoCs, not product delivery** —
each mechanism group gets a credible public-seam route demonstrated end-to-end on the
pinned test Host (HTU `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`,
0.2.0-rc.2), with positive controls producing real external effects and negative controls
proven by oracles INDEPENDENT of tool return values (filesystem state, server-side MCP
markers, process side effects, ledger rows), plus one sensitivity plant per PoC proving
each guard is load-bearing.

Mandatory inputs read before build (per brief): AGENTS.md; docs/ROUTER_RULES.md §0-first;
docs/TEST_METHODS.md; `dev/agent-workflow/evidence/u4-g1f-review-r1` verdict
`u4-g1-f-review-r1/REVIEW.md`; `u4-obligations-20261025/` (SUMMARY.md,
mechanism-groups.json, feasibility.json, expected-tool-obligations.json); the sealed H0
package `u4-h0-20261025/` (copied FROM, never modified); architecture memo
`origin/task/alpha5-reset-architecture-five-stage-20261025:docs/plans/memo/alpha5-reset-20261025/center-assembly-architecture.md`
§2 (CI-01..12), §4, §8 (ARC-A/B/C), §10.4; master code
`packages/runtime/src/plugin/live/{agent-bindings,team-tool-plane,pa-mount-registry,plane-effect-backends}.mjs`,
`packages/tools/a5p5-tools`; PR #360 WIP assets on `origin/feat/a5-m2-integration`
(governed-families/write.mjs, write-slice.ts) evaluated by source.

**CORE PATCH BUDGET spent: 0.** Every capability here rides public seams: the cordis
plugin row via the profile patch file (`profiles/web/cordis.patch.yml`), the
`tools/execute` waterfall prepend listener, `ctx.tools.register/get/schemas`, and
`ctx.jobs` (injected). No upstream source was touched; HTU porcelain empty + HEAD==pin
verified before AND after every Host start (steps.jsonl `post-check-htu` = ok).

---

## §guard-form — which guard form this package runs (brief allows either; state which)

**The sealed H0 self-dispatch form**: ONE prepend (`highest-priority`) `tools/execute`
listener; for a governed name it (1) observes `ctx.tools.get(name, exec.agent)` — the same
view the dispatch resolve uses, (2) identity-checks it against the **center-owned approved
table**, (3) on mismatch/not-visible returns a refusal **without calling `next()`** — the
built-in dispatch (and its late re-resolve, H0 TOCTOU finding at
`core/tools/src/index.ts:1578`) therefore NEVER runs, (4) on match **self-dispatches the
verified function object** (`approved.def.execute(args, exec)`) and returns `{ value }`
(→ `normalizeDispatchResult` :1865-1885 consumes `result.value` and revalidates against
the SAME definition's output schema). Executor A's next()-calling Host-equivalent form is
the admitted alternative; this package deliberately runs the H0 field-verified form and
the results below apply to THAT form.

Scope discipline (CI-03): governance applies only to **enrolled** agents (PoC analogue of
Team-member scoping); anything else passes straight to `next()` = native behavior.

## §findings-host-facts — two Host facts this round established (they shape every later plan)

1. **One agent carrier per web-profile instance.** A second `session/create` on the same
   instance yields a distinct `sessionId`, but tool executions from BOTH sessions carry the
   FIRST session's `agent` identity (E2 evidence: runs/g1fb-…T14-30-48Z/ledger.jsonl — the
   "second session" ctl rows carry `agentId: session-6747ee90…`, the first session's id).
   Consequence: an agent-scoped tool mount governs every session of that instance; the
   honest CI-03 "non-Team untouched" boundary in ONE instance is agent-scoped
   enrollment. This package demonstrates it as the **pre-enroll control** (A0: native
   `write` ran untouched with the center present but zero mounts — real native file
   effects, zero governed rows), and discloses that cross-INSTANCE non-Team untouched
   (= a Host where the center plugin is absent) remains a composition-level center
   obligation, trivially true since nothing mounts there.
2. **Cordis refuses non-injected context property access at READ time**
   (`ctx.jobs` without `inject: ['jobs']` THROWS "cannot get property \"jobs\" without
   inject" — E2 evidence, bridge refusal row). Plugin-side lazy lookups must sit behind
   the branch that needs them. `inject: ['tools','jobs']` (tool-jobs' own pattern) fixes it.

---

## Per-PoC design + cells

Run(s): **E2** = `runs/g1fb-2026-10-25T14-30-48Z` (Host start #1; fixture-bug run, kept
as evidence incl. the two §findings rows above). **E3** = `runs/g1fb-2026-10-25T14-34-41Z`
(Host start #2, combined suite AB; the evidence run). **E4** = offline re-evaluation of
E3 (no Host) → `runs/…T14-34-41Z/summary-reeval.json` (all cell verdicts below cite it;
inputs are the ORIGINAL run bytes: `ledger.jsonl`, `markers/`, `filesystem-evidence/`,
`wire/`). Cell tables: 32/33 pass. Evidence paths are relative to this directory;
"rows" = leg/phase fields in `runs/E3/ledger.jsonl`.

Shared plumbing (ONE of each, reused by all PoCs): ONE center ledger instance
(`g1fb-center-1#ledger-1`), ONE generic family-registration function
(`g1fb-registry.mjs:createGovernedFamilyRegistry.register`), ONE guard listener, ONE
mount-identity law = master `pa-mount-registry.mjs` **imported unmodified at runtime**.

### PoC-1 — FS-write / ARC-A minimal (write + edit through ONE generic registration function)

Design: family declarations are closed-data objects
(`familyId,version,name,description,parameters,outputSchema,policy,execute`); the generic
registry assembles the ToolDefinition (`output:{schema,render}` — Host requirement at
`tools.register` :1063), registers the policy into the center ledger, publishes a mount
identity through the master registry, and installs the execute wrapper (the ONE kernel
edge: `ledger.admit` → refuse = typed throw BEFORE any body effect / allow = run body).
Adding the second FS family (edit) = **new declaration file only**.

| cell | verdict | evidence |
| --- | --- | --- |
| enroll registers all 8 names generically | PASS | rows leg=enroll results×8 ok; summary-reeval `enroll8` |
| write allow → real file | PASS | `filesystem-evidence/work/w/ok.txt` (content G1F-OK→G1F-EDITED); marker `fs-write-p1a.written` |
| write deny → pre-body refusal, ZERO file | PASS | row refused-before-body (p1d, deny-lane), zero body-start; `work/out/bad.txt` ABSENT |
| edit executes (second FS mutation, same generic fn) | PASS | file edited to G1F-EDITED; marker `fs-edit-p1e.written` |
| same-name claim from foreign family → refused, owner kept | PASS | rows family-register refused name-collision (P1-DUPE-WRITE2 vs P1-B-WRITE); ctl dupe-attempt refused:*; status shows write owner unchanged |
| zero-diff law: adding family #2 touched no center file | PASS | every registration row carries the SAME `registrySelfSha` (distinct=1 across 10 registrations); static scan preflight `generic-center-files-carry-no-family-names` = OK; second family = new file `g1fb-family-edit.mjs` only |

Plant (sensitivity): `pathGuardEnabled=false` (world-config flag via ctl, never a
tool argument) → governed write to the forbidden subtree **executes** and
`work/out/plant.txt` exists (forbidden effect REAL) → flag healed.

### PoC-2 — shared lifecycle CA-02: read + grep + bash (+ job admits) on ONE ledger

Design: one `createCenterLedger` state machine (§5-lane minimal): allow→execute;
deny→refused (zero body); ask→deterministic `g1fb-req-NNN` pending → ctl approve →
issued → ONE-SHOT consume → execute; replay → refused; revoke-before-consume → refused.
Grant key = name + parameter fingerprint (tag excluded — the same CALL re-presented
replays on the SAME key, which is exactly what the replay/revoke cells test).

| cell | verdict | evidence |
| --- | --- | --- |
| read allow (marker first-8 = G1FDATA1) | PASS | `markers/read-p2a.first8` |
| read deny outside lane → pre-body refused | PASS | row refused-before-body p2d, zero body-start |
| grep ask → approve(`g1fb-req-001`) → consume → real `grep` process (`exit=0 matches=2`) | PASS | markers `grep-p2g2.count`; grant phases requested,approved,consumed |
| replay after consume → refused, body zero | PASS | grant replay-refused; p2g3 zero body-start |
| bash deny → ZERO process spawned (output file never exists) | PASS | `work/denydir/x.txt` ABSENT + zero body-start |
| bash ask → approve → consume → file `askok` | PASS | `work/askdir/y.txt` |
| bash ask → REVOKE between ask and execute → refused before body | PASS | grant revoked(g1fb-req-003) → revoked-refused; `work/askdir/z.txt` ABSENT |
| ONE ledger instance for ALL classes incl. job_* rows | PASS | every admit/grant row carries `ledger: g1fb-center-1#ledger-1`; distinct=1; names write,edit,read,grep,bash,job_list,job_output |
| CI-03 pre-enroll native control (see §findings-host-facts 1) | PASS | native files `work/w/native-write{,2}.txt` real; center empty at A0; ZERO governed rows before enroll |

Plant: `ledgerEnabled=false` → the DENY-lane bash **executes** (`work/denydir/p.txt`
exists — forbidden process DID spawn) → healed.

### PoC-3 — one named Bridge: Jobs (`createGovernedJobsBridge`)

Design: `g1fb-jobs-bridge.mjs` PART 1 is a **byte-identical sed-extract** of master
`plane-effect-backends.mjs` lines 1579-1850 (body sha256
`71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f`; preflight
re-extracts and asserts BOTH master bytes and plugin-copy containment every run —
`master-bridge-bytes-match-extraction` OK). PART 2 is the thin PoC mount: attribution map
(jobId→viewer), a gatewayRow (owner fence + placement-feed pin), a counting proxy over
`ctx.jobs` (the NON-REACH oracle), per-agent bridges with viewer scope. The governed
`job_list/job_output/job_kill` families are ordinary registrations — they pass through
the SAME guard + ledger admission as write/read/bash and then call the bridge. NO second
approval ledger exists anywhere inside the bridge.

| cell | verdict | evidence |
| --- | --- | --- |
| background bash birth: REAL child process, REAL output | PASS | job `bash-1`; `work/w/jobfile.txt`="JOBOUT-p3s\n"; marker `job-spawn-p3s.born` |
| bridge job_list shows own row | PASS | body-end text contains bash-1 |
| bridge job_output returns REAL ring bytes through the bridge | PASS | text contains "JOBOUT-p3s" + status line |
| owner fence: foreign viewer refused **and host svc.kill NEVER reached** | PASS | bridge row fence-refused(foreign-attribution); svc-calls rows show 0 kill calls for bash-1 (measured non-reach) |
| teardown ordering (CI-08): regen → OLD disposer refused-stale, NEW mount kept | PASS | rows disposed:gen1 → refused-stale; job_list works both before and after the stale call |
| no second ledger: grant rows ONLY ever on {grep,bash}; job traffic = plain admits | PASS | grant-names=[grep,bash]; 4 job admits on the ONE ledger; 19 bridge rows carry observe/attribution, zero approval state |
| plant CI-08: `identityLawEnabled=false` → naive disposer KILLS the current mount | PASS | rows PLANT-naive; afterwards governed body for job_list = ZERO (native tool took over — governance gone: the forbidden effect REAL); approved table without job_list |

### PoC-4b — MCP dynamic sources (late binding, admission, collision, drift)

Design: two stdio MCP servers (fixture `g1fb-mini-mcp-server.mjs`, adapted from the
sealed HTU root-binding harness mini-mcp — streamable-http→stdio, disclosed) mounted as
`@deepseek-ai/dsh-mcp-client` patch rows. **alpha is wake-file gated** so its tools bind
strictly AFTER session start; its `tools/call` handler writes SERVER-SIDE markers —
the zero-effect oracle is the ABSENCE of that file, independent of any tool return. The
guard gates `mcp__*` names by FULL public name; admission records are
`{full-name → identity}` captured from the live tool view (§10.4 minimal).

| cell | verdict | evidence |
| --- | --- | --- |
| late binding observed after session start | PASS(beta-real/alpha-log) | watcher row discovered mcp__beta__ping at boot (real tools/change row); alpha: host log shows initialize/tools-list completing ONLY after the wake file; runner step late-binding recorded |
| unknown mcp tool → refused BEFORE body, zero server-side effect | PASS | refused-before-body reason unknown-dynamic-source (b1); marker `mcp-alpha-b1.served` ABSENT |
| same-name from SECOND server does not inherit admission | PASS | mcp__beta__ping refused (b3) though alpha was admitted; beta marker b3 ABSENT |
| admitted source runs (server-side proof) | PASS (beta) / see gap note (alpha) | `mcpmarks/mcp-beta-b4.served` exists — admitted mcp__beta__ping executed SERVER-SIDE through the admitted identity |
| admission-disabled plant → unknown source served | PASS | `mcpmarks/mcp-beta-b5.served` exists only while the plant was on |
| heal → re-refusal, zero effect | PASS | b6 refused; marker b6 ABSENT |
| admitted→drift (identity moved since admission) refused | covered by identity-check code path, not separately fired in E3 | guard row identity-drift branch (unit-tested path) |

**PoC-4b disclosed gap (honest):** alpha's OWN "admitted→served" marker was not produced
in E3. Root cause is fixture orchestration, diagnosed exactly: the round-1 mock served
the whole concatenated script inside the first turn, so alpha's call+admit happened
BEFORE its wake-gated server had registered (`admit-mcp` → `not visible` — correct
fail-closed behavior), and the guard's first-call path recorded a discovery row for a
not-yet-bound name (phantom). Both are fixed in the fixtures (group-gated mock; discovery
only for bound identities — see g1fb-run.mjs/makeDecideG1F and g1fb-probe-plugin.mjs
`unknown-dynamic-source-not-yet-bound`); re-demonstrating the alpha-positive cell needs one
more Host start, which the shared ≤2 budget forbids — awaiting the parent's call. The
mechanism itself is proven green: identical code path, beta admitted → served server-side.

---

## §reuse-vs-rewrite

| asset | status | note |
| --- | --- | --- |
| `instance.mjs`, `util.mjs`, `mock-deepseek.mjs`, `s1m1-session-client.mjs` | **reused UNMODIFIED** (sealed H0 copies; mock sha256 `8beade…` pinned in preflight) | boot/port/teardown/wire infrastructure |
| master `pa-mount-registry.mjs` | **reused UNMODIFIED by runtime import** (never copied; sha recorded per-run in `master-reuse` row; center REFUSES to start if absent — fail-closed) | the mount identity law (CI-08) is the master law itself |
| master `createGovernedJobsBridge` (plane-effect-backends.mjs:1579-1850) | **reused as BYTE-IDENTICAL extraction** inside `g1fb-jobs-bridge.mjs`; both directions verified per-run (master bytes sha + containment) | the special mechanism stays inside the bridge and passes through the same admission |
| HTU `root-binding/harness/mini-mcp.mjs` | **adapted** (streamable-http→stdio, PoC wake/mark extensions) | fixture only |
| `g1fb-lib/ledger/registry/family-*/probe-plugin/run/unit/reeval` | **rewritten minimal** | master plane files import lane-TS modules; PR #360 `write.mjs` imports controlled-fs closures — neither is importable from a plain plugin at the pin, so PoC-grade equivalents were written; the #360 assets were still evaluated by source and their declaration shape is what `g1fb-family-*.mjs` mimics |

## §budget — ledger (shared caps: ≤2 Host starts, ≤5 experiments, ≤30min/run, ≤2GiB)

| # | kind | Host start | outcome |
| --- | --- | --- | --- |
| E1 | static: preflight + dry-runs + no-Host unit smoke (21/21) | none | all green |
| E2 | suite A run `g1fb-…T14-30-48Z` | #1 | fixture-bug (jobs inject; §findings-2) — consumed; PoC-1/2 core cells already green; evidence kept |
| E3 | combined suite AB run `g1fb-…T14-34-41Z` | #2 | 32/33 cells; the evidence run |
| E4 | OFFLINE re-evaluation of E3 (`g1fb-reeval.mjs`, no Host) | none | verdicts as tabled |

Evidence size: 4.0 MB total (cap 2 GiB). Ports: 3186 only (ss-verified free before,
`:3080` and 3180-3185 never touched). Own PIDs only (instance.log owned_pid in
steps.jsonl). Each run's `finally` re-verified HTU porcelain empty + HEAD==pin
(`post-check-htu` ok on both starts). Worlds snapshotted to `runs/*/filesystem-evidence/`
then `tests/homes/g1fb-*` deleted at the end of the task; no commits, no wildcards, no
writes outside this evidence directory.

## §CORE_SEAM_BLOCKER

**None asserted by this package.** Every PoC above ran entirely through public seams
with CORE PATCH BUDGET = 0. Carried forward from H0 (unchanged, center obligations —
they bound the VERDICTS, not the seam availability): (1) the prepend-listener guard is
sound only if the center composition is trusted to be the sole registrant on governed
names for its scope (collision law enforced here at the center; Host-layer same-scope
shadowing remains a composition-trust boundary); (2) `tools/change` carries no payload —
centers must diff `ctx.tools.schemas()` (done); (3) PoC-4a (web/HTTP dynamic sources)
stays ENV-BLOCKED — not this executor's group.

## §verdicts (per PoC; H0 CONDITIONAL inheritance respected — every group is blocked_by_H0)

- **PoC-1 FS-write/ARC-A: READY-PUBLIC** — the one-generic-registration route (zero diff
  for family #2, collision refused, pre-body deny with real zero-effect) holds end-to-end
  under the H0 self-dispatch guard form. Remaining H0 composition-trust conditions are
  center obligations, not seam gaps.
- **PoC-2 shared lifecycle: READY-PUBLIC** — one ledger demonstrably serves read+grep+
  bash+job admits with the full ask/approve/consume/replay/revoke state machine, deny
  with measured zero-process; plant proves the ledger is load-bearing.
- **PoC-3 Jobs bridge: READY-PUBLIC** — the byte-identical master bridge rides the same
  admission with NO second ledger, its owner fence produces measured host-non-reach, and
  the master mount law (imported unmodified) delivers the CI-08 old-disposer behavior
  with the plant showing the counterfactual.
- **PoC-4b MCP dynamic: CONDITIONAL** — condition 1 (this package, needs the pending
  budget call): alpha's own admitted→served marker must be re-demonstrated with the
  fixed group-gated orchestration (one Host start; beta already covers the identical
  path). Condition 2 (inherited H0): admission-table identity-checking is sound under
  the same composition-trust conditions as the guard (single-trusted-center), and the
  drift branch, though coded+unit-covered, needs one live firing in the next round.
