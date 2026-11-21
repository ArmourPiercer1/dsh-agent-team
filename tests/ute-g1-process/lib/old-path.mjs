/**
 * old-path.mjs — the OLD-PATH identity of the process baseline, and the
 * capture facade the harness and the controls share.
 *
 * "Old path" here means: the PRODUCT route-C composition
 * (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`) serving the native
 * `bash` name through the confined `subprocess` face — the composition the
 * shipped governed Member preset produces. It does NOT mean the legacy governed
 * tool plane (`team_bash`), which is a different mount and is measured
 * separately in `probe-composition.mjs` (its dispatch is NOT-RUN there).
 *
 * @module tests/ute-g1-process/lib/old-path
 */
import { captureCorpus, captureVector } from './scenario.mjs'
import { shellIdentity } from './world.mjs'

/** The pinned fixture identity every row was captured under. */
export const OLD_PATH_IDENTITY = Object.freeze({
  host: '0.2.0-rc.2',
  hostSha: '639ed015397290b3745d163aafe02ffee4aa3f84',
  route: 'mountMemberA5sfRealm+attachA5sfNativeToolModules',
  member: 'bash',
  shell: '/bin/bash',
  dispatch: 'root.tools.execute (the host registry, the model call path)',
})

/**
 * One stable line describing the composition a row was captured on. It names
 * the ROUTE and the shadow module, never a machine path.
 */
export function identityLine() {
  return `OLD-PATH-IDENTITY route=${OLD_PATH_IDENTITY.route} member=${OLD_PATH_IDENTITY.member} shell=${OLD_PATH_IDENTITY.shell} host=${OLD_PATH_IDENTITY.host}@${OLD_PATH_IDENTITY.hostSha} dispatch=${OLD_PATH_IDENTITY.dispatch} engine=${shellIdentity()}`
}

export { captureCorpus, captureVector }
