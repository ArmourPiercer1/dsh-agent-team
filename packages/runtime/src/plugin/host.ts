/**
 * P8-S5A — the shipped production plugin entry (plan §19.2, S5-PRE).
 *
 * The harness MOUNTS this entry as a Cordis plugin row and consumes the
 * `teamRoot` service it provides — the harness never builds a parallel
 * backend graph (frozen invariant: production root = single assembly
 * point, harness = consumer).
 *
 * Load path (S5-PRE): `tsc -p packages/runtime/tsconfig.build.json` emits
 * the plain-JS artifact `dist/packages/runtime/src/plugin/host.js`; the
 * DSH plugin loader imports that file with plain Node (no TS loader, no
 * `node --import`, no package-exports change). This module therefore:
 *
 *   - registers the upstream resolution hook at load (the glue bundle and
 *     the storage seam live in the worktree, OUTSIDE the DSH checkout —
 *     their bare `@deepseek-ai/*` imports resolve through the checkout's
 *     apps/cli workspace links; see ./upstream-resolver.mjs);
 *   - declares `inject` for the hard host services (`agents`,
 *     `storageDomain`, `sessions`) so the Loader defers this
 *     row's apply until the host provides them (the pre-S5A harness row
 *     injected the same set minus `sessionPersistence`, which it resolved
 *     lazily; R122 swapped the materialization seam — rc.1 removed
 *     `sessionPersistence.ensureMaterialized`, and the stock `sessions`
 *     service's `flush(session)` is the upstream ACP's own replacement,
 *     present in both eras); the entry still passes a lazy accessor under
 *     the frozen glue's `sessionPersistence` deps key so a pre-settle call
 *     fails with a stable code instead of a TypeError;
 *   - validates the row `config` LOUDLY (a composition mistake rejects the
 *     bootstrap — the driver sees the setup-failure evidence, never a
 *     half world);
 *   - loads the live-agent glue and the frozen legacy reader by URL
 *     (row-owned `config.glueUrl`; the legacy entry is compiled separately
 *     into the runtime dist mirror — see ./legacy-surface.js) and
 *     constructs the production root (./root.js) around the opened
 *     TeamDomain; the `import.meta.url`-derived URLs (the upstream
 *     resolver hook, the frozen legacy entry, and — when the row config
 *     carries no glueUrl/seamUrl — the location-derived glue/seam
 *     defaults) use a production-first layout-agnostic candidate search,
 *     so the SAME module also runs from TS source under the unit-test
 *     runner (fresh checkout, no dist) — the production world always hits
 *     the first (dist) candidate, which resolves to exactly the files the
 *     pre-candidate code computed;
 *   - provides `teamRoot` SYNCHRONOUSLY (before the first await) and arms
 *     one effect. A rejected apply fiber is absorbed into the Cordis
 *     logger — invisible to the harness — so EVERY setup failure (config,
 *     services, modules, domain, boot) rejects the facade's `ready`
 *     instead: the observability row awaits `ready` and maps the rejection
 *     to the setup-failure evidence. On row stop the live bundle + domain
 *     are closed (close() is idempotent).
 * @module @dsh-agent-team/runtime/plugin/host
 */
import { existsSync } from 'fs'
import { register } from 'module'
import { fileURLToPath } from 'url'

import { REMOTE_RPC_CHANNEL } from '../../../remote/src/handlers/register.js'
import type {
  ConnectionLike,
  RemoteRegistration,
} from '../../../remote/src/handlers/register.js'
import { resolveDurableMcpFacet } from '../../agent-setup/capability/index.js'
import { resolveDurableModelSelection } from '../../agent-setup/model/index.js'
import {
  createTeamDomain,
  openTeamDomain,
} from '../../../storage/repositories/index.js'
import type { TeamDomain } from '../../../storage/repositories/index.js'
import type { StorageDomainSeam } from '../../../storage/schema/index.js'
import type { LegacyInspectFn } from './legacy-surface.js'
import { createTeamProductionRoot } from './root.js'
import {
  TEAM_PLUGIN_ERROR_CODES,
  TeamPluginError,
} from './types.js'
import type {
  TeamAgentBindings,
  TeamPluginConfig,
  TeamPluginSeedMember,
  TeamProductionRoot,
} from './types.js'
import type { TeamToolSet } from '../../../tools/src/index.js'

/**
 * The structural projection of the Cordis plugin context this entry uses
 * (the concrete context is proxied by the loader; only these members are
 * consumed — plan §19.2 keeps the entry independent of the Cordis types).
 *
 * Exported under the stable name the P1-T4 baseline test pins; only the
 * member surface evolved (the production entry provides `teamRoot`
 * synchronously, arms exactly one effect, and reports a missing row
 * config through the facade's `ready` rejection).
 */
export interface TeamPluginHostContext {
  get(name: string): unknown
  provide(name: string, value: unknown): void
  effect(factory: () => () => void, label?: string): void
}

/** The durable-consumption surface the glue bundle reads off the domain. */
interface DomainConsumption {
  readonly model: {
    readonly resolveDurableModelSelection: typeof resolveDurableModelSelection
  }
  readonly capability: {
    readonly resolveDurableMcpFacet: typeof resolveDurableMcpFacet
  }
}

/** The frozen legacy reader entry as emitted into the runtime dist mirror. */
interface LegacyEntryModule {
  inspectLegacyTeam: LegacyInspectFn
}

/** The plain-JS glue module (config.glueUrl) export surface. */
interface GlueModule {
  createAgentBindings(deps: {
    readonly agents: unknown
    readonly sessionPersistence: unknown
    readonly domain: TeamDomain & { readonly consumption: DomainConsumption }
    readonly config: TeamPluginConfig
    readonly teamToolsRef: { current: unknown }
    readonly now: () => string
    /**
     * T12-M3 (optional additive): the DSH `subagents` public service,
     * structurally a superset of the glue's SubagentsDrainPort
     * (drainContinuableDescendants + listDescendants). Absent → the glue's
     * recursive drain fails closed with the typed
     * `recursive-drain-unavailable` (documented in the glue).
     */
    readonly subagents?: unknown
  }): TeamAgentBindings
}

/**
 * T12-M4 — the Remote mount outcome recorded on the facade. The state is
 * authoritative once the facade's `ready` promise settles: `mounted` when
 * the production wiring owns the `/team-remote` channel on the public
 * connection seam, `skipped` when the headless host provides no
 * `connection` service (the remote surface stays unmounted without
 * failing the boot). `undefined` means the bootstrap never reached the
 * mount step (an earlier failure).
 */
type RemoteMountState =
  | { readonly state: 'mounted'; readonly channel: string }
  | { readonly state: 'skipped'; readonly reason: string }

/**
 * Register the upstream resolution hook exactly once per process (a second
 * `module.register` would stack a duplicate hook in the resolution chain).
 *
 * Layout-agnostic candidate search, production layout FIRST:
 *
 *   1. the DIST mirror depth (the production world) — five up from
 *      `dist/packages/runtime/src/plugin/host.js` is
 *      `<worktree>/packages/runtime`, so the hook resolves to the
 *      source-tree `<worktree>/packages/runtime/src/plugin/upstream-resolver.mjs`
 *      — the EXACT file the pre-candidate code computed (tsc never copies
 *      the .mjs into the mirror). Production behavior is bit-identical.
 *   2. the SOURCE depth (reachable only under the unit-test runner) —
 *      four up from `src/plugin/host.ts` is the worktree root, so the SAME
 *      file as `<worktree>/packages/runtime/src/plugin/upstream-resolver.mjs`.
 *
 * The hook file is itself world-agnostic: upstream-resolver.mjs derives its
 * checkout candidates from its OWN path, which is identical for both
 * candidates — registering it from either layout is the same registration.
 *
 * Fail closed: if NO candidate resolves, the SAME error surface as the
 * pre-candidate single `register()` call — Node's ERR_MODULE_NOT_FOUND for
 * the missing hook (the first candidate's error is rethrown). No new stable
 * code, no silent fallback to a wrong file. The once-per-process flag is set
 * only AFTER a successful registration, so a failed registration cannot
 * poison later apply attempts.
 */
function registerUpstreamResolverOnce(): void {
  const g = globalThis as typeof globalThis & {
    __dshAgentTeamUpstreamResolverRegistered?: boolean
  }
  if (g.__dshAgentTeamUpstreamResolverRegistered === true) return
  const hookCandidates: readonly string[] = [
    // dist/.../src/plugin/host.js → five up = <worktree>/packages/runtime.
    '../../../../../src/plugin/upstream-resolver.mjs',
    // src/plugin/host.ts → four up = the worktree root.
    '../../../../packages/runtime/src/plugin/upstream-resolver.mjs',
  ]
  const errors: Array<unknown> = []
  for (const candidate of hookCandidates) {
    try {
      register(new URL(candidate, import.meta.url).href)
      g.__dshAgentTeamUpstreamResolverRegistered = true
      return
    } catch (error) {
      errors.push(error)
    }
  }
  // Fall-through is only reachable when EVERY candidate threw, so `errors`
  // is non-empty; rethrow the FIRST candidate's error — the exact error
  // surface of the pre-candidate single register() call.
  throw errors[0]
}

/**
 * Validate the row `config` channel loudly (plan §19.2: the row config is
 * the entry's ONLY input channel — a malformed composition must reject
 * apply, not degrade).
 * @param raw - the unvalidated `config:` of the row.
 * @returns the validated config.
 * @throws {TeamPluginError} TEAM_PLUGIN_CONFIG_INVALID with the failing field.
 */
export function validateTeamPluginConfig(raw: unknown): TeamPluginConfig {
  // NB: function declaration, not a const arrow — TypeScript 6.0.3 control
  // flow only treats a never-returning call as an abrupt completion when the
  // callee is a function declaration (or ambient declaration); never-typed
  // arrow const expressions do not narrow the guard below it (probe-verified
  // against this repo's toolchain, see dev evidence P8-S build notes).
  function fail(detail: string): never {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID,
      `dsh-agent-team row config: ${detail}`,
    )
  }
  const c = raw as (Partial<TeamPluginConfig> & Record<string, unknown>) | null
  if (c === null || typeof c !== 'object' || Array.isArray(c)) fail('must be a plain object')
  if (c.bootPhase !== 'create' && c.bootPhase !== 'resume') fail('bootPhase must be "create" or "resume"')
  if (typeof c.rootSessionId !== 'string' || c.rootSessionId.length === 0) fail('rootSessionId must be a non-empty string')
  if (typeof c.blueprintSource !== 'string' || c.blueprintSource.length === 0) fail('blueprintSource must be a non-empty string')
  if (typeof c.generation !== 'number' || !Number.isInteger(c.generation) || c.generation < 1) fail('generation must be a positive integer')
  if (c.defaultWorkspace !== undefined && typeof c.defaultWorkspace !== 'string') fail('defaultWorkspace must be a string when present')
  if (!Array.isArray(c.seedMembers)) fail('seedMembers must be an array')
  for (const seed of c.seedMembers as readonly TeamPluginSeedMember[]) {
    if (
      seed === null ||
      typeof seed !== 'object' ||
      typeof seed.instanceId !== 'string' ||
      typeof seed.templateId !== 'string' ||
      typeof seed.label !== 'string' ||
      typeof seed.childSessionId !== 'string'
    ) {
      fail('every seedMember needs instanceId/templateId/label/childSessionId strings')
    }
  }
  if (
    c.staticModel === null ||
    typeof c.staticModel !== 'object' ||
    typeof c.staticModel.provider !== 'string' ||
    typeof c.staticModel.model !== 'string'
  ) {
    fail('staticModel must be { provider, model } strings')
  }
  if (
    c.deniedSelection !== null &&
    (c.deniedSelection === undefined ||
      typeof c.deniedSelection !== 'object' ||
      Array.isArray(c.deniedSelection))
  ) {
    fail('deniedSelection must be a plain object or null')
  }
  if (
    c.mcpServer !== null &&
    (c.mcpServer === undefined ||
      typeof c.mcpServer !== 'object' ||
      typeof c.mcpServer.name !== 'string' ||
      (c.mcpServer.port !== null && typeof c.mcpServer.port !== 'number'))
  ) {
    fail('mcpServer must be { name, port: number|null } or null')
  }
  if (!Array.isArray(c.environmentFacts)) fail('environmentFacts must be an array')
  if (
    c.externalPolicyFacts === null ||
    typeof c.externalPolicyFacts !== 'object' ||
    c.externalPolicyFacts.hard === undefined ||
    typeof c.externalPolicyFacts.hard !== 'object' ||
    c.externalPolicyFacts.capabilityExists === undefined ||
    typeof c.externalPolicyFacts.capabilityExists !== 'object'
  ) {
    fail('externalPolicyFacts must be { hard, capabilityExists } maps')
  }
  if (
    c.glueUrl !== undefined &&
    (typeof c.glueUrl !== 'string' || c.glueUrl.length === 0)
  ) {
    fail('glueUrl must be a non-empty file URL string when present')
  }
  if (c.seamUrl !== undefined && typeof c.seamUrl !== 'string') fail('seamUrl must be a file URL string when present')
  return c as unknown as TeamPluginConfig
}

/**
 * The default live-agent glue URL, derived from this host entry's own
 * module location: the dist layout carries the byte-copied mirror
 * (place-dist-glue.mjs) next to the emitted host.js, and the source layout
 * carries the original .mjs next to host.ts — one relative specifier, both
 * layouts. An explicit `config.glueUrl` always wins.
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the derived glue file URL.
 */
export function defaultGlueUrl(hostModuleUrl: string): string {
  return new URL('./live/agent-bindings.mjs', hostModuleUrl).href
}

/**
 * The row config with the default-workspace derivation applied
 * (plugin-bundle-form D9): an explicit `config.defaultWorkspace` always
 * wins; when absent the team rows inherit the directory the operator
 * launched the host from. The machine-agnostic bundle row (root
 * `cordis.patch.yml`) can carry no absolute path, but the projection fold
 * REQUIRES a resolvable effective workspace on every team row (member row
 * workspace ?? team default ?? fail-closed ProjectionError — a created
 * team without one is unprojectable end-to-end), and the glue's own
 * `effectiveRootWorkspace` falls back to the same config value — so the
 * entry supplies the launch directory and both surfaces agree.
 * @param config - the validated row config.
 * @param launchCwd - the host process's working directory.
 * @returns the config with `defaultWorkspace` guaranteed present.
 */
export function withDefaultWorkspace(config: TeamPluginConfig, launchCwd: string): TeamPluginConfig {
  if (config.defaultWorkspace !== undefined) return config
  return { ...config, defaultWorkspace: launchCwd }
}

/**
 * The default storage-seam URL candidates, per module layout (the dist
 * entry sits five directory levels below the runtime package root —
 * `dist/packages/runtime/src/plugin` — the source entry two — the same
 * layout-agnostic candidate pattern as `loadLegacyInspect`). An explicit
 * `config.seamUrl` always wins.
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the candidate file URLs, dist layout first.
 */
export function defaultSeamUrlCandidates(hostModuleUrl: string): readonly string[] {
  return [
    new URL('../../../../../root-binding/harness/seam.mjs', hostModuleUrl).href,
    new URL('../../root-binding/harness/seam.mjs', hostModuleUrl).href,
  ]
}

/**
 * Pick the effective default seam URL: the first candidate that exists on
 * disk, or a fail-closed error naming every tried path (a missing
 * co-located seam is a build/install failure, not a fallback case).
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the file URL of the first existing candidate.
 * @throws {TeamPluginError} TEAM_PLUGIN_GLUE_UNAVAILABLE when no candidate exists.
 */
function resolveDefaultSeamUrl(hostModuleUrl: string): string {
  const candidates = defaultSeamUrlCandidates(hostModuleUrl)
  const found = candidates.find((candidate) => existsSync(fileURLToPath(candidate)))
  if (found === undefined) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
      `no "teamStorageSeam" service is provided and no default seam module was found (tried: ${candidates.join(' | ')})`,
    )
  }
  return found
}

/**
 * Load the frozen legacy reader entry through the layout-agnostic
 * candidate search (the relative specifiers are resolved against THIS
 * module's URL, so each candidate hits a different absolute file per
 * layout — see the inline rationale at the call site for the full
 * production-first candidate contract).
 *
 * Fail closed: if NO candidate loads, the SAME stable code as the
 * pre-candidate single-URL import (TEAM_PLUGIN_GLUE_UNAVAILABLE) — no new
 * error surface, no silent fallback to a wrong file.
 */
async function loadLegacyInspect(): Promise<LegacyInspectFn> {
  const legacyEntryCandidates: readonly string[] = [
    // dist/.../src/plugin/host.js → five up = <worktree>/packages/runtime
    // → the BUILT mirror file (the legacy package is noCheck-built
    // separately into the runtime dist mirror).
    '../../../../../dist/packages/legacy/session-reader/index.js',
    // src/plugin/host.ts → three up = <worktree>/packages → the
    // session-reader TS source location (the unit-test runner's .js→.ts
    // sibling hook loads the source module; a fresh checkout has no dist
    // by definition — the layout this candidate exists for).
    '../../../legacy/session-reader/index.js',
  ]
  const failures: string[] = []
  for (const candidate of legacyEntryCandidates) {
    try {
      const legacyEntry = (await import(candidate)) as LegacyEntryModule
      if (typeof legacyEntry.inspectLegacyTeam !== 'function') {
        throw new Error('the legacy entry does not export inspectLegacyTeam')
      }
      return legacyEntry.inspectLegacyTeam
    } catch (error) {
      failures.push(`${candidate}: ${String(error)}`)
    }
  }
  throw new TeamPluginError(
    TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
    `the frozen legacy reader entry could not be loaded: ${failures.join(' | ')}`,
  )
}

/**
 * The plugin name (Cordis named-export protocol; the row id is
 * `dsh-agent-team`).
 */
export const name = 'dsh-agent-team'

/**
 * The hard host service dependencies (Cordis inject protocol): the Loader
 * keeps this row INACTIVE until all three exist and applies it once they
 * do (the pre-S5A harness row injected the same set minus
 * `sessionPersistence`, which it resolved lazily — R122 swapped that seam:
 * rc.1 removed `sessionPersistence.ensureMaterialized`, and the stock
 * `sessions` service's `flush(session)` is the upstream ACP's own
 * replacement, present in both eras, so waiting on it can only ever delay,
 * never deadlock, the bootstrap). The entry still passes a LAZY accessor
 * under the frozen glue's `sessionPersistence` deps key so any call that
 * races the provider fails with a stable code instead of a TypeError.
 */
export const inject = ['agents', 'storageDomain', 'sessions']

/**
 * The plugin entry (Cordis named-export protocol: the loader awaits the
 * apply fiber). The apply body itself never rejects: it provides the
 * `teamRoot` facade synchronously and tracks every setup failure through
 * the facade's `ready` promise (a rejected apply fiber is absorbed into
 * the Cordis logger, which the harness never observes — `ready` is the
 * single observable failure channel).
 * @param ctx - the plugin context (services via `ctx.get`; this entry
 *   provides `teamRoot`).
 * @param config - the row `config:` (validated loudly; see
 *   {@link validateTeamPluginConfig}).
 */
export async function apply(ctx: TeamPluginHostContext, config?: unknown): Promise<void> {
  // The lazy materialization accessor (served to the frozen glue under its
  // `sessionPersistence` deps key as `ensureMaterialized`): resolved per
  // call so the first materialization — long after the stock host is fully
  // up — observes a settled service, not a concurrent profile load. R122:
  // rc.1 removed `sessionPersistence.ensureMaterialized`; the stock
  // `sessions` service's `flush(session)` is the upstream ACP's own
  // replacement (the attached log writer's flush materializes an empty
  // session durably) and is present in both the alpha.1 and rc.1 hosts.
  const sessionPersistence = {
    ensureMaterialized(session: unknown): Promise<unknown> {
      const svc = ctx.get('sessions') as
        | { flush?: (session: unknown) => Promise<unknown> }
        | null
        | undefined
      if (svc === undefined || svc === null || typeof svc.flush !== 'function') {
        throw new TeamPluginError(
          TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
          'the "sessions" public service is absent (or lacks flush) — it is resolved lazily per call and must be up before agent materialization runs',
        )
      }
      return svc.flush(session)
    },
  }

  // The bootstrap (config validation, resolver hook arming, services,
  // seam, domain, glue, legacy reader, root construction, boot) runs as
  // the tracked `ready` promise; its results are captured here so the
  // facade getters and the row-stop effect can close over them.
  let root: TeamProductionRoot | undefined
  let openDomain: TeamDomain | undefined
  // T12-M4: the remote registration set by the production mount inside
  // bootstrap (undefined until the mount step; disposed by the row-stop
  // backstop below).
  let remoteRegistration: RemoteRegistration | undefined
  let remoteMountState: RemoteMountState | undefined

  async function bootstrap(): Promise<TeamProductionRoot> {
    // A broken row must not arm the upstream resolution hook: validate the
    // row config first, then register the resolver exactly once per process.
    const validatedConfig = validateTeamPluginConfig(config)
    // D9: the launch-directory default workspace (explicit config wins).
    const rowConfig = withDefaultWorkspace(validatedConfig, process.cwd())
    registerUpstreamResolverOnce()

    const agents = ctx.get('agents')
    if (agents === undefined || agents === null) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        'the "agents" public service is absent from the plugin context',
      )
    }

  // --- the storage seam: injected service, or the real seam over the --------
  // --- DSH public storageDomain (the row-owned seamUrl module, or its -------
  // --- location-derived default) ---------------------------------------------
  let seam: StorageDomainSeam | undefined = ctx.get('teamStorageSeam') as
    | StorageDomainSeam
    | undefined
  if (seam === undefined || seam === null) {
    // Explicit config wins; otherwise the default seam module is derived
    // from this entry's own location (fail-closed when unresolvable).
    const seamUrl = rowConfig.seamUrl ?? resolveDefaultSeamUrl(import.meta.url)
    const storageDomain = ctx.get('storageDomain')
    if (storageDomain === undefined || storageDomain === null) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
        'the "storageDomain" public service is absent (required to build the seam from seamUrl)',
      )
    }
    const seamModule = (await import(seamUrl)) as {
      createRealStorageDomainSeam?: (storageDomain: unknown) => StorageDomainSeam
    }
    if (typeof seamModule.createRealStorageDomainSeam !== 'function') {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
        'the seamUrl module does not export createRealStorageDomainSeam',
      )
    }
    seam = seamModule.createRealStorageDomainSeam(storageDomain)
  }

  // --- the durable authority (A02): create stamps, open reopens ------------
  const domain: TeamDomain =
    rowConfig.bootPhase === 'create'
      ? await createTeamDomain(seam)
      : await openTeamDomain(seam)
  openDomain = domain

  // The glue reads the durable consumption resolvers off the domain
  // (attached here — the production root's mutation node exposes the same
  // pair, keeping ONE pair of resolvers process-wide).
  const domainFacade: TeamDomain & { readonly consumption: DomainConsumption } = {
    ...domain,
    consumption: {
      model: { resolveDurableModelSelection },
      capability: { resolveDurableMcpFacet },
    },
  }

  // --- the live-agent glue (plain JS, row-owned URL or the location-derived -
  // --- default; construction is side-effect free — every boot effect runs ---
  // --- inside live.boot()) ---------------------------------------------------
  const glueUrl = rowConfig.glueUrl ?? defaultGlueUrl(import.meta.url)
  let glue: GlueModule
  try {
    glue = (await import(glueUrl)) as GlueModule
  } catch (error) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
      `the glue module (${glueUrl}) could not be loaded: ${String(error)}`,
    )
  }
  if (typeof glue.createAgentBindings !== 'function') {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_GLUE_UNAVAILABLE,
      'the glue module does not export createAgentBindings',
    )
  }
  const teamToolsRef: { current: TeamToolSet | undefined } = { current: undefined }
  const live: TeamAgentBindings = glue.createAgentBindings({
    agents,
    sessionPersistence,
    domain: domainFacade,
    config: rowConfig,
    teamToolsRef,
    now: () => new Date().toISOString(),
    subagents: ctx.get('subagents'),
  })

  // --- the frozen legacy reader (A29): layout-agnostic candidate search, --
  // --- production layout FIRST; the root never imports the legacy sources
  // --- in the production world. Candidate 1 (dist mirror depth) resolves
  // --- to the EXACT built mirror file the pre-candidate code computed
  // --- (five up from dist/.../src/plugin/host.js = <worktree>/
  // --- packages/runtime → dist/packages/legacy/session-reader/index.js);
  // --- candidate 2 (source depth) is reachable only under the unit-test
  // --- runner, where it resolves to the session-reader TS source location
  // --- (the runner's .js→.ts sibling hook loads the source module). The
  // --- specifiers are relative (not file URLs) so that hook rewrite
  // --- applies; resolved from the DIST depth, candidate 2 points at the
  // --- same built mirror file as candidate 1, so a corrupted-mirror
  // --- production run still fails closed on the same file.
  const legacyInspect = await loadLegacyInspect()

  // --- the production root (the SINGLE assembly point, A01–A29 + seams) -----
  const builtRoot: TeamProductionRoot = createTeamProductionRoot({
    config: rowConfig,
    domain: domainFacade,
    storageSeam: seam,
    live,
    now: () => new Date().toISOString(),
    teamToolsRef,
    legacyInspect,
    // P8-S7-R4 A28: the DSH public sessionQuery service, resolved lazily
    // at handoff use time (absent in this host entry → the handoff source
    // surface fails closed exactly as the S5A boot world does).
    getSessionQuery: () => ctx.get('sessionQuery'),
  })
  root = builtRoot
  await builtRoot.boot()

  // --- T12-M4: the production Remote mount (the Remote contract v1
  // dispatcher onto the public connection seam, plan §20) --------------
  //
  // The web profile always provides the 'connection' public service, so
  // the mount is the production default there. A headless host provides
  // no such service: the remote surface stays UNMOUNTED and the boot
  // keeps succeeding (the durable domain and the agent tools work
  // without a remote surface) — the outcome is recorded on the facade,
  // never a boot throw. A PRESENT-but-malformed service is a boot
  // failure (fail closed: a broken web profile must not silently lose
  // the remote surface), as is a channel-conflict rejection (one owner
  // per channel).
  //
  // No adapter: the dispatcher answers with the frozen RemoteResponse
  // envelope — {ok:true, value:{data, provenance}} or {ok:false,
  // error:{code, message, details}} with `details` ALWAYS a present
  // object — which is structurally a ConnectionRpcResult<unknown>; the
  // DSH-shaped handler's extra `signal` argument is ignored by the
  // dispatcher (RemoteResponse ⊂ ConnectionRpcResult<unknown>).
  const connection = ctx.get('connection') as
    | ConnectionLike
    | null
    | undefined
  if (connection === undefined || connection === null) {
    remoteMountState = {
      state: 'skipped',
      reason: 'the "connection" public service is absent (headless host)',
    }
  } else if (
    typeof connection !== 'object' ||
    typeof connection.rpc !== 'object' ||
    connection.rpc === null ||
    typeof connection.rpc.handle !== 'function'
  ) {
    throw new TeamPluginError(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING,
      'the "connection" public service is malformed: expected connection.rpc.handle to be a function; a headless host should not provide a partial service',
    )
  } else {
    // The production root installs the registration seam during its
    // construction (A31); current() throws the seam's stable
    // not-installed code if that ever regresses (propagated as-is).
    const registerRemote = builtRoot.seams.remoteHandlerRegistration.current()
    let registration: RemoteRegistration
    try {
      registration = registerRemote(connection)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED,
        `the remote handler registration onto channel ${REMOTE_RPC_CHANNEL} failed (one owner per channel): ${message}`,
      )
    }
    remoteRegistration = registration
    remoteMountState = { state: 'mounted', channel: registration.channel }
  }
  return builtRoot
  }

  const ready: Promise<TeamProductionRoot> = bootstrap()
  // Mark the rejection handled even when no consumer attaches (the
  // observability row awaits `ready` through its own handler).
  void ready.catch(() => undefined)

  function requireRoot(): TeamProductionRoot {
    if (root === undefined) {
      throw new TeamPluginError(
        TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_NOT_READY,
        'teamRoot was read before the bootstrap settled (await `ready` first)',
      )
    }
    return root
  }

  // The `teamRoot` service — provided SYNCHRONOUSLY (before the first
  // await) so the consumer can observe every setup failure through
  // `ready`. The harness reads the other fields after `ready` settles;
  // the getters keep the facade live if the row is ever restarted against
  // the same root.
  const facade = {
    ready,
    get domain(): TeamDomain {
      return requireRoot().domain
    },
    get live(): TeamAgentBindings {
      return requireRoot().live
    },
    get tools(): TeamProductionRoot['tools'] {
      return requireRoot().tools
    },
    get control(): TeamProductionRoot['control'] {
      return requireRoot().control
    },
    get activity(): TeamProductionRoot['activity'] {
      return requireRoot().activity
    },
    get messaging(): TeamProductionRoot['messaging'] {
      return requireRoot().messaging
    },
    get config(): TeamPluginConfig {
      return requireRoot().config
    },
    get remote(): RemoteMountState | undefined {
      return remoteMountState
    },
  }
  ctx.provide('teamRoot', facade)

  // Row-stop backstop: settle the bootstrap (if it is still running), then
  // close the live bundle + the durable domain (idempotent; the observability
  // row may also close live — the root's close() is idempotent). When the
  // bootstrap failed before the root was built, close the domain directly.
  ctx.effect(
    () => () => {
      void ready
        .catch(() => undefined)
        .then((settled) => {
          // T12-M4: release the /team-remote channel ownership first (the
          // disposer must never fail the row teardown — the underlying
          // DSH effect disposal runs in the connection fiber).
          try {
            remoteRegistration?.dispose()
          } catch {
            // a throwing disposer is swallowed: the row teardown proceeds
          }
          if (settled !== undefined) {
            void settled.close().catch(() => undefined)
          } else if (openDomain !== undefined) {
            void openDomain.close().catch(() => undefined)
          }
        })
    },
    'dsh-agent-team production cleanup',
  )
}
