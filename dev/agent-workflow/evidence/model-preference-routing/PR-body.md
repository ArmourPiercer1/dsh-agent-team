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

- **Frozen token grammar** (Gate A — a SINGLE pure parser,
  `packages/domain/blueprint/src/model-preference.ts`
  `parseModelPreferenceToken`): split at the FIRST `/`; provider = non-empty
  prefix, model = non-empty suffix. A MODEL-ONLY token is LEGAL shorthand
  (inherits `staticModel.provider`). Malformed (empty / whitespace / control
  chars / `/model` / `provider/`) fails Blueprint validation (reason
  `invalid-model-preference`) and is EXCLUDED from the hash. *(Supplement P2-2:
  the near-duplicate domain + runtime parsers are collapsed into this one
  grammar — the runtime `route.ts` mirror is deleted; U+1680 OGHAM SPACE MARK
  and C0/DEL control chars are rejected via `\s` + a control-char set, so there
  is ONE parser and ONE site.)*
- **Template-static grant** (Gate B, `agent-setup/model/template-model.ts`):
  `initialTemplateModelGrantOf(template, staticModel)` derives the model grant
  from `template.modelPreference` ONLY — qualified unchanged / model-only
  inherits `staticModel.provider` / absent → `undefined` / **malformed →
  `throw InvalidTemplateModelPreferenceError`** *(supplement P2-1: a
  PRESENT-but-malformed preference is a fail-loud throw — code
  `INVALID_TEMPLATE_MODEL_PREFERENCE`, details `{templateId, token}` — never a
  silent `staticModel` fallback and never disguised as absent; the pre-supplement
  `return undefined` for malformed was exactly that defect)*.
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
| A validation | `t2-blueprint-validation` | 69 (incl. P2-2 single-parser U+1680 / control-char cases) |
| A hash | `t2-blueprint-hash` | pre-existing 1 F0 (capabilities:null projection debt) |
| B helper | `template-model-preference` | 10 (B5 malformed→throw, B5b code/templateId/token, B5c U+1680, S2 no-fallback) |
| C consumption | `p8s4b-model-consumption` | 17 |
| D step-8 | `model-activation-step8` | 4 (P2-4 naming: "composition contract") |
| E live glue E1–E9 | `model-blueprint-initial-routing` | 23 (P2-4: E3 = fresh-create boundary) |
| F read-side F1–F4 | `p8s7r2-effective-config` (22, +3) / `p8s7r2-model-state` (18, +2) | 40 |
| F-inspect I1–I4 | `model-inspect-config` (NEW, P2-4 §4 — shipped `team_inspect_config` action) | 7 |
| G legacy G/G1/G2 | `p7t6-teammates-adapter` | 22 |

- **Gate E highlights**: the freshly-delegated expert's FIRST turn on its
  template model (E3 — the primary defect closure), durable override beating
  the template (E6), cold-resume re-derivation from the bound Blueprint (E7),
  cross-root isolation (E8), and the no-preference control (E9).
- **p4t6** SessionEvent denylist scan pin **748 → 753** (round 1, +5 new
  scannable files) → **753 → 756** (supplement, +3: `domain/…/model-preference.ts`
  + `runtime/agent-setup/model/errors.ts` + `runtime/test/model-inspect-config.test.ts`),
  zero denylist vocabulary — 10/10.
- **Typecheck**: 8 packages green (legacy is noCheck by design).
- **Build**: `pnpm build` + `build:composition` + `check:artifacts`
  **OK 1188, zero drift**.
- **Full-suite failure-set** vs the `4fb79fc` baseline: **20 failed | 3908
  passed (3928)** (supplement run); **post − baseline = ∅** (no new failures —
  per-test `comm` diff; the only baseline entry no longer present is
  `p7t6-teammates-adapter`, fixed in round 1; the known p6t1-parallel load flake
  is present in BOTH runs = same set).
- **MCP suites** (all green): `mcp-blueprint-initial-grant` 32 /
  `multi-mcp-wiring` 47 / `p8s4b-mcp-facet` 25.
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
| R6 | three-way agreement: the projection (effectiveConfig.model.value == modelState.current.value, provenance `member-template` / `template` / `static`, recordId null) carries the FULL route `deepseek-official/role-worker`, and its `.model` equals the ACTUAL provider request `body.model` (`role-worker`) — i.e. `route.provider` = the selected provider, `route.model` = `body.model` (NOT a three-string literal equality) |
| R7 | no-`modelPreference` control → `global-default` (backward-compat locked) |
| R8 | cross-root on one row: Team A `role-a`/`role-a-leader`, Team B `role-b`/`role-b-leader`, no leak |

20-request mock ledger all correct. **Re-verified in the review-supplement
round** (run `mpr-2026-09-26T04-36-32`, exit 0, fatal=null, R1–R8 + H1–H2 all
PASS — including the P2-5 H2 "port … free" detail and the R6 label
consistency). Hygiene: test-use pristine pre **and** post @ `46a7f68b09`
(porcelain empty); :3080/:3180 read-only probes identical (401, never bound);
host/mock ports released. All 13 iteration fixes were **kit-side** — zero
production changes (CORE PATCH BUDGET = 0 held). Evidence:
`dev/agent-workflow/evidence/model-preference-routing/real-host/`.

## PR #30 review-supplement round (2026-09-26, P2-1..P2-5)

Addressed the review supplement guide
(`docs/plans/active/PR30-model-preference-review-supplement-fix-guide.md`,
local, gitignored; review baseline = this PR's head `6b9ff59`). Core invariant
(§14): **present+valid → template/static value; absent →
unspecified→staticModel; present+invalid → fail loud, NEVER disguised as
absent**. A hardening round — no re-design, no scope expansion beyond the five.

- **P2-1 — malformed `modelPreference` fails loud.** The pre-supplement
  `initialTemplateModelGrantOf` returned `undefined` for a PRESENT-but-malformed
  token, which the consumers silently read as "absent" and fell back to the
  deployment `staticModel` — a disguised-as-absent defect. It now throws a typed
  `InvalidTemplateModelPreferenceError` (code `INVALID_TEMPLATE_MODEL_PREFERENCE`,
  details `{templateId, token}`, message states it must never fall back to
  `staticModel`). The throw propagates raw at all four boundary call sites
  (`activation/provider.ts`, `live/agent-bindings.mjs`, `plugin/root.ts`, and the
  `INSPECT_CONFIG` effect — outside its try block). `absent` still → `undefined`
  (unchanged).
- **P2-2 — one shared parser.** The near-duplicate token parsers in
  `domain/blueprint/validate.ts` and `runtime/agent-setup/model/route.ts` are
  collapsed into a SINGLE pure parser,
  `packages/domain/blueprint/src/model-preference.ts`
  (`parseModelPreferenceToken`). The runtime `route.ts` mirror is deleted (only
  `parseModelItem` — durable-item semantics — remains there). Grammar: split at
  the FIRST `/`; reject on `\s` (covers U+1680 OGHAM SPACE MARK, which the old
  hand-rolled runtime table did NOT reject) and a C0/DEL control-char set;
  separator at position 0 or the last index → malformed. One grammar, one site.
- **P2-3 — `staticModel` is required, not silent-optional.**
  `TeamRuntimeOptions.staticModel` (and `EffectContext.staticModel`) are now
  REQUIRED; `createTeamRuntime` passes it unconditionally. 23 `createTeamRuntime`
  call sites across 14 test files use a unified
  `TEST_STATIC_MODEL = {provider:'test-static', model:'test-default'}`; the
  ~28 test files with intentional custom baselines are left byte-for-byte.
- **P2-4 — `team_inspect_config` effective-policy regression + Gate D/E naming.**
  New `model-inspect-config` suite (7) drives the SHIPPED `team_inspect_config`
  action and asserts `effect.effective['model']`: **I1** qualified →
  `{kind:'allow', items:['openai/gpt-6-astra']}` (template-static, not the
  baseline, not deny); **I2** bare `qwen3.8-27b` + `qiyuan-self` baseline →
  `qiyuan-self/qwen3.8-27b` (inherits baseline provider); **I3** no preference →
  `{kind:'deny'}` (layer `unspecified` — `staticModel` is the CONSUMER fallback
  per E9, not a policy value); **I4** a planted durable human override
  (`openai/gpt-6-pro`, recordId `ovr-mpic-model`, team scope) →
  `{kind:'allow', items:['openai/gpt-6-pro']}` (record layer beats template).
  Gate D renamed to "activation step-8 **composition contract**" (the unit leg
  locks the composition glue; it no longer claims to observe the provider's
  internal frozen policy — that final behavior is closed by Gate E + real-host
  R1/R2). Gate E E3 renamed to "delegation **fresh-create boundary**: the
  member's FIRST assembly already uses the template model" (the full direct
  `team_delegate` chain is proven by real-host R2; no tool-level unit harness
  was re-built).
- **P2-5 — smoke-kit evidence self-consistency.** H2's PASS detail now reads
  `port ${PORT} free` (it previously read `still bound` — a contradiction on a
  PASS; the mock 3496 check is the same). R6's check label is aligned with the
  real comparison semantics (the projection carries the full `provider/model`
  route `deepseek-official/role-worker`; the wire `body.model` is the model id
  `role-worker`; the assertion compares `route.model == body.model`). The
  comparison LOGIC is unchanged — text only.

Supplement gates all green: typecheck 8 pkgs exit 0 · `build` +
`build:composition` + `check:artifacts` **OK 1188 zero drift** · p4t6
**753→756** · `template-model-preference` 10/10 · `t2-blueprint-validation`
69/69 · `model-inspect-config` 7/7 · `model-activation-step8` 4/4 ·
`model-blueprint-initial-routing` 23/23 · full suite **20F|3908P(3928)** with
**post − baseline = ∅** · MCP suites green · real-host smoke re-run
`mpr-2026-09-26T04-36-32` (exit 0, fatal=null, R1–R8 + H1–H2 all PASS, H2
detail = "port 3181/3496 free", R6 label consistent).

### P3 text corrections (2026-09-26, post-supplement)

Three minor text/accuracy corrections from a follow-up review (none change
behavior or affect the merge):

- **P3-1** — the R6 row above now states the real relationship (the projection
  carries the full `provider/model` route; `route.model == body.model`), not a
  three-string literal equality — aligned with the current kit label.
- **P3-2** — `model-preference.ts` no longer lists U+180E MONGOLIAN VOWEL
  SEPARATOR as part of `\s` (it was removed from the ECMAScript whitespace set
  in ES2020; `/\s/.test('\u180e') === false`). The comment now references the
  spec production (WhiteSpace ∪ LineTerminator) instead of a hand-listed
  code-point set, keeping U+1680 as the motivating example.
- **#8** — the `S2 integration` describe in `template-model-preference.test.ts`
  is renamed to `S2 defensive derivation regression` (it is a unit-level test
  over the shared pure helper, not a live-boundary integration; the live
  boundary is proven by Gates D/E/F + real-host R1/R2).

Verification: `build` + `check:artifacts` **OK 1188 zero drift**; affected
focused suites green (`template-model-preference` 10/10,
`t2-blueprint-validation` 69/69, `model-inspect-config` 7/7,
`model-activation-step8` 4/4, `model-blueprint-initial-routing` 23/23). No
logic change → no full-suite / smoke re-run required.

## Verification

```
cd .worktrees/model-preference-routing
pnpm typecheck                                                    # exit 0 (8 pkgs)
pnpm build && pnpm build:composition && pnpm check:artifacts      # OK 1188 zero drift
npx vitest run packages/runtime/test/template-model-preference.test.ts   # 10/10 (P2-1)
npx vitest run packages/runtime/test/model-inspect-config.test.ts        # 7/7  (P2-4)
npx vitest run packages/domain/test/t2-blueprint-validation.test.ts      # 69/69 (P2-2)
npx vitest run packages/runtime/test/model-blueprint-initial-routing.test.ts  # 23/23
```
