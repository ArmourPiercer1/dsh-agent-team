/**
 * team-session-ownership — the ONE durable Team-ownership resolver
 * (restart-recovery C1, guide §3.2).
 *
 * The 0.1.7 restart-recovery fence (host-side, registered BEFORE any glue
 * can boot) and the live glue (the `teamRootOfSession` closure) must share
 * a SINGLE ownership algorithm — two traversals of the same durable
 * repositories would drift (guide §3.2: "目标是只有一个 ownership
 * authority 算法"). This module is that authority, extracted from the glue's
 * pre-existing `teamRootOfSession` with the semantics preserved VERBATIM:
 *
 *   1. the boot root owns itself;
 *   2. a session that carries its own durable TeamSession row IS a team
 *      root of this domain (a freshly created TeamSession / team-root
 *      binding — the domain hosts every team root, T12-GLUE) and owns
 *      itself;
 *   3. a bound member child is owned by the root whose member list carries
 *      it — the boot root first (its TeamSession row may be absent in
 *      older worlds), then the other team roots of the domain;
 *   4. unresolved → `undefined` (the boot root is NOT a fallback for
 *      unknown sessions — the callers fail closed).
 *
 * The module is PURE: synchronous, deterministic, no side effects, no
 * service reads beyond the passed repositories, and structurally typed
 * (the minimal repository projection the algorithm touches — no import of
 * the storage package, so the fence stays usable before the domain open
 * settles and in test worlds with doubles).
 *
 * Scanned by the P4-T6 zero-Team-SessionEvent audit (zero denylist
 * vocabulary — this module carries none).
 *
 * @module @dsh-agent-team/runtime/plugin/team-session-ownership
 */
/**
 * Resolve the team root that OWNS one session of this domain (guide §3.2).
 *
 * @param domain - the opened TeamDomain (structural projection; the real
 *   domain or a repository double).
 * @param bootRootSessionId - this row's boot root session id (the row
 *   config's `rootSessionId`).
 * @param sessionId - the session id to classify.
 * @returns the owning root session id, or `undefined` when no ownership
 *   can be established (the callers fail closed exactly as before — the
 *   boot root is NEVER a fallback for unknown sessions).
 */
export function resolveOwningTeamRoot(domain, bootRootSessionId, sessionId) {
    const sid = String(sessionId);
    // (1) the boot root owns itself.
    if (sid === bootRootSessionId)
        return bootRootSessionId;
    // (2) the session IS a team root of this domain.
    if (domain.repositories.teamSessions !== undefined) {
        try {
            if (domain.repositories.teamSessions.get(sid) !== undefined)
                return sid;
        }
        catch {
            // a malformed root session id is not a team row — ownership stays
            // unresolved (fail closed)
        }
    }
    const isMemberOf = (teamRoot) => {
        for (const member of domain.repositories.memberInstances.list(teamRoot)) {
            if (String(member.childSessionId) === sid)
                return true;
        }
        return false;
    };
    // (3) a bound member child of this domain's teams: the boot root first,
    // then the other team roots of the domain.
    if (isMemberOf(bootRootSessionId))
        return bootRootSessionId;
    if (domain.repositories.teamSessions !== undefined) {
        try {
            for (const row of domain.repositories.teamSessions.list()) {
                const root = String(row.rootSessionId);
                if (root === bootRootSessionId || root === sid)
                    continue;
                if (isMemberOf(root))
                    return root;
            }
        }
        catch {
            // an unavailable listing leaves the ownership unresolved
        }
    }
    return undefined;
}
//# sourceMappingURL=team-session-ownership.js.map