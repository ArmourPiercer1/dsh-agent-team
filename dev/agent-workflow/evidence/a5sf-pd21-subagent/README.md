# PD-21 — the governed Member's SUBAGENT realm (measured, then fail-closed)

> **Evidence class: `DEV-LIVE`.** Development evidence, never a candidate claim; `candidateClaimEligibility`
> is false by construction. No `V@B`, no matrix grade change, no CI change. `CORE PATCH BUDGET = 0`:
> the fix is a **declaration** change in `cordis.patch.yml` plus test/driver/evidence files — zero
> `packages/**` source edits.

PD-18 (#668) fail-closed the governed preset's host-executed executors and, in the same evidence
README, recorded a consequence it explicitly did **not** measure:

> "`subagent` is retained; its child-session assembly on a governed row is UNMEASURED (PD-18 adjacent
> finding)."

This lane measures it on the real Host, through public seams only, and then disposes of it.

## 1. The five answers (one sentence each)

1. **Can a governed Member use `subagent` to start a session outside its ceiling?** — **It could, and it
   did**: on `3df546de6` a governed Member's `subagent` call returned a live child session whose
   model-visible realm was the **Host's**, not the Member's (its `read` returned the 29-byte
   out-of-lane fixture and its `bash` ran `cat` on the base subprocess — **5** mock request bodies
   carried the secret bytes, **0** `a5sf-guard-consult` facts were recorded).

2. **Can a governed Member use `team_*` to create a wider Member?** — **No.** The Member's own
   envelope explicitly *allows* `create-member`, yet both `team_create_member` calls (own template
   and the declared **wider** template) were refused at admission with
   `TEAM_RUNTIME_CALLER_AUTHORITY_DENIED` ("restricted to roles [human, leader] (got role
   'member')") and the instance count stayed **2 → 2** — the role gate, not the envelope, is the
   fence, and it holds.

3. **What is the child's actual tool surface?** — **25 tools, the governed preset's own list minus the
   15 `team_*` tools**: `bash`, `read`, `write`, `edit`, `glob`, `grep`, `read_image`, `subagent`,
   `subagent_fork`, `send_message`, `list_agents`, … Its durable session header even says
   `agentPreset: "a5sf-governed-member"`, so the label is inherited while the **realm is not**. It
   carried `subagent` itself (provider-managed recursion).

4. **Inheritance or fail-closed?** — **Fail-closed**, because inheritance is not reachable inside this
   budget: the child context is created *under the Member's agent context*, which makes it a
   **sibling** of the realm's `fs`/`subprocess`/`web`/`terminals` isolate fork, so a preset-level row
   cannot resolve the confined providers (see §3). The whole `delegation` group is therefore removed
   from the governed preset: `subagent` / `subagent_fork` / `subagent-control` / `subagent-list-agents`
   (plus the shipped-disabled `tool-ralph`, which carries `subagentProvider: spawn`). A governed
   Member that names `subagent` now gets the host router's typed `Error: unknown tool "subagent"`,
   **zero children, zero bytes**.

5. **Escape-arm byte counts.** — **Before: 29 out-of-lane bytes** returned by the child (both through
   `read` and through `bash`), present in **5/14** mock request bodies, **0** guard facts.
   **After: 0 bytes, 0 requests, 0 children, 0 facts** (the refusals are typed, not silent).

## 2. The two live arms, side by side

Both arms are the **same driver**, the same World shape, the same fixtures, the same scripted model;
the only difference is the preset declaration under test. Each arm is an **agreeing two-boot pair**
(`agreeing=true, differing=[]`).

| fact (from `agreement.txt`) | PRE-FIX pair (base preset) | POST-FIX pair (this commit) |
| --- | --- | --- |
| `childRealmVerdict` | **REFUTED** | **PROVEN** |
| `escapeVerdict` | **REFUTED** | **PROVEN** |
| `childFactsVerdict` | **REFUTED** | **PROVEN** |
| `createVerdict` | PROVEN | PROVEN |
| `subagentOnMemberSurface` | `true` | `false` |
| Member surface names | **40** | **35** (5 removed) |
| `childPresent` / `childModelRequests` | `true` / **3** | `false` / **0** |
| child surface names | **25** | **0** |
| `requestsCarryingSecret` | **5** | **0** |
| `guardFacts` (allow / deny) | `1 / 0` | `1 / 0` |
| `confinedTurnLaunchers` | 1 | 1 |
| `memberInstancesBefore → After` | `2 → 2` | `2 → 2` |
| baseline / member-surface / launcher arms | PROVEN | PROVEN |

The pre-fix pair is archived at `archive/pair-prefix/` (its `agreement.txt` is the RED record).
The post-fix pair is `runs/boot01`, `runs/boot02` with this directory's `agreement.txt`.

### 2.1 The pre-fix escape, verbatim (from `archive/pair-prefix/boot01/child-probe.json`)

```
read  { file_path: "<world>/out-of-lane/secret-out-of-lane.txt" }
  → isError=false, "<content>\n1: A5SF_PD21_OUT_OF_LANE_SECRET\n\n(End of file …)</content>"
bash  { command: "cat '<world>/out-of-lane/secret-out-of-lane.txt'", workdir: "<world>/workspace" }
  → isError=false, "A5SF_PD21_OUT_OF_LANE_SECRET\n"
final assistant: "A5SF_PD21_CHILD_DONE A5SF_PD21_OUT_OF_LANE_SECRET"
```

The Member's own `bash` in the same turn is the **positive control**: it returns
`{"kind":"confined-terminal", "exitCode":0, "stdout":"A5SF_PD21_IN_LANE_BYTES\n"}` and records exactly
**one** allow fact. The child's two reads record **none** — the child never touched the guard.

### 2.2 The post-fix refusal, verbatim (from `runs/boot01/member-transcript.txt`)

```
TOOL CALL [subagent] call-a5sfpd21-subagent
TOOL RESULT isError=true
  Error: unknown tool "subagent"
```

## 3. Why the child escaped (code anchors, then measured)

* `packages/runtime/team-services/src/install.ts` mounts the confined providers into
  `root.isolate('fs', Symbol('member:<id>'))` and nests `subprocess` / `web` / `terminals` isolates
  inside it; the native tool modules are shadowed **on that isolated context**.
* The subagent provider's child is created by
  `parent.ctx.agents.create({ parentAgent, setup })` (`subagent-in-process-driver`), i.e. **under the
  Member's agent context** — a *sibling* of the isolate fork, not a descendant of it.
* `applyChildComposition` then runs `agentPresets.composeFrom(childCtx, parent.ctx)`, which re-mounts
  the parent's **preset** into the child scope. Rows re-mount; the **isolated service slots do not**.
  So every governed row on the child resolves the base service: `read` → base `tool-fs`,
  `bash` → base `tool-bash` (host sandbox, not the confined terminal face).
* The measured consequence is exactly that: the child's `read` was the native fs tool (XML
  `<content>` output, no `IO_READ_DENIED`, no fact) and its `bash` ran on the **base** subprocess.

This is why "inherit the realm" was rejected rather than attempted: the provider has no seam to
create the child *inside* the Member's isolate fork, and a `packages/**` change to add one is outside
`CORE PATCH BUDGET = 0`.

## 4. The fix

In `cordis.patch.yml`, inside `preset-a5sf-governed-member`:

* **removed** the `delegation` group and all of its children (`tool-subagent-control`,
  `tool-subagent-list-agents`, `tool-subagent`, `tool-subagent-fork`, plus the shipped-disabled
  `tool-subagent-codex` / `tool-subagent-claude-code`);
* **removed** `tool-ralph` (shipped `disabled: true`, `subagentProvider: spawn`) — a disabled row is
  not a governance boundary, and a later enable would silently restore a spawn-capable face;
* **kept** everything else (bash, fs, fs-search, jobs, skills, goal/plan/todo/present, compaction,
  ask-user, plugin-manager) — a surgical removal, asserted by the host-free suite.

The Member's model-visible surface drops from **40** to **35** names: `subagent`, `subagent_fork`,
`send_message`, `interrupt_agent`, `list_agents`.

**Disclosed capability regression.** A governed Member can no longer delegate to a child agent at
all. This is a *removal*, not an enforcement: there is no governed child realm today. The standard
preset still declares `tool-subagent`/`tool-subagent-fork` (asserted by the positive-control arm), so
the capability exists outside the governed preset. Restoring it requires a provider seam that builds
the child inside the Member's isolate fork, then a governed-child measurement.

## 5. Evidence inventory

| path | what it is |
| --- | --- |
| `runs/boot01`, `runs/boot02` | POST-FIX live pair: `member-surface.json`, `child-surface.json`, `child-probe.json`, `member-transcript.{json,txt}`, `guard-facts.json`, `proc-observations.json`, `counters.json`, `run-record.json` |
| `agreement.{txt,json}` | the post-fix pair agreement (`agreeing=true`) |
| `archive/pair-prefix/` | PRE-FIX live pair (the RED record, same driver, base preset): `boot01`, `boot02`, `agreement.{txt,json}`, `driver.log` |
| `boot-prefix-pair.log`, `boot-postfix-pair.log` | full driver logs of both pairs |
| `host-free-pin.log` | `A5SF_PD21_PIN=1 node --test tests/world-factory/a5sf-pd21-subagent.test.mjs` (pre-fix rows read from `git show 3df546de6:cordis.patch.yml`) |
| `mutation-controls.log` | both mutation controls + the clean control |
| `plan-patch.yml` | the host-free `--plan` composition (no World booted) |
| `driver-digest.json`, `driver/`, `run-ledger.jsonl` | driver identity, host logs, append-only DEV-LIVE ledger |
| `boot-tree-state.json` | the working-tree state the boots ran against (see §7) |

## 6. Reproduction

```bash
# host-free (no boot): surface + typed refusal + the pre-fix pin
A5SF_PD21_PIN=1 node --test tests/world-factory/a5sf-pd21-subagent.test.mjs
node tests/world-factory/a5sf-pd21-mutation-controls.mjs

# the two live pairs (each boot needs a dev-live slot; <= 6 concurrent dev Hosts)
node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs            # post-fix, 2 boots
git show 3df546de6:cordis.patch.yml > cordis.patch.yml                      # pre-fix
node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs            # pre-fix, 2 boots (RED)
```

The driver's `--plan` is host-free. Every boot: archive-before-start, its own `DSH_HOME` under
`tests/homes/`, ports from the 3180 family, `:3080` never touched, one machine-wide dev-live slot
(`face: Subagent`, `world: u5a5sfpd21`), teardown by identity, host-tree porcelain verified empty.

## 7. Disclosures

* **DEV-LIVE, dirty tree.** The boots ran in the task worktree at `HEAD = 3df546de6` with the fix
  **applied but not yet committed**; `boot-tree-state.json` records that dirty set and the sha256 of
  the booted `cordis.patch.yml` (`f9d7db60…`). The committed content of `cordis.patch.yml` is
  byte-identical to the booted file, so re-running from the PR commit reproduces these numbers.
* **Boot authorisation.** This lane's boot authorisation is the task's own explicit DEV-LIVE
  instruction plus the owner's ≥2026-11-09 dev-live self-authorisation. The face-scoped
  `dev-live-grant.json` is **not** claimed: it is `face: Subprocess`, `world: u5a5sfsub1`, and this
  face is `Subagent`. The slot acquired is a machine-wide concurrency slot only.
* **Fixture vs product.** The model is the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`);
  the /proc watcher, the fixture files and the mock request log are test instrumentation. The product
  path is real: the preset row, the realm provider/compiler, the guard, the confined terminal face,
  the subagent provider and the team tool router are the shipped modules the Host loads.
* **Not the child's OS sandbox.** The child's `bash` ran under the **host** sandbox policy
  (workspace-write). The out-of-lane fixture sat inside the World home, which the host sandbox
  permits, so the read succeeded; on a stricter host policy the `bash` half could refuse for a
  *different* reason. That is exactly why the `read` half (no sandbox fence at all) and the
  `requestsCarryingSecret` counter are the load-bearing witnesses, not the `bash` exit code.
* **No `V@B`, no matrix grade, no CI change, no `packages/**` edit.**

## 8. What this does NOT claim

* It does **not** claim a governed child realm exists. It claims the opposite, and removes the tool.
* It does **not** claim the `team_*` surface is safe in general: it measures the two creation calls
  (`own` template, `wider` template) and the instance count around them.
* It does **not** cover `subagent` on the **standard** preset (still declared; ungoverned by design).
* It does **not** grade the Subagent face in `TOOL-ACCEPTANCE-MATRIX.md`; that taxonomy has no
  Subagent face yet, and adding one is a matrix change this lane is not authorised to make.
