# lsp-keyfix — `filePath` vs `file_path` key-shape law (small PR, branch `a5-lsp-keyfix` @ cad5cf03)

Finding (F leg, real-install): the shipped upstream `tool-lsp` schema authoritatively spells the
path **`filePath`** (`tests/deepseek-harness-test-use/packages/lsp/tool-lsp/src/index.ts:131`,
JSON-schema `required: ['operation','filePath', ...]` (tool schema surface); read-only pinned in the main checkout; my extractor accepts BOTH spellings uniformly across the file-path class - see the law below), while our canonicalizer's
extractor (`packages/runtime/operation-permission/canonical-operation.ts` `extractFilePath`) read
ONLY `file_path` — so every schema-shaped lsp call died fail-closed at canonicalization
(`file-path-missing`) BEFORE any policy decision: safe direction, but the lsp governance lane was
de facto unusable.

Fix (canonicalizer side; the host schema is the authority and stays untouched — CORE budget 0):
one deterministic law over both spellings, all file-path-class tools:
- exactly one of `file_path` / `filePath` present → that value is THE path (`file_path`-only
  behaves EXACTLY as before — zero regression);
- both present, byte-identical → ONE object, decidable, proceed;
- both present, differing → **deterministic refusal with its OWN reason code
  `file-path-key-conflict`** (added to the closed `CanonicalizationFailureReason` union + array in
  `errors.ts`); the canonicalizer never picks a winner between two candidate targets (never-guess);
- a present-but-malformed value (non-string/blank) fails closed under EITHER spelling BEFORE the
  conflict question;
- neither → the unchanged `file-path-missing`.
Fingerprint corollary: the key SPELLING is not a security fact — same bytes under either spelling
project to one resource key and one fingerprint (spec-tested; a lane can never be spelled around).

Dist: `tsc -p tsconfig.build.json` rebuilt; emitted dist diff = exactly the semantic delta
(verified by `git diff` — union member + array entry + extractor body/doc).

RED (append-only): `RED-unbooked.log` (6 failed / 2 passed pre-fix on the new spec; the 2 passes =
the unchanged `file_path`-only and neither-key legs), `p4t6-RED-unbooked.log` (pre-booking
`expected 1207 to be 1206`).

GREEN: `a5lsp-keyshape.test.ts` 8/8; regression `a2-canonical-operation` + `a5a-pre-execute` 81/81;
p4t6 10/10 with the measured pin continuation **1206 → 1207** (ONE new spec; production edits ride
already-counted files; constant named `SCANNED_PATHS_A5LSPKEY` — the pre-existing `SCANNED_PATHS_A5LSP`
is a different round's booking, untouched).

p4t6 quote chain: master's g6b-step-b booking 1206 (`alpha5/g6b-flake/step-b/compat2-p4t6-red-measure.log`)
→ A5-LSP-KEYFIX 1207 (this round's `p4t6-RED-unbooked.log`; MEASURED, no chain value copied).
