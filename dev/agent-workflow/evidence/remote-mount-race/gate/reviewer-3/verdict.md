# GATE VERDICT — reviewer 3 (blind) — task `task/remote-mount-race`

**Reviewed commit:** `677b029` (branch `task/remote-mount-race`, off base `5adc8b9`)
**Review worktree:** `.worktrees/RMR-REV3` (detached @ 677b029)
**Reviewer workspace home (vertical):** `references/.dsh-test-rmr-rev3-20260905T18-32-55` (left on disk as evidence)
**Port:** 3183 only. **Toolchain:** `pnpm install --frozen-lockfile` (lockfile-pinned: eslint 9.39.5, typescript-eslint 8.68.0, typescript 6.0.3, vitest 4.1.11); tsc invoked directly; tests via `scripts/run-tests.mjs` (repo-documented spawn-restricted equivalent); vertical via the prebuilt CLI `D:\AgentDev\deepseek-harness\apps\cli\lib\bin.js` (read-only use, permitted).

---

## 裁决: **不通过**

The functional core of the fix is verified correct end-to-end (root causes re-derived and severed, all new and pinned test worlds green, smoke green, live first-boot + RESTART vertical green, adopt-without-restamp proven byte-for-byte). **However the commit does not meet all gate criteria as specified:**

1. **The repo's lint gate is RED on this commit — 8 new errors, base `5adc8b9` is clean (F-1, gate-deciding).**
2. **The artifact-freshness gate is NOT empty — all 508 committed build artifacts (dist + composition-shim) are CRLF in the git blobs while a fresh deterministic build emits LF; content is byte-identical modulo CR (F-2, reported; judged non-blocking in itself, but the gate criterion as specified is not met).**

Both defects are mechanical with zero behavioral impact; remediation is small. No red-line violation, no frozen-semantic violation, no functional defect found.

---

## 1. Independent root-cause analysis (re-derived from the code, not from the task log)

**Symptom chain (reconstructed):** `POST /team-remote/catalog.list` → HTTP 405 means the `/team-remote` route prefix was never registered (the webserver's frontend-static fallback answers unmatched non-GET/HEAD POSTs with 405; a registered route yields 401 unauth / 200 authed — verified live in both states during the vertical). The route is registered only if the host row's bootstrap reaches the mount step.

### Mechanism B — returning-home `create` throws, bootstrap rejection swallowed (the user-world trigger)

Base code (reconstructed from `5adc8b9` sources):

- The shipped bundle row hardcoded `bootPhase: "create"` (`cordis.patch.yml` @ base).
- `createTeamDomain` (`packages/storage/repositories/team-domain.ts` @ base) is the STRICT fresh-world entry: an already-stamped domain → `TEAM_DOMAIN_EXISTS`.
- In any home that booted once, `team_domain.json` is stamped; every restart therefore threw at the domain step — **before the mount step** — and the bootstrap rejected.
- The entry armed `void ready.catch(() => undefined)` (base `host.ts` L653): the rejection was absorbed with **zero terminal signal** → `/team-remote` never registered → the team UI's remote transport 405s forever. A restart alone can never recover (the domain stays stamped) — the handoff's "restart likely recovers" intuition is wrong, which I confirm from the code.

The diff severs this:

- New `createOrOpenTeamDomainDetailed` (team-domain.ts L256-307): `schemaMeta.size === 0` → full eight-store stamp (`created: true`); already stamped → adopt with the SAME L2 per-store validation as `openTeamDomain` (`created: false`), stamps never touched; partial stamping (crash between the 8 writes) → `SCHEMA_STAMP_MISSING` with the exact first missing store — **diagnosed, never repaired**; L1 version mismatch fails at the seam open; non-seam → `SEAM_FAILURE`. Error paths release the handle (same as the other entries).
- New row phase `'create-or-open'` (host.ts L652-662): after the domain step, `resolvedPhase = outcome.created ? 'create' : 'resume'` and `resolvedRowConfig` (host.ts L677-679) is passed to the live glue and the root. The root (`root.ts` L1601) and the glue (`agent-bindings.mjs` L839-840, which independently validates the two-value contract) therefore **still see only `'create' | 'resume'`** — their strict contracts are untouched, so `resume`-never-creates (plan §7-B2 / T12-B2 W4) cannot be leaked by the new phase.
- `cordis.patch.yml` switches the bundle row to `bootPhase: "create-or-open"` with a decision comment.
- The swallowed rejection is now surfaced: `void ready.catch(...)` logs `[dsh-agent-team] bootstrap FAILED: ...` (host.ts L700-710) — a swallowed bootstrap can no longer present as a silent half-world (verified live in the smoke negative probe).

### Mechanism A — one-shot `connection` read at the mount step (latent race)

Base code: the mount step read `ctx.get('connection')` exactly once; absent → permanent `skipped`, no retry, no re-check, no log. The web profile's `connection` service is provided by the client-connection row on an independent fiber (no dependency edge to the team row), so on a slow boot the service can legitimately appear after the one-shot read → permanent silent skip → 405. (The mechanism is confirmed in code; the specific repro timings in the task log are treated as claims — not needed for my analysis.)

The diff severs this:

- New config `remoteMountWaitMs` (types.ts; validated non-negative integer, negative → `TEAM_PLUGIN_CONFIG_INVALID` naming the field, host.ts L256-266). Default 30000; `0` = pre-fix IMMEDIATE decision (used by the headless test worlds to keep their observable semantics — see §4).
- Mount step (host.ts L836-872): present → mount immediately (original path); absent + waitMs>0 → `pending` + `armRemoteMountWatcher` (host.ts L590-638): second row effect, 100 ms poll (`REMOTE_MOUNT_POLL_MS`), deadline timer, both `unref`'d. Late appearance → mounts through the SAME registration path (`mountRemoteNow(root, candidate, allowFailure=true)`) with the exact late service object; late malformed / registration failure → terminal `failed`, **recorded not thrown** (bootstrap already settled); window expiry → terminal `skipped` naming the window; row stop while pending → terminal `skipped` (facade never leaves a dangling `pending`). Late mount's registration is disposed by the existing row-stop backstop (single disposer, idempotent).

### Mechanism C — observability gap (both terminal mount outcomes and the ready rejection were silent)

Fixed: every terminal `RemoteMountState` logs one `console.error` line — `MOUNTED` (with `+N ms late` when applicable), `SKIPPED` (reason), `FAILED` (reason) — via `logRemoteMountOutcome` (host.ts L499-523). Verified live: the smoke negative probe and both vertical boots emitted the new lines with nothing else on stderr.

### Scope honesty (not a defect, recorded for the risk ledger)

A home whose domain is stamped **but carries no Team identity for the configured root** (the exact state of the user's diagnostic home per the handoff: stamped, all data tables empty — a first boot that died after stamping) does NOT self-heal under this fix: `create-or-open` adopts (`created: false`) → resolves to `resume` → the root's resume branch fails closed with `TEAM_PLUGIN_RESUME_STATE_MISSING` — now LOUDLY (console line), and the documented one-time stopgap (delete the empty `team_domain.json`) applies. Never-silently-repair-a-partial-world is the correct strict semantics; the fresh-install case (the acceptance target) is fully fixed, as the vertical proves.

---

## 2. Gate numbers

| Gate | Result | Detail |
|---|---|---|
| Typecheck | **9/9 pass** | 8 packages via `tsconfig.json`; `legacy` ships only `tsconfig.build.json` (no typecheck config — it is the `noCheck` mirror build into runtime dist) — verified clean via `tsc -p packages/legacy/tsconfig.build.json --noEmit`. Raw: `tsc-typecheck-build.log`. |
| Build | **9/9 pass** + composition steps exit 0 | `tsc -p <pkg>/tsconfig.build.json` × 9; `scripts/place-dist-glue.mjs` (1 placement, byte-identical); `scripts/build-client-composition.mjs` (85 modules, 11 css). |
| Tests | **2448 passed / 4 failed / 2452 total** (14.2 s) | The 4 failures are EXACTLY the documented pre-existing baseline — audited-shim matcher TypeErrors in files the diff does NOT touch: `packages/client/test/client-plugin-mount.test.ts:651` `toBeNull` (1) and `packages/runtime/test/pbf-default-artifact-urls.test.ts:76,85,116` `toHaveLength`/`toBeUndefined`×2 (3). Raw: `tests-full.log`. New/pinned worlds all PASS: `rmr-create-or-open.test.ts` (5), `rmr-remote-mount-race.test.ts` (7), `rmr-create-or-open-boot.test.ts` (3), `t12b2-resume-separation.test.ts` (5 — W4 "resume never creates" intact, file untouched by diff), `t12m4-remote-mount.test.ts` (9), `p8s5a-production-assembly.test.ts` (7 — T1.7 single-effect intact via the `remoteMountWaitMs: 0` pin), `p4t6-session-event-scan.test.ts` (10 — file-count pin 603→606 passes with the 3 new test files). |
| Lint | **FAIL — 8 errors, all NEW in this commit** | `eslint .` exit 1. Base `5adc8b9` on the main repo with the identical lockfile-pinned toolchain: exit 0, zero issues. See F-1. Raw: `lint.log`. |
| Smoke | **PASS** (exit 0) | Both built entries load, shape-valid, fail loud on degenerate context (host ready-code `TEAM_PLUGIN_CONFIG_INVALID`). The negative probe now prints the new `[dsh-agent-team] bootstrap FAILED: ...` console line — the intended observability, not a failure. Raw: `smoke.log`. |
| Artifact freshness | **DRIFT (reported, F-2)** | After the fresh deterministic build, `git status --porcelain -- packages/runtime/dist packages/client/composition-shim` = **508 modified files, NOT empty**. `git diff --ignore-cr-at-eol` over the same paths = **EMPTY** (content byte-identical modulo CR): committed blobs are CRLF (e.g. host.js 772 CR, client-bundle.js 14228 CR), fresh build emits LF (0 CR); machine `core.autocrlf=true`. Raw: `artifact-drift-status-full.txt`, `artifact-drift-ignore-cr-eol.txt`, `artifact-drift-crlf-evidence.txt`. |
| Live vertical | **PASS** (first boot + RESTART) | See §3. |

---

## 3. Live vertical evidence (port 3183, fresh home, committed install bytes)

Home: `references/.dsh-test-rmr-rev3-20260905T18-32-55` — profile files only from `.dsh-diag-405-2026-09-05T16-35-38\profiles\web` (node_modules excluded); install surface = the COMMITTED bytes of 677b029 from my worktree (root `package.json` + `cordis.patch.yml`, `packages/client/composition-shim`, `packages/runtime/dist`, `packages/runtime/root-binding`, `packages/runtime/src/plugin/upstream-resolver.mjs`); `settings.yaml` copied; NO sessions/, storages/, .credentials.yaml, .anonymous-user-id (first-ever-boot state). The profile's own `cordis.patch.yml` is `[]` (no row override — the bundle layer's `create-or-open` stands as-is).

### FIRST boot — `vertical-first-boot.log` (verbatim, complete)

```
dsh web: http://127.0.0.1:3183/?token=vKsgCMBbuSUuaCv4Ipt3kZG1Bd5iIJ11gEgIR8VmMvI
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```
(The `node : ... RemoteException` wrapper lines in the raw log are PowerShell's stderr classification of the console.error line — the log contains exactly the two product lines above.)
- Required line `remote mount: MOUNTED channel=/team-remote`: **PRESENT** (immediate path — `connection` was present at the mount step in this boot; the late-mount path is pinned by `rmr-remote-mount-race` scenario 1).
- `bootstrap FAILED` lines: **0**.

Wire probe (raw: `vertical-first-token-probe.txt`, `vertical-first-catalog-probe.txt`):
- `GET http://127.0.0.1:3183/?token=vKsg...` → **`HTTP/1.1 303 See Other`** + `set-cookie: dsh-auth-vQDQxooHHFvxzSO5Pq7_c_16lXf1oGL-DrRubpYscDE=...; Max-Age=2592000; Path=/; HttpOnly; SameSite=Strict`
- `POST /team-remote/catalog.list` (cookie, body `{"type":"client-request","rpcId":"rev3-1","method":"catalog.list","payload":{"version":1,"params":{}}}`) → **`HTTP/1.1 200 OK`**, body:
  `{"type":"server-response","rpcId":"rev3-1","result":{"ok":true,"value":{"data":{"blueprints":[{"blueprintId":"my-team-bp-1","revisions":[1]}]},"provenance":{"origin":"team-remote","method":"catalog.list","endpoint":"catalog.list","contractVersion":1,...}}}}`
  — contains `"blueprintId":"my-team-bp-1"` ✓. The user's 405 is gone.

Sidecar captured pre-restart: `sha256(team_domain.json) = 1d185b289d8e454d5c517a488432c44e61a4271e64b9da63dd324c669883d07b` (2714 B).

### Kill + RESTART — the user's exact regression

Killed the two server PIDs (started 18:34:47; the 0:37 harness process at PID 76664 untouched) → probe **`000`** (down). Rebooted the SAME home on 3183 — `vertical-restart-boot.log` (verbatim, complete):

```
dsh web: http://127.0.0.1:3183/?token=CwOypnexzRDlTmH9epf9uhvxc33wis-r55ujo4n_JgE
[dsh-agent-team] remote mount: MOUNTED channel=/team-remote
```
- `bootstrap FAILED` lines: **0**. The stamped domain was **adopted, not re-created** — no `TEAM_DOMAIN_EXISTS`, no failure.

Wire re-probe (raw: `vertical-restart-token-probe.txt`, `vertical-restart-catalog-probe.txt`): `GET /?token=...` → **303** + set-cookie; `POST /team-remote/catalog.list` → **`HTTP/1.1 200 OK`** with `"blueprintId":"my-team-bp-1"` ✓.

**Adopt-without-restamp at the product level:** `sha256(team_domain.json)` post-restart = `1d185b28...` — **byte-identical** to pre-restart (stamps preserved; `created: false` path touched nothing).

### Teardown

Server killed → 3183 probe **`000`**; remaining node processes: the 0:37 harness (untouched) plus one transient. Home left on disk as evidence.

---

## 4. Findings

### F-1 — Lint gate red: 8 new errors, base clean (GATE-DECIDING)

`eslint .` (lockfile-pinned eslint 9.39.5 + typescript-eslint 8.68.0) — base `5adc8b9`: **exit 0, zero issues**; commit `677b029`: **exit 1, 8 errors**, all in code introduced by this diff:

| File | Line | Rule | Note |
|---|---|---|---|
| `packages/runtime/src/plugin/host.ts` | 593 | `prefer-const` | `let pollTimer` — assigned once (L605), only READ in `settle()` (L599) |
| `packages/runtime/src/plugin/host.ts` | 594 | `prefer-const` | `let deadlineTimer` — assigned once (L626), only READ in `settle()` (L600) |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts` | 165 | `@typescript-eslint/no-explicit-any` | `config: Record<string, any>` — the only `any` in the file missing the eslint-disable comment its siblings carry (L157, L168, L174) |
| `packages/runtime/test/rmr-create-or-open-boot.test.ts` | 220, 221, 222, 227, 233 | `prefer-const` | `let team1 / binding1 / members1 / createdAt1 / team2` — each assigned exactly once, never reassigned |

Zero behavioral impact; purely mechanical remediation (7× let→const, 1× disable comment or typed parameter). The commit breaks the repo's own quality gate and would carry a red `pnpm lint` into the integration branch.

### F-2 — Artifact-freshness gate not empty: 508 artifacts, CRLF-only drift (reported)

After the fresh deterministic build (9× `tsc -p tsconfig.build.json` + `place-dist-glue` + `build-client-composition`), `git status --porcelain -- packages/runtime/dist packages/client/composition-shim` lists **508 modified files** (full list: `artifact-drift-status-full.txt`; representative: `dist/packages/runtime/src/plugin/host.js`, `dist/packages/contracts/src/dto/*.js`, `composition-shim/client-bundle.js`, …). Root cause: the committed blobs were committed with CRLF line endings (implementer-machine git normalization); tsc and the in-repo composition builder emit LF. `git diff --ignore-cr-at-eol` over both paths is **empty** — the content, including all fix code in the committed dist, is byte-identical modulo CR. Functionally inert (proven: the vertical booted and served from the committed bytes). Remediation: normalize the committed artifacts to LF (or add `.gitattributes` with `text eol=lf` for the two artifact trees) so a fresh build byte-matches the commit. I judge this non-blocking in itself (content-identical; the prior prebuilt-artifacts gate carried a CRLF note to its risk ledger), but the gate criterion as specified ("must be EMPTY") is not met, so it is reported as part of a non-green gate.

### No functional defects found

- Both 405 mechanisms are severed in code (§1); the third (observability) adds the missing terminal signals, verified live.
- `create`/`resume` strict semantics preserved: `t12b2-resume-separation` (5/5, untouched file) — W4 resume-never-creates intact; boot S3 pins strict `create` still failing `TEAM_DOMAIN_EXISTS` over a stamped medium; the row-level `create-or-open` resolves to the two-value contract before root/glue see it (`resolvedRowConfig`), and the glue's own two-value validation (agent-bindings.mjs L839) is satisfied by construction.
- Partial-create is diagnosed, never repaired (storage S3: identical `SCHEMA_STAMP_MISSING` to strict open, exact store, `found: null`).
- Watcher lifecycle is sound: single `settled` guard, timers unref'd and cleared, row-stop settles terminal `skipped` while pending, late-mount registration disposed by the existing backstop (scenario 4 pins exactly one effect at `remoteMountWaitMs: 0`, keeping T1.7's single-effect invariant honest rather than silently weakened).
- Frozen documents (`docs/plans/paused/`, read from the main repo — they are gitignored and absent from the worktree): `bootPhase` grep = **0 hits**; all `resume` mentions are agent/session cold-resume semantics (e.g. Architecture §30.3, §36), none constrain a plugin-row boot phase. **No SPEC_CONFLICT.** The new phase is a defined, documented production default; `'create'`/`'resume'` keep their frozen roles.
- Test sufficiency: the three new files pin fresh init, adopt-without-restamp (value-for-value `stampedAt`; boot-level `createdAt` byte-identity), partial-create diagnosis, L1 mismatch, non-seam, late mount through the exact late-appearing service with the frozen envelope, window-expiry skip naming the window, late-malformed → `failed` after settle, `0` = immediate single-effect decision, row-stop pending → terminal skipped, negative config validation naming the field, and the end-to-end row-level phase resolution (fresh→create/mint, restart→resume/load, strict-create fail-closed). Together with the live vertical (including the restart + sidecar hash), the claimed behaviors are pinned at unit AND product level.

---

## 5. Red-line self-check

- No edits to upstream DSH or `references/deepseek-harness*`; **CORE PATCH BUDGET = 0** — verified: the diff touches only `packages/`, `cordis.patch.yml`, and `dev/agent-workflow/` (evidence files).
- `references/deepseek-harness-test-use`: `git status --porcelain` = empty, HEAD `76fda72979` (pristine). I only READ it (plugin-loader semantics).
- `:3080` stable instance: probe 401 (up, untouched) before and after all work; `D:\deepseek-harness\` never written (its prebuilt CLI executed read-only, explicitly permitted); `C:\Users\user\.dsh-dev` never read or written (one mistyped PowerShell variable briefly pointed commands at `C:\Users\user` — every such write was DENIED by the sandbox; nothing left there); `references/deepseek-harness-test-use` pristine.
- No push, no force-push, no commits: my worktree HEAD remains `677b029`; status shows only the permitted untracked test scratch `packages/testkit/test/.tmp-fault/` (never staged). All my build side effects on `packages/runtime/dist` and `packages/client/composition-shim` were restored (`git checkout --`); the vertical ran against the COMMITTED bytes.
- Only port 3183 used (3180 family untouched; 3181/3182 untouched). Port state verified by `curl.exe` probes (000/401/200/303), not `Get-NetTCPConnection`.
- All long commands ran with hard timeouts (background jobs, 10–30 min caps); the vertical server was killed by PID selection (StartTime), verified down by probe before and after.

---

## 6. Evidence files (this directory)

`verdict.md` (this file) · `tests-full.log` (full suite output) · `tsc-typecheck-build.log` · `lint.log` (8 errors) · `smoke.log` · `artifact-drift-status-full.txt` (508 files) · `artifact-drift-ignore-cr-eol.txt` (empty) · `artifact-drift-crlf-evidence.txt` · `vertical-first-boot.log` · `vertical-first-token-probe.txt` · `vertical-first-catalog-probe.txt` · `vertical-body.json` · `vertical-restart-boot.log` · `vertical-restart-token-probe.txt` · `vertical-restart-catalog-probe.txt` · `vertical-body2.json` · `vertical-team-domain-after-first-boot.json` (sidecar pre-restart).
