# G2 per-Team supply — public-port audit @ host 639ed01539 (round-19)

## REAL today (wired in host.ts buildG2TeamSupply, config-gated)
- entries: createG2TeamAssemblySupply -> SIGNED loadG2TeamAssemblyEntries
  (g2-team-assembly.mjs:118-148; PUBLIC entry files by approved path;
  openNativeBrowser-direct stays rejected there).
- transport: createTransport(config) — mcp-client/src/transport.ts:31,
  PUBLIC via the package exports map "./src/*": "./src/*". The host closure
  binds the APPROVED per-server record (serverConfigs) by target.server
  (transport axis must match); unknown name -> throw; row-side facts never
  derive a connection (assembly :331 requires Transport {start,send,close}
  — createTransport answers exactly that).
- browser worker mapping: PUBLIC worker face execute(method, args, signal)
  (worker-client.ts:70-71; the host stagehand plugin itself calls
  resource.native.execute(method, args, signal) @index.ts:187).

## Genuinely missing public ports (TYPED refusal today — no getter invented)
1. TEAM-SCOPED mcpResources face. Actual API: class McpResourceRuntime
   (mcp-resources/src/index.ts:56 super(ctx,'mcpResources')); register
   (:80) writes the CAPTURED fiber ctx's layer; reads resolve per-agent via
   layers.merge(exec.agent,...) (:123). Only host usage = the composition
   fiber ctx.inject(['mcpResources'], cb) (mcp-client/src/server-context.ts
   :29). Tried: global-store ctx.get('mcpResources') from plugin assembly
   (= GLOBAL layer register — violates Team-only, refused); passing faces
   through config (functions cannot ride serialized config); blueprint
   capabilities.mcp composition route (mounts the NATIVE provider path,
   bypasses the governed port/seam generation — rejected by the 19:31 law).
   Minimal EXISTING fork options for root:
   (a) mcp-resources: an agent-argument register/read variant mirroring the
       tools.get(name, agent) layering precedent (one public method, same
       layer math);
   (b) host: expose a scoped-fiber factory (ctx.fork-like) usable from
       plugin assembly so the existing ctx.inject(['mcpResources']) fiber
       pattern can run per-Team — mirrors server-context.ts:29 exactly.
2. Per-SESSION consumeBrowserApproval: the Team PA plane edge lives in
   bindings AFTER the mount (build order mount->plane). The lazy-bind
   increment (this lane): bindings passes a forwarding closure bound to the
   later-built plane's approval edge (call-time deref; approvals only ever
   arrive post-placement) + the callResource mapping above already rides
   the supply. NOT done this round; named, not dropped.

WEB/BROWSER closed-table gaps stay single-filed as before (B-BROWSER target
rule = browser lane; WEB route = the signed A5_G2_WEB_ROUTE_GAP).
