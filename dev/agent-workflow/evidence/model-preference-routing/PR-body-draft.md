# fix: route Blueprint `modelPreference` through the real Agent model-selection path

## Overview

Blueprint templates can declare a `modelPreference` (a model token), but the
value was carried in the schema/hash/Remote projection WITHOUT reaching the
real Agent model-selection path — a member's model silently fell back to the
deployment `staticModel` baseline regardless of the bound Blueprint. This PR
makes the bound Blueprint template's `modelPreference` a TEMPLATE-STATIC
policy value that the activation/resolver consumes, so a member is routed to
its Blueprint-declared model from the FIRST turn with **zero** governance
overrides.

Guided by `docs/plans/active/dsh-agent-team-model-preference-routing-fix-guide.md`
(local, gitignored). Gates A–G all delivered and green.

## Core design (guide §4)

- **Frozen token grammar** (Gate A): split at the FIRST `/`; provider =
  non-empty prefix, model = non-empty suffix. A MODEL-ONLY token is LEGAL
  shorthand (inherits `staticModel.provider`). Malformed (empty / whitespace /
  control chars / `/model` / `provider/`) fails Blueprint validation with
  reason `invalid-model-preference` and is EXCLUDED from the hash.
  `packages/runtime/agent-setup/model/route.ts` (`parseModelItem` /
  `parseModelPreferenceToken`) + `packages/domain/blueprint/src/validate.ts`.
- **Template-STATIC grant** (Gate B): shared helper
  `initialTemplateModelGrantOf(template, baseline)`
  (`packages/runtime/agent-setup/model/template-model.ts`) derives the model
  grant from `template.modelPreference` ONLY: qualified token unchanged /
  model-only inherits `baseline.provider` / absent → undefined.
- **Consumption** (Gate C): the resolver `template` layer carries
  `templateValues.model = {kind:'allow', items:[route]}` (provenance
  template/static, recordId null) — below record-backed overlays/humanOverride,
  above the unspecified default; external hard facts always win.
- **Step-8 derivation** (Gate D): the provider derives the model + mcp grants
  at step 8; a generic `templateValues` is omitted when empty.
- **Live glue** (Gate E): one `locateTemplate` drives both model + mcp grants;
  `boundTemplate` is returned and reused; the fresh-create `templateIdHint`
  window is honored for the member's FIRST request.
- **Root read-side** (Gate F): the production root's `policyReader` reads the
  OWNING root's bound Blueprint through a per-root `boundBlueprintFor`
  resolver (NO closure over the bootstrap row anchor) and returns the template
  static MODEL grant merged with the capability values — so a LEGACY template
  (no `capabilities`) that declares `modelPreference` now yields the model
  grant instead of an empty view.
- **Legacy importer** (Gate G): `packages/legacy/teammates-adapter.ts` maps a
  legacy teammate def's `provider` + `model` into an executable
  `modelPreference` route (both → `provider/model` + drop `extras.provider`;
  model-only → `model`; provider-only → absent + `extras.provider`).

## Red lines held

- CORE PATCH BUDGET = 0 (upstream DSH pristine; no patch-package; no `model`
  param added to team tools).
- No second parallel field; no schemaVersion bump; no special-case in
  effectiveConfig/modelState (regression tests only); MCP allow/deny semantics
  untouched; no MemberInstance schema fields; `staticModel` stays the
  deployment fallback for genuinely-unspecified cells only; no ambient state
  (`staticModel` is an injected port).

## Tests & evidence

- Gate A/B/C: `t2-blueprint-validation` / `t2-blueprint-hash` /
  `template-model-preference` / `p8s4b-model-consumption`.
- Gate D: `model-activation-step8` (4).
- Gate E (live glue E1–E9): `model-blueprint-initial-routing` (23) — incl.
  the freshly-delegated expert's FIRST turn on its template model (E3),
  durable override beating the template (E6), cold-resume re-derivation from
  the bound Blueprint (E7), cross-root isolation (E8), and the no-preference
  control (E9).
- Gate F: extended `p8s7r2-effective-config` + `p8s7r2-model-state`
  (F1–F4 read-side agreement).
- Gate G: extended `p7t6-teammates-adapter` (G / G1 model-only / G2
  provider-only).
- p4t6 SessionEvent denylist scan pin 748 → 753 (+5 new scannable files, zero
  denylist vocabulary).
- Full-suite failure-set comparison vs the `4fb79fc` baseline (post − baseline
  = ∅).
- Real-host 0.1.7-rc.1 smoke (R1–R8) asserting the ACTUAL provider request
  bodies.
