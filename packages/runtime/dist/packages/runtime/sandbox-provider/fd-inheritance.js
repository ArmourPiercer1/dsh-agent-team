/**
 * THE FD-INHERITANCE DECLARATION SET — C-PROC (INTERFACES-v1: FD 继承集显式
 * 声明). The law this file encodes is the launcher-side reading of the
 * TOCTOU_A/TOCTOU_B findings (10-landlock-lanes): Landlock does NOT retroactively
 * close already-open FDs, so the confined launcher must CLOSE EVERY
 * UNDECLARED inherited FD before exec — the O_CLOEXEC flag is a mechanism,
 * not by itself the guarantee (plan §7 强制限制 verbatim).
 *
 * There is deliberately NO "inherit everything" arm: the default is the
 * constant `close-all-undeclared` and the payload carries no field that
 * could relax it.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/fd-inheritance
 */
/** The closed set of purposes an inherited FD may be declared for. */
export const INHERIT_PURPOSES = ['stdin', 'stdout', 'stderr', 'delivery'];
/** The fixed inherit default — exported so tests and docs cite ONE site. */
export const FD_INHERIT_DEFAULT = 'close-all-undeclared';
/** The CLOEXEC-is-mechanism law, stated verbatim where the plan is compiled. */
export const FD_CLOSE_LAW_NOTE = 'CLOEXEC marks a closure; it is the mechanism, not the guarantee — the launcher closes every undeclared inherited FD itself, because Landlock never retroactively closes already-open FDs (TOCTOU_A)';
/** Compile (and law-check) a declaration set. No declaration = close everything above 2. */
export function compileFdPlan(declared) {
    const problems = [];
    const seen = new Set();
    declared.forEach((d, i) => {
        const path = `$.declared[${i}]`;
        if (!Number.isInteger(d.fd) || d.fd < 0) {
            problems.push({ code: 'field-type', path: `${path}.fd`, detail: 'fd must be a non-negative integer' });
        }
        else if (seen.has(d.fd)) {
            problems.push({ code: 'duplicate-fd', path: `${path}.fd`, detail: `fd ${d.fd} declared twice — inheritance has one statement per FD` });
        }
        else {
            seen.add(d.fd);
        }
        if (!INHERIT_PURPOSES.includes(d.purpose)) {
            problems.push({ code: 'value-outside-closed-set', path: `${path}.purpose`, detail: `purpose must be one of ${INHERIT_PURPOSES.join(' | ')}` });
        }
        if (typeof d.resourceFingerprint !== 'string' || d.resourceFingerprint.trim().length === 0) {
            problems.push({ code: 'empty-string', path: `${path}.resourceFingerprint`, detail: 'an inherited FD must state the resource it carries' });
        }
    });
    if (problems.length > 0)
        return { ok: false, problems };
    return { ok: true, plan: Object.freeze({ declared: Object.freeze([...declared]), inheritDefault: FD_INHERIT_DEFAULT }) };
}
/** The launcher payload: the default-CLOSE directive plus the whitelist it whitelists. */
export function fdPlanToPayload(plan) {
    return Object.freeze({
        inheritDefault: FD_INHERIT_DEFAULT,
        declared: Object.freeze(plan.declared.map((d) => Object.freeze({ fd: d.fd, purpose: d.purpose }))),
    });
}
//# sourceMappingURL=fd-inheritance.js.map