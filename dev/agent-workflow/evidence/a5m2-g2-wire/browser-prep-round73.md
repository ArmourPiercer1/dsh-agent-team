# A5M2-G2-WIRE round-73 — PUBLIC Browser / real-scenario PREPARATION map (read-only; nothing probed; no drafting for other owners)

## 0. Correction of my r72 claim (root)
`install-c8dd3f07b` EXISTS:
`/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b`
(one existence check this round; NOT re-audited, NOT modified — center's
receipt facts stand: final lock sha256 dad670ae74…b35217a, cold-import of
`dsh-agent-team/host` at NODE_RC=0 with the full 12-peer 0.2.0-rc.2
closure). My r72 "absent on this host" was scoped to the old pack-int/
bf4 FLAT npm tree and MUST NOT override this fixture. The r72 TEST-supply
table itself (zero missing) stands as booked.

## 1. The PUBLIC Browser chain (639 public-fact set, file:line)
- `@deepseek-ai/dsh-experimental-browser-use-stagehand-native` exports
  `"./src/*": "./src/*"` — package.json:21 (PUBLIC subpaths; npm caveat
  recorded r72: npm files lists exclude src; supported surface = full-639
  checkout + normal TS launch chain).
- `src/launch.ts:24` `export async function launchChromium(config:
  NativeBrowserConfig, signal: AbortSignal): Promise<OwnedChromium>`.
- `src/worker-client.ts:15` `export async function openBrowserWorker(...)`.
- Worker PUBLIC face: `src/worker-client.ts:71` `async execute(method,
  args, signal)` — exactly the face my lane binds.

## 2. My lane's g2 supply face, mapped at the packed 699cc face (file:line)
| # | item (what a real Browser-scenario leg needs from the supply) | 699cc-face evidence | state |
|---|---|---|---|
| 1 | closed stagehand_* mount-name table (6) | `live/team-tool-plane.mjs:180` `A5_G2_BROWSER_MOUNT_NAMES` = stagehand_act/extract/navigate/observe/screenshot/tabs | EXPOSED |
| 2 | per-surface injection seam (never a shared face) | `host.ts:1618` `{ key:'g2BrowserEnabled', injectKey:'g2Browser', family: browser, code:'G2_BROWSER_INJECT_INVALID', names: A5_G2_BROWSER_MOUNT_NAMES }` | EXPOSED |
| 3 | arm gate + approved-config ride | `live/agent-bindings.mjs:3625` arm triad; `:3614-3615` facts ride `planeCfg.g2Browser` (approved config) | EXPOSED |
| 4 | browserMount forwarding to the mount | `live/agent-bindings.mjs:3701-3702` `{ mode: planeCfg.g2Browser.mode, nativeConfig: … ?? {} }` | EXPOSED |
| 5 | producer-side all-or-nothing pairing (mapping NEVER without its approval edge) | `host.ts:2553-2571` mapping passed ONLY when `g2Mount.consumeBrowserApproval` is a function, then `out.consumeBrowserApproval` + `out.callResource` together | EXPOSED |
| 6 | lease law on the resource call (public execute on the LEASE-OWNED runtime, no swap) | `host.ts:2573+` `g2CallResource` binds `resource.value.execute(method,args,signal)` (worker-client.ts:70-71 public face), refusal otherwise | EXPOSED |
| 7 | consumer-side pairing guard | `live/agent-bindings.mjs:3677-3685` browserEntries pairing requires BOTH faces, else typed refusal; `:3685` consumed-proof approval for armed-but-unpaired | EXPOSED |
| 8 | mount-side port creation | `live/governed-families/g2-team-mount.mjs:208-215` browserMount requires `callResource` fn, then `createG2TeamBrowserPort({...browserMount, observe lane:'browser'})` | EXPOSED |
| 9 | honest public-gap ledger (public port genuinely absent) | `host.ts:2434-2443` cites `g2-supply-public-gap-639.md`: TEAM-scoped `mcpResources` retrieval and per-SESSION `consumeBrowserApproval` are TYPED REFUSALS (no getters, no global provider swap); lazy-bind increment NAMED | RECORDED |

## 3. What a REAL Browser-scenario leg additionally requires (NOT supply-face gaps)
1. `planeCfg.g2BrowserEnabled === true` + `planeCfg.g2Browser` with the
   REAL `{mode:'launch'|'attach', nativeConfig:{…}}` (approved config —
   owner-side, not drafted here).
2. The per-session PA approval producer wired onto `g2Mount`
   (bindings-owned session edge; structurally armed at #5/#7; the REAL
   approval flow is a live-Host act).
3. Stagehand tool registration visible via the public tools face
   (`readNative = agentCtx.tools.get(name, runtimeAgent)` pattern,
   bindings:3078) on a running same-Host instance.
4. Chrome executable present for `launchChromium` (launch mode).
My supply face already exposes every PUBLIC element it can; per the gap
ledger (#9) the residual items are public-port absences, already typed-
refused — nothing private is needed or used.

## 4. Honest UNVERIFIED list (no probing performed)
- same-Host running instance with the experimental browser plugin active;
- Chrome executable presence/version/launchability;
- live `ctx.tools` census of stagehand_* registration on that instance;
- real end-to-end approval (PA plane) flow.
No numbers-inflation: none of the above was measured; all are declared
unverified.
