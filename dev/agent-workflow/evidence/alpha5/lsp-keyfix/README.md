# lsp-keyfix — canonicalizer camel-drift alias (#350: HOLD; premise retracted)

## RETRACTION (root independently verified @639ed01539; reviewer fe2d6cf7 measured — governs this file)

The FIRST commit of this round (2cb7169e) claimed the shipped upstream `tool-lsp` schema spells the
path **`filePath`** at `tool-lsp/src/index.ts:131`, that our canonicalizer's snake-only read made
every schema-shaped lsp call die at canonicalization, and that this PR fixed the installed lsp
channel. **All three claims are false and are retracted here:**

- the shipped **input** schema spells `file_path` — `index.ts:120` (`required: true`); `:131` is the
  OUTPUT schema; the body reads `args.file_path` (`render.ts:46-58`) into the host's INTERNAL
  camelCase seam vocabulary (`index.ts:183-191` parser call, `types.ts:42`); the schema compiler
  keeps keys verbatim (`core/tools/src/schema.ts:295-301`); full-history pickaxe for a `filePath`
  input key: empty; old baselines identical (`46a7f68b09` / `fb2c4b9e69` / `a66e470204`);
- the pre-PR canonicalizer accepts the shipped `file_path` form (measured 3/3 on cad5cf03 dist);
  "the lsp governance lane is de facto unusable for schema-shaped calls" was FALSE;
- the pushed commit message cannot be rewritten (no-force-push rule) — this README, the follow-up
  commit message, and the corrected PR body are the retraction carriers.

## True root cause of the F-leg observation (re-diagnosed from run receipts — no new requirement invented)

F-leg probe (`a5-legs-runner` worktree, `.../gap-legs-f/runs/a5legs-leg1-2026-10-19T09-10-55Z/run-receipt.md`,
L1-FAILCLOSED verbatim): the probe itself sent the path under **`filePath`** — its own assumption of
the "shipped spelling" — and received `permission denied: canonicalization failed for tool "lsp":
file-path-missing`. The refusal at the canonicalizer layer was CORRECT under the then-law (only
`file_path` is a known key). Deeper read of the SAME run's wire transcript (F-LEG-DIAGNOSIS.md): F
ALSO probed the true `file_path` spelling — the allow-lane probe passed canonicalization AND the lane
layer and landed at `Error: no LSP provider handles …` (that world mounts no LSP provider; REWORK:82
`preset 不挂 lsp；profile 缺项`). So a real installed end-to-end lsp failure DOES exist in evidence,
but its layer is **provider-mount (world configuration), not canonicalization / lanes / guards** —
the original F report mis-layered it onto the canonicalizer because probe 1 answered first. No product
defect is established; #350 fixes, and needs to fix, nothing here. Disclosed/not claimed: the
installed `schema → authorization → host parser → real LSP body` positive form with a mounted
provider — five-leg diagnostic plan (P-pos/P-camel/P-strict/P-deny/P-symlink; clangd-18 pre-checked
present) booked in F-LEG-DIAGNOSIS.md, deferred to after the G4 space audit.

## What this branch mechanically contains (kept on the branch, value/cost booked for a SEPARATE product decision — see ALIAS-DECISION.md)

The extractor reads both `file_path` and `filePath` for the file-path class, one deterministic law:
one key → its value; both keys byte-identical → ACCEPT (root 11:0xZ ruling; fingerprint/key equal to
the single-key form); both keys differing → typed refusal `file-path-key-conflict` (closed union);
malformed under either spelling fails closed before the conflict question; neither → unchanged
`file-path-missing`.

**Scope honesty (root 终态令 incremental fact): the alias does NOT rewrite or forward the args.** A
camel-only call that governance now accepts at the canonicalizer layer **still fails at the host's
own parser** (`parseLspArgs` reads `args.file_path`) — execution stays zero either way; the alias
changes only WHICH layer answers (canonicalizer refusal → host body failure) and makes the drifted
path visible/fingerprintable to governance. It is a canonicalizer-layer tolerance, not an
end-to-end fix, and it is not required by any demonstrated defect.

## Mechanism tests (unit level only, disclosed)

`a5lsp-keyshape.test.ts` 8/8 — ALL fake-resolver/direct-canonicalizer unit level; they pin the
closed-world law only and do NOT constitute installed-chain verification (installed
schema→authorization→LSP-body chain leg = not scheduled yet, no claim). Regression
`a2-canonical-operation` + `a5a-pre-execute` 81/81. p4t6 10/10, measured pin 1206 → 1207 (ONE new
spec; production edits ride already-counted files; constant `SCANNED_PATHS_A5LSPKEY` is distinct
from the pre-existing different-round `SCANNED_PATHS_A5LSP`). Forward note: this branch and the MCP
branch each book 1206→1207 independently; on a MERGED tree carrying both new specs the scanner is
re-anchored MEASURED (expected 1208 — never copy the chain value).

RED (append-only): `RED-unbooked.log` (the law's RED-first reading pre-implementation; its test
NAMES carry the retracted attribution wording — names kept for evidence integrity, the retraction
lives here), `p4t6-RED-unbooked.log` (`expected 1207 to be 1206`).
