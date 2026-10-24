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

## ROUND-20 (root 21:01) — shipped-surface audit + same-source bind fixes
SHIPPED-ENTRY AUDIT (files vs exports maps @639ed01539): mcp-client and
browser-use-stagehand-native both map "./src/*" while `files` ships ONLY
lib/index.js (+ lib/types) — the deep src/* specifiers resolve in a SOURCE
CHECKOUT (the pinned test-use world, where this lane verifies) but NOT in a
published package install. Current PUBLIC lib entries: mcp-client root =
apply/Config/createMcpToolDefinition only (no createTransport); stagehand
root = apply/Config only (launchChromium/openBrowserWorker are src-internal,
imported at its own index.ts:14-15 for apply's composition). NO dsh
lib/runtime helper offers either entry either. MINIMAL EXPORT PROPOSALS
(report-only, awaiting root; NO self-patch, NO alias, NO core touch):
 (P1) mcp-client src/index.ts: `export { createTransport } from
      './transport.ts'` — rides the ALREADY-shipped lib/index.js; approved
      transportEntry then names the package ROOT, not a src path.
 (P2) stagehand src/index.ts: `export { launchChromium, openBrowserWorker }`
      — both already imported there (:14-15), zero new wiring, same shipping.
SAME-SOURCE TRANSPORT BIND (host.ts buildG2TeamSupply): server/transport
equality was NOT the binding — the closure now compares the approved record
FIELD BY FIELD against the actual minted target (stdio: spawnArgv0 vs
command, spawnArgCount vs args.length, RAW spawnCwd vs cwd with '' kept;
http: endpointOrigin vs the record url's URL.origin) and throws BEFORE
construction on any divergence (zero transport object). LEASE LAW:
callResource now binds the LEASE-OWNED resource's runtime
resource.value.execute(method,args,signal) — never a swapped runtime; the
close owner stays the lease.

## ROUND-21 (root 21:02) — MCP transport REAL via the PUBLIC trio
The Team-owned small factory now builds transports from the PUBLIC pieces
transport.ts:9-12 itself imports: StdioClientTransport
(@modelcontextprotocol/client/stdio), StreamableHTTPClientTransport
(@modelcontextprotocol/client), and the Host PUBLIC scrubbedParentEnv
(@deepseek-ai/dsh-subprocess); construction mirrors createTransport
(transport.ts:31-49: command/args/scrubbed+config env/cwd; URL +
requestInit.headers) — the underlay, not its governance (no approval/
supervision/reconnect logic copied). Same full-bind law unchanged: the
approved record is field-validated against the actual minted target BEFORE
construction. A configured transportEntry still wins (source-checkout
verification worlds); no resolution = typed refusal (no fake promise).
Browser: ordinary installs answer NO launchChromium/openBrowserWorker
factory (browserUse only register/runtime.SessionResources, open is
caller-owned) — P2 stays REPORT-ONLY pending root's post-G3 unified
ruling; source-checkout legs stay labeled as such. consumeApproval for
browser rows: the durable shape exists (ptc-escalation-row.mjs:407
requestControl template over the same controlServiceRef seam) but its
consumption semantics pair with the B-BROWSER rule map (its own lane) —
NOT minted unilaterally. MCP-row approval is already REAL (the plane PA
walk: approve -> consume -> dispatch, pinned in the wire spec).
