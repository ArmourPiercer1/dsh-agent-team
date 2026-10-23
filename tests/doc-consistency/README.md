# tests/doc-consistency — ownership and controls (EB1)

**Owner: Engineering Baseline line (E0–E1).** Created 2026-10-23, isolated branch
`task/eb-e0-e1-doc-baseline-20261029`, base `929fc4af2`. Nothing here is collected
by `vitest.config.ts` or by `scripts/run-tests.mjs`, so the nine-root Census and
the Alpha.5 red sets are untouched by this directory.

## What runs this code

| target | command | what it proves |
| --- | --- | --- |
| positive + negative controls | `pnpm docs:controls` | every rule below can FAIL for the right reason, and the clean baseline PASSES |
| fast probe | `pnpm docs:probe -- --base <verified-ref>` | changed-document consistency (T0) |
| complete check | `pnpm docs:sync -- --check` | whole current-document set, including derived-view freshness |

Controls are run by a plain-Node runner (`scripts/doc-consistency-controls.mjs`),
not by the suites, because this worktree has no `node_modules` by design (capacity
rule for this line). They are also read-only against the repository: each scenario
gets its own throwaway fixture Git repository under the gitignored
`.worktrees/eb1-controls-scratch/` path of this worktree. Nothing is written into
`docs/`, `.agents/` or `dev/` by a control.

## Rule × scenario matrix

| rule (code) | positive case | negative case (must fail) |
| --- | --- | --- |
| note status == directory (`NOTE_note-status-dir-mismatch`) | clean fixture | note in `implemented/` declaring `status: proposed` |
| note id uniqueness (`NOTE_note-id-duplicate`) | clean fixture | second note reusing `EB-ADR-0001` |
| implemented needs existing evidence (`NOTE_note-verified-by-missing`) | note citing an existing artifact | same note with the artifact deleted — proves liveness, not caching |
| proposal carries no delivery claim (`NOTE_note-false-delivery-claim`) | proposed note describing future behaviour, no evidence | proposed note carrying `verified_by:` |
| stable-id uniqueness (`ID_DUPLICATE`) | clean fixture | repeated `INV-EB-0001` in `ids.yaml` |
| contract anchor exists (`CONTRACT_ANCHOR_MISSING`) | clean fixture | `source_anchor` pointing at a removed file |
| no verification without artifact (`FAKE_VERIFICATION`) | all entries `not_verified` | entry flipped to `verified_local` with empty `verification_artifacts` |
| named artifact must exist (`ARTIFACT_MISSING`) | — | entry citing a path that is not in the tree |
| derived view freshness (`STALE_GENERATED_VIEW`) | `--write` then `--check` | registry changed, view not regenerated |
| write authority | `--write` regenerates only the view | `--write` leaves normative files byte-identical; `isWriteAllowed()` refuses contract paths |
| terminology (`TERMINOLOGY_DEPRECATED`) | clean fixture | deprecated token in a current-state doc |
| links (`LINK_DANGLING`) | clean fixture | relative link to a missing file |
| claims need evidence (`CLAIM_WITHOUT_EVIDENCE`) | claim citing an existing artifact | same claim with the citation removed |
| proposal exemption (AC-EB-0001 positive) | Idea + Proposed describing future behaviour → no findings | — |
| base resolution | `--base <sha>` sees committed, staged and untracked changes | unresolvable `--base` → `REFUSED`, exit 2 (never "no changes") |
| CLI discipline | `--check` | `--base` missing → `REFUSED`; `docs:sync` with neither `--check` nor `--write` → `REFUSED` |

A scenario passes only when the expected finding code **and** the expected exit
code are both observed; an unexpected crash is reported as a FAILED control, never
as a pass (learned the hard way on 2026-10-23, when a `ReferenceError` exit 1 was
almost logged as a successful negative control).

## Deliberately NOT covered here (declared, not hidden)

- No C1/C2/C3 and no runtime behaviour: these are static document checks.
- Claims inside Markdown table cells are not scanned (policy tables produce false
  positives); a table containing a delivery claim is missed.
- Historical text (round log, `evidence/**`, finished plans, frozen contract
  records) is preserved and never retro-flagged.
- Semantic equivalence of prose stays with the Contract Owner.
