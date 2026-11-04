# a5sf fs-tools — `edit` acceptance arms and the `grep`/`glob` adoptability measurement

**Lane:** `task/a5sf-fs-tools-20261103` (worktree `.worktrees/a5sf-fs-tools`), cut from
`origin/master` = `6fbe33c01` (verified `git rev-parse origin/master` before branching).
**Scope:** the per-tool acceptance rows the matrix still grades `WIRED-NOT-ACCEPTED`
(`edit`, M-03) and `NOT_WIRED` (`grep` M-06, `glob` M-07), measured **host-free**: no Host
boot, no port, no `DSH_HOME`, no `tests/homes/**`.

**CORE PATCH BUDGET = 0.** No product code changed, `packages/**` untouched,
`packages/runtime/src/plugin/live/agent-bindings.mjs` untouched
(sha256 `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b`, the standing
ARC-A override value). This lane adds arms + evidence + the matrix cells those arms justify.

---

## 1. What was measured, in one paragraph

`edit` is no longer a judgement call: through the real product entry points
(`mountMemberA5sfRealm` → `attachA5sfNativeToolModules`) with the **real pinned**
`@deepseek-ai/dsh-tool-fs` (`tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js`,
0.2.0-rc.2), an in-lane edit **executes on the routed (confined) definition**, writes its new
bytes to disk, and emits exactly one `a5sf-guard-consult/1` fact in the `member` realm; an
out-of-lane edit is **refused by the guard** with bytes unchanged; an edit whose **path is
inside the write allowance but outside the read allowance** is refused by the read axis
(`IO_WRITE_REQUIRES_READ`), which is the read-before-write rule actually being consumed; and
`edit` is forwarded **once, on the ceiling partition only**. The proposed grade is
**`ENFORCE-PARTIAL`** with `V@B = no` — identical in kind to the already-committed `write`
row: the host-free half is proven, the live baseline was not run.

`grep`/`glob` are **not adoptable through this seam yet**, and the reason is measured, not
assumed: the module mounts and its definitions are routed/identity-shadowed, but its I/O runs
through `ctx.subprocess.spawn` (argv-vector ripgrep), **not** through the guarded `fs`
service — so an out-of-lane search **executes and returns the outside content with zero guard
facts**. No OS-level denial was observed and no string filter was allowed to stand in.
**The hole is pre-existing:** the pre-attach preset control (`SEARCH-0`) runs the same
out-of-lane search through the host-preset definition with **no attach at all** and gets the
same result (executes, outside content, zero fs facts) — so the routed adoption changes
nothing about it and does not introduce it; it is an inventory entry, not a regression from
this route.

---

## 2. The worlds (all in-process)

Each arm builds a fresh Cordis world: `SystemPrompt` + `ToolRuntime` + a real
`@deepseek-ai/dsh-subprocess-local` (Part B only) + a `fs` provider double whose
`writeText`/`editText` actually mutate the file and whose `editText` enforces the tool-level
unique-match. The **preset plane** mounts the real pinned module on a `standing` scope; the
Member realm is mounted on the agent scope through `mountMemberA5sfRealm`; the shadow is
attached through `attachA5sfNativeToolModules` **after** the realm. **Scope caveat (what these
measurements grade): the NATIVE ROUTE only.** The probe world deliberately does **not** mount
the Team's governed tool plane — no `config.teamToolPlane`, and none of
`packages/tools/families/fs.mjs` or `search.mjs` that the production glue places through
`agent-bindings.mjs` (plane assembly around `:2989`, placement around `:3088`). In a configured
Team Member the native preset may be shadowed by governed (or shut) rows, so these arms grade
the native routed lane — the lane `a5sfNativeToolModules` creates — and say nothing about what
a production Team plane exposes on top of it. The `fs` guard is the real `packages/runtime/team-services/src/fs.ts`
`createMemberFsGuard`/`createConfinedFileSystemClass` pair — the probe does not implement any
policy logic itself.

Guard facts are the file sink's `a5sf-guard-consult/1` lines; the probe prints

```
realm/toolBindingIdentity/memberIdentity/method/decision/decidedBy
```

per fact, so each measurement names *which realm* and *which identity* produced it.

---

## 3. Part A — `edit` (M-03), four measurements

Raw: `fs-arms.log` (ARM `EDIT-1` … `EDIT-4`). Each line below is copied from that log.

### (1) In-lane edit succeeds — the routed (confined) definition served it

```
EDIT-1 (in-lane, routed definition): presetEdit=unconfined(facts=0) routedEdit=shadow
  ceilingForwarded=["write","edit"]
  result="The file /tmp/…/inside/edit-me.txt has been updated successfully."
  disk="ALPHA\nbeta\n"
  facts=[member/null/member-fs-tools-probe/editText/allow/ALLOW]
```

Three facts make this an acceptance measurement rather than a smoke test:

- **Control first.** Before the attach, the same edit through the **preset** definition
  succeeds with **zero** guard facts (`factsAfterControl=0`, disk mutated). After the attach,
  `tools.get('edit', agentKey)` is a *different object* from the preset definition, and the same
  call emits **one** fact. The fact delta is therefore attributable to the routed definition,
  not to the tool.
- The fact is `realm=member`, `toolBindingIdentity=null` (the ceiling lane),
  `memberIdentity=member-fs-tools-probe`, `method=editText`, `decision=allow` — the ceiling
  partition's confined provider made the decision.
- The **new bytes are on disk** (`ALPHA\nbeta\n`) and the model-facing result is the native
  `edit` success sentence.

### (2) Out-of-lane edit is refused — bytes unchanged, guard facts named

```
EDIT-2 (out-of-lane refused): result="Error: authored locator
  '/tmp/…/outside/outside.txt' is outside every allow subtree of the lane"
  disk="DO-NOT-TOUCH\n"
  facts=[member/null/member-fs-tools-probe/editText/deny/IO_WRITE_DENIED]
```

The refusal is the guard's typed `IO_WRITE_DENIED` (`decidedBy`), attributed to the **member**
realm and the probe member identity; the file's bytes are byte-identical before and after.
The model-facing text is the provider's remediation of that refusal; the typed code lives in
the fact, which is why the assertion pins the fact, not the prose.

### (3) Read-before-write is governed — which axis denies what

The matrix's ⑤ for this row says "reading the old content and writing the new content are two
axes". Three arms separate them, plus one boundary:

```
EDIT-3a (write lane yes, read lane no):
  compiledReadAllow=["/tmp/…/inside"] compiledWriteAllow=["/tmp/…"]
  targetInsideWrite=true targetInsideRead=false
  result="Error: native editText must read '/tmp/…/axis.txt' before rewriting it, …"
  disk="gamma\n"
  facts=[member/null/member-fs-tools-probe/editText/deny/IO_WRITE_REQUIRES_READ]

EDIT-3b (write lane no, read lane yes):
  result="Error: authored locator '/tmp/…/axis2.txt' is outside every allow subtree …"
  disk="delta\n"
  facts=[member/null/member-fs-tools-probe/editText/deny/IO_WRITE_DENIED]

EDIT-3c (read-before-write is existence-conditioned; measured via the write sibling):
  createInWriteLane=ok existingEdit=denied(IO_WRITE_REQUIRES_READ)
  facts=[member/null/member-fs-tools-probe/writeText/allow/ALLOW,
         member/null/member-fs-tools-probe/editText/deny/IO_WRITE_REQUIRES_READ]

EDIT-3d (content is not a lane; unique-match is tool-level):
  pathAdmission=allow then toolContentCheck=refused
  result="Error: old_string was not found in /tmp/…/content.txt"
  diskUnchanged=true
```

What this measures, stated plainly:

- **The read axis denies an existing-file edit whose path the write axis allows.** The target
  in 3a is inside `compiledWriteAllow`, so the write lane alone would admit it; the denial is
  `IO_WRITE_REQUIRES_READ`, the guard's "write ⇒ read" rule, and it names `editText`. The edit
  never reaches the provider, so the bytes do not move.
- **The reverse split is the write axis.** 3b's target is inside the read lane but outside the
  write lane, and the denial is `IO_WRITE_DENIED` — a different axis, a different typed code.
  The two axes are separable by measurement, not by assertion.
- **The read requirement is conditioned on the target existing.** 3c creates a brand-new file
  in a write-only subtree through the sibling `writeTool` (which shares the same guard rule)
  — allowed, because there is nothing to read — while an existing file in that same subtree
  is refused. This is the intended semantics, recorded so nobody later reads
  "read-before-write" as "always read".
- **Content is not a lane dimension.** The lane model is path-scoped (`read`/`write` rule
  sets); there is no "content of file X is outside the read restriction" axis to plant,
  because the restriction is evaluated on locators, not on file bodies. The only
  content-sensitive check is the tool's own `old_string` match (3d): the guard admits the
  **path** first (one `allow` fact), then the provider refuses the edit because the string does
  not occur, and no bytes change. So the honest answer to "plant a file whose content is
  outside the read restriction while the path is inside the write allowance" is: **that
  predicate is not expressible in this policy model**; what is expressible and was measured is
  the path-axis split above (3a/3b) plus the tool-level content check (3d).

**One disclosure that keeps (3) honest.** The pinned `edit` tool also asks the host's
`fs/edit-intent` waterfall whether the file was already read, and the product composes a
separate `fs-observation-policy` plugin to enforce that. **That plugin is not mounted in this
probe world**, and the probe's `BaseFs` returns no guard from the intent slot, so the upstream
per-session read-before-edit policy did not participate. What was measured is DSH Team's own
read axis (`createMemberFsGuard`'s `write ⇒ read` rule) refusing the rewrite. The two
mechanisms are distinct: the upstream one is a session observation policy, the Team one is a
compiled lane. This lane does not claim the upstream policy was exercised.

### (4) Surface neutrality — `edit` once, on the ceiling partition

```
EDIT-4 (surface neutrality):
  partition=[{"realm":"ceiling","tools":["write","edit"]},{"realm":"binding","tools":["read"]}]
  editOnCeiling=true editOnBinding=false
  surfaceBefore=["read","write","edit"] surfaceAfter=["read","write","edit"]
```

`edit` is forwarded exactly once (the union of forwarded names has no duplicate, and equals the
pre-attach surface), it is on the **ceiling** partition (the ceiling realm's confined lane), it
is **not** on the binding lane (`dsh.fs/read` forwards only `read`), and `tool:edit` appears
exactly once in the assembled prompt sections. No surface change, no duplicate registration.

### Proposed grade for M-03

**`ENFORCE-PARTIAL`, `V@B = no`.** The closed enum has no "host-free accepted" tier; the
already-committed `read`/`write` rows use `ENFORCE-PARTIAL` for exactly this shape (mechanism
half proven host-free with routed execution + denial, live half never run). This row now has
**execution**, **denial**, **the read/write axis split**, and **surface neutrality**, which is
strictly more than "routed/registered". It is **not** `DONE`/`LIVE-CONFIRMED`: the live six-row
acceptance (`a5sf-acceptance/README.md`) has never run, and `V@B` stays `no`.

Residual risks kept in ⑦: live rows not run; only the ceiling lane was exercised for `edit`
(no `dsh.fs/edit` binding lane exists in this composition — a binding for `edit` would move it
to a binding realm and is a different measurement); **version-conflict / atomic-replace
semantics are UNMEASURED** (the provider double applies a direct unique-match replacement; it
does not exercise the live provider's expected-version guard or its atomic rename); the
existence-conditioned boundary (3c) was measured through the `write` sibling, because `edit`
cannot create a file; TRUSTED_ONLY in-realm JS; content is not a lane dimension (3d); and the
whole row grades the native routed lane, not a configured production Team plane (see §2).

---

## 4. Part B — `grep` / `glob` (M-06 / M-07)

### Which module owns them, and its shape

| | |
| --- | --- |
| module | `@deepseek-ai/dsh-tool-fs-search` (`tests/deepseek-harness-test-use/packages/fs/tool-fs-search/lib/index.js`, 0.2.0-rc.2) |
| registration | **synchronous** `apply()` — `ctx.tools.register` for `grep` and `glob` + one `tool:grep`/`tool:glob` prompt section each; no `ctx.inject` child fiber, no event-driven branch |
| injected | `inject = ["tools","systemPrompt","subprocess"]` — deliberately **no `fs`** |
| I/O route | `ctx.subprocess.spawn({ argv: [rgPath, "--no-config", …argv], … })`: a plain argv vector to the **packaged ripgrep** (`@vscode/ripgrep`), explicitly documented in the source as *"The spawn is unconfined (a plain `ctx.subprocess` call)"* |
| product preset | `tool-fs-search` in `standard`/`cordis`/`ptc`; config requires `sampleOverCapGlobResults` (boolean) — the probe passes the product value `false` |

So the module **can ride the routed mount** in the narrow sense (it registers its tools through
the module's `ctx`, its tool names are disjoint from `dsh-tool-fs`, and the router forwards
both). What it cannot do is **inherit the confined lane**: the realm's confined Provider is
`fs`, and this module never touches `fs`.

### Measurements

```
SEARCH-0 (pre-attach preset control: same hole, 0 facts):
  attachCalled=false readAllow=["/tmp/…/inside"] searched="/tmp/…/outside"
  grep=EXECUTED glob=EXECUTED guardFacts=0 definitions=preset
  grepText="Found 1 match\n\n/tmp/…/outside/secret.txt\nLine 1: OUTSIDE-SECRET"

SEARCH-1 (mount + forwarding + identity):
  module=@deepseek-ai/dsh-tool-fs-search registration=synchronous
  inject=["tools","systemPrompt","subprocess"]
  forwarded=["glob","grep"] routedDefinitionsShadowed=true
  surfaceBefore=["glob","grep"] surfaceAfter=["glob","grep"]

SEARCH-2 (in-lane grep):
  result="Found 1 match\n\n/tmp/…/inside/needle.txt\nLine 1: INSIDE-NEEDLE"
  guardFacts=0

SEARCH-3 (out-of-lane grep: measured bypass):
  readAllow=["/tmp/…/inside"] searched="/tmp/…/outside"
  grep=EXECUTED glob=EXECUTED guardFacts=0
  grepText="Found 1 match\n\n/tmp/…/outside/secret.txt\nLine 1: OUTSIDE-SECRET"
```

- The attach **forwards** `grep` and `glob` (ceiling receipt), the definitions are shadowed
  (the agent resolves a different object than the preset), and the surface is neutral.
- An **in-lane** search succeeds against the packaged ripgrep (real child process), and — note
  honestly — emits **zero** fs guard facts, because no fs call happens.
- An **out-of-lane** search whose path the ceiling read lane does **not** cover **executes**
  and returns the outside file's match; same for `glob` (`secret.txt` was listed). Zero guard
  facts means the guard was never consulted: this is not a guard refusal that happened to be
  permissive, and it is not a string filter — the untrusted path is passed verbatim as an
  `rg` argv element and the process runs.
- **It is not caused by adopting the module.** `SEARCH-0` measures the same call through the
  **host-preset** definition before any attach (`attachCalled=false`, definitions are the
  preset ones): it also executes, also returns `OUTSIDE-SECRET`, also emits zero fs facts.
  The out-of-lane search hole therefore **exists at the host-preset plane before this route is
  involved**; adopting `grep`/`glob` into the routed mount neither creates nor widens it, and
  it is not a regression introduced here.

### Exact failing condition (the gate for both rows)

> The routed mount confines the **`fs` service**. `grep`/`glob` read through
> **`ctx.subprocess`**, which the realm does not confine. A per-binding **OS-confined
> subprocess Provider** (P1-07's `os-confined:leaf` runner) must be mounted as that realm's
> `subprocess` service — and the target path must be enforced in the OS profile, not in an
> argv string filter — before either row can move.

P1-07's own evidence records the remaining wiring gap: the OS-confined runner exists and is
mechanism-tested, but "native `ctx.subprocess.spawn` wiring into the live Host is P1-05/P2
integration" (`a5sf-p1-07/OS-RUNNER-EVIDENCE.md` §3). This lane confirms the consequence on the
routed mount: no such provider is in the realm, so the guard cannot refuse and the search runs.

**No OS-level denial is claimed here.** No confinement profile was active for the searched
tree; the only observation is that the routed/native path executed an out-of-ceiling search.

### The one arm that would move each row

For **M-06 (grep)**: mount an OS-confined `subprocess` Provider so the **ceiling/Member**
realm's search mount resolves it, then
re-run `SEARCH-3` — the out-of-lane `grep` must fail with an OS `Permission denied` (or a typed
provider refusal) **and** emit a guard fact attributed to the member/binding identity, with the
outside content absent from the result. Also pin `exit 0/1`, no-match, bad-pattern and
cancellation on that same confined provider.

Note on the realm: `grep`/`glob` are forwarded on the **ceiling/Member** fiber —
`nativeToolMountsOf` only binding-mounts a module that owns a `dsh.fs/*` binding tool, and the
search module owns none. A search binding would have to be created first for a per-tool
binding realm to exist; until then the confined `subprocess` must be visible to the ceiling
mount (installed on the realm/agent context the module resolves through).

For **M-07 (glob)**: the same single arm with `glob` — an out-of-lane `glob` must be refused by
the confined provider (not merely return no paths), because "no results" is indistinguishable
from "not allowed" without the fact.

Both rows stay `NOT_WIRED`: the governed execution path has not bound them, and the measurement
above is exactly why binding them as-is would be a false claim.

---

## 5. What this lane does NOT claim

- **Not a live-baseline verification.** `V@B` is `no` on every row touched. No Host was booted;
  the live six-row acceptance was not run.
- **Not OS-level confinement for search.** Only the routed-mount behaviour was measured; no
  Landlock/seccomp profile was in play.
- **Not a content-scoped read policy.** The guard is locator-scoped; 3d records that the only
  content check is the tool's own unique-match.
- **Not a new mechanism.** Zero product files changed. Every fact was produced by the existing
  `mountMemberA5sfRealm` / `attachA5sfNativeToolModules` / `createMemberFsGuard` code at
  `origin/master`.
- **Not `bash`/`web`/`pwsh`/MCP/state-tool coverage.** Those rows were not measured and are
  left untouched.

---

## 6. Gates

All run on this tree; raw transcripts in this directory.

| gate | result | raw |
| --- | --- | --- |
| `node dev/agent-workflow/evidence/a5sf-fs-tools/fs-arms.mjs` | **12/12 PASS, exit 0** | `fs-arms.log` |
| all a5sf node suites (8 files) | **92/92** (12+9+10+8+14+9+13+17) | `all-a5sf-node-suites.log` |
| `node_modules/.bin/vitest run a5sf` | **166/166, 11 files** | `vitest-a5sf.log` |
| law suites + p4t6 (`u6-arc-a-fitness`, `u6-pr6-arc-d-adversarial`, `a4p3-intervention-lane-hygiene`, `p4t6-session-event-scan`) | **54/54** (12+13+9+20) | `law-and-p4t6.log` |
| p4t6 tie, **measured last** | **1428** (`filesScanned=1428`, ledger `expected=1428`, `violations=[]`) | `p4t6-measured-tie.log` |
| `pnpm typecheck` (9 projects) | pass | `typecheck.log` |
| `pnpm build` | pass | `build.log` |
| `node scripts/place-dist-glue.mjs` | 101 placements, byte-identical; **no dist diff** | `place-dist-glue.log` |
| `node scripts/check-artifacts-committed.mjs` | pass (1916 compared, 101 glue) | `check-artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | pass (1916 compared, drift 0) | `check-artifacts-at-head.log` |
| `node scripts/eb3-evidence-guard.mjs --new-since origin/master` | pass, `added=18 findings=0` | `eb3-evidence-guard.log` |
| `node scripts/eb3-ci-required.mjs` | pass, `workflows=9 findings=0` | `eb3-ci-required.log` |
| `node scripts/ci-pr-gate.mjs --only graph-parse,state-freshness,blueprint-fence,lint-identities` | pass (4/4 legs) | `ci-pr-gate.log` |
| `node scripts/eb3-ci-negative-controls.mjs` | **26/26 controls** behaved as required | `eb3-negative-controls.log` |
| `pnpm ci:local --base origin/master` | **pass**, steps=4 failed=0 coverage=determined wall=12.6s | `ci-local.log` |
| `git diff --check origin/master..HEAD` | clean (exit 0) | `git-diff-check.log` |

The p4t6 tie was measured after every file in this directory was on disk and before the
evidence commit; this lane adds only `dev/**` + `docs/**` paths, so the scanner total is
unchanged at **1428** and no booking was needed (the `A5SF` booking stays
`{"from":1396,"to":1428}`, 32 paths).

## 7. Reproduce

```bash
cd .worktrees/a5sf-fs-tools
node dev/agent-workflow/evidence/a5sf-fs-tools/fs-arms.mjs   # FS-TOOLS ARMS: PASS 12/12
```

Environment note: this worktree had no `node_modules` or pinned baseline checkout of its own;
both are **gitignored symlinks** to the established installs — `node_modules →
../a5sf-s1/node_modules`, `packages/runtime/node_modules → ../../../a5sf-s1/packages/runtime/node_modules`,
`tests/deepseek-harness-test-use → ../../../tests/deepseek-harness-test-use` — so the pinned
baseline (0.2.0-rc.2 @ `639ed01539`) and the rc.2 `@deepseek-ai` install are the real ones, and
the pnpm store stays outside the sandbox.

## 8. Raw index

| file | what |
| --- | --- |
| `fs-arms.mjs`, `fs-arms.log` | the 12 arms (7 for `edit`, 5 for `grep`/`glob`, incl. the pre-attach SEARCH-0 control), through the product seam, real pinned modules |
| `all-a5sf-node-suites.log` | the eight a5sf node suites |
| `vitest-a5sf.log` | `npx vitest run a5sf` |
| `law-and-p4t6.log`, `p4t6-measured-tie.log` | law suites + the p4t6 tie measured last |
| `typecheck.log`, `build.log`, `place-dist-glue.log` | the build chain |
| `check-artifacts-committed.log`, `check-artifacts-at-head.log` | artifact discipline |
| `eb3-evidence-guard.log`, `eb3-ci-required.log`, `eb3-negative-controls.log` | EB3 gates |
| `ci-pr-gate.log`, `ci-local.log`, `git-diff-check.log` | gate verdicts |
