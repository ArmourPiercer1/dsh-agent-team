/**
 * FamilyAssembly descriptor — the SEARCH family (grep + glob rows).
 *
 * Moved VERBATIM out of `team-tool-plane.mjs` (u7-w0b S3): the anchored
 * search/glob backend construction, the row build over the assembly-injected
 * a5p5 transport face, and the closed-schema contribution. The plane only
 * drives this descriptor through the generic seam
 * (`runtime/src/plugin/live/family-assembly.mjs`); it no longer names the
 * family, its modules or its config key.
 *
 * @module tools/families/search
 */
import { createAnchoredSearchBackend } from '../search-family/src/search-mechanics.mjs'
import { createAnchoredGlobBackend } from '../search-family/src/glob-backend.mjs'
import { buildSearchRowDefinitions, buildSearchContribution } from '../search-family/src/index.mjs'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.search-family',
  order: 30,
  placement: 10,
  config: Object.freeze({ globEnabled: 'boolean' }),
  claims: (cap) => [cap.names.grep, cap.names.glob],
  enabled: () => true,
  disabledOwned: () => [],
  backends(cap) {
    const { realmId, fsInstance, confinedCfg, logBackend, createShutBackend, injected } = cap
    const globEnabled = cap.planeConfig.globEnabled !== false
    const shut = createShutBackend('a5-effect-face-pending')
    const realSearch = fsInstance !== null && typeof fsInstance.rootDir === 'string'
      ? createAnchoredSearchBackend({
        realmId,
        rootDir: fsInstance.rootDir,
        confined: confinedCfg,
        observe: logBackend('a5g7-search'),
      })
      : null
    // `globEnabled:false` builds NO glob backend at all — the row is the
    // existing typed shut face, never the rg row, so nothing can spawn.
    const realGlob = globEnabled === false ? null
      : fsInstance !== null && typeof fsInstance.rootDir === 'string' && confinedCfg !== null
      ? createAnchoredGlobBackend({
        realmId,
        rootDir: fsInstance.rootDir,
        confined: confinedCfg,
        templateId: cap.templateId,
        instanceId: cap.instanceId,
        observe: logBackend('a5glb-glob'),
      })
      : null
    // The disabled form's shut face WINS over the kit `backends` injection
    // seam: the mount gate is config law, not wiring.
    const globDisabledShut = globEnabled === false ? createShutBackend('a5-glob-config-disabled') : null
    // Kit-compat law (a5p5 register.ts — globBackend ABSENT reuses the
    // search backend): an injected fixture search keeps carrying glob.
    return {
      search: injected.search ?? realSearch ?? shut,
      glob: globDisabledShut ?? injected.glob ?? injected.search ?? realGlob ?? shut,
    }
  },
  build(cap) {
    const { realmId, fsInstance, confinedCfg, backends, injected } = cap
    const searchRowDefs = buildSearchRowDefinitions({
      realmId,
      decide: cap.decide,
      pa: cap.pa,
      searchBackend: backends.search,
      globBackend: backends.glob,
      shellBackend: backends.shell,
      names: cap.names,
      callIdPrefix: cap.callIdPrefix,
      ...(injected.search === undefined && fsInstance !== null && typeof fsInstance.rootDir === 'string'
        ? { effectAnchorRoot: fsInstance.rootDir }
        : {}),
    }, cap.transport.createGovernedToolDefinitions)
    const contribution = buildSearchContribution({
      grepDefinition: searchRowDefs[0],
      globDefinition: searchRowDefs[1],
      launcherPin: typeof confinedCfg?.assembly?.launcherSha256 === 'string'
        ? confinedCfg.assembly.launcherSha256
        : undefined,
      cancelBoundary: 'the confined rg bodies stop the payload through the provider\'s frozen lease arm on timeout and on the host abort signal; the settle race answers exactly one of {exit, timedOut, cancelled} via the shared cancel leg (raceConfinedSettle), the drain never re-decides it, and a payload whose stop could not be confirmed is reported UNCERTAIN (termination-unconfirmed), never as a clean end (a5b3 laws, U6 PR5)',
    })
    return {
      definitions: searchRowDefs.map((def) => Object.freeze({ ...def, output: cap.presentationFace })),
      contribution,
      diagnostics: { search: backends.search, glob: backends.glob },
    }
  },
  refusalCode: 'PLANE_SEARCH_REGISTRATION_REFUSED',
})
