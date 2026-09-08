# Live round r2 — decision and repair plan

## Evidence basis

The committed live acceptance run is recorded in `REPORT.md`.

- F3/F9/T1.4/F11 host and UI baseline paths executed against the configured DSH_HOME.
- G3 pending, allow, deny, durable decisions, and human decider stamping passed live.
- G3 consumed failed because the request's guarded write did not produce the expected consumed fact; report classifies this as frozen guard-scope/F10 semantics, not an F9 regression.
- G4 policy failed because the committed `b6-req.md` request omitted `toolName`, leaving `capabilityDomain` undefined and bypassing the external-policy branch.

## Required next work

1. Do not change product semantics or bypass the frozen guard contract for G3 consumed.
2. Treat the G4 failure as a persistent test-recipe defect. Add the V1 T4.7a precedent's explicit `toolName: "write"` (or explicit `capabilityDomain`, if that is the frozen contract's selected field) to the policy-half request recipe, and ensure the gate selects that request rather than an older pending request.
3. Run the focused G4 policy re-test on a fresh hard-tools boot using the same configured DSH_HOME, with no fabricated ledger state.
4. Re-run the consumed path only if the frozen acceptance contract explicitly requires a changed guard scope; otherwise preserve the observed F10-class behavior and document it as an unchanged semantic boundary.
5. After any recipe/test-only supplement, run the complete live V2 matrix as required by the active plan, then obtain three fresh blind gate reviews.
6. Do not push until the reviewers return `通过` or `投机通过` and all required live rows are closed.

## Safety boundaries

- Keep `references/deepseek-harness-test-use` pristine.
- Do not touch stable `:3080` or `D:\deepseek-harness`.
- Keep credentials only in the user-configured gitignored DSH_HOME; never print or commit secret values.
- One task, one branch, one worktree, one writer; integrate supplements with `cherry-pick -x`.
