# GATE REVIEW 2 — task/remote-mount-race @ 677b029 (blind, independent)

Reviewer: BLIND GATE REVIEWER 2 · worktree `.worktrees\RMR-REV2` (detached at `677b02990d31e6efdcde3bd97a87dd0f5220e338`, base `5adc8b9`) · route: qiyuan-self/qwen3.8-27b (per ROUTER_RULES §1)

## 裁决

**不通过**

Single red gate: **lint** (8 new errors, all stylistic, in files the diff introduced/modified — finding F1). No functional defect found anywhere in the diff; the fix mechanism is confirmed correct and the user symptom is verified fixed end-to-end (vertical: 405 → 200 on first boot AND on restart). In router terms this is a 补充内容-level gate result: a trivial lint fix + lint re-run is required; no design change.

> **⚠ Branch state during this review (material for the next dispatch).** This review targeted `677b029` per mandate. While it was in flight, the orchestrator advanced the branch: `74030a3` (R135 bookkeeping + gate dispatch, 18:29:38) and **`ab4b904` "gate round-1 remediation (F-1 lint + F-2 artifact line-ending hygiene)" (18:48:30)** — i.e. round-1 reviewers' findings F-1 (lint) / F-2 (artifact line-endings) were remediated **while this blind review was running**. I verified the remediation content against my independent findings: it addresses **exactly my 8 F1 errors** (host.ts timer vars → const holder `timers`; test file `let`→`const` ×5 + one missing `no-explicit-any` disable comment — the same 5 lines my verdict lists) and adds `.gitattributes` pinning `packages/runtime/dist/**` + `packages/client/composition-shim/**` to `text eol=lf` — the same autocrlf materialization artifact my artifact-freshness forensics documented independently. **Lint re-run at `ab4b904`: EXIT 0 (clean, verified in my review worktree).** Therefore: this 不通过 stands for the mandated target `677b029`, but its sole blocking finding is **already remediated and lint-verified at current branch HEAD `ab4b904`**; a round-2 re-baseline to `ab4b904` (or acceptance of this verdict + the verified remediation) would clear the gate without further code change. (Note: `ab4b904` also committed `packages/testkit/test/.tmp-fault/**` test scratch into the branch — orchestrator housekeeping, not product surface; flagged for the record only.)

---

## Review object

- Commit `677b02990d31e6efdcde3bd97a87dd0f5220e338`, single commit off base `5adc8b9`. 31 files, +1961/−94.
- Product surface: `cordis.patch.yml`; `packages/runtime/src/plugin/host.ts`; `packages/runtime/src/plugin/types.ts`; `packages/runtime/src/plugin/node-min.d.ts` (new); `packages/storage/repositories/team-domain.ts`; 3 new test files (`rmr-create-or-open`, `rmr-remote-mount-race`, `rmr-create-or-open-boot`); 3 modified test files (`p8s5a-production-assembly` +6, `t12m4-remote-mount` +7, `p4t6-session-event-scan` pin 603→606). Remainder = R135 log + evidence files (outside product review surface).
- Committed artifact surface: `packages/runtime/dist` + `packages/client/composition-shim` (R131 PBA regime).

## Independent root-cause analysis (re-derived from code; R135 treated as claims-to-verify, not authority)

### How the 405 arises (verified in pristine upstream `references/deepseek-harness-test-use`)

1. `packages/host/frontend-static/src/index.ts` L124-131: the frontend-static fallback seat answers unmatched non-GET/HEAD POSTs with `res.writeHead(405)`.
2. `packages/client/connection/src/rpc-host.ts` `register()`: the team remote surface is registered as the named prefix route `/team-remote`; that route's handler answers `POST /team-remote/<endpoint>` with **401** (no browser auth) / **200** (authed, valid `application/json` envelope via `rpcFetchHandler`).
3. `packages/host/webserver/src/index.ts` L165-172: `register()` throws `webserver: duplicate prefix route "<path>"` on a duplicate — a prefix route, once registered, is unique.

Therefore `HTTP 405 on POST /team-remote/catalog.list` is **equivalent to** "the row's remote-mount step never registered the route." The 405 is a symptom of a dead/never-completed bootstrap or a skipped mount, not a transport fault.

### Root cause B (dominant — the user's symptom): shipped row hardcoded `bootPhase: "create"`

- Pre-fix `cordis.patch.yml` shipped `bootPhase: "create"`.
- host.ts bootstrap, create branch: `createTeamDomain` → on an already-stamped medium throws `TEAM_DOMAIN_EXISTS`. A production home is stamped after its very first boot (the storage entry stamps the full 8-store schema even for an empty domain — verified in `team-domain.ts`), so **every returning home threw**.
- Pre-fix, the `ready` promise was consumed by `void ready.catch(() => undefined)` → the rejection was swallowed with **zero** log → zero signal.
- Bootstrap never completed → the root was never mounted → `/team-remote` was never registered → every team-remote call in the 新建团队 flow 405'd. The team UI shell worked because it rides the client-plugin surface, which does not depend on the host row's bootstrap completing.
- R135's claims (user home `team_domain.json` stamped 2026-09-05 with 8 empty tables; swallow at host.ts L653 pre-fix; stopgap = delete the empty `team_domain.json`) are **code-consistent and confirmed as mechanisms**; the stopgap's success (fresh unstamped medium → create succeeds once) is exactly the prediction of this mechanism.

### Root cause A (latent): one-shot `ctx.get('connection')` at the mount step

- The pre-fix mount step read `ctx.get('connection')` exactly once, synchronously, during bootstrap. The `connection` service is provided by the client-connection row on an **independent fiber — no dependency edge** from the team row to it — so absence at read time is a legitimate race outcome, not a misconfiguration.
- Absent → mount step recorded `skipped` permanently → 405 even on a fresh medium (timing-dependent). R135's measured window (absent at +23 ms, present at +717 ms) was not independently reproduced, but the mechanism is wiring-confirmed and the numbers are plausible and not load-bearing for this verdict.

### Root cause C (observability): no terminal signal

- Pre-fix, swallowed bootstrap rejection, skipped mount, and late appearance all produced **no** log line → the failure mode was undiagnosable from the host log (the user's exact experience: shell works, 新建团队 405s, nothing in the log).

### How the diff severs each mechanism (verified in the new code)

- **B**: the row now ships `bootPhase: "create-or-open"`. Bootstrap resolves the phase **after** the domain decision: `createOrOpenTeamDomainDetailed` → `resolvedPhase = outcome.created ? 'create' : 'resume'` (host.ts L723-735) and passes it, via `resolvedRowConfig`, to the root and the glue. A returning home **adopts** the stamped domain (created=false → resume) instead of throwing. Strict two-value semantics for the root and the glue are preserved unchanged: the glue (`agent-bindings.mjs` L839-841) still throws unless `bootPhase` is exactly `'create' | 'resume'` — the `create-or-open` value never reaches it.
- **A**: the mount step is now: connection present → mount immediately; absent + `remoteMountWaitMs > 0` (default 30000; `0` = pre-fix immediate-decision semantics, used by the pinning tests) → state `pending` + a row-effect watcher (`armRemoteMountWatcher`, host.ts L590-652) polling `ctx.get('connection')` every 100 ms (`REMOTE_MOUNT_POLL_MS`); late appearance → **late mount through the same registration path** (`mountRemoteNow`); malformed appearance → `failed` (recorded, not thrown — the bootstrap already settled); deadline → `skipped`; row stop while pending → terminal `skipped` (settle-on-stop in the effect cleanup).
- **C**: every terminal mount outcome is logged (`logRemoteMountOutcome`: `[dsh-agent-team] remote mount: MOUNTED/SKIPPED/FAILED …`, with reason and elapsed ms), and the bootstrap rejection is now logged (`[dsh-agent-team] bootstrap FAILED: …`, host.ts L882-885) instead of swallowed.

### Resume-never-creates (plan §7-B2 / t12b2 W4) — preserved

- Root: create phase mints (`createAndStartTeam`: TeamSession + team-root binding + Leader, root.ts L1601-1627); resume phase is **load-only** with three fail-closed `TEAM_PLUGIN_RESUME_STATE_MISSING` checks (root.ts L1628-1658). No mint call exists on the resume branch.
- Glue: create → `agents.create` (+ seed non-leader members); resume → `agents.resume` (re-binds from the domain, no mint).
- `create-or-open` does **not** widen resume: it is a row-level input resolved *after* the domain decision. Strict `resume` input still opens strictly (`openTeamDomain` → `SCHEMA_STAMP_MISSING` on an unstamped medium) and never creates; strict `create` input still throws `TEAM_DOMAIN_EXISTS` on a stamped medium.
- Evidence: `t12b2-resume-separation` **5/5** (W4 = resume over an empty medium fails closed) and `rmr-create-or-open-boot` S2/S3 (restart adopts with `createdAt` byte-identical, no re-mint; strict create over the stamped medium fails closed) — all green.

### Mount-watcher timer/lifecycle hygiene (special-attention item) — sound

- Both timers `unref()`'d (host.ts L636-637) — the watch timers never hold the process alive.
- Single `settled` guard; `settle()` clears both timers; the row-effect cleanup (L639-651) clears both timers and settles terminal `skipped` if unsettled. No dangling `pending` is observable on the facade.
- **No double-register**: the webserver throws on a duplicate `/team-remote` prefix (upstream-verified); the only registration site is `mountRemoteNow`, reachable at most once per row lifecycle (immediate, or late via the single watcher, or never). The previous row's registration, if any, is disposed by that row's stop backstop before any later row can register (`RemoteRegistration.dispose` is idempotent, register.ts L80-92).
- Single-threaded analysis: effect cleanups run at microtask scale and cannot interleave with timer callbacks (macrotasks) in a way that double-fires `settle`; even the hypothetical is neutralized by the `settled` guard. The seam is install-once with no uninstall (`seams.ts`), so `current()` cannot throw post-close; the remote-handlers registration reference is installed during root construction, strictly before the watcher is armed.

### New storage entry — error-path handle release (special-attention item) — sound

- `createOrOpenTeamDomainDetailed` (team-domain.ts): L1 version check via `openHandle`; empty schema → stamp all 8 stores → `created: true`; non-empty → L2 verification of the canonical 8 stamps (`SCHEMA_STAMP_MISSING` / `SCHEMA_VERSION_MISMATCH`) → `created: false`; **every** failure path runs `closeHandleSafe(handle)` before rethrowing. A partial stamp is never papered over or half-repaired (it fails exactly as the strict open entry does — pinned by test).
- Evidence: `rmr-create-or-open` **5/5** (fresh init; adopt keeps stamps untouched; partial stamp ≡ strict-open failure; L1 mismatch; non-seam `SEAM_FAILURE`).

---

## Gate numbers (independently re-run at 677b029; spawn-restricted documented equivalents — node child-spawn EPERM, direct tsc/eslint/run-tests/smoke invocations, `pnpm install` from PowerShell)

| Gate | Result |
| --- | --- |
| install | `pnpm install --frozen-lockfile` **EXIT 0** (463 packages, 38.5 s) |
| typecheck | **8/8 programs clean** (legacy is build-only by design — it has no typecheck program; in the x/9 package frame: 8 of 9 packages + 1 N/A) |
| build | **9/9 EXIT 0** + `place-dist-glue.mjs` EXIT 0 + `build-client-composition.mjs` EXIT 0 (shim: client-bundle.js 845690 B) |
| tests | **2452 total: 2448 passed, 4 failed** — all 4 are the pre-existing baseline (below). **0 new failures.** Re-run reproduced exactly (13.9 s) |
| lint | **EXIT 1 — 8 errors, all new, all in diff-introduced/modified files** → finding F1 (the red gate) |
| smoke | `composition-smoke.mjs` **EXIT 0** (host + client entries fail-loud on degenerate context as designed; the printed `[dsh-agent-team] bootstrap FAILED: …` line is the documented negative probe, not a failure) |
| artifact-freshness | **PASS** (forensics below) |

### The 4-baseline explanation (the 4 test failures)

All four are `TypeError: expect(…).toX is not a function` — the audited vitest-shim lacks those matchers; **neither file is touched by the diff**:

1. `packages/client/test/client-plugin-mount.test.ts:651` — `toBeNull` (1 failure, test P9-T9/R118)
2. `packages/runtime/test/pbf-default-artifact-urls.test.ts:76` — `toHaveLength`
3. `packages/runtime/test/pbf-default-artifact-urls.test.ts:85` — `toBeUndefined`
4. `packages/runtime/test/pbf-default-artifact-urls.test.ts:116` — `toBeUndefined`

Diff-relevant suites, all green: `rmr-create-or-open` **5/5** (storage) · `rmr-remote-mount-race` **7/7** (runtime: race regression incl. frozen-envelope dispatcher, deadline skip with window, malformed → failed, 0 = legacy immediate decision, row-stop settle-on-stop, negative-config rejection) · `rmr-create-or-open-boot` **3/3** (S1 mint / S2 adopt-no-re-mint / S3 strict-create fail-closed) · `t12b2-resume-separation` **5/5** (W4 resume-never-creates) · `t12m4-remote-mount` **9/9** · `p8s5a-production-assembly` **7/7** (T1.7 single-row-effect pin preserved via `remoteMountWaitMs: 0`) · `p4t6-session-event-scan` **10/10** (pin 603→606 = the 3 new test files, mechanical count; scanner `.mjs` unchanged). New tests total 15/15 green.

### Artifact-freshness forensics (committed `packages/runtime/dist` + `packages/client/composition-shim` vs fresh build)

- Full rebuild from committed source: 9× `tsc -p tsconfig.build.json` + `place-dist-glue.mjs` + `build-client-composition.mjs`, all EXIT 0.
- `git diff HEAD --stat -- packages/runtime/dist packages/client/composition-shim` = **empty** after the rebuild — committed artifacts are content-identical to a fresh deterministic build. (`git diff HEAD --name-only` on the whole tree = 0.)
- Raw byte comparison (`.NET` on raw `cmd /c git show` extraction, avoiding PS5.1 `>` re-encoding): **13 of 14 sampled files byte-identical to the 677b029 blobs**, including **every file the diff changed** (host.js / host.d.ts / host.js.map / types.d.ts / types.js.map / team-domain.js / team-domain.d.ts / register.js / identity.js / contracts index.js / client-bundle.js 845690 B / shim index.js / shim package.json).
- The one differing sample: placed `packages/runtime/dist/…/live/agent-bindings.mjs` — on-disk 71965 B (CRLF) vs committed 70544 B (LF); delta = exactly 1421 = the line count. **Proven environmental**: `core.autocrlf=true` materializes the worktree *source* file as CRLF and `place-dist-glue` is a byte-copy; the committed dist blob == the committed src blob byte-identical (70544 B, LF) and unchanged between `5adc8b9` and `677b029`. On an LF-materialized checkout the documented build chain reproduces the committed blob byte-for-byte.
- Environment caveat (recorded, not a defect): `git status --porcelain` shows 511 ` M` entries on the two artifact paths on this machine — a git EOL-expectation false positive (git's own warnings: "LF will be replaced by CRLF the next time Git touches it"); index sha == HEAD sha and the authoritative content comparison (`git diff HEAD`) is empty. The repo's own `check-artifacts-committed.mjs` is unusable here (node spawn EPERM); `git diff HEAD` + raw byte comparison is the documented equivalent.

---

## Vertical evidence (port 3182 only; fresh home = first-ever production-style boot; all lines verbatim)

Home: `references\.dsh-test-rmr-rev2-2026-09-05T18-39-12` (left on disk as evidence). Profile files copied from the reference 405-world (`references\.dsh-diag-405-2026-09-05T16-35-38\profiles\web`, node_modules excluded); install surface = the worktree's committed artifact surface (root `package.json` + `cordis.patch.yml` + `packages/client/composition-shim` + `packages/runtime/dist` + `packages/runtime/root-binding` + `packages/runtime/src/plugin/upstream-resolver.mjs`; 1036 files); `settings.yaml` from the reference world. No `sessions/`, `storages/`, `.credentials.yaml`, `.anonymous-user-id` copied (genuine first boot). Server = the user's prebuilt CLI `D:\AgentDev\deepseek-harness\apps\cli\lib\bin.js` (read-only use, permitted).

### FIRST boot

```
dsh web: http://127.0.0.1:3182/?token=uOIyCtRCqZpneW7gxKTaquCnclbynlii_TOXEUfxeqs
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```

No `bootstrap FAILED` line. The MOUNTED line carries no "(late, …)" suffix → connection present at the mount step → immediate mount.

Probe 1 — `GET /?token=…` (token exchange):

```
HTTP/1.1 303 See Other
cache-control: no-store
location: /
referrer-policy: no-referrer
set-cookie: dsh-auth-9o_WOrrppnUpd3HWtOxmaPKuTZhCz4zO81hoZobwGQ8=v1.eyJ2ZXJzaW9uIjoxLCJhdXRob3JpdHkiOiIxMjcuMC4wLjE6MzE4MiIsImlzc3VlZEF0IjoxNzg4NjA0ODMzNTAwLCJleHBpcmVzQXQiOjE3OTExOTY4MzM1MDB9.Uz8KSaNR2SuvSsLgQ0fsbssBbY51LQidOsfD_u4tKic; Max-Age=2592000; Path=/; Expires=Mon, 05 Oct 2026 10:40:33 GMT; HttpOnly; SameSite=Strict
Date: Sat, 05 Sep 2026 10:40:33 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked
```

Probe 2 — **the user's failing call**: `POST /team-remote/catalog.list`, `Content-Type: application/json`, with cookie, body `{"type":"client-request","rpcId":"rev2-1","method":"catalog.list","payload":{"version":1,"params":{}}}`:

```
HTTP/1.1 200 OK
content-type: application/json
Vary: Accept-Encoding
Date: Sat, 05 Sep 2026 10:40:38 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"type":"server-response","rpcId":"rev2-1","result":{"ok":true,"value":{"data":{"blueprints":[{"blueprintId":"my-team-bp-1","revisions":[1]}]},"provenance":{"origin":"team-remote","method":"catalog.list","endpoint":"catalog.list","contractVersion":1,"requestToken":null,"projectionGeneration":null,"effectSequence":null}}}}
```

Probe 3 — negative control, same POST **without** cookie:

```
HTTP/1.1 401 Unauthorized
Date: Sat, 05 Sep 2026 10:40:44 GMT
Connection: keep-alive
Keep-Alive: timeout=5

unauthorized
```

(401 unauth / 200 authed = the `/team-remote` route is registered; a 405 would have meant the frontend-static fallback answered.)

### RESTART — the user's exact regression (stamped domain, fresh process, same home)

```
dsh web: http://127.0.0.1:3182/?token=fVojKHd5dFd6ZpAUatlidwd7RPOvh7YWzoB4KiU90-c
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```

No `bootstrap FAILED` — had the row tried a strict create over the stamped medium, `bootstrap FAILED: TeamPluginError: … TEAM_DOMAIN_EXISTS` would have been printed and the route would not have mounted; instead the domain was **adopted** (phase resolved to resume) and the route mounted.

Re-probe — token exchange returned `HTTP/1.1 303 See Other`; the identical `catalog.list` POST returned:

```
HTTP/1.1 303 See Other

HTTP/1.1 200 OK
content-type: application/json
Vary: Accept-Encoding
Date: Sat, 05 Sep 2026 10:42:25 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

{"type":"server-response","rpcId":"rev2-1","result":{"ok":true,"value":{"data":{"blueprints":[{"blueprintId":"my-team-bp-1","revisions":[1]}]},"provenance":{"origin":"team-remote","method":"catalog.list","endpoint":"catalog.list","contractVersion":1,"requestToken":null,"projectionGeneration":null,"effectSequence":null}}}}
```

Home state after both boots: `storages/team_domain.json` (2714 B) stamped at 18:39:44 (first boot), mtime **unchanged** after the 18:42 restart → adopted, not re-initialized. Teardown: server killed (job kill of the managed boot process), `curl` probe → `000`. Raw probe captures: `vertical-probe1-index.txt`, `vertical-probe1-catalog.txt`, `vertical-probe2-catalog.txt` (this directory).

---

## Findings / defects

**F1 — the sole blocking finding (gate level, no behavioral impact): the lint gate is red at the commit under review.** `eslint .` (eslint 9.39.5, lockfile-pinned) exits 1 with **8 errors, all in files the diff introduced/modified** (the rest of the tree is lint-clean — base `5adc8b9` therefore clean):

| file:line | rule | note |
| --- | --- | --- |
| `packages/runtime/src/plugin/host.ts:593:9` | prefer-const | `pollTimer` declared `let`, assigned exactly once (L605) |
| `packages/runtime/src/plugin/host.ts:594:9` | prefer-const | `deadlineTimer` declared `let`, assigned exactly once (L626) |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts:165:26` | @typescript-eslint/no-explicit-any | `config: Record<string, any>` parameter — the file carries targeted disable comments for its other `any` usages (L157, L168, L174, L202-210) but missed this one |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts:220:1` | prefer-const | module-scoped `let team1` (decl L203), assigned once |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts:221:1` | prefer-const | module-scoped `let binding1` (decl L205), assigned once |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts:222:1` | prefer-const | module-scoped `let members1` (decl L207), assigned once |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts:227:1` | prefer-const | module-scoped `let createdAt1` (decl L208), assigned once |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts:233:1` | prefer-const | module-scoped `let team2` (decl L211), assigned once |

The repo's gate standard is lint-clean (every prior gate round in the router log records "lint 0"); the committed tree does not meet it, so the R135 claim "五门验证…已全部完成（R136 记录）" is not supported by the committed tree for the lint gate at this commit point. The fix is mechanical (const-at-assignment; one disable comment or a tightened type) and requires no design change. **No behavioral impact** — the flagged code is behaviorally correct as written (verified in the hygiene analysis above).

**No other defects found.** Specifically:

- No functional defect: root causes B / A / C are each genuinely severed (mechanism analysis + vertical 405 → 200 on first boot **and** restart + 15/15 new tests green).
- No semantic regression: strict `create`/`resume` semantics preserved; resume-never-mints intact (t12b2 W4 + S3 + glue two-value contract); the `create-or-open` value never reaches the root/glue contract.
- No timer/lifecycle defect: unref, single-settle guard, settle-on-stop, no double-register (webserver duplicate-prefix throw cannot be triggered from this code path).
- No error-path handle leak in the new storage entry: `closeHandleSafe` on every failure path; partial stamps fail closed exactly as the strict open entry does.
- No artifact drift: committed dist + composition-shim are a faithful fresh build (forensics above; the single CRLF sample is a local `core.autocrlf=true` materialization artifact, proven environmental).
- No red-line violation by the commit: CORE PATCH BUDGET = 0 holds — the diff touches no upstream path, no private/internal API, no patch mechanism.

---

## Red-line self-check (reviewer conduct)

- **No push / commit / force-push** performed; no refs created or moved by me.
- **Worktree `.worktrees\RMR-REV2`**: detached at `677b029`; left exactly as found — `git status --porcelain` **empty** at finish. (My builds' ignored outputs were removed; the autocrlf EOL materialization state was restored via `git checkout -- <artifact paths>`; the testkit's untracked `.tmp-fault` scratch — generated by the test suite itself and explicitly permitted by the mandate — was removed at the end.)
- **:3080 and `D:\deepseek-harness\` — zero contact.** The user's prebuilt CLI `D:\AgentDev\deepseek-harness\apps\cli\lib\bin.js` was executed read-only for the vertical, as explicitly permitted.
- **`C:\Users\user\.dsh-dev` — no writes**; not needed (R135's user-home claims were verified from code, not from that home).
- **`references/deepseek-harness-test-use` — read-only** (405 mechanism, L124-131 fallback; rpc-host registration; webserver duplicate-route throw); left pristine.
- **Ports**: only **3182** used (3180-family / 3181 / 3183 untouched). `Get-NetTCPConnection` not relied upon (known-unreliable here); curl probes used: `000` before boot, `000` after each server stop, `000` after final teardown.
- **My scratch**: confined to the reviewer-2 evidence directory (this path) + the mandated vertical home under `references/` (left on disk as evidence).
- **Spawn-restricted sandbox**: no denied spawn was retried by another means; documented equivalents used throughout (direct `tsc`/`eslint`/`run-tests`/`smoke` invocations; `pnpm install` from PowerShell; raw `cmd /c git show` for byte-accurate blob extraction).

## Reviewer notes

- Per ROUTER_RULES §3.1.3 process docs are normally not review material; per the mandate, R135 was read **as claims to verify** and every mechanism was re-derived independently from plugin + upstream source. R135's mechanism claims (B: stamped-empty domain + swallowed create; A: one-shot early connection read; C: zero signal) are all code-confirmed; its measurement numbers (+23 ms / +717 ms) were not independently reproduced and are not load-bearing for this verdict.
- Verdict granularity: the binary 通过/不通过 frame is mandated here; the router's four-valued framing would classify this round as **补充内容** (substantive supplement: fix F1's 8 lint errors + re-run `eslint .` to EXIT 0; no re-verification of the other gates is strictly required since they were independently re-run and reproduced, though a full five-gate re-run is the conservative choice).
