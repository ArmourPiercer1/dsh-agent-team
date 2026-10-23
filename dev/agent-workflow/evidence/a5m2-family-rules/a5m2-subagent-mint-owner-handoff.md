# A5M2 B-SUBAGENT — mint-owner handoff (root 21:33: required pairing runs on the REAL new mint, not transcribed shapes)

Table entry: `PA_FAMILY_TARGET_RULES['B-SUBAGENT']` as landed at
feat/a5m2-family-rules `fbebc3c520fd9d1cf0b12adc03e906e10e118a5d` (under root
narrow review). Ownership: this lane owns the ENTRY only; the shared
validator and the closed kinds are signed and untouched. Each mint owner
changes ONLY their own mint (root 21:18).

## What your minted flat manifest must carry (leaf for leaf)

Shared required (all rows, non-empty strings): `operation` (the discriminant
— exactly one of your eight operations), `contract`, `revision`, `effect`,
`depth`, `argsCanonical`, `namedGapsCanonical`.

- SPAWN rows (subagent-spawn / subagent-fork-spawn / subagent-spawn-external-codex /
  subagent-spawn-external-claude-code / subagent-model-routes-read) add
  exactly: `action` (string — the per-row bind pins it EQUAL to `operation`;
  both lanes already mint `target.action === plan.operation`), `parent`
  (string), `childClaim` (NULL or string — never a sentinel),
  `childAdjudication` (string), `model` (string). Total 12 keys, extras deny.
- CONTROLS trio (subagent-interrupt / subagent-list / subagent-send-message)
  add exactly: `action` (bind: equal to `operation`), `caller` (string),
  `addressClaim` (NULL or string), `addressRelation` (string),
  `addressAdjudication` (string), `budget` (string), `effectDelta` (string —
  your real row-level EFFECT_LABELS value), `recordIndex`
  (nonNegativeInt). Total 15 keys, extras deny.

`argsCanonical` = your OWN `canonicalJson(plan.args)` (the sorted-key
JSON.stringify law already in the controls module :234-238 — same helper,
spawn side may copy the law); `namedGapsCanonical` = the same over your whole
`*_NAMED_GAPS` object. Complete reversible JSON — never a hash/digest; full
text, unknown legal args keys, null and '' must survive.

currentFields pairing: `['operation','action']` — your edge's current trusted
facts must be able to restate exactly these two.

## The REQUIRED pairing legs (root 21:20 "一次联合实际mint→同validator") — in YOUR spec

1. For EACH of your operations: run the REAL minted manifest from your
   seat/adapter through the SAME published
   `validatePaFamilyTarget('B-SUBAGENT', realManifest)` → `undefined`
   (5 legs spawn-side, 3 legs controls-side). Transcribed fixtures do NOT
   discharge this; the minted object does.
2. One REAL error leg per lane from your own pinned refusals class at the
   grammar edge (e.g. foreign `action` → the measured
   `action: not the '<op>' variant constant of the B-SUBAGENT typed plan`;
   a foreign key → `...: not part of the B-SUBAGENT typed plan`).
3. A no-silent-translation pin: your PRE-joint manifest (without the two
   canonical leaves) must still fail with
   `argsCanonical: required by the B-SUBAGENT typed plan, absent`.
4. Revision pairing: the entry pairs adapter rev 1 at the measured pins
   (spawn @8c314fb9… / controls @61663441…). A mint change is a VISIBLE
   revision bump in your own module per your existing conventions — never a
   silent translation of approved revisions.

## Known re-anchors at merge

- SPAWN lane: the earlier flat entry in your tree is superseded (10 keys →
  12, per-row action bind, `currentFields ['operation','contract']` →
  `['operation','action']`); your (c) `toStrictEqual` manifest leg gains the
  two canonical leaves; the root-21:01 `childClaim: nullableString` leg is
  UNCHANGED (same signed kind, same law).
- CONTROLS lane: your trio is UNWIRED at the pin — your card-delivered
  flatten (caller / address.claim→addressClaim / address.relation→
  addressRelation / address.adjudication→addressAdjudication / budget +
  plan recordIndex + effectDelta) names the leaves this entry types.
- Until BOTH mint deltas land, every joint claim stays fail-closed at the
  bridge (pinned absent-leaf bytes) — no lane may claim otherwise.
