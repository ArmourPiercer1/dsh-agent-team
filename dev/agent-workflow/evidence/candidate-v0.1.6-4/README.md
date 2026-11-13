# `candidate-v0.1.6-4` — the two independent C2 records, archived on master

**Archived:** 2026-11-13 (workday clock), lane `task/v016-closing-20261113`, base `origin/master` @
`76a86d6e923efa291350a32d1c1eb70e3754a684` (#746).
**Candidate:** `cand-v0.1.6-4`, ref `candidate/v0.1.6-4` →
`0d31f9121308a43030701fe6d56c316100782419`, manifest
[`dev/engineering/candidates/cand-v0.1.6-4.json`](../../../engineering/candidates/cand-v0.1.6-4.json)
(`content_digest sha256:4d37bf396e26b375f02f496dc09bc065c6a93e4fd30a1bc8eae50281857a17c1`).
**Record class of both files:** `CANDIDATE-C2`. **Neither record is a candidate-level claim.**

This directory exists because the two records were produced inside two adjudicator worktrees and
were never tracked: a `CANDIDATE-C2` record that exists only on one machine is not evidence anyone
else can check. Copying them here is **archival**: no byte of either record was edited, no verdict was
re-marked, no manifest was rewritten, no candidate ref and no Authority pointer moved.

---

## 1. The two records — identity, class, binding

Both are **byte-identical copies** of the adjudicators' files (`sha256` below was taken before and
after the copy and is equal on both sides).

| record | `sha256` | bytes | `recordClass` | `candidateCommit` | `candidateSha` | source (not on master) |
| --- | --- | --- | --- | --- | --- | --- |
| `C2-A.json` | `0823170ed5937f2160072af11aac3e5b7dac5dd8198187f2dd2aa7e95a9618ec` | 41372 | `CANDIDATE-C2` | `0d31f9121308a43030701fe6d56c316100782419` | `0d31f9121308a43030701fe6d56c316100782419` | `.worktrees/c2a-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-A.json` (branch `task/c2a-cand4-20261113`, adjudicator session `c2a-cand4-20261113`) |
| `C2-B.json` | `1e05deaa40ac99dbb29ed1604f0305c11c4a1997359df5180b28cb369c5e64a6` | 36627 | `CANDIDATE-C2` | `0d31f9121308a43030701fe6d56c316100782419` | `0d31f9121308a43030701fe6d56c316100782419` | `.worktrees/c2b-cand4/dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-B.json` (branch `task/c2b-cand4-adjudication`, adjudicator session `c2b-cand4-adjudication-20261116`) |

**The binding check the archive was gated on.** Both files name
`candidateCommit = candidateSha = 0d31f9121308a43030701fe6d56c316100782419`, which is the SHA the
manifest freezes and the SHA `candidate/v0.1.6-4` points at. Had either record named a different
commit, this archive would not exist: a `CANDIDATE-C2` record is bound to one SHA and cannot be
re-pointed.

Both adjudicators state they did not author product code, did not move the Authority pointer, did not
move the candidate ref, did not tag or publish, and did not edit the frozen manifest (fields
`authored_product_code` / `moved_authority_pointer` / `moved_candidate_ref` in each record's
`adjudicator` block).

---

## 2. Verdicts — both `eligible: false`, C2-B is `NOT PASS`

| record | verdict (first sentence, quoted) | `candidateClaimEligibility.eligible` | scope of the claim |
| --- | --- | --- | --- |
| `C2-A` | *"PASS for C2-A as re-scoped on this SHA: identity 147/147; A6-off A1 seven clauses 7/7 twice with a same-tree A6-on control 7/7 twice and full cross-mode agreement … packaging 33/33 driver + 39/39 live twice with artifact identity equal …"* — and, in the same sentence, *"Candidate-level eligibility is NOT claimed: C2-B is unrun on this SHA and the manifest evidence.record_root is still stale."* | **`false`** | `C2-A only` |
| `C2-B` | **`"NOT PASS (candidate claim not eligible from this record)"`** | **`false`** | "this record claims CANDIDATE-C2 only for the measurements below, all run on `0d31f9121…`" |

**Both are `eligible: false`, and C2-B's verdict is `NOT PASS`.** That is the archived fact and it is
not softened here. This is not a documentation accident and not an archive defect: two independent
adjudications on the same SHA each **explicitly withheld the candidate-level claim**, and the second
one's overall verdict is a refusal.

- **C2-A's `eligibleIf`** (quoted from the record): *"C2-B is measured on `0d31f9121` with a PASS, and
  the manifest `evidence.record_root` is corrected by a new manifest commit (not an edit of the frozen
  one)."* Neither limb is met by this archive: C2-B was measured on that SHA and returned **NOT PASS**,
  and no manifest correction commit exists (the generator fix that makes future manifests derive
  `record_root` from the candidate id deliberately does **not** rewrite the frozen `-4` manifest; see
  `scripts/freeze-candidate.mjs#recordRootFor` and item 1 of this lane).
- **C2-A's own reason text is stale in one clause.** It says *"C2-B is unrun on this SHA"*; C2-B has
  since been run, which is why both files sit here. The clause is left exactly as written — a record
  is not edited after the fact — and the reviewable fact is the `eligibleIf` above, which C2-B's
  `NOT PASS` fails. This supersession is recorded here, in prose, not in the record.
- **C2-B's refusals, in its own words** (`candidateClaimEligibility.basis`): PD-40 Sticky Stop
  **reproduces** (arm A3); the two conjunctions the release most depends on have **no instrument** on
  this tree — `Goal × plane-takeover × A6-off` and PD-42's approved-`bash`-out-of-lane; the operator
  re-issue path has no arm; #745's committed composition artifacts are stale and one README sentence
  is false; and the release notes still asserted PD-43 open in four places. Those are refusals of the
  **claims a release would make**, not failures of the measurements: C2-B *signs* A6-off 7/7 twice
  (A1), #738's lifecycle gate (A2), pd33's typed-shut no-plane composition (A5), packaging 16/16 with
  a byte-identical tarball (A6), both crash windows, and joint 11/11 twice.

Nothing in this archive upgrades a refusal: no prior C2 result is re-marked `PASS`, and no `V@B` cell,
matrix grade, or `CANDIDATE-C2` claim is created by copying these files into the tree.

---

## 3. Verifier command and its output (measured here, not transcribed)

The verifier is the independent one (`scripts/verify-candidate.mjs`). It re-derives every manifest
digest, re-reads the live Authority pointer through the one authority loader, re-runs the ancestry
checks and the host pin, and then verifies the **cited run records** — including the hard refusal that
a record claiming candidate eligibility must name the manifest's own commit.

```bash
# C2-A
node scripts/verify-candidate.mjs \
  --manifest dev/engineering/candidates/cand-v0.1.6-4.json \
  --record dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-A.json
# C2-B
node scripts/verify-candidate.mjs \
  --manifest dev/engineering/candidates/cand-v0.1.6-4.json \
  --record dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-B.json
# both together (the pair, which is what the candidate-level claim would need)
node scripts/verify-candidate.mjs \
  --manifest dev/engineering/candidates/cand-v0.1.6-4.json \
  --record dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-A.json \
  --record dev/agent-workflow/evidence/candidate-v0.1.6-4/C2-B.json
```

Measured output (full transcripts: [`verify-C2-A.txt`](./verify-C2-A.txt),
[`verify-C2-B.txt`](./verify-C2-B.txt), [`verify-both.txt`](./verify-both.txt) — each ends with the
process exit code):

| run | record edge | summary line | exit |
| --- | --- | --- | --- |
| `--record C2-A.json` | `PASS evidence…/C2-A.json: runId=(none) recordClass=CANDIDATE-C2 eligible=false candidateCommit=0d31f9121… — no candidate claim, preserved reference only` | `VERIFIED cand-v0.1.6-4 @ 0d31f9121… — PASS=147` | 0 |
| `--record C2-B.json` | `PASS evidence…/C2-B.json: runId=c2-b-cand-v0.1.6-4-20261113 recordClass=CANDIDATE-C2 eligible=false candidateCommit=0d31f9121… — no candidate claim, preserved reference only` | `VERIFIED cand-v0.1.6-4 @ 0d31f9121… — PASS=147` | 0 |
| both records | the two `PASS` record edges above | `VERIFIED cand-v0.1.6-4 @ 0d31f9121… — PASS=148` | 0 |
| (no record, for the baseline) | `PASS evidence.records: no run record is cited … vacuously satisfied` | `VERIFIED cand-v0.1.6-4 @ 0d31f9121… — PASS=147` | 0 |

Read the vocabulary carefully: `VERIFIED`/`PASS=1xx` grades **the manifest's identity edges plus how a
cited record is bound** — it says "this record is bound to this manifest and makes no claim it cannot
support". It is **not** a candidate verdict. The records' own verdicts (§2) are what decide
eligibility, and both say `eligible: false`.

---

## 4. What this archive does not do

- It does not edit either record. The bytes are the adjudicators' bytes (`sha256` in §1).
- It does not re-mark any prior C2 result as `PASS`, and it does not restate C2-B's `NOT PASS` as
  anything else.
- It does not rewrite the frozen manifest: `cand-v0.1.6-4.json` still carries the pre-fix
  `evidence.record_root` (`…/candidate-v0.1.6-1`) as frozen history. The generator fix makes the
  **next** freeze derive it.
- It does not move the candidate ref, the Authority pointer, any matrix grade, or Required CI.
- It does not carry the adjudicators' supporting run directories (boot logs, agreement files). Those
  stay where they were produced; the records name them, and the records are what a `CANDIDATE-C2`
  claim is verified from.

## 5. Re-running the verification

Any checkout of this branch can reproduce §3 byte-for-byte except for the order of independent git
reads: the only live inputs are this repository (the candidate commit and ref must resolve — the
commit is an ancestor of `origin/master`, the ref is `candidate/v0.1.6-4`) and the tracked Authority
pointer (`dev/engineering/current-authority.json` → snapshot `as20261109r1`). The host tree is
gitignored; the verifier reads the pin from `tests/paths.mjs` at the candidate commit, so no boot and
no `tests/homes/` world is needed.
