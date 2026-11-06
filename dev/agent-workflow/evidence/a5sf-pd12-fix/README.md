# PD-12 fix — `network: deny` now governs the Member's model-visible `bash`

**Status:** `FIXED` (draft PR, branch `task/a5sf-pd12-fix-20261110`, **not merged**). `DEV-LIVE` +
host-free evidence; **0 candidate starts**, no `V@B` movement, no grade change.
**Register:** `PRODUCT-DEBT-REGISTER.md` PD-12 — `FIXED` with residuals (1)–(5).
**Not closed by this lane:** PD-13 (read axis of a shell body), BL-42 (an `enforced` network backend).

This directory is the evidence for one claim:

> On a Member realm that installs the confined `subprocess` face and declares a `shellClass`, the
> model-visible `bash` tool is now served by that face. The compiled ceiling's `network: deny` is
> therefore **consulted on the path the tool takes**, and the call is refused *at admission* with
> `NETWORK_UNCONFINED_REALM` naming `network-destination`, with **zero** provider calls and **zero**
> processes. The refusal is still an **admission** refusal, not an OS-level network denial.

Everything below either proves that sentence, proves which mechanism makes it true, or states what
it does not cover.

---

## 1. The defect, pinned first

Before this fix the same Member, same lane, ran `bash` on the shipped `SandboxBashExecutor` over the
**inherited** base `subprocess` service; the confined provider was called 0 times and the `bwrap`
argv carried no `--unshare-net` (live: `evidence/a5sf-sub-devlive/`, boots 10/11).

The pin is the first arm of `tests/world-factory/a5sf-pd12-bash-governance.test.mjs` (`P0`). It
asserts that **old behaviour verbatim**, and is skipped by the normal gate unless `A5SF_PD12_PIN=1`
(a committed red test would rot the gate; the flip is recorded in the two logs).

| arm | pre-fix tree (row change stashed) | fixed tree |
|---|---|---|
| `P0` defect pin: deny `bash` **executes**, base spawn +1, confined provider 0 | **PASS** (the hole, asserted) | **FAIL** — this is the fix |
| `D1` deny `bash` refused, typed code names the capability, 0 provider / 0 base | FAIL | PASS |
| `A1` allow `bash` served by the confined face end to end | FAIL | PASS |
| `A2` no `network` axis still allows | FAIL | PASS |
| `S1` surface neutral (one `bash`, name set unchanged) | PASS | PASS |
| `C1` shadow removed ⇒ the hole returns | PASS | PASS |
| `C2` realm without the confined face ⇒ no shadow, old path | PASS | PASS |
| `C4` no `shellClass` ⇒ `SUBPROCESS_SHELL_NOT_DECLARED` first | FAIL (it executed) | PASS |

- `pin-before.log` — `A5SF_PD12_PIN=1` with only `a5sf-realm-row.mjs` reverted: `P0 ✔`, `D1/A1/A2/C4 ✖`.
- `pin-after.log` — same command on the fixed tree: `P0 ✖` (by design), `D1/A1/A2/S1/C1/C2/C4 ✔`.

The two logs are the pin's before/after; the fixture, the world and the command are byte-identical
between them, so the flip is a property of the product path, not of the test.

## 2. The mechanism, and why it makes the ceiling term true

Route C already re-registers native tool modules **inside the Member's isolated scope** after
`applyBuiltInToolDeny`, which shadows the preset's definition for that agent (the same seam that
serves the FS/search pair). PD-12 extends that seam by one row instead of inventing architecture:

1. `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` — `confinedBashSpecOf(realm, nativeSpecs,
   surface)` returns a spec for `./confined-bash-tool.mjs` **only when**:
   - the agent's current tool surface already contains `bash` (so `builtinToolDeny` still wins and
     the tool name set cannot grow), **and**
   - `realm.installation.members[0].faces.subprocess` is non-null (there is a confined face to route
     to), **and**
   - no configured native module already owns `bash`.
2. `attachA5sfNativeToolModules` appends that spec to `nativeSpecs` (and no longer returns early
   when there are no configured specs, because the shadow may be the only one).
3. `packages/runtime/src/plugin/live/confined-bash-tool.mjs` registers the `bash` tool with the
   preset's parameter shape (`command`, `description`, `timeoutMs`, `workdir`), resolves the cwd
   inside the Member workspace, and submits a closed `ConfinedSpawnSpec`:
   `argv = ['/bin/bash', '-c', command]`, the resolved cwd as **both** the declared read and write
   root, explicit stdio (stdin ignored), a grace period, and the caller's abort signal.
4. The face runs its normal admission order — shell-class admission → attribution → lane guards →
   **network capability probe** → provider. On a `network: deny` lane the probe step is what now
   answers, so the denial happens **before** the provider is ever asked to spawn.
5. `mountNativeToolModules` already refuses subprocess-consuming modules on realms without the face
   (`SUBPROCESS_UNCONFINED_REALM`); the face-presence check above mirrors that rule at the row level.

Why the ceiling term is now true *on this path*: the call's argv/cwd/roots are the confined face's
inputs, the face compiles/uses the Member's `EffectiveIoPolicy`, and `network: deny` is evaluated by
the face before spawn. There is no second executor behind the tool name in that scope: `D1` measures
the base executor at 0 and the provider at 0, and `A1` measures the provider at exactly 1.

## 3. Mutation controls — which assertion each mutation reds

`mutation-controls.mjs` (run: `node dev/agent-workflow/evidence/a5sf-pd12-fix/mutation-controls.mjs`)
performs a single literal edit in the **real source**, runs the suite, requires the exact RED set,
then restores the bytes and verifies their sha256. A control that fails to produce the expected RED
pattern exits non-zero; "no RED" is a failed control, never a pass.

| control | single edit | must red | must stay green | observed |
|---|---|---|---|---|
| `MA` shadow row removed | `const bashSpec = confinedBashSpecOf(...)` → `undefined` | `D1` (deny executes again), `A1` (base serves, no provider), `A2`, `C4` | `S1`, `C1`, `C2` | `RED-AS-REQUIRED` red=`[D1,A1,A2,C4]` |
| `MB` network admission removed | `if (networkDenied) {` → `if (false && networkDenied) {` in `team-services/src/subprocess.ts` | `D1` only (the shadow still routes to the face, but the deny is no longer consulted) | `A1`, `A2`, `S1`, `C1`, `C2`, `C4` | `RED-AS-REQUIRED` red=`[D1]` |

`MA` is the required "removing the shadow row must turn the fixed assertion red". `MB` is the
discriminating control for "the refusal is the network term": with the same shadow, removing only
the admission makes `D1` red while every allow-axis arm stays green. Full record:
`mutation-controls.json`.

In-suite controls (no source mutation): `C1` removes the shadow through the product's own
`disposeNativeToolModules()` and restores the pre-fix path; `C2` is a realm with no confined face
(no shadow); `C4` is the same deny world without a declared `shellClass` (the shell admission decides
first, so the capability code is not the one that names the refusal).

## 4. Live run pair and the deciding observation

Driver: `driver/run-boot.mjs` (a copy of `evidence/a5sf-sub-devlive/driver/run-boot.mjs`; the same
WorldFactory / harness / ledger / lease / slot discipline, the same `LOCUS` style; only the two
`bash`-path propositions and their samples changed). Real Hosts on the pinned tree
(`639ed015397290b3745d163aafe02ffee4aa3f84`), ports in the **3180** family (3184/3185 observed),
`DSH_HOME` under `tests/homes/`, one dev Host at a time (≤2 cap), teardown removed the home and
released the ports:

| run | run id | cases | result |
|---|---|---|---|
| `runs/boot02` | `a5sf-pd12-2026-11-06T14-40-14-719Z` | 4 | **PASS 4/4** (`executor`, `face-admitted`, `network-deny`, `denyBash` all PROVEN) |
| `runs/boot03` | `a5sf-pd12-2026-11-06T14-41-37-054Z` | 4 | **PASS 4/4**, identical verdicts and clauses |

Ledger: `driver/run-ledger.jsonl` — 9 rows, **every row `recordClass: "DEV-LIVE"`** (3 boots ×
intent/boot/outcome). `driver/grant.json` binds the start to commit
`3313bdf08919313d03abf78e57dcfb6c6ff957c9`; the authorisation is the shared DEV-LIVE Subprocess grant
(`devlive-subprocess-1`, world `u5a5sfsub1`). `boot02`/`boot03` were preceded by an identical
successful start (`run-01.log`); the pair is the preserved, complete artefact set.

The **deciding observation** is the locus pair, not the verdict text:

- allow lane, `runs/boot02/probe-report.json#executor`:
  `confined-provider-called-once` = 1, `confined-spawn-recorded` = 1,
  request argv `["/bin/bash","-c","printf 'A5SF_SUB_BASH_…'; sleep 1.5"]`,
  `networkProfile` `null`; `base-executor-not-reached` = 0, `shell-executor-not-reached` = 0.
- deny lane, `runs/boot02/probe-report.json#denyBash`:
  `typed-refusal-code` = `NETWORK_UNCONFINED_REALM`, the message names
  `network-destination='unsupported'`; `zero-confined-provider-calls` = 0,
  `zero-base-spawns` = 0, `zero-shell-execs` = 0, `zero-proc-sightings` = 0 (independent `/proc`
  scan), `body-never-ran` = true.

Correct outcome with wrong attribution is a false pass, so each clause names its own counter leg:
`confined-spawn` and `provider-call` for "the face served it"; `base-spawn` and `shell-exec` for
"the inherited executor did not"; `/proc` sightings and the fixture's marker file for the
independent OS witness; `denyBash.refusedByFace` for the typed code. All four cases in both runs are
the same driver bytes (`sha256` below) and the same claims.

`sub:face-admitted` and `sub:network-deny` stayed green in both runs (the face's own argv vectors and
its own deny lane were not weakened). `runs/boot02/summary.txt` / `runs/boot03/summary.txt` and the
per-run `run.log` copies are the raw records.

## 5. Blast radius — which presets get a governed `bash`

The shadow is **not** global; it is conditional and surface-neutral. Concretely:

1. **Realms that install the confined `subprocess` face and declare a `shellClass`** (the only case
   the live pair exercised): every Member on such a realm, on **all** lanes, now has its
   model-visible `bash` served by the confined face. The allow lane still executes; the deny lane
   refuses at admission.
2. **Realms with the face but no `shellClass`**: the name is still shadowed (the realm asked for a
   process face), and the call is now refused `SUBPROCESS_SHELL_NOT_DECLARED` **before** any
   process — where it previously executed on the preset executor. A composition must declare
   `shellClass: { programs: ['bash'] }` to keep an allow lane. That is a deliberate prerequisite,
   and it is why `C4` exists.
3. **Realms without the confined face**: no shadow at all; the agent surface, the preset definition
   and the old executor path are byte-identical (`C2`). This includes shipped product presets today:
   `product-assembly.ts` still cannot request a process face, so a shipped preset without a governed
   realm keeps the pre-fix `bash`.
4. **Members whose preset mounts the persistent shell** (`dsh-tool-bash-persistent` /
   `dsh-terminal`): the tool **name** `bash` is now owned by the confined module in the agent scope,
   so the model reaches the confined tool, not the PTY, for that name. The persistent shell is not
   unmounted — other shell-consuming tools can still reach it, and PD-13/PD-3 is how that path gets
   governed. The shadow does not claim to close it.
5. **Tool semantics**: argv is closed to `/bin/bash -c <non-empty body>`; cwd is resolved inside the
   Member workspace and declared as both read and write root; stdin is ignored; stdout/stderr are
   capped at 256 KiB each; default timeout 60 s; non-zero exit is **data** (`exitCode` in the JSON
   result), only admission refusals are tool errors. There is no `env`, no login shell and no
   interactive state, so a preset's `bash` expectations (e.g. `cd` persistence) do not carry over.
6. **Surface neutrality**: the model-visible name set is unchanged (one `bash`, no added/removed
   names, `S1`); `builtinToolDeny` that removes `bash` still removes it because the spec is computed
   from the post-deny surface.

## 6. What this evidence can and cannot claim

**Can claim** (each backed by an arm above):

- On a realm with the confined subprocess face and a declared shell class, the Member's `bash` call
  is served by that face (provider exactly once, base executor 0).
- The compiled `network: deny` is consulted on that path; the call is refused with
  `NETWORK_UNCONFINED_REALM` naming `network-destination`; 0 provider calls, 0 base spawns, 0 `/proc`
  sightings — no process is created.
- The allow lane still works end to end through the face (stdout, exit code, faithful non-zero).
- A ceiling with no `network` axis still allows (`A2`), so the refusal is the network term.
- The shadow is the load-bearing mechanism (`MA`), and the network admission is the load-bearing
  decision (`MB`); removing either reds exactly the arms that depend on it.

**Cannot claim** (and must not be read as claiming):

- **OS-level network isolation.** The provider probe still reports
  `network-destination: 'unsupported'` (Landlock ABI v7); the refusal is our admission decision made
  before spawn. BL-42 remains open. Do not say "the child cannot reach the network".
- **That the Member can no longer get an ungoverned shell.** The persistent terminal path (PD-13),
  face-less realms (item 3 above) and preset-level modules that bind the inherited `subprocess`
  outside the realm remain. The invariant is true for *this tool name on this realm shape*, not for
  every shell a Member can reach.
- **That the read axis of a shell body is attributable.** Declared roots are the resolved cwd; the
  body may read anywhere the OS profile allows. PD-13 is unchanged.
- **Any candidate/`V@B`/grade movement.** Every start here is `DEV-LIVE`; the record class cannot
  become a candidate claim, and no matrix cell changed.

## 7. Gates (all run on this tree)

| gate | result |
|---|---|
| `node --test tests/world-factory/a5sf-pd12-bash-governance.test.mjs` | 7 pass, 1 skipped (the pin; `A5SF_PD12_PIN=1` runs it) |
| `A5SF_PD12_PIN=1 node --test …` | fixed arms pass; pin red by design (`pin-after.log`) |
| `node dev/agent-workflow/evidence/a5sf-pd12-fix/mutation-controls.mjs` | `PASS (2/2)`, both `RED-AS-REQUIRED` |
| `node --test tests/world-factory/a5sf-*.test.mjs` | see `a5sf-family.log` |
| `node --test tests/world-factory/a5sf-debt-register.test.mjs` | 10/10 pass |
| `node scripts/doc-checks.mjs` | exit 0 |
| `pnpm -r typecheck` | exit 0 |
| `git diff --check` | clean |

## 8. Files and hashes

Host-free:

- `tests/world-factory/a5sf-pd12-bash-governance.test.mjs` — P0/D1/A1/A2/S1/C1/C2/C4.
- `packages/runtime/src/plugin/live/confined-bash-tool.mjs` — the shadow tool (plain `.mjs`; driven
  through the route-C seam).
- `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` — `confinedBashSpecOf` + append.
- `packages/runtime/team-services/src/{mount,subprocess,install}.ts` — unchanged by this fix; the
  behaviour is reused (the diff is limited to the row + the new module + dist placement).
- `scripts/dist-placements/130-a5sf-pd12-confined-bash.json` — dist mirror placement (tsc never
  emits `.mjs`; without it the installed face would fail at member setup).
- `packages/runtime/dist/packages/runtime/src/plugin/live/{a5sf-realm-row.mjs,confined-bash-tool.mjs}`
  — the committed mirror artefacts.

Live lane:

- `driver/run-boot.mjs` — sha256 `25905c29b3614bd41b81bb2575681e3b7aef38290f363c6ca2c7acad309a4575`
- `driver/a5sf-pd12-realm-row.mjs` — sha256 `47d1e7f1f54b89d999efae260a18bc1244f0a1a65d5168103833df5be7544be2`
- `driver/preflight-bundle.mjs` — sha256 `7a085020d6a8275a9c0b9fed23e8566a31c9c035a6625a9dc3f4ddcfad001ce5`
- `runs/boot02/`, `runs/boot03/` — the pair (probe-report, counters, guard facts, `/proc`
  observations, run record, summary, ledger snapshot, raw log).

The driver is a **derived copy**: the accepted subprocess dev-live procedure with the two
`bash`-path propositions replaced. No upstream tree was touched (`CORE PATCH BUDGET = 0`).
