/**
 * @dsh-agent-team/client — browser half: Cordis client plugin and Team UI.
 *
 * Responsibility (TaskDoc §11 package boundary): the dsh-agent-team Cordis
 * client plugin (see ./plugin/client.ts) and the Team UI (slots / panels),
 * built only on the public client surface — no Node.js builtins, no DOM
 * assumptions before the P9 UI work.
 *
 * Skeleton status (P1-T4): this entrypoint exports the package identity
 * marker only; the slot UI lands in the P9 external Web UI migration.
 * @module @dsh-agent-team/client
 */

/**
 * Stable identity marker of the client package.
 *
 * Placeholder until the P9 UI work replaces it; its value is asserted by
 * the package unit test and is part of the skeleton contract.
 */
export const PACKAGE_ID = 'client'
