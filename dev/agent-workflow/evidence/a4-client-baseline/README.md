# Client test lane: baseline and scope disclosure

**Measured at `11e1609c`** (and re-measured at base `d21effba` for attribution) · command:

```bash
pnpm --filter @dsh-agent-team/client run test      # = vitest run with packages/client/vitest.config.ts
```

## Why this file exists

Every Alpha.4 gate has been run with the **root** command `pnpm test` (`vitest run`, root `vitest.config.ts`), whose include is:

```
include: ['packages/*/test/**/*.test.ts']
```

That pattern matches **zero** of the client package's spec files. Proof, not inference:

```bash
pnpm vitest list --filesOnly | grep -c 'spec.tsx'   # → 0
```

while `packages/client/vitest.config.ts` includes `test/**/*.test.ts`, `test/**/*.client.spec.ts` and `test/**/*.client.spec.tsx` — **27 tracked `*.client.spec.ts(x)` files** that no Alpha.4 gate has ever executed. The 22-identity citable baseline (`failing-identities-pr0-run2.txt`, sha256 `ed20c777…91e3`) is therefore **root-suite-scoped**. Any statement that "the full suite" was run must say so; that is what X12 in the ADR records, and this file supplies the numbers.

## Measured state of the client lane

| tree | files | tests | failing |
| --- | --- | --- | --- |
| `11e1609c` (master, post-PR1) | 3 failed / 50 passed (53) | 3 failed / 850 passed (853) | 3 tests + 1 collection error |
| `d21effba` (pre-PR1 base) | 2 failed / 51 passed (53) | 3 failed / 851 passed (854) | 3 tests |

The three **failing tests are identical at both commits**, so they are pre-existing and not caused by Alpha.4:

- `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > selecting a blueprint loads the defaults`
- `test/team-creation-panel.client.spec.tsx > TeamCreationPanel > switching the runtime preset re-runs …`
- `test/team-governance.client.spec.tsx > TeamGovernance > an override reset targets the member instance`

**Task 6 edits `team-governance.client.spec.tsx`**, so PR6 will find a red lane it did not cause and, without this file, no way to prove it. Until the client lane has the same identity-diff discipline as the root suite, PR6 records its own before/after on this lane.

The fourth difference (`11e1609c` only) is a **collection error, not a regression**:

- `test/s3-client-generation-spike.test.ts` fails to collect in the main checkout with `Cannot find module '../../../../../tests/deepseek-harness-test-use/…'`.

## The s3 spike is location-dependent — do not "fix" it

Its relative import climbs **five** directories. From `packages/client/test/` that lands on `/home/user/dsh-plugins/tests/…` (missing) in the main checkout, and on `/home/user/dsh-plugins/dsh-agent-team/tests/…` (present) inside a worktree, because a worktree adds one path level.

Measured both ways: **passes in a worktree, fails collection in the main checkout.** The file is untouched since `833c6999`. Consequences worth stating plainly:

- nobody should chase this as breakage, and it must not be "fixed" by rewriting the import to suit one location (that would move the failure into the other);
- any client-lane result captured in the **main** checkout is missing a file that worktree runs include, so root-suite and client-lane comparisons must state which tree they came from — this is the same class of environment-migration gap as the absent `references/deepseek-harness` noted in `AGENTS.md`.

## What is still not true of this lane

- No identity baseline: unlike the root suite, there is no `failing-identities` capture for the client lane, so closure here is by the three names above, not by an identity diff.
- `scripts/fail-set.mjs` drives the root suite; it has neither a client-lane mode nor a lint mode.
- Chrome lanes: only two exist and both exit at an environment guard, so they are not coverage.

Recorded as PR7 inventory in X12 rather than papered over.
