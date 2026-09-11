# H4 — stale exact-rule canonical identity (P1-A) — root cause

Task: alpha.2 hardening follow-up, **H4 / P1-A**.
Repo: `dsh-agent-team`, worktree `.worktrees/alpha2hf-h4`, branch
`task/alpha2hf-h4-rule-identity` (base master `6a2f3e1`, alpha.2 H1–H3
integrated). Upstream basis: 0.1.2-rc.1 @ `a66e470204` (untouched).

## The bug

`packages/runtime/operation-permission/pre-execute-adapter.ts` held an
**install-lifetime** `ruleKeyCache: Map<string, string>`: once a policy's
`exact` rule path was successfully canonicalized on some decision, its key
was cached forever in the install closure. Operations, however, are
canonicalized **fresh on every decision** (A2 — plan §10.2, no cache).
After a symlink/junction retarget of the rule path, rule and operation of
one decision therefore carry identities from **different points in time**:

- a **stale DENY** key stops matching the fresh operation key → the
  decision downgrades to the default lane (escalation: where the policy
  statically forbade, an approval request is raised and can then
  authorize);
- a **stale ALLOW** key keeps matching a fresh operation key that denotes a
  resource the rule path no longer denotes (stale authority executes).

The glue seam confirms the identity basis: the upstream
`fs.resolveLocalTarget` returns `targetKey = realpath(displayPath)`, so a
retarget moves the key; the A6 glue closure
(`agent-bindings.mjs`) reads the session cwd lazily at resolve time and
unbrands the targetKey with `String(target.targetKey)`.

### T0 / T1 diagram (H4-A1 shape — default ask + deny exact `alias.txt`)

```
T0 (decision 1 — phase 1):   alias.txt  --symlink-->  target A (realpath KEY_A)

  A2 (operation, fresh):     op.key  = resolveTarget('alias.txt') = KEY_A
  R2 (rule, fresh + cached): ruleKeyCache['alias.txt'] = KEY_A   ← cached
  match:  rule KEY_A == op KEY_A  →  static DENY ✓  (zero requests)

T1 (after retarget, decision 2):   alias.txt  --symlink-->  target B (realpath KEY_B)

  A2 (operation, fresh):     op.key  = resolveTarget('alias.txt') = KEY_B
  R2 (rule, pre-fix):        rule key = ruleKeyCache['alias.txt'] = KEY_A  ← STALE
  match:  rule KEY_A != op KEY_B  →  the DENY rule no longer matches
  →  decision downgrades to the default (ask) → an approval request is
     raised and an approval could authorize what the policy forbade
     (RED: H4-A1 phase 2 — the pinned key misses the retargeted identity)
```

H4-A2 is the mirror (default deny + allow exact `alias.txt`; `alias` and
`orig` shared target KEY_A at T0; retarget `alias`→KEY_B): reading
`orig.txt` at T1 yields op.key = KEY_A, which the **cached** allow key
KEY_A still matches → the stale ALLOW executes a resource the rule path
(`alias.txt`) no longer denotes (RED: `expected 'deny' to be 'allow'`).

## The fix (parent ruling — implemented exactly)

**Delete the cache entirely.** Every permission decision fresh-resolves all
same-tool exact rules through the **same resolver seam and the same
session-cwd basis** as the operation. No invalidation, no TTL, no watcher:
nothing is stored, so nothing can be stale. Cold resume is trivially
consistent for the same reason.

### Pre / post code

Pre (removed):

```ts
/**
 * R2 — the install-owned rule-canonicalization cache (lazy; successful
 * resolutions only — a failed rule resolution is retried on the next
 * decision, never cached). Keyed by the raw (A1-trimmed) rule path.
 */
const ruleKeyCache = new Map<string, string>()
// ...
const canonicalRuleKey = async (path: string): Promise<string | undefined> => {
  const cached = ruleKeyCache.get(path)
  if (cached !== undefined) return cached
  try {
    const { key } = await resolveTarget(path)
    ruleKeyCache.set(path, key)
    return key
  } catch {
    return undefined
  }
}
```

Post:

```ts
const canonicalRuleKey = async (path: string): Promise<string | undefined> => {
  let result: unknown
  try {
    result = await resolveTarget(path)
  } catch {
    return undefined
  }
  // Result-shape validation BEFORE use (the same fail-closed checks the
  // operation path applies, plan §7.5): a non-plain result, a non-string
  // key, or an empty key is a malformed seam result — never a key. The
  // glue wraps the upstream targetKey with String(...), so a missing
  // targetKey surfaces as the string 'undefined' — pinned as a failure
  // here too (a silent 'undefined' key could match a rule whose targetKey
  // was literally that string: authority minted from a seam violation).
  if (typeof result !== 'object' || result === null || Array.isArray(result)) {
    return undefined
  }
  const { key } = result as { key?: unknown }
  if (typeof key !== 'string' || key === '' || key === 'undefined') {
    return undefined
  }
  return key
}
```

Notes:

- Fresh resolution = one resolver call per same-tool exact rule per
  decision — the same lazy fs seam the operation already uses (the cost
  the ruling accepts; per-tool exact rule counts are small).
- **Result-shape validation is new, mandated behavior** ("malformed key =
  failure, never silent"): the pre-fix code blindly destructured
  `{ key }`. The `'undefined'` sentinel check pins the glue's
  `String(target.targetKey)` behavior: a missing upstream targetKey is a
  failure, never a key. A `display` check is deliberately NOT added for
  rules — display is never consumed on the rule path, and the ruling's
  spec enumerates the key checks.
- The module doc (R2), the R1 signal-threading doc (the cwd is read
  lazily at resolve time — FACT 3b, not captured at install), the
  `PreExecuteExec`/`resolveTarget` docs, `permission-resolver.ts`
  input-contract docs ("ONCE per agent scope" → fresh per decision), and
  the a5a suite comments all synced to the no-cache semantics.

## Preserved failure semantics (H2 ruling — exact)

- **DENY lane:** a canonicalization failure ⇒ deny **before** the A3
  resolver (P1-3 fail-closed flip), stable reason + `onObserve` stage
  `deny-canonicalization-failure`, zero durable request, failure never
  remembered. With the cache gone, "never remembered" is structural —
  nothing is remembered at all.
- **ALLOW / ASK lanes:** failure = non-match for this decision (rule
  skipped; retried on the next decision — identical semantics, only the
  "not cached" wording became "never remembered").
- H4-A3 (transient rule failure → P1-3 DENY → recovery → fresh retry
  matches) is GREEN on **both** trees, proving the semantics are preserved.
- Untouched, as mandated: the A3 matcher, the H1 monotonic end-cap guard
  (`authorizedExecutions` WeakSet), bash exact-rule inertness, A4 durable
  control, the A6 glue.

## Verification

| gate | actual |
| --- | --- |
| RED (commit (a) `309d998`, pre-fix) | 2 failed \| 8 passed (10) — exactly the mandated RED set (H4-A1 p2 + H4-A2 p2) — `red-console.log` |
| h4 suite (post-fix) | 10/10 green |
| focused runtime suites (a2, a3, a4a, a5a, a6a, h1a, h4) | 239/239 green |
| a1 (domain package) | 43/43 green |
| p4t6 DEC-1 pin | 668 → 669 (642 + 10 + 1 + 7 + 1 + 2 + 2 + 1 + 1 + 1 + 1; twenty-seven files, +one H4); (h4) comment-chain entry names `packages/runtime/test/h4-rule-identity.test.ts`; suite 10/10 green at 669 |
| `pnpm --filter @dsh-agent-team/runtime run typecheck` | exit 0 |
| `pnpm --filter @dsh-agent-team/runtime run build` (and full workspace build) | exit 0, 9/9 packages Done |
| `pnpm run build:composition` (root) | place-dist-glue byte-identical; client composition built; check-artifacts-committed lists exactly the 8 rebuilt dist files for this commit (committed together with the source — same commit) |
| dist EOLs | 8 rebuilt tsc files pure LF (CR=0); `agent-bindings.mjs` glue re-polluted to CRLF by the fresh build (autocrlf platform note) and restored to the committed LF form (byte-identical to HEAD, 130418 bytes) |
| references (`deepseek-harness-test-use`) | porcelain-clean, HEAD `a66e470204` (CORE PATCH BUDGET = 0) |

Full GREEN console: `green-console.log` (same directory).
