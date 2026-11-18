# B4 — the five collected host-dependent suites (48 → 43 uncollected)

**Dated:** 2026-11-18 (real UTC) · **Branch:** `task/tinf-next-20261116` · **Worktree:** `.worktrees/tinf-next-20261116`
**Base:** `origin/master` @ `b7276ffa7` (B3 landed, 48 uncollected)
**Host:** `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`, native assets
provisioned from the pinned published package `@deepseek-ai/node-addon-system-linux-x64@0.1.2`.
**Scope of this delivery:** 5 of the audit's **18** host-dependent files (`docs/plans/memo/uncollected-audit-20261115/`
§6.1). This is a partial delivery, named as such: batches 1 and 2 landed; the remaining 13 are listed in §5 with the reason.

## 1. Where they run, and why there

`ci-integration` provisions **no** host — it is `hostFree`. A host-resolving suite there would have to
skip on absence, which is the exact false-green this milestone removes. So the honest shape is **(a)**:
graded steps in the job that already provisions and builds the pinned host, `census-runtime` (layer
`ci-census`), each with its own bounded `timeout-minutes` and its own manifest leg:

| batch | boundary | step (`census-runtime.yml`) | manifest leg | timeout | measured wall (host present) |
| --- | --- | --- | --- | --- | --- |
| 1/2 | **Subprocess** — PTY contract + subprocess contract | `B4/1 subprocess boundary …` | `b4/1 subprocess boundary …` | 15 min | 26.9 s |
| 2/2 | **Web / attachment** — confined web contract, product web row, `read_image` face | `B4/2 web + read_image face …` | `b4/2 web + read_image face …` | 10 min | 1.0 s |

Each leg declares `env: {"A5SF_REQUIRE_PINNED_HOST": "1"}` and the step sets the same value, so
`eb3-ci-required` grades the two copies (`CI_LAYER_LEG_ENV_MISSING` otherwise). The two batches are
separate steps so a red names WHICH boundary broke; they are separate manifest legs for the same reason.

## 2. Missing host = red, proved twice

`measurements.txt` is the machine evidence: every row is a real `node --test` invocation with
`A5SF_REQUIRE_PINNED_HOST=1`, and `pass/fail/skipped` are read from the reporter.

**Shape 2 is the absent-host proof**: the host tree is bind-mounted EMPTY (`unshare -m -r`,
`host-tree-entries=0`). Every one of the five exits **1**:

| suite | host present | host tree EMPTY | the named refusal / failure |
| --- | --- | --- | --- |
| `a5sf-pty-contract` | 15/15, 396 ms | **exit 1**, 0 pass / 1 fail | `A5SF-PTY-CONTRACT-HOST-INCOMPLETE: … missing terminalService=…/packages/terminal/terminal/lib/index.js, agentRegistry=…` |
| `a5sf-sub-contract` | 15/15, 26 326 ms | **exit 1**, 0 pass / 1 fail | `A5SF-SUB-CONTRACT-HOST-INCOMPLETE: … missing upstreamSubprocess=…/packages/subprocess/subprocess/lib/index.js, …` |
| `a5sf-web-contract` | 10/10, 425 ms | **exit 1**, 0 pass / 1 fail | `A5SF-WEB-CONTRACT-HOST-REFUSED the pinned host checkout is absent or incomplete (missing packages/web/web/lib/index.js, packages/web/tool-web/lib/index.js …)` |
| `a5sf-web-row` | 10/10, 445 ms | **exit 1**, 0 pass / 1 fail | `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '…/packages/web/web/lib/index.js' …` |
| `a5sf-pd31-read-image` | 7/7, 140 ms | **exit 1**, 4 pass / **3 fail** | the three arms that read the pinned host |

The second flag-side proof: for the two suites that *own* a declared refusal
(`a5sf-pty-contract` / `a5sf-sub-contract` report `…-HOST-REFUSED … verdict=NOT_RUN` when the flag is
unset), `A5SF_REQUIRE_PINNED_HOST=1` is the switch that turns that `NOT_RUN` into the failure above —
which is why the flag is both declared on the leg and set on the step. For `a5sf-web-row` no flag is
needed: the refusal is a module-load `ERR_MODULE_NOT_FOUND`, i.e. structurally un-skippable.

**No skip-on-missing-input path was introduced.** None of the five files was edited.

## 2b. The hosted L2 found one machine-specific assertion pair (fixed 2026-11-18)

The first hosted run of B4/1 (Actions run 44343691531, on `b87adf358`) went red **deterministically**:
the runner's Landlock is ABI v8, its probe answers `network-destination=unsupported`, and the product
therefore refused the `network=deny` lane **before spawning anything** (`NETWORK_UNCONFINED_REALM`).
Two `a5sf-sub-contract` P3 arms had pinned a v7 box's answer (`enforced`, admission) and called the
product's safe refusal a failure. **The product was right; the arms were machine-specific.**

They now assert the PAIRING: `enforced` ⇒ admitted once + kernel errno in a distinct netns; `unsupported`
⇒ refused before spawn with `NETWORK_UNCONFINED_REALM` and `spawns.after === 0`; `enforced` with no
mechanism, or an empty note, stays red; a deny lane is never silently allowed. Both halves run on every
host — the hosted capability is injected at the provider seam (`capabilityOverride`, probe only), so a v7
box proves the refusing half end to end and a v8 runner proves the admitting half. B4/1 is now
**32/32** (15 pty + 17 sub-contract). Full transcript and reasoning:
`dev/agent-workflow/evidence/hosted-l2-20261118/README.md`.

## 3. Stale assertions: none found, nothing updated

All five pass unchanged against the pinned host. Nothing was re-pinned, relaxed, or deleted to make a
suite collectable, and no expectation was mechanically updated. (This is the "investigate first" outcome:
the old behaviour and the assertions agree on this host.)

## 3b. The CI checkout shape

`../m7b1-observation-window-20261116/ci-shape.txt` records the same two batches inside a **full clone
of the pushed head** (`git clone`, 2859 commits, porcelain 0) with its own `pnpm install
--frozen-lockfile` + build, the pinned host fetched by exact SHA and built, and the assets provisioned
from the pinned published package: **B4/1 32/32 in 27 s**, **B4/2 27/27 in <1 s**. A fresh clone there
carries no usable native assets, which is the CI fact the `host-sandbox assets` step exists for.

## 4. The ratchet

`dev/ci/uncollected-baseline.json` was regenerated with
`node scripts/test-catalog.mjs --write-uncollected-baseline` (never by hand): **48 → 43**, exactly the
five files above, and `--max-uncollected 43` passes. The catalog also reported the five as
`UNCOLLECTED_FIXED … now collected — regenerate the baseline in the same PR` before the regeneration.

## 5. What stayed out, and why

The audit's remaining **13** host-dependent files are untouched by this PR:

- `tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs`, `a5sf-pd17-fs-read-axis`, `a5sf-pd19-fact-attribution`,
  `a5sf-tool-axis`, `a5sf-pd21-subagent`, `a5sf-pd23-control-surface`, `a5sf-pd24-surface-ledger`,
  `a5sf-pd25-unbounded-turn` — **Realm / surface boundary**. These keep most arms and red only their positive
  control when the host is absent, so they need a per-file investigation of WHICH arm is the host
  dependency before they can be declared a red-on-absence suite rather than a mixed one.
- `tests/world-factory/a5sf-web.test.mjs`, `a5sf-pd18-web-ptc`, `a5sf-pd27-confined-web`, `a5sf-pd29-service-seam`
  — **Web egress / service seam**; the audit measured them mixed as well.
- `tests/world-factory/host-sandbox-assets.test.mjs` — **provisioning** boundary: it needs a *trusted local
  runtime tree* (`/srv/workspace/...` in the audit's environment), which a hosted runner does not have. It is
  the provisioner's own test, so binding it to a local tree is the wrong shape; it needs its own decision.

Each of those is a batch of its own (one security boundary each), to be landed the same way: a graded step
in `census-runtime`, a truthful manifest leg with `hostFree: false`, `env`, `why`, and a two-shape
measurement recorded here.
