# remote-mount-race — reproduction evidence (scratch world)

World: references/.dsh-diag-405-2026-09-05T16-35-38 (copy of C:\Users\user\.dsh-dev)
Build: D:\AgentDev\deepseek-harness @ a66e4702047846cdaa10c66c9d3df3951f5ea70d (release(dsh): 0.1.2-rc.1)
Plugin install: scratch profiles\web\node_modules\dsh-agent-team @ origin master 05721fd content
  (host.js 29910 B / client-bundle.js 845690 B — LF-identical to the committed baseline, per handoff §1)

## Setup notes (2026-09-05)

- tsx source entry (`node --import tsx/esm apps/cli/src/bin.ts`) FAILS in-sandbox:
  esbuild sync-service spawn EPERM (documented class, TEST_METHODS.md §5).
  -> switched to the user build's own PREBUILT entry `node apps/cli/lib/bin.js`
     (lib built 2026-09-05 16:09–16:10 local, i.e. minutes before the user incident;
     same source, pure-Node start — no spawn, same DSH code).
- Scratch `profiles\node_modules` (copied earlier) had materialized the user home's
  JUNCTIONS into real trees (robocopy follows junctions); the boot healer rejected it:
  "exists and is not a symlink or dsh-managed module proxy; remove it so dsh can manage
  the installation fallback". Verified user home entries are real junctions
  (e.g. @deepseek-ai\cordis -> D:\AgentDev\deepseek-harness\apps\cli\node_modules\@deepseek-ai\cordis).
  -> removed the materialized copy; the healer rebuilt the fallback at next boot.

## Boot A — race WON (prebuilt entry, idle machine)

- start: `node apps/cli/lib/bin.js web --port 3180 --no-open` (DSH_HOME=scratch), job pwsh-125
- boot line: `dsh web: http://127.0.0.1:3180/?token=Gj-01wX9KoKzj_Cel5on88FtTEio7K2NzhLqCc5Pyf4`
- GET / (no token) -> 401 (auth gate active)
- POST /team-remote/catalog.list (unauthenticated) -> **401** "unauthorized"
  = the /team-remote prefix route IS registered (requestRejection trust gate,
  rpc-host.ts L163-167). If the mount had been skipped this would be 405
  (frontend-static fallback-only, frontend-static/src/index.ts L125-128).
- token->cookie exchange (GET /?token=... -> 303 + set-cookie dsh-auth-...)
- POST /team-remote/catalog.list (authenticated cookie, client-request envelope
  {type, rpcId, method:catalog.list, payload:{version:1, params:{}}}) -> **HTTP 200**:
  {"type":"server-response","rpcId":"diag-405-0003","result":{"ok":true,
   "value":{"data":{"blueprints":[{"blueprintId":"my-team-bp-1","revisions":[1]}]},
   "provenance":{"origin":"team-remote","method":"catalog.list","endpoint":"catalog.list",
   "contractVersion":1,"requestToken":null,"projectionGeneration":null,"effectSequence":null}}}}
- probe body file: probe-body.json (this dir)
- TERMINAL (product face): ONLY the boot line — no mount/skip/remote-state line at all
  (the observability gap this task fixes; host.ts skipped branch + ready catch are silent).
- teardown: job killed; 3180-3186/3493 verified free; no user-build node processes left.

## Interpretation (so far)

- The user's 405 = mount skipped (route never registered) — consistent with handoff §2.1/§2.3.
- Boot A won the race on this machine (fast prebuilt start, idle). The user lost it
  (tsx cold start + machine load: the connection service was not yet provided when the
  one-shot ctx.get('connection') read ran at the end of the host row bootstrap,
  host.ts L610; the skipped branch at L614-618 is permanent and silent).
- Deterministic confirmation next: instrument the SCRATCH install copy (timing poller
  for first connection appearance + state at the one-shot read), then force the user's
  lost interleaving (one-shot read taken before the connection service exists, no retry
  — exact product semantics) and re-probe: expect 405 + silent product output + timing
  log proving T_read < T_appear.
