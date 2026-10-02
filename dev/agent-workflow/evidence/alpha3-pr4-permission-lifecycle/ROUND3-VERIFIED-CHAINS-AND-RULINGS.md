# Round-3 (fresh sole writer) — independently verified chains + rulings applied

Verified at HEAD `440ede5172c6bb0d669426d5cf019012620e4f9f` by reading the source
(paths/lines from THIS round's reads, not the predecessor's). Every claim below was
re-derived; the predecessor's note is corroborated except where marked.

## BLOCK-0 (verified)
- `host.ts:1766` `permissionOverlayStore = await openPermissionOverlayStore(seam)` runs AFTER the
  SAME seam was used to open the domain (`host.ts:1561/1564/1567`). `openPermissionOverlayStore`
  (`storage/repositories/permission-overlays.ts:462`) itself calls `createOrOpenTeamDomain(seam)`
  then `seam.open(...)` — a second open of `team_domain` while the domain handle is live.
- The real seam doc (`runtime/root-binding/harness/seam.mjs:23-25`) states upstream enforces
  **single-open-per-domain-name (`already-open` rejection)**; the seam contract
  (`storage/schema/seam.ts:110`) says the same. The predecessor's raw
  `host-apply-overlay-open-failure.log` shows exactly `already-open — domain 'team_domain' is
  already open` in production apply(). Chain confirmed ⇒ the catch at `host.ts:1770` swallows it,
  the warn text claims "fail closed", and the port is absent ⇒ lane absent everywhere.
- Fix shape: the domain handle is the ONE legal handle ⇒ the overlay repository MUST ride the
  already-open `TeamDomain` (facade gains the tenth repository; `close` stays the facade's).
  Upstream single-open makes ANY second handle in production impossible, confirmed.

## BLOCK-1 (verified)
- `root.ts:2447-2453` passes ONLY `{ overlay, fsContainsKeys }` to `createPermissionGovernanceLane`.
- `GovernancePermissionLaneDeps` (`governance/types.ts:151/167`) supports `permissionEnvelope` and
  `staticLayers` (sync data readers); with NO envelope the service defaults to
  `parsePermissionMutationEnvelope({ rules: [] })` = NO expansion authority (`governance/service.ts:636-638`),
  and `lane.staticLayers?.(...)` = `undefined` = UNKNOWN facts (`service.ts:639`).
- Consequence (`permission-mutation.ts:staticEffectForRegion` + `authorizeLeaderPermissionMutation`):
  EVERY Leader expansion hits EFFECT_CONTEXT_UNAVAILABLE or EXPANSION_DENIED. Human
  (`authority.kind:'operator'`) mutations are unaffected — which is why round-1/2 legs passed.
- Grammar facts verified in `packages/domain/blueprint/src/types.ts`:
  `TemplatePermissionPolicy = {default, allow[], ask[], deny[]}` (rule = `{tool, resource:
  exact-path | subtree-path | any}`); the BlueprintDocument carries NO §6 permission-envelope field
  (`teamEnvelope`/`memberEnvelopes` are the PolicyState-lane envelopes; `maximumEffect` exists ONLY
  inside `governance/permission-mutation.ts`). The envelope matchers are exact|subtree|fingerprint;
  exec-class MUST be fingerprint (`validateMatcher`), `any` is refused.
- RULING APPLIED (recorded decision, this round): with no grammar carrier for a §6 permission
  envelope, the production entry DERIVES the Leader's expansion ceiling from the SAME bound
  snapshot — the LEADER template's own permission lanes: template ALLOW rule ⇒ envelope rule
  {operationClass, matcher(canonical), maximumEffect:'allow'}; template ASK rule ⇒ ceiling 'ask';
  deny lane ⇒ no rule; shell-class `any` rules are NOT expressible as fingerprint envelope rules
  ⇒ NO exec expansion authority from the grammar (Leader exec fingerprint expansions refuse
  typed `EXPANSION_DENIED` at the production entry until a blueprint grammar PR carries §6).
  This never widens (the Leader can only expand inside what its own bound template allows) and is
  **[ROUND-4 CORRECTION — the "never widens" claim is FALSE as shipped.** The round-3 derivation
  copied the leader's ALLOW/ASK lanes but SILENTLY DROPPED the same-lane DENY/ASK exceptions, so a
  member COULD be widened past the leader's EFFECTIVE answer at exception regions (X1's two demos:
  deny-exception + ask-ceiling). Round 4 removed the derivation (explicit carrier only) and added
  the `authorityCeiling` effective comparison; the false code comment (then permission-plane.ts
  :259-260) is deleted with the rewrite. Pins: `a3p4-r4-authority-binding` B1/B2/B5 + entry `R4-derive`.
  **[SUPERSEDED 2026-10-02 by ROUND 5: the added `authorityCeiling` effective comparison was REMOVED
  — ADR §6 carries NO second policy condition; carrier breadth over a leader deny is the
  content-hash-pinned blueprint author's choice. Round-4's own CORRECTION (derivation removed,
  explicit carrier only, comment deleted) STANDS, and so does the round-3 truth this addendum
  records: the derive route is gone forever. Retargeted pins: B1/B2 → envelope-algebra form,
  B5 kept (pure-envelope; the ceiling input it was suspected of is deleted), `R4-derive` →
  `R5-derive` (carrier-covered member grant COMMITS despite the leader's own deny; leader
  self-answer unchanged — no self-widening).]**]**
  version-explicit: the facts document binds {blueprintId, revision, contentHash} and abstains
  (UNKNOWN / zero-envelope) on drift ⇒ typed refusal, never a stale answer.

## BLOCK-2 (verified)
- `pre-execute-adapter.ts:1436` `if (decision.decision === 'deny')` reads the STATIC decision.
  With the seam answering ASK over a static deny, line 1264 does not return (effect 'ask'), but
  L1436 denies outright — no control row, no approval. Confirmed against the predecessor's raw
  (`a3p4-production-red-probe.log` B1).

## BLOCK-3 (verified)
- `pre-execute-adapter.ts:1264-1266` returns on any dynamic deny BEFORE the artifact-grant floor
  at 1302-1305. The floor's condition `effectiveEffect === 'deny' &&
  decision.provenance.source === 'default'` (1305) can therefore never see a merged
  DEFAULT-deny round: the merged answer's own provenance never reaches it (the seam returns
  `effect` only — `DynamicPermissionDecision` has NO `source` field).
- INFO-3 (verified): `pre-execute-adapter.ts:1224` `staticRules: canonicalRules ?? { allow: [],
  ask: [], deny: [] }` — a declared-NONE claim the decision lane itself forbids conflating with
  UNKNOWN (`decision-lane.ts:222-231`). Must not survive the fix.

## BLOCK-4 (verified)
- `root.ts:2563` `members: createMemberLifecycleReader(repos.memberInstances)` — blind member-row
  read. The v2 Leader has NO member row in real boots: `seedBootWorld` (which seeds the
  `inst-leader` row at `root.ts:3003-3013`) is reached ONLY by fixture boot worlds — the real-host
  comment at `root.ts:3047` says the real root "NEVER reaches seedBootWorld". The artifact
  identity port confirms the doctrine (`host.ts` lifecycleOf: leader ⇒ 'leader', NO member row).
- The EXISTING authority semantics to reuse (`control/service.ts:2141-2163`): leader live ⇔
  `teamSessions.get(root) !== undefined`; the member-row lifecycle check explicitly EXCLUDES
  `LEADER_INSTANCE_ID`. Chain confirmed by the predecessor's raw (EXECUTION_STATE_UNKNOWN).

## BLOCK-5 (verified)
- `agent-bindings.mjs:2526-2531` installs `resolveDynamicDecision` ONLY when
  `permissionPlaneRef.current` exists. Store-open failure (BLOCK-0) ⇒ root builds no plane ⇒ the
  pre-execute pipeline runs PURE STATIC rules ⇒ persisted overlay deny + static allow + restart
  failure = silent static-allow execution. The mutation side refuses typed (NOT_CONFIGURED) —
  the "fail closed" claim lives only on the write side.
- RULING APPLIED (parent-locked): production host entry treats the durable permission authority as
  MANDATORY (always-on); no new config flag; root factory keeps optional injection for
  test/legacy assemblers; loud pre-flight derived from `capabilities.permissions` (glue L2023 is
  exactly `boundTemplate.capabilities?.permissions`). Precedent for mandatory-fail-boot: the
  artifact authority `rebuildFromLedger()` failure fails the boot ("the grant vertical never comes
  up half-built", host.ts Phase-E comment).

## MINOR-1 (verified)
- `decision-lane.ts:348-349`: exec winningLayer maps kernel `source:'layer'` ⇒ `'template'`
  unconditionally; `'blueprint'` is unreportable. The kernel answer
  (`PermissionKernelAnswer`, types.ts:326-328) carries NO layer identity. Fix shape: probe the
  SAME pure algebra per static layer (highest-first, mirroring `staticEffectForRegion`'s
  top-down fold, permission-mutation.ts:818-847) to locate the winning static layer, mapped to the
  request's blueprint/template slot — still ZERO precedence owned by this lane.

## Predecessor claim that did NOT verify
- "root.ts:2974 still says 'deferred to PR5' for permission wiring": NOT PRESENT at 440ede51.
  `grep -rn "deferred to PR5" packages` finds nothing; `git log --all -S "deferred to PR5" --
  root.ts` is empty; root.ts:2974 is inside `seedBootWorld` (BP6 audit comment). The actual stale
  text that DOES exist is the host warn ("…stays unconfigured (fail closed)") — fixed here — and
  the `permission-plane.ts` module doc asymmetry-2 ("the reader is ABSENT … unless a caller
  injects a provider"), updated here to describe the production injection.

## Refused-seam routing (the predecessor's open decision — RESOLVED by parent ruling)
- Typed hard refusal for EVERY refusal class; NO static fallback anywhere; the distinct refusal
  code is preserved in the deny reason and in a loud observation row. Named tests pin each class
  (lifecycle refusals, authority-read failures, context/fact unavailability).
