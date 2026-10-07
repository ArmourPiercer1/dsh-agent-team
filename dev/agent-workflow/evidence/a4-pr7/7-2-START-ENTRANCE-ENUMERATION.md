# A4-PR7 Task 7.2 — start-entrance enumeration, gate placements, and measured shapes

Commit: this file ships with the 7.2 commit on `feat/a4-pr7-v3-cutover`.
Test lane: `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts` GROUP D (54 tests in
the file; 31 of them added here). Production: `blueprint-authority.ts`, `root.ts`,
`bound-blueprint.ts`, `host.ts`.

## 1. The enumeration (closed, and how to re-derive it)

The plan requires enumerating every entrance that can bring a Team's agents to life, not
accepting a list. Re-derive it with:

```
grep -rn "ensureLiveAgent("        packages/runtime/src --include=*.ts   # -> 1 call site
grep -rn "live\.boot()"            packages/runtime/src --include=*.ts   # -> 1 call site
grep -rn "startRootAgent\b"        packages/runtime/src/plugin/root.ts   # -> the create ports
grep -rn "createAndStartTeam("     packages/runtime/src/plugin/root.ts   # -> 2 call sites
```

| mechanism | entrance(s) | gate | pinned by |
| --- | --- | --- | --- |
| `live.boot()` (root.ts, one site, inside `boot()`) | `boot.create` | G1 (create-and-start, after the chokepoint commit, before the live layer) | D2, D-"CREATE mint" |
| " | `boot.resume` | G2 (after the row/binding/leader reads, BEFORE the resume phase's first durable write) | D6 |
| `ports.start` / `startRootAgent` port | `team.create`, `handoff.create` | G3 (`gatedCreateRootAgent`, on the port, not only on the wire) | D5, D-handoff |
| " | (create-and-start's with-context mode) | G1 + G3 | D-handoff |
| `live.ensureLiveAgent()` (the one site) | `team.ensureRootLive` | G4 (on the port) | D5 |

Member/child agent ensures are downstream: `live.ensureLiveAgent` has exactly one call
site in `src`, and the live layer's one-shot create phase runs inside `live.boot()`. There
is no fifth mechanism.

## 2. The law the gate encodes

- **The resolution is the check.** The gate asks the bound document the one question it
  can answer ("will this build run me?") through the same resolver every other consumer
  uses (`resolveSnapshot` for a bound ref, the classified anchor for a no-ref legacy row).
  A second copy of the version logic here would be a second answer, and the two drift.
- **Which document is the whole law.** A mint entrance binds the anchor's identity, so the
  anchor is its bound document; a resumed Team is bound to whatever its ROW says and the
  anchor is irrelevant. A host whose anchor is retired still resumes a Team whose bound
  revision this build runs; a host with a v3 anchor still refuses the Team whose row still
  points at v1. That is why the gate takes a session id and why the resume path could not
  read `boundSnapshot`.
- **Version leg before governance leg, at every entrance.** The governance leg reads a v3
  Team's authority documents; on a document this build will not run they do not exist, so
  the leg would report a document fault as a governance fault and hand the operator an
  acknowledgement to sign for a migration. Pinned: for every refused mint the governance
  double records ZERO consultations for the minted root, while the open control records a
  consultation for the same kind of mint.
- **Not acknowledgeable.** No acknowledgement path exists for the version refusal in either
  direction of the confusion. Pinned: the refusal code is outside the
  `TEAM_START_GOVERNANCE_*` family and the governance service is never consulted.
- **Nothing is written before the refusal.** `boundBlueprintFor` caches only on success;
  D6 measures the seam write log across the resume `boot()` at zero, with a positive
  control proving the same counter sees a real refused `team.create`'s commit.

## 3. Measured shapes that differ from the plan's shorthand (disclosed, not smoothed)

1. **A port-level version refusal is not wire-representable today.** `team.ensureRootLive`
   / `team.create` on a refused bound document answer
   `{"code":"internal-error", … "reason":"untyped-error"}`: the S6 dispatcher maps anything
   outside its frozen per-method code set to `internal-error`, and PR7's
   `BLUEPRINT_MIGRATION_REQUIRED` is deliberately not in that set (adding a wire code is a
   contract change; `s6-remote.ts` is outside Task 7's file list). The NAMED wire arm for
   this condition already exists and is PR6's closed fourth governance arm: with the
   governance leg answering `migration-required`, the same entrance answers
   `TEAM_REMOTE_TEAM_START_MIGRATION_REQUIRED` with the headline "…start is refused until
   the Team is migrated (acknowledgement never clears this)". That leg is reached when the
   v1/v2 bridge flips at `packages/runtime/src/plugin/host.ts` (`createGovernanceWarningService`
   `bridge` dep) in Task 7.3. **The gate's value at a flattened entrance is the part the
   envelope cannot express: zero agent effect whatever the wire says.**
2. **The two MINT entrances fail closed through the binder, not through the gate.** On
   `boot.create` and `handoff.create` the fresh-root bind resolves the bound document inside
   the binder overlay (the `persona` substrate effect), which throws first: the observable
   names are `BINDER_OVERLAY_FAILED` / `HANDOFF_TEAM_CREATION_FAILED` with the document
   refusal as the readable wrapped cause. A per-session resolver cannot be consulted before
   the row exists (`bound-blueprint.ts` case 1 throws for a root without a row), so no
   earlier typed name is available on these entrances without changing `root-binding/*`
   (outside Task 7). The effects are the required ones — zero Root Agent starts, zero
   governance consultations, durable chokepoint commit, re-drivable — and both are pinned.
   The handoff envelope is `ok:true` with the operation in `creation-failed`; that is this
   API's shape for a refused creation, and the test asserts the operation state, not the
   envelope.
3. **The create-entrance gate (G1) is defence in depth, not covered by an attributing
   test.** Mutation G (delete the `requireBoundBlueprintStartable` call inside
   `createAndStartTeam`) leaves the lane green because the binder pre-empts it on every mint
   reachable from these worlds. It stays: it is the position PR6's review established for
   the version leg's ordering against the governance leg in the same function, and it is the
   line in a configuration where the overlay does not resolve the blueprint.
4. **The `freezeSnapshot` version gate is dark at this commit.** Only a frozen
   `migration-required` identity can trigger it, and the retired set is derived: while the
   bridge holds `[1,2,3]` nothing is retired. It lands with 7.3 like the other dark arms.

## 4. Mutation proofs (bite check)

Harness: `.scratch/mutate72.py` (writes the mutation, runs the lane, restores the file
byte-exactly in a `finally` and verifies the bytes; **never** `git checkout` — see §5).

| mutation | result |
| --- | --- |
| A — `requireBoundBlueprintStartable` becomes a no-op | 4 red (resume entrance, ensure-port ordering, wire envelope) |
| B — classifier's version arm disabled | lane cannot load (the degraded worlds die at construction) |
| C — `team.ensureRootLive` gate call removed | exactly the 2 ensure-entrance tests red |
| D — anchor value parsed eagerly (`requireAnchor()`) | lane cannot load — this is the A1-20(c) failure the group pins |
| E — `bound-blueprint.ts` case 2 back to the raw domain parse | the 2 case-2 tests red |
| F — authority's degraded anchor arm bypassed | lane cannot load (D9) |
| G — create-entrance gate call removed | green — **survives**, disclosed in §3.3 |

## 5. Incident, recorded because the rule exists

During mutation A the restore was done with `git checkout -- packages/runtime/src/plugin/root.ts`
while 7.2's work on that file was still uncommitted. That destroyed the uncommitted 7.2
edits to `root.ts`; they were re-applied from this session's edit history and re-verified
(`tsc` clean, 54/54 green). The lane law is explicit: **restore a mutation from the string
you read before mutating, never from git.** The harness in §4 does exactly that and prints
the byte-comparison after every case.
