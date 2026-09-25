/**
 * Ambient declarations for `tests/paths.mjs` (the ESM path single source of
 * truth). Added by the 0.1.7-rc.1 upgrade review-supplement round (PR #29
 * finding F1): the testkit compatibility test is the first TypeScript test
 * to import the module, and the strict tsconfigs reject the untyped `.mjs`
 * import (TS7016). The declarations mirror the runtime module's exports
 * exactly; keep them in sync when paths.mjs changes.
 */
export const TEST_USE_REL: string
export const TEST_HOME_ROOT_REL: string
export const TEST_USE_BASELINE_SHA: string
export const CLIENT_COMMIT_HASH: string
export function findTestRepoRoot(start: string): string | null
export function testUseTree(repoRoot: string): string
export function homeRoot(repoRoot: string): string
export function homeDir(repoRoot: string, name: string): string
