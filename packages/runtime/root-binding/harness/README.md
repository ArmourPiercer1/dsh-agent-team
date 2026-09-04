# P5-T5 real-instance harness (root binding, I-1 real binding)

Drives a **real DSH test instance** through the four root-binding scenarios
using **public surfaces only**. This is the first P5 task that boots a real
DSH instance; all earlier P5 layers are mock-first units.

## Files

| File | Role |
| --- | --- |
| `run.mjs` | Entry point. Preflight → (optional build chain) → junction farm → fresh DSH_HOME → boot 1 (S1→S3→S4) → boot 2 (S2, process restart) → postflight → `summary.json`. |
| `plugin.mjs` | The Cordis row (`p5t5-root-binding`) mounted into the instance. Reads `<DSH_HOME>/p5t5-directive.json`, opens the real TeamDomain through the `storageDomain` seam, registers two scoped webServer routes, and executes the scenarios with assertion-based reports. |
| `seam.mjs` | `createRealStorageDomainSeam(storageDomain)` — the adapter between the productized module's storage seam and the real `storageDomain` service (json backend → `<DSH_HOME>/storages/`). |
| `slots.mjs` | Builds the real overlay slots (persona via agent preset + `installModelSelection`, capability via the real `tools`/`skills`/MCP seams) on top of a live agent handle. |
| `mini-mcp.mjs` | Tiny in-process MCP server (JSON-RPC over HTTP, `ping`→`pong`) for the capability overlay's MCP facet. Ports 3481–3485 (first free). |
| `ts-loader.mjs` | Node ESM `module.register` resolve hook: rewrites `.js`→`.ts` for worktree `packages/**` specifiers so the row consumes the worktree's TypeScript sources (plain JS otherwise; no bundling). |

## Scenarios

| ID | Boot | Surface story |
| --- | --- | --- |
| S1 fresh Team root | 1 | `agents.create` (plain root session) → `bindFreshTeamRoot` (TeamDomain write port + real surface + real slots, admission guard `open`) → model select from blueprint `defaultModel` → verify durable records, persona/model/capability overlays, admission `ADMISSION_OPEN`, durable session file. |
| S3 admission fail closed | 1 | Same as S1 but the admission guard policy is `closed`: overlays install, the decision is `rejected` with `ADMISSION_TEAM_POLICY_CLOSED` (fail-closed, **not** an error), durable state stands, instance stays healthy. |
| S4 ordinary root | 1 | `rehydrateColdTeamRoot` on an unbound session: zero-effect no-op (`noopReason: 'ordinary'`, no events, no durable writes, no residency installs). |
| S2 cold root (process restart) | 2 | Same DSH_HOME, new process: `agents.resume` of the S1 root (app-faithful order: model selection installed in setup, preset mounted in setup), model ref re-seeded from the durable `modelSelection` projection, `rehydrateColdTeamRoot` → durable present with `wrote:false`, scope restored, re-admitted, **zero** durable writes this boot. |

Ordering constraint: S3 and S4 run in boot 1 **after** S1 (TeamDomain unit
must exist; S1's session is the durable anchor S2 resumes).

## Run

From the worktree root (or pass an absolute `--report-dir`):

```
node packages/runtime/root-binding/harness/run.mjs \
  --report-dir dev/agent-workflow/evidence/P5-T5/harness-output \
  --scenarios S1,S3,S4,S2 \
  --port 3180
```

- `--port` (default 3180): boot 1 port; boot 2 uses `port + 1` (3181).
- `--scenarios` (default `S1,S3,S4,S2`): subset in canonical order; boot 2 is
  skipped entirely when S2 is not selected.
- Exit code 0 = all selected scenarios pass + all self-checks green.
- Outputs in `--report-dir`: `summary.json`, `run.log`, `<S>.json` reports,
  `<S>.error.json` (on failure), `dump-config-boot<N>.txt`, `logs/` (instance
  logs, build logs if the build chain ran).

## Pristine / safety self-checks (recorded in `summary.json`)

- test-use tree (`references/deepseek-harness-test-use`) `git status` clean
  **before** the run, after the build chain (if it ran), and **after** the run;
- stable instance `:3080` reachability recorded before and after (GET only,
  3 s timeout — the stable instance is never touched);
- ports 3180/3181/mini-MCP released after every stop;
- `dump-config` proves the row mounted **only** through the public
  profile-patch seam (`<DSH_HOME>/profiles/web/cordis.patch.yml`).

Build chain (only when a farm package's `lib/` is missing, e.g. a pristine
test-use checkout): `pnpm install --ignore-scripts` then
`node scripts/build.ts` with `DSH_CLIENT_COMMIT_HASH=76fda72979`,
`ESBUILD_WORKER_THREADS=1`, inside the test-use tree. Artifacts are
gitignored; the pristine check re-verifies afterwards. The `build:web` step
(vite → esbuild service spawn) is **not buildable in-sandbox** (piped-stdio
spawn EPERM, TEST_METHODS §3); the harness tolerates exactly that failure
when the complete `build:lib` artifact set is present (recorded as
`summary.build.webBuildSandboxLimited`) — host-side functionality, which is
all this harness exercises, does not need the web shell bundle.

## Public surfaces used (name → origin)

See `dev/agent-workflow/evidence/P5-T5/public-surfaces.md` for the full
file:line registry. Summary:

- profile-patch row mount — `DshInstance.mountRows` → `<DSH_HOME>/profiles/web/cordis.patch.yml` (public composition seam);
- `dump-config` — `DshInstance.dumpConfig` (host CLI, public);
- scoped surface — the row's `webServer.register` routes `/__p5t5/health`, `/__p5t5/run` (public `webServer` service);
- durable control plane — `<DSH_HOME>/storages/team_domain/` (public `storageDomain` json backend);
- durable session log — `<DSH_HOME>/sessions/<project>/<sid>/session.jsonl.zstd` (public session store layout);
- agent/preset/system-prompt/model seams consumed by the row — `agents`, `agentPresets`, `systemPrompt`, `sessionProjections`, `sessions`, `storageDomain` (public Cordis services).

## P5-T6 reuse (crash / restart / corrupt reruns)

The harness is reusable: rerun any scenario subset with the same command
(e.g. `--scenarios S2` for a restart rerun). For crash/corrupt variants,
mutate the DSH_HOME durable state **between** boots (the directive is the
single input; the row re-reads it on every process start). The directive
contract and report schema are stable; extend `run.mjs`'s `driveBoot`
rather than forking the plugin.

## Documented limitations (harness-internal stand-ins)

1. **Directive = blueprint payload stand-in.** The real system will carry the
   immutable Blueprint snapshot in a durable store owned by an upstream task;
   here the directive file (written per boot by `run.mjs`) is the transport.
   The productized module still validates and pins `blueprintId/revision/
   contentHash` exactly as specified.
2. **Admission policy stand-in.** `admissionPolicyByScenario` in the
   directive simulates durable admission state; the guard itself is the
   production-shaped `AdmissionGuard` seam (fail-closed on unknown policy or
   guard error).
3. **Cold-residency model ref.** The app-faithful pattern seeds the model ref
   from the `modelSelection` projection at resume time (resume.js probe
   L134-138 pattern); `installModelSelection` does **not** auto-restore from
   durable events — the seeding is done in the row's resume setup, matching
   the app.
4. **Post-publish preset mount.** S1/S3 mount the persona preset on the live
   (already-published) agent handle; the P2 precedent proved select works
   post-publish, mount is the untested leg — the row records
   `obs.mountErrors` so a failure is visible in the report rather than silent.
5. **Static model.** `defaultModel` is a static provider/model pair; no model
   provider is ever contacted (no LLM calls in this task).
