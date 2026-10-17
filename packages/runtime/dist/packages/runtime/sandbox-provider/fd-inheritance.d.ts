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
export declare const INHERIT_PURPOSES: readonly ["stdin", "stdout", "stderr", "delivery"];
/** One declared inheritance purpose. */
export type InheritPurpose = (typeof INHERIT_PURPOSES)[number];
/** One declaration: the FD number, its purpose, and the resource it carries. */
export interface DeclaredInheritedFd {
    readonly fd: number;
    readonly purpose: InheritPurpose;
    /** Fingerprint of the resource behind the FD (identity, not a name). */
    readonly resourceFingerprint: string;
}
/** The compiled plan the launcher receives. */
export interface FdPlan {
    readonly declared: readonly DeclaredInheritedFd[];
    /** Always the constant below — present so the payload states it explicitly. */
    readonly inheritDefault: 'close-all-undeclared';
}
/** The launcher-side wire payload (JSON-safe; fd numbers only). */
export interface FdPlanPayload {
    readonly inheritDefault: 'close-all-undeclared';
    readonly declared: readonly {
        fd: number;
        purpose: InheritPurpose;
    }[];
}
/** The fixed inherit default — exported so tests and docs cite ONE site. */
export declare const FD_INHERIT_DEFAULT: "close-all-undeclared";
/** The CLOEXEC-is-mechanism law, stated verbatim where the plan is compiled. */
export declare const FD_CLOSE_LAW_NOTE = "CLOEXEC marks a closure; it is the mechanism, not the guarantee \u2014 the launcher closes every undeclared inherited FD itself, because Landlock never retroactively closes already-open FDs (TOCTOU_A)";
/** A compile outcome. */
export type FdPlanAdvance = {
    readonly ok: true;
    readonly plan: FdPlan;
} | {
    readonly ok: false;
    readonly problems: readonly {
        code: string;
        path: string;
        detail: string;
    }[];
};
/** Compile (and law-check) a declaration set. No declaration = close everything above 2. */
export declare function compileFdPlan(declared: readonly DeclaredInheritedFd[]): FdPlanAdvance;
/** The launcher payload: the default-CLOSE directive plus the whitelist it whitelists. */
export declare function fdPlanToPayload(plan: FdPlan): FdPlanPayload;
//# sourceMappingURL=fd-inheritance.d.ts.map