# BLOCK-0..4 consolidated fix — design note

> **STATUS (round 3, 2026-10-06): SHIPPED.** All items below landed in the round-3 consolidated
> commit. The open decision was RESOLVED in the fail-closed direction (every refused seam class ⇒
> hard deny with the typed code preserved — pinned as three distinct legs; see
> `ROUND3-VERIFIED-CHAINS-AND-RULINGS.md` and the README round-3 rulings). The
> "`root.ts:2974` still says deferred to PR5" premise below was **DISPROVEN at head `440ede51`**
> (grep at that line shows unrelated code; `git log -S 'deferred to PR5'` on `root.ts` is empty) —
> nothing was corrected there; the genuinely false texts (the host's warn-only store story, the
> plane's "wired by the caller" claim) were fixed instead. Raw per-round evidence: `README.md`.

## (RESOLVED round 3, fail-closed) design decision: how must a REFUSED seam answer route?

Today (`pre-execute-adapter.ts:1241-1251`): a `refused` decision ⇒ hard `deny` with
`permission denied: <code> — <reason>`. Once BLOCK-0 lands (the store actually opens), that posture
applies to EVERY refusal the lane can produce — `STATIC_FACTS_UNKNOWN`, `EFFECT_CONTEXT_UNAVAILABLE`,
`OVERLAY_VIEW_UNDECODABLE`, `ASSEMBLY_FAILED`, and the lifecycle refusals — so an infrastructure gap
(a provider that could not supply facts this round) becomes indistinguishable, at the tool boundary,
from a governance denial.

Options, with consequences:

1. **refused = hard deny (keep today).** Safest posture; but a transient fact/provider gap silently
   looks like "the Team denied this", the artifact floor is unreachable for those rounds, and
   BLOCK-1's `EFFECT_CONTEXT_UNAVAILABLE` hard-denies every Leader mutation the moment BLOCK-0 is
   fixed. Cheapest diff, worst diagnosability.
2. **refused = static fallback (the frozen pre-PR4 decision) + loud observation.** The round falls
   back to the canonical static answer; the dynamic layer is recorded as unavailable
   (`dynamic-decision-refused` + the code). Consequence: governance state changes (an overlay deny
   that could not be read, an unknown Leader lifecycle) would NOT block — that violates the
   fail-closed rule for AUTHORITY state, so this can only be legal for the *provider/fact* codes,
   never for lifecycle or overlay-read codes.
3. **Split by refusal class (recommended).**
   - lifecycle refusals (`EXECUTION_ARCHIVED`, `EXECUTION_TERMINAL`, `EXECUTION_STATE_UNKNOWN`,
     `INSTANCE_UNKNOWN`) ⇒ **hard deny** (an instance that is not durably live never executes);
   - authority-read failures (`OVERLAY_VIEW_UNDECODABLE`, `ASSEMBLY_FAILED`, and — while BLOCK-0
     exists — `NOT_CONFIGURED`) ⇒ **hard deny** (the authority itself is unreadable);
   - *context/fact* unavailability (`STATIC_FACTS_UNKNOWN`, `EFFECT_CONTEXT_UNAVAILABLE`) ⇒ either
     hard deny (strict) or static fallback with a mandatory observation — **this is the parent's
     call**; it decides whether "the host could not canonicalize the policy this round" blocks
     work or proceeds under the static policy.

I will implement whichever is ruled, with the choice pinned by named tests, and will not choose it
silently.

## BLOCK-4 reader shape (the leader branch)

`createMemberLifecycleReader(rows)` gains the control authority's existing semantics
(`control/service.ts:2142-2161`): `instanceId === LEADER_INSTANCE_ID` ⇒ liveness =
`teamSessions.get(root) !== undefined` (alive ⇒ executable; no member row is consulted, no
fabricated lifecycle field); otherwise the member-row lifecycle exactly as today. Needs the
TeamSession reader injected beside the member rows (the root already holds `repos.teamSessions`).

## Remaining RED-first list (built locally before the single commit)

- BLOCK-3 POSITIVE: no overlay + template-default-deny + valid spill grant ⇒ executes via the floor
  (currently unpinned RED; needs the artifact/spill fixture — the a5a /
  `artifact-read-permission-lane` worlds are the source of that harness).
- BLOCK-3 NEGATIVE: explicit overlay RULE deny ⇒ still blocks (my plane-spec leg P6(c) already
  covers the shape; will be restated through the real adapter).
- BLOCK-2: ask-over-static-deny ⇒ approval pending (durable control request row appears), each of
  exact / subtree / exec through the REAL adapter, applicability stated per class (subtree needs
  `containsTargets`; exec additionally meets the LEADER dual gate `execEnvelopeOps`).
- BLOCK-1: configured Leader exact/subtree/exec grant commits + answers allow at root assembly AND
  at host `apply()`; negative = unconfigured facts ⇒ the ruled refusal posture.
- BLOCK-4: Leader green over a real LeaderInstance/TeamSession; worker legs unchanged; a glue leg
  driving the real `createAgentBindings` with a filled plane ref (closes the t12a blind spot).
- BLOCK-0: single-handle port construction + fail-closed retained on a genuine storage fault.
- Comment fix: `root.ts:2974` still says "deferred to PR5" for permission wiring — must state that
  PR4 wires the lane and PR5 is notification only. **[Round-3 finding: the claimed comment does NOT
  exist at head — premise false (grep + `git log -S` empty). Executed instead: the host's
  warn-only "store could not be opened (fail closed)" text and the plane's "caller wires the
  envelope" docs, both genuinely false at head, now state the round-3 truth.]**

## Held state (do not commit until signalled)

Tree = `packages/runtime/test/a3p4-permission-lifecycle-e2e.test.ts` (26 legs, +faulting-predicate
leg) + the untracked evidence dir (40 files: raws, failsets, `.exit` records, README with the
297→299 / dist-attribution / tsc-exit-0 corrections). Nothing else. No push.

## BLOCK-5 — fail-OPEN on the decision path when the durable store cannot be read

Source state at 440ede51 (re-confirmed): `host.ts:1764-1776` catches the store-open failure and only
`console.warn`s — the warn TEXT says "the permission mutation lane stays unconfigured (fail closed)",
but the same catch leaves `permissionOverlay` undefined, so `root.ts` never builds the plane
(`root.ts:2558-2573`) and `permissionPlaneRef.current` stays undefined; `agent-bindings.mjs:2527-2530`
spreads `resolveDynamicDecision` ONLY when the plane exists ⇒ the pre-execute pipeline runs the PURE
STATIC rules. Consequence: a persisted restrictive overlay rule (deny/ask) + a static template allow
+ a store-open failure at restart = **silent static-allow execution**. My "fail closed" posture held
ONLY on the mutation side (`mutatePermission` → `PERMISSION_MUTATION_NOT_CONFIGURED`), never on the
decision side. The warn text is therefore also wrong and must not survive the fix.

Fix shape (aggregate into the same commit):

1. **Distinguish an optional-dependency factory from a production initialization failure.** The root
   factory keeps its optional-injection posture (`permissionOverlay?` — test/legacy assemblers may
   legitimately pass no seam). The PRODUCTION entry (`host.ts` = the shipped plugin) treats the
   durable permission authority as MANDATORY when the Team's permission layer is enabled: a store
   that cannot be opened is a typed startup failure for that Team, never "no overlay".
2. **What "enabled" means — OPEN SUB-FORCE for the parent** (there is no permission flag in
   `TeamPluginConfig` today; `grep` over `src/plugin/types.ts` finds none): (a) derive it from the
   bound Blueprint — a template carrying `capabilities.permissions` (the exact condition the glue
   already uses at `agent-bindings.mjs:2023`) makes the authority mandatory; (b) add a row-config
   flag (new config surface, needs a ruling); (c) always-on for the production host entry.
   RECOMMENDED: (c) with (a) as the loud pre-flight message — the production entry never boots a
   permissions-carrying Team without its overlay authority.
3. **Real bootstrap regression (RED first, host `apply()` level):** persisted restrictive overlay
   rule + static allow + injected store-open failure at `apply()` ⇒ execution must NOT execute on
   the static allow: either the startup fails typed, or (if the parent prefers degradation over
   startup failure) the decision seam is installed in a POISONED state that returns a typed refusal
   for every supported operation with a loud observation. POSITIVE control: healthy store ⇒ overlay
   deny respected. Negative control: a world with NO permissions-carrying template ⇒ zero new
   startup failure (the factory/test posture is untouched).
4. Warn-text correction: the message must say what actually happened ("the permission authority is
   unavailable; the Team's permission layer is blocked") — no "fail closed" claim on a path that
   falls through to static allow.

## Batch status: FIVE blocks (0,1,2,3,4,5 → five defects: 0 and 5 are the same root event with
opposite consequences), ONE commit, still HOLDING.
