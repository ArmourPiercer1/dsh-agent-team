# Pre-driver probe (diagnostic, DEV-LIVE)

These records were produced by the SAME integration branch before the joint
driver existed, with the fs-only composition (plane-owned bash spelling, no
`tool-bash` in the member preset), to locate the F-3 routing fact and the
PD-42 ceiling state:

- `a6-officer.json` — the Alpha.6/PD-42 scenario record (A6 arms + PD42 arms +
  the routed decider).
- `pd42-ceiling.json` — the guard-fact/side-effect record for the ceiling arms.
- `durable-ledger.json` — the durable control ledger rows read from the run's
  `storages/team_domain.json`.

They are NOT one of the two acceptance runs and carry no verdicts. The
driver-produced diagnostic control is `../joint-verdicts.json`.
