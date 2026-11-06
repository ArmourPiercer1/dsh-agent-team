# PD-15 — a network-enforcement proof is bound to the face that consumes it

**Task** `task/a5sf-pd15-face-bound-proof-20261111` · base `origin/master` @ `e411363d8` (#645)
· draft PR **#646**, first line `PD15-FIX` · **not merged**, no settle.
**Register:** `PRODUCT-DEBT-REGISTER.md` PD-15 — finding id **`FACE-BOUND-PROOF`**, `FIXED`
with residuals (1)–(4).
**CORE PATCH BUDGET = 0**: `packages/**` + our tests only; upstream, the pinned host and every
`docs/plans/finished/` contract are untouched.
**Boots: 0** (`DEV-LIVE` count = 0). No listener, no socket, no external egress, no port in the
3180 family.

---

## 1. The finding (from #645's review of BL-42)

The confined `web` face admitted a `network: deny` call on **any** backend whose
`network-destination` capability row said `enforced` with a non-empty mechanism and an evidence
reference. BL-42's proof (a per-child `CLONE_NEWUSER|CLONE_NEWNET`) was bound to the **realm** (its
`evidence://` reference and trust root) but not to the **face** that measured it. A composition
that handed the web transport the SUBPROCESS lane's realm-bound proof would therefore have
admitted a deny `web_fetch` into ordinary host egress — and BL-42's netns only ever covers a child
the launcher started, never the in-process web transport.

No in-tree composition did this (the web path still reports `unsupported`), so the hole was
**latent**, not measured. It was fixed while latent: a latent hole closes with a typed check and a
defect pin, not with a live round.

## 2. The pin, and its flip

`tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs` arm `P0` asserts the PRE-FIX behaviour
verbatim: a web provider whose probe says `enforced` **and whose `networkProof()` returns the
subprocess face's proof** is admitted and reaches the fake provider (ordinary host egress). It is
skipped by the normal gate unless `A5SF_PD15_PIN=1`, so the committed tree cannot red its own gate;
the flip is recorded in the two logs below.

| arm | pre-fix tree (product sources at `origin/master`) | fixed tree |
|---|---|---|
| `P0` defect pin: subprocess-face proof admits a deny `web_fetch` | **PASS** (the hole, asserted) | **FAIL** — this is the fix |
| `D1` subprocess-face proof refused, typed `NETWORK_PROOF_FACE_MISMATCH`, 0 fetch/DNS/connect/proxy | FAIL | PASS |
| `D2` `enforced` row with no face-bound proof refused as `NETWORK_UNCONFINED_REALM` | FAIL | PASS |
| `A1` a proof minted for the `web` face ADMITS on the web face | PASS (by accident: the row alone admitted) | PASS (for the right reason) |
| `A2` a `subprocess` proof still admits on the subprocess face | FAIL (`face` field did not exist) | PASS |
| `A3` a `subprocess` proof with no measured namespace identity refused | FAIL | PASS |
| `T1` tampered / absent / unknown face, and no consumer face, all refused | FAIL | PASS |

- `pin-before.log` — `A5SF_PD15_PIN=1`, product sources restored to `origin/master`: `P0 ✔`,
  `D1/D2/A2/A3/T1 ✖` (and `A1 ✔` for the wrong reason — see the table).
- `pin-after.log` — same command on the fixed tree: `P0 ✖` (by design), everything else `✔`.

The command, the fixture and the world are byte-identical between the two logs; the flip is a
property of the product path, not of the test.

## 3. Why the proof belongs to the FACE, not to the realm alone

A realm is an identity/binding scope; a face is the mechanism boundary that a proof is measured
on. BL-42's observation is about a **process**: the launcher starts a control child and a deny
child, the deny child's `/proc/self/ns/net` differs from the host's, its `connect`/`sendto` fail
`ENETUNREACH`, and the listener counters do not move. That sentence is true of the subprocess face
and false of an in-process transport, which never enters any namespace.

Realm binding answers "was this measured in *our* realm?"; it cannot answer "was this measured on
*the boundary this caller is about to cross*?". Before PD-15 the second question was never asked,
so a real proof for one boundary was accepted as evidence for another. The fix makes that question
unskippable: `NetworkEnforcementProof.face` is required, `evaluateNetworkRequirement` takes the
consumer's face, and a mismatch (or an unnamed proof, or a caller that cannot name its face) is the
typed `NETWORK_PROOF_FACE_MISMATCH` refusal.

## 4. The fix

| file | change |
| --- | --- |
| `packages/runtime/sandbox-provider/network.ts` | `NETWORK_ENFORCEMENT_FACES = ['subprocess','web']`; `NetworkEnforcementProof.face` (required) and nullable namespace inodes; `isNetworkEnforcementFace`; `NETWORK_PROOF_FACE_MISMATCH`; `evaluateNetworkRequirement(..., consumerFace)` refuses unnamed/mismatched/incomplete proofs |
| `packages/runtime/sandbox-provider/provider.ts` | `networkProofOf()` mints `face: 'subprocess'` and the gate passes `'subprocess'` as the consumer |
| `packages/runtime/team-services/src/web.ts` | `ConfinedWebProvider.networkProof()`; the guard keeps the BL-17 `enforced` check and then requires a proof whose face is `web`; mismatch → `NETWORK_PROOF_FACE_MISMATCH`, none → `NETWORK_UNCONFINED_REALM` |
| `packages/runtime/team-services/src/types.ts` | `NETWORK_PROOF_FACE_MISMATCH` joins the per-call `TEAM_IO_DENIAL_CODES` |
| `tests/world-factory/lib/a5sf-web-arms.mjs` | the fake web boundary can carry a face-bound `networkProof` (a fixture value; it measures no network) |
| `tests/world-factory/a5sf-web.test.mjs` | `PROBE-LOAD-BEARING` now requires the probe AND this face's proof |
| `tests/world-factory/a5sf-bl42-netdeny.test.mjs`, `a5sf-sub-contract.test.mjs` | BL-42's proofs gain the `face` field and the evaluator call names its consumer — the legitimate consequence of the type change |
| `packages/runtime/test/a5sf-subprocess-contract.test.ts` | a **pre-existing BL-42 consequence**, not a PD-15 change: the arm expected the real provider to be incapable of `network: deny`, which BL-42 made false; it now downgrades only the network row of the SAME measured probe so it still tests the runner's refusal path |

## 5. The negative controls, and what each proves

- **A1 — a correctly face-bound `web` proof still admits.** The probe reports `enforced` and the
  provider's `networkProof()` says `face: 'web'`; one provider fetch, one ALLOW fact. This is the
  control that the fix is not "refuse every web deny".
- **A2 — a correctly face-bound `subprocess` proof still admits on its own face**, through the
  same evaluator, and a `web` proof does **not** admit on the subprocess face. This is the control
  that the binding is symmetric and did not break BL-42's lane.
- **T1 — tampering reds the admission.** A `web` proof with `face` changed to `subprocess` is
  refused on the web face; a proof with no `face` is refused (not defaulted); an unknown face is
  refused; a caller that omits its own consumer face is refused.
- **BL-42's own end-to-end suite** (`a5sf-bl42-netdeny.test.mjs`: real launcher, real child, real
  netns, real `ENETUNREACH`, listener counters) stays green — the subprocess lane's proof gained the
  field and lost no observation.

## 6. What is NOT claimed

1. **The web face is NOT OS-isolated.** The web transport is in-process; no proof shape makes it
   OS-isolated today. A `web`-face proof is only ever a **service-level** statement. A future web
   transport riding a confined child is the only path to an OS-level sentence for this face.
2. **Face binding stops replay, not perjury.** The proof is self-described; a composition that
   deliberately mints a false `face: 'web'` proof is caught by review/composition, not by the field.
   What is now impossible is the *accident*: a genuine subprocess proof can no longer be replayed
   into the web face.
3. **No live Host, no composition supplies a web-face proof.** An admitted deny `web_fetch` would
   still be ordinary host egress; no `DEV-LIVE` or `CANDIDATE-C2` row was written.
4. **`network: restricted` is untouched.**
5. **No grade, `V@B`, matrix ⑧/⑨ cell moved.**

## 7. Gates

| gate | result | log |
| --- | --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **508 tests, 504 pass, 0 fail, 4 skipped** (the 4 skips are deliberate pins/optional arms, incl. PD-15 `P0`) | `gate-a5sf.log` |
| package TS: `a5p4-network-closure` + `a5p4-provider` + `a5sf-subprocess-contract` + `a5sf-confined-subprocess` + `a5sf-subprocess-unconfined-realm` + `a5sf-terminal-lifecycle` + `u7f-web-c1` | **7 files, 103/103 pass** | `gate-package-web-sub-terminal.log` |
| `pnpm -r typecheck` | exit 0 (9 packages) | `gate-typecheck.log` |
| `npx eslint` on the new files | see `gate-eslint.log` (the world-factory driver is outside the configured lint surface, like every other evidence driver) | `gate-eslint.log` |
| `node scripts/check-artifacts-committed.mjs` | verdict `ok` after rebuild + `git add` of the runtime dist mirror | `gate-artifacts.log` |
| `node scripts/doc-checks.mjs` | exit 0 | `gate-doc-checks.log` |
| `node --test tests/world-factory/a5sf-debt-register.test.mjs` | **10/10** | `gate-register.log` |
| `node scripts/ci-pr-gate.mjs --only state-freshness` | pass | `gate-state-freshness.log` |
| p4t6 scan | **1437 files / 15 hits — unchanged**; every new file in this lane is `.mjs` under `tests/` or `dev/`, outside `packages/**` (the scanner's scope), so no booking is owed. The ledger test itself is 20/20 | `p4t6-measured.log`, `gate-p4t6.log` |

`CORE PATCH BUDGET = 0`; no upstream file, no pinned-host file, no `docs/plans/finished/`
contract was modified. The pinned test-use tree is the shared read-only checkout addressed
through `tests/deepseek-harness-test-use` (a gitignored link in this worktree, as in the other
worktrees).

## 8. Reproduction

```bash
# the normal gate
node --test tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs

# the pin: P0 green before the fix, red after it
A5SF_PD15_PIN=1 node --test tests/world-factory/a5sf-pd15-face-bound-proof.test.mjs
```

`pin-before.log` was produced by restoring exactly `network.ts`, `provider.ts`, `web.ts` and
`types.ts` to `origin/master` and re-running the second command; `pin-after.log` is the fixed tree.

## 9. The two sentences

**Now harder to fake:**

> A `network: deny` web call cannot be admitted on another face's proof: the proof must name the
> face it was measured for, the guard must name the face asking, and a mismatch is the typed
> `NETWORK_PROOF_FACE_MISMATCH` refusal before any provider call — BL-42's subprocess netns proof
> can no longer be replayed into the in-process web transport.

**Still simply unavailable:**

> OS-level network isolation of the web face. The web transport runs in the process that holds the
> Member's scope; no proof shape reaches into a network namespace it never enters, so a `web`-face
> proof is a service-level statement and an admitted deny `web_fetch` is still ordinary host
> egress. A future web transport that rides a confined child is the only path to the OS-level
> sentence.
