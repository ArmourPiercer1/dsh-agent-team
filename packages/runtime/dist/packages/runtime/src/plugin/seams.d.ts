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
import type { InstallSeam, RemoteHandlerRegistration, RemoteQueryCommandCompletion, ServerPrincipalDerivation } from './types.js';
import type { LiveResidencyOverlayPort } from '../../projection/index.js';
/**
 * The stable not-installed error codes of the four S6 seams (thrown by
 * `current()` before install, and by the projection overlay proxy when a
 * projection is requested before S6 wiring).
 */
export declare const S6_SEAM_NOT_INSTALLED_CODES: {
    /** A30 — the projection live-residency overlay is not installed. */
    readonly PROJECTION_LIVE_OVERLAY_NOT_INSTALLED: "PROJECTION_LIVE_OVERLAY_NOT_INSTALLED";
    /** A31 — the remote handler registration is not installed. */
    readonly REMOTE_HANDLERS_NOT_INSTALLED: "REMOTE_HANDLERS_NOT_INSTALLED";
    /** A32 — the server-side principal derivation is not installed. */
    readonly PRINCIPAL_DERIVATION_NOT_INSTALLED: "PRINCIPAL_DERIVATION_NOT_INSTALLED";
    /** A34 — the remote query/command completion is not installed. */
    readonly REMOTE_COMPLETION_NOT_INSTALLED: "REMOTE_COMPLETION_NOT_INSTALLED";
};
export type S6SeamNotInstalledCode = (typeof S6_SEAM_NOT_INSTALLED_CODES)[keyof typeof S6_SEAM_NOT_INSTALLED_CODES];
/** The construction inputs of one install seam. */
export interface InstallSeamOptions {
    /** The seam's stable name (diagnostics). */
    readonly name: string;
    /** The seam's stable not-installed error code. */
    readonly notInstalledCode: string;
    /** The stable not-installed error message. */
    readonly notInstalledMessage: string;
}
/**
 * Build one named, typed, fail-closed, install-once seam.
 *
 * @param options - the seam identity (name + stable not-installed code).
 * @returns the {@link InstallSeam} (S5 implements no semantics behind it).
 */
export declare function createInstallSeam<T>(options: InstallSeamOptions): InstallSeam<T>;
/**
 * A30 — the S6 projection live-residency overlay seam.
 * @returns the install seam (the production root consumes it through
 *   {@link createFailClosedOverlayProxy}).
 */
export declare function createProjectionLiveOverlaySeam(): InstallSeam<LiveResidencyOverlayPort>;
/**
 * A31 — the S6 remote handler registration seam.
 * @returns the install seam.
 */
export declare function createRemoteHandlerRegistrationSeam(): InstallSeam<RemoteHandlerRegistration>;
/**
 * A32 — the S6 server-side principal derivation seam.
 * @returns the install seam.
 */
export declare function createServerPrincipalDerivationSeam(): InstallSeam<ServerPrincipalDerivation>;
/**
 * A34 — the S6 remote query/command completion seam.
 * @returns the install seam.
 */
export declare function createRemoteQueryCommandCompletionSeam(): InstallSeam<RemoteQueryCommandCompletion>;
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
export declare function createFailClosedOverlayProxy(seam: InstallSeam<LiveResidencyOverlayPort>): LiveResidencyOverlayPort;
//# sourceMappingURL=seams.d.ts.map