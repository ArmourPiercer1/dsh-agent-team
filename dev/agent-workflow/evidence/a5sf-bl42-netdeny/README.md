# BL-42 — a confined network backend whose probe can honestly say `enforced`

**Task** `task/a5sf-bl42-netdeny-20261111` · base `origin/master` @ `47316541a` (PD14-FIX, #643)
· draft PR `BL42-NETDENY` · **not merged**, no settle.
**CORE PATCH BUDGET = 0**: `packages/**` only; upstream, the pinned host, and every
`docs/plans/finished/` contract are untouched.
**Boots: 0** (`DEV-LIVE` count = 0). Every listener in this evidence is
`127.0.0.1:0`; there is no external egress and no port in the 3180 family.

---

## 1. What changed, in one paragraph

Before BL-42 the confined lane had **no network mechanism at all**: the provider's
capability row said `network-destination: unsupported` with `mechanism: null` and
`evidence: null`, so a `network: deny` lane was refused by our own ADMISSION code
with zero processes. That is a statement about us, not about the OS — the sentence
`a5sf-subprocess-face/README.md` §7 told the truth about. BL-42 gives the
confined child a **network namespace** (`unshare(CLONE_NEWUSER|CLONE_NEWNET)`,
unprivileged, created by and for the child), measures a deny and a control through
a loopback listener **before** it lets any row say `enforced`, and makes the
capability row carry the mechanism and a realm-bound `evidence://` reference. The
`network: deny` admission now admits the lane **because the OS was asked and
answered**, and the refusal the old lane produced survives unchanged as the
negative control for a backend that cannot apply the mechanism.

Files:

| file | role |
| --- | --- |
| `packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py` | `enter_netns()`, the `--net-leg` measurement mode, the deny arm of `--confined-exec[-stream]`, and the inherited-socket-fd refusal |
| `packages/runtime/sandbox-provider/network.ts` | `NETNS_MECHANISM`, `NETNS_COVERAGE`, `NetworkEnforcementProof`, `networkEnforcedRow()`, and the proof-required `evaluateNetworkRequirement()` |
| `packages/runtime/sandbox-provider/probe-abi.ts` | `runNetworkLeg()` (the measurement) and `probeToCapabilities(..., net)` (the row is `enforced` **only** on `NET-DENY-CONFIRMED` + distinct inodes + non-empty mechanism/evidence) |
| `packages/runtime/sandbox-provider/provider.ts` | probe-first `prepare()`, `networkProofOf()`, the `network: deny` policy byte, the applied-facts receipt, and the streaming refusal |
| `packages/runtime/team-services/src/subprocess.ts` | `probeNetworkDenial()` now refuses a bare level: `enforced` without a mechanism, or without an evidence row, is `unsupported` |
| `tests/world-factory/a5sf-bl42-netdeny.test.mjs` | A1/A2/A2b/A3/P0/A5/A6 — the arms below |
| `tests/world-factory/lib/a5sf-sub-contract-world.mjs` | `launcherOverride` — the negative control runs the SAME product provider over a mutant launcher |

---

## 2. The mechanism, and the observation that proved it applied

**Mechanism: `netns`** — an unprivileged network namespace per confined child
(`CLONE_NEWUSER|CLONE_NEWNET`), with the child mapping its own uid/gid, gaining no
network interface but `lo` (down), and no inherited socket. Chosen against the
pinned host by measurement, not preference:

| candidate | why not chosen |
| --- | --- |
| Landlock | grades files, not sockets; `LANDLOCK_TCP_NOTE` already says v4 does not cover the network dimension |
| seccomp on `socket`/`connect`/`sendto` | weaker on INHERITED fds (a BPF filter cannot revoke an fd already open), needs a compiled program and a per-syscall allowlist that drifts with the payload |
| `bwrap --unshare-net` | works on this host (measured: deny child `ECONNREFUSED 111`, listener accept count unchanged), but adds an external binary dependency and a second mount-ns layer inside the wrapper the host already applies |
| **netns in the launcher** | **no external dependency, no system setting, fails closed, and the payload's OWN namespace inode is readable back as evidence** |

**The observation that proves it applied** (this is the part that matters — a
`--unshare-net` flag in an argv is not evidence). `--net-leg` binds a loopback TCP
listener and a UDP socket in the LAUNCHER process, generates a nonce, runs two
children with the same code and the same argv, and reads the counters **in the
parent**:

* control child (host netns): connects, sends the nonce → `accepted=1`,
  `datagrams=1`, `nonce_matched=true`;
* deny child (its own netns): `connect` fails `ENETUNREACH (101)`, `sendto` fails
  `ENETUNREACH (101)` → `accepted=0`, `datagrams=0`, and the child's own
  `/proc/self/ns/net` inode differs from the host's.

Measured on this host (`pin-after.log`):

```
MECHANISM mode-supported=true verdict=NET-DENY-CONFIRMED mechanism=netns
MECHANISM control-accepted=1 nonce-matched=true deny-accepted=0 tcp=ENETUNREACH udp=ENETUNREACH
MECHANISM netns=4026532407 host=4026531833
```

Namespace inode numbers are per-run; the ARM asserts the inequality, not the
numbers. The kernel preconditions this host needed are themselves measured and
recorded in the launcher: `PR_SET_DUMPABLE` before the `uid_map` write, and the
uid/gid captured **before** `unshare` (after it, `geteuid()` reads the overflow
uid and the map write fails `EPERM`).

---

## 3. Probe honesty: how a level became evidence

The chain is now: **measurement → row → proof → admission**, and every link can
say no.

1. `runNetworkLeg()` runs `--net-leg`. Anything other than
   `NET-DENY-CONFIRMED` (missing mode, `MIXED/FAILED`, unparseable, `NO-ENFORCEMENT`)
   is *not* a confirmation.
2. `probeToCapabilities()` emits `networkEnforcedRow` **only** when the verdict is
   `NET-DENY-CONFIRMED` with a non-empty mechanism, **distinct** netns inodes, the
   control's TCP **and** UDP paths accepted with the nonce matched, the deny's
   counters at zero, and both deny errnos present. Otherwise it emits the old
   `networkProbeRow` (`unsupported`, `mechanism: null`, `evidence: null`).
3. `probeNetworkDenial()` (the ONE probe both product faces share) treats an
   `enforced` row with no mechanism — or with a mechanism but no evidence row — as
   `unsupported`. **A level alone is not evidence.**
4. `evaluateNetworkRequirement('deny', realm, proof?)` admits only with a
   `NetworkEnforcementProof` (non-empty mechanism + evidence + two distinct numeric
   inodes). No proof → the historical `IO_POLICY_UNSUPPORTED`, before any process.
5. `prepare()` puts `network: "deny"` in the launcher policy **only** when the
   request asked for it, and `execute()` refuses `SANDBOX_UNAVAILABLE` if the
   launcher reports `network_unenforced` (the launcher's own fail-closed arm).

Three refusals survive deliberately: a backend with no probe; a backend whose probe
fails/throws/omits the row; and a backend that names `enforced` without mechanism or
evidence. All three are still `unsupported`, all three still refuse `deny` at
admission, and none of them spawns anything (`A2b`, `P0`).

---

## 4. The pin, and its flip

`pin.mjs` measures the same three propositions against **a launcher given on the
command line**. `pin-before.log` runs it against
`launcher-pre-bl42.py` (the file at `origin/master`, sha256
`1264ea584e3438d6d831c0c8426f5663579f638556af9376d3a6e3617e9736e3`, copied here so
the measurement stays reproducible); `pin-after.log` runs it against the shipped
launcher (sha256 `f418831915c624fbabfc534d4bc4f6b07e04e55670f728450c316adca05094b4`).

| proposition | before BL-42 | after BL-42 |
| --- | --- | --- |
| mechanism leg | `MIXED/FAILED`, `mechanism=null` (the mode does not exist) | `NET-DENY-CONFIRMED`, `mechanism=netns` |
| control / deny | not measured (no leg) | control `accepted=1`, nonce matched; deny `accepted=0`, min/udp `ENETUNREACH` |
| capability row | `unsupported`, `mechanism=null`, `evidence=null` | `enforced`, `mechanism="netns CLONE_NEWUSER|CLONE_NEWNET …"`, `evidence://a5p4/probe/<realm>/<stamp>`, realm + `sha256:` trust root |
| admission | `IO_POLICY_UNSUPPORTED` (refused before `prepare`) | admitted, `prepare()` reached, plan policy `network="deny"` |
| processes | 0 | 1 child per attempt, refused inside its own netns |

The **pin is not deleted**: the pre-fix behaviour is arm `P0`, and it is
*re-measured on every run* against a mutant launcher that short-circuits
`enter_netns()` — `unsupported` row, `NETWORK_UNCONFINED_REALM`, zero provider
calls. The old sentence about this host remains true for any host where the
mechanism cannot be applied.

Existing artefacts that described the old behaviour were updated, not rewritten:
`tests/world-factory/a5sf-sub-contract.test.mjs` P3-PROBE-SHAPE and
P3-DENY-REFUSES-BEFORE-SPAWN are now P3-PROBE-SHAPE (flip) and
P3-DENY-KERNEL-REFUSED (flip) and say so in their titles; the three fixtures that
modelled an `enforced` backend now carry a mechanism + evidence, because a bare
level is no longer accepted by the product code.

---

## 5. Mutation controls (each mechanism is load-bearing)

`mutation-controls.mjs` removes exactly one mechanism from the REAL source, runs
the BL-42 arms, and requires the protected arms to go RED while the rest stay
GREEN. Original bytes are restored in `finally` and verified sha-identical.
Report: `mutation-controls.json`.

| control | mutation | required RED | observed RED | everything else |
| --- | --- | --- | --- | --- |
| **MA** mechanism not applied | `enter_netns()` returns before it unshares | A1, A2, A3, A5 | A1, A2, A3, A5 | P0, A2b, A6 GREEN |
| **MB** probe honesty removed | `probeNetworkDenial` trusts the level: the mechanism/evidence guard is skipped **and** the level is hard-coded `enforced` | A2b, P0 | A2b, P0 | A1, A2, A3, A5, A6 GREEN |

`verdict: PASS` (both `RED-AS-REQUIRED`). MA is the mutation that would have been
invisible before BL-42 — with the mechanism gone, the arms that "prove the
mechanism" cannot pass. MB is the mutation that would have made the probe lie:
only the honesty arms notice, which is exactly the discrimination the bar asks for.

---

## 6. The §7 bar, item by item — the honest count

Bar text: `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7.

| # | item | satisfied? | artefact |
| --- | --- | --- | --- |
| 1 | capability row with mechanism + recorded evidence bound to realm/trust root, ABI/coverage listed | **YES (with the coverage exceptions in §7 below)** | `A2` asserts level/mechanism/`evidence://`/realmId/trustRoot; the row's note carries the leg numbers and `not-covered=af_unix_pathname,inherited_socket_fds`; `A2b` pins that a level without them is `unsupported` |
| 2 | a real child attempt that fails **inside** the deny lane as a kernel/transport denial | **YES** | `A3` (process face) and `A5` (terminal face): child stdout `ERR 101 Network is unreachable`, produced by the child's own `socket.connect`, with `world.spawn` returning no error — i.e. the refusal is NOT ours |
| 3 | positive control on the same invocation without the confinement that succeeds and is observed | **YES** | `A3`/`A5` allow-lane arm: same script, same argv, `CONNECTED`, listener counter `0 → 1` |
| 4 | out-of-band transport observation on both sides | **YES** | listener counters are read **in the test process** (not in the child, not in the provider): deny `unchanged (1)`, control `1`; plus `A1`'s launcher-side counters and namespace inodes |
| 5 | second consumer path | **YES for "second face", NOT for the README's "live Host preset" reading** | `A5` drives PD-13's confined terminal face (`createConfinedTerminalFace` → `terminals.startSend`) over the same process face, both sides measured. No Host was booted; the live-preset half is **not** claimed |

**Honest count: 4 of 5** under the strict README reading (item 5's live half is
missing); **5 of 5** under the owner's `live Host preset / second face` wording.
The difference is stated rather than resolved in my favour: the second consumer is
a real product face inside a real realm, but it is not a booted Host, and no
`DEV-LIVE` row is written.

---

## 7. What is NOT claimed (disclosures)

1. **`AF_UNIX` pathname sockets are outside the netns.** They are filesystem
   objects; the namespace does not reach them. The lane's business is the network
   dimension; a payload that opens a pathname socket still talks to the host — the
   filesystem lane governs whether it can open it, not this row.
2. **Inherited socket FDs are refused, not filtered.** The deny arm now refuses a
   spawn that declares an inherited socket fd (exit 125) instead of trying to
   contain one. The row's coverage list says so.
3. **DNS is measured only as DNS-shaped UDP transport** against a loopback
   listener — there is no external egress and no real resolver in this evidence.
   `UDP` is therefore covered as a transport, not as "DNS cannot resolve".
4. **`network: restricted` is untouched.** Only `deny` has a mechanism; the closed
   set's other member still refuses at admission for lack of a proof.
5. **A host that forbids unprivileged user namespaces reports `unsupported`** and
   the old admission refusal returns. That is the designed fail-closed behaviour,
   not a gap in the evidence: it is exactly what `P0` measures.
6. **No multi-user, no hostility test.** The namespace is owned by the child; a
   child that gains `CAP_SYS_ADMIN` inside its own user namespace could create
   interfaces, but it cannot reach the host's network — and this evidence does not
   claim more than "the child has no route to the host's network".
7. **No live Host, no ledger row, no `DEV-LIVE`.** `DEV-LIVE` count = 0.
8. **The receipt's applied facts are asserted at the provider seam** (`A3`/`A5`
   observe the child, not the receipt) — the receipt field is implemented and
   typechecked but is not the load-bearing evidence here.

---

## 8. The two sentences

**Now entitled to write** (this host, this tree):

> On this host a `network: deny` lane is **enforced by the operating system**: the
> confined child runs in its own unprivileged network namespace, a loopback
> listener that the unconfined control child reaches with a matched nonce records
> **zero** accepted connections from the deny child, the child's own `connect`
> and `sendto` fail `ENETUNREACH`, and the provider's capability row says
> `enforced` with the mechanism and a realm-bound evidence row that name the
> measurement they came from.

**Still not entitled to write:**

> A Member's `bash` cannot reach the network.

The sentence above is about the **lane** and the **face**, on hosts where the
mechanism was measured; it is not about the product's live wiring (no Host was
booted), it does not cover `AF_UNIX` pathname sockets or inherited socket FDs, it
says nothing about DNS as a resolver, and it does not survive on a host that
forbids unprivileged user namespaces — where the honest sentence remains the old
one: *the lane refuses at admission with zero processes because the provider's own
probe reports `unsupported`.*

---

## 9. Gates

| gate | result | log |
| --- | --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | 501 tests / 498 pass / 0 fail / 3 skipped (the three pre-existing env-gated defect pins) | `gate-a5sf.log` |
| `pnpm -r typecheck` | exit 0 (9 packages) | `gate-typecheck.log` |
| `npx eslint` on the new files | exit 0 — the three files are outside the configured lint surface (`File ignored because of a matching ignore pattern`), same as every other evidence driver | `gate-eslint.log` |
| `node scripts/check-artifacts-committed.mjs` | OK after rebuild + glue placement (dist mirror committed) | `gate-artifacts.log` |
| `node scripts/doc-checks.mjs` | exit 0 | `gate-doc-checks.log` |
| `node --test tests/world-factory/a5sf-debt-register.test.mjs` | 10/10 (three anchor line ranges re-pointed: the added probe block moved them; the symbols they name are unchanged) | `gate-register.log` |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | pass | `gate-state-freshness.log` |
| p4t6 scan | **1437 files / 15 hits — unchanged from the PD-14 measurement**; the new `.mjs` files are outside the scanned population (`bl42=0`) | `p4t6-measured.log` |
| package-TS lane (`scripts/run-tests.mjs runtime`) | **cannot run on this tree or at baseline**: the plain-node vitest shim has no `afterAll` / `toMatchObject` / `toHaveLength`. Measured identical failure in the main checkout at `550815c97`. Recorded as an infrastructure limitation, not a BL-42 failure; the affected behaviours are covered by the world-factory arms | `gate-package-ts.log` |

`CORE PATCH BUDGET = 0`; no upstream file, no pinned-host file, no
`docs/plans/finished/` contract was modified.

## 10. Reproduction

```bash
node dev/agent-workflow/evidence/a5sf-bl42-netdeny/pin.mjs \
  --launcher dev/agent-workflow/evidence/a5sf-bl42-netdeny/launcher-pre-bl42.py   # before
node dev/agent-workflow/evidence/a5sf-bl42-netdeny/pin.mjs                        # after
node dev/agent-workflow/evidence/a5sf-bl42-netdeny/mutation-controls.mjs
node --test tests/world-factory/a5sf-bl42-netdeny.test.mjs
```

`pin.mjs` imports the built dist (`packages/runtime/dist/...`), so run
`pnpm --filter @dsh-agent-team/runtime build` first if the dist is stale.
