# 7-3-cordis — cordis.patch.yml's embedded Team design, v1 → v3 (§7.3 flip step 2 of 3)

Commit on `feat/a4-73-cordis-v3`, branched from `origin/master` @ `60b30bc0` (the brief quoted
`b2940925`; `git fetch origin` showed master had moved by one records-only merge, `#166`, touching
only `SESSION_ROUTER_LOG.md` + `graph.yaml` — code side identical). No push.
`schema.ts:75` and `types.ts:416` untouched — **no narrowing** (that is step 3). `fixtures.ts`,
`docs/**`, `graph.yaml`, `SESSION_ROUTER_LOG.md` untouched. CORE PATCH BUDGET 0. No host booted,
no build run, port 3080 untouched: verification is tests plus reading the parser.

## Verdict

**MIGRATED. Not BLOCKED.** The v1 digit at that site is NOT the claim: no test in the tree parses
this document, no golden hash pins `my-team-bp-1`, and no refusal/migration proof depends on it
being v1 (each of those searched for, §Blocker check). The shape-vs-less question is therefore
**not reached — zero witnesses moved**: nothing was re-pointed, loosened, or given a weaker
expected value. The only committed witness that touches this file's digit is the fence's own
dirty-set identity, and it is a dispatch instrument, not a behaviour claim (§Disposition).

The promoted document is valid before AND after the flip: v3 is in today's accepted set `[1,2,3]`
(proved by running the REAL `parseBlueprint` over the REAL file — 4/4, `battery/parse-witness-scratch-4green.txt`),
and the flip only removes `[1,2]` from membership and re-points the field-set selector, neither of
which a v3 document trips. It is also exactly the form the step-3 flip requires, which is why the
coordinator's sequence puts this commit before the narrowing.

## What the document became

One file, one document, plus one wrapper row removed (same commit):

* `schemaVersion: 1` → `schemaVersion: 3`.
* The two documents v3 makes REQUIRED, added at the honest zero position, adjacent, inside the
  block scalar: `permissionMutationEnvelope: { rules: [] }` and `teamHardEnvelope: { rules: [] }` —
  never a permissive filler. `rules: []` is legal and means exactly one thing on its plane
  (validate.ts's own words: "empty means NO expansion authority").
* Comments (YAML `#`, inside and above the block) stating the per-plane claim, because the two
  planes DISAGREE about absence and a single reading would be wrong in one direction:
  — **expansion plane** (`effectiveAuthorityCeiling`, domain/authority-envelope): an unmatched
  scope is `no-authority`; `rules: []` means this Leader may expand nothing.
  — **approval plane** (`bindingDocs`, domain/permission-plane): an absent rule imposes NO
  narrowing; a Human User approving a concrete operation is impeded only by host-side law.
  The inertness claim is made where it is true — the ONE world of "a Team that never asks to
  expand anything" (permissions come solely from the static lanes in the same document, no
  mutation, no rising-authority proposal) — and the comment names the world where it is NOT inert
  (a profile override designing for expansion must declare real rules, not inherit the pair).
* Identity preserved: `blueprintId: my-team-bp-1`, `revision: "1"`, and every pre-existing field
  (census §4 proves nothing was lost, moved, or reordered; the scratch parse-witness additionally
  asserts `parsed(HEAD) == parsed(BASE)` except the digit and the two added documents).
* Promoted document's contentHash (from the parse witness):
  `sha256:9ee498574d6651ab131a87b50fd435993fc7647252466da1608f7d542384152f`.

## Blocker check (was the digit the claim?)

Searched, all negative, each by command not by assumption:

| Candidate for "the digit is the claim" | Result |
| --- | --- |
| A test that parses the REAL shipped document's version | None. `readFileSync` of the real `cordis.patch.yml` appears in exactly one vitest file (`team-spill-local-composition.test.ts`) and it never imports `parseBlueprint` — it asserts spillStore row structure only. |
| A golden contentHash of `my-team-bp-1` | None. `git ls-files | xargs grep -l my-team-bp-1` → the file itself, two docs (`docs/INSTALL.md`, `docs/STATUS.md` — read-only lanes), the skill doc, and orchestration records. No `.ts`/`.mjs`. |
| A refusal/migration proof depending on the shipped doc being v1 | None — the flip-refusal proofs carry their own literals (`pr-e`/`pr-f` kit anchors), not this file. |
| Wrapper leg f20 | SYNTHETIC: `fixture('f20')` is an inline YAML *shaped like* cordis.patch.yml, never the file; it stays green. The scope leg pins `isScanScopePath('cordis.patch.yml') === true`, which stays true for a CLEAN cordis.patch.yml. No control moved. |
| `p4t6-session-event-scan` | The scanner's scope excludes the root manifest (recorded in its own comments); 10 legs unchanged. |
| `scripts/composition-smoke.mjs` | Zero references to the root manifest; its `validateTeamPluginConfig` stack line is the intentional degenerate-context fail-loud probe. |
| `.pbf-root-surface-check.mjs` (evidence, out-of-chain) | Validates the ROW CONFIG through the real validator (non-empty-string check, never parses the document) and pins `blueprintId: my-team-bp-1` — preserved. Needs built artifacts; not run (no-build discipline). |

## Disposition — PROMOTE, per claim

The unit of disposition here is ONE document (one site, one export):

* **The digit (L60→L68 `schemaVersion`)** — PROMOTE. It is decoration ON A LIVE document:
  production boot parses it (host.ts:2125 / root.ts:943 / blueprint-authority.ts:328 →
  `parseBlueprint`; agent-bindings.mjs:1810 legacy path), and the design claim — the team, its
  lanes, its quotas — never depended on which digit declared the carrier. Live + decoration ⇒
  PROMOTE per the probe rule; the digit simply has to track the version the product runs, which
  is exactly what the flip will require.
* **The pair** — REQUIRED, not decoration: v3 refuses without them (validate.ts:1334-1337), and
  they move ATOMICALLY with the digit — the scratch proved a v1 digit wearing `teamHardEnvelope`
  is refused (`battery/parse-witness-scratch-4green.txt` leg 3), so a half-migration is a
  host-boot refusal, not a silent change.
* CARRY, DROP, STOP — not applicable and not used: no witness pins the digit (CARRY would be
  pinning a number nothing claims); DROP is what pbf-default-artifact-urls' stub did for a
  document NOTHING PARSES — this one is parsed at every real boot, so deleting the digit would
  delete the product's shipped team design; no pin coupling (STOP) anywhere — the fence and the
  wrapper accepted the departure in-commit.

## Consumer population — every consumer of this manifest's `blueprintSource`, before vs after

Runnable vitest population (each run at base and after, un-piped, identities recorded):

| Consumer | What it consumes | Base | After |
| --- | --- | --- | --- |
| `packages/runtime/test/team-spill-local-composition.test.ts` | parses the REAL file (yaml), asserts composed spillStore row tree; never parses the document | 3/3 | 3/3 |
| `packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | DEFERRALS↔dirty equality ×2, f20 synthetic, scope leg, 60 legs | 60/60 | 60/60 |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | the root manifest is outside its scope (own comment); wrapper file edited in place | 10/10 (total 1031 derived, unchanged) | 10/10 (unchanged) |
| `packages/runtime/test/pbf-default-artifact-urls.test.ts` | validator semantics the install surface relies on (never parses) | 9/9 | 9/9 |

**Failure identities: none on either side** — the population is green at base, so the known base
debt list (`t1-capability-schema` ×9, `t2-blueprint-hash`, `d3-member-identity-context`,
`p6t3-restart` ×2, `p8s3b-result-effects`, `t12a-b2-child-identity`, `t12a-glue-handoff-ports`,
`p6t1-parallel`) belongs to the fixtures.ts consumer population and never surfaced here.

Mandated adjacent population: twins 13+8 → `21 passed` both; §7.6 gate `1 failed | 25 passed (26)`
BOTH — the failing leg is the unbuilt-tree refusal, and its diagnostic was byte-compared
base-vs-after rather than building: the ONLY difference is the self-describing tree-state
sentence (`0 tracked file(s) changed … 0 untracked` → `2 … 1 untracked`); the refusal text,
stack and verdict are identical. Classifier 54/54 both.

Verified by reading (cannot run without a host, and no host was booted):

* `host.ts` — `validateTeamPluginConfig` requires a non-empty string only; the anchor parse at
  :2125 goes through `classifyBlueprintAnchor` → full `parseBlueprint`; v3 is accepted today, and
  post-flip a v1 document here would degrade-boot with the loud `migration-required` line — which
  is exactly the harm this commit removes.
* `root.ts:943`, `blueprint-authority.ts:257/328` — same classifier/parse.
* `live/agent-bindings.mjs:1809-1810` — legacy row-global `parseBlueprint(src)`.
* `team-spill-local.ts` — bundle-layer comment only; never reads `blueprintSource`.
* `package.json` — `dsh.bundle.patch: './cordis.patch.yml'` declaration, unchanged.
* Kit/harness scripts writing `profiles/web/cordis.patch.yml` (run.mjs, g5, root-binding,
  member-residency, session-reader e2e, `tests/kits/_shared/preset-seam.mjs`) — they author their
  OWN profile layers in their own DSH_HOMEs and never read this file's document.

## Census — parse-level, pre-commit, with its positive control

`battery/` carries every run with its exit code. Order: shared tool self-test, positive control,
the shared tool ON MY FILE (to show what it would have claimed), then the companion.

| Run | Exit | Result |
| --- | --- | --- |
| `element-set-census-quotedfix.py --self-test` | 0 | 6 PASS / 0 FAIL |
| same, positive control `5cdb4e50^` vs `a2c7-subtree-matcher.test.ts` in a throwaway worktree at `5cdb4e50` | **1** | 2 × `removal that is not a version element: ['metadata: {}']` — the historical defect still fires, the quoted-fix did not blunt it |
| same, `origin/master cordis.patch.yml` | **0** | `files 0 … anomalies 0` — see Instruments §2: the shared tool DISCARDS a `.yml` path by extension filter even when explicitly passed. Running it alone would have handed this lane a free clean bill of health. |
| `tools/yaml-element-census.py origin/master cordis.patch.yml` (this lane's companion; reuses the shared tool's OWN VERSION/YAMLISH/PAIR regexes; `sys.dont_write_bytecode` before import — no `.pyc` touched anywhere) | 0 | base 34 elements / work 38; LOST = `schemaVersion: 1` only; GAINED = `schemaVersion: 3` + exactly the four pair elements; pair adjacency, `rules: []` placement, version-count and stream-identity-modulo-version all pass |

The companion exists because the silent-drop family applies to this file with full force
(dropping `metadata: {}` / `requirements:` / the `policyStates:` entry here would parse and hash
identically), and the shared instrument structurally cannot see a raw YAML block scalar. It was
run BEFORE commit, base = `origin/master` (never the tree against itself).

## Battery (committed tree, literal outputs in `battery/`)

1. **Fence** — base `dirty(6 files, 17 sites)` → after **`dirty(5 files, 16 sites)`** (−1 file,
   −1 site); `unknown(0,0)`, `advisory(8,10)`, `refused(52,115)`, **`prose(5,5)`**, `adjudicated(16,24)`
   all byte-stable (the prose trap was disarmed before writing: no `schemaVersion`-colon-digit
   pattern appears in any comment added here). OFFENDING-set difference, both directions:
   left−right = `cordis.patch.yml :: L60=v1` (the one departure); right−left = **nothing added**.
   Run twice byte-identical pre-`git add` AND twice byte-identical post-`git add`, and the
   post-add output equals the pre-add output (evidence files live under the excluded
   `dev/agent-workflow/` prefix).
2. **Wrapper** — 60 legs before, 60 after (the DEFERRALS row is data, not a leg); map 6 rows → 5;
   **zero controls moved** (f20 is synthetic; the scope leg pins membership, not dirt). The row
   removal is CHECKED, not trusted: re-adding it once reddens
   `every deferred path is still dirty (a migrated path must leave the list)` —
   `expected [ 'cordis.patch.yml' ] to deeply equal []` (`battery/mutation-c-wrapper-rowread.txt`).
3. **Consumer population** — 82 legs (3+9+60+10) green before and after, identities: none on
   either side.
4. **p4t6** 10/10 (derived total 1031 untouched — no scanned file added or created; the new
   evidence is `.py`/`.md` under `dev/`, outside its `packages/**` scope), twins **13+8**,
   §7.6 gate **26** (25+1 unbuilt refusal both sides, diagnostic byte-equal modulo the
   self-described tree-state fields — no build performed), classifier **54**.
5. `pnpm -r run typecheck` exit 0, `0 × error TS`; `pnpm -r --no-bail run typecheck` exit 0,
   `0 × error TS` (separate runs, separate transcripts);
   `lint-identities --diff …0237d487.txt`: **new 0 / resolved 0** (160 identity lines, 76
   distinct, universe 1107) both before and after.
6. **Mutation table** (restore verified by sha256 of the file, `battery/hashes-good.txt`, never
   by exit code):

| Mutation | What goes RED | Named finding |
| --- | --- | --- |
| (a) drop the `teamHardEnvelope` block from the promoted document | this lane's census companion: 2 anomalies, exit 1. The production parser (scratch probe): `TeamContractError: blueprint is missing required field 'teamHardEnvelope' at $`. **FENCE UNCHANGED `dirty(5,16)`; ALL FOUR CONSUMER SUITES 82/82 GREEN.** | **Coverage finding, reported as such**: once the scratch probe is deleted (it was), NOTHING in the committed tree parses this document. Its shape is witnessed at authoring time by the census and at runtime only by a real host boot. This is the same residual class §7.3 priced for `teamRequirements` (A ships unexercised); it is not new, and step 3 inherits it. |
| (b) revert the digit to 1 (pair kept) | fence: `dirty(6,17)`, `OFFENDING cordis.patch.yml :: L68=v1`; wrapper leg `the dirty set is EXACTLY the recorded Task 7.4 deferral set (no new path)` red: `expected [ 'cordis.patch.yml' ] to deeply equal []` | no consumer assertion moves (they never read the digit); note the mutant is a document a real boot REFUSES (v1 + `teamHardEnvelope` = unknown field — scratch leg 3), so digit and pair are one atom. |
| (c) re-add the wrapper's DEFERRALS row | wrapper leg `every deferred path is still dirty (a migrated path must leave the list)` red **by name**: `expected [ 'cordis.patch.yml' ] to deeply equal []`, 59/60 pass | proves the row deletion in this commit is load-bearing. |

## What this does NOT claim / follow-ups for the coordinator (not this lane's to touch)

* The flip has not happened: `schema.ts:75` is `[1, 2, 3]`, `types.ts:416` is `1 | 2 | 3`; step 3
  does the narrowing, §7.5 bullet 2 and the 40-name population.
* `docs/INSTALL.md` + `docs/STATUS.md` carry a copy of this design (and the skill
  `.agents/skills/team-blueprint-authoring/SKILL.md:46` TEACHES `schemaVersion: 1` with this very
  `blueprintId`) — post-flip, that skill would teach authoring of refused documents. Docs lanes,
  not mine (docs/** forbidden here; fence excludes Markdown by extension).
* `scripts/verify-blueprint-version-clean.mjs:29` cites the site as `cordis.patch.yml:60`; the
  digit now sits at L68 (8 comment lines above it). Historical-prose staleness, flagged rather
  than edited (fence is not this lane's file).
* `t12a-live-bridge.mjs` remains dirty BY DESIGN (coordinator ruling) and none of its importers
  consumes this manifest — untouched.

## Instruments that lied to me, and how each was caught

1. **The piped install.** `pnpm install … | tail -5` returned exit 0 — the pipeline's exit code is
   `tail`'s. The install had actually FAILED (`ERR_SQLITE_ERROR unable to open database file`: the
   default store under `~/.local/share/pnpm` sits on a read-only filesystem; the workspace
   `.pnpm-store` must be passed with `--store-dir`). The lie compounded: vitest then ran the half
   of the population that didn't import `yaml` and reported 70 green while `team-spill-local-composition`
   and the pbf suite died at collection with `Cannot find package 'yaml'` — the exact phantom class
   the brief warned about, arriving via a different door. Caught by reading the failure (the brief's
   own warning made it recognizable as install-state, not base debt), by `ls node_modules/.pnpm`
   (817 packages after a real install) and `require.resolve('yaml')`; re-installed un-piped with
   `> log 2>&1; echo exit=$?` thereafter.
2. **The shared census discarded my file while claiming to audit it.** Run exactly as instructed on
   `cordis.patch.yml`, it printed `files 0 … anomalies 0` and exited 0: `main()` filters the
   path list to `.ts`/`.tsx` even for paths passed EXPLICITLY, and its extractor only sees quote
   carriers, so a raw YAML block scalar is doubly invisible. A post-commit run of it would have
   been a textbook free zero. Caught by noticing `files 0` while a tracked file had just changed,
   then reading `main()`; fixed by a companion that reuses the shared tool's own regexes
   (`tools/yaml-element-census.py`), with the vacuous run preserved in
   `battery/census-quotedfix-on-cordis-vacuous-zero.txt` rather than hidden.
3. **My own probe lied about the document, twice.** (a) The first scratch draft asserted
   `requirements == [{domain, name}]`; the parser normalizes `optional: false` INTO the object, so
   the red was my assertion shape, not a lost element — caught by reading the diff
   (`…(2)` vs `…(1)`) instead of "fixing" the document. (b) The first draft's "reverting the digit
   still parses" test was self-contradictory (digit-revert leaves the pair on, which IS refused);
   it was rewritten before any conclusion was drawn from it. Lesson: a scratch witness is also an
   instrument, and it fails in both directions.
4. **`git checkout <path>` restored the INDEX, not my edit.** With the edits unstaged, the
   checkout of the mutated wrapper restored HEAD and silently destroyed the DEFERRALS removal —
   the sha256 check (`4d5cad6e…` expected, `17057fc6…` produced) is what surfaced it. The removal
   was re-applied by script and hash-verified byte-identical. Corollary for the mutation table:
   restore-by-hash earned its keep a second time when my own restore script replaced the WRONG
   envelope block (pme instead of the) — hash `b66d8699…` ≠ `6eaf46a9…`, caught before anything
   was concluded from the mutant.
5. **A redirect to a non-existent directory faked a catastrophe.** The first post-edit fence run
   aimed at `../captures/after/` before `mkdir -p`; bash failed the redirect, the fence never ran,
   and the follow-on offending-set diff compared the base against an EMPTY file, printing all six
   base offenders as "departed". Caught by the `[stderr]` lines and exit-code discipline — the
   diff it produced was wrong in the SCARY direction, which is the direction least likely to be
   questioned.
6. **The brief's own SHA went stale** (as the brief itself anticipated): `origin/master` is
   `60b30bc0`, not `b2940925`; `git fetch` + `git rev-parse` before branching, and the delta
   verified records-only before building on it.
7. **`grep -c "error TS"` exits 1 on a true zero** — re-met during the typecheck capture; the
   `echo exit=$?` was deliberately attached to the pnpm command, not to the pipeline, so the
   count's exit never polluted the claim's exit.
