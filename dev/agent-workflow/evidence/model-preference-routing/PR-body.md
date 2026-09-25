# fix: route Blueprint `modelPreference` through the real Agent model-selection path

## Overview

Blueprint templates can declare a `modelPreference` (a model token), but the
value was carried in the schema/hash/Remote projection WITHOUT reaching the
real Agent model-selection path — a member's model silently fell back to the
deployment `staticModel` baseline regardless of the bound Blueprint.

This PR makes the bound Blueprint template's `modelPreference` a
TEMPLATE-STATIC policy value that the activation/resolver consumes, so a
member is routed to its Blueprint-declared model from the **FIRST** turn with
**zero** governance overrides.

Guided by `docs/plans/active/dsh-agent-team-model-preference-routing-fix-guide.md`
(local, gitignored). Gates A–G all delivered and green.

## Core design (guide §4)

- **Frozen token grammar** (Gate A, `agent-setup/model/route.ts`): split at
  the FIRST `/`; provider = non-empty prefix, model = non-empty suffix. A
  MODEL-ONLY token is LEGAL shorthand (inherits `staticModel.provider`).
  Malformed (empty / whitespace / control chars / `/model` / `provider/`)
  fails Blueprint validation (reason `invalid-model-preference`) and is
  EXCLUDED from the hash.
- **Template-static grant** (Gate B, `agent-setup/model/template-model.ts`):
  `initialTemplateModelGrantOf(template, baseline)` derives the model grant
  from `template.modelPreference` ONLY — qualified unchanged / model-only
  inherits `baseline.provider` / absent → undefined.
- **Consumption** (Gate C): the resolver `template` layer carries
  `templateValues.model = {kind:'allow', items:[route]}` (provenance
  template/static, recordId null) — below record-backed overlays/humanOverride,
  above the unspecified default; external hard facts always win.
- **Step-8 + live glue** (Gate D/E): one `locateTemplate` drives both the
  model + mcp grants; `boundTemplate` is reused; the fresh-create
  `templateIdHint` window is honored for the member's FIRST request.
- **Root read-side** (Gate F): the production root's `policyReader` reads the
  OWNING root's bound Blueprint through a per-root `boundBlueprintFor`
  resolver (NO closure over the bootstrap row anchor) and returns the template
  static MODEL grant merged with the capability values — a legacy template
  (no `capabilities`) that declares `modelPreference` now yields the grant
  instead of an empty view.
- **Legacy importer** (Gate G, `packages/legacy/teammates-adapter.ts`):
  provider+model → executable `modelPreference` route (`provider/model`,
  provider dropped from extras); model-only → bare `model`; provider-only →
  no `modelPreference` + `extras.provider`.

## Red lines held

- **CORE PATCH BUDGET = 0** (upstream DSH pristine; no patch-package; no
  `model` param added to team tools).
- No second parallel field; no schemaVersion bump; no special-case in
  effectiveConfig/modelState (regression tests only); MCP allow/deny semantics
  untouched; no MemberInstance schema fields; `staticModel` stays the
  deployment fallback for genuinely-unspecified cells only; no ambient state
  (`staticModel` is an injected port).

## Tests & gates (all green)

| Gate | Suite | Result |
|---|---|---|
| A validation | `t2-blueprint-validation` | 68 |
| A hash | `t2-blueprint-hash` | pre-existing 1 F0 (capabilities:null projection debt) |
| B helper | `template-model-preference` | 6 |
| C consumption | `p8s4b-model-consumption` | 17 |
| D step-8 | `model-activation-step8` | 4 |
| E live glue E1–E9 | `model-blueprint-initial-routing` | 23 |
| F read-side F1–F4 | `p8s7r2-effective-config` (22, +3) / `p8s7r2-model-state` (18, +2) | 40 |
| G legacy G/G1/G2 | `p7t6-teammates-adapter` | 22 |

- **Gate E highlights**: the freshly-delegated expert's FIRST turn on its
  template model (E3 — the primary defect closure), durable override beating
  the template (E6), cold-resume re-derivation from the bound Blueprint (E7),
  cross-root isolation (E8), and the no-preference control (E9).
- **p4t6** SessionEvent denylist scan pin **748 → 753** (+5 new scannable
  files, zero denylist vocabulary) — 10/10.
- **Typecheck**: 8 packages green (legacy is noCheck by design).
- **Build**: `pnpm build` + `build:composition` + `check:artifacts`
  **OK 1180, zero drift**.
- **Full-suite failure-set** vs the `4fb79fc` baseline:
  **19 failed | 3897 passed (3916)**; **post − baseline = ∅** (no new
  failures, no new failed files). The 2 baseline−post items are: the
  pre-existing environment-dependent p7t6 Linux failure (fixed — Windows-only
  `split('\\')` → cross-platform `split(/[\\/]/)`) and the known
  p6t1-parallel load flake (passed this run).
- **Zero-core**: test-use pristine @ `46a7f68b09` (porcelain empty) pre-run.

## Merge gate (guide §7) — GREEN ✅

The real-host 0.1.7-rc.1 smoke kit
(`tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs`)
asserts the **ACTUAL** provider request `body.model` on every recorded HTTP
request (not just the projection). **GREEN ×2** (consecutive exit 0; 36 checks,
0 failed, fatal=null):

| Criterion | Assertion (actual `body.model`) |
|---|---|
| R1 | leader first request `role-leader` (NOT the `global-default` baseline) + 13/13 team tools + zero-seed 0 override |
| R2 | **direct `team_delegate` → worker first request `role-worker`** — the defect closure (one `member-activated` create+work effect; no create+override+follow-up; `override.get`=null) |
| R3 | create alone = no substantive turn; follow-up → `role-worker` |
| R4 | durable human override → next request `override-worker` (record layer beats template-static; no synthetic override record) |
| R5 | expert `role-expert` identical before **and** after cold-resume (re-derived from the bound Blueprint snapshot) |
| R6 | three-way agreement: `body.model` == effectiveConfig.model.value == modelState.current.value (provenance `member-template` / `template` / `static`, recordId null) |
| R7 | no-`modelPreference` control → `global-default` (backward-compat locked) |
| R8 | cross-root on one row: Team A `role-a`/`role-a-leader`, Team B `role-b`/`role-b-leader`, no leak |

20-request mock ledger all correct. Hygiene: test-use pristine pre **and** post
@ `46a7f68b09` (porcelain empty); :3080/:3180 read-only probes identical
(401, never bound); host/mock ports released. All 13 iteration fixes were
**kit-side** — zero production changes (CORE PATCH BUDGET = 0 held). Evidence:
`dev/agent-workflow/evidence/model-preference-routing/real-host/`.

## Verification

```
cd .worktrees/model-preference-routing
pnpm --filter @dsh-agent-team/runtime run typecheck   # exit 0
pnpm build && pnpm build:composition                  # check:artifacts OK 1180
npx vitest run packages/runtime/test/model-blueprint-initial-routing.test.ts  # 23/23
```
