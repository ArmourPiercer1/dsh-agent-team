# Evidence set ledger — `alpha6-pr-i1b-real-host` (dated 2026-10-31, round 3 of PR-I1b / #522)

**The binding evidence set for the merge-gate spec is exactly:**

- `capture.json` — pinned by `packages/runtime/test/a6-pr-i1b-admission.test.ts` (`readRealHostCapture`), and
- `a6pri1b-2026-10-31T15-54-28Z/` (`verdict.json` + `MEASURED-LINES.txt` + `host.log`) — which the spec
  requires, at read time, to be **byte-identical** to `capture.json` (F-I1b3-2). The kit writes both from one
  object in one run; the pair above was verified byte-identical before landing.

That run booted both worlds **inside `TEST_PORT_RANGES`** — matrix `3181`, enable `3182`
(from the bands in `tests/paths.mjs`, both probed free, neither 3080 nor 3180 ever touched) — and its
verdict token is `VERDICT kit=pr-i1b-real-host run=a6pri1b-2026-10-31T15-54-28Z ports=3181+3182
checks=24 failed=0`.

## What changed and why (nothing here is silent)

- **Removed by this commit: `a6pri1b-2026-10-31T13-51-12Z/`** (was tracked @ `256410456`, recoverable there
  byte-for-byte). It recorded the off-band boot `[3292, 3392]` that round-3 finding F-I1b3-1 proved was
  structurally outside every sanctioned band. The spec's read-time port pin now reddens any capture whose
  recorded ports leave the bands, so leaving that capture's stamped set in the tree would have left a
  committed evidence set that the spec can never certify — a silently contradicting set. It is superseded by
  `15-54-28Z`, not merely re-labelled.
- **Kept, not binding: `a6pri1b-2026-10-31T12-46-43Z/`.** This directory is cited verbatim by
  `docs/plans/memo/alpha6-review-separation/pri1b-admission-design-20261031.md` §10 (`checks=22 failed=0`).
  Dated evidence a normative-history document cites stays tracked (TEST_METHODS §8 keep-set), so it remains
  as the historical record of the round-1/2 runs — which were also off-band (`3182`/`3282`). The identity
  pin makes it inert as merge-gate evidence: `capture.json` pins `15-54-28Z`, and a capture repointed at
  `12-46-43Z` reddens on byte-identity (proven by mutation in the round-3 fix report).
- **Disclosed, never landed: run `a6pri1b-2026-10-31T15-53-57Z`** (`checks=24 failed=14`). A failed
  in-band attempt: two kit runs were executing concurrently (a runner error — the instrument is single-runner
  by design: ports are probed free seconds before bind), and one world's checks raced the other's boot
  (`405`, `state: starting`). The kit recorded the failure honestly (rc=1); its directory was deleted before
  landing because it measures a corrupted interference, not a host.

## Attribution correction (F-I1b3-1)

The off-band boot was **the instrument's own deviation** — the kit computed its enable port as
`enablePort = port + 100` (3182 → 3282, 3292 → 3392), which lands outside `TEST_PORT_RANGES`
(`3180-3199 / 3491-3500 / 13000-13099`, `tests/paths.mjs`) for every in-band primary. Earlier prose
attributed the choice to the runner brief; that was wrong — the brief's ports were band-legal, and a
band-legal `--enable-port` under the old arithmetic still produced an off-band enable boot. The kit now
derives both ports from the imported bands, refuses out-of-band `--port`/`--enable-port` by name, and
asserts both ports in-band before booting anything.
