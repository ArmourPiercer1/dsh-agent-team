/**
 * P8-S5A — the S6 installation seams (plan §19.1: "如果 Projection/Remote
 * 尚由 S6 完成，则 production root 中提供明确 installation seam，S6 接入").
 *
 * The four seams of the shipped production root (plan A30–A34):
 *
 * | seam                    | plan | installed implementation (S6)          |
 * | ----------------------- | ---- | -------------------------------------- |
 * | `projectionLiveOverlay` | A30  | the live-residency overlay port        |
 * | `remoteHandlerRegistration` | A31 | the Remote contract v1 dispatcher    |
 * | `serverPrincipalDerivation` | A32 | the server-side principal derivation |
 * | `remoteQueryCommandCompletion` | A34 | the remote query/command completion |
 *
 * Seam discipline (frozen invariant: "S6 surfaces = explicit fail-closed
 * named typed install-once slots"):
 *
 * - **named** — each seam has a stable name (diagnostics);
 * - **typed** — `install(impl: T)` / `current(): T` with the exact S6
 *   implementation type (no `any`);
 * - **fail-closed** — before install, every use through `current()` throws
 *   the seam's stable not-installed code (never a silent no-op, never a
 *   partial activation);
 * - **install-once** — a second `install` throws
 *   {@link TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED}.
 *
 * S5 implements NONE of the S6 semantics behind these slots — the slots
 * only. The projection service is wired with {@link createFailClosedOverlayProxy}
 * (a delegating proxy over `projectionLiveOverlay`), so `project()` fails
 * closed with the stable code until S6 installs the overlay; after install
 * the same proxy delegates (activate-on-install — no restart, no re-wiring).
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/plugin/seams
 */
import { TEAM_PLUGIN_ERROR_CODES, TeamPluginError } from './types.js';
// --- the stable not-installed codes ------------------------------------------------
/**
 * The stable not-installed error codes of the four S6 seams (thrown by
 * `current()` before install, and by the projection overlay proxy when a
 * projection is requested before S6 wiring).
 */
export const S6_SEAM_NOT_INSTALLED_CODES = {
    /** A30 — the projection live-residency overlay is not installed. */
    PROJECTION_LIVE_OVERLAY_NOT_INSTALLED: 'PROJECTION_LIVE_OVERLAY_NOT_INSTALLED',
    /** A31 — the remote handler registration is not installed. */
    REMOTE_HANDLERS_NOT_INSTALLED: 'REMOTE_HANDLERS_NOT_INSTALLED',
    /** A32 — the server-side principal derivation is not installed. */
    PRINCIPAL_DERIVATION_NOT_INSTALLED: 'PRINCIPAL_DERIVATION_NOT_INSTALLED',
    /** A34 — the remote query/command completion is not installed. */
    REMOTE_COMPLETION_NOT_INSTALLED: 'REMOTE_COMPLETION_NOT_INSTALLED',
};
/**
 * Build one named, typed, fail-closed, install-once seam.
 *
 * @param options - the seam identity (name + stable not-installed code).
 * @returns the {@link InstallSeam} (S5 implements no semantics behind it).
 */
export function createInstallSeam(options) {
    let impl;
    let installed = false;
    return {
        get name() {
            return options.name;
        },
        get installed() {
            return installed;
        },
        install(candidate) {
            if (installed) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED, `S6 seam "${options.name}" was already installed (install-once violated)`);
            }
            // A function-typed seam (the A32 principal derivation) carries a
            // function implementation — non-null objectness accepts both.
            if (candidate === null ||
                (typeof candidate !== 'object' && typeof candidate !== 'function')) {
                throw new TeamPluginError(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID, `S6 seam "${options.name}" install requires a non-null implementation`);
            }
            impl = candidate;
            installed = true;
        },
        current() {
            if (!installed) {
                throw new TeamPluginError(options.notInstalledCode, options.notInstalledMessage);
            }
            return impl;
        },
    };
}
// --- the four named seams (A30 / A31 / A32 / A34) ----------------------------------
/**
 * A30 — the S6 projection live-residency overlay seam.
 * @returns the install seam (the production root consumes it through
 *   {@link createFailClosedOverlayProxy}).
 */
export function createProjectionLiveOverlaySeam() {
    return createInstallSeam({
        name: 'projectionLiveOverlay',
        notInstalledCode: S6_SEAM_NOT_INSTALLED_CODES.PROJECTION_LIVE_OVERLAY_NOT_INSTALLED,
        notInstalledMessage: 'the projection live-residency overlay (S6 A30) is not installed: the production root projection is fail-closed until S6 installs it',
    });
}
/**
 * A31 — the S6 remote handler registration seam.
 * @returns the install seam.
 */
export function createRemoteHandlerRegistrationSeam() {
    return createInstallSeam({
        name: 'remoteHandlerRegistration',
        notInstalledCode: S6_SEAM_NOT_INSTALLED_CODES.REMOTE_HANDLERS_NOT_INSTALLED,
        notInstalledMessage: 'the remote handler registration (S6 A31) is not installed: the Remote contract v1 dispatcher is unavailable on the production root',
    });
}
/**
 * A32 — the S6 server-side principal derivation seam.
 * @returns the install seam.
 */
export function createServerPrincipalDerivationSeam() {
    return createInstallSeam({
        name: 'serverPrincipalDerivation',
        notInstalledCode: S6_SEAM_NOT_INSTALLED_CODES.PRINCIPAL_DERIVATION_NOT_INSTALLED,
        notInstalledMessage: 'the server-side principal derivation (S6 A32) is not installed: remote requests cannot be bound to a team calling authority on the production root',
    });
}
/**
 * A34 — the S6 remote query/command completion seam.
 * @returns the install seam.
 */
export function createRemoteQueryCommandCompletionSeam() {
    return createInstallSeam({
        name: 'remoteQueryCommandCompletion',
        notInstalledCode: S6_SEAM_NOT_INSTALLED_CODES.REMOTE_COMPLETION_NOT_INSTALLED,
        notInstalledMessage: 'the remote query/command completion (S6 A34) is not installed: remote query/command methods cannot be completed on the production root',
    });
}
// --- the fail-closed delegating overlay proxy ---------------------------------------
/**
 * The projection overlay port the production root hands to
 * `createProjectionService`: a DELEGATING proxy over the A30 seam.
 *
 * - Before install: `snapshot()` throws the stable
 *   {@link S6_SEAM_NOT_INSTALLED_CODES.PROJECTION_LIVE_OVERLAY_NOT_INSTALLED}
 *   — `project()` fails closed (the proxy throws synchronously inside
 *   `project`, so every projection attempt is rejected, never partial);
 * - After install: `snapshot()` delegates to the installed S6 overlay
 *   (activate-on-install: the SAME proxy serves live projections with no
 *   service re-wiring).
 *
 * @param seam - the A30 install seam (the production root's
 *   `seams.projectionLiveOverlay`).
 * @returns the `LiveResidencyOverlayPort` the projection service consumes.
 */
export function createFailClosedOverlayProxy(seam) {
    return {
        snapshot() {
            return seam.current().snapshot();
        },
    };
}
//# sourceMappingURL=seams.js.map