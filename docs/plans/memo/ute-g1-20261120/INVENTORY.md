# INVENTORY — the legacy ToolPlane / Family Body, per tool family (UTE-3)

**Dated:** 2026-11-20 (session calendar). **Work package:** UTE-3 of the UTE G1
"Native Execution Consolidation" round (UTE-0 contract → UTE-1 FS native
binding → UTE-2 settlement → **UTE-3 inventory** → UTE-4 retirement).
**Machine gate:** [`scripts/ute-family-inventory.mjs`](../../../../scripts/ute-family-inventory.mjs)
(**required** — invoked by the `eb3-family-definitions` leg, see §6).
**Suite:** [`scripts/ute-family-inventory.test.mjs`](../../../../scripts/ute-family-inventory.test.mjs)
(35 tests, 27 mutations).
**Ledger:** [`dev/agent-workflow/ledgers/ute-family-inventory.json`](../../../../dev/agent-workflow/ledgers/ute-family-inventory.json)
(schema `ute-family-inventory/1`).
**Evidence:** `dev/agent-workflow/evidence/ute3-inventory-20261120/`.

Marker discipline is the UTE G1 one (`README.md` §0): `[MEASURED]` = re-read the
named file; `[PROPOSED-BY-MEMO]` = this memo's engineering choice, binding only on
the work package that adopts it; `UNKNOWN` = not measured / not visible. Nothing
here restates the frozen contract; this file is the human-readable companion to
the ledger, and the ledger is the machine-checked artifact.

**What this inventory exists for.** UTE-4 may delete a family's old path only
against a declared `oldPath.files` list (`RETIREMENT.md` §5.1). Before UTE-3 that
list was hand-written per family and unauditable. This inventory makes it
machine-checkable: the family set and members come from the census, the file
universe comes from the git index, the dependencies are parsed from source text,
and the readiness is recomputed from the measured retirement artifacts.

---

## 1. The shipped state of the old plane `[MEASURED]`

- **9 families** are booked in `dev/agent-workflow/ledgers/arc-a-family-census.json`
  (8 product + 1 test-only). All 9 are inventoried; none is skipped.
- **92 implementation files** make up the family-body universe (each booked lane's
  `src/` plus `packages/tools/families/*.mjs`). **90** are claimed by exactly one
  family; **2** (`packages/tools/families/index.mjs`, `index.d.mts`) are the
  generated barrel and are declared `shared` with a reason. Nothing is silently
  unowned.
- **14 shared modules** are declared explicitly (the plane, the FamilyAssembly
  seam, the mount bindings, the guard, the pre-execute adapter, ControlService,
  the governance-center kernel/registry/factory, controlled-fs, the sandbox
  provider, the generated barrel + reviewed manifest). They are part of every
  product family's runtime path and belong to none of them.
- **34 model-visible definitions** are contributed across the 9 families, all
  declared with the file and builder symbol that declares them.

The common trunk for every **product** family is
`host ToolExecutionPipeline → host ToolsService → tool-placement (team-tool-plane)
→ tools.guard (tool-dispatch/install.ts) → pa-admission (team-tool-plane) →
control-ask-grant (agent-bindings `a5PaControlLeg`) → family.build()
(packages/tools/families/<family>.mjs) → contribution candidate → row definition →
executor → port → effect`. The per-family part of that chain is what the ledger's
`runtimePath` records step by step.

---

## 2. Per-family table `[MEASURED]`

`readiness` is `baseline / newPath / negativeControls`, **derived** by the checker
from the retirement ledger + the retirement gate's coverage derivation (§4), never
declared by this memo. `files` counts `oldPath.files`. The full file list, roles,
definition declarations, relative imports and every runtime step are in the ledger.

| family | files | definitions | non-relative deps | steps | authority | native | readiness |
|---|---|---|---|---|---|---|---|
| `dsh.fs-family` | 17 | read, write, edit, read_image | node:buffer, node:crypto, node:fs, node:fs/promises, node:path | 12 | ControlService + governance-center kernel + tools.guard | prototype | partial / prototype / partial |
| `dsh.process-family` | 11 | bash, pwsh | node:crypto, node:fs, node:timers | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |
| `dsh.search-family` | 9 | grep, glob | @deepseek-ai/dsh-tool-fs-search, node:child_process, node:crypto, node:fs, node:fs/promises, node:path, node:timers | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |
| `dsh.inspect-family` | 10 | team_skill, team_cordis_inspect_list, team_cordis_inspect_query | node:buffer, node:crypto, node:fs, node:fs/promises | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |
| `dsh.u6-probe-family` | 3 | u6arc_probe | node:crypto, node:fs, node:path | 7 | family-local governance kernel + family grantConsume port (**no ControlService**) | none | none / none / none |
| `dsh.web-family` | 10 | web_fetch, web_search | node:crypto, node:dns, node:http, node:https | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |
| `dsh.agent-control-family` | 14 | subagent, subagent_fork, send_message, interrupt_agent, list_agents, list_subagent_models, workflow | node:crypto | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |
| `dsh.ui-family` | 9 | ask_user_question, present | node:buffer, node:crypto, node:fs, node:fs/promises | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |
| `dsh.agent-state-family` | 7 | todo_write, create_goal, get_goal, update_goal, exit_plan_mode | @deepseek-ai/dsh-home-paths, node:buffer, node:crypto, node:fs, node:os, node:path, node:process, node:timers, node:timers/promises | 12 | ControlService + governance-center kernel + tools.guard | none | none / none / none |

### 2.1 The one family with a native side `[MEASURED]`

`dsh.fs-family` is the **only** family with anything on the DSH-native side:
`packages/tools/src/native-fs-binding.ts` (UTE-1, `native-fs-binding/1`), an
additive barrel export in `packages/tools/src/index.ts`, and its suite under
`tests/ute1-fs/`. Its own header says it is **not wired into any shipped
assembly** and that nothing under `packages/runtime` imports it, so its honest
status is **`prototype`** — not `product-module`. Every other family is `none`
(measured: no native provider module and no mount for it in this tree).

### 2.2 Authority, as it really is `[MEASURED]`

For every **product** family the approval / Grant / Stop authority is
**ControlService** (`packages/runtime/control/service.ts`), reached through the
`a5PaControlLeg` that `packages/runtime/src/plugin/live/agent-bindings.mjs` hands
the plane; the guard (`packages/runtime/tool-dispatch/install.ts`) arms the host
`tools.guard` / `tools/pre-execute` seams, and the governance-center kernel
(`packages/runtime/governance-center/kernel.ts`) holds the approval entry and the
one-shot `consumeOnce` grant edge. A family lane is handed only `decide`/`pa`
functions — it holds no kernel, registry, approval table or grant handle.

The **test-only** `dsh.u6-probe-family` is different by design: it builds its own
governance-center faces through the public factory and supplies its own one-shot
`grantConsume` port. It does **not** ride ControlService, and the checker enforces
that this exception cannot silently spread: a `testOnly: false` family that does
not name `ControlService` is refused. **`UNKNOWN` is a legal answer** in the schema
(with a note and zero files), but no family on this tree needed it.

### 2.3 Cross-family edges (the reason retirement is not local) `[MEASURED]`

Parsed from the declared files; recorded per family in `importsAcrossRepo`:

| family | imports from another family lane |
|---|---|
| `dsh.process-family` | `packages/tools/fs-family/src/index.mjs` |
| `dsh.search-family` | `packages/tools/fs-family/src/index.mjs` |
| `dsh.inspect-family` | `packages/tools/fs-family/src/index.mjs`, `packages/tools/search-family/src/index.mjs` |
| `dsh.ui-family` | `packages/tools/fs-family/src/index.mjs` |

**Consequence `[PROPOSED-BY-MEMO]`:** retiring `dsh.fs-family` while process /
search / inspect / ui still import its mechanics is not a local deletion — the
UTE-4 change set for FS has to migrate or re-home those imports first. The runtime
path of `dsh.inspect-family` records the FS-owned port step with its real owner
(`owner: dsh.fs-family`), so the edge is visible at the chain level too.

---

## 3. How the checker derives the facts it is not allowed to take on trust `[MEASURED]`

| fact | independent input | refusal when it disagrees |
|---|---|---|
| family set | census, both directions | `INVENTORY_FAMILY_MISSING` / `INVENTORY_FAMILY_UNKNOWN` |
| members | census `nativeNames` with the `(bound-definition)` prefix stripped, set equality | `INVENTORY_MEMBER_DRIFT` |
| lane / mount | census `lane` / `mount` | `INVENTORY_LANE_DRIFT` / `INVENTORY_TESTONLY_DRIFT` |
| definitions | must be exactly the members; `boundDefinition` must equal the census prefix; `declaredIn` must be an owned file; the declared builder symbol must appear in that file | `INVENTORY_DEFINITION_DRIFT` |
| old-path files | `git ls-files` (tracked) + the working tree | `INVENTORY_PATH_UNTRACKED` / `INVENTORY_PATH_MISSING` |
| file universe | the census lanes' `src/` + `packages/tools/families/` in the git index; every such file must be claimed once or `shared` with a reason | `INVENTORY_FILE_UNOWNED` / `INVENTORY_SHARED_UNREASONED` / `INVENTORY_DUPLICATE_CLAIM` |
| dependencies | a tokenizer over the declared files (comments/strings/templates cannot fake an import; `new URL('<rel>', import.meta.url)` and literal `import()`/`require()` are read) | `INVENTORY_DEPENDENCY_UNDECLARED` / `INVENTORY_DEPENDENCY_UNKNOWN` |
| runtime path | each step's file must be tracked and be this family's file, a declared `shared` file, or another family's file with that owner named; `external` steps must not name a file and must say `where` | `INVENTORY_RUNTIME_PATH_BROKEN` |
| authority | `enforcedBy` non-empty; files tracked; `UNKNOWN` must be alone with a note; a product family must name `ControlService` | `INVENTORY_AUTHORITY_INVALID` |
| native side | `none` ⇒ no files; anything else ⇒ tracked files | `INVENTORY_NATIVE_DRIFT` |
| readiness | recomputed from the retirement ledger + retirement gate coverage | `INVENTORY_READINESS_DRIFT` |
| retirement `oldPath` | must be a subset of the inventory's files for that family | `INVENTORY_RETIREMENT_PATH_DRIFT` |

---

## 4. Readiness, derived (not wished) `[MEASURED]`

Readiness is mapped from the retirement gate's own coverage derivation
(`scripts/ute-retirement-gate.mjs`, which reads
`tests/ute-g1-fs/golden/old-path.tsv`'s `entry` column, the new path's
`NEW-PATH-VECTOR <id>` lines and the `NC-MEMBER <member>` control lines):

| vocabulary | derivation |
|---|---|
| `baseline: none` | no member has a baseline vector |
| `baseline: partial` | some but not all members do |
| `baseline: complete` | every member does |
| `newPath: none` | the new-path term is not established |
| `newPath: prototype` | established for some members (a prototype cannot cover the unit by definition) |
| `newPath: complete` | every member reproduced by the new path |
| `negativeControls: none` | no control evidence at all |
| `negativeControls: partial` | family-level controls exist but not every member has its own line |
| `negativeControls: complete` | every member has its own control line |

**Measured today `[MEASURED]`:** only `dsh.fs-family` has a retirement row, and
the gate reads its coverage as `oldBaseline 3/4`, `newPathVerified 3/4`,
`negativeControlsPass 0/4` (no `read_image` vector; four family-level controls,
zero per-member lines) → `partial / prototype / partial`. Every other family has
**no retirement row** → `none / none / none`. That is an honest `none`: absence of
evidence is not readiness, and this inventory does not invent a row for a family
nobody has begun retiring.

---

## 5. What this inventory does NOT prove

1. **It is not a retirement licence.** `scripts/ute-retirement-gate.mjs` owns the
   four-term predicate and the `allowed` verdict. This inventory says *which files
   and definitions belong to a family and how a call reaches an effect today*, not
   that the family may be deleted.
2. **It does not prove the old and new paths are semantically equivalent.** The
   blocking semantic differences on FS (`lane-refusal-code`,
   `refusal-observation-shape`) are recorded in the retirement ledger and are not
   restated or resolved here.
3. **It does not prove the new path is correct.** `newPath: prototype` is a
   measurement of the FS prototype only; the other eight families have no
   native path at all (`none`).
4. **It does not prove a declared import is USED.** The parser proves the import
   statement exists; dead imports are a lint concern, not a retirement gap.
5. **It does not prove authority is effective.** It proves the files named are the
   real ControlService / guard / kernel implementations (`[MEASURED]` by reading
   them) and that a product family names them; whether the runtime actually denies
   a call is a per-family acceptance question (`TOOL-ACCEPTANCE-MATRIX.md`), not an
   inventory question.
6. **It does not claim the file list is complete by construction.** The universe
   rule is anchored on the booked census lanes and the family-body directory. A
   family implementation that lives somewhere else on the tree would not be caught
   by `INVENTORY_FILE_UNOWNED` — closing that requires a census/plan change, not a
   wider path heuristic (see §7).
7. **Test-only is not product evidence.** `dsh.u6-probe-family` is booked
   `test-only` and is inventoried so it cannot be forgotten; it must never be read
   as evidence about any product family.
8. **The dependency parser is a tokenizer, not a type checker.** It reads ESM
   static imports, literal `import()`/`require()` and `new URL(…, import.meta.url)`.
   A computed dynamic import with a variable specifier is invisible to it (the
   probe lane's two URL seams are literal, so they are covered; a future computed
   seam would need an explicit ledger note).

---

## 6. Required-CI wiring `[MEASURED]`

The checker runs on the **existing** required leg
`node scripts/eb3-family-definitions.mjs` (declared in
`dev/ci/eb3-ci-manifest.json` as the `eb3-family-definitions` leg, executed by
`ci-integration`, which `ci-required` calls). `scripts/eb3-family-definitions.mjs`
invokes `checkInventoryArm()` in-process and merges the inventory's findings into
its own finding list, so a red inventory is a red required job and the
`INVENTORY_*` code is printed verbatim.

**No new workflow file, no new manifest leg and no new argv shape.** The checker
wiring was chosen this way on purpose: the byte-identity rule in
`scripts/eb3-ci-required.mjs` grades a leg's YAML invocation against the manifest's
`check[]`, so appending a second command to an existing `run:` block would be
`CI_LAYER_LEG_UNPROVEN`, while adding a step or a leg is a workflow/manifest change
the UTE-3 instruction forbids unless proven necessary. Invoking the checker from the
leg that already loads the census achieves the same gate with zero workflow delta:
`node scripts/eb3-ci-required.mjs` reads `pass workflows=10 findings=0`.

**The suite needs one collection line, and only one.** The Test Catalog law
(`scripts/test-catalog.mjs`) refuses `UNCOLLECTED_NEW` / `UNCOLLECTED_GREW` for a
`*.test.mjs` that no dispatch leg runs, so a net-new suite cannot land without
being collected somewhere — a manifest `suites[]`/`check[]` entry, or the reviewed
uncollected baseline (the silent channel, refused here). Following the UTE-0/1/2
precedent, `scripts/ute-family-inventory.test.mjs` is appended to the **existing**
`ci-census` "next host lane" leg: one token in its `check[]` and the byte-identical
token in the existing `census-runtime.yml` `run:` line (the file lists are compared
element-by-element, so the order is identical). No leg, step, job or workflow file
is added, and `eb3-ci-required` still passes with the same `workflows=10`.

**Why the suite lives there and not on the required leg.** It is the same lane that
already runs `scripts/ute-retirement-gate.test.mjs` and
`tests/ute2-settlement/settlement.test.mjs`; the *checker* (not the suite) is what
the required `ci-integration` leg executes, and a red inventory therefore fails the
Required context without waiting for the deferred census layer.

## 7. Decisions the owner might disagree with `[PROPOSED-BY-MEMO]`

1. **`mechanics` is the class of helper/law/constant modules** (presentation
   faces, row-name constants, output schemas) because the closed role set has no
   finer word. The ledger says which file is which; the role is a coarse filter.
2. **Shared runtime files are declared in a top-level `shared[]` and cited in
   runtime paths** rather than duplicated into every family's `oldPath`. A family
   that owns no file in its own chain is refused, so "all shared" cannot hide.
3. **A cross-family runtime step must name its real owner** (`owner:`), and the
   cross-family edges are recorded in `importsAcrossRepo`. This makes the FS
   retirement's non-local consequence auditable rather than implicit.
4. **`readiness` is recomputed, not trusted.** A hand-edited readiness value that
   the evidence does not support is `INVENTORY_READINESS_DRIFT` (mutation-tested),
   which means the ledger's readiness columns are a mirror of the retirement
   evidence, not a second opinion.
5. **The dependency parser is hand-written and tested** rather than depending on
   `acorn` (which `eb3-family-boundaries` uses). The reason is independence from a
   devDependency that is not a root runtime dependency; the parser's limitations
   are stated in §5.8 and its specimens are in the suite.

## 8. Local gates observed (verbatim transcripts in the evidence directory)

| gate | result |
|---|---|
| `node scripts/ute-family-inventory.mjs` | `UTE-FAMILY-INVENTORY-SUMMARY families=9 files=92 findings=0` (exit 0) |
| `node scripts/ute-family-inventory.mjs --json` | parseable `ute-family-inventory-verdict/1`, findings 0 |
| `node --test scripts/ute-family-inventory.test.mjs` | 35 tests pass, `UTE-INVENTORY-MUTANTS total=27 red=27` |
| `node scripts/eb3-family-definitions.mjs` | `pass files=30 findings=0` (exit 0) |
| `node scripts/eb3-ci-required.mjs` | `pass workflows=10 findings=0` (exit 0) |
| `node scripts/docs-sync.mjs --check` | `findings=0 blocking=0` (exit 0) |
| `node scripts/check-artifacts-committed.mjs` | `verdict=ok compared=2104` (exit 0) |
| `node scripts/test-catalog.mjs --max-uncollected 41 --max-excluded 7` | `tests=883 … UNCOLLECTED 41 … refused=0 findings=0` (exit 0) |
| `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `new 0, resolved 0` (exit 0) |
