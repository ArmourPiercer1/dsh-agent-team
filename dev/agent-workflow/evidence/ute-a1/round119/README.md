# Round 119 — the real-model acceptance attempt on both hosts, and the key-inheritance control

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, base `b2f4b1a08`. Sole writer; no history
rewrite, no merge, no non-topic push. PR **#822 stays DRAFT**. `:3080` and its `DSH_HOME` were never
touched. **CORE PATCH BUDGET = 0**: both pinned hosts were read-only; no upstream source was patched.

**The one sentence:** the owner supplied the credential the round-111 probe named; the real route IS
available and both pinned hosts answered a real model turn (`deepseek-v4-flash`, HTTP 200) — but the
real-model **driver** aborts before its first judge (`world.mock.requests` is `null` without a mock), so
**acceptance was not achieved**, no row moves, and the remaining work is the driver's real branch.

## A. Credential discipline

- The key lives only in the repo-root `../../.env` (mode 600, outside this worktree). It was loaded per
  shell with `set -a; . ../../.env; set +a`, never `cat`-ed, never `echo`-ed, never `set -x`-ed, and
  unset at the end of every invocation.
- The driver reads it **by name** (`DEEPSEEK_API_KEY`); its probe records names only; the diagnostic
  recorder records request **bodies** (never headers). No value or fragment was written into any file,
  transcript, evidence artifact, commit message or PR comment.
- Mechanical self-check (`leakage-self-check.log`): `git grep -l -- "<value>" -- .` → nothing;
  `git status --porcelain` → no `.env`; `git ls-files` → no `.env`; `grep -rl -- "<value>"` over
  `dev/agent-workflow/evidence/` and `.artifacts/` → nothing.

## B. The two required runs — both exit 1, neither proven

```
set -a; . /home/armourpiercer/projects/dsh-agent-team/.env; set +a
TEAM_TEST_HOST=legacy node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
TEAM_TEST_HOST=next   node tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs --model real --boots 2
```

| host | pin | exit | boots | per-boot overall | agreement | duration |
| --- | --- | --- | --- | --- | --- | --- |
| legacy (rc.2) | `639ed01539` | **1** | 2/2 booted, both aborted after the first real turn | `ERROR` → RUN record `FAIL` | `agreeing=true differing=[]` | **200 s** |
| next (rc.5) | `9c2670d3bc` | **1** | 2/2 booted, both aborted after the first real turn | `ERROR` → RUN record `FAIL` | `agreeing=true differing=[]` | **31 s** |

Probe: the run wrote `level: REAL-ROUTE-AVAILABLE`, `available: true`, `missing: null` (preserved as
`../d-boot-feasibility/real-model/diagnostic/diagnostic3-root-artifacts/probe.json`; the root `probe.json`
stays the round-111 `ENV-LIMITED` record). **20/20 judges on
each host/boot are `FAIL`** with `detail.reason = "selected case produced no verdict (fail-closed)"`;
per-judge table in `../d-boot-feasibility/real-model/REAL-MODEL-ACCEPTANCE.md` §0.3.

**The four negative controls — deny, Stop, duplicated approval, restart-no-replay — were NOT REACHED.**
No typed reply exists for any of them; they are *not observed*, not *preserved as absent*.

Root cause (`run-real-model.mjs`):
`requests()` is `world.mock?.requests ?? []` (`:1913`) → under `--model real` it is `[]` → `:2156`
`leaderSurface = []` → `:2160` throws `the Leader surface lost 'team_delegate'`. Two further real-mode
gaps a fixed surface read would hit next: `sawReply()` returns `true` unconditionally in real mode
(vacuous turn gates), and every judge is keyed to the scripted mock's fixed call ids
(`call-d4-worker-write`, `call-rm-leader-collect`, …).

## C. What WAS measured on the real route (driver unchanged)

A pass-through recorder at the provider boundary (diagnostic only, never used as evidence of a judge):

- two real requests, both `POST /anthropic/v1/messages` → **HTTP 200**, model **`deepseek-v4-flash`**;
- the second carried **43 tools**, including **all six** the judge requires — `team_delegate`,
  `team_collect`, `team_resolve_control`, `team_list_pending_control`, `team_create_member`,
  `team_archive_member` — plus nine more `team_*` tools;
- the durable Leader session of the same boot: one real assistant turn with reasoning and two tool calls
  (`bash`, `grep`); the model ran and tool-called, but it does not perform the scripted choreography the
  bare marker prompts encode;
- session title event: `provider deepseek-official, model deepseek-v4-flash`.

Endpoint probe (names only): `GET /models` → `deepseek-flash`, `deepseek-v4-pro`;
`POST /anthropic/v1/messages` → 200 for `deepseek-flash`, `deepseek-v4-flash`, `deepseek-v4-pro`, 400 for
`deepseek-v4.1-flash-1017` ("supported API model names are deepseek-flash, deepseek-v4-pro"). The
owner-named id is the seat model, not an API model name; the host default is valid.

**Disclosed diagnostic failures:** attempt 1 pointed the host at a dead port because the recorder file had
been written under shell `/tmp`, which the sandboxed shell could not see at run time
(`real-model/diagnostic/attempt1-proxy-missing-console.log`); attempt 2's recorder used
`new URL(req.url, UPSTREAM)` and dropped the `/anthropic` prefix, producing a 404 that was a **recorder
bug**, not a model error (`real-model/archive/2026-11-25T16-21Z-diagnostic-attempt2-proxy404/`). The 200/43-tools
capture is attempt 3 after fixing the prefix.

## D. Task 2 — the key-inheritance control (collected, catalog delta 0)

New arm **`P5-KEY-INHERITANCE`** in the existing collected suite
`tests/world-factory/a5sf-sub-contract.test.mjs` (so the catalog does not move: tests=788, digest
`sha256:15451525…`, identical to round 118).

The code path under test is named in every failure message:
`packages/runtime/team-services/src/subprocess.ts:1145-1154` (`SENSITIVE_ENV_PATTERN` /
`confinedChildEnvironment()`).

| shape | measured | verdict |
| --- | --- | --- |
| POSITIVE CONTROL — plain `child_process` child of the test process | sees `DEEPSEEK_API_KEY` with the injected marker | proves the negative is not vacuous |
| UNIT — `confinedChildEnvironment(undefined)` | drops `DEEPSEEK_API_KEY`, `*_KEY`, `*_PASSWORD`, `*_SECRET`, `*_TOKEN`; keeps an ordinary name | pass |
| NEGATIVE (inherited env) — governed Bash child **and its grandchild** | all five names absent in both; ordinary name present in both | pass |
| DIRECT env — explicit `spec.env` entry | the caller's own value reaches the child; the **inherited** value never does; unrelated credential names still absent | pass (documented opt-in, not the key's path) |

Suite: **18/18 pass** (`node --test tests/world-factory/a5sf-sub-contract.test.mjs`, 30.0 s); the new arm
alone 3.6 s. No assertion was weakened; the arm fails if the scrub stops dropping any of the five names.

## E. Status truth — no row moves

- Row 34 in `D-ACCEPTANCE-REPORT.md` stays **`ENV-LIMITED` + `SCRIPTED-ONLY`**, with its limitation text
  now naming the **driver** work instead of the missing credential; a new `## ROUND 119` section records
  the attempt.
- `C1-C18-SIGNOFF.md` §2 gains the round-119 note: the model-behaviour rows (C1, C3, C12, C13 base, C14b,
  the `d3`/`d4` live rows) still rest on the scripted mock; `CANDIDATE-ACCEPTED` not reached; no row
  PRODUCT-PROVEN.
- `CANDIDATE-REPORT.md` §8.1 and the owner short-list item 3 record the same; §4.3 and §6.7 point at it.
- **No `DEV-LIVE-real-model` level is claimed anywhere.**

## F. Gate block on this head (pasted verdict lines)

| log | verdict |
| --- | --- |
| `gate-dispatch-ute-vnext-a1.log` | `mode=run leg=ute-vnext-a1 suites=8 files=8 exit=0`; tests 267 / pass 264 / fail 0 / skipped 3 |
| `gate-test-catalog-task.log` | `--max-uncollected 41 --max-excluded 7` → `tests=788 digest=sha256:15451525… refused=0 findings=0` (exit 0) |
| `gate-test-catalog.log` | plain invocation: same census, `refused=38 findings=38` (exit 2 **by design** — the uncollected set is disclosed, never printed green) |
| `gate-ute-cut-closure.log` | `UTE-CUT-CLOSURE pass … cut=cut(0/148) … findings=0` |
| `gate-ute-p0-assets.log` | `UTE-P0-ASSETS pass modules=37 files=180 lines=69512 … cut=cut(148/148) findings=0` |
| `gate-docs-sync.log` | `docs:sync --check: docs=193 … findings=0 blocking=0 contracts=20 pairs compared` |
| `gate-place-dist-glue.log` | `place-dist-glue: done (35 placement(s))` |
| `gate-eb3-ci-required.log` | `EB3-CI-REQUIRED pass workflows=11 findings=0` |
| `gate-bound-vitest.log` | `EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0` |
| `gate-ute-g1-argv.log` | the census G1 argv lane: tests 89 / pass 89 / fail 0 |
| `gate-eb3-run-manifest.log` | `EB3-RUN-MANIFEST pass records=639 strict=0 incomplete=11 findings=0` (634 at the committed head; +5 = the archived real-model RUN records, with duplicated copies dropped — §G) |
| `gate-ci-pr-gate.log` | `ci-pr-gate --full --census-captures 2` — see the settlement comment for the pasted verdict |

The catalog is **unchanged** by this round (788/736/14/38, same digest): the arm rides a suite that
already existed. The per-PR `ute-vnext-a1` leg is also unchanged (267/264/0/3) — this suite rides the
**ci-census `b4/1 subprocess boundary`** lane, not that leg, and the census population is file-based.

## G. Evidence layout, and the corrected snapshot

- Real runs preserved: `../d-boot-feasibility/real-model/archive/2026-11-25T16-15Z-real-legacy/`
  (the legacy run's root artifacts + console log) and its two RUN records in
  `.../archive/2026-11-25T16-15-36-219Z/`; the next host's root artifacts in
  `.../archive/2026-11-25T16-15Z-real-next-artifacts/`, its two RUN records in
  `.../archive/2026-11-25T16-16-34-959Z/` and its console log at the evidence root
  (`console-next-20261125T161536Z.log`). The committed
  root `probe.json`/`runs/` remain the round-111 **scripted** baseline; a driver-made duplicate archive of
  those scripted runs was dropped rather than committed twice.
- **Correction, disclosed:** a snapshot first created as `archive/2026-11-25T16-21Z-real-next/` had been
  copied *after* a diagnostic invocation had overwritten the root `probe.json`/`results.json`, so it
  mislabelled data as next-host evidence. It was removed. The next host's root artifacts were later
  identified (their boot records carry `hostSha 9c2670d3bc`) and are preserved as
  `archive/2026-11-25T16-15Z-real-next-artifacts/`; the diagnostic's own working state is kept separately
  as `archive/2026-11-25T16-21Z-diagnostic-attempt2-proxy404/`. Nothing was reconstructed: every host now
  has its own probe, results, agreement and RUN records (both boots `ERROR`/`FAIL`, `agreeing=true`).
- Diagnostic: `../d-boot-feasibility/real-model/diagnostic/` (`real-request-capture.json`, `proxy.log`,
  `console-capture.log`, `attempt1-proxy-missing-console.log`).

## H. What is still unproven

Every one of the 20 judges on a real model; the four negative controls; every model-behaviour claim
(model-driven choice, retries, adversarial tool selection). Completing it needs the driver's real branch
finished — real request capture, non-vacuous turn gates, discovered call ids and real prompts — not a
different environment. No capability level, no `CANDIDATE-ACCEPTED` and no `PRODUCT-PROVEN` claim is made.
