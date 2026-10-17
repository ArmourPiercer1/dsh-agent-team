/**
 * web-projection.ts — the Web-resource half of Lane F: turn the gateway's
 * job records into what a Web viewer may see, under two hard rules.
 *
 *  1. OWNER SCOPING. A job projects only to its owning member scope
 *     (JobOwner identity = member scope, C-GW). A viewer addressed by any
 *     other member identity gets a typed `owner-mismatch` refusal, not a
 *     "not found" that leaks existence-by-absence across sessions: the
 *     refusal names the mismatch class but never the owner's identity.
 *  2. TOKENS REDACT AT COLLECTION. Any value that reached the gateway under
 *     a credential-shaped key (`*token*`, `*secret*`, `authorization`,
 *     `cookie`, `password`) is replaced by the redaction marker on the way
 *     IN (see jobs-gateway `observeDispatchEvent`), so the projection has
 *     nothing sensitive to forget on the way OUT. This module therefore also
 *     re-applies the same sweep defensively — projection is not the last
 *     line of defence; it is the second one.
 *
 * @module runtime/jobs-gateway/web-projection
 */
import { gatewayRefusal, jobOwnerKey } from './types.js';
export const REDACTION_MARKER = '[REDACTED]';
const CREDENTIAL_KEY = /(token|secret|authorization|cookie|password|apikey|api_key)/i;
/** Deep redaction sweep: credential-shaped KEYS have their values replaced. */
export function redactCredentials(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => redactCredentials(entry));
    }
    if (value !== null && typeof value === 'object') {
        const out = {};
        for (const [key, entry] of Object.entries(value)) {
            out[key] = CREDENTIAL_KEY.test(key) ? REDACTION_MARKER : redactCredentials(entry);
        }
        return out;
    }
    return value;
}
/**
 * Project one job for one viewer member scope. The viewer is identified by
 * the same canonical member key as the owner; different keys never see the
 * record, and the refusal never carries the owner key itself.
 */
export function projectJobForViewer(viewerOwner, job) {
    if (jobOwnerKey(viewerOwner) !== job.ownerKey) {
        return gatewayRefusal('owner-mismatch', 'this viewer is not the owning member scope of the job');
    }
    const view = redactCredentials({
        jobId: job.jobId,
        ownerKey: job.ownerKey,
        toolName: job.toolName,
        state: job.state,
        outcome: job.outcome,
        pinnedIdentity: job.pinnedIdentity,
    });
    return { ok: true, view };
}
//# sourceMappingURL=web-projection.js.map