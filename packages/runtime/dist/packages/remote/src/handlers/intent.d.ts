/**
 * The `intent` category handler (design note §3): the pre-creation
 * compatibility probe (Architecture §7 TeamIntent flow). Backed by the
 * {@link RemoteIntentPort} (host wiring: the pure domain
 * `evaluateCompatibility` fed by the blueprint's requirements).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/intent
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteIntentPort } from './ports.js';
/** The intent category handler (`intent.probe`). */
export declare function createRemoteIntentHandler(deps: RemoteIntentPort): (method: string, params: RemoteMethodParams) => {
    readonly data: unknown;
};
//# sourceMappingURL=intent.d.ts.map