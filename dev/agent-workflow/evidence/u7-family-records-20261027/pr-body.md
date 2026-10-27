## What this lane delivers

The acceptance ledger (`dev/agent-workflow/ledgers/u7-tool-acceptance.json`) had
`pwsh`, `web_fetch`, `web_search`, `ask_user_question`, `present` at L2/L3 =
NOT_VERIFIED with the note "only sidecars / prose committed; no u5-run-record/1 RUN
record for this suite is on the tree". The three C2 suites already exist and had
passed on their lanes — those runner invocations simply omitted `--run-record`.
This lane re-runs each suite with ONE boot each and commits the finalized RUN
records, then re-points ONLY the levels those records' PASS cases actually prove.

**Live results (first-boot, zero retries): `u7-pwsh` PASS 6/6 · `u7-f-web` PASS 7/7 ·
`u7-f-ui` PASS 7/7.** Boot budget: 3 host starts of a declared 6
(`budget-ledger.jsonl` = exactly 3 runner-appended entries). Team SHA `a264d2df0a56…`,
Host SHA `639ed01539…` (pristine test-use @ `TEST_USE_BASELINE_SHA`, porcelain empty
before/after). `:3080` probed read-only 401 before/after every run; `tests/homes/`
empty after teardown.

## Ledger re-point map (before → after)

| tool | L1 | L2-mounted | L3-refusal | L4-positive |
| --- | --- | --- | --- | --- |
| pwsh | PROVEN | NOT_VERIFIED → **PROVEN** `pwsh:mounted` | NOT_VERIFIED → **PROVEN** `pwsh:deny-zero-effect` | DISCLOSED (unchanged — no positive-spawn case; M-07 stays NOT_VERIFIED) |
| web_fetch | PROVEN | NOT_VERIFIED → **PROVEN** `web:mounted` | NOT_VERIFIED → **PROVEN** `web:deny-leg-zero-wire` | NOT_VERIFIED → **PROVEN** `web:fetch-positive` |
| web_search | PROVEN | NOT_VERIFIED → **PROVEN** `web:mounted` (placement row names web_search) | NOT_VERIFIED → **PROVEN** `web:search-no-provider` | DISCLOSED (unchanged — no provider ships) |
| ask_user_question | PROVEN | NOT_VERIFIED → **PROVEN** `ui:mounted` | NOT_VERIFIED → **PROVEN** `ui:ask-live-refused` | DISCLOSED (unchanged) |
| present | PROVEN | NOT_VERIFIED → **PROVEN** `ui:mounted` | NOT_VERIFIED → **PROVEN** `ui:present-outside-refused` | DISCLOSED (unchanged) |

`web_fetch` L4 is the only level moved beyond L2/L3: `web:fetch-positive` is a live
authorized call whose REAL effect was read back through the runner-owned stub as an
INDEPENDENT oracle (`claimHits=1`, `governed-web-fetch RAN … status=200 bytes=60`,
body claim read back through the model transcript). No DISCLOSED reason was edited.
Every re-point mirrors the existing `{record, case}` evidence style; the cases' own
arm disclosures (kernel-admission denial for pwsh deny; plane-row refusals for the UI
arms; native-name surface disclosure for pwsh mount) are carried as row notes.

## Evidence law followed

* Zero product / `packages/**` change — evidence + ledger JSON only.
* Records are schema `u5-run-record/1`, finalized, all cases PASS; graded strict by
  `eb3-run-manifest.mjs` (source-bound to this tree, host pin, live authority generation).
* Launch tokens redacted from the three committed `instance-*.log` boot lines
  (TEST_METHODS §3.6); everything else byte-exact runner output; all files ≪ 1 MiB.
* Fresh-worktree host provisioning: shared baseline dir had drifted (no git repo), so
  `clone --local --no-hardlinks` from the main checkout's PRISTINE test-use +
  `checkout --detach 639ed0153972…` + install `--ignore-scripts --frozen-lockfile` +
  `DSH_CLIENT_COMMIT_HASH=639ed01539 pnpm run build` — disclosed in the lane README.

## Local gates (all on the committed tree)

* `node scripts/eb3-tool-acceptance.mjs` — pass, findings=0 (every new PROVEN accepted)
* `node scripts/eb3-run-manifest.mjs --new-since origin/master` — pass records=68 strict=3 findings=0
* `node scripts/eb3-evidence-guard.mjs --new-since origin/master` — pass added=13 findings=0
* `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` — **DSH-CI-VERDICT pass pass=7 fail=0 skip=1 legs=8** (graph-parse, state-freshness, install, blueprint-fence, typecheck, lint-identities new 0, artifacts-at-head drift 0; the census leg is the runner's own named skip in default mode — hosted `--full` grades it)
