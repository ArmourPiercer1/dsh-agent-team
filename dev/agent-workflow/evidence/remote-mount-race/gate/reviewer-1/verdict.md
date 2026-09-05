# G-RMR gate — reviewer 1 (blind) — commit 677b029 (branch `task/remote-mount-race`, base `5adc8b9`)

## 裁决: 不通过

The functional fix is complete, correct, and live-proven — the user-world 405 is severed on every
boot path, and the strict `create`/`resume` semantics are preserved. However, the committed state
**fails the repository's own lint gate** (8 errors, exit 1 — reproducible; the R135 gate-summary
claim of "LINT exit 0" is contradicted by an independent re-run), and the mandated artifact-
freshness literal check is non-empty in this environment (pre-existing CRLF-blob storage of the
committed dist mirror; content-identical after CR normalization — see F2). Under the router
protocol a gate passes only when all gate evidence is independently green; the required supplement
is a two-file stylistic lint fix plus a gate-record correction. Nothing about the product behavior
is in question — 不通过 is forced by the failed gate record, not by any functional defect found.

---

## 1. Independent root-cause analysis (derived from code, not from R135)

**How the 405 arises (upstream mechanics, verified in the production CLI source):**
- `packages/host/webserver/src/index.ts`: requests are dispatched to named routes (exact/prefix
  tables); unmatched requests fall through to a single registered fallback handler.
- `packages/host/frontend-static/src/index.ts` L124–131: the web profile's fallback claims the
  fallback seat and answers **every non-GET/HEAD request that reaches it with 405** ("named routes
  own their method handling"). So `POST /team-remote/*` → 405 **iff** no named route under the
  `/team-remote` prefix is registered. GETs still hit the static handler (401/200) — exactly why
  the Team UI shell works while 新建团队's `catalog.list` POST 405s.
- `packages/client/connection/src/rpc-host.ts` L78–85/L173: the `/team-remote` prefix route exists
  only if `connection.rpc.handle('/team-remote', dispatcher)` ran, which calls
  `owner.webServer.register({kind:'prefix', path:'/team-remote', …})`. When that registration never
  runs, the pre-fix behavior is a **permanent silent skip with zero terminal signal**.

**Two independent mechanisms, each sufficient for the symptom:**
1. **B — deterministic, the user's trigger.** The shipped bundle row hardcoded
   `bootPhase: "create"` (pre-fix `cordis.patch.yml`). The host's domain step
   (`bootPhase === 'create' ? createTeamDomain : openTeamDomain`) runs **before** the mount step;
   `createTeamDomain` throws `TEAM_DOMAIN_EXISTS` on an already-stamped medium
   (`packages/storage/repositories/team-domain.ts`), which the pre-fix bootstrap swallowed
   (`void ready.catch(() => undefined)`) → bootstrap dead before the mount step → no route → 405
   on every boot of a returning home. The user's diag world shows the stamped
   `team_domain.json` (8 stamps, all data tables empty) pre-dating the failing boots.
2. **A — latent race.** The pre-fix entry read `ctx.get('connection')` exactly ONCE at the mount
   step; absent → skip forever, nothing logged. The `connection` service is provided by the web
   profile's client-connection row on an **independent fiber** (the team row injects only
   `agents`/`storageDomain`/`sessions` — no dependency edge), so a slow boot can lose the race
   deterministically. (R135's B-2 "confirmation" forced the losing interleaving by instrumenting
   the scratch copy to take the one-shot read at +23 ms while the service appeared at +717 ms —
   the *mechanism* (one-shot read, no retry, silent skip) is unambiguous in the pre-fix code; the
   natural read instant varies with bootstrap speed, so a lost race is real but timing-dependent.)
3. **C — observability gap.** Neither the skip branch nor the swallowed rejection emitted anything
   on the console; the 405 was diagnosable only from the absence of evidence.

**Does the diff sever each mechanism (verified in code + tests + live):**
- **B**: bundle now ships `bootPhase: "create-or-open"`. `createOrOpenTeamDomainDetailed`
  (`packages/storage/repositories/team-domain.ts` L247–307): L1 seam check in `openHandle` (a
  version-mismatched domain fails at open, before any decision); `schema_meta.size === 0` →
  initialize with the full eight canonical stamps (`created: true`); otherwise full L2 verification
  in canonical order, missing stamp → `SCHEMA_STAMP_MISSING` naming the exact first missing store
  (identical diagnosis to `openTeamDomain`; partial creates are diagnosed, never repaired);
  `created: false`. The host resolves `outcome.created ? 'create' : 'resume'` **after** the domain
  step and feeds the resolved two-value phase to the root and the live glue via
  `resolvedRowConfig` — `root.ts` (create mints the durable Team identity; resume LOADS it and
  fails closed with `TEAM_PLUGIN_RESUME_STATE_MISSING`, never mints) and
  `agent-bindings.mjs` L839 (validates exactly `'create'|'resume'`) keep their strict contracts
  untouched. `create` still fails closed with `TEAM_DOMAIN_EXISTS` (rmr-create-or-open-boot S3),
  and strict `resume` over an un-stamped medium still fails closed (t12b2 W4, unchanged) — so
  create-or-open is a genuinely distinct phase, not a widening of either strict phase. Plan §7-B2
  "resume never creates" holds: the adopt path resolves to `resume` only when a stamped (hence
  identity-bearing by a completed prior boot) medium exists, and if the identity is nevertheless
  absent (crash between stamping and minting) the resume fails closed loudly — see O3.
- **A**: absent at the mount step + `remoteMountWaitMs > 0` (default 30000; `0` = the legacy
  immediate decision, pinned by t12m4/p8s5a worlds) → facade `pending` + a second row effect
  polling every 100 ms: the service APPEARING mounts late through the SAME registration path
  (identity preserved — rmr-remote-mount-race scenario 1 asserts the dispatcher answers through
  the exact late-appearing object with the frozen envelope); a MALFORMED late appearance → logged
  terminal `failed` (recorded, never thrown — the bootstrap has settled); window expiry → logged
  terminal `skipped` naming the window; row stop while pending → terminal `skipped` (no dangling
  `pending`). Timers are unref'd (process never held open). Every branch is covered by
  deterministic real-timer regression tests (7/7 green).
- **C**: every terminal mount outcome is `console.error`ed (`MOUNTED` — with late-ms note /
  `SKIPPED` / `FAILED`), and the `ready` rejection is ALSO console-errored
  (`[dsh-agent-team] bootstrap FAILED: …`). Demonstrated three ways: smoke negative probe, test-
  run stderr (late mount at +109 ms, expiry, malformed, and the strict-create
  `TEAM_DOMAIN_EXISTS` surfacing), and my live vertical (the MOUNTED line).

## 2. Gate numbers (independent re-runs; raw outputs in `gate-outputs-raw.md`)

| Gate | Result |
| --- | --- |
| Typecheck | **9/9** (8 via `tsconfig.json`; `legacy` via `tsconfig.build.json` — the only tsconfig that package has, identical at base 5adc8b9, so pre-existing layout, not a diff artifact) |
| Build | **9/9** via `tsconfig.build.json` + `build-client-composition.mjs` (85 modules, client-bundle.js 845690 B = committed baseline) |
| Tests | **2448 passed / 4 failed / 2452 total** (`scripts/run-tests.mjs`, the documented spawn-restricted equivalent). The 4 failures are exactly the pre-existing audited-shim matcher gaps (no `toBeNull`/`toHaveLength`/`toBeUndefined` in the shim): `client-plugin-mount.test.ts:651` (1) + `pbf-default-artifact-urls.test.ts:76,85,116` (3) — **both files untouched by the diff**. New worlds: `rmr-create-or-open` 5/5, `rmr-remote-mount-race` 7/7, `rmr-create-or-open-boot` 3/3; unchanged-semantics worlds: `t12b2-resume-separation` 5/5 (W4 intact), `t12m4-remote-mount` 9/9, `p8s5a-production-assembly` 7/7, `p4t6-session-event-scan` 10/10 (pin 606) |
| Lint | **FAIL — exit 1, 8 errors** (see F1). R135's "exit 0" claim is false |
| Smoke | **PASS** exit 0; negative probe prints the new `bootstrap FAILED` console line through the committed dist |
| Artifact freshness | **Content-identical** (`git diff --ignore-cr-at-eol` over `packages/runtime/dist` + `packages/client/composition-shim` = empty after a full fresh rebuild); **literal `git status --porcelain` = 511 ` M`** — pre-existing CRLF-blob storage of the committed dist mirror vs LF build output under `core.autocrlf=true` with no repo `.gitattributes` (see F2) |

## 3. Vertical evidence (port 3181; fresh DSH_HOME `references/.dsh-test-rmr-rev1-20260905-183908`, left on disk)

Setup per brief: diag-405 profile files only (no node_modules, no sessions/storages/credentials),
install surface from my review worktree (committed bytes — installed host.js 41744 B, bundle
`bootPhase: "create-or-open"`), reference `settings.yaml`, CLI `D:\AgentDev\deepseek-harness\apps\cli\lib\bin.js`.

FIRST boot (fresh medium) — terminal, verbatim:
```
dsh web: http://127.0.0.1:3181/?token=YoJhvObsrTcjyOXXrHbUpBx70BQcaaGit5RcYDRa-AM
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```
(no `bootstrap FAILED` line). Wire: `GET /?token=…` → **303 + set-cookie**;
`POST /team-remote/catalog.list` → **HTTP/1.1 200 OK** + `"blueprintId":"my-team-bp-1"` (full
responses: `vertical-token-exchange-firstboot.txt`, `vertical-probe-firstboot.txt`). Medium after:
8 schema_meta stamps + minted TeamSession (createdAt 10:39:31.725Z) + exactly the Leader → fresh
medium INITIALIZED, identity MINTED (resolved `create` branch).

Kill → probe **000**.

RESTART (same home, stamped medium — the user's exact regression) — terminal, verbatim:
```
dsh web: http://127.0.0.1:3181/?token=ovkWXcPsl1ams5XyxeAwDES0nQDCRZuInQKOWwMmbII
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```
(no `bootstrap FAILED` — pre-fix this boot threw the swallowed `TEAM_DOMAIN_EXISTS`). Wire: 303 +
set-cookie; `POST /team-remote/catalog.list` → **HTTP/1.1 200 OK** + `"blueprintId":"my-team-bp-1"`
(`vertical-token-exchange-restart.txt`, `vertical-probe-restart.txt`). After restart the
schema_meta stampedAt values (10:39:30–31Z) and the TeamSession createdAt are UNCHANGED → the
stamped domain was ADOPTED, never re-stamped; the identity was LOADED, never re-minted (resolved
`resume` branch).

Teardown: server killed; final probe 3181 = **000**.

## 4. Findings

**F1 — DEFECT (gate failure): the committed state fails the repo's lint gate.**
`node node_modules/eslint/bin/eslint.js .` (eslint 9.39.5, repo flat config = eslint:recommended +
typescript-eslint recommended) exits 1 with 8 errors, all in files this commit introduces/changes;
reproducible on a two-file re-run:
- `packages/runtime/src/plugin/host.ts` L593:9, L594:9 — `prefer-const`: `pollTimer`/`deadlineTimer`
  are `let`-declared and assigned exactly once (L605, L626).
- `packages/runtime/test/rmr-create-or-open-boot.test.ts` L165:26 — `@typescript-eslint/no-explicit-any`:
  `config: Record<string, any>` in `applyWorldFailing`'s signature carries **no** eslint-disable
  comment (every sibling `any` in the file has one).
- same file L220:1, L221:1, L222:1, L227:1, L233:1 — `prefer-const`: `team1`/`binding1`/
  `members1`/`createdAt1`/`team2` are `let`-declared without initializers and each assigned
  exactly once.
Required supplement (trivial, behavior-neutral): make the 7 variables `const` (move the single
assignments into the initializers or restructure), add the one missing disable comment (or type
the param), and correct the gate record (R135 gate-summary "LINT exit 0" → the actual 8-error
result, or a re-run after the fix).

**F2 — Finding (pre-existing, non-blocking): committed dist mirror is stored with CRLF line
endings; fresh rebuilds emit LF.**
After a full 9-package rebuild + composition-shim rebuild, `git status --porcelain -- packages/
runtime/dist packages/client/composition-shim` = 511 ` M` entries, 0 untracked, 0 deleted; but
`git diff --ignore-cr-at-eol` over the same paths = **empty** — every file is content-identical
once CR-at-EOL is ignored (checked including the 11 files changed by the diff and the
composition-shim; e.g. worktree host.js rebuilt = 40973 B/771 bare LF vs committed 41744 B =
+771 CR). The committed blobs are CRLF (proven by git status semantics under `core.autocrlf=true`
with no repo `.gitattributes`); the state is pre-existing at base 5adc8b9 (the PBA commit first
added the dist mirror; files untouched by this diff drift identically). The build is
deterministic; Node is line-ending-agnostic (the vertical booted the committed CRLF bytes).
Hygiene risk: without a `.gitattributes` pinning the dist (e.g. `packages/runtime/dist/** -text`
or `eol=lf`), a rebuild committed from another machine produces a 500-file line-ending-only diff.
Not attributable to this commit; reported so the hygiene gap is on record.

**O1 — Observation: the `remoteMountWaitMs` default (30 s) makes a headless host wait the full
window before logging the terminal `skipped`** (timers are unref'd, so they don't hold the process
open; boot itself is unaffected). Documented trade-off in code; fine.

**O2 — Observation: mechanism A's live "confirmation" (R135 B-2) used an instrumented forced-early
read in a scratch copy** (one-shot read taken at +23 ms vs service appearance at +717 ms), not a
naturally-occurring loss. The mechanism itself (one-shot read, no retry, silent skip, independent
fiber) is unambiguous in the pre-fix code, and the fix's semantics are what the acceptance
requires; noted for the record only — it does not weaken the fix.

**O3 — Observation (crash window, by design): a process death AFTER the eight schema stamps but
BEFORE the root mints the Team identity leaves a stamped medium with no identity; the next
create-or-open boot resolves to `resume` and fails closed with
`TEAM_PLUGIN_RESUME_STATE_MISSING`** (loud, via the new console surfacing). Pre-fix the same
window produced the silent swallowed `TEAM_DOMAIN_EXISTS` 405. This is fail-closed-by-design
("complete or diagnose, never repair"), consistent with the pre-existing create/stamp ordering;
strictly better than the status quo. Not a regression.

## 5. Red-line self-check

- Diff surface = `packages/{runtime,storage,testkit}` + `cordis.patch.yml` + `dev/agent-workflow/`
  only; **no edits to upstream or `references/deepseek-harness*`** (read-only inspection of the
  production CLI source for the 405 mechanics; CORE PATCH BUDGET = 0 respected).
- `:3080` untouched; `D:\deepseek-harness\` zero-touch (only `D:\AgentDev\deepseek-harness`
  prebuilt CLI executed read-only, as permitted); `C:\Users\user\.dsh-dev` never written (one
  aborted setup attempt to that path was **denied by the sandbox before any write** — no effect);
  `references/deepseek-harness-test-use` untouched (pristine).
- No push, no force-push, no commits; my review worktree (`.worktrees/RMR-REV1`) remains detached
  at 677b029, tracked files clean (only permitted untracked `packages/testkit/test/.tmp-fault/`
  test scratch; nothing staged).
- Port 3181 only; teardown verified (final probe 000); the long-running harness process
  (started 0:37) was never touched.
- All long commands ran with hard timeouts; port liveness trusted via `curl.exe` probes (000/200),
  not `Get-NetTCPConnection`.

## 6. Verdict summary

**不通过** — solely on F1 (the commit fails the repo's own lint gate, and the gate record misstates
that result) with F2 reported as a pre-existing hygiene finding. The user-world 405 fix itself is
independently verified end-to-end (first-ever boot AND returning-home restart both MOUNTED +
catalog.list 200; strict create/resume semantics preserved; create-or-open phase separation clean
against glue and root). The required supplement is the two-file stylistic lint fix plus gate-record
correction; a full re-review cycle per ROUTER_RULES §3.3.3 follows as usual.
