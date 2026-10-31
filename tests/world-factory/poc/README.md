# tests/world-factory/poc — PoC prototype experiments (NOT production acceptance)

Files here are proof-of-concept measurements dispatched as task lanes
(banner `PoC ONLY` in every file header). They are excluded from production
acceptance criteria, CI collection (vitest config collects `packages/*/test/**`
only), and gate ledgers. Reproduce individually with `node --test`.

| file | lane | what it measures |
| --- | --- | --- |
| `host-present-harness.mjs` + `poc-native-present.test.mjs` | a5w-pvpoc-20261031 | Native `present` retention route (P-P1/P-P2/P-P4): real ToolRuntime in-process over the pinned built host lib, zero boot, zero port. Evidence: `dev/agent-workflow/evidence/a5w-native-reuse-20261031/PRESENT-NATIVE-POC.md` |
