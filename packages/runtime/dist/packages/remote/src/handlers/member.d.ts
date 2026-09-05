/**
 * The `member` category handler (design note §3): member admission
 * actions (create / send / follow-up) over the P6-T2 TeamRuntime facade,
 * and member lifecycle (archive / restore / dispose) over the P7-T3
 * LifecycleService.
 *
 * The admission outcome's durable effect sequence (when the effect carries
 * one) rides in the reply's provenance (`effectSequence`).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/member
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteAdmissionPort, RemoteLifecyclePort } from './ports.js';
/** The port pair the member category needs. */
export interface RemoteMemberHandlerPorts {
    readonly admission: RemoteAdmissionPort;
    readonly lifecycle: RemoteLifecyclePort;
}
/**
 * The member category handler (`member.create`, `member.send`,
 * `member.followup`, `member.archive`, `member.restore`, `member.dispose`).
 */
export declare function createRemoteMemberHandler(ports: RemoteMemberHandlerPorts): (method: string, params: RemoteMethodParams) => {
    data: {
        outcome: import("../contracts/remote-safe.js").RemoteSafeRecord;
    };
    effectSequence: number | undefined;
} | {
    data: import("../contracts/remote-safe.js").RemoteSafeRecord;
    effectSequence?: undefined;
};
//# sourceMappingURL=member.d.ts.map