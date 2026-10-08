# FINDINGS — A4-PR7 lane `capability-negatives`

**Lane:** `fix-a4-capability-negatives` · worktree `.worktrees/a4-capability-negatives` · base `master = 1d706917`
**Scope:** test-only. One file changed: [`packages/domain/test/t1-capability-schema.test.ts`](../../../../packages/domain/test/t1-capability-schema.test.ts). No product source change, so no rebuild: `pnpm check:artifacts:head` → `drift=0`.
**Status:** handed back **unmerged**, not pushed.
**Taken:** 2026-10-08. Nine-root census taken **exactly once** at hand-back (see §7).

---

## 0. Verdict

1. **The defect was real and it was an instrument defect, not a product defect.** The test-local
   YAML serializer `toYamlFrontmatter` in `t1-capability-schema.test.ts` emitted a non-empty array
   *inline after its key* (`items:         - read`). That is not YAML; the repository's own parser
   refuses it with `Unexpected block-seq-ind on same line with key`. Because YAML decode happens
   *before* `validateBlueprintDocument`, every fixture with a non-empty capability list died in the
   decoder. Proof, not argument: instrumenting `decodeYamlFrontmatter`'s failure path and running
   the **base** file produced **9 decode refusals**; the fixed file produces **0**
   (`transcripts/probe-t1-base.txt`, `transcripts/probe-t1-tip.txt`).
2. **The five green legs the baseline flagged did not all fail the same way — three of them were
   green on their own syntax error, and two reached the validator but could not say which law
   fired.** Measured per leg (§3). This corrects `BASELINE-CLASSES` §6.1's count of 5: the
   emitter cannot reach legs 5 and 6a, whose fixtures contain only *empty* arrays (`[]` was
   emitted correctly), so those two legs did see a real governance refusal — asserted as
   `toThrow()`, i.e. unnamed.
3. **`validateAllowDenyEntry`'s closed-vocabulary branch had no assertion of its identity at base
   and has one now.** At base, 0 test references named it and 3 of its 3 reaching legs (`4`, `4b`,
   `5`) could not distinguish its refusal from a decode error — and `4`/`4b` never reached it at
   all. Now each leg asserts code + `details` + message text (§3), and reachability is *measured*
   by mutation, not claimed: neutering the branch turns exactly those legs red (§4).
4. **The emitter fix moved the census, and that is the deliverable.** Nine-root red set went
   **22 → 13 identities: `NEW=0`, `FIXED=9`**, every `FIXED` being a red this lane owned; leg
   count went **6288 → 6291** (= +3 new emitter-proof legs; nothing left the registry). No titled
   red resolved into a collection error: the 3 `FILE …::COLLECTION-OR-UNHANDLED` identities are
   byte-identical (§7).
5. **The class is now measured, not assumed.** Repo-wide: **102** test files build blueprint
   frontmatter, exactly **1** had a hand-written YAML serializer (this one), **18** files contain a
   bare `.toThrow()` (54 sites), and **2 files / 7 legs** were a bare `.toThrow()` sitting on a
   parse entry. After this lane: **1 file / 2 legs** remain (`bp1-blueprint-inspector.test.ts`),
   and those two are measured to *reach* the validator — they are a form risk, not a false green
   (§6).

Nothing was rewritten to make an assertion pass: all 17 original leg titles and every original
assertion survive; the only deleted assertion lines are the five `expect(() => parseBlueprint(source)).toThrow()`
calls, each replaced by a strictly stronger identity assertion (`git diff` removed-lines review in
§2.3; `expect(` sites **54 → 63**).

---

## 1. Why the base file could not have measured anything it claimed

`parseBlueprint` order (`packages/domain/blueprint/src/validate.ts:1535-1538`): `splitFrontmatter`
(`:1536`) → `decodeYamlFrontmatter` (`:1537`, defined `parse.ts:120`; a `YAMLError` becomes
`MALFORMED_DTO` with `details.reason='yaml-invalid'`, `parse.ts:130`/`:136`) →
`validateBlueprintDocument` (`:1538` → `validate.ts:1175`), whose version fence is `:1195-1199`.
A fixture that is not valid YAML therefore never reaches a validator branch, and a version-1
document never reaches the capability validator either. The base file had **both** problems at once:

| base input | what the leg expected | what actually happened |
| --- | --- | --- |
| `fullCapabilities()` etc. (non-empty arrays) | validator refusal / successful parse | YAML syntax error in the decoder |
| `schemaVersion: 1` carrier | capability-mode facts | `SCHEMA_VERSION_MISMATCH` — unsupported blueprint schema version 1; this build supports [3] |

`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]` (`packages/domain/blueprint/src/schema.ts:75`; code
`SCHEMA_VERSION_MISMATCH` raised at `validate.ts:1197`), plan §7.3 v3-only cutover. Both refusal
strings are visible in the stored base capture: `Unexpected block-seq-ind on same line with key`
×6 (legs 2, 3, 7, 8, 9, 11) and `unsupported blueprint schema version 1; this build supports [3]`
×3 (legs 1, 10, 11b) — `grep -c` over `transcripts/probe-t1-base.txt`, which is the base file's run.
So legs 1, 10, 11b (fixtures whose emitted YAML happened to be legal) were
red at the **version fence**, and the rest were red or falsely green **inside the emitter**.

Migration of the carrier to `schemaVersion: 3` follows plan §7.1/§7.2 blueprint validation with the
strictest legal authority declaration:

```ts
const NO_DECLARED_AUTHORITY = {
  permissionMutationEnvelope: { rules: [] },   // declared empty = NO expansion authority
  teamHardEnvelope: { rules: [] },             // absent/empty hard doc evaluates as no-authority
}
```

`rules: []` is not filler and does not widen anything — an empty `rules` list is the *narrowest*
legal envelope (ADR §5.1 forbids the implicit wide grant a permissive stub rule would create). The
capability laws these legs test are **live in v3** (v3 inherits the v2 template field set, and
`validateTemplateCapabilities` is on the v3 path), so the carrier move retires nothing: `capabilities`
is still a real v3 field and the closed vocabulary still binds.

Per §7.4 dispositions, three legs' *superseded* form is recorded rather than silently kept:
legs **1**, **10**, **11b** were, at base, duplicate assertions of the version fence in a file whose
subject is the capability schema. Their carrier moved to v3 (their own assertions are unchanged and
now actually run). The refusal of a frozen v1 document stays owned, green, by
`test/blueprint-v1-frozen-resume.test.ts`; `test/a1-permission-policy.test.ts:186` already covers
capability-less documents. Disposition: **migrate-by-hand**, with the *premise* of the base form
registered as debt: nothing in the repo asserted "the capability schema refuses X *on the supported
carrier*" before this lane.

---

## 2. The emitter, and the proof that now pins it

### 2.1 The base emitter's output (reproduced, not described)

`scratch/emitter-shape.mjs` runs both emitters through the real `yaml` parser:

```
base emitter  → "teamTools:   kind: allow   items:         - read"   → yaml.parse FAILS:
                Unexpected block-seq-ind on same line with key
fixed emitter → value-for-value round-trip (toEqual against yaml.parse and against the product decoder)
```

The base emitter also mangled any string starting with `- ` (no quoting for a leading indicator),
which is why the fix covers quoting and not only sequences.

### 2.2 New legs 0a / 0b / 0c — an emitter is a fixture-language, so it gets legs

* **0a** emits every shape the suite builds (nested mappings, sequence of scalars, sequence of
  objects each carrying a nested mapping with its own sequence, `[]`, `{}`, numbers, booleans,
  `null`) and asserts `yaml.parse(emitted)` **equals the value it was given**, and that the
  product's own `splitFrontmatter` + `decodeYamlFrontmatter` read the same document. `undefined`
  entries are dropped, never emitted as `"undefined"`.
* **0b** round-trips the reinterpretation traps: `'a: b'`, `'a # not a comment'`, `'say "hi"'`,
  `"it's"`, `'true'`, `'false'`, `'null'`, `'007'`, `'1.5'`, `''`, `'- not a sequence item'`,
  `'{not a mapping}'`, `'[not a sequence]'`, `'yes'`, an embedded newline — and asserts plain
  scalars stay **unquoted** (`plain: hello`), so the fixture language still exercises plain style.
* **0c** pins the refusal: an unprovable shape (a sequence inside a sequence, a value with no
  scalar form) **throws from the emitter** with a message naming itself. Guessing is the failure
  mode that hid this defect, so guessing is now a loud error.

Plus a per-leg reachability gate: every fixture-consuming leg begins
`expectFixtureIsLegalYaml(source)`, which decodes through the product and, on failure, throws a
message that says *"this leg never reached the validator (the emitted text is the defect, not the
law under test)"*. Legs that can't reach the law can no longer report on it.

### 2.3 No assertion was weakened to pass

`git diff` removed lines are only: the old emitter body; the five bare `.toThrow()` calls; leg 7's
fixture construction hoisted out of `parseBlueprint(...)` argument position (same five documents,
same mutated fields, plus three added pairwise hash-delta assertions and per-assertion naming of the
mutated field); and single-line `parseBlueprint(<builder>())` split into
`const source = …; expectFixtureIsLegalYaml(source); const blueprint = parseBlueprint(source)`.
Leg titles are verbatim (that is why the census diff reports `FIXED`, i.e. the *same identities*
resolved, not new ones). `grep -c 'expect('`: base **54** → tip **63** (`scratch/expect-count.txt`).

---

## 3. Converted negative legs — the rejection identity, per leg

`MALFORMED_DTO` alone is **not** an identity: a fixture syntax error carries the same code. Each leg
pins the `details` its specific validator branch attaches *and* the refusal text, and additionally
asserts `details.reason !== 'yaml-invalid'` so a decode error can never satisfy it.

| leg | validator branch (law) | asserted identity | base state (measured) | tip |
| --- | --- | --- | --- | --- |
| 4. missing `items` | `validateAllowDenyEntry` (`validate.ts:817`, entered at `:888-890`) | `MALFORMED_DTO`, `details.path='$.leader.capabilities.teamTools.items'`, msg `missing required field 'items'` | **green on a YAML syntax error** (probe line 201) — never reached the law | green, on the law |
| 4b. non-string item | `validateAllowDenyEntry` | `details.path='$.leader.capabilities.teamTools.items[0]'`, msg `must be a non-empty string` | **green on a YAML syntax error** (line 211) | green, on the law |
| 5. deny + extra fields | `validateAllowDenyEntry` | `details.path='$.leader.capabilities.teamTools'`, `details.extraFields=['items']`, msg `deny entry at … must not have extra fields` | green on a **real** refusal, but unnamed (fixture had only `[]`) | green, on the law |
| 6a. unknown capability sub-field | `assertNoUnknownFields(record, BLUEPRINT_CAPABILITIES_FIELDS…)` (`validate.ts:886`) | `details.unknownFields=['unknownField']`, msg `$.leader.capabilities (capabilities) has unknown fields: unknownField` | green on a **real** refusal, unnamed | green, on the law |
| 6b. unknown template field | `assertNoUnknownFields(record, templateFields…)` in `validateTemplate` | `details.unknownFields=['unknownField']`, msg `$.leader (template) has unknown fields: unknownField` | **green on a YAML syntax error** (line 250) | green, on the law |

Correction to record: `BASELINE-CLASSES` §6.1 reported *five* green legs passing on their own YAML
syntax error. Instrumented per-leg, the number is **three** (4, 4b, 6b). Legs 5 and 6a built
fixtures whose only arrays were empty, so the base emitter emitted them correctly and the validator
did run — the defect there is the *unnamed* assertion, which is the same class of hole (an
impersonating throw satisfies it) with a shorter fuse. Both counts are in the raw probe files; the
correction is reported rather than quietly harmonised.

---

## 4. Reachability: neuter-and-restore, and the mutation table

"A green mutation table can mean a dead mutant", so every green is paired with the red it caused.
Harness: `scratch/mutate.py` (patches one exact site from an in-memory copy, runs the target file
once, restores, and verifies the restore by sha256 — reported per row).

```
M1 [ALIVE] restored-hash-verified=True red=3  green=17 expected-red=['4.','4b.','5.']  not-turned-red=[]
M2 [ALIVE] restored-hash-verified=True red=1  green=19 expected-red=['6a.']            not-turned-red=[]
M3 [ALIVE] restored-hash-verified=True red=1  green=19 expected-red=['6b.']            not-turned-red=[]
M4 [ALIVE] restored-hash-verified=True red=10 green=10 expected-red=['0a.','2.','3.','4.','4b.','6b.','7.','8.','9.','11.'] not-turned-red=[]
M5 [ALIVE] restored-hash-verified=True red=1  green=19 expected-red=['7.']             not-turned-red=[]
```

* **M1** — neuter `validateAllowDenyEntry` (early return preserving the projection). Exactly the
  three allow/deny legs go red ⇒ the closed-vocabulary branch is *live* and the three legs measure
  it, each by name.
* **M2** — `void BLUEPRINT_CAPABILITIES_FIELDS` (capabilities unknown-field vocabulary) ⇒ red `6a`.
* **M3** — `void templateFields` (template unknown-field vocabulary) ⇒ red `6b`.
* **M4** — re-introduce the base emitter defect in the test file itself ⇒ **10** legs red, including
  the new `0a`. This is the emitter's own reachability probe: a regression in the fixture language
  is now caught by the suite rather than by a reader. (`0b`, `5` and `6a` are correctly *not* in
  that set: their fixtures contain only empty arrays, which the broken branch never touched —
  coverage of empty-array emission is carried by `0a`/`0b`, not by the array branch.)
* **M5** — `capabilities: null` in the hashable projection (`validate.ts:1624-1625`) ⇒ red `7`, the
  hash leg. Leg 7 therefore measures the projection it claims to, and its strengthening (pairwise
  deltas between the five mutations, not just each-vs-base) is what makes M5's single red precise.

Full transcripts: `transcripts/mut-M1.txt` … `mut-M5.txt`, machine-readable
`raw/mutation-table.json`, roll-up `transcripts/mutation-table.txt`.

---

## 5. Legs left red: none in this file

Every one of the 9 reds this file owned resolved to green **without touching an assertion** (§7
reports them as `FIXED` by identity, `NEW=0`). Nothing in this file needed `retire` or
`registered-debt` with a red survivor; the disposition that was actually used is
`migrate-by-hand` (carrier v1 → v3, strictest envelopes) + assertion strengthening, and the
premise-level debt is recorded in §1.

---

## 6. The class, repo-wide ("this class is now repo doctrine — measure the class")

Scanner: `scratch/audit-serializers.mjs` (balanced-paren `expect(` scan **plus the fluent matcher
tail**, because the matcher lives *outside* `expect(...)`, and `.not.toThrow()` positives excluded;
comment bodies stripped). Run on base `1d706917` and on this tip:

| metric | base `1d706917` | this tip |
| --- | --- | --- |
| test files scanned (`packages/*/test/*.test.ts`) | 507* | 506 |
| files that build blueprint frontmatter in-test | **102** | 102 |
| …of which have a **hand-written YAML serializer** | **1** (`t1-capability-schema.test.ts`) | 1 (now proven by 0a–0c) |
| files interpolating a multi-line dynamic block into a fixture | 11 | 12 (t1 now qualifies — its serializer is visible to the scanner) |
| files containing a bare `.toThrow()` (total sites) | 18 (54) | 17 (49) |
| **bare `.toThrow()` sitting on a parse entry** | **2 files / 7 legs** | **1 file / 2 legs** |
| suspects left to probe | 2 | 1 |

\* the base scan ran in the main checkout, which moved during this lane (see §8), so it contains one
test file (`packages/tools/test/a4-corrupt-leg-guard.test.ts`) that is not in this branch's base.
File-level class counts other than that (102 / 1 / 18 / 54) are unaffected by it.

Then the decisive step — *measured*, not inferred — by instrumenting `decodeYamlFrontmatter`'s
failure path (`scratch/probe-fixtures.py`, restore hash-verified) and running each suspect:

| file | bare `toThrow()` on a parse entry | decode refusals | verdict |
| --- | --- | --- | --- |
| `packages/domain/test/t1-capability-schema.test.ts` (base) | 5 | **9** (legs 2,3,7,8,9,11 red; **4, 4b, 6b green on the syntax error**) | the class, confirmed and fixed |
| `packages/domain/test/bp1-blueprint-inspector.test.ts` | 2 (`:223`, `:256`) | **1**, inside the leg titled `rejects invalid YAML (yaml-invalid, the parser message preserved)` — that leg *intends* invalid YAML and asserts `yaml-invalid` | the two bare-toThrow legs produce **no** decode refusal ⇒ their fixtures decode, the validator runs ⇒ **not false greens**. Form risk remains (any throw would satisfy them); owner's call, not this lane's file. |
| `packages/runtime/test/p8s7r2-model-state.test.ts` | 10 (none on a parse entry) | **0** | out of class: never feeds a document to a parse entry |

**Answer to the class question:** files at risk from a hand-written serializer = **1 of 102**
(`t1`, now fixed); other files' green negative legs passing on a YAML syntax error = **0**
(measured across the 2 remaining suspects; the 5 t1 legs were the whole population of syntax-error
passes and they are this file's). The broader residue — 17 files / 49 bare `.toThrow()` sites that
are *not* on a parse entry — is reported as a form-level backlog for their owners.

Deliberately **not** added: a repo-wide guard leg for this class. A new scannable test file would
move `p4t6`'s pinned total (§8) and, if it went red, would itself be a gate failure; the class
guard is therefore reported here as evidence with a re-runnable scanner rather than installed as an
unowned red.

---

## 7. Nine-root census — taken once, by identity

One capture, sequential, `CI=true`, `XDG_CACHE_HOME` inside the workspace,
`rm -rf packages/testkit/test/.tmp-fault` beforehand (`scratch/census.sh`, form inherited from
`baseline-classes/scratch/census.sh` → `7-6-closure/scratch/final-census.sh`).

```
capture tip-1  HEAD=1d706917 dirty=1 (this lane's file)  vitest processes at start = 0
Test Files  8 failed | 497 passed (505)
Tests       10 failed | 6281 passed (6291)
[fail-set] captured 13 identities (10 failing tests, 3 collection-failing files)
```

| instrument | published baseline (`2162f6a7`) | this tip | by identity |
| --- | --- | --- | --- |
| test files | 505 | **505** | unchanged |
| legs | 6288 | **6291** | +3 = legs `0a`,`0b`,`0c`; **no leg left the registry** |
| titled reds | 19 | **10** | `FIXED=9`, all owned by this lane |
| collection-error files | 3 | **3** | identical identities |
| **red identities** | **22** | **13** | **RETIRED 9 · UNCHANGED 13 · NEW 0** |

`node scripts/fail-set.mjs diff baseline-2162f6a7.ids.txt tip-1.ids.txt` →
`[fail-set] baseline=22 current=13 NEW=0 FIXED=9` (`transcripts/census-diff-vs-baseline.txt`).

**RETIRED (9)** — all in `t1-capability-schema.test.ts`, resolved as the *same* identities:
`1.`, `2.`, `3.`, `7.`, `8.`, `9.`, `10.`, `11.`, `11b.`
**UNCHANGED (13)** — `t2-blueprint-hash.test.ts::projects absent optional singles as explicit
null`; `p6t3-mediation` ×5; `p6t3-restart` ×2; `p6t6-actions` ×1; `d3-member-identity-context::D3-4`;
and the 3 `FILE …::COLLECTION-OR-UNHANDLED` (`p8s3b-result-effects`, `t12a-b2-child-identity`,
`t12a-glue-handoff-ports`).
**NEW (0).** No red "resolved" into a collection error: the collection set is byte-identical, so
there is no escalation of that kind. No leg left the registry (6288 + 3 = 6291 exactly).

**`p6t1-parallel` quoted as a rate, not labelled green:** 12 legs, **all passed** in this capture
(1 capture, 0 red ⇒ the published series "0 red in 13 runs — 8 solo × 12 legs + 5 full census
captures = 156 leg-runs", `BASELINE-CLASSES.md` §1.1, extends to **0 red in 14 runs / 168
leg-runs**).

---

## 8. Verification battery

Full machine-readable roll-up: [`FINAL-BATTERY.txt`](FINAL-BATTERY.txt); raw captures under
`transcripts/`, `raw/`, `scratch/`.

| gate | result |
| --- | --- |
| `pnpm exec vitest run packages/domain/test/t1-capability-schema.test.ts` | **20 passed (20)** |
| `pnpm exec vitest run packages/domain/test` | 525 passed / 1 failed (the baseline red `t2-blueprint-hash…explicit null`) |
| `packages/testkit/test/a4p7-merge-gate.test.ts` (off-limits to edit; run only) | **29 passed (29)** |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed (10)** |
| `p4t6` derived scannable total | **1039** (`983 + Σ named SCANNED_PATHS_*`; derivation `scratch/p4t6-total.txt`) — **unchanged**: this lane is an edit to an already-counted file, "an edit is not an increment", so the named list is not extended |
| `pnpm --no-bail -r run typecheck` | exit **0** |
| `pnpm run lint` | `✖ 160 problems (128 errors, 32 warnings)` — the standing 128, unmoved. The one lint error in this file (`'TeamBlueprint' is defined but never used`) is **inherited verbatim** from base (base line 21 imports it and never uses it); "fixing" it would move the standing 128 and show as `resolved 1`, so it is left alone. |
| `node scripts/lint-identities.mjs --diff …/lint-identities-0237d487.txt` | `76 distinct; `**`new 0, resolved 0`** |
| `pnpm check:artifacts:head` | `verdict=ok rev=HEAD `**`drift=0`** (1508 files) — no product change to rebuild |
| `expect(` sites in the changed file | base **54** → tip **63**, no silent removals (§2.3) |

**Environment facts that affect re-measurement.**
* **Fresh worktree prereq:** `pnpm install --store-dir /home/user/dsh-plugins/dsh-agent-team/.pnpm-store`
  (un-piped) then `pnpm setup`; both exit 0. Without them every leg dies on a missing `dist/`.
* **`master` moved during this lane:** my base is `1d706917` as instructed; the main checkout is now
  at `f0c99f67` (PR #202 `fix-a4-corrupt-leg-guard` + docs rounds). My branch is *not* rebased and
  *not* merged, so the folding side must re-run the census after the fold: PR #202 adds a test file,
  which by itself moves `p4t6`'s 1039 and the file count.
* `/tmp` in this harness is per-call private: an intermediate copy of the rewritten file was lost
  with its call and the file was re-authored from scratch and re-verified
  (`scratch/tip-files/`, `SHA256SUMS`, restore verified `c46ee034…67acc7` against the censused tree).

---

## 9. How to re-run any number above

| claim | command |
| --- | --- |
| emitter round-trips / refuses | `pnpm exec vitest run packages/domain/test/t1-capability-schema.test.ts -t '0a'` (and `0b`, `0c`) |
| base emitter output vs real parser | `node scratch/emitter-shape.mjs` |
| decode-refusal probe (any file, base or tip) | `python3 scratch/probe-fixtures.py packages/domain/test/bp1-blueprint-inspector.test.ts` (patches `parse.ts`, restores, hash-verifies) |
| mutation table | `python3 scratch/mutate.py` (prints `restored-hash-verified=` per row) |
| serializer-class audit | `node scratch/audit-serializers.mjs <repo-root>` |
| census + identity diff | `./scratch/census.sh tip 1` then `node scripts/fail-set.mjs diff <baseline.ids> scratch/tip-1.ids.txt` |
