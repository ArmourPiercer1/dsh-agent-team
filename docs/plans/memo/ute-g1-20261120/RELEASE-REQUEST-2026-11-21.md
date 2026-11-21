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
| `OldBaseline` | a reproducible (input → effect) table captured on the old path, two byte-identical captures, effects corroborated by an independent witness | **6 / 8** |
| `NewPathVerified` | every baseline vector **reproduced** on the new path | **2 / 8** (fs 16/16, search 15/15) |
| `SemanticDifferencesResolved` | every blocking difference carries a reference-bound owner approval | **0 / 8** (31 blocking differences, 31 × `approval: null`) |
| `NegativeControlsPass` | every retirement-unit member has a real control that turns RED when the mechanism is removed, plus a positive arm | **6 / 8** |

The honest summary is therefore: **the measurement programme is complete for eight of
the nine census families; the retirement decision programme has not started.** That is
not a failure of the work — it is the boundary the work was supposed to expose, and it
is now visible in one machine-readable place instead of in prose.

---

## 2. The migration / retirement matrix (master `1d64aeb45`)

| # | family | census id | unit | old files | baseline | new path | controls | blocking diffs | gate verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | fs | `dsh.fs-family` | 4/4 | 7 | ✅ | ✅ | ✅ | 2 | refused (semantic) |
| 2 | search | `dsh.search-family` | 2/2 | 9 | ✅ | ✅ | ✅ | 3 | refused (semantic) |
| 3 | web | `dsh.web-family` | 2/2 | 10 | ✅ | ❌ absent | ✅ | 3 | refused |
| 4 | inspect | `dsh.inspect-family` | 3 (single-impl) | 10 | ❌ n/a | ❌ | ❌ n/a | 1 | refused + `UTE_UNIT_UNGRADABLE` |
| 5 | process | `dsh.process-family` | 1/2 (`pwsh` excluded) | 11 | ✅ | ❌ absent | ✅ | 5 | refused |
| 6 | agent-control | `dsh.agent-control-family` | 7 covered | 14 | ✅ | ❌ absent | ✅ | 3 | refused |
| 7 | ui | `dsh.ui-family` | 2/2 | 9 | ✅ | ❌ absent | ✅ | 7 | refused |
| 8 | agent-state | `dsh.agent-state-family` | 5/5 | 7 | ✅ | ❌ absent | ✅ | 7 | refused |
| — | u6-probe | `dsh.u6-probe-family` | test-only | 0 | — | — | — | — | **out of scope, see §7** |

**Totals:** 20 booked members, 77 old-path source files, 31 blocking differences, 0
retireable families. Every file in the 77 exists (`checked`, this master).

Per-family evidence lives in `dev/agent-workflow/evidence/ute3-*/` and in the golden
tables under `tests/ute-g1-*/golden/`; the ledger rows carry the exact `expect` tokens
and `contradicts` assertions the gate grades, so a ledger edit that claims more than
its evidence shows is refused (`UTE_APPROVAL_UNREFERENCED`, `UTE_VECTOR_UNREPRODUCED`,
`UTE_MEMBER_UNCOVERED`, `UTE_UNIT_UNDERCLAIMED`).

### The two families that are closest to retireable

- **fs** — 16/16 vectors reproduced on the pinned rc.5 new path, 4/4 members, controls
  green (including the `unconfined-fs` mutation that turns a lane denial into a 70-byte
  allow). Its only blocker is the owner's signature on the refusal **shape** change
  (`FS_SANDBOX_DENIED` prose → typed `FS_PERMISSION_DENIED`), for which the technical
  route (B+C, closed refusal-category mapping) was already ruled on 2026-11-20.
- **search** — 15/15 vectors reproduced, 2/2 members, 12 controls. Its three blockers
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

**Group A — refusal surfaces (8 differences).** fs ×2, search ×1, web ×1, process ×1,
ui ×1, agent-state ×1. The old paths raise typed codes; the new paths either raise a
different typed code (fs), a generic text with the cause only in a guard fact
(search/web), or a different envelope entirely (ui/agent-state).

**Group B — the name-ownership question (5 differences).** `SD-WEB-1` (two claimants for
`web_fetch`/`web_search`), `SD-AGENTCTL-2` (native-name claim not graded),
`alias-to-native-name-change` (inspect), `SD-UI-two-implementations`,
`SD-AS-two-implementations`. In each, **the same spelling is declared twice** — by the
governed family body and by the pinned host package the Member preset already mounts.
A retirement cannot move a name whose owner is unnamed.

**Group C — the route question (4 differences).** `SD-AGENTCTL-1-route-c-unserved`,
`SD-UI-product-route-absent`, `SD-AS-product-route-absent`, `SD-PROCESS-3-pty-face-not-measured`.
The product route does not serve the family being retired (agent-control, ui,
agent-state), or serves a different face of it (the persistent-PTY bash definition is
never selected by the shipped wiring).

**Group D — behaviour that genuinely differs (10 differences).** `SD-SEARCH-1`
(path-less `grep` = 0 matches: a defect), `SD-SEARCH-2` (VCS-ignore policy),
`SD-WEB-2` (one call = three network effects on route C vs one bounded response),
`SD-PROCESS-1` (no truncation flag), `SD-PROCESS-2` (killed-vs-exit status),
`SD-PROCESS-5` (`pwsh` member unreachable), `SD-UI-*`/`SD-AS-*` result envelope,
state sink, present receipt turn, timed-pending shape.

**Group E — coverage the stage does not claim (4 differences).**
`SD-AGENTCTL-3-governed-admission-surface`, `SD-UI-refusal-vocabulary`,
`SD-AS-refusal-vocabulary`, `SD-PROCESS-4-refusal-surface`.

None of the 31 is a formatting nit that a reviewer could wave through: each one changes
what a caller (or a user) observes, or names a binding that does not yet have an owner.

---

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

## 6. Expected-deletable old code (77 files, by family)

Only after that family's §5 step is approved. `packages/tools/families/*.mjs` holds the
assembly row; `packages/tools/*-family/src/**` holds the body.

- **fs (7):** `families/fs.mjs`, `fs-family/src/{fs-family-contribution,fs-read-contribution,read-row,write-row,edit-row,image-row}.mjs`
- **search (9):** `families/search.mjs`, `search-family/src/{cancel-leg,glob-backend,index,search-backend,search-contribution,search-mechanics,search-row,stream-drain}.mjs`
- **web (10):** `families/web.mjs`, `web-family/src/{fetch-executor,fetch-row,index,search-executor,search-row,web-family-contribution,web-mechanics,web-search-provider,web-transport}.mjs`
- **inspect (10):** `families/inspect.mjs`, `inspect-family/src/{index,inspect-executor,inspect-family-contribution,inspect-mechanics,inspect-rows,row-names,skill-executor,skill-mechanics,skill-row}.mjs`
- **process (11):** `families/process.mjs`, `process-family/src/{bash-contribution,bash-normalizer.ts,bash-row,confined-shell-executor,index,pwsh-confined,pwsh-executor,pwsh-mechanics,pwsh-row,shell-mechanics}.mjs`
- **agent-control (14):** `families/agent-control.mjs`, `agent-control-family/src/{index,agent-control-contribution,agent-control-executor,agent-control-mechanics,agent-runtime-port,native-output-schemas,spawn-row,fork-row,steer-row,interrupt-row,list-agents-row,list-models-row,workflow-row}.mjs`
- **ui (9):** `families/ui.mjs`, `ui-family/src/{ask-executor,ask-row,index,present-executor,present-row,ui-family-contribution,ui-interaction-port,ui-mechanics}.mjs`
- **agent-state (7):** `families/agent-state.mjs`, `agent-state-family/src/{agent-state-law,contribution,executors,fs-state-store,index,state-store}.mjs`

**Not deletable, and this is the point of Group B/C:** deleting these 77 files does not
remove any capability a user can currently reach, because the product route serves the
host's rows, not these. A "retirement" that stops here would be a **false negative
deletion** — it would look like progress and change nothing observable.

---

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
