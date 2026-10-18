# a5-globoff-key — battery triage (branch off master 5885e46e, no push)

Battery runs (all transcripts in this directory):

1. `RED-before-impl.log` — the new spec, 5 red / 2 green BEFORE implementation,
   exactly the predicted shape: `globEnabled:false` silently ignored (K2/K3/K4/K7
   ran the real glob), non-boolean silently treated as usable (K5). K1/K6 pinned
   the current form and stayed green across the whole round.
2. `GREEN-after-impl.log` — same spec 7/7 after the two-plane-hunk implementation.
3. `runtime-suite.log` (packages/runtime, 4672 legs) and `base-runtime-suite.log`
   (same suite at the base commit, changes stashed) — the FAIL-set diff is EMPTY
   for my tree: every failure of the changed tree also fails at the base, and the
   base run additionally carried one a3p3 hygiene flake the changed-tree run did not.
4. `full-suite-at-mine-rootcwd.log` — canonical root-cwd run, ALL nine packages:
   7375 tests / 11 failed. Per-file A/B at the base (changes stashed, same
   environment):
   - p6t3-mediation (5) + p6t3-restart (2): base A/B identical 7 failed | 5 passed
     — pre-existing on this host at the base commit; no import path to the plane.
   - t2-blueprint-hash (1), p6t6-actions (1), a4p7-merge-gate leg "is green,
     asserted by arm name": fail identically at the base — pre-existing.
   - a4p7-merge-gate leg "the committed install surface is fresh against the
     tree": the ONE delta, and it is the hygiene gate doing its job — it refuses a
     src edit whose dist mirror is not COMMITTED beside it; it is re-run after the
     commit below and closes there (check:artifacts path re-checked at head).
   Environment note: the worktree runs need `tests/deepseek-harness-test-use`
   provisioned (it is gitignored; absent it, REPO_ROOT walks up to the stale main
   tree and rc2-persona-probe / a4pr0a read the wrong sources). Provisioned here
   by hardlink copy from the main tree; with it, rc2 13/13 and a4pr0a pass.
   a4pr0a additionally needs the ROOT cwd (`git ls-files packages`); it passes
   root-cwd in both mine and base runs — the package-cwd invocation is the flake.

Ownership: `git diff` on team-tool-plane.mjs is 5 hunks, all inside
createTeamToolPlaneAssembly + its docblock; zero diff lines in PLANE_RESERVED_NATIVE
or verifyPlaneNames (parallel 单 B territory, branch a5-pindir). agent-bindings.mjs
untouched: planeCfg is passed through whole (`plane: planeCfg`), so the new key
arrives at the assembly with zero binding-layer edit.
