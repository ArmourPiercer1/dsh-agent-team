/**
 * paths.mjs — the lane's one repo-root computation and its pinned identity.
 *
 * The host pins come from `tests/paths.mjs` (the single source of truth); this
 * file never restates a generation or a SHA.
 *
 * @module tests/ute-g1-agentctl/lib/paths
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** This lane's repository root (tests/ute-g1-agentctl/lib -> repo root). */
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The lane's directory, for evidence/golden joins. */
export const LANE_ROOT = join(REPO_ROOT, 'tests', 'ute-g1-agentctl')

/** The evidence directory this lane writes. */
export const EVIDENCE_ROOT = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'ute3-agentctl-b1-20261121')
