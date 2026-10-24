# A5M2-G2-WIRE round-74 — Browser REAL-SOURCE-ENTRY / SAME-INSTANCE prep map (read-only; no probing, no boot, no installs; new fixture untouched)

Deployment-conditions law (root, recorded): source-Host 639 (public
`./src/*` + TS launch/worker route) and the standard npm fixture are
DIFFERENT deployment conditions; "npm package files exclude src" NEVER
means the source Host lacks src. The new frozen fixture
`tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b`
(lock sha256 dad670ae74…b35217a, cold-import of `dsh-agent-team/host` at
NODE_RC=0, full 12-peer 0.2.0-rc.2 closure) is FACT on record — never to
be re-audited/modified by this lane, and the old pack-int/bf4 FLAT npm
tree is NOT the reference for Browser readiness.

## 1. The public source-entry chain (file:line, 639 checkout @639ed01539)
- Root launch chain (root fact): 639 root `package.json:202`
  `"dsh": "node --import tsx/esm apps/cli/src/bin.ts"`; entry
  `apps/cli/src/bin.ts:1` shebang → `@deepseek-ai/dsh-app-boot` startup
  (bin.ts:9-11 imports loadLayeredEnv/resolveDshHome/parseDshArgs).
- Browser public entry pair (user-ruling-3 public lifecycle set):
  - `packages/experimental/browser-use-stagehand-native/src/launch.ts:24`
    `export async function launchChromium(config: NativeBrowserConfig,
    signal: AbortSignal): Promise<OwnedChromium>`;
  - `.../src/worker-client.ts:15`
    `export async function openBrowserWorker(...)`.
- Worker TS branch (same-source execution, root fact confirmed in bytes):
  `worker-client.ts:25-31` — BUNDLED form (`!import.meta.url.endsWith('.ts')`)
  spawns `./worker.js` directly (:26); SOURCE form takes the TS branch:
  data-URL bootstrap `import { register } from 'tsx/esm/api'; register();
  await import(.../worker.ts)` (`:29`), with `TSX_TSCONFIG_PATH` forwarded
  (`:22`) and the credentials discipline (only explicit model credentials
  cross workerData; ambient creds/proxy stay out, `:20` comment).
- Worker PUBLIC call face: `worker-client.ts:71`
  `async execute(method, args, signal)` — the exact face the lane's
  `g2CallResource` binds on the LEASE-OWNED `resource.value` (lane
  host.ts:2573+; law: no runtime swap, close owner stays the lease).

## 2. Same-instance Browser scenario — what the lane already provides (699cc face, carried from r73)
Closed six-name table `team-tool-plane.mjs:180`; per-surface inject seam
`host.ts:1618`; arm triad + approved-config ride
`agent-bindings.mjs:3625/:3614-3615`; `browserMount {mode,nativeConfig}`
forwarding `:3701-3702`; producer ALL-OR-NOTHING pairing (mapping never
without `consumeBrowserApproval`) `host.ts:2553-2571`; consumer pairing
guard `agent-bindings.mjs:3677-3685`; mount-side
`createG2TeamBrowserPort` requires `callResource`
`g2-team-mount.mjs:208-215`; public-gap typed refusals recorded
`host.ts:2434-2443` (TEAM-scoped mcpResources; per-session
consumeBrowserApproval lazy-bind increment NAMED — nothing private used).

## 3. What SAME-INSTANCE adds on top (chain-level, mapped)
1. The instance runs the SOURCE launch chain (`node --import tsx/esm
   apps/cli/src/bin.ts`): the plugin's worker then takes the TS branch
   (`worker-client.ts:27-31`) IN THE SAME source tree — the same
   `src/worker.ts` the mount's names resolve against; './src/*' being
   PUBLIC makes every leg above a legal import under this condition.
2. The mount's `readNative` (public tools face census,
   `agent-bindings.mjs:3078` pattern) must observe the six stagehand_*
   registrations from THAT instance's ctx.tools — same-instance = the
   lane's `browserMount.callResource` executes against the very worker
   whose `launchChromium`/`openBrowserWorker` produced the lease.
3. `planeCfg.g2Browser` approved config carries the real
   `{mode:'launch'|'attach', nativeConfig}` for that host's Chrome.
4. PA approval producer (per-session) rides `g2Mount` (structural arming
   exists; real flow is a live-Host act).

## 4. Honest TO-VERIFY list (NOTHING probed or booted; no Host GO)
- real Chrome executable present/launchable/version on the same Host;
- a running same-Host source-639 instance with the stagehand plugin
  ACTIVE (ctx.tools census of the six names);
- live tsx/esm worker TS-branch bootstrap succeeding on that instance;
- end-to-end PA approval through the real per-session edge.
All four declared UNVERIFIED; no numbers, no probing, no boot without
Host GO. New fixture untouched; no installs/clones; no mock-count tables.
