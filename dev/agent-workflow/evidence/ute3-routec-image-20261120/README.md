# UTE-3 route-C `read_image` repair — evidence

**Task**: UTE-3 (FS retirement unit) — make the PRODUCT route-C composition serve
the fourth FS member honestly, or prove why it cannot.
**Branch**: `task/ute3-routec-image-20261120` · **worktree**:
`.worktrees/ute3-routec-image-20261120` · **base**: `origin/master 38be84c32`.

## The defect, as measured (pre-fix)

`packages/runtime/team-services/src/mount.ts` merged only the services the ROUTER
owns (`tools`, `systemPrompt`) into the inject map of a routed module's deferred
`ctx.inject(...)` children. The pinned host module
`@deepseek-ai/dsh-tool-fs` registers `read`/`write`/`edit` directly but registers
`read_image` from `ctx.inject(['attachments'], …)`; the module itself declares
`inject = ['tools','fs','systemPrompt']` and that deferred body dereferences
`ctx.fs` (`tool-fs/src/read-image.ts`). Cordis therefore refused the child with
`cannot get property "fs" without inject` **before any provider call**: zero
reads, zero attachment bytes — a composition fault, not a lane refusal.

`tests/ute-g1-fs`'s `FS-I0-route-c-gap` pinned that product fact and the other six
image vectors had to run under a disclosed `post-gap-1` composition.

## The repair

`mount.ts` now continues a module's OWN declared service into its deferred
children (`continuedServiceNamesOf` → `mergeRoutedInject(names, continued)`),
narrowed to `fs` and only when the module's `inject` already names it. Only the
NAME enters the child's declaration; Cordis resolves the OBJECT on the child's own
scope chain (the realm's `root.isolate('fs', …)` scope where `install.ts` mounted
the confined provider). A module that does not declare `fs` gets a byte-identical
inject map — `scope-of-widening.txt` lists every routed module and the unit
assertions pin the shape.

## What the evidence shows

| file | what it is |
|---|---|
| `red-before-fix.txt` | the new product-route suite + the world-factory contract suite on the PRE-FIX tree (repair stashed): 4 product-route arms and FSB-IMG-1/2/3 fail; the failure text is the exact inject fault |
| `green-after-fix.txt` | the same two suites on this tree: product-route 7/7, world-factory 21/21 (including FSB-IMG-1b, the withheld-continuation fixture) |
| `gates.txt` | every gate of this task, verbatim, in order |
| `scope-of-widening.txt` | every module mounted through the routed seam, its `inject`, whether it declares `fs` and whether it has deferred children |

The product-route suite asserts, on the REAL route-C row with the REAL pinned
module and the REAL confined provider:

* in-lane allow → `isError:false`, **exactly one** attachment whose bytes are
  digested at the store's `saveImage` seam (70 B PNG), one `stat` + one
  `readBytes` on the confined provider, guard facts `stat/allow` →
  `readBytes/allow` with `realm=member`, `memberIdentity` of this Member;
* out-of-lane deny → the LANE's refusal, the outside file byte-identical, **zero**
  provider reads and **zero** attachment bytes, one `stat/deny` fact;
* text-only route → the tool's own modality refusal before any read (one route
  resolution, zero provider calls, zero bytes);
* aborted-before-dispatch → the registry refusal, nothing materialised;
* **MUTATION `unconfined-fs`**: the SAME module on a scope whose `fs` is the
  inherited BASE provider turns the SAME out-of-lane call into an allow that
  commits 70 bytes with ZERO guard facts — i.e. if the repair had continued a
  root/unconfined service into the child, the confinement arm would be RED;
* **confined-child probe**: a deferred child of an `fs`-declaring module resolves
  `ctx.fs` (no inject fault), serves an in-lane `stat`, and is refused out-of-lane
  with the lane's own sentence and `realm=member` guard facts. Object identity is
  deliberately NOT asserted: Cordis hands out a fresh context-bound proxy per
  access (measured), so the proof is behavioural.

The withheld-continuation fixture (`tests/world-factory` FSB-IMG-1b) keeps the
historical failure shape pinned as FAIL-CLOSED: typed refusal, zero reads, zero
bytes, no fallback to a root/base `fs`.

## Honest limits

* This is a REACHABILITY repair: it changes what the product route serves for one
  tool. It does not change any Member's authority, does not move the FS member
  set, and is not a switch to the native path.
* The new path (prototype provider) still has no image support: every `FS-I*`
  vector stays `newPathPending`, so the retirement gate still refuses
  `UTE_VECTOR_UNREPRODUCED` and `unit` stays 3/4 on the new path.
* The two `blocking=yes` semantic differences still have no owner approval.
* `dev/agent-workflow/evidence/a5sf-fs-face/README.md` and the owner files listed
  in the PR body still describe PD-5 / GAP-FS-CONTRACT-1 as OPEN; that is an owner
  follow-up, not silently edited here.

## Reproduce

```bash
node --test --test-force-exit --test-timeout=480000 --test-reporter=spec \
  tests/ute-g1-fs/product-route-image.test.mjs
node --test --test-force-exit --test-timeout=900000 --test-reporter=spec \
  tests/world-factory/a5sf-fs-contract.test.mjs
node tests/ute-g1-fs/capture-old-path.mjs --write   # twice -> compare=identical
node scripts/ute-retirement-gate.mjs --all          # exit 1 (expected: new path + unapproved diffs)
```

## Post-merge integration fix (origin/master `c74e02a87`, PR #800 B+C refusal protocol)

Merging master brought `tests/ute-g1-fs/lib/refusal-categories.test.mjs`, which
asserted that the merged golden TSV yields **seven** refusal classes including
`route-unresolved`. This branch's repair deleted `FS-I0-route-c-gap`, so the TSV
yields six, and the class survives only as the withheld-continuation fixture's
output. Three arms were red on the merged tree (reproduced locally in
`refusal-categories-integration.txt`).

The fix keeps both claims measured:

* the corpus derivation now names exactly `cancelled, image-modality-denied,
  lane-deny, missing-path, stale-version, write-requires-read` (six), and the
  synthetic extra-class arm still refuses an invented class by name;
* `route-unresolved` is declared in `FIXTURE_CLASS_EVIDENCE` and its reachability
  is MEASURED: the new arm drives `FSB-IMG-1b` (`withheld-fs-continuation`),
  classifies the observed refusal with the same `classifyRefusal` the golden
  capture uses, and asserts the class; `assertClassVocabularyCovered` fails by
  name (`REFUSAL_CLASS_UNPRODUCED`) if a declared class loses every producer, and
  `REFUSAL_FIXTURE_STALE` if a fixture declaration outlives its necessity;
* a sixth mutant (`drop-route-unresolved-fixture-evidence`) keeps the fixture
  producer load-bearing: `REFUSAL-CATEGORY-MUTANTS total=6 red=6`.

The suite is therefore host-requiring now (one arm mounts the world factory);
it already rode the post-build UTE FS leg, and the manifest/workflow text says so.
