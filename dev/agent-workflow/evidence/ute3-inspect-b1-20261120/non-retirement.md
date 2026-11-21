# INSPECT family — non-retirement evidence (UTE-3 / G1, stage B1)

**Dated:** 2026-11-20 (session calendar). **Branch:** `task/ute3-inspect-b1-20261120`.
**Base:** `origin/master` = `69e292a29` at capture time.
**Scope:** the three members the reviewed census books for `dsh.inspect-family`:
`team_skill`, `team_cordis_inspect_list`, `team_cordis_inspect_query`.
**Machine transcript:** [`composition-probe.txt`](./composition-probe.txt)
(`node tests/ute-g1-inspect/probe-composition.mjs`).
**Marker discipline:** `README.md` §0 of `docs/plans/memo/ute-g1-20261120/` —
`[MEASURED]` means re-read the named path; `[UNKNOWN]` is never a pass.

> **This file is not a retirement baseline.** It is the proof that a same-name
> old-path-vs-new-path baseline **cannot be built for these members**, because
> the booked member name has exactly one implementation and the native/service
> side answers the capability under a *different* model-visible name. It records
> `oldBaseline: false`, `newPathVerified: false`, `negativeControlsPass: false`
> and one blocking, unapproved semantic difference. The retirement gate must
> refuse this family; refusing honestly is the result.

## 0. The Stage-0 answer, as a machine token

The probe derives these three lines by scanning the tracked `packages/**` tree
for `name:` declarations (following the family's `row-names.mjs` constant
through the builder parameter default) and by mounting the product route-C
composition. They are reproduced verbatim below so the retirement ledger's
`expect` tokens are backed by a committed file:

```
PROBE-INSPECT single-implementation=yes member=team_skill reason=one-row-definition-site:packages/tools/inspect-family/src/skill-row.mjs; the native/service side serves the capability under DIFFERENT names (skill) and claims no team_skill definition
PROBE-INSPECT single-implementation=yes member=team_cordis_inspect_list reason=one-row-definition-site:packages/tools/inspect-family/src/inspect-rows.mjs; the native/service side serves the capability under DIFFERENT names (cordis_inspect_list) and claims no team_cordis_inspect_list definition
PROBE-INSPECT single-implementation=yes member=team_cordis_inspect_query reason=one-row-definition-site:packages/tools/inspect-family/src/inspect-rows.mjs; the native/service side serves the capability under DIFFERENT names (cordis_inspect_query) and claims no team_cordis_inspect_query definition
PROBE-CONCLUSION booked-members=governed-family-body-only
```

**Conclusion:** `single-implementation=yes` for all three booked members. There
is no "legacy ToolPlane Family Body plus native path" pair to compare. The
family **does** have a governed family body (the Stage-0 assumption that it
might have none is refuted by measurement), but no second implementation of the
same name exists to switch to. A baseline that recorded effects for `team_skill`
and then asked the new path for `NEW-PATH-VECTOR …` would have to invent a
new-path name that does not exist; manufacturing one would be the fabricated
progress the instruction forbids.

## 1. Which modules serve each member today `[MEASURED]`

| member | declaring file (definition site) | symbol | family descriptor |
|---|---|---|---|
| `team_skill` | `packages/tools/inspect-family/src/skill-row.mjs:64-66` | `buildSkillRowDefinition({ skillName = SKILL_ROW_NAME })` | `packages/tools/families/inspect.mjs:44` (`claims()`) |
| `team_cordis_inspect_list` | `packages/tools/inspect-family/src/inspect-rows.mjs:19-21` | `buildInspectRowDefinitions({ listName = INSPECT_LIST_ROW_NAME })` | same `claims()` line |
| `team_cordis_inspect_query` | `packages/tools/inspect-family/src/inspect-rows.mjs:19,48` | `buildInspectRowDefinitions({ queryName = INSPECT_QUERY_ROW_NAME })` | same `claims()` line |

The three spellings are declared once, in
`packages/tools/inspect-family/src/row-names.mjs:20-22`:

```
export const SKILL_ROW_NAME = 'team_skill'
export const INSPECT_LIST_ROW_NAME = 'team_cordis_inspect_list'
export const INSPECT_QUERY_ROW_NAME = 'team_cordis_inspect_query'
```

The probe's scan reports **one definition site per member** and no second
`name:` declaration anywhere under `packages/**` (dist excluded). The executable
bodies are `skill-executor.mjs` and `inspect-executor.mjs`; the family
contribution is `inspect-family-contribution.mjs` (`visibility.nativeNames` =
the same three names); the OS effects are the governed anchored skill read and
the host `cordisInspect` registry read.

## 2. Is each member reachable on product route-C? `[MEASURED]`

The probe mounts `mountMemberA5sfRealm` and calls
`attachA5sfNativeToolModules` with the composition's `nativeToolModules`
config (empty: no host preset module is configured by the Team row), then
asks the real `ToolsService` for each booked member and dispatches it:

```
PROBE-ROUTE-C mounted=yes attach-fibers=0 composition=nativeToolModules=[] (no host preset module configured)
PROBE-ROUTE-C team_skill registered=no reachable=no refusal="Error: unknown tool \"team_skill\""
PROBE-ROUTE-C team_skill providerCalls=0 inheritedServiceCalls=0 guardFacts=0
PROBE-ROUTE-C team_cordis_inspect_list registered=no reachable=no refusal="Error: unknown tool \"team_cordis_inspect_list\""
PROBE-ROUTE-C team_cordis_inspect_list providerCalls=0 inheritedServiceCalls=0 guardFacts=0
PROBE-ROUTE-C team_cordis_inspect_query registered=no reachable=no refusal="Error: unknown tool \"team_cordis_inspect_query\""
PROBE-ROUTE-C team_cordis_inspect_query providerCalls=0 inheritedServiceCalls=0 guardFacts=0
```

`providerCalls=0`, `inheritedServiceCalls=0` and `guardFacts=0` are measured
(zero), not waived: the names never enter the registry, so no provider, no
inherited service and no guard consult can be reached. There is no mounting gap
to repair: the booked names belong to the governed plane, not to route-C.

## 3. What the legacy governed plane does with the names `[MEASURED]`

The plane **claims** the aliases (they are its own mount spellings) and
**refuses** the native spellings by the natexe law:

```
PROBE-PLANE claims=team_skill,team_cordis_inspect_list,team_cordis_inspect_query source=packages/tools/families/inspect.mjs
PROBE-PLANE member=team_skill alias-reserved=no claimed=yes
PROBE-PLANE member=team_skill native=skill reserved-native=yes native-claim=REFUSED-by-natexe-law (PLANE_SUPPORTED_NATIVE_TAKEOVERS is the complete truth of assembled same-name pairs)
PROBE-PLANE member=team_cordis_inspect_list native=cordis_inspect_list reserved-native=yes native-claim=REFUSED-by-natexe-law (...)
PROBE-PLANE member=team_cordis_inspect_query native=cordis_inspect_query reserved-native=yes native-claim=REFUSED-by-natexe-law (...)
```

`PLANE_RESERVED_NATIVE` (`packages/runtime/src/plugin/live/team-tool-plane.mjs:299`)
lists the native names; `PLANE_SUPPORTED_NATIVE_TAKEOVERS` (`:361`) records the
complete set of same-name pairs the surface assembles, and it contains no
`skill` / `cordis_inspect_*` entry. `row-names.mjs:6-18` states the ruling in
prose. So the plane knows all three aliases, claims them, and would refuse a
native-spelling takeover — it does not "not know" the names, and it does not
refuse the aliases.

## 4. The one implementation, executed (not merely named) `[MEASURED]`

`familyAssembly.build(cap)` with a fake admission (`decide`/`pa` = allow) and a
fake `cordisInspect` face produces the three definitions and they run:

```
PROBE-FAMILY-BODY definitions=team_skill,team_cordis_inspect_list,team_cordis_inspect_query
PROBE-FAMILY-BODY team_skill allow outcome=ok value={"name":"demo","provider":"filesystem",...}
PROBE-FAMILY-BODY team_skill unknown outcome=refused text="refused-admission skill-unknown — ..."
PROBE-FAMILY-BODY team_cordis_inspect_list outcome=ok value={"providers":[ ... ]}
PROBE-FAMILY-BODY team_cordis_inspect_query allow outcome=ok value={"platform":"host","provider":"probe.provider","method":"echo","data":{"echo":{"x":"y"}}}
PROBE-FAMILY-BODY team_cordis_inspect_query unknown-provider outcome=refused text="refused-admission inspect-provider-unknown — ..."
PROBE-FAMILY-BODY inspect-face calls list=3 query=1 inheritedServiceCalls=0
```

This proves the governed body is live and is the only body answering the
booked names. It is **not** a governed-plane dispatch: the kernel/PA mount is
not built here, and no guard file is written by direct family-body execution.
That limit is stated rather than hidden.

## 5. Where the native/service capability actually lives `[MEASURED]`

The design memo's "service-provided, not a tool-body fork" claim is measured in
the route-C row, not assumed:

- `skill` — the pinned host package `@deepseek-ai/dsh-tool-skill`
  (`tests/deepseek-harness-test-use/packages/skill/tool-skill/src/index.ts:82`,
  `name: 'skill'`) owns the row. Team contributes **no** tool definition; it
  mounts the `skills` **service** provider `a5sf-skill-provider.mjs`
  (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs:1189,1349`,
  `a5sfSkillProviderSpecOf`), which reads every body through the realm's
  confined `fs`. The host row is untouched (`A5SF_HOST_SKILL_PACKAGE` at
  `:1192`).
- `cordis_inspect_list` / `cordis_inspect_query` — the pinned host package
  `@deepseek-ai/dsh-tool-cordis`
  (`tests/deepseek-harness-test-use/packages/extensions/tool-cordis/src/index.ts:23,42`)
  owns the rows over the host `cordisInspect` service. Team contributes no
  native row; the governed rows call the **same** public service face
  (`packages/tools/inspect-family/src/inspect-executor.mjs`).

Therefore the capability has two serving mechanisms, but the **booked
model-visible name has one**. Retiring `team_skill` is not a switch to another
implementation of `team_skill`; it is a name/schema/presentation change to the
host `skill` row, which is a semantic change requiring an owner approval (the
ledger carries it as a blocking, unapproved difference).

## 6. What this file does NOT prove

1. **Not a baseline.** No `id`/`entry` effect table was captured for the three
   members; `oldBaseline` is `false`, and the gate refuses
   `UTE_OLD_BASELINE_MISSING`. This file is not a substitute for that table.
2. **Not a new path.** No rc.5 native module reproduces these names; there is
   nothing to reproduce. `newPathVerified` is `false`.
3. **Not negative controls.** No per-member control transcript exists for this
   family (`negativeControlsPass: false`); the probe's own lines are not
   controls.
4. **Not a governed-plane dispatch.** The family body was executed directly
   with a fake admission; the kernel/PA/guard seam is measured only by the
   inventory's runtime path, not re-run here.
5. **Not a retirement licence.** The family stays `NOT_RETIREABLE` with three
   unmeasured terms and one blocking difference.
6. **`[UNKNOWN]`** whether a future UTE-4 would retire the alias by adopting
   the host names (`skill` / `cordis_inspect_*`) as a semantic change, or keep
   the aliases forever. That is an owner decision, not a measurement.
7. **`[UNKNOWN]`** live-boot behaviour of the host `skill` + Team provider
   combination inside a real Member composition; the probe is host-free by
   design (no boot, no DSH_HOME, no port).

## 7. Reproduction

```bash
node tests/ute-g1-inspect/probe-composition.mjs \
  > dev/agent-workflow/evidence/ute3-inspect-b1-20261120/composition-probe.txt
node scripts/ute-retirement-gate.mjs --family inspect   # exit 1, the honest state
node scripts/ute-retirement-gate.mjs --all              # exit 1
```

The transcript is deterministic apart from the temp directory, which the probe
normalizes to `<tmp>`.
