/**
 * Alpha.6 — the ROOT-side assembly of the trusted review facts plane.
 *
 * One pure factory joins the pieces the Host already owns:
 *  - the bound Blueprint SOURCE parsed ONCE (v5 only; a v4/invalid document is
 *    `refused`, never a silent legacy fallback);
 *  - the fail-closed composition decision (exactly one live Officer);
 *  - the durable reader + member rows;
 *  - the durable permission-overlay generation for the RESOLVED reviewer;
 *  - the closed control-kind category classifier.
 *
 * It returns the two ControlService ports and NOTHING else: no notifier swap,
 * no wake delivery, no root mutation. A caller that wants Alpha.6 must pass the
 * result into `createControlService` explicitly; an absent/refused result keeps
 * the Alpha.5 path byte-identical.
 *
 * @module packages/runtime/alpha6/root-composition
 */
import { type Alpha6ControlPorts, type AssignedOfficerMemberSnapshot } from './assigned-officer-facts.js';
import { type Alpha6PermissionOverlayPort } from './authority-generation.js';
import { type Alpha6CompositionRefusal } from './composition.js';
export interface Alpha6RootCompositionInput {
    /** The explicit Host/Team opt-in. False keeps Alpha.5 byte-identical. */
    readonly enabled: boolean;
    /** The SAME bound source handed to the router/wiring; parsed once here. */
    readonly blueprintSource: string;
    readonly rootSessionId: string;
    readonly leaderTemplateId: string;
    /** The durable member view of THIS team (never a model claim). */
    readonly members: readonly AssignedOfficerMemberSnapshot[];
    /** The non-locking durable control reader (ControlService.readControlState). */
    readonly control: {
        readonly readControlState: (rootSessionId: string) => Promise<{
            readonly requests: readonly unknown[];
            readonly transfers: readonly unknown[];
        }>;
    };
    readonly permissionOverlay?: Alpha6PermissionOverlayPort;
}
export type Alpha6RootComposition = {
    readonly mode: 'legacy';
    readonly reason: 'disabled';
} | {
    readonly mode: 'refused';
    readonly refused: Alpha6CompositionRefusal;
} | {
    readonly mode: 'alpha6';
    readonly ports: Alpha6ControlPorts;
    readonly officerInstanceId: string;
    readonly routing: import('../../domain/blueprint/src/index.js').ReviewRouting;
};
/**
 * Assemble the trusted ports. Any missing fact refuses; this function NEVER
 * invents an Officer, a generation, a category or a routing.
 */
export declare function createAlpha6RootComposition(input: Alpha6RootCompositionInput): Alpha6RootComposition;
/**
 * The LIVE-VIEW variant used by a long-lived Host composition.
 *
 * The static factory above pins a member SNAPSHOT. Production creates members
 * AFTER the control service exists, so a snapshot would either be empty or
 * stale. This variant takes the durable member LOOKUP (get/list) and does NOT
 * pin an Officer:
 *
 *  - construction checks only the static policy face (v5 routing enabled, a
 *    non-empty Officer template that is not the Leader template);
 *  - every assigned-Officer evaluation re-resolves exactly ONE live RUNNING
 *    Officer through `AssignedOfficerFactsPort`, so zero/multiple/archived
 *    states refuse AT THE QUERY, never against a startup snapshot.
 *
 * No notifier swap and no root mutation happen here either.
 */
export type Alpha6LiveRootComposition = {
    readonly mode: 'legacy';
    readonly reason: 'disabled';
} | {
    readonly mode: 'refused';
    readonly refused: Alpha6CompositionRefusal;
} | {
    readonly mode: 'alpha6';
    readonly ports: Alpha6ControlPorts;
    readonly officerTemplateId: string;
    readonly routing: import('../../domain/blueprint/src/index.js').ReviewRouting;
};
export interface Alpha6LiveRootCompositionInput {
    readonly enabled: boolean;
    readonly blueprintSource: string;
    readonly rootSessionId: string;
    readonly leaderTemplateId: string;
    readonly members: {
        readonly get: (rootSessionId: string, instanceId: string) => Promise<AssignedOfficerMemberSnapshot | undefined> | AssignedOfficerMemberSnapshot | undefined;
        readonly list: (rootSessionId: string) => Promise<readonly AssignedOfficerMemberSnapshot[]> | readonly AssignedOfficerMemberSnapshot[];
    };
    readonly control: Alpha6RootCompositionInput['control'];
    readonly permissionOverlay?: Alpha6PermissionOverlayPort;
    /**
     * The frozen v5 source of a CREATED team root, read from its registry row.
     * The live composition is constructed once per boot row, so routing for a
     * team created later must be resolved per query, never assumed to be the
     * boot anchor's policy.
     */
    readonly blueprintSourceForRoot?: (rootSessionId: string) => string | null;
}
/**
 * The PRODUCTION opt-in assembly — the ONE seam `root.ts` calls.
 *
 * `enabled` is the explicit Host/Team opt-in
 * (`TeamPluginConfig.alpha6ReviewRouting`). When it is not exactly `true`,
 * this returns `legacy` WITHOUT invoking `live`: no blueprint field is read,
 * no member row is listed, no Alpha.6 code runs, so the Alpha.5
 * `createControlService` object stays byte-identical.
 *
 * When it is `true` the live composition runs and either yields the two
 * trusted ports or a REFUSAL with NO ports. The caller MUST fail closed on a
 * refusal (throw at wiring time); an opted-in Team never falls back to the
 * Leader path.
 */
export type Alpha6RootWiring = {
    readonly mode: 'legacy';
} | {
    readonly mode: 'refused';
    readonly refused: Alpha6CompositionRefusal;
} | {
    readonly mode: 'alpha6';
    readonly ports: Alpha6ControlPorts;
    readonly officerTemplateId: string;
    readonly routing: import('../../domain/blueprint/src/index.js').ReviewRouting;
};
/** The live input the caller's thunk supplies; the `enabled` bit is the helper's. */
export type Alpha6RootWiringLiveInput = Omit<Alpha6LiveRootCompositionInput, 'enabled'>;
export declare function createAlpha6RootWiring(enabled: boolean, live: () => Alpha6RootWiringLiveInput): Alpha6RootWiring;
export declare function createAlpha6LiveRootComposition(input: Alpha6LiveRootCompositionInput): Alpha6LiveRootComposition;
//# sourceMappingURL=root-composition.d.ts.map