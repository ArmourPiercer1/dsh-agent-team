# model-preference-routing — Gate A–G focused evidence (2026-09-26)

Focused test runs (all green on the task branch, pre-full-suite). Full-suite
failure-set comparison (post − baseline = ∅) is in `../full-suite/post-full.log`
vs `../baseline/master-baseline-4fb79fc.log`.

| Gate | Criterion | Suite | Tests | Result |
|---|---|---|---|---|
| A validation | token grammar: qualified / model-only / malformed (empty, ws, control, `/model`, `provider/`) + `invalid-model-preference` + hash exclusion | `t2-blueprint-validation` | 68 | PASS |
| A hash | modelPreference contributes to the hash; malformed excluded | `t2-blueprint-hash` | (pre-existing 1 F0 = capabilities:null projection debt, not this round) | PASS (new cases) |
| B helper | `initialTemplateModelGrantOf`: qualified unchanged / model-only inherits staticModel.provider / absent+malformed undefined | `template-model-preference` | 6 | PASS |
| C consumption | resolver `template` layer carries `templateValues.model` (provenance template/static, recordId null); below record-backed overlays, above unspecified default; external hard facts win | `p8s4b-model-consumption` | 17 | PASS |
| D step-8 | activation step-8 grants carry the template model grant; generic templateValues omitted when empty | `model-activation-step8` | 4 | PASS |
| E live glue | E1–E9: one `locateTemplate` drives model+mcp; fresh-create `templateIdHint` honored for the member's FIRST request; E3 = newly-delegated expert first turn on its template model (primary defect closure); E6 durable override beats template; E7 cold-resume re-derivation; E8 cross-root isolation; E9 no-preference control | `model-blueprint-initial-routing` | 23 | PASS |
| F read-side | F1 template layer wins (value openai/gpt-6-astra, source member-template, state inherited); F2 modelState.current = template model + provenance {layer template, origin static, recordId null} + available; F3 human override → pending-next-boundary (both horizons); F4 one row 3 roots (anchor no-pref→baseline, root X→prov-x/model-x, root Y→prov-y/model-y; no anchor-closure / cross-leak) | `p8s7r2-effective-config` (22, +3) / `p8s7r2-model-state` (18, +2) | 40 | PASS |
| G legacy | writer `deepseek/deepseek-writer` + extras.writer.provider absent; leader `deepseek-chat` bare; G1 model-only→`foo`; G2 provider-only→no modelPreference + extras.provider | `p7t6-teammates-adapter` | 22 | PASS |

Static gates:
- typecheck: 8 packages green (legacy noCheck by design).
- build: `pnpm build` (9 pkgs) + `build:composition` + `check:artifacts` **OK 1180, zero drift** (after `git add packages/`).
- p4t6 SessionEvent denylist scan pin **748 → 753** (+5 new scannable files: route.ts, template-model.ts, template-model-preference.test.ts, model-activation-step8.test.ts, model-blueprint-initial-routing.test.ts), zero denylist vocabulary — 10/10.

Pre-existing Linux failure fixed in this round: `p7t6-teammates-adapter` source-scan
`split('\\')` → cross-platform `split(/[\\/]/)`.

Real-host 0.1.7-rc.1 smoke kit (merge gate, guide §7 R1–R8): see `../real-host/`
(kit + per-run evidence) — the ACTUAL provider request `body.model` is asserted,
not just the projection.
