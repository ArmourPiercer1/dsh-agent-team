# M7-B1 + B4 — a trusted observation window owned by the World Factory, and five host-dependent suites in CI

> **Dated:** 2026-11-18 (real UTC) · **Base:** `origin/master` @ `b7276ffa7` · **Branch:** `task/tinf-next-20261116`
> · **Worktree:** `.worktrees/tinf-next-20261116` · **Draft PR:** #786
> **Host:** `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2), native assets
> provisioned from the pinned published package `@deepseek-ai/node-addon-system-linux-x64@0.1.2`.
> **CORE PATCH BUDGET = 0:** nothing upstream was touched; the extension lives in this repo's vNext testkit.

## 1. The defect M7-B1 closes

M7-A put the Contract Oracle in front of a real DSH execution chain — and the **suite** decided what
the witness watched, which paths were authorized, and when the window opened and closed. The
observation made its own rules. The failure mode is not hypothetical: the oracle can only refuse a
contract whose required scope the instrument did not watch *if the contract declares that scope*, and
M7-A's suite declared it from the same code that opened the window. A partial watch could therefore
corroborate a claim about "the filesystem" with nothing between the claim and the verdict.

M7-B1 moves the five decisions into `tests/world-factory/lib/m7b1-observation-contract.mjs`, which the
World Factory owns, and validates every one of them **before an instrument exists**.

## 2. The contract, field by field

| field | declared by | refused as |
| --- | --- | --- |
| `world_id` | the `TestWorldFactory` World object (`world.id`, owned `home`) | `IDENTITY_INVALID` |
| `agent_id` | the real Agent Session id | `IDENTITY_INVALID` |
| `execution_id` | the scripted tool-call id, **asserted** against the Host's durable `tool/call.execution_id` | `IDENTITY_INVALID` |
| watch scope | `scope: [...]`, absolute and symlink-**resolved**; a symlinked root is refused at declare time and re-resolved at open time | `SCOPE_EMPTY` / `SCOPE_NOT_ABSOLUTE` / `SCOPE_SYMLINK` / `SCOPE_UNRESOLVABLE` / `SCOPE_DOES_NOT_COVER` |
| claim | `path-scope` or `filesystem-domain` | `SCOPE_PARTIAL_FOR_DOMAIN` (a domain claim never passes over a partial watch) |
| window | `openObservationWindow()` (`pre`) → `closeObservationWindow()` (`post`), one instrument, one `window_id` | `WITNESS_NOT_ARMED` / `WITNESS_NOT_WINDOWED` |
| provenance | the testkit row seal **extended** with the window record (`producedBy`, `armedAt`, `closedAt`) | `WITNESS_NOT_SEALED` / `WINDOW_MISMATCH` |

`openObservationWindow` also verifies the host state the observation is only meaningful on:
`HOST_ABSENT`, `HOST_TREE_UNPINNED` (HEAD vs `tests/paths.mjs`), `HOST_ASSETS_UNPROVEN` (the two
native sandbox assets vs the committed sha256 pin). These are the preconditions under which a
"denial" would otherwise be an environment fact wearing the product's name.

**Provenance was extended, not duplicated.** The row seal stays where it was (`WeakMap` in
`packages/testkit/src/effect-witness.ts`); the window half was added in the same file with the same
discipline (`WINDOWS` brand, `INSTRUMENT_WINDOW` mapping), and the oracle gained exactly one field,
`requiredObservationWindowId`. `packages/testkit/test/m2-{effect-witness,contract-oracle}.test.ts`
still pass unchanged (46/46), which is the evidence that the extension did not move the old law.

## 3. Real pinned host — 7/7, 80.2 s (boot 77.8 s)

Arms: A1 authorized write → `SATISFIED` (effect reported AND excluded); A2 outside write →
`VIOLATED` with the exact path; A3 same-directory-as-the-harness write → `VIOLATED` on the sibling
alone while the harness's own file stays `authorized`; A4 verbatim `FS_SANDBOX_DENIED` captured from
the Host's durable trace; A5 forged row with the correct window id → `INSTRUMENT_ERROR`; A6 sealed row
from another window → `INSTRUMENT_ERROR`.

The A3 arm is the one a directory-shaped watch cannot pass: the harness writes its own file **inside
the window**, in the same directory, and the tool writes a sibling. One directory, two rulings, both
produced per-entry.

## 3b. Review round 1 (three blocking holes, one medium) — closed in the module

- **B1 identity.** `checkWindowBinding` compares the window's `world_id`/`agent_id`/`execution_id`
  with the contract's, and the contract's `execution_id` must be carried by a `tool/call` or
  `tool/result` event in the host's durable trace (the oracle gained `requiredExecutionId` and faults
  when no event carries it). A caller-mutated id is refused by the module:
  `M7B1-MUTATED-EXECUTION_ID verdict=INSTRUMENT_ERROR reason=IDENTITY_MISMATCH`,
  `M7B1-MUTATED-AGENT_ID … IDENTITY_MISMATCH`, `M7B1-NO-TRACE … EXECUTION_ID_NOT_IN_TRACE`.
- **B2 window seal.** `OPENED`/`CLOSED` private `WeakSet`s keyed on object identity; `close` and
  `judge` consult `isSealedObservationWindow`; `closeObservationWindow` refuses an envelope or an
  instrument it did not produce. Spread / `Object.create` / `structuredClone` copies of the record,
  copies of the envelope, a foreign instrument closing the window, and a second close are all
  `WITNESS_NOT_SEALED`. A second module instance's record is refused by this instance.
- **B3 lifecycle.** `phase === 'post'` with a non-blank `closedAt` is required before judgement:
  judging the armed window is `INSTRUMENT_ERROR`, and the rule itself answers `WINDOW_NOT_CLOSED`.
- **M1 `/`.** `/` is refused as a watch root, so no scope can establish a `filesystem-domain` claim;
  every domain claim is `SCOPE_PARTIAL_FOR_DOMAIN` — the `scope:['/'] … ACCEPTED` shape is gone.

`checkWindowBinding` is pure, so these rules are re-proven on every run including with the host tree
EMPTY (`host-absent.txt`). Host present: **10/10 in 75.8 s**.

**On the reviewer's parity nit.** Converting the three census steps to `suites[]` + `--leg` was
measured and REVERTED: `--parity --old-ref e5bf05670` then reports **problems=3** (`UNCONVERTED step
"B4/1 …" / "B4/2 …" / "M7-B1 …" dispatches … but had no node --test argv on the old side`), because a
brand-new dispatch step has no old-side argv at a fixed base — the trap this repo already documented
in the B3 leg's `why` ("a new dispatch step has no `node --test` argv at the parity base
(`e5bf05670`) … `--parity` could not stay at problems=0"). Nothing in `census-runtime.yml` is a
dispatch step: every census leg (M7-A included) is a graded `cmd`+`check[]` argv, which
`eb3-ci-required` compares token-for-token, so the workflow and the manifest cannot drift. Changing
that shape for three legs requires a ruling on either the parity base ref or the UNCONVERTED rule
(a rename is already caught by the other branch of the same check), which is above this task.

## 3c. The hosted L2 found the one thing local evidence could not (2026-11-18)

The GitHub Actions run on `b87adf358` (run 44343691531) went red in **B4/1**, deterministically. The two
P3 network arms had pinned ONE host's capability and were therefore machine-specific:

- `P3-PROBE-SHAPE` demanded `enforced`. The runner's Landlock is ABI v8, and its own probe note says
  *"landlock ABI v8: Landlock ABI v4 mediates only TCP port bind/connect inside the domain"* — so the
  probe answers `unsupported`, correctly.
- `P3-DENY-KERNEL-REFUSED` demanded admission. Because the capability is `unsupported`, the product
  refused **before any process was created** with `NETWORK_UNCONFINED_REALM` — the safe answer, and the
  one the arm called a failure.

**The product was right; the assertion was wrong.** Both arms now assert the *pairing*, which is the
contract and holds on any kernel:

| capability | probe must be | deny lane must be |
| --- | --- | --- |
| `enforced` | mechanism matching `netns` **and** a realm-bound `evidence://` row (realmId + trustRoot + the measurement note) | admitted **once**, child runs in a distinct netns, kernel errno on the connect |
| `unsupported` | **no** mechanism, **no** evidence, and a note that **names the gap** (the ABI text) | refused **before spawn**: `NETWORK_UNCONFINED_REALM`, `spawns.after === 0`, nothing ran |

Red in both directions: `enforced` with no mechanism (the pre-BL-42 shape) is a capability *claim*, not an
observation; and a network=deny lane is never silently allowed. Both halves are exercised on every host —
the hosted ABI-v8 capability is injected at the provider seam (`capabilityOverride`, probe only, the spawn
path stays the product's), so a v7 developer box proves the refusing half end to end and a v8 runner
proves the admitting half. Local: **17/17**, including `P3-PROBE-SHAPE (hosted capability simulated)`
and `P3-DENY-REFUSED-BEFORE-SPAWN (hosted capability simulated)`. The manifest's `why` for the leg now
records the pairing and quotes the hosted transcript.

## 3d. Merged onto master `b28728fef` (#788) — the numbers, from tools

`origin/master` was merged in (`554dbe1a5`), no force-push. Uncollected went **46 → 41**
(`test-catalog --write-uncollected-baseline`, the tool's own number: master's 46 minus the five suites this
branch collects). `tinf-instruments` stays at **50** and the census layer grew **5 → 8** legs, because the
five suites collected here are host-dependent and `tinf-instruments` lives in the host-free
`ci-integration` lane — collecting them there would make that layer's `hostFree:false` claim a lie. Three
new `ci-census` legs (`b4/1` 2 suites, `b4/2` 3, `m7b1` 1) carry them in the one job that provisions the
host.

Two resolutions were not textual and are worth remembering:

- **The manifest auto-merge was silently wrong.** master's `eb3-ci-manifest.json` is generated JSON
  (`ensure_ascii=False`); this branch had once re-serialised it, so git could not isolate hunks and the
  auto-merge dropped master's per-suite `hostRefusal` blocks. Rebuilt from master's bytes plus the three
  legs: the diff is now 55 insertions / 0 deletions.
- **#788's derived-marker guard did its job.** `C10e` refused this branch's `M7B1_REQUIRE_PINNED_HOST` /
  `M7B1_HOST_TREE` (`CI_HOST_REFUSAL_MARKER_UNLISTED`); both are now registered in the frozen lists and
  the negative controls are 32/32 again.

Merged-tree gates: catalog **41** (and `--max-uncollected 40` refuses `UNCOLLECTED_GREW`), catalog test
26/26, `dispatch --check` legs=18 bad=0, parity **problems=0** (union 69, digest unchanged) re-derived in
the clone that carries `e5bf05670`, ci-required findings=0, controls 32/32, census-plan 50/50,
census-cutover 41/41, docs-sync clean, lint new 0 / resolved 0, typecheck clean, testkit 512/512. In the
fresh clone the three census steps ran in one job: **B4/1 32/32 (26.4 s), B4/2 27/27 (0.5 s), M7-B1 10/10
(94.0 s)**.

## 3e. Hosted L2 green on the first merged head, then merged `82091ae4a` (#787)

The hosted L2 on `1922d957b` (master `b28728fef`) passed **all three census steps in one job, in order**
(M7-B1 10/10 with `M7B1-ARM inside-authorized verdict=SATISFIED unauthorized=[]` and named refusals for
every forged shape; M7-A still `VERIFIED`), and **B4/1 on the ABI-v8 runner** printed
`✔ P3-PROBE-SHAPE (capability-paired) … OR unsupported WITH a note naming the ABI gap` and
`✔ P3-DENY-KERNEL-REFUSED (capability-paired): … unsupported ⇒ refused BEFORE SPAWN with
NETWORK_UNCONFINED_REALM and zero children`. The capability pairing is therefore confirmed by the
environment that broke the old assertion — not by simulation.

Then `#787` landed (`82091ae4a`: second pinned host, `excluded-baseline.json`, `--max-excluded`) and the
branch was merged again (head `6bea34a98`, no force-push). Re-derived: uncollected **41** (regenerated,
#787's floor was 46 and collects nothing here), `test-catalog.test.mjs` byte-identical to master and
**28/28**, the ratchet line tightened from `--max-uncollected 46 --max-excluded 9` to
`--max-uncollected 41 --max-excluded 9` (a ratchet may only go down), the manifest diff against master
still **55 insertions / 0 deletions** with three `hostRefusal` blocks intact, and `excluded-baseline.json`
still **9 entries** — none of them one of this branch's five suites. In the CI-shape clone: **B4/1 32/32
(26.5 s), B4/2 27/27 (0.5 s), M7-B1 10/10 (88.7 s)**, parity `problems=0`, controls 32/32.

## 4. Host absent — two answers, no green path

| shape | result |
| --- | --- |
| host tree bind-mounted EMPTY, flag unset | exit 0; 6 pass / 1 skipped; graded line `M7B1-WINDOW verdict=INSTRUMENT_ERROR reason=HOST_ABSENT` |
| same, `M7B1_REQUIRE_PINNED_HOST=1` | **exit 1**: `M7B1-HOST-ABSENT: …/apps/cli/lib/bin.js is absent but M7B1_REQUIRE_PINNED_HOST=1` |

## 5. B4 — what landed, and what did not

Landed: **batches 1 and 2**, 5 suites, 48 → 43 uncollected, both in `census-runtime` (`ci-census`),
each its own bounded step and manifest leg, `A5SF_REQUIRE_PINNED_HOST=1` on both sides.
Host-present: 15/15, 15/15, 10/10, 10/10, 7/7. Host tree EMPTY: all five exit 1 with a named refusal
(or, for `a5sf-web-row`, an `ERR_MODULE_NOT_FOUND` that cannot be skipped). No suite was edited: all
five pass unchanged, so there was no stale assertion to investigate.

Not landed (13), each needing its own batch and two-shape measurement: Realm/surface (`pd15`, `pd17`,
`pd19`, `tool-axis`, `pd21`, `pd23`, `pd24`, `pd25`), Web-egress/service-seam (`web`, `pd18`, `pd27`,
`pd29`), provisioning (`host-sandbox-assets`, which needs a trusted local runtime tree a hosted runner
does not have).

## 5b. Proven in the CI checkout shape, not only in the worktree

`dev/agent-workflow/evidence/m7b1-observation-window-20261116/ci-shape.txt`: a **full clone**
(`git clone --branch …`, 2861 commits, porcelain 0, HEAD == `92940605c2`, which also carries the parity
base `e5bf05670` so `--parity` is run in it: `problems=0`), its own `pnpm install
--frozen-lockfile` + build, the pinned host fetched by exact SHA and built, the native assets
provisioned from the pinned published package (`54a9c25c…` = the pin) — then the three graded argv
lines exactly as the job runs them:

| step | result | wall |
| --- | --- | --- |
| M7-B1 (`M7B1_REQUIRE_PINNED_HOST=1`) | 10/10 | 94 s |
| B4/1 subprocess (`A5SF_REQUIRE_PINNED_HOST=1`) | 30/30 | 27 s |
| B4/2 web + read_image | 27/27 | <1 s |

A fresh clone in that shape carries **no usable native assets**, so the `host-sandbox assets` step is
load-bearing: without it the observation window refuses (`HOST_ASSETS_UNPROVEN`) rather than grading an
unpinned backend. Disclosure: the clone tested `325e34ce28`; later commits on the branch touch only a
module doc comment and prose.

## 6. Evidence

- `dev/agent-workflow/evidence/m7b1-observation-window-20261116/` — `README.md`, `host-present.txt`,
  `host-absent.txt`.
- `dev/agent-workflow/evidence/b4-host-dependent-20261116/` — `README.md`, `measurements.txt`.
