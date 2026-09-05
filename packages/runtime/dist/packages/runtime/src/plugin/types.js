/**
 * P8-S5A — production plugin composition types.
 *
 * This module defines:
 *
 * - {@link TeamPluginConfig} — the JSON-safe row `config:` of the shipped
 *   production plugin (the only input channel: the Cordis row carries plain
 *   JSON; the production root derives every factory from it — no service
 *   payload smuggling);
 * - the plugin-level stable error codes ({@link TEAM_PLUGIN_ERROR_CODES});
 * - the typed S6 installation seams (the A30–A34 slots: named, typed,
 *   fail-closed, install-once — plan §19.1 "如果 Projection/Remote 尚由
 *   S6 完成，则 production root 中提供明确 installation seam");
 * - {@link TeamProductionRoot} — the complete assembled surface of the
 *   production root (A01–A29, plan §19.1 assembly list).
 *
 * Pure module: types + constants only — no I/O, no `node:` builtins, no
 * live references.
 * @module @dsh-agent-team/runtime/plugin/types
 */
// --- plugin-level error codes ------------------------------------------------------
/**
 * The stable plugin-level error codes (the `code` property of the thrown
 * {@link TeamPluginError}). Every failure path of the production entry is
 * fail-closed with one of these (or a domain-module code propagating).
 */
export const TEAM_PLUGIN_ERROR_CODES = {
    /** The row config is missing a required field or has the wrong type. */
    TEAM_PLUGIN_CONFIG_INVALID: 'TEAM_PLUGIN_CONFIG_INVALID',
    /** A required public service is absent from the ctx (not injected). */
    TEAM_PLUGIN_SERVICE_MISSING: 'TEAM_PLUGIN_SERVICE_MISSING',
    /** The glue module URL is missing/unloadable or its export is malformed. */
    TEAM_PLUGIN_GLUE_UNAVAILABLE: 'TEAM_PLUGIN_GLUE_UNAVAILABLE',
    /** An S6 seam was installed twice (install-once violated). */
    TEAM_PLUGIN_SEAM_ALREADY_INSTALLED: 'TEAM_PLUGIN_SEAM_ALREADY_INSTALLED',
    /** An unknown seam name was requested. */
    TEAM_PLUGIN_SEAM_UNKNOWN: 'TEAM_PLUGIN_SEAM_UNKNOWN',
    /** A facade field was read before `ready` settled (await `ready` first). */
    TEAM_PLUGIN_NOT_READY: 'TEAM_PLUGIN_NOT_READY',
    /**
     * T12-B1 — the real production create (the canonical fresh-root binding
     * of the `create` boot phase) failed in a way that leaves the durable
     * Team identity unproven. Fail-closed: the boot rejects; nothing is
     * reported as created.
     */
    TEAM_PLUGIN_CREATE_FAILED: 'TEAM_PLUGIN_CREATE_FAILED',
    /**
     * T12-B2 — the production resume (`resume` boot phase) could not LOAD
     * the existing durable Team identity (the TeamSession record, the
     * team-root binding, or the Leader member row) for the configured
     * root. Fail-closed: a resume loads the existing Team identity — it
     * never re-mints one; the loud failure replaces the silent pass-through.
     */
    TEAM_PLUGIN_RESUME_STATE_MISSING: 'TEAM_PLUGIN_RESUME_STATE_MISSING',
    /**
     * T12-B6 — the handoff target team cannot be created-and-started
     * through the live glue: either a with-context handoff ran on a glue
     * that lacks the target-agent ports (`createRootAgent` /
     * `deliverRootContext`), or the deterministic target root already
     * carries an incompatible durable record (stable identity collision,
     * not a re-drive). Fail-closed: the preflight runs before any
     * durable mutation, so nothing is reported as created.
     */
    TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE: 'TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE',
};
/** The plugin-level error carrier (stable `code` + message + detail). */
export class TeamPluginError extends Error {
    code;
    detail;
    constructor(code, message, detail) {
        super(message);
        this.name = 'TeamPluginError';
        this.code = code;
        if (detail !== undefined)
            this.detail = detail;
    }
}
/** True when `value` is a {@link TeamPluginError} carrier. */
export function isTeamPluginError(value) {
    return value instanceof TeamPluginError;
}
//# sourceMappingURL=types.js.map