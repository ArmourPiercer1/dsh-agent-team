# PD-7 — a stale-but-live shell is reported `active` (FIXED)

<!-- phase-identity: alpha5-sandbox-first -->

> **Scope.** This is a **correctness** fix in our own `packages/**`: the reported state is
> made to equal the state the command gate already enforces. It changes **no** authority
> semantics: the same commands are refused, the same domains stay alive, `killDomain` is
> still the only writer of the stored `status`, and there is still no per-domain kill.
> `CORE_PATCH_BUDGET = 0` is untouched — no upstream file was read or written.
>
> **0 boots**, 0 ports, no `DSH_HOME`, no real PTY. Every number below comes from
> `node --test` / `vitest run` in the task worktree.
>
> **Fix commit**: `e37f9520f984e466a75f027823f4acb5b4f3d3ec` (branch
> `task/a5sf-pd7-20261107`; the register row's `status` cites the same commit).

## 1. Mechanism (verified, not inferred)

`packages/runtime/team-sandbox/src/terminal.ts` (base `46ac9398c`) keeps a
`TerminalDomain` whose `status` is **creation-time bookkeeping**:

- `terminal.ts#L209` sets `status: 'active'` in the domain literal built by `acquire()`;
- `terminal.ts#L149-L158` `killDomain()` is the **only** writer of `status` (it sets
  `stale` while the kill is in flight, then `terminated`);
- `terminal.ts#L232-L246` `assertCurrent()` is the command gate. It compared the live
  `currentRevision(identity)` against the domain's recorded `policyRevision` and refused
  with `REVISION_STALE` when they differed;
- `terminal.ts#L269-L270` `list()` returned the stored domain objects **verbatim**:
  `return Object.freeze([...domains.values()])`.

A revision move with **no re-acquire** therefore produces exactly the PD-7 object: the PTY
is open, no code has written `status` (so it is still `'active'`), and every command is
refused by the gate. The report echoed the creation-time literal; it never asked the
predicate.

**Was `:209` still accurate?** Yes — `terminal.ts:209` is still `status: 'active',` in the
domain literal before and after this fix. The PTY evidence README cites `terminal.ts:209`
as *where `active` is set* and `terminal.ts:236-237` for the stale-but-live observation, not
as the `list()` implementation. The register's second anchor,
`terminal.ts#L269-L270`, was the `list()` line. Both citations were accurate at base; neither
line moved in this fix (see §5).

## 2. RED first

New arm in `tests/world-factory/a5sf-pty-contract.test.mjs`:
`P5-STALE-DOMAIN-REPORTS-STALE`. It acquires two bindings under `rev-1` (control: `list()`
says `active` and the gate accepts), then calls `setRevision('rev-2')` **without
re-acquiring**, so both domains are stale-but-live. For each it quotes both answers about
the same domain and asserts they agree.

RED run (`red-first.log`, 15 tests: 14 pass, 1 fail). The new arm failed with:

```text
AssertionError [ERR_ASSERTION]: PD-7: list() must not report a refused domain as active
  actual: 'active'   expected: 'active'   operator: 'notStrictEqual'
```

The gate answer at the same moment was already the state machine's own word:

```text
{ ok: false, code: 'REVISION_STALE',
  detail: "domain 'terminal-2' was created under 'rev-1', current is 'rev-2'; the shell is stale" }
```

while `list()` reported `{ domainId: 'terminal-2', policyRevision: 'rev-1', status: 'active' }`.

## 3. The fix — derived from the gate predicate, not a parallel flag

`assertCurrent` was lifted from a method into a closure function inside
`createTerminalDomainRegistry` **with its body, refusal codes, details and check order
unchanged**, and the registry now exposes it by shorthand. `list()` maps every domain
through that exact function:

```ts
function assertCurrent(domainId: string): { ok: true; revision: string } | TerminalRefusal { /* the gate, unchanged */ }

list(): readonly TerminalDomain[] {
  return Object.freeze([...domains.values()].map((domain) => (assertCurrent(domain.domainId).ok ? domain : reportedDomain(domain))))
},
```

```ts
function reportedDomain(domain: TerminalDomain): TerminalDomain {
  return domain.status === 'active' ? Object.freeze({ ...domain, status: 'stale' as const }) : domain
}
```

Why this shape:

- **One source of truth.** The report is literally the gate's answer; there is no second
  revision comparison and no parallel `stale` flag to drift. This is the class of bug PD-7
  was (two answers about one object), so the fix reuses the existing answer.
- **`list()` does not mutate.** It projects a frozen copy for the refused case. The stored
  `domain.status` is still written only by `killDomain`; a read cannot change lifecycle
  state.
- **Status vocabulary.** `TerminalStatus = 'active' | 'stale' | 'terminated'`. A gate refusal
  is either `REVISION_STALE` (revision moved) or `REVISION_UNKNOWN` (the lane publishes no
  current revision); both mean "not commandable", and `'stale'` is the existing word for
  that. No new status name was invented. An already `stale`/`terminated` domain keeps its
  own status.
- **No authority change.** `assertCurrent` refuses the same domains with the same codes;
  `revoke`, `acquire`, `shutdown`, the kill accounting and the absent per-domain kill are
  untouched.

What a reader should now expect from `list()`: `status: 'active'` **iff** a command to that
domain would be accepted by `assertCurrent` right now; `status: 'stale'` if the domain is
still registered but the gate would refuse it (`REVISION_STALE`/`REVISION_UNKNOWN`); and no
`terminated` row, because `killDomain` paths delete the domain from the registry.

## 4. GREEN

- New arm: PASS. `green.log` — 15 tests, 15 pass, 0 fail.
- Existing stale-domain arm `P5-KILL-ONE-NOT-THE-OTHER`: **its survival/refusal assertions
  are unchanged and pass**; see §6 for the one status expectation it had to change.
- `packages/runtime/test/a5sf-terminal-lifecycle.test.ts` (vitest, targeted team-sandbox):
  7/7 pass (`vitest.log`), including the `Object.keys(domain)` lifecycle-fact assertion,
  which is unaffected by the projected copy.

## 5. Anchors stayed put

The fix was arranged so that the anchor lines of **other** debt rows did not move:

- `terminal.ts#L249-L258` (`async revoke(...)`, PD-1) — revoke still starts at line 249;
- `terminal.ts#L284` (`killed: domain.status === 'terminated'`, PD-8) — still line 284;
- `terminal.ts#L51-L57` (`PtyHandle.descendants`, PD-9) — untouched.

PD-7's own first anchor had to change form: the gate is now a `function` rather than an
object method, so the row anchors `terminal.ts#L236` containing
`function assertCurrent(domainId: string)` (same predicate, same lines region as before)
and keeps `#L269-L270` for `list()`.

## 6. The existing arm that had to change (and why that is not a behaviour report)

`P5-KILL-ONE-NOT-THE-OTHER` line 627 previously asserted the defect itself:

```text
assert.equal(siblingRow.status, 'active', 'FINDING: a stale-but-live domain is reported active in list()')
```

It now asserts `'stale'` with the message "a superseded-but-live domain reports the state its
command gate enforces". This is the register's own predicted proof (`P5-KILL-ONE-NOT-THE-OTHER`
changes its asserted status from `active` to `stale`), and it is the *same* fact the new arm
asserts with a control — it is not a new behaviour claim. Every other assertion in that arm
(sibling not killed, `REVISION_STALE` on commands, no `registry.kill`, member-scoped revoke)
is byte-identical and still green.

## 7. Mutation control

Procedure: restore the base `terminal.ts` (`git checkout HEAD -- …/terminal.ts`) and also
restore the *pre-fix* expectation on line 627 (otherwise the corrected expectation would
carry the fix's behaviour into the mutation and red a second arm). The new arm stays in the
file. Result (`mutation-control.log`):

```text
✖ P5-STALE-DOMAIN-REPORTS-STALE: …                       1 fail
✔ P5-KILL-ONE-NOT-THE-OTHER: …                           1 pass
ℹ tests 15   pass 14   fail 1
```

**Only the new arm reds.** The new arm is load-bearing: it is the assertion that fails when
the report is allowed to drift from the gate again.

## 8. What this does *not* decide

Nothing here chooses whether a stale domain should be reaped, kept alive, re-acquired or
reported with a richer state. The object stays live exactly as before (no new kill), the
authority to run commands is unchanged, and `list()` only tells the truth about the refusal
that already existed. If a future decision is that a superseded domain should die instead of
being reported stale, that is a lifecycle/semantics change and a different task.
