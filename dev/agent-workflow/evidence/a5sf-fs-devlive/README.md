# FS/Search — DEV-LIVE pilot (14-row live result + the missing live read driver)

**Record class: DEV-LIVE. This is development evidence.** It is not a candidate claim, it does not
certify the tool-acceptance matrix, and it **cannot** move `V@B` — a DEV-LIVE record is structurally
incapable of producing `V@B=yes` (see `docs/DEV-LIVE-OPERATOR-GUIDE.md` §2 and the
`RECORD_CLASS_MISMATCH` guard on the grant path). What it *does* do is measure the FS/Search face on
the current alpha line with repeated, self-authorised, isolated starts, and say exactly what the
measurement can and cannot support.

- **Version measured:** `953b65a59cfdc4938c72e31f0db5f059dd3c0401` (origin/master when the lane's
  worktree was cut). Host pin: `639ed015397290b3745d163aafe02ffee4aa3f84`
  (`tests/deepseek-harness-test-use`, untouched).
- **Authorisation:** `dev-live-grant.json` — `grantId=devlive-fs-search-1`, `scope=DEV-LIVE`,
  `face="FS Provider"`, `world=u5a5sfdev1`, owner ruling 2026-11-09. No cumulative cap; 2-concurrent
  machine slot respected; one slot held at a time (the other lane held one).
- **Starts used:** **4**. Three produced complete case tables; one aborted after judging 11 rows
  (driver defect, not product). **Two consecutive starts (3 and 4) produced an identical 14-row
  table at reason granularity** — that pair is the DEV-LIVE result.
- **Driver version (hashes of the exact files that ran):**

  | file | sha256 |
  | --- | --- |
  | `driver/run-boot.mjs` | `ad1e4a4dfc82d6737e53c2f2d7aa04d6b7b2d45eaa12bb09ad71fb52dd766633` |
  | `driver/a5sf-fs-devlive-realm-row.mjs` | `6c9d61ba6beb2eea71a18c561287a722cd838d0cd837f80f03c8dd7c07e69b2c` |
  | `driver/preflight-bundle.mjs` | `80a0408c1fdcdfbb89de8639602ed5814836b24b6e8d077c18a1fdac32e1a235` |
  | `driver/live-read-driver.mjs` | `42e1147e727c20de44c99db861b7e8870b4733a3517ca69e723aa16b8a1271c0` |

  Run # · purpose · cause/fix · result: **`RUNS.md`**. Machine index: `driver/runs/INDEX.json`.
  Compiled ledger (all 4 starts, DEV-LIVE rows): **`ledger.json`**.

## 1. What was measured, and how

One Member on a real Host carries the accepted search ToolBinding *and* an `fs` ToolBinding, so a
single start measures both faces against the same compiled ceiling. The composition is the
already-accepted candidate-1 row (`driver/a5sf-fs-devlive-realm-row.mjs`, adapted from
`evidence/a5sf-candidate1/`), which mounts the shipped `installToolBindingRealm` with the product's
own lane algebra (`path-rules.ts#intersectPathRuleSets`). Fixtures: identical content in-lane and
out-of-lane so a leak is visible; a FIFO for the cancellation window; a 1×1 PNG for `read_image`.

Guards, gate order, ledger discipline, health polling (poll `/__p6t6/health`, never a single probe)
and teardown are the ones candidate-1 proved. Added by this lane:

- **A zero-boot preflight that actually runs** — `driver/preflight-bundle.mjs` builds the
  `a5sf-zero-boot-preflight/1` bundle at run time from the World that is about to boot (per-case
  locators, lanes, dispositions, member bindings, assembly, driver step order, collector shapes) and
  the driver refuses to spawn on anything but `PASS`. It reports **PASS 18/18** on every start; the
  artefact is `runs/run-N/preflight.log`. This closes the observed pattern where `--plan` printed
  `PLAN OK` while the old hand-written bundle failed on stale case ids.
- **The dev-live lease** (`preRegisterDevLiveBudget`): intent row, slot acquisition at the one spawn
  chokepoint, `dev-live-outcome` row with teardown receipt.

## 2. Per-case live result (runs 3 and 4 identical)

| case | verdict | live reason | weakest honest claim |
| --- | --- | --- | --- |
| `live:search-row1-grep-in-lane-allowed` | PASS | `IN_LANE_GREP_ALLOWED_AND_CONFINED` | the in-lane `grep` returned matches exclusively from the in-lane directory and the confined `subprocess` face served it; says nothing about patterns or roots not planted here |
| `live:search-row2-grep-outside-ceiling-refused` | PASS | `OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS` | the outside-ceiling `grep` was refused at admission with **zero** confined spawns; the anchor-leader negative control shows the same call succeeds unconfined, so the refusal is the realm's |
| `live:search-row3-grep-outside-restriction-refused` | PASS | `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION` | a locator the ceiling admits but the ToolBinding's read lane does not was refused with a binding-lane fact; the file was never read |
| `live:search-row4-cancelled-search-settles-cancelled` | PASS | `CANCELLED_SEARCH_ABORTED_WITH_KILLED_CHILD_NO_RESULT` | cancelling during a FIFO-blocked `grep` settled as cancelled, the child was killed, and no result was delivered; timing is one observed window, not a bound |
| `live:search-row5-invalid-pattern-is-error` | PASS | `INVALID_PATTERN_SURFACED_AS_TOOL_ERROR` | an invalid regex became a tool error, not a crash or a silent empty result |
| `live:search-row6-archive-boundary-no-callable-shadow` | PASS | `NO_USABLE_CALLABLE_SHADOW_AFTER_STOP` | after archive, post-stop `grep`/`glob` are refused (422), no fact is written after the stop instant, the Host is dead, the port released and the home deleted; one stop instant, not a race sweep |
| `live:row1-read-a-inside-both-allowed` | PASS | `READ_A_ALLOWED_AND_CONFINED` | the in-lane `read` returned exactly the planted bytes through the confined provider (1 `readText`), with a binding allow fact |
| `live:row2-read-b-binding-deny-on-read-path` | PASS | `BINDING_DENY_ON_READ_PATH` | the restriction-only file was refused on the **read** path (`stat` denied) with no provider read and no content leak; the write⇒read gate is not what refused |
| `live:row3-read-c-refused-no-widening` | PASS | `REFUSED_WITHOUT_WIDENING` | a locator inside the restriction but outside the ceiling was refused exactly once, at the binding lane, with the ceiling's deny and the restriction's allow both recorded — no widened allow fact exists |
| `live:row4a-write-in-lane-readable-allowed-ceiling-only` | PASS | `CEILING_WRITE_IN_LANE_READABLE` | an in-lane write landed on disk with the expected bytes and one confined write call; the read-before-write coupling was satisfied by a prior read on the same start |
| `live:row4b-write-b-ceiling-allowed-read-not-implied` | PASS | `CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED` | a write to an unread in-ceiling file was refused (read-before-write), the disk was unchanged, no planted bytes came back, and the refusal is not the guard's read-coupling refusal — the ceiling admits the write |
| `fs:edit-in-lane` | PASS | `CEILING_EDIT_ALLOWED_AND_CONFINED` | an in-lane `edit` (after reading the file) produced the new text on disk, removed the original, and made exactly one confined `write-call`; the stale-version guard was not exercised |
| `fs:edit-outside-ceiling` | PASS | `OUTSIDE_CEILING_EDIT_REFUSED_BEFORE_PROVIDER_LOCUS_host-read-before-write-observation-policy` | the edit had **no effect** (disk unchanged, zero provider writes) and was refused before the Provider; the refusal came from the **host observation policy**, not from the a5sf ceiling guard — see §3 |
| `fs:read-image-observation` | **NOT_REACHED** | `READ_IMAGE_ROUTE_REFUSED_MODEL_DECLARES_NO_IMAGE_INPUT` | `read_image` **is** on the Member's tool surface and executes, but the route refuses before any `fs` consult because the scripted model declares no image input. Nothing about the confined image read path was measured |

Run totals: **13 PASS / 0 FAIL / 1 NOT_REACHED** (overall NOT_REACHED, complete, not partial). The
NOT_REACHED is a measurement gap, not a pass and not a product failure.

`grep`/`glob`: `glob` was measured on the same start (in-lane PROVEN, outside-ceiling PROVEN); it is
reported inside row 1/row 2's conjunction rather than as separate case ids, exactly as the accepted
suite defines them.

## 3. Where live behaviour DIFFERED from the host-free arm's expectation

These are the valuable observations. Both are recorded as facts, not silently absorbed into a pass.

**(a) `edit` outside the ceiling is refused by the HOST before the a5sf guard is consulted.**

- Host-free expectation: a typed `a5sf` ceiling denial, with a guard fact at the locator and zero
  provider writes.
- Live: `Error: cannot modify ".../ceiling-outside-edit/secret.txt": file has not been read — read
  the file, then retry`. **0 guard facts, 0 provider writes, disk untouched.** The host's
  read-before-write observation policy refuses first, because the file was never read — and it
  cannot be read, since the read is itself outside the ceiling.
- Consequence for the matrix: an `edit`-only probe cannot witness the ceiling's edit guard for an
  unread out-of-lane file; the effect is still refused, so the *outcome* claim holds, but the
  *attribution* claim ("the a5sf ceiling refused it") would be false. The judge now records the
  locus (`LOCUS_host-read-before-write-observation-policy`) instead of pretending a guard fired.
  A future cycle that wants the guard's own refusal must pre-read the file through an allowed lane
  (i.e. choose a file inside the ceiling and outside the *binding* write lane), or instrument the
  guard on the write path.

**(b) `read_image` is reachable but unmeasurable with the scripted model.**

- Host-free arm: `read_image` was expected either to be a typed face refusal or to serve a confined
  read.
- Live: the tool exists on the Member surface and the call executes; the route gate answers
  `model "a5sf-search-model" does not declare image input; switch to an image-capable model`. No
  `fs` consult happened, so the confined image path was not exercised.
- Relation to **PD-5** (`fs` is not in `ROUTED_SERVICE_NAMES` in
  `packages/runtime/team-services/src/mount.ts`): the observation does not contradict PD-5 — the
  tool reaches the route gate, and the gate refuses before the missing route would matter. It does
  mean **PD-5 cannot be evidenced from this arm**: to measure it, the mock model must declare image
  input (the fs-contract world already has an `llmModalities: ['image']` seam), and the Member realm
  must be the one the route resolves.

## 4. The missing live read driver — built, and it measures

`tests/world-factory/suites/150-a5sf-read.mjs` could only ever answer `LIVE_SEAM_UNAVAILABLE`, because
nothing in the tree mounted the compiled ceiling's confined Provider outside a booted Host. This lane
adds:

- **`driver/live-read-driver.mjs`** — the driver the suite resolves via `A5SF_READ_DRIVER`. It mounts
  the **real** seam (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs#mountMemberA5sfRealm` over a
  real Cordis `Context`, the pinned `LocalFileSystem`, the pinned `fs-observation-policy`, the real
  `@deepseek-ai/dsh-tool-fs` module) and performs the read through the **confined Member provider**:
  `readText` for a whole file, `readByteRange(target, {offset, length})` for a byte window. It never
  re-intersects a lane — it maps the product compiler's `effective` onto the realm's inputs.
- **Two-line contract wiring in the suite**: `runScenario` now calls the documented
  `driver.install({identity, effective})` before the first allowed read and `await`s `driver.read`.
  The dry driver is untouched (no `install`, synchronous `read` still awaits to a value).
- **`runLiveSeamScenario`** exported (live-seam half of the same scene, no Host boot) and
  **`driver/suite-seam-probe.mjs`** to run it.

Result, zero Host starts: **assertions 14/14, cases 7/7 PASS** (allowed-in-ceiling exact bytes;
outside-ceiling typed refusal with zero provider read; no leak; two-member isolation; the >10 MiB
byte window **and** the file-edge window exact; chain diag clean; the synthetic bypass still caught;
leak-check clean). Artefact: `.artifacts/a5sf-fs-devlive/live-seam/live-seam-summary.json`.

What this driver does **not** prove: it mounts a Member realm in-process, so it says nothing about
hosted routes (cancel/archive/teardown) and nothing about a **binding** realm's `read_image`
composition (GAP-FS-CONTRACT-1: a binding realm's isolated ctx does not settle the native module's
deferred `fs` inject). It is a live-seam measurement, not a Host measurement, and it spends no start.

## 5. What remains unmeasured, and why

1. **The a5sf edit guard's own refusal for an out-of-lane edit** — pre-empted by the host
   read-before-write policy (§3a). Needs a different locator strategy or write-path instrumentation.
2. **`read_image` confinement / PD-5** — the scripted model declares no image input (§3b), and the
   suite's live driver mounts the Member (not binding) realm. Needs an image-capable mock route and
   the binding-realm composition seam.
3. **The suite's full Host path (`run()` through `u5-canary-runner --suite a5sf-read`)** — it boots a
   Host in addition to mounting the realm. The seam half is proven green here; the Host half was not
   re-run because it would spend a fifth start and its assertions about a hosted effect need the
   host-attributable oracle, which is exactly the candidate-grade machinery this pilot deliberately
   does not substitute for. Recorded as a next-cycle item, not claimed.
4. **Stability beyond two starts** — two consecutive identical tables is the task's bar; it is not a
   flake-rate estimate.
5. **Other tools on the same faces** (bash/pwsh, web, lsp) — out of scope for this pilot.

## 6. Did the dev-live loop work better than the old one-boot-then-escalate pattern?

Yes, materially, and in a way that is visible in `RUNS.md`:

- The old pattern spent one start, and if it failed the operator either escalated or re-entered a
  slow authorisation cycle. Here, **each of the 4 starts produced attributable evidence**, including
  the aborted one (11 judged rows survived because the abort path re-judges what was measured).
- Three defects were found and fixed **in the instrument**, not in the product: (1) an abort-path
  completeness rule that did not know the new case ids, (2) a stale fixture expectation in the
  edit-outside judge, (3) the edit-outside attribution (this one was a genuine discovery about where
  the refusal lives). Each fix was diagnosable from the artefacts of the failing start; no start was
  repeated "to see if it happens again" without a changed hypothesis.
- The preflight ran before every spawn and never blocked a start, and it was itself fixed once
  host-free (18/18). That is the part the old loop lacked: instrument defects that a zero-boot check
  can catch now cost zero starts.
- The 3-consecutive-same-cause escalation rule was never triggered: the four failures/reds had four
  distinct causes (abort rule, stale expectation, locus attribution, and the model-declaration
  NOT_REACHED), each with new diagnostic information. That is the rule working as intended.

## 7. What the next dev cycle needs

1. **Finish the suite's Host path** (`run()` with `--driver`), now that the seam half is green: it
   needs a grant-scoped boot and the host-attributable oracle, and it should assert that the driver's
   `install` was called with the *same* compiled effective policy the Host mounted (a cross-check
   that the seam measurement and the Host measurement speak about one policy).
2. **An image-capable scripted route** for the mock model, so `read_image` reaches the `fs`/route
   seam and PD-5 can be evidenced (or falsified) instead of classified as NOT_REACHED.
3. **A locator strategy for the edit guard**: a file inside the ceiling but outside the binding write
   lane that has been read through the allowed lane, so the guard (not the host observation policy)
   answers. Until then, keep the locus field and do not let any record claim "the ceiling refused the
   edit".
4. **Fold the zero-boot preflight** into the runner so every suite start is gated by a bundle built
   from its own World (this pilot's `preflight-bundle.mjs` is a template), and keep
   `scripts/a5sf-preflight.mjs` as the host-free CLI check.
5. **Carry the DEV-LIVE label into every derived view** — a DEV-LIVE row must never be aggregated
   into a matrix cell without a record-class column; the record class is the difference between
   "we measured this on the alpha line" and "this version is certified".

## 8. Reproduce

```bash
# 1. the zero-boot gate (host-free, no start)
node dev/agent-workflow/evidence/a5sf-fs-devlive/driver/run-boot.mjs --plan
# 2. one live start (DEV-LIVE; needs the grant file, writes one ledger row set)
node dev/agent-workflow/evidence/a5sf-fs-devlive/driver/run-boot.mjs
# 3. the suite's live seam, zero starts
A5SF_READ_DRIVER=$PWD/dev/agent-workflow/evidence/a5sf-fs-devlive/driver/live-read-driver.mjs \
  node dev/agent-workflow/evidence/a5sf-fs-devlive/driver/suite-seam-probe.mjs
```
