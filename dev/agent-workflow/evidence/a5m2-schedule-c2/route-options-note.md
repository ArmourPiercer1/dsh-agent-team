# B-SCHEDULE route-options note (center dispatch; investigation ONLY — no Host, no upstream patch, no clone, no boot)

Baseline: product 874f3ae0d packed dist (reuse install `install-eda06b4a7`, read-only); upstream 639 `tests/deepseek-harness-test-use/packages/schedule/schedule` + `@deepseek-ai/dsh-schedule@0.2.0-rc.2` (15-peer pin). All line numbers verified read-only this pass.

## (a) Capabilities our row needs today (our packed adapters/host wiring)
- **C1 RAW ScheduleService handle** — `agent-bindings.mjs:3193` `deps.scheduleServiceFeed()`; `:3195` shape check requires `list`/`delete` (refusal `:3198` names full shape `list/delete/create/update/catalog/history`); `:3209` feeds `scheduleService` into our `createScheduleWiring`. "The native TOOL face is NOT a service stand-in".
- **C2 member-scope NATIVE tool definitions `schedule_list` + `schedule_delete`** — captured via public agent tool face `agentCtx.tools.get(name, runtimeAgent)` at `:3165-3177`; whole-family refuse if either missing (`never a half mount` `:3154`).
- **C3 governed assembly (ours, not upstream)** — `createScheduleWiring` + signed arm wrappers `:3201-3243+` (lane-owned product code; no upstream need).
- **C4 conflict-free ownership in the SAME agent scope** — upstream auto-attach registers **all four** tools per root agent: `@deepseek-ai/dsh-schedule/lib/index.js:2116` `registerScheduleTools` (schedule_create first, four per-tool disposers); attach on `agent/created` guarded `roots().includes(agent)` `:2653-2662`; disposal is service-private (`attached` Map). Public tool API returns owner-only disposers (`core/agent-loop/lib/index.js:2876`).

## (b) Public interfaces that can serve each (639 tree; EXPORTED surface only)
- C1: `@deepseek-ai/dsh-schedule` package exports (package.json `"."`,`"./invariant"`,`"./client"`,`"./typert"`,`"./remote"`) — public export list `lib/index.js:2910` (`ScheduleService`, `scheduleDomain`, `scheduleView`, `ScheduleId`, errors, record factories, `registerScheduleTools`); service class `lib/index.js:2520` `super(ctx,"schedule")` `:2614`; generated typed service face `lib/typert.host.js:354 export const TYPERT` (contains `"exportName": "ScheduleService"` `:486`). Row `{id: schedule, name: "@deepseek-ai/dsh-schedule"}` is the official public config face (root-validated earlier). **No `new ScheduleService` call site exists in EITHER host tree** (app-boot only lists the optional bundle at `app-boot/lib/index.js:551-557`, "offered switched off"; bundle package absent from this machine's `.pnpm`) ⇒ row-load instantiation is the only public registration path and is **unverified live** (no-boot constraint).
- C2: no public interface registers native pair into a chosen member scope; upstream self-registers per created-root (see C4). Public tools face offers register-with-disposer only (owner-scoped).
- C4: root 00:34: public `new ScheduleService` cannot close auto-attach; no public detach of upstream's registrations.

## (c) Full-fork carry list (contract surface, not code yet)
Size: lib **4,114 lines** total (`index.js` 2,910 + `typert.host.js` 727 + `typert.remote-client.js` 477) + `src/*.ts` (exported subpath) + `locale/*.json`. Contract surface: four tool definitions+schemas (`src/tools.ts`: `schedule_list` :452, `schedule_delete` schema :473/:496, create/update siblings), `ScheduleService` + storage contract (session-event fold `foldScheduleEvents`, durable tasks `:2272` region, retention/delivery timers), typed remote protocol (typert host+remote-client), decorator-guard set (list/catalog/history/delete/update `:2528-2572` region), public export list (`:2910`), config keys (`MIN_EVERY_INTERVAL_SECONDS`…), and the attach/auto-attach policy (the fork's only place a self-maintained opt-out is lawful). Version lock: 0.2.0-rc.2 identity vs future upstream drift.

## (d) Verdict per capability (no wishful naming)
- **C1 service handle**: PUBLIC_ROUTE_EXISTS — *conditional* (public exports + TYPERT + official row id/name), live instantiation PENDING a permitted boot; private deep paths never count.
- **C2 native pair into member scope**: **BLOCKED** — no public registration/detach face; upstream self-attach is the only registrar.
- **C3 assembly**: N/A (lane-owned, ships as-is).
- **C4 same-scope ownership takeover**: **BLOCKED** — exactly the narrow Host owner-takeover seam (Sentinel_460cdf8bc4408191bbd1ced429751aab) awaiting user permission.
- Fork alternative for C2/C4: FORK_REQUIRED **only if** user denies the Sentinel AND fork self-maintains attach opt-out — fork alone (byte-copy, no policy change) reproduces the same conflict.

Counts: capabilities 4 → PUBLIC_ROUTE_EXISTS 1 (conditional), BLOCKED 2, N/A 1; fork-carry contract items 8.
First evidence lines: `agent-bindings.mjs:3165-3177/3193-3198/3209`; `dsh-schedule lib/index.js:2116/2520/2613-2614/2653-2662/2910`; `typert.host.js:354/486`; `core/agent-loop lib/index.js:2876`; `app-boot lib/index.js:551-557`.
