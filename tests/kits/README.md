# tests/kits/ — reusable test kits

Placement policy (test-infra-standardization, 2026-09-12):

- **Reusable, line-agnostic kits** (boot/stop/teardown helpers, probe
  drivers, world setup utilities that a NEW task would use unchanged) live
  here, tracked. They import canonical paths from **`tests/paths.mjs`** —
  never hardcode `references/…` or a machine absolute path.
- **Task-specific kits** (the `setup/boot/check` `.mjs` files authored for
  one task's live world) stay with that task's evidence under
  `dev/agent-workflow/evidence/<task>/` — evidence dirs are self-contained
  records and are never pruned. When a task kit proves reusable, promote the
  generalized form here and leave a pointer in the evidence dir.
- The shared primitives already canonical under
  `tests/characterization/lib/` (`instance.mjs`, `util.mjs`,
  `tree-clean.mjs`, …) remain the first place to look before adding a new
  kit.
