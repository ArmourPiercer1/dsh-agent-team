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
 * BL-42 (2026-11-11) — `deny` NOW HAS EXACTLY ONE ADMISSIBLE FORM: a
 * {@link NetworkEnforcementProof} that a MEASURED mechanism was applied. The
 * proof is not something a caller may invent; it is derived from the provider's
 * own `--net-leg` observation (a real control child reaching a loopback
 * listener, a real deny child in a distinct network namespace whose connect and
 * send fail with a kernel errno while the listener's own counters do not move)
 * and it must carry a non-empty mechanism AND the evidence reference the
 * capability row itself carries. Without it, `deny` is refused with the same
 * code and the same words as before — the closed answer, never a default-allow.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/network
 */

import { refuse, type AssuranceDimension, type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js'

/** The network profile closed set — there is NO unconfined arm. */
export const NETWORK_PROFILES = ['deny', 'restricted'] as const

/** One network profile. */
export type NetworkProfile = (typeof NETWORK_PROFILES)[number]

/**
 * What ABI v4's net surface actually is — stated verbatim in every probe row
 * for `network-destination`. It must never read like "no network".
 */
export const LANDLOCK_TCP_NOTE =
  'Landlock ABI v4 mediates only TCP port bind/connect inside the domain; UDP, IPv6 raw paths, AF_UNIX sockets, inherited socket FDs and out-of-band routes are NOT covered — this is not a general no-network guarantee (PoC-4b)'

/**
 * BL-42 — THE MECHANISM STRING. One mechanism, named once: a fresh
 * `CLONE_NEWUSER|CLONE_NEWNET` pair created by the confined child for itself
 * (see `launcher/landlock-prelauncher.py#enter_netns`). It is a string on the
 * capability row because a row without a mechanism is exactly what this project
 * refused to accept as evidence.
 */
export const NETNS_MECHANISM =
  'netns CLONE_NEWUSER|CLONE_NEWNET per confined child (unprivileged, owned by the child; verified by the child\'s own /proc/self/ns/net inode)'

/**
 * WHAT THE NETNS MECHANISM COVERS, stated so it cannot be read as more. The
 * same list sits in the launcher and in the row note `runNetworkLeg` builds.
 */
export const NETNS_COVERAGE = Object.freeze({
  covered: Object.freeze(['tcp', 'udp', 'ipv4', 'ipv6', 'raw', 'af_unix_abstract', 'loopback']),
  notCovered: Object.freeze([
    'af_unix_pathname (a filesystem object, not a network destination — the lane decides)',
    'inherited_socket_fds (refused outright by the launcher\'s deny-lane fd gate)',
  ]),
})

/**
 * BL-42 — what a REAL `deny` admission must be able to show. Every field is a
 * measured fact or a binding, never an intention: `mechanism` and `evidence` are
 * what the capability row must carry, and the inodes are the namespace
 * identities the probe leg observed (host vs. deny child).
 */
export interface NetworkEnforcementProof {
  /** Non-empty mechanism name (currently always {@link NETNS_MECHANISM}). */
  readonly mechanism: string
  /** The `evidence://` reference the capability row carries, bound to the realm. */
  readonly evidence: string
  /** The deny child's network-namespace inode (observed, not assumed). */
  readonly netNsInode: number
  /** The host's network-namespace inode, for the inequality the leg asserts. */
  readonly hostNetNsInode: number
}

/**
 * Gate a network profile BEFORE any process exists. `undefined` claims nothing;
 * `deny` requires a measured {@link NetworkEnforcementProof}; `restricted` is
 * still refused on this lane's provider set; anything else is outside the closed
 * set.
 */
export function evaluateNetworkRequirement(
  profile: NetworkProfile | undefined,
  realmId: string | null,
  proof?: NetworkEnforcementProof | null,
): ProviderResult<null> {
  if (profile === undefined) return { ok: true, value: null }
  if (profile === 'deny') {
    if (proof !== undefined && proof !== null
      && typeof proof.mechanism === 'string' && proof.mechanism.trim() !== ''
      && typeof proof.evidence === 'string' && proof.evidence.trim() !== '') {
      return { ok: true, value: null }
    }
    return refuse(
      'IO_POLICY_UNSUPPORTED',
      `network profile 'deny' is not offered in realm '${realmId ?? '<unbound>'}': no provider in this lane demonstrates full network deny (PoC-4b); Landlock TCP bits do not count, and a mechanism without a recorded applied-evidence row is not a mechanism`,
    )
  }
  if (profile === 'restricted') {
    return refuse(
      'IO_POLICY_UNSUPPORTED',
      `network profile 'restricted' is not offered in realm '${realmId ?? '<unbound>'}': the destination-filter / DNS / redirect Provider has not landed (plan §7)`,
    )
  }
  return refuse('IO_POLICY_UNSUPPORTED', `network profile '${String(profile)}' is outside the closed set (deny | restricted)`)
}

/** The honest probe row for the network dimension at the given ABI level. */
export function networkProbeRow(abiVersion: number | null, realmId = 'unbound'): ProcessCapabilityRow {
  const abi = abiVersion === null ? 'no landlock ABI measured' : `landlock ABI v${abiVersion}`
  return Object.freeze({
    dimension: 'network-destination' as AssuranceDimension,
    level: 'unsupported' as const,
    mechanism: null,
    realmId,
    trustRoot: null,
    evidence: null,
    note: `${abi}: ${LANDLOCK_TCP_NOTE}`,
  })
}

/**
 * BL-42 — the `enforced` row. Issued ONLY from a `NET-DENY-CONFIRMED` net leg,
 * and it carries every field the refusal path used to find `null`: mechanism,
 * realm binding, trust root and the evidence reference. `note` restates the
 * leg's own numbers, so the row is a measurement, not a claim.
 */
export function networkEnforcedRow(init: {
  readonly realmId: string
  readonly trustRoot: string | null
  readonly evidence: string
  readonly note: string
  readonly abiVersion: number | null
}): ProcessCapabilityRow {
  return Object.freeze({
    dimension: 'network-destination' as AssuranceDimension,
    level: 'enforced' as const,
    mechanism: NETNS_MECHANISM,
    realmId: init.realmId,
    trustRoot: init.trustRoot,
    evidence: init.evidence,
    note: `${init.note} | coverage covered=${NETNS_COVERAGE.covered.join(',')} not-covered=${NETNS_COVERAGE.notCovered.join(';')}`
      + (init.abiVersion === null ? '' : ` | landlock ABI v${init.abiVersion} is NOT the network mechanism here`),
  })
}
