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
import { type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js';
/** The network profile closed set — there is NO unconfined arm. */
export declare const NETWORK_PROFILES: readonly ["deny", "restricted"];
/** One network profile. */
export type NetworkProfile = (typeof NETWORK_PROFILES)[number];
/**
 * What ABI v4's net surface actually is — stated verbatim in every probe row
 * for `network-destination`. It must never read like "no network".
 */
export declare const LANDLOCK_TCP_NOTE = "Landlock ABI v4 mediates only TCP port bind/connect inside the domain; UDP, IPv6 raw paths, AF_UNIX sockets, inherited socket FDs and out-of-band routes are NOT covered \u2014 this is not a general no-network guarantee (PoC-4b)";
/**
 * Gate a network profile BEFORE any process exists. `undefined` claims
 * nothing; the two closed profiles are refused on this lane's provider set;
 * anything else is outside the closed set.
 */
export declare function evaluateNetworkRequirement(profile: NetworkProfile | undefined, realmId: string | null): ProviderResult<null>;
/** The honest probe row for the network dimension at the given ABI level. */
export declare function networkProbeRow(abiVersion: number | null, realmId?: string): ProcessCapabilityRow;
//# sourceMappingURL=network.d.ts.map