# H2 — alpha.2 hardening, P1 vertical (three P1 findings) — summary

Worktree `.worktrees/alpha2-h2`, branch `task/alpha2-h2-p1-contracts`, base `e352cae` (int tip
after H1's P0 end-cap integration). Writer: H2 (single writer; no other worktree touched).
CORE PATCH BUDGET = 0 honored: zero files under `references/` modified (both reference trees
verified porcelain-0 at `a66e470204` at the gate).

## Rulings implemented

### P1-1 — the bash contract: the A1 schema is the enforcement point (commit (a) `15172be`)

- `packages/domain/blueprint/src/validate.ts`: `validatePermissionRule(raw, path, lane)` now takes
  the lane name and rejects, AFTER tool+resource validation:
  - **`bash` + `exact` in ANY lane** — MALFORMED_DTO: an exact key is a file key and can never
    match the bash tool-level resource (inert by construction); alpha.2 has no parameter-level
    shell matcher (bash supports only `any`, in ask or deny). Details:
    `{ path: '<rule path>.resource.kind', lane }`.
  - **`bash` + `any` in the `allow` lane** — MALFORMED_DTO: alpha.2 grants no positive whole-tool
    permission for bash; the allow lane must not carry a bash rule (use ask or deny). Same
    details shape. Both diagnostics name the lane and the ruling (stable text, pinned verbatim).
- `bash` + `any` in **ask/deny stays LEGAL** (the documented shell permission) — pinned by a new
  ask-lane positive-parse test.
- **Resolver MATCHER behaviorally UNCHANGED** (a3): only its recorded-ruling module comment was
  updated to name the schema as the enforcement point; the a3 allow-lane bash test was reframed
  from "documented consequence" to a defensive **matcher-totalness pin** (the matcher remains
  total; the schema is what makes the case unreachable from a legal policy).
- `types.ts` (`PermissionTool` doc) + `schema.ts` (`PERMISSION_TOOL_NAMES` doc) synced to the
  schema-enforces framing.
- **New domain parse tests** (a1 suite +5 → 43/43): the four rejections pinned with exact message
  + details (`bashContractSource(lane, resource)` helper) + the ask-lane positive.
- **Fixture sweep** (7 sites fixed — full list in `h2-bash-occurrences.md`):
  PERMISSION_LINES_ASK, PERMISSION_SOURCE_ASK_KEY_SHUFFLED (fixtures.ts), the a1 `movedToDeny`
  inline source + `EXPECTED_ASK_POLICY`, and the a6a `PERMISSION_BLUEPRINT` leader allow lane —
  all had allow-lane `bash`+`any` (now schema-illegal); the two any-resource negative fixtures
  switched `bash` → `read` to preserve the single-violation property (deviation D2).
  KEPT (legal): `PERMISSION_SOURCE_BASH_ANY` (deny lane), a6a member-A deny-lane bash rule (M3),
  a5a S12 ask-lane bash rule.

### P1-2 — the bash fingerprint BINDS the command (no shell parsing) (commit (b) `3ca9615`)

- Argument name verified against the upstream `tool-bash` schema
  (`references/deepseek-harness-test-use/packages/shell/tool-bash/src/index.ts`): `command:
  string`, required; `validateBashArgs` rejects missing / non-string / whitespace-only
  (`'invalid command: expected a non-empty string'`).
- **New closed `OperationPermissionError` reasons** (21 → 24, `errors.ts`, following the closed
  enum pattern): `bash-command-missing`, `bash-command-not-a-string`
  (details `{ valueType }`), `bash-command-empty` (deviation D1 — mirrors `file-path-empty` and
  the upstream trim rejection).
- **A2 projection** (`canonical-operation.ts`): tool-level branch now
  `fingerprint: buildFingerprint({ tool: 'bash', commandHash: hashString(command) })` — reuses
  the write `contentHash` helper (`'sha256:' + hex`); the command is validated by a new
  `extractBashCommand` (missing / non-string / whitespace-only → the three closed reasons above,
  zero backend round-trips); the hash covers the **RAW** command (no shell parsing, no
  normalization); the **resource stays tool-level** (`{ kind: 'tool', key: 'bash', display:
  'bash' }`) and the resolver is never called for bash.
- **Adapter tool-level summary** (`pre-execute-adapter.ts`): gains a bounded **non-authority**
  command preview — `commandPreview(arguments)`: first **120 chars**, whitespace-flattened to
  single spaces, ASCII `...` appended when truncated (deviation D3); total (never throws);
  display text ONLY — the durable `summary` field is "free text; NOT authority data"; the
  preview never enters the fingerprint/scope/hash (those carry the command HASH).
- **a2 legs**: same command → same fingerprint; different command → different fingerprint; raw
  command not in the digest; +4 fail-closed captures (missing / non-string / whitespace /
  non-object args) + the fail-closed resolver-not-called pin extended to bash.
- **a5a S12 rewritten**: A (`echo hello` ask → allow → executes; request pinned against A2's
  fingerprint of the same raw command; summary preview `bash echo hello` pinned) → A2 (SAME
  command, new callId → SAME fingerprint, NEW request, allow-once) → B (`ls -la` → DIFFERENT
  fingerprint; the command-A approvals cannot authorize command-B; deny → zero execution) → C
  (unchanged: no rule + default deny → static deny).

### P1-3 — exact DENY rule canonicalization failure ⇒ operation DENY (option A) (commit (c) `2247736`)

- **Why**: R2's "both resolve or both fail" argument does not hold in general — the operation and
  the rule are SEPARATE resolver calls at different times over a mutable filesystem. The per-lane
  consequences of a failed rule are asymmetric: failed ALLOW = no positive grant (never elevated);
  failed ASK = falls to the default (ask — same — or deny — more restrictive; not an escalation);
  failed DENY = a STATIC DENY downgrades to ask/default and an approval may then authorize what
  the policy statically forbade (an escalation). **Only the deny lane flips; only the deny lane
  gets the fail-closed flip.**
- **Implementation** (`pre-execute-adapter.ts`): `canonicalLane(laneName, rules, tool)` reports
  per-lane `failedExact` (the raw trimmed paths of same-tool exact rules that failed
  canonicalization — A1 already trims exact paths); `canonicalRulesFor(tool)` surfaces
  `denyCanonicalizationFailure?` (set from the deny lane only); **`enforce` step (3) denies
  BEFORE calling the A3 resolver** when set — stable reason naming the failed path(s):
  `permission denied: a static deny rule could not be canonicalized (<paths>) — the rule cannot
  be dropped (fail-closed)` + an `onObserve` row (stage `deny-canonicalization-failure`, tool +
  paths). The failure is NOT cached (success-only cache unchanged): the next decision retries and
  re-binds the rule once it resolves. Allow/ask lanes keep non-match-on-failure semantics.
- **R2 module doc** updated to state the lane asymmetry (plus the `canonicalRuleKey` /
  `canonicalLane` / `canonicalRulesFor` doc updates and the diagnostics-stage doc).
- **a5a legs DR-A..DR-D** (+8 tests): DR-A fail-closed deny before the resolver (stable reason +
  observe row + zero execution + zero control rows) and not-cached retry (after the backend
  recovers, the rule re-canonicalizes and the operation proceeds to the default ask); DR-B failed
  allow rule → no match (asked, approved, executes; no fail-closed row); DR-C failed ask rule →
  falls to the default (deny) (static deny, not the fail-closed reason); DR-D mixed failed lanes
  → only the deny lane flips (reason names the deny path, never the allow/ask paths).

## Gate table (actuals)

| Gate (brief §3) | Actual |
| --- | --- |
| domain full: baseline shape 373/10 + (a)'s 5 new tests | **378 passed \| 10 failed (388)** — the SAME 10 pre-existing failures: `t1-capability-schema` ×9 + `t2-blueprint-hash` ×1 (17 passed files + 2 failed of 19) |
| runtime a2/a3/a5a updated green; a4a/a6a/t12a/h1a still green | focused **227/227**: a3 28, a2 31, a4a 28, a5a 50, a6a 50, h1a 40 (h1a = H1's suite, no regression); t12a: its 3 module-load-failing files remain the PRE-EXISTING parity failures (no H2 touch) |
| runtime full parity (known failing set unchanged, no new failures) | **6 failed files \| 141 passed (147)**; **8 failed \| 1523 passed (1531)** — identical failing set to H1's baseline (p6t3-mediation 5, d3-member-identity-context 1, p6t3-restart 2 = the 8 failing tests; p8s3b-result-effects + t12a-b2-child-identity + t12a-glue-handoff-ports = the 3 module-load files). passed = 1512 + 11 new (a2 +1, a5a +10) |
| testkit at the pin, (h2) DEC-1 entry appended (value + comment only) | **124 passed \| 0 (15 files)** at pin **667** — in-place edits only, no new scannable file; `(h2)` entry appended to the DEC-1 chain in `p4t6-session-event-scan.test.ts`; scanner re-run green |
| pin delta | **667 → 667** (H1's value; H2 added zero scannable files) |
| typecheck | **0 errors, 9/9 packages** (`pnpm -r run typecheck`) |
| build | **0, 9/9 packages**; 25 install-surface dist files rebuilt (domain blueprint src + runtime operation-permission) |
| build:composition + artifacts | **exit 0**: `[check-artifacts-committed] OK: 1080 files; committed install-surface artifacts match the fresh build` (the pre-staging working-tree run exits 1 BY DESIGN — the STALE-artifacts gate stages the rebuilt dist for same-commit inclusion; after staging, exit 0) |
| dist EOL pure LF | verified: all 25 changed dist files contain **zero CR bytes** (one glue file, `agent-bindings.mjs`, was re-copied CRLF by place-dist-glue from its CRLF source and restored to the committed LF form — content byte-identical modulo EOL; the artifacts check itself is autocrlf-filter-insensitive) |
| references/ porcelain 0 @ a66e470204 | verified in the main worktree: `deepseek-harness-test-use` @ `a66e470204`, porcelain 0; `deepseek-harness` (fork) porcelain 0 |
| bash-occurrence sweep | done — 7 illegal fixture/doc sites fixed in (a); all remaining occurrences legitimate (full classified list: `h2-bash-occurrences.md`) |

## Deviations (with evidence)

1. **D1 — a third P1-2 reason, `bash-command-empty`**, beyond the brief's "missing/non-string"
   wording: the upstream `tool-bash` `validateBashArgs` rejects `command.trim().length === 0`
   (verified in `references/.../tool-bash/src/index.ts`), and the closed-enum pattern already
   carries `file-path-empty` for the analogous read/edit path validation. Pattern-fidelity +
   upstream-tool fidelity; pinned by a2 (`failBashCommandWhitespace`) and by the errors.ts doc.
2. **D2 — `NEG_PERMISSION_ANY_WITH_PATH` / `NEG_PERMISSION_ANY_EXTRA_FIELD` switched
   `bash` → `read`**: both negatives isolate an any-resource field violation; with `tool: bash`
   they would ALSO trip the new P1-1 rejections (bash+any in their lanes), breaking the
   single-violation property the negative fixtures document. Documented in the fixture comments.
3. **D3 — ASCII `...` ellipsis** for the preview truncation marker (the brief says "ellipsis when
   truncated" without specifying the glyph): three ASCII dots, 120-char cap on the
   whitespace-flattened string, pinned by a5a S12 (`bash echo hello` / `bash ls -la` — under the
   cap, no truncation in the pin) — the truncation branch is covered by the helper's code path
   (total, defensive) but not by a >120-char test command (a deliberate choice: the pin keeps the
   summary text stable for the common case).
4. **D4 — pre-(d) `build:composition` working-tree run exits 1 by design** (the
   STALE-artifacts gate's contract: rebuilt dist must ship in the SAME commit as the source
   change). Recorded here with the post-staging green run (`OK: 1080 files`); the dist rebuild is
   included in commit (d).

## Commit list (this branch, on top of base e352cae)

| Commit | Content |
| --- | --- |
| `15172be` | (a) P1-1 — the bash contract: the A1 schema is the enforcement point (8 files: validate.ts, types.ts, schema.ts, fixtures.ts, a1 suite, permission-resolver.ts ruling comment, a3 suite, a6a fixture) |
| `3ca9615` | (b) P1-2 — the bash fingerprint binds the command: A2 projection `{ tool, commandHash }`, 3 new closed reasons, the bounded non-authority summary preview, a2/a5a legs (5 files) |
| `2247736` | (c) P1-3 — exact deny-rule canonicalization failure ⇒ operation DENY (option A): `failedExact` / `denyCanonicalizationFailure?` / pre-resolver deny + observe row, R2 lane-asymmetry doc, a5a DR-A..DR-D (2 files) |
| (d) | evidence + p4t6 `(h2)` DEC-1 entry + the rebuilt install-surface dist (25 files, pure LF) |

## H3 hand-off notes

- The a3 MATCHER is untouched (total, defensive); any H3 work on parameter-level shell matching
  must start from the A1 schema (the enforcement point) — see the a3 module's recorded ruling.
- The bash fingerprint is now per-COMMAND: any durable-approval UX for bash will show per-command
  requests (allow-once per command string); the preview in the summary is the display affordance
  (120 chars, flattened, `...`).
- P1-3 fail-closed deny uses reason text `a static deny rule could not be canonicalized
  (<paths>)` + observe stage `deny-canonicalization-failure` — stable, pinned by DR-A/DR-D.
- The p4t6 pin is 667; the next task that ADDS a scannable file under `packages/**` bumps it to
  668 + appends its own DEC-1 entry after `(h2)`.
