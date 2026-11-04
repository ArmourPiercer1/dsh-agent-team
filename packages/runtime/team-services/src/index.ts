/**
 * `@dsh-agent-team/runtime/team-services` — Alpha.5 P1-05: the per-Member
 * Service realm (isolated `ctx.fs` scope + confined Provider subclass) and the
 * install/denial vocabulary. BL-16 adds the confined `subprocess` face
 * (`subprocess.ts`); the web provider is still P1-06/out of this lane.
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
  InstallMemberIoProvidersInput,
  MemberServiceSpec,
  ToolBindingRealm,
  ToolBindingRealmSpec,
} from './install.js'
export {
  CONFINED_SUBPROCESS_REFUSAL_CODES,
  CONFINED_SUBPROCESS_SHELL_CLASS_PROGRAMS,
  CONFINED_SUBPROCESS_STATIC_PROGRAMS,
  ConfinedSubprocessRefusal,
  confinedChildEnvironment,
  confinedSpawnAllowPaths,
  createConfinedOutputReader,
  createConfinedSubprocessClass,
  createMemberSubprocessGuard,
  isShellClassProgram,
  programAttributionRefusal,
  readIntentsOf,
  SUBPROCESS_GUARD_METHOD,
} from './subprocess.js'
export type {
  ConfinedCollectMode,
  ConfinedOutputMode,
  ConfinedOutputReader,
  ConfinedProcessProvider,
  ConfinedSpawnSpec,
  ConfinedStdinMode,
  ConfinedStreamProcess,
  ConfinedSubprocessOptions,
  ConfinedSubprocessRefusalCode,
  ProgramAttributionRefusal,
  SubprocessProviderConstructor,
} from './subprocess.js'
export { A5SF_SUBPROCESS_UNCONFINED_REALM, mountA5sfRealm } from './mount.js'
export type {
  A5sfRealmBinding,
  A5sfRealmMember,
  MountA5sfRealmInput,
  MountedA5sfRealm,
} from './mount.js'
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
