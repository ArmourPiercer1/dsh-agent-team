# FINDINGS — A4-PR7 §7.6 gap lane (`feat/a4-76-scenario-gaps`)

**Verdict first.** All three legs are **GREEN on the shipped product**, and each one **reddens under a
construction-level counterfactual mutant** installed in the product source. On these three laws the
product is honouring the documents: there is **no product defect to hand back** in the sense of a
red I had to engineer away. I changed **no production source** — none of the three laws needed a
product change, and the phase's core patch budget is zero anyway. What this lane does hand back is
**four findings about the evidence**, of which the first is the one the brief was looking for.

Base `master @ 16022365`; the tree is clean of mutants (every mutated file restored to its
base SHA-256, verified in each transcript).

| # | Finding | Class | Status |
| --- | --- | --- | --- |
| 1 | The PR6 governance-warning family's durability claims are **not verifiable in place**: 144 legs, no second store, `FakeLedger` in-memory array. | Evidence gap in a shipped suite | Demonstrated by construction; **not** a product defect. Fix is out of this lane's ownership. |
| 2 | A "restart" leg that keeps the process's module registry can pass **on heap state**. This lane's own Row-17 leg did exactly that until it was strengthened. | Methodological, applies to every restart leg | Fixed in this lane; recorded in the restart helper and the transcript. |
| 3 | Row 5's `startup-census` counterfactual is **not surgical** — it reddens 2 pre-existing legs too. | About the mutant, not the product | Disclosed, and answered by a second, surgical mutant. |
| 4 | Row 5's *"no startup-time descendant enumeration"* is **not assertable as written**. | Law-vs-instrument | The closest honest assertion is stated and implemented (4 behavioural arms + 1 scoped structural absence). |

---

## 1. The governance-warning family cannot see a restart (Row 17, `7-6-closure` F-17)

`7-6-closure/SCENARIOS.md` row 17: *"§21.10's other entries have restart legs; the
governance-warning family has no restart leg."* Verified independently before writing: across
`a4p6-governance-warning`, `a4p6-governance-warning-service`,
`a4p6-governance-warning-host-adapter`, `a4p6-intervention-aggregation` (plus
`a4p6-start-gate-entrances` and `a4p7-v3-cutover-acceptance`, which drive the same lane) there is
**no second store and no reopened handle**; the one test named "re-opens" is the in-memory
`ensureRootLive` re-entry — the same process reading the same object. Every one of those suites
drives the service through a `FakeLedger`, an in-memory array.

**The finding, demonstrated rather than asserted.** Under the mutant
`acknowledgement-lives-in-the-heap` — the acknowledgement is still **appended durably through the
production writer**, but `fold()` reads it back from a module-level `Map` instead of from those rows
— the whole family stays **green, 144 legs of 144**
([`transcripts/mutant-row17-acknowledgement-lives-in-the-heap.txt`](transcripts/mutant-row17-acknowledgement-lives-in-the-heap.txt),
section 2). A suite that cannot distinguish "the acknowledgement is in the ledger" from "the
acknowledgement is in this process's heap" is not evidence about spec §21.10's *"warning
acknowledgement reconstructs"*, no matter how many legs it has. The new leg reddens **3/3** under
the same mutant.

**Why this is not a product defect:** the shipped product *does* reconstruct. Over a real
`FileStorageSeam` + `TeamDomain` ledger, with the family written through the production writer
(`commitDurableFact`) and read through the production reader shape (a filter over
`repositories.ledger.list()`), a store opened over the same directory reproduces the warning
identity, the fingerprint, the folded observation count and first/last observation times, **and the
acknowledgement** (`acknowledgedBy` / `acknowledgedAt` / `acknowledgementNote`), with the raw
append-only rows byte-identical across the reopen — and the ack stays bound to its fingerprint
(§15.4): after the restart, document drift mints a NEW un-acknowledged warning that re-blocks.

**What this lane did NOT do:** I did not touch the PR6 files. They are another lane's ownership,
and rewriting 144 legs to a durable fixture is not a §7.6 gap-lane change. The two options for the
parent, in preference order: (a) give the family a durable-world fixture (the fixture in
`a4p7-governance-warning-restart-reconstruction.test.ts` — `wireWarningStore` /
`restartWarningStore` — is self-contained and copyable), or (b) state in those suites' headers that
they assert in-process semantics only. Today neither statement is in the tree.

## 2. A restart leg can pass on heap state (methodological, found the hard way)

The Row-17 leg's **first version passed under the mutant above**. Its restart moved the store handle
and the service instance but stayed in the same process, so the mutant's module-level `Map` was
still populated and the leg read its acknowledgement out of the heap. That is the same trap that
makes the PR6 family blind, one level up: I nearly shipped a "restart" leg that never left the
process.

The strengthened restart moves three things, each necessary: the **handle** (`domain.close()` then
a new `FileStorageSeam` + new `TeamDomain` over the same directory), the **wiring** (a new service
instance), and the **process** (`vi.resetModules()` + re-import of the service module, with
`expect(fresh.createGovernanceWarningService).not.toBe(createGovernanceWarningService)` so the
reset cannot silently stop mattering). No assertion was weakened at any point; the file's restart
helper documents this in place, and the transcript records the survival rather than only the
capture.

**How far this generalises, measured:** a scoped grep for module-level mutable state across
production sources in the runtime package roots (`packages/runtime/*/`, excluding `test/` and
`dist/`, pattern `^const X = new Map<` / `^const X = new Set<` / `^let lowercase`) returns **0
hits**; the two `new Map` sites in `packages/runtime/governance-warning/service.ts`
(lines 191, 266) are function-local. So today the product gives any restart leg no heap state to
lean on, and the risk is latent, not live — but it is latent for every lane that writes a restart
leg, and a lane that adds module-level state would find only legs like the one I first wrote
already in place to notice.

## 3. Row 5's census counterfactual is not surgical (disclosed)

The obvious mutant for *"no startup-time descendant enumeration"* — install a
`readdirSync(root, {recursive:true})` census at first sight and answer coverage by existence —
reddens all three new legs, **and also 2 pre-existing legs**, verbatim:
`packages/runtime/test/a3p4-production-permission-plane.test.ts > P2 / P3 / P4 — the configured
exact / subtree / exec paths are live > a subtree grant is judged by the injected predicate: inside
allow, outside still default` and
`packages/runtime/test/a3p4-pr4-decision-routing-regression.test.ts > R2 — an overlay ASK over a
static deny enters APPROVAL through the real adapter (BLOCK-2) > subtree: an overlay ASK subtree
rule over the static default deny reaches approval (containment judged per decision)`
Those worlds ask about a path they never create on disk, and a census answers by existence — so
that mutant is a sledgehammer that also disproves a claim those legs never made. It is reported as
what it is instead of being trimmed until it looks clean. The surgical answer is the second mutant,
`first-sight-verdict-memo` (cache the verdict per logical key, replay it forever): it reddens
**exactly** the prohibition leg — arm (d), the retargeted descendant answering `allow` from the
replayed verdict instead of `deny` — while **131 sibling legs** across the 6 suites that drive the
same boundary stay green.

## 4. The prohibition is not assertable as written, and what was asserted instead

The brief asked for this in terms. *"Authority evaluation must not materialize a static set of
covered descendants"* (spec §6.1) is a claim about an internal representation: **no leg can observe
a set that is never consulted**, and grepping the source for a variable name would pin a spelling,
not a law. The closest honest assertion is the behavioural signature such a set **cannot** pass;
Row 5 leg 2 asserts four of them (zero containment work through startup; per-ask consultation of
the exact pair at a cost independent of the descendant population; a durable overlay head that is
byte-identical after new descendants are covered; a verdict that follows the canonical relation
when a real `junction` is retargeted to a real `symlink`), and leg 3 adds the strongest absence
assertion available — a walk of the shipped authority lane over four named directories, requiring
the 7 named authority modules to have been seen and no directory-listing primitive to appear in
any of them. All of it is in the file's header, in the same words, next to the quoted law.

## 5. What the merge gate caught in this lane's own work (it worked; here is the record)

The first run of `packages/testkit/test/a4p7-merge-gate.test.ts` on this tree read **27/29**, and
both red legs were **my own files**:

- `the static legs > every workspace package that declares a typecheck script typechecks` —
  **21 TypeScript errors**, all in `a4p7-governance-warning-restart-reconstruction.test.ts`:
  `P6T1World` imported from the helper that only declares it locally, a required `hardStatus` field
  missing from the bound-docs literal, and 18 reads of `warningId` / `interventionId` /
  `acknowledgement` off a **closed union** (`GovernanceStartOutcome` is
  `open | warning-required | corrupt | migration-required`) without narrowing.
- `the static legs > lint closes as an identity diff against the named baseline, not against a
  count` — **4 new identities**, all mine: two `@typescript-eslint/no-unused-vars`, one
  `@typescript-eslint/no-explicit-any`, and a fourth that is the most instructive of the four: a
  stale `eslint-disable-next-line` two lines *above* the construct it was meant to cover. ESLint
  reports an unused directive with `ruleId: null`, and `scripts/lint-identities.mjs:107` renders a
  null ruleId as `(parse-fatal)`, so a misplaced comment was classified as a parse failure.

Both were fixed in **my** files; the accepted lint baseline and the merge gate were **not**
touched. No assertion changed: the union reads moved into two helpers
(`requireBlocked`, `requireAck`) that **assert the arm and then narrow**, so the leg still fails if
the gate answers a different arm — the narrowing is for the checker, the assertion stays the leg's.

**Why this belongs in the findings:** every one of those 21 type errors and 4 lint identities sat
behind a suite that ran **green**. Vitest transpiles without type-checking, and the nine-root
census does not run lint. A lane that had only run its own three legs would have handed back a tree
that breaks two §7.6 merge legs — which is precisely the failure mode the merge gate was written to
make impossible, and the reason the battery in `FINAL-BATTERY.txt` is run against the *committed*
tree rather than inferred from the leg runs. After the fixes: merge gate **29/29**, `pnpm
--filter @dsh-agent-team/runtime typecheck` clean, `npx eslint` clean on all four touched files.

## Not findings, recorded so the reader does not have to ask

- **No production source changed.** The only existing file touched is
  `packages/testkit/test/p4t6-session-event-scan.test.ts`, extended by the new named list
  `SCANNED_PATHS_A476GAPS` (3 paths) and its own tie `expect(SCANNED_PATHS_A476GAPS.length).toBe(1039 - 1036)`,
  both endpoints measured: with the three files on disk and the entry stripped the run reads
  `expected 1039 to be 1036`
  ([`scratch/captures/p4t6-pre-extend-red.txt`](scratch/captures/p4t6-pre-extend-red.txt)). The
  lane's `expect(` count moves 40 → 41: it gains an assertion and loses none.
- **No merge-gate file touched.** `packages/testkit/test/a4p7-merge-gate.test.ts` is untouched and
  reads 29/29 (see `FINAL-BATTERY.txt`).
- **Green-on-first-honest-write is treated as suspicion, not success.** All three lanes are
  accompanied by a mutant run, a restore verification and the sibling suites that drive the same
  boundary; the only self-inflicted reds (two, in Row 5's first run — a `provenance.rule.resource`
  matcher object asserted as rendered text, and a module walk with non-existent file names) were
  harness errors fixed against the document, not assertions relaxed.
- **Fresh-worktree prerequisite (F5) honoured:** `pnpm install --store-dir …` then `pnpm setup` ran
  before any census, because `packages/client/dist` is gitignored and the census's client root is
  otherwise silently smaller. Logs: [`scratch/pnpm-install.log`](scratch/pnpm-install.log),
  [`scratch/pnpm-setup.log`](scratch/pnpm-setup.log).
