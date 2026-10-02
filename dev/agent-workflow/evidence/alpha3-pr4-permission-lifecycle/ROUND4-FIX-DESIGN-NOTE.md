# Alpha3 PR4 — ROUND 4 FIX-DESIGN NOTE (authority binding + explicit §6 carrier)

> **[SUPERSEDED PARTIALLY — 2026-10-02 (ROUND 5)]** The parent's
> final round-4 review (three reviewer reports R-A/R-B/R-C, all IN) removed
> the `leaderAuthorityFacts`/`authorityCeiling` SECOND policy gate described
> in §2 (last paragraph) and §3 (BLOCK-4) below — ADR §6 carries NO second
> policy condition: the §6 expansion policy is EXACTLY the explicit
> `permissionMutationEnvelope` carrier over the target member's effective
> before/after. What the grantor itself can execute is the grantor's own
> decision-plane question, never a gate on the grant. Ledger-honesty note:
> the round-4 ceiling refusals additionally MISLABELED — they threw the
> aggregate problem `expansion-region-uncovered` while the documented
> `expansion-exceeds-authority-ceiling` label was UNREACHABLE in the
> aggregate path. The round-4 record below stays visible AS RECORDED; the
> round-5 chains live in `round5/` and the README round-5 section.

Date: round 4 (tree base `3d432261a4941328e78ff1785c694fff65d70f3d`, parent `440ede51…`).
Author: PR60 sole writer. Input: parent CONFIRMED-GO batch + the five reviewer
reports (R-A, R-B, X1, X2, R-C). This note records the DESIGN DECISIONS; the
battery raws live in `round4/`, the ledger in `README.md` (round-4 section).
**[CORRECTED 2026-10-02 (ROUND 5): "CONFIRMED-GO" was overstated framing — the
parent's round-4 batch directed implementation WHILE the reviews circulated;
the round-5 reviews (three independent reviewers over the shipped round-4 HEAD)
reopened two of this note's designs (the second policy gate and the authority
cache, both removed in round 5). Read "CONFIRMED" as "GO to implement", never
as "design beyond review".]**

## 1. The config carrier (`permissionMutationEnvelope`)

Frozen-doc basis: ADR §6 (the §6 MutationEnvelope governs LEADER EXPANSION)
and design §4/§5 (operationClass + matcher grammar + ladder). The carrier is
a NEW TOP-LEVEL blueprint field, conceptually DISTINCT from `teamEnvelope` /
`memberEnvelopes` (those are operation-token capabilities; this one is the
permission-MUTATION authority):

```
permissionMutationEnvelope:
  rules:
    - operationClass: <PERMISSION_TOOL_NAMES token>
      matcher:
        kind: exact | subtree        # FILE classes → PATH
        path: "<path>"
      maximumEffect: allow | ask | deny
    - operationClass: bash | pwsh
      matcher:
        kind: fingerprint            # SHELL classes → exact canonical fingerprint ONLY
        fingerprint: "<≤256, no control chars>"
      maximumEffect: …
```

Validation (`packages/domain/blueprint/src/validate.ts`
`validatePermissionMutationEnvelope`): closed field sets; shell classes MUST
use fingerprint matchers and file classes MUST NOT (the §5 class split is
enforced AT THE GRAMMAR — a malformed carrier is a blueprint rejection, not
a runtime surprise); duplicate `(operationClass, kind, resource)` pairs
refuse; empty `rules` is a legal typed absence. Present-only inclusion in
`toHashableBlueprint` keeps every pre-round-4 blueprint contentHash
BYTE-IDENTICAL (existing hash pins pass unchanged).

RULING (recorded): `permissionMutationEnvelope` is deliberately NOT added to
`BLUEPRINT_POLICY_REFERENCEABLE_FIELDS` — a POLICY-STATE transition must
never flip an AUTHORITY carrier; the carrier is draft-frozen with the
snapshot like the template policies themselves.

## 2. The envelope path basis (documented ruling)

Envelope FILE matchers canonicalize against **the TARGET member's effective
workspace** (`durable member.workspace ?? team default` — exactly the glue's
`memberCwd` doctrine, `agent-bindings.mjs`), through the REAL fs provider, at
read time. Rationale: the kernel compares the envelope matcher against the
rising cells partitioned from the TARGET member's overlay + static facts,
all of which are canonical keys in the TARGET's space; one decision must see
ONE canonical key space (round-3's row-anchor constant broke this whenever a
member ran at a different workspace — BLOCK-3). EXEC fingerprints are carried
VERBATIM — a fingerprint IS an identity; canonicalizing it would be wrong
(BLOCK-1: this is exactly what makes exec expansion REACHABLE).

The leader CEILING (`leaderAuthorityFacts`) evaluates the LEADER template's
policy AT THE TARGET MEMBER'S BASIS for the same one-key-space reason: a
deny exception inside an allow subtree must land on the exact key it
subtracts. Cross-workspace interpretation mismatch can only make the ceiling
STRICTER (fail-closed), never looser.
**[SUPERSEDED 2026-10-02 by ROUND 5: this paragraph's second half — the ceiling itself — was REMOVED in
round 5 (no second policy gate; carrier breadth over a leader deny is the
content-hash-pinned blueprint AUTHOR's choice per §6). The addressed-basis
doctrine of the surrounding sections stands.]**

## 3. Per-BLOCK closure map

- **BLOCK-1 (exec UNREACHABLE).** The carrier grammar carries the fingerprint
  authority (§1); `createPermissionAuthorityFacts.buildEnvelope` maps it
  verbatim (`packages/runtime/src/plugin/permission-plane.ts`
  `buildEnvelope`). The old skip-shell branch (`if (classifyPermissionOperationClass(…) !== 'fs') continue`)
  is DELETED with the whole derivation. Pinned: entry `R4-exec` (real host
  boot: legal fingerprint ALLOW commits, uncarriered fingerprint refuses,
  envelope-free tightening stays legal), root-level `A3` (verbatim, zero fs
  calls), plane spec P4 (decision side, untouched).
- **BLOCK-2 (row-A-on-behalf-of-team-B).** `void teamSessionId` row-wide
  constant DELETED. The readers are addressed `(teamSessionId,
  memberInstanceId)` (service.ts awaits them INSIDE the serialized section);
  every document resolves through `resolveBoundBlueprint(teamSessionId)` —
  the SAME three-case bound-Blueprint authority the team identity binds to
  (no-anchor-fallback contract; an unresolvable ref is UNKNOWN, never the
  anchor). Pinned: `A1` (two teams, IDENTICAL templateIds, carrier on one →
  authority differs), entry E2 + all R4 legs (real host apply).
- **BLOCK-3 (cwd wrong-source).** Canonicalization anchor = the TARGET
  member's EFFECTIVE workspace (§2), read per-addressed-member through the
  durable row; the frozen identity closure is GONE; drift revalidation is
  REAL (the tuple `{blueprintId, revision, contentHash, templateId, cwd,
  providerVersion}` is re-read after the canonicalization await — a changed
  tuple discards the document, never caches mixed identity). Equality skip:
  `planPermissionMutation`'s pair equality (X2's refined site) is left
  BYTE-STABLE and is honest under the corrected authority — an unchanged
  effective state is not an expansion, and a stale canonical key can no
  longer ENTER the store because the first commit is now anchored + ceiling-
  checked (pins `A7` discard-on-drift, `A8` cache tuple, `R4-anchor` basis
  inversion). The lane's own decision plane (X2: correctly per-team today)
  was NOT touched.
- **BLOCK-4 (derive swallowing deny/ask).** The derivation of the envelope
  from the leader's static ALLOW/ASK lanes is REMOVED (envelope = the
  explicit carrier ONLY). On top, every risen cell is additionally capped by
  the leader's EFFECTIVE answer (`permissionEffectiveAnswer` over the
  leader's OWN overlay + static facts — exceptions subtracted, never a lane
  union): below-risen → `EXPANSION_OUTSIDE_ENVELOPE` (problem
  `expansion-exceeds-authority-ceiling`), unknown grantor →
  `EFFECT_CONTEXT_UNAVAILABLE` (`permission-mutation.ts` risen branch; the
  `authorityCeiling` input is OPTIONAL — absent = the PR3 algebra
  byte-for-byte, pinned by `B4` + the untouched a3p3 80/80 family). Pinned:
  `B1`/`B2` (X1's two demos verbatim), `R4-derive` (same shape through the
  real boot), `R4-absent` (absence = no expansion, tightening unaffected —
  NOT a hard fail).
  **[SUPERSEDED 2026-10-02 by ROUND 5: the "additionally capped by the leader's EFFECTIVE answer"
  mechanism and its `authorityCeiling` input are REMOVED (kernel, service
  fold, host injection, plane reader — all deleted; the mislabeled problem
  label recorded above). The derive-REMOVAL (carrier-only envelope) and
  `R4-absent` STAND. Test pin changes: B1/B2 retargeted to the ruled
  positive (carrier-subtree-covering grants COMMIT), B3/A9 removed,
  `R4-derive` INVERTED into `R5-derive` (carrier-covering member grant
  COMMITS while the leader's own answer stays DENY — no self-widening),
  B4/B5 retained (pure-envelope algebra), `R4-ceiling` retained (the
  envelope's OWN ladder math — name collision with the removed gate only).]**
- **GAP3 (refresh-failure semantics, recorded).** Boot refresh is a WARMUP:
  failure = LOUD log + abstention + typed expansion refusal + BOOT CONTINUES;
  faults are NEVER cached, so the next addressed read REBUILDS (bounded
  recovery), while unaffected readers keep serving correct current facts.
  Pinned: `A6` (unit), `R4-recover` (entry: refusal-during-fault + unaffected
  commit + lazy recovery).

## 4. What round 4 did NOT do (honest edges)

- The DECISION plane (live glue pre-execute canonicalization at
  `session.header.cwd`) is UNTOUCHED (X2: correctly per-team today; there is
  NO verdict cache in production — X2's refinement retracted that concern
  and no such machinery was invented here).
- The grant RESOURCE text remains a canonical key supplied by the caller:
  tool-surface canonicalization of leader-authored grant paths at the
  target-member basis is FUTURE wiring (no production RPC wire calls
  `grantInstance` at this commit — the root `permissionPlane` surface +
  tests; stated per X2 so the entry tests are not over-read).
- Cross-team isolation at round 4 is pinned at (a) the builder directly with
  identical templateIds (`A1`) and (b) the real host boot carrier semantics;
  a SECOND TeamSession boot inside one host world (mirroring
  `policy-state-multi-team-bound-blueprint.test.ts` exactly) was not added —
  the resolver is the SAME `resolveBoundBlueprint` production function those
  specs already pin per team.
- X1's standing exec truths are preserved verbatim (leader's own exec allow
  stays the static-`any` + capability-envelope DUAL gate; exec overlay
  ALLOW stays human-grant-only; exec exact/subtree IN THE OVERLAY stays
  MALFORMED; deriving exec authority from `any` stays FORBIDDEN — this round
  added the EXPLICIT carrier path only).

## 5. Tests added this round

> **[SUPERSEDED PARTIALLY 2026-10-02 (ROUND 5)]** The counts below are the
> round-4 record (spec 14, family 75). Round 5 retargets them: the
> `authorityCeiling` kernel legs B1/B2/ B3 (B3 removed) and the leader-ceiling
> leg A9 (removed) change `a3p4-r4-authority-binding` (14 → 12 legs, A8
> INVERTED to a no-cross-call-cache pin); the entry file grows 15 → 20
> (`R4-derive` → `R5-derive`, +`R5-tool`/`R5-rpc`/`R5-ws`/`R5-grammar`/
> `R5-hash`). The round-5 math + raws live in README (round-5 section) and
> `round5/`. What ROUND 5 KEPT of this section verbatim: the FIRST direct
> spec of `createPermissionAuthorityFacts` (addressed-team, target anchor,
> fingerprint verbatim, absence legal, unknown bindings, drift discard, fault
> recovery) and the E2 carrier re-anchor.

- `test/a3p4-r4-authority-binding.test.ts` — FIRST direct spec of
  `createPermissionAuthorityFacts` (A1–A9: addressed-team, target anchor,
  fingerprint verbatim, absence legal, unknown bindings, fault recovery,
  drift discard, cache tuple, leader ceiling) + kernel `authorityCeiling`
  (B1–B5: X1 both demos, unknown grantor, legacy compatibility, laundering-
  class pin). `Tests 14 passed (14)` — `round4/r4-spec1-authority-binding.log`.
- `test/a3p4-pr4-production-entry-regression.test.ts` — new `R4` describe at
  the REAL host entry (exec allow + over-ceiling + tightening; ask ceiling;
  deny-exception; absent-carrier; anchor inversion; recovery) + the E2
  carrier re-anchor (`DERIVED` → configured carrier, comments corrected).
- Family: `Tests 75 passed (75)` — `round4/r4-family-green.log` (prior 55
  legs kept, zero weakenings; E2's absolute-path legs retained and the
  relative-divergence coverage ADDED as required).
