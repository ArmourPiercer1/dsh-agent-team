# stage2b notes (running log, append-only)

## run 2026-10-15T22-13-21 — attempt 0 (preflight)
- FATAL preflight: kit WORKTREE resolved 5 levels up instead of 6 (03-stage2b sits
  under dev/agent-workflow/evidence/alpha5-adapter-p0/07-integration). Error:
  `test-use not at baseline: undefined` (git ran in a non-existent dir). Fixed in
  p06-stage2b-kit.mjs (`resolve(KIT_DIR, up x6)`). No host was started.

## run 2026-10-15T22-13-33 — I1 PASS; I2 FAIL (blueprint), increments tail killed
- I1 PASS: cold boot :3185 (boot line x1, no-token GET / = 401, auth 303,
  p6t6 health ok=true, row state well-formed). DSH_HOME=tests/homes/a5p0-s2b-2026-10-15T22-13-33.
- I2a FAIL — original error (i2-team-create.json):
  MALFORMED_DTO: "permission rule $.members[0].capabilities.permissions.allow[1]
  (lane 'allow') is rejected: alpha.2 grants no positive whole-tool permission
  for bash — the allow lane must not carry a bash rule (no parameter-level allow
  for shell commands; use the ask or deny lane for { tool: bash, resource:
  { kind: 'any' } }) (source: a5p0-main.yaml)"
- I2b PASS (catalog.list). I2c/I2d/I3..I5 = never reached (create rejected; the
  waiting tail was terminated deterministically, job killed at ~4min into the L1 wait).
- FIX (kit-side, no product change): member allow lane = read:any only;
  ARM/DISPOSE token carriers ride the allowed `read` name via token-bearing
  file paths (a5p0-arm-<ARM_TOKEN>.txt / a5p0-dispose-<DISPOSE_TOKEN>.txt).
  Marker expectations shifted 1->2 (the arming call itself lands on the Adapter
  because assembly completes inside its pre-execute pass, before its dispatch).
- IMPACT RECORD: world `tests/homes/a5p0-s2b-2026-10-15T22-13-33` deleted after
  the run was killed (host pid was inside the job sandbox; port 3185 re-verified
  free = no response before re-run).
- Wait discipline (coordinator directive): every mock wait bounded 180s (was
  300s); timeouts land in run.log.

## mechanism pins (this round, for the report)
- Preset subtree CANNOT host the same-name assembly (same-layer registration
  collision + restrict() only names inherited names) — assembly rides the
  public `agent/created` event and lands on each agent's OWN scope
  (restrict-first -> register; the p01-fixture topology), sibling-inert.
- Model: mock staticModel provider=deepseek-official model=a5p0-model; harness
  session model = qwen3.8-flash-next (this agent).
