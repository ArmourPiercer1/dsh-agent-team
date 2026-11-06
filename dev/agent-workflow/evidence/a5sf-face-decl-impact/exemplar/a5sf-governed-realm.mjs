/**
 * a5sf-governed-realm.mjs — PROPOSAL (committed as evidence, NOT merged, NOT
 * installed). The smallest shipped provider that gives a Member the confined
 * `terminals` + confined `subprocess` faces.
 *
 * DROP-IN LOCATION: `packages/runtime/src/plugin/live/a5sf-governed-realm.mjs`
 * (its dist mirror `packages/runtime/dist/packages/runtime/src/plugin/live/`
 * is produced by the existing build; the package's `exports` map needs no new
 * entry as long as the composition row names the file, not a subpath).
 *
 * WHY A HOST ROW AND NOT A PRESET ROW: a preset plugin that supplies a service
 * must isolate the provider and all its consumers in the same realm; a service
 * consumed by host plugins belongs in the Host configuration. `teamA5sfRealm`
 * is read by the host glue (`host.ts` → `agent-bindings.mjs`) for every Member
 * it sets up, so it is a HOST row. The Member preset only decides WHICH shell
 * tools the model sees.
 *
 * WHAT IT DOES
 *   1. Parses the SAME product declaration the row understands
 *      (`a5sfMemberPolicies`'s shape) with the ONE shipped parser, so the
 *      policy half stays the single compiler's answer — this module never
 *      compiles a lane.
 *   2. Wraps that provider: every compiled Member answer gains
 *      `subprocess` (the realm's confined process spec, with the composition's
 *      declared shell class) and `terminal` (the PD-13 confined terminal face).
 *   3. Provides the result as `teamA5sfRealm`.
 *
 * WHAT IT GIVES UP — read this before declaring it (the same list is in
 * `governed-member-preset.patch.yml`):
 *   - THE NETWORK AXIS IS NOT DELIVERED. `network: deny` cannot reach this
 *     provider: `parseProductRealmDeclaration` refuses a narrowed network lane
 *     with `NETWORK_UNCONFINED_REALM` (measured: `impact-table.json`
 *     `probes.networkDenyRefusal`), because the realm it knows about installs
 *     no web face. So the shell this module delivers runs with the host
 *     network namespace. BL-42's netns is reachable only after that refusal
 *     learns about a composition-declared process face; that is a product code
 *     change in `product-assembly.ts`, not a config change.
 *   - NO PERSISTENT SHELL STATE. Each command is a fresh confined child:
 *     `cd`/`export` do not survive a call and there is no interactive stdin;
 *     `workdir` is the replacement for `cd`.
 *   - NO BACKGROUND JOBS. The confined terminal tool has no
 *     `run_in_background`, no per-call `timeoutMs` and no `sandbox_permissions`
 *     escalation; it answers a JSON string, not the transient tool's object.
 *   - NOT OS-ISOLATED BEYOND THE PROCESS FACE. The child runs under the
 *     confined subprocess face's Landlock profile; the kernel is the boundary
 *     for everything the admission did not name. A DYNAMIC read (`$(...)`,
 *     backticks, a `$VAR` path) is not lexically attributable and is not
 *     refused at admission (PD-13 arm C6).
 *
 * CORE PATCH BUDGET = 0: every import below is this repo's own module.
 *
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-governed-realm
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProductRealmProvider, parseProductRealmDeclaration } from '../../../team-services/src/product-assembly.js'
import { createConfinedProcessProvider } from '../../../sandbox-provider/provider.js'

export const name = 'a5sf-governed-realm'
/** `ctx.provide` needs nothing; the realm is read lazily by the host row. */
export const inject = []

/**
 * The one face this composition declares. The program is ABSOLUTE and the
 * shell class NAMES it: `installMemberIoProviders` refuses a terminal face
 * whose program is a PATH name (`TERMINALS_UNCONFINED_REALM`) or that the
 * subprocess face's shell class does not admit (same code). Both refusals are
 * the reason this block exists as data instead of prose.
 */
export const GOVERNED_FACE = Object.freeze({
  program: '/bin/bash',
  shellClass: Object.freeze({ programs: Object.freeze(['bash']) }),
  maxOutputBytes: 1 << 18,
  graceMs: 5_000,
})

/**
 * Mount the governed realm provider on the Host context.
 *
 * @param {object} ctx - the Host Cordis context (the row's own context).
 * @param {object} config - the row config.
 * @param {object} config.memberPolicies - the product declaration (the SAME
 *   shape `a5sfMemberPolicies` carries on the team row). REQUIRED: this module
 *   is not a policy source and refuses to invent one.
 * @param {string} config.blueprintSource - the row's bound blueprint (the
 *   declaration is reconciled against it by the ONE parser).
 * @param {string} config.realmId - the realm identity the provider pins into
 *   its proof/evidence rows.
 * @param {string} config.scratchRoot - a writable scratch root for the launcher.
 * @param {string} [config.launcherPath] - override; defaults to THIS package's
 *   own launcher, resolved from the module location (never a repo path).
 * @param {string} [config.pythonPath] - the interpreter the launcher runs under.
 */
export function apply(ctx, config = {}) {
  const declaration = config.memberPolicies
  if (declaration === undefined || declaration === null) {
    throw new TypeError('a5sf-governed-realm: config.memberPolicies is required (this row is not a policy source)')
  }
  if (typeof config.realmId !== 'string' || config.realmId.trim() === '') {
    throw new TypeError('a5sf-governed-realm: config.realmId is required (the provider pins it into its evidence rows)')
  }
  if (typeof config.scratchRoot !== 'string' || config.scratchRoot.trim() === '') {
    throw new TypeError('a5sf-governed-realm: config.scratchRoot is required (the confined launcher needs a scratch root)')
  }

  // The ONE declaration parser: reconciliation against the bound blueprint,
  // every typed refusal, and the compiled Member ceilings come from it. This
  // module adds FACES to its answer, never a second lane.
  const plan = parseProductRealmDeclaration(declaration, { blueprintSource: config.blueprintSource })
  const policyProvider = createProductRealmProvider(plan)

  const launcherPath = config.launcherPath ?? join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py',
  )
  if (!existsSync(launcherPath)) {
    throw new Error(`a5sf-governed-realm: the confined launcher is missing at ${launcherPath}; refusing to provide a face with no OS profile`)
  }

  // ONE provider per realm: probes are captured once per instance, and the
  // launcher bytes it names are the ones measured by `probe()`.
  const processProvider = createConfinedProcessProvider({
    realmId: config.realmId,
    trustRoot: config.trustRoot ?? null,
    scratchRoot: config.scratchRoot,
    assembly: {
      launcherPath,
      ...(config.pythonPath === undefined ? {} : { pythonPath: config.pythonPath }),
    },
  })

  const service = Object.freeze({
    /**
     * Answer the compiled objects for ONE admitted Member: the parser's
     * `members` unchanged, plus the two faces this composition declares.
     * `undefined` for an undeclared template (the row then mounts nothing —
     * the legacy path stays byte-identical for unmanaged Members).
     */
    compiledFor(rawMember) {
      const answer = policyProvider.compiledFor(rawMember)
      if (answer === undefined) return undefined
      const member = answer.members?.[0]
      const policy = member?.policy
      if (policy === undefined || policy.ok !== true) {
        // A Member with no compiled ceiling is refused by the installer; adding
        // a face here would only make the refusal less specific.
        return answer
      }
      return Object.freeze({
        ...answer,
        subprocess: Object.freeze({
          // The ceiling is the shell's lane: a shell is not a tool binding, so
          // there is no ToolRestriction term to intersect (the ONE compiler has
          // already produced this ceiling).
          effective: Object.freeze({
            memberIdentity: policy.value.memberIdentity,
            toolBindingIdentity: 'dsh.subprocess/exec',
            invocationId: `${policy.value.revision}:exec`,
            policyRevision: policy.value.revision,
            read: policy.value.read,
            write: policy.value.write,
            network: policy.value.network,
          }),
          provider: processProvider,
          realmId: config.realmId,
          bindingId: 'dsh.subprocess/exec',
          memberScope: policy.value.memberIdentity,
          // The COMPOSITION's declared shell class — forwarded verbatim to the
          // confined face's admission. The Member cannot widen it.
          shellClass: GOVERNED_FACE.shellClass,
        }),
        terminal: Object.freeze({
          program: GOVERNED_FACE.program,
          maxOutputBytes: GOVERNED_FACE.maxOutputBytes,
          graceMs: GOVERNED_FACE.graceMs,
        }),
      })
    },
  })

  ctx.provide('teamA5sfRealm', service)
}
