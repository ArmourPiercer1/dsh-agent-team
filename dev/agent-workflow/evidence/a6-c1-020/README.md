# C1 real-Host smoke on DSH 0.2.0-rc.2 — observed 2026-11-04

Host: pristine `tests/deepseek-harness-test-use` @ `639ed01539` (0.2.0-rc.2).
Kit: `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`
(alpha6 opt-in OFF; this is the Alpha.4/legacy approval loop).

## Kit compatibility fixes (test infrastructure, not a product verdict)

0.2.0-rc.2 delivers tool results as `user` messages with a `tool_result`
content block and assistant tool calls as `tool_use` blocks. The kit assumed
0.1.x (`role: 'tool'`, `tool_calls`). After normalizing both shapes:

- tool-chain progress advances (create -> delegate -> done) instead of
  replaying create_member;
- instance ids are parsed from flattened result text, not `[object Object]`;
- the Leader notification text is read from text blocks, so S1c/S1d match.

## Result (one run, ports 3546/3547)

PASS: S1.0, S1b, S1c, S1d, S3a, S3b, S3c, S2d, S3d, S2e, S4.0, S4a, S4b,
XC1, XC3.

FAIL:
- **S2b/S2c** — after `team_resolve_control allow`, the member `bash`
  re-dispatch is refused by the product guard:
  `team tool guard: the Tool Binding for "bash" cannot be verified at
  dispatch time (no fallback to the native body)`. The allow decision and
  the single consumption fact are durable; the guarded execution does not
  run, so the side-effect file is absent. This is the **known BIND-DIAG
  limitation for a NON-TAKEOVER native name**, not a new 0.2.0 regression:
  the supported execution face is the plane takeover spelling (`bash@bash`),
  and this legacy c1 blueprint does not mount `teamToolPlane`/the plane-shaped
  projection. An attempt to flip only `teamToolPlane.names.bash='bash'` was
  refused by the plane projection (the blueprint's native-name deny rules are
  not plane-shaped), so enabling takeover needs a plane-shaped blueprint,
  not a one-key change.
- **S4c/S5a/S5b** — after the deliberate notification 500, the Host keeps
  retrying the notification turn (mock requests 30–44 are all 500), so the
  explicit recovery prompt to the Z Leader does not get a turn before the
  kit timeout. The durable Z request stays pending (S4b/XC3 pass).

## Alpha.6 consequence

The Alpha.6 opt-in boot and unit/e2e (production-root) evidence remain valid.
The real-Host Member -> Officer arc is still NOT proven: this C1 run uses the
legacy non-takeover surface, which the product refuses by design at the
binding gate. A real arc needs a plane-shaped blueprint with `bash@bash`
takeover, which this kit does not author. Do not cite this run as a passing
end-to-end.

Raw run output is intentionally not committed (large, machine-specific);
the assertions above are reproducible with the kit and ports.
