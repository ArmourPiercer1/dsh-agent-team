# Post-cutover `INTENTIONAL_RETIRED` list — flip-window checklist

**Status: OPEN, coordinator-owned. This file is the flip PR's work list, not a record of
intent.** It is deliberately a separate artifact from `DEFERRALS`
(`packages/testkit/test/a4p7-blueprint-version-clean.test.ts`): a `DEFERRALS` row says
*"this path is dirty and someone owes it work"*; a row here says *"this site must still
carry a retired version literal after §7.3 retires that version, for a named reason, and
here is the step that proves the reason still holds at the flip."* A site may be in both
while §7.4 is open; **it may not be in neither**, because "in neither" is how a permanently
dirty path becomes an unexplained red gate — the condition this phase has repeatedly
produced muting.

## Admission criteria (all four, or the row does not belong here)

1. The literal **cannot** be migrated to the supported version without deleting what the
   file proves (a historical byte claim, an acceptance/rejection axis, a frozen identity).
2. The reason is a **lawful disposition under the flip**, stated in one of the §7.4
   dispositions — `invert-to-refusal` (post-§7.3 only), `delete-lie`, or *legitimate
   non-Blueprint version axis pending adjudication*.
3. A **verification step is written that can be executed at the flip**, not remembered.
4. The owning PR and the owning file's spec clause are named.

`DEFERRALS` staleness is the ratchet that keeps this honest: while a row lives here, its
path stays dirty and its `DEFERRALS` entry must remain, otherwise the wrapper's
*"every deferred path is still dirty"* goes red and somebody is forced to read something.

## Row schema

```
path            repo-relative, as the fence prints it
line(s)         the literal's line(s) at time of writing; re-verify at the flip
spec clause     what the file proves at that line, in the file's own terms
why-not-migrate the law that makes migration destructive
disposition     one of the three above, in words
flip-verification  the executable step proving the reason still holds
owner           PR/lane that owes the flip-window change
```

## Rows (2026-10-08)

### 1. `tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs` — historical V1 anchor

- **line(s):** the `V1_ANCHOR_SOURCE` document literal and its hand-copied
  `V1_ANCHOR_HASH_PRE_PR_E` (both byte-identical as of lane `C-testkit`'s recon).
- **spec clause:** the kit's claim *is* the pre-PR-E bytes: `parseBlueprint(V1_ANCHOR_SOURCE)`
  must derive exactly `sha256:6a7fba9f…`. The lane derived it with the tree's own pipeline;
  coherence verified today.
- **why-not-migrate:** rewriting the anchor to v3 keeps the syntax and destroys the claim —
  there would be nothing left to have been stable across PR-E.
- **disposition:** `invert-to-refusal` at the §7.3 flip. After retirement, the kit's
  surviving claim is that this historical source is **refused**, which is the one time that
  disposition is lawful.
- **flip-verification:** run the derivation before and after the flip; pre-flip it must
  still equal the pinned hash, post-flip the parser must refuse and the kit must assert the
  refusal rather than the bytes.
- **owner:** §7.3 flip PR (coordinator), filed by `C-testkit`.

### 2. `tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs` — historical V1 anchor

Same shape, same derivation, same disposition, same verification. Filed by `C-testkit`.

### 3. `packages/legacy/test/p7t6-teammates-adapter.test.ts` — not a Blueprint document

- **line(s):** the adapter fixtures carrying the legacy `.md` teammate-file version axis
  (one of them, `L380`, is a **negative** test of that axis).
- **spec clause:** which legacy `.md` versions the adapter accepts and rejects.
- **why-not-migrate:** it is a **different namespace's version axis**. Migrating it would
  not retire a Blueprint version; it would delete the adapter's acceptance proof. §7.3 owns
  the legacy emitter, §7.4 does not own it at all.
- **disposition:** *legitimate non-Blueprint version axis* — the fence's key-half rule keys
  on `schemaVersion` text plus a `blueprintId` half, so another namespace's document reads
  as a Blueprint document. It lands in the adjudication ledger's **dirty-class row kind**
  (ruled 2026-10-08 → see log round 10/11: a permanently-dirty non-document would otherwise
  make §7.4's closure unreachable, which is the mute-producing condition).
- **flip-verification:** the ledger row must cite this file's full path and a real line
  range containing each site, per the G3 rule; and an independent reader must confirm no
  site here is a `TeamBlueprint` document.
- **owner:** fence owner (ledger row) + §7.3 (emitter). Stopped correctly by `C-testkit`
  rather than migrated.

## Closure condition for this file

The §7.3 flip PR may not close with an unhandled row here, and this file may not be
deleted by weakening a criterion. **Empty means every row above has had its
`flip-verification` executed and its outcome recorded — not re-planned.**

## Flip-round verification (the §7.3 flip PR — every row's `flip-verification` EXECUTED)

The rows above were written before the narrowing existed; each carries a
`flip-verification` that had to be run, not restated. Executed 2026-10-08 on the
landing tree (`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`):

| Row | Check executed | Outcome |
| --- | --- | --- |
| 1 — `tests/kits/pr-e-requirement-recovery-smoke` | does the narrowing change this kit's V1 anchor? the kit builds a **frozen historical document** as its own fixture, and the kit's assertions are about its own byte anchor | **UNCHANGED.** Still dirty-class in the fence (1 site), still outside `packages/**`. The kit does not call `parseBlueprint`; it compares recorded bytes. Row stands. |
| 2 — `tests/kits/pr-f-closure-smoke` | same question | **UNCHANGED.** Same disposition, same single site. Row stands. |
| 3 — `packages/legacy/test/p7t6-teammates-adapter.test.ts` | after §7.3 item (2) (the adapter now emits a v3 draft), does this file still carry version literals — i.e. does its `DEFERRALS` row still describe reality? | **STILL DIRTY, 9 sites, row stands** (`L119, 258, 285, 390, 408, 426, 468, 470, 472` re-measured, all still present). The literals are the **legacy `.md` teammate-file format's own** version axis, not a `TeamBlueprint` document, so the adapter change does not touch them. Independent confirmation the requirement asks for: no site in the file is a Blueprint document (the only `schemaVersion` inside a document-shaped object is the legacy fixture's own header). Because it stays dirty, the wrapper keeps its row AND the archetype leg now points at this file's line set by equality. |

## The residual this leaves, priced out loud (the `.mjs` scan class)

§7.3 removed the only real `.mjs` emitter the fence had ever classified
(`packages/runtime/test/t12a-live-bridge.mjs`, whose row was therefore deleted
from `DEFERRALS` — the deletion is checked: re-adding it reddens
`every deferred path is still dirty (a migrated path must leave the list)` by
name). What replaces it is a **synthetic** leg: `isScanScopePath` on a
non-existent `packages/runtime/test/witness-version-carrier.mjs` plus
`classifyText` on bytes that file would carry.

The gap is precise and should not be read as "the `.mjs` class is covered":

- The synthetic leg proves the **class** (scope + verdict + line number) with no
  file on disk. It cannot prove that a **real** `.mjs` under `packages/*/test`
  that is *not* a default artifact gets scanned, because no such file exists to
  check, and the synthetic path is by construction not a default artifact.
- Priced: if a future `.mjs` fixture carries a document stamp in a shape the
  fence does not read, the fence stays silent and the leg stays green. The
  backstop is not the fence — it is `parseBlueprint` refusing the document at
  runtime with `SCHEMA_VERSION_MISMATCH`, which is the direction that fails
  safe (an unread file cannot smuggle an *accepted* v1/v2 document, only a
  refused one).
- The measurement that found this: `classifyText` returns **all-empty** for any
  text that lacks a document-shaped key pair. A `.mjs` carrying
  `schemaVersion: 1` alone — with no `blueprintId` in the same text — is
  classified as nothing at all, in `.mjs` **and** in `.ts`. That is the fence's
  `BLUEPRINT_KEY` both-halves guard, and the synthetic leg now carries
  `blueprintId` explicitly so the leg tests the classifier rather than the
  guard.
