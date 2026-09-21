import { LocalSpillStore } from '@deepseek-ai/dsh-spill-local';
import { TEAM_ARTIFACT_AUTHORITY_SERVICE, } from './artifact-grant-bridge.js';
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
function toSpillStoreSource(source) {
    switch (source.kind) {
        case 'tool':
            return {
                kind: 'tool',
                toolName: source.toolName,
                callId: source.callId,
                label: source.label,
            };
        case 'session-reference':
            return {
                kind: 'session-reference',
                sessionId: source.sessionId,
                label: source.label,
            };
        default: {
            const kind = source;
            throw new Error(`team-spill-local: unhandled spill source ${JSON.stringify(kind)} — the upstream source union has drifted`);
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
    constructor(ctx, config) {
        super(ctx, config);
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
    async saveText(input) {
        const ref = await super.saveText(input);
        const bridge = this.ctx.reflect.get(TEAM_ARTIFACT_AUTHORITY_SERVICE);
        if (bridge !== null && bridge !== undefined && bridge.authority !== undefined) {
            // A managed-session record failure propagates out of saveText
            // (ADR §5): the upstream consumer's best-effort fallback then
            // applies, and the artifact is never presented as grant-backed.
            await bridge.authority.recordSpillStoreArtifact({
                sessionId: input.owner.sessionId,
                source: toSpillStoreSource(input.source),
                locator: ref.locator,
            });
        }
        return ref;
    }
}
export default TeamAwareLocalSpillStore;
//# sourceMappingURL=team-spill-local.js.map