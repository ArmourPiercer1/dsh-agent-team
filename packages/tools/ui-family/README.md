# `packages/tools/ui-family` — the UI Family lane (u7-f)

Owner-facing lane for the governed `ask_user_question` / `present` rows.
Read `src/index.mjs` first — it is the module-role map. This README states
the OWNER ROLE and the lane law.

## Provenance

NEW lane (u7-f): nothing moved out of the center — the center never held
these rows. The rows are plugin-side MIRRORS of the pinned host tools
(tool-ask-user index.ts / timed.ts and tool-present index.ts @639ed01539):
descriptions, parameter fields and renders are the host's; the governed
additions (closed-world parameter schema, the anchor/probe law on
`present`, the injected-port shape) are disclosed on the PR body and in the
row headers. The family mounts through the reviewed descriptor
`packages/tools/families/ui.mjs` (family manifest + generated index; the
seam re-hashes it at mount).

## Owner role (§4 six boundaries)

The Family owns the Definition, the argument contract, the effect BODY and
the result SHAPE. It owns NO authority (admission / grant mint / grant
consume are the Kernel's; the contribution states `kernel` on all three)
and NO UI face: every human interaction lands only through the port the
TRUSTED MOUNT injects (`input.backends.uiInteraction`, or the host's public
`userQuestions` service behind `ui-interaction-port.mjs`'s adapter). Absent
port = typed refusal, zero effect — never a bypass, never a fake.

## THE OUTWARD EDGES (booked in `scripts/eb3-family-boundaries.mjs` as `dsh.ui-family`)

Nothing under this directory may import the plane, the Kernel lane, or Host
internals. The complete outward set, face by face:

- `node:*` — `node:fs` + `node:fs/promises` (the post-consume ONE-FD
  identity probe in `present-executor.mjs`: `statSync` snapshot,
  `open(O_RDONLY|O_NOFOLLOW)`, fd metering), `node:crypto`
  (fingerprinting in `ui-mechanics.mjs`).
- `packages/contracts/src/index.js` — `canonicalJsonStringify` in
  `ui-family-contribution.mjs` (the canonicalizer face, read-only).
- `packages/domain/tool-governance/src/index.js` — the ONE effect-grammar
  face `parseRequestedEffectSet`, imported by the TWO executors only,
  booked consumer-by-consumer in the A5P0 layer audit (`PR1_CONSUMERS`).
- `packages/tools/fs-family/src/index.mjs` — the SIBLING FAMILY PUBLIC
  FACE (`lexicalAnchor`, `resolveAnchoredPath`, `MAX_READ_BYTES`,
  `verifyOpenedHandle`): the anchor law and the opened-handle identity law
  each have ONE home and this lane reads both through the reviewed face,
  never through a sibling's internals (`fs-mechanics.mjs` is NOT an edge
  of this lane; `verifyOpenedHandle` is fs-family's additive re-export of
  controlled-fs' `open-at-exec` law, added in the review F-405-1 fix —
  no third copy).

Everything else the lane imports is inward (`./`-relative, this lane).

## The law blocks

- **The timed law** (`ui-mechanics.mjs` + `ask-executor.mjs`): the variant
  selects at MOUNT (`uiTimedQuestions`, the host `mode: timed` mirror); the
  per-call `timeout` is `-1` (the keyed indefinite `wait`) or an integer
  1..2147483 seconds (default 120); an expired foreground wait answers the
  TYPED `{pending, callId, message}` outcome with the host pendingNotice
  verbatim — the pending branch is checked FIRST and a dishonest port's
  answers riding it are DROPPED. A timeout never produces an answer.
- **The anchor law** (`present-executor.mjs`, reusing
  `fs-family/src/fs-mechanics.mjs` — reused, not copied): paths are
  pure-lexically anchored BEFORE the PA edge (out-of-root = typed refusal,
  zero fs touch, zero grant consumption); `resolveAnchoredPath` re-checks
  POST-CONSUME (anchor drift / symlink alias refuse with zero
  publication); the anchors pay the declared per-file `read` effects;
  zero file bytes ever enter the result or a line.
- **The one-fd identity law** (review F-405-1; `present-executor.mjs`
  reusing the fs family's OWN law, never a third copy): after the anchor
  re-check the executor snapshots the path and OPENS ONCE with
  `O_RDONLY|O_NOFOLLOW`, then proves the FD — never the path — with
  `verifyOpenedHandle` (controlled-fs `open-at-exec`: `/proc/self/fd`
  containment against the governed root FIRST, fstat-vs-snapshot identity
  second), re-proves regularity on the fd, and meters the size cap ON THE
  FD (a `MAX_READ_BYTES+1` budget read whose bytes are DISCARDED). A file
  or a PARENT DIRECTORY swapped between the anchor check and the open
  cannot escape or substitute: `ANCHOR-ESCAPE` / `ANCHOR-DRIFT` /
  `FILE_TOO_LARGE` refuse with zero publication. Deterministic
  swap-at-open races are pinned by C1 R-1/R-2/R-3 — RED on the
  check-then-open head, GREEN here (evidence
  `review-round1-race-RED.log` / `-GREEN.log`).
- **The receipt-turn law** (review F-405-3): the host present RESULT
  REQUIRES an integer `turn` (pinned host
  `packages/deliverables/tool-present/src/index.ts:61`; `:79` refuses an
  unopened turn), so a mount that reports success WITHOUT one is not a
  success here: the row answers typed `UI_PRESENT_RECEIPT_INVALID` (with
  `sideEffectPossible: true` — the mount may already have displayed)
  instead of silently dropping the correlation identity.

## Booking

- family manifest entry + `ui-interaction` kernel capability
  (`packages/tools/families/manifest.json`, `gen-family-index.mjs`);
- census booking (`dev/agent-workflow/ledgers/arc-a-family-census.json`);
- dist placements (`scripts/dist-placements/070-ui-family.json`);
- p4t6 booking (`packages/testkit/test/p4t6-bookings/u7fui.json`).

## Proof

C1: `packages/runtime/test/u7-f-ui-c1.test.ts` (41 legs; positives land
their effects on the injected fake port, every refusal arm proves ZERO port
calls and zero consumption; the R-legs pin the one-fd identity law against
deterministic swap-at-open races and the receipt-turn / fd-cap laws;
mutation controls live in
`dev/agent-workflow/evidence/u7-f-ui-20261026/`).
