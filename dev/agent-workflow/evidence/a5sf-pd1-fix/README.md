# PD-1 fix — generation-scoped revocation binds a member with no live shell

Task: implement the **owner-authorised PD-1 fix** ruled on 2026-11-09. Branch
`task/a5sf-pd1-fix-20261109` (worktree `.worktrees/a5sf-pd1-fix`), based on `origin/master` =
`fb9584da5733918113b1dbd01b08d6931cfb1ddb`. **0 boots**, no port, no DSH_HOME, `CORE PATCH_BUDGET = 0`
(only `packages/runtime/team-sandbox/**` and its `packages/**` caller changed). No merge, no settle.

| artifact | role |
| --- | --- |
| [`mutation-control.mjs`](mutation-control.mjs) + [`mutations.log`](mutations.log) | two negative controls: revert only the new recording line; disable only the post-await re-check. Source restored byte-for-byte. |
| [`red.log`](red.log) | the new arms against the OLD `terminal.ts` (RED) |
| [`green.log`](green.log) | post-fix arms + debt-register guard + runtime `a5sf` suite + all `tests/world-factory/a5sf-*` |
| [`typecheck.log`](typecheck.log) | `pnpm -r typecheck` (9 of 10 workspace projects, all Done) |
| register row | [`PRODUCT-DEBT-REGISTER.md`](../../../../docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md) PD-1 → `status: FIXED`, ruling sentence, arm names |

---

## 1. The chosen semantics and the signature

**Generation-scoped isolation, not a member-wide tombstone.** `revoke` now takes the trusted
member identity, so it can compute the generation key even when the member owns no live domain.
A re-created generation of the same member therefore still acquires — the property the owner
required to survive.

```ts
revoke(identity: TrustedMemberIdentity, reason?: string): Promise<readonly string[]>
```

- `TrustedMemberIdentity` supplies `teamId`, `memberInstanceId` and `instanceGeneration`;
  `memberKey(identity)` is `` `${teamId}/${memberInstanceId}#${instanceGeneration}` ``.
- **Fail closed on an incomplete identity.** If any of `teamId`, `memberInstanceId` or a finite
  `instanceGeneration` is missing, `revoke` throws `TerminalRevokeRefusalError`
  (`code: 'REVOKE_IDENTITY_UNTRUSTED'`) instead of guessing a generation. There is no string
  overload and no `undefined` "revoke all" fallback: a caller that cannot name a generation is
  refused. `shutdown()` remains the all-domains teardown.
- `revoke` records `revokedMembers.add(revokedKey)` **unconditionally before its first await**
  (`terminal.ts:298`), then kills the live domains of that same generation
  (`memberKey(domain.owner.identity) === revokedKey`). The old live-domain recording inside the
  loop is retained as defence in depth — and it is what lets the negative control isolate the new
  line (see §4).
- The exported symbols are `TERMINAL_REVOKE_REFUSAL_CODE` and `TerminalRevokeRefusalError`
  (`terminal.ts:77-85`, re-exported from `packages/runtime/team-sandbox/src/index.ts`).

### Updated callers (all of them; generation source for each)

| caller | call sites | generation source |
| --- | --- | --- |
| `packages/runtime/test/a5sf-terminal-lifecycle.test.ts` | `:145`, `:164` | `IDENTITY` constant (`member-pty`, `instanceGeneration: 1`); its re-creation arm derives generation 2 |
| `tests/world-factory/a5sf-pd1-revocation-escape.test.mjs` | refusal / live-domain / in-flight / new-generation arms | `MEMBER` (`instanceGeneration: 1`) and `NEXT_GENERATION` (`instanceGeneration: 2`) |
| `tests/world-factory/a5sf-pty-contract.test.mjs` | `:318`, `:327`, `:638` | `PTY_CONTRACT_IDENTITY` (`tests/world-factory/lib/a5sf-pty-contract-world.mjs:63-68`, `instanceGeneration: 1`) |
| `tests/world-factory/a5sf-pty-contract.test.mjs` | `:348` (no-live-shell arm) | `{ ...PTY_CONTRACT_IDENTITY, memberInstanceId: 'member-with-no-shell' }` — same trusted generation 1, different member |
| `tests/world-factory/a5sf-pty-contract.test.mjs` | finding arm `P1-REVOKE-WITHOUT-DOMAIN-IS-NOT-STICKY` | now asserts the fixed contract (`DOMAIN_REVOKED`, 0 allocations) instead of the escape |

No other `packages/**` caller exists: a repository search finds the definition, the lifecycle test,
and the two world-factory arm files only. (`plane.mutation.revoke` / `binder.revoke` /
`registry.revoke(familyId)` are different services — permission lifecycle, invocation binder,
approval-family registry — and are untouched.)

---

## 2. The defect mechanism (what was wrong)

- The acquire gate is generation-keyed: `if (revokedMembers.has(memberKey(identity)))`
  (`terminal.ts:190`), where the key includes `#instanceGeneration`.
- Before this fix, the **only writer** of that key was `revoke(memberInstanceId)`, and it wrote it
  from the domains it could see. A member with **zero live domains at revoke time** wrote zero
  keys, so its post-revoke `acquire` passed the gate, passed the revision check, and reached
  `spawn()` — one real port allocation and a live, gate-admitting domain.
- The generation needed to compute the key was not an input to `revoke`. The fix is therefore the
  signature change above, not a repaired loop.

---

## 3. The in-flight race window, exactly

```
terminal.ts:190   if (revokedMembers.has(memberKey(identity))) { ... }   <-- gate runs HERE
terminal.ts:220   const pty = await spec.spawn()                         <-- await (window opens)
        ...       (revoke can record the key and return while this is pending)
terminal.ts:239   if (revokedMembers.has(memberKey(identity))) { ... }   <-- NEW post-await check
terminal.ts:247   domains.set(key, domain)                               <-- publish (window closes)
```

Between the gate at `:190` and the publish at `:247` the domain is **not in `domains`**, so
`revoke`'s kill loop cannot see it; and if `revoke` lands while `spawn()` is pending, the
already-running `acquire` has already passed the gate. Publishing the late result would make a
revoked generation's shell eligible for execution.

**How the post-await check closes it** (`terminal.ts:233-246`): after `spawn()` resolves, the
created `TerminalDomain` is built but **not published**. The registry re-checks
`revokedMembers.has(memberKey(identity))`; if the key appeared meanwhile it calls
`killDomain(domain, 'revocation landed while the shell was being created')` (SIGKILL + audit
reason) and returns `{ ok: false, code: 'DOMAIN_REVOKED' }`. `domains.set` is never reached, so
`list()` has zero domains, no domain id was returned to the caller, and the shell is reaped.
There is no `await` between the re-check and `domains.set`, so a revoke cannot slip between them
in the single-threaded registry.

Coverage of both sides of the race:

- `PD-1 IN-FLIGHT` arms a revoke during an awaited `spawn()` while a live shell exists on another
  binding; the revoke records the generation through the retained live-domain path, and only the
  post-await re-check can stop the late creation. `mutations.log` CONTROL B disables exactly that
  re-check and reds exactly this arm.
- The **no-live-domain** in-flight case is covered by the same re-check plus the unconditional
  recording that `PD-1 REFUSAL` pins. The fixture deliberately keeps a live sibling so the two
  controls stay separable (CONTROL A reds refusal only; CONTROL B reds in-flight only).

---

## 4. RED → GREEN

RED (`red.log`, on `fb9584da5` with the new arms): `PD-1 REFUSAL` **fails** — the post-revoke
acquire succeeds with an allocation; `PD-1 IN-FLIGHT` fails; the live-domain contrast fails only
because the old signature cannot accept the identity object at all; the register arm fails until
the row is updated. **`PD-1 CONTRAST (new generation)` already passes on the old code** — that is
the existing behaviour the ruling requires us not to break.

GREEN (`green.log`):

- `PD-1 REFUSAL` — `DOMAIN_REVOKED`, **0 allocations**, 0 domains.
- `PD-1 CONTRAST (live domain)` — visible shell SIGKILLed, gate refuses, re-acquire refused.
- `PD-1 IN-FLIGHT` — late creation `DOMAIN_REVOKED`, SIGKILL observed, **0 usable domains**,
  spawned exactly once.
- `PD-1 CONTRAST (new generation)` — **PASSES**: a re-created generation acquires and its gate
  admits. This is the acceptance test for the ruling; it did not regress.
- `PD-1 REGISTER` — row is `FIXED`, carries the ruling sentence verbatim, names all four arms.
- debt-register guard: 9/9. Runtime `a5sf` suite: 13 files / 196 tests. All
  `tests/world-factory/a5sf-*`: **23 files / 441 tests, 0 fail, 2.58 s**.

### Negative controls (`mutations.log`)

- **CONTROL A** — revert only `revokedMembers.add(revokedKey)` (`terminal.ts:298`). Result: exit 1,
  **exactly `PD-1 REFUSAL` reds**; live-domain contrast, in-flight and new-generation contrasts
  stay green (the retained loop records a visible domain). This proves the refusal arm measures
  the new recording line and not a fixture artefact.
- **CONTROL B** — disable only the post-await re-check. Result: exit 1, **exactly `PD-1 IN-FLIGHT`
  reds**; refusal and both contrasts stay green. This proves the race arm measures the post-await
  check.
- Both mutations restore the source byte-for-byte (sha256
  `7fb3941bd4438f84a75bfc7bff8576b832f294face422704fd5852360acab232`) and the working-tree diff is
  identical to the start of the control.

---

## 5. What this fix does **not** cover

1. **Truthfulness of the caller's generation.** `revoke` validates structure only (`teamId`,
   `memberInstanceId`, finite `instanceGeneration`). It deliberately does **not** consult
   `options.isTrustedMember`, because an authority must be able to revoke a member that is being
   archived (already leaving the trusted set). Nothing in this module proves the caller passed
   the *real* generation: a wrong-but-valid generation records the wrong key, and the real
   generation would not be bound. That is an authority-lane obligation (the policy lane that
   mints `TrustedMemberIdentity`), not enforceable here. It is the same trust the acquire side
   already places in `isTrustedMember` + `currentRevision`.
2. **Generation vs. the domain map key.** `keyOf` still does not include the generation
   (`teamId/memberInstanceId/toolBindingIdentity`). A gen-2 acquire for a binding whose gen-1
   domain is live and *not revoked* can reuse that gen-1 domain. PD-1 does not change reuse
   semantics and this fix does not address that separate generation-confusion surface.
3. **Revision tightening during `spawn()`.** The post-await re-check covers *revocation* only.
   `policyRevision: current` is captured before the await; a revision that tightens while
   `spawn()` is pending is caught later by `assertCurrent` (the domain is published but every
   command is `REVISION_STALE`). PD-1's ruling scoped the race to revocation; no "kill on
   revision change during spawn" was added.
4. **Kill scope.** `revoke(identity)` kills and tombstones exactly that generation. A live domain
   of a different generation of the same member is intentionally untouched (that is the
   re-creation contrast). If an operator means "all generations", that is a caller-level loop or
   `shutdown()`, not this method.
5. **Reachability and liveness.** `RealmServiceFaces` still has no `terminals` face (PD-3), so no
   governed product composition reaches `revoke`/`acquire`; the arms are host-free and use the
   injected `PtyHandle` recorder. No real OS PTY, no model-facing tool, no boot is claimed.
6. **The old evidence directory** [`a5sf-product-debt/PD-1-revocation-escape/`](../../a5sf-product-debt/PD-1-revocation-escape/README.md)
   describes the superseded defect pin and its old mutation control. Its banner points here; its
   `mutation-control.mjs` matches the pre-fix source and is not part of this fix's gates.
