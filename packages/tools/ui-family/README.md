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

## The two law blocks

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
  zero fs touch, zero grant consumption); `resolveAnchoredPath` + an
  O_NOFOLLOW probe run POST-CONSUME (anchor drift / symlink alias refuse
  with zero publication); the probe pays the declared per-file `read`
  effects; zero file bytes ever enter memory, the result, or a line.

## Booking

- family manifest entry + `ui-interaction` kernel capability
  (`packages/tools/families/manifest.json`, `gen-family-index.mjs`);
- census booking (`dev/agent-workflow/ledgers/arc-a-family-census.json`);
- dist placements (`scripts/dist-placements/070-ui-family.json`);
- p4t6 booking (`packages/testkit/test/p4t6-bookings/u7fui.json`).

## Proof

C1: `packages/runtime/test/u7-f-ui-c1.test.ts` (36 legs; positives land
their effects on the injected fake port, every refusal arm proves ZERO port
calls and zero consumption; mutation controls live in
`dev/agent-workflow/evidence/u7-f-ui-20261026/`).
