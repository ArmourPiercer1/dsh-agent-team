/**
 * TCM M4 (plan §7 / §15.6) — the two-stage v2 Team creation flow (PURE):
 *
 * ```text
 * stage 1: team.create v2 (workspace-aware, CREATE-ONLY — NO initialWork)
 * stage 2: open the real Root (the host-created session)
 * stage 3: team.admitInitialWork v2 (the deferred creation-time initial
 *          work — only when the attempt's prompt is non-empty)
 * ```
 *
 * The order is the frozen §1.1 order: create TeamSession → open Root →
 * admit initial work → Root first turn. The React panel
 * (TeamCreationPanel) is the sole caller: it freezes ONE
 * {@link TeamCreateAttempt} snapshot from the draft
 * (`planTeamCreateAttempt`) and drives this function; a stage-3 failure
 * resumes ONLY the admit stage (the real Root stays open; the SAME stable
 * token + prompt replay — never a fresh token, never an ordinary
 * `sessions.create`, never a New Session).
 *
 * Failure discipline (frozen `TeamRemoteClient` contract, mirrored here):
 * every RPC-level outcome arrives as a typed `RemoteResponse` (the
 * closed `code` / `message` preserved verbatim); the faces REJECT only
 * on transport-level loss or a failed creation-path open, which the flow
 * maps onto the panel's local `native-error` marker code — the ONLY
 * rejection kind.
 *
 * Pure module: no React, no I/O, no transport — the three faces are
 * injected (the panel binds them to the frozen Remote wrappers). Erasable
 * TS only.
 * @module @dsh-agent-team/client/model/team-create-flow
 */

import type {
  RemoteResponse,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamCreateParamsV2,
} from '../../../remote/src/index.js'
import type { TeamCreateAttempt } from './team-intent-model.js'

/** The three faces the flow drives (all frozen-seam wrappers, verbatim). */
export interface TeamCreateFlowFaces {
  /** `team.create` (contract v2) — the workspace-aware CREATE-ONLY variant. */
  readonly createV2: (params: RemoteTeamCreateParamsV2) => Promise<RemoteResponse>
  /** The creation-path session open (the host-created root; rejects when unknown after the re-pull). */
  readonly openCreatedSession: (sessionId: string) => Promise<void>
  /** `team.admitInitialWork` (contract v2, v2-only method). */
  readonly admitInitialWorkV2: (params: RemoteTeamAdmitInitialWorkParams) => Promise<RemoteResponse>
}

/**
 * The flow stage a failure belongs to. The panel renders the lane from it
 * and chooses the retry resume: `create` / `open` failures re-run the flow
 * from stage 1 on the SAME retained root (cold-root recovery); a `work`
 * failure re-sends ONLY stage 3 (the real Root is already open).
 */
export type TeamCreateFlowStage = 'create' | 'open' | 'work'

/**
 * The flow outcome: the terminal success (root created + open AND, when
 * the attempt carried initial work, the work admitted), or the typed
 * failure with its stage.
 */
export type TeamCreateFlowOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly stage: TeamCreateFlowStage
      readonly code: string
      readonly message: string
    }

/** The local marker code for a face rejection (channel loss / failed open). */
const LOCAL_ERROR_CODE = 'native-error'

/** A thrown face error rendered to a string (verbatim). */
function throwableMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Run the two-stage v2 creation flow for one frozen attempt.
 * @param faces - the injected faces (bound to the frozen Remote wrappers
 *   by the panel; the v2 wrappers stamp contract version 2, the rest of
 *   the client stays on v1 — TCM vNext §15.3).
 * @param attempt - the frozen attempt snapshot (plan §7.7: the parameters
 *   of a started create are immutable for the attempt's lifetime).
 * @param resumeAt - `'work'` when the previous attempt failed at stage 3
 *   (the real Root already exists and is open: ONLY the admit is
 *   re-sent, with the SAME token + prompt). `undefined` = the full
 *   create → open → (work) sequence.
 * @returns the terminal outcome (never throws).
 */
export async function runTeamCreateFlow(
  faces: TeamCreateFlowFaces,
  attempt: TeamCreateAttempt,
  resumeAt: 'work' | undefined = undefined,
): Promise<TeamCreateFlowOutcome> {
  if (resumeAt === undefined) {
    // STAGE 1 — the v2 workspace-aware create. CREATE-ONLY: the closed v2
    // field set carries `workspace?` and NO `initialWork` (the creation-
    // time initial work travels stage 3, after the root is open).
    const createParams: RemoteTeamCreateParamsV2 = {
      rootSessionId: attempt.rootSessionId,
      blueprintId: attempt.blueprintId,
      ...(attempt.blueprintRevision !== undefined
        ? { blueprintRevision: attempt.blueprintRevision }
        : {}),
      ...(attempt.workspacePath !== undefined
        ? { workspace: attempt.workspacePath }
        : {}),
    }
    let createResponse: RemoteResponse
    try {
      createResponse = await faces.createV2(createParams)
    } catch (error) {
      return { ok: false, stage: 'create', code: LOCAL_ERROR_CODE, message: throwableMessage(error) }
    }
    if (!createResponse.ok) {
      return {
        ok: false,
        stage: 'create',
        code: createResponse.error.code,
        message: createResponse.error.message,
      }
    }
    // STAGE 2 — open the real Root (the frozen §1.1 order: open BEFORE
    // work). The host created the session under the minted id during
    // stage 1; the face re-pulls the host list once when the stream
    // increment lags the RPC.
    try {
      await faces.openCreatedSession(attempt.rootSessionId)
    } catch (error) {
      return { ok: false, stage: 'open', code: LOCAL_ERROR_CODE, message: throwableMessage(error) }
    }
    // Empty initial work: the flow is terminal after create + open
    // (plan §15.6: 无 initial work时只执行 create[+open]).
    if (attempt.prompt === '') return { ok: true }
  } else if (attempt.prompt === '') {
    // Defensive total: a `work` resume carries nothing to admit (the panel
    // can only resume from a stage-`work` failure, which requires a
    // non-empty prompt) — a trivial success, never an empty-prompt RPC.
    return { ok: true }
  }
  // STAGE 3 — the deferred creation-time initial work (the v2-only command
  // through the Team compatibility/admission authority). The stable
  // `(rootSessionId, requestToken)` idempotency identity is the draft's:
  // a same-token same-payload replay is a zero-delivery terminal replay;
  // a same-token different-payload mismatch is a typed failure the host
  // refuses.
  const workParams: RemoteTeamAdmitInitialWorkParams = {
    rootSessionId: attempt.rootSessionId,
    requestToken: attempt.requestToken,
    prompt: attempt.prompt,
  }
  let workResponse: RemoteResponse
  try {
    workResponse = await faces.admitInitialWorkV2(workParams)
  } catch (error) {
    return { ok: false, stage: 'work', code: LOCAL_ERROR_CODE, message: throwableMessage(error) }
  }
  if (!workResponse.ok) {
    return {
      ok: false,
      stage: 'work',
      code: workResponse.error.code,
      message: workResponse.error.message,
    }
  }
  return { ok: true }
}
