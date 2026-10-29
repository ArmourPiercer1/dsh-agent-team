# U4-H0 Static call-sequence trace — Guard → dispatch Definition TOCTOU

Host: pristine `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` — canonical pin
`639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2). All line numbers are in
`packages/core/tools/src/index.ts` (@pin) unless another file is named. This file is produced
by source reading only (step 1 of the work package); the PoC (runs/) then exercises exactly the
points marked ◆ on the real Host.

## 1. The execution pipeline, point by point

Model-direct call enters the registry through the public service `ToolRuntime.execute`
(scheduler staging `prepareScheduledExecution` :1489). Sequence for one call:

| # | Point | Line(s) | What is read / bound here | Can the name→Definition binding change after here? | Public listener observable/veto? |
|---|---|---|---|---|---|
| P0 | `createExecution`: args frozen, `callerSignal` captured into `cancellationStates` WeakMap; `ptc`-collapse denial for model-direct non-`run_code` names | :1395–:1474 | input name/args; no Definition identity bound | yes | no (no event yet) |
| P1 | pre-execute gate: `tools/pre-execute` waterfall; ask/deny; `guardReason(exec)` | :1505–:1531 (gate), guard restrictions :700–:711 | decides by **name + parsed args + agent** only; restrictions are name sets compiled at registration → **A/B indistinguishable** | yes | ◆ public waterfall listener (`tools/pre-execute`); veto = deny decision — still name-level, not Definition-level |
| P2 | scheduler classification `executionMode` → `resolveExecution` (reads `isConcurrencySafe`) | :1303–:1312 → :1247 | resolves a Definition for scheduling only | yes | no public hook |
| P3 | enter the around-dispatch fence: `ctx.waterfall(carrier,'tools/execute', exec, () => dispatchToolBody)` — outermost-first; a listener that does not call `next()` vetoes the rest **including built-in dispatch** | :1605–:1608; `vendor/cordis/src/events.ts:229–243` (waterfall), :254–259 (push/unshift order) | listener chain runs; `exec.signal` is wrapper-mutable (:156, :401–407) | ◆ yes between listeners (each `await` inside any listener is an interleaving slot for any other JS, incl. registrations) | ◆ **`tools/execute` listener, pre-`next()` code runs before any body** |
| P4 | dispatch entry: fuse `callerSignal` with wrapper signal; **abort check** `isAborted(signal)` → `toolAbortedBeforeDispatchResult()` | :1564–:1575 | reads the fused signal | ◆ any swap that happened up to here is committed; the abort check observes an abort fired synchronously earlier | ◆ a `tools/change` listener firing `controller.abort()` before this point prevents the body (M3 proved `delivered-change-abort` on this Host) |
| P5 | **live resolve**: `resolveExecution(exec.name, exec.agent, exec.parent!==undefined)` → `get()`→`view(scope).visible.get(name)` + mode collapse | :1578 → :1247–:1252 → :1230–:1232, view :1178–:1219 | **re-resolves the CURRENT binding — this is the TOCTOU resolve** | ◆ no await between :1572 and :1581 → no swap can interleave from :1572 onward (single-threaded) | observation only post-hoc |
| P6 | `state.bodyInvoked = true`; **invoke** `tool.execute(exec.arguments, exec)` | :1580–:1581 | executes the object resolved at P5 (property `.execute` re-read at call time) | after invoke: swap cannot change WHICH body runs (it is running); it can only affect later resolves | — |
| P7 | success result: `createSuccessResult` validates against the **P5-resolved** definition's `output.schema` | :1582, :1832–:1835 | output-schema binding = P5's definition | yes (schema binding, never a body execution) | — |
| P8 | waterfall return → `normalizeDispatchResult`: success path **re-resolves** (:1876) and re-validates; **error path does not resolve** (:1867–:1874) | :1865–:1883 | a wrapper-returned SUCCESS result is bound to the *then-current* definition's schema | yes (schema binding only) | a wrapper returning an ERROR result keeps the pipeline off the resolve path |
| P9 | post-execute, finalization, `tools/result`, abort settlement | :1633+: | outcome observation | — | ◆ detection only (post-body) |

Binding facts proved statically:

- **F1** Every public path that changes the name→Definition binding
  (`register` :1063–:1085, the returned disposer, `restrict` :1119) mutates the layer
  **synchronously** and then calls `onChange` → `this.ctx.emit('tools/change')`
  (`packages/core/scope/src/store.ts` `effect()` :236–:267; tools-side :833–:835).
  `emit` maps listeners **synchronously** in registration order
  (`vendor/cordis/src/events.ts:194–197`). The only `notify:false` site is
  `tools.guard()` (:1137–:1140), which does not change the visible map.
  ⇒ **every visible-set change is synchronous + synchronously announced before the
  mutating call returns.**
- **F2** `get(name, scope)` (:1230) and the dispatch resolve P5 (:1578) use the **same**
  view function; `resolveExecution` additionally applies the mode collapse
  (`collapses` :1335+), which only ever DENIES (returns `undefined` ⇒ `UNKNOWN_TOOL`),
  never substitutes a definition. ⇒ a guard observation equal to `get(name, exec.agent)`
  differs from dispatch only in the fail-closed direction.
- **F3** Between the P4 abort check and the P6 invoke there is **no `await`**
  (:1572→:1576→:1578→:1580→:1581 are one synchronous block). ⇒ a swap can only land
  before P4 (at an await slot in P3) or after P6 has begun.
- **F4** Waterfall semantics (`events.ts:229–243`): a listener that returns without
  `next()` vetoes the inner listeners **and** the built-in dispatch P4–P7; the listener's
  return value becomes the dispatch result (`normalizeDispatchResult` at :1609). A
  synchronously thrown listener also prevents the body (caught at :1628 → error result).
- **F5** Listener order = registration order (`events.ts:254–259`, `prepend` ⇒ unshift).
  A plugin cannot statically force being innermost (a later `push` lands behind it) nor
  immune-to-suppression first delivery (a later `prepend` lands ahead).
- **F6** Scope keys: `Agent.ctx` is a scoped context keyed by the Agent object
  (`packages/core/agent-loop/src/agent.ts:130–131`, public `readonly ctx`), and the
  execution payload carries `exec.agent`. ⇒ a plugin that obtains `exec.agent` (or an
  `agent/created` reference) can publicly register a **same-name scoped shadow** that
  wins `view(scope)`'s own-layer pass (:1204–:1208) — the strongest external
  replacement vector on the public surface.

## 2. The residual window (exact)

For a guard that verifies `ctx.tools.get(exec.name, exec.agent)` in a `tools/execute`
listener and then `next()`s:

```
[W] = (guard's get returns A) ... (dispatch :1578 resolves)
```

- `[W]` is non-empty only across `await` slots inside P3's other listeners.
- Any swap inside `[W]` is synchronous and synchronously emits `tools/change` (F1); a
  synchronous `abort()` from the change listener is therefore observed by the P4 check
  (F3) ⇒ body prevented. This is the M3-proven route (`s1-h0-m3` outcome
  `delivered-change-abort`).
- Surviving leak paths for the next()-passing guard, all **delivery-suppression**:
  (L1) a `tools/change` listener registered ahead of the guard's (later `prepend`, F5)
  throws — `emit`'s synchronous `map` aborts, the guard's listener is never invoked,
  and the committed mutation stands; (L2) a listener INNER to the guard performs
  swap-then-`next()` such that the swap lands between the guard's own recheck and its
  `next()` — synchronous, so it still emits before P4 ⇒ covered by (F1+F3) unless (L1)
  applies. (L3) post-body: swap during P6's await changes only what LATER calls resolve
  (plus P7/P8 schema binding for the running call) — never executes a new body.

## 3. Strongest public guard design (chosen for the PoC)

**G = verified-identity self-dispatch, with armed change-abort as a defense-in-depth
layer.** All parts are public seams; nothing private, no host edit:

1. **Center-owned Definitions.** The center registers every governed tool itself and
   records the approved object identity (`Map name→{def, executeFn}`); its `execute`
   closure is center code that re-checks a per-call grant (`grants.get(exec.rootCallId)`
   must carry the approved `executeFn`) before touching effects.
2. **Outermost guard listener** (`ctx.on('tools/execute', fn, { prepend: true })`),
   synchronous pre-work for governed names:
   `def = ctx.tools.get(exec.name, exec.agent)` (F2-equivalent observation).
   - `def` not the approved object (foreign replacement, shadow, missing, restricted
     away) ⇒ **veto**: return an isError result **without calling `next()`** (F4) ⇒
     P4–P7 never run; the error path of P8 performs no re-resolve. Zero body execution.
   - approved ⇒ arm a per-call `AbortController`, record `armed{callId→def,ac}` and
     `grants{callId}`, set `exec.signal = AbortSignal.any([incoming, ac.signal])` (the
     sanctioned wrapper change, :156/:401–407), then **self-dispatch**: synchronously
     `await approvedDef.execute(exec.arguments, exec)` and return `{ value }` (P8 then
     revalidates against the approved definition while the binding is still A; the PoC
     keeps B's schema identical so the revalidate is identity-neutral — the product-side
     admission rule is stated in README). **The body invoked is the exact function object
     the guard verified** — the `[W]` window is closed structurally: there is no
     re-resolution on the executed path (F4: built-in dispatch was vetoed by not calling
     next()).
3. **Defense-in-depth change watcher** (`ctx.on('tools/change', fn, { prepend: true })`,
   fully try/caught, synchronous): for every armed call re-apply `ctx.tools.get` and
   abort on mismatch/vanish. This (a) cancels the running verified body fail-closed on
   any binding change (conservative), (b) covers future chain edits that reintroduce
   `next()`-passing, (c) re-establishes the M3 mechanism inside the same run.
4. Crash-safety: a synchronous throw anywhere in the guard prevents the body (F4).
   Guard-disabled sensitivity plant is the ONLY way a replacement body executes.

Order-independence: with self-dispatch the guard need not be innermost — any outer
listener either passes `next()` (reaches the guard) or vetoes (no body); nothing inner
to the guard runs for governed names at all. The residual conditions (composition
first-delivery of `tools/change` for the defense layer; native-mode presentation parity;
center-owned registration of governed names) are enumerated as verdict conditions in
README.md §6.

## 4. Why the alternatives are weaker (kept for the record)

- **next()-pass + change-abort only** (M3's mechanism): keeps `[W]` and relies on
  delivered, unsuppressed change events ⇒ CONDITIONAL by construction.
- **Body-side grant token as the sole guard**: a foreign replacement body B has no
  grant check inside it (B is not center code) — the token cannot stop P5 resolving B;
  it only binds OUR body to OUR grant. Necessary, not sufficient.
- **Registration-time veto via `tools/change`**: emit fires AFTER the mutation is
  committed (store.ts:236–:267) and has no transactional rollback; a throwing earlier
  listener suppresses later delivery (L1). React-only, never preventive by itself.
