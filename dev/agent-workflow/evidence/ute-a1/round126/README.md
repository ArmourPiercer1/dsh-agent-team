# ROUND 126 — the version gate is GREEN at a frozen candidate SHA (first end-to-end exercise)

Dated 2026-11-26. Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`.

## What was wrong and what fixed it

Round 125's single dispatch passed the gate (62 judges) but the job failed in the **binding step**, which parsed the
verdict with `require()` on a bare relative path (`Cannot find module 'dev/…/verdict.json'`). Round 126 changes only
that: the binding step now reads the file with `fs.readFileSync` + `JSON.parse`, with a comment naming the defect.
The binding assertions themselves (graded == checked-out == requested, artifact fresh) are unchanged.

## The frozen-SHA run

```
gh workflow run candidate-acceptance.yml --ref vnext/a1-cut -f head=23435646228553715ae51fee98357f5927f69ab1
run 45752072811
```

| job | conclusion |
| --- | --- |
| `candidate-acceptance (VERSION GATE, NOT per-PR Required) head=2343564622…` | **success** |
| `version-gate (Required at frozen candidate SHA)` | **success** |

Both hosts, 31 judges each:

```
CANDIDATE-GATE pass host=legacy judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
CANDIDATE-GATE pass host=next   judges=31 proven=30 known-refuted=1 env-limited=0 drivers=4 records=8 agreement=true
CANDIDATE-GATE pass hosts=legacy,next judges=62 proven=60 known-refuted=2 env-limited=0
```

The only non-PROVEN id remains the approved product-scope refusal `d4:ask-execute-process`
(`SCOPE-subprocess-ask.md`, owner-approved 2026-11-24).

## The receipt, verified locally

`version-gate-receipt.json` (schema `1`, gate `candidate-acceptance-gate/1`) binds head
`23435646228553715ae51fee98357f5927f69ab1`, `verdict: pass`, `judges {proven:60, knownRefuted:2, envLimited:0}`,
`hosts [legacy, next]`, `startedAt 2026-11-26T04:06:28.841Z` → `finishedAt 04:15:35.302Z`, and references the gate's
own `2026-11-26T04-06-28-840Z/verdict.json` by path + sha256. The referenced verdict was restored into the
evidence tree from the run's own bundle so the binding is verifiable in-repo:

```
VERSION-GATE-VERIFY pass head=2343564622… hosts=legacy,next proven=60 known-refuted=2 env-limited=0 … EXIT=0
```

Copy of the receipt: `hosted/version-gate-receipt-…-45752072811/version-gate-receipt.json`.
Verifier refusal path exercised: with the referenced verdict absent it prints
`REFUSED VERSION_GATE_VERDICT_FILE_MISSING …` and exits 1 — a receipt is never accepted without its evidence.

## What this does and does not establish

- **Establishes**: the version gate has now been exercised end-to-end at a frozen SHA — dispatch → provisioning of
  both pinned hosts → 16 real host boots → dual-host gate → head binding → receipt → `version-gate` verification
  context, green.
- **Does not establish**: `PRODUCT-PROVEN` for any row. That additionally requires the owner to apply the release
  branch/tag protection rule naming the `version-gate` context (`VERSION-GATE.md` §5/§6); no rule has been applied and
  no release ref exists.
- The hosted **Required** CI set is a separate thing: on a PR it grades the merge commit `merge(master, head)`, not the
  frozen SHA (round 124 §B). The frozen SHA is graded by this gate.
