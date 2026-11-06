# a5sf-surface — the leader's model-facing surface, graded before a start

**Date**: 2026-11-08 (session calendar; real UTC 2026-11-07)
**Task**: `task/a5sf-surface-20261108`
**Base**: `origin/master` = `e0f18df3b702370cd50b475d18b8d9758a1fe9d0`
**Boots spent**: **0**. No port, no `DSH_HOME`, no pristine-checkout write, no
`harness.boot(`. `:3080` and its home were never touched.
**Scope**: extend the existing shared preflight (`tests/world-factory/lib/a5sf-acceptance-preflight.mjs`,
entry `scripts/a5sf-preflight.mjs`). No new harness, no second entry point. One
new check id (`driver.leader-surface`), one tightened check (`driver.log-capture`),
17 check ids total.

---

## 1. The gap this closes

BL-17 boot 4 (`task/a5sf-bl17-live2-20261108`, tree `e0f18df3…`) spent the fourth
of five P2-04 starts. The Host booted healthy on 3184, and `team.create` answered
`200` with:

```
TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED
permission coverage gate failed for instance 'inst-leader': 2 unmanaged tool(s)
on the final model-facing surface: u5_canary (unknown-unm…
```

The driver's `mainBlueprintYaml()` wrote `builtinToolDeny: []`
(`dev/agent-workflow/evidence/a5sf-bl17-live2/run-boot.mjs`, the
`'    builtinToolDeny: []'` line). The World always composes the `u5-canary` row
(`tests/world-factory/lib/world-factory.mjs:63-64`,
`tests/world-factory/canary/u5-canary-plugin.mjs` → `u5_canary`) and, for a `u6Fs`
World, the `u6-fs-probe-host` row
(`tests/world-factory/world-kinds/010-u6-fs.mjs` → `u6fs_probe`). Neither name had
an authority owner, so A2C-2 refused the root agent **before any model turn**
(`final-mock-requests.json` = `[]`).

The preflight that ran immediately before the start was **PASS 16/16, exit 0**. It
was honest: every check graded blueprint IDs, counts, order and capture
*declarations* — and none of them graded the tool surface the root agent would
actually be handed. The run's own README §5 names this blind spot. This change is
the missing check plus the driver fix, both host-free.

---

## 2. The predicate, and where A2C-2's equivalent lives

The check applies **the same set algebra and the same six-class classifier** the
product applies at setup. There is no second policy vocabulary.

Product side (one file):

| fact | location |
| --- | --- |
| managed vocabulary (`managed`) | `packages/domain/blueprint/src/schema.ts:421-429` (`PERMISSION_TOOL_NAMES`: `read, read_image, write, edit, lsp, bash, pwsh`) |
| `SAFE_UNMANAGED` registry | `packages/runtime/operation-permission/permission-coverage.ts:130` (`todo_write`) |
| `KNOWN_SENSITIVE` exact names | `packages/runtime/operation-permission/permission-coverage.ts:146-175` |
| `KNOWN_SENSITIVE` family prefix | `packages/runtime/operation-permission/permission-coverage.ts:180` (`job_`) |
| the classifier (fixed precedence) | `packages/runtime/operation-permission/permission-coverage.ts:294-341` (`classifyPermissionCoverageTool`) |
| the whole-surface verdict | `packages/runtime/operation-permission/permission-coverage.ts:333-372` (`evaluatePermissionCoverage`; `ok ⇔ unmanagedTools.length === 0`) |
| the LIVE call site | `packages/runtime/src/plugin/live/agent-bindings.mjs:3549-3579` — reads the final surface after `builtinToolDeny`'s masking, passes `PERMISSION_TOOL_NAMES` as `managedToolNames`, `[...selectedTeamToolNames, ...a5PlaneOwnNames]` as `teamToolNames`, the proven MCP delta as `mcpToolNames`, and throws `PermissionCoverageUnmanagedError` |
| the typed error / inner code | `packages/runtime/operation-permission/errors.ts:423-431`; code `alpha2-permission-coverage-unmanaged-tools` |

Host-free side (this change, `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`):

```js
finalSurface = unique(declaredSurface) − builtinToolDeny
for name of finalSurface:
    class = classifyLeaderSurfaceTool(name, { managed, teamTools, mcpTools, safeUnmanaged })
    if class ∈ { known-sensitive-unmanaged, unknown-unmanaged }:
        finding POLICY_SURFACE_UNMANAGED { toolName, classification }
```

`classifyLeaderSurfaceTool` has the **same fixed precedence** as the product:
managed → team → MCP → safe-unmanaged → known-sensitive (exact names, then the
`job_` prefix) → unknown. Both fatal classes produce the one finding code
`POLICY_SURFACE_UNMANAGED`, exactly as the product folds both into
`unmanagedTools` and refuses the agent.

### How the two cannot drift

1. **One shared rule, not two copies of a list.** The deny list a corrected driver
   writes is produced by `discoveryFirstDenyList()` exported from the *same*
   module the check uses, and the evidence driver helper
   (`driver-fix/leader-surface-discovery.mjs`) calls it directly. The check and
   the driver cannot disagree about a name — they run the same function.
2. **A drift guard against the product.** Test `E10` reads
   `permission-coverage.ts` and `schema.ts` and asserts that all four mirrored
   registries are **equal** to the product's literals, and that the product
   classifier's branch order is still managed → team → MCP → safe → sensitive →
   prefix. If the product gains a tool, a safe entry or a sensitive name, `E10`
   goes red until the mirror is re-derived.
3. **The `discovery-first` sentinel is graded, not trusted.** A bundle that says
   `builtinToolDeny: "discovery-first"` is not waved through: the check computes
   the list from the declared surface and still requires the resulting final
   surface to be coverage-clean.

What this still cannot do: it grades the **declaration**. A driver could declare
`discovery-first` and then write a different static list. That residual is exactly
the same residual `driver.log-capture` has always had (declaration, not runtime
follow-through), and it is stated in §6. The one thing the change does remove is
the *silent* version of the bug: the surface is now a declared fact, so a driver
that never states it is `UNKNOWN`, never `PASS`.

---

## 3. The declaration the bundle must carry

`driver.blueprint.leader` (aliases accepted: `driver.leaderSurface`,
`bundle.leaderSurface`):

```json
{
  "blueprintId": "team.a5sf.bl17.main",
  "tools": ["bash", "edit", "read", "read_image", "write",
            "team_delegate", "team_archive_member", "u5_canary", "u6fs_probe"],
  "builtinToolDeny": [],
  "teamTools": ["team_delegate", "team_archive_member"],
  "worldRows": {"u5-canary": ["u5_canary"], "u6-fs-probe-host": ["u6fs_probe"]},
  "presetTools": ["bash", "edit", "read", "read_image", "write"]
}
```

- `tools` — the complete names the World + preset + selected Team tools would put
  on the leader's model-facing surface (the surface **before** `builtinToolDeny`
  removes names). Required.
- `builtinToolDeny` — the blueprint's list, or the sentinel
  `"discovery-first"`. Required.
- `teamTools` — the names the blueprint actually selected and registered (plus any
  placement-owned plane names). A2C-2's team owner is assignment-based; a `team_`
  prefix is **not** ownership (the canonical `040` kit uses the prefix as a
  heuristic; this check does not).
- `managed` / `safeUnmanaged` / `mcpTools` — optional ownership facts; absent,
  the product mirrors apply.
- `worldRows` / `presetTools` — optional provenance. Every name they contribute
  must also appear in `tools`; otherwise the check fails
  `POLICY_SURFACE_DECLARATION_INCONSISTENT` (an under-declared surface would
  otherwise pass by grading a smaller set than the World surfaces).

Verdict rules:

- no driver plan / no leader declaration / no `tools` / no `builtinToolDeny`
  → **UNKNOWN** with a named reason — never `PASS`;
- malformed anything → **FAIL** `POLICY_SURFACE_INVALID`;
- a name surfaced but neither denied nor managed → **FAIL**
  `POLICY_SURFACE_UNMANAGED` (one finding per name).

`PREFLIGHT_VERDICTS` is unchanged (`PASS | FAIL | UNKNOWN`), the one-line
`DSH-A5SF-PREFLIGHT {…}` shape is unchanged, and the exit codes are unchanged
(0 PASS, 1 FAIL, 2 unreadable, 3 UNKNOWN).

---

## 4. Boot #4, reproduced host-free

[`boot4-repro.bundle.json`](boot4-repro.bundle.json) is the spent run's declaration
as a full pre-boot bundle: the same World rows, the same BL-17 base preset tools
(`persona` + `tool-fs` + `persistent-shell` → `read/read_image/write/edit/bash`),
the same two selected Team tools, and the blueprint's literal
`builtinToolDeny: []`. The surface members are a **reconstruction** from the run's
own evidence (composed profile, `abort-diagnosis.json`, the driver's blueprint
text) — the spent run never declared them, which is the point.

Actual CLI payload ([`boot4-repro.payload.txt`](boot4-repro.payload.txt), exit 1):

```
DSH-A5SF-PREFLIGHT {"schema":"a5sf-zero-boot-preflight/1","verdict":"FAIL",
 "summary":"FAIL 15/17 checks blocks=POLICY_SURFACE_UNMANAGED unknown=driver.log-capture",
 "findings":[
  {"code":"POLICY_SURFACE_UNMANAGED","toolName":"u5_canary","classification":"unknown-unmanaged",
   "detail":"tool \"u5_canary\" would be on the leader's final model-facing surface but is neither
             denied (builtinToolDeny) nor managed (managed/teamTools/mcpTools/safeUnmanaged);
             A2C-2 would refuse team.create with alpha2-permission-coverage-unmanaged-tools
             (unknown-unmanaged)"},
  {"code":"POLICY_SURFACE_UNMANAGED","toolName":"u6fs_probe","classification":"unknown-unmanaged", …}
 ]}
```

Exactly two findings, exactly `u5_canary` and `u6fs_probe`, exactly the
`alpha2-permission-coverage-unmanaged-tools` refusal the live run hit. `driver.log-capture`
is `UNKNOWN` for this bundle on purpose: the spent run declared a body capture and
**no retention**, so the tightened check refuses to certify "no truncation" from
silence (it contributes no finding). The summary's `blocks=` tail names only the
surface finding.

---

## 5. The driver fix: discovery-first, not a static list

[`corrected.bundle.json`](corrected.bundle.json) — same World, same preset, same
surface — declares `builtinToolDeny: "discovery-first"` and
`captureLimits.body.maxChars = null` on every fail-capable body capture.

Actual CLI payload ([`corrected.payload.txt`](corrected.payload.txt), exit 0):

```
DSH-A5SF-PREFLIGHT {"schema":"a5sf-zero-boot-preflight/1","verdict":"PASS",
 "summary":"PASS 17/17 checks", …}
```

The driver-side implementation is
[`driver-fix/leader-surface-discovery.mjs`](driver-fix/leader-surface-discovery.mjs):
`surfacedToolNames(request)` → `buildLeaderSurfaceCapabilities(...)` →
`renderBuiltinToolDenyLines(...)`, the pure half of the canonical
discovery→deny→create sequence
(`tests/world-factory/suites/040-u6-arc-a.mjs:159-161`,
`tests/world-factory/lib/u6-fs-assembly.mjs` `mainBlueprintYaml(denyList)`,
`tests/world-factory/u7-tbash.test.mjs:43` for the minimal form). For the boot-#4
surface it computes exactly `[u5_canary, u6fs_probe]`; for the canonical u6-fs
surface it computes `[glob, grep, u5_canary, u6fs_probe]`.

**Why discovery-first and not the two names.** A static list is the bug class:
boot 4 would have been fixed by adding `u5_canary` and `u6fs_probe`, and the next
preset change, World row, or Team-tool selection would reproduce the abort with a
new name while the declaration still says `PASS`. Discovery-first reads the
**actual** surface (before `team.create` the anchor root carries the same preset
as the leader, and the World rows are already mounted), so the list grows with
the World by construction. Test `E4` is the anti-rot proof: adding `u9_new_probe`
and `job_control_face` to the corrected declaration still PASSes (the deny list
grows to four names), while the same addition to the static CLEAN declaration goes
red on exactly the new tool.

The driver must pass the **selected Team tool names** (the ones it wrote in the
same blueprint, plus placement-owned plane names) as `teamTools`; the rule does
not guess `team_` by prefix. That matches A2C-2's `teamToolNames` argument
(`agent-bindings.mjs:3564`).

`corrected.bundle.json` also declares the discovery step itself:
`discover-leader-surface` produces `leader-surface` and `create-team` requires
it, so `driver.gate-order` (unchanged, no new check) refuses a driver that
creates before it discovers — the declared-precondition half of the same fix.

---

## 6. `driver.log-capture`: what it now catches, and what it cannot

Boot 4 PASSED `driver.log-capture` while the run record sliced the `team.create`
body at **400** chars and the thrown Error at **300**, so the second unmanaged
tool name (`u6fs_probe`) had to be inferred from `2 unmanaged tool(s)` plus the
World's other row. `captures: ["body"]` was declared; retention was not.

The check now requires every fail-capable, body-capturing step to declare its
retention, and refuses a declared truncation:

- `captureLimits: { body: { maxChars: null } }` (or `null`) → unbounded, PASS;
- `captureLimits: { body: { maxChars: n } }` with `n >= DRIVER_BODY_CAPTURE_MIN_CHARS`
  (4096) → PASS;
- `n < 4096` → **FAIL** `DRIVER_CAPTURE_TRUNCATED` (the boot-4 400-char shape);
- `bodyTruncated: true` → **FAIL** `DRIVER_CAPTURE_TRUNCATED`;
- **no retention declared on a body capture** → **UNKNOWN**
  `DRIVER_CAPTURE_LIMIT_UNDECLARED` — "no truncation" is not certified from
  silence.

Negative control: [`negative-controls/log-capture-truncated.bundle.json`](negative-controls/log-capture-truncated.bundle.json)
sets the `team.create` limit to 400 — exactly one red check
(`DRIVER_CAPTURE_TRUNCATED`, `maxChars:400`, `minimum:4096`), payload in
[`negative-controls/log-capture-truncated.payload.txt`](negative-controls/log-capture-truncated.payload.txt).

**What it still cannot do.** It grades the *declaration*, not the driver's
follow-through: a driver can declare `maxChars: null` and still `.slice(0, 400)` in
code. Closing that half needs a runtime assertion in the driver's own HTTP helper
(refuse a fail-capable call whose capture sink clips) or a boot that fails and is
then read — neither is host-free. What the change does guarantee is that the
*boot-4 shape* (a declared body with no retention, or an honest 400-char
retention) is visible as `UNKNOWN`/`FAIL` before the start instead of `PASS`.

---

## 7. Negative controls and tests

Committed bundles, each re-read by the suite (test `E9`), so the payload cannot
drift away from the code:

| bundle | target check | expected |
| --- | --- | --- |
| [`boot4-repro.bundle.json`](boot4-repro.bundle.json) | `driver.leader-surface` | FAIL, exactly one red, `u5_canary` + `u6fs_probe` |
| [`corrected.bundle.json`](corrected.bundle.json) | — | PASS 17/17 |
| [`negative-controls/log-capture-truncated.bundle.json`](negative-controls/log-capture-truncated.bundle.json) | `driver.log-capture` | FAIL, exactly one red, `DRIVER_CAPTURE_TRUNCATED` |

Each directory also carries the exact CLI stdout as `*.payload.txt` and the
pretty-printed payload as `*.result.json` (both produced by
`scripts/a5sf-preflight.mjs` on this tree with the pristine host redirected via
`--host-root`; the `inputs` block records the roots used).

Test deltas in `tests/world-factory/a5sf-acceptance-preflight.test.mjs`
(54 → 65 tests):

- `E1` id set + clean PASS; `E2` boot-#4 control (also asserts `log-capture` is
  `UNKNOWN`, not `PASS`); `E3` undeclared surface/deny → `UNKNOWN`; `E4`
  discovery-first PASS + anti-rot; `E5` six classes; `E6` under-declaration; `E7`
  log-capture truncation/`UNKNOWN`; `E8` CLI reproduction (one line, exit 1);
  `E9` committed bundles load-bearing; `E10` product drift guard; `E11` driver
  helper == check rule.

---

## 8. Honest limits

- The check grades a declared surface. It cannot prove the driver wrote that
  declaration into `main.yaml` or that the host surfaced exactly those names; the
  live A2C-2 gate remains the final authority. The two agree **given** the
  declaration — which is the entire point of making it a bundle fact.
- The boot-#4 surface is a reconstruction (composed rows + preset + selected Team
  tools + the driver's quoted blueprint); the observed run never declared it.
  The two failing names are the ones the live gate named/implied; the check names
  both from the reconstruction, not from a re-run.
- The discovery-first helper needs one pre-create model request (the canonical
  pattern's discovery prompt). This change does not add that request to any
  driver; the next driver must, and §9 names why that is the next risk.
- No grade, no `V@B`, no matrix pointer, no existing evidence file was changed;
  `CORE PATCH BUDGET = 0` (no product change).

---

## 9. Most likely remaining reason the last start aborts

**For the earmarked BL-18 (web) start: the deny lane will be declared on the product
config path, which refuses it by design, so the Host dies at composition
(`NETWORK_UNCONFINED_REALM`) before the probe runs.**

`dev/agent-workflow/evidence/a5sf-web/README.md` §8/§8b is explicit: the product
config path (`a5sfMemberPolicies` + `blueprintSource` in `product-assembly.ts`)
**deliberately refuses** a narrowing `network: deny` ceiling and a narrowing
ToolBinding. The deny lane is only reachable through the OPTIONAL public
`teamA5sfRealm` service seam — a composition row that `ctx.provide`s a
`compiledFor()` answer carrying `{ effective, provider: { fetch, search } }`.
There is no live BL-18 driver on `master` yet (`evidence/a5sf-web/` is host-free
arms and a checklist), so the first BL-18 driver will be written by copying the
FS/Search/boot-4 driver shape — and that shape declares `permissions` /
`policyStates` in the blueprint and a plain realm row. On BL-18 that is exactly
the path `product-assembly.ts` refuses: the start is spent on a typed
composition refusal (`NETWORK_UNCONFINED_REALM`, before any scope or probe), not
on a row result. The fix is a composition row like
`<world>/rows/bl18-web-offer-row.mjs` (the web README ships the exact
`compiledFor()` sketch), plus a discovery turn on the anchor preset that really
exposes `web_fetch` — if the base preset has no web face, the surface assertion
fails before `team.create` (the search driver's `if (!surface.includes('grep'))
throw` is the precedent).

A5C-2 is not the risk any more: with `discovery-first` the leader denies
`web_fetch` on its own surface (it is `known-sensitive-unmanaged`), which is
coverage-correct but means **the leader cannot be the web caller** — the BL-18
probe must ride a Member/native module, not the leader's model turn. A driver
that scripts the leader to call `web_fetch` will get a tool-surface error (or an
A2C-2 refusal if it forgot the deny), not a denial fact.

**If the owner instead spends it on an FS/Search re-validation**, the most likely
abort is the **discovery turn shifting the mock script's turn accounting**:
discovery-first adds the first model request (boot 4 made zero), and the fixed
mock script's first reply is then consumed by the anchor-root discovery turn
rather than the created leader's first turn, so the item-1 script lands on the
wrong session and the PTY oracle reports `NOT_REACHED`. The mitigation is a
marker-routed mock (`MK_DISC` → harmless no-tool reply, item scripts keyed on
their own markers) plus a declared `discover-leader-surface` step with
`produces: ["leader-surface"]` preceding `create-team` — `driver.gate-order`
already grades that declaration with no new check.
