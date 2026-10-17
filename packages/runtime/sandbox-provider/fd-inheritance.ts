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
 * FD CONTRACT — "3 = launcher-owned; declaring is not using".
 * FD 3 is the launcher's own reserved channel: the one-shot arm computes
 * its fd-3 reservation BEFORE any fd allocation and closes the slot itself
 * (`close_extra_fds` leaky-closure), and the stream arm's line-JSON
 * handshake rides fd 3 and the child closes it BEFORE restrict→execve. A
 * policy that merely DECLARED fd 3 used to compile cleanly and then be
 * silently overridden at exec (review L3d: declared-fd-3-survived=false) —
 * that tension between declaration face and execution face is resolved on
 * the REFUSAL side: `compileFdPlan` refuses `fd === 3` as `fd-launcher-owned`
 * at prepare, before any plan or process exists, under the same law for the
 * one-shot and the streaming arm (both share prepare()).
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/fd-inheritance
 */

/** The closed set of purposes an inherited FD may be declared for. */
export const INHERIT_PURPOSES = ['stdin', 'stdout', 'stderr', 'delivery'] as const

/** One declared inheritance purpose. */
export type InheritPurpose = (typeof INHERIT_PURPOSES)[number]

/** One declaration: the FD number, its purpose, and the resource it carries. */
export interface DeclaredInheritedFd {
  readonly fd: number
  readonly purpose: InheritPurpose
  /** Fingerprint of the resource behind the FD (identity, not a name). */
  readonly resourceFingerprint: string
}

/** The compiled plan the launcher receives. */
export interface FdPlan {
  readonly declared: readonly DeclaredInheritedFd[]
  /** Always the constant below — present so the payload states it explicitly. */
  readonly inheritDefault: 'close-all-undeclared'
}

/** The launcher-side wire payload (JSON-safe; fd numbers only). */
export interface FdPlanPayload {
  readonly inheritDefault: 'close-all-undeclared'
  readonly declared: readonly { fd: number; purpose: InheritPurpose }[]
}

/** The fixed inherit default — exported so tests and docs cite ONE site. */
export const FD_INHERIT_DEFAULT = 'close-all-undeclared' as const

/** FD 3 is launcher-owned (handshake / ruleset-reservation channel) and can
 *  NEVER be an inherited payload FD — see the module header's fd contract. */
export const LAUNCHER_OWNED_FD = 3

/** The CLOEXEC-is-mechanism law, stated verbatim where the plan is compiled. */
export const FD_CLOSE_LAW_NOTE =
  'CLOEXEC marks a closure; it is the mechanism, not the guarantee — the launcher closes every undeclared inherited FD itself, because Landlock never retroactively closes already-open FDs (TOCTOU_A)'

/** A compile outcome. */
export type FdPlanAdvance =
  | { readonly ok: true; readonly plan: FdPlan }
  | { readonly ok: false; readonly problems: readonly { code: string; path: string; detail: string }[] }

/** Compile (and law-check) a declaration set. No declaration = close everything above 2. */
export function compileFdPlan(declared: readonly DeclaredInheritedFd[]): FdPlanAdvance {
  const problems: { code: string; path: string; detail: string }[] = []
  const seen = new Set<number>()
  declared.forEach((d, i) => {
    const path = `$.declared[${i}]`
    if (!Number.isInteger(d.fd) || d.fd < 0) {
      problems.push({ code: 'field-type', path: `${path}.fd`, detail: 'fd must be a non-negative integer' })
    } else if (d.fd === LAUNCHER_OWNED_FD) {
      problems.push({ code: 'fd-launcher-owned', path: `${path}.fd`, detail: `fd ${LAUNCHER_OWNED_FD} is launcher-owned (handshake/ruleset reservation, closed before exec on both arms) — declaring it is not using it; the refusal lives on the declaration face, the execution face never silently overrides (review L3d)` })
    } else if (seen.has(d.fd)) {
      problems.push({ code: 'duplicate-fd', path: `${path}.fd`, detail: `fd ${d.fd} declared twice — inheritance has one statement per FD` })
    } else {
      seen.add(d.fd)
    }
    if (!(INHERIT_PURPOSES as readonly string[]).includes(d.purpose)) {
      problems.push({ code: 'value-outside-closed-set', path: `${path}.purpose`, detail: `purpose must be one of ${INHERIT_PURPOSES.join(' | ')}` })
    }
    if (typeof d.resourceFingerprint !== 'string' || d.resourceFingerprint.trim().length === 0) {
      problems.push({ code: 'empty-string', path: `${path}.resourceFingerprint`, detail: 'an inherited FD must state the resource it carries' })
    }
  })
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, plan: Object.freeze({ declared: Object.freeze([...declared]), inheritDefault: FD_INHERIT_DEFAULT }) }
}

/** The launcher payload: the default-CLOSE directive plus the whitelist it whitelists. */
export function fdPlanToPayload(plan: FdPlan): FdPlanPayload {
  return Object.freeze({
    inheritDefault: FD_INHERIT_DEFAULT,
    declared: Object.freeze(plan.declared.map((d) => Object.freeze({ fd: d.fd, purpose: d.purpose }))),
  })
}
