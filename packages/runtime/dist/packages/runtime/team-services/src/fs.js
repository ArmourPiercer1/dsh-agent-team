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
 * WHAT IT DOES NOT DO: it does not resolve or read anything itself (every
 * operation is `super.<method>`), does not know about tools or approvals, and
 * does not weaken the host Provider — a refusal is raised BEFORE the operation,
 * a permitted call behaves byte-for-byte like the base Provider.
 *
 * @module @dsh-agent-team/runtime/team-services/fs
 */
import { locatorWithinRuleSet } from '../../member-io-policy/src/path-rules.js';
import { NODE_PATH_IDENTITY_RESOLVER, evaluateLocatorAccess, } from '../../member-io-policy/src/provider-capabilities.js';
import { TeamIoDenial } from './types.js';
/** The write half of the managed surface (everything else is read). */
const WRITE_METHODS = new Set(['writeText', 'editText']);
/**
 * Build the admission function for one Member. All checks are fail-closed:
 * a resolver failure, an unsupported destination, an uncovered target or a
 * write without read coverage all throw a typed {@link TeamIoDenial}; there is
 * no path that returns "allow" by omission.
 */
export function createMemberFsGuard(policy, resolver = NODE_PATH_IDENTITY_RESOLVER) {
    return async function guard(method, hostPath) {
        const write = WRITE_METHODS.has(method);
        const lane = write ? policy.write : policy.read;
        const decision = await evaluateLocatorAccess({ lane, locator: hostPath, access: write ? 'write' : 'read', resolver });
        if (decision.decision !== 'allow') {
            throw new TeamIoDenial(decision.decision === 'deny' ? (write ? 'IO_WRITE_DENIED' : 'IO_READ_DENIED') : 'IO_POLICY_UNSUPPORTED', decision.detail, { memberIdentity: policy.memberIdentity, method, target: hostPath });
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
            // The caller's `policy` argument is deliberately NOT forwarded: it can only
            // weaken the host fence (e.g. `danger-full-access`) and the Member ceiling
            // has already decided this write. The base provider's own default applies.
            void policy;
            return super.writeText(target, content, expected, signal);
        }
        async editText(target, edit, expected, signal, policy) {
            await this.admitted('editText', target);
            void policy;
            return super.editText(target, edit, expected, signal);
        }
    }
    return TeamConfinedFileSystem;
}
//# sourceMappingURL=fs.js.map