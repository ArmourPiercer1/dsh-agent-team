# Rule 3 — the repaired legs BITE (one mutation live at a time)

`HEAD = 7f382ac7` · run `2026-10-08T05:01:11Z` (UTC `2026-10-08`) · script `.tmp-a474/bite-proofs-v3.sh`
Every class below: mutate ONE injected thing → run the file(s) → the legs go red **for the
named reason** → `git checkout --` → verify `git hash-object == git rev-parse HEAD:path`.
Final state: `git status --porcelain packages` = **0 lines**, all six blobs match `7f382ac7`.

A first attempt (`.tmp-a474/bite-proofs-v2.sh`, logs overwritten) forgot the restore between
classes and so *accumulated* its mutations; its C/D/E/F rows attributed the wrong cause and are
void. This table is from v3, where the script restores and blob-verifies after every class.

| class | what was broken (the thing the repair injected) | file(s) | legs red | the NAMED reason in the log |
| --- | --- | --- | --- | --- |
| **A** | the declared ceiling **zeroed**: `ceilingOverCells` returns `{ rules: [] }` | `a3p3-permission-mutation-authority`, `a3p4-permission-lifecycle-e2e` | 29 / 49 | `PermissionMutationError` ×12, `authority-ceiling-insufficient` ×6 — including `TIGHTENINGS need NO expansion authority`, the leg whose own seed grant is the first thing the closed gate ever touched |
| **A2** | the **port dropped** from a fixture-direct world (`authorityCeiling:` deleted) | `a3p4-permission-lifecycle-e2e` | 16 / 26 | `…wired no authority-ceiling reader to consult: an unread ceiling is never guessed and never treated as absent (zero write)` ×4 — the headline of `70266cc7` |
| **C** | the **mirrored carrier dropped** (`carrier:` removed from `declaredCeilingReader`) | `a3p3-revoke-reveal-semantics` | 6 / 33 | `authority-ceiling-insufficient` ×4, `the expansion authority ceiling reaches only no-authority` ×4 — the red legs are exactly `S1b`, `S3`, `S7b` (+ the two other Leader drives), i.e. the legs that vary the carrier |
| **B** | the **production reader line deleted** (`permissionAuthorityCeiling: createAuthorityCeilingReader({ facts })`) | `a3p4-pr7-entry-exec-contract-regression` | 11 / 17 | no-reader headline ×9 (driven through the real entry/wire, so the code surfaces as `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE` ×14 + `"problem":"authority-ceiling-port-absent"` ×5) |
| **D** | the fixture blueprint's **hard ceiling zeroed** (port PRESENT) | `a3p4-pr7-entry-exec-contract-regression` | 11 / 17 | `TEAM_RUNTIME_CALLER_NOT_FOUND` ×5 — see FINDINGS §9: a refused Leader rise in an approval-wired lane becomes a durable ASK, and the ask resolves the Leader caller through `admission/resolve`, which this fixture never seeded. The ceiling refusal is real; the ASK path is what answers first. |
| **E** | the **port dropped in both root-assembled worlds** | `a3p4-pr4-production-entry-regression` | 2 / 20 | no-reader headline ×2, thrown at `service.ts:1256` — and the red legs are exactly the two this file repaired (`E1 … assembled root`, `R5-tool …`), which is the same pair the coordinator reproduced independently on `c1eeca40` |
| **F** | the **subtree cells withdrawn** while legs still seed subtree rules | `a3p4-permission-lifecycle-e2e` | 3 / 26 | `authority-ceiling-insufficient` — on `a subtree grant answers for a DESCENDANT key`, `an UNJUDGED subtree rule keeps the frozen lane asymmetry`, `a MemberInstance created AFTER the grants has zero permissions`: the containment-conditional cells are load-bearing for exactly the subtree legs |

## Why this is the right break, per class

* **A/A2/C** are the three things the helper injects (a declared hard ceiling, the port itself,
  and the mirrored carrier) and each has its own failure signature: an insufficient ceiling, the
  port-absent headline, and an insufficient ceiling ON THE CARRIER PLANE. A single "wire
  everything" helper could hide which of the three mattered; these three rows say all three do.
* **B/D/E** are the production-shaped repairs, and they bite in the order production reads them:
  no port → the port-absent refusal (B, E); port present, ceiling empty → the ceiling refuses and
  the approval lane takes the answer (D).
* **F** is the one place where a cell is declared *conditionally* (only when the world has a
  containment predicate), and the withdrawal reddens precisely the subtree legs.

## Blob verification

`restored-by-blob` appears after every class in `summary.txt`; the blobs are the ones in
`repair-prebite-sha256.txt` / the `7f382ac7` tree:

```
helpers   f5514419537ca566cbc2ad6e46934c47cddd2abe
a3p3-auth e426638e8d6649230d168df432973155607dafd2
a3p3-rev  56b9e00ec16506ae764727f1a6de863892e4a5c6
a3p4-life a743fbe8d53ddc860048ebf292061359539ce70a
a3p4-pr7  b2010ca6afd4faf0f19f942546d2c1dc422d16f7
a3p4-pr4  594a08d192f89e8c6d7effb6bab5fd3485144748
```

## Classes G and H — not §7.5 law: the two instabilities the identity diff surfaced

Spending the bill means running the whole population, and a full run of 502 files in one pool
produced two identities that were red at this tip and green at base, neither of which had an
assertion or a product frame anywhere in its failure. Both are now fixed at the seam, both have a
deterministic proof, and neither touches an assertion.

| class | the thing broken | file | red / total | what it says |
| --- | --- | --- | --- | --- |
| **G** | the **§7.6 merge gate's held-aside build directory** (`dist` renamed to `dist.held-by-7-6-gate` mid-run, in another worker) meets a source walker that skips the literal name `dist` and nothing else | `a3p3-governance-lane-hygiene` | file-level death, `no tests` | `ENOENT … stat '…/packages/client/dist.held-by-7-6-gate/packages/client/src/plugin/ghost.d.ts'` — the walk descends into a tree whose files are being renamed out from under `statSync` |
| **H** | a durable-world leg left on the runner's **5000 ms default timeout** | `a3p5-glue-permission-receipt` | 1 / 11 in **3 of 3** full runs | `Error: STACK_TRACE_ERROR` with durations **5032 / 5012 / 5022 ms**: the leg was killed AT the ceiling and never measured past it. `@vitest/runner` substitutes that placeholder for a timeout inside `withTimeout`, which is why the red carried no message |

**G is reproducible on command** — which is the difference between a flake and a defect:

    mkdir -p packages/client/dist.held-by-7-6-gate/x && ln -s /nope packages/client/dist.held-by-7-6-gate/x/ghost.d.ts
    npx vitest run packages/runtime/test/a3p3-governance-lane-hygiene.test.ts

With that plant in place and the fix stashed: `G-held-build-dir.BEFORE.log` — `Test Files 1
failed`, `Tests no tests`, the ENOENT above. With the same plant and the fix applied:
`G-held-build-dir.AFTER.log` — **21 passed (21)**. Plant removed: `G-held-build-dir.UNPLANTED.log`
— **21 passed (21)**, i.e. the leaf law's verdict set is untouched; the walker just stops
pretending that a build output has only one possible name. Four walks in that file shared the
name-equality filter, so all five now share one `isHeldBuildOutput` predicate; the gate file is
**not** modified (it is on `master`, and holding a build output aside is exactly how it proves the
composition refuses).

**H's proof is the durations**, not a plant: the leg is the file's slowest in isolation at
**1659 ms** (`--reporter=json`), and it died at 5032 / 5012 / 5022 ms in three consecutive
population runs. The fix is that leg's own third argument, `20_000` — ~12x its isolated worst
case, so a genuine hang still fails. No other leg in 503 files carries an explicit timeout, and
this is the only one that needed it; the global `testTimeout` was deliberately NOT raised, because
that would hide every other knife edge in the corpus to fix one.

Both classes are disclosed as **corpus defects, not §7.5 consequences**: G's two participants are
both on `master` and had simply never been scheduled to overlap before this lane made the merge
gate green enough to run its hold experiment inside a full run; H's leg is slow because it boots a
durable world. What is NOT disclosed as innocent is the coincidence that both appeared only in
runs of THIS branch — the honest statement is that a race needs two participants and a full run of
502 files is what scheduled them, that both had a deterministic mechanism, and that both are gone
in run #4 (`bill-check.txt`).
