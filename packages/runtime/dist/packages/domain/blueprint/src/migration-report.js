/**
 * The v3→v4 migration REPORT module (VNEXT-SCHEMA-ADR M-4; exit form (a):
 * a READ-ONLY report, no edit loop, no auto-rewrite — those ship only with
 * the release round).
 *
 * Laws encoded here:
 *  - E2 (ADR §2): a migration may NEVER widen permissions. Bound envelope
 *    content (the Alpha.4 authority documents and mutation envelopes) is
 *    byte-invariant across a migration (D-07⑤): any difference is a
 *    `MIGRATION_PERMISSION_WIDENING` REJECTION, not a decision to offer.
 *  - v3 carries NO tool-governance fact, so every produced `toolBindings`
 *    entry is a NEW declaration: at best `requires-decision`, never silent
 *    acceptance — and never silent allowance.
 *  - compat-default rules may not produce wide values: when the caller
 *    reports `appliedRules` containing `compat-default` AND the proposed
 *    document carries wide values with no source fact, the report REJECTS
 *    (the mapping "default → allow/all" must not exist).
 *  - silently dropping a carried field is a loud `requires-decision`
 *    finding — narrowing is legal only as an explicit human decision.
 *
 * The report consumes REAL documents (a v3 source, an optional proposed v4
 * document) so the NEG suite drives the shipped decision surface.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/domain/blueprint-migration-report
 */
import { canonicalJsonStringify } from '../../../contracts/src/index.js';
import { isTeamContractError } from '../../../contracts/src/index.js';
import { validateBlueprintDocument } from './validate.js';
import { validateBlueprintV4Document } from './blueprint-v4.js';
export const MIGRATION_PERMISSION_WIDENING = 'MIGRATION_PERMISSION_WIDENING';
/** The envelope documents whose CONTENT is byte-invariant across migration. */
const BOUND_ENVELOPE_FIELDS = ['teamHardEnvelope', 'permissionMutationEnvelope', 'teamEnvelope', 'memberEnvelopes'];
/** Fields compared for silent drops/narrowing (everything except the family + version). */
const CARRIED_EXCLUSIONS = new Set(['schemaVersion', 'toolBindings', ...BOUND_ENVELOPE_FIELDS]);
function isWide(entry) {
    if (entry.authorization === 'allow')
        return true;
    const { read, write, network } = entry.io;
    if (read.mode === 'all' || write.mode === 'all')
        return true;
    if (network.mode === 'allow')
        return true;
    return false;
}
function problemsToFindings(problems) {
    return problems.map((p) => ({ path: p.path, verdict: 'rejected', code: p.code, detail: p.detail }));
}
/**
 * Plan the migration of one v3 document to v4. Read-only: the proposed
 * document is VALIDATED and DIFFED, never mutated or rewritten.
 */
export function planBlueprintV3toV4Migration(source, proposed, opts = {}) {
    let core3;
    try {
        core3 = validateBlueprintDocument(source);
    }
    catch (err) {
        const code = isTeamContractError(err) ? err.code : 'UNKNOWN';
        const path = isTeamContractError(err) && typeof err.details.path === 'string' ? String(err.details.path) : '$';
        return freeze({
            verdict: 'reject',
            ok: false,
            requiresDecision: false,
            permissionWidening: false,
            code,
            fields: [{ path, verdict: 'rejected', code, detail: err instanceof Error ? err.message : 'source is not a valid v3 blueprint document' }],
            notes: ['the source document must itself validate; nothing is migrated from an invalid source'],
        });
    }
    const carried = Object.keys(core3)
        .filter((key) => key !== 'schemaVersion')
        .map((key) => ({ path: `$.${key}`, verdict: 'carried' }));
    if (proposed === undefined) {
        return freeze({
            verdict: 'accept',
            ok: true,
            requiresDecision: false,
            permissionWidening: false,
            fields: carried,
            notes: ['identity migration: the v3 face carries 1:1 and no governance family is declared (absence = nothing declared, never an expansion)'],
        });
    }
    let core4;
    try {
        core4 = validateBlueprintV4Document(proposed);
    }
    catch (err) {
        const code = isTeamContractError(err) ? err.code : 'UNKNOWN';
        const rawProblems = isTeamContractError(err) ? err.details.problems : undefined;
        const fields = Array.isArray(rawProblems) && rawProblems.length > 0
            ? problemsToFindings(rawProblems)
            : [{ path: '$', verdict: 'rejected', code, detail: err instanceof Error ? err.message : 'proposed document refused' }];
        return freeze({
            verdict: 'reject',
            ok: false,
            requiresDecision: false,
            permissionWidening: false,
            code,
            fields,
            notes: ['the proposed document fails the v4 grammar; a migration cannot propose an invalid document'],
        });
    }
    const fields = [...carried];
    let widening = false;
    // (1) bound-envelope byte-invariance (D-07⑤ / E2): a DIFFERENCE is a
    //     refusal, not a decision.
    for (const field of BOUND_ENVELOPE_FIELDS) {
        const before = canonicalJsonStringify(core3[field] ?? null);
        const after = canonicalJsonStringify(core4[field] ?? null);
        if (before !== after) {
            widening = true;
            fields.push({
                path: `$.${field}`,
                verdict: 'rejected',
                code: MIGRATION_PERMISSION_WIDENING,
                detail: 'bound envelope content is byte-invariant across a migration; a proposed difference is a widening, not a migration',
            });
        }
    }
    // (2) produced governance entries: v3 has NO source fact for any of them.
    const produced = (core4['toolBindings'] ?? []);
    const compatDefaultApplied = (opts.appliedRules ?? []).includes('compat-default');
    produced.forEach((entry, index) => {
        const wide = isWide(entry);
        if (wide)
            widening = true;
        if (wide && compatDefaultApplied) {
            fields.push({
                path: `$.toolBindings[${String(index)}]`,
                verdict: 'rejected',
                code: MIGRATION_PERMISSION_WIDENING,
                detail: 'a compat-default rule produced a WIDE value with no v3 source fact; no compat-default mapping may widen (E2)',
            });
        }
        else {
            fields.push({
                path: `$.toolBindings[${String(index)}]`,
                verdict: 'requires-decision',
                ...(wide ? { code: MIGRATION_PERMISSION_WIDENING } : {}),
                detail: 'v3 carries no governance fact for this entry; a produced binding is a NEW declaration and needs an explicit human decision',
            });
        }
    });
    // (3) silent drops / narrowings on carried fields.
    for (const key of Object.keys(core3)) {
        if (CARRIED_EXCLUSIONS.has(key))
            continue;
        const before = canonicalJsonStringify(core3[key]);
        const after = canonicalJsonStringify(core4[key] ?? null);
        if (before !== after) {
            fields.push({
                path: `$.${key}`,
                verdict: 'requires-decision',
                detail: 'a carried field differs between source and proposed; a migration may not silently drop or narrow it',
            });
        }
    }
    const rejected = fields.some((f) => f.verdict === 'rejected');
    const decision = fields.some((f) => f.verdict === 'requires-decision');
    const wideningCode = fields.find((f) => f.code === MIGRATION_PERMISSION_WIDENING)?.code;
    const verdict = rejected ? 'reject' : decision ? 'report-requires-decision' : 'accept';
    const firstRejectCode = fields.find((f) => f.verdict === 'rejected')?.code;
    return freeze({
        verdict,
        ok: verdict === 'accept',
        requiresDecision: verdict === 'report-requires-decision',
        permissionWidening: widening,
        ...(verdict === 'reject'
            ? { code: firstRejectCode ?? 'UNKNOWN' }
            : wideningCode !== undefined
                ? { code: wideningCode }
                : {}),
        fields,
        notes: ['read-only report (ADR M-4 exit (a)): nothing was rewritten; every finding names its path'],
    });
}
function freeze(value) {
    if (value !== null && typeof value === 'object') {
        for (const item of Object.values(value))
            freeze(item);
        Object.freeze(value);
    }
    return value;
}
//# sourceMappingURL=migration-report.js.map