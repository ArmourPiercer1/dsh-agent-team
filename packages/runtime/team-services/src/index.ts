/**
 * `@dsh-agent-team/runtime/team-services` — Alpha.5 P1-05: the per-Member
 * Service realm (isolated `ctx.fs` scope + confined Provider subclass) and the
 * install/denial vocabulary. No web/subprocess provider here yet (P1-06/P2).
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
  InstallMemberIoProvidersInput,
  MemberServiceSpec,
  ToolBindingRealm,
  ToolBindingRealmSpec,
} from './install.js'
export {
  TEAM_IO_DENIAL_CODES,
  TEAM_SERVICE_INSTALL_CODES,
  TeamIoDenial,
  TeamServiceInstallError,
} from './types.js'
export type {
  MemberIoInstallation,
  MemberServiceInstallation,
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
