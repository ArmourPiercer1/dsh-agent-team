# INCIDENT (self-caused, recovered): `git checkout --` wiped the uncommitted implementation

Sequence: the first mutation round (M1..M3) reverted mutations with
`git checkout -- <file>` — but derivation.ts and projection.ts carried THIS
lane's UNCOMMITTED implementation, so the checkout reverted the feature
itself, not just the mutation. Consequences, all handled:

- The first M3 capture measured a feature-less tree (items absent because the
  merge was gone, not because of the mutation) and was therefore INVALID as a
  mutation proof. Diagnosed empirically (probe + instrumented merge showed the
  merge code was simply absent — `git status` showed the two files reverted).
- The implementation was RE-APPLIED line-for-line and the full green was
  re-established (gate-a4-escalate-and-p3-trio.txt: 134 passed; the 17-leg
  pair: 17 passed).
- The ENTIRE mutation matrix was RE-RUN against the restored implementation
  with a backup discipline: every mutated file is copied to
  .tmp-faultscratch/impl-backup/ BEFORE mutation and restored by `cp`, with
  sha256 verified back to the backup digest after each leg. No `git checkout`
  is used for mutation reversal. Final state verified: every mutated file's
  digest equals its backup (and the runtime suite + gates re-passed over the
  restored tree afterwards).
- The pre-incident M1/M2 captures happened to be valid (both mutated the
  intact implementation before reverting), but were re-captured anyway under
  the new discipline; the evidence/mut/ files are all the redo.

Lesson recorded: on an uncommitted tree, mutations revert ONLY by backup cp,
never by git restore.
