/**
 * `@dsh-agent-team/runtime/team-services` — Alpha.5 P1-05: the per-Member
 * Service realm (isolated `ctx.fs` scope + confined Provider subclass) and the
 * install/denial vocabulary. BL-16/BL-17 add the confined `subprocess` face
 * (`subprocess.ts`); BL-18 adds the confined `web` face (`web.ts`) — the
 * network axis, refused before any provider call when the compiled lane
 * requests `network: deny` and no backend proves enforcement.
 *
 * @module @dsh-agent-team/runtime/team-services
 */

export {
  createConfinedFileSystemClass,
  createMemberFsGuard,
} from './fs.js'
export type { FsGuard, FsProviderConstructor, FsProviderSurface } from './fs.js'
export {
  installMemberIoProviders,
  installToolBindingRealm,
} from './install.js'
export type {
  ConfinedSubprocessRealmSpec,
  ConfinedSubprocessSurface,
  ConfinedTerminalRealmSpec,
  ConfinedTerminalSurface,
  ConfinedWebRealmSpec,
  ConfinedWebSurface,
  InstallMemberIoProvidersInput,
  MemberServiceSpec,
  ToolBindingRealm,
  ToolBindingRealmSpec,
} from './install.js'
export {
  WEB_FETCH_GUARD_METHOD,
  WEB_NETWORK_RESIDUALS,
  WEB_SEARCH_GUARD_METHOD,
  createConfinedWebClass,
  createWebNetworkGuard,
} from './web.js'
export type {
  ConfinedWebOptions,
  ConfinedWebProvider,
  WebNetworkResidual,
  WebProviderConstructor,
} from './web.js'
export {
  CONFINED_SHELL_ADMISSION_CODES,
  CONFINED_SUBPROCESS_REFUSAL_CODES,
  CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS,
  CONFINED_SUBPROCESS_STATIC_PROGRAMS,
  ConfinedSubprocessRefusal,
  SHELL_WRITE_GUARD_METHOD,
  confinedChildEnvironment,
  confinedSpawnAllowPaths,
  createConfinedOutputReader,
  createConfinedSubprocessClass,
  createMemberSubprocessGuard,
  createMemberSubprocessWriteGuard,
  isShellClassProgram,
  isShellClassSpawn,
  probeNetworkDenial,
  programAttributionRefusal,
  readIntentsOf,
  resolveShellRoot,
  shellClassAdmissionRefusal,
  SUBPROCESS_GUARD_METHOD,
} from './subprocess.js'
export type {
  ConfinedCapabilityRow,
  ConfinedCollectMode,
  ConfinedNetworkCapabilityProbe,
  ConfinedOutputMode,
  ConfinedOutputReader,
  ConfinedProcessProvider,
  ConfinedShellAdmissionCode,
  ConfinedShellClassAdmission,
  ConfinedShellDeclaration,
  ConfinedSpawnSpec,
  ConfinedStdinMode,
  ConfinedStreamProcess,
  ConfinedSubprocessOptions,
  ConfinedSubprocessRefusalCode,
  ProgramAttributionRefusal,
  ShellAdmissionRefusal,
  SubprocessProviderConstructor,
} from './subprocess.js'
export { A5SF_SUBPROCESS_UNCONFINED_REALM, A5SF_TERMINALS_LEGACY_PTY_REFUSED, mountA5sfRealm } from './mount.js'
export type {
  A5sfRealmBinding,
  A5sfRealmMember,
  MountA5sfRealmInput,
  MountedA5sfRealm,
} from './mount.js'
/**
 * PRODUCT ASSEMBLY (2026-11-05; policy-source fix 2026-11-05): the derived
 * product path (`a5sfMemberAuthority` → ceilings read from
 * `config.blueprintSource`) and the EXCEPTION path (`a5sfMemberPolicies`, which
 * must resolve and narrow that same blueprint). See `product-assembly.ts` for
 * the declaration shape, the refusal vocabulary and the faces this lane
 * deliberately does not own.
 */
export {
  A5SF_GOVERNED_REALM_KEY,
  A5SF_MEMBER_AUTHORITY_KEY,
  A5SF_MEMBER_POLICIES_KEY,
  A5SF_PRODUCT_ASSEMBLY_RESIDUALS,
  A5SF_PRODUCT_REALM_SCHEMA,
  createProductRealmProvider,
  deriveProductRealmDeclaration,
  deriveProductRealmPlan,
  deriveProductRealmPlanFromBlueprint,
  parseProductRealmDeclaration,
} from './product-assembly.js'
export type {
  A5sfBoundBlueprintRealmInput,
  A5sfDerivedRealmInput,
  A5sfProductAssemblyResidual,
  A5sfProductCompiledAnswer,
  A5sfProductManagedMember,
  A5sfProductMemberDeclaration,
  A5sfProductRealmDeclaration,
  A5sfProductRealmParseContext,
  A5sfProductRealmPlan,
  A5sfProductRealmProvider,
  A5sfProductRealmSource,
} from './product-assembly.js'
export {
  createGuardConsultFileSink,
  GUARD_ALLOW_DECIDED_BY,
  GUARD_CONSULT_SCHEMA,
  GUARD_CONSULT_TRANSPORT_CODES,
  GuardConsultTransportError,
  GuardObservationError,
  observeGuard,
  readGuardConsultFile,
} from './guard-observability.js'
export type {
  GuardConsultContext,
  GuardConsultDecision,
  GuardConsultFact,
  GuardConsultFileSink,
  GuardConsultFileSinkOptions,
  GuardConsultObserver,
  GuardConsultRealm,
  GuardConsultTransportCode,
} from './guard-observability.js'
export {
  TEAM_IO_DENIAL_CODES,
  TEAM_SERVICE_INSTALL_CODES,
  TeamIoDenial,
  TeamServiceInstallError,
} from './types.js'
export type {
  MemberIoInstallation,
  MemberServiceInstallation,
  RealmServiceFaces,
  TeamIoDenialCode,
  TeamServiceInstallCode,
} from './types.js'
export {
  assertDormant,
  collectRows,
  COMPOSITION_REFUSAL_CODES,
  planProviderReplacement,
  replaceProvider,
  TEAM_MANAGED_SERVICES,
  TEAM_SERVICE_ROWS,
} from './manifest.js'
export type {
  CompositionRefusal,
  CompositionRefusalCode,
  CompositionResult,
  TeamManagedService,
  TeamServiceRow,
} from './manifest.js'
