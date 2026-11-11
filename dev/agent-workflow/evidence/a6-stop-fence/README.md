A6-STOP-FENCE

# A6-STOP-FENCE — the cancellation fence at the durable consumption boundary

Owner ruling **A** (2026-11-09, "narrow cancellation barrier + disclosed residual window"),
implemented on `task/a6-stop-fence-20261109` from `master` @ `f31e3d9e2` (candidate content
`168266dbf`). This note is the implementation/evidence record; the PR body carries the same claims.

| field | value |
| --- | --- |
| tree | `master` @ `f31e3d9e2` (candidate content `168266dbf`) |
| branch / PR | `task/a6-stop-fence-20261109` / **draft PR #710** (base `master`, not merged) |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH `0.2.0-rc.2`) — **not patched** (`CORE PATCH BUDGET = 0`) |
| mechanism note read | `dev/agent-workflow/evidence/a6-stop-race-mechanism/README.md` @ `task/a6-stop-race-20261109` |
| measurement read | `dev/agent-workflow/evidence/c2-adjudication/README.md` §11.2 @ `task/c2-adjudication-20261109` |
| tests | `packages/runtime/test/a6-stop-fence.test.ts` (8 arms, host-free, deterministic) |
| boot | **not performed by this session** — the main agent boots the PR (repo rule) |

## 0. What was measured before this change (the fact being fixed)

`c2-adjudication` §11.2: over six boots the durable `allow` (seq 14) and the durable
`control-allow-consumed` (seq 15) landed **+81…+83 ms** apart; the Stop was acknowledged in the same
~10 ms, and the consumption was written in **4/6** boots (`0/6` executed). The mechanism note then
located the last cancellation read at `pa-control-bridge.ts:683` and the consumption write at
`control/service.ts:4395`, with four awaits and no probe between them.

## 1. The fence: exact linearisation point

`packages/runtime/control/service.ts#guardOperation`, inside `withTeamLock(...)`, in the
single-unconsumed-allow branch, **after** every existing check — team liveness, target lifecycle,
scope candidacy, `checkExternalOperation` (A2C-4), `recheckConsumedAuthority` (A1-14),
`paEffectsDenyReason` (A5-M1), the corrupt-sibling check — and **immediately before** the
`control-allow-consumed` write:

```
        if (corruptLeg !== undefined) return corruptLegVerdictOf(corruptLeg.payload)
        const consumptionSequence = await allocateSequence()      // last avoidable await, moved BEFORE the probe
        if (guardOptions?.signal?.aborted === true) {              // THE FINAL PROBE (synchronous read)
          await commitAbandonmentFact(root, requestId, 'invocation-cancelled-before-consumption')
          return { allowed: false, reason: 'invocation-cancelled', requestId, decisionSequence }
        }
        await putEntry({ sequence: consumptionSequence, factType: 'control-allow-consumed', ... })
```

**Why nothing avoidable awaits after the probe.** Every authority / external-policy / PA-manifest
await is behind the probe by construction (they are the checks above it). The *only* await that used
to sit between the last check and the probe was `allocateSequence()` inside the consumption
`putEntry` call; it is now hoisted above the probe. What remains after the probe is exactly one
await: `putEntry(...)` → `repositories.ledger.put(entry)` — the disclosed residual window (§4).
The trip path additionally awaits the terminal abandonment write, which is the effect the trip
exists to produce (not avoidable latency on the success path).

**Signal identity.** The probe reads the *same* signal the approval wait already consumes:
`pa-control-bridge.ts` hoists the combined `waitSignal` (wiring signal ⊕ `input.signal` ⊕ the
bounded-wait controller, combined with `AbortSignal.any`) and passes it as the OPTIONAL second
argument `guardOperation(scope, { signal })`. No new signal, no second cancellation registry.
The signal is **not** durable identity: it is absent from `ControlOperationScope`, the scope key,
the PA manifest, the request identity, the activity/ledger payloads and `options`. Callers that
pass nothing get the historical behaviour byte-for-byte.

## 2. Trip semantics (owner contract items 3 and 5)

On trip, under the same per-Team lock:

- **no** `control-allow-consumed` fact (zero consumption) and **no** tool execution;
- the durable `allow` decision row is left EXACTLY as the approver wrote it — no `deny`, no
  rewrite (a Stop is an execution-lifecycle event, not an approver decision);
- exactly **one** terminal `control-request-abandoned` fact, reason
  `invocation-cancelled-before-consumption` — a new, accurate lifecycle reason. The crash/
  engine-undetermined reason `invocation-abandoned` (A6-26 / A6 closing constraint 1) is
  deliberately NOT reused;
- the guard returns the new closed block reason `invocation-cancelled`;
- a later replay finds the terminal mark and is refused as `request-abandoned` — it cannot
  re-consume.

If the consumption already committed (i.e. the cancel landed after the probe), the fact is **kept**;
the guard never rewrites a committed consumption as un-consumed. The execution edge still refuses
the body (pre-existing `cancelled` gate), and the pipeline's real outcome is recorded by the
existing execution-result path — this change adds no second outcome writer.

## 3. The six deterministic test points (plus two more)

`packages/runtime/test/a6-stop-fence.test.ts`, all host-free: no sleeping 80–100 ms anywhere; every
cancel lands at a named await through a deferred barrier, and every barrier is *disarmed* during
world setup (request/allow) and armed only immediately before the guard call.

| arm | where the cancel lands | asserted |
| --- | --- | --- |
| S1 | before entering the guard (pre-aborted signal) | terminal abandonment; zero consumption; zero execution; exactly one abandonment with the lifecycle reason; no deny decision; original allow unchanged (same sequence, still `allow`); replay refused `request-abandoned` |
| S2 | during the external-policy await (`externalPolicyFacts`) | same set |
| S3 | during the authority recheck await (`authorityRevalidation`, v3 operation case) | same set |
| S4 | during the PA-effects verifier await (`paEffectsVerifier`, strict PA manifest row, guard stage) | same set |
| S5 | after sequence preparation, before the final probe (gated `ledger.allocateSequence`) | same set |
| S6 | **control — the probe passes** (un-cancelled) | exactly one consumption, exactly one execution, one decision (allow), replay refused `allow-consumed` |
| S7 | inside the consumption write await (`putEntry` → `ledger.put`) | the **disclosed residual window**: consumption commits (1), no abandonment, verdict allowed, and the committed consumption stays committed (replay `allow-consumed`) |
| S8 | **regression** — caller passes NO options | plain allow consumes once and executes once; replay `allow-consumed`; plain deny blocks `decision-deny` with zero consumption and zero abandonment |
| RED | S1–S5 against the pre-fence guard | the same suite fails (`the guard allowed a cancelled invocation`) — it is a discriminating test, not a tautology |

## 4. Measured residual window (do not claim atomic Stop)

The window between the final probe and the durable write is owned by exactly one await:

```
await putEntry({ sequence: consumptionSequence, factType: 'control-allow-consumed', ... })
  -> repositories.ledger.put(entry)
```

Measured by S7, which holds that await open with a barrier and lands the cancel inside it:

- un-cancelled control (S6), natural consumption-write await: **≈0.33–0.43 ms** per run
  (in-process durable store; the observed value is printed by the suite as
  `A6-STOP-FENCE naturalConsumptionPutMs`);
- S7, the window deliberately held open: the cancel landed while the write was pending and the
  write still committed. The suite prints the held duration as
  `A6-STOP-FENCE residualWindowMs` (≈1–2 ms across runs; it is the barrier's hold, not a claim
  about production latency).

**Claimed:** cancellation observed before the final consumption check ⇒ nothing consumed, terminal
abandonment, no tool execution. **Not claimed:** atomic Stop; a cancel that arrives after the check
may race the durable write, and if it commits the consumption is kept. No per-invocation durable
Stop state (ruling C) is implemented.

## 5. Team-tools asymmetry — now fenced, and how reachability was verified

`packages/tools/src/tools.ts:344-352` (`executeGuarded`, the guarded `team_*` lane) consulted the
guard with **no** signal; only the runtime action received `ctx.signal`. It now forwards it:

- `consultGuard(service, scope, options?)` (`packages/tools/src/guard.ts`) forwards the optional
  guard argument; `executeGuarded` builds `{ signal: ctx.signal }` when the context carries one;
- `ctx.signal = exec.signal` (`packages/tools/src/tools.ts`, the `ToolCallContext` construction
  inside the tool `execute`), i.e. the host's `ToolExecutionInput.signal` — the same phase signal
  the approval wait and the runtime action already receive;
- so every guarded `team_*` call on a well-formed instance id is fenced at the same probe.
  Verified **statically** (call site → context construction → host `exec.signal`, and the
  `consultGuard` signature) and **host-free** (the compiled `consultGuard` path typechecks and the
  runtime/tools suites are green). **Not verified on a live boot** — that is the main agent's step.

No new signal is minted in the tool layer; absent `ctx.signal` the call is byte-identical to before.

## 6. Gates run in this session

All on the committed tree (`d5c352c60` + the gate-log commit), from this worktree:

| command | verdict |
| --- | --- |
| `pnpm -r typecheck` | **PASS** (9 projects, exit 0) |
| `vitest run packages/runtime packages/tools` (full, `--no-file-parallelism`) | **6558 passed / 6559**, 533/535 files. The two non-green suites are ENVIRONMENTAL and reproduce identically on the untouched baseline: `a5sf-os-runner` P1-07 (no Landlock backend on this host) and `u7-f-agent-control-native-output-schema-c1` (needs the gitignored pristine `tests/deepseek-harness-test-use` checkout, absent in a worktree) |
| targeted suites (`a2c4`, `a4p7`, `control-guard-coupling`, `f9`, `p6t6-guard`, `a4-corrupt-leg-guard`, `a6-stop-fence`) | **87/87 PASS** |
| `eslint .` | **RED at baseline**: 130 errors, every one on untouched files (unused vars etc.); **zero** on any line this PR adds or changes (`control/service.ts` only flags its pre-existing lines 174/284) |
| `node scripts/doc-checks.mjs` | **PASS** |
| `node scripts/eb3-tool-acceptance.mjs` | **PASS** (`tools=31 L4-proven=19`) |
| `node scripts/lint-identities.mjs` | **PASS** (162 identity lines, 0 gitignored) |
| `node scripts/check-artifacts-committed.mjs` | **OK** (2082 files, tree == index) |
| `node scripts/check-artifacts-at-head.mjs --store-dir …` | **OK** — HEAD carries its own build (2082 compared, drift 0) |
| `node scripts/check-install-manifest.mjs` | **RED at baseline**: 14 computed `new URL()` / `import()` refusals inside committed `packages/runtime/dist` artifacts; issue count identical before/after this PR (a pre-existing finding, the lock leg passes) |

Notes that must survive review:

- `node scripts/check-install-manifest.mjs` is **RED on the untouched baseline too** (14 computed
  `new URL()` / `import()` refusals inside the committed `packages/runtime/dist` artifacts; the lock
  leg passes). Our change adds none and the issue count is identical before/after — a pre-existing
  finding, not a regression.
- the protected-center digest ledger `dev/agent-workflow/ledgers/arc-a-protected-center.json`
  correctly refused the change until four **named** override entries were booked (control/index.ts,
  control/service.ts, control/types.ts, operation-permission/pa-control-bridge.ts). This is an
  interface change to the consumption boundary, not a family addition; the PR title/body says so.
- dist artifacts were rebuilt from this tree (`pnpm -r run build`) because `packages/runtime/dist`
  is tracked and a host boot reads it.

## 7. What this session did NOT do

- no merge, no end-to-end claim; no live boot (repo rule: the main agent boots the PR personally);
- no upstream/host edit, no patch-package, no vendored change (`CORE PATCH BUDGET = 0`);
- no durable per-invocation Stop state (ruling C declined by the owner);
- no claim that the A6-26 accepted-but-unclaimed review-wake abandonment changed — it is a
  separate defect and a separate disclosure.
