# a4-pr76-acceptance-world

> **SIMULATED / MACHINE acceptance — NOT the human pass.** The Alpha.4 human
> acceptance remains BLOCKED/NOT_RUN (`alpha4-implementation-plan.md` §7.7).

A live, one-command reproducible **acceptance world** for the Alpha.3
nine-step permission-surface checklist
(`ALPHA3-PERMISSIONS-USER-FACING.md` §8), so the coordinator can drive the
Alpha (and a human can perform the §8 browser pass) against the merged tree.

Read first: **`LEGS.md`** (per-leg plan, MACHINE results, findings), then
**`POST-TIGHTENING-RE-VERIFICATION.md`** (sandbox-safe re-verification).

## Drive it

```bash
cd <this dir>
node boot.mjs --detach --model-delay-ms 4000   # prints launch line (token); idempotent
# ...drive the browser checklist against http://127.0.0.1:3180/?token=...
node driver.mjs                                # optional: re-run the MACHINE legs (raw receipts)
node boot.mjs --stop                           # MANDATORY teardown — never leave the host running
```

Red lines enforced by the scripts and restate here: port 3180 only; never
`:3080` or its `~/.dsh` home; pristine `tests/deepseek-harness-test-use`;
world lives in gitignored `tests/homes/a4-accept-20261007T16-57-26Z`;
tokens/paths never enter git.

## Layout

| path | what |
| --- | --- |
| `boot.mjs` | supervisor: materializes the world idempotently from `world-template/`, spawns the pristine web host (sanitized env, HOME/XDG pinned inside the world) + the in-process mock DeepSeek lane, probes :3080 before/after, refuses foreign ports, prints the launch line |
| `driver.mjs` | MACHINE legs for checklist steps 2–9 with raw wire receipts; prints PASS/FAIL/SKIP, exit != 0 on FAIL |
| `world-template/` | the world's source of truth: `profiles/web/*` (cordis patch rows → main-checkout dist `packages/runtime/dist/.../plugin/host.js` + p6t6 harness row) and the two v3 Blueprints (`a4-accept-team.yaml` = the row anchor + non-empty envelopes; `a4-accept-anchor.yaml` = second catalog entry) |
| `receipts/` | executed evidence: `driver-run-20261007T171846.log` (canonical 8/8 PASS), `driver-run-20261007T171559.log` (first pass), `accept-probe.log` (:3080 before/after), `gates.md` (check:artifacts OK 1508 + whole-repo test identity comparison) |

## Honest-state summary

- MACHINE: 8/8 legs PASS against a real booted host; model turns run on the
  repo harness **mock** oracle (no credentials in this env) — the real-model
  dimension of steps 4–7 is **BLOCKED: missing `DEEPSEEK_*` credentials**,
  never simulated as a pass.
- GUI: the human §8 browser pass is fully supported by this world and still
  owed (owner: human/coordinator).
- Findings recorded (not worked around) in `LEGS.md` — notably F1, a latent
  frozen-row `schemaVersion` conflation this world reproduces on demand.
