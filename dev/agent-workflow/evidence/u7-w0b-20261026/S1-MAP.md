# S1 — `team-tool-plane.mjs` per-family site map (u7-w0b, base 88107ad71)

Plane line count at base: **2635** (`packages/runtime/src/plugin/live/team-tool-plane.mjs`).
ARC-A fitness classifies this file NOT protected (`u6-arc-a-fitness.test.ts:222`), so this
lane is a **product refactor**, not a `CORE_SEAM_BLOCKER`. CORE PATCH BUDGET = 0 throughout.

A "family" on this plane = the quadruple **(a)** static module imports, **(b)** a
`registry.register(contribution, {origin:'reviewed-manifest'})` block, **(c)** an
`ensure<X>ApprovalEntry` closure, **(d)** a boolean flag in `kernelFamilies` plus every
reader of that flag. Sites below are line ranges at 88107ad71.

## 1. Every per-family site

### 1a. Static imports (module-path coupling — one named import block per family)

| Family | Lines | Symbols pulled from the family module |
| --- | --- | --- |
| search (mechanics) | :87–88 | `createAnchoredSearchBackend`, `createAnchoredGlobBackend` |
| fs (read) | :94–96 | `buildReadRowDefinition`, `createGovernedReadExecutor`, `* as fs-mechanics`, `* as read-presentation` |
| fs (mutation, U7-9a) | :107–118 | `buildWriteRowDefinition`, `buildEditRowDefinition`, `buildImageRowDefinition`, 3 executor factories, `createBoundedImageReadPort`, `buildFsFamilyContribution`, `* as fs-mutation-mechanics` |
| process (shell) | :129–132 | `buildBashRowDefinition`, `buildProcessShellContribution`, `createConfinedShellBackend` |
| search (rows/contrib) | :145–147 | `buildSearchRowDefinitions`, `buildSearchContribution` |
| center | :148–151 | `createGovernanceKernel`, `createGovernedFamilyRegistry` (the Kernel faces — NOT a family) |
| jobs (bridge) | :162–166 | `buildJobsBridgeContribution`, `buildJobsManagementRowDefs`, `JOBS_MANAGEMENT_NAMES` (sibling file `./jobs-family-bridge.mjs`) |

### 1b. Backend / row construction (family-specific, interleaved with center code)

| Site | Lines | Notes |
| --- | --- | --- |
| `realSearch` (anchored rg) | :1670–1701 | needs `realmId`, `fsInstance.rootDir`, `confinedCfg`, observe |
| `realGlob` (anchored confined rg) | :1702–1712 | plus `templateId`, `instanceId`, glob-disabled switch |
| `realShell` (confined shell) | :1713–1734 | plus `cwdRoot`, `backgroundJobs` producer arm |
| `globDisabledShut` / `productionBackends` | :1735–1741 | per-family shut face |
| `searchRowDefs` | :1762–1782 | injected: realmId, decide, pa, 3 backends, names, callIdPrefix, effectAnchorRoot |
| `bashRowDef` | :1793–1808 | injected: realmId, decide, pa, shellBackend, `names.bash`, callIdPrefix |
| `defs` (search+bash block) | :1809–1815 | family-ordered def array |
| `readExecutor` | :1827–1840 | realmId, rootDir, policy, decide, pa, subtreeContains, observe |
| `jobsBridge` / `jobsShut` / `shutJobsText` / `jobsDefs` | :1854–1863 | jobs trio rows |
| `readRowDef` | :1874 | `buildReadRowDefinition({readName, readExecutor})` |
| `WRITE/EDIT/READ_IMAGE_NATIVE_NAME` | :1885–1887 | three hard-coded fs mutation spellings |
| fs mutation executors + image port | :1922–1960 | write/edit/image executors |
| `writeRowDef` / `editRowDef` / `imageRowDef` | :1961–1967 | |
| fs completeness refusal | :1969–1975 | `PLANE_FS_FAMILY_INCOMPLETE` |
| `fsFamilyRowDefs` / `baseDefs` / `allDefs` | :1976–1985 | family-ordered def arrays |
| `placedByName` | :1998 | name → placed definition (shared) |

### 1c. Registration blocks (one hand-written block per family, all `origin:'reviewed-manifest'`)

| Family | Lines | Refusal code | Flags set |
| --- | --- | --- | --- |
| fs (read+mutation, ONE candidate) | :2037–2065 | `PLANE_READ_REGISTRATION_REFUSED` | `read`, `fsMutation` |
| process (shell) | :2072–2089 | `PLANE_PROCESS_REGISTRATION_REFUSED` | `shell` |
| search | :2097–2115 | `PLANE_SEARCH_REGISTRATION_REFUSED` | `search` |
| jobs (named bridge; only with a real bridge body) | :2124–2140 | `PLANE_JOBS_REGISTRATION_REFUSED` | `jobs` |

`kernelManifest.capabilities` (:2019–2035) lists the five capability keys the registry may
back; it is already family-agnostic data but is written inline.

### 1d. Flag-bag and its readers (`kernelFamilies`, :2036)

`{ read, fsMutation, shell, search, jobs }` — five booleans, no descriptor, no key set.

| Reader | Lines | Effect if false |
| --- | --- | --- |
| `guard.owns` | :2206–2213 | name not kernel-owned (native path) — note `read/bash/grep/glob` are owned **unconditionally**, the flag only guards fsMutation names and the jobs trio |
| `guard.identityFor` | :2219–2236 | returns null → No-feed refusal |
| `familyIds` diagnostic | :2532–2537 | families listed in registration order |
| disposal block | :2593–2612 | `registry.revoke` + `dropApprovalsForFamily` per family, four hand-written pairs |
| ensure closures | :2255, :2286, :2314, :2342, :2371 | the gate each copy starts with |

### 1e. The five `ensure<X>ApprovalEntry` closures

| Closure | Lines | Count |
| --- | --- | --- |
| `ensureReadApprovalEntry()` | :2254–2276 | 23 |
| `ensureFsMutationApprovalEntry(name)` | :2285–2304 | 20 |
| `ensureBashApprovalEntry()` | :2313–2331 | 19 |
| `ensureSearchApprovalEntry(name)` | :2341–2360 | 20 |
| `ensureJobsApprovalEntry(name)` | :2370–2388 | 19 |

Plus five latch declarations: `readEntryAttempted` (:2253, boolean), `bashEntryAttempted`
(:2312, boolean), `fsMutationEntryAttempted` / `searchEntryAttempted` /
`jobsEntryAttempted` (:2284, :2340, :2369 — `Map<string,boolean>`).

### 1f. The dispatch site that picks a copy by name (two of them)

* `guard.identityFor` (:2215–2237) — if/else chain over name spelling → copy.
* `placementFeed` (:2390–2418) — nested ternary chain over name spelling → copy.

Both are per-family name knowledge expressed as control flow.

## 2. Exact diff between the five near-copies

Normalised (name/flag/latch/familyId substituted), the bodies are **identical** with
exactly these five axes of variation:

1. **Gate predicate** — `centerKernel.families.<flag> !== true`, one of
   `read` / `fsMutation` / `shell` / `search` / `jobs`.
2. **Name source** — `readName` / `bashName` (captured singletons) vs `name` (the argument).
   The three argument-taking copies additionally carry an *allowed-name* guard:
   fsMutation `if (name !== WRITE… && name !== EDIT… && name !== READ_IMAGE…) return null`
   (:2286), search `if (name !== grepName && name !== globName) return null` (:2343).
   jobs has **no** such guard (:2371) — its name set is enforced only by `jobsEntryAttempted`
   being pre-seeded from `JOBS_MANAGEMENT_NAMES` and by `addApprovalEntry`'s
   `NO_CANDIDATE` refusal downstream.
3. **Latch shape** — boolean for the two single-name families; `Map` keyed by name for the
   three multi-name families.
4. **`familyId` literal** — `'dsh.fs-family'` (twice: read :2272 and fsMutation :2300),
   `'dsh.process-family'` (:2327), `'dsh.search-family'` (:2356), `'dsh.jobs-family'`
   (:2383) — supplied by the **caller**, never derived from the registry.
5. **Comment prose** — the only other difference.

`diff` of the read copy against each other copy yields exactly those hunks and nothing
else (verified with comments stripped; see `s1-ensure-diff.txt`).

**Identical law in all five** (this is what S2 must preserve byte-for-byte in behaviour):

```
if (centerKernel === null || gate-false) return null
existing = kernel.approvalFor(scopeKey, name); if (existing !== undefined) return existing
if (latched(name)) return null                       // invalidation goes SILENT
d = placedByName.get(name);        if (d === undefined) return null
identity = definitionIdentityOf(d); if (identity === null) return null   // pre-mint: NOT latched
latch(name)
added = kernel.addApprovalEntry({ scopeKey, nativeName: name, definitionIdentity: identity, familyId })
if (added.ok !== true) return null                   // no live claiming candidate
return kernel.approvalFor(scopeKey, name) ?? null
```

## 3. What each family's builder takes from the plane

Every builder is a pure function; the plane is the only caller and passes an
**implicitly-typed bag**. Nothing in the plane constructor names what each family may
receive — that is the seam S3 closes.

| Family | Builder | Inputs the plane supplies |
| --- | --- | --- |
| fs (read) | `buildReadRowDefinition` | `readName`, `readExecutor` (a plane-built closed-over executor) |
| fs (write/edit/image) | `buildWriteRowDefinition` / `buildEditRowDefinition` / `buildImageRowDefinition` | native name literal; the corresponding plane-built executor; for image also `imageRouteResolver` |
| fs (one candidate) | `buildFsFamilyContribution` | 4 × `{definition, executorFactory, [readPortFactory]}` + 3 mechanics namespaces + `cancelBoundary` string |
| process | `buildBashRowDefinition` | `{realmId, decide, pa, shellBackend, names:{bash}, callIdPrefix}` + `createGovernedShellRowDefinition` (a5p5 trio face) |
| process (candidate) | `buildProcessShellContribution` | `definition`, `launcherPin` (from `confinedCfg.assembly.launcherSha256`), `cancelBoundary` |
| search (rows) | `buildSearchRowDefinitions` | `{realmId, decide, pa, searchBackend, globBackend, shellBackend, names, callIdPrefix, [effectAnchorRoot]}` + `createGovernedToolDefinitions` |
| search (candidate) | `buildSearchContribution` | `grepDefinition`, `globDefinition`, `launcherPin`, `cancelBoundary` |
| jobs | `buildJobsManagementRowDefs` | `{jobsBridge, shutJobsText, PLANE_PRESENTATION_FACE}` |
| jobs (candidate) | `buildJobsBridgeContribution` | `bridge`, `definitions`, `hostPin`, `cancelBoundary` |

Authority-bearing inputs (`permissionPolicy`, `decide`, `pa`, `realmId`, `confinedCfg`) are
passed **into** every family row builder — i.e. the plane currently hands each family
capability handles it would be the seam's job to enumerate and bound. S3 must make that
enumeration explicit and keep approval/grant handles out of it.

## 4. Baseline (measured at 88107ad71, `npx vitest run`, 14 files / 178 tests, all green)

Log: `baseline-vitest.log`; the five-copy `diff` transcript: `s1-ensure-diff.txt`. Suites: `u7-9a-fs-mutation-c1`, `u6-pr2/pr3/pr5-kernel-flow`,
`u74a-jobs-producer`, `a5p2-admission-kernel`, `u6-arc-a-fitness`,
`u6-pr6-arc-d-adversarial`, `u6-pr6-arc-d-matrix`, `a5p7-lane-hygiene`,
`u6-pr2-read-golden-vectors`, `u6-pr3-shell-golden-vectors`,
`u6-pr5-search-golden-vectors`, `u7-9a-mutation-golden-vectors`.

The four golden corpus digests pinned in those suites (byte-identical replay law):

| Row family | Vectors | Digest |
| --- | --- | --- |
| read (u6-pr2) | 2893 | `bfa69f58df48b9ff7881aef6b5eb1d750b02f18a362d9c6202468ff856c6eacf` |
| bash (u6-pr3) | 299 | `efb096a6140530d913ab2b5483d59c981843aa4b57e599fac451c93ae1d02964` |
| search (u6-pr5) | 409 | `0dabc187cae53bc0b22e7573b4c442f5dcdeb2f2f2f98aef79bfbd9a653e3de8` |
| fs mutation (u7-9a) | 1440 | `91fee9a6ff7ea6db450e49b7fd2b39b142a3fc06d4f924664521a69329da332b` |
