# The three legs, by identity, with the document line each is derived from

**Lane:** A4-PR7 §7.6 gap lane (`feat/a4-76-scenario-gaps`) · **base:** `master @ 16022365` ·
**worktree:** `.worktrees/a4-76-scenario-gaps`.

Each leg below asserts a law the ADR/spec **already states**. The assertion is derived from the
document line quoted next to it, never from observed behaviour; the document line is quoted
verbatim, and the same quote is in the header of the file that carries it.

Rows and their "no leg" findings come from
[`../7-6-closure/SCENARIOS.md`](../7-6-closure/SCENARIOS.md) (F1, F5–F8), read in full before
any writing. Documents: [`alpha4-permission-governance-spec.md`](../../../../docs/plans/active/alpha4-permission-governance/alpha4-permission-governance-spec.md)
("spec"), [`ADR-alpha4-hard-governance.md`](../../../../docs/plans/active/alpha4-permission-governance/ADR-alpha4-hard-governance.md)
("ADR").

`describe > test` identities are reproduced exactly as vitest registers them; each was verified
present in the JSON report of the nine-root census
([`ROOT-CENSUS.md`](ROOT-CENSUS.md)) rather than transcribed from the source.

---

## Row 5 — a descendant created AFTER Team startup

File: [`packages/runtime/test/a4p7-live-descendant-authority.test.ts`](../../../../packages/runtime/test/a4p7-live-descendant-authority.test.ts)
· 3 legs · 42 `expect(` sites.

`describe`: `a4p7 §7.6 row 5 — a descendant created AFTER Team startup (spec §21.3, §6.1; ADR §7.3, §8, §29.4)`

| # | `it` (verbatim) | The document line it is derived from |
| --- | --- | --- |
| L1 | `the subtree granted before the resource exists covers the resource created after startup at the FIRST ask, while the MemberInstance created after the grants still inherits nothing` | spec §21.3: *"broad subtree applies to descendant created after Team startup"*; ADR §8 worked example: root `A` with `sub-A-1`, runtime later creates `sub-A-2` — *"If the root `A` retains the same canonical identity, `sub-A-2` … may become covered by `A/**`"*. |
| L2 | `the prohibition, in the form a leg CAN assert: zero containment work through Team startup, the relation computed per ask for the pair asked about at a cost that does not follow the descendant population, a durable row that never moves, and a verdict that follows the live canonical relation` | spec §6.1: *"Authority evaluation must not materialize a static set of covered descendants. The authoritative relation is computed against current canonical identities and the injected containment seam."* · spec §21.3: *"no startup-time descendant enumeration"* · ADR §7.3: *"No implementation may expand the envelopes into a startup-time list of currently existing descendants and use that list as authority."* · ADR §29 invariant 4: *"authority is computed from live canonical/containment context, never startup path enumeration"*. |
| L3 | `the mechanism: the shipped authority lane reaches no directory-listing primitive at all (the tool a startup enumeration would need)` | The same prohibition, asserted as a structural absence over the shipped lane: spec §6.1 / ADR §7.3. The leg walks `packages/runtime/{permission-lifecycle,operation-permission,effective-policy,governance}` and requires the 7 named authority modules to have been seen, then requires that no directory-listing primitive (`readdir`, `readdirSync`, `opendir`, `glob`, `scandir`, `listFiles`) appears with a call paren in any of them. |

**What L2 cannot assert, stated plainly (the brief asked for this explicitly).** *"Must not
materialize a static set"* is a claim about an internal representation. No leg can observe a set
that is never consulted, and a leg that re-reads the source for a variable name would pin a
spelling, not a law. The closest honest assertion is the **behavioural signature such a set cannot
pass**, and L2 makes four of them: **(a)** zero containment consultations through Team startup
(the seam's call log is empty when the assembled root is handed back); **(b)** the relation is
computed *at the ask*, for the pair asked about, and the consultations an ask costs do **not**
follow the descendant population (ask with 1 descendant → create 8 → ask again: identical cost);
**(c)** the durable overlay head after those allows is the **same durable row byte for byte**
(same `snapshotId`, same generation) — coverage of a resource that did not exist when the row was
committed cannot have come with that row; **(d)** the relation is **live**: the same logical key,
asked twice across an unchanged durable row, follows the canonical containment relation when the
filesystem's canonical identity moves under it (the leg retargets a real `junction` to a real
`symlink` and the verdict flips to `deny`/`default`). L3 then supplies the strongest available
absence assertion, scoped and derived by walking, not by a guessed path.

**What is real here:** the production assembly (`createTeamProductionRoot`), a real
`FileStorageSeam` + `TeamDomain`, the real durable overlay store, real directories and files the
test creates and removes, and the test-owned **containment predicate over those real
directories** — the same injection `a3p4-production-permission-plane.test.ts` uses, because
production injects the pinned public `FileSystem.contains` and the assembly point cannot tell the
two apart.

**Counterfactual:** two mutants, both on
[`packages/runtime/permission-lifecycle/decision-lane.ts`](../../../../packages/runtime/permission-lifecycle/decision-lane.ts)
— `startup-census` (materialize `readdirSync(root, {recursive:true})` at first sight and answer by
existence) and the surgical `first-sight-verdict-memo` (cache the verdict per logical key and
replay it). Transcript:
[`transcripts/mutant-row5-census-and-memo.txt`](transcripts/mutant-row5-census-and-memo.txt).

---

## Row 6 — same canonical subtree root, descendants changed ⇒ the proposal stays valid

File: [`packages/runtime/test/a4p7-descendant-change-proposal-valid.test.ts`](../../../../packages/runtime/test/a4p7-descendant-change-proposal-valid.test.ts)
· 2 legs · 22 `expect(` sites.

`describe`: `a4p7 §7.6 row 6 — same canonical subtree root, descendants changed (spec §6.3 / §21.3, ADR §8)`

| # | `it` (verbatim) | The document line it is derived from |
| --- | --- | --- |
| L1 | `a descendant the seam newly reaches that moves NO approved rise leaves the allowed proposal VALID: same case, byte-identical frozen fingerprint, one commit` | spec §6.3 (drift table): *"If descendants change while root identity stays stable: proposal remains valid"* / *"containment is recomputed live"* · spec §6.2: *"A subtree proposal does not bind to the then-current descendants."* · spec §21.3: *"same root + changed descendants -> proposal remains valid"* · ADR §8: *"A subtree matcher freezes its canonical root identity, not the current set of descendants"*. |
| L2 | `the boundary: the SAME descendant arriving where it moves an approved rise answers mutation-stale with ZERO writes (one variable separates the halves)` | spec §6.3, the complementary row of the same table (approved-rise drift → stale) — the half already pinned by `a4p5-permission-mutation-inline-commit > drift after approval -> mutation-stale with ZERO writes`. Pinned here as the **boundary of the validity claim**, differing from L1 in exactly one variable. |

**Why the boundary leg belongs in the same file:** the finding was that only one half of the
frozen-binding boundary had a leg. A file that asserts only "descendant change is harmless" would
be compatible with a product that froze nothing at all. L1/L2 hold the world fixed except whether
the changed descendant set moves an approved rise, and the verdicts differ with it: `changed: true`
with byte-identical frozen fingerprints (`/^mutfp-[0-9a-f]{64}$/`) and one commit, versus
`PERMISSION_MUTATION_TERMINAL_OUTCOMES.MUTATION_STALE` with zero writes and the approval case still
`decided`.

**Counterfactual:** `bind-then-current-descendants` — the forbidden implementation the spec names
by name, installed in the product (the approved-rise digest becomes a digest of every cell the
mutation region reaches with its before/after answers) across
`packages/runtime/governance/{permission-mutation,permission-approval,service}.ts`. It reddens
**exactly 1 of 76** legs: this lane's L1, at
`a4p7-descendant-change-proposal-valid.test.ts:345`. Transcript:
[`transcripts/mutant-row6-descendant-census.txt`](transcripts/mutant-row6-descendant-census.txt).

---

## Row 17 — the governance-warning family reconstructs after restart

File: [`packages/runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts`](../../../../packages/runtime/test/a4p7-governance-warning-restart-reconstruction.test.ts)
· 3 legs · 47 `expect(` sites.

`describe`: `a4p7 §7.6 row 17 — the governance-warning family reconstructs after restart (spec §21.10, §16, §15.4/§15.5)`

| # | `it` (verbatim) | The document line it is derived from |
| --- | --- | --- |
| L1 | `a warning observed and acknowledged on a real durable ledger is reproduced by a store opened over the same directory: same warning identity and fingerprint, same folded count/time, same acknowledgement — from rows that were never rewritten` | spec §21.10 (Persistence/restart), the line with no leg: *"**warning acknowledgement reconstructs**"* · spec §16: *"Governance warnings use a separate durable source but reuse the fingerprinted-acknowledgement design pattern."* · spec §15.5: acknowledgement carries *"warning id / fingerprint; acknowledgedBy; acknowledgedAt; optional note"* and *"affects reminder state only. It never modifies authority."* |
| L2 | `the reconstructed acknowledgement is bound to its fingerprint: after the restart, drift in the bound documents mints a NEW un-acknowledged warning that re-blocks` | spec §15.4: the fingerprint binds kind, Blueprint `contentHash`, the normalized Leader envelope and the normalized Team Hard envelope — so a reconstructed ack is bound to THAT identity and nothing broader. |
| L3 | `the production projection reconstructs over a ledger that carries the warning family (the a4pr0a composition law applies to these fact types too)` | The a4pr0a composition law (`a4pr0-proposal-*`): a fact type that is written must be classifiable by the projection, or one warning breaks `team.getProjection` for that Team permanently. spec §16's *"separate durable source"* only holds if the shared read path survives it. |

**What "restart" means here, and why three things must move.** The unit restart model this repo
uses: `domain.close()`, a NEW `FileStorageSeam` and a NEW `TeamDomain` over the **same directory**
(`restartP6T1World`), a NEW service instance — **and** a fresh evaluation of the service module
(`vi.resetModules()` + re-import, asserted not to be the same factory). The third step is not
decoration: this lane's own counterfactual passed this leg until the step was added, because a
module-level `Map` survived the restart (see
[`FINDINGS.md`](FINDINGS.md) §3). After all three, the only thing the second store knows is what
the first one put on disk. The raw append-only rows are re-read after the reopen and compared
byte-identical (`toEqual(rawBefore)`), so the reconstruction is shown to come from rows that were
never rewritten.

**Counterfactual:** `acknowledgement-lives-in-the-heap` — the ack is still **appended durably**
through the production writer, but `fold()` reads it from a module-level `Map` instead of from
those rows. Under it the three legs here redden **3/3** while the whole PR6 governance-warning
family (6 files, **144 legs**) stays **green**. Transcript:
[`transcripts/mutant-row17-acknowledgement-lives-in-the-heap.txt`](transcripts/mutant-row17-acknowledgement-lives-in-the-heap.txt).
