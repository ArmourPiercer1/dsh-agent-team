# UTE G1 — the consolidated release request (2026-11-21). Submitted, not executed.

**Status of this request: NOT EXECUTABLE AS FILED.** Zero of the eight families in the
retirement ledger satisfy `RetireAllowed`. Every family is refused by
`scripts/ute-retirement-gate.mjs` for a measured reason, and the largest block of
reasons is the one thing an agent cannot supply: an **owner signature** on a blocking
semantic difference. This document is the single consolidated request required by
`RETIREMENT.md` §6; performing the switch is a separate act that this document does
**not** perform and does not authorise.

```
UTE-RETIREMENT-SUMMARY requested=8 allowed=0 refused=8
```

---

## 1. What "done" means here, and what was actually done

`RetireAllowed = OldBaseline ∧ NewPathVerified ∧ SemanticDifferencesResolved ∧ NegativeControlsPass`.

| term | what the ledger measures | families satisfying it |
| --- | --- | --- |
| `OldBaseline` | a reproducible (input → effect) table captured on the old path, reproducibility evidenced by a second capture — **two committed byte-identical transcripts** for search, web and ui/agent-state; **a fresh capture compared byte-for-byte against the committed fixture** for fs and process; **two in-suite fresh captures compared byte-for-byte (no committed pair)** for agent-control — effects corroborated by an independent witness, and **every census member covered by a baseline vector** | **6 / 8** (fs, search, web, agent-control, ui, agent-state; process has no `pwsh` vector; inspect has no baseline) |
| `NewPathVerified` | every baseline vector **reproduced** on the new path | **2 / 8** (fs 16/16, search 15/15) |
| `SemanticDifferencesResolved` | every blocking difference carries a reference-bound owner approval | **0 / 8** (31 blocking differences, 31 × `approval: null`) |
| `NegativeControlsPass` | every retirement-unit member has a real control that turns RED when the mechanism is removed, plus a positive arm | **7 / 8** (all but inspect, which has no unit to guard) |

The honest summary is therefore: **the measurement programme is complete for eight of
the nine census families; the retirement decision programme has not started.** That is
not a failure of the work — it is the boundary the work was supposed to expose, and it
is now visible in one machine-readable place instead of in prose.

---

## 2. The migration / retirement matrix (reviewed master `2b69193fa`)

`members` is the census booking (`arc-a-family-census.json` `nativeNames`); `unit coverage`
is the gate's derived `coverage.oldBaseline / newPathVerified / negativeControlsPass` fact
(3/3 axes per member), not a second member count.

| # | family | census id | members | unit coverage | old files | baseline | new path | controls | blocking diffs | gate verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | fs | `dsh.fs-family` | 4 | 4/4 | 17 | ✅ | ✅ | ✅ | 2 | refused (semantic) |
| 2 | search | `dsh.search-family` | 2 | 2/2 | 9 | ✅ | ✅ | ✅ | 3 | refused (semantic) |
| 3 | web | `dsh.web-family` | 2 | 0/2 | 10 | ✅ | ❌ absent | ✅ | 3 | refused |
| 4 | inspect | `dsh.inspect-family` | 3 | 0/3 (single-impl) | 10 | ❌ n/a | ❌ | ❌ n/a | 1 | refused + `UTE_UNIT_UNGRADABLE` |
| 5 | process | `dsh.process-family` | 2 | 1/2 (`pwsh` uncovered) | 11 | ❌ **1/2** (`pwsh` uncovered) | ❌ absent | ✅ | 5 | refused |
| 6 | agent-control | `dsh.agent-control-family` | 7 | 0/7 | 14 | ✅ | ❌ absent | ✅ | 3 | refused |
| 7 | ui | `dsh.ui-family` | 2 | 0/2 | 9 | ✅ | ❌ absent | ✅ | 7 | refused |
| 8 | agent-state | `dsh.agent-state-family` | 5 | 0/5 | 7 | ✅ | ❌ absent | ✅ | 7 | refused |
| — | u6-probe | `dsh.u6-probe-family` | 1 | test-only | 0 | — | — | — | — | **out of scope, see §7** |

**Totals:** **27 booked members** = 4 (fs) + 2 (search) + 2 (web) + 3 (inspect) +
2 (process) + 7 (agent-control) + 2 (ui) + 5 (agent-state) — the census `nativeNames`
lengths the gate resolves per row; **87 old-path body files** = 17 + 9 + 10 + 10 + 11 + 14 + 9 + 7 (every
file of every governed family body, see §6) **plus 3 shared generated-surface files**
(the barrel, its reviewed manifest and its declaration — see §6.1), so a full
retirement accounts for **90 tracked source files**; 31 blocking differences; 0
retireable families. Every file in the 87 and in the 3 exists (`checked`, this master).

`process` is the one family whose baseline was **captured and still does not establish the
term**: the census books `bash` **and** `pwsh`, and `RETIREMENT.md` §2 grades “every unit
member has at least one baseline vector” *inside* the term. `pwsh` has no baseline vector — it is excluded
from the shipped wiring, not from the census unit — so the gate derives
`oldBaseline=false` with `UTE_MEMBER_UNCOVERED term=oldBaseline` and the ledger now records
`verdict: false` (B10). The 14-vector `bash` baseline is real; the family's baseline
coverage is 1/2, not a green baseline.

Per-family evidence lives in `dev/agent-workflow/evidence/ute3-*/` and in the golden
tables under `tests/ute-g1-*/golden/`; the ledger rows carry the exact `expect` tokens
and `contradicts` assertions the gate grades, so a ledger edit that claims more than
its evidence shows is refused (`UTE_APPROVAL_UNREFERENCED`, `UTE_VECTOR_UNREPRODUCED`,
`UTE_MEMBER_UNCOVERED`, `UTE_UNIT_UNDERCLAIMED`).

### The two families that are closest to retireable

- **fs** — 16/16 vectors reproduced on the pinned rc.5 new path, 4/4 members, controls
  green. The confinement claim is carried by the **`unconfined-fs`** mutation
  (`tests/ute-g1-fs/product-route-image.test.mjs:268`, collected by the census CI argv at
  `.github/workflows/census-runtime.yml:434`): the same host module on a base provider
  turns the lane denial into a **70-byte allow** — exactly the arm the first review
  wrongly called nonexistent (withdrawn; see `CORRECTIONS.md`). The per-member pair
  `NC-MEMBER read_image` / `widen-read-lane-image` independently shows the same
  70-byte attachment escape. Its only blocker is the owner's signature on the refusal **shape** change
  (`FS_SANDBOX_DENIED` prose → typed `FS_PERMISSION_DENIED`), for which the technical
  route (B+C, closed refusal-category mapping) was already ruled on 2026-11-20.
- **search** — 15/15 vectors reproduced, 2/2 members, 8 controls in the family battery
  plus 12 controls in the separate B2 new-path mutation harness (the two counts are not
  interchangeable). Its three blockers
  include a **real product defect** (`SD-SEARCH-1`: a path-less `grep` returns zero
  matches on the product route).

---

## 3. Hosted CI — the evidence the local runs cannot give

Local runs cannot install the repo in this environment (`pnpm install` fails
`[ERR_SQLITE_ERROR] cannot open database file`), so `pr-gate`'s `install`/`typecheck`/
`artifacts-at-head` legs and the census runtime are **only** measurable hosted. Every
merge below landed after a full green hosted run on the exact 40-hex head
(`ci-required` + `ci-census / census-runtime` + `ci-fast` + `ci-integration` +
`ci-product` + `ci-security` + `pr-gate` + `pr-settlement-gate` + `candidate-protection`
+ `synthesize-merge-tree`):

| PR | merged (UTC) | what it added |
| --- | --- | --- |
| #805 | 11-20 19:46 | the `append-only-log` CI leg (10 legs now), after squash merges repeatedly truncated the log |
| #806 | 11-20 21:01 | search old-path baseline |
| #807 | 11-20 21:49 | fs new path, 16/16 |
| #809 | 11-20 23:22 | search new path, 15/15 |
| #810 | 11-21 00:04 | web old-path + per-member controls |
| #811 | 11-21 01:51 | inspect Stage-0 non-retirement proof |
| #813 | 11-21 03:00 | process old-path (14 vectors, 10 controls) |
| #814 | 11-21 03:33 | agent-control old-path (42 vectors, 24 controls) |
| #815 | 11-21 04:11 | ui + agent-state old-path (69 vectors, 13 controls) |

Census executions ran the whole suite on a fresh checkout after the repo build; the
last full census reported `assertions_executed=18650` with `skipped_total=0`.

Two hosted reds during this window were **real defects the local gates could not see**,
and both were fixed rather than retried away:

1. a `pwsh` exclusion assertion that pinned *this host* (`binary=ABSENT`) — false on
   GitHub runners, which ship PowerShell. Replaced with a wiring-derived exclusion law
   (`PWSH-EXCLUSION-UNJUSTIFIED` if a route/preset/scope ever serves `pwsh`) plus a
   conditional control.
2. an append-only log violation caused by appending *above* master's entry during a
   merge — the guard compares positionally, so "nothing deleted" was not enough.

One hosted red (`#810`, `ci-integration`) did **not** reproduce locally (100/100 and
41/41 green) and passed on a clean rerun; it is recorded as a flake, not as green.

---

## 4. The 31 blocking semantic differences, grouped by what they ask the owner

The full text of each is in `dev/agent-workflow/ledgers/ute-retirement.json`
(`terms.semanticDifferencesResolved.differences[].summary`), and the question sheet for
the first three families is in `APPROVAL-REQUEST-2026-11-20.md`.

**The partition is a machine derivation, not a reading.** The mapping below is produced by
`dev/agent-workflow/evidence/ute3-review-20261121/partition.mjs`, which reads the ledger,
asserts that exactly **31** distinct ids exist, and asserts that each id is assigned to
exactly one group (no id appears twice; no ledger id is unassigned). The counts are
**A=7, B=5, C=4, D=14, E=1** and sum to 31. The earlier version of this document had A=8 with only
seven enumerated, double-counted `SD-PROCESS-4-refusal-surface`,
`SD-UI-refusal-vocabulary` and `SD-AS-refusal-vocabulary` in A **and** E, and collapsed
eight UI/AS differences into four in D. This section replaces that split.

**Group A — refusal surfaces (7).** Each family's old path raises a typed code (or a
closed class) and the new/other path either raises a different typed code, a generic text
with the cause only in a guard fact, or a different envelope. Members:
`fs:lane-refusal-code`, `fs:refusal-observation-shape`,
`search:SD-SEARCH-3-refusal-surface`, `web:SD-WEB-3-refusal-surface`,
`process:SD-PROCESS-4-refusal-surface`, `ui:SD-UI-refusal-vocabulary`,
`agent-state:SD-AS-refusal-vocabulary`.

**Group B — name ownership: five different questions, stated separately (5).** These are
**not** one mechanism, and the earlier “the same spelling is declared twice by the pinned
host package the Member preset already mounts” sentence was false in two of the five and
miscategorised a third.

1. `SD-WEB-1-native-name-claim-collision` — two *repo* claimants for `web_fetch` /
   `web_search`: the governed family descriptor (`packages/tools/families/web.mjs`,
   opt-in `webEnabled`) and the route-C shadow (`A5SF_WEB_TOOL_NAMES` in
   `packages/runtime/src/plugin/live/a5sf-realm-row.mjs`, PD-27). The preset row is
   `cordis.patch.yml:350-351` `id: tool-web, name: 'dsh-agent-team/web-tool'` — **this
   repository's own module, explicitly not the pinned host `tool-web` package**, and the
   host package is not mounted. The collision is real; the “pinned host package” framing
   was not.
2. `SD-AGENTCTL-2-native-name-claim-not-graded` — the governed family claims all seven
   reserved native spellings, but the native-side ledger does not grade a family claim:
   `PLANE_SUPPORTED_NATIVE_TAKEOVERS` declares no agent-control class, `verifyPlaneNames`
   is closed to the grep/glob/bash map, and `family-assembly.mjs` has zero references to
   `PLANE_RESERVED_NATIVE`. Ownership is unresolved **by construction**; no mounted second
   implementation is asserted for it.
3. `alias-to-native-name-change` (inspect) — **not a same-spelling collision at all.** The
   governed side serves `team_skill` / `team_cordis_inspect_list` /
   `team_cordis_inspect_query`; the native/service side serves `skill` /
   `cordis_inspect_list` / `cordis_inspect_query`. The spellings differ: this is an
   **alias → native rename** (name + schema + presentation), not two claimants of one name.
4. `SD-UI-two-implementations` — **one of the two** UI spellings is declared twice **and
   mounted**: `present` is declared by the governed body (`ui-family/src/present-row.mjs`)
   and by the pinned host `tool-present` package that the preset mounts
   (`cordis.patch.yml`). `ask_user_question` is declared by both sides
   (`ui-family/src/ask-row.mjs` and the host `tool-ask-user`), but the preset does **not**
   mount `tool-ask-user` (PD-25), so the host implementation is unreachable on the product
   route. Deleting the governed body leaves the mounted host `present`; the ask exception
   is a declaration collision without a mount.
5. `SD-AS-two-implementations` — **all five** agent-state spellings are declared twice
   **and mounted**: the governed body (`agent-state-family/src/executors.mjs`) and the
   pinned host `tool-todo` / `tool-goal` / `plan-mode` packages the preset mounts
   (`cordis.patch.yml`). Deleting the governed body leaves all five host rows in place,
   and those rows would not adopt the governed law.

The probes support exactly this: `PROBE-UISTATE … two-implementations=yes` is true for the
six *mounted* members, and the composition probe prints the missing `tool-ask-user` row
(PD-25). A retirement cannot move a name whose owner is unnamed — but for inspect the
question is a rename, and for `ask_user_question` it is an unmounted declaration, not a
second live implementation.

**Group C — the route question (4).** Members: `agent-control:SD-AGENTCTL-1-route-c-unserved`,
`ui:SD-UI-product-route-absent`, `agent-state:SD-AS-product-route-absent`,
`process:SD-PROCESS-3-pty-face-not-measured`.

- `SD-AGENTCTL-1-route-c-unserved` — the product route-C composition attaches confined
  shell/search/fs/skill/present/web shadows and **no agent-control spec**, so every one of
  the seven dispatches is an `unknown tool` refusal with zero provider calls. The cited
  probe is a deliberately configured *no-preset* composition (`nativeToolModules: []`), so
  it cannot by itself distinguish “route C serves none” from “the probe configured no host
  preset”; the independent proof is `cordis.patch.yml:216-232`, where the delegation group
  is removed from the governed preset. The replacement must be a new native binding that
  does not exist at B1.
- `SD-UI-product-route-absent` / `SD-AS-product-route-absent` — **the governed family BODY
  is not mounted on product route-C; the names are not all absent.** The *bare* route (a
  deliberately configured composition with no native tool modules) registers none of the
  seven names (`unknown tool`). The shipped preset does serve `present` on the preset scope
  (route-C host shadow: `PROBE-ROUTE-C-PRESET present-on-preset-scope=registered`,
  attach-fibers=1, shadowed=yes) and all five agent-state names as inherited preset rows
  (`PROBE-DISPOSITION`: `todo_write`, `create_goal`, `get_goal`, `update_goal`,
  `exit_plan_mode`); `ask_user_question` is deliberately absent (PD-25). So **6 of the
  7 names are served on the product route** through host preset rows, while the governed
  body that would be retired is not. The retirement unit spans a governed body no measured
  product route mounts — not “a family no product route can reach”.
- `SD-PROCESS-3-pty-face-not-measured` — the shipped product wiring mounts no governed PTY
  face; the persistent-PTY `bash` definition is never selected by it, so its semantics are
  uncovered.

**Group D — behaviour that genuinely differs (14).**
`search:SD-SEARCH-1-grep-path-default` (a path-less `grep` returns zero matches: a defect),
`search:SD-SEARCH-2-grep-vcs-ignore` (VCS-ignore policy),
`web:SD-WEB-2-redirect-ownership` (one call = three network effects on route C vs one
bounded response), `process:SD-PROCESS-1-no-truncation-flag`,
`process:SD-PROCESS-2-killed-exit-status`, `process:SD-PROCESS-5-pwsh-member-unreachable`,
and the four UI plus four agent-state result-shape differences:
`ui:SD-UI-result-envelope`, `ui:SD-UI-state-sink`, `ui:SD-UI-present-receipt-turn`,
`ui:SD-UI-timed-pending-shape`, `agent-state:SD-AS-result-envelope`,
`agent-state:SD-AS-state-sink`, `agent-state:SD-AS-present-receipt-turn`,
`agent-state:SD-AS-timed-pending-shape`. (The earlier document's “10” counted only six
named ids and treated the eight UI/AS shape differences as four.)

**Group E — coverage the stage does not claim (1).**
`agent-control:SD-AGENTCTL-3-governed-admission-surface`. The earlier “4” came from
double-counting the three refusal-surface ids already in Group A.

Mapping summary (asserted by `partition.mjs`): A=7, B=5, C=4, D=14, E=1 → **31**, each id
once. None of the 31 is a formatting nit that a reviewer could wave through: each changes
what a caller (or a user) observes, or names a binding that does not yet have an owner.

## 5. Formal switch plan (NOT executed; each step is gated and reversible)

**Preconditions, all of which must hold for a family before its step may run:**

1. `scripts/ute-retirement-gate.mjs --family <id>` exits **0** (i.e. the owner has
   recorded `SemanticDifferencesResolved` with a `PR #n @ 40-hex` reference that the
   gate can resolve to a HEAD ancestor), and
2. a hosted `census-runtime` run on that exact HEAD is green, and
3. the retirement unit is **whole** — a partial unit is `UTE_UNIT_UNDERCLAIMED` by law.

**Order** (each family is independent; the order is by blast radius, smallest first):

| stage | family | why this position | abort criterion |
| --- | --- | --- | --- |
| S1 | inspect | single implementation ⇒ the "switch" is a proof, not a route change | any name ownership dispute |
| S2 | search | new path fully reproduced; one known defect to accept or fix first | `SD-SEARCH-1` accepted without a user-facing note |
| S3 | fs | new path fully reproduced; refusal-shape signature pending | any `FS_PERMISSION_DENIED` surfaced without its category |
| S4 | process | `pwsh` excluded ⇒ partial unit; needs an owner ruling on partial retirement | a `pwsh` call routed to a retired row |
| S5 | web | network effects per call change with redirect ownership | one call producing more network effects than the approved budget |
| S6 | ui + agent-state | model-visible surface; two implementations live in the same preset | a model-visible schema/name change without an approval |
| S7 | agent-control | route C does not serve it; the retirement is a binding change | any subagent/workflow dispatch losing its admission facts |

**Mechanism.** `ControlService` remains the sole Grant/Stop authority; no step may
bypass it. Each step is a **separate PR** that (a) flips the family's ledger row to
`RETIRED` with the approval reference, (b) removes the legacy family body from the
assembly's `claims()`, and (c) deletes exactly the files listed in §6 — in that order,
so that a revert is a single `git revert` of a small commit.

**Observability per step:** the census must stay `verdict=PASS` with
`skipped_total=0`, `test-catalog` must stay `refused=0`, and the family's own lane suite
must keep its golden parity **against the new path** (a retired family's golden moves
from "old path reproduced" to "new path is the only path").

---

## 6. Expected-deletable old code (87 body files + 3 generated-surface files, by family)

Only after that family's §5 step is approved. **The set is every file of the governed
family body**, not just the rows a call happens to reach: `packages/tools/families/*.mjs`
holds the assembly row, and `packages/tools/*-family/src/**` holds the complete body
(entry point, rows, executors, mechanics, normalizer, contribution and port modules).

**How this list was derived, and why it is not copied from the ledger.** The list is
`census.contributionPaths` **plus the actual `src/` directory** of each booked family
(`find <lane>/src -type f`), plus the assembly row. The retirement ledger's
`oldPath.files` is not sufficient on its own: `UTE_OLD_PATH_PARTIALLY_REMOVED` can only
report a declared file that is *gone*, so it cannot see a file the list never named. The
review found exactly that failure: the earlier 7-file FS list omitted 10 of the body's 17
files (including `index.mjs` and every executor the seven rows call). The ledger's
`fs.oldPath.files` now carries all 17 (B4), and the lists below match the directories.

- **fs (17):** `families/fs.mjs`, `fs-family/src/edit-executor.mjs`,
  `fs-family/src/edit-row.mjs`, `fs-family/src/fs-family-contribution.mjs`,
  `fs-family/src/fs-mechanics.mjs`, `fs-family/src/fs-mutation-mechanics.mjs`,
  `fs-family/src/fs-read-contribution.mjs`, `fs-family/src/image-executor.mjs`,
  `fs-family/src/image-read-port.mjs`, `fs-family/src/image-row.mjs`,
  `fs-family/src/index.mjs`, `fs-family/src/read-executor.mjs`,
  `fs-family/src/read-normalizer.ts`, `fs-family/src/read-presentation.mjs`,
  `fs-family/src/read-row.mjs`, `fs-family/src/write-executor.mjs`,
  `fs-family/src/write-row.mjs`
- **search (9):** `families/search.mjs`, `search-family/src/{cancel-leg,glob-backend,index,search-backend,search-contribution,search-mechanics,search-row,stream-drain}.mjs`
- **web (10):** `families/web.mjs`, `web-family/src/{fetch-executor,fetch-row,index,search-executor,search-row,web-family-contribution,web-mechanics,web-search-provider,web-transport}.mjs`
- **inspect (10):** `families/inspect.mjs`, `inspect-family/src/{index,inspect-executor,inspect-family-contribution,inspect-mechanics,inspect-rows,row-names,skill-executor,skill-mechanics,skill-row}.mjs`
- **process (11):** `families/process.mjs`, `process-family/src/{bash-contribution,bash-normalizer.ts,bash-row,confined-shell-executor,index,pwsh-confined,pwsh-executor,pwsh-mechanics,pwsh-row,shell-mechanics}.mjs`
- **agent-control (14):** `families/agent-control.mjs`, `agent-control-family/src/{index,agent-control-contribution,agent-control-executor,agent-control-mechanics,agent-runtime-port,native-output-schemas,spawn-row,fork-row,steer-row,interrupt-row,list-agents-row,list-models-row,workflow-row}.mjs`
- **ui (9):** `families/ui.mjs`, `ui-family/src/{ask-executor,ask-row,index,present-executor,present-row,ui-family-contribution,ui-interaction-port,ui-mechanics}.mjs`
- **agent-state (7):** `families/agent-state.mjs`, `agent-state-family/src/{agent-state-law,contribution,executors,fs-state-store,index,state-store}.mjs`

**Total: 87 = 17 + 9 + 10 + 10 + 11 + 14 + 9 + 7.** Every file exists and is tracked at
this master. The per-family counts are the directory counts (fs 16 body files + 1
assembly; search 8 + 1; web 9 + 1; inspect 9 + 1; process 10 + 1; agent-control 13 + 1;
ui 8 + 1; agent-state 6 + 1).

### 6.1 The generated surface (N = 3): regenerate per removal, never delete blindly

The 87 above are the governed **bodies**. Three tracked files in
`packages/tools/families/` are not any family's body and are not in the 87, but they
statically import or list all eight rows. **Deleting the 87 without touching this
surface leaves a broken import graph**: `index.mjs` would still execute
`import { familyAssembly as f0 } from './fs.mjs'` after `fs.mjs` is gone, and the
plane would fail to load before any family is mounted.

| file | what it is | what each removal must do |
| --- | --- | --- |
| `packages/tools/families/index.mjs` | **GENERATED** static barrel: one import per manifest entry, all eight today | **regenerate**, do not hand-edit: `node scripts/gen-family-index.mjs` (writes it from `manifest.json`); verify with `node scripts/gen-family-index.mjs --check` |
| `packages/tools/families/manifest.json` | the **REVIEWED** list (`u7-family-manifest/1`): one entry per family module with its reviewed sha256, plus the kernel capability backings | edit by hand: delete that family's entry. Never hand-edit a digest; `node scripts/gen-family-index.mjs --digest` prints what the modules hash to |
| `packages/tools/families/index.d.mts` | hand-written, stable declaration of the barrel's **shape** (no per-entry data; not generated) | no per-family edit; it survives until the barrel itself is removed at the end of the programme |

`index.mjs` is generated by `scripts/gen-family-index.mjs`; `manifest.json` is the
reviewed input that script reads (a reviewed edit, not a generated file); `index.d.mts`
is hand-written and stable. The tracked build mirrors
`packages/runtime/dist/packages/tools/families/{index.mjs,manifest.json}` are copies
placed by `node scripts/place-dist-glue.mjs` after `tsc` (see
`scripts/dist-placements/060-u7w0b-family-seam.json`); they are regenerated by the
build and are not additional sources of truth, so they are not counted in N.

**Revised total: 87 + 3 = 90 tracked source files** that a full retirement of the
eight families must account for. Per family, the §5 step deletes that family's slice of
the 87 and regenerates the shared surface (one manifest entry removed, barrel
regenerated); the last step removes the now-empty barrel, manifest and declaration. The
ledger's per-family `oldPath.files` stays the 87 body files — one disjoint list per
family, which is what `UTE_OLD_PATH_PARTIALLY_REMOVED` can grade. The shared surface has
no per-family slot in the ledger schema, so the gate cannot see a premature deletion of
`index.mjs`; that is a recorded limit of the detector, not a claim that the surface is
optional.

**What the deletion does, exactly (per family).** The point of Group B/C is that these
bodies are **not** what the shipped product route serves:

- **fs, search, web, process, ui, agent-state (6):** the governed bodies are not
  mounted on the shipped preset (no plane key is set), and the booked names are served
  by another live implementation — the route-C native binding for fs/search/process,
  this repository's own `dsh-agent-team/web-tool` row for web, and the pinned host rows
  for `present` plus all five agent-state names (6 of the 7 ui/agent-state spellings;
  `ask_user_question` is absent by PD-25 both before and after). For these six,
  deleting the governed bodies **removes no capability reachable on the shipped
  preset**: the product route keeps serving the same names, so such a retirement would
  be a false-negative deletion rather than a capability loss.
- **agent-control (1):** neither the bare route nor the shipped preset serves the seven
  names (the delegation group is removed), so deleting the governed body also removes
  nothing reachable. It differs from the six in that there is **no second live
  implementation at all**: for an install that opts the governed plane in, the deleted
  body is the only implementation.
- **inspect (1):** Stage-0 measured a single implementation. The governed body **is the
  only implementation** of `team_skill` / `team_cordis_inspect_list` /
  `team_cordis_inspect_query`; the native/service side serves the same capability under
  different names (`skill`, `cordis_inspect_*`). Deleting the body therefore removes
  the only implementation of those booked spellings (again, for an install that turns
  the governed plane on; the shipped preset already serves none of them).

So the blanket sentence "change nothing observable" is exact only for the **shipped
preset**, and the corrected claim is the per-family one above: **true for six families,
with nothing reachable removed for agent-control either, and false for inspect**, whose
body is the only implementation. The deletion set is the whole body, not a selection of
rows, precisely so that a retirement cannot leave a half-dead implementation behind.

## 7. Out of scope: `dsh.u6-probe-family`

Census row: `mount: "test-only"`, lane `tests/u6-arc-a-probe-family`, native name
`u6arc_probe`, reviewed by U6 PR5. It exists to probe the census itself and has no
production contribution. It has no ledger row, and the gate does not refuse it — it is
**excluded by construction, not by omission**, and `UTE-FAMILY-INVENTORY-SUMMARY
families=9` counts it while the retirement ledger counts 8. If the owner wants the
exclusion recorded as a ledger row with `state: "NOT_APPLICABLE"`, that is a schema
decision (`UTE_LEDGER_SCHEMA` currently admits only retirement units).

---

## 8. Rollback plan

- **Before a step:** nothing to roll back; the ledger is the only state.
- **During a step (PR open):** close the PR. The ledger row still says
  `NOT_RETIREABLE`; the assembly still claims the family.
- **After a merge:** `git revert <merge sha>` restores both the ledger row and the
  deleted files in one commit. The `append-only-log` guard means the log entry stays
  (it is a record that the attempt happened), and a revert is itself logged — that is
  the intended behaviour, not a defect.
- **Worst case (a retired family misbehaves in production):** re-add the family to the
  assembly's `claims()` from the revert commit, then re-run that family's lane suite;
  the golden table was never deleted, so the old path's behaviour is still pinned and
  re-provable.
- The rollback has been **exercised in miniature**: every merge in this window had to
  re-resolve the log/ledger/test composition, and the ledger's rows survived each
  recomposition with their evidence pointers intact.

---

## 9. What is explicitly NOT proven (UNKNOWN, never PASS)

1. **No production switch was performed.** Nothing in this round changes what the
   shipped product route serves, except the disclosed route-C `read_image` repair
   (#802), which made a previously unreachable tool reachable and confined.
2. **No live-boot acceptance for any new path.** The lane suites run host-free C1 worlds;
   `tests/next-host/**` proves the pinned rc.5 host boots, but not that a *retired*
   family behaves identically in a live Member session.
3. **`pwsh` semantics are unknown** (no shipped wiring selects it here).
4. **Read confinement is not PROVEN** for process: refusals, absent secrets and unchanged
   trees are pinned; the absence of an unauthorised read is not observable from inside.
5. **The `goal` three-piece's durable/restore semantics** are covered only through the
   governed plane's own store, not through a live kernel PA dispatch.
6. **FS/Search/Web baselines are route-C reality**, while agent-control/ui/agent-state
   baselines are **governed-plane reality** — the two are not interchangeable, and the
   matrix marks which is which rather than averaging them.
7. **`SemanticDifferencesResolved` is 0/8 by construction**: no approval record exists,
   and none was fabricated.

---

## 10. What I am asking for

1. **Sign or refuse** the differences in `APPROVAL-REQUEST-2026-11-20.md` (§1 fs, §2
   search, §3 web) and the equivalent set for process, agent-control, ui, agent-state —
   31 decisions, each with a named alternative if the answer is no.
2. **Rule on the exclusion** of `dsh.u6-probe-family` from the retirement ledger (§7).
3. **Rule on partial retirement**: is a family like `process` (1/2 members, `pwsh`
   unreachable by shipped wiring) retireable at all, or must the unit stay whole?
4. **Rule on the baseline-under-repair question**: FS's baseline was captured on a tree
   containing the #802 repair; the ledger records the capture point, but acceptability
   is a ruling.
5. **Then**, when a family's four terms are true, authorise its §5 step — one PR per
   family, with the §6 deletions in the same commit set so the revert is one command.

Until (1)–(4) are answered, the correct state of this programme is the one the gate
prints: **eight families measured, eight refused, zero retired, nothing switched.**
