/**
 * P7-T2 — the mutation module's PURE KERNELS (pre-alpha3 PR-F, plan
 * §F.2: the `MutationService` class + its step-boundary machinery moved
 * to {@link ./internal/mutation-service.js} — the test-world kernel — and
 * this file keeps only the exported pure kernels the PRODUCTION
 * governance authority
 * ({@link @dsh-agent-team/runtime/governance}) reuses, so the intake
 * boundary and the durable write path speak ONE vocabulary):
 *
 * - {@link checkExternalHardFacts} — the external-hard-facts check of one
 *   policy cell (invariant 35, §19.2/§19.5);
 * - {@link normalizePolicyEntry} — the exact structural validation of one
 *   policy entry (the frozen domain validator's rules, this module's
 *   closed error code);
 * - {@link normalizeStateView} — the exact structural validation of one
 *   PolicyState target.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation/service
 */
import { CAPABILITY_NAME_VALUES, } from '../../domain/policy/src/index.js';
import { MutationError, MUTATION_ERROR_CODES } from './errors.js';
/**
 * The external hard facts check of ONE policy cell value — the pure
 * kernel of {@link MutationService.checkExternalHard} (invariant 35,
 * §19.2/§19.5: an escalation beyond the external hard facts is rejected
 * for EVERY origin, human override included). `deny` values pass (a
 * tightening never escapes the hard facts).
 *
 * Exported kernel (pre-alpha3 PR-A): the production governance authority
 * (packages/runtime/governance) reuses it for its write-time checks, so
 * the intake service and the durable write path speak ONE vocabulary.
 *
 * @param teamSessionId - the team being checked (error context).
 * @param capability - the cell capability.
 * @param value - the normalized cell value.
 * @param external - the external hard facts (read by the caller).
 * @throws {@link MutationError} `EXTERNAL_HARD_REJECTED` (beyond the hard
 *   facts) or `MALFORMED_MUTATION_INPUT` (malformed facts from the reader).
 */
export function checkExternalHardFacts(teamSessionId, capability, value, external) {
    if (value.kind === 'deny')
        return; // tightening never escapes the hard facts
    if (typeof external !== 'object' ||
        external === null ||
        typeof external.hard !== 'object' ||
        external.hard === null ||
        typeof external.capabilityExists !== 'object' ||
        external.capabilityExists === null) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed external hard facts from the policy reader for TeamSession '${teamSessionId}'`, { stage: 'external', source: 'reader' });
    }
    if (external.capabilityExists[capability] === false) {
        throw new MutationError(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED, `capability '${capability}' does not exist in the substrate; no origin may grant it (invariant 35)`, { capability, hardReason: 'capabilityMissing' });
    }
    const hardEntry = external.hard[capability];
    if (hardEntry === undefined)
        return;
    const hard = normalizePolicyEntry(hardEntry, `external.hard.${capability}`);
    if (hard.kind === 'deny') {
        throw new MutationError(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED, `capability '${capability}' is hard-denied by the external policy; no origin may grant it (§19.2/§25.4)`, { capability, hardReason: 'hardDeny' });
    }
    const allowed = new Set(hard.items);
    const missing = [];
    for (const item of value.items) {
        if (!allowed.has(item))
            missing.push(item);
    }
    if (missing.length > 0) {
        throw new MutationError(MUTATION_ERROR_CODES.EXTERNAL_HARD_REJECTED, `capability '${capability}' allow items exceed the external hard allow-list`, { capability, hardReason: 'outsideHardAllowList', items: missing });
    }
}
/**
 * Validate + normalize one policy entry — the EXACT structural rules of
 * the frozen domain validator (a `deny` entry carries no extra fields; an
 * `allow` entry carries only kind+items, a non-empty array of unique
 * non-empty strings), normalized to a fresh deep-freezable copy under
 * this module's error code. Exported kernel: the production governance
 * authority (packages/runtime/governance, pre-alpha3 PR-A) reuses it for
 * its write-time cell validation (one closed error surface).
 */
export function normalizePolicyEntry(raw, field) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: policy entry must be a record {kind:'allow'|'deny', ...}`, { field, problem: 'not a record' });
    }
    const record = raw;
    const kind = record['kind'];
    const keys = Object.keys(record);
    if (kind === 'deny') {
        if (keys.some((key) => key !== 'kind')) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: a 'deny' entry must not carry extra fields (got ${keys.join(', ')})`, { field });
        }
        return { kind: 'deny' };
    }
    if (kind === 'allow') {
        if (keys.some((key) => key !== 'kind' && key !== 'items')) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: an 'allow' entry may only carry 'kind' and 'items'`, { field });
        }
        const items = record['items'];
        if (!Array.isArray(items) || items.length === 0) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: 'allow' items must be a non-empty array (use kind:'deny' for no items)`, { field });
        }
        const seen = new Set();
        for (const item of items) {
            if (typeof item !== 'string' || item.length === 0) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.items: every item must be a non-empty string`, { field: `${field}.items` });
            }
            if (seen.has(item)) {
                throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.items: duplicate item '${item}'`, { field: `${field}.items`, item });
            }
            seen.add(item);
        }
        return { kind: 'allow', items: [...items] };
    }
    throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: kind must be 'allow' or 'deny' (got ${String(kind)})`, { field });
}
/**
 * Validate + normalize one PolicyState target — the EXACT structural
 * rules of the frozen domain validator (id-like `stateId`; closed
 * capability keys; a cell may only carry `locked` (boolean) and `value`
 * (policy entry)), normalized to a fresh deep-freezable copy. Exported
 * kernel: the production governance authority (packages/runtime/governance,
 * pre-alpha3 PR-A) reuses it for its PolicyState target validation.
 */
export function normalizeStateView(raw, field) {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}: policy state must be a record {stateId, cells?}`, { field, problem: 'not a record' });
    }
    const record = raw;
    const stateId = record['stateId'];
    if (typeof stateId !== 'string' ||
        stateId.length === 0 ||
        /\s/.test(stateId) ||
        // eslint-disable-next-line no-control-regex -- intentional scanner: rejects control characters in state ids
        /[\u0000-\u001f\u007f]/.test(stateId)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.stateId: must be a non-empty id-like string (no whitespace/control characters)`, { field: `${field}.stateId` });
    }
    const state = { stateId };
    const cellsRaw = record['cells'];
    if (cellsRaw === undefined)
        return state;
    if (typeof cellsRaw !== 'object' || cellsRaw === null || Array.isArray(cellsRaw)) {
        throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells: must be a record keyed by capability name (or absent)`, { field: `${field}.cells` });
    }
    const cells = {};
    for (const [key, cellRaw] of Object.entries(cellsRaw)) {
        if (!CAPABILITY_NAME_VALUES.includes(key)) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells: unknown capability '${key}' (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`, { field: `${field}.cells`, capability: key });
        }
        const capability = key;
        if (typeof cellRaw !== 'object' || cellRaw === null || Array.isArray(cellRaw)) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells.${capability}: state cell must be a record {locked?, value?}`, { field: `${field}.cells.${capability}` });
        }
        const cell = cellRaw;
        if (Object.keys(cell).some((k) => k !== 'locked' && k !== 'value')) {
            throw new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, `malformed mutation input at ${field}.cells.${capability}: a state cell may only carry 'locked' and 'value'`, { field: `${field}.cells.${capability}` });
        }
        const normalized = {};
        if (cell['locked'] === true)
            normalized.locked = true;
        if (cell['value'] !== undefined) {
            normalized.value = normalizePolicyEntry(cell['value'], `${field}.cells.${capability}.value`);
        }
        cells[capability] = normalized;
    }
    state.cells = cells;
    return state;
}
//# sourceMappingURL=service.js.map