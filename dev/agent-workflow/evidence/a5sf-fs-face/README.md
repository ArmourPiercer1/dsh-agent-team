# FS face — layer B (per-native-tool contract) acceptance, host-free

Task: **layer B acceptance of the FS capability face** (the per-native-tool contract
that layer A cannot cover), **increment 2**: the five properties §8 of the previous
increment named as "neither layer proves, silently assumed".
Branch: `task/a5sf-fs-contract2-20261107` (worktree `.worktrees/a5sf-fs-contract2`,
based on `origin/master` = `923b66ccb`). Increment 1 was
`task/a5sf-fs-contract-20261107` (`f02036ac9`, PR #612); its nine arms and the world
builder are EXTENDED here, never replaced — no second harness exists.
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

### 2.5 INCREMENT 2 — the semantics of the five previously assumed properties

**2.5.a `write`/create (BL-38 path).** `fs-observation-policy/src/index.ts:65-71` —
`writeIntent` answers `{kind:'createIfAbsent'}` for an unseen/confirmed-absent
target and `{kind:'replaceIfVersion', version}` only for a confirmed-present one; a
create therefore carries **no version**. `fs-local/src/index.ts:214-219` evaluates
the version guard ONLY for `replaceIfVersion`; `:220-223` turns
`createIfAbsent` onto an EXISTING file into `FS_NOT_OBSERVED` ("a blind overwrite —
require a read first"). So the guard on a create is a **presence** check, not a
version compare, and a non-existent file has nothing to compare.
The Team guard adds a second, product-shaped condition:
`team-services/src/fs.ts:124-153` runs the write⇒read check only when the target
EXISTS (it `lstat`s first and returns early on `ENOENT`). Hence a create in a WRITE
lane that the READ (observation) lane does not cover **succeeds**, while an
overwrite of an existing file in the same lane is refused with
`IO_WRITE_REQUIRES_READ` **before** the provider: "create" and "overwrite outside
the observation allowance" genuinely behave differently.

**2.5.b binding realms for `edit`/`write`/`read_image`.** The binding realm's guard
is the compiled `EffectiveIo = ceiling ∩ restriction`
(`member-io-policy/src/compile.ts:176-...`; installed per binding at
`install.ts:528-613`), and the tool body resolves the `fs` of the ctx it was
registered on (`tool-fs` registers once per fiber; the product attach partitions by
tool name — `a5sf-realm-row.mjs` `nativeToolMountsOf`). `fs.ts:226-239`
(`writeText`) and `:241-251` (`editText`) consult that guard, and
`tool-fs/src/read-image.ts:258-263` routes `stat` + `readBytes` through it.

**2.5.c multi-match `edit`.** `fs-local/src/fsio.ts:818-833` — `applyLiteralEdit`
counts occurrences; `!replaceAll && replacements > 1` throws `FS_AMBIGUOUS_EDIT`
**before** `index.ts:279-281` calls `writeFileAtomic`; with `replaceAll` the same
function does one `split/join` pass, so the whole multi-match replacement is ONE
atomic write.

**2.5.d `streamText` cancellation.** `fs-local/src/fsio.ts:489-515` — the real
`createReadStream` is constructed WITH the caller's signal; the iteration loop maps
a mid-stream `AbortError` to `FsError('read aborted', 'FS_ABORTED')`
(`:40-42`/`:508-511`). `tool-fs/src/read.ts:145-164` renders the window and only
THEN emits `fs/observed`, so an abort leaves no window and no observation.

**2.5.e `read_image`'s route gate.** `tool-fs/src/read-image.ts:119-130` resolves the
CALLING route (`exec.agent.session.requestHeader()?.config`, then agent options) and
throws unless the resolved model declares `image` input; `:256` calls it before
`:258` (resolve + `stat`) and `:263` (`readBytes`), so a text-only refusal precedes
every provider effect. MEASURED against the round's premise: the `fs` fault of
`GAP-FS-CONTRACT-1` is a LAZY property access, so under route C `execute` runs and
the route gate DOES refuse before the child touches `ctx.fs` — the gap blocks the
POSITIVE path only (FSB-IMG-1), not the text-only refusal (FSB-IMG-4b).

---

## 3. The arms

File: `tests/world-factory/a5sf-fs-contract.test.mjs` (+ world builder
`tests/world-factory/lib/a5sf-fs-contract-world.mjs`). **Twenty** node:test cases (the
nine of increment 1 + eleven from increment 2), no Host, no port, no `DSH_HOME`, no
`tests/homes/**`. The world builder gained four options — `bindings` (compiled by the
REAL `compileEffectiveIo`, never re-intersected here), `llmModalities` (what the route
double declares), `laneRoots` (allow subtrees, so a write lane can be wider than the
read lane) and one extra composition (`binding-post-gap-1`); it gained NO second
provider, module or harness.

**HOST-REQUIRED.** Every case loads the pinned baseline's built `lib/` entries
(`packages/fs/{tool-fs,fs-local,fs-observation-policy}/lib/index.js`); that checkout is
gitignored and `lib/` is not even committed in it. What a hosted runner does and does
not have, the declared refusal that replaces a hard failure there, and the two
provisioning options are §10.

### 3.1 Increment 1 arms

Every arm — increments 1 and 2 — runs over the **REAL** pinned
`@deepseek-ai/dsh-tool-fs` module, the **REAL** pinned `LocalFileSystem`, and the
REAL `fs-observation-policy` (without it §2.1's guard does not exist), registered
through the PRODUCT seam `mountMemberA5sfRealm` (+ `attachA5sfNativeToolModules`,
route C). Two increment-2 arms use the PROPOSED `binding-post-gap-1` composition
instead of the eager route-C attach, because `GAP-FS-CONTRACT-1` (§6) blocks their
positive path today: `FSB-BIND-IMAGE` and `FSB-IMG-4a`. `FSB-IMG-4b` runs the same
gate assertion on the real product route, which is what keeps the route-gate claim
product-anchored. The provider is wrapped once by an `InstrumentedFs` that only
counts calls and records the typed error the real provider threw — every call is
still `super.<method>`.

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

### 3.2 Increment 2 arms

Same harness, same provider/tool/composition discipline:

| arm | property / semantics (file:line) | assertion (order / identity, not presence) |
| --- | --- | --- |
| `FSB-CREATE-1` | create, `createIfAbsent` (`obs-policy:65-71`, `fs-local:214-223`) | write lane `inside`, read lane `observe` only ⇒ `Created file`, value `operation=create`, exactly **1** `writeText`, **0** `stat`, **0** `readText`, zero provider errors, exactly **one** `writeText/allow` fact — no version and no read are involved |
| `FSB-CREATE-2` | overwrite outside the read lane (`fs.ts:124-153`) | the same lane, an EXISTING target ⇒ `IO_WRITE_REQUIRES_READ` **before** the provider: **0** provider calls, **0** bytes changed, exactly **one** `writeText/deny` fact |
| `FSB-CREATE-3` | `createIfAbsent` onto an existing unobserved file (`fs-local:220-223`, `error.ts:23-29`) | exactly **1** `writeText` call, **one** typed provider `FS_NOT_OBSERVED` (not `FS_STALE_VERSION`), **0** bytes, one ALLOW fact; after a `read`, the SAME write succeeds (`Updated file`) with no provider error |
| `FSB-BIND-EDIT` | binding lane for `edit` (`install.ts:528-613`, `fs.ts:241-251`) | in-binding: `editText` delta **1 on the BINDING provider / 0 on the CEILING**, bytes written, exactly **one** fact `[editText, allow, ALLOW, realm=binding, identity]`; ceiling-only target: **0+0** calls, **0** bytes, exactly **one** `IO_WRITE_DENIED` binding fact |
| `FSB-BIND-WRITE` | binding lane for `write` (`fs.ts:226-239`) | same two-sided shape: binding `writeText` = 1 / ceiling = 0, one binding ALLOW fact; ceiling-only target ⇒ one `IO_WRITE_DENIED` binding fact, **0** calls, **0** bytes |
| `FSB-BIND-IMAGE` | binding lane for `read_image` (`read-image.ts:258-263`) — **proposed** `binding-post-gap-1` | in-binding: binding provider `stat=1, readBytes=1`, ceiling provider all **0**, exactly **one** attachment, facts `[stat allow, readBytes allow]` both `realm=binding`; ceiling-only target: **0+0** calls, **0** attachment bytes, exactly **one** `stat/deny IO_READ_DENIED` binding fact |
| `FSB-EDIT-MULTI-1` | multi-match without `replace_all` (`fsio.ts:818-833`) | exactly **1** `editText`, **one** typed `FS_AMBIGUOUS_EDIT` ("matched 3 times" + remedy), **0** bytes changed, one ALLOW fact; the SAME read then edits successfully with `replace_all` (2 `editText` in total) |
| `FSB-EDIT-MULTI-2` | multi-match WITH `replace_all` | exactly **1** `editText` (one atomic write), every match replaced (`tick tick tick` → `tock tock tock`), "All occurrences were successfully replaced", no provider error |
| `FSB-READ-ABORT` | `streamText` cancelled mid-stream (`fsio.ts:489-515`, `read.ts:145-164`) | abort after exactly **1** consumed chunk ⇒ error, **one** typed `FS_ABORTED` (`read aborted`), **no** value/window and **no** success or truncation envelope, provider calls `stat=1, streamText=1, readText=0`, facts `[stat allow, streamText allow]`, and **no open descriptor** on the fixture in `/proc/self/fd` |
| `FSB-IMG-4a` | text-only route gate (`read-image.ts:119-130`, `:256`) under `post-gap-1` | refusal names `model "mock-model" does not declare image input` + remedy; exactly **one** `resolveModelInfo(provider, model)` on the CALLING route; **0** provider calls, **0** attachment bytes, **0** facts |
| `FSB-IMG-4b` | the SAME gate on the **PRODUCT** route (`route-c`) | the text-only refusal also happens BEFORE any I/O; the GAP's `cannot get property "fs" without inject` MUST NOT appear (distinct codes), exactly **one** route resolution, **0** I/O/facts/attachments. This is why the arm is meaningful either way: the GAP blocks the positive image path (FSB-IMG-1), not this refusal |

`FSB-IMG-1` is the one arm that pins **today's broken** behaviour. It is named after
the gap and must be **replaced** (not deleted silently) by the route-C variant of
`FSB-IMG-2/3` when §6 lands: change that case's `composition` to `'route-c'`.

---

## 4. RED → GREEN, and the mutation controls

### 4.1 Green baseline (measured)

```
$ node --test tests/world-factory/a5sf-fs-contract.test.mjs
✔ FSB-EDIT-1 … ✔ FSB-IMG-4b
ℹ tests 20   ℹ pass 20   ℹ fail 0   ℹ duration_ms 794.755
```
full log: `suite.log`; full-face baseline in the same run:
```
$ node --test tests/world-factory/a5sf-*.test.mjs
ℹ tests 360   ℹ pass 360   ℹ fail 0   ℹ duration_ms 3725.478
```
(`a5sf-suites.log`; 340 pre-existing + the 9 + the 11 new.)

**RED-first receipt.** The first execution of the eleven new cases was `red-first-run.log`:
2 reds. Both were pins corrected by measurement, not vacuous assertions:
`FSB-CREATE-3` asserted "no provider error" after the control half without resetting
the recorder (the typed `FS_NOT_OBSERVED` from the refused first call was still
there), and `FSB-IMG-4b` was written on the round's premise that the GAP makes the
route gate unreachable — measurement showed the gate runs first (the `fs` access is
lazy), so the arm now pins that ordering with a distinct code. The other nine ran
green on their first tuned assertion pass; per-arm load-bearing proof is §4.2.

### 4.2 RED is proved by MUTATION, because the pinned behaviour already works

An arm that asserts nothing is green too. Each control mutates **only the decision the
lane owns** — a forwarding choice on the mounted instance, or (for M6/M8–M10) the
compiled lane itself, because a mounted realm is immutable by design — with no committed
file and no upstream edit, and must red **exactly** its named arm(s):

```
$ node dev/agent-workflow/evidence/a5sf-fs-face/mutations.mjs
PASS baseline: red=[] expected=[]
PASS M1-drop-version-guard: red=[edit-stale] expected=[edit-stale]
       red  edit-stale: the model-facing reason names the staleness
PASS M2-underreport-stat-size: red=[read-abort, read-boundary] expected=[read-abort, read-boundary]
       red  read-boundary: the tool STREAMED (streamText exactly once, readText zero) after one stat
       red  read-abort: the abort really fired while the stream was open
PASS M3-drop-write-signal: red=[write-abort] expected=[write-abort]
       red  write-abort: the target is byte-identical (no partial write)
PASS M4-silent-attachment: red=[image-allowed] expected=[image-allowed]
       red  image-allowed: EXACTLY ONE attachment
PASS M5-force-replace-if-version: red=[create-new] expected=[create-new]
PASS M6-widen-read-lane: red=[create-outside-read] expected=[create-outside-read]
PASS M7-drop-write-intent: red=[create-unobserved] expected=[create-unobserved]
PASS M8-widen-binding-edit: red=[bind-edit] expected=[bind-edit]
PASS M9-widen-binding-write: red=[bind-write] expected=[bind-write]
PASS M10-widen-binding-read-image: red=[bind-image] expected=[bind-image]
PASS M11-force-replace-all: red=[edit-ambiguous] expected=[edit-ambiguous]
PASS M12-drop-replace-all: red=[edit-ambiguous, edit-replace-all] expected=[edit-ambiguous, edit-replace-all]
PASS M13-silent-stream-abort: red=[read-abort] expected=[read-abort]
PASS M14-text-only-route-claims-image: red=[image-route-gate, image-route-gate-gap] expected=[…]
PASS D-post-gap-1-composition: red=[image-route-c] expected=[image-route-c]

MUTATION-CONTROLS-PASS (16 controls, 20 arms each)
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
- **M5** forces the create target through the REPLACE guard (the version guard the
  create path is claimed NOT to consult) ⇒ only `FSB-CREATE-1` reds with
  `FS_STALE_VERSION`; the existing-file arms stay green.
- **M6** recompiles the ceiling with the WRITE roots on the READ axis (the write⇒read
  gate's precondition) ⇒ only `FSB-CREATE-2` reds; the create arm on the same lane
  stays green, which is the create-versus-overwrite distinction itself.
- **M7** stops forwarding the observation intent for the unread target ⇒ only
  `FSB-CREATE-3` reds (the unobserved overwrite silently publishes).
- **M8/M9/M10** compile the named binding with `no-additional-narrowing` (the
  restriction stopped applying) ⇒ exactly the matching `FSB-BIND-*` arm reds; the
  in-binding half of that same arm stays green, so the red is the ceiling-only path.
- **M11/M12** force the multi-match `replace_all` flag ⇒ M11 reds only the ambiguity
  arm; M12 reds both multi-match arms because the flag is load-bearing in the
  ambiguity arm's positive control half as well.
- **M13** swallows the stream abort so the partial stream ends cleanly ⇒ only
  `FSB-READ-ABORT` reds (it would otherwise report a truncated read as success).
- **M14** makes a text-only route claim image input ⇒ both route-gate arms red; the
  image-capable arms are unaffected, so the red is the gate, not the fixture.

---

## 5. What is NOT proven here (and the exact command a boot would run)

Nothing in this section is claimed. No Host was started (0 boots).

1. **The live half of every property (layer C).** All twenty arms are an in-process
   Cordis root over `mkdtemp` fixtures: they prove the tool/provider/product-seam
   contract against the REAL pinned module and the REAL `LocalFileSystem`, not
   against a booted Host's preset, attachment store or model routing. Which layer
   owns each of the five increment-2 properties is stated in §8.
2. **The live provider CLASS.** These arms pin `fs-local`'s `LocalFileSystem`; a
   sandboxed Host mounts `fs-sandbox`'s `SandboxedFileSystem extends
   LocalFileSystem`. The `create`, `edit`-ambiguity and `streamText`-abort paths run
   through the subclass in a live run, so their provider-side semantics were not
   confirmed on the live class (the tool-side routing/ordering was).
3. **`read_image` through the PRODUCT route (positive path).** Still fails closed
   (§6). `FSB-BIND-IMAGE` therefore uses the PROPOSED `binding-post-gap-1`
   composition — same real module, same real binding provider, one-line inject
   merge — and is labelled as a proposal, not a product claim. `FSB-IMG-4a` uses the
   same proposed composition for the gate's positive-side neighbour; `FSB-IMG-4b`
   runs the gate on the real product route.
4. **Live route resolution for the text-only gate.** `FSB-IMG-4a/4b` drive a route
   double whose `resolveModelInfo` declares `['text']`. They prove the ORDER (gate
   before any provider effect) and the identity of the refusal, not a real
   provider/model catalog.
5. **Atomic replacement as a positive claim.** The abort arm proves "no partial
   publication"; no arm proves the single-rename atomicity window
   (`fsio.ts:646-649`) under a reader racing the publish. Not claimed.
6. **Two-writer serialisation.** `editText`/`writeText` take a per-target lock
   (`fs-local` `withLock`); no arm races two admitted calls. Not claimed.
7. **The descriptor-leak half of `FSB-READ-ABORT` is Linux-only.** It reads
   `/proc/self/fd`; the arm prints
   `A5SF-FS-CONTRACT-NOTE: /proc/self/fd unavailable; …` and skips only that
   sub-assertion on a platform without `/proc` (it never turns the arm green on
   absence). Everything else in the arm is platform-independent.
8. **BL-38's PRODUCT semantics.** `FSB-CREATE-1/2/3` measure what the composed
   tool+policy+guard DO; they do not decide whether a write-only Member SHOULD be
   admitted. BL-38 stays owner-owned / DEFERRED.

The one-shot boot command (unchanged from increment 1 — a boot would need the new
cases added to this driver first; none of them is a Host boot today):

```
node dev/agent-workflow/evidence/a5sf-acceptance/run-boot.mjs        # live run
node dev/agent-workflow/evidence/a5sf-acceptance/run-boot.mjs --plan # zero-boot plan
```

The host-free commands that DO run in this round are §9.

---

## 6. FINDING — `GAP-FS-CONTRACT-1`: routed `read_image` cannot resolve `fs`

`packages/runtime/team-services/src/mount.ts:430` (was `:428` on the increment-1
base; the `#606` refactor moved the declaration, the constant is unchanged)

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

Measured impact of the diff (`proposed-fix-validation.log`) in **increment 1**:
347/349 a5sf cases passed (that round's count). The two reds were **expected**:
`FSB-IMG-1` (it pins the gap) and TA12's enumeration
(`[attachments,tools,systemPrompt]` → `[attachments,tools,systemPrompt,fs]`). With the
diff applied, the real routed `read_image` serves in-lane images through the confined
provider and refuses out-of-lane ones with `IO_READ_DENIED`, zero reads, zero
attachments (measured during this round, before reverting the file).

No product file is changed on this branch: `mount.ts` was modified only for that
measurement and restored with `git checkout --`.

Increment 2 adds one measured fact about this gap: it does NOT hide the
`read_image` route gate. The undeclared `fs` is a LAZY property access, so under the
unpatched product route `execute` still runs and `assertImageCapableRoute`
(`read-image.ts:256`) refuses a text-only model BEFORE the first `ctx.fs` access
(`:258`). `FSB-IMG-4b` pins exactly that: the text-only refusal is observable on the
product route, and the inject fault must not appear. The gap therefore blocks only
the POSITIVE image path — which is why `FSB-BIND-IMAGE` still needs the proposed
composition.

---

## 7. Matrix pointers updated (no grade, no `V@B` change)

`docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md`:

- `M-01 read` ⑥ gains the layer-B pointer (`FSB-READ-1/2`, and increment 2's
  `FSB-READ-ABORT`).
- `M-02 write` ⑥ gains increment 2's create/`createIfAbsent` pointers
  (`FSB-CREATE-1/2/3`) and the binding `write` pointer (`FSB-BIND-WRITE`) — the
  deferred half of `BL-38` now has host-free arms (its product semantics stay
  DEFERRED).
- `M-03 edit` ⑥ gains the layer-B pointer (`FSB-EDIT-1/2`), increment 2's
  multi-match/`replace_all` pointers (`FSB-EDIT-MULTI-1/2`) and the binding `edit`
  pointer (`FSB-BIND-EDIT`) — the version-conflict and multi-match cells that were
  previously "untested" now have host-free arms; its residual cell no longer says
  "only the ceiling lane".
- `M-04 read_image` ⑥ gains the layer-B pointer (`FSB-IMG-2/3`), the
  `GAP-FS-CONTRACT-1` pointer (`FSB-IMG-1`, §6 here), increment 2's route-gate
  pointers (`FSB-IMG-4a/4b`) and the binding-image pointer (`FSB-BIND-IMAGE`). The
  row's grade stays `BOUNDED-DEFER` / `V@B = no`; its residual cell no longer says
  "read_image's own execution path has no guard-fact measurement" (true only under
  the proposed composition now, and stated that way).
- §1.1's honesty sentence about what is still unaccepted was narrowed to say which of
  those items now have host-free arms and which remain live-only, and a new
  increment-2 paragraph names the five properties, their arms and their owning layer.
  No grade moved.

---

## 8. The round's question, answered: what was neither layer's, and who owns it now

**No tool semantic proven by shared face-level arms was re-proved here.** Layer A's
existing arms prove: lane allow/deny on the `read`/`write` axes, ceiling ∩ restriction,
tool-binding routing, dual-Member isolation, ask handling, fact attribution. None of
them touches the version guard, the streaming decision, attachment materialisation or
abort atomicity. Conversely, none of the arms here asserts an admission decision as its
conclusion.

**The five items increment 1 named as "neither layer proves" are now proven
host-free, with the layer that owns each stated instead of implied:**

| # | property | layer that owns it | arm(s) | what is still NOT proven |
| --- | --- | --- | --- | --- |
| 1 | create of a NEW file with the policy mounted (`createIfAbsent`, BL-38) | **B** — tool+policy+provider contract; the write⇒read condition is the PRODUCT guard | `FSB-CREATE-1/2/3` | live half (layer C); BL-38 product policy itself is DEFERRED |
| 2 | `edit` / `write` / `read_image` under a BINDING realm | **B** (identity + ordering of the provider that serves the call); layer A already owned the intersection algebra | `FSB-BIND-EDIT/WRITE` (product route), `FSB-BIND-IMAGE` (proposed composition) | the positive `read_image` product path (GAP-1); live half |
| 3 | multi-match `edit` / `replace_all` | **B** | `FSB-EDIT-MULTI-1/2` | live half |
| 4 | streamed `read` cancellation mid-stream | **B** | `FSB-READ-ABORT` | live half; the fd witness is Linux-only (§5.7) |
| 5 | `read_image`'s route gate (text-only refusal before I/O) | **B** — the tool's own gate, not the lane | `FSB-IMG-4a` (gate semantics), `FSB-IMG-4b` (product-route ordering) | live route resolution (§5.4) |

**Item 6 from increment 1 — the live provider class (`fs-sandbox`) — remains
live-only and unproven.**

**The weakest remaining link for this face is now property 2's `read_image` half.**
It is the only one of the five whose POSITIVE case cannot run on the product route:
`FSB-BIND-IMAGE` needs the proposed `binding-post-gap-1` composition, because
`ROUTED_SERVICE_NAMES` omits `fs` (`GAP-FS-CONTRACT-1`, §6). Everything else about
the binding lane is proven on the real product seam. So of the five, the
`read_image`-under-binding positive path is the one that still rests on a
not-yet-committed one-line product change; the text-only REFUSAL half is proven on
the real route (`FSB-IMG-4b`), which is why the route-gate property itself is not
the weak link.

---

## 9. Reproduction

```sh
# the arms (host-free, 20 cases, ~0.8 s)
node --test tests/world-factory/a5sf-fs-contract.test.mjs

# the mutation controls (16 controls × 20 arms, ~7 s; prints MUTATION-CONTROLS-PASS)
node dev/agent-workflow/evidence/a5sf-fs-face/mutations.mjs

# the whole face's node:test surface (360 cases, ~4 s)
node --test tests/world-factory/a5sf-*.test.mjs

# the product seam's vitest face
cd packages/runtime && pnpm exec vitest run \
  test/a5sf-service-install.test.ts test/a5sf-member-policy.test.ts \
  test/a5sf-provider-composition.test.ts test/a5sf-invocation.test.ts
```

On a machine **without** the pinned host the same command prints
`A5SF-FS-CONTRACT-HOST-REFUSED … refused=1 skipped=20 cases=20 verdict=NOT_RUN` and
exits 0 with `pass 0`; a lane that is *supposed* to provide the host must run
`A5SF_REQUIRE_PINNED_HOST=1 node --test tests/world-factory/a5sf-fs-contract.test.mjs`
so absence becomes a failure (§10, `host-refusal-simulation.log`).

Environment: WSL2 kernel 6.18.33.2-microsoft-standard-WSL2, Node 24.21.0, Landlock
ABI v7, `pnpm` workspace; pristine host tree resolved via `tests/paths.mjs`
(`0.2.0-rc.2 @ 639ed01539…`). `DSH_HOME` unused. No port bound.

---

## 10. CI: what the hosted runner actually has, the declared refusal, and the provisioning proposal

### 10.1 Measured facts (PR #612, this round)

- `ci-integration` has **no host provisioning step**: its setup is Checkout → Node →
  merge-tree bind → pnpm → Install → … and no step clones or builds
  `tests/deepseek-harness-test-use` (`grep -n 'test-use|deepseek-harness' .github/workflows/ci-integration.yml`
  → no match). The tree is **gitignored**, so a runner checkout has none of it.
- The arms import **`lib/` build output**, and `lib/` is **not committed** in the pinned
  tree either: `git -C tests/deepseek-harness-test-use ls-tree -r --name-only 639ed01539 packages/fs/fs-local`
  lists only `src/`, `tests/`, `package.json`, READMEs (0 `lib/` paths). A plain checkout
  of the pinned SHA therefore still fails this precondition; a provisioning lane must
  also **build** the host.
- The first hosted run of this suite failed exactly there, before any arm ran:
  `Error: the pinned baseline's toolFs entry is missing (…/tests/deepseek-harness-test-use/packages/fs/tool-fs…)`
  at `makeFsContractWorld` → `EB3-LAYER layer=ci-integration verdict=FAIL`.
- Locally the tree exists **and is built**; `findTestRepoRoot` also walks up into the
  main worktree, which is why the local run never hit this.

So the answer to "absent or different": **absent on the runner** (no checkout at all),
and **different even if checked out** (no `lib/` build). The two shapes must not be
confused, which is why the gate distinguishes them.

### 10.2 The fix: a declared refusal, counted as not-run, never as pass

`tests/world-factory/a5sf-fs-contract.test.mjs` now has three states
(`host-refusal-simulation.log` is the receipt, produced in a temp tree with no
ancestor carrying the checkout):

| state | outcome | machine-readable evidence |
| --- | --- | --- |
| host absent | every case registered as **SKIPPED**; exit 0 | `A5SF-FS-CONTRACT-HOST-REFUSED schema=a5sf-host-refusal/1 refused=1 skipped=20 cases=20 verdict=NOT_RUN pinned=639ed01539… baseline=0.2.0-rc.2 path=… reason=pinned-host-not-provisioned`, and `ℹ pass 0 / ℹ skipped 20` |
| host absent + `A5SF_REQUIRE_PINNED_HOST=1` | **FAIL** (exit 1) | `A5SF-FS-CONTRACT-HOST-INCOMPLETE: … provision … and build it` |
| host present but a `lib/` entry missing | **FAIL** (exit 1) | `A5SF-FS-CONTRACT-HOST-INCOMPLETE: the pinned host tree exists at … but is missing toolFs=…, fsLocal=…, observationPolicy=… — a partial or older host is a pin violation` |
| host present and complete | all twenty arms RUN (assertions unchanged) | `ℹ pass 20 / ℹ skipped 0` |

Why this is not a fake green:

- the refusal is a **single greppable token** with the pin it required, the path it
  looked at, `refused=1`, `skipped=<all cases>` and `verdict=NOT_RUN`;
- the refusal registers **the same twenty cases** the real path would run, so a refusal
  cannot undercount what it refused (the case table is the single list for both);
- `pass 0` is what the runner's summary says; nothing in this README claims the arms
  passed on CI;
- the moment the host appears, the arms run — and if it appears *partially*, that is a
  red pin violation, not a silent skip;
- the mutation controls still run wherever the host exists (they are not weakened).

Known limit, disclosed rather than papered over: a skip is not a job failure, so the
`ci-integration` **layer job** is green on a hostless runner. The token is the only
thing that says "not run"; that is the same trade-off `census` makes on hosted PR runs
(`pr-gate.yml`: `refusedlegs=census`). The step comment in `ci-integration.yml` still
says "no pristine host tree at run time", which the refusal makes **inaccurate** — I was
asked not to edit `.github/workflows/**`, so this is flagged here for the owner.

### 10.3 Proposal A (preferred if CI must prove these arms): a provisioning lane

Mirror `characterization.yml` / `census-runtime.yml`:

1. read `TEST_USE_BASELINE_SHA` / `DSH_BASELINE_VERSION` from `tests/paths.mjs` (never
   copy them), `git fetch --depth 1` that exact SHA from
   `https://github.com/ArmourPiercer1/deepseek-harness.git`;
2. assert the checked-out SHA **equals** the pin (a moved branch tip is a failure);
3. `pnpm install` **and build** inside the checkout (the `lib/` requirement above —
   `characterization.yml` already does checkout + install + build);
4. run `A5SF_REQUIRE_PINNED_HOST=1 node --test tests/world-factory/a5sf-fs-contract.test.mjs`
   so the refusal cannot come back green;
5. decide whether this lives in `ci-integration` (then its step env sets the flag) or in
   a separate host lane whose green means "the arms ran".

Cost: one extra host install+build in that lane; no boot, no port.

### 10.4 Proposal B (cheaper, removes the checkout entirely): the pinned npm packages

All three entries are published at exactly the pinned version, with `lib/` in the
tarball (verified this round):

```
@deepseek-ai/dsh-tool-fs@0.2.0-rc.2             → package/lib/index.js, deps diff/schemastery/util-code-language
@deepseek-ai/dsh-fs-local@0.2.0-rc.2            → package/lib/index.js, deps chokidar/koffi/schemastery
@deepseek-ai/dsh-fs-observation-policy@0.2.0-rc.2 → package/lib/index.js, no deps
```

Adding them as root `devDependencies` (the repo already carries
`@deepseek-ai/dsh-tool-fs-search@0.2.0-rc.2` the same way) lets the ordinary
`pnpm install --frozen-lockfile` step provide them, and the suite imports the same
`lib/index.js` from `node_modules` instead of the gitignored checkout. The arms would
still exercise the real pinned implementation (the published artifact of the same
release), and the refusal would become dead code on CI.

**Not done in this round, and why:** regenerating `pnpm-lock.yaml` needs registry
resolution; in this sandbox `pnpm add` re-resolved the graph and aborted on
`ECONNRESET` / 87-second registry timeouts (`ERR_PNPM_META_FETCH_FAIL`) **before**
writing `package.json` or the lockfile, so nothing was left half-changed. This is a
dependency-topology decision (a third pin site next to `tests/paths.mjs`) for the owner,
not something to slip into a test-only PR. If approved: add the three deps, let the
suite keep the same entry paths via `import('@deepseek-ai/dsh-tool-fs')` (one helper
switch in `fsContractHostLayout`), regenerate the lockfile on a machine with a stable
registry, and the `ci-integration` step needs no other change.
