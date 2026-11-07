/**
 * a5sf-governed-realm.mjs — the SHIPPED governed Member realm provider
 * (owner-ruled governed preset, 2026-11-11).
 *
 * WHAT THIS IS. The product half of the governed Member preset: a
 * `{ compiledFor }` provider (the `teamA5sfRealm` shape the product row already
 * consumes) that answers, for ONE admitted Member, the SAME compiled objects the
 * product assembly produces PLUS the two confined faces this composition
 * declares — the confined `subprocess` face and PD-13's confined `terminals`
 * face. It is the shipped replacement for the evidence exemplar
 * (`dev/agent-workflow/evidence/a5sf-face-decl-impact/exemplar/`), and the
 * difference is the ONE thing the owner ruling demands: it reads the REAL Team
 * facts instead of config literals.
 *
 * WHERE EVERY FACT COMES FROM (no static exemplar value survives):
 *   - BOUND BLUEPRINT — `resolveBoundBlueprint(teamRootSessionId)`, the booted
 *     Host's OWN BP-F resolver (`packages/runtime/src/plugin/bound-blueprint.ts`
 *     — a bound ref resolves through the live authority and NEVER the row
 *     anchor). The provider never parses a `blueprintSource` itself, so it can
 *     neither duplicate nor override the Team's blueprint.
 *   - AUTHORITY — `readAuthority({ teamSessionId, memberInstanceId, templateId })`
 *     supplied by the Host: the durable Alpha.4 authority generation (the SAME
 *     number the A5-M1 reader hands the tool Guard, i.e. the generation this
 *     Agent actually stands on) and the durable MemberInstance admission state.
 *     The `{ revision, admitted }` reference is consumed verbatim by the ONE
 *     compiler; this module never evaluates an approval and never mints one.
 *   - MEMBER IDENTITY / GENERATION — the descriptor the row hands `compiledFor`
 *     (`instanceId`, `templateId`, `teamRootSessionId`, resolved by
 *     `resolveConsumptionViews` from the durable roster) plus the SAME durable
 *     authority generation above. No `instanceGeneration: 1`, no
 *     `authority.admitted: true` literal exists in this file.
 *   - POLICY LANES — `deriveProductRealmPlanFromBlueprint` →
 *     `parseProductRealmDeclaration` → `compileMemberPolicy`: the ONE product
 *     parser/compiler/reconciliation, with the ALREADY-RESOLVED blueprint handed
 *     in. This module adds FACES to that answer; it compiles no lane of its own
 *     and introduces no second policy source.
 *
 * ENABLEMENT. The composition enables it with the neutral row key
 * `a5sfGovernedRealm: true` (`A5SF_GOVERNED_REALM_KEY`): the row then compiles
 * nothing and this provider is the ONLY compiled-realm source. A row that also
 * carries `a5sfMemberPolicies` / `a5sfMemberAuthority` is refused as the "two
 * compiled-realm sources" fork (`a5sf-realm-row.mjs`), and a governed row with no
 * provider refuses at mount rather than silently giving the Member no realm.
 *
 * WHAT THIS DOES **NOT** DELIVER (the same disclosures as the preset itself; see
 * `dev/agent-workflow/evidence/a5sf-governed-preset/README.md`):
 *   - NETWORK: the confined child runs with the HOST network namespace. The
 *     ceiling cannot say `deny` — the product declaration path refuses a
 *     narrowed network lane with `NETWORK_UNCONFINED_REALM` before any realm
 *     exists — so this provider never requests a netns, and BL-42's proof is
 *     NOT claimed here (PD-15's face binding forbids reusing it for Web).
 *   - NO PERSISTENT SHELL: every command is a fresh confined child
 *     (`cd`/`export` do not survive a call; no interactive stdin).
 *   - NO BACKGROUND JOBS / TIMEOUT / ESCALATION: the confined terminal tool
 *     registers `bash` with `command`/`description`/`workdir` only.
 *   - DYNAMIC READS (`$(...)`, backticks, `$VAR`-assembled paths) are not
 *     lexically attributable and are not refused at admission (PD-13 arm C6).
 *   - WORKSPACE / SCRATCH ISOLATION IS NOT TEAM-SCOPED here (`NOT_WIRED`): the
 *     scratch root is one deployment-level directory, not a per-Team subtree.
 *
 * CORE PATCH BUDGET = 0: every import is this repo's own module.
 *
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-governed-realm
 */
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createProductRealmProvider,
  deriveProductRealmPlanFromBlueprint,
} from '../../../team-services/src/product-assembly.js'
import { TeamServiceInstallError } from '../../../team-services/src/types.js'
import { createConfinedProcessProvider } from '../../../sandbox-provider/provider.js'

/** The realm identity this preset pins into its capability/evidence rows. */
export const GOVERNED_REALM_ID = 'a5sf-governed-member'

/** The tool binding the confined shell executes under. */
export const GOVERNED_SHELL_BINDING = 'dsh.subprocess/exec'

/**
 * The composition's declared shell face. `program` is ABSOLUTE and the shell
 * class NAMES it: `installMemberIoProviders` refuses a terminal face whose
 * program is a PATH name (`TERMINALS_UNCONFINED_REALM`) or that the subprocess
 * face's shell class does not admit. The Member can never widen either.
 */
export const GOVERNED_FACE = Object.freeze({
  program: '/bin/bash',
  shellClass: Object.freeze({ programs: Object.freeze(['bash']) }),
  maxOutputBytes: 1 << 18,
  graceMs: 5_000,
})

/**
 * The durable MemberInstance lifecycles that ARE an admission.
 *
 * `CREATED` (identity durably committed), `RUNNING` (an admitted turn exists)
 * and `SETTLED` (work finished, identity/child session preserved) are live
 * members of the active work set. `ARCHIVED` and `DISPOSED` are NOT: an archived
 * member "left the main active work set" and a disposed one is terminal, so the
 * governed realm must refuse to compile for either — that refusal is what
 * "revoked on Member lifecycle" means at this layer.
 */
export const GOVERNED_ADMITTED_LIFECYCLES = Object.freeze(['CREATED', 'RUNNING', 'SETTLED'])

/**
 * Build the Alpha.4 authority reference from the TWO durable facts the Host
 * reads: the permission-overlay GENERATION (the highest-generation snapshot —
 * the port's own `latest()` law, and the SAME number the A5-M1 reader hands the
 * tool Guard) and the durable MemberInstance lifecycle.
 *
 * This is the ONE place the mapping lives, so the Host wiring and the tests read
 * the same rule. `generation` is validated by the caller (a non-integer is a
 * read fault, never a default). The reference is CONSUMED verbatim by the
 * compiler: it grants nothing.
 */
export function governedAuthorityReference({ generation, lifecycle }) {
  const admitted = GOVERNED_ADMITTED_LIFECYCLES.includes(lifecycle)
  return Object.freeze({
    revision: `a4:overlay-generation:${String(generation)}`,
    admitted,
    instanceGeneration: generation,
  })
}

function fail(code, detail, path) {
  throw new TeamServiceInstallError(code, detail, path)
}

function nonBlank(value) {
  return typeof value === 'string' && value.trim() !== ''
}

/** The launcher this package ships, resolved from THIS module (never a repo path). */
function defaultLauncherPath() {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '..', '..', '..', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py',
  )
}

/**
 * Build the governed provider.
 *
 * @param {object} options
 * @param {string} options.realmId - the realm identity pinned into the face.
 * @param {string} options.scratchRoot - a writable scratch root for the launcher.
 * @param {(teamRootSessionId: string) => unknown | Promise<unknown>} options.resolveBoundBlueprint
 *   The Host's BP-F resolver. REQUIRED: without it there is no authority-bearing
 *   blueprint and the provider refuses rather than deriving from a row anchor.
 * @param {(input: { teamSessionId: string, memberInstanceId: string, templateId: string }) => unknown | Promise<unknown>} options.readAuthority
 *   The durable Alpha.4 authority read. REQUIRED. Must answer
 *   `{ revision: <non-blank string>, admitted: <boolean>, instanceGeneration: <non-negative integer> }`.
 * @param {string} [options.trustRoot] - the launcher trust root (default null).
 * @param {string} [options.program] - admitted shell program (default `/bin/bash`).
 * @param {{ programs: readonly string[] }} [options.shellClass] - declared shell class.
 * @param {number} [options.maxOutputBytes] - bounded per-command output.
 * @param {number} [options.graceMs] - grace before the confined child is killed.
 * @param {string} [options.launcherPath] - override; defaults to this package's launcher.
 * @param {string} [options.pythonPath] - interpreter for the launcher.
 * @param {object} [options.processProvider] - an ALREADY-BUILT confined process
 *   provider (tests only: a double must be labelled as one by its caller).
 * @returns {{ compiledFor(member: unknown): Promise<object | undefined> }}
 */
export function createGovernedRealmProvider(options = {}) {
  const {
    realmId,
    scratchRoot,
    resolveBoundBlueprint,
    readAuthority,
    trustRoot = null,
    processProvider: injectedProcessProvider,
    launcherPath: launcherOverride,
    pythonPath,
    program = GOVERNED_FACE.program,
    shellClass = GOVERNED_FACE.shellClass,
    maxOutputBytes = GOVERNED_FACE.maxOutputBytes,
    graceMs = GOVERNED_FACE.graceMs,
  } = options

  if (!nonBlank(realmId)) {
    fail('REALM_DECLARATION_INVALID', 'a5sf-governed-realm: options.realmId is required (the provider pins it into its capability rows)', 'realmId')
  }
  if (!nonBlank(scratchRoot)) {
    fail('REALM_DECLARATION_INVALID', 'a5sf-governed-realm: options.scratchRoot is required (the confined launcher needs a writable scratch root)', 'scratchRoot')
  }
  if (typeof resolveBoundBlueprint !== 'function') {
    fail('MEMBER_POLICY_WITHOUT_BLUEPRINT', 'a5sf-governed-realm: options.resolveBoundBlueprint is required (the governed realm derives its ceilings from the Team\'s BOUND blueprint; a provider with no resolver has no authority-bearing blueprint)', 'resolveBoundBlueprint')
  }
  if (typeof readAuthority !== 'function') {
    fail('REALM_DECLARATION_INVALID', 'a5sf-governed-realm: options.readAuthority is required (the Alpha.4 authority reference is READ from the live authority, never supplied as a literal)', 'readAuthority')
  }

  const launcherPath = launcherOverride ?? defaultLauncherPath()
  let processProvider = injectedProcessProvider
  if (processProvider === undefined) {
    if (!existsSync(launcherPath)) {
      fail(
        'SUBPROCESS_UNCONFINED_REALM',
        `a5sf-governed-realm: the confined launcher is missing at ${launcherPath}; refusing to provide a face with no OS profile`,
        'launcherPath',
      )
    }
    // ONE provider per realm: probes are captured once per instance, and the
    // launcher bytes it names are the ones it measured.
    processProvider = createConfinedProcessProvider({
      realmId,
      trustRoot,
      scratchRoot,
      assembly: {
        launcherPath,
        ...(pythonPath === undefined ? {} : { pythonPath }),
      },
    })
  }

  return Object.freeze({
    /**
     * Answer the compiled objects for ONE admitted Member.
     *
     * ASYNC by design: the bound blueprint and the Alpha.4 authority are LIVE
     * reads (the row awaits `compiledFor`), so the numbers this compiles under
     * are the ones the Team is bound to at attach time — never a config
     * snapshot taken at row-assembly time.
     *
     * @param {unknown} rawMember - the row's Member descriptor.
     * @returns {Promise<object | undefined>} the compiled answer (plus the two
     *   faces), or `undefined` when the template is UNMANAGED.
     */
    async compiledFor(rawMember) {
      const member = rawMember
      if (typeof member !== 'object' || member === null || Array.isArray(member)) {
        fail('MEMBER_IDENTITY_INVALID', 'a5sf-governed-realm: compiledFor needs the row\'s Member descriptor record; a ceiling cannot bind an unknown identity', 'member')
      }
      const { instanceId, templateId, teamRootSessionId, sessionId } = member
      if (!nonBlank(instanceId)) {
        fail('MEMBER_IDENTITY_INVALID', 'a5sf-governed-realm: the Member descriptor carries no instanceId; a ceiling cannot bind an unknown identity', 'member.instanceId')
      }
      if (!nonBlank(templateId)) {
        fail('MEMBER_IDENTITY_INVALID', `a5sf-governed-realm: Member '${instanceId}' carries no templateId; a declared ceiling is a TEMPLATE fact and cannot be guessed`, 'member.templateId')
      }
      const teamSessionId = nonBlank(teamRootSessionId) ? teamRootSessionId : sessionId
      if (!nonBlank(teamSessionId)) {
        fail('MEMBER_IDENTITY_INVALID', `a5sf-governed-realm: Member '${instanceId}' carries no team root session; the bound blueprint cannot be resolved`, 'member.teamRootSessionId')
      }

      // THE REAL BOUND BLUEPRINT. A resolver that throws or answers nothing is a
      // refusal, never a fallback to a row anchor (the B1 boot-fallback hole).
      let blueprint
      try {
        blueprint = await resolveBoundBlueprint(teamSessionId)
      } catch (error) {
        fail(
          'MEMBER_POLICY_WITHOUT_BLUEPRINT',
          `a5sf-governed-realm: the Team's bound blueprint could not be resolved for '${teamSessionId}' (${error instanceof Error ? error.message : String(error)}); the governed realm never derives from an unresolvable binding`,
          'resolveBoundBlueprint',
        )
      }
      if (blueprint === undefined || blueprint === null) {
        fail(
          'MEMBER_POLICY_WITHOUT_BLUEPRINT',
          `a5sf-governed-realm: the Team '${teamSessionId}' has no bound blueprint; there is no authority-bearing blueprint to derive a Member ceiling from`,
          'resolveBoundBlueprint',
        )
      }

      // THE REAL ALPHA.4 AUTHORITY. Read per attach (not captured at assembly).
      let authority
      try {
        authority = await readAuthority({ teamSessionId, memberInstanceId: instanceId, templateId })
      } catch (error) {
        fail(
          'REALM_DECLARATION_INVALID',
          `a5sf-governed-realm: the Alpha.4 authority could not be read for Member '${instanceId}' (${error instanceof Error ? error.message : String(error)}); a realm never compiles on an unread authority`,
          'readAuthority',
        )
      }
      if (typeof authority !== 'object' || authority === null) {
        fail('REALM_DECLARATION_INVALID', `a5sf-governed-realm: the Alpha.4 authority read for Member '${instanceId}' answered no record; a realm never compiles on an unread authority`, 'readAuthority')
      }
      const { revision, admitted, instanceGeneration } = authority
      if (!nonBlank(revision)) {
        fail('REALM_DECLARATION_INVALID', `a5sf-governed-realm: the authority reference for Member '${instanceId}' has no revision; the compiler consumes it verbatim and this module never invents one`, 'authority.revision')
      }
      if (typeof admitted !== 'boolean') {
        fail('REALM_DECLARATION_INVALID', `a5sf-governed-realm: the authority reference for Member '${instanceId}' has no boolean admission fact`, 'authority.admitted')
      }
      if (!Number.isInteger(instanceGeneration) || instanceGeneration < 0) {
        fail('MEMBER_IDENTITY_INVALID', `a5sf-governed-realm: the authority read for Member '${instanceId}' answered no non-negative integer generation; a stale/unknown generation is never defaulted`, 'authority.instanceGeneration')
      }

      // ONE COMPILER, REAL INPUTS: the resolved bound blueprint + the live
      // authority + the Member's actual generation. Reconciliation, the closed
      // v4 vocabulary and every typed refusal are the product assembly's own.
      const plan = deriveProductRealmPlanFromBlueprint({
        blueprint,
        authority: Object.freeze({ revision, admitted }),
        instanceGenerations: Object.freeze({ [templateId]: instanceGeneration }),
      })
      const compiled = createProductRealmProvider(plan).compiledFor(member)
      if (compiled === undefined) return undefined

      const compiledMember = Array.isArray(compiled.members) ? compiled.members[0] : undefined
      const policy = compiledMember === undefined ? undefined : compiledMember.policy
      if (policy === undefined || policy.ok !== true) {
        // An uncompiled ceiling is refused by the installer; adding faces here
        // would only make the refusal less specific.
        return compiled
      }
      // IDENTITY BINDING: the compiled answer must describe the Member the row
      // named, at the generation the authority reported. The compiler already
      // enforces this; re-asserting here makes a provider-side substitution
      // impossible rather than merely unlikely.
      if (compiledMember.identity.memberInstanceId !== instanceId || compiledMember.identity.instanceGeneration !== instanceGeneration) {
        fail(
          'MEMBER_IDENTITY_UNTRUSTED',
          `a5sf-governed-realm: the compiled ceiling describes '${String(compiledMember.identity.memberInstanceId)}' at generation ${String(compiledMember.identity.instanceGeneration)}, but this attach is '${instanceId}' at generation ${String(instanceGeneration)}`,
          'compiledFor',
        )
      }

      const effective = policy.value
      return Object.freeze({
        ...compiled,
        subprocess: Object.freeze({
          // A shell is not a tool binding, so there is no ToolRestriction term to
          // intersect: the ceiling the ONE compiler produced IS the shell lane.
          effective: Object.freeze({
            memberIdentity: effective.memberIdentity,
            toolBindingIdentity: GOVERNED_SHELL_BINDING,
            invocationId: `${effective.revision}:exec`,
            policyRevision: effective.revision,
            read: effective.read,
            write: effective.write,
            network: effective.network,
          }),
          provider: processProvider,
          realmId,
          bindingId: GOVERNED_SHELL_BINDING,
          memberScope: effective.memberIdentity,
          shellClass,
        }),
        terminal: Object.freeze({
          program,
          maxOutputBytes,
          graceMs,
        }),
      })
    },
  })
}
