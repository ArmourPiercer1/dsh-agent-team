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
 * U7-F adds the shell-class SECOND row in the SAME candidate (the Registry
 * law is one live candidate per family): the governed `pwsh` row at its
 * fixed native spelling, over the SAME confined provider law with its own
 * faithful command form, gated by the closed boolean `pwshEnabled` (the
 * `globEnabled` law — false builds NO backend, the row lands the typed shut
 * face and refuses before any spawn).
 *
 * @module tools/families/process
 */
import {
  buildBashRowDefinition,
  buildProcessShellContribution,
  createConfinedShellBackend,
  buildPwshRowDefinition,
  createConfinedPwshBackend,
  createGovernedPwshExecutor,
} from '../process-family/src/index.mjs'

// The governed `pwsh` row mounts at its FIXED native spelling (the jobs /
// fs-mutation precedent — never the renamable `names` map; Gate 0b's name
// config speaks only the renamable classes). A2C-1 keeps the shell
// authorities apart: a pwsh grant is never a bash grant and vice versa.
const PWSH_NATIVE_NAME = 'pwsh'

export const familyAssembly = Object.freeze({
  schema: 'u7-family-assembly/1',
  familyId: 'dsh.process-family',
  order: 20,
  placement: 20,
  // U7-F closed boolean: `pwshEnabled:false` builds NO pwsh backend at all
  // (the row lands the typed shut face — refusal before any spawn is config
  // law, not wiring). Default true.
  config: Object.freeze({ pwshEnabled: 'boolean' }),
  // The shell row ALWAYS mounts (no confinedProvider = the typed shut
  // face), so the enforcing kernel rides every governed mount.
  enabled: () => true,
  claims: (cap) => [cap.names.bash, PWSH_NATIVE_NAME],
  disabledOwned: () => [],
  backends(cap) {
    const { confinedCfg, fsInstance } = cap
    const cwdRoot = typeof fsInstance?.rootDir === 'string' ? fsInstance.rootDir : cap.planeConfig.workingDir
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
    // U7-F: the pwsh backend — the SAME named, reviewed confined provider
    // (Landlock launcher + byte-pin double gate + frozen lease/terminate),
    // its own faithful command form. `pwshEnabled:false` builds NOTHING and
    // its shut face WINS over the kit `backends` injection seam (the mount
    // gate is config law, not wiring — the globEnabled precedent), so a
    // disabled pwsh mount answers the typed refusal before any spawn.
    const pwshEnabled = cap.planeConfig.pwshEnabled !== false
    const realPwsh = pwshEnabled && confinedCfg !== null
      ? createConfinedPwshBackend({
        realmId: cap.realmId,
        templateId: cap.templateId,
        instanceId: cap.instanceId,
        cwdRoot,
        confined: confinedCfg,
        observe: cap.logBackend('u7f-pwsh'),
      })
      : null
    const pwshShut = pwshEnabled === false
      ? cap.createShutBackend('a5-pwsh-config-disabled')
      : cap.injected.pwsh ?? realPwsh ?? cap.createShutBackend('a5-effect-face-pending')
    return {
      shell: cap.injected.shell ?? realShell ?? cap.createShutBackend('a5-effect-face-pending'),
      pwsh: pwshShut,
    }
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
    // U7-F: the pwsh row is a FAMILY BODY over the injected authority
    // forces (the fs-family precedent — the lane decides nothing, admits
    // nothing, consumes nothing by itself): the closed parse + the pwsh
    // coverage belt + the PA edge + the effect backend, deny-before-backend.
    const pwshExecutor = createGovernedPwshExecutor({
      realmId: cap.realmId,
      templateId: cap.templateId,
      instanceId: cap.instanceId,
      callIdPrefix: cap.callIdPrefix,
      decide: cap.decide,
      pa: cap.pa,
      policy: cap.permissionPolicy,
      backend: cap.backends.pwsh,
      observe: cap.logBackend('u7f-pwsh-row'),
    })
    const pwshRowDef = Object.freeze({
      ...buildPwshRowDefinition({ pwshName: PWSH_NATIVE_NAME, pwshExecutor }),
      output: cap.presentationFace,
    })
    // CI-07: the descriptor NAMES the reviewed confined process provider
    // this row's execution drives, and the mount's launcher pin rides the
    // bound digests — a provider-pin change is a DIFFERENT contribution.
    // U7-F: the ONE candidate carries BOTH shell rows (Registry law).
    const contribution = buildProcessShellContribution({
      definition: bashRowDef,
      launcherPin: typeof confinedCfg?.assembly?.launcherSha256 === 'string'
        ? confinedCfg.assembly.launcherSha256
        : undefined,
      cancelBoundary: 'the confined shell executor terminates the payload through the provider\'s frozen lease arm on timeout and on the host abort signal; the settle race answers exactly one of {exit, timedOut, cancelled} (tie law exited > timedOut > aborted), the drain never re-decides it, and a payload whose stop could not be confirmed is reported UNCERTAIN (truncated/not-observed), never as a clean end (a5b3 laws, U6 PR3)',
      pwsh: {
        definition: pwshRowDef,
        cancelBoundary: 'the confined pwsh executor terminates the payload through the SAME provider lease arm on timeout and on the host abort signal, under the SAME closed settle race (exited > timedOut > aborted) and drain law; an already-aborted invocation settles cancelled BEFORE the PA edge (zero consumption); a payload whose stop could not be confirmed is reported UNCERTAIN (truncated/not-observed), never as a clean end (U7-F)',
      },
    })
    return {
      definitions: [bashRowDef, pwshRowDef],
      contribution,
      diagnostics: { shell: cap.backends.shell, pwsh: cap.backends.pwsh },
    }
  },
  refusalCode: 'PLANE_PROCESS_REGISTRATION_REFUSED',
})
