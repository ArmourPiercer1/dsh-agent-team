# S4 — jobs stays a NAMED BRIDGE (not an ordinary FamilyAssembly descriptor)

Decision: the jobs trio (`job_output` / `job_list` / `job_kill`) is **left on its
named-bridge path** in `team-tool-plane.mjs`. It is NOT expressed through the
FamilyAssembly seam, because doing so would change semantics:

* **Bridge identity is injected, not built.** The bridge body
  (`createGovernedJobsBridge`) is constructed by the trusted entry
  (`agent-bindings.mjs`, protected) with the gateway row, the plane row and the
  host jobs service, and arrives as `input.backends.jobs`. An ordinary
  descriptor builds its own effect bodies from capabilities; giving a family
  the bridge as a capability would make the descriptor the owner of a
  bridge-identity decision it does not own today.
* **Registration is conditional on that injection**, not on config alone:
  `jobsEnabled === true` with NO bridge mounts the typed shut rows and
  registers **no** candidate (the trio is then not kernel-owned). The seam's
  `enabled → build → register` contract registers whenever a family is enabled;
  a "placed but never registered, never owned" arm is exactly the
  self-attestation the U6 PR4 law forbids, and inventing it as a generic seam
  feature would widen the seam for one bridge.
* **The cross-key laws are the bridge's, and gate OTHER families.** #392's
  closed `backgroundJobs` key and the CREATING-LANE PIN LAW
  (`backgroundJobs` ⇒ `jobsEnabled` ∧ attribution producer ∧ confined
  provider ∧ `names.bash === 'bash'`) are validated before any family runs,
  because they decide whether the PROCESS family's shell backend gets its
  background arm. Moving them into a descriptor would make one family's config
  validation depend on another family's descriptor order.

What DID change for jobs (generic, no semantic change):

* the `kernelFamilies.jobs` flag is gone: kernel ownership of the trio is now
  read from the mount-time claim table (`mountClaims`, names claimed by a
  candidate REGISTERED on this mount) — the same truth the flag mirrored
  (owned iff the bridge contribution registered);
* the four hand-written dispose `revoke` + `dropApprovalsForFamily` pairs
  became ONE loop over the registry's live candidates (registration order), so
  the jobs candidate drains through the same law as the seam families;
* the trio's approval entries bind through the ONE S2 binder (familyId from the
  registered `dsh.jobs-family` descriptor).

Byte pins (measured on this branch; `s4-jobs-byte-pins.txt`):

| Pin | Required | Measured |
| --- | --- | --- |
| `createGovernedJobsBridge` region (u6-pr4 A1) | `71705d6e…b29f` | `71705d6e…b29f` |
| `jobs-gateway-assembly.mjs` | `c99ecaad…8b53` | `c99ecaad…8b53` |
| `pa-mount-registry.mjs` | `fa1d831d…510d` | `fa1d831d…510d` |

`git diff 88107ad71` over all three files is empty. #391's
`invokeClasses` / `knownEffectClasses` supply lives in
`jobs-gateway-assembly.mjs` / `agent-bindings.mjs`, both untouched.

Suites (this tree): u6-pr4-jobs-bridge 24, u74a-jobs-producer 20,
a5p7-jobs-assembly 14, a5p7-jobs-assembly-actuator 40, a5p7-lane-hygiene 5,
u7-w0b law 21 (incl. jobs P1/P2/P4), ARC-D adversarial 13 + matrix 4 — 141/141.
The 12-config mount fingerprint (incl. jobsNoBridge / jobsBridge / jobsBad) is
byte-equal to base 88107ad71.

What remains jobs-specific in the plane (and is the bridge's, by design): the
named imports from `./jobs-family-bridge.mjs`, the `jobsEnabled` /
`backgroundJobs` closed keys and their cross-key laws, the trio row build over
the injected bridge, and its conditional registration. The S5 fitness test
allows exactly this named-bridge block and nothing family-specific beyond it.
