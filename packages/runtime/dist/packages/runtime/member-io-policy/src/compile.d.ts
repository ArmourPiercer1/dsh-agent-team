/**
 * Alpha.5 P1-02 — the MemberPolicy / EffectiveIo compiler.
 *
 * WHAT THIS MODULE IS: the ONE place where the two authoring facts (the v4
 * Member ceiling, P1-01, and the v4 per-tool I/O restriction) become the
 * single per-invocation hard ceiling the FS / Web / Subprocess consumers
 * obey. It is PURE: no I/O, no clock, no mutation of its inputs, no re-reading
 * of Alpha.4 approval state (that arrives as `Alpha4EffectiveAuthority`).
 *
 * WHAT IT IS NOT: it never GRANTS anything. `ask`, a one-shot approval or an
 * `approvedOnce: true` invocation can only live INSIDE the compiled ceiling;
 * nothing here can widen a ceiling. A ceiling change is a different operation
 * (an explicitly authorized policy revision producing a new `revision`).
 *
 * FAIL-CLOSED LAWS (all machine-checked by `test/a5sf-member-policy.test.ts`):
 *  - an undeclared Member ceiling compiles to a TYPED REFUSAL, never to a
 *    synthesized `read: all` (absence is not permission);
 *  - `network: restricted` is UNSUPPORTED this round, never coerced;
 *  - a stale instance generation / mismatched policy revision / mismatched
 *    member identity / tool binding is refused, never "repaired";
 *  - read and write are INDEPENDENT: a write-only grant never implies read.
 *
 * @module @dsh-agent-team/runtime/member-io-policy/compile
 */
import { projectV4ToolBindingAuthoring } from '../../../domain/vnext-field-mapping/src/index.js';
import type { CompileInput, CompileResult, EffectiveIoPolicy, InvocationAuthority, MemberPolicy, ToolIoRestriction } from './types.js';
/**
 * Compile the LEFT factor: one trusted Member → its hard I/O ceiling.
 *
 * The trusted input is consumed, never derived: no field of the ceiling can
 * be inferred from a tool owner, an argv value, a cwd string or a UI label.
 */
export declare function compileMemberPolicy(input: CompileInput): CompileResult<MemberPolicy>;
/**
 * Compile the per-invocation policy:
 *   EffectiveIo ⊆ MemberCeiling(member) ∩ ToolRestriction(member, tool).
 *
 * The invocation is BOUND, not trusted loosely: a call minted for another
 * member, another policy revision or another tool binding is refused.
 */
export declare function compileEffectiveIo(member: MemberPolicy, tool: ToolIoRestriction, invocation: InvocationAuthority): CompileResult<EffectiveIoPolicy>;
/**
 * Project one v4 tool binding into the RIGHT factor of the two-axis policy.
 *
 * A `mode: all` lane becomes `'no-additional-narrowing'` ONLY when its `deny`
 * list is EMPTY — an all-lane with no deny declares no path at all, so it can
 * neither widen nor narrow anything. An all-lane that DOES carry a deny is a
 * real restriction: v4 makes `deny` a REQUIRED field of the all form, so
 * collapsing it to the identity sentinel would silently DROP the deny and let
 * the tool read/write the denied subtree through the wider lane. That shape is
 * projected as its `PathRuleSet` (`mode: 'all'`, deny kept), so
 * `intersectPathRuleSets` — which unions deny on both axes — is what binds.
 *
 * Nothing downstream needs a new shape for it: `matchLocator`,
 * `locatorWithinRuleSet` and `intersectPathRuleSets` already read
 * `mode: 'all'` with deny precedence, and the effective lane stays
 * `restricted` whenever the Member ceiling is restricted (the normal case).
 * A `restricted` network lane becomes the typed `'unsupported'` this round,
 * never a boolean guess.
 *
 * FAIL-CLOSED: if a future consumer could not represent an all-lane + deny, the
 * right answer is the existing typed refusal — never this collapse. No branch
 * of this function turns a non-empty deny into the identity.
 */
export declare function projectToolIoRestriction(binding: Parameters<typeof projectV4ToolBindingAuthoring>[1]): CompileResult<ToolIoRestriction>;
//# sourceMappingURL=compile.d.ts.map