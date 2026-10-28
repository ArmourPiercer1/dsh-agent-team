# G4-R phase 1 binding evidence

Offline-only implementation; no Host boot and no writes to `:3080`/`~/.dsh`.

## Cells

* `composedProfileDigest` is recorded per World and per boot by `TestWorldFactory.startHost`. The exact bytes are the materialized `cordis.patch.yml` copied to the run evidence directory before the Host spawn, including comments and the final newline. The digest is SHA-256 of those bytes. This is the same profile patch the World launches, not an invented normalized object.
* `worldOracleDigest` and `worldOracle: {suite, digest, sources}` bind the PER-SUITE executable oracle sources. Starting with the selected suite module (or core/Jobs runner), follow literal relative `.mjs` imports inside `tests/world-factory`, excluding launcher/registry/binding helper modules. Sort relative paths lexically, then SHA-256 the concatenated RAW source bytes in that order, without separators or text normalization. This includes imported assembly expected constants and judges; no generic oracle is substituted for ARC-A. A JSON artifact stores base64 byte copies plus entry/path inventory and is capped at 1 MiB. External dependencies remain Team/Host SHA-bound. These are runner filesystem reads, not model returns; this is reproducible provenance, not cryptographic protection against an operator rewriting both source and record.
* `trustedSourcesDigest` remains `null`. The public runner seam exposes no plane TrustedSources/admission-source document or digest. `authoritative-tool-sources.v1.json` is a census/inventory input, not the plane's recorded admission source document, so hashing it would fabricate the requested fact. The record carries `trustedSourcesUnavailableReason` naming this public limitation.
* `hostTreeSha` is an explicit clarity alias for the pristine Host checkout SHA; existing `hostSha` is retained unchanged. No misleading new product/Team SHA is introduced.

## C1

`tests/world-factory/binding-digests.test.mjs` independently recomputes both digests from their copied on-disk artifacts. It mutates the profile artifact by one byte and asserts the recomputed digest differs (RED mutation control), then creates a fixture `u5-run-record/1` carrying all new cells and validates it through `scripts/eb3-run-manifest.mjs`'s exported validator (GREEN schema check).

Observed: C1 GREEN; 44 world-factory tests GREEN (including C1 run-record tests). One-byte mutations to profile and oracle source both yield digest mismatch (RED controls inside the GREEN test). No pre-implementation failing run was recorded, so this is mutation RED/GREEN rather than a claim of captured TDD RED. The C1 also invokes the actual manifest CLI with its fixture.

Collected suites and standalone Jobs bypass `bootWorld`; the factory-level pre-spawn callback captures their REAL patch bytes too, so none needs a guessed/stale profile digest. A runner that creates no World has an empty digest map, not a launched-profile claim. Restarts retain per-boot entries and content-addressed evidence copies.

Measured p4t6: `pnpm exec vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` exits 0 with the new files on disk and no booking; scannable delta is 0 (`tests/world-factory` is outside the packages scanner). No packages path or booking was changed.
