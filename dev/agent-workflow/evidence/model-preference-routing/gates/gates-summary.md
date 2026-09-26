# model-preference-routing — Gate A–G focused evidence (2026-09-26)

Focused test runs (all green on the task branch, pre-full-suite). Full-suite
failure-set comparison (post − baseline = ∅) is in `../full-suite/post-full.log`
(round 1) and `../full-suite/post-supplement-full.log` (review-supplement round,
`20F|3908P(3928)`, post − baseline = ∅ via per-test `comm`) vs
`../baseline/master-baseline-4fb79fc.log`.

The **PR #30 review-supplement round** (2026-09-26, P2-1..P2-5 hardening) updated
several gates — see the per-gate notes below and the supplement section at the
bottom of this file.

| Gate | Criterion | Suite | Tests | Result |
|---|---|---|---|---|
| A validation | token grammar: qualified / model-only / malformed (empty, ws, control, `/model`, `provider/`) + `invalid-model-preference` + hash exclusion; **supplement P2-2: single domain parser lock — U+1680 OGHAM SPACE MARK + C0 control-char rejection now via the shared `parseModelPreferenceToken` (one grammar, one site)** | `t2-blueprint-validation` | 69 | PASS |
| A hash | modelPreference contributes to the hash; malformed excluded | `t2-blueprint-hash` | (pre-existing 1 F0 = capabilities:null projection debt, not this round) | PASS (new cases) |
| B helper | `initialTemplateModelGrantOf`: qualified unchanged / model-only inherits staticModel.provider / absent → `undefined` / **supplement P2-1: malformed → `throw InvalidTemplateModelPreferenceError` (fail-loud, code + `{templateId, token}`; the pre-supplement `return undefined` for malformed was the silent-staticModel-fallback defect) — never disguised as absent** | `template-model-preference` | 10 | PASS |
| C consumption | resolver `template` layer carries `templateValues.model` (provenance template/static, recordId null); below record-backed overlays, above unspecified default; external hard facts win | `p8s4b-model-consumption` | 17 | PASS |
| D step-8 | **supplement P2-4 naming closure → "Gate D — activation step-8 composition contract (the template/static model grant)"**: the unit leg locks the composition glue (grants carry the template model grant; generic templateValues omitted when empty) and no longer claims to observe the provider's internal frozen policy — the PROVIDER WIRING's final behavior is closed by Gate E + real-host R1/R2 | `model-activation-step8` | 4 | PASS |
| E live glue | E1–E9: one `locateTemplate` drives model+mcp; fresh-create `templateIdHint` honored for the member's FIRST request; **supplement P2-4: E3 renamed → "delegation fresh-create boundary: the member's FIRST assembly already uses the template model"** (the unit leg locks the glue fresh-create boundary; the full direct `team_delegate` chain is proven by real-host R2 — no re-built tool-level unit harness); E6 durable override beats template; E7 cold-resume re-derivation; E8 cross-root isolation; E9 no-preference control | `model-blueprint-initial-routing` | 23 | PASS |
| F read-side | F1 template layer wins (value openai/gpt-6-astra, source member-template, state inherited); F2 modelState.current = template model + provenance {layer template, origin static, recordId null} + available; F3 human override → pending-next-boundary (both horizons); F4 one row 3 roots (anchor no-pref→baseline, root X→prov-x/model-x, root Y→prov-y/model-y; no anchor-closure / cross-leak) | `p8s7r2-effective-config` (22, +3) / `p8s7r2-model-state` (18, +2) | 40 | PASS |
| F-inspect effective policy | **supplement P2-4 §4 (NEW) — the shipped `team_inspect_config` action path (I1–I4, `effect.effective['model']`)**: I1 qualified → `{kind:'allow', items:['openai/gpt-6-astra']}` (template-static, NOT the baseline, NOT deny); I2 bare `qwen3.8-27b` + `qiyuan-self` baseline → `qiyuan-self/qwen3.8-27b` (inherits baseline provider); I3 no preference → `{kind:'deny'}` (layer `unspecified`; `staticModel` is the CONSUMER fallback per E9, not a policy value); I4 planted human override `openai/gpt-6-pro` (recordId `ovr-mpic-model`, team scope) → `{kind:'allow', items:['openai/gpt-6-pro']}` (record layer beats template) | `model-inspect-config` | 7 | PASS |
| G legacy | writer `deepseek/deepseek-writer` + extras.writer.provider absent; leader `deepseek-chat` bare; G1 model-only→`foo`; G2 provider-only→no modelPreference + extras.provider | `p7t6-teammates-adapter` | 22 | PASS |

Static gates (round 1):
- typecheck: 8 packages green (legacy noCheck by design).
- build: `pnpm build` (9 pkgs) + `build:composition` + `check:artifacts` **OK 1180, zero drift** (after `git add packages/`).
- p4t6 SessionEvent denylist scan pin **748 → 753** (+5 new scannable files: route.ts, template-model.ts, template-model-preference.test.ts, model-activation-step8.test.ts, model-blueprint-initial-routing.test.ts), zero denylist vocabulary — 10/10.

Pre-existing Linux failure fixed in this round: `p7t6-teammates-adapter` source-scan
`split('\\')` → cross-platform `split(/[\\/]/)`.

Real-host 0.1.7-rc.1 smoke kit (merge gate, guide §7 R1–R8): see `../real-host/`
(kit + per-run evidence) — the ACTUAL provider request `body.model` is asserted,
not just the projection.

---

## PR #30 review-supplement round (2026-09-26, P2-1..P2-5 hardening)

Review baseline = PR #30 head `6b9ff59e952de34a0a9bd6668d705d537cd280c3`. Core
invariant (guide §14): present+valid → template/static value; absent →
unspecified→staticModel; **present+invalid → fail loud, NEVER disguised as
absent**. All five items delivered + green; scope did not expand beyond the five.

| Item | Fix | Evidence |
|---|---|---|
| **P2-1** malformed fail-loud | `initialTemplateModelGrantOf` throws typed `InvalidTemplateModelPreferenceError` (code `INVALID_TEMPLATE_MODEL_PREFERENCE`, `{templateId, token}`) when the token is PRESENT but malformed; absent still → `undefined`. Propagates raw at all 4 boundary call sites (incl. the INSPECT_CONFIG effect, outside the try). | `template-model-preference` B5/B5b/B5c + **S2 integration** (no fallback; error text does not contain the baseline route) — 10/10 |
| **P2-2** single shared parser | ONE pure parser in `packages/domain/blueprint/src/model-preference.ts` (`parseModelPreferenceToken`; `\s` + C0/DEL control set + first-`/` split); the runtime `route.ts` mirror is **deleted** (`parseModelItem` = durable-item semantics stays). U+1680 (OGHAM) rejected via `\s` — it was NOT in the old hand-table, locking "one parser". | `t2-blueprint-validation` 69/69 (U+1680 + control-char cases) + S1 parser suite |
| **P2-3** `staticModel` required | `TeamRuntimeOptions.staticModel` (and `EffectContext.staticModel`) now **required**; `createTeamRuntime` passes it unconditionally; 23 `createTeamRuntime` call sites across 14 test files use the unified `TEST_STATIC_MODEL = {provider:'test-static', model:'test-default'}`; ~28 pre-existing custom-baseline files left byte-for-byte. | full typecheck 8 pkgs exit 0; full suite post − baseline = ∅ |
| **P2-4** inspect-config I1–I4 + Gate D/E naming | NEW `model-inspect-config` (7/7) drives the **shipped** `team_inspect_config` action (I1 qualified→template-static / I2 bare→inherit baseline provider / I3 no-pref→`{kind:'deny'}` unspecified / I4 human override→wins). Gate D renamed to "activation step-8 **composition contract**" (no longer claims to observe the provider's internal frozen policy). Gate E E3 renamed to "delegation **fresh-create boundary**" (unit leg locks the glue; real-host R2 proves the full chain). | `model-inspect-config` 7/7; `model-activation-step8` 4/4; `model-blueprint-initial-routing` 23/23 |
| **P2-5** smoke-kit evidence self-consistency | H2 PASS detail now `port ${PORT} free` (was the contradictory `still bound` on PASS; mock 3496 same). R6 check label aligned with the real comparison (projection = full `provider/model` route; wire `body.model` = model id; compares `route.model == body.model`) — comparison LOGIC unchanged. | real-host run `mpr-2026-09-26T04-36-32` (exit 0, fatal=null): H2 = "port 3181 free" / "port 3496 free"; R6 label consistent |

Supplement static gates (all green):
- `pnpm typecheck` — 8 packages, exit 0 (after the branded `InstanceId`/`TemplateId`/`ChildSessionId` fix for the `seedMembers` in the new inspect-config test).
- `pnpm build` + `build:composition` + `check:artifacts` **OK 1188, zero drift** (after `git add packages/`).
- p4t6 SessionEvent denylist scan pin **753 → 756** (+3 new scannable files: `domain/blueprint/src/model-preference.ts` + `runtime/agent-setup/model/errors.ts` + `runtime/test/model-inspect-config.test.ts`) — 10/10.

S7 full suite (review-supplement): **`20F | 3908P (3928)`**; per-test `comm` diff vs
`../baseline/master-baseline-4fb79fc.log` = **post − baseline ∅** (no new failures;
the only baseline entry no longer present is `p7t6-teammates-adapter`, fixed in
round 1; `p6t1-parallel` load flake is present in BOTH runs = same set). Log:
`../full-suite/post-supplement-full.log`.

S6 MCP suites (all green in the full run): `mcp-blueprint-initial-grant` 32 /
`multi-mcp-wiring` 47 / `p8s4b-mcp-facet` 25.
