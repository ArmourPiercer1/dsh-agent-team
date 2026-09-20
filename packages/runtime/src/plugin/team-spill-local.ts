/**
 * Strict-read + Core-spill — the Team-aware local spill provider
 * (Phase C, ADR-strict-read-core-spill §5).
 *
 * `TeamAwareLocalSpillStore` extends the upstream `LocalSpillStore` and
 * adds exactly ONE behavior: after a spill is saved durably (through
 * `super.saveText` — the ONLY storage path; the private file layout, the
 * 0600/0700 discipline, and the cleanup sweep are never re-implemented),
 * it records a durable artifact-read grant for the producing Team
 * instance through the root's {@link TeamArtifactAuthority} — reached
 * via the row-scope `teamArtifactAuthority` bridge service the host row
 * provides (./artifact-grant-bridge.ts), read LAZILY per `saveText`
 * (the bootstrap fills the bridge; a bridge without an authority is the
 * unmanaged path, never an error).
 *
 * This is the producer side of the content-read vertical: the bundle
 * layer (the repo-root `cordis.patch.yml`) disables the base
 * `spill-local` row and inserts this row in its place, so the
 * Team-aware store is the profile's single spill-store write path and
 * every spill-store artifact of a managed Team session gets a grant
 * record — with the file already durable and its fs identity resolved
 * fresh (durable-first issuance, guide §3).
 *
 * Failure semantics (ADR §5): for a session MANAGED by a Team, ANY
 * grant-record failure (fs seam absent, the durable put rejected, an
 * ineligible instance lifecycle) REJECTS `saveText` — the upstream spill
 * consumers (spill-policy / fs-search / session-reference) are all
 * best-effort and degrade to their inline result, and the artifact file
 * (when written) is reclaimed by the upstream cleanup sweep. An
 * artifact is never presented as grant-backed unless its grant fact is
 * durable. For an UNMANAGED session (no durable Team binding) the
 * authority reports `unmanaged-session` and the store behaves
 * byte-for-byte as the upstream one (no grant, no record I/O beyond the
 * single identity lookup).
 *
 * The row keeps the base row's config surface (the inherited `Config`
 * static — `root` / `cleanupPeriodDays`) and registers the same
 * `spillStore` service (the inherited `Service` base): the upstream
 * consumers see no difference beyond the grant recording. The default
 * export is the class (the Cordis loader unwraps a class plugin's
 * default export); the named export exists for tests and composition
 * tooling.
 *
 * @module @dsh-agent-team/runtime/plugin/team-spill-local
 */
import type { Context } from '@deepseek-ai/cordis'
import { LocalSpillStore } from '@deepseek-ai/dsh-spill-local'
import type { Config } from '@deepseek-ai/dsh-spill-local'
import type { SaveTextSpill, SpillRef } from '@deepseek-ai/dsh-spill'
import type { SpillStoreSource } from '../../artifact-read/index.js'
import {
  TEAM_ARTIFACT_AUTHORITY_SERVICE,
  type TeamArtifactAuthorityBridge,
} from './artifact-grant-bridge.js'

/**
 * Map the DSH `SaveTextSpill.source` (a closed two-arm union) onto the
 * seam-free `SpillStoreSource` mirror, verbatim (the branded string
 * fields are plain strings underneath — no conversion, no parsing).
 *
 * @param source - the DSH spill source of the save.
 * @returns the mirrored structured source.
 * @throws when the source carries a kind outside the closed union
 *   (defensive — the DSH type is closed; a foreign value must never
 *   reach the durable fact unexamined).
 */
function toSpillStoreSource(source: SaveTextSpill['source']): SpillStoreSource {
  switch (source.kind) {
    case 'tool':
      return {
        kind: 'tool',
        toolName: source.toolName,
        callId: source.callId,
        label: source.label,
      }
    case 'session-reference':
      return {
        kind: 'session-reference',
        sessionId: source.sessionId,
        label: source.label,
      }
    default: {
      const kind: never = source
      throw new Error(
        `team-spill-local: unhandled spill source ${JSON.stringify(kind)} — the upstream source union has drifted`,
      )
    }
  }
}

/**
 * The Team-aware local spill store (module docs for the full contract).
 */
export class TeamAwareLocalSpillStore extends LocalSpillStore {
  /**
   * Pass-through constructor (the base row's config surface is kept
   * exactly — the loader applies the inherited `Config` schema).
   *
   * @param ctx - the row's Cordis context.
   * @param config - the resolved row config (`root` / `cleanupPeriodDays`).
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, config)
  }

  /**
   * Save the spill durably (the upstream storage path), then record the
   * durable artifact-read grant of a managed Team session (module docs
   * for the failure semantics: a managed-session record failure rejects;
   * an unmanaged session is upstream-equivalent).
   *
   * @param input - the spill to save (owner session, source, suggested
   *   name, content).
   * @returns the upstream `SpillRef` (locator, bytes, retrieval hint).
   */
  override async saveText(input: SaveTextSpill): Promise<SpillRef> {
    const ref = await super.saveText(input)
    const bridge = this.ctx.reflect.get(
      TEAM_ARTIFACT_AUTHORITY_SERVICE,
    ) as TeamArtifactAuthorityBridge | null | undefined
    if (bridge !== null && bridge !== undefined && bridge.authority !== undefined) {
      // A managed-session record failure propagates out of saveText
      // (ADR §5): the upstream consumer's best-effort fallback then
      // applies, and the artifact is never presented as grant-backed.
      await bridge.authority.recordSpillStoreArtifact({
        sessionId: input.owner.sessionId,
        source: toSpillStoreSource(input.source),
        locator: ref.locator,
      })
    }
    return ref
  }
}

export default TeamAwareLocalSpillStore
