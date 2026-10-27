# u7-family-records — u5-run-record/1 RUN records for the pwsh / web / ui C2 suites

Branch `task/u7-family-records-20261027`, base `origin/master` `a264d2df0a56a11457cfababf18b844bb5db5c0a`.
This lane adds NO product code: it re-runs the three already-merged C2 suites
(`u7-pwsh`, `u7-f-web`, `u7-f-ui` — `tests/world-factory/suites/070-u7-pwsh.mjs`,
`070-u7-f-web.mjs`, `080-u7-f-ui.mjs`, run through `tests/world-factory/u5-canary-runner.mjs`)
each with ONE boot and `--run-record`, so the acceptance ledger
(`dev/agent-workflow/ledgers/u7-tool-acceptance.json`) can re-point its L2/L3 rows
onto committed `u5-run-record/1` RUN records instead of prose. The earlier lane runs
(`u7-f-pwsh-20261026`, `u7-f-web-20261026`, `u7-f-ui-20261026`) passed but their runners
were invoked without `--run-record`, so nothing on the tree was citable — that gap, not
the verdicts, is what this lane closes.

Boot budget: **3 host starts total (ONE per suite, ZERO retries)**, against a declared
`--max-host-starts 6`. `budget-ledger.jsonl` carries exactly the three entries the runner
appended before each spawn. Every runner exit code was 0; no ENV retry was needed.

Provisioning disclosure (environment drift, not a law gap): the shared read-only baseline
`/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness` no longer carries the host git
repository on this machine (only stale `snapshots/`+`vendor/` leftovers — the same
environment-migration gap class AGENTS.md records for `references/`). Per the TEST_METHODS
§1 fresh-worktree law this worktree therefore ran
`git clone --local --no-hardlinks /srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use tests/deepseek-harness-test-use`
from the main checkout's PRISTINE test-use clone, then `git checkout --detach 639ed015397290b3745d163aafe02ffee4aa3f84`
(= `TEST_USE_BASELINE_SHA`; HEAD verified, `git status --porcelain` empty BEFORE the build
and AFTER every run — re-checked 0 lines at lane end). The host was built with the
documented chain `pnpm install --ignore-scripts --frozen-lockfile` +
`DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build`.
The team-repo side was provisioned with `pnpm install` (already present),
`pnpm -r run build` and `pnpm build:composition` — zero drift
(`check-artifacts-committed` 1881 files ok, `check-artifacts-at-head` drift=0).

Port hygiene: pre-boot `ss -ltn` showed the sanctioned bands (3181–3199 / 3491–3500 /
13000–13099) free; the stable instance `:3080` was probed read-only BEFORE and AFTER every
run and answered `401` every time (identical pre/post state — the records also carry this
as their `stable-instance-unchanged` PASS case). Test hosts leased 3184 each run (runner
lease plan); the web stub leased 3491 (MOCK band). `tests/homes/` is EMPTY after teardown
(all three worlds released; homes are gitignored and were never committed).

Redaction: the three `instance-*.log` copies had their launch-token value replaced with
`<REDACTED-per-TEST_METHODS-3.6>` on the boot line (TEST_METHODS §3.6: launch tokens never
committed). The boot line itself — the readiness witness — is otherwise byte-intact; every
other committed file is byte-exact runner output.

## Commands (identical shape per suite, run from the worktree root)

```bash
node tests/world-factory/u5-canary-runner.mjs --suite <u7-pwsh|u7-f-web|u7-f-ui> --line rec1 \
  --evidence dev/agent-workflow/evidence/u7-family-records-20261027/<suite>/ \
  --run-record dev/agent-workflow/evidence/u7-family-records-20261027/<suite>/run-record.json \
  --budget-ledger dev/agent-workflow/evidence/u7-family-records-20261027/budget-ledger.jsonl \
  --max-host-starts 6
```

No lane-specific env beyond the runner's own (`scrubProviderEnv` + mock provider injection);
the three world kinds declare `envKeys: []`.

## u7-pwsh — run `u5-u7-pwsh-rec1-2026-10-27T19-33-56-098Z`

* Team SHA `a264d2df0a56a11457cfababf18b844bb5db5c0a` · Host SHA `639ed015397290b3745d163aafe02ffee4aa3f84` · 1 boot (phase `u7pwsh-boot1`)
* **overall = PASS** (`RUN-SUMMARY … overall=PASS cases=6 PASS:6`)
* cases (verbatim from `u7-pwsh/run-record.json`):
  * `pwsh:mounted` PASS — placement-feed rows carry `pwsh` (+ one governed `pwsh` call dispatched into the governed stack); the case carries the standing disclosure that the boot-session model surface lists native names only
  * `pwsh:deny-zero-effect` PASS — arm `kernel-admission-denial-in-tool-result`, deny marker absent, zero `confined-pwsh ran` lines
  * `pwsh:approve-honest-env` PASS — real durable Control row → public `team.resolveControl` allow → consume law → typed `pwsh-executable-not-found` ENV arm (pwsh absent on this Linux host; positive spawn stays DISCLOSED, matrix M-07 unchanged)
  * `pwsh:seam-replay-refused` PASS — settled requestId refused a second time (`CONTROL_REQUEST_DECIDED`)
  * `pwsh:leak-check` PASS · `stable-instance-unchanged` PASS (`:3080` 401→401 read-only probe)

## u7-f-web — run `u5-u7-f-web-rec1-2026-10-27T19-35-12-134Z`

* Team SHA `a264d2df0a56…` · Host SHA `639ed01539…` · 1 boot (phase `u7fweb-boot1`), stub on 3491
* **overall = PASS** (`cases=7 PASS:7`)
* cases (verbatim from `u7-f-web/run-record.json`):
  * `web:mounted` PASS — placement-feed rows `[… web_fetch, web_search]`, `planeCfg.webEnabled=true`
  * `web:fetch-positive` PASS — durable ALLOW → grant consumed → production `node:http` transport wired the stub exactly once (`claimHits=1`, `governed-web-fetch RAN … status=200 bytes=60 hops=0`), body claim read back through the model transcript; the runner-owned stub ledger is the INDEPENDENT oracle
  * `web:approval-chain-live` PASS — TWO durable PA ask rows (tool=web_fetch), public `team.resolveControl` v4 answered allow then deny
  * `web:deny-leg-zero-wire` PASS — `pa-refused code=APPROVAL_DENIED` with `victimHits=0`
  * `web:search-no-provider` PASS — live typed `WEB_SEARCH_NO_PROVIDER`, no `governed-web-search RAN`, zero stub wire beyond `/claim`
  * `web:leak-check` PASS · `stable-instance-unchanged` PASS

## u7-f-ui — run `u5-u7-f-ui-rec1-2026-10-27T19-36-29-906Z`

* Team SHA `a264d2df0a56…` · Host SHA `639ed01539…` · 1 boot (phase `u7fui-boot1`)
* **overall = PASS** (`cases=7 PASS:7`)
* cases (verbatim from `u7-f-ui/run-record.json`):
  * `ui:mounted` PASS — placement-feed rows `[… ask_user_question, present]`, zero `PLANE_UI_REGISTRATION_REFUSED`
  * `ui:ask-live-refused` PASS — arm `plane-row-refused` (`governed-ask default-deny refusal`), zero fabricated answers, zero `governed-ask RAN`
  * `ui:present-inroot-zero-effect` PASS — `governed-present port-refusal`, planted file byte-identical (sha before == after), zero RAN/PROBED
  * `ui:present-outside-refused` PASS — `governed-present anchor-refusal code=locator-rejected`, outside file byte-identical, OUTSIDE CANARY rode no log line and no tool result
  * `ui:positive-arms-honest` PASS — arm `refused-zero-effect-disclosed` (live positive arms stay DISCLOSED: no trusted mount injects a UI port)
  * `ui:leak-check` PASS · `stable-instance-unchanged` PASS

## What the ledger may and may not read off these records

| tool | L2-mounted | L3-refusal | L4-positive |
| --- | --- | --- | --- |
| pwsh | `pwsh:mounted` | `pwsh:deny-zero-effect` | stays DISCLOSED — no positive spawn case exists (pwsh absent; M-07 NOT_VERIFIED) |
| web_fetch | `web:mounted` (row names web_fetch) | `web:deny-leg-zero-wire` | `web:fetch-positive` — real fetch effect read back through the independent stub oracle → PROVEN |
| web_search | `web:mounted` (the same placement row names web_search) | `web:search-no-provider` | stays DISCLOSED — no provider ships with the product |
| ask_user_question | `ui:mounted` (row names ask_user_question) | `ui:ask-live-refused` | stays DISCLOSED — no trusted mount injects a UI port |
| present | `ui:mounted` (row names present) | `ui:present-outside-refused` (typed `locator-rejected`, zero fs touch; `ui:present-inroot-zero-effect` PASSes too and is citable for the same level) | stays DISCLOSED — the present publication face exists on no host ctx service |

No DISCLOSED reason was edited. The three `*.u7*evidence.json` sidecars and the
per-world `logs/instance-*.log` files are the runner's own captures (all ≤ 24 KiB); the
`run-record.json` files are the citable RUN records (schema `u5-run-record/1`, finalized,
`overall=PASS`) that `scripts/eb3-tool-acceptance.mjs` grades.
