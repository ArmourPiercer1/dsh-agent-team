/**
 * P3-T5 canonical-chain bridge.
 *
 * The compatibility engine test suites live in the task-owned path
 * `packages/domain/compatibility/test/` (TaskDoc 11.4 P3-T5 owned path:
 * `packages/domain/compatibility/**`), but scripts/run-tests.mjs discovers
 * test files flat at `packages/<pkg>/test/*.test.ts` only. This file
 * re-executes the seven suites so the canonical chain (`node
 * scripts/run-tests.mjs domain`) runs them.
 *
 * The specifiers are computed at runtime on purpose: the frozen package
 * typecheck (`tsc -p packages/domain/tsconfig.json`, `rootDir: "packages/domain"`)
 * must not pull the contracts sources — reached through the compatibility
 * engine's frozen contracts-v1 imports — into the domain program, where
 * they would fail with TS6059 ("file not under rootDir"). Full static type
 * coverage of the suites lives in `tsc -p packages/domain/compatibility/
 * tsconfig.json` (no rootDir), which typechecks `compatibility/{src,fixtures,
 * test}` against the same root tsconfig.base.json compiler options.
 *
 * The plain-node shim (scripts/test-vitest-shim.mjs) runs `it` bodies
 * synchronously and rejects async test bodies, so the suites are imported
 * at module top level (top-level await) instead of inside an `it` callback.
 */

const suiteFiles = [
  't5-requirement-validation.test.ts',
  't5-environment-facts.test.ts',
  't5-engine-outcomes.test.ts',
  't5-warning-ack.test.ts',
  't5-drift-invalidation.test.ts',
  't5-complete-true.test.ts',
  't5-purity-serialization.test.ts',
]

for (const name of suiteFiles) {
  const specifier = `../compatibility/test/${name}`
  await import(specifier)
}
