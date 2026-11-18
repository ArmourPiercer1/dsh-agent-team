# M7-B1 — the World Factory owns the filesystem observation window

**Dated:** 2026-11-18 (real UTC 2026-11-18T14:1x) · **Branch:** `task/tinf-next-20261116` · **Worktree:** `.worktrees/tinf-next-20261116`
**Base:** `origin/master` @ `b7276ffa7` (B3 landed, 48 uncollected)
**Host:** `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2), native assets provisioned from
`@deepseek-ai/node-addon-system-linux-x64@0.1.2` (`HOST-ASSETS-PROVISIONED … files=2 host=639ed01539…`, receipt `.artifacts/tmp/host-assets/provision-receipt.json`).
**CORE PATCH BUDGET = 0:** no upstream source touched; the extension is in this repo's `packages/testkit` (vNext testkit, not upstream).

## 1. What moved, and why

M7-A proved one real tool chain can be graded by the Contract Oracle — but the **suite** decided what
the witness watched, which paths were authorized, and when the window opened and closed. That is the
observation making its own rules, and it is how a partial watch ends up corroborating a whole-domain
claim. M7-B1 moves those five decisions into a module the World Factory owns:

| field | where it is declared | what fails if it is missing |
| --- | --- | --- |
| `world_id` | `declareObservationContract({world})` — the `TestWorldFactory` world | `IDENTITY_INVALID` |
| `agent_id` | the real Agent Session id | `IDENTITY_INVALID` |
| `execution_id` | the real scripted tool-call id, **asserted** against the Host's durable call id | `IDENTITY_INVALID` |
| watched FS scope | `scope: [...]` — absolute, symlink-**resolved**; a symlink root is refused, and re-resolved at open time | `SCOPE_EMPTY` / `SCOPE_NOT_ABSOLUTE` / `SCOPE_SYMLINK` / `SCOPE_UNRESOLVABLE` / `SCOPE_DOES_NOT_COVER` / `SCOPE_PARTIAL_FOR_DOMAIN` |
| observation window | `openObservationWindow()` (phase `pre`) → `closeObservationWindow()` (phase `post`, `closedAt`) — one instrument, one window, same `window_id` | `WITNESS_NOT_ARMED` / `WITNESS_NOT_WINDOWED` |
| witness provenance | the testkit's row seal (**extended**, not duplicated) + the window record (`producedBy`, `armedAt`, `closedAt`, `window_id`) | `WITNESS_NOT_SEALED` / `WINDOW_MISMATCH` |

**Fail closed, by name.** `openObservationWindow()` returns `{ok:false, verdict, reason, detail}` — it
never throws for a precondition, so a caller cannot turn "could not establish" into a bare red without
naming it. A window that could not open/close is returned by `judgeObservationWindow()` as ITS verdict
(`INSTRUMENT_ERROR`), never `SATISFIED`. A `claim: 'filesystem-domain'` over a partial watch is refused
at declare time (`SCOPE_PARTIAL_FOR_DOMAIN`) — a partial watch can never corroborate a domain claim.

**Provenance is identity, extended in place.** The testkit already kept row identity in a private
`WeakMap`. M7-B1 adds the window half **in the same module**
(`createFsWitness({window})`, `observationWindowOf`, `isSealedObservationWindow`,
`closeObservationWindow`) and the oracle gains one field, `requiredObservationWindowId`. Consequences
pinned by arms A5/A6: a hand-built row carrying the *correct* window id is `INSTRUMENT_ERROR`, and a
real sealed row from *another* window is refused because its `window_id` is not this contract's.

## 2. The three negative-control lines, verbatim

From `host-present.txt` (unmodified reporter output, `ℹ ` prefix stripped):

```text
M7B1-ARM inside-authorized verdict=SATISFIED expected=SATISFIED unauthorized=[]
M7B1-ARM outside-authorized verdict=VIOLATED expected=VIOLATED unauthorized=["/home/armourpiercer/projects/dsh-agent-team/.worktrees/tinf-next-20261116/tests/homes/u5m7b1-20261118T14-14-12Z/m7b1-tmp/m7b1-watched/beside.txt"]
M7B1-ARM same-directory-as-harness verdict=VIOLATED expected=VIOLATED unauthorized=["/home/armourpiercer/projects/dsh-agent-team/.worktrees/tinf-next-20261116/tests/homes/u5m7b1-20261118T14-14-12Z/m7b1-tmp/m7b1-harness/beside-harness.txt"]
```

and the denial the Host itself emitted (A4), captured from its durable session trace — not fabricated:

```text
M7B1-DENIAL FS_SANDBOX_DENIED error_code=FS_SANDBOX_DENIED outcome=DENIED message="Error: [sandbox: file access denied under workspace-write mode] [sandbox: escalation available — retry this exact operation once with sandbox_permissions (the narrowest wider mode that suffices) + justification; the approval prompt asks the user]"
```

Why the third line is the one that matters: the harness wrote **its own** file
`m7b1-harness/harness-own.json` **inside the window**, and the tool wrote a sibling
`m7b1-harness/beside-harness.txt` **in the same directory**. The contract authorizes the harness's file
path and forbids the sibling path; the verdict reports the sibling alone and classifies the harness's
write as authorized. A directory-shaped watch (or one that treats "the harness uses this directory" as
its own business) cannot produce that pair of answers.

## 2b. Review round 1: three holes closed at the MODULE, and M1

Review of draft #786 found the seal only half-live (rows sealed, window record not; the
`opened`/`closed` envelopes were caller-supplied), identity only pinned by the test, and the
lifecycle unenforced. The fixes are in `m7b1-observation-contract.mjs` (plus one oracle field),
and each is proven by MUTATING the caller side and getting a named refusal:

| hole | fix (where) | mutation, and the refusal the module returned |
| --- | --- | --- |
| **B1** identity not bound | `checkWindowBinding` compares window↔contract on world/agent/execution, and the contract's `execution_id` must appear on a `tool/call`/`tool/result` event (the oracle now also takes `requiredExecutionId` and faults when the trace never carried it) | `M7B1-MUTATED-EXECUTION_ID verdict=INSTRUMENT_ERROR reason=IDENTITY_MISMATCH detail=the window is bound to execution_id="m7b1-2" but the contract declares "exec-mutated-by-the-caller"…` · `M7B1-MUTATED-AGENT_ID … reason=IDENTITY_MISMATCH …` · `M7B1-NO-TRACE verdict=INSTRUMENT_ERROR reason=EXECUTION_ID_NOT_IN_TRACE detail=… no tool/call or tool/result event … carries it` |
| **B2** window seal not checked | `OPENED`/`CLOSED` private `WeakSet`s keyed on OBJECT IDENTITY, `isSealedObservationWindow` now consulted by `close` and `judge`, `closeObservationWindow` refuses anything it did not arm | `M7B1-SPREAD-WINDOW verdict=INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED` · `M7B1-OBJECT-CREATE-WINDOW … WITNESS_NOT_SEALED` · `M7B1-STRUCTUREDCLONE-WINDOW … WITNESS_NOT_SEALED` · `M7B1-SPREAD-ENVELOPE … WITNESS_NOT_SEALED` · `M7B1-FOREIGN-CLOSE ok=false reason=WITNESS_NOT_SEALED` · `M7B1-RECLOSE ok=false reason=WITNESS_NOT_SEALED` |
| **B3** lifecycle unenforced | `checkWindowBinding` requires `phase==='post'` **and** a non-blank `closedAt` before any judgement | `M7B1-UNCLOSED verdict=INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED` (judging the armed window) · `M7B1-WINDOW-NOT-CLOSED reason=WINDOW_NOT_CLOSED detail=window win-… is phase=pre closedAt=null; a verdict needs the POST snapshot…` |
| **M1** `/` bypassed the domain refusal | `/` is refused as a watch root, so no scope can establish a `filesystem-domain` claim; every such claim is `SCOPE_PARTIAL_FOR_DOMAIN` | the two `scope:['/']` cases (domain claim **and** `authorizedPaths:['/etc/passwd']`) are now refused at declare time — the `ACCEPTED` shape is gone |

`checkWindowBinding` is a pure function, so the identity/lifecycle/trace rules are proven on EVERY
run, host or no host (`host-absent.txt` shows the same refusal lines with the tree empty). The row
seal is proven separately in `witnessed` mode through the oracle (`M7B1-ROW-SEAL verdict=
INSTRUMENT_ERROR reason=WITNESS_NOT_SEALED`), and a SECOND module instance's window record is
refused by this instance (its private registry is a different one) — so the seal is identity, not
shape, at both layers.

**Unchanged and re-verified:** A1–A3 controls and the verbatim `FS_SANDBOX_DENIED` trace text, the
old testkit suites (46/46), host-absent `INSTRUMENT_ERROR` + exit 1 with the flag, and the
`ci-census` leg grading in `eb3-ci-required`.

## 3. The two runs

| run | shape | result | wall |
| --- | --- | --- | --- |
| host PRESENT | pinned host + pinned assets, `M7B1_REQUIRE_PINNED_HOST=1` | **10/10 pass** (8 fail-closed/binding + the real-host test), arms A1–A9 all as pre-registered | **75.8 s** (`bootMs` ≈ 73 s), file `host-present.txt` |
| host ABSENT, flag unset | host tree bind-mounted EMPTY (`unshare -m -r`, 0 entries) | exit 0: **9 pass / 1 skipped**, and the graded refusal line `M7B1-WINDOW verdict=INSTRUMENT_ERROR reason=HOST_ABSENT` | ~1 s, file `host-absent.txt` |
| host ABSENT, flag set | same empty tree, `M7B1_REQUIRE_PINNED_HOST=1` | **exit 1**, `M7B1-HOST-ABSENT: …/apps/cli/lib/bin.js is absent but M7B1_REQUIRE_PINNED_HOST=1` | ~1 s, file `host-absent.txt` |

So there are exactly two honest answers to a missing host — a *declared* `INSTRUMENT_ERROR` or a hard
red — and no third path on which the window goes green.

## 3b. The CI checkout shape — the same three steps, in a FULL clone of the pushed head

`ci-shape.txt` is the whole transcript. Shape: `git clone --branch task/tinf-next-20261116
https://github.com/ArmourPiercer1/dsh-agent-team.git` (full history, **2859 commits**, porcelain 0,
HEAD == the pushed head `325e34ce28`), `pnpm install --frozen-lockfile` (a warm local pnpm store was
used only to cut install time; the lockfile is frozen, so the dependency set is a cold CI's), repo
`build` + `build:composition` (exit 0), the pinned host fetched by exact SHA from the public remote
(detached, porcelain 0) and built with the workflow's `TEST_METHODS §2` chain, then the native assets
provisioned from the pinned published package (`bin/glibc/system.node` = `54a9c25c…` = the pin).

| graded step | argv | result | wall |
| --- | --- | --- | --- |
| M7-B1 | `M7B1_REQUIRE_PINNED_HOST=1 node --test --test-force-exit --test-timeout=1200000 --test-reporter=spec tests/world-factory/m7b1-observation-window.test.mjs` | **7/7 pass**, arms A1–A6 identical to the worktree run | **93 s** (`bootMs=89645`) |
| B4/1 | `A5SF_REQUIRE_PINNED_HOST=1 … --test-timeout=600000 … a5sf-pty-contract.tests.mjs a5sf-sub-contract.test.mjs` | **30/30 pass** | **27 s** |
| B4/2 | `A5SF_REQUIRE_PINNED_HOST=1 … --test-timeout=300000 … a5sf-web-contract a5sf-web-row a5sf-pd31-read-image` | **27/27 pass** | **<1 s** |

A fresh clone in this shape carries **no usable native assets** — which is exactly why the
`host-sandbox assets` step precedes both graded steps, and why a run without it fails closed
(`HOST_ASSETS_UNPROVEN`) instead of grading an unpinned backend.

**Disclosure:** the head tested in this clone is `325e34ce28`. The commits after it on this branch
touch only a module doc comment and this evidence/memo prose — no executable change. Every other number
in this file comes from the task worktree and is labelled as such.

## 4. Where CI grades it

`.github/workflows/census-runtime.yml`, step **`M7-B1 observation window — World-Factory-owned scope +
three FS negative controls (pinned host, absence is RED)`**, `timeout-minutes: 15`,
`M7B1_REQUIRE_PINNED_HOST=1`, `M7B1_BOOT_TIMEOUT_MS=600000`, run
`node --test --test-force-exit --test-timeout=1200000 --test-reporter=spec tests/world-factory/m7b1-observation-window.test.mjs`.

Declared as the `ci-census` leg **`m7b1 observation window …`** in `dev/ci/eb3-ci-manifest.json` with
the same `cmd` + `check` and the same `env` — `eb3-ci-required` grades the whole argv and the two-side
env declaration (`CI_LAYER_LEG_ENV_MISSING` otherwise). The step is **after** the pinned-asset
provisioning (it reads those bytes) and **after** the M7-A ledger, so neither the census argv nor the
M7-A step changes. No structural rule was weakened: `CI_LAYER_LEG_ENV_MISSING` and
`CI_HOST_REFUSAL_UNGUARDED` are untouched, and `hostFree` stays `false` for `ci-census`.
