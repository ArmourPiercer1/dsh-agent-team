/**
 * THE NETWORK-DIMENSION CLOSED SET — C-PROC (INTERFACES-v1: 网络维度闭集),
 * carried at the PoC-4b honesty level (plan §7): the Landlock TCP-port bits
 * (ABI v4) are NOT a general "no network" guarantee, so this lane refuses
 * `deny` and `restricted` profiles BEFORE any process exists with
 * `IO_POLICY_UNSUPPORTED` until a real destination-filtering /
 * netns-seccomp Provider demonstrates them (plan PoC-4b: 否则
 * `IO_POLICY_UNSUPPORTED`，不把 Landlock TCP port ABI4 视为一般无网络保证).
 *
 * An ABSENT profile is accepted and claims nothing: the `network-destination`
 * dimension is then stated `unsupported` on every probe — the no-overclaim
 * law (design §5) forbids inferring "network is denied" from "TCP bits
 * exist".
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/network
 */
import { refuse } from './contract-stub.js';
/** The network profile closed set — there is NO unconfined arm. */
export const NETWORK_PROFILES = ['deny', 'restricted'];
/**
 * What ABI v4's net surface actually is — stated verbatim in every probe row
 * for `network-destination`. It must never read like "no network".
 */
export const LANDLOCK_TCP_NOTE = 'Landlock ABI v4 mediates only TCP port bind/connect inside the domain; UDP, IPv6 raw paths, AF_UNIX sockets, inherited socket FDs and out-of-band routes are NOT covered — this is not a general no-network guarantee (PoC-4b)';
/**
 * Gate a network profile BEFORE any process exists. `undefined` claims
 * nothing; the two closed profiles are refused on this lane's provider set;
 * anything else is outside the closed set.
 */
export function evaluateNetworkRequirement(profile, realmId) {
    if (profile === undefined)
        return { ok: true, value: null };
    if (profile === 'deny') {
        return refuse('IO_POLICY_UNSUPPORTED', `network profile 'deny' is not offered in realm '${realmId ?? '<unbound>'}': no provider in this lane demonstrates full network deny (PoC-4b); Landlock TCP bits do not count`);
    }
    if (profile === 'restricted') {
        return refuse('IO_POLICY_UNSUPPORTED', `network profile 'restricted' is not offered in realm '${realmId ?? '<unbound>'}': the destination-filter / DNS / redirect Provider has not landed (plan §7)`);
    }
    return refuse('IO_POLICY_UNSUPPORTED', `network profile '${String(profile)}' is outside the closed set (deny | restricted)`);
}
/** The honest probe row for the network dimension at the given ABI level. */
export function networkProbeRow(abiVersion, realmId = 'unbound') {
    const abi = abiVersion === null ? 'no landlock ABI measured' : `landlock ABI v${abiVersion}`;
    return Object.freeze({
        dimension: 'network-destination',
        level: 'unsupported',
        mechanism: null,
        realmId,
        trustRoot: null,
        evidence: null,
        note: `${abi}: ${LANDLOCK_TCP_NOTE}`,
    });
}
//# sourceMappingURL=network.js.map