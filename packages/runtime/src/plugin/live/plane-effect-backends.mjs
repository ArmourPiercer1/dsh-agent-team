/**
 * plane-effect-backends.mjs — GLUE-7: the PRODUCTION backend assembly for the
 * governed Team TOOL PLANE. This file is GLUE, nothing else: every backend
 * here rides an execution implementation this repository already ships and
 * has already proven live. No new executor architecture exists in this file —
 * it is the wiring the int-a5b README correction named as the delivery gap
 * (the production mount row never passed `backends`, so every live
 * read/search/shell dispatch landed on the typed shut face).
 *
 * THE INVENTORY (each backend -> the existing implementation it rides):
 *
 *  - `createConfinedShellBackend` (shell class) — SINCE U6 PR3 THIS CODE
 *    LIVES IN THE PROCESS-FAMILY LANE:
 *    `packages/tools/process-family/src/confined-shell-executor.mjs` (owner
 *    role: that lane's README; CI-07 names the reviewed provider it drives).
 *    This file IMPORTS and re-exports it unchanged — the mechanics it rides
 *    are untouched (and the provider MOUNT itself is booked THERE, in the
 *    `a5p4-lane-hygiene` named-mount ledger — this center file has not
 *    referenced the provider lane since U6 PR5 moved the search rows): the
 *    confined Process provider's P-LSP `spawnStreaming` ladder, the Landlock
 *    pre-launcher (`launcher/landlock-prelauncher.py`), the launcher
 *    byte-pin DOUBLE gate (pb-CONTRACT §1 `ProviderAssemblyConfig`), and the
 *    frozen lease/terminate law. The argv array is explicit (never a shell
 *    string on the provider's own face), the network dimension makes NO
 *    claim (the lane refuses a `deny` profile — PoC-4b honesty).
 *
 *  - `createAnchoredSearchBackend` (search, read-only) and the ARCHIVED
 *    `createAnchoredGlobBackend` CANDIDATE-A — SINCE U6 PR5 THIS CODE LIVES
 *    IN THE SEARCH-FAMILY LANE:
 *    `packages/tools/search-family/src/search-mechanics.mjs` (owner role:
 *    that lane's README). This file IMPORTS and re-exports them unchanged —
 *    the row law is untouched: TWO bodies picked by what the mount holds
 *    (with a confined provider the `./search-backend.mjs` delegate — the
 *    PR5 fixed-ripgrep row; without one the W5 grep(1) port, the RED
 *    control the parity suite pins R1–R5), both anchoring on the P-C
 *    controlled-fs INSTANCE root under the lane's own `isBeneath` law. The
 *    CANDIDATE-A glob row stays ARCHIVED (ships NOTHING; moved with its
 *    disclosures, never deleted, never re-wired — the PR5 row is the
 *    glob lane's production backend, `search-family/src/glob-backend.mjs`).
 *
 *  - `createGovernedReadExecutor` (fs class, the placed governed `read`)
 *    rides the SAME controlled-fs instance root: real bytes, anchored reads,
 *    deny-lane re-check BEFORE any read (the G1 law), template-default-deny
 *    honored (an effect the policy never names never runs), escapes refused.
 *
 * Fail-closed law (unchanged): a missing configuration never widens —
 * no `fsInstance` = no search/read row (the shut landing stays), no
 * `confinedProvider` = no shell row, an unavailable provider refuses typed,
 * `background: true` is refused BY NAME (never reinterpreted), and every
 * refusal is the closed `BackendFailure` triad (denied / hidden /
 * undetermined) — the plane pipeline renders them, this file never throws.
 *
 * @module packages/runtime/src/plugin/live/plane-effect-backends
 */

// U6 PR2 (U6 slice plan, PR2 of 6): the governed `read` row's mechanics,
// window/presentation law, effect executor and row DEFINITION moved VERBATIM
// to the FS family lane (`packages/tools/fs-family/`, owner role: see that
// lane's README). This center file keeps the OLD export surface as a
// re-export so every pinned consumer — the shipped read suites, the adjacent
// .d.mts typings, team-tool-plane — resolves UNCHANGED; the family lane is
// now the single home of the read-slice logic. (U6 PR5: `resolveAnchored`'s
// center-internal consumers — the search/glob rows' anchor law — moved with
// the search slice into the search-family lane, which rides the fs-family
// PUBLIC face for it; what remains here is the pure re-export surface the
// pinned consumers resolve against.)
import {
  createGovernedReadExecutor,
  lexicalAnchor,
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
} from '../../../../tools/fs-family/src/index.mjs'
export {
  createGovernedReadExecutor,
  lexicalAnchor,
  MAX_READ_BYTES,
  READ_ROW_CHUNK_BYTES,
  READ_ROW_LINE_CAP,
  READ_ROW_MAX_LINE_LENGTH,
  READ_ROW_MAX_OUTPUT_BYTES,
  resolveAnchored,
  resolveAnchoredPath,
}

// ── U6 PR5 (U6 slice plan, PR5 of 6): the governed search/glob rows'
// mechanics — the ONE grepArgv builder, the fd-view/sink helpers, the
// TWO-body `createAnchoredSearchBackend`, the ARCHIVED CANDIDATE-A
// `createAnchoredGlobBackend`, the fixed-rg search row, the production
// confined-rg glob row, and their shared cancel leg — moved VERBATIM to the
// SEARCH family lane (`packages/tools/search-family/`, owner role: see that
// lane's README). This center file keeps the OLD export surface as a
// re-export so every pinned consumer — the shipped search/glob/cancel
// suites, the adjacent .d.mts typings, team-tool-plane — resolves UNCHANGED
// (the PR2 read / PR3 shell precedents); the family lane is now the single
// home of the search-slice logic. `createAnchoredGlobBackend` here is the
// ARCHIVED candidate the glue7 suite pins (ships NOTHING); the PRODUCTION
// glob row's factory re-exports below under its lane truth.
import {
  grepArgv,
  createAnchoredSearchBackend,
  createAnchoredGlobBackend,
} from '../../../../tools/search-family/src/search-mechanics.mjs'
export {
  grepArgv,
  createAnchoredSearchBackend,
  createAnchoredGlobBackend,
}
export { createAnchoredRgSearchBackend } from '../../../../tools/search-family/src/search-backend.mjs'
export {
  GLOB_BACKEND_ID,
  GLOB_WALK_TIMEOUT_MS,
  GLOB_MAX_RESULTS_CEILING,
  GLOB_MAX_WALK_BYTES,
  GLOB_STDERR_DRAIN_MS,
  GLOB_MAX_STDERR_BYTES,
  GLOB_REFUSAL_TEXT,
  GLOB_REFUSAL_FAMILIES,
  GLOB_PLACEMENTS,
  globIsBeneath,
  openAnchoredWalkRoot,
  verifyGlobResultsBeneath,
  globArgv,
  GLOB_OUTPUT_PROTOCOL_ARGV,
  parseWalkOutput,
  createAnchoredGlobBackend as createProductionGlobBackend,
} from '../../../../tools/search-family/src/glob-backend.mjs'
export {
  CANCEL_CODE_ABORTED,
  CANCEL_CODE_UNCONFIRMED,
  callAborted,
  createOwnedStop,
  raceConfinedSettle,
} from '../../../../tools/search-family/src/cancel-leg.mjs'

// ── U6 PR3: the shell-class mechanics + the confined shell EXECUTOR moved
// VERBATIM to the process family lane (`packages/tools/process-family/`,
// owner role: see that lane's README). This center file keeps the OLD export
// surface as a re-export so every pinned consumer — a5b2-exit-code-fidelity,
// a5b3-cancel-leg, alpha5-glue7-plane-backends, team-tool-plane — resolves
// UNCHANGED (the PR2 fs-family precedent); the family lane is now the single
// home of the shell-slice logic. (U6 PR5: SYSTEM_RX's one center consumer
// was the archived glob row's provider grant builder — it moved with the
// row; the symbol never had a center export to keep.)
import {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  createConfinedShellBackend,
} from '../../../../tools/process-family/src/index.mjs'
export {
  raceShellSettle,
  shellCancelled,
  SHELL_STREAM_DRAIN_MS,
  drainShellStdio,
  createConfinedShellBackend,
}


// ── U6 PR4 (ARC-C): the governed jobs bridge moved VERBATIM to its own
// named-bridge module (`jobs-family-bridge.mjs`, the ONE home of the trio:
// bridge body + row definitions + closed-schema contribution). This center
// file keeps the OLD export surface as a re-export (the PR2/PR3 precedent:
// a5p7-jobs-assembly-actuator resolves UNCHANGED); the bridge body's
// byte-identity through the move is sha-pinned by u6-pr4-jobs-bridge.test
// (body sha256 71705d6eb1aaa9d0ae3fd22541f788a5dfb8dd07e6f96827db49e40283a9b29f
// at BOTH the old and the new home). jobs-gateway-assembly.mjs (the
// attribution ledger) is untouched by the move.
export {
  createGovernedJobsBridge,
  buildJobsManagementRowDefs,
  buildJobsBridgeContribution,
  JOBS_MANAGEMENT_NAMES,
  JOBS_BRIDGE_ID,
} from './jobs-family-bridge.mjs'
