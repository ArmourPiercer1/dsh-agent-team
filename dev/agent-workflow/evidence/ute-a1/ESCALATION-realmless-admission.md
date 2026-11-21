# ESCALATION — a member without a confined-provider realm gets NO admission at all

**Raised:** round 34. **Class:** a preserved capability cannot be delivered under the current contract
without a ruling (it is not a bug I can fix by choosing a side).

## What the code says

`agent-bindings.mjs` installs the centre — admission point, durable ledger, settlement — only when a
confined provider realm is mounted:

```js
const a5sfRowConfig = a5sfRealmConfigOf(config)
if (a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined && sessionId !== teamRoot) {
  const a5sfRealm = await mountMemberA5sfRealm({ ... })
  await installMemberExecution({ ..., compiledAnswer: compiledAnswerOfRealm(a5sfRealm), realm: a5sfRealm, ... })
}
```

`installMemberExecution` uses `realm` for exactly ONE thing (the native-module mount); everything else —
binding, ledger, settlement, admission — works from the compiled answer. So a member without a realm runs
its native tools **with no admission decision, no ledger line and no settlement record**, under the host's
own mediation only.

That is not the A1 law ("an unwired controlled call is explicitly refused"). It is the call being
**outside the centre**, and nothing in the product reports that it happened.

## The design question the round was asked to answer

**Where does a realm-less member's ceiling come from?** Measured answer: the SAME compiler. The row
already has `createProductRealmProvider(plan).compiledFor(member) → { members, bindings? }` — the one
compiler the realm mount itself calls (`a5sf-realm-row.mjs:858-905`). Compiling without mounting is
therefore not a second policy; it is the same answer minus the provider substitution.

## Two ways forward, and what each costs

| Option | Behaviour for a realm-less member | Cost / risk |
| --- | --- | --- |
| **A (recommended)** Compile through `createProductRealmProvider(...).compiledFor(member)` and install an **admission-only** centre when no realm is present. The native mount stays optional. | Each call is decided against the compiled ceiling and recorded; the provider is UNCONFINED and the fact says so (`provider: 'unconfined'`). | Honest and minimal, but it ADMITS calls whose effect is not confined — must be stated as a limit, never as enforcement. It also re-introduces plane-level allow semantics for those members, which is the E3 capability. |
| **B** Install a **refusing** admission point when no realm is present (`ADMISSION_PROVIDER_UNCONFINED`). | Nothing runs without a confined provider. Fail-closed in the strongest sense. | Every realm-less member stops working entirely — a product behaviour change that hits any deployment not configuring `a5sf` realms, including parts of the test suite that use realm-less worlds (E3's world among them). |

Both options keep ONE decision authority. Neither invents a second compiler.

## Why this needs the owner and not my preference

Option A admits calls that run unconfined; option B removes a behaviour deployments may rely on. The
project's own rule is that an enforcement claim must be earned and a capability loss must be stated — and
which of these two is "the product" is an owner decision, not an implementation detail. My recommendation
is **A with the limit stated on every such fact**, because it keeps the centre's authority universal (the
A1 law's intent: every controlled call is decided) and because option B silently converts a wiring gap
into an outage.

## What is NOT in doubt

- The current state (no centre) is wrong under either option and must not be described as "unwired calls
  are refused": today they are **unmediated**.
- E3 is the witness, and it stays red until this is ruled and implemented.
- Nothing here requires a DSH patch; it is all Team-side assembly.
