# governed-fs — Bounded READ pilot (isolated evidence module)

**Status: PILOT — not production.** This directory is excluded from the
production compile face (`packages/tools/tsconfig.build.json` carries the
exclude with a note); no production assembly imports it; the dev tsconfig
typechecks it and vitest runs it. Publication is gated by the root's review +
secret scan at an exact head — nothing here is a shipped surface until then.

## What it is

A bounded, governance-shaped `read` definition (`createGovernedReadDefinition`)
that ports the native tool-fs read contract (params/args-law/output schema/
render footers) and executes reads through a **trusted-dirfd chain** under:

- pre-open `lstat` per component through the anchor fd (symlinks refuse as
  links; fifo/socket/device refuse BEFORE any `O_RDONLY` open);
- `O_NOFOLLOW` per step, `O_NONBLOCK` on the final open (hang guard);
- root dirfd pinned to an `expectedRootIdentity` (dev+ino) supplied by the
  caller — opened per call, never held open across calls (BLOCK ①/④ form);
- effect-boundary rechecks: live grant/generation/bindingRevision/revocation
  (`verifyLiveAdmission`) + a NO-OPEN dir-entry retarget guard
  (`recheckHandleIdentity`, lstat under the parent anchor);
- per-call admission binding (never a shared "current grant"), required
  `grantId` riding an EXISTING trusted grant; a live view that omits the
  grant diverges (root F1 ruling — no silent bypass);
- runtime validation of every outcome against the native output shape
  (`validateNativeOutputShape`, additionalProperties:false semantics);
- unsupported shapes fail CLOSED at construction (`ioProfile`,
  `FLAGS_SUPPORTED`).

## Honest ledgers (root G-list, all residual)

- **G1** — the step-0 doc's "fd0 held for the world's lifetime" is NOT the
  implemented form: the anchor is per-call open + identity check against the
  pinned dev/ino. Design account amended in
  `dev/agent-workflow/evidence/alpha5/tools-gov/B-READ-PILOT-DESIGN.md` §7
  (long-held fds were the leak source the FD audit pinned).
- **G2** — `rootIdentity` trust precondition: the anchor is only as honest as
  the pin-time measurement by the assembler. A swap BEFORE pinning pollutes
  the pin itself; that premise is disclosed, not hidden.
- **②** — race posture is stated in NARROW-PROFILE form only (a tree no other
  principal mutates between verify and effect). NO guarantee for arbitrary
  mutable trees (that profile is unsupported and refuses); a full close would
  need `openat2(RESOLVE_*)`, which node lacks. `O_NONBLOCK` is a hang guard,
  not a race defense.
- **③** — parent-directory relocation is UNSUPPORTED (profile breach; the
  identity anchor answers it, nothing finer is claimed).
- **④** — one-shot grant CONSUMPTION is not closed here: this pilot only
  revalidates the current grant before the effect. Consumption ledgers belong
  to a trusted integration (assembly layer), which does not exist yet — never
  claim one-shot semantics.
- **⑦** — resolution law is the native contract shape: `resolve()` then
  lexical containment; the `'..'` component filter is defense-in-depth (the
  call never sees post-resolve `'..'`), the real guard is the per-component
  O_NOFOLLOW chain walk; in-root bounded traversal stays ALLOWED.
- **G6/T-L10** — the two-member unit arm proves ASSEMBLY ISOLATION under
  sequential same-tick issue (per-definition def/gen/grant/root binding; a
  cross-wired binding refuses). It is NOT a scheduler-interleaving proof; the
  live two-member leg stays booked at the kit stage.
- **G8** — "zero opens after verify" is re-anchored to: **no leaf-target open
  after verify**; the effect-boundary recheck is a NO-OPEN dir-entry
  inspection (lstat = readlinkat family). Live T-L5 counts by this law.
- **G9** — `GOV_NO_PROC` (no `/proc`, no string fallback) is a code path with
  an UNREACHABLE probe on Linux: recorded as untested-by-environment, never
  as passing.
- **⑤/⑥** — `truncatedByBytes` never rides the outcome (native schema is
  strict; render derives it); raw paths ride verbatim (only all-blank
  `file_path` rejects).
- **⑫** — the envelope/window goldens are HAND-DERIVED from host 0.2.0-rc.2
  source law (read.ts / read-render.ts), NOT live two-mount captures; the
  live parity stage (three-form → bytes+FD witness, native-body-count=0, four
  parity) is booked for the pilot acceptance window and requires the root's
  RELEASE of the "pinnedHost read-pilot verification ONLY" gate.
- **local rewrite disclosure** — the chain re-implements the controlledFS
  LAWS (verifyOpenedHandle / bindAdmissionRecheck / fail-closed profile)
  locally instead of importing `packages/runtime/controlled-fs`: the isolated
  pilot must not touch production assembly. Law-for-law, not module-for-module.

## House rules

- CLEANUP HOLD: test fixtures are RETAINED and printed (`[fixture retained]`),
  never removed; raw logs are never deleted or read for their token lines.
- p4t6: this module's four files are booked MEASURED at **1210** in
  `packages/testkit/test/p4t6-session-event-scan.test.ts`
  (`SCANNED_PATHS_A5READPILOT`, tie `1210 - 1206`).
- Production assembly edits are OUT OF SCOPE until the root releases the
  progression hold; nothing here may be imported by `host.ts`/`agent-bindings`
  at this stage.
