# v0.1.6-rc.1 release-package evidence — candidate identity and C2 presence

**Lane:** `docs/v016-rc1-release-package` (worktree `.worktrees/v016-rc1-docs`), based on
`origin/master` @ `76a86d6e923efa291350a32d1c1eb70e3754a684` (#746).
**Date:** 2026-11-13 (workday clock; the UTC stamps in the two captures are the measured ones).
**Scope:** documentation only. No product code, no tag, no Release, no npm publish, no Authority
pointer move, `CORE PATCH BUDGET = 0`. `:3080` and upstream were never touched.

This directory exists so the release-package documents
([`RELEASE-NOTES-0.1.6.md`](../../../../docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md) §11 and
[`V016-RC1-GO-NO-GO.md`](../../../../docs/plans/active/alpha5-sandbox-first/V016-RC1-GO-NO-GO.md))
can cite an in-repo measurement for every identity statement they make. It is **not** a C2 record, not a
`V@B`, and not an acceptance grade.

## Files

| file | what it is |
| --- | --- |
| [`cand4-identity.txt`](./cand4-identity.txt) | candidate/manifest provenance, ref check, `verify-candidate.mjs` output (no `--record`) and its counts |
| [`c2-presence.txt`](./c2-presence.txt) | the two C2 records for `cand-v0.1.6-4` (path + sha256 + record fields + verdict/eligibility), and the verifier output with both records |

## What was measured

1. **Frozen identity** — `dev/engineering/candidates/cand-v0.1.6-4.json` is **tracked on `master` as of
   `76a86d6e9` (#746)**, byte-identical to the freeze-branch copy `5a5da26a7`; it is not in the
   candidate ref's tree. It was read from the tracked file, never edited.
   `sha256 c0962acc…`, `content_digest sha256:4d37bf39…`, candidate commit
   `0d31f9121…`. The verifier reports **`VERIFIED` with `PASS=147, MISMATCH=0, MISSING=0,
   REFUSED=0, UNVERIFIABLE=0`** (see `cand4-identity.txt`).
2. **Manifest documentation drift** — `evidence.record_root` still names
   `dev/agent-workflow/evidence/candidate-v0.1.6-1` (the freeze generator carries the field unchanged
   across cand-1/-2/-3/-4). C2-A records this as `FAIL`/drift that weakens no identity edge.
3. **C2 presence** — at capture time **both** C2 records for `cand-v0.1.6-4` existed in their
   adjudicators' worktrees and both verified against the manifest (`verify-candidate` with both
   `--record` files: `VERIFIED`, `PASS=148`). Both records nevertheless report
   `candidateClaimEligibility.eligible: false`: C2-A scopes its PASS to `C2-A only` and names unmet
   conditions; C2-B's overall verdict is `NOT PASS (candidate claim not eligible from this record)`.
   The C2 pair the notes cite for the Alpha.6 arms is a different pair, bound to `cand-v0.1.6-3` @
   `17a24e2c3…`.

## Reproduce

```bash
# manifest (the freeze commit is not an ancestor of the candidate)
node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-4.json

# C2 presence for this SHA
ls .worktrees/c2a-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-*.json 2>/dev/null
ls .worktrees/c2b-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-*.json 2>/dev/null

# both records must verify against the same manifest before either can carry anything
node scripts/verify-candidate.mjs --manifest dev/engineering/candidates/cand-v0.1.6-4.json \
  --record .worktrees/c2a-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-A.json \
  --record .worktrees/c2b-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-B.json
```

`verify-candidate.mjs` does not read `evidence.record_root`; the drift is a documentation defect, not
an identity mismatch. It still matters to eligibility because the C2-A adjudicator made its correction
a condition of candidate-level eligibility.

## What this directory does not claim

- It does not synthesize, copy or re-sign a C2 record. The two C2 captures are readings of files the
  adjudicators own; if those files change, this snapshot does not.
- It does not turn "both records verify" into "the candidate is eligible": both records explicitly
  withhold candidate-level eligibility, and the verifier's `PASS=148` is an identity/edge count, not
  an eligibility grant.
- It does not make a release decision. The recommendation is in `V016-RC1-GO-NO-GO.md` and is a
  recommendation to the owner.
- It does not move any acceptance row, create a `V@B`, or claim stability beyond the two agreeing runs
  the cited records measured.
