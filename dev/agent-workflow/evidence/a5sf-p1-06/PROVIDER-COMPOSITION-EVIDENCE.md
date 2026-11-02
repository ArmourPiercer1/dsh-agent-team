# P1-06 · Provider/Backend exclusive replacement and delivery path — evidence

- **Task**: P1-06 (Gate **G1.6**), branch `task/a5sf-p1-01-20261102`.
- **Lane**: `packages/runtime/team-services/src/manifest.ts` (new).
- **Tests**: `packages/runtime/test/a5sf-provider-composition.test.ts` — **9/9**;
  `tsc -p packages/runtime/tsconfig.json` rc=0 (`green-tests.log`).

## 1. What is proven (dump-config composition algebra, the real algorithm)

`replaceProvider` / `planProviderReplacement` apply the shipped `disable + insert`
patch shape through the REAL `applyEntryPatches` from
`@deepseek-ai/cordis-plugin-include` (the same algorithm `dsh --dump-config` and
the live boot share):

| Law | Test |
|---|---|
| base row disabled in place, exactly ONE active Team row with the declared plugin | `replaces one provider` |
| every declared row (fs/web/process) replaced in one all-or-nothing pass | `plans every declared replacement` |
| missing base row ⇒ `BASE_ROW_MISSING` (never a lone Team provider) | `refuses a missing base row` |
| pre-existing Team row ⇒ `TEAM_ROW_DUPLICATE` (the two-provider boot failure) | `refuses a duplicate Team row` |
| unmatched patch target ⇒ refusal, no silent skip | `refuses an unmatched patch target` |
| the shipped `cordis.patch.yml` contains NONE of the unshipped rows ⇒ normal DSH composition is unchanged | `shipped bundle dormancy` |
| a bundle that smuggles a Team row early ⇒ `TEAM_ROW_SHIPPED_EARLY` | `dormancy guard refuses` |

## 2. What is NOT shipped / not proven here (disclosed)

- The rows are declared `shipped: false`. Landing the real plugin modules and the
  bundle patch is the Native Integrator's separately reviewed change; this lane
  cannot silently alter a normal Host.
- `pnpm smoke:composition`, `pnpm check:install-manifest`, `pnpm check:artifacts`
  and a real `dsh --dump-config` boot were NOT run: `pnpm install`/scripts that
  need the pnpm store are unavailable in this sandbox (`ERR_SQLITE_ERROR`). The
  composition algebra is exercised at the same layer dump-config uses, but a real
  dump/boot comparison remains an acceptance condition for the delivery PR.
- Gate G1.6 is therefore **CONDITIONAL**: algebra PASS, real dump/boot + package
  exports pending the integrator + a pnpm-capable environment.

## 3. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-provider-composition.test.ts
```
