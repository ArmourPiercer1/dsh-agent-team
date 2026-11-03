# a5sf TOOL AXIS — the binding realm is mounted and correct, but the execution path never addresses it

**The question.** Make the a5sf execution path consume each **ToolBinding's** restriction, not only the Member
ceiling, so that
`EffectiveIo(member,tool,call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member,tool)`
holds in code. The ceiling half is PROVEN live (`dev/agent-workflow/evidence/a5sf-live-native3/`, #559); this lane is
the missing tool half.

**The answer, first and plainly.** **The per-tool addressing seam does not exist today.** P1 does mount one realm per
`(Member × ToolBinding)` — but the *execution* attach addresses **one realm per Member** (`installation.members[0].ctx`)
and never a binding realm. The binding realms are addressable objects (`realm.bindings[i].ctx` / `.fs`), so the missing
piece is not storage or compilation; it is **per-TOOL registration/execution routing**. A native tool *package*
registers its whole tool suite over ONE Cordis context (the real `@deepseek-ai/dsh-tool-fs` registers `read`,
`read_image`, `write`, `edit` from a single `apply(ctx, config)`), so mounting that module into one binding realm would
apply **that binding's lane to every sibling tool** — the wrong restriction for the siblings, and mounting the module
once per binding collides on the same tool names in the same agent scope layer.

This directory therefore records a **measured RED** (the tool restriction is ignored at runtime), proves the binding
realm itself enforces the intersection correctly — arms (a)(b)(c) — and proposes the narrow seam. **No production
code changed** (`CORE PATCH BUDGET = 0`; `agent-bindings.mjs` and `a5sf-realm-row.mjs` untouched, so no protected-centre
sha256 moved).

| item | value |
| --- | --- |
| Worktree | `.worktrees/a5sf-tool-axis` |
| Branch | `task/a5sf-tool-axis-20261103` |
| Base | `origin/master` = `96173398175993d463bc82c098c6b143b7de8d04` |
| Host boots | **0** (none; P2-01's last boot is not spent — the answer needed no Host) |
| Ports / DSH_HOME / `tests/homes/**` | none created |
| `:3080` | never touched |
| Core patch budget | **0** — no `upstream` source touched, no package source touched |
| `tests/deepseek-harness-test-use` | pinned `639ed01539…`, **read-only**; provisioned in this fresh worktree as a symlink to the shared pristine checkout (`porcelain` empty before/after), disclosed in §7 |

---

## 1. The addressing question, answered from the code

### 1.1 Where the per-binding realms live

`packages/runtime/team-services/src/install.ts:281` `installToolBindingRealm` mounts one confined Provider for ONE
`(Member × ToolBinding)`:

```
309:  const key = `${spec.identity.memberInstanceId}#${spec.toolBindingIdentity}`
332:  const scoped = root.isolate('fs', Symbol(`binding:${key}`))
```

and returns it as a first-class realm (`ctx`, `fs`, `policyRevision`, `dispose`) at `install.ts:347-357`.
`packages/runtime/team-services/src/mount.ts` composes them into `MountedA5sfRealm.bindings` (`mount.ts:183-196`,
`208`). So the **mount** is one realm per Member **and** one per ToolBinding.

The binding's `EffectiveIo` is the compiled intersection, not a re-evaluation: `ToolBindingRealmSpec.effective`
(`install.ts:254-261`) is exactly what P1-02's `compileEffectiveIo` produced.

### 1.2 What the EXECUTION path addresses

```
packages/runtime/team-services/src/mount.ts:227
      const target = installation.members[0]?.ctx
```

`mountNativeToolModules` (the route-C native re-mount that produced the live `read`) targets the **Member ceiling**
realm. The product row names the same scope:

```
packages/runtime/src/plugin/live/a5sf-realm-row.mjs:122
  const member = Array.isArray(members) ? members[0] : undefined
```

and the live call site is

```
packages/runtime/src/plugin/live/agent-bindings.mjs:2809
        await attachA5sfNativeToolModules(a5sfRealm, agentCtx, a5sfRowConfig, runtimeAgent)
```

A repository-wide search for a *consumer* of `realm.bindings` outside `mount.ts` itself returns **none** in
`packages/runtime/src` or `packages/runtime/team-services/src`. The binding realms are mounted, correct, and inert.

**Answer: one realm per Member for execution; one realm per ToolBinding mounted but never addressed.** The ceiling
realm is the only lane the live tool path consults — which is exactly what `a5sf-live-native3` measured
(`realm: "member"`, `toolBindingIdentity: null` on every fact).

---

## 2. The RED arm (measured on THIS tree)

`red-arm.mjs` (one-shot evidence probe; it is deliberately **not** a committed test because a red assertion may not sit
in the CI graph). It builds the real preset topology (native `@deepseek-ai/dsh-tool-fs` on a standing scope, agent
scope as its child), the real P1/P2 mount with:

- Member ceiling `read: [<dir>]` (covers `ceiling-only.txt`),
- ToolBinding `dsh.fs/read` restriction `read: [<dir>/inside]` (strictly narrower; does NOT cover `ceiling-only.txt`),
- the compiled binding `EffectiveIo` from the REAL `compileEffectiveIo` (`read: [<dir>/inside]`),

attaches the native package through the PRODUCT call (`attachA5sfNativeToolModules`), and dispatches `read` through the
REAL `@deepseek-ai/dsh-tools` runtime on `ceiling-only.txt`.

`red-arm.log` (verbatim):

```
ceiling allows: /tmp/a5sf-red-arm-…-Ew1IPH
read binding allows: /tmp/a5sf-red-arm-…-Ew1IPH/inside
locator: /tmp/a5sf-red-arm-…-Ew1IPH/ceiling-only.txt
dispatch isError=false text="<path>/tmp/a5sf-red-arm-…/ceiling-only.txt</path>\n<type>file</type>\n<content>\n1: CEILING_ONLY\n\n(End of file - total 1 lines)\n</content>"
facts: {"schema":"a5sf-guard-consult/1","realm":"member",…,"toolBindingIdentity":null,…,"method":"stat",…,"decision":"allow",…}
     | {"schema":"a5sf-guard-consult/1","realm":"member",…,"toolBindingIdentity":null,…,"method":"readText",…,"decision":"allow",…}
RED-ARM: FAIL — DESIRED: a ceiling-allowed, restriction-denied read must be REFUSED

false !== true

EXIT=1
```

**The RED fact:** a call the ceiling allows and the tool restriction forbids is **served**, the denied bytes reach the
model, and **every** sink fact is attributed to the Member realm (`toolBindingIdentity: null`). There is no binding
fact at all — the mechanism was never consulted. This is precisely the "second axis missing" state the external ruling
named.

---

## 3. The binding-realm mechanism itself is correct — arms (a)(b)(c)

The committed suite `tests/world-factory/a5sf-tool-axis.test.mjs` (host-free; real `dsh-tool-fs` from the pinned
baseline; real `ToolRuntime`; real mount) drives `realm.bindings[0].fs` **directly**, so the mechanism is measured
without the missing attach. It uses the REAL `compileEffectiveIo` for the intersection — no re-implementation.

| arm | ceiling | restriction | compiled lane | call | result |
| --- | --- | --- | --- | --- | --- |
| **TA4a** (a) | `[<dir>]` | `[<dir>/inside]` | `[<dir>/inside]` | `ceiling-only.txt` | **DENY** `IO_READ_DENIED`, exactly **1** fact `realm:"binding"`, `toolBindingIdentity:"dsh.fs/read"`, base Provider never asked |
| **TA4b** (b) | `[<dir>/inside]` | `[<dir>]` (WIDER) | `[<dir>/inside]` | `ceiling-only.txt` | **DENY** — `compileEffectiveIo` intersects, so a restriction cannot widen; the runtime realm enforces the compiled lane |
| **TA4c** (c) | `[<dir>]` | `[<dir>/inside]` | `[<dir>/inside]` | `inside/ok.txt` | **ALLOW**, exactly **1** fact `realm:"binding"`, `decision:"allow"` |

Verbatim from `tool-axis-suite.log` (7/7):

```
✔ TA1 one realm per Member AND one per ToolBinding; the product tool-plane naming addresses the MEMBER realm only
✔ TA2 SEAM: a call the CEILING allows but the read RESTRICTION denies is ALLOWED by the native execution path (regression sentinel)
✔ TA3 CONTROL: a call allowed by BOTH the ceiling and the restriction is allowed
✔ TA4a ceiling allows + restriction denies => the binding realm DENIES with exactly one fact
✔ TA4b ceiling denies + a WIDER restriction allows => compileEffectiveIo intersects and the binding realm DENIES (no widening)
✔ TA4c both allow => the binding realm ALLOWS with exactly one fact
✔ TA5 structural pin: the native attach targets installation.members[0].ctx and no product source addresses realm.bindings for execution
ℹ tests 7
ℹ pass 7
ℹ fail 0
```

TA2 is the committed **regression sentinel** for today's behaviour: it asserts the leak (and is labelled SEAM) so that
the seam PR must invert it. TA3 is the discriminating control: the same native read path works, so TA2 is not a broken
read path. TA5 pins the addressing fact in source (`mount.ts` targets `members[0].ctx`; the glue never reads
`.bindings`).

### 3.1 Why the real tool package cannot simply be mounted into one binding realm

The pinned baseline's `@deepseek-ai/dsh-tool-fs` registers a whole suite from ONE `apply`:

```
tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js:1192-1206
function apply(ctx, config) {
  …
  applyReadTool(ctx, {…});
  ctx.inject(["attachments"], (imageCtx) => { applyReadImageTool(imageCtx) });
  const sandbox = new FsSandboxController(ctx);
  applyWriteTool(ctx, sandbox);
  applyEditTool(ctx, sandbox);
}
```

Every tool body resolves `ctx.fs` from that ONE plugin context. Mounting the module into the `dsh.fs/read` realm would
confine `write`/`edit`/`read_image` with **read's** lane — a wrong lane, not the sibling tools' `ToolRestriction` (it
would break arm (c) for the siblings). Mounting the module once per binding realm in the same agent scope collides on
the duplicated tool names (`tools.register` refuses a duplicate in one scope layer, measured by the route-C suite's
surface neutrality law).

---

## 4. SEAM PROPOSAL — S-1: per-tool execution binding at the native attach

**Goal:** make the execution path select the already-compiled per-binding realm **per tool**, with no new policy
compiler and no second permission system.

**Where:** `packages/runtime/team-services/src/mount.ts` (`MountedA5sfRealm.mountNativeToolModules`) plus a thin
adapter in `a5sf-realm-row.mjs`. Public seam, zero Core patch.

**Shape (smallest correct):**

1. `NativeToolModuleMount` gains an optional `toolBindingIdentity`.
2. For a binding-targeted module, the mount creates ONE child scope over the binding realm's ctx
   (`realm.bindings[i].ctx` — already isolated by `installToolBindingRealm`) and installs a **registration router**
   there:
   - `ctx.tools.register(def)` forwards `def` to the REAL `ToolRuntime` **only when `def.name` is the binding's tool
     name** (the last segment of `owner/toolName`); every other definition of the package is dropped from *this* fiber
     and is registered by the fiber of its own binding (or by the ceiling fiber when it has no binding);
   - the forwarded definition's handler still closes over the binding realm ctx, so `ctx.fs` is **that binding's
     confined Provider** and its consultations carry `realm:"binding"` + `toolBindingIdentity`;
   - `ctx.systemPrompt.section` is routed by the same tool name (`tool:<name>`), so the prompt surface stays exactly
     one section per tool;
   - a route with no mounted binding realm for the tool falls back to the ceiling realm (today's behaviour), and a
     module entry naming a tool its package does not register is a **typed refusal** (fail closed).
3. The existing surface-neutrality check in `attachA5sfNativeToolModules` remains the final gate: the UNION of the
   filtered fibers must reproduce the post-deny model-visible surface byte-for-byte (names and prompt sections).
4. `EffectiveIo` is never recomputed: the router selects `realm.bindings[i]`, whose guard was installed from the
   compiled intersection. Widening is impossible because the selected guard is the compiled one.

**Why this is not a second policy system:** the router evaluates no lane and reads no blueprint. It is a *dispatch*
of already-installed realms keyed by the tool name the ToolRuntime already knows. The only new authority is "which
mounted realm a tool name belongs to", and the answer is the `toolBindingIdentity` P1 already compiled.

**Rejected alternatives (recorded):**

- **S-2 — per-call provider multiplexer keyed by AsyncLocalStorage:** requires rebinding every definition's `execute`
  and an ambient tool identity the fs provider methods do not receive on the effect boundary (`ctx.fs.readText(target,
  exec.signal)` passes only the signal), so it would wrap the tool registry *and* the provider — more mechanism, same
  policy content.
- **S-3 — mount the whole module into one binding realm:** applies one tool's restriction to its siblings; wrong lane
  and breaks arm (c) for them.

**Interim option (for the coordinator, not implemented here):** until S-1 lands, the attach could **refuse** to mount
native tools when a mounted binding realm's compiled lane is strictly narrower than the Member ceiling (fail closed
instead of silently widening). That is a lane-comparison guard, not a policy compiler; it is deliberately left out of
this lane because it would hide the leak that the RED arm and TA2 must keep measuring, and it changes live behaviour
that this lane has no boot budget to re-verify.

---

## 5. What this lane does NOT claim

- It does **not** claim the invariant holds at runtime. It holds for the mounted binding realm (arms a/b/c) and does
  **not** hold on the native execution path (RED + TA2). That gap is the finding.
- It does **not** claim the live path is unchanged for a *well-formed* binding: the live-native3 boot supplied no
  `bindings`, so the binding axis was not exercised there at all.
- It does **not** claim kernel/OS enforcement, a Host boot, or a model-judgement path: all arms are host-free, and the
  model calls are dispatches through the real registry.
- It does **not** book new protected-centre sha256 values: no protected source changed.
- It does **not** modify `tests/deepseek-harness-test-use`; that tree is read-only evidence source.

---

## 6. Risks for the reviewer (one, stated plainly)

**The seam changes the native attach's identity model.** A filtered per-tool fiber means one Cordis fiber per
`(module × binding)` instead of one per module: teardown order (shadow before the confined provider), the
surface-neutrality check, and prompt-section de-duplication all become per-fiber invariants rather than per-module
ones. The suite's TA1/TA2 and the route-C suite pin today's single-fiber shape, so a seam PR must update both —
and the live teardown half is still NOT_REACHED (`a5sf-live-native3` §8), so a per-fiber disposal path cannot be
validated in a booted Host under the current budget. That is the risk to schedule against the remaining boot.

---

## 7. Environment disclosure (fresh worktree)

This fresh worktree had no `tests/deepseek-harness-test-use` and no package `node_modules`. `node_modules` was
installed with `pnpm install --frozen-lockfile --ignore-scripts --store-dir <repo>/.pnpm-store` (the shared store; the
home store is outside the workspace-write sandbox). The pinned baseline checkout is the shared pristine
`<repo>/tests/deepseek-harness-test-use` (`detached @ 639ed015397290b3745d163aafe02ffee4aa3f84`, `porcelain` empty),
exposed to this worktree through a **symlink** and excluded via `.git/info/exclude`; it is read-only in this lane. No
Host was started; no `tests/homes/**` entry was created.

---

## 8. Files and reproduction (no boot)

```bash
node --test tests/world-factory/a5sf-tool-axis.test.mjs          # 7/7 (TA1..TA5)
node dev/agent-workflow/evidence/a5sf-tool-axis/red-arm.mjs      # exit 1 TODAY: the desired arm fails
node scripts/eb3-evidence-guard.mjs
```

| file | what it is |
| --- | --- |
| `tests/world-factory/a5sf-tool-axis.test.mjs` | the committed host-free suite: topology, the SEAM sentinel, the control, intersection arms (a)(b)(c), the structural pin |
| `red-arm.mjs` / `red-arm.log` | the one-shot DESIRED-behaviour arm and its measured RED (exit 1) |
| `tool-axis-suite.log` | the suite's 7/7 run |
| `all-a5sf-node-suites.log` | every a5sf `node:test` suite: 82/82 |
| `vitest-a5sf.log` | `vitest run a5sf`: 166/166 |
| `law-and-p4t6.log` | ARC-A / ARC-D / A4P3 lane hygiene + p4t6: 54/54 |
| `p4t6-post-booking.log`, `p4t6-measured-tie.log` | the LAST-measured p4t6 suite (20/20) and the measured tie (`filesScanned=1428`, booking `{1396,1428}`) |
| `typecheck.log`, `build.log` | `pnpm -r typecheck` / `pnpm -r build` exit 0 |
| `place-dist-glue.log`, `check-artifacts-committed.log`, `check-artifacts-at-head.log` | dist glue + both artifact gates |
| `eb3-evidence-guard.log`, `eb3-ci-required.log`, `eb3-negative-controls.log` | EB3 gates |
| `ci-local.log` | `pnpm ci:local` verbatim (see §9) |
| `README.md` | this document |

---

## 9. Gates (measured on this tree)

| check | result |
| --- | --- |
| new suite `a5sf-tool-axis.test.mjs` | **7/7 pass**, 0 fail (`tool-axis-suite.log`) |
| all a5sf `node:test` suites (8 files incl. the new one) | **82/82 pass**, 0 fail (`all-a5sf-node-suites.log`) |
| `vitest run a5sf` | **166/166 pass**, 11 files (`vitest-a5sf.log`) |
| p4t6 | **20/20 pass**; MEASURED LAST on this tree: `filesScanned=1428 files.length=1428`, A5SF booking `{from:1396,to:1428}` unchanged (`p4t6-post-booking.log`, `p4t6-measured-tie.log`) |
| law suites (ARC-A fitness / ARC-D adversarial / A4P3 lane hygiene) | **34/34 pass** (12+13+9), together with p4t6 **54/54** (`law-and-p4t6.log`) |
| typecheck | exit 0 (`typecheck.log`) |
| build | exit 0 (`build.log`) |
| `place-dist-glue` | `done (101 placement(s))` (`place-dist-glue.log`) |
| `check-artifacts-committed` | `verdict=ok compared=1916 glue=101` (`check-artifacts-committed.log`) |
| `check-artifacts-at-head` | `verdict=ok compared=1916 drift=0` — HEAD carries its own build (`check-artifacts-at-head.log`) |
| `eb3-ci-required` | `pass workflows=9 findings=0` (`eb3-ci-required.log`) |
| negative controls | `26/26 control(s) behaved as required` (`eb3-negative-controls.log`) |
| `eb3-evidence-guard` | exit 0 (`eb3-evidence-guard.log`) |
| `pnpm ci:local` | **`DSH-CI-LOCAL verdict=pass steps=5 failed=0 coverage=determined files=1 wall=13.9s`** (`ci-local.log`) — verbatim |
| `git diff --check` | clean |

`pnpm ci:local` selected the new test through the change set and re-ran it green (`node --test (selected)` 7/7);
`coverage=determined` because the only other change is `dev/**` evidence prose, which the tool classifies as
docs-only. Nothing was skipped or downgraded to reach that verdict.

