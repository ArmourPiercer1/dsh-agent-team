# ROUND 124 (2026-11-26) — the version gate's legacy assets, and the required-set truth at the frozen SHA

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, PR **#822** (restored to DRAFT after this round).
Sole writer. `CORE PATCH BUDGET = 0`; `:3080` and its `DSH_HOME` untouched.

## 1. Two measured failures, and what was actually wrong

### A. The version gate's legacy host had no pinned native assets

Run `45727813248` (`workflow_dispatch`, `head=0d66cf8eb`), job
`candidate-acceptance (VERSION GATE …) head=0d66cf8eb`. Head binding passed and the rc.5 host passed
31/31; **all four legacy drivers refused before the first host start**:

```
HostBaseError: host base guard: sandbox pre-flight refused before the first host start:
host-sandbox-assets: DESTINATION_DIGEST_MISMATCH:
bin/glibc/system.node in …/tests/deepseek-harness-test-use hashes dfa6d5861f51ddb5112a7c92e560752d79c2a89362c0634c8d4f0fc888b21487,
the pinned manifest says 54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc
```

The workflow built the rc.2 host but did not run the native-asset provisioning leg, so the gate saw the
hosted runner's own build (`dfa6d586…`). The manifest's `transport` field documents exactly this hazard: a
runner build is not the standard; the fixed published asset is.

**Fix.** `.github/workflows/candidate-acceptance.yml` now runs, after the rc.2 build and before the gate,
the canonical census leg (same command as `dev/ci/eb3-ci-manifest.json`'s `ci-census` leg
`host-sandbox assets (pinned published package)`):

```
node scripts/provision-host-assets.mjs --from-package @deepseek-ai/node-addon-system-linux-x64@0.1.2
```

Verification order: exact package@version → registry `dist.integrity` (sha512) → committed tarball sha256
(`77fb771b…cc20`) → every installed file's sha256 + length + mode → publish. It replaces mismatched build
bytes; it re-verifies good pinned bytes; it never copies a local tree. The sha256 pin is unchanged.
Local proof: `asset-provision.log` (first run installs the pinned bytes; second run's receipt shows
`preExistingSha256 == sha256` for both files).

### B. The Required red at `0d66cf8e` was NOT the ready-flip/merge-ref

Run `45727883993` (`ci-required`, event `pull_request`, `ready_for_review`, created
`2026-11-26T00:19:14Z`). Truth from the run's own jobs and logs:

- checkout: `refs/pull/822/merge` (`Uses: …/ci-fast.yml@refs/pull/822/merge`) = `23df45eb`;
- first parent = master tip `a19d1df0`; head = `0d66cf8e`;
- every layer's `EVENT_NAME=pull_request` and two-parent-merge guard **passed**;
- the text `event ${EVENT_NAME} is not supported` / `the checkout is not a two-parent merge commit` in a
  raw log is the step's **echoed command**, not a fired error.

The reds were identical in the preceding **draft** run `45727536793`, so the ready flip changed nothing:

| layer | measured red | fix |
| --- | --- | --- |
| `ci-fast` | `EB3-IMPACT REFUSED BASE_UNRESOLVABLE: spawnSync git ENOBUFS` — the branch's `git diff --name-only a19d1df0..HEAD` is 1,105,461 B / 10,254 files, over Node's 1 MiB default | `scripts/eb3-impact.mjs` git buffer 64 MiB (capacity only; selection logic unchanged) |
| `ci-integration` | `EB3-EVIDENCE-GUARD fail added=9226 … findings=6` — six preserved round-120 real-model transcripts > 1 MiB | six reasoned entries in `dev/ci/evidence-large-allowlist.json`; the 1 MiB bound and the raw-capture refusal unchanged |
| `ci-security`, `ci-product` | vitest config load: `lstat …/tests/deepseek-harness-test-use` ENOENT (round 118's eager realpath of the gitignored pristine tree, absent on a hosted checkout) | `tests/next-host/host-select.mjs`: missing legacy tree = "nothing to decline" (legacy resolution is the repo install); missing **next** tree still refuses; regression test added |

**No layer guard was weakened and no event was declared unsupported.** `ready_for_review` is a supported
`pull_request` activity and GitHub served the merge ref.

**Supported way to a full Required set with census.** Make the PR ready (or push a `synchronize` while
ready) so the event's merge ref exists; the run executes all four layers **and** `ci-census`, and
`ci-required` grades them. It grades the **merge commit** `M = merge(master tip, event head)` — here
`M = 23df45eb`, **not** `0d66cf8e`. Returning to draft makes `ci-required` red because census is skipped on
a draft (the documented deferred tier), not because of a product failure. The **frozen SHA itself** is
graded only by the `candidate-acceptance` dispatch (`-f head=<S>`) and its separate `version-gate` context.

## 2. Local gate block at this round

Recorded verbatim in `gates/`. Commands and results:

| gate | command | result |
| --- | --- | --- |
| dispatch leg | `node scripts/dispatch-tests.mjs --run --leg ute-vnext-a1` | `suites=8 files=8 exit=0`, 268 tests / 265 pass / 0 fail / 3 skipped, set `sha256:0b087a6a…` |
| test catalog | `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | tests=790 collected=738 excluded=14 uncollected=38 findings=0 |
| cut closure | `node scripts/ute-cut-closure.mjs --check` | `cut(0/148) prodRefs=0 distResiduals=0 findings=0` |
| P0 assets | `node scripts/ute-p0-assets.mjs --check` | `modules=37 files=180 lines=69512 cut(148/148) findings=0` |
| docs sync | `node scripts/docs-sync.mjs --check` | docs=193 findings=0 blocking=0 contracts=20 |
| dist glue | `node scripts/place-dist-glue.mjs` | 36 placements, byte-identical |
| EB3 required | `node scripts/eb3-ci-required.mjs` | `pass workflows=11 findings=0` |
| bound vitest | `node scripts/eb3-security-run.mjs --layer ci-integration --list-file tests/checks/eb3-ute-migrated-suites.txt --timeout 30000` | `PASS suites=15 files=15 passed=238 failed=0` |
| run manifest | `node scripts/eb3-run-manifest.mjs` | `pass records=662 strict=0 incomplete=11 findings=0` |
| UTE G1 argv | `node --import ./scripts/run-tests-hooks.mjs --test --test-concurrency=1 <9 files>` | 89/89 pass |
| verifier unit | `node --test --test-force-exit scripts/version-gate-verify.test.mjs` | 22/22 pass |
| PR gate | `node scripts/ci-pr-gate.mjs --full --census-captures 2` | **`DSH-CI-VERDICT pass pass=10 fail=0 skip=0 refused=0 legs=10`** (289.4 s; census 601f/7446l twice, identical identity sets) |

## 3. What is still unproven

- The re-dispatched version gate at the new HEAD is recorded separately once it settles
  (`VERSION-GATE.md` §8 / `CANDIDATE-REPORT.md` §5.1); a green there is still not PRODUCT-PROVEN without
  the owner's branch/tag protection rule.
- The round-124 Required-set fixes are local-and-log-proven; the four hosted layers were **not** re-run in
  this round (the task's hosted run is the version gate only). A future ready/synchronize `ci-required` run
  is the measurement that would make the supported procedure green, and it has not been run here.
- No capability row moves; `d4:ask-execute-process` remains the single enumerated `knownRefuted`.
