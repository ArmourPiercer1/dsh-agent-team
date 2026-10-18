---
name: team-blueprint-authoring
description: Author a DSH Agent Team blueprint (a saved-source YAML document) and run pre-flight checks before creating a team — identity frontmatter, the frozen closed field sets, exactly one complete LeaderTemplate, member templates, capabilities (teamTools/builtinToolDeny/skills/mcp/permissions with allow-ask-deny lanes, exact/subtree/any resources, shell-class rules), envelopes, policyStates, quotas, the draft-file convention, and live checks over the /team-remote catalog.list / catalog.get endpoints. Use when asked to create, modify, or validate a team blueprint or a new team design.
---

# Team Blueprint Authoring & Pre-flight

A **TeamBlueprint** is a YAML document with a frontmatter record (no markdown
body). A blueprint revision, once resolved, instantiates a TeamSession. The
validation is **strong and all-or-nothing**: any single violation rejects the
whole document. This skill is the authoring contract plus the pre-flight
procedure to run before a team is created.

## 1. Where blueprints live

Three authorities, in order (per team root):

1. the per-team **bound blueprint snapshot** (durable; an existing team always
   runs on the revision bound at creation — authoring a new revision does NOT
   rebind it);
2. the **saved sources** of the `blueprintDir` row config (absolute path, or
   relative to the host process's cwd). **Absent `blueprintDir` = the
   filesystem catalog is disabled** — only the inline bootstrap blueprint is
   resolvable. If the deployment has no `blueprintDir`, author the file and
   hand it to the operator (who registers the directory in the plugin row
   config);
3. the **inline bootstrap anchor** (`blueprintSource` row config) — the
   shipped default design.

Saved-source directory rules:

- candidate files: `*.yaml` / `*.yml` regular files, one file = one
  `(blueprintId, revision)`;
- `*.draft.yaml` / `*.draft.yml` are **ignored** — the authoring staging
  surface. Iterate in a draft, rename to a final name when it resolves;
- the index is **stateless**: every catalog query rescans the directory — no
  watcher, no cache. A file added after host boot is visible on the next
  `catalog.list`; a deleted file disappears on the next query (unless its
  revision is frozen by an existing team);
- a name with path separators is rejected (traversal fence).

## 2. Document anatomy

```yaml
---
schemaVersion: 3
blueprintId: my-team-bp-1
revision: "1"
displayName: "My Team"
description: "What this team does."
leader:
  templateId: leader
  persona: "You lead this team. ..."
members:
  - templateId: worker
    displayName: "Worker A"
    persona: "You are a worker on this team."
requirements:
  - domain: persona
    name: standard
teamEnvelope:
  allow: [assign-task, create-member, send-message, report-progress, archive-member, restore-member]
  deny: [delete-team]
memberEnvelopes:
  - templateId: worker
    envelope:
      allow: [send-message, report-progress]
      deny: []
policyStates:
  - id: default
    description: "Default state."
quotas:
  team:
    maxInstances: 12
    maxConcurrent: 12
  members:
    maxInstances: 4
    maxConcurrent: 4
metadata: {}
# Version 3 makes these two authority documents REQUIRED, with no default: a
# defaulted ceiling would be the implicit wide grant ADR §5.1 forbids. Author
# them at the honest zero below and never with a permissive filler rule; the
# two planes read `rules: []` differently and both readings are pinned in
# production — on the EXPANSION plane an unmatched scope is no authority (this
# Leader may expand nothing), on the APPROVAL plane an absent rule imposes no
# narrowing (a Human User is impeded only by host-side law). This zero is
# inert only for a Team that never asks to expand anything.
permissionMutationEnvelope:
  rules: []
teamHardEnvelope:
  rules: []
---
```

Structural rules (all fail loudly with a classified reason):

- the document is exactly one YAML frontmatter record between `---`
  delimiters; a markdown body is rejected (`markdown-body-not-allowed`);
- BOM is stripped, CRLF normalized, the YAML must decode cleanly;
- identity fields:
  - `schemaVersion` — positive integer; supported: **3 and 4** (the `{3, 4}`
    dual-parsing window since the v4 flip — 翻档 ≠ 退役, the flip is not a
    retirement: the window's duration/exit is the T-1 pending ruling and is
    NOT pre-set anywhere; formal Schema ADR:
    `docs/plans/memo/alpha5-tool-io-governance/ADR-vnext-blueprint-schema-v4.md`).
    **Provenance of that run set** (doc-sync 2026-10-18): the `{3, 4}` face is
    the **flip candidate `a7a1cfd2` (PR #324, pending)**; on master
    (`7ab56dbf`) the constant is still `[3]`
    (`packages/domain/blueprint/src/schema.ts:75`) and a v4 document is refused
    `SCHEMA_VERSION_MISMATCH` — the dormant grammar ships unwired there
    (`382e5fb6`). Read the v4 lines of this file as *what the candidate
    accepts* until the flip merges; adjudication (1) at the end of this file
    holds the full per-generation table.
    v3 = v2 shape + the two REQUIRED authority documents, and a document that
    omits either does not parse; v4 = the SAME frozen core face (validated by
    the same frozen v3 validator — the fourth parser delegates) plus the ONE
    optional v4-only field `toolBindings` (§4.4). **1** and **2** remain
    DEFINED but are RETIRED: this build refuses them with
    `SCHEMA_VERSION_MISMATCH` and the catalog lists them `migration-required`;
  - `blueprintId` — non-empty, ≤128 chars, no whitespace/control characters,
    no `@` (reserved for the `blueprintId@revision` form);
  - `revision` — a positive integer (the shipped convention writes it
    quoted, e.g. `"1"`).

## 3. The frozen field sets (unknown fields fail)

- **Top level (14)**: `schemaVersion`, `blueprintId`, `revision`,
  `displayName`, `description`, `leader`, `members`, `requirements`,
  `teamEnvelope`, `memberEnvelopes`, `policyStates`, `quotas`,
  `capabilityPolicy`, `metadata`. (v2 ADDITIONALLY accepts
  `teamRequirements` — §4.2. v4 ONLY, on top of the 14, accepts
  `toolBindings` — §4.4; at v3 that key is an unknown field, refused.)
- **Template (leader and members share one schema)**: `templateId` (required),
  `displayName` (≤128), `description` (≤4096), `persona` (**required**,
  non-empty, ≤32768), `modelPreference`, `contextPolicy`, `capabilities`.
  (v2 ADDITIONALLY accepts a per-template `requirements` — §4.2.)
- **Control characters: prose fields and identifier fields have different
  rules.** `persona` and `description` (top level, per template, and per
  policy state) are prose, so tab, newline and carriage return are legal in
  them — write a long `persona` as a YAML block scalar and its newlines are
  part of the text:

  ```yaml
  leader:
    templateId: leader
    persona: |
      You lead this team.

      Follow TEAM_DESIGN.md section by section.
  ```

  Every OTHER control character (the rest of C0, plus DEL) is refused in prose
  as well. Identifier-shaped fields — `blueprintId`, `revision`, `templateId`,
  `displayName`, `modelPreference`, `contextPolicy` — keep the strict ban: no
  control character, no whitespace, so a `displayName` never spans two lines.
- **capabilities**: `teamTools`, `builtinToolDeny`, `skills`, `mcp` (all four
  REQUIRED when the block is present) + optional `permissions`.
- **permissions policy**: `default`, `allow`, `ask`, `deny` (all required).
- **permission rule**: `tool`, `resource`.
- **requirement** (v1 flat list): `domain`, `name`, `optional`.
- **structured requirement** (v2 `teamRequirements` / per-template
  `requirements`, §4.2): `requirementId`, `type`, `subjects` (lowercase slug
  list, unique), `complete` (optional boolean).
- **envelope**: `allow`, `deny` (arrays of operation tokens, lowercase slug
  `[a-z][a-z0-9._-]{0,127}`). Two recognized token classes: the
  team-governance operations (`assign-task`, `create-member`,
  `send-message`, `report-progress`, `request-control`, `resolve-control`,
  `archive-member`, `restore-member`, `dispose-member`) and the
  **exec-authorization tokens** `'bash'` / `'pwsh'` — the leader's
  effective envelope must carry the token for the leader's allow-lane
  shell-class permission rule to authorize the tool at runtime (the
  pre-execute dual gate; §5.1). Other slugs parse but are inert.
- **member envelope entry**: `templateId`, `envelope`.
- **policy state**: `id` (lowercase slug ≤64), `description`, `fields`.
- **quota spec**: `team`, `members`; each `{maxInstances, maxConcurrent}`.
- the legacy field `memberId` is rejected at **any** depth.

### 3.1 `modelPreference` (per-template model routing)

Each template (leader and members share the schema) MAY declare a
`modelPreference` — a model token that routes that member to a specific model
from its **FIRST** turn, with zero governance overrides. (Delivered
2026-09-26, model-preference-routing round: the value now reaches the real
Agent model-selection path as a TEMPLATE-STATIC policy value.)

- **Token grammar** (split at the FIRST `/`):
  - `provider/model` — fully qualified (both parts non-empty).
  - `model` (model-only) — LEGAL shorthand; inherits the deployment
    `staticModel`'s provider (so `gpt-6-astra` → `<staticModel.provider>/gpt-6-astra`).
  - malformed (empty / whitespace / control chars / `/model` / `provider/`)
    REJECTS the whole blueprint (reason `invalid-model-preference`) and is
    excluded from the Blueprint hash.
- **Precedence**: `modelPreference` becomes a TEMPLATE-STATIC policy value
  (the resolver `template` layer, provenance `member-template` /
  `template` / `static`, recordId null). It sits **BELOW** any record-backed
  override / `humanOverride` (a durable model override always wins) and
  **ABOVE** the unspecified default (the deployment `staticModel` fallback).
  External hard facts always win.
- **No `model` param on team tools**: you do NOT (and cannot) set a member's
  model through a team tool at runtime — `modelPreference` is the Blueprint's
  declarative routing; a runtime model change goes through the durable
  override path, which outranks the template value.
- A template WITHOUT `modelPreference` falls back to the deployment
  `staticModel` (unchanged legacy behavior).

## 4. Hard invariants (the ones that reject whole documents)

1. **Exactly one complete LeaderTemplate**: the `leader` field is required; a
   template is "complete" only with a non-empty `persona`. A blueprint that
   only defines teammates is structurally invalid.
2. **Template identity unique** across the whole blueprint (leader included).
3. **Reference closure**: every `memberEnvelopes[].templateId` must name a
   template declared in the same document.
4. **requirements**: unique `(domain, name)` pairs.
5. **Envelope self-consistency**: no operation in both `allow` and `deny` of
   the same envelope.
6. **policyStates**: referenced fields must exist in the frozen field set.
7. **quotas**: positive integers; `maxConcurrent ≤ maxInstances` per block.

### 4.1 The `persona` requirement: declare the KIND, never a preset id

A requirement whose domain/type is `persona` names the **persona kind** the
team runtime needs — NOT the runtime preset's id. The pre-create probe
observes the selected preset's effective persona section as an OBSERVED kind
(`absent` / `standard` / `complete`; `unresolved` when it cannot be read
host-side over the DSH public `agentPresets` seam — never a guess) and the
requirement's subject is matched against that observed kind.

- The closed set of REQUIRED persona kinds (`RequiredPersonaKind`) currently
  allows exactly **`standard`** = a composable persona base (the
  prefix/suffix persona slot the Team composes its Leader/Member identity
  into). `absent` / `complete` as REQUIRED kinds are outside the closed set
  until an ADR gives them product semantics (they remain valid OBSERVED
  kinds).
- A preset satisfies `standard` when its effective persona section is
  present and composable — under ANY preset id (`standard`, `ptc`, `cordis`,
  a bespoke id).
- An unmet `complete:true` persona requirement is a structural FATAL,
  classified by the world:
  - the selected preset's effective persona is `complete` →
    `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` — a complete system persona
    cannot carry the team's Leader/Member identity (Architecture §13.5);
    not downgradeable, no Continue-anyway;
  - the world is bare / no composable persona section →
    `PERSONA_INCOMPATIBLE`.
  The remedy in both lanes: pick a preset whose persona is composable
  (`standard`), or make that preset's persona composable.
- Why kind, not id: the historical convention matched the requirement name
  against the selected preset's ID (the 2026-09-19/20
  persona-requirement-preset-id bug, `docs/issues/`: any composable preset
  whose id differs from the requirement name failed with a FATAL whose copy
  falsely claimed a "complete system persona", and the only workaround was
  renaming the requirement after the preset id — a config-level detour).
  The kind convention is user-rulled (PR #22 Direction B) and re-landed by
  the pre-Alpha.3 series (PR-E §E.3, incl. the live host-side observer).
  Naming a requirement after a preset id (e.g. `team-small-ctb`) is NO
  LONGER matched — the world fact is keyed by the observed kind.
- **Known gap: a bespoke preset id cannot satisfy `standard` from the client
  today, and no blueprint edit can fix that.** The client builds the persona
  fact from a static id table
  (`PRESET_PERSONA_KIND_ROSTER[row.id] ?? row.id`,
  `packages/client/src/model/team-intent-model.ts`) instead of a host-side
  observation, so a preset whose id is not in that table is observed as
  **its own id** — a guess, which this section forbids above. The result is a
  FATAL `PERSONA_INCOMPATIBLE` for a preset that may well have a composable
  persona. Two blueprint-side "fixes" do NOT work and must not be tried:
  naming the requirement after the bespoke id (the closed set is exactly
  `standard`, so it is refused at parse time as
  `unknown required persona kind`), and `optional: true` (a `persona`-type
  requirement is FATAL at the engine level regardless of `complete` —
  `packages/runtime/activation/checks.ts`, the documented `optional` mapping).
  What a blueprint CAN do is omit the `persona` requirement entirely (an
  empty `requirements` list parses), which stops asserting the kind — accept
  that loss explicitly rather than silently. The real fix is client-side
  (report `unresolved`, never the id) plus a seam that carries the preset's
  observed persona kind.
- Validation split: a **v2** document's structured persona requirement
  subjects are validated against the closed set at parse time (any other
  subject → `MALFORMED_DTO`, `unknown required persona kind`). A **v1**
  flat `name` is free-form at parse time (frozen v1), so an off-kind name is
  accepted by the parser but GUARANTEED to FATAL at the pre-create probe —
  treat every persona requirement name as a kind, and use `standard`.
- Existing `name: standard` blueprints stay valid unchanged (`standard` is
  both a preset id and a kind); a bespoke id (e.g. `team-small-ctx`) must
  become `standard`.

### 4.2 `schemaVersion: 2` — structured requirements (additive)

v2 keeps the entire v1 shape (the flat top-level `requirements` list still
parses unchanged) and adds two structured requirement surfaces
(`{requirementId, type, subjects, complete?}`; `subjects` = unique lowercase
slugs):

- top-level **`teamRequirements`** — team-level structured requirements
  (plan §E.2); ABSENT in v1 and in a v2 document that declares none
  (omitted, never present-but-undefined); a declared `[]` is legal;
- per-template **`requirements`** on the leader and member templates —
  requirements bound to that template; ABSENT in v1; a v2 template that
  declares none hashes byte-identically to its v1 form.

The v2 ADDITIONAL rule: a persona-TYPE structured requirement's subjects
must be closed required persona kinds — currently `standard` (§4.1). The v1
flat list is NOT re-keyed by this rule (frozen v1): its `name` still must
SEMANTICALLY be a kind (§4.1), even though the parser does not reject an
off-kind name.

### 4.4 `schemaVersion: 4` — the optional `toolBindings` family (v4 flip round)

v4 is the v3 face UNCHANGED plus ONE optional top-level field. Authoring
facts (grammar machine-pinned by `a5sr1`–`a5sr5` + `a5fl1`; every omission
is a typed refusal — there are NO implicit defaults):

- `toolBindings` — an array (absent = declares nothing; a non-array is a
  defect). Each entry is EXACTLY the closed set `owner`, `name`,
  `authorization`, `io`, `execution`; every field is required; unknown keys
  are refused at their full path, and the REMOVED v2-proposal fields
  (`kind`, `adapterId`, `runnerId`, `shadowExecute`) are refused BY NAME.
- `authorization` — `allow` | `ask` | `deny` (no case folding).
- `io` — exactly `read`, `write`, `network` (all three required):
  - `read` / `write` lanes: `mode: all` carries only `deny[]`;
    `mode: restricted` carries `allow[]`, `ask[]`, `deny[]` (a `..` segment
    in any path is refused; a legal trailing space survives verbatim);
  - `network` lane: `mode: allow` (no other keys), `mode: deny` (+`default`),
    `mode: restricted` (+`allow[]`, `ask[]`, `deny[]`, `default`), with
    `default` ∈ `ask` | `deny` — a never-defaulted lane never guesses wide.
- `execution` — exactly `implementationOrigin` (`dsh-native` |
  `team-trusted-extension` | `standalone-runner` | `remote-provider`) and
  `executionBoundary` (`trusted-host` | `confined-subprocess` |
  `delegated-remote`) — the three-axis facts, all written explicitly.
- Identity: the family is PRESENT-ONLY IN THE HASH — two v4 documents
  differing only in `toolBindings` are different blueprints. The key at v3
  is an unknown field (refused); nothing at v3 changed.
- Production posture: the family PARSES, FREEZES and HASH-BINDS today; the
  runtime effect plane does not yet EXECUTE these lanes (effect-queue
  round). The first AUTHORED v4 document is the write-format point of no
  return (翻档 ≠ 退役; window duration/exit = T-1 pending, not pre-set).

## 5. Capabilities (per template)

Absent `capabilities` = legacy mode (rc.1 behavior, everything inherited).
When present, all four base sub-fields are required:

- `teamTools` — `{kind: allow, items: [team tool names]}` or `{kind: deny}`
  (deny = zero team tools for that agent).
- `builtinToolDeny` — a plain string array of exact built-in tool names to
  deny for that agent (the blacklist must actually remove the tools from the
  agent's visible surface, e.g. `bash`, `write`, `edit`). It reaches only the
  **global (restrictable) tool layer** of the agent — tools the host preset
  installs into the agent's **own** tool layer are not deny-able this way
  (see §5.2).
- `skills` — allow/deny entry for Team-managed skills.
- `mcp` — allow/deny entry for MCP servers. **Initial grant
  (mcp-blueprint-initial-grant fix)**: a template
  `capabilities.mcp: {kind: allow, items: [...]}` is the role's INITIAL
  governance grant — after team creation (fresh root / fresh member) and
  across cold resumes, those servers are mounted immediately WITHOUT any
  `override.set` (the effective governance cell's initial value; later
  record-backed layers — PolicyState / overlays / human override — and the
  external hard policy still intersect on top). `kind: deny`, an EMPTY
  `allow` (`items: []`, legal YAML but normalizes to "no initial grant"),
  and legacy templates (no `capabilities` at all) grant NOTHING — the cell
  stays `unspecified` (fail-closed: nothing mounts). Names must be among
  the row's configured `mcpServers`.

`items` entries are non-empty strings, max 128 chars.

### 5.1 `permissions` (static parameter-aware operation permissions)

```yaml
permissions:
  default: ask          # REQUIRED: ask | deny (a default of 'allow' is REJECTED)
  allow:
    - { tool: read, resource: { kind: subtree, value: /home/user/data } }
    - { tool: write, resource: { kind: exact, value: out/report.md } }
    # LEADER template only (dual-gated — see below):
    # - { tool: bash, resource: { kind: any } }
  ask:
    - { tool: bash, resource: { kind: any } }
  deny:
    - { tool: read, resource: { kind: exact, value: /etc/shadow } }
```

Rules (closed vocabulary; anything else is a `MALFORMED_DTO`):

- `default` is `ask` or `deny` — never `allow` (no silent privilege
  expansion).
- `allow` / `ask` / `deny` are required arrays (each may be empty). Rules keep
  declaration order; duplicates are legal.
- `tool` — one of the seven managed tools: `read`, `read_image`, `write`,
  `edit`, `lsp`, `bash`, `pwsh`.
- `resource` — `kind` is `exact` (a file key), `subtree` (a containment root
  — judged by the public `FileSystem.contains` seam over file identities), or
  `any` (the whole tool).
- **Shell class (`bash` / `pwsh`)**:
  - `exact` is rejected in EVERY lane of EVERY role (an exact key is a
    file key and can never match the tool-level shell resource);
  - `subtree` is rejected in EVERY lane of EVERY role (a subtree root is
    a file target);
  - `any` in the **allow** lane is rejected on **MEMBER** templates (no
    positive whole-tool permission for a member shell); on the **LEADER
    template** the allow lane MAY carry `{ tool: bash|pwsh, resource:
    { kind: any } }` (exec-autonomy-contract, user ruling 2026-09-18) —
    an explicit, declared whole-tool exec authorization. It is INERT
    unless the **DUAL GATE** holds: the leader's effective mutation
    envelope (`teamEnvelope` ∩ the leader template's `memberEnvelopes`
    entry, fail-closed) must carry the matching exec token (`'bash'` or
    `'pwsh'` — separate tokens; `bash authority != pwsh authority`).
    Missing token → the call is downgraded to the `user-approval` ask
    path (human decides). There is NO implicit default-allow: an absent
    rule still resolves to `policy.default`. `any` in the `ask` / `deny`
    lanes stays legal in every role (the minimal shell permission).

### 5.2 Interaction with the host preset (measured live on a **0.1.5-rc.2** host, 2026-09-14 — ERA-FLAGGED: read the era note at the end of this section)

The agent's tool surface is composed by the **host preset** (e.g. the shipped
`standard`) plus this blueprint's capabilities. Three host-contract facts
matter when you author strict `capabilities.permissions` for an agent whose
preset is a non-minimal shipped one:

1. **The preset's spawn `subagent` is not deny-able.** The shipped
   non-minimal presets (`standard`, `cordis`, `ptc`) install the `subagent`
   tool into the agent's **own** tool layer through a deferred install that
   runs at publication (`agent/created`). `builtinToolDeny` reaches only the
   global layer — listing `subagent` there fails setup with
   `unknown global tool "subagent"`.
2. **The coverage gate reads the surface before that install lands.** The
   permission Coverage Gate reads the agent surface during composition, i.e.
   **before** publication; the deferred own-layer install lands on the
   model-facing surface milliseconds after the gate. Verified A/B/C on
   0.1.5-rc.2: `subagent` absent from the gate read, present in the model's
   first request (and in every post-publication surface snapshot). So for
   such an agent the gate-verified surface is NOT the model-facing surface —
   do not count on the gate having checked `subagent`.
3. **`subagent_fork` IS deny-able — and must be.** It installs immediately in
   the global layer, and it is classified known-sensitive: a strict agent
   that neither denies nor manages `subagent_fork` is rejected by the
   coverage gate (known-sensitive-unmanaged FATAL).

Practical rule: for a strict-permission agent, either choose a preset that
does not mount the spawn subagent (the shipped `minimal` preset has no
`subagent`; its only managed tool `bash` takes an allow-lane rule on the
LEADER template — the §5.1 leader exception, dual-gated by the mutation
envelope — and stays ask/deny-only on members), or keep `subagent_fork` in
`builtinToolDeny` and accept
that the model will still see `subagent` post-gate (open P1 finding as of
2026-09-14; no shipped fix yet — the own-layer surface-shrink line is tracked
as **SG-C2** in `docs/plans/memo/post-alpha4-debt-register.md`, status 延期).

**Era note for items 1–2 (doc-sync 2026-10-18, no re-verification claimed).**
These three facts were measured live on a **0.1.5-rc.2** host on 2026-09-14.
The pinned host generation of this repo has since moved twice — the canonical
pin is now **0.2.0-rc.2 @ `639ed01539`** (`tests/paths.mjs`:
`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA`, the single source for the
generation; per `AGENTS.md` no kit may hardcode a generation). **No live
re-verification of items 1–2 on the current pin is on record in this repo** —
the only post-upgrade record naming this surface is the fixture-side
`dev/agent-workflow/evidence/dsh-020rc2-upgrade/03-team-tool-deny-least-privilege.md`,
which measures the `team_*` deny-name round, not the preset's spawn-subagent
install order. So: item 3 is enforced by **this repo's own** coverage gate
(closed known-sensitive registry,
`packages/runtime/operation-permission/permission-coverage.ts:154`) and stays
generation-independent; items 1–2 are host-behavior claims carrying a
0.1.5-rc.2 measurement date — re-check them on the pin before you design
anything that depends on the gate having (or not having) seen `subagent`.

**C2 (subagent descendant governance) — open backlog, temporary risk.**
DSH subagent descendants do not inherit the Team member's agent-local
parameter-permission / builtin-deny governance: a Team member can delegate
to an in-process subagent that inherits the parent preset standing
composition but NOT the member's agent-local permission listener/guard.
No hard plugin-level deny exists in this release, and
`builtinToolDeny: [subagent]` is **NOT** a reliable mitigation on the
non-minimal presets (item 1 above proves the tool is not restrictable
there). While C2 remains open, the safe authoring options are:

1. use a preset that does not mount the spawn `subagent` tool (the shipped
   `minimal` preset is the known example); or
2. use a custom preset/composition that does not install `subagent`.

If a project intentionally keeps a standard/cordis/ptc preset with
`subagent` visible to the model, record C2 as an ACCEPTED TEMPORARY RISK in
the team's design notes until the descendant-governance work is completed.
If a future rc.2-compatible plugin change makes `subagent` genuinely
restrictable by `builtinToolDeny`, update this guidance ONLY after a
post-publication model-surface test proves the tool is actually removed
from the model-facing surface.

### 5.3 The Leader's team-tool surface (the approval loop)

A Leader that must perform leader-level approvals should expose the closed
approval-loop tools in its `teamTools` allow list:

```yaml
capabilities:
  teamTools:
    kind: allow
    items:
      - team_list_pending_control   # discover exact pending requestIds (read-only)
      - team_resolve_control        # record the allow/deny decision
```

(`team_request_control` belongs on the surface only when the Leader itself
issues explicit control requests for its own operations.)

Two facts keep the loop honest:

- **tool exposure is not authority**: listing these tools in `teamTools`
  gives the Leader the model-facing surface; the resolver-role closure in
  the control service (Leader or human for `leader-approval`; human only
  for `user-approval`; a member is never a resolver) remains the
  authoritative decision check — a denied resolve fails closed regardless
  of the tool list.
- **the envelope still gates the operation**: the Leader's Team envelope
  must permit the existing `resolve-control` operation (and
  `request-control` when that tool is exposed), exactly as before —
  `team_list_pending_control` is a read and adds no envelope operation.

### 5.4 The lifecycle tool: `team_archive_member` (exposure vs. authority)

`team_archive_member` (the 13th closed team tool; the Leader's
lifecycle-management surface — moving a member out of the active work set)
behaves like every other team tool under a **selective** template:

```yaml
capabilities:
  teamTools:
    kind: allow
    items:
      - team_archive_member
```

- **`teamTools` is model-facing exposure ONLY**: it decides whether the
  tool appears on that Agent's model surface. It grants no authority by
  itself — a selective LeaderTemplate whose allow list does NOT contain
  `team_archive_member` never sees the tool, even though the plugin's
  catalog offers it.
- **the envelope must still permit the operation**: the Leader's
  effective envelope must allow the existing `archive-member` operation
  token (the LIFECYCLE class). Exposure without the envelope token yields
  a tool that is rejected at the runtime authority; the envelope token
  without exposure yields an authority the model cannot reach. **Both are
  required; neither implies the other.**
- **legacy templates are unaffected**: a blueprint WITHOUT a
  `capabilities` field stays in legacy mode and inherits the FULL
  catalog — today **fifteen** tools (the thirteen static specs plus
  `team_grant_permission` / `team_revoke_permission`, materialised together at
  `packages/tools/src/tools.ts:1524-1541`; legacy mode = `[...catalog]`,
  `packages/runtime/src/plugin/live/agent-bindings.mjs:2391-2394`).
  `team_archive_member` is part of it, and so is anything a later round adds to
  the catalog — a legacy template follows the catalog, it does not pin a count.
- **already-created Teams use the frozen Blueprint snapshot**: the bound
  blueprint source is snapshotted into the TeamSession at creation. A
  plugin upgrade that adds a NEW tool to the catalog does NOT inject it
  into an existing selective Team — that Team's snapshot keeps its
  original allow list. To give an old blueprint DESIGN the archive
  surface, author a NEW blueprint revision (the allow list gains
  `team_archive_member`; the Leader envelope already carries
  `archive-member` in the standard shape) and bind a NEW TeamSession to
  that revision. Bypassing the frozen snapshot — or dynamically patching
  a bound blueprint at runtime — is NOT a supported way to roll the tool
  out.

## 6. Pre-flight checklist (static)

Run these in order on the authored file; stop at the first failure and fix:

1. **Structure** — one frontmatter record, `---` closed, no markdown body,
   YAML decodes.
2. **Identity** — `schemaVersion: 1`; `blueprintId` grammar (no `@`, no
   whitespace, ≤128); `revision` a positive integer.
3. **Closed fields** — no unknown field at any level; no `memberId` anywhere.
4. **Leader** — present, `templateId` set, `persona` non-empty.
5. **Templates** — all `templateId`s unique (leader included); every
   `memberEnvelopes[].templateId` resolves.
6. **Capabilities** (per template, when present) — the four required
   sub-fields; `permissions` (when present): `default` ∈ {ask, deny}; the
   three lanes present; rule `tool` in the seven-name vocabulary; resource
   `kind` in {exact, subtree, any}; the shell-class rejections of §5.1
   (allow-lane `any` rejected on MEMBERS only — the leader exception is
   legal but runtime-dual-gated; exact/subtree rejected for every role).
7. **Requirements** — unique `(domain, name)`; a `persona` requirement's
   name/subject is a persona KIND (`standard` — the only closed required
   kind today), never a preset id (§4.1); v2 structured requirements:
   `requirementId`/`type`/`subjects`/`complete` grammar (§4.2).
8. **Envelopes** — operation token grammar; no operation in both `allow` and
   `deny`.
9. **policyStates** — `fields` reference only frozen fields.
10. **quotas** — positive integers; `maxConcurrent ≤ maxInstances`.

The checklist mirrors the strong validator, but the authoritative check is
the host's resolution — step 7.

## 7. Live pre-flight (host running)

If the team plugin is installed and the host is up (web profile, port P —
the default shipped profile uses the port from the boot line `dsh web:
http://127.0.0.1:P/...`), the remote seam is reachable at
`/team-remote/<endpoint>`:

```bash
# 1) the saved source appears in the catalog (identity-level, weak):
curl -s http://127.0.0.1:P/team-remote/catalog.list \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"pre-1","method":"catalog.list","payload":{"version":4,"params":{}}}'

# 2) the exact revision RESOLVES (strong parse — the real pre-flight):
curl -s http://127.0.0.1:P/team-remote/catalog.get \
  -H 'content-type: application/json' \
  -d '{"type":"client-request","rpcId":"pre-2","method":"catalog.get","payload":{"version":4,"params":{"blueprintId":"my-team-bp-1","blueprintRevision":1}}}'
```

Interpretation:

- the file **lists** but **fails to resolve** → the document carries a valid
  identity but is logically broken; the error carries the strong parser's
  exact diagnosis — fix and re-query (rescan is per-request, no restart);
- `catalog.get` succeeds → the blueprint is ready: create the team with
  `team.create` (same `blueprintId`/`blueprintRevision`) or via the Team UI
  (新建团队 → pick the blueprint);
- HTTP 405 on `/team-remote` → the remote channel is not mounted on this
  host (check that the dsh-agent-team plugin row is present and booted — see
  the host boot log's remote-mount outcome line);
- if the deployment has no `blueprintDir`, no saved source will ever list —
  that is a config gap, not a blueprint defect.

## 8. Revisioning

A resolved revision is **immutable**: an existing team keeps its bound
snapshot for its lifetime. To change a design, author a NEW file with the
same `blueprintId` and a bumped `revision`; new teams pick the new revision,
existing teams keep the old one. Never edit the file of a revision a team is
already bound to in place (frozen revisions replay their stored source).

## 9. Common mistakes

- Writing a markdown body or prose around the frontmatter.
- A `blueprintId` containing `@` or whitespace.
- Forgetting `persona` on the leader (or leaving it empty) — the most common
  structural FATAL.
- Writing a runtime preset id (e.g. `team-small-ctb`) as a `persona`
  requirement name — under the persona-KIND convention the pre-create probe
  matches the OBSERVED kind, never a preset id, so such a name can never be
  satisfied: the probe FATALs (`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` when
  the selected preset's persona is complete, `PERSONA_INCOMPATIBLE`
  otherwise) — §4.1.
- Putting an operation in both `allow` and `deny` of one envelope.
- `permissions.default: allow` — always rejected.
- Giving `bash`/`pwsh` an `exact`/`subtree` resource (any role), or an
  allow-lane `any` for a shell tool on a MEMBER template (the leader
  allow-lane exception is legal but needs the mutation-envelope exec
  token or the call downgrades to human approval — §5.1 dual gate).
- Denying the preset's own-layer spawn `subagent` in `builtinToolDeny`
  (setup fails with `unknown global tool "subagent"`), or assuming its
  absence from the gate surface means the model never sees it (on the
  0.1.5-rc.2 standard-preset agents that were measured it is installed
  post-gate — §5.2, era-flagged: not re-verified on the pinned
  0.2.0-rc.2 host).
- Leaving `subagent_fork` undecided on a strict standard-preset agent
  (known-sensitive unmanaged → coverage gate FATAL — §5.2).
- Expecting an edited file to change an already-created team — it does not.
- Authoring into a directory that no `blueprintDir` config points at.

---

## Alpha.4 adjudications affecting what you may author (2026-10-08)

**(1) Blueprint document versions — the §7.3 cutover, and what actually RUNS.**
The sections above describe the **v1** and **v2** document shapes; they remain
correct for reading and diagnosing existing blueprints. Once §7.3 lands,
`SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]`: a v1/v2 blueprint is **not
migrated for you**. It is still *listed* in `catalog.list` with
`migrationState: 'migration-required'`, and its **start/resume is refused with
zero agent creation and no acknowledgement path** — a confirmation dialog is not
a migration. **Alpha.4 ships no migrator** (user adjudication, 2026-10-08):
migration is a manual authoring task, and the field-by-field semantics live in
`docs/plans/active/alpha4-permission-governance/` (ADR + spec), not here. When
authoring anything new, author the current supported version and declare the
hard envelope explicitly — do not rely on a pre-v3 default.

_Which run set "the current supported version" names moved after Alpha.4, and
this file said nothing about it until now (doc-sync 2026-10-18; every line below
was read off the code at the SHA it names):_

- **On master today (`7ab56dbf`) the run set is `[3]`.**
  `packages/domain/blueprint/src/schema.ts:75` reads
  `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS: readonly number[] = [3]`, so a
  `schemaVersion: 4` document is refused `SCHEMA_VERSION_MISMATCH`. On master,
  **v3 is the only version to author against.**
- **The v4 GRAMMAR already exists — DORMANT** (`382e5fb6`, PR #316, the
  reversible half): the fourth parser ships **unwired**
  (`packages/domain/blueprint/src/blueprint-v4.ts`, whose header section is
  titled "WHY THIS FILE IS NOT WIRED": *"NOTHING shipped reaches the functions
  below"*), alongside the v4 authoring maps and the migration report. The §4.4
  closed grammar is machine-pinned by `packages/domain/test/a5sr1-…` through
  `a5sr5-…` (NEG 33/33). Dormant = it parses in tests, it runs nowhere.
- **The enablement route is public** (`71af4f64`, PR #320, doc-only): a
  4-stage table; stages 1–3 are ADR-gate-normal (no user ruling needed),
  stage 4 is gated **only** on T-1.
- **The flip is a CANDIDATE, not a delivered fact**: `a7a1cfd2`
  (`alpha5-v4-flip`, **PR #324 — pending, not on master**) is the stroke that
  moves the constant to `[3, 4]`; it is what makes the `{3, 4}` wording of §2,
  §4.4 and `docs/blueprint-authoring.md` literally true on the tree that carries
  it. Read those sections as **what the candidate accepts** until it merges. The
  ADR (`docs/plans/memo/alpha5-tool-io-governance/ADR-vnext-blueprint-schema-v4.md`)
  carries the window law either way: **翻档 ≠ 退役** — the flip is not a
  retirement, and its duration/exit is the T-1 pending ruling, pre-set nowhere.
- **Effect posture, both generations**: a v4 document's `toolBindings` is
  parsed, frozen and hash-bound; the runtime effect plane does not yet EXECUTE
  those lanes. Authoring v4 is safe-but-dark for effects and irreversible for
  identity.
- **Retired set is generation-stable**: **1** and **2** stay defined-but-retired
  (`migration-required`, operator owns the migration); a never-defined version
  keeps its typed parse refusal.

**(2) A shell-class rule narrowed below `allow` is a one-way door in Alpha.4.**
If an envelope or member overlay caps a shell-class command at `ask`, executing
that command requires the rung that owns the envelope, i.e. **Human Admin**, and
Alpha.4 has **no Human Admin resolver**: `CONTROL_UNRESOLVABLE_AUTHORITIES =
['human-admin']`, so the control case is closed **synchronously** as
`authority-unavailable` with a leg row that is *born terminal* plus its terminal
deny (ADR A1-12) — never a pending item, never retried, and **nothing at runtime
can release it**. There is no approval affordance to click. The narrowing itself
succeeds; the door only closes.

  Authoring rule that follows: do **not** author a blueprint that depends on a
  shell-class command being escalated above `ask`, and do not design a workflow
  whose happy path is "narrow it now, approve it later". If a blueprint needs a
  shell command gated, gate it at the **blueprint** layer with an explicit
  envelope rule at the intended effect, so the decision is made at authoring
  time rather than at execution time by a resolver that does not exist. No
  fixture or shipped blueprint configuration does this today; the first real
  host that writes one hits it cold, which is why it is written here. **Tracked
  as a post-Alpha.4 item** (a Human Admin resolver, or a pre-flight refusal of
  envelope declarations that create the door).
