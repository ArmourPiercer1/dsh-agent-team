# H5 — the bash execution-effect fingerprint: the projection ruling

Task `task/alpha2hf-h5-bash-effect` (alpha.2 hardening follow-up, P1-B).
Branch `task/alpha2hf-h5-bash-effect` in worktree `.worktrees/alpha2hf-h5`
(base = int tip `0d01ed3`, incl. the H4 fix). Commit (a) = RED probes
(`52c9709`); commit (b) = this fix. Upstream pin: 0.1.2-rc.1 @
`a66e470204` (`references/deepseek-harness-test-use`, pristine —
CORE PATCH BUDGET 0, verified empty at the end).

## 1. The final projection

The bash canonical projection (the `canonicalJsonStringify` input of the
fingerprint) is now, EXACTLY:

```
{
  tool: 'bash',
  commandHash: 'sha256:' + sha256Hex(command),      // H2 — unchanged: RAW command, no normalization, no shell parsing
  workdir: <resolver key of (args.workdir ?? '.')>, // H5 — the canonical authority key
  runInBackground: args.run_in_background ?? false, // H5 — explicit value, defaulted false
  timeoutMs: args.timeoutMs ?? null,                // H5 — explicit value only (NEVER a deployment default / executor cap)
  sandboxPermissions: args.sandbox_permissions ?? null // H5 — the requested mode string; legality stays upstream
}
```

A durable approval for `bash -c X in /A` no longer authorizes
`bash -c X in /B`, a background start, a different explicit timeout, or a
sandbox escalation. The A4 request scope key (correlation +
operationFingerprint) therefore distinguishes them: same correlation +
different fingerprint = a NEW request (H5-C2).

The RESOURCE stays tool-level — `{ kind: 'tool', key: 'bash', display:
'bash' }` (plan §3.2): the workdir key enters the FINGERPRINT, not the
resource. The resolver is consulted EXACTLY ONCE per bash operation (for
the workdir key) — the `CanonicalizeOperationInput.resolveTarget` JSDoc
and the module header were updated to say so.

## 2. The workdir seam ruling

Input normalization (mirrors the established module pattern for the
read/edit fields — the tool's own defaulting, applied BEFORE the
resolver call):

| input `args.workdir` | normalized input | rationale |
| --- | --- | --- |
| omitted (`undefined`) | `'.'` | upstream `resolveWorkdir` (tool-bash L143–155 @ a66e470204): omitted = session cwd — `'.'` resolves against the seam's cwd basis to the session cwd itself |
| string, non-blank | the string itself | the tool's relative/absolute semantics are the seam's |
| string, empty or whitespace-only | `'.'` | **the empty-string ruling**: upstream `resolvePath(cwd, '')` = cwd — an empty-string workdir is EFFECTIVELY the session cwd, so it must bind the SAME key as the omitted form |
| non-string | fail closed `bash-workdir-not-a-string` | see §3 |

The normalized input then goes through the EXISTING validated resolver
wrapper (`resolveResource` in `canonical-operation.ts`): a rejection /
malformed result / empty key fails closed with the EXISTING closed
reasons (`resolver-threw` / `resolver-result-malformed` /
`resolver-key-empty`) — no new reasons
were minted for resolution failures.

Why this shape gives the required semantics for free:

- **Omitted ≡ explicit session-cwd** (plan B2): the seam's cwd basis IS
  the session cwd (lazily read per call — the same basis the operation
  and the rules use, the H4 same-basis invariant). `'.'` and the
  explicit session-cwd path resolve through the SAME backend to the
  SAME key (verified in a2: `bashWorkdirDot` ≡ `bashWorkdirExplicitCwd`
  ≡ `bashWorkdirEmptyString` ≡ omitted — one key, one fingerprint; in
  the H5 adapter-level env, `KEY_A` for both `'.'` and `'/A'`).
- **Symlink/junction identity**: the backend's realpath-derived key
  (fsio `resolveLocalTarget`, L146–194 @ a66e470204) makes two paths
  that reach the SAME effective workdir bind the SAME key — and a
  retargeted identity binds a NEW key (the H4 property, now also
  covering the bash workdir).

**policyWorkspaceRoot (V2 note)**: upstream `resolveWorkdir` prefers
`policyWorkspaceRoot` over the session cwd when a sandbox executor is
configured. The CURRENT Team composition has NO sandbox executor, so
the basis is the session cwd (the H5 env models exactly this). If a
future composition sets `policyWorkspaceRoot`, the single point of
change is the A5 seam wrapper (its `cwd` argument), which the module
already treats as the authoritative basis: the `'.'` normalization stays
valid because `'.'` resolves against whatever cwd the seam carries. No
module change is required at V2; recorded here so the assumption is
visible.

## 3. The four new closed fail-closed reasons

All four fire BEFORE the resolver call (zero backend round-trips — the
established module pattern, `extractBashEffects` sits next to
`extractBashCommand`):

| reason | trigger | upstream basis |
| --- | --- | --- |
| `bash-workdir-not-a-string` | `workdir` present and not a string | the tool would reject it (`resolveWorkdir` expects string/omitted) |
| `bash-run-in-background-not-boolean` | `run_in_background` present and not a boolean | the tool's own background gate is `args.run_in_background === true`; a present non-boolean has no well-formed effective value |
| `bash-timeout-ms-invalid` | `timeoutMs` present and not a finite number > 0 | mirrors the upstream `validateBashArgs` check (tool-bash L61–63 @ a66e470204: `!Number.isFinite(v) \|\| v <= 0`); `Infinity` is rejected (the B8(e) leg) |
| `bash-sandbox-permissions-not-a-string` | `sandbox_permissions` present and not a string | the requested mode is a string by the upstream contract; any string (including `''`) is its own value |

**Why the validation is REQUIRED (not defense-in-depth)** — the B8
reachability proof (recorded in `upstream-contract.md` §6): the upstream
materialization of tool arguments is lossless-JSON-only
(core/tools `prepareExecution` L1402–1407), the `tools/pre-execute`
waterfall (where this module runs) fires at L1466–1469, and the
parameter-schema validation (`validateBashArgs`) runs INSIDE
`tool.execute` (tool-bash L330), reached only via dispatch at L1540.
Malformed effect-field types therefore DO reach the module unvalidated;
without these four checks a malformed shape would flow into the
projection (or a raw `typeof` assertion) instead of failing closed with
a typed, enumerable reason. The mode LEGALITY of a present string
(including `sandbox_permissions: ''` and the `justification` pairing)
stays the upstream authority at execution — the Team layer does not mint
authority for anything upstream would reject (such a call never
executes), and no sandbox/justification pairing validation was added.

## 4. Excluded fields

`description` and `justification` are NOT read by the canonicalizer:
display/explanation metadata (plan §4.2/§4.5), never part of the
projection (verified in the a2 legs: `bashDescA` ≡ `bashDescB` — one
fingerprint) and not part of the summary.

## 5. The summary format and its non-authority proof

The durable control-request `summary` for a bash operation is now
(bounded, non-authority):

```
bash [cwd=<workdirDisplay>] [background] [sandbox=<mode>] [timeout=<n>ms] <command preview>
```

- `[cwd=…]` is ALWAYS shown for bash (the workdir is always effective);
- `[background]` when `run_in_background === true`;
- `[sandbox=<mode>]` when the requested mode string is present;
- `[timeout=<n>ms]` when the explicit timeout is a finite number > 0;
- the command preview is unchanged (first 120 chars, whitespace
  flattened, `…` when truncated — the S1 cap leg proves two commands
  sharing the 120-char prefix + different tails get IDENTICAL previews
  and DIFFERENT fingerprints).

**Non-authority proof**: the `summary` is the control plane's free-text
display field — it never enters the fingerprint, the scope key, or any
hash. The effect values that DO bind are the canonical projection values
(the workdir KEY, the boolean, the explicit number, the requested mode
string — A2/H5); the summary's `cwd=` value is the RESOLVED DISPLAY
(representation of the opaque key), and the other three tokens are
re-read from the SAME deep-frozen argument record the canonicalizer
consumed — canonicalization has already failed closed on malformed
shapes, so the re-read can only mirror well-formed values (the token
builder stays total: any unexpected shape contributes no token). The
H2 comment at the `requestControl` call site was updated to the H5
ruling. The a5a S12 pins were updated to the new format
(`'bash [cwd=.] echo hello'` / `'bash [cwd=.] ls -la'` — in the a5a env
the seam's display for `'.'` is `'.'`).

## 6. The `workdirDisplay` presentation field

`CanonicalOperation` gains ONE optional presentation field:

```
readonly workdirDisplay?: string  // bash ONLY — the resolved workdir target's display
```

It is the approval summary's `cwd=` token. It is NEVER part of the
fingerprint/scope/authority (the fingerprint carries the opaque workdir
key — verified: the a2 fingerprint contains no `display:` text).
Undefined for the file tools. No new exports; the field rides the
existing `CanonicalOperation` type (dist `.d.ts` for
`types.d.ts`/`canonical-operation.d.ts` rebuilt and shipped in the same
commit per the PBA artifacts gate).

## 7. Files changed (commit (b))

- `packages/runtime/operation-permission/canonical-operation.ts` —
  `extractBashEffects` (new, next to `extractBashCommand`); the bash
  branch rewritten (effects fail closed before the resolver; one
  `resolveResource` call for the workdir key; the extended projection;
  `workdirDisplay` returned); module header + `resolveTarget` JSDoc
  updated.
- `packages/runtime/operation-permission/errors.ts` — the four new
  closed reasons in `CanonicalizationFailureReason` +
  `CANONICALIZATION_FAILURE_REASONS` + JSDoc.
- `packages/runtime/operation-permission/types.ts` —
  `CanonicalOperation.workdirDisplay?`.
- `packages/runtime/operation-permission/pre-execute-adapter.ts` —
  `bashEffectTokens` (new, total) + the summary builder + the H2→H5
  comment.
- `packages/runtime/test/a2-canonical-operation.test.ts` — the bash legs
  updated to the new projection (the resolver is now consulted exactly
  once over `'.'`; workdir-identity legs omitted ≡ `'.'` ≡ explicit
  session-cwd ≡ empty-string, a distinct `sub` workdir; each effect
  field changes the fingerprint; description/justification excluded;
  the six malformed-effect fail-closed legs with zero resolver
  round-trips).
- `packages/runtime/test/a5a-pre-execute.test.ts` — the S12 summary
  pins updated to the H5 format (two lines + comment).
- `packages/runtime/test/h5-bash-effects.test.ts` — two type-level fixes
  on the RED probes (explicit `operationFingerprint !== undefined`
  check; guard-verdict union narrowing) — assertion semantics unchanged.
- `packages/testkit/test/p4t6-session-event-scan.test.ts` — the DEC-1
  `(h5)` entry; pin 669 → 670 (642 + 10 + 1 + 7 + 1 + 2 + 2 + 1 + 1 + 1
  + 1 + 1); the twenty-eight-file list; the evidence line.
- `packages/runtime/dist/.../operation-permission/` — the 14 rebuilt
  install-surface artifacts (shipped in the same commit per the PBA
  artifacts gate — `[check-artifacts-committed] OK: 1080 files`).
- `dev/agent-workflow/evidence/alpha2-hardening-followup/h5-bash-effect/`
  — `green-console.log` + this ruling.

## 8. Deviations

None against the brief. One platform flake, recorded for completeness:
the first post-fix full run failed at the H5-S1 world teardown with
`ENOTEMPTY` (Windows handle race in the `.tmp-fault` scratch cleanup —
a partial teardown left residue); after removing the residue the run
went 25/25 green and every subsequent run (including the evidence
capture) was clean. No contract, test, or assertion was changed in
response.

## 9. Gate actuals

See `green-console.log` (full consoles): focused runtime 254/254
(h5 25 · a2 31 · a3 28 · a4a 28 · a5a 50 · a6a 52 · **h1a 40/40
untouched**); domain a1 43/43; tools h3 10/10; testkit p4t6 10/10 @
pin 670; runtime typecheck exit 0; runtime build exit 0;
`pnpm -r run build` exit 0 (the client dist — gitignored, absent in a
fresh worktree — materialized as a precondition of the composition
build, the documented `pnpm run setup` chain); `pnpm run
build:composition` → `[check-artifacts-committed] OK: 1080 files`
(after staging the 14 rebuilt dist artifacts — the same-commit rule of
the PBA gate; the LF-pinned dist glue re-polluted with CRLF by
`place-dist-glue` under `autocrlf=true` was restored to the committed
LF form and the 21 staged blobs verified pure LF, zero CR bytes);
upstream `references/deepseek-harness-test-use` porcelain EMPTY @
`a66e470204`; worktree porcelain clean after commit; no push.
