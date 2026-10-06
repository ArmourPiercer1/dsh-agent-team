# CORRECTION NOTE — evidence wording of the 4bd13a9a round (2026-10-05, repair round 2)

Written as a NEW file on purpose: `README.md`, `PROVENANCE.md`, `git/` and every log
of the previous round stay byte-identical. This note only retracts/qualifies
statements made there. It changes no source and no verdict.

Reviewed commit under correction: `4bd13a9a580b177151d1769da3a38142e01211b8`
(parent `ed9e2c09b02ca0e04f4f5cdb03c51abf42d9bb29`). The one approved real-Chrome
v4 run (`bash-2336`, stamp `2026-10-05T18-50-45Z`, exit 2, E2 PASS,
E1/E3E5 `locate-not_found`, E4 frozen NOT_RUN) remains the terminal live authority;
nothing here re-litigates it and no browser/host/wrapper was executed again.

## 1. Stale compiled hash — proven. Failure-time DOM — NOT proven.

The previous README (the "P5" diagnosis paragraph) read as though the live failure
had been shown to be caused by a stale CSS-module class in the shipped bundle, with
the failure-time DOM as supporting evidence. Correct split:

* **Proven** — the compiled class vocabulary used by the driver/fixtures is stale
  relative to the delivered artifact. `built-artifact/ui-workspace-lib-client-js.txt`
  pins the shipped `ui-workspace-lib` client bundle at `bytes=200414`,
  `sha256=e9b6815b2469e7cee8dafe92d42e76b70a0f016e8e52c98e38a11d2cef39cc07`; that
  bundle contains the `_6kVdha_title` family and **0** occurrences of `W0d-vW`.
  A locator that could only work against `W0d-vW…` could never have matched this
  artifact. That is a fact about the artifact and the strings, nothing else.
* **NOT proven** — what the DOM actually looked like at the moment E1/E3/E5 failed.
  The 18-50-45Z run captured no failure-time DOM at all: a locate miss was recorded
  only as `locate-not_found` plus counts. Which candidate cause fired *first*
  (stale class vocabulary, an unexpanded group, English-only label matching, or the
  fixed-x region bound), which locale was active, the real sidebar width, and
  whether the compiled prefix at that instant was exactly `6kVdha_title`, are all
  **unproven** and remain so. They are hypotheses about a run we cannot reproduce.
* What this round actually establishes is narrower and stronger: the collector and
  the navigation seam at `4bd13a9a` were **structurally** wrong (whole-document
  key-prefix matching, positional group traversal, leaf-counted row identity), so
  they could not have produced a trustworthy locate on the real rail regardless of
  which of the above caused the specific miss. That is demonstrated offline against
  the faithful DOM (`RED-identity-20261005T203443Z.log`), not inferred from the live log.

## 2. `shot-E2-ordinary.png` is E2-only corroboration

That screenshot shows the **E2 ordinary-workspace leg** (the one leg that passed).
It does not depict the rail at the moment E1/E3/E5 missed, and it is not evidence
about the group/overflow/session DOM state of those legs. Any sentence implying it
corroborated the failure-time rail must be read as: "the E2 leg's UI looked as
expected". E1/E3/E5 have no failure-time screenshot from that run — which is exactly
why `navigate()` now writes `shot-<leg>-locate-<status>.png` plus scrubbed rail
diagnostics on a locate failure.

## 3. PROVENANCE tree hash — corrected here and in the new receipt

Previous `PROVENANCE.md` lists the delivered commit's tree as
`9f6eb5c41816d82fe7811360d997b71d6b8ed598`. That is the tree of the unreachable
intermediate commit `8c99142e…` (the pre-review build), not of the delivered commit.

Verified in this worktree at the reviewed commit:

```
$ git rev-parse 4bd13a9a580b177151d1769da3a38142e01211b8^{commit}
4bd13a9a580b177151d1769da3a38142e01211b8
$ git rev-parse 4bd13a9a580b177151d1769da3a38142e01211b8^{tree}
07d1250b4e7d4d9dce6808e20de1e2a24a6094b3
$ git rev-parse 4bd13a9a580b177151d1769da3a38142e01211b8^{parent}
ed9e2c09b02ca0e04f4f5cdb03c51abf42d9bb29
```

So the correct final tree of `4bd13a9a…` is
**`07d1250b4e7d4d9dce6808e20de1e2a24a6094b3`**. `PROVENANCE.md` is left as written
(historical record); the corrected value is stated here and in the new round's
receipt + `git/commit-metadata.txt`, which pin parent, newHEAD and tree explicitly.

## 4. One further transparency item, restated rather than buried

The previous round's `git/commit-metadata.txt` records `porcelain at capture: 1
lines` because a `source/` staging slip briefly existed in the worktree root before
being moved into the package. Nothing entered the commit; the count is kept visible
rather than re-measured after the fact.
