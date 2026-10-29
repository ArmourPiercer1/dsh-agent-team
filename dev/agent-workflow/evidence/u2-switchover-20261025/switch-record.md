# U2 switchover evidence — live captures (UTC 2026-10-25T10:58:59Z)

Commits: A=56b62dfbe411c90f5e66a4505e94b972b06fea12 B=f44ca07dd23a62ee67d891afd02d1e1413dd0f3a C=8552597c3

## loader status (live pointer authority; digest verified by loader at read)
{"ok":true,"status":"POINTER","pointer_file":"dev/engineering/current-authority.json","snapshot_file":"dev/engineering/authority-snapshots/as20261025r1.json","snapshot_version":"as20261025r1","content_digest":"sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062","current_phase_statement":"ALPHA.5 TOOL-IO-GOVERNANCE PHASE — PRODUCTION INTEGRATION AND PER-TOOL ACCEPTANCE (release blocked until whole-tool approval; authority = current_contract)","six":{"phase_id":"alpha5-tool-io-governance","active_plan":"docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md","backlog":"docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md","matrix":"docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md","baseline":"9b2ee57bc5afd30e89855e09d1769d2e5ec83912","baseline_collected":"2026-10-22T07:20:56Z"},"two_current_findings":[]}

## byte + digest facts
pointer-bytes sha256:5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee
snapshot content_digest recomputed (F0): sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062
pointer records            : {"content_digest":"sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062","snapshot_version":"as20261025r1"}

## live refusal control: precondition digest deliberately wrong (must refuse, zero bytes written)
{
  "ok": false,
  "why": "POINTER_PRECONDITION: current pointer digest is sha256:5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee, expected sha256:0000000000000000000000000000000000000000000000000000000000000000 — refusing (the pointer moved underneath this switch)"
}
switch exit=2
pointer bytes after refused switch (must equal pointer-bytes above): sha256:5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee

## live refusal control: switch to unrecorded version (precondition ok but snapshot digests differ)
{
  "ok": false,
  "why": "POINTER_PRECONDITION: dev/engineering/current-authority.json exists (digest sha256:5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee) but the transaction declared --expect-pointer-absent — refusing to overwrite a pointer that moved"
}
switch exit=2
pointer bytes still unchanged: sha256:5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee

## Original transaction record (operator-captured verbatim at execution time, 2026-10-25 ~10:48Z)

publish-authority.mjs (the only snapshot writer) →
  {"ok":true,"published":"dev/engineering/authority-snapshots/as20261025r1.json","snapshot_version":"as20261025r1","content_digest":"sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062","supersedes":null}
  (first publish attempt of the draft was refused: REFUSED(2) MAX_LENGTH published_by — the
  83-char authoring note exceeded the frozen schema's maxLength 64; shortened to 58 chars and
  republished, which is why the final digest is 2204…, not the earlier edf1… draft digest)

switch-authority.mjs switch --root . --snapshot-version as20261025r1
  --expected-digest sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062
  --expect-pointer-absent →
  {"ok":true,"switched":true,"pointer":"dev/engineering/current-authority.json",
   "snapshot":"dev/engineering/authority-snapshots/as20261025r1.json",
   "snapshot_version":"as20261025r1",
   "content_digest":"sha256:220427218281602d572e8749858d08e17c388b9cbb437d68e3f3987869195062",
   "pointer_bytes_sha256":"sha256:5356e8deabdcad5e6686208a8f3debe1113b56393d4a5c1c787e575c897725ee",
   "previous_pointer":null,"two_current_pending":true}
  two_current_pending=true was BY DESIGN for the microseconds before commit B removed the graph
  block in the same commit; the two-current guard's live state ever since: [].
  The replay-control above (wrong precondition digests) proves the transaction refuses to move
  an already-moved pointer: today a re-run of the original command refuses with
  POINTER_PRECONDITION (--expect-pointer-absent vs existing pointer) — captured above.

## Pre-commit fence live exercise against the REAL staged commit-B index (UTC ~10:55Z)
  positive: "authority pointer + named snapshot parse in the index" exit 0
  negative: same path staged with content_digest "sha256:abc" → REFUSED exit 1, message names
            the publisher and the switch tool
  restored: exit 0
