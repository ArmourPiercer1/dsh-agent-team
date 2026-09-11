# H2 — P1 vertical: bash contract + bash fingerprint + deny-rule fail-closed (alpha.2 hardening)

> Task: `task/alpha2-h2-p1-contracts` · worktree: `.worktrees/alpha2-h2` (create from the int tip AFTER H1 is integrated into `int/alpha2-hardening`; run `pnpm install` first) · 1 writer = you.
> Authority: `docs/plans/active/dsh-agent-team-alpha2-permission-boundary-hardening.md` (§6, §7, §8, §17, §19) — the main agent has VERIFIED every claim below; citations are to the pre-H2 tree (H1 changes pre-execute-adapter.ts install/enforce — the file you also touch; read the H1-integrated version when you start).

## 1. The three verified P1 findings

**P1-1 — bash contract three-way contradiction (real):**
- `packages/domain/blueprint/src/types.ts` L30-32: "bash only supports tool-level ask/deny via the any resource (no parameter-level allow for shell commands in alpha.2)".
- `packages/runtime/operation-permission/permission-resolver.ts` L89-93 (recorded ruling): "a bash rule matches in ANY lane ... An allow-lane `any` bash rule therefore yields a whole-tool ALLOW for bash (A1's schema accepts `bash` in the allow lane; this is the documented consequence...)".
- `packages/runtime/test/a3-permission-resolver.test.ts` L383-384 pins: "bash op + bash any rule (allow lane) → allow (documented consequence: whole-tool allow for bash)".
- `packages/domain/blueprint/src/validate.ts` accepts `bash` in ANY lane (L589: tool ∈ six names, no lane check) and `bash` + `exact` (L600-655: path-shape checks only).
⇒ The doc says no positive bash grant; the matcher + schema deliver one.

**P1-2 — constant bash fingerprint (real):**
- `packages/runtime/operation-permission/canonical-operation.ts` L378-384: the tool-level branch returns `fingerprint: buildFingerprint({ tool: 'bash' })` — the command is deliberately excluded, so EVERY bash command (any payload) shares one fingerprint. The module contract (types.ts L102-105) says the fingerprint covers "every security-relevant field" — for bash the command IS the security-relevant field. A durable approval is therefore not verifiable as "which shell payload was approved" (the summary at pre-execute-adapter.ts L542-545 is just `bash (tool-level)`).

**P1-3 — exact DENY rule canonicalization failure downgrades to ask/default (real):**
- `packages/runtime/operation-permission/pre-execute-adapter.ts` L367-377 `canonicalRuleKey`: `catch { return undefined }` (success-only cache, retry on next decision).
- L400-401 `canonicalLane`: `const key = await canonicalRuleKey(rule.resource.path); if (key === undefined) continue // unresolvable rule path: no match (R2)`.
- All three lanes are mapped through the SAME function (L412-418) — a same-tool exact DENY rule whose resolution fails (transient IO, mount/symlink change, cwd drift after the lazy install binding) silently drops, and the operation can fall to `default` (ask) → approval may then authorize what the policy intended as a static deny. The module doc's "both resolve or both fail" argument does not hold: the operation and the rule are SEPARATE resolver calls at different times over a mutable filesystem (review §8.2).
- Asymmetry ruling (main agent, matches review §8.2): a failed ALLOW rule = no positive grant (not an escalation); a failed ASK rule = falls to default, which is ask (same) or deny (more restrictive) — not an escalation; ONLY a failed DENY rule can downgrade a static deny into an approvable ask ⇒ only the deny lane needs the fail-closed flip.

## 2. Rulings (implement exactly)

### 2.1 Bash contract (domain schema is the enforcement point)
- `validate.ts` (or the helper it calls for rules): reject, with a STABLE diagnostic message (deterministic text, no randoms):
  - `{ tool: 'bash', resource: { kind: 'any' } }` in the **allow** lane → error naming the lane and the ruling (no positive whole-tool grant for bash in alpha.2; use ask or deny).
  - `{ tool: 'bash', resource: { kind: 'exact', path } }` in **any** lane → error (an exact key is a file key and can never match the bash tool-level resource — inert by construction; the vocabulary has no parameter-level shell matcher in alpha.2).
  - `{ tool: 'bash', resource: { kind: 'any' } }` in the **ask** and **deny** lanes → remain LEGAL (the whole-tool ask/deny is the documented shell permission).
- The schema is the ONLY enforcement point (review §7.2): the resolver MATCHER is structurally correct as-is (exact can never equal the tool key; any matches tool-level — permission-resolver.ts L244-254) and stays UNCHANGED in behavior. Update its recorded-ruling comment (L76-94) to state: the allow-lane consequence is unreachable via parse since the H2 ruling; the matcher remains total over well-typed `CanonicalRules` (defensive).
- `types.ts` L27-33 doc: sync the wording (bash = ask-any / deny-any only; allow-any and exact are REJECTED at blueprint parse with stable diagnostics).
- **Pre-release tightening ruling (record)**: blueprints containing a bash allow-any or bash exact rule now FAIL parse. Shipped/legacy blueprints (my-team-bp-1 etc.) carry NO permissions block ⇒ zero regression; alpha.2 is pre-release (no compatibility promise per the pre-release stance). Grep the whole repo (fixtures, test blueprints, kit blueprints under dev/agent-workflow/evidence, docs examples) for `permissions` blocks containing `bash` and fix every occurrence; report the list in the summary.
- a3 tests: L383-384 (allow-lane any bash → allow) — reframe: the pure-resolver totalness test may REMAIN (the resolver is a pure function over its input contract; pin that deny>ask>allow>default holds even for such input), but the "documented consequence" framing is REMOVED and replaced with "unreachable via parse (H2 schema ruling); matcher totalness pinned defensively". ADD domain-level parse tests: the four cases above (allow-any rejected, exact-in-any-lane rejected ×3 lanes, ask-any accepted, deny-any accepted) with the stable error texts pinned.

### 2.2 Bash fingerprint binds the command (no shell parsing)
- `canonical-operation.ts` tool-level branch (L378-384): before building the projection, validate `arguments.command` is a string (the bash tool's required parameter — verify the exact argument name against the upstream bash tool schema in test-use `packages/shell/` when you start; if it is not `command`, use the real name and record it). Missing / non-string command → NEW closed `OperationPermissionError` reason (extend the closed set in `errors.ts` — follow the existing 21-reason pattern, e.g. `bash-command-missing`) ⇒ canonicalization failure ⇒ the adapter's existing fail-closed deny (a5a S13 pins that path for file tools).
- Projection for bash becomes `{ tool: 'bash', commandHash: hashString(command) }` (reuse the SAME `hashString` helper write uses for contentHash — L411) — deterministic, no raw command in the fingerprint payload, NO shell parsing / no AST (review §7.2). Resource stays `{ kind: 'tool', key: BASH_TOOL_RESOURCE_KEY }`.
- `pre-execute-adapter.ts` summary (L542-545): for the tool-level resource, append a BOUNDED, NON-AUTHORITY preview of the command: first 120 chars, newlines/tabs → single spaces, trailing ellipsis when truncated (e.g. `bash (tool-level): "rm -rf /tmp/..."`). The preview is UI/diagnostics text ONLY — never part of the fingerprint, scope, or hash (pin in a test: preview truncation does not change the fingerprint; two commands sharing the first 120 chars still get distinct fingerprints).
- a5a S12 update: same command → same fingerprint; different command → different fingerprint; an allow for command-A does NOT authorize command-B (new correlation → new request carrying command-B's fingerprint — the a5a S5/S6 allow-once machinery unchanged). a2 suite: the bash canonicalization legs update (projection + failure reason + READ/preview-free fingerprint determinism).

### 2.3 Exact DENY rule canonicalization failure ⇒ operation DENY (option A)
- `pre-execute-adapter.ts`: `canonicalLane` gains a per-lane failure report — shape: `{ rules: CanonicalRule[]; failedExact: readonly string[] }` (failedExact = the RAW trimmed paths of SAME-TOOL exact rules that failed to canonicalize; other-tool rules are skipped before canonicalization and never report). `canonicalRulesFor` returns `{ allow, ask, deny, denyCanonicalizationFailure?: string }` (the first failed deny path, diagnostics only).
- `enforce` step (3), BEFORE `resolveOperationPermission`: if `denyCanonicalizationFailure !== undefined` → return a stable deny reason: `permission denied: the template's deny rule "<path>" could not be canonicalized (fail-closed: a static deny cannot be downgraded to ask/default)` + an onObserve row `{ stage: 'deny-rule-canonicalization-failed', callId, rulePath }`. A3 is NEVER called for that decision (pin with the fake/real A3 spy per a5a conventions).
- allow/ask lanes KEEP the non-match-on-failure semantics — update the R2 module doc (the fail-closed argument at L361-366 + L380-387) to state the lane asymmetry explicitly (the failed-ask/failed-allow outcomes are never privilege expansions; only the deny lane is flipped).
- a5a new legs (S16 family): (DR-A) deny lane exact rule on a path the resolver THROWS for → operation DENIED with the fail-closed reason, ZERO control rows, resolver (A3) not called, observe row emitted; (DR-B) the SAME failing path in the ASK lane + default deny → plain static deny via default (NOT the fail-closed reason — pin the asymmetry); (DR-C) failing path in the ALLOW lane → no grant (falls to default — pin existing semantics); (DR-D) failing path on a DIFFERENT tool's rule → skipped before canonicalization, no failure report, decision proceeds normally.

## 3. Gates (task tree, then parent re-gates int)

- domain: a1 suite green (updated parse tests) + domain 372/11 baseline shape (11 pre-existing failures unchanged in identity).
- runtime: a2 (30→ updated), a3 (28→ updated framing), a5a (39→ + new legs incl. the DR family + S12 rework), a4a/a6a/t12a unaffected-but-green (H1's changes are in this base — do not regress them).
- runtime parity: the known 6 pre-existing failing files unchanged, no NEW failures.
- testkit 124/0 at the NEW pin (DEC-1 chain: append an `(h2)` entry; scanner-verify after — the pin continues from H1's value).
- typecheck 0, build 0, `build:composition` 0 + artifacts check, dist EOL pure-LF check (restore if the build churns).
- red lines: references/ untouched (test-use @ a66e470204 porcelain 0), :3080/:3180 zero-touch, 3181/3493 not needed (unit task), worktree porcelain clean at end, delete dispatch inputs (.tmp-*, this brief) before the final commit.

## 4. Deliverables
- Task branch commits (final tree green), commit order: (a) schema ruling + domain tests; (b) fingerprint + summary preview; (c) deny-rule fail-closed; (d) evidence/summary. (Any split you can defend in the summary.)
- `dev/agent-workflow/evidence/alpha2-hardening/h2/`: suite consoles, the bash-occurrence grep list, summary.md (rulings, gate table w/ actual numbers, pin delta, deviations w/ evidence, commit list).
- Report to parent: GO/NO-GO for H3, SHAs, gate table, pin (H1's value → yours), deviations, the fixture-fix list.
- Fixed router blocker format if blocked after 3 attempts on a step.
