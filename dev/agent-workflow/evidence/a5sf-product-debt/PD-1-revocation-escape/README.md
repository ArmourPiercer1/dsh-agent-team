# PD-1 — revocation escape: the acceptance pin

Task: **PD-1 acceptance arm** — an executable reproduction of the revocation escape recorded as
PD-1 in [`PRODUCT-DEBT-REGISTER.md`](../../../../docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md).
Branch `task/a5sf-pd1-20261107` (worktree `.worktrees/a5sf-pd1`), based on `origin/master` =
`79d88a01692958d59dc092ef02f1c5556dda8d9c` (`DEBT-REGISTER: consolidate the four layer-B findings
into one ranked register`, #617). Host starts spent this round: **0**. `CORE PATCH_BUDGET = 0`: no
`packages/**` file is changed by this branch; the negative control edits
`packages/runtime/team-sandbox/src/terminal.ts` in-process, restores it byte-for-byte, and re-asserts
its sha256 and a clean `git diff` (§5). No grade, no `V@B`, no candidate claim, no merge.

**This is a defect pin, not an endorsement.** The arm asserts that the escape **currently
succeeds**. It is deliberately green today. When PD-1 is fixed it must turn **red on purpose**; the
failure message names the register row and says the register needs updating (§6). The arm is also
coupled to the register: it reds if the PD-1 row is deleted or downgraded from `governance hole`
(§6).

Artifacts:

| artifact | role |
| --- | --- |
| [`tests/world-factory/a5sf-pd1-revocation-escape.test.mjs`](../../../../tests/world-factory/a5sf-pd1-revocation-escape.test.mjs) | the arm: escape, WITH-domain contrast, register coupling |
| [`mutation-control.mjs`](mutation-control.mjs) + [`mutation-control.log`](mutation-control.log) | negative control: unconditional revocation record → arm control branch green, pin red, source restored |
| [`arm.log`](arm.log), [`suite.log`](suite.log), [`debt-register.log`](debt-register.log), [`doc-checks.log`](doc-checks.log) | gate transcripts |
| register row PD-1 | gained `**acceptance criterion**` pointing at the arm, stating it is deliberately green today |

---

## 1. The verified mechanism — file:line

The defect is exactly as the register describes in effect, and slightly narrower in cause than the
row's title suggests. At the base commit:

- **The acquire-side gate is generation-keyed.** `terminal.ts:168-169` refuses
  `if (revokedMembers.has(memberKey(identity)))`, where
  `memberKey` is `` `${teamId}/${memberInstanceId}#${instanceGeneration}` ``
  (`terminal.ts:132-134`). So a refusal exists only if a key for **this exact generation** was
  written.
- **The only writer of that key is `revoke`, and it writes it from the domains it can see.**
  `terminal.ts:249` is `async revoke(memberInstanceId?: string, reason = 'revoked')` — the method
  receives a member id, **no generation**. Its recording block (`terminal.ts:253-259`) loops over
  `domains.values()` and calls `revokedMembers.add(memberKey(domain.owner.identity))` only inside
  `if (domain.owner.identity.memberInstanceId === memberInstanceId)`. Then `terminal.ts:260-266`
  kills the same visible domains.
- **Therefore a member with zero live domains at revoke time writes zero keys.** The post-revoke
  `acquire` finds `revokedMembers` empty for that member/generation, passes the gate at
  `terminal.ts:168`, passes the revision check (`terminal.ts:171-176`), and spawns through the
  injected port (`terminal.ts:186-222`). The code's own comment at `terminal.ts:250-252` claims the
  revocation is marked before the first await precisely so an interleaving acquire cannot spawn a
  shell that survives the call — that comment is true only for members that already own a domain,
  which is the hole.
- **Why the fix is an owner decision, not a one-line loop repair:** the generation needed to compute
  `memberKey` is not an input to `revoke`. Recording "unconditionally" is impossible without either
  widening the signature or introducing an owner-scoped tombstone that deliberately ignores the
  generation (and would also block a re-created generation, which the current design permits —
  `packages/runtime/test/a5sf-terminal-lifecycle.test.ts` has an arm asserting exactly that).

**Did the register match?** The effect sentence is accurate: *"records a revoked generation key only
for members that already own a live domain, so a member with no shell at the moment of the revoke is
never recorded and `acquire` afterwards succeeds with one real port allocation."* Two precisions the
register does not spell out, and one number to read honestly:

1. **The cause is a missing input, not a forgotten branch.** The row's title ("does not bind a
   Member that owns no shell yet") and "true today" read like a loop that forgot a case. In fact
   `revoke` **cannot** compute the revoked key for a domain-less member: it never receives the
   generation. The row does say "carry the generation in `revoke()`'s signature" in its fix field,
   so the register is not wrong — but the defect field understates that this is structural. The
   user-facing mechanism is: **the key carries the generation; the method does not.**
2. **"one real port allocation" is one allocation request at the `PtyHandle` seam**, not a measured
   OS process. In this arm `spawn` is the injected recorder (`terminal.ts:51-57`); the arm counts
   one request. A real PTY is `NOT_REACHED` host-free. The register's sentence is defensible if
   "port" means the injected seam; it would be wrong if read as "an OS PTY was measured".
3. **Reachability is genuinely latent.** No file under `packages/**` calls `revoke`/`acquire` outside
   tests, and `RealmServiceFaces` still has no `terminals`
   (`packages/runtime/team-services/src/install.ts:441-448`), so no governed product composition can
   reach the escape. The register already states this as the backstop (PD-3). The escape is real at
   the module contract and **not reachable from a wired product realm today** — that is the honest
   scope, and it is the register's scope.

---

## 2. The surface the arm drives — and what "usable" means

The arm imports the **product package entry**
(`packages/runtime/team-sandbox/src/index.ts`, which publicly exports `createTerminalDomainRegistry`
at `src/index.ts:16`), not the private module file and not a stub of the registry. There is **no
product mount for a terminal face at this base** — `RealmServiceFaces` has no `terminals`, so the
composition refuses every `terminals` consumer with `TERMINALS_LEGACY_PTY_REFUSED`
(`install.ts:441-448`; PD-3). Mounting the composition would only re-measure that unrelated
refusal; the package entry is the deepest reachable **product** surface for this lifecycle. This is
the same seam the Shell-PTY layer-B arms use (`createTerminalDomainRegistry` through the repo's TS
loader); the arm needs no pinned-host checkout and no boot.

**"Usable" honestly means exactly two observations, and no more:**

1. the injected `PtyHandle` port was asked to `spawn` **exactly once** — i.e. a real backend would
   have had to open a shell for the revoked member; and
2. the per-command gate `assertCurrent(domainId)` — the product's only command-admission check for a
   live domain — **admits** (`ok: true`, `revision: 'rev-1'`), with the domain listed `active`.

It does **not** mean a command ran. `PtyHandle` (`terminal.ts:51-57`) carries `pid`, `backend`,
`descendants()` and `kill()`; there is no write/read channel, so this registry cannot execute a
command at all (PD-9 in the register is precisely that "write"/"read" are a gate and an audit). The
arm's assertion message and the log state this; the README does too.

What the arm does **not** claim: a real OS PTY, a live host session, a model-facing tool reaching the
registry, or a governed realm exposing it. Those need PD-3's wiring and a boot; this round is 0
boots.

---

## 3. The contrast case (why this is not "revocation does nothing")

The same fixture, the same identity, the same registry, with the shell acquired **before** the
revoke:

- `revoke(member)` returns the live `domainId`, `kill('SIGKILL')` is observed on the recorder, and
  `assertCurrent(domainId)` refuses afterwards;
- a post-revoke `acquire` returns **`DOMAIN_REVOKED`**, the allocation counter stays at **1**, and
  `list()` is empty.

So revocation demonstrably binds a member that owns a live domain; the escape is specific to the
member that owns none. The contrast arm is a **positive law** (it must stay green after a fix), and
it is what lets a future reader distinguish "PD-1 was fixed" from "revocation is inert".

---

## 4. The defect-pin contract (the inversion)

- Arm file: `tests/world-factory/a5sf-pd1-revocation-escape.test.mjs`. Every test title begins with
  **`KNOWN-DEFECT PD-1:`**.
- Default mode prints exactly one machine-readable line: **`PD1-ESCAPE-REPRODUCED`**.
- When PD-1 is fixed, the escape assertion fails and the message is the handover contract (verbatim
  from the run captured under the mutation, `mutation-control.log`):

  > **PD-1 NO LONGER ESCAPES — this RED is the arm doing its job, not a regression. PD-1 in
  > `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` (row "PD-1 (F3) — revocation
  > does not bind a Member that owns no shell yet") is now FIXED in the code: a Member that owned no
  > live domain at revoke time is refused when it acquires afterwards. The register needs updating
  > (re-classify or remove the governance-hole row, retire or invert this KNOWN-DEFECT pin, and keep
  > the WITH-domain contrast case green).**

- Control mode (`A5SF_PD1_EXPECT=fixed`) is set **only** by the negative-control driver and asserts
  the closed outcome instead: refusal `DOMAIN_REVOKED`, zero allocations, zero domains, and the line
  `PD1-ESCAPE-CLOSED`. It exists so the mutation can turn *this arm* green without weakening the
  default pin.
- `A5SF_PD1_EXPECT` is validated at module load; any value other than `escape`/`fixed` is a hard
  failure (the mode cannot be silently typo'd).

---

## 5. The negative control — red → green → restored

[`mutation-control.mjs`](mutation-control.mjs) edits the real product source in-process, runs the
same arm, and restores the file in a `finally`:

1. **Baseline** on the unmutated source: pin green, `PD1-ESCAPE-REPRODUCED` once.
2. **Mutation** (`terminal.ts`, sha256 `a2a24fcd…` → `ef9ec2ca…`): three single-occurrence edits —
   declare a member-scoped tombstone set, add the member id to it unconditionally at the top of
   `revoke`, and consult it beside the generation-keyed set at `acquire`. Now a domain-less member
   is recorded and the escape is impossible.
3. **Same arm, control mode**: **GREEN**, `PD1-CONTROL-REFUSAL code=DOMAIN_REVOKED allocations=0
   domains=0`, `PD1-ESCAPE-CLOSED`. This is the requirement that a fix makes this arm green — it
   proves the arm reads the defect, not a fixture artefact.
4. **Same arm, default mode, under the mutation**: **RED** with the handover message above. This is
   the inversion a *real* PD-1 fix will produce.
5. **Restore**: byte-for-byte equality, sha256 back to `a2a24fcd…`, `git diff --quiet --
   packages/runtime/team-sandbox/src/terminal.ts` rc 0. Then the pin is green again.

Result: `PD1-MUTATION-CONTROL-PASS` (full transcript in [`mutation-control.log`](mutation-control.log)).

**Why the mutation is member-scoped rather than "record the generation unconditionally":** the
literal version is not expressible — `revoke` has no generation to record. The control therefore
uses the owner-scoped tombstone the register's fix field names as the alternative. A consequence,
stated so it is not mistaken for a bug in the control: this mutation also blocks a member **re-created
at a new generation**, which the shipped design permits (`a5sf-terminal-lifecycle.test.ts`). That is
exactly why the real fix needs the owner ruling recorded in the row's `blocked by`, and why the
control is a *sensitivity instrument*, not the proposed fix. `CORE_PATCH_BUDGET = 0` holds: nothing
under `packages/**` is committed and the file is byte-identical afterwards.

---

## 6. The register coupling, and the exact sentence that becomes true

The third case in the arm reads
`docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` and reds if:

- the summary table no longer has a `PD-1 (F3)` row, or its consequence cell is no longer
  **`governance hole`**;
- the `### PD-1 (F3)` detail block's `**security consequence**` is no longer `**governance hole**`;
- the row no longer names `tests/world-factory/a5sf-pd1-revocation-escape.test.mjs` as its
  acceptance criterion;
- the row no longer states that the arm is **deliberately green today**.

So deleting or downgrading the record while the code still escapes reds the arm. The register row
gained exactly one new field, `**acceptance criterion**`; its classification (`governance hole`),
ranking (first of ten, "if only one row is fixed, fix PD-1"), and `decision = semantics` are
unchanged.

**The exact sentence that will be true once PD-1 is fixed:**

> Revoking a Member records the withdrawal independently of whether the Member owns a live domain:
> a shell acquired after `revoke` returns `DOMAIN_REVOKED` and makes zero port-allocation requests.

That is the assertion `A5SF_PD1_EXPECT=fixed` already makes under the mutation, and the assertion a
real fix must satisfy in default mode at which point the pin reds on purpose until the row is
updated.

---

## 7. Gates (all commands run in `.worktrees/a5sf-pd1`)

| gate | command | result |
| --- | --- | --- |
| the pin, green today | `node --test tests/world-factory/a5sf-pd1-revocation-escape.test.mjs` | **3/3 pass**, `PD1-ESCAPE-REPRODUCED` once ([`arm.log`](arm.log)) |
| negative control | `node dev/…/PD-1-revocation-escape/mutation-control.mjs` | **PASS**, pin green → mutation → control green → pin red → restored, sha256-identical, `git diff` clean ([`mutation-control.log`](mutation-control.log)) |
| a5sf suite, base vs with arm | `node --test tests/world-factory/a5sf-*.test.mjs` | base (tracked files): **406/406**; with the arm: **409/409**, 0 fail ([`suite.log`](suite.log)) |
| register integrity | `node --test tests/world-factory/a5sf-debt-register.test.mjs` | **7/7 pass** ([`debt-register.log`](debt-register.log)) |
| doc checks | `node scripts/doc-checks.mjs` | rc 0 ([`doc-checks.log`](doc-checks.log)) |
| whitespace | `git diff --check` | rc 0 |

Note on the base count: the first base run in this fresh worktree was short one file because
`tests/deepseek-harness-test-use` (gitignored, `0.2.0-rc.2 @ 639ed01539`) was not linked into the
new worktree; `a5sf-tool-axis.test.mjs` reds loudly on that absence. Linking the shared pristine
checkout (the same link every provisioned worktree uses) restored the true base: **406 tests, 406
pass**. The 406→409 delta is exactly this arm's three cases; no existing test changed status.

---

## 8. Boundaries and what this round found

- **No product fix.** The escape still works; the pin says so. No grade/`V@B`/gate change. No
  `packages/**` change (§5 restores the only temporary edit).
- **No boot.** No real PTY, no host session, no governed realm. The arm is host-free by design; the
  pinned-host gate and its `A5SF-…-HOST-REFUSED` law are untouched.
- **Duplication is deliberate, not an oversight.** The Shell-PTY layer-B suite already has
  `P1-REVOKE-WITHOUT-DOMAIN-IS-NOT-STICKY` (a *finding arm*). That arm is not coupled to the
  register, has no inversion contract, and has no mutation control. This arm is the register's
  acceptance criterion and adds those three things. The pty-contract arm should be retired (or
  pointed at this one) when PD-1 is fixed, together with the register row.
- **What the register understates (reported, not "fixed" in the record):** the cause is a missing
  API input (no generation on `revoke`), not a missed loop case; and "one real port allocation"
  is one `PtyHandle.spawn` request, not a measured OS process. Neither changes PD-1's
  classification, ranking, or consequence, so the register's classification was deliberately left
  untouched — but a reader should not conclude that the fix is a local loop repair.
- **The escape is latent, not live.** PD-3's missing face is the only thing keeping it unreachable
  from a governed realm. The register says this; it is the reason PD-1 is first in ship order. If
  PD-3 is wired without fixing PD-1, this pin stops being the only witness.
