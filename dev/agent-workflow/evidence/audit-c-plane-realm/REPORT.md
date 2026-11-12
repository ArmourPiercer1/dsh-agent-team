AUDIT-C-PLANE-REALM

# AUDIT C — who owns tool execution when one v5 Team carries both `memberIoCeilings` (Alpha.5 realm) and `reviewRouting` (Alpha.6)?

**Branch:** `task/audit-c-plane-realm-20261111` (worktree `.worktrees/audit-c`), base
`origin/master` @ `9e1c493b6`. **Class:** read-only audit. No product file was changed, no
Host was booted, no product commit/PR exists on this branch (the single commit is this
report). Defect source: `origin/task/pd42-v5-cellings-20261111` (`bf73378db`) and its
evidence `dev/agent-workflow/evidence/pd42-v5-cellings/README.md` (runs 1 and 2 agree).

**Verdict (short).** Not a precedence bug and not one bug. The code shows
**(a) a missing registration** for `bash` (the realm's confined terminal is never mounted on
this composition, and could not be: it has no `subprocess`/`terminals` face), **(b) a missing
*binding*** for `read`/`write` (the realm's route-C shadow definitions are registered but
never declared to the closed-world Guard, so they are bound `unverified`), and **(c) an
architectural ownership gap underneath both**: two assemblies write one agent-scope name
layer with no arbitration seam, so "who owns `bash`" is decided by composition-time omission
(the test kit drops the preset row), not by product precedence. The minimal fix for
`read`/`write` is inside approved seams and does not touch exactly-once. The minimal fix for
`bash` is **not** inside the currently reachable configuration: the realm has no process face
in the product composition, so the proposed `faces.terminals` adapter is a no-op until the
product realm plan mounts one.

---

## 1. Validation of the parallel investigation (claim → verdict)

I re-derived each claim from the code at `9e1c493b6` (not from the PR-720 summary). Two claims
are wrong/incomplete in ways that change the fix.

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Three owners: PA decides admission, plane owns `bash`/`grep`/`glob`/`pwsh` definitions **and bindings**, realm owns confined faces + `read`/`write`/`edit`/`read_image` definitions but **registers no binding**, only a routing receipt | **Needs correction** (substance holds; the ownership list is over-broad) | PA/consume first: `packages/tools/a5p5-tools/src/pipeline.ts:113` (`decide`), `:119-165` (PA), `:178` (`backend.run`) — correct. Plane places: `team-tool-plane.mjs:2140-2156`, `:2010` (`ownNames` = placed defs only). Realm faces: `team-services/src/install.ts:593-604`. Realm routing receipt: `mount.ts:1906-1926`, `toolBindingIdentity: binding?.toolBindingIdentity ?? null` at `:1914` — correct. **But the plane does not own `grep`/`glob`/`read`/`write`/`edit`/`read_image` in this composition**: `DEFAULT_PLANE_NAMES` is the `team_*` alias set (`team-tool-plane.mjs:113`), the fs family is disabled without `fsInstance` (`tools/families/fs.mjs:50-56`), and `ownNames` only lists *placed* definitions (`:2010`). PD42 configures only `names.bash:'bash'` (`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs:630-634`), so the plane's placed set here is `bash` + `pwsh` (+ its aliases). The disabled fs family still *claims* `read` for the kernel table with a forever-null answer (`fs.mjs:56` → `team-tool-plane.mjs:1943-1951`), but nothing is placed under that name. |
| 2 | `read`/`write` refused because realm-forwarded names are not in `assemblyOwnedNames` and not in global `nativeNames` ⇒ `bindInheritedSurface` → `verified:false` → `TOOL_BINDING_UNVERIFIED` | **Confirmed** (causal chain exact; one line ref drifts) | `bindInheritedSurface`: `tool-dispatch/closed-world-guard.ts:432-497`; `claimsNative` false ⇒ `unverifiedReason:'unattributed'` (`:449-465`) ⇒ `verified:false` (`:497-503`); guard denial `:576-591` (fallback branch ⇒ message at `:199`, which is byte-identical to the observed text in `runs/run1/a6-officer.json:137-139`). Not native-global: `nativeNames` is harvested from `tools.schemas()` **with no scope** (`agent-bindings.mjs:2872-2876`), while preset rows mount under the preset-registry generation scope (`a5sf-realm-row.mjs:66-75`) and route-C shadows mount in the agent scope. Not assembly-owned: `assemblyOwnedNames` is `a5PlaneOwnedNames`, filled only from the plane (`agent-bindings.mjs:2784, 2914, 3350`); `bindOwnTools` list is a different array (`:3116, 3650-3651`). Line drift: the "no terminals face" is `install.ts:593-604` (`terminals: terminals ?? null` at `:603`), not `:590-603`. |
| 3 | `bash` runs because it is a plane own-name (`bindOwnTools` → `bindAll('team-own')`) and its effect runs on the plane's own `confinedCfg`, not the realm terminal ⇒ 0 realm facts | **Confirmed** | `agent-bindings.mjs:3349-3351, 3650-3651` → `tool-dispatch/install.ts:1162-1250` (`bindAll`, `verified:true` at `:1260`). Effect: `tools/families/process.mjs:59-79` (`createConfinedShellBackend` over `confinedCfg`) and `:97` (`shell: cap.injected.shell ?? realShell ?? shut`). Measured 0 facts: `runs/run1/pd42-ceiling.json` (`"facts": []`). The realm sink only receives facts from a **realm face** consult (`team-services/src/guard-observability.ts:46`, `install.ts:512-536`), which the plane's provider never enters. |
| 4 | "Two arrays" trap: fixing only `a5PlaneOwnedNames` still leaves `write` refused, so **both** must be updated | **Partially refuted** | The two arrays are real and distinct (`agent-bindings.mjs:2784` vs `:3116`) — confirmed. But `bindAll` consults `assemblyOwnedNames` **only inside the feed branch** (`install.ts:1167` used at `:1189-1212`); with no feed entry for a realm name (`bindingFeed` answers only from the plane's placement map, `agent-bindings.mjs:2921-2925`), the binding is minted from the live scoped read (`install.ts:1260`). So pushing the name into the **`bindOwnTools` list** alone is sufficient for `read`/`write` to become verified (host-free proof of the no-feed bind path: `packages/runtime/test/a5pbr2-binding-feed.test.ts:216-226`, 10/10 green when re-run in this worktree). Pushing only `assemblyOwnedNames` does nothing for verification. Both should still be updated for consistency (the `nativeNames` filter at `install.ts:1301` and the coverage gate at `agent-bindings.mjs:3620` read them), but "both required" is wrong. |
| 5 | The seam exists (`backends` → `injected`, used only for jobs); **no per-Member binding override exists** | **Needs correction** | `createTeamToolPlaneAssembly` input is `:695`; `injected` at `:1711`; process family prefers `cap.injected.shell` at `process.mjs:97`; glue injects only `jobs`/`backgroundJobs` (`agent-bindings.mjs:3323-3327`) — correct. But **there are per-Member definition/policy seams**: `a5sfNativeToolModules` row config (route C, `a5sf-realm-row.mjs:340-520, 589-640`), `a5sfRealmProvider.compiledFor` (per-Member compiled ceiling/binding injection, `:36-49, 846-987`), and a per-(Member×ToolBinding) confined realm `installToolBindingRealm` (`team-services/src/install.ts:698-784`), reachable from `mountNativeToolModules(toolBindingIdentity)` (`mount.ts:1706`). What does not exist is a per-Member override of the **closed-world Guard's `verified` flag** — that is `bindOwnTools`-only (`install.ts:1344`). |
| 6 | Fix = (A) export `a5sfAttachedToolNames(fibers)` reading `NATIVE_REGISTRATION_ROUTING.forwarded`, push into both own-name sets; (B) adapter mapping `faces.terminals` → `backends.shell`, injected only when the face exists | **A: approve with a tighter predicate. B: forbid as written — it cannot fire in this composition** | Receipts exist and are publishable: `mount.ts:1906-1926` (routed) and `:1653` (direct), constant `NATIVE_REGISTRATION_ROUTING` at `:403`; the glue **discards** the attach's return value (`agent-bindings.mjs:3028` is a bare `await`). (B): `faces.terminals` is `terminals ?? null` (`install.ts:603`) and `terminals` is only set when `input.terminal` + `input.subprocess` are supplied (`install.ts:498, 512-545`; `mount.ts:721-726, 818-826`). The **product** realm provider supplies neither: `createProductRealmProvider` returns `{ members, bindings? }` only (`team-services/src/product-assembly.ts:1278-1281`), so on the PD42 v5 path `faces.subprocess === null` **and** `faces.terminals === null`. Change B's guard condition is therefore always false here ⇒ a safe no-op that fixes nothing. |

**Additional finding the parallel investigation missed (and it matters for the fix):** because
`faces.subprocess === null`, route C also declines the **PD-12 `bash` shadow**
(`a5sf-realm-row.mjs:1014-1040`) and the **PD-16 `grep`/`glob` shadow** (`:1113-1140`). So in this
composition `grep`/`glob` are still the preset's host definitions and would be refused exactly
like `read`/`write` if called; only `read`/`write`/`edit`/`read_image`/`present` are realm-served.
`bash` is not "displaced at dispatch": the realm never mounted a `bash` body at all.

---

## 2. Ownership diagram (as the code actually draws it)

```
v5 Team (memberIoCeilings + reviewRouting)
│
├── Alpha.6 review lane (assigned officer, wake, resolve)
│     └─ owns ADMISSION ORDER for the re-dispatched call, not the tool:
│        pipeline.ts:113 decide → :119-165 PA/consume (exactly-once, one-shot)
│        → :178 backend.run        (effect only; no retry, no second consume)
│
├── Alpha.5 Team tool PLANE  (createTeamToolPlaneAssembly, team-tool-plane.mjs:695)
│     ├─ placement (Agent own layer): :2140-2156   → names = { team_grep, team_glob, bash*, pwsh }
│     ├─ binding: agent-bindings.mjs:3650-3651 bindOwnTools → install.ts:1162-1250 'team-own'
│     │        (verified; placement feed optional, :1189-1212)
│     └─ effect: its OWN confined provider over planeCfg.confinedProvider
│              process.mjs:59-79, :97  (Landlock launcher; NOT the realm)
│
├── Alpha.5 Member REALM  (mountA5sfRealm, mount.ts:814 → installMemberIoProviders, install.ts:274)
│     ├─ faces: fs = confined  (always)
│     │         subprocess / web / terminals = null unless the provider supplies them
│     │         install.ts:593-604; product provider supplies NONE (product-assembly.ts:1278-1281)
│     ├─ route C shadow (attachA5sfNativeToolModules, a5sf-realm-row.mjs:1465)
│     │         fs   → read/write/edit/read_image   (:1136, :1493, :1567-1570)
│     │         shell/search → SKIPPED (no subprocess/terminals face)
│     │         present → direct mount; skill → only with a skill catalog
│     └─ binding: NONE. Publishes only a routing receipt (mount.ts:1906-1926);
│              the glue discards the returned fibers (agent-bindings.mjs:3028).
│
└── Closed-world Guard (installScopedToolGuard, tool-dispatch/install.ts:356)
      ├─ own names   → bindOwnTools :1344 → verified :1260
      ├─ MCP names   → bindMcpTools
      ├─ inherited   → bindInheritedSurface (publish, :1302) → verified ONLY if
      │                name ∈ nativeNames (global view) AND scoped == global identity
      │                (closed-world-guard.ts:449-470); everything else = 'unattributed'
      └─ dispatch denial at closed-world-guard.ts:576-591 (message :199)
```

**"Which wins when both are present" — the deciding line.** There is no precedence rule,
because there cannot be two: the pinned host keys scoped layers by the exact scope
(`tests/deepseek-harness-test-use/packages/core/scope/src/store.ts:239-242`) and a second
registration of the same name in that one layer throws
(`packages/core/tools/src/index.ts:747-748`: `tool "<name>" is already registered in this
scope`). The realm's route-C shadow and the plane both target the **same** agent scope
(`a5sfToolPlaneOf(realm).ctx` = `installation.members[0].ctx`, `a5sf-realm-row.mjs:315-333`;
route C's `memberTarget` is the same field, `mount.ts:1390`). So if both register `bash`, the
**later** one (the plane, `agent-bindings.mjs:3340`, after route C at `:3028`) throws and the
whole Member setup fails (`team-tool-plane.mjs:2140-2156` → `PLANE_PLACEMENT_CONFLICT` →
`agent-bindings.mjs:3341-3349`). The "winner" is therefore decided *before dispatch* by
**omission**: the PD42 kit removes `tool-bash` from the Member's preset copy
(`c1-leader-approval-smoke.mjs:1046-1066`), which also makes
`confinedTerminalSpecOf`'s surface gate (`a5sf-realm-row.mjs:1052`) decline the terminal
shadow. The deciding lines are the surface gate (`:1052`) and the duplicate law
(`team-tool-plane.mjs:2155`), not any resolver.

---

## 3. Per-tool binding table (this composition)

| tool | body the model resolves | who registered it | guard binding origin / how | effect face | realm `a5sf-guard-consult/1` facts | PD42 result |
|---|---|---|---|---|---|---|
| `bash` | plane governed shell row | plane placement `team-tool-plane.mjs:2140-2156`; spelling `bash` per `:711` + `verifyPlaneNames` `:393-415` / ledger `:361-392` | `team-own` → `bindOwnTools` (`agent-bindings.mjs:3650-3651` → `install.ts:1162-1250`) ⇒ **verified** | plane's `createConfinedShellBackend` over `planeCfg.confinedProvider` (`process.mjs:59-79,97`) | **0** (plane provider never consults the realm guard) | executes exactly once; 0 facts |
| `read`, `write`, `edit`, `read_image` | realm route-C confined fs shadow | `attachA5sfNativeToolModules` → `realm.mountNativeToolModules` (`a5sf-realm-row.mjs:1493,1567-1570`; `mount.ts:1346`) | inherited/observed ⇒ names not in `nativeNames` and not in `bindOwnTools` ⇒ `unverifiedReason:'unattributed'` (`closed-world-guard.ts:449-470,495`) | realm confined `fs` (`install.ts:274-460`) | **0** (refused before the body) | refused `TOOL_BINDING_UNVERIFIED` |
| `grep`, `glob` | **preset host** definitions (route-C search shadow declined: no `subprocess` face, `a5sf-realm-row.mjs:1115`) | preset registry scope | same `unattributed` path | inherited base `subprocess` (unconfined) | 0 | would be refused (not measured) |
| `present` | realm direct mount of the host package on confined `fs` (`a5sf-realm-row.mjs:1355-1371`) | route-C direct mount (`mount.ts:1560-1690`) | `unattributed` (same reason) | realm confined `fs` | 0 | would be refused (not measured) |
| `skill` | preset placeholder (no catalog configured ⇒ no shadow, `a5sf-realm-row.mjs:1299-1316`) | preset registry scope | `unattributed` | base `fs` | 0 | would be refused (not measured) |
| `team_*` team tools | Team catalog | glue `toolPlaneCtx.tools.register` (`agent-bindings.mjs:3053`) | `team-own` (`bindOwnTools`, list `:3650`) | in-process | n/a | verified |
| `pwsh` | plane governed pwsh row | plane, fixed native spelling (`process.mjs:37-39`) | `team-own` (verified) | plane confined provider | 0 | verified (not measured) |

Two distinct failure shapes are visible: **bash = no realm body at all** (missing registration);
**read/write = realm body present, no Guard binding** (missing attribution). Neither is a
resolver-precedence decision.

---

## 4. Why `bash` runs but `read`/`write` do not (resolver trace)

There is **one** resolver (the Guard) with **one** binding table, but **two** binding *sources*:

1. `bindOwnTools(names)` — placement-attributed, verified by the trusted assembly
   (`install.ts:1162-1250`, handle method `:1344`).
2. `bindInheritedSurface(surface, identities, trusted)` — at publish, a name is `dsh-native`
   **only** if it is on the explicit global-view list **and** the scoped read equals the global
   read (`install.ts:1302`; `closed-world-guard.ts:449-470`). Everything else is bound
   `verified:false`, `unverifiedReason:'unattributed'|'native-shadowed'|...` and refused at
   dispatch (`:576-591`).

`bash` goes through (1): it is in the plane's `ownNames` (`team-tool-plane.mjs:2010`), pushed
into the `bindOwnTools` list (`agent-bindings.mjs:3650`). `read`/`write` go through (2) and fail,
because a preset-scope or agent-scope definition is not the global definition
(`agent-bindings.mjs:2872-2876`). No per-tool table exists; the only per-tool input is which
list the name landed in.

**Is there any other path by which a realm `read`/`write` could become verified?** No:
- `bindInheritedSurface` (native) — requires global-view equality, impossible for a route-C body;
- `bindMcpTools` — requires the `mcp__` introduction set (`agent-bindings.mjs:3665-3675`);
- `dispatcher.bind` via the feed — still only reachable from `bindAll`, i.e. from
  `bindOwnTools`/`bindMcpTools`;
- `revalidate` — never binds added names (`closed-world-guard.ts` `revalidateSurface`; PR1 rule).

So Change A (declare the realm's forwarded names as assembly-own, then `bindOwnTools`) is
**necessary**, and it is the only existing seam that can verify them.

---

## 5. Can the plane's dispatch call the realm terminal? (Q4)

What a realm needs to serve each tool:

* `read`/`write`/`edit`/`read_image`: the confined **`fs`** provider on the realm's isolated
  scope — always mounted (`install.ts:274-460`); route C forwards the definitions over it.
* `bash` **as a realm face**: a confined **`terminals`** face, which requires
  `input.terminal` (program + declared shell class) **and** a mounted confined
  `subprocess` face (`install.ts:498-545`; `mount.ts:721-726`; `createConfinedTerminalFace`,
  `terminal.ts:394-420`). That face answers `spawn/startSend/read/signal/kill/list`
  (`terminal.ts:151-167`) and consults the realm guard before any process
  (`:63`, facts via the `onGuardConsult` observer).

The plane's dispatch **cannot** call it today:
1. the realm mounts **no** `subprocess` and **no** `terminals` face in this composition —
   `createProductRealmProvider` returns no `terminal`/`subprocess` and `a5sf-realm-row.mjs:976`
   only forwards what the provider answers;
2. even with a face, the plane's shell row is a bespoke provider built from
   `planeCfg.confinedProvider` (`process.mjs:59-79`) and has no reference to `ctx.terminals`;
   the only reachable injection is `backends.shell` (`team-tool-plane.mjs:1711` +
   `process.mjs:97`) or a family reading `cap.hostService('terminals')`
   (`team-tool-plane.mjs:1709-1716`, bound at `mount()` to `toolPlaneCtx`, i.e. the realm scope);
3. the terminal face's owner fence needs an owner object with a non-empty `id`
   (`terminal.ts:439-442`); the plane row does carry `exec.agent` (used for cwd at
   `confined-terminal-tool.mjs:66-72`), but whether `exec.agent.id` is populated on the
   re-dispatch path is unverified here.

---

## 6. Minimal fix

### 6.1 Approve — Change A (corrected): bind the realm's forwarded definitions

**Files (2 product files):**

1. `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` — new export
   `a5sfAttachedToolNames(fibers)` that reads `fiber[NATIVE_REGISTRATION_ROUTING]`
   (`mount.ts:403`) and returns the names in `routing.forwarded` for fibers whose
   `routing.realm === 'ceiling'`. Use `forwarded` **only** — never `observed` (it includes
   dropped names, `mount.ts:1906-1926`) and never `expectedTools` (a declaration, not a fact).
   Drop names whose definition the seam did not actually replace: the attach's own coverage
   gate already proved `post-attach identity !== pre-attach baseline` for every forwarded name
   (`a5sf-realm-row.mjs:1659-1690`), so `forwarded` is the honest set. Optional strengthening:
   add the recorded definition identity to the receipt (the partition already holds
   `forwardedDefinitions`, `mount.ts:465,677,1651`) and require identity equality at bind time.
2. `packages/runtime/src/plugin/live/agent-bindings.mjs` —
   * capture the attach's return (`:3028` becomes `const a5sfNativeFibers = await …`);
   * compute `realmOwned = a5sfAttachedToolNames(a5sfNativeFibers ?? [])` and, **after** the
     plane's own names are known (`:3349-3350`), push each name into **`a5PlaneOwnedNames`**
     (so `install.ts:1301` excludes it from the native-inherited filter) **and** into
     **`a5PlaneOwnNames`** (so `bindOwnTools` at `:3651` covers it);
   * do **not** add them to `teamToolNames` in the coverage gate (`:3620`): they are native
     permission classes and must keep their `PERMISSION_TOOL_NAMES` coverage.

**Safe predicate (guards against widening):**
`name ∈ routing.forwarded` **and** `routing.realm === 'ceiling'` **and** `name` is on the
post-attach surface **and** `name` is not in the plane's `ownNames`/placement feed **and**
`tools.get(name, runtimeAgent)` is readable (otherwise fail closed exactly as `bindAll` does at
`install.ts:1173-1185`). This cannot attribute a name the realm did not forward, and a name the
plane placed is excluded so the two binding families can never race.

**Explicitly not changed:** execution, PA/consume, the plane's placements, the realm's lane
compilation, `PLANE_SUPPORTED_NATIVE_TAKEOVERS`, `assemblyOwnedNames` feed semantics.

**Exactly-once / no-replay:** untouched. `bindOwnTools` is bind-time only; it adds no
execution edge. Every call is still re-verified against the pinned definition identity at the
dispatch door (`tool-dispatch/install.ts` execute seam → guard), and a moved body is refused.

**Risk:** the names that become callable are exactly the bodies the realm already mounted and
whose identity the attach's coverage gate already proved; the effective lane is the realm's
compiled `fs` lane, so an out-of-lane call still returns `IO_*_DENIED` with a fact (host-free
proof: `tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs` A1/D1/D2). Residual risk: a
forwarded name whose body is not on a confined face would now be callable — `present` (direct
mount, host package on confined `fs`) and `skill` are the only candidates, both realm-served.

**Regression surface:** no realm ⇒ `attachA5sfNativeToolModules` returns `undefined` ⇒ empty
set ⇒ byte-identical. Plane absent ⇒ `a5PlaneOwnNames` only gains realm names (the same
`bindOwnTools` path); `bindAll`'s feed branch never runs for them. Alpha.6 off ⇒ this code path
does not read `alpha6ReviewRouting` at all ⇒ unchanged. Members with a permissions policy but
no `teamToolPlane` today still install no Guard (`agent-bindings.mjs:2812` is gated on
`permissionPolicy !== undefined` only) — unaffected.

Host-free check to run before/after: `npx vitest run packages/runtime/test/a5pbr2-binding-feed.test.ts`
(10/10 in this worktree) plus `node --test tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs`.

### 6.2 Forbid as written — Change B (`faces.terminals` adapter)

It cannot fire: `faces.terminals === null` on the product realm plan
(`product-assembly.ts:1278-1281` → `install.ts:603`), so the injection condition is never met and
the change is a no-op that would be mistaken for a fix. It also cannot be made to fire without
touching the shared product assembly:

* the realm needs a **declared shell class + program** (`createConfinedTerminalFace`,
  `terminal.ts:394-420`) and a confined `subprocess` provider (`mount.ts` `subprocess` input);
  choosing those is a policy decision, not derivable in the glue;
* the mount input is assembled in `packages/runtime/team-services/src/product-assembly.ts`
  (shared file, Integration-Owner-only per `docs/ROUTER_RULES.md` §0.1) and carried by
  `a5sf-realm-row.mjs:976`;
* even then, the realm must **not** also register `bash` (route C) while the plane places
  `bash` — one scope layer, one entry per name (`core/tools/src/index.ts:747-748`). The
  compatible shape is the one the parallel investigation proposes *after* the face exists:
  plane row stays the only `bash` registrant, and its effect is an adapter that calls the
  realm's `terminals` service (via `backends.shell` or `cap.hostService('terminals')`),
  returning the plane row's failure codes verbatim and refusing `background:true` by name.

**Exactly-once for a future Change B:** the adapter would run **after** `decide` and after the
PA consume (`pipeline.ts:113/119/178`), exactly once per admitted call; it must open one
session + one `startSend`, never retry or re-send, and map a `TeamIoDenial` to a typed failure
(a post-approval ceiling refusal is required by plan §0 invariant 2, not a replay). No change
to the one-shot consume is permitted or needed.

### 6.3 Honest interim for `bash`

Until a realm process face exists, a governed Member whose realm is mounted but whose `bash`
effect runs on a different provider produces a **success with zero realm facts** — the worst
shape, because it reads as governed. If the bash arm is not implemented now, the conservative
alternative is a typed `ENFORCEMENT_UNAVAILABLE` refusal when a realm is mounted and the plane's
shell backend is not the realm's face, rather than a silent 0-fact success.

---

## 7. What I could not determine

1. **The actual contents of `nativeNames` on the real Host** (`tools.schemas()` with no scope)
   in the PD42 world. I inferred "`read`/`write` are not on it" from the observed message text,
   which maps uniquely to `unverifiedReason:'unattributed'` (`closed-world-guard.ts:576-591`);
   confirming it needs a Host boot, which this audit is not allowed to perform.
2. **Whether `exec.agent.id` is populated on the A6 re-dispatch path** (needed for the
   terminal owner fence, `terminal.ts:439-442`) — `confined-terminal-tool.mjs` only relies on
   `exec.agent.session.header.cwd`.
3. **Which `memberIoCeilings` compiled shape (v4 vs v5) supplies a shell class / program** —
   the product-assembly plan carries no `terminal` spec at all, so the question is open by
   construction, not by a missing read.
4. **The exact reason the plane's `grep`/`glob` aliases and `pwsh` row were not exercised** in
   PD42 (the kit drives `bash` only); the table above marks them "would be refused / verified,
   not measured".
5. **Whether a second, independent live composition (no plane, realm only) can make the A6 ask
   reach the Officer at all** — the PR-720 evidence reports `wakes=0`; I did not reproduce it.
6. I did not run the `dist` artifact/placement gate (`node scripts/check-artifacts-committed.mjs`)
   because this audit changes no product file; any Change A/B implementation must run it.

## 8. Read-only statement

One file written (`dev/agent-workflow/evidence/audit-c-plane-realm/REPORT.md`), one local commit
on `task/audit-c-plane-realm-20261111`. No product source, product commit, PR, push, merge, Host
boot, or `:3080` interaction. Host-free test run: `packages/runtime/test/a5pbr2-binding-feed.test.ts`
(10/10 pass) in this worktree.
