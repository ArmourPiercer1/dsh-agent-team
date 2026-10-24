# M2-WRITE-01 — post-consume write closure (root implementation ruling, 2026-10-23)

Owner: M2-WRITE-01 (this card). Assembly (final edge) owner: CENTER.
Zero commits, zero push, zero Host. Two files, both NEW, both in my exclusive
scope; the lane barrel `controlled-fs/src/index.ts` is NOT touched (CENTER adds
exports at integration); census registration belongs to CENTER/CI owner.

## Files delivered

| file | role |
|---|---|
| `packages/runtime/controlled-fs/src/post-consume-write.ts` | the internal write-execution closure (NOT barrel-exported) |
| `packages/runtime/test/a5m2-post-consume-write-c1.test.ts` | the fixed-point C1 (13 legs, three-state resolution) |
| this `runs/2026-10-23T08-30Z-pcw/` | `c1-pcw.raw` (13/13, RUNNER_EXIT=0), `tsc-runtime.txt` (EXIT=0), `eslint.txt` (EXIT=0), `audit.txt` (EXIT=0, `post-consume-write.ts` listed among consumers, OK), `git-status.txt` |

## P1 — closure shape (no post-approval substitution)
`createPostConsumeWriteClosure(plan, consumedContext, config)` → a FROZEN
closure `{ write, claimed }`. `write()` takes ZERO parameters (leg asserts
`write.length === 0` and that extra arguments cannot change the frozen bytes).
`rootReal / approvedLocator / content / planFingerprint` are read from the
frozen typed plan ONLY. Construction violations are `TypeError`s: a consumed
`parametersFingerprint` that is not the plan's fingerprint is refused with
“one plan, one spend”; the approved locator is RE-DERIVED against the lexical
root (pure-lexical law), never trusted from caller arithmetic. The factory
handle is not a permission: minting anything requires the exact consumed plan.
Legs: T-P1, T-P1b, T-P5 (barrel carries no symbol; `Object.keys(closure) ===
['claimed','write']`).

## P2 — open without O_TRUNC; verification BEFORE truncation
Existing-target path only (see NEW-FILE LIMITATION): the open is
`O_WRONLY | O_NOFOLLOW` — NO `O_TRUNC`, NO `O_CREAT` (the O_CREAT-less shape
is what makes state A/B separation structural, see below). Before the open:
root-identity agreement (the instance root's CURRENT realpath must equal the
plan's approved root real identity — the comparison baseline this module NEWLY
owns), parent-directory identity (realpath must equal the approved lexical
parent exactly — a match is only possible when every ancestor component is
real), target alias law (lstat: symlink/`not-a-file` refused before anything
is touched). After the open: the SAME `verifyOpenedHandle`
(`open-at-exec.ts:67-96`) — `/proc/self/fd` escape + same-FD `fstat` dev/ino
against the pre-open lstat snapshot. Only a `confirmed` verdict reaches
`truncate(0)` then `write(content)` ON THE SAME FD.
Legs: T-C1 (happy, byte-exact no-residue, D-C2-1 receipt keys only), T-P2
(root swap ⇒ `outside-anchor` refusal, target stands BYTE-EXACT `PRECIOUS-
BEFORE-ATTACK\n` — the old O_TRUNC-at-open law truncated first and discovered
later; this is the P2 ordering proof), T-P2b (parent swapped with an outside
namesake victim: refused pre-creation `symlink-alias`, victim not even opened).

## P3 — claim BEFORE the first await, no ledger, no boolean consumed
The claim flips SYNCHRONOUSLY in `write()`’s sync prologue; in-flight AND
settled repeats are refused with zero FS, message carries `already claimed`.
The state is a closure-local string cell — no global ledger, no
`consumed: boolean` parameter anywhere. Disclosed: a refused repeat also
settles the closure (a repeat could touch FS; one consumed call, one attempt).
Leg: T-P3 (three concurrent claims + a post-settled fourth; exactly one
landing; bytes written once).

## P4 — three states, separated BY CODE
- **A (checks fail before creation ⇒ ZERO CREATION)**: structural, not lucky —
  the module contains NO `O_CREAT` anywhere, so no window, race or error path
  can create. The new-file path itself is the HELD path (limitation below);
  leg T-A1 asserts the typed refusal carries the limitation name
  (`HELD pending root ruling`, no-openat2/parent-FD spelled out) and nothing
  was created. T-A2: parent swapped to an outside symlink BEFORE the call ⇒
  `symlink-alias` + the outside dir stands EMPTY (iron proof).
- **B (existing target, checks after pre-check)**: cannot produce a created
  file from this closure (no `O_CREAT` at all). T-B1: raced-away target —
  whichever branch the runtime takes, the iron invariant asserted is
  `!existsSync(target)`: the closure creates NOTHING.
- **C (after truncate, existence AND content changed)**: any later failure is
  `cfsUndetermined('write-side-effect-unconfirmed', { sideEffectPossible:
  true })` — the existing lane law verbatim (code EXECUTION_TERMINATION_
  UNCONFIRMED). The success side is leg T-C1 (bytes exact). The FAILURE side
  (truncate succeeded, write failed) has no forceable injection seam at this
  level: **NOT_VERIFIED**, disclosed.
- Drift of a verified-then-swapped existing target before truncation rides the
  existing lane mapping `exec-time-identity-drift { sideEffectPossible: false }`.

## NEW-FILE LIMITATION (path HELD pending root ruling — concrete finding)
Binding and validating the controlled parent/target reference BEFORE creation
requires one of:
1. `openat2(RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS)` — not exposed by Node 24
   (no binding; libuv has no wrapper);
2. a pinned parent-FD + `openat` — Node exposes neither `openat` nor a way to
   open a target THROUGH a held directory fd (`OpenAtPort` unlanded; the lane
   pins `ARBITRARY_TREE_PROFILE_PUBLISHED = false`, admission-binding.ts law 4).
What exists is approximation: per-component `lstat` (aliasWalk) and
`realpath` pre-checks — all inherently racy against a parent swap because
`O_NOFOLLOW` guards ONLY the final path segment: an `O_CREAT` open after a
verified pre-check resolves through the CURRENT parent, so creation can land
outside the approved identity, discovered only afterwards. The root ruling
forbids exactly that “create-then-discover-via-FD” pattern, and forbids using
a post-hoc `undetermined` to excuse an unauthorized/out-of-bounds write — so
the absent-target branch REFUSES (`not-a-file`, message naming the HELD path
and the missing primitives) instead of approximating. The pre-creation parent
checks are retained as defense-in-depth for the existing-target path, NOT as
a creation license.

## Post-open drift/escape branches — measured, disclosed NOT_VERIFIED
On this runtime (Node v24.21.0, libuv 1.x) `fsPromises.open` completes in the
event-loop I/O polling backend: measured (`OPEN_RACE: opened-before-attack`),
a synchronous main-thread attack CANNOT land between the call and the
`open()` syscall — the threadpool-blocker window never materializes (16×
sparse-file blockers never got to matter). The drift/escape branches of
`verifyOpenedHandle` therefore are NOT forceable from this level here; they
are the existing lane law (exercised by the read side’s C-FS suite), passed
through verbatim by this module. Disclosed rather than approximated.

## P5 — not exposed
`packages/runtime/controlled-fs/src/index.ts` NOT touched (leg asserts the
barrel carries neither `createPostConsumeWriteClosure` nor the plan type);
no tool argument surface, no service reachability; refusal codes verbatim
from the closed C-FS set — no lane-invented codes (repeat-claim/cancellation
use `effect-outside-grant` with the fact in the message; open-failure mapping
mirrors `safeOpen` verbatim: ELOOP→symlink-alias, EISDIR/ENOTDIR/ENOENT-
parent→not-a-directory, raced ENOENT→not-a-file, else path-rejected).

## Gates (verbatim rc in this dir)
vitest 13/13 RUNNER_EXIT=0 · tsc(tsconfig runtime)=0 · tsc(tsconfig.lane)=0 ·
eslint=0 · audit EXIT=0 (post-consume-write.ts appears in the OK consumer
list).
