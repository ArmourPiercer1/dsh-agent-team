# DRAFT — EDIT/SRE execute-body PA-handoff redemption legs (G3 body block, per CENTER's single-writer split)

**Status: ARCHIVED — REVIEW-ONLY.** Per CENTER (root anti-duplication
ruling) the main personally landed the plane-body redemption in the int
tree; this draft was used as the comparison-review material and the int
version passed every point (verified read-only in the int tree's
`packages/runtime/src/plugin/live/team-tool-plane.mjs`):
synchronous single take (edit :4344-4352, sre :4813-4820); ORIGINAL
correlation via `priorFlight.correlation` both rows; `PA_HANDOFF_LOST`
fails closed ("nothing is asked again and no byte is written", no
fallback); typed `exec-token-replay` otherwise; `PA_HANDOFF_MISMATCH`
pair assertions (:4416/:4878, symmetric with write :3902/image :5184);
teardown `editHandoffCloseAll`/`sreHandoffCloseAll` (:4121/:4598); export
faces `paEditHandoff`/`paSreHandoff` (:7194/:7201 conditional-mount
mirror); `handedOff: true` pre-marked in the open path (:4294). NO
OBJECTIONS. Nothing from this draft is applied by the lane. Applies to
`packages/runtime/src/plugin/live/team-tool-plane.mjs` IN THE LANE TREE ONLY,
and ONLY after the main's int-tree side lands the pre-dispatch open ports
(`editHandoffOpen`/`sreHandoffOpen` mirroring `writeHandoffOpen`, the two
export faces, and the flight records `editPaHandoffs`/`srePaHandoffs` +
`handedOff===true` marking) — the redemption legs below REFERENCE those
symbols by exactly the names the main card gave; no parallel shape is
invented here.

Reference mirrored VERBATIM: the audited WRITE redemption in this file
(:3462-3492 at lane HEAD) — token shape law, synchronous single take,
ORIGINAL-correlation law, PA_HANDOFF_LOST with no-Part-A-retry wording,
typed replay refusal otherwise.

## Block 1 — edit row `execute` (replace the current two-branch identity walk)

Current (lane HEAD ~:3756-3766): token-typed refuse → `priorFlight !==
undefined` ⇒ typed replay whose text DISCLOSES "The edit row carries NO
pre-dispatch hand-off lane (disclosed M-02 scope)" → new corr. The
disclosure text retires with this hand-off; the replacement is the write
law, three branches:

```js
      const priorFlight = governedTokenLedger.get(tokenKey)
      // A5-M2 EDIT HAND-OFF redemption (the write row's take law, verbatim):
      // the ONE in-flight HANDED-OFF flight on this token IS this body's
      // redemption — the ledger's single-flight law holds, because the flight
      // was opened FOR this exact execution at pre-dispatch. The take is
      // SYNCHRONOUS and SINGLE: a re-entrant second redemption finds no flight
      // and fails closed there (Part A is never re-run, no fallback lane serves
      // this edit). Any other prior stays the typed replay refusal.
      let editClaim
      let correlation
      if (priorFlight !== undefined && !priorFlight.settled && priorFlight.handedOff === true) {
        editClaim = editPaHandoffs.get(tokenKey)
        editPaHandoffs.delete(tokenKey)
        if (editClaim === undefined) {
          throw new Error('refused-edit PA_HANDOFF_LOST — the pre-dispatch PA hand-off of this execution is gone (closed, torn down, or already spent); Part A is never re-run and no fallback lane serves this edit')
        }
        // ONE correlation per token for its whole life: the redemption runs
        // under the ORIGINAL id Part A asked with, never a fresh one.
        correlation = priorFlight.correlation
      } else if (priorFlight !== undefined) {
        throw new Error(`refused-edit exec-token-replay — this execution token already ${priorFlight.settled ? 'owns a settled' : 'owns an in-flight'} governed plane call (the shared token ledger: one token runs one governed flight; a settled token is never re-armed)`)
      } else {
        editCorrSeq += 1
        correlation = `plane-edit:${realmId}-${String(editCorrSeq)}`
        governedTokenLedger.set(tokenKey, { correlation, settled: false })
      }
```

(The downstream ensure-current → classify(raw, exec, correlation) order is
UNCHANGED — grant-pairing assertions live at the write :3849+ ensure-current→
classify→edge sequence the main card named. `editClaim` participates exactly
as `writeClaim` does downstream; whatever the write row does with the claim
after take, the edit row copies — no extra use, no drop.)

## Block 2 — sre row `execute` (same three branches, s/edit/sre/g)

Names per card: ledger symbol `srePaHandoffs`, claim `sreClaim`, correlation
family `plane-sre:${realmId}-<seq>` (`sreCorrSeq` already exists), refusal
verb `refused-sre`. Mount names are the ports' OWN-name answers ONLY
(`A5_EDIT_MOUNT_NAME='edit'` :152, `A5_SRE_MOUNT_NAME='str_replace_editor'`
:155) — real ownership stays registry-token identity, never a string
comparison; no bare-name exemption anywhere.

## Checklist baked in (root prohibitions)

- no re-open of Part A, no fresh correlation for a handed-off token;
- no bare-name exemption; no native fallback; NO second ledger (token
  account is the mount-area shared `governedTokenLedger` ONLY);
- unconsumed grants are never exempted (PA_HANDOFF_LOST fails closed);
- nothing auto-approves a second Ask;
- cancel/result/dispose clean-up rides the main's onTerminal
  (`tools/result` single funnel) — this body adds none.
