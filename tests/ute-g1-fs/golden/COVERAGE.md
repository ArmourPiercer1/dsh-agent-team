# FS retirement unit — member coverage (UTE-3 PR B1, old path)

The FS family is ONE retirement unit of four model-visible members
(`read`, `write`, `edit`, `read_image`), derived from
`dev/agent-workflow/ledgers/arc-a-family-census.json` (`dsh.fs-family`). This file
maps each member to the baseline vectors that exercise it and to its own
negative control, so the coverage claim can be checked without reading the
corpus source.

Machine gate: `node scripts/ute-retirement-gate.mjs --all` parses the `id` and
`entry` columns of [`old-path.tsv`](./old-path.tsv) and greps the committed
control transcript for `NC-MEMBER <member>`.

## Members

| member (`entry`) | baseline vectors (`old-path.tsv`) | negative control (committed transcript) |
|---|---|---|
| `read` | `FS-R1-outside-read-leak` | `NC-MEMBER read` — widen ONLY the read lane; the refusal becomes a result-text leak of the planted secret |
| `write` | `FS-W1-create`, `FS-W2-overwrite-read`, `FS-W3-unobserved-overwrite`, `FS-W4-outside-write`, `FS-W5-write-axis`, `FS-S1-symlink-escape`, `FS-M1-mode-preserved` | `NC-MEMBER write` — widen ONLY the write lane; the refused out-of-lane file appears (5 bytes) |
| `edit` | `FS-E1-edit-read`, `FS-E2-stale-edit` | `NC-MEMBER edit` — drop ONLY the edit version guard; a stale edit applies (the external bytes change) |
| `read_image` | `FS-I0-route-c-gap`, `FS-I1-inlane-image`, `FS-I2-outside-image-denied`, `FS-I3-lane-bound-image`, `FS-I4-missing-image`, `FS-I5-route-unresolved`, `FS-I6-cancel-before-dispatch` | `NC-MEMBER read_image` — widen ONLY the image read lane; the refused out-of-lane image materialises a 70-byte attachment |

Each `NC-MEMBER` is paired with `NC-MEMBER-POSITIVE <member>`, which re-runs the
UNMODIFIED vector and shows it still reproduces its golden row. A control whose
mutant looks like the baseline goes RED; that is what makes the positive line
load-bearing rather than decorative.

Transcript: `dev/agent-workflow/evidence/ute-g1-fs-20261120/negative-controls.txt`
(and the same lines are re-run by `lane-suite.test.mjs`).

## Refusal classes (machine-readable, not prose)

The four `read_image` denials that are not lane denials each get a distinct class
in the `refusal` column, named from the text the legacy path actually emitted:

| vector | `refusal` | observed signal |
|---|---|---|
| `FS-I0-route-c-gap` | `route-unresolved` | `cannot get property "fs" without inject` (route-C deferred child cannot resolve `fs`) |
| `FS-I4-missing-image` | `missing-path` | `read target '…' does not exist` |
| `FS-I5-route-unresolved` | `image-modality-denied` | `… does not declare image input; switch to an image-capable model …` |
| `FS-I6-cancel-before-dispatch` | `cancelled` | `tool call aborted before dispatch` |

`other` remains the honest terminal class for genuinely unclassifiable
refusals, but **no corpus row rests there**: `lane-suite.test.mjs` asserts it and
the capture command refuses to write a row whose `refusal=other` has an empty
`codes` cell. `FS-I2`/`FS-I3` stay `lane-deny` (their cause is the lane, and the
lane axis is deliberately collapsed across generations).

## What the `read_image` rows actually observed

`read_image` has no filesystem effect: it commits an ATTACHMENT and returns a
model-facing text+image result. Each image row therefore carries a synthetic
`@result:…` entry inside the normal `effects` cell:

```
@result:<mediaType>:<w>x<h>|present|<bytes>|<sha256>|blocks=<shape>
@result:none|absent|-|-|-          # refusal: no attachment materialised
```

* the digest is over the bytes the ATTACHMENT STORE received (captured at the
  store's `saveImage` seam by `lib/old-path.mjs`), not over the path string and
  not over the tool's self-reported metadata;
* `blocks=text+image` asserts the model-facing result was exactly one text block
  plus one image block whose attachment id is the same store ref;
* for denials the source file's own `path|present|…|sha256|mode` entry records
  that the out-of-lane file was left untouched (this is not a proof that no
  `open()` happened — see README §7).

## Composition disclosure (important)

The PRODUCT route-C composition cannot reach `read_image` at all:
`packages/runtime/team-services/src/mount.ts:445` omits `fs` from
`ROUTED_SERVICE_NAMES`, so the call throws `cannot get property "fs" without
inject` before any provider call (GAP-FS-CONTRACT-1 / PD-5).

| vector | composition | why |
|---|---|---|
| `FS-I0-route-c-gap` | `route-c` (product) | pins the product fact: `read_image` is dead on the unpatched product route; zero provider reads, zero attachments |
| `FS-I1` … `FS-I6` | `post-gap-1` (proposed composition) | the SAME legacy host, SAME real `dsh-tool-fs` module and SAME confined provider, with the FS face's existing one-line deferred-inject merge |

This is a disclosed composition, NOT a claim that the unpatched product route
serves `read_image`. Whether a retirement baseline may be captured under
`post-gap-1` before the product-route fix lands is an owner decision; B1 does not
decide it, and the ledger note says so.

## Still not exercised (mirrored in §7 of the README and the meta file)

* `read_image` on the product route-C composition in any ALLOW shape (PD-5).
* JPEG / WebP / GIF, downscale/`originalDimensions`, byte-cap refusal,
  extension-less content sniffing, mid-read cancellation, attachment-store
  failure. Only the arms listed above are claimed.
* Read confinement as a positive proof, delete/move, streaming/byte-range, and a
  live boot.
* The NEW path (`NEW-PATH-VECTOR <id> PASS`) for every `FS-I*` row: that is PR
  B2, which is why the retirement gate refuses `UTE_VECTOR_UNREPRODUCED` today.
