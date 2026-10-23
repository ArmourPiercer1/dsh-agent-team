# PROVIDER-IDENTITY SUPPLY — MINIMAL CANDIDATE (center, per root 18:35; precise source conclusions in hand, no new design)

Root's closed r18 chain (root independent source diagnosis, cited as authority):
Guard bindOwnTools → install:1150 real binding.providerId = 'dsh-agent-team'
→ registry:377 (verified: pa-mount-registry :375-377 writes `binding: entryBinding`
into the mount record) → plane:1375 → bridge:498 → durable row carries it VERBATIM.
The image arm (agent-bindings :2983) and callFacts (plane :3004) HARD-CODE
'a5p5-plane'; family registration (:3594) reads FROM THE ARM — self-consistent
among the three plugin-side carriers, NOT consistent with the Binding.

Non-goals (root law, binding on this candidate): image.mjs :359-360 strict equality
STAYS; :507 family validation STAYS; no changing the real binding to a test constant,
no alias, no durable-row edit, no comparison removal; write side has no comparison —
its pattern is NOT copied; placementFeed carries ONLY definitionIdentity/realmId today —
this candidate does NOT pretend a provider field exists on it; no self-authorization
from any receipt (the durable row is never an input to the supply).

## The single trusted authority

The ONE provider authority = the live binding authority the Guard/install path
already produces (same source registry:377 reads when composing entryBinding).
Supply rule: read it LIVE at each consumption moment; absent or non-string ⇒ refuse
with the carrier's own existing refusal codes (mount-refused family); never default,
never cache from a row, never from a receipt.

## Minimal diff shape (identity-supply consistency ONLY; four sites)

1. agent-bindings image ARM CONSTRUCTION (:2981-2983, before bind — root's timing
   fact): replace `providerId: 'a5p5-plane'` with `provider: <reader>` — a callable
   supplied by the mount assembly that resolves the LIVE binding authority's
   providerId at CALL time. The arm stores no constant. (createGovernedReadImageArm
   keeps its current param validation law: it must receive either a usable constant
   today or this reader — the arm-side change is the smallest accepting both,
   image arm owner signs.)
2. agent-bindings FAMILY REGISTRATION (:3594-3598): `providerIdentity` =
   LIVE binding authority read AT THE REGISTRATION MOMENT (post-publish, hence
   post-bind — ordering holds), not `a5ImagePlacedArm.providerId`. Absent ⇒ the
   EXISTING mount-refused path; nothing registers with a guessed identity.
3. team-tool-plane CALLFACTS assembly (:3004 region): `providerIdentity` = same
   LIVE authority read per call; 'a5p5-plane' constant REMOVED from this site.
   Sites :2735/:2830/:2983/:1125 (todo/write/arm placements): OUT of this fix
   unless the same image-style row comparison exists — it does not (write/todo
   rows carry no provider comparison; root: do not copy).
4. mount assembly wires the reader ONCE from the same getter the registry's
   entryBinding composition uses (registry:377 source of truth); the reader has
   NO access path to durable rows (structure, not convention: its inputs are the
   live guard/dispatcher surface only).

image.mjs untouched. pa-control-bridge untouched. types.ts untouched.

## Fixed-point C1 over the REAL assembly objects (spec contract, source-audited before any new package)

FP-A POSITIVE: real Guard bindOwnTools → real install → real registry → publishPaMount
→ real model call: row.binding.providerId === callFacts.providerIdentity ===
arm-resolved provider === live binding authority, all byte-equal (r18's three-way
string now agrees from ONE source, not three constants).
FP-B ABSENT: reader answers undefined at registration ⇒ registration refused
(existing code), NO row consumable; at call time ⇒ arm's existing bindingMismatch
refuses with its own bytes. No fallback constant exists to fall back TO.
FP-C TIMING (arm precedes bind): arm constructed before bind; call AFTER bind
resolves the live authority — the value at construction time is NEVER stored;
a construction-then-bind-then-change-of-authority call answers the NEW live value
(or refuses), never the stale one.
FP-D NO SELF-GRANT: the reader's inputs contain no durable-row channel — pinned by
constructing a call where a durable row SAYS 'x' while live authority says 'y':
consumption refuses (row≠live), proving the row is not an authority.
FP-E FAMILY-CHECK :507 and image :359-360 byte-unchanged (regression pins).

## Process

Source review on the candidate diff + this C1 contract → owner-signed minimal
implementation on its branch → center merge + combination validation → NEW proper
package built from the signed source → root rules on the next Host round
(r18 world/consumption stays frozen; no rollback, no reuse; r18's consumption
already spent is never recounted).
