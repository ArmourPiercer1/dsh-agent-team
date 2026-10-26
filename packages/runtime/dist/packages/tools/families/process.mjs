/**
 * FamilyAssembly descriptor — the PROCESS family (the governed shell row).
 *
 * Moved VERBATIM out of `team-tool-plane.mjs` (u7-w0b S3): the confined
 * shell backend (CI-07 named provider; the U7-4a governed background arm
 * when — and only when — the plane's validated closed keys say on), the
 * shell row Definition over the assembly-injected a5p5 shell transport, and
 * the closed-schema contribution. The plane drives this descriptor through
 * the generic seam and names none of it. The shell backend is SHARED: the
 * search family's trio build reads `cap.backends.shell` (its shell ARM is
 * discarded at selection — the PR3 dormancy law).
 *
 * The cross-key laws that guard the background arm (`backgroundJobs`
 * requires `jobsEnabled`, the attribution producer, the confined provider,
 * and the creating-lane pin `names.bash === 'bash'`) are the jobs named
 * bridge's and stay at the plane, validated BEFORE this descriptor runs.
 *
 * @module tools/families/process
 */
import {
  buildBashRowDefinition,
  buildProcessShellContribution,
  createConfinedShellBackend,
} from '../process-family/src/index.mjs'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.process-family',
  order: 20,
  placement: 20,
  config: Object.freeze({}),
  // The shell row ALWAYS mounts (no confinedProvider = the typed shut
  // face), so the enforcing kernel rides every governed mount.
  enabled: () => true,
  claims: (cap) => [cap.names.bash],
  disabledOwned: () => [],
  backends(cap) {
    const { confinedCfg, fsInstance } = cap
    const realShell = confinedCfg !== null
      ? createConfinedShellBackend({
        realmId: cap.realmId,
        templateId: cap.templateId,
        instanceId: cap.instanceId,
        cwdRoot: typeof fsInstance?.rootDir === 'string' ? fsInstance.rootDir : cap.planeConfig.workingDir,
        confined: confinedCfg,
        observe: cap.logBackend('a5g7-shell'),
        // U7-4a: the governed background arm — present ONLY when both closed
        // keys said on AND the trusted entry injected its producer (validated
        // by the plane; absent otherwise, byte-for-byte). The arm is THIS
        // SAME provider row, not a second executor.
        ...(cap.planeConfig.backgroundJobs === true
          ? { background: { enabled: true, accept: (ctx) => cap.injected.backgroundJobs.accept(ctx) } }
          : {}),
      })
      : null
    return { shell: cap.injected.shell ?? realShell ?? cap.createShutBackend('a5-effect-face-pending') }
  },
  build(cap) {
    const { confinedCfg } = cap
    // U6 PR3 (dormancy law, a5p5-dormant-audit): the family lane NEVER
    // touches the dormant a5p5 lane — the row's execute transport is
    // INJECTED by the plane (its ONE reviewed consumer) through `cap.transport`.
    const bashRowDef = Object.freeze({
      ...buildBashRowDefinition({
        realmId: cap.realmId,
        decide: cap.decide,
        pa: cap.pa,
        shellBackend: cap.backends.shell,
        names: { bash: cap.names.bash },
        callIdPrefix: cap.callIdPrefix,
      }, cap.transport.createGovernedShellRowDefinition),
      output: cap.presentationFace,
    })
    // CI-07: the descriptor NAMES the reviewed confined process provider
    // this row's execution drives, and the mount's launcher pin rides the
    // bound digests — a provider-pin change is a DIFFERENT contribution.
    const contribution = buildProcessShellContribution({
      definition: bashRowDef,
      launcherPin: typeof confinedCfg?.assembly?.launcherSha256 === 'string'
        ? confinedCfg.assembly.launcherSha256
        : undefined,
      cancelBoundary: 'the confined shell executor terminates the payload through the provider\'s frozen lease arm on timeout and on the host abort signal; the settle race answers exactly one of {exit, timedOut, cancelled} (tie law exited > timedOut > aborted), the drain never re-decides it, and a payload whose stop could not be confirmed is reported UNCERTAIN (truncated/not-observed), never as a clean end (a5b3 laws, U6 PR3)',
    })
    return {
      definitions: [bashRowDef],
      contribution,
      diagnostics: { shell: cap.backends.shell },
    }
  },
  refusalCode: 'PLANE_PROCESS_REGISTRATION_REFUSED',
})
