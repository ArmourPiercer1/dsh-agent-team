# ALIAS-DECISION — keep the canonicalizer camel alias? (product decision, root 候裁; #350 HOLD 不依赖此件)

**根终口径 @2026-10-20：alias 产品裁="此时不索取"——本件转为可选/延期项留档，不催；PR #350 HOLD 继续、不关、分支不删。**

Framing per root 终态令: the alias is NOT required by any demonstrated defect (the shipped `file_path`
form always canonicalized; the real installed lsp end-to-end failure is at the provider-mount layer —
world configuration, see F-LEG-DIAGNOSIS.md — not canonicalization). Its retention is a STANDALONE
product choice.

## Value (measured/bounded)
- Governance VISIBILITY on drifted calls: today a camel-drifted file-path call is a key-less
  `file-path-missing` at the canonicalizer — the intended target path is invisible in the
  canonicalization failure, fingerprint, and lane machinery (nothing to match against). With the
  alias the path is extracted: the lane can decide (allow/ask/deny by real target) and the attempt
  is attributable (resource key + fingerprint recorded).
- Dual-key ambiguity becomes a TYPED decision (`file-path-key-conflict`) instead of one spelling
  silently winning/losing — the never-guess posture is only expressible once both keys are seen.
- Cost of the refusal path today is asymmetric for ASK lanes: a drifted call that a human would
  approve cannot even be shown its own target; it dies pre-policy.

## Cost / risk (bounded, measured)
- Does NOT make camel-only calls executable (host parser still reads `args.file_path` — execution
  zero either way); so the visibility gain changes only the ANSWERING LAYER and the audit record,
  never the effect set. No effect is widened: everything governance can now decide on, the old law
  simply refused — a strict relaxation of DENIALS toward typed decisions, never a new permission.
- Attack surface: a caller could add a byte-identical `filePath` twin — fingerprint/key are equal
  to the single-key form (spec-tested), so no lane is spelled around.
- 8 unit tests + closed reason code + 1 p4t6 scan path = the whole carrying cost on this branch.

## Options for root
- A. KEEP on #350 (alias + conflict law), PR body stating retracted premise + scope honesty; merge
  decision still per #350's own corrected claims.
- B. SPLIT: conflict-law + fail-closed precedence is law-shaped and worth keeping; the camel
  ACCEPT leg could be dropped or gated per-tool class later (the law degenerates safely: with only
  `file_path` read, everything behaves as today).
- C. DROP the whole branch (nothing demonstrated broken); the RED/GREEN evidence remains valid for
  the law's determinism if re-litigated later.
No action is taken on this file's account before a ruling; #350 stays HOLD.
