# §7.3 / §7.5 — FINDINGS (flip lane, step 3 of 3)

Outcome: **PARTIAL — landed nothing.** The narrowing was measured to completion, migrated to
zero regressions, and then withheld because §7.5 bullet 2 (its required consequence) cannot be
landed at the quality the safety case demands inside this lane. The full work is preserved as
[`73-flip-full-migration.patch`](73-flip-full-migration.patch) (35 files, +1248/−469) and must be
applied together with §7.5, not before it.

---

## 1. The §7.5 deletion: measured, not guessed

Green baseline (this tree, narrowing + migration applied, §7.5 NOT applied):
`packages/{runtime,domain,legacy,storage,contracts}/test` → **18 failed / 5022 passed (5040)**,
8 files. Same command at base `834edfc5` (my changes `git stash`ed): **20 failed**. My tree's reds
are a strict subset — `comm -13` shows **zero legs red in my tree and green at base**.
Identities: [`s75-baseline-reds.txt`](s75-baseline-reds.txt).

After deleting `leaderEnvelopeCoverage` and dropping the coverage judge from
`authorizeLeaderPermissionMutation`: **59 failed**, delta
**+41 legs / 9 files** ([`s75-deletion-delta.txt`](s75-deletion-delta.txt),
[`s75-delta-by-file.txt`](s75-delta-by-file.txt)); 2 of the 41 are the declared `p6t1-parallel`
flakes ⇒ **39 real**.

### The two conditions that decide whether the deletion is safe

The ceiling gate at `service.ts:1213` runs **only if** a ceiling context exists. Two independent
routes can deny it one:

| # | Route | Status after §7.3 |
|---|---|---|
| (i) | reader returns `undefined` for this target — `permission-plane.ts:969-972`, gated on `schemaVersion === 1 \|\| 2` | **CLOSED by the narrowing.** Unreachable: no document reaches those digits. This is exactly why §7.5 was ordered after §7.3, and it is the reason the ordering is right. |
| (ii) | the `authorityCeiling` **port is absent on the lane** — `root.ts:2899` spreads it in only when `permissionAuthorityCeiling !== undefined` | **NOT closed by §7.3.** Closed in the shipped product by `packages/runtime/src/plugin/host.ts:2703`, which injects `createAuthorityCeilingReader({ facts })` unconditionally. Still open for any root-direct lane built without the port — which is what most of the 39 legs are. |

So the deletion is **legal for the shipped composition** and **not legal for the test corpus as it
stands**. Proven, not argued — the failure shapes split cleanly:

- **Identity moved (safe class).** `a4p7-carrier-width-under-ceiling` leg 1 — the file written to
  hand this law over — now refuses with `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` where it
  asserted `PERMISSION_ENVELOPE_EXPANSION_DENIED`, and its `expect(await w.listRules()).toBeUndefined()`
  zero-write witness still holds. The ceiling really does own width, at the width the mutation
  **claims**, not the cell it rises in. Prerequisite (1) is satisfied.
- **No refusal at all (unsafe-if-unfixed class).** ~23 of 39 legs fail as `expected false to be
  true` / `expected undefined to be 'PERMISSION_ENVELOPE_EXPANSION_DENIED'` / `expected function to
  throw an error, but it didn't`. In those worlds the mutation would **commit**. Their own fixture
  comments already say why: *"the only production producer of `permissionAuthorityCeiling` is the
  plugin host, so no ceiling reader is ever consulted here"* (`p6t4-helpers.ts:79`,
  `p6t2-helpers.ts:82`, `p6t3-helpers.ts:70`, `exec-contract-dual-gate.test.ts:223`,
  `multi-mcp-wiring.test.ts:181`, `model-inspect-config.test.ts:52`,
  `f15-mcp-live-loss-characterization.test.ts:102`, `p8s3b-result-effects.test.ts:418`).
- **Ordering class (needs judgement, not re-pinning).** `a4p7-ceiling-no-context-refusal` leg 9 —
  *"a Leader rise Alpha.3 itself refuses keeps its OWN refusal identity"* — now answers
  `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` instead of `EXPANSION_DENIED`. That leg is the guard
  against an unavailable read wearing an authorization label; with the coverage arm gone the two
  arms no longer compete, so the leg's premise needs re-derivation rather than a new expected code.
- **Refusal-shape class.** `a3p4-pr4` `NEGATIVE: an envelope region WITHOUT coverage` fails inside
  the assertion (`expect(undefined).toContain(...)`): the refusal still happens but
  `details.problem` is gone. Re-pinning without reading the new payload would be laundering.

### Why I stopped instead of pushing through

Re-homing 39 legs means, per leg, choosing between "re-pin to the ceiling's code", "wire a ceiling
reader into a fixture world that never had one", and "this leg's subject no longer exists". The
second option changes verdicts by construction, and a leg that passes because its fixture now
carries a document that decides the question in its favour is exactly the silent re-dressing this
phase has been built to catch. Doing 39 of those in the remaining budget would produce a green
suite with weaker coverage than the red one I started from. The narrowing's rule is all-or-nothing,
so the narrowing goes too.

**What would close it** (for the follow-up lane, in the order I would attempt it):

1. Wire `authorityCeiling: createAuthorityCeilingReader({ facts })` into the root-direct lane
   builders (`p6t2/p6t3/p6t4-helpers`, `exec-contract-dual-gate`, `multi-mcp-wiring`,
   `model-inspect-config`, `f15-…`, `p8s3b-result-effects`) so the test lane matches the host.
   Then re-measure: the ~23 "no refusal" legs should split into "ceiling refuses" (safe) and
   "ceiling commits" (a real gap, which must be reported, not re-pinned).
2. Re-pin the identity-moved legs to `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` **with the
   zero-write witness kept next to the code assertion**, never the code alone.
3. Re-derive `a4p7-ceiling-no-context-refusal` leg 9 and `a3p3-revoke-reveal-semantics`'s
   "the extracted classifier and the Leader judgement never disagree" from the new one-owner law.
4. `a3p3-permission-mutation-authority` and `a3p3-revoke-reveal-semantics` are largely **pure-unit**
   tests of the deleted judge (25 of 39). Their subject is gone; they belong on the ceiling surface
   (`authority-ceiling.test.ts`), not re-pinned in place.
5. Mutation table last, on the green tree — see §5 for the rows I had started.

---

## 2. Load-bearing discovery: `rules: []` is not a neutral zero

`expansionCeiling` (`packages/runtime/governance/authority-ceiling.ts`) is explicit that on the
**expansion plane** an *absent* **or** *declared-empty* `teamHardEnvelope` contributes
`CEILING_NO_AUTHORITY`. So `teamHardEnvelope: { rules: [] }` is **not** a neutral migration token
for a fixture whose legs expect a Leader expansion to commit:

- Pre-flip those documents were v1 → `permission-plane.ts:969-972` returned `undefined` → **no
  ceiling was consulted at all**.
- At v3 the ceiling is live, and an empty hard document answers *no authority* — a refusal the
  same bytes never produced.

**The migration rule this forces:** where a leg's expected outcome depends on an expansion being
permitted, the hard ceiling must **cover the same scope at `maximumEffect: allow`** — strictly
wider than the mutation carrier. Mirroring the carrier exactly is not enough, and a
wider-than-needed ceiling is *not* a weakened witness as long as the asserted `EXPANSION_DENIED`
still has only one possible source in the document. `hardYamlCeil()` in
`a3p4-pr4-production-entry-regression` (10 sites) exists for this reason.
Where the honest zero *is* correct — listed-and-never-granted witnesses, the legacy adapter, the
skill's taught example — it is used deliberately, and the reason is written at the site.

## 3. Cause-attribution risk for refusal-asserting legs

Any leg asserting a refusal whose fixture now carries `teamHardEnvelope: { rules: [] }` can be
passing **for the wrong document**. The ceiling refusal and the carrier refusal look identical from
outside. Two counter-controls were added where I touched such a leg (same bytes promoted to v3 must
parse; the hard ceiling widened must let the same rise through) — this is the pattern to require of
the §7.5 follow-up too.

## 4. Dead branches the narrowing creates (reported, not touched)

Production is not this lane's to edit, so these are findings:

- `permission-plane.ts:738` `if (document === undefined) return { status: 'absent' }` has **no
  reachable trigger** at v3: both envelopes are required fields, so a parsed document always has
  them. Its companion comment at `authority-ceiling.ts:202` ("a v1/v2 Team states
  `{ status: 'absent' }`") is now stale.
- `permission-mutation.ts`'s `unmet` arm of `authorizeLeaderPermissionMutation` becomes
  unreachable the moment the coverage judge is deleted (see §1) — a live refusal with no route to
  it.
- The frozen closed **v1 field set** is unreachable through any document; `t2-blueprint-v2-requirements`
  and `blueprint-v1-frozen-resume` now prove the version gate fires *before* it, and assert that the
  refusal does **not** name the field, so a regression behind the gate cannot hide.
- `permission-plane.ts:969-972` (route (i) above) is itself now dead code with a comment claiming
  it is the live pre-v3 escape.

## 5. Instruments that lied to me, and how each was caught

1. **`npx vitest run --reporter=basic`** — no such reporter in vitest 4; 7 packages exited 1 having
   registered nothing. Caught by reading the exit codes instead of the summary line.
2. **Running the testkit suite from `packages/testkit`** reddened 13 fence-wrapper legs at base
   because the fence refuses a non-toplevel cwd (exit 2). It lied *fail-closed on purpose*; caught
   by running the same command from the toplevel and comparing.
3. **The identity diff itself — the one that mattered.** My sweep diffed *test identities*
   (NEW/RESOLVED). An identity diff **cannot see a leg that already existed flipping pass→red**. It
   reported "residual ~25" while `t1-capability-schema`'s 9 legs were already red. Caught only
   because the §7.5 baseline run printed a red count. Corrected method: red-identity diff against a
   `git stash`ed base run, reported in §1. The earlier NEW/RESOLVED numbers measure *registration*,
   never *verdict*, and should not be read as a safety signal.
4. **`a4p1-blueprint-v3-governance` legs V16/V17 were green with zero assertions** — guarded by
   `if (!v1.ok || !v2.ok) return`, which goes vacuous the instant a fixture stops parsing. They had
   been lying before the flip touched them. Caught by reading the guard instead of the status;
   fixed in the patch by removing the guard and stating what the leg can still reach.
5. **A docstring that described a derivation the code could not reach**:
   `a4p7-v8-catalog-migration-state`'s header claimed both `SUPPORTED_…` and
   `RETIRED_…` sets while only importing the first — because the retired arm was unreachable while
   the bridge stood. The flip made the claim testable and the missing import threw immediately.
6. **Backtick interpolation, twice**: searching for `` `${V1_DOCUMENT_VERSION}` `` misses because the
   literal is `` `schemaVersion: ${V1…}` ``. Assert-before-write meant nothing was clobbered.
7. **Duplicate YAML key**: an unconditional `permissionMutationEnvelope` plus a configured carrier
   emitted the key twice; the second shadowed the first and reddened an unrelated store-fault leg
   with `MALFORMED_DTO`. Caught by reading the emitted document text, not the diff.
8. **A silent re-dressing caught rather than laundered**: `a3p4-r4-authority-binding` C1 went red on
   `{status:'declared'}` because my new builder default turned its *absence* scenario into
   declared-empty. The red was my fixture lying about the leg's subject; inverted honestly.
   `R4-absent` did the opposite — it **passed** while its title had become false; retitled and
   extended.
9. **`grep -c` exits 1 on a true zero and `diff` exits 1 on real output.** Twice I read those as
   failures. They are values.
10. My earlier SCOPE said "29 collection deaths"; the count was **28**. Corrected before commit.

## 6. Residual risks I am leaving on the table

- **The fence's non-default `.mjs` blind spot.** After the flip, a version literal in a non-default
  `.mjs` fixture that no test parses is invisible to the fence: the fence classifies by parsing, and
  unparsed bytes carry no verdict. Tolerable *today* only because the shipped default artifact is
  pinned by a permanent instrument (below) and the two `.mjs` carriers found were promoted. Closes
  by extending the wrapper's scope leg to parse every `.mjs` fixture it scans, which needs a
  parse-and-ignore-failure contract first.
- `.agents/skills/team-blueprint-authoring/SKILL.md:89` still says supported versions are
  "**1** … and **2**". Pre-existing staleness, left because the instruction was to change only the
  taught example and keep every other instruction identical. It is now wrong in a way it wasn't
  before, and someone who owns the skill should fix it in the same breath as this flip.
- `t1-capability-schema`'s 9 legs are red at base (`$.metadata must be a plain object, got null`)
  and red after (`unsupported blueprint schema version 1`). Same identities, different cause: the
  version gate now *hides* the metadata bug. Not mine to fix, but the metadata bug is real and is
  now harder to see.
- `a4p7-merge-gate`'s 1 red is base debt requiring `pnpm build`; reported by identity, not absorbed.

## 7. Numbers this lane will stand behind

- Population: `packages/{runtime,domain,legacy,storage,contracts}/test` = 415 files / 5040 legs, 12.4s.
- Base reds: 20 (2 of them `p6t1-parallel` flakes). My tree: 18. New reds from the narrowing: **0**.
- New reds from §7.5's deletion: **41** (39 real + 2 flakes), across 9 files.
- Migration reach: 35 files, +1248/−469; 28 module-scope collection deaths cleared; the live default
  artifact in `t12a-live-bridge.mjs` and the shipped `p5t5-helpers.ts` promoted; the one production
  emit site (`packages/legacy/teammates-adapter.ts:542`) moved to the supported version with both
  authority documents at the honest zero.
- Refusal identities measured, not remembered: retired version → `SCHEMA_VERSION_MISMATCH`
  (`unsupported blueprint schema version 1; this build supports [3]`); v3 missing a required
  envelope → `MALFORMED_DTO` naming the field (`validate.ts:157`); the plugin-boundary names
  `BLUEPRINT_VERSION_REFUSAL_CODES.*` stay distinct (A1-21).

## 8. Why the bundle was split: measured risk DIRECTION, not convenience

This PR is patch items (1) + (2). **Item (3) — deleting `leaderEnvelopeCoverage`
from the mutation gate — is deliberately NOT in it**, and it is not in it for a
reason that has a number attached.

`leaderEnvelopeCoverage` is a judge argument at
`packages/runtime/governance/permission-mutation.ts:1390`. Deleting it stops the
gate asking "does the leader's own carrier cover this region?" and therefore
moves refusals **outward, onto the ceiling** or, when the ceiling says nothing,
**away entirely**. Measured on the 5040-leg population (raws:
`s75-baseline-reds.txt`, `s75-post-deletion-reds.txt`, delta
`s75-deletion-delta.txt`, per-file `s75-delta-by-file.txt`):

| quantity | value |
| --- | --- |
| legs that changed state | **+41 legs across 9 files** |
| of which real | 39 (2 are the `p6t1-parallel` flakes) |
| legs that moved to a *different* refusal identity, healthily | 1 (`PERMISSION_AUTHORITY_CEILING_INSUFFICIENT`) |
| legs that stopped refusing at all ("expected function to throw an error, but it didn't") | ~23 |

So the direction of item (3) is **LOOSENING**: 39 refusal assertions become
commits, and the majority of them do not turn into a *different* refusal — they
turn into a silent success. That is the one direction this cutover must not
bundle: the version narrowing's whole safety claim is that a build can no longer
accept a document whose authority documents it cannot reason about, and a
change that deletes a check in the same commit makes "which refusal did the
narrowing cause, and which did the deleted check cause" unanswerable after the
fact.

Keeping `leaderEnvelopeCoverage` while the narrowing lands is the **strict**
direction: the product may over-refuse, never over-grant, and every refusal
identity in the corpus keeps its original cause. The flip therefore lands
without item (3); the patch that would have done it is preserved, unapplied, at
`73-flip-item3-permission-mutation-DELETED.patch` so the measurement travels
with the proposal rather than being re-derived by whoever picks it up.

The same rule decided the two smaller cuts. The `a4p1` V16/V17 legs were left
untouched apart from a NOTE above V16 (they are green with **zero assertions**
— a pre-existing condition, and "fixing" them here would have made a
pre-existing leg flip pass→red inside a narrowing PR, which the identity diff
cannot see). And `packages/runtime/src/plugin/host.ts` / `root.ts` were not
touched at all, although `host.ts:2703` is the only production site that makes
the ceiling port non-absent and nothing in the corpus pins it.

## 9. Question (i): does the shipped composition's team ever reach the ceiling, and is the empty hard envelope a silent capability downgrade?

What the shipped document is (measured, now pinned by
`packages/runtime/test/a4p7-shipped-composition-blueprint.test.ts`): the repo-root
`cordis.patch.yml` embeds a `blueprintSource:` block; parsed through the real
`parseBlueprint` it is a v3 document, `contentHash`
`sha256:9ee498574d6651ab131a87b50fd435993fc7647252466da1608f7d542384152f`,
declaring `permissionMutationEnvelope: { rules: [] }` **and**
`teamHardEnvelope: { rules: [] }`. Before this PR **no test in the repo parsed
it** — the fence classifies its text, never its meaning.

Whether the team "reaches the ceiling" is the question with the consequence:

- On the expansion plane, an **absent** and a **declared-empty**
  `teamHardEnvelope` answer the same way — `CEILING_NO_AUTHORITY` — while a v1
  document consulted **no ceiling at all**. That equivalence is pinned by the
  merged, green `a4p7-carrier-width-under-ceiling.test.ts` (a hard document
  silent about a scope answers `{ status: 'insufficient', plane: 'expansion',
  ceiling: 'no-authority' }`).
- So for the shipped row: with both documents empty, no member can be authorised
  above the static lanes, by design. The shipped file says exactly this in its
  own comment block ("This zero is inert in exactly one world..."), and the
  world it names is one where the team never asks to expand.
- **The downgrade risk is therefore real but conditional**: it bites only if the
  plan intends the shipped team to expand *within its own scope*. If it does,
  the honest migration for the shipped row is a hard ceiling that **covers that
  scope at `maximumEffect: allow`** — strictly wider than the carrier, not equal
  to it — because the carrier staying `[]` while the ceiling covers the scope is
  what lets the leader authorise without widening itself.

What this lane did **not** do: pin today's answer in a test. The instrument
asserts the document's identity and its refusal behaviour under a retired stamp;
the "is zero intended or not" verdict belongs to the owner of the shipped
design, and a test frozen now would convert an open product question into a
regression. Flagged for the pin lane: `packages/runtime/src/plugin/host.ts:2703`
is the only thing making the ceiling port non-absent in production, and the
corpus contains no leg that would notice it disappearing.

## 10. Question (ii): the legs whose `EXPANSION_DENIED` had two possible document causes

Two distinct identities matched a naive grep, and conflating them would have
produced a wrong list. Exact counts in `packages/**/test`:

- `PERMISSION_ENVELOPE_EXPANSION_DENIED` — the **carrier-width law** (a mutation
  wider than the leader's carrier). 6 legs: `a3p3-revoke-reveal-semantics` ×2,
  `a3p4-pr4-production-entry-regression` ×1, `a3p4-pr7-entry-exec-contract-regression` ×1,
  `a4p7-carrier-width-under-ceiling` ×1, `a4p7-ceiling-no-context-refusal` ×2.
  These are not the ceiling and are not shape-ambiguous: they are answered by the
  carrier, and the fixtures declare the carrier explicitly.
- bare **`EXPANSION_DENIED`** — the authority-ceiling plane. **All 8 legs are in
  one file**, and all 8 are named:

  1. `a3p4-pr4-production-entry-regression.test.ts:399` — NEGATIVE: an envelope region WITHOUT coverage refuses typed EXPANSION_DENIED and writes nothing
  2. `:1246` — a persisted overlay DENY beats the template ALLOW through the real glue pipeline
  3. `:1348` — R4-exec — a configured bash-fingerprint carrier reaches ALLOW through the real boot
  4. `:1385` — R4-ceiling — an ASK carrier ceiling refuses the ALLOW grant and accepts the ASK grant
  5. `:1529` — R4-absent (§7.3) — a DECLARED-EMPTY carrier refuses the grant round-3 used to derive
  6. `:1592` — R4-anchor — a RELATIVE carrier rule canonicalizes at the TARGET member workspace and grants
  7. `:1653` — R4-recover — a provider fault at warm-up is LOUD-but-continue; expansions refuse typed meanwhile
  8. `:2165` — R5-ws — FIX-3 CWD source-of-truth: a NON-BOOT Team B canonicalizes at its own default

Why those 8 were the ambiguous ones: pre-flip their fixture document carried no
`teamHardEnvelope` (the file is one of the three this PR's patch migrated, and
one of the two `DEFERRALS` rows deleted). Pre-flip the ceiling could reach them
through `permission-plane.ts`'s `document === undefined → 'absent'` branch, which
produces the *same* `CEILING_NO_AUTHORITY` identity as a declared-empty
envelope — so a green `EXPANSION_DENIED` there did not tell the reader which
document shape caused it. Post-flip the ambiguity is gone for two independent
reasons: a v3 document must declare the envelope (no implicit default), and the
`'absent'` branch is now unreachable dead code (`permission-plane.ts:738`,
reported in §4). Nothing was fixed here beyond the migration this PR already
carried; the list is the deliverable.

## 11. Instruments that lied, round 2 (all on the landing tree)

- **A `DEFERRALS` row carrying a retired stamp made the fence's own author
  dirty.** I wrote the new rows with `toContain('schemaVersion: 1')` in their
  prose; the fence scanned `packages/testkit/**` like any other path and the
  wrapper's own no-self-exemption leg went red (`the fence needs no exemption
  for its own author`). The instrument was right and my text was wrong: the fix
  is the file, never the list. The leg now *composes* its fixture stamp from
  parts for the same reason, and says so in a comment.
- **`classifyText` silence is not "clean".** Four different shapes I tried
  returned all-empty verdicts before one returned `dirty@1`. The cause was not
  the shape and not the extension: the classifier returns nothing at all unless
  the text contains a document-shaped key pair. An assertion written as "expect
  0 verdicts" would have passed against a classifier that never read the file.
- **An apostrophe is a syntax error in a single-quoted TS string, twice.**
  `§7.3's migration` inside a `DEFERRALS` row, and "the shipped composition's
  embedded blueprint" inside the p4t6 leg **title** — both produced a
  whole-file `PARSE_ERROR` with a byte offset and `Tests no tests`, i.e. a
  collection death masquerading as an empty suite. Same class as the earlier
  backtick-interpolation trap.
- **A stale re-pin is a silent narrowing of the claim.** The advisory pin at
  `a4p7-v3-cutover-acceptance:584` pointed at the very leg §7.3 inverted; after
  the inversion the site was at `:611`. Deleting the pin would have been the
  quiet option; it is re-pinned with the reason written next to it.
- **`grep -c` on `sha256:[0-9a-f]+` over the whole repo matched lint JSON and
  the DSH home tree**, and looked like evidence. Restricted to `git grep` over
  pathspecs, the census is 5 candidate files and 1 unrelated literal.
