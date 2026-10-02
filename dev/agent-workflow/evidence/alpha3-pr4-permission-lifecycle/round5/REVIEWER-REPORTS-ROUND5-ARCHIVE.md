# Round-5 reviewer reports — archive (condensed by the sole writer)

Date: 2026-10-02. The three round-5 reviewer reports (R-A, R-B, R-C) were
forwarded VERBATIM by the parent in session; the forwarded originals were not
committed to this worktree at the time of receipt. This file archives a
faithful CONDENSATION, item by item, with the disposition each item received
in the round-5 commit. Where the condensation simplifies the reviewer's exact
wording, the round-5 README section + the code/test anchors carry the precise
resolution. This archive exists so the ledger is self-contained offline.

## R-A (design/law reviewer)

- **GAP (hard) — the second policy gate must go.** ADR §6 carries exactly ONE
  policy condition for leader expansion: the explicit `permissionMutation
  Envelope` carrier, evaluated against the TARGET's effective before/after.
  The round-4 `authorityCeiling` fold (leader's own effective answer capping
  every risen cell) is a SECOND policy condition the frozen docs do not carry.
  Required positive regression at ENTRY level: a carrier-permitting grant for
  X COMMITS even though the Leader itself denies X; the Leader's own execution
  permission for X is unchanged (no self-widening).
  → FOLDed: FIX-1 (gate deleted kernel/service/host/plane; `R5-derive` is the
  required entry regression). The round-4 refusals this gate produced were
  additionally MISLABELED `expansion-region-uncovered` while the documented
  `expansion-exceeds-authority-ceiling` label was UNREACHABLE in the
  aggregate path (writer-discovered while removing it; cited in the
  ROUND4-FIX-DESIGN-NOTE.md supersede marker).
- **GAP (minor) — `healthy()` honesty + loud warm-up fault.** `healthy()` must
  derive from per-target READ RESULTS, not "did refresh throw"; a warm-up
  fault must print a LOUD console.error, and the recovery regression must
  ASSERT the log line.
  → FOLDed: readFresh records per-target ok; refresh ANDs them; host.ts prints
  the `[dsh-agent-team] ... warm-up FAULTED ...` line; `R4-recover` asserts
  `warnings` matches /warm-up FAULTED/.
- Naming note: the surviving `R4-ceiling` leg is ENVELOPE ladder math via the
  carrier's own `maximumEffect` — a NAME COLLISION with the removed gate, kept
  deliberately (B2 same algebra at spec level).

## R-B (line-level reviewer)

- Carrier NEGATIVE-GRAMMAR legs + a GOLDEN content-hash pin were the standing
  round-4 debt (the MALFORMED rejection class existed nowhere in the repo).
  → FOLDed as `R5-grammar` (closed ladder vocabulary / closed field set /
  matcher-kind closure) + `R5-hash` (golden hash
  `sha256:f0148ab83ec03c4dcb3da4b9357b260ea446067fb335c56153b35b815c897bd6`).
- Single-tool sketch (`team_mutate_permission` with a verb field) was offered
  as an example. → Writer ruling: TWO tools (grant/revoke) — matches the
  verb-object convention of the existing twelve/thirteen and the parent's
  "grant/revoke tools" wording. Grammar otherwise as sketched (closed rules,
  opaque client keys never authorization input).
- Mutation-kind claim: the closed kernel set is `grant_instance |
  update_permission | revoke_permission` (permission-mutation.ts:394). The
  writer's first pass had invented `revoke_instance`; caught by the RED leg
  (`r5-entries-iter1.log`), corrected everywhere.
- B5 claim (`B5` supposedly laundering through the ceiling input) was WRONG at
  line level — B5's inputs are pure-envelope; B4/B5 RETAINED unchanged.

## R-C (entry/production reviewer)

- **GAP (real) — no production entry exists for the grant lane.** The whole
  round-4 carrier/lane work was unreachable from any REAL entry: no tool, no
  RPC method. Required regressions ×2 paths: real entry → GMS → durable
  snapshot → NEXT pre-execute shows real ALLOW (granted) and real refusal
  (absent/revoked), end-to-end through the production adapter.
  → FOLDed: FIX-2 — `team_grant_permission`/`team_revoke_permission` on the
  real ToolSpec surface (leader gate server-side, canonicalization INSIDE the
  wiring at TARGET member basis) + REMOTE method `override.mutatePermission`
  (v7-only, OVERRIDE category, closed schema, human principal → operator
  authority mirroring the override lane). Legs `R5-tool`, `R5-rpc`.
- **GAP (real) — CWD source-of-truth.** memberWorkspace fallback must use the
  DURABLE `teamSessions.get(teamSessionId)?.defaultWorkspace`, NEVER the acting
  boot-row `resolvedRowConfig.defaultWorkspace`; no row → undefined (UNKNOWN).
  Required pin: NON-BOOT Team B (two teams one row): Team-B leader (no member
  row) + Team-B member without workspace row canonicalize under B's durable
  default, never row-A. Glue ambiguity (agent-bindings boot-member meta.cwd =
  config.defaultWorkspace) recorded as a ledger note, not code.
  → FOLDed: FIX-3 + leg `R5-ws` (positive/negative leader+member, A-side
  concurrency).
- **GAP (real) — the authority cache is unprovable-version authority.** A
  constant providerVersion is NOT a version (symlink re-point staleness); the
  bindingKey omitted templateId; nothing evicted. The A8 cache-tuple pin was
  inverted evidence.
  → FOLDed: FIX-4 — full cache removal; RE-CANONICALIZE on EVERY read inside
  the serialized outer layer via the CURRENT provider/cwd; identity
  revalidation kept; A8 INVERTED to a NO-cross-call-cache pin (fresh provider
  reads MUST show through); the rebind→rebuild half kept; A1-ghost/A6/A7
  survive.

## GAP numbering note

The round-4 README uses the label "GAP3" for the refresh-failure semantics
(recording). The round-5 forwarded reports number GAP2(hard)=the second-gate
item above (R-A), GAP3(minor)=the healthy()/loud-warmup item (R-A minor);
the CWD and cache items are R-C's real gaps. This archive maps them; no
silent renumbering.
