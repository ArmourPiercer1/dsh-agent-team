# ute-g1-fs-20261120 — UTE-3 PR B1 evidence (FS `read_image` baseline + per-member controls)

Task: close the OLD-PATH half of the FS retirement unit's fourth member
(`read_image`) and add one real negative control per member. No product code.
The NEW-path half (`NEW-PATH-VECTOR <FS-I*>` PASS) is PR B2.

## Files

| file | produced by | what it proves |
|---|---|---|
| `old-path-capture.txt` | `node tests/ute-g1-fs/capture-old-path.mjs` | the 17-vector golden fixture re-derives from the legacy path with no drift (exit 0), including the 7 `read_image` vectors and their per-vector composition |
| `negative-controls.txt` | `node tests/ute-g1-fs/negative-controls.mjs` | family-level NC-1..NC-4 plus `NC-MEMBER read/write/edit/read_image` and their `NC-MEMBER-POSITIVE` pairs; `NC-VERDICT GREEN controls=12 failed=0` |
| `lane-suite.txt` | `node --test tests/ute-g1-fs/lane-suite.test.mjs` (now runs in the POST-build product lane in CI) | the prototype still reproduces the 10 non-pending golden rows; the 7 image rows are declared `newPathPending` (B2 scope, every pending id asserted `^FS-I`) and printed, not silently skipped; and no golden row rests in the `other` refusal bucket |
| `gate-refusal.txt` | `node scripts/ute-retirement-gate.mjs --all` | the FS row is still REFUSED (`exit=1`), now by `UTE_VECTOR_UNREPRODUCED` for the image vectors + the unresolved semantic differences; `oldBaseline` and `negativeControlsPass` no longer refuse `read_image` |
| `member-map.txt` | `node scripts/ute-retirement-gate.mjs --family fs --json` (derived) | the gate's own coverage sets: `oldBaseline 4/4`, `negativeControlsPass 4/4`, `newPathVerified 3/4` |
| `hosted-ci-failure.txt` | hosted run 44759369386, verbatim | the pre-build `ERR_MODULE_NOT_FOUND: @deepseek-ai/dsh-scope` red, its cause, the leg move, and the UTE-1 17-vs-10 parity defect found while validating the move |
| `postbuild-product-lane.txt` | `node --test --test-force-exit --test-timeout=480000 --test-reporter=spec tests/ute1-fs/native-fs-binding.test.mjs tests/ute-g1-fs/lane-suite.test.mjs` (the exact post-build CI argv) | 18/18 pass on the pinned rc.5 tree: the 10-vector product parity plus the lane suite's 4 tests (golden reproduction, semantic differences, no `other`, per-member controls). Run locally with an in-tree copy of the pinned host because the worktree provisioning symlink is refused by the UTE-1 containment guard; CI provisions a real tree. |
| `retirement-gate-suite.txt` | `node --test scripts/ute-retirement-gate.test.mjs` | the gate's own 31/31 suite, with its REAL arm updated to the post-B1 state (old-path axes covered, new-path reproduction still refused) |

## The one finding that changes the shape of this evidence

The product route-C composition cannot reach `read_image` at all:
`packages/runtime/team-services/src/mount.ts:445` keeps
`ROUTED_SERVICE_NAMES = ['tools','systemPrompt']` (no `fs`), so the tool's
deferred child throws `cannot get property "fs" without inject` before any
provider call — GAP-FS-CONTRACT-1 / PD-5 in the Alpha.5 product-debt register.
Measured here as `FS-I0-route-c-gap` (deny, zero provider calls, zero attachment
bytes).

Consequently the six allow/lane/route/cancel `read_image` vectors run under the
world factory's existing `post-gap-1` composition — the SAME legacy host, SAME
real `@deepseek-ai/dsh-tool-fs` module and SAME confined provider, with the
one-line deferred-inject merge the FS face already uses to pin the attachment
contract. The composition is declared per vector in `lib/corpus.mjs`, recorded in
`golden/old-path.meta.txt` and `golden/COVERAGE.md`, and repeated in the ledger
note. It is **not** a claim that the unpatched product route serves
`read_image`. Whether a retirement baseline may be taken under that proposed
composition before the product-route fix is an owner decision; B1 discloses the
fact and does not decide it.

## Observation method (why the image digest is not a self-report)

`lib/old-path.mjs` wraps the recording attachment store's `saveImage` and
digests the bytes the store receives; the tool's returned metadata is only
cross-checked against that digest (byte count) and against the model-facing
content blocks (one text block + one image block with the same attachment id).
A refused call that commits anything makes the capture throw instead of
recording a zero-effect refusal.

## Refusal classes

The four non-lane image denials are not prose-only: `FS-I0` is
`route-unresolved`, `FS-I4` `missing-path`, `FS-I5` `image-modality-denied`,
`FS-I6` `cancelled` (patterns named from the text the legacy run actually
emitted; see `golden/COVERAGE.md`). `FS-I2`/`FS-I3` remain `lane-deny`.
`other` stays in the vocabulary as the honest terminal bucket, but no corpus row
uses it: the capture command refuses to write `other` with an empty `codes` cell,
and the lane suite's fourth test fails if any golden row rests there.

## Still missing

* `NEW-PATH-VECTOR <id> PASS` for all seven `FS-I*` rows (PR B2).
* Any `read_image` allow on the product route-C composition (blocked on PD-5;
  a one-line product fix that B1 is not allowed to make).
* JPEG/WebP/GIF, downscale, byte-cap refusal, content sniffing, mid-read
  cancellation, attachment-store failure.
