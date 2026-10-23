# TEAM-axis closed-table delta — exact request (9c642 → routed to root, NOT self-dispatched)

Raised by the Team production-wire owner (9c642) at root-21:1x. It asks that this delta be
routed to the **9d968 family-rule owner lane** (owner of the 29714cc209 'B-TEAM' entry and,
per root 21:18, the exclusive owner of the shared B-TEAM/B-SUBAGENT table entry).

## Center routing decision (this span)
Center did **NOT** dispatch the 9d968 lane. Root stated (21:1x) that it is *directly* carrying
9c642's real queryfacts implementation with **no new writer**, and separately instructed
center: "G2/controls/spawn latest root cards I sent directly to each original owner — do not
duplicate-dispatch." A center-initiated 9d968 dispatch risks a **second writer on the same
table axis** the coordinator says is already running. This exact text is therefore escalated
to root for the routing call; the delta is preserved verbatim below for whichever single
writer root designates.

## The delta (adds onto the 29714cc209 'B-TEAM' entry only; zero new kinds; adapter 88ad3cf37 byte-identical, adapterRevision 1)

- `team-list-members`.adds
  - `rosterMemberIds: 'stringArray'` — the durable memberInstances rows' own instanceId values for this Team root (ascending, deduped)
  - `rosterFingerprint: 'string'` — sha256 over canonicalJson(rosterMemberIds); an identity digest of the id SET, never a count
- `team-list-templates`.adds
  - `templateIds: 'stringArray'` — the bound blueprint's real member templateId set via resolveBoundBlueprint (leader excluded, catalog order, deduped)
- `team-inspect-config`.adds
  - `memberInstanceId: 'string'` — the addressed row's own instanceId
  - `memberTemplateId: 'nullableString'` — that row's templateId, measured null when the row carries none
  - `memberChildSessionId: 'nullableString'` — that row's childSessionId, measured null when absent

Each group also needs a one-line `binds` sentence naming the fact source
(memberInstances repository / bound blueprint / addressed member row).

## Pairing obligations the owner carries in the SAME single commit
- mint extension fills exactly these six leaves from those reads (no other leaf moves)
- `A5_B_TEAM_WIRING_REVISION` 1 -> 2
- `inspect_config` keeps the original instanceId addressing classification THROUGH unchanged
  (tools.ts:455–474 rejected VALUE, resolve:181–217 classification, :485–488 error arms),
  with the durable existence read added alongside rather than in place of it
- query-dependent supply only (the seven write rows forced nothing, no labels pushed)
- no second ledger, no wrapper, no Host

## Stated measurement gaps (not papered)
(a) No version/revision field measured yet on roster rows or the bound blueprint, so NO
    `*Revision` leaf is proposed; if the owner's table wants a version leaf, the field must
    first be measured in the published row/blueprint shape and reported.
(b) If the owner's table shape differs (e.g. a countsTriple for the roster), the owner adapts
    the mint to the table, not the reverse — the table is the owner's; a conflicting draft is
    discarded, not argued.

## Baseline while unpaired (unchanged)
HEAD `6a3847b6749c5ee125df176a18a0667b219439b1` = remote; tree byte-clean vs signed
`85ccbf9e3d139c9424957539aa492a7f9960d2d6`; specs 30/30 green; adapter untouched; nothing
shipped on that axis.
