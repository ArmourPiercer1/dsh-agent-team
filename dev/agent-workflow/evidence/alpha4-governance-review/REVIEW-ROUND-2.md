# Alpha.4 governance — review round 2 (2026-10-07): closure verification of round-1 blockers

**Object under review**: the A1/A2 amendments as written in `docs/plans/active/alpha4-permission-governance/` (working tree at `docs/alpha4-governance-accept-20261007`, code baseline `master@2b86ee42`).
**Method**: two fresh reviewer subagents, each given **only the round-1 blocker text** — none of the round-1 dispositions, and no knowledge of each other's work — instructed to judge whether the amended documents close those blockers *as written*, to attack the wording rather than the intent, and to hunt for contradictions the amendments introduced. Read-only; no tests, builds, hosts or ports; nothing modified.
**Protocol**: per `docs/ROUTER_RULES.md` §0 and plan A1.1, this is the re-review of the same review round's fixes, so the findings were restated; the dispositions were not.

## Verdicts

| Lane | Verdict | Per-blocker closure |
|---|---|---|
| Security (`cc86965f…`) | **BLOCK**, narrowly | B1 CLOSED · B2 CLOSED · B3 PARTIAL · **B4 NOT CLOSED** |
| Architecture (`bd1f94f1…`) | **SUPPLEMENT** | B1 PARTIAL · B2 PARTIAL · B3 PARTIAL; no closure unimplementable; **no new `CORE_SEAM_BLOCKER`** |

Round-1 blockers B1–B4(security) / B1–B3(architecture) are therefore **structurally addressed but not closeable as written**; the gap is wording, ownership and one real semantic hole — closed by **Amendment A3**.

## The blocking finding

**F-N1 (security, MAJOR)** — my own A2-6 said "for one-shot approvals the applicable ceiling document is selected by the **beneficiary's** carrier". Under a member beneficiary, the Alpha.3 carrier *is* the mutation envelope evaluated at the target's basis (`governance/permission-mutation.ts:1042`), so a literal implementation never consults `teamHardEnvelope` when a Human User approves a member ask — voiding the Human Admin hard ceiling for exactly the approvals A1-4 exists to preserve. Because A2's preamble claimed "supersedes the text above and A1 on conflict", the document's own precedence order selected the hole.
**Closure**: ADR **A3-1** (both documents always narrow, for every reviewer and beneficiary; a carrier selects only the canonicalization basis; A2-6's selection clause retired in place) + a new **Global Precedence** section whose rule 2 is "ceilings are never relaxed by ambiguity — the restriction-preserving reading governs, and such a conflict is a defect to fix in place, never a choice for an implementer".

## Round-2 findings and their disposition

| Finding | Sev | Disposition |
|---|---|---|
| F-N1 ceiling-document selection voids hard ceiling | MAJOR blocking | **A3-1**, Global Precedence, A2-6 retired in place |
| F-N2 spec §7.4/§21.4 still route approvals by ceiling-reaching (the deadlock A1-4 rejects); §24.3's pinning tests had no PR home | MAJOR | §7.4 rewritten in place as `mayReview()` / `grantCeiling()` with new §7.4.1 tests owned by **PR2 lane A**; §21.4 rewritten in place, tests owned by **PR4 lane A** |
| F-N3 plan Global Constraints "fail closed on no match" and lane D "no-match zero authority" unconditional | MAJOR | both corrected in place to plane-specific semantics |
| F-N4 §24.3 `min()` mixes `RuntimeAuthority` with `EffectiveCeiling`; A1-4's "minimumAuthority of the matched permission rule" is a dangling term (no schema, no code) | MAJOR | **A3-2**: two functions never `min()`'d; the dangling term struck; no such field may ever be added |
| F-N5 the exec dual-gate (leader shell allow→ask on missing exec fingerprint, `pre-execute-adapter.ts:1406-1443`) has no stated v3 disposition | MAJOR | **A3-4** decides it (matching shell rule narrows, absent shell rule does not; residual accepted and disclosed); PR4 must test both branches |
| F1 PR0 invisible to every gate, review order, merge table; `p4t6` pin owned by PR1 | HIGH | plan **A3 addenda**: PR0 joins gates/review/merge/stable-state, gains pin-recompute authority |
| F2 plan still orders "add `escalate` decision value" (the fail-open shape A2-1 forbids) and plan A2 addenda lacked a precedence clause | HIGH | both lines struck in place; precedence clause added; **Global Precedence rule 3** requires semantic changes be applied in place |
| F3 PR7 missing the earliest anchor-parse owner (`blueprint-authority.ts:232` via `host.ts:1695`, `root.ts:883`) | HIGH | **A3-11** + PR7 file list |
| F4 `inspect.ts:169` widening silently unlists v1/v2 sources, killing catalog-assisted migration | MED | **A3-11**: inspect stays listable with the typed reason; strong parse rejects |
| F5 two matcher ASTs; "single grammar" would become a third | MED | **A3-9**: config-shaped AST wins (hash-bound); runtime shape demoted to adapter |
| F6 `maximumEffect` names a storage type; domain can't reach it legally | MED | **A3-9**: structural re-declaration in domain + mutual-assignability test; no `domain→storage` edge, no contracts edit |
| F7 lane-hygiene walk roots exclude `domain` | MED | PR1 adds the root |
| F8 A2-16 "exactly one `.append(` call site" is false (two exist today) | MED | **A3-10** restates it as one funnel; verified myself: `governance/service.ts:707` + `overlay-repository.ts:71` |
| F9 lane C7 named a fixture that does not exist and missed 16+ kits, the authoring helper, and the harness source | MED | **A3-16** + my own recount: **19** files carry `schemaVersion: 1|2`; `scripts/fixtures/` holds only `zero-core/`; `scripts/composition-smoke.mjs` has **zero** "blueprint" occurrences; enforcement is a new static scan (the affected kits are precisely the environment-blocked lanes) |
| F10 escalation leaves the inline waiter with no outcome | MED | **A3-12(i)** typed `escalated` terminal outcome |
| F11 the blocking RED test could never be RED (foreign decision values are dropped by the read gate) | MED | **A3-12(iv)**: inject at the guard input; RED today, green after the exhaustive switch |
| F12 testkit ownership cross-wire (fixtures are a PR7 need, the pin is a PR0 need, the tree says PR1 owns testkit) | MED | plan A3 addenda: pin recompute per-PR from PR0; PR7 owns testkit fixtures |
| F13 escalation leg fact had no durable shape; `stale-denied` reuse stays attractive | MED | **A3-12(ii,iii)**: `control-escalation-recorded` with named fields; `stale-denied` banned for escalation (it asserts target-terminal and renders as "stale") |
| F14 A2-15 named files off the `ensureRootLive` path | LOW | **A3-13**: real path `plugin/root.ts` / `plugin/s6-remote.ts`; the defer-escape removed |
| F15 phantom kind name `permission-envelope-mutation` | LOW | **A3-14**, corrected to the verified facts: the string is nowhere in the tree **and** no longer in the documents; canonical spelling `'envelope-mutation'` (`control/types.ts:129`) |
| F16 dead doc pointers (`docs/plans/drafts/…`, Alpha.3 user-facing doc) | LOW | fixed in place |
| F17 PR4 missing `action-router/router.ts:619` and `operation-permission/errors.ts` | LOW | PR4 list |
| F18 `packages/domain/tsconfig.json` include must gain the new module dir | LOW | PR1 list |
| F19 proposal rows render as uncategorized ledger entries | LOW | PR6 owns the client mapping; PR0 owns the category registration |
| F20 `scripts/fail-set.mjs` required by A1.2.2 is owned by no PR | INFO | PR0 owns it (built and verified in `.worktrees/a4-fail-set` `2a0ff1ef`) |
| F21 positive: PR1's existing-test citations are accurate; A2-13's drift predicate is sound on the pinned seam | INFO | recorded |
| B1/B2 narrow residuals (per-write mismatch assert has no named test; "governance state" undefined for the enumeration test; tool-side caller binding not named as a derivation site) | MINOR | folded into the A1.4 invariant→test matrix, which **now has an owner** (PR1, written before its first GREEN) and must name `compatibility.reprobe`, `member.archive/dispose/restore`, `team.create`/`handoff.create` and the admission/liveness methods, not just methods literally named "governance" |
| B3 residual: legacy-shape rows lack the three re-derivation inputs; v1/v2 bridge keeps self-request/self-resolve by construction | MINOR→disclosed | **A3-17**: named as a temporary security exception with PR7 retirement instead of left implicit |
| A1-9 suppression bypassable by generation-bumping self-tightening | LOW | **A3-17** accepted and disclosed: friction, never authority |

## Coordinator corrections to the review record (verification over authority)

Round 2 was right about substance in the main and wrong on several cited facts; each was checked before being written into a normative clause, and three of my own A2 clauses turned out to be the ones at fault:

1. **Storage claim reversed twice.** The architecture lane's first report said `factType` is a "closed 13-value union" with a registry that throws `unknown ledger factType`. Not reproducible: `packages/storage/schema/ledger.ts:87-88` types it as an open hygienic string (documented as such at `:15-17`), `durable-mutation-store.ts:81` calls it an "open factType vocabulary", and `repositories/ledger.ts` whitelists nothing. The lane's own later report agrees. **My A2-2's "ledger-first" premise was right; my PR0 file list naming `storage/schema/ledger.ts` was the actual error** (a no-op), and PR0's real missing obligation was the one neither report named first: an unmapped fact type throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` in `plugin/projection-source.ts:766` and breaks the **whole ledger read plane**, not one row (A3-7).
2. **`schema_meta.stamp` needs no change.** The "make stamp a `string[]`" suggestion is rejected: it would alter the stamped-home contract for no need, and the premise it rested on was the reversed storage claim.
3. **Two cited paths do not exist**: `packages/contracts/src/control.ts` and `packages/runtime/src/control/types.ts`. The durable vocabulary is `packages/runtime/control/types.ts:169-182` = `allow | deny | stale-denied`, and `'escalate'` exists nowhere in `packages/**` as a value — which makes plan:277/289 ("add `escalate` decision value") the live hazard and confirms A2-1's ban (F-N2/F6 stand regardless).
4. **My own A2-10 misdescribed the version vocabulary** (`inspect.ts` is the weak identity inspector; the strong parse throws `SCHEMA_VERSION_MISMATCH`) and **A2-6 was the security hole** (F-N1). Both corrected in place rather than re-amended around.

## Status after this round

Round-1 blockers: **closed by A3 as written** (B1–B4 security, B1–B3 architecture), with three items deliberately *accepted-and-disclosed* rather than closed (A3-17). Round 3 is the last permitted round under the plan's three-round cap: a narrow check that A3 closes F-N1/F-N2/F-N3/F-N4/F-N5 and F1–F3 without introducing new contradictions. If round 3 still blocks, this becomes a §5 blocker escalated to the user rather than a fourth attempt.

Evidence: round 1 = `REVIEW-ROUND-1.md`; this round = this file. Verbatim lane reports live in the orchestrating session log.
