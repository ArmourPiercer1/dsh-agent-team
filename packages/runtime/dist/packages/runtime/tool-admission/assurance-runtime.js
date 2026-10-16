/**
 * Alpha.5 PR2 (plan §5, hard clause H2 @ user 05:4x/07:0xZ) — THE RUNTIME
 * ASSURANCE VERIFICATION THAT RUNS AHEAD OF ANY HARD-PROFILE CONSUMPTION.
 *
 * THE HOLE THIS CLOSES. `assuranceSatisfies` (PR0) answers the CAPABILITY
 * question from the LEVEL alone — by design, because the derivation law keeps
 * it a capability question. The schema (PR0 M-2) lets a dimension record
 * `level: 'enforced'` with `mechanism: null`, `trustRoot: null`,
 * `evidence: null`: an authored CLAIM that nothing backs it. A runtime that
 * consumes assurance by reading the level would let exactly that claim cash a
 * hard profile — the overclaim design §1.4/§5 refuses, and the user's H2 makes
 * a hard law: **a level never redeems a capability by itself**. At runtime,
 * every demanded dimension must carry REAL `mechanism` / `trustRoot` /
 * `evidence` values and a REAL `realmId`, and they must MATCH the record an
 * independent probe observed. `enforced` + `null` mechanism = REFUSAL.
 *
 * THE ORDER (H2 verbatim: 先于 hard-profile): this verification runs INSIDE
 * Admission, before an `admitted` decision can be minted into a grant, and
 * therefore before PR3's ControlledFs / PR4's ConfinedProcessProvider are ever
 * asked to enforce the profile. `a5p2-assurance-probe` pins the ordering too:
 * the probe answers before the ledger sees the call.
 *
 * THE PROBE IS AN INJECTED PORT. Until PR4 lands the real capability probe
 * (backend/OS/permission detection, design §5), the assembly injects
 * {@link createStubAssuranceProbe}; its semantics (explicitly-stated
 * dimensions answer, everything else is the honest `{ ok: false }`) and the
 * PR4 replacement contract are pinned in this lane's README. A stub that
 * guessed "probably fine" would reintroduce the hole with extra steps.
 *
 * THE TWO REFUSALS, kept apart (§5 distinctions):
 *  - the LEVEL does not meet the demand → `IO_POLICY_UNSUPPORTED`
 *    (Provider capability insufficient — the honest "this profile cannot run");
 *  - the level claims to meet the demand but the RECORD is unverifiable —
 *    a null mechanism/trustRoot/evidence, a blank string, a probe that cannot
 *    observe, or a claim that CONTRADICTS the probe (any field, including
 *    `realmId`) → `TOOL_BINDING_UNVERIFIED` (the Binding's claim cannot be
 *    verified at call time; PR1's Guard established the same code for the same
 *    class of fact).
 * Every demanded dimension is checked and every failure reported — never just
 * the first (PR0's `assuranceSatisfies` precedent).
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/runtime/tool-admission/assurance-runtime
 */
import { ASSURANCE_DIMENSIONS, } from '../../domain/tool-governance/src/index.js';
/** A record the probe cannot confirm answers `{ ok: false }` — never a guess. */
export function createStubAssuranceProbe(observed) {
    return (_binding, dimension) => {
        const record = observed[dimension];
        if (record === undefined) {
            return { ok: false, detail: `the stub probe was given no observation for '${dimension}' (README §stub: PR4 replaces this port with the real capability probe; an unobserved dimension is NO observation)` };
        }
        return { ok: true, mechanism: record.mechanism, realmId: record.realmId, trustRoot: record.trustRoot, evidence: record.evidence };
    };
}
function isRealString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
/**
 * Verify the contract's demanded dimensions AGAINST THE PROBE before any
 * hard-profile consumption. `required` maps a dimension to what the effective
 * Policy derives from it (the derivation law: the POLICY demands, the
 * Provider proves; a level never demands for itself).
 * @param contract - the Binding's assurance contract (authored claim).
 * @param required - the per-dimension demands the call derives from Policy.
 * @param probe - the independent observation port (stub until PR4).
 */
export function verifyAssuranceForHardProfile(contract, required, probe, binding) {
    const verified = [];
    const refusals = [];
    for (const dimension of ASSURANCE_DIMENSIONS) {
        const demand = required[dimension];
        if (demand === undefined)
            continue;
        const record = contract.assurance[dimension];
        if (record === undefined) {
            // PR0's parser makes this unreachable for a parsed contract; kept loud
            // because a cast record must not silently pass.
            refusals.push({ dimension, requirement: demand, code: 'TOOL_BINDING_UNVERIFIED', detail: 'the contract states no record for a demanded dimension' });
            continue;
        }
        const levelOk = demand === 'hard'
            ? record.level === 'enforced'
            : record.level === 'enforced' || record.level === 'author-trusted';
        if (!levelOk) {
            // A capability question, answered honestly: the profile the Policy
            // derives cannot run under this Provider.
            refusals.push({ dimension, requirement: demand, code: 'IO_POLICY_UNSUPPORTED', detail: `dimension '${dimension}' is '${record.level}' but the effective Policy derives a '${demand}' demand (partial/unsupported/untested never satisfy, PR0 derivation law)` });
            continue;
        }
        // THE LEVEL CLAIMED CAPABILITY — that claim now has to SHOW its work.
        if (!isRealString(record.mechanism) || !isRealString(record.trustRoot) || !isRealString(record.evidence)) {
            refusals.push({ dimension, requirement: demand, code: 'TOOL_BINDING_UNVERIFIED', detail: `dimension '${dimension}' claims '${record.level}' with a null/blank ${!isRealString(record.mechanism) ? 'mechanism' : !isRealString(record.trustRoot) ? 'trustRoot' : 'evidence'} — H2: enforced+null is a refusal, a level never redeems a capability by itself` });
            continue;
        }
        const answer = probe(binding, dimension);
        if (!answer.ok) {
            refusals.push({ dimension, requirement: demand, code: 'TOOL_BINDING_UNVERIFIED', detail: `dimension '${dimension}' claims '${record.level}' but the probe cannot observe it (${answer.detail})` });
            continue;
        }
        const mismatched = ['mechanism', 'realmId', 'trustRoot', 'evidence'].filter((field) => record[field] !== answer[field]);
        if (mismatched.length > 0) {
            refusals.push({ dimension, requirement: demand, code: 'TOOL_BINDING_UNVERIFIED', detail: `dimension '${dimension}' claims '${record.level}' but the probe observed a DIFFERENT record (fields differing: ${mismatched.join(', ')}) — the claim is not the observation` });
            continue;
        }
        verified.push({
            dimension,
            requirement: demand,
            mechanism: record.mechanism,
            realmId: record.realmId,
            trustRoot: record.trustRoot,
            evidence: record.evidence,
        });
    }
    if (refusals.length > 0) {
        // One typed error carrying EVERY failure: a caller must not have to
        // re-ask per dimension to learn the honest scope of the shortfall.
        const first = refusals[0];
        return {
            ok: false,
            error: {
                code: first.code,
                message: `admission refused: assurance runtime verification failed for ${refusals.length} demanded dimension(s): ${refusals.map((r) => `[${r.code}] ${r.detail}`).join(' | ')}`,
                details: {
                    refusal: 'assurance-runtime-verification',
                    dimensions: refusals.map((r) => r.dimension).join(','),
                    codes: refusals.map((r) => r.code).join(','),
                },
            },
        };
    }
    return { ok: true, value: { verified } };
}
//# sourceMappingURL=assurance-runtime.js.map