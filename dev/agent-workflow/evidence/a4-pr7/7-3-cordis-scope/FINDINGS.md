# 7-3-cordis-scope — is the shipped `teamHardEnvelope: { rules: [] }` a silent capability downgrade?

**Read-only measurement lane.** No tracked file edited, nothing staged, nothing committed.
**NOTE: this directory is UNCOMMITTED** — it exists only in the detached worktree
`.worktrees/a4-cordis-scope` @ `f0485b15f5be2a3afc8834c4f148bf951dce20aa` (= `origin/master`, the
flip merge of PR #172; verified after `git fetch`). Expect it from that worktree path, not from master.
All file:line citations below are against this tree unless prefixed with a commit.

## Headline (3 sentences)

**Neither inert in the strictest sense nor a capability downgrade**: under the shipped composition
the one behavioural pre→post-flip difference is on the operator surface `override.mutatePermission`
(a rising grant that pre-flip committed directly now refuses the direct commit and converts into a
durable `envelope-mutation` approval case that commits inline on approval), which changes the route,
not the reach — nothing that was permitted becomes impossible; no supported shipped UI/CLI flow even
calls that mutation today (the team panel client has zero `mutatePermission` callers); and the
plan's own plane-specific no-match semantics (plan :23) plus spec §3.2 ("no implicit default") make
`rules: []` the *correct* shipped value — the narrow-widening candidate is not authorised and not
needed.

## 1. Flow enumeration (every path that could attempt an authority-expanding mutation)

The expansion ceiling is consulted by exactly one function in production:
`expansionCeiling` (`packages/runtime/governance/authority-ceiling.ts:395-426`), called from exactly
one production site: the v3 ceiling gate inside `mutatePermission`
(`packages/runtime/governance/service.ts:1340-1422` via `createPermissionAuthorityCeilingJudge`,
gate placement `service.ts:1200-1263`). `mutatePermission` has exactly two production entries
(`createGovernanceMutationService` is instantiated only by `root.ts`; grep for callers outside
governance/root/permission-plane returns only tests):

| # | Flow | Reaches the expansion ceiling? | Via / why not |
|---|------|--------------------------------|---------------|
| 1 | The **thirteen** SKILL tools (`team_list_members`, `team_list_templates`, `team_inspect_config`, `team_create_member`, `team_delegate`, `team_follow_up`, `team_collect`, `team_send_message`, `team_report_progress`, `team_request_control`, `team_resolve_control`, `team_list_pending_control`, `team_archive_member` — table `.agents/skills/team-leader-operations/SKILL.md:33-49`) | **No** | None writes the permission overlay; `createTeamTools` materialises them with no dependency on the governance permission port (`packages/tools/src/tools.ts:1524-1546` — only the two `permissionSpec` entries consume `options.permission`). |
| 2 | **`team_grant_permission` / `team_revoke_permission`** (Leader-only; materialised in the production set as a 14th/15th spec alongside the thirteen — `tools.ts:1373-1500`, registration `:1539-1540`; Leader gate `:1394-1404`; `mutatePermission` call `:1477-1479` with `authority: {kind:'leader'}`) | **Rises reach `mutatePermission` but NOT the ceiling gate** | For `actor === 'leader'` the Alpha.3 coverage law runs FIRST (`service.ts:1161-1199`): `authorizeLeaderPermissionMutation` (`governance/permission-mutation.ts:1389-1410`, code `PERMISSION_ENVELOPE_EXPANSION_DENIED` at `:174`) judges rises against the `permissionMutationEnvelope`; the shipped doc yields `NO_ENVELOPE = {rules: []}` both pre-flip (absent carrier) and post-flip (declared empty) — `permission-plane.ts:467` and the short-circuit at `:717` — so the throw is identical and precedes the ceiling gate. A `teamHardEnvelope` value cannot change any Leader outcome while this law stands (it was slated for deletion in §7.3 but the deletion is still gated: `service.ts:1458-1465` citing `7-3-prereq/FINDINGS.md`). Non-rising mutations (tightening/identity) classify zero rises (`permission-mutation.ts:1308`) and consult nothing. |
| 3 | **Operator `override.mutatePermission`** (remote v7-only method — `packages/remote/src/contracts/catalog.ts:104,238`; handler `packages/runtime/src/plugin/s6-remote.ts:3274+`, host-derived ActionCaller, never client-supplied authority) | **YES — the only production site where the ceiling gate is the live law** | `actor === 'human'` skips the Alpha.3 block (`service.ts:1161`; ADR §7 "Human mutations need no envelope", comment `service.ts:642-644`); the v3 gate runs (`:1214-1263`); `initiatorAuthority = 'human-user'` (`permission-plane.ts:1002-1003`). See §3 for the pre/post delta. |
| 4 | **Concrete-operation `ask` approvals** (PR4 approval routing, `packages/runtime/operation-permission/approval-routing.ts:774-840` consuming `OperationApprovalCeilingPort` = the same provider's approval-plane subset) | **No — approval plane only** | Uses `grantCeiling`/`narrowingForApproval` (`authority-envelope.ts:439-453`): a declared-empty document is the identity; a v1 absent document is skipped → also identity. Byte-identical outcome pre/post flip. |
| 5 | **`team_request_control(kind='envelope-mutation')`** (`tools.ts:962-1022`) | **No** | Control-plane case creation; resolvers `{leader, human}` (`control/types.ts:160-171`); it authorizes an exact scope once, it never writes the permission overlay; the mutation ceiling law lives in the mutation lane's commit section (`control/service.ts:2544-2553`). |
| 6 | **`override.set` / `override.reset`** | **No** | The legacy capability-override lane (`service.ts:332-445`), a different store; the permission assembler does not read it (`effective-policy/permission-assembler.ts`, no OverrideStore import). Never consulted a ceiling, before or after. |
| 7 | **`policyState.set` → `switchPolicyState`** | **No** | Closed-list validation, no ceiling consultation; the shipped blueprint declares exactly one state `default` (`cordis.patch.yml:89-91`). |
| 8 | **`/team-remote` catalog flows** (blueprint-authoring pre-flight: `catalog.list` / `catalog.get` then `team.create` — `.agents/skills/team-blueprint-authoring/SKILL.md:495-511`) | **No** | `catalog.*` are read-only; `team.create` binds a blueprint document at creation (validation, not runtime expansion). |
| 9 | **Team panel UI** (`packages/client`) | **No** | The client calls `override.getPermissionAdministration` (read-only v8, `team-remote-client.ts:580`), `intervention.act` (v8, `:578`), `resolveControl` (v4, `:523-524`); **zero `mutatePermission` callers in `packages/client/src`** (grep). |
| 10 | **CLI / legacy / testkit entries** | **No** | `grep mutatePermission packages/legacy packages/testkit` (non-test, non-dist): empty; the governance service has no other production consumer. |
| 11 | **Human Admin row** (`expansionCeiling('human-admin')` → `CEILING_IDENTITY`, `authority-ceiling.ts:401-402`) | **Unreachable** | Alpha.4 ships no Human Admin constructor (plan Global Constraints); the production provider's highest named position is `human-user` (`permission-plane.ts:1002-1003`). |

## 2. What a `rules: []` hard document contributes, and what the cited test really pins

- **Expansion plane** (`effectiveAuthorityCeiling`, `packages/domain/authority-envelope/src/authority-envelope.ts:409-424`): no matching rule ⇒ `CEILING_NO_AUTHORITY` (`:419-420`, `:283`). A `rules: []` document answers that at every scope. An **absent bound slot contributes the same value** on this plane (`authority-ceiling.ts:406-417`: "`absent` on THIS plane is … the expansion plane spells `no-authority`"). **The lane's algebraic claim — absent and declared-empty both answer `CEILING_NO_AUTHORITY` — is CONFIRMED**, pinned at `packages/runtime/test/a4p2-ceiling-reachability.test.ts:103-119` (`docs(EMPTY, EMPTY)` and `docs(ABSENT, ABSENT)` both assert `{status:'no-authority'}`; the Human User capped by an empty hard ceiling pinned just below, `:121-135`), not at the test the lane cited.
- **The provider nuance the lane's phrasing erases**: for the shipped **v1** document pre-flip, `expansionCeiling` was never called at all — the production ceiling reader answers `undefined` for `schemaVersion 1 | 2` (`permission-plane.ts:960, 972` — "the existential branch"; identical at the pre-flip base, verified at `git show bcbbfaa9:...:972`), and the gate skips on `undefined` (`service.ts:1216-1220`). So the accurate statement of the pre-flip world is "no ceiling consulted" (gate skipped at the version switch), not "absent consulted as no-authority". Both characterisations deny the same grants; the difference matters for who owns the law.
- **Approval plane** (`narrowingForApproval`, `authority-envelope.ts:439-453`): no match ⇒ `CEILING_IDENTITY` (`:448-449`); declared-empty imposes no narrowing — pinned at `a4p2-ceiling-reachability.test.ts:238-249` ("never dead-locks approvals"). Identical to the v1 absent-skip outcome. This is the ADR A1-4 "explicitly rejected alternative" (fusing the two dead-locks every Leader approval; `authority-envelope.ts:24-28`).
- **`a4p7-carrier-width-under-ceiling`** (`packages/runtime/test/a4p7-carrier-width-under-ceiling.test.ts`, 8 legs at :241, :261, :270, :333, :353, :422, :472, :495): **it pins something narrower than the lane claimed.** Every ceiling document in it is `{status:'declared'}` **with rules** — it never builds an `absent` slot and never uses `rules: []` as a document. What it pins: the Alpha.3 width law (legs 1-2), the v3 ceiling asked at the claimed WIDTH with a declared document that does not match the queried point answering `no-authority` while the approval plane simultaneously says identity/`leader` (leg 3, `:270-331`), the width refusal at the real operator entry with the approval lane UNWIRED in the fixture → hard `AUTHORITY_CEILING_INSUFFICIENT`, zero write (leg 4, `:333-351`), the never-loosens direction (leg 5), cell-first point order (legs 6-7), parse-fault posture (leg 12). The absent-vs-empty equivalence is `a4p2-ceiling-reachability`'s, and the "declared no-match ⇒ no-authority" instance inside a4p7 leg 3 is consistent with, but not the same pin as, the lane's claim.

## 3. The pre/post-flip delta — one positive case, then the enumerated negative

**Pre-flip shipped doc**: `schemaVersion: 1`, no envelope fields (verified
`git show bcbbfaa9^:cordis.patch.yml` — grep for `teamHardEnvelope|permissionMutationEnvelope` exits 1).
**Post-flip**: `schemaVersion: 3` with both documents declared `{rules: []}`
(`cordis.patch.yml:68,118-121`). The flip closed acceptance to `[3]`
(`packages/domain/blueprint/src/schema.ts:75`, commit 8f2ce74f — "narrows [1,2,3] -> [3]"), so the
pre-flip behaviour is counterfactual-only post-#172: a v1 document no longer binds
(`SCHEMA_VERSION_UNSUPPORTED`).

**Positive case (real difference, capability preserved):** Operator `override.mutatePermission`
with a rising grant/revoke-reveal:
- Pre-flip (v1): ceiling gate skipped (`permission-plane.ts:972` → `service.ts:1220`) and the
  Alpha.3 block is Leader-only (`service.ts:1161`) → **the rise commits directly, no ceiling law ran**.
- Post-flip (v3, hard declared-empty): `expansionCeiling('human-user')` = `no-authority`
  (`authority-ceiling.ts:404-423`) → `AUTHORITY_CEILING_INSUFFICIENT` (`service.ts:1401-1408`) →
  on the shipped root the approval lane IS wired (`root.ts:2351` `controlServiceRef.current`,
  `root.ts:2910-2919` proposals + late-bound port, `root.ts:3016-3017` deps; `approvalWired`
  condition `service.ts:649-654`), so the refusal converts to a **durable `envelope-mutation`
  approval case** (`service.ts:1236-1261`, kind at `:810,:1011,:1019`), priced at the rung above the
  derived beneficiary (`permission-approval.ts:213-217, 252-300` — declared-empty approval ceiling
  is the identity, so member-grants need `leader`, leader-grants need `human-user`; never
  `human-admin`, so no `CONTROL_UNRESOLVABLE_AUTHORITIES` dead end), resolvable by leader or human
  (`control/types.ts:170`; client surface `intervention.act` v8 / `team.resolveControl`,
  `team-remote-client.ts:523-524,578`; the intervention plane projects the mutation plane,
  `intervention/types.ts:303`), committing inline with the A1-14 recheck.
- Net: **extra approval hop; end state still reachable by the same human.** Route change, not reach loss.

**Enumerated negative for everything else** (each cannot differ pre/post, with reason):
- Flows 1, 4-11 of the table: never consult the ceiling at all (§1), so no envelope value can move them.
- Flow 2 (Leader grant/revoke): the gate is unreachable because the Alpha.3 carrier law refuses rises
  identically in both worlds — pre-flip absent carrier and post-flip declared-empty BOTH canonicalize
  to `NO_ENVELOPE = {rules: []}` at the same line (`permission-plane.ts:717`, `:467`) and produce the
  same typed throw `PERMISSION_ENVELOPE_EXPANSION_DENIED` (`permission-mutation.ts:1389-1410`);
  a4p7 leg 1 (`:241-259`) pins that refusal code at the real Leader entry. The ceiling cannot re-open
  what the carrier law refuses, and adding hard rules could not re-open it either (the Leader is
  bound by BOTH documents and the mutation envelope stays empty; meet absorbs —
  `authority-ceiling.ts:293-309, 395-426`).
- Non-rising mutations (any actor): zero rising regions (`permission-mutation.ts:1308`) → both
  envelope-law blocks iterate over an empty set (`service.ts:1191-1235` judges only
  `classification.rising`) → unchanged, identical in both worlds. This includes the revoke/narrow
  path the Leader-operations SKILL's shell-class warning documents (SKILL §"Do not narrow a
  shell-class permission below `allow`", ~:241-267 — that hazard is about documents WITH rules and
  the concrete-operation `ask` plane, orthogonal to the empty envelope).

**Consequence for the merged assumption**: the empty envelope is **not inert in the literal sense**
(there is one reachable plane whose outcome moved), but it is **not a silent capability downgrade**
either — the moved outcome keeps every prior end state reachable through a resolvable approval, the
moving is the explicit design intent of A4-PR5 ("a DECIDED-insufficient rise stops refusing into the
void and becomes a durable proposal", `service.ts:1237-1241`), and it is disclosed in the tree:
the cordis comment conditions inertness on "no permission mutation ever runs"
(`cordis.patch.yml:110-117`), plan :23 states the plane-specific semantics, and the
blueprint-authoring SKILL repeats the same disclosure (`SKILL.md:79-86`).

## 4. The narrowest candidate fix, priced

Candidate: a hard ceiling whose rules cover the carrier's scope with `maximumEffect: allow`.

- **What it grants the Leader: nothing.** Flow 2 is gated by the `permissionMutationEnvelope`
  coverage law before the ceiling gate; the hard document can only ever narrow the Leader further
  (`a4p2-ceiling-reachability.test.ts:98-101` monotonicity legs; ADR §7.2: adding a matching rule
  "can never increase effective authority", ADR :232 region). To move the Leader you would also
  widen `permissionMutationEnvelope` — that is authoring a Leader self-expansion right the shipped
  design deliberately withholds ("the Leader of this Team may expand NOTHING",
  `cordis.patch.yml:104-106`); nothing in the plan authorises granting it.
- **What it grants the operator: pre-flip direct commit restored** for every covered scope (the
  hard envelope is the only document binding `human-user`, `authority-ceiling.ts:306`). That is
  exactly the approval hop Alpha.4 exists to insert. Plan :23: "on the expansion plane no matching
  rule means no authority"; spec §3.2 "no implicit default is permitted"
  (`authority-ceiling.ts:199-200` comment); ADR §7.1 (line 215) names no-match = no expansion
  authority, fail-closed; and both the cordis comment (`:100-101` "never a permissive filler rule")
  and the authoring SKILL ("Author them at the honest zero … never with a permissive filler rule",
  `SKILL.md:79-86`) forbid the candidate as authored doctrine.
- **Verdict, per the user's own stop-rule: the plan's semantics make the empty envelope the
  correct shipped value. No widening is warranted. Stop.** The honest residue is disclosure only —
  if anything, one sentence in the cordis comment could name the operator round-trip explicitly;
  the existing conditional sentence (`:111-117`) already covers it truthfully.

## 5. Unverified / boundaries

- **No vitest run** — every claim above is static reading; the cited tests are green as merged on
  master (this tree is the merged master). Had a run been needed, the harness protocol
  (`rm -rf packages/testkit/test/.tmp-fault`, un-piped `pnpm install --store-dir
  /home/user/dsh-plugins/dsh-agent-team/.pnpm-store`) was available but no question required it.
- **No host boots, no port 3080, no builds.** The operator authority derivation
  (remote caller → host ActionCaller → provider `initiatorAuthority: 'human-user'`) is read at
  `s6-remote.ts:3274-3335` + `permission-plane.ts:1002-1003`, not confirmed end-to-end at runtime —
  a host boot on the shipped composition would settle it; `NOT_DETERMINED_STATICALLY` for the exact
  runtime identity stamp only, the code path is cited.
- The claim that an open `envelope-mutation` case is approvable from the shipped GUI is module-level
  (projection includes the mutation plane, `intervention/types.ts:303`; the client dispatches acts
  over `intervention.act`, `TeamInterventions.tsx:143-144`); the exact act vocabulary per case
  state was not exhaustively traced.
- The lane's numbers/claims were re-derived from this tree, not inherited; where the lane's
  citation was imprecise (which test pins which absence claim; "absent consulted" vs "gate skipped")
  this file states the correction explicitly.
