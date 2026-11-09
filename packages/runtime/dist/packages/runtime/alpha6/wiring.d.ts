import type { ControlRequestNotificationPort } from '../control/types.js';
export interface Alpha6WiringMember {
    readonly templateId: string;
    readonly childSessionId: string;
}
export interface Alpha6WiringConfig {
    readonly alpha6ReviewRouting?: boolean;
    readonly blueprintSource: string;
    readonly rootSessionId: string;
    readonly seedMembers: readonly Alpha6WiringMember[];
}
export interface Alpha6WiringLive {
    readonly deliverRootControlNotification?: (input: {
        readonly rootSessionId: string;
        readonly requestId: string;
        readonly text: string;
    }) => Promise<void>;
    readonly deliverReviewWake?: (input: {
        readonly rootSessionId: string;
        readonly targetSessionId: string;
        readonly wakeId: string;
        readonly text: string;
    }) => Promise<void>;
}
export declare function controlRequestNotification(config: Alpha6WiringConfig, live: Alpha6WiringLive): {
    requestNotification?: ControlRequestNotificationPort;
};
//# sourceMappingURL=wiring.d.ts.map