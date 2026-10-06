# A4-PR2 writer report (lanes A/B/C) — branch `feat/a4-pr2-ceiling-evaluator`

Base `f55dd64d`. Commits: `bc10e1a7` (lane A) → `3e95a037` (reachability + proofs) →
`ae8b2940` (lane B) → this commit (lane C + addendum duties).

## Delivered
- **Lane A** `governance/authority-ceiling.ts` (+`runtime-authority.ts`): one rank map
  (`AUTHORITY_RANK`), `authorityRank`/`isHigherAuthority`/`mayReview` (3 required params, no
  self-approval), `expansionCeiling` (expansion plane: absent bound slot ⇒ `no-authority`,
  `unavailable` ⇒ refuse), `evaluateAuthorityCeiling` (minimum rung, rose-because-insufficient
  evidence). `RuntimeAuthority` is a type alias of `ProposalAuthorityPosition` (X7-R3).
- **Lane B**: `classifyPermissionRise` + `PermissionRiseRegion` extracted out of
  `authorizeLeaderPermissionMutation`, which now classifies and then refuses; the Leader's
  coverage verdict is an injected judge (`leaderEnvelopeCoverage`). Order preserved:
  pre-classification subtree gate first, CONTEXT refusal before EXPANSION.
- **Lane C**: `authorizeCeilingBoundedPermissionRise` (kernel) +
  `createPermissionAuthorityCeilingJudge` (exported from `service.ts`, computed on both planes
  separately, never fused/min'd) wired into `mutatePermission` after the Leader step and before
  the commit. New additive code `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`;
  `unavailable`/`undetermined` map to CONTEXT carrying the inner code. Lane dep
  `authorityCeiling` added (`types.ts`); v3 selection lives in the reader, never in the service.
- **Addendum (PR #81)**: `tools.ts` grant/revoke descriptions rewritten string-only to state the
  ceiling gate, the additive code, and "REFUSAL, never a pending request"; revoke now says a
  reveal is an expansion. New own pins in `a4p2-dual-envelope-mutation.test.ts` (zero test hits
  for those strings existed at base — verified). Barrel-import window closed in
  `a3p3-governance-lane-hygiene.test.ts` with 9 injected cases. p4t6 pin recomputed from the
  measured 983 → derived `983 + SCANNED_PATHS_A4PR2.length` (4 named files, 987 actual).

## Mutation proofs (production flipped, tests untouched)
`mutation-proofs/lane-a-mutation-proofs.txt` 13/13 caught; `lane-b-…` 6/6; `lane-c-…` 6/7.
Generators are in the same directory and restore from a saved copy (the first version used
`git checkout --` and destroyed an uncommitted refactor — recorded in the lane-B receipt).

## Guards I could NOT redden
- **C7 — dropping the APPROVAL plane from the judge's loop stayed GREEN.** On every fixture
  the two documents drive, the expansion plane's answer is ≤ the approval plane's for the same
  scope (`{rules: []}`: expansion `no-authority` vs approval identity `allow`; a matching rule:
  equal), and expansion is evaluated first, so the approval row is never the binding one.
  The row is therefore asserted but not *independently exercised*; a divergence-capable
  document pair (or swapping the loop order in a test build) is owed before this can be called
  covered.
- **A-`human-admin` construction**: pinned absent by source scan only; no behavioural test can
  reach that rung.

## What remains unenforced (not silent)
1. **Production wiring of the ceiling reader is NOT done.** `permission-plane.ts`
   (`createAuthorityCeilingReader`) and `root.ts` were not edited. The gate is live for any
   deployment injecting `lane.authorityCeiling`; the production root injects none, so
   production v3 mutation still behaves exactly as Alpha.3. Disclosed rather than half-wired:
   no test would have covered a root-assembled reader in the time available.
2. **Tightenings are not ceiling-gated** (deliberate, pinned as a leg): a ceiling caps
   expansion; requiring a grant to *remove* authority would make a Team harder to restrict the
   less authority its actor has.
3. **Higher-authority-required is a terminal refusal** (`requiredAuthority` is carried in the
   refusal detail — often `human-admin`, a rung with no production constructor). Pending/
   escalation is PR5.
4. **Gates NOT run** (stopped for session budget): `pnpm -r run typecheck` (only
   `packages/runtime` + `packages/tools` tsc, both clean), `pnpm build` +
   `check:artifacts` (so no dist drift committed — REQUIRED before merge), full-suite baseline
   ×2. Run so far: the 10 named suites above (187 legs, incl. p4t6) + eslint on all 12 changed
   files (clean; 3 pre-existing `service.ts` unused-import errors silenced with a note after
   verifying they fail at base `f55dd64d` too).
5. `docs/**` and orchestration state untouched; no push; CORE_SEAM_BLOCKER count 0 (no host
   edit was needed — `root.ts` already receives `resolveBoundBlueprint`/`permissionCanonicalize`).
