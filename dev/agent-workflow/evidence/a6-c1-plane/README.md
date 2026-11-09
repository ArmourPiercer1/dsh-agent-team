# C1 real-Host smoke with the plane bash takeover — observed 2026-11-04

Host: pristine `tests/deepseek-harness-test-use` @ `639ed01539` (0.2.0-rc.2).
Kit: `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`
with `C1_PLANE_TAKEOVER=1` (new opt-in mode), invoked with
`--host-port 3546 --mock-port 3547`;
DSH_HOME and the scratch workspace are under the gitignored `tests/homes/`.

This run answers the open question from `a6-c1-020`: can the same legacy C1
blueprint execute its approved `bash` once the row mounts the supported
takeover spelling (`bash@bash`)?

## Mode changes (test infrastructure)

- row config gains `teamToolPlane: { realmId, names: { bash: 'bash' },
  confinedProvider }` — the shell takeover with the reviewed Landlock
  prelauncher pair;
- the blueprint's native `deny: read@runtime` lanes are replaced by empty
  `deny: []` lanes, because the plane projection refuses a native-name deny
  rule (`rule deny[0] (read@runtime) is an ...`). An empty lane is still
  required by the Blueprint DTO.
- the mock's shell arguments use the plane's closed spelling `timeout`
  instead of the native `timeoutMs` (the plane row refused `timeoutMs` with
  `a5p5-refused kind=refused-schema code=unknown-field`).

## Result

The takeover mounts and the original BIND-DIAG wall is gone:

- PASS L0: `bash` present; Boot surface 20 tools.
- PASS S1.0 / S1b / S1c / S1d: `team.create`, the durable approval request,
  the Leader notification, the exact pending id.
- PASS S2d / S2e: the Leader allow was recorded and **exactly one**
  `control-allow-consumed` fact exists for the request.
- PASS S3a / S3b / S3c / S3d: the second ask was denied with no consumption
  and no side effect.
- FAIL S2b/S2c: the approved member `bash` never returned a tool result and
  the allow file is absent.

## Why S2b still fails (measured, not inferred)

The durable ledger shows **two** approval requests for the one member call:

1. `parameter-permission` (the Guard/native ask) — allowed and consumed once;
2. `team-tool-execute` (the plane PA's own approval leg) — recorded only
   after the first was consumed, and still pending when the kit timed out.

The legacy C1 notification path only announces the first request; nothing
wakes the Leader for the second, so the plane's `controlLeg` waits forever.
This is not a binding refusal: the plane mounted, admitted the call and asked
through its durable bridge. A real end-to-end arc therefore needs the
Alpha.6 routing/wake plane (or a blueprint/policy shape in which the Guard
and the plane PA do not both ask), which this legacy kit does not author.

Do **not** cite this run as a passing Member->Officer end-to-end. It is a
reproducible partial: takeover removes the binding wall and exposes the
approval-plane overlap.

Raw host/mock logs are intentionally not committed (large, machine-specific);
the assertions above are reproducible with the kit mode and this README's
ledger excerpt.
