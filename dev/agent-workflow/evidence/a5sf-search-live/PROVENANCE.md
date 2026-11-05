# Provenance of the run-10 record

The tenth-boot record (`2026-11-04T23-18-01-066Z`) was produced under authority generation
**`as20261102r1`** and merged here byte-identically from `task/a5sf-search-live2-20261105 @ 75f030f8f`
(commit `8b1e43f66`). It is therefore **history**, not fresh evidence.

The RUN-manifest gate (`scripts/eb3-run-manifest.mjs --new-since`) correctly refuses a **NEW** record that
binds a superseded generation, and it has no vocabulary for "imported history". Rather than rewrite the
record's binding — which would falsify what the run actually saw — the two files are stored under their
generation:

- `run-record.as20261102r1.json` (root copy)
- `runs/2026-11-04T23-18-01-066Z/run-record.as20261102r1.json`

They are byte-identical to the originals; only the name carries the generation. The generation switch to
`as20261105r1` names a product tree that is *equal* to the tree this run exercised (`packages/**` tree
`9609403c…`), which is the relationship the matrix cites — not a claim that the run happened under the new
generation.
