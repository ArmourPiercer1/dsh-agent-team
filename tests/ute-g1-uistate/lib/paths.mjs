/**
 * paths.mjs — the lane's ONE source of repo/host paths and the pinned host
 * identity.
 *
 * `tests/paths.mjs` stays the ONLY source of the host generation and SHA
 * (TEST_METHODS.md §11); this module only re-exports it next to the two trees
 * the baseline is measured against, so no capture module invents a path of its
 * own.
 *
 * @module tests/ute-g1-uistate/lib/paths
 */
import { register } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** This lane's repo root (`tests/ute-g1-uistate/lib` -> repo root). */
export const REPO_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')

/** The pinned, READ-ONLY host checkout. Never written, never tracked. */
export const PRISTINE_ROOT = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')

// The repo's ESM/TS hooks (the same registration every lane run uses).
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const paths = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'paths.mjs')).href)

/** The pinned host generation (from tests/paths.mjs — never hard-coded here). */
export const DSH_BASELINE_VERSION = paths.DSH_BASELINE_VERSION
/** The pinned host commit (the 12-char form tests/paths.mjs exports). */
export const TEST_USE_BASELINE_SHA = paths.TEST_USE_BASELINE_SHA
/** The host tree location relative to the repo root. */
export const TEST_USE_REL = paths.TEST_USE_REL
