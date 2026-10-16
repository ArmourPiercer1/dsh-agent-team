/**
 * `AssuranceContract` — one of THREE independent dimensions (design §2.1,
 * S0 matrix §3): `implementationOrigin` (DSH native / Team trusted extension
 * / standalone runner / remote Provider), `executionBoundary` (trusted Host /
 * confined subprocess / delegated remote), and the per-dimension `assurance`
 * record. The retired `native/custom/shadow-run` "safety level" triple is a
 * FORBIDDEN old usage (matrix §3); this file cannot express it.
 *
 * THE DERIVATION LAW (design §1.4, verbatim): "Assurance 从有效 Policy 推导
 * 所需执行能力，不是可放宽权限的第二组开关。Provider 必须完整兑现其声称支持
 * 的维度." This module therefore answers CAPABILITY questions
 * ({@link assuranceSatisfies}) and never grants anything:
 *
 *  - `hard`          — the guarantee must be OS/Provider-ENFORCED → only
 *                      `enforced` satisfies it;
 *  - `authoritative` — an enforced guarantee or an honest author-trusted one
 *                      (same-process trusted mediation, design §3.6) counts;
 *  - `partial`, `unsupported`, `untested` NEVER satisfy either — the
 *                      no-overclaim law (design §5: never infer "strict
 *                      Profile green" from "Landlock READ_FILE blocks").
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/assurance
 */
import { closeRecordKeys, finish, isRecord, } from './parse-util.js';
/** `implementationOrigin` values (design §2.1, verbatim). */
export const IMPLEMENTATION_ORIGINS = ['dsh-native', 'team-trusted-extension', 'standalone-runner', 'remote-provider'];
/** `executionBoundary` values (design §2.1, verbatim three). */
export const EXECUTION_BOUNDARIES = ['trusted-host', 'confined-subprocess', 'delegated-remote'];
/** The per-dimension assurance levels (design §2.1, verbatim five). */
export const ASSURANCE_LEVELS = ['enforced', 'author-trusted', 'partial', 'unsupported', 'untested'];
/** The dimensions the assurance record must state (design §2.1 list). */
export const ASSURANCE_DIMENSIONS = [
    'content-read',
    'directory-metadata',
    'write',
    'alias',
    'network-destination',
    'inherit-cancel',
];
/**
 * Strict parse: the record must state EVERY dimension (a missing one is a
 * refusal, never an implicit `untested`), each from the closed five, and the
 * two origin/boundary fields from their closed sets.
 */
export function parseAssuranceContract(raw) {
    const problems = [];
    if (!isRecord(raw)) {
        return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'an AssuranceContract must be a record' }] };
    }
    closeRecordKeys(raw, ['implementationOrigin', 'executionBoundary', 'assurance'], '$', problems);
    const originRaw = raw['implementationOrigin'];
    if (typeof originRaw !== 'string' || !IMPLEMENTATION_ORIGINS.includes(originRaw)) {
        problems.push({ code: 'value-outside-closed-set', path: '$.implementationOrigin', detail: `implementationOrigin must be one of ${IMPLEMENTATION_ORIGINS.join(' | ')}` });
    }
    const boundaryRaw = raw['executionBoundary'];
    if (typeof boundaryRaw !== 'string' || !EXECUTION_BOUNDARIES.includes(boundaryRaw)) {
        problems.push({ code: 'value-outside-closed-set', path: '$.executionBoundary', detail: `executionBoundary must be one of ${EXECUTION_BOUNDARIES.join(' | ')}` });
    }
    const assuranceRaw = raw['assurance'];
    let assurance;
    if (!isRecord(assuranceRaw)) {
        problems.push({ code: 'field-type', path: '$.assurance', detail: '`assurance` must be a record over every dimension' });
    }
    else {
        closeRecordKeys(assuranceRaw, ASSURANCE_DIMENSIONS, '$.assurance', problems);
        const built = {};
        let complete = true;
        for (const dimension of ASSURANCE_DIMENSIONS) {
            const level = assuranceRaw[dimension];
            if (level === undefined) {
                problems.push({ code: 'missing-field', path: `$.assurance.${dimension}`, detail: `the Provider must state dimension '${dimension}' (design §1.4: 完整兑现其声称支持的维度)` });
                complete = false;
                continue;
            }
            if (typeof level !== 'string' || !ASSURANCE_LEVELS.includes(level)) {
                problems.push({ code: 'value-outside-closed-set', path: `$.assurance.${dimension}`, detail: `assurance level must be one of ${ASSURANCE_LEVELS.join(' | ')}` });
                complete = false;
                continue;
            }
            built[dimension] = level;
        }
        if (complete)
            assurance = built;
    }
    return finish(problems, () => ({
        implementationOrigin: originRaw,
        executionBoundary: boundaryRaw,
        assurance: assurance,
    }));
}
/**
 * Does the contract actually carry the demanded capability per dimension?
 * Reports every failing dimension (collected, never the first).
 */
export function assuranceSatisfies(contract, required) {
    const failing = [];
    for (const dimension of ASSURANCE_DIMENSIONS) {
        const demand = required[dimension];
        if (demand === undefined)
            continue;
        const level = contract.assurance[dimension];
        const satisfied = demand === 'hard' ? level === 'enforced' : level === 'enforced' || level === 'author-trusted';
        if (!satisfied)
            failing.push(dimension);
    }
    return { ok: failing.length === 0, failing };
}
//# sourceMappingURL=assurance.js.map