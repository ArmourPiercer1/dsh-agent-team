# P2-T6 Seam Report — Remote / Client / Additive UI Seams

Task: **P2-T6 — Remote/client/additive UI seams + G2 audit** (TaskDoc §11.3, L1034-1047).
Upstream pin: `deepseek-harness-test-use @ cd5ef8148158c3a752a658978873241fdf8e2bbc` (pristine).
Branch: `task/P2-T6-remote-client` · worktree `.worktrees/P2-T6`.
Fixed environment: DSH_HOME `references/.dsh-test-p2t6`, ports **3401/3411** (never 3281/3291/3080/3180).

Method: machine-level characterization, **public surface only** (zero-core: group module
`tests/characterization/probes/remote-client/index.mjs` imports node: builtins + in-root
`lib/**` only; every upstream import lives in `plugins/` payloads and is admitted by the
live public surface at static-scan time). Probe group runs inside the shared harness
(`run.mjs` probes section); every boot is a fresh `DshInstance` on port 3401 with the
patch layer mounted per boot and byte-exactly restored afterwards.

## Boot matrix

| boot | rows mounted | proves |
| --- | --- | --- |
| B1 | host-probe + client-probe + no-decl control | plugin discovery, composition dump, client module graph + bundle serving |
| B2 | host-probe + reconnect-probe | launch-token cookie, RPC wire contract, ConnectionController scenarios R1-R5 |
| B3 | missing-bundle fixture (negative) | boot fails loudly, attributable (MissingClientBundleError) |
| B4 | malformed-decl fixture (negative) | boot fails loudly, attributable (platform validation) |
| B5 | slot-probe | SlotCore seats: conversation.view / sidebar.footer.action / input dock |

## Seam: client module discovery (dsh.client → boot graph)

Seam ID `CLIENT_MODULE` (architecture-critical, DevPlan §15 matrix).

Mechanism: the ClientModules service scans mounted composition rows at boot — nearest
package.json with a `name` walking up from the entry URL — requires
`exports["./client"]` and reads the **nested** `pkg.dsh.client` declaration (a string
`platform`, optional `inject`/`external` arrays, optional boolean `immediately`);
qualifying packages gain a `/plugins/??<id>/client.js&rev=<rev>` entry in the composed
Web boot graph (`window.__DSH_BOOT__`), and the combo bundle URL serves the declared
client file.

- Positive (B1): `p2t6-client-probe` (declares `exports["./client"]` + nested
  `"dsh": {"client": {"platform": "web"}}`) boots; appears in the composition dump
  (`dump-config-b1.txt`, `rowInDump`); gains exactly one boot-graph entry whose URL
  matches `/^\/plugins\/\?\?p2t6-client-probe\/client\.js&rev=/`; GET of that URL → 200
  and the served body contains the `P2T6-CLIENT-BUNDLE` marker; baseline (non-probe)
  entries are still present, i.e. the probe is additive.
- Negative (B1): `p2t6-no-decl` (no `dsh.client`, no exports) gains **no** client entry;
  GET of an unknown bundle path 404s; `p2t6-host-probe` (host-only) gains no client entry.
- Negative (B3/B4): see the two negative-control seams below.
- Quirk (L6-4, found while root-causing the D2 B1 failure): a **flat** top-level
  `"dsh.client"` key instead of the nested `"dsh": {"client": {...}}` form is **silently
  ignored** — `resolveMeta` returns null with no log line and the row is excluded from
  the client-module graph (at boot and in steady state alike, zero diagnostics). The
  fixtures originally used the flat form, which masked the whole discovery seam as
  "silently excluded"; the canonical form is per
  `packages/client/modules/package.json`. No upstream validation rejects the flat form.
- Observed (green probes run 2026-08-29T21:32Z): 46 baseline client entries + the probe
  entry (id `p2t6-client-probe`); combo rev format `<composed-rev>-<index>`
  (e.g. `0ea86cfde2ab1412-45`, composed rev `7a02665edbb1`-era per graph); dump bytes —
  see `run/logs/obs/host-probe-activated.json` + `run/logs/dump-config-b1.txt` +
  `run/run-log.txt`.
- Verdict: **PASS** — additive client-module discovery is executable end-to-end on the
  public surface; failures are loud and attributable.

## Seam: remote RPC (authenticated client-request channel)

Seam ID `TEAM_REMOTE` (architecture-critical).

Mechanism: the web server mints the HMAC auth cookie on `GET /?token=<launchToken>`;
client→host RPC travels `POST /<channel>/<endpoint>` with body
`{"type":"client-request","rpcId","method","payload"}`; rows register public handlers
via the `connection` service (`rpc.handle`); responses are `server-response` envelopes
(`result:{ok:true,value}` / `result:{ok:false,error:{code,message}}`).

- Positive (B2): launch URL → redirect (observed status 302; the check accepts 302|303)
  with `Set-Cookie: dsh-auth-<b64url(sha256(authority))>=v1.<b64url-payload>.<b64url-hmac>`
  (name = 9-char prefix + 43 base64url chars; HttpOnly, SameSite=Strict, Path=/,
  Max-Age per the default 24h session day); authenticated POST to the registered
  `/p2t6rpc/echo` channel round-trips: `result.ok:true`, `value.marker:"p2t6-rpc-echo"`,
  `value.endpoint:"echo"`, and the whole payload object is echoed back (`value.echo`).
- Negative (B2): no cookie → 401 `unauthorized`; wrong content-type → 415
  `content type must be application/json`; `method` ≠ endpoint → 200 envelope
  `result.ok:false`, `error.code:"bad-request"`, message includes
  `does not match endpoint`; handler returning an error result → 200
  `result.ok:false` with the probe's `p2t6-probe-error` code; handler throw → 500
  `handler failure: …`.
- Observed (green probes run 2026-08-29T21:32Z): redirect status **302**; cookie name
  `dsh-auth-` + 43 base64url chars (b64url of the sha256 digest of the request
  authority); cookie value `v1.<b64url-payload>.<b64url-hmac>`; all five negative
  responses matched verbatim (see `run/run-log.txt`).
- Verdict: **PASS** — the remote client-request channel is fully executable and the wire
  contract (including all five negative responses) matches the public spec.

## Seam: reconnect basic (loss → backoff → reconnect)

Seam ID `TEAM_REMOTE` (architecture-critical).

Mechanism: `ConnectionController` (public `./src/client/connection.ts` subpath) drives a
generation loop: wait-for-ready (timeout) racing source-loss; on loss/timeout → state
`reconnecting`, attempt++, exponential backoff `min(max, base·factor^(attempt−1))` with
delay ∈ [cap/2, cap]; sinks are exception-isolated.

Probe scenarios (obs in `run/logs/obs/obs-reconnect.json`):
- **R1 happy path**: single connect; `onConnected` receives the source `home` value;
  state sequence `["connected"]`; after `stop()` no events; **restart after stop**
  refires `onConnected` (count 2) with **zero** state events — `lastState` persists
  across stop/start, so the state-change sink dedupes (recorded contract observation,
  asserted, not a bug).
- **R2 two losses**: state sequence
  `["connected","reconnecting","connected","reconnecting","connected"]`; three
  distinct homes; both reconnect intervals within the frozen formula bounds
  (interval1 ∈ [10,120]ms for base 20/factor 2; interval2 ∈ [20,60]ms, with slack).
- **R3 ready-timeout**: a never-ready source settles only on abort; first state is
  `reconnecting` within 250ms ± slack, zero connects; after `stop()` no events.
- **R4 throwing sinks**: both sinks throw on every call; the controller still completes
  3 generations — sink exceptions are isolated (logged, not propagated).
- **R5 stop-during-backoff**: with slow backoff, `stop()` lands inside the sleep;
  exactly 1 generation runs; states `["connected","reconnecting"]`; no events and no
  further generation after quiescence.
- Negative/edge: every scenario above is a negative or edge control of the happy path;
  the instance log also shows ≥2 `connection lost, retry #` lines and ≥1
  `connection sink threw` line (B2 log assertions).
- Verdict: **PASS** — reconnect basic (loss → backoff → reconnect) is executable with
  the backoff formula, state machine, and sink isolation all verified.

## Seam: conversation.view seat (Team Tab, list/session)

Seam ID `TEAM_VIEW_SLOT` (architecture-critical).

Mechanism: `SlotCore` (named export of the public `dsh-client-ui-slots` package — the
engine under the plugin-level `ctx.slots` face) is driven inside the instance with
declarations **mirroring the frozen ui-conversation artifact**: `conversation` (into
root, single/root) declares `conversation.session` (single/session), which declares
`conversation.view` (list/session).

- Positive (B5): Team Tab `{id:"p2t6-team-tab", label:"Team", priority:0,
  registrant:"p2t6-team-probe"}` registers into `conversation.view`; the entry carries
  the registrant at entry level; a different-priority registration shadows it (winner
  = lowest priority).
- Negative (B5): same-id **same-priority** re-registration throws verbatim
  `list slot "conversation.view" already has an entry with id "p2t6-team-tab"
  (registered by p2t6-team-probe) — register at a different priority to shadow it`;
  list registration without `id` throws `requires options.id`; registration into an
  undeclared slot throws `slot "…" is not declared (a parent entry's children table
  must declare it)`; redeclaring an already-declared child slot throws
  `slot "conversation.view" is already declared (by …)`.
- Lifecycle (B5): the disposer cascades — disposing the declarant collapses
  `conversation.view` (spec → undefined, `declarationEpoch` +1, entries cleared,
  `isLive` false), subsequent register throws the not-declared message, and
  redeclaration after collapse works again; sibling slots survive. Subscribe
  notifications are microtask-batched (2 same-tick registrations → exactly 1
  notification per key).
- Observed: full check ledger in `run/logs/obs/obs-slot.json` (core A).
- Verdict: **PASS** — the additive conversation.view entry is executable with the
  frozen list/session seat semantics.

## Seam: sidebar New Team entry (sidebar.footer.action, list/root)

Seam ID `NEW_TEAM_ENTRY` (architecture-critical).

Mechanism: same engine, declarations mirroring the frozen ui-sidebar artifact:
`shell` → `sidebar` (single/root) → `sidebar.footer.action` (list/root).

- Positive (B5): New Team `{id:"p2t6-new-team", label:"New Team"}` registers into
  `sidebar.footer.action` and wins its seat.
- Negative (B5): a squatter with the same id at the same priority collides (verbatim
  seat message naming the registrant); missing id throws; dispose → collapse →
  register-after-collapse throws the not-declared message.
- Observed: `run/logs/obs/obs-slot.json` (core B).
- Verdict: **PASS** — the New Team additive sidebar entry is executable.

## Seam: conversation input dock (Team Dock fallback seat)

Seam ID `INPUT_DOCK` (non-critical — frozen DevPlan §15 matrix row).

Realization per the frozen rule “UI 非关键 seat 可使用已冻结 fallback” (P2-T6 实现要点):
the equivalent public seat `conversation.input.dock` (list/session) exists in the
frozen ui-conversation artifact; the probe registers Team Dock
`{id:"p2t6-team-dock", label:"Team Dock"}` there as fallback-seat evidence. No blocker:
a public seat exists, so the fallback clause applies and the seat is proven
executable. Observed: `run/logs/obs/obs-slot.json` (core C).
- Verdict: **PASS** (fallback seat recorded).

## Seam: client bundle missing (negative control)

Row `p2t6-missing-bundle`: valid **nested** `dsh.client` declaration, `exports["./client"]` →
`./client.js` — but the file is **absent**. Contract (source: `packages/client/modules`
ctor + flush): activation-PASS failures aggregate into `ClientPackageCompositionError`
and ABORT BOOT — the child exits code 1 before the web URL prints (steady state is the
lenient path: a row live-patched after boot only warns and is excluded). Verified (B3):
`start()` rejects with `process exited (code=1 signal=none)`; the persisted instance log
(`run/logs/instance-port3401-negative-b3.log`) carries the full chain:
`Error: dsh: plugin tree failed to load: failed to apply loader entry modules
(@deepseek-ai/dsh-client-modules): client-modules: 1 client package failed to compose:`
→ `client bundles not found; run `pnpm run build` before launch:` →
`package: p2t6-missing-bundle` + `path: .../missing-bundle/client.js` (with the
`AggregateError` stack). The separate `dump-config` call still lists the row (mount
succeeded; the failure is at composition), and the port frees after stop. Verdict:
**PASS** (control behaved per contract).

## Seam: malformed dsh.client declaration (negative control)

Row `p2t6-malformed-decl`: `dsh.client.platform: 42` (not a string). Same fail-loud
contract via the platform-validation path: `parseDshClient` throws
`client-modules: p2t6-malformed-decl dsh.client.platform must be a string`, the
activation pass aggregates it under the `ClientPackageCompositionError` "other
failures" bucket, and boot aborts. Verified (B4): `start()` rejects with
`process exited (code=1 signal=none)`; the persisted log
(`run/logs/instance-port3401-negative-b4.log`) names the package and carries the exact
marker `[cause]: ClientPackageCompositionError [AggregateError]`; dump-config still
lists the row; port frees after stop. Verdict: **PASS** (control behaved per contract).

## Summary

| seam | seamId | criticality | verdict |
| --- | --- | --- | --- |
| client module discovery (dsh.client → boot graph) | CLIENT_MODULE | architecture-critical | PASS |
| remote RPC (authenticated client-request channel) | TEAM_REMOTE | architecture-critical | PASS |
| reconnect basic (loss → backoff → reconnect) | TEAM_REMOTE | architecture-critical | PASS |
| conversation.view seat (Team Tab, list/session) | TEAM_VIEW_SLOT | architecture-critical | PASS |
| sidebar New Team entry (sidebar.footer.action, list/root) | NEW_TEAM_ENTRY | architecture-critical | PASS |
| conversation input dock (Team Dock fallback seat) | INPUT_DOCK | non-critical (frozen fallback seat) | PASS |
| client bundle missing (negative control) | CLIENT_MODULE | non-critical | PASS |
| malformed dsh.client declaration (negative control) | CLIENT_MODULE | non-critical | PASS |

All eight seams executable → aggregated in `tests/characterization/seam-manifest/
manifest.json` (26 rows across P2-T1..T6) and re-validated in-group on every run
(`run/logs/obs/seam-manifest-validation.json`).

## Contract observations (recorded, not asserted as bugs)

1. **Restart dedupe**: `lastState` persists across stop/start — a restarted controller
   refires `onConnected` but emits no state event for the unchanged state.
2. **Redirect status of `GET /?token=…`**: observed **302** (asserted as 302|303; the
   exact value is recorded in `run/run-log.txt`).
3. **`NODE_OPTIONS=--experimental-transform-types`** deviation, scoped to the B2 boot
   only (public `./src/*.ts` subpath; node 24 strip-only cannot parse parameter
   properties) — see known limitation L6-1 in the manifest register.
4. Browser rendering is out of machine-level scope (L6-2): proofs = boot marker +
   composition dump + public HTTP routes + SlotCore-driven seats.
5. **Flat `"dsh.client"` key is silently ignored (L6-4)**: the registry reads the
   nested `pkg.dsh.client`; a row declaring a flat top-level `"dsh.client"` key yields
   `resolveMeta → null` with no log line and is excluded from the client-module graph
   at boot and in steady state alike. No upstream validation rejects the flat form.
6. **Fixture-form post-mortem (root cause of the D2 B1 failure)**: all three probe
   fixtures originally used the flat form, so the client-bundle probe vanished from the
   boot graph with zero diagnostics — the seam was misread as "silently excludes broken
   rows" (D1/D2 storyline). A live-patch experiment (`debug-b1/live-patch.mjs` +
   `debug-b1/live-diag.json`) proved the live-recomposition path works mechanically
   (entry appears, fiber active, `internal/plugin` event delivered with `fiber.entry`
   set) while the graph stayed empty — the registry's own `resolveMeta` call returned
   null. Rewriting the fixtures to the canonical nested form turned B1 fully green and
   inverted the B3/B4 contract from "silent exclusion" to fail-loud-at-boot (both
   confirmed empirically in `debug-b1/neg-b3-child.log` / `neg-b4-child.log`).
