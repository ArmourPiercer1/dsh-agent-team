# stage2-observer lane — rounds log (PR #54, sole writer: observer lane)

Owned: `tests/kits/pr-e-requirement-recovery-smoke/stage2-observer.{mjs,test.mjs}`
+ the `s2o-*` evidence dirs beside this file. Branch `task/pre-alpha3-pr54-ui-observe`.
Prior rounds (index): stage-1 hold-point batches 1–5 (flag-off byte-identical);
batch-3 blocks A/B/C; `3a0c494f` fresh-boot rail; `46f46305` PNG omission;
`8e19f5d2` structured entry diagnostic; `d8e95a9a` member-perspective entry;
`8e8584b8` P1 verification-before-publication (orphan-marker claim RETRACTED);
`e42d87c5` additive geometry reads. No live run was performed by any observer
round; run5/run6 were parent-authorized live runs whose raws this lane only
read. Await-timeout non-recurrence remains NOT attributed.

## Round 5 — geometry-STABILITY GATE (`s2o-*-stability-*`)

Why: live run6 (22-15-13) showed evaluate legs measuring a TRANSIENT mid-relayout
box (bar [327.5,347.5], widths {panel:20,dl:0,…}) while the SAME pass's
screenshots showed a healthy settled layout — the measurement-window race run5
had left explicitly NOT-concluded.

Mechanism (weighted): PRIMARY = the pinned host tracks the viewport via a
rAF-throttled ResizeObserver (AppFrame.tsx L151-168) and admits "The JS solve
lags the viewport by a ResizeObserver + rAF frame" (L252-258) — the responsive
auto-collapse lands one frame late (expected settle: 1-3 samples). SECONDARY
(toggle-only): CSS grid easing `transition: grid-template-columns
var(--ds-transition-duration-slow)` (AppFrame.module.css L16; = 0.3s,
ui-theme base.css L14) is deliberately SKIPPED for resize-driven collapses
(the viewportChanged guard, AppFrame.tsx L218-224).

Gate (parent CODE GO, minimal): after the narrow resize + existing readiness
predicates, `sampleFrameGeometryDom` (viewport, sidebar-collapsed attr,
panel/rail parent-chain rects + computed transition + data-animating) is polled
~50ms by `waitForStableFrameGeometry` until TWO CONSECUTIVE IDENTICAL samples —
keyed STRICTLY on geometry identity, NEVER on oracle results (waiting-for-pass
forbidden). Deadline = existing OBSERVE_TIMEOUT_MS → typed `S2O_GEOMETRY_UNSTABLE`
fail-closed, NO marker (leg 99 proves the empty marker dir). All original
oracles then run ONCE against the settled layout, byte-kept; run5-style stable
data pays exactly one redundant identical pair (leg 100: polls=2, verdicts
unchanged, incl. genuinely-failed settled cases). Transient pre-stability
samples ride `comparisons.json → <phase>.geometry.preSamples` so a future
run6-style race is PROVABLE from raws. No 600ms blind sleep, no host/CSS change,
no new viewport tiers.

Fixtures (offline, foreground, bounded): 98 transient→settles ⇒ gate waits,
evaluates settled, transients recorded; 99 never-settles ⇒ typed timeout, zero
marker; 100 stable ⇒ one redundant pair, both-viewport diagnostics land.
RED 100/97/3 rc=1 (only gate legs fail pre-gate); GREEN 100/100/0 rc=0;
ui-observe suite 51/51/0; CLI typed smoke unchanged.
