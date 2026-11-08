/**
 * Alpha.5 P1-05 — the confined per-Member filesystem Provider.
 *
 * WHY A SUBCLASS AND NOT A NEW PROVIDER: the Member data plane must keep the
 * host Provider's exact semantics (atomic writes, version guards, symlink
 * handling, diff basis, watch) and add ONLY an admission decision. Inheriting
 * from the live Provider class — sampled from the running service, never
 * imported by name — gives that for free and keeps this lane free of any
 * upstream dependency (CORE PATCH BUDGET = 0, and no lockfile change).
 *
 * WHAT IT ENFORCES: every target-bearing method asks the compiled
 * {@link MemberPolicy} before delegating. `read*`/`listDir`/`stat`/`lstat`/
 * `watch` consult the read axis; `writeText`/`editText` consult the write axis
 * AND, when the target already exists, also require read coverage (`write ⇒
 * read`, the native read-then-write contract). The path identity check is
 * P1-03's `evaluateLocatorAccess`: authored containment first, then the
 * provider-resolved real path, so a symlink that escapes the authorized subtree
 * is refused even though its authored name is inside.
 *
 * `ask` IS A REFUSAL HERE (A5-DUAL-PLANE-01, 2026-11-05): the compiled lane can
 * carry the disposition `ask`, and this plane owns no approval consumer
 * (`resolveAskClassCall` is the designed seam and has no production caller), so
 * an ask-covered locator — authored or reached through an alias — throws the
 * typed `IO_ASK_REQUIRES_APPROVAL` BEFORE `super.<method>` runs. Refusing is the
 * fail-closed interim state; the alternative would be to treat the allow that
 * also covers the locator as an approval that was never requested or consumed.
 * Wiring real one-shot approval is BL-30's design, deliberately not done here.
 *
 * WHAT IT DOES NOT DO: it does not resolve or read anything itself (every
 * operation is `super.<method>`), does not REQUEST or CONSUME approvals, and
 * does not weaken the host Provider — a refusal is raised BEFORE the operation,
 * a permitted call behaves byte-for-byte like the base Provider, and the
 * per-call HOST policy it forwards is narrowed to at most this deployment's own
 * default mode (PD-17: the session's workspace root must survive, its
 * escalation must not).
 *
 * @module @dsh-agent-team/runtime/team-services/fs
 */
import { locatorWithinRuleSet } from '../../member-io-policy/src/path-rules.js';
import { NODE_PATH_IDENTITY_RESOLVER, evaluateLocatorAccess, } from '../../member-io-policy/src/provider-capabilities.js';
import { LifecycleAdmissionClosedError, memberAdmissionCloseOf } from '../../lifecycle/admission-state.js';
import { TeamIoDenial } from './types.js';
/** Host sandbox modes, strictest first — the ladder `hostPolicyOf` narrows on. */
const STRICTNESS = Object.freeze(['read-only', 'workspace-write', 'danger-full-access']);
/** The write half of the managed surface (everything else is read). */
const WRITE_METHODS = new Set(['writeText', 'editText']);
/**
 * Build the admission function for one Member. All checks are fail-closed:
 * a resolver failure, an unsupported destination or an uncovered target, a
 * write without read coverage, and a CLOSED lifecycle admission all throw a
 * typed refusal; there is no path that returns "allow" by omission.
 *
 * LIFECYCLE ADMISSION (PD20-B1, the measured `a5sf-recon-shell` defect): this
 * function is the ONE boundary in front of every Member execution face
 * (confined `fs` / `subprocess` / `terminals` / search / web), and it is the
 * only one a RUNNING Member's own turn passes through on its way to a new
 * child process or a new byte. So it is where "an archive/dispose has been
 * requested in this process" is enforced at the NEXT TOOL BOUNDARY: the close
 * stamp (`lifecycle/admission-state`, written by the live binding of the
 * lifecycle `AdmissionClosePort` step 1) refuses the call before any locator is
 * resolved — no spawn, no byte, no lane fact. Before this check existed, the
 * only consumer of the close was the Team tool-dispatch route, so a Member's own
 * turn kept obtaining new confined terminal sessions until it ended (measured
 * window 8.56 s / 8.72 s, a second `bash` 290/427 ms before the commit).
 */
export function createMemberFsGuard(policy, resolver = NODE_PATH_IDENTITY_RESOLVER) {
    return async function guard(method, hostPath) {
        // The lifecycle admission close comes FIRST: the lane decision is not even
        // taken for a Member whose archive/dispose has been requested, so there is
        // no allow fact to misread as "this Member was still operable".
        const closed = memberAdmissionCloseOf(policy.memberIdentity);
        if (closed !== undefined)
            throw new LifecycleAdmissionClosedError(closed, method, hostPath);
        const write = WRITE_METHODS.has(method);
        const lane = write ? policy.write : policy.read;
        const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: write ? 'write' : 'read', resolver });
        if (decision.decision !== 'allow') {
            throw new TeamIoDenial(decision.decision === 'deny'
                ? (write ? 'IO_WRITE_DENIED' : 'IO_READ_DENIED')
                // A5-DUAL-PLANE-01: `ask` is a decision, and this plane cannot consume
                // one (no approval seam is wired); it refuses with its OWN code rather
                // than borrowing the "unsupported" one. Reaching the base Provider here
                // would read bytes / change a file with no approval ever requested.
                : decision.decision === 'ask' ? 'IO_ASK_REQUIRES_APPROVAL' : 'IO_POLICY_UNSUPPORTED', decision.detail, { memberIdentity: policy.memberIdentity, method, target: hostPath });
        }
        if (!write)
            return;
        // write ⇒ read, but only for an EXISTING target: creating a brand-new file
        // has nothing to read, and the upstream read-before-write policy is
        // likewise conditioned on the file existing.
        const resolved = decision.resolved;
        let exists = true;
        try {
            await resolver.lstat(resolved);
        }
        catch (error) {
            // Only "no such file" means "nothing to read". Any other failure (EACCES,
            // ELOOP, a resolver fault) is NOT evidence of absence: refuse instead of
            // silently skipping the read-before-write requirement.
            if (error.code !== 'ENOENT') {
                throw new TeamIoDenial('IO_POLICY_UNSUPPORTED', `could not determine whether '${hostPath}' exists (${error instanceof Error ? error.message : String(error)}); write admission cannot be proven`, { memberIdentity: policy.memberIdentity, method, target: hostPath });
            }
            exists = false;
        }
        if (!exists)
            return;
        if (!locatorWithinRuleSet(policy.read, hostPath)) {
            throw new TeamIoDenial('IO_WRITE_REQUIRES_READ', `native ${method} must read '${hostPath}' before rewriting it, but the Member read axis does not cover it; write does not imply read`, { memberIdentity: policy.memberIdentity, method, target: hostPath });
        }
        const readDecision = await evaluateLocatorAccess({ lane: policy.read, locator: hostPath, access: 'read', resolver });
        if (readDecision.decision !== 'allow') {
            throw new TeamIoDenial('IO_WRITE_REQUIRES_READ', `native ${method} must read '${hostPath}' before rewriting it, and the read axis refused it (${readDecision.decision})`, { memberIdentity: policy.memberIdentity, method, target: hostPath });
        }
    };
}
/**
 * Create the confined Provider class for one Member: the live Provider class is
 * the base, every target-bearing method guards first and delegates second.
 * The returned constructor is mountable through Cordis (`ctx.plugin`) and
 * registers the same `fs` service name in the context it is mounted under.
 */
export function createConfinedFileSystemClass(Base, guard) {
    class TeamConfinedFileSystem extends Base {
        /** Guard one target-bearing call, then delegate to the base Provider. */
        async admitted(method, target) {
            const hostPath = this.processPath(target);
            await guard(method, hostPath);
            return hostPath;
        }
        async readText(target, signal) {
            await this.admitted('readText', target);
            return super.readText(target, signal);
        }
        async streamText(target, signal) {
            await this.admitted('streamText', target);
            return super.streamText(target, signal);
        }
        async readBytes(target, signal, maxBytes) {
            await this.admitted('readBytes', target);
            return super.readBytes(target, signal, maxBytes);
        }
        async readByteRange(target, range, signal) {
            await this.admitted('readByteRange', target);
            return super.readByteRange(target, range, signal);
        }
        async listDir(target, signal) {
            await this.admitted('listDir', target);
            return super.listDir(target, signal);
        }
        async stat(target, signal) {
            await this.admitted('stat', target);
            return super.stat(target, signal);
        }
        async lstat(path, opts, signal) {
            await guard('lstat', path);
            return super.lstat(path, opts, signal);
        }
        async watch(target, changed, signal) {
            await this.admitted('watch', target);
            return super.watch(target, changed, signal);
        }
        async writeText(target, content, expected, signal, policy) {
            await this.admitted('writeText', target);
            return super.writeText(target, content, expected, signal, this.hostPolicyOf(policy));
        }
        async editText(target, edit, expected, signal, policy) {
            await this.admitted('editText', target);
            return super.editText(target, edit, expected, signal, this.hostPolicyOf(policy));
        }
        /**
         * The per-call HOST policy, always NARROWED, never substituted (PD-17).
         *
         * WHY IT IS FORWARDED AT ALL: the host `write`/`edit` tools build a policy
         * from the CALLING SESSION (mode + the session workspace root) and hand it
         * to the provider on every mutation. Without it the base `fs-sandbox`
         * falls back to the DEPLOYMENT default root, which is not the session
         * workspace, so a write the Member lane had just admitted inside its own
         * ceiling was refused by the HOST fence (`FS_SANDBOX_DENIED` under
         * `workspace-write`) — measured live: Member A could read `workspace/lane-a`
         * but not write it. The Member ceiling is decided BEFORE this call and is
         * not re-derived here; this only restores the host fence's own root.
         *
         * WHY IT CANNOT WIDEN ANYTHING: the forwarded mode is the STRICTER of the
         * caller's mode and this deployment's default (`read-only` <
         * `workspace-write` < `danger-full-access`). An escalation stamp can
         * therefore never make the host fence weaker than this deployment's own
         * default, and it can never make the MEMBER lane admit a locator it refused
         * — that decision is already final. When the base provider exposes no
         * `sandboxMode` (not a sandboxing backend) the policy is forwarded
         * untouched: there is no deployment mode to narrow against.
         */
        hostPolicyOf(policy) {
            if (policy === undefined || policy === null || typeof policy !== 'object')
                return policy;
            const deployment = this.sandboxMode;
            if (typeof deployment !== 'string')
                return policy;
            const caller = policy.mode;
            if (typeof caller !== 'string')
                return policy;
            const narrowed = STRICTNESS.indexOf(caller) < STRICTNESS.indexOf(deployment) ? caller : deployment;
            return Object.freeze({ ...policy, mode: narrowed });
        }
    }
    return TeamConfinedFileSystem;
}
//# sourceMappingURL=fs.js.map