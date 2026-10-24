# EB0-1 … EB0-5 — receipts assembled from what already exists (**not** an EB0 exit)

> **Read this before using any number here.** "Assembled from receipts" is not "EB0 complete".
> EB0-5 still needs a **same-platform selector p50/p95** study: nearly every value below is
> **n = 1**, on a shared host, against a scripted mock, and the accurate name for this file is
> *an inventory with samples*, not a performance baseline. What is missing is listed at the end of
> EB0-5 and stays open.

Authored in the EB E0–E1 line (`.worktrees/eb-e0-e1`, branch
`task/eb-e0-e1-doc-baseline-20261029`, HEAD at authoring time `9d8e24f9d233b7582449439be8e919dc05a6b748`).

**What this file is.** Every number below is read off a receipt that was already committed, or off a
CI run that already happened. Nothing here is a new measurement campaign: no Host was started, no
load was generated, nothing was installed, the 94 controls were not re-run, and no world was built.
**What it is not.** It is not a performance baseline in the engineering sense. The samples are
n = 1 in most rows, the environments are shared, and several boundaries are explicit. Where a
number does not exist, the row says `UNKNOWN` instead of approximating.

Line-labelling rule from `baseline-inventory.md` still applies: a fact carries the source it was
measured on, and "this tree" is never "the project".

---

## EB0-1 — authority entry points (old store vs new candidate)

Measured read-only at `9d8e24f9d` on 2026-10-24 by parsing `dev/agent-workflow/graph.yaml`
(`current_contract` block) against the generated view's `legacy_authority` object. **This table is
the state at authoring time and it was an incomplete picture: three of six fields were not
mirrored at all, so what it could certify was agreement on three fields, not a complete
reconciliation.** The gap was closed later the same day -- see "closed later" below.

| field | OLD `graph.yaml#current_contract` | NEW `current-state.json → legacy_authority` | reconciliation | who requires it |
| --- | --- | --- | --- | --- |
| `phase_id` | `alpha5-tool-io-governance` | same | **equal** | `ci-pr-gate` Q2 |
| `active_plan` | `…/alpha5-tool-io-governance/current-execution-plan.md` | same | **equal** | Q2 (target must exist) |
| `backlog` | `…/ALPHA5-EFFECTIVE-BACKLOG.md` | **not mirrored** | absent in view | Q2 (target must exist) |
| `matrix` | `…/TOOL-CAPABILITY-MATRIX-9b2.md` | **not mirrored** | absent in view | Q2 (target must exist) |
| `baseline` | `9b2ee57bc5afd30e89855e09d1769d2e5ec83912` | same | **equal** | Q4 (40 hex, ancestor) + Q6 + testkit |
| `baseline_collected` | `2026-10-22T07:20:56Z` | **not mirrored** | absent in view | Q3 requires it to **exist exactly once** in the block; its value reaches `info.contract` but no verdict depends on it |

**Closed later the same day, at root's instruction.** `scripts/gen-current-state.mjs` now mirrors all
six fields, `registry.schema.json` documents that list under `x-generated-view-mirror`, and
`checkLegacyMirror()` (exported, and run by every `docs:sync --check`) refuses three ways this can
rot: a key that stops being emitted (`LEGACY_MIRROR_INCOMPLETE`), a value the graph does not record
(`LEGACY_MIRROR_VALUE`), and a schema annotation that no longer names the same list
(`LEGACY_MIRROR_SCHEMA_MISMATCH`). The `MIRROR_VALUE` leg is what enforces root's semantic
constraint in code rather than in prose: **the mirror copies, it does not resolve** — `baseline`
stays the frozen recorded SHA (never the live HEAD) and `matrix` stays a path (no tool table is
read). Mutation control `mutation-control-2-legacy-mirror.log`: unmutated mirror → 0 findings;
drop `matrix` → INCOMPLETE+VALUE; empty `baseline_collected` → INCOMPLETE+VALUE; substitute a
different baseline → exactly 1 VALUE; absent block → silent, because pointer grammar belongs to
`ci-pr-gate`, and re-implementing it here would create a second authority over one rule.

Re-run against the **pinned** SHA `01640829ec8e4765fa3b9d1d0c8e6a554de75171` (old values read with
`git show <SHA>:…`, never from the working tree): **six fields equal, zero mismatch**, plus
`baseline_exists=true` / `baseline_is_ancestor_of_head=true` —
[`legacy-mirror-reconciliation-01640829.md`](legacy-mirror-reconciliation-01640829.md).
`current_phase` is still **not** in the view, and that is now a documented absence rather than an
accident of wording.
`view.migration.migration_of_legacy_consumers = "not_started_requires_coordination"`.

**Retracted on contact.** `dev/engineering/README.md` said the bridge mirrors "`current_phase` plus
the `current_contract` baseline"; the code mirrors three fields of `current_contract`
(`phase_id`, `active_plan`, `baseline`) and never emits `current_phase`. Corrected in the same
round as this file. Also mine and also wrong: a first ad-hoc reconciliation attempt reported
"baseline not present in the view" because the throwaway parser captured the graph's trailing
comment on the `baseline:` line — the shipped generator picks `(\S+)` and was right all along. An
ad-hoc parser that disagrees with the generator is a bug in the parser, and it is worth saying out
loud because this is the same defect class this line keeps hitting: prose and code diverging.

Sample and cold/hot: one point in time on this branch; "cold" does not apply (file parse).

---

## EB0-2 — CI surface, with real hosted durations

`git ls-tree master@929fc4af2 -- .github/workflows` = four workflows: `pr-gate.yml`,
`census-runtime.yml`, `candidate-protection.yml`, `characterization.yml` (manual only).

Existing runs on this line's own heads, duration = `completed_at − started_at` from the check-runs
API (so **queue time is excluded**); each run is a fresh runner, i.e. cold for the runner's own
checkout, on shared hosted infrastructure (no exclusive-machine attribution):

| head | workflow | started → completed (UTC) | duration | conclusion |
| --- | --- | --- | --- | --- |
| `9d8e24f9d` | candidate-protection | 01:10:10 → 01:10:24 | **14 s** | success |
| `9d8e24f9d` | pr-gate | 01:10:09 → 01:11:36 | **87 s** | success |
| `9d8e24f9d` | census-runtime | 01:10:10 → 01:27:32 | **1042 s** | success |
| `b97ffdafd` (PR #361 head, recorded 2026-10-23) | pr-gate / census / protection | — | 127 / 1048 / 16 s | success |

Shape of the cost, from two independent samples: **census dominates by ~12×**; the gate is roughly a
minute and a half; protection is seconds. The three started within one second of each other, i.e.
in parallel, so wall-clock to all-green ≈ census, not the sum.

`UNKNOWN`: per-step durations inside census (not exposed on the check resource I read), runner
machine identity, and whether any of the 94 doc controls execute in CI — they do **not** (no CI
wiring on this branch, EB3-B not built), so CI green is not evidence about them.

---

## EB0-3 — tool source attribution, one shipped-package observation

The census at `@929` (see `baseline-inventory.md`) still stands for the tree. Added here is the one
attribution sample that comes from a real run of the **packed** package rather than from source:
the host instance log of window 4 (below) prints, at boot,

- `dsh-agent-team@0.1.1-alpha.2`, exports `.` , `./host`, `./spill-local`, `./client`, `./package.json`,
  resolved from `…/.worktrees/pack-int/out-699cc4fb7a27941b19c1550c42d45d4_3cfcbe1f772c5998b332e4dd8c9559a2/…`
  — i.e. the `699cc` standard package, not owner source;
- `remote mount: MOUNTED channel=/team-remote`;
- `a5g7: placement-feed rows=[team_grep, team_glob, team_bash, read] realm=a5m2-team-c2-h1--24T05-54-08Z`;
- `a5ptc: census-boot … selectedRunner=none enforcement=confine-unset (host sandbox default)`;
- and, importantly for permission claims: the permission-authority **warm-up FAULTED** ("a provider
  read abstained for at least one warm target"), `facts healthy: false`, EXPANSIONS refuse typed
  until an addressed read rebuilds the facts, "decisions and execution are unaffected".

n = 1 realm, one window, one exercised tool name. Host identity `639` (baseline `639ed015…`,
0.2.0-rc.2) is **reported by root's card and not stated in these receipts** → `NOT_VERIFIED` here.

---

## EB0-4 — capacity, install and cleanup receipts

Capacity at the E0 census (unchanged, `live`, 2026-10-23): 46 worktrees, tracked evidence 21 097
files / 509.5 MiB, 525 test worlds, disk 107 G total / 12 G avail (90 % used). It also noted a
reference-protection observation **as of that census**: 5.1 G under `evidence/retired-trees-2026-10-23/`,
3.5 G under `recovery/`, a 38 M incident, each with zero tracked references at that moment.

**That observation is time-stamped and does not describe now.** The trees named there have since been
cleaned or protected by the capacity line, and "zero tracked references" was a count taken at one
instant — it was never evidence about whether the content was wanted, and reading it as "still
abandoned today" would be inventing a current fact out of an old snapshot. The numbers stay here
because EB0-4 is a record of what the census saw, not a live capacity report.

New, read off committed receipts:

| receipt | what it proves | boundary |
| --- | --- | --- |
| `install-c8dd3f07b` (booked `8d4c56125`, 2026-10-24T04:40:53Z) | frozen/offline install RC 0, **532 reused / 0 downloaded**, final lock `dad670ae749c…`, +42/−41 lock diff | accounting basis disputed: nominal `du` 450 MB vs real `df` delta 78 MiB — escalated, not resolved |
| G6 re-anchor install forensics (booked `b1475871b`, 05:27:53Z; **latest verified count: 4 commands / 332 downloads**, per root's re-verification — the booking commit's own wording of 3 attempts / "~330" predates the last command being accounted for and is not used here) | final success **reused 483 from the store while downloading 332 tarballs from the registry online**; lock bytes never drifted | the "offline store" claim is **only partially true**; install freeze now in force chain-wide |
| packaged-entry cold import (`447e14ac2`, 04:43:51Z) | one cold import through the exports map of the packed `699cc` package, `NODE_RC=0`, `VERSION 0.1.1-alpha.2` | `df 78 MiB` is a **shared-volume window, explicitly not an exclusive-budget proof**; inode-level budget not done |
| window-4 monitor (below) | 22 samples, **0 breaches**, world `5 095 → 41 327 B` against a 64 MiB ceiling; `dfAvail 7 372 623 872 → 7 372 517 376` (Δ 106 496 B) | `dfAvail` is the shared volume — **cannot be attributed to this run alone**; fixture lock `dad670ae749c…` byte-identical before/after the window |

Cleanup: window-4 teardown is a real cleanup receipt — `childExit=true`, independent port-free probe
after the child-exit event, `mockFree=true` (mock port 3497), `groupMembers: []` (no leftover
processes), monitor exit planned and 0. That is the only cleanup measurement this line has first-hand; the larger
capacity clean-up belongs to the capacity line, whose more recent cleaning/protection work this file
does not re-measure and therefore does not restate as a number.

---

## EB0-5 — timing, with the gap named instead of smoothed over

**Sample.** Team window 4, evidence commit `92a206ad8439aff98a5536f5abb1a6a5fae2680b`
(2026-10-24T05:57:25Z), run dir
`dev/agent-workflow/evidence/alpha5/live/a5m2-team-c2-h1-2026-10-24T05-54-08Z/`, carrier `04c2cff0`
(per that commit's own message), fixture `team.a5q-queryonly`, fixture lock `dad670ae749c…`,
package `out-699cc4fb7a…`.
**Model boundary: `127.0.0.1:3497 scripted, exactly-one-call decide` — there is no real model in the
sample, so no row here says anything about model latency.**
**Scope boundary: one public positive chain — `team_list_members`, `pairs=1 outcomes={ok:1,error:0,unknown:0}`,
`missing=none`; optional probes "NOT RUN by window-1 scope".**

Leg deltas are consecutive `at` values from `runner.out`:

| leg | at (UTC) | Δ from previous |
| --- | --- | --- |
| `C-FRESH-HOME` | 05:54:09.294 | — |
| `C-MOUNT-CANDIDATE` | 05:54:09.295 | 0.001 s |
| `C-PORT-FREE` + `C-MOUNT-VALIDATE` | 05:54:09.298 | 0.003 s |
| `C-PROFILE-LAYER-WRITTEN` | 05:54:09.299 | 0.001 s |
| `C-MOCK-MODEL` (scripted mock up) | 05:54:09.308 | 0.009 s |
| **`C-BOOT`** (host HTTP up on 3180) | 05:54:11.316 | **2.008 s** |
| `C-REMOTE-MOUNT-MARKER` (polls=2) | 05:54:11.574 | 0.258 s |
| `C-BLUEPRINT-SOURCE-GATE` | 05:54:11.638 | 0.064 s |
| `C-READINESS-BARRIER` (polls=2) | 05:54:13.172 | 1.534 s |
| `C-CREATE-ONCE` (initialize readback) | 05:54:13.237 | 0.065 s |
| `C-OPTIONAL-PROBES` (not run) | 05:54:13.241 | 0.004 s |
| **`C-LEADER-MEMBERS`** (the one public chain call) | 05:54:15.274 | **2.033 s** |
| `child-exit` / `port-free-after-stop` / `teardown` | 05:54:15.406 → 15.411 | 0.137 s total |

Derived, with the honest limits:

- traced span, first leg → teardown: **6.117 s**;
- monitor-recorded span, `startedAt 05:54:08.798` → `end.elapsedMs 22183` (child-exit event
  `05:54:30.288`, monitor exit `05:54:31.002`): **22.183 s**;
- **the ~14.9 s between the runner's last traced leg (15.411) and its own exit (30.288) is
  `UNKNOWN` — the receipt does not attribute it.** Candidate explanations exist (mock/world
  teardown, report flush) and none is evidenced; writing one as fact would be the exact error this
  file exists to avoid;
- therefore the whole 22.2 s is a **window span, not a cold-start performance number** (root's
  instruction, and the data agrees: it contains boot, mount, gate, readiness polls, create, one call
  and teardown, plus an unattributed tail);
- the only two numbers with the shape of a measurement are `C-BOOT` **2.008 s** and the public chain
  leg **2.033 s**, each n = 1, each on a scripted mock, each on a shared host;
- permission-facts cost is **not measured** and is known-perturbed: the authority warm-up faulted in
  this very window (`facts healthy: false`);
- `PA` / durable permission consumption: **NOT_VERIFIED** (the mount line says durable authority is
  active, the warm-up line says its facts are unhealthy — the pair is exactly why "active" cannot be
  read as "consumed");
- C2 coverage: this window is one public positive pair; **it is not C2**.

**Still open for EB0-5 (do not close these by re-reading this file):**

- **no p50/p95, and no same-platform selector study.** A performance baseline needs repeated runs on
  one platform with a stated selector; what exists is single samples. Producing the distribution
  needs worlds and load, which root has not ordered and this line will not manufacture to fill a row;
- n = 1 for boot, the public chain leg, the install receipts and the capacity samples;
- the ~14.9 s unattributed tail above;
- no warm/hot pair: there is no second run on the same fixture to compare against, so even "cold vs
  warm" is not established, only "one window";
- shared-host noise is unquantified (`dfAvail` moves with other tenants).

`UNKNOWN` rows deliberately left un-filled rather than estimated: repeated-run variance, teardown
tail attribution, per-tool coverage beyond `team_list_members`, PA/durable consumption, real-host
C2 integration, and any resource cost of the 94 controls under CI (they do not run there).
