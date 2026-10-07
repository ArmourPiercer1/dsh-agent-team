/**
 * A4-PR6 stage 6.A — the GovernanceWarning service.
 *
 * The durable, team-locked diagnostic lane (spec §15, plan §6.A): it folds
 * the envelope-consistency comparison into `consistent | mismatch |
 * undetermined`, mints fingerprint-bound warnings for the last two, gates
 * the Team start through the ONE frozen `GovernanceStartCheck` port, and
 * records fingerprint-bound acknowledgements that are REMINDER STATE ONLY.
 *
 * What this module never does:
 * - write a `ControlRequest`, an approval case, or any decision value (a
 *   warning is not an approval case — pinned by the 6.A tests);
 * - return `wait-for-response` or any status the Team waits in;
 * - affect the authority evaluator (ack changes reminder state, full stop);
 * - clear `migration-required` for anybody, ever (plan:594).
 *
 * Durability law (A5-6): the lane writes ONLY the two fact types
 * `governance-warning-observed` / `governance-warning-acknowledged` through
 * an injected writer port; the production adapter funnels them through the
 * same durable commit path as every other ledger fact, so the rows appear
 * in the same fold the UI reads. Reads go through an injected reader port.
 * The service holds NO repositories/locks itself — the production caller
 * owns the team lock, exactly like the proposal store's ports.
 *
 * @module @dsh-agent-team/runtime/governance-warning/service
 */
import { createHash } from 'node:crypto';
import { GOVERNANCE_START_CORRUPT_REASONS, GOVERNANCE_WARNING_FACT_TYPES, GOVERNANCE_WARNING_KINDS, GOVERNANCE_WARNING_VERDICTS, } from './types.js';
// ---------------------------------------------------------------------------
// the consistency comparator (pure; exported for the diagnostic stage)
// ---------------------------------------------------------------------------
const EFFECT_RANK = { deny: 0, ask: 1, allow: 2 };
/** Meet over a rule set matching one point: min effect; no rule → no claim. */
function meetAt(rules, operationClass, point, contains) {
    let worst = 'none';
    for (const rule of rules) {
        if (rule.operationClass !== operationClass)
            continue;
        let matches;
        if (rule.matcherKind === 'exact' || rule.matcherKind === 'fingerprint') {
            matches = rule.matcherKey === point;
        }
        else {
            matches = rule.matcherKey === point ? true : contains(rule.matcherKey, point);
        }
        if (matches === undefined)
            return { undetermined: true };
        if (!matches)
            continue;
        if (worst === 'none' || EFFECT_RANK[rule.effect] < EFFECT_RANK[worst])
            worst = rule.effect;
    }
    return { effect: worst };
}
function normalizeView(view) {
    const rules = [...view.rules]
        .map((r) => `${r.operationClass}\u0000${r.effect}\u0000${r.matcherKind}\u0000${r.matcherKey}`)
        .sort();
    return rules.join('\u0001');
}
/**
 * The pure envelope-consistency comparison (spec §15.3). Law: at EVERY
 * witness point (every declared matcher of either document), the leader's
 * broadest claim must not EXCEED the human-user hard envelope's lane at the
 * same point; `absent` hard means no narrowing (the `allow` identity). A
 * single undecidable containment relation absorbs the whole comparison into
 * `undetermined` — it is never reported as `consistent`; a decided mismatch
 * anywhere dominates (`mismatch` is the stronger signal).
 *
 * The CONFIGURATION stage (create/publish diagnostic — no Blueprint editor
 * exists in Alpha.4, so no product surface calls it yet; disclosed) runs
 * this SAME comparator over the declared, un-canonicalised documents with a
 * containment that answers only for provable declaration relations and
 * `undefined` otherwise — a declaration whose relation needs the filesystem
 * reads `undetermined`, never a fabricated `consistent`.
 */
export function compareEnvelopes(leader, hard, contains) {
    const fingerprintMaterial = createHash('sha256')
        .update(`${GOVERNANCE_WARNING_KINDS.ENVELOPE_CONSISTENCY}\u0000${normalizeView(leader)}\u0000${normalizeView(hard)}`)
        .digest('hex');
    let undetermined = false;
    const witnesses = [];
    const points = new Map(); // `${opClass}\u0000${key}` -> `${opClass}|${key}`
    for (const rule of [...leader.rules, ...hard.rules]) {
        points.set(`${rule.operationClass}\u0000${rule.matcherKey}`, `${rule.operationClass}|${rule.matcherKey}`);
    }
    for (const [key, label] of points) {
        const opClass = key.slice(0, key.indexOf('\u0000'));
        const point = key.slice(key.indexOf('\u0000') + 1);
        const leaderAt = meetAt(leader.rules, opClass, point, contains);
        if ('undetermined' in leaderAt) {
            undetermined = true;
            continue;
        }
        if (leaderAt.effect === 'none')
            continue; // no claim → can never exceed
        const hardAt = meetAt(hard.rules, opClass, point, contains);
        if ('undetermined' in hardAt) {
            undetermined = true;
            continue;
        }
        // hard `none` means no narrowing = allow identity.
        const hardRank = hardAt.effect === 'none' ? EFFECT_RANK.allow : EFFECT_RANK[hardAt.effect];
        if (EFFECT_RANK[leaderAt.effect] > hardRank) {
            witnesses.push(`${label}: leader ${leaderAt.effect} > hard ${hardAt.effect === 'none' ? 'allow(identity)' : hardAt.effect}`);
            if (witnesses.length >= 8)
                break; // diagnostic cap, never a decision input
        }
    }
    if (witnesses.length > 0) {
        return { verdict: GOVERNANCE_WARNING_VERDICTS.MISMATCH, fingerprintMaterial, witnesses };
    }
    if (undetermined) {
        return {
            verdict: GOVERNANCE_WARNING_VERDICTS.UNDETERMINED,
            fingerprintMaterial,
            witnesses: ['containment relation undecidable for at least one compared pair'],
        };
    }
    return { verdict: GOVERNANCE_WARNING_VERDICTS.CONSISTENT, fingerprintMaterial, witnesses: [] };
}
// ---------------------------------------------------------------------------
// the service
// ---------------------------------------------------------------------------
/** Stable id derivation: the fingerprint IS the dedup key and the ack key. */
export function warningIdForFingerprint(fingerprint) {
    return `warn-${fingerprint.slice(0, 32)}`;
}
export function interventionIdForWarningId(warningId) {
    return `int-${warningId}`;
}
function str(payload, key) {
    const value = payload[key];
    return typeof value === 'string' ? value : undefined;
}
export function createGovernanceWarningService(deps) {
    const bridge = deps.bridge ?? true;
    /** Fold the durable rows into per-fingerprint warnings (ascending). */
    async function fold(teamSessionId) {
        const rows = await deps.reader.list(teamSessionId, [
            GOVERNANCE_WARNING_FACT_TYPES.OBSERVED,
            GOVERNANCE_WARNING_FACT_TYPES.ACKNOWLEDGED,
        ]);
        const byFingerprint = new Map();
        for (const row of rows) {
            const fingerprint = str(row.payload, 'fingerprint');
            if (fingerprint === undefined)
                continue; // unreadable row: never invents a warning
            if (row.factType === GOVERNANCE_WARNING_FACT_TYPES.OBSERVED) {
                const existing = byFingerprint.get(fingerprint);
                if (existing === undefined) {
                    byFingerprint.set(fingerprint, {
                        fingerprint,
                        kind: str(row.payload, 'kind') ?? GOVERNANCE_WARNING_KINDS.ENVELOPE_CONSISTENCY,
                        verdict: str(row.payload, 'verdict') ?? GOVERNANCE_WARNING_VERDICTS.MISMATCH,
                        firstAt: row.createdAt,
                        lastAt: row.createdAt,
                        count: 1,
                    });
                }
                else {
                    existing.count += 1;
                    if (row.createdAt < existing.firstAt)
                        existing.firstAt = row.createdAt;
                    if (row.createdAt > existing.lastAt)
                        existing.lastAt = row.createdAt;
                }
            }
            else if (row.factType === GOVERNANCE_WARNING_FACT_TYPES.ACKNOWLEDGED) {
                const warning = byFingerprint.get(fingerprint);
                if (warning === undefined)
                    continue; // an ack without a warning observes nothing
                const acknowledgedBy = str(row.payload, 'acknowledgedBy');
                if (acknowledgedBy === undefined)
                    continue;
                // LAST ack wins (a re-ack with a new note is legal and honest).
                warning.acknowledgement = {
                    warningId: warningIdForFingerprint(fingerprint),
                    fingerprint,
                    acknowledgedBy,
                    acknowledgedAt: row.createdAt,
                    ...(str(row.payload, 'note') !== undefined ? { note: str(row.payload, 'note') } : {}),
                };
            }
        }
        return [...byFingerprint.values()].sort((a, b) => (a.firstAt < b.firstAt ? -1 : 1));
    }
    function snapshot(teamSessionId, warning) {
        return {
            warningId: warningIdForFingerprint(warning.fingerprint),
            interventionId: interventionIdForWarningId(warningIdForFingerprint(warning.fingerprint)),
            teamSessionId,
            kind: warning.kind,
            fingerprint: warning.fingerprint,
            verdict: warning.verdict === GOVERNANCE_WARNING_VERDICTS.UNDETERMINED ? 'undetermined' : 'mismatch',
            observationCount: warning.count,
            firstObservedAt: warning.firstAt,
            lastObservedAt: warning.lastAt,
            acknowledged: warning.acknowledgement !== undefined,
            ...(warning.acknowledgement !== undefined
                ? {
                    acknowledgedBy: warning.acknowledgement.acknowledgedBy,
                    acknowledgedAt: warning.acknowledgement.acknowledgedAt,
                    ...(warning.acknowledgement.note !== undefined ? { acknowledgementNote: warning.acknowledgement.note } : {}),
                }
                : {}),
        };
    }
    /**
     * The gate core. Returns the closed outcome; when the verdict mints a
     * warning the observation is appended FIRST (durable before blocked),
     * so the client can always discover the warning through `intervention.list`
     * while the root stays not-live.
     */
    async function runGate(teamSessionId) {
        const docs = await deps.docs.read(teamSessionId);
        if (docs.stage === 'pre-v3') {
            // v1/v2 bound document: bridge keeps today's behaviour through PR6
            // (ZERO warnings minted); PR7 7.2 flips `bridge` and the SAME arm
            // answers migration-required — which NO acknowledgement clears, ever.
            return bridge ? { status: 'open' } : { status: 'migration-required' };
        }
        if (docs.stage === 'unreadable' || docs.stage === 'corrupt') {
            // Fail closed, NOT acknowledgeable (plan:602).
            return {
                status: 'corrupt',
                reason: docs.stage === 'unreadable'
                    ? GOVERNANCE_START_CORRUPT_REASONS.AUTHORITY_DOCUMENT_UNREADABLE
                    : GOVERNANCE_START_CORRUPT_REASONS.AUTHORITY_DOCUMENT_CORRUPT,
            };
        }
        const result = compareEnvelopes(docs.leader, docs.hard, deps.contains);
        if (result.verdict === GOVERNANCE_WARNING_VERDICTS.CONSISTENT) {
            // `consistent` writes NOTHING durable (a passing check is not history).
            // A previously-minted warning whose fingerprint no longer recomputes is
            // NOT erased — append-only ledger; it simply stops being re-observed.
            return { status: 'open' };
        }
        // The durable runtime fingerprint binds the team + blueprint + the
        // compared documents (spec §15.4): drift in ANY of these is a NEW
        // warning with no acknowledgement.
        const fingerprint = createHash('sha256')
            .update([
            'runtime',
            GOVERNANCE_WARNING_KINDS.ENVELOPE_CONSISTENCY,
            teamSessionId,
            docs.blueprintContentHash,
            result.fingerprintMaterial,
        ].join('\u0000'))
            .digest('hex');
        const warningId = warningIdForFingerprint(fingerprint);
        const interventionId = interventionIdForWarningId(warningId);
        const existing = (await fold(teamSessionId)).find((w) => w.fingerprint === fingerprint);
        if (existing === undefined) {
            await deps.writer.writeObserved(teamSessionId, {
                warningId,
                kind: GOVERNANCE_WARNING_KINDS.ENVELOPE_CONSISTENCY,
                verdict: result.verdict,
                fingerprint,
                blueprintContentHash: docs.blueprintContentHash,
                witnesses: result.witnesses.slice(0, 8),
            });
        }
        else if (existing.acknowledgement !== undefined) {
            // Acknowledged fingerprint: reminder state only — re-observation does
            // NOT re-block and does NOT re-mint; the durable history still records
            // the observation (append-only truth).
            await deps.writer.writeObserved(teamSessionId, {
                warningId,
                kind: GOVERNANCE_WARNING_KINDS.ENVELOPE_CONSISTENCY,
                verdict: result.verdict,
                fingerprint,
                blueprintContentHash: docs.blueprintContentHash,
            });
            return { status: 'open' };
        }
        else {
            // Duplicate observation: the fold counts it (count/time update; the
            // warning identity never changes).
            await deps.writer.writeObserved(teamSessionId, {
                warningId,
                kind: GOVERNANCE_WARNING_KINDS.ENVELOPE_CONSISTENCY,
                verdict: result.verdict,
                fingerprint,
                blueprintContentHash: docs.blueprintContentHash,
            });
        }
        return { status: 'warning-required', interventionId, warningId };
    }
    return {
        checkStart: runGate,
        checkEnsureRootLive: runGate, // the SAME gate, re-entered — never bypassed
        async observeRuntime(teamSessionId) {
            // Never blocks; a thrown read is swallowed at this edge by design:
            // the runtime stage observes, it never halts the Team (spec §15.2).
            try {
                await runGate(teamSessionId);
            }
            catch {
                /* observation is advisory at the runtime boundary */
            }
        },
        async acknowledge(input) {
            const warnings = await fold(input.teamSessionId);
            const expectedInterventionId = input.interventionId;
            const match = warnings.find((w) => interventionIdForWarningId(warningIdForFingerprint(w.fingerprint)) === expectedInterventionId);
            if (match === undefined) {
                return { kind: 'not-found' };
            }
            if (match.acknowledgement !== undefined) {
                return { kind: 'already-acknowledged', acknowledgement: match.acknowledgement };
            }
            const acknowledgedAt = deps.now();
            const acknowledgement = {
                warningId: warningIdForFingerprint(match.fingerprint),
                fingerprint: match.fingerprint,
                acknowledgedBy: input.callerPrincipalId,
                acknowledgedAt,
                ...(input.note !== undefined ? { note: input.note } : {}),
            };
            await deps.writer.writeAcknowledged(input.teamSessionId, {
                warningId: acknowledgement.warningId,
                fingerprint: acknowledgement.fingerprint,
                acknowledgedBy: acknowledgement.acknowledgedBy,
                ...(input.note !== undefined ? { note: input.note } : {}),
            });
            return { kind: 'acknowledged', acknowledgement };
        },
        async listWarnings(teamSessionId) {
            const warnings = await fold(teamSessionId);
            return warnings.map((w) => snapshot(teamSessionId, w));
        },
    };
}
//# sourceMappingURL=service.js.map