# Dated note on this directory's MUTATION.diff (added 2026-10-31, round-4 fix round — F-I1a4-5)

`MUTATION.diff` here is byte-identical to the one committed at `3ac9fd52e`. **It is not rewritten by
this note** — committed evidence bytes are never edited in place; what follows is the disclosure that
was missing beside them.

The hunk header says `@@ -660,7 +660,7 @@`, but at the bytes this run mutated the removed line —
`conjunct('driver', 'boot-2 self-reported pid equals the pid this driver spawned', p2?.pid ===
host2.spawnPid,` — sits at line **762** of `tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs`
(grep-verified at `3ac9fd52e`: the diff's `-` line occurs exactly once, at 762). The header is **102
lines stale** because the patch is older than these bytes: it was **generated** against the driver as
of `74014ee12`, where `@@ -660,7` and the true line 663 were consistent, and the round-18 re-run
replayed the stored patch onto the grown file. `git apply` locates a hunk by its context lines, not by
the header numbers — which is why the run's whole-file rebuild check still pinned the mutation to
exactly one line's change (see `MUTATION-METHOD-LAW.txt` in this directory). The numbers are a
provenance artifact of when the patch was made, and they stay as generated.

The rule this note records (round-4 review, F-I1a4-5): **hunk headers are generated, never typed** —
a committed `MUTATION.diff` is the output of a diff over the bytes that were mutated at patch-creation
time. Where a stored patch is later replayed onto a moved file, that fact is disclosed beside the
patch — as here — and the mutation is pinned by the law's whole-file rebuild check and the read-back
of the planted line, never by the header.
