# H4 BRIEF — alpha.2 hardening follow-up, P1-A: stale exact-rule canonical identity

You are the sole writer for task `task/alpha2hf-h4-rule-identity` in worktree
`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\alpha2hf-h4` (base = master `6a2f3e1`,
which already contains the full alpha.2 hardening H1–H3). Read
`docs/ROUTER_RULES.md` and `docs/TEST_METHODS.md` in this worktree first.

## Mission

Close P1-A of `docs/plans/active/dsh-agent-team-alpha2-hardening-followup-repair-plan.md`
(the plan is in the MAIN worktree `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\`
— read-only for you; it is gitignored and not present in this worktree):
the install-lifetime `ruleKeyCache` in the pre-execute adapter caches SUCCESSFUL exact-rule
canonical keys forever, while operations are canonicalized FRESH on every decision. When the
filesystem identity of a rule path changes (symlink/junction retarget), the rule and the
operation use identities from different points in time — a static DENY can silently stop
matching (escalation to ask→execute), and a stale ALLOW can keep authorizing a resource the
rule path no longer denotes. Fix: **delete the cache entirely; every permission decision
fresh-resolves all same-tool exact rules through the same resolver seam and same session-cwd
basis as the operation.** No invalidation, no TTL, no watcher (plan §2.2/§2.3-H4-b).

## Parent-verified facts (do not re-litigate; re-verify only if a test contradicts them)

1. **Current code** (`packages/runtime/operation-permission/pre-execute-adapter.ts`, this
   worktree): L547–552 the R2 doc + `const ruleKeyCache = new Map<string, string>()`;
   L582–599 `canonicalRuleKey` (cache-first, caches successes only, failures never cached);
   L614–648 `canonicalLane` (per-lane mapping; `any` rules never hit the resolver; `bash`
   exact rules inert — `if (tool === 'bash') continue`); L650ff `canonicalRulesFor` (denies
   via `denyCanonicalizationFailure` when set).
2. **Operations are fresh every decision**: `canonical-operation.ts`
   `canonicalizeOperation` has no cache; the adapter calls it per exec.
3. **Upstream identity basis** (pinned 0.1.2-rc.1 @ `a66e470204`,
   `references/deepseek-harness-test-use/packages/fs/fs-local/src/fsio.ts` L146–194, in the
   MAIN worktree — read-only): `resolveLocalTarget` returns
   `targetKey = realpath(displayPath)` for existing paths (a symlink/junction retarget
   changes the identity) and is existence-tolerant for missing paths (nearest-existing-
   ancestor realpath + missing suffix). The glue seam
   (`packages/runtime/src/plugin/live/agent-bindings.mjs` L1233–1248) reads
   `agentCtx.agent?.session?.header?.cwd` LAZILY at resolve time and wraps
   `fsBackend(agentCtx).resolve(path, { cwd })` → `{ key: targetKey, display: displayPath }`.
4. **Failure semantics to PRESERVE EXACTLY (H2 ruling, do not change)**:
   - DENY lane: any same-tool exact rule that fails to canonicalize ⇒ the operation is
     DENIED BEFORE the A3 resolver, with the stable reason + `onObserve` stage
     `deny-canonicalization-failure`; zero durable request; failure never cached.
   - ALLOW/ASK lanes: failure ⇒ that rule is a non-match for THIS decision (no positive
     authority is minted). Lane asymmetry is documented in the module header — keep the doc
     accurate.
   - The A3 matcher (`permission-resolver.ts`) is UNTOUCHED. The P0 end-cap (H1:
     `authorizedExecutions` WeakSet + `tools.guard` + fail-closed install + composite
     disposer) is UNTOUCHED.
5. **Known shim constraints** (plain-node vitest): follow the EXISTING working test style —
   `packages/runtime/test/a5a-pre-execute.test.ts` (fake-resolver + `createEnv` harness,
   `makeFakeResolver` L240–253, `makeExec` L260–272, `makeNext` L275–284, env L291–337) and
   `h1a-pre-execute-endcap.test.ts` (real-composition style). Never leave a never-resolving
   await in module scope or a test body (known runner hang: 0 CPU forever). No new
   assertion libs: `toBe`/`toEqual` (and the patterns the existing files already use).

## Fix design (parent ruling — implement exactly this)

1. **Delete `ruleKeyCache`** (L552) and all references to it.
2. **`canonicalRuleKey(path)`** becomes: fresh `await resolveTarget(path)` every call,
   with result-shape validation BEFORE use (plan §2.3 H4-b: "a malformed `{key}` must not be
   silently accepted"): the result must be a non-null non-array object whose `key` is a
   non-empty string — note the glue does `String(target.targetKey)`, so a missing
   targetKey surfaces as the string `"undefined"`, which is NOT a valid key: treat
   `key === 'undefined' || key === ''` (and any non-string) as a FAILURE (return
   `undefined`), mirroring the checks `canonical-operation.ts` `resolveResource` (L492–522)
   already applies on the operation path. Keep the function's `string | undefined`
   contract (undefined = failure) so `canonicalLane`'s lane handling is unchanged.
3. **Docs sync** (plan §2.3 H4-c): every statement that exact rules are "cached for the
   scope's lifetime" / "canonicalized once per agent scope" / "successful resolutions only —
   cached" becomes: "same-tool exact rules are canonicalized FRESH for each permission
   decision, against the same live resolver / session-cwd basis as the operation; a failed
   resolution is retried on the next decision (there is no cache — success or failure)".
   Check at minimum: the adapter module header (R2 section), `canonicalRuleKey` doc,
   `canonicalLane` doc, `canonicalRulesFor` doc, `permission-resolver.ts` input-contract
   docs, `types.ts`/`index.ts` if they mention caching, and `packages/runtime/test/`
   comments that assert caching behavior (fix those assertions, not the behavior).
4. **Nothing else changes**: no new state, no new seams, no glue changes, no A3 changes,
   no end-cap changes, no bash changes (H5's job), no performance machinery.

## RED probes (commit 1 — NO product changes)

New file `packages/runtime/test/h4-rule-identity.test.ts`. Use a **mutable fake resolver**
(a `Map<string,string>` the test mutates between phases — `keyOf(path) = 'file:///' +
normalized(path)` as in a5a) plus the a5a-style env (real ControlService over a P6-T4
world, fake ctx, one adapter install). Probe legs (name them so the console is greppable,
e.g. `H4-A1`, `H4-A2`, `H4-A3`, `H4-DB`):

- **H4-A1 — DENY retarget (MUST be RED pre-fix)**: policy `default: ask`,
  `deny: [read exact alias.txt]`. Phase 1: map `alias.txt → key-A`; decide a `read` of
  `alias.txt` ⇒ expect static DENY (deny reason, ZERO control requests, zero body).
  Retarget: `alias.txt → key-B` (the fake's map only — this is the topology mutation).
  Phase 2: decide the same `read` of `alias.txt` again (fresh callId) ⇒ expect static
  DENY again, zero requests, zero body. Pre-fix the rule key is cached at `key-A` while the
  operation canonicalizes to `key-B` ⇒ the deny rule no longer matches ⇒ the decision
  downgrades to ASK and a control request is raised ⇒ RED. Post-fix: rule fresh-resolves to
  `key-B` ⇒ matches ⇒ DENY.
- **H4-A2 — ALLOW retarget stale authority (MUST be RED pre-fix)**: policy
  `default: deny`, `allow: [read exact alias.txt]`. Phase 1: `alias.txt → key-A`; decide a
  `read` of `alias.txt` ⇒ ALLOW (executes via `next()`, zero requests). Retarget
  `alias.txt → key-B`. Phase 2: the fake also maps a DIFFERENT path `orig.txt → key-A`
  (constant — the resource the alias pointed to before the retarget); decide a `read` of
  `orig.txt` ⇒ expect DENY (default; the allow rule now canonicalizes to `key-B` and does
  not match `key-A`). Pre-fix the allow rule is cached at `key-A` ⇒ matches ⇒ ALLOW ⇒ RED.
- **H4-A3 — transient failure retry (GREEN pre-fix; regression guard)**: policy
  `default: deny`, `deny: [read exact alias.txt]`; the fake FAILS (throws) for
  `alias.txt` in phase 1 ⇒ expect the P1-3 fail-closed DENY (stable
  `deny-canonicalization-failure` reason, `onObserve` row stage
  `deny-canonicalization-failure`, zero requests). Phase 2: the fake SUCCEEDS
  (`alias.txt → key-A`) and the operation reads `alias.txt` ⇒ expect static DENY by the
  now-resolving rule (fresh re-resolution; proof nothing about the failure — or, post-fix,
  anything at all — is cached).
- **H4-DB — operation/rule same-basis agreement**: stable mapping; decide the same
  resource twice; assert the rule and operation keys agree on EVERY decision (the fake
  records the call sequence; assert the rule-path resolutions interleave with the
  operation resolution using the same closure and return identical keys) — guards against
  any reintroduced drift between the two resolution paths.

After commit 1 you MUST have a console run showing A1 and A2 FAILING (RED) and A3/H4-DB
passing, saved as evidence (below). If A1/A2 do NOT go red: STOP, do not force it, write a
deviation record with the exact console + reasoning, and pick the more conservative
behavior (plan §16).

## Fix (commit 2 — GREEN)

Implement the fix design. Then the full h4 suite is GREEN. Also re-run the focused suites
and record results (they must stay green — especially `a5a`'s DR-A..DR-D
deny-canonicalization legs and all 40 `h1a` end-cap tests):

```
pnpm --filter @dsh-agent-team/runtime exec vitest run test/h4-rule-identity.test.ts test/a1-permission-policy.test.ts test/a2-canonical-operation.test.ts test/a3-permission-resolver.test.ts test/a4-exact-control-scope.test.ts test/a5a-pre-execute.test.ts test/a6a-production-wiring.test.ts test/h1a-pre-execute-endcap.test.ts
```

(If a filename differs slightly in this tree, use the real one — `pnpm --filter
@dsh-agent-team/runtime exec vitest list` or dir listing. Do not run the FULL parity suite
— that is the closure task's job.)

## Gates before you finish (record actuals in the report)

1. Focused suites above: all green, actual counts.
2. **p4t6 pin**: your new scannable test file moves the testkit pin 668 → 669. Find the pin
   mechanism (search `668` in `packages/runtime/testkit/` — the DEC-1 comment-chain entry
   pattern used by the h1a/h3 entries) and add the `(h4)` entry naming
   `h4-rule-identity.test.ts`; verify with the same scanner command the previous tasks used
   (evidence dir `dev/agent-workflow/evidence/alpha2-hardening/h1/` etc. show the command).
3. `pnpm --filter @dsh-agent-team/runtime run typecheck` → 0.
4. `pnpm --filter @dsh-agent-team/runtime run build` → 0; then `pnpm -r run build:composition`
   → OK. **This machine is autocrlf=true: a fresh build:composition re-pollutes the
   LF-pinned dist glue with CRLF (known platform behavior).** After the build, restore the
   committed LF form of any dist-glue file the build touched
   (`git -C <worktree> checkout -- <dist glue paths>` or diff against `git show HEAD:`) and
   re-verify the artifacts gate.
5. **CORE PATCH BUDGET 0**: `git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use status --porcelain`
   must be EMPTY and HEAD `a66e470204`. Never write into `references/`.
6. Worktree porcelain-clean (your own files committed), scratch deleted, **no push**.

## Evidence (commit with your code, in THIS worktree)

`dev/agent-workflow/evidence/alpha2-hardening-followup/h4-rule-identity/`:
- `red-console.log` (commit 1: A1/A2 RED, A3/H4-DB pass — full vitest console)
- `green-console.log` (commit 2: h4 + focused suites green — full console)
- `root-cause.md` (short: the stale-identity mechanism with the T0/T1 diagram from plan
  §2.1, the exact pre/post code, why fresh-per-decision is the right fix, the preserved
  failure semantics, the cost (one extra resolver call per same-tool exact rule per
  decision — the resolver is the same lazy fs seam the operation already uses))

## Deviation protocol

Any contradiction with the parent-verified facts above, any RED that doesn't reproduce, any
gate that fails: STOP, write `deviation.md` in the evidence dir with upstream/console
evidence and the conservative choice you made (or why you're blocked), and finish the
report around it. Never "make the test pass" by weakening the security contract.

## Commit structure (exactly 2 commits)

1. `H4 alpha.2 follow-up — commit (a): RED probes for stale exact-rule authority (h4-rule-identity.test.ts, mutable-retarget fake resolver; A1 DENY retarget + A2 ALLOW retarget RED on the current cache, A3 transient-failure retry + H4-DB same-basis GREEN; evidence red-console.log)`
2. `H4 alpha.2 follow-up — commit (b): remove the install-lifetime exact-rule authority cache — per-decision fresh canonicalization of all same-tool exact rules through the same resolver/cwd basis as the operation, resolver-result shape validation (malformed key = failure, never silent), R2 docs synced; h4 6/6 + focused suites green; pin 668->669 (DEC-1 (h4)); evidence green-console.log + root-cause.md`

Final message: the two commit SHAs, focused-suite actuals, pin verification line, the gate
actuals (typecheck/build/composition/EOL/references), any deviations, and confirm the
worktree is porcelain-clean with no push.
