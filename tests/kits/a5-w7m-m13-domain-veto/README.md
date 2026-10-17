# a5-w7m-m13-domain-veto — Alpha.5 W7M kit (pr8 M-13: Domain 工具 veto 观测腿)

Sibling of the reviewed `a5-w7-jobs-wiring` (W7) kit — assembled for the pr8
**M-13** RLW line (`TeamPermit ∧ DomainPermit` mutual non-override, veto ⇒
0 side effects, unresolved Domain reference fail-closed, `job_start` anchor
stays absent) per `dev/agent-workflow/evidence/alpha5/wiring/w7/JOPS-CAPABILITY-RECHECK.md`
§② (the assembly plan that line's recheck wrote). **Zero edits** to the W7
kit, the probe, the runner, the machine matrix, or any `packages/**` lane
source — this kit only ADDS observation legs on top of the reviewed public
faces.

Scope note (收缩令 2026-10-17): the six-leg chain booking for M-13 is
**W-E2 @a9bbeb1c** (`alpha5-wire-tools2`, 28/28, TRANSITIONED-LIVE proposal).
This kit does NOT re-book those legs. Its unique increment is the **A3-(a)
host public path materialization**: veto ⇒ never registered on `ctx.jobs` ⇒
the public `job_list` face self-proves zero veto registrations, plus the
allow leg really starting and really collecting via `bash
run_in_background` on the host's own plane (JOPS-CAPABILITY-RECHECK
`(a)`-layer, file:line verified on the pinned tree). The 4-cell matrix in
this run is this kit assembly face's independent re-observation (same-shape,
not the six-leg chain) and keeps M7b non-vacuous.

| face | what it adds |
| --- | --- |
| `a5w7m-veto-plugin.mjs` | one plugin row: jobs-gateway PUBLIC BARREL **from repo dist** (build include @933f2f5d — no kit-local compile) + a disclosed **row-local Domain mock** (CAS simulated device, domain reference table, per-cell DomainPermit bits) behind a SINGLE effect-commit gate. TeamPermit = the live gateway's own `admitJob` verdict against HOST-derived member identities; the gate funnels the 4-cell matrix, the negative controls, and the actuator annotation, and its interlock ledger IS the side-effects observation. |
| `a5w7m-kit.mjs` | real-Host driver on port **3184** (self-proved free; if a foreign listener holds it at run time the deviation is recorded and a free 3180-family port is used), world `tests/homes/a5w7m-*`: boots the production Team row + p6t6 + this row with a coverage-safe kit preset for the TEAM sessions; the `(a)`-layer allow leg runs on a **PLAIN ordinary host session** (public `POST /api/session/create`, shipped default face, outside team governance — see the coverage-gate finding below). Proves the face live (`bash` + `job_list` + `job_output` in that session's live model surface, `(a)`-layer file:line anchors verified on the pinned tree), runs the 4 cells, runs the **allow leg for real** (`bash run_in_background` → `job_list` → `job_output`, output collected), measures veto zero on BOTH the row ledger and the host face, runs the A4 negative controls (unresolved / withdrawn reference; stale CAS version), keeps lease hygiene (settle → drain → RELEASED), re-greps the `job_start` anchor pre/post, and emits the pr8 receipt candidate (`veto_matrix` / `veto_side_effects` / `negative_controls` / `pinned_host` / `evidence_refs`, F-1 re-checked before `--emit-receipt` writes it). |

## run

```bash
# host tree + repo build must exist (tests/paths.mjs pins; see TEST_METHODS §2)
node tests/kits/a5-w7m-m13-domain-veto/a5w7m-kit.mjs \
  --evidence-dir dev/agent-workflow/evidence/alpha5/wiring/w7m/run-GREEN \
  [--without-row] [--emit-receipt dev/agent-workflow/evidence/alpha5/pr8/probes/receipts/M-13.receipt.json] \
  [--port 3184] [--world-prefix a5w7m] [--keep]
# then (zero-port, read-only): node dev/agent-workflow/evidence/alpha5/pr8/probes/probe-M-13.mjs
```

## coverage-gate finding (observed live, typed)

The lane's OWN Permission Coverage Gate (`packages/runtime/operation-permission/permission-coverage.ts`,
six-class closed union) classifies the whole `job_` family `KNOWN_SENSITIVE_UNMANAGED`
⇒ FATAL on any governed session surface. Booting the governed anchor on the
shipped `standard` preset failed with the typed `alpha2-permission-coverage-unmanaged-tools`
error (verbatim: 19 unmanaged tool names, `job_list`/`job_output`/`job_kill`
among them) — preserved as `run-RED-attempt1-coveragegate/`. Consequence:
the host public jobs plane runs where the host itself runs it — a plain
(non-team) session — which is exactly where JOPS-CAPABILITY-RECHECK places
the `(a)` layer. Not a bypass: an honest layering observation.

Host boot env: `DSH_PERMISSION_MODE=danger-full-access` (public deployment
knob; the base web-app patch layer maps it to approval policy `never`) so the
allow leg traverses the host's OWN approval layer headlessly; the leg's
commands are `echo`/`sleep` only. Disclosed in the receipt.

## what is LIVE here and what is not (口径)

* LIVE: the gateway law on the live assembly (TeamPermit refusals are the
  lane's own codes), the dual-permit conjunction at the single gate, the
  host's public background-jobs path really starting/collecting, and the
  zero registrations of veto cells on that same public face.
* DISCLOSED mock (by the S0 test requirement itself — "Domain mock
  (CAS 状态/模拟设备)"): device, CAS store, permit bits, reference table.
  Row-local, deterministic inputs; NOT host registry facts.
* Not claimed: any host-registry-shaped mid-session rebind (fixture-level,
  W7 disclosure unchanged — M-13 does not require it); termination of any
  kind (G-g OPEN, cooperative abort only); `job_start` existence (grep
  stays at zero, pre and post); PASS as a line-level state (probe vocabulary
  is LIVE / PROBE-GATED only — IF-7).

RED control: `--without-row` boots the world without this row — every leg
fails on its own 404 and the criteria table names exactly what the wiring
owes. The GREEN run's evidence directory is committed beside this README;
the probe (unmodified) re-reads the emitted receipt and the runner (unmodified)
re-verifies the matrix row.
