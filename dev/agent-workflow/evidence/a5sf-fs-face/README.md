# FS face — layer B (per-native-tool contract) acceptance, host-free

Task: **layer B acceptance of the FS capability face** (the per-native-tool contract
that layer A cannot cover).
Branch: `task/a5sf-fs-contract-20261107` (worktree `.worktrees/a5sf-fs-contract`,
based on `origin/master` = `f02036ac9`).
Host starts spent this round: **0** (three earmarked starts — FS/Search
revalidation, BL-17 live, BL-18 live — remain untouched). `CORE PATCH BUDGET = 0`:
no upstream file was read-write, no Team product file is changed by this branch.
Grades and `V@B` in `TOOL-ACCEPTANCE-MATRIX.md` are **unchanged**; only evidence
pointers were added (§7).

Voice note: every number below is copied from a run whose command is printed next to
it, on **this** host. §5 lists what is NOT proven and why. §6 reports one product gap
with a minimal diff that is **proposed, not committed**.

---

## 1. What layer B is, and why these arms are not layer A

The phase plan (`current-implementation-plan.md` §7.5) splits acceptance into three
layers. For the FS face they stand as:

| layer | question it answers | already owns (do not restate) |
| --- | --- | --- |
| **A** — capability face × permission axis | is the LANE around a call correct: ceiling ∩ restriction, read/write axes, ask/deny, member isolation, facts attribution | `a5sf-member-policy.test.ts` (allow/deny/ceiling/restriction/ask), `a5sf-product-assembly.test.mjs` PA5/PA8, `a5sf-tool-axis.test.mjs` TA2/TA3/TA4 (binding realm, dual-Member), `a5sf-service-install.test.ts` (provider composition) |
| **B** — per-native-tool contract | does the REAL tool behave as the tool's own contract says **inside** an admitted call: version guard, streaming/window boundary, attachment materialisation, abort atomicity, error shape/order | **this document** |
| **C** — frozen-candidate live | does the assembled Host + preset + provider actually do it | previous boot rounds; not re-run here |

The discipline applied: an arm was written only where the assertion is about the
**tool's** semantics or the **order/identity** of side effects. No arm here concludes
"the lane refused"; that conclusion is layer A's and is already proven. Where the
lane's refusal appears at all (FSB-IMG-3) it is only the **ordering witness** that
the attachment/provider side effects did not happen first.

---

## 2. Upstream behaviour FOUND (pinned baseline `0.2.0-rc.2 @ 639ed01539`)

All paths below are inside the pristine pinned tree `tests/deepseek-harness-test-use/`
(read-only; resolved through `tests/paths.mjs`, never hardcoded in the arms).

### 2.1 `edit` — the version/staleness conflict is POLICY-supplied, then PROVIDER-enforced

- `packages/fs/tool-fs/src/edit.ts:127` — the tool asks
  `ctx.waterfall('fs/edit-intent', target, exec, () => undefined)`. With **no**
  listener the intent is `undefined` and the provider performs an **unconditional**
  edit (`fs-local/src/index.ts:270-275`). So the guard is not the tool's own.
- `packages/fs/fs-observation-policy/src/index.ts:78-83` + `:122` — the policy
  listener answers `{ version }` for a file this member has observed, throws
  `FS_NOT_OBSERVED` when it has not, `FS_NOT_FOUND` when the target is absent.
- `packages/fs/fs-local/src/index.ts:273-275` — `editText` compares
  `existing.version !== expected.version` **before literal matching** and throws
  `FS_STALE_VERSION` (so a stale edit can never be misreported as
  `FS_EDIT_NOT_FOUND`/`FS_AMBIGUOUS_EDIT`); `:268` uses the same code when the file
  vanished.
- `packages/fs/tool-fs/src/error.ts:30-32` — the model-facing message keeps the
  provider's reason and appends ` — re-read the file, then retry`.

Measured destination: the stale call fails, the file is untouched, exactly one
`FS_STALE_VERSION` reaches the caller, and the admission was consulted **once**.

### 2.2 `read` — the 10 MiB boundary is a ROUTING decision, and truncation is a WINDOW

- `packages/fs/tool-fs/src/read.ts:21` `STREAM_MIN_SIZE = 10 * 1024 * 1024`;
  `:145-147` — `size === undefined || size >= streamMinSize ? ctx.fs.streamText(...)
  : [await ctx.fs.readText(...)]`.
- `packages/fs/tool-fs/src/read-render.ts:83-84` — the window stops at
  `maxBytes` and sets `truncatedByBytes`; `:155-156` — the footer is
  `(Output capped. Showing lines a-b. Use offset=b+1 to continue.)`.

Measured destination: a file that **really crosses** the threshold is streamed
(`streamText` once, `readText` zero), the model sees a byte-capped window with the
exact continuation footer, and the bytes past the window never reach it. The tool
does **not** refuse and does **not** spill to a temp file.

### 2.3 `read_image` — gates before I/O; one attachment after one read

- `packages/fs/tool-fs/src/index.ts:70` — `read_image` is registered from
  `ctx.inject(['attachments'], …)`, i.e. a **deferred** child.
- `packages/fs/tool-fs/src/read-image.ts:247-256` — extension/media-type/route gates
  (the route gate asks `ctx.llm.resolveModelInfo` for image modality) run **before**
  any filesystem work; `:258` resolves+stats (one `stat`); `:263` reads bytes with
  `exec.signal` and a byte cap; `:273` calls `saveImage` once.

Measured destination (with the composition gap of §6 bridged): allowed ⇒ exactly one
attachment, metadata read from the real PNG (70 B, 1×1), and the tool value names the
**same** attachment; refused by the lane ⇒ one `stat` deny fact, zero `readBytes`,
zero attachment bytes.

### 2.4 cancellation — the provider refuses publication, and it is a typed abort

- `packages/fs/fs-local/src/fsio.ts:596,600` — abort checked before staging;
  `:627` — `internals.inspectTemp` runs **after** the staged file is written and
  synced; `:632` — a second `throwIfAborted(signal, 'write')` guards publication;
  `:658` — the abort is mapped to `FsError('write aborted', 'FS_ABORTED')` and the
  staging directory is removed, so the target is never renamed.

Measured destination: mid-write abort ⇒ target byte-identical, no leftover staging
directory, one `FS_ABORTED`, and no success sentence.

---

## 3. The arms

File: `tests/world-factory/a5sf-fs-contract.test.mjs` (+ world builder
`tests/world-factory/lib/a5sf-fs-contract-world.mjs`). Nine node:test cases, no Host,
no port, no `DSH_HOME`, no `tests/homes/**`.

Every arm runs over the **PRODUCT** seam (`mountMemberA5sfRealm` +
`attachA5sfNativeToolModules`, route C), the **REAL** pinned
`@deepseek-ai/dsh-tool-fs` module, the **REAL** pinned `LocalFileSystem`, and the
REAL `fs-observation-policy` (without it §2.1's guard does not exist). The provider is
wrapped once by an `InstrumentedFs` that only counts calls and records the typed error
the real provider threw — every call is still `super.<method>`.

| arm | property | assertion (order / identity, not presence) |
| --- | --- | --- |
| `FSB-EDIT-1` | version conflict | read → external change → edit ⇒ **one** `editText` provider call, **one** typed `FS_STALE_VERSION`, **zero** bytes changed, message names staleness + remedy, **exactly one** new guard fact (`editText/allow`, contiguous sequence) — i.e. it was ADMITTED and then refused by the version guard |
| `FSB-EDIT-2` | control | fresh read → edit succeeds, file really changed, facts order `stat → readText → editText`, no version error |
| `FSB-READ-1` | >10 MiB boundary | file of 10,500,033 B ⇒ `streamText` = 1, `readText` = 0, `stat` = 1; window = 256 lines / 52,501 total; footer `(Output capped. Showing lines 1-256. Use offset=257 to continue.)`; tail token absent; the continuation is a **second stream** |
| `FSB-READ-2` | control | below-threshold file ⇒ `readText` = 1, `streamText` = 0, `(End of file - total 1 lines)` |
| `FSB-IMG-1` | routed `read_image` (GAP-1) | the routed definition **is not** the preset object (the shadow really took) and the call fails closed with `cannot get property "fs" without inject`, **zero** provider reads, **zero** attachment bytes, **zero** guard facts |
| `FSB-IMG-2` | attachments, allowed | post-fix composition: exactly one `stat` + one `readBytes`, **exactly one** attachment with `{image/png, 70 B, 1×1, pixel.png}`, one image block naming that same attachment, facts `stat → readBytes` |
| `FSB-IMG-3` | attachments, refused | one `stat` deny fact on the requested locator, **zero** `readBytes`, zero attachment bytes |
| `FSB-ABORT-1` | cancellation | read → write with an abort fired from `internals.inspectTemp` (after staging, before publication) ⇒ error, `FS_ABORTED` once, target byte-identical, **no** `.tmpdir` residue, **no** success text, one `writeText/allow` fact |
| `FSB-ABORT-2` | control | the same write without an abort publishes |

`FSB-IMG-1` is the one arm that pins **today's broken** behaviour. It is named after
the gap and must be **replaced** (not deleted silently) by the route-C variant of
`FSB-IMG-2/3` when §6 lands: change that case's `composition` to `'route-c'`.

---

## 4. RED → GREEN, and the mutation controls

### 4.1 Green baseline (measured)

```
$ node --test tests/world-factory/a5sf-fs-contract.test.mjs
✔ FSB-EDIT-1 … ✔ FSB-ABORT-2
ℹ tests 9   ℹ pass 9   ℹ fail 0   ℹ duration_ms 525.775
```
full log: `suite.log`; full-face baseline in the same run:
```
$ node --test tests/world-factory/a5sf-*.test.mjs
ℹ tests 349   ℹ pass 349   ℹ fail 0   ℹ duration_ms 1972.8
```
(`a5sf-suites.log`; 340 pre-existing + the 9 new.)

### 4.2 RED is proved by MUTATION, because the pinned behaviour already works

An arm that asserts nothing is green too. Each control mutates **only the forwarding
decision the lane owns**, on the mounted instance (no committed file, no upstream edit),
and must red **exactly** its own arm:

```
$ node dev/agent-workflow/evidence/a5sf-fs-face/mutations.mjs
PASS baseline: red=[] expected=[]
PASS M1-drop-version-guard: red=[edit-stale] expected=[edit-stale]
       red  edit-stale: the model-facing reason names the staleness
PASS M2-underreport-stat-size: red=[read-boundary] expected=[read-boundary]
       red  read-boundary: the tool STREAMED (streamText exactly once, readText zero) after one stat
PASS M3-drop-write-signal: red=[write-abort] expected=[write-abort]
       red  write-abort: the target is byte-identical (no partial write)
PASS M4-silent-attachment: red=[image-allowed] expected=[image-allowed]
       red  image-allowed: EXACTLY ONE attachment
PASS D-post-gap-1-composition: red=[image-route-c] expected=[image-route-c]
       red  image-route-c: the routed read_image fails closed today

MUTATION-CONTROLS-PASS (6 controls, 9 arms each)
```
full log: `mutations.log`.

- **M1** drops `expected` (the observed version) at the confined `editText` seam ⇒ only
  the stale-conflict arm reds; the fresh-edit control, read and abort arms stay green.
- **M2** makes the confined `stat` under-report the big file's size ⇒ the tool buffers
  instead of streaming; only the boundary arm reds (the small-file control is
  unaffected), which proves the arm measures the **routing**, not just "a big file".
- **M3** drops `signal` at the confined `writeText` seam ⇒ the abort never reaches the
  provider, the write publishes; only the abort arm reds.
- **M4** makes the attachment store answer without recording ⇒ only the allowed-image
  arm reds, which proves it asserts the **materialised record**, not the call.
- **D** re-runs the SAME `read_image` refusal arm over the post-GAP-1 composition,
  where the module can resolve `fs` ⇒ it reds, proving the arm measures **today's
  composition**, not "read_image fails somewhere".

---

## 5. What is NOT proven here (and the exact command a boot would run)

Nothing in this section is claimed. No Host was started (0 boots).

1. **The live half of all four properties** — layer C. A real Host's production
   preset, real attachment store, real model routing. This round proves the tool
   contract against the real module + real provider class, not against a booted Host.
   The repo's only live driver is
   `node dev/agent-workflow/evidence/a5sf-acceptance/run-boot.mjs` (add `--plan` for a
   zero-boot plan). It carries the P2-01 case set, **not** the FSB cases: a live run
   of these properties needs a new case set in that driver first. Command a boot
   would run, once that case set exists:
   ```
   node dev/agent-workflow/evidence/a5sf-acceptance/run-boot.mjs
   ```
2. **The live provider CLASS.** These arms pin `fs-local`'s `LocalFileSystem` — the
   class the pinned baseline ships as the default — while the sandboxed Host mounts
   `fs-sandbox`'s `SandboxedFileSystem extends LocalFileSystem`. Two of the four
   properties read through that subclass in a live run (`read` stream, `read_image`
   byte read). Their provider-side semantics were therefore **not** confirmed on the
   live class; the tool-side routing/ordering was.
3. **`read_image` through the PRODUCT route (positive case).** Today it fails closed
   (§6). The positive attachment contract is pinned under the post-fix composition
   only. A boot cannot show the positive case until §6 lands either.
4. **Atomic replacement as a positive claim.** The abort arm proves "no partial
   publication"; no arm proves the single-rename atomicity window (`fsio.ts:646-649`)
   under a reader racing the publish. Not claimed.
5. **Two-writer serialisation.** `editText`/`writeText` take a per-target lock
   (`fs-local` `withLock`); no arm races two admitted calls. Not claimed.

---

## 6. FINDING — `GAP-FS-CONTRACT-1`: routed `read_image` cannot resolve `fs`

`packages/runtime/team-services/src/mount.ts:428`

```ts
const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt'] as const
```

The router adds these names to a **deferred** child's inject so the child resolves the
services the mount serves. The pinned `tool-fs` registers `read_image` from
`ctx.inject(['attachments'], …)` (`tool-fs/src/index.ts:70`) — a deferred child whose
`apply` resolves **`ctx.fs`** for the actual read. Under route C that child therefore
throws `cannot get property "fs" without inject` **before** any provider call, and the
mount's own settle logic reports it. Measured: `FSB-IMG-1` — zero provider reads, zero
attachment bytes, zero guard facts, and the routed definition shadows a preset one that
would have worked.

Severity: **fail-closed but unusable**. No confinement hole (nothing is read, nothing
materialised), but on a route-C Member `read_image` is dead, and the shadowing hides
the working preset definition.

Minimal diff **proposed, not committed** (1 product line + 1 existing test expectation):

```diff
--- a/packages/runtime/team-services/src/mount.ts
+++ b/packages/runtime/team-services/src/mount.ts
@@ -428,7 +428,7 @@
-const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt'] as const
+const ROUTED_SERVICE_NAMES = ['tools', 'systemPrompt', 'fs'] as const
```
plus the doc comment above it ("the two services the router owns") must say that `fs`
is added so a deferred child reaches the realm's **confined** provider, not the
inherited host one; and `tests/world-factory/a5sf-tool-axis.test.mjs:984` (TA12)
enumerates the waiting-on inject names and must include `fs`.

Measured impact of the diff (`proposed-fix-validation.log`): 347/349 a5sf cases pass.
The two reds are **expected**: `FSB-IMG-1` (it pins the gap) and TA12's enumeration
(`[attachments,tools,systemPrompt]` → `[attachments,tools,systemPrompt,fs]`). With the
diff applied, the real routed `read_image` serves in-lane images through the confined
provider and refuses out-of-lane ones with `IO_READ_DENIED`, zero reads, zero
attachments (measured during this round, before reverting the file).

No product file is changed on this branch: `mount.ts` was modified only for that
measurement and restored with `git checkout --`.

---

## 7. Matrix pointers updated (no grade, no `V@B` change)

`docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md`:

- `M-01 read` ⑥ gains the layer-B pointer (`FSB-READ-1/2`).
- `M-03 edit` ⑥ gains the layer-B pointer (`FSB-EDIT-1/2`) — the version-conflict
  cell that was previously "untested" now has a host-free arm.
- `M-04 read_image` ⑥ gains the layer-B pointer (`FSB-IMG-2/3`), plus the
  `GAP-FS-CONTRACT-1` pointer (`FSB-IMG-1`, §6 here). The row's grade stays
  `BOUNDED-DEFER` / `V@B = no`.
- §1.1's honesty sentence about what is still unaccepted was narrowed to say which of
  those items now have host-free arms and which remain live-only. No grade moved.

---

## 8. What neither layer proves — the answer to the round's question

**No tool semantic proven by shared face-level arms was re-proved here.** Layer A's
existing arms prove: lane allow/deny on the `read`/`write` axes, ceiling ∩ restriction,
tool-binding routing, dual-Member isolation, ask handling, fact attribution. None of
them touches the version guard, the streaming decision, attachment materialisation or
abort atomicity. Conversely, none of the arms here asserts an admission decision as its
conclusion.

**Semantics neither layer proves (silently assumed today):**

1. **`write` of a brand-new file without a read.** `fs-observation-policy` returns
   `createIfAbsent` for an unobserved path, so the create path needs no read
   (`BL-38` tracks the deferred half). No arm covers "create a file in-lane with the
   policy mounted"; it is assumed from the policy source, not measured.
2. **`edit`/`write` under a BINDING realm (tool-binding restriction), not just the
   ceiling realm.** TA2/TA3 exercise `read` through the binding realm; no arm runs
   `edit`/`write`/`read_image` with a restriction that differs from the ceiling. The
   intersection is proven for `read` only.
3. **`edit` with multiple matches / `replace_all`.** `FS_AMBIGUOUS_EDIT` and the
   `replace_all` flag have no arm; only the single-match path is exercised.
4. **`read` cancellation mid-stream.** The abort arm covers `write`; `streamText`'s
   between-chunk abort (`fsio.ts:489-515`) is untested, so "abort leaves no partial
   output" is proven for the write path only.
5. **The `read_image` route gate.** `assertImageCapableRoute` (text-only model ⇒
   refusal) has no arm; both image arms use an image-capable route double.
6. **Live provider class.** See §5.2 — `fs-sandbox` is a subclass, and the properties
   that read through it were measured on `fs-local`.

Items 1–5 are cheap host-free arms and are the natural next layer-B increment; item 6
is live-only.

---

## 9. Reproduction

```sh
# the new arms (host-free, ~0.5 s)
node --test tests/world-factory/a5sf-fs-contract.test.mjs

# the mutation controls (~2 s; prints MUTATION-CONTROLS-PASS)
node dev/agent-workflow/evidence/a5sf-fs-face/mutations.mjs

# the whole face's node:test surface (349 cases, ~2 s)
node --test tests/world-factory/a5sf-*.test.mjs

# the product seam's vitest face
cd packages/runtime && pnpm exec vitest run \
  test/a5sf-service-install.test.ts test/a5sf-member-policy.test.ts \
  test/a5sf-provider-composition.test.ts test/a5sf-invocation.test.ts
```

Environment: WSL2 kernel 6.18.33.2-microsoft-standard-WSL2, Node 24.21.0, Landlock
ABI v7, `pnpm` workspace; pristine host tree resolved via `tests/paths.mjs`
(`0.2.0-rc.2 @ 639ed01539…`). `DSH_HOME` unused. No port bound.
