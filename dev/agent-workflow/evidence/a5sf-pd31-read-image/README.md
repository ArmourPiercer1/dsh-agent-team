# PD31-READ-IMAGE — `read_image` on a real Host: measured, and under what condition it cannot read

> **One sentence.** On the pinned Host (`0.2.0-rc.2 @ 639ed01539`), a governed Member **does read
> images today** — a real in-lane PNG returns `image/png 3x2 px, 68 bytes` as an actual image block
> (`attachmentId sha256:0bf7e492…`, 68 B, 3×2) and **the same 68 bytes ride the model request as an
> `image` content part** (base64, 92 chars, decoded sha256 `0bf7e492…`) — **but only when its model
> route declares `image`**: the shipped `deepseek-v4-flash` is not in the pinned catalog, resolves
> `['text']`, and the native tool refuses **before any provider I/O** with
> `model "deepseek-v4-flash" does not declare image input; switch to an image-capable model to read
> images`, **zero guard facts, zero attachment bytes**. This is **real live evidence** (DEV-LIVE, two
> agreeing boots per arm plus two mutation controls), **not** a host-free fallback.
>
> **Product statement (for the Preview roster).** A governed Member can read images **only when its
> model route declares `image`**. A default install whose route declares `['text']` — which is what
> the shipped `deepseek-v4-flash` resolves to — **cannot use `read_image` at all**: the refusal
> arrives before any provider I/O, with 0 guard facts and 0 bytes. Any roster that lists
> `read_image` as available without that clause is wrong.

- **Lane**: `PD31-READ-IMAGE` · branch `task/pd31-read-image-20261114` · worktree
  `.worktrees/pd31-read-image`. **Re-measured on merged master `0c2a8f422`** (PD-27 web egress, PD-28 web preview, PD-29 service
  seam, PD-30 goal/stop). A first measurement on base `24d2cf760` reported 31 names and a merged-tree
  reading on `da6cc7ba2` reported 33; both are **superseded** — PD-30 restored the goal tools, so the
  shipped surface is now **36 names**, and every number below comes from the six boots recorded here.
- **Register numbering.** The goal/stop lane holds **PD-30** on the same base and the register's
  contiguity law (`PD-1…PD-n`, gate-enforced) fixes this lane's row at **PD-31**, while the lane,
  branch, PR and evidence directory keep the `PD31` name — the fifth dated renumber in this phase
  (PD-27 naming → PD-28 merge, PD-30 naming → PD-28, …). This lane does **not** take a published id;
  it waits for the contiguous slot and states why.
- **Instrument commit**: both pairs and both mutation records ran the driver at `055fa822b` (driver
  sha256 `dd433e7c…`), which adds the World install-graph provision and the `never started`
  precondition (§2.2) to the same judging logic. The per-run `driverSha256` in
  `driver-digest-*.json` is the authority and is checkable with
  `git show 055fa822b:tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs`.
- **Evidence class**: `DEV-LIVE` (`candidateClaimEligibility` false on every record). Ports in the
  3180 family, `DSH_HOME` under `tests/homes/`, dev-live slot leases, pinned host tree pristine
  before and after every boot. **Not a candidate claim, not a matrix grade, not `V@B`.**

## 1. The question

`TOOL-ACCEPTANCE-MATRIX.md` row `read_image (M-04)` and `a5sf-pd24-surface-ledger` left `read_image`
as the one governed row whose **live branch was `UNMEASURED`**: the surface was pinned host-free, but
every live call was rejected first by **model routing** — `PD-24`'s ledger filed it as
`model "deepseek-v4-flash" does not declare image input`.

That state cannot distinguish three very different products:

1. a **real capability gate** that the deployment simply had not satisfied,
2. a **broken tool** that would fail even on a vision route, or
3. a **silent empty shell** that returns an envelope without the bytes.

This lane measures the live Host and separates all three.

## 2. The seam (public config, zero upstream patch)

The pinned host's DeepSeek catalog declares:

```
H:packages/llm/llm-deepseek/src/models.ts:8-14 @639ed01539
{ id: 'deepseek-flash', name: 'DeepSeek-V41-Flash', contextWindow: …,
  inputModalities: ['text', 'image'], systemPromptUpdate: 'in-history', toolUpdate: 'addition-only' }
```

and `modelInfo()` treats an **uncatalogued** id as text-only by design
(`H:packages/llm/llm-deepseek/src/model-info.ts`, the `configured === undefined` branch).

A World may point its Team row at **any** catalog id through the **public** `staticModel` config key
(documented in `docs/INSTALL.md`; the shipped row uses `deepseek-v4-flash`). The driver changes that
**one** value:

```js
staticModel: { provider: 'deepseek-official', model: MODEL_ID }   // 'deepseek-flash' | 'deepseek-v4-flash'
```

The wire still goes to the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`); **no
vision model is needed**, only the *declared* modality — which is exactly what the native gate reads
(`exec.agent.session.requestHeader()?.config`, else `exec.agent.options`, then
`llm.resolveModelInfo`).

**No upstream source was modified.** No `packages/**` file changed either (p4t6 census unaffected).

### 2.1 The first mutation attempt edited the wrong copy (disclosed)

`--mutation route-gate-off` first edited the **pinned source checkout's** built artifact
(`tests/deepseek-harness-test-use/packages/fs/tool-fs/lib/index.js`). The boot was still refused with
the identical sentence: the Host resolves the bare specifier `@deepseek-ai/dsh-tool-fs` from the
**repo's installed tree** — `node_modules/.pnpm/@deepseek-ai+dsh-tool-fs@0.2.0-rc.2_…/lib/index.js` —
not from that checkout. The driver now resolves the module with
`createRequire(join(REPO_ROOT,'package.json')).resolve('@deepseek-ai/dsh-tool-fs')`, records **both**
digests, and the host-free suite asserts the needle in both copies. The failed attempt is recorded in
`driver.log` (and summarised here); it changed nothing, and the restore sha is in the log.

### 2.2 The merged tree needed its install graph (and the pair initially measured an empty team)

The first merged-tree attempt produced two "agreeing" boots that both measured **surface 0**: the
shipped preset's `tool-web (dsh-agent-team/web-tool)` row resolved to no module in the pinned test
layout, so child-session creation failed (`TEAM_RUNTIME_DURABLE_WRITE_FAILED … never started`) and all
twelve probes ran against a Leader-only team. Two boots agreeing on nothing is still nothing; the
pair was discarded.

The fix is a **deployment property**, not a composition edit: a real install has `dsh-agent-team` in
the profile's `node_modules`, so the driver links `profiles/web/node_modules/dsh-agent-team` to the
repo root (its `package.json#exports` then resolve `dsh-agent-team/web-tool`,
`dsh-agent-team/host`, …) and rewrites no row. It also refuses to measure when the host log says any
preset row `never started`, so an empty team can never be reported as a PASS. Both are a **local
copy** of the provisioning PD-29/PD-30 drivers carry by hand; when the shared world-factory library
owns it, delete the helper and re-run — the numbers must not move.

## 3. What ran (six boots, all `DEV-LIVE`)

| run | command (from the repo root) | model declared | boots | result |
| --- | --- | --- | --- | --- |
| **postfix pair** | `node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs` | `deepseek-flash` (`text,image`) | 2 | **PASS, agreeing** (7/7 cases both boots) |
| **prefix pair** | `A5SF_PD31_PIN=1 node …/run-boot.mjs` | `deepseek-v4-flash` (uncatalogued ⇒ `text`) | 2 | **PASS, agreeing** (7/7 both) |
| mutation **model-text** | `node …/run-boot.mjs --mutation model-text --boots 1` | `deepseek-v4-flash` | 1 | **control OK** — served arm goes RED → gate refusal |
| mutation **route-gate-off** | `node …/run-boot.mjs --mutation route-gate-off --boots 1` | `deepseek-v4-flash` | 1 | **control OK** — gate removed ⇒ read SERVED, wire gets the text placeholder |

Each boot is one delegated governed Member turn that runs the probes **once each, one tool call at a
time**, under the shipped opt-in preset `a5sf-governed-member` (`cordis.patch.yml`), a real
`team.create` → `team_delegate` → Member turn over `/team-remote`, and the Member's own durable
session log as the primary witness (the mock's received request bodies are the wire witness).

The **surface is 36 names** in every arm (`read_image` present, native description
`Read a PNG/JPEG/WebP/GIF file and return the image itself…`), measured on merged master
`0c2a8f422` — the model declaration changes no tool declaration, and the count is the only surface
number this evidence claims (the 31-name and 33-name readings are superseded, §13).

## 4. The allow arm (postfix, both boots identical)

Probe `read_image {file_path: <workspace>/probe.png}` — a real 3×2 RGB PNG the driver builds with
signature + IHDR + zlib IDAT + IEND (68 bytes, sha256
`0bf7e49230407e1a478f021e556e8094f209ef01fe8f95fb94d3152374dddd95`).

**Tool result (durable `tool/result`, Member session):**

```
<path>…/workspace/probe.png</path>
<type>image</type>
<content>
image/png image, 3x2 px, 68 bytes
</content>
```

plus exactly **one** image block:

```json
{"type":"image","attachment":{
  "attachmentId":"sha256:0bf7e49230407e1a478f021e556e8094f209ef01fe8f95fb94d3152374dddd95",
  "mediaType":"image/png","bytes":68,"width":3,"height":2,"name":"probe.png"}}
```

**Guard facts (JSONL sink `a5sf-consult.jsonl`, `a5sf-guard-consult/1`): exactly 2 allow facts for
this call, in this order, both attributed to the tool and the call:**

| method | decision | decidedBy | tool | callId |
| --- | --- | --- | --- | --- |
| `stat` | `allow` | `ALLOW` | `read_image` | `call-a5sfpd31-image-in` |
| `readBytes` | `allow` | `ALLOW` | `read_image` | `call-a5sfpd31-image-in` |

> **Measured vs the brief.** The task brief said "exactly 1 allow fact". The Host yields **2**: the
> native body consults the guard once per provider method (`resolve` is not guarded; `stat` and
> `readBytes` are). The driver asserts **2**, and the register/matrix text says 2. Calling it 1 would
> be a fabricated number.

**Wire (what the leased mock actually received).** Six consecutive Member requests carry one image
part each (the read happens once; the image stays in history and is re-sent on every following
request):

```json
{"type":"image","source":{"type":"base64","media_type":"image/png","data":"iVBORw0KGgo…"}}
```

- `base64Chars`: **92** (= `ceil(68/3)*4`), `bytes`: **68**, decoded sha256: **`0bf7e492…`**.
- The part sits inside the `tool_result.content` array (next to the text envelope and the
  `Image "probe.png" (sha256:…)` handle text) — `model-request-image-parts.json` records all six,
  and `model-requests.json` keeps the block verbatim.
- **Zero** text blocks embed the base64 or a PNG signature
  (`requestsCarryingImageBinaryInText = 0`): the binary is an image part, not prompt text.
- Out-of-lane bytes in any request: **0** (`requestsCarryingSecretImage = 0`).

The `/v1/files` attempts in `model-requests.json` are the adapter's Files-API path; the mock answers
them, and the request falls back to inline base64 — visible, and irrelevant to the modality gate.

## 5. The refusal arm (prefix / `A5SF_PD31_PIN=1`, both boots identical)

Same Member, same surface, same probes; the row declares `deepseek-v4-flash`. Every image call is the
gate's refusal, **before** `resolve`/`stat`/`readBytes`:

```
Error: cannot read "…/workspace/probe.png" as an image: model "deepseek-v4-flash" does not declare
image input; switch to an image-capable model to read images
```

- `read_image` guard facts: **0** (the only facts in the boot are the plain `read` control's 2).
- Attachment bytes: **0**; model-request image parts: **0**.
- The same refusal, with the path substituted, is returned for the out-of-lane **existing** and
  **missing** targets and for both over-limit fixtures — the gate precedes path resolution and the
  limits, so those arms cannot be mistaken for a capability answer.
- The `.txt` probe still gets the **extension law** first (it is a tool-local check, not the route
  gate): `the .txt extension does not declare a supported image format; …`.

The prefix arm is the *shipped* composition, not a hand-edited one: `A5SF_PD31_PIN=1` selects
`deepseek-v4-flash` exactly as `cordis.patch.yml` ships it.

## 6. The lane arm (out-of-lane, allow arm)

`read_image {file_path: <home>/out-of-lane/secret-out-of-lane.png}` — a real 2×2 PNG placed **above**
the workspace lane, and `<home>/out-of-lane/does-not-exist-out-of-lane.png` — absent:

```
Error: authored locator '…/out-of-lane/secret-out-of-lane.png' is outside every allow subtree of the lane
Error: authored locator '…/out-of-lane/does-not-exist-out-of-lane.png' is outside every allow subtree of the lane
```

- **Exactly 1 deny fact** each (`stat`, `deny`, `decidedBy = IO_READ_DENIED`,
  `tool = read_image`, own `callId`).
- **0 bytes**, no image block, no image part.
- **No existence oracle**: after substituting each path, the two texts are **identical**, and neither
  says "not found"/"no such file". The typed code (`IO_READ_DENIED`) lives in the guard **fact**
  (`decidedBy`), not in the model-facing sentence — and that is the **right home**: a refusal whose
  text distinguished "denied" from "not found" would itself be an existence oracle. The sentence
  must stay generic; the machine-readable reason belongs in the fact, where an auditor reads it.

## 7. Non-image file (`.txt`)

`read_image {file_path: <workspace>/notes.txt}` (a real text file) is refused by the tool's own
extension law **before any fs I/O**: `the .txt extension does not declare a supported image format;
read_image accepts PNG/JPEG/WebP/GIF files, including extension-less files in those formats`. Zero
guard facts, zero image parts, no crash, in **both** arms (it does not depend on the model route).

## 8. Over-limit images (refused **whole**, never truncated)

The store's own pinned laws — read from
`H:packages/attachment/attachment-local/src/index.ts:34-42` and re-asserted by the driver at plan
time, so a baseline move reds instead of silently invalidating the fixtures — are **20 MiB bytes /
8192 px per side / 64 000 000 decoded pixels**.

| fixture | bytes | crossing | result |
| --- | --- | --- | --- |
| `over-dimension.png` (9000×1 RGB) | 106 | > 8192 px on one side, **inside** the pixel law | `Error: Image exceeds the configured per-side pixel limit.` — **2 allow facts** (`stat`, `readBytes`), **0** image parts |
| `over-byte-cap.png` (20 MiB + 1) | 20 971 521 | > 20 MiB | `Error: cannot read "…": 20971521 bytes exceeds the 20971520-byte limit` — **2 allow facts**, **0** image parts |

Neither stores an attachment nor sends bytes: the read is refused **as a whole**; nothing is
truncated, downscaled, or partially attached. (The dimension refusal comes from the store, not from
the tool's own "8192px limit" mapping — recorded verbatim rather than paraphrased.)

## 9. The mutation controls (≥2, both live)

### 9.1 `--mutation model-text` — the declaration is load-bearing

Post-fix composition with **the model declaration taken back to text** (`deepseek-v4-flash`):

- **`successArm` = RED** (the arm's success proposition is false) — the same gate refusal as the
  prefix arm; `propositionVerdict` = PROVEN for the *refusal* proposition, which is the opposite
  vocabulary and is recorded separately so the two cannot be confused;
- `read_image` facts **0**, image parts **0**, `overall` PASS *for the refusal proposition*;
- control verdict: **OK** (`mutation-control-postfix-model-text.json`), i.e. the allow arm's success
  is caused by the declared capability, not by the fixture or the lane.

### 9.2 `--mutation route-gate-off` — the gate itself is the refusing element

The capability check is **removed** from the `tool-fs` module the Host actually loads (resolved
installed copy; see §2.1), on a **text-only** route:

- the read is **served**: 2 allow facts (`stat`, `readBytes`), a real image block with the fixture's
  attachment metadata;
- the wire carries **0** image parts — the product projects the image to
  `[image omitted because this model accepts text only; attachment sha256:0bf7e492]`, which is the
  correct behaviour for a text-only route and is asserted;
- lane/over-limit/non-image arms still behave as measured above;
- **`successArm` = GREEN**, `propositionVerdict` = PROVEN for the *served* proposition;
- control verdict: **OK** (`mutation-control-postfix-route-gate-off.json`).

This is the proof that the refusing element in §5 is the **gate**, not the fixture, the lane, or a
broken tool: remove it and the same text-only route reads the file.

**Restore discipline.** The original bytes are backed up before the edit
(`.pd31-mutation-backup.bin`, removed after restore), restored in `finally`, and the restored sha256
must equal the pre-mutation sha256 (both recorded in `runs`/`mutation.json`: `66742231de99…` →
`12908be1896d…` → `66742231de99…`). The pinned **source** checkout's copy is *not* touched and its
digest is recorded unchanged. A crash-recovery path restores the backup first on the next run of any
arm (`recoverMutationBackup`), so a SIGKILL cannot leave later Worlds ungated.

> **Disclosure (shared tree).** The mutation target is the repo's installed `node_modules/.pnpm`
> copy, which is shared by every World on this checkout. The window is one boot (~75 s), the restore
> is sha-verified, the moving parts are recorded, and the hermetic alternative (a private host clone
> with its own `node_modules`) was rejected as a multi-GB install. No other boot ran in the window;
> no tracked file was modified (`host-tree-porcelain-*` empty).

## 10. What this evidence does **not** say

- **Not a candidate claim / grade.** `DEV-LIVE`; `candidateClaimEligibility` is false by
  construction. `read_image`'s matrix ⑧ stays `BOUNDED-DEFER`, ⑨ stays `no`: the row's `V@B` is
  untouched and this lane adds **no** `V@B`.
- **The live row is the native host tool, not the governed fs-family wrapper.** The shipped preset
  mounts `@deepseek-ai/dsh-tool-fs` (the `read_image` definition is native) and the shipped host row
  carries **no** `teamToolPlane`; `packages/tools/families/fs.mjs` (which maps a route refusal to the
  typed `IMAGE_MODEL_NOT_CAPABLE` code) is **not mounted** in this World. Consequences:
  - the live refusal is the native sentence, **without** an `IMAGE_MODEL_NOT_CAPABLE` token;
  - the typed `IMAGE_MODEL_NOT_CAPABLE` arm remains **host-free only** (the family wrapper's own
    evidence);
  - all facts in this run are the **confined fs guard's** (`stat`/`readBytes`), so the read really is
    governed even though the tool definition is the native one.
- **Not a claim about the governed family route.** This lane measures route-C native attach over the
  confined provider — the composition the product actually ships — not a `teamToolPlane` row.
- **The image is re-sent on every following request.** All six post-read requests carry the same
  68-byte part. That is adapter behaviour (history retention + Files-API fallback), not a PD-31
  defect; for a 20 MiB image the byte budget/offload quanta apply upstream. Not measured further.
- **Not a vision-model test.** The mock answers text; what is proven is the *declared capability,
  the gate, the read, the attachment and the wire shape*, not image understanding.
- **Not a claim about JPEG/WebP/GIF.** Only PNG fixtures were exercised (the tool's own list is
  broader).
- **Not about downscaling.** No within-limit large image was probed for downscale behaviour; only the
  over-limit refusals.
- **One aborted dev boot left an orphan Host on port 3188** (a killed development iteration before
  the recorded runs; its dev-live lease and process were outside this shell's PID namespace and
  could not be reaped from here). It is **not** part of the evidence; no recorded boot used that
  port. Disclosed so a later reader does not count it.
- **The worktree's `tests/deepseek-harness-test-use`** is a fallback to the main checkout's pristine
  host tree (`A5SF_PD31_HOST_TREE` can override); the pin, HEAD and porcelain are asserted per boot.

## 11. Register / matrix consequences

- `PRODUCT-DEBT-REGISTER.md`: new row **PD-31 (READ-IMAGE)**, class `evidence-quality`, status
  **DRAFT — not merged**. **Numbering disclosure:** the register's host-free guard
  (`a5sf-debt-register.test.mjs`) asserts ids are **contiguous `PD-1…PD-n` in document order**. On
  `0c2a8f422` the rows end at **PD-30** (goal/stop), so the next free contiguous id is **PD-31**.
  This lane held the row unwritten until PD-30 landed rather than minting a second in-flight claim
  for a number another branch had assigned, and states the date and the reason here — the fifth
  dated renumber of this phase. The lane, branch, PR and evidence directory keep the `PD31` name.
  The row does **not** claim a new hole: it closes `read_image`'s `UNMEASURED` branch, records that
  the capability is **config-gated and satisfiable**, and states in product words that a default
  `['text']` route **cannot use `read_image` at all** (0 facts, 0 bytes, before any provider I/O).
- `TOOL-ACCEPTANCE-MATRIX.md`: **append-only** dated section **§1.8.13** (the matrix's live
  correction chain continues past §1.8.12; §2's appendix is not reordered) + a dated note appended to
  the `read_image (M-04)` row. **No ⑧/⑨/`V@B`/grade change**: `read_image` stays `BOUNDED-DEFER` /
  `no`, because a live measurement of a native row is not a candidate claim. The roster number quoted
  in `§1.8` prose was 31 as of PD-29; this lane's own reading on `0c2a8f422` is **36** and is stated
  as the lane's measurement, not as an edit to the §1.8 tables.
### 11.1 Gates at the evidence commit

Full transcript: [`gates.txt`](gates.txt). Green: the **PD31 host-free suite** (7/7, including the
install-graph ownership pin), the register guard (10/10, ids contiguous `PD-1…PD-31`),
`docs:probe`/`docs:sync --check` (0 blocking), `ci-pr-gate --only state-freshness`,
`eb3-evidence-guard`, `eb3-run-manifest`, p4t6 (20/20), `pnpm -r typecheck`, `check:artifacts` and
`check:artifacts:head` (drift 0). The whole **a5sf host-free family** is green in a fresh-install
worktree; in this worktree's long-lived shared install the four PD30 tests fail for one reason only —
that install predates master's new `@deepseek-ai/dsh-web-search-exa` root dependency — and the same
four fail identically at `origin/master` with that install.

One command is red **before this lane and identically in the untouched main checkout**, recorded
rather than hidden: `pnpm lint` **161 problems / 129 errors**, all under `packages/**`, none in a
changed file (`tests/world-factory` is eslint-ignored); the main checkout prints the same 161/129.
`node scripts/doc-consistency-controls.mjs` keeps its **8 pre-existing failures** (POS-1, POS-3,
POS-4, POS-6, NEG-21, POS-8, POS-10, POS-11) with identical counts in the main checkout.

`check:artifacts:head` needs `--store-dir <repo>/.pnpm-store` in this worktree: without it the script
correctly **refuses** because the shared `node_modules` records another worktree's non-writable pnpm
store, and a refusal is not a verdict of "fresh".

## 12. Reproduction

```bash
# host-free (no boot): 6 tests — model seam, gate needle in both copies, fixtures/limits,
# preset shape, arm matrix, DEV-LIVE binding
node --test tests/world-factory/a5sf-pd31-read-image.test.mjs

# live: the agreeing pair (2 boots, real Host + shipped preset + real Member turn)
node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs

# live: the shipped text-only arm (2 boots) — the same command, pinned
A5SF_PD31_PIN=1 node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs

# mutation controls (1 boot each; route-gate-off edits and restores the INSTALLED module)
node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs --mutation model-text --boots 1
node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs --mutation route-gate-off --boots 1

# host-free plan only (rows/blueprints/preset/limits, zero boots)
node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs --plan
```

Requires the pinned host tree `tests/deepseek-harness-test-use` (or `A5SF_PD31_HOST_TREE`) at
`639ed01539`, clean, and a free dev-live slot; ports are leased from the 3180 family automatically.

## 13. Files

```
runs/boot01|02/                  the agreeing pair (postfix: image-capable route)
  counters.json                  every measured counter, incl. per-call fact lists
  guard-facts.json               the raw a5sf-guard-consult/1 sink
  member-probes.json             one entry per probe + the model-facing blocks
  member-surface.json            the 36-name Member surface + the read_image definition
  member-transcript.{json,txt}   the Member's own durable session, rendered
  model-request-image-parts.json every image part with decoded bytes/sha256
  model-requests.json            the received request bodies (text truncated, image kept)
  run-record.json / summary.txt  PASS/FAIL per case + DEV-LIVE claim
  teardown.json                  ports/pids released, host-tree porcelain, mutation record
  member-session.v4.jsonl.zstd   the raw durable session log
archive/pair-prefix/boot01|02/   the shipped text-only arm, same instrument
archive/mutation-model-text/     mutation 1 (declaration back to text)   → successArm RED, control OK
archive/mutation-route-gate-off/ mutation 2 (gate removed)              → successArm GREEN, control OK
                                 (the four runs in §3 are the records. Earlier readings — 31 names on
                                 base 24d2cf760, 33 on da6cc7ba2 — were superseded by this re-measure.
                                 The 33-name pair is kept under archive/postfix-2026… as history; the
                                 31-name records are not kept, because the rebase retired the commits
                                 they were bound to and a record whose commit no longer exists cannot
                                 be re-derived.)
agreement-postfix.{json,txt}     two-boot agreement (postfix)
agreement-prefix.{json,txt}      two-boot agreement (prefix)
mutation-control-*.json          mutation expectation vs observed verdict
driver-digest-*.json             commit, host pin, composition sha256, driver sha256, arm
driver.log                       the full run log (all arms, all boots, mutation apply/restore)
run-ledger.jsonl                 host-start ledger (DEV-LIVE records, one line per boot)
host-tree-porcelain-*.txt        empty after every arm (the pinned tree stayed pristine)
```

## 14. One-sentence answers (register / PR)

1. **Can `read_image` read images on a real Host today?** **Yes** — on the pinned Host, a governed
   Member reads an in-lane PNG as a real image block (68 B, 3×2, `sha256:0bf7e492…`) with 2 allow
   facts and the same bytes as an `image` content part on the wire, **provided its model route
   declares `image`** (`deepseek-flash` in the pinned catalog, selected through the public
   `staticModel` key); on the **shipped** route (`deepseek-v4-flash`, uncatalogued ⇒ `['text']`) it
   **cannot**, and the refusal is the native capability sentence with **0 I/O, 0 facts, 0 bytes**.
2. **Which gate refuses, and is it real?** The native `assertImageCapableRoute` reads
   `llm.resolveModelInfo`; two mutation controls show it is load-bearing — text declaration ⇒ red,
   gate removed ⇒ the same text-only route reads the file (and the wire correctly gets a text
   placeholder, not binary).
3. **Is the lane still enforced?** Yes: out-of-lane existing **and** missing are the same lane
   refusal with **exactly 1** `IO_READ_DENIED` deny fact, **0 bytes**, no existence oracle.
4. **Real live or host-free fallback?** **Real live** (DEV-LIVE, two agreeing boots per arm, six
   boots total, real `team.create` + delegated Member turn + real guard sink + real attachment store
   + real host `read_image`). Typed `IMAGE_MODEL_NOT_CAPABLE` and the fs-family wrapper remain
   **host-free** — disclosed, not substituted.
