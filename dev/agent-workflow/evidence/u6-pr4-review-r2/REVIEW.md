# U6 PR4 / PR #377 — FINAL round 2 independent review

**Verdict: 投机通过**

## Scope and verification

- Reviewed only the PR4 tree at `b9d0ddebf588579fdeea4a33609d95249b8c4235`; did not consult earlier PR4 review material or `SESSION_ROUTER_LOG.md`.
- Moved bridge body is byte-identical: `packages/runtime/src/plugin/live/jobs-family-bridge.mjs:76-347` SHA-256 `71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f`; master pre-move extract matches. Frozen `jobs-gateway-assembly.mjs` and `pa-mount-registry.mjs` match the pinned SHAs. No diff touches `control/**`, `tool-admission/**`, or `install.ts`.
- All explicit U6 C1 files (PR1/PR2/PR3/FIX-K/PR4, 15 files) passed: **127 tests**. `node --test tests/world-factory/world-factory.test.mjs` passed **28/28**. The originally requested glob form matched no files; this was a command-pattern issue, corrected by running the concrete files.
- `agent-bindings.mjs:2660-2669` supplies every governed jobs bridge with `ci05GovernedGatewayRow(...)`; no governed construction path was found using the raw gateway row. Non-Team construction remains gated by `permissionPolicy`/`teamToolPlane` (`agent-bindings.mjs:2643-2645`).
- `jobs-family-bridge.mjs:160-163,194-199,309-316,328-335` performs the management check before `svc.wait/read/kill`, and list filtering uses the same wrapped gateway face. Unit F legs count zero service reach for unattributed output/kill and hide unattributed list rows.
- The trio is on the same kernel/approval table/`consumeOnce` path as read/bash; no second approval ledger was found. Unit C and the world-factory no-second-ledger arm support this (boot 4 recorded `trioUses:7`, zero control rows).

## Findings / carried risks (none are new CORE defects)

1. **BRIDGE-BLOCKED remains real.** The C2 receipts in `dev/agent-workflow/evidence/u6-pr4-20261026/README.md:170-185,284-298` show mount and leak laws, but no positive live birth/management/fence/cancel measurement. This is correctly disclosed, not silently promoted to Bridge PASS.
2. **Creation-lane attribution is absent at this pin** (`README.md:336-343`). With CI-05 fail-closed, governed mounts refuse every un-attributed job before Host reach; this is the named local bridge gap and must remain carried until a Team-owned producer exists.
3. **Team-lane stall is a harness/test-world issue, not demonstrated product regression** (`README.md:245-264). Boots 5–7 changed only `tests/world-factory/lib/u6-jobs-assembly.mjs` / its test fixture and related runner/receipt files; no production runtime file changed between boot 4 and boots 5–7. Boot 7 still mounted all governed rows and completed the root native lane, so the evidence does not implicate PR4 product code.
4. **Ctl ring-read race** is separately named and one-line-fixable (`README.md:265-274`), but was not re-run due to the dominant Team-lane stall and start budget. Carry it as test-world evidence debt, not as a bridge-law failure.
5. **C2 effect legs remain unverified.** The honest status is not full G4/CA-03; the branch's own final position is G4-CORE-PASS / BRIDGE-BLOCKED (`README.md:284-298`).

## §10.6 ruling (ARC-C)

The final status **G4-CORE-PASS / BRIDGE-BLOCKED is correct**, not CORE BLOCKER: the remaining gaps are local to Jobs live creation/fixture execution and do not affect shared identity trust, authorization primitives, pre-body refusal, or one-shot `consumeOnce`. CI-05 is stricter than the old pass-through, and the bridge's failure mode is fail-closed. This does **not** constitute full G4-PASS, does not unlock S5/release, and requires the named attribution producer plus a valid live Team-lane run before ARC-C can be called green.
