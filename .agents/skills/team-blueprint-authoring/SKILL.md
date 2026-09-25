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
schemaVersion: 1
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
---
```

Structural rules (all fail loudly with a classified reason):

- the document is exactly one YAML frontmatter record between `---`
  delimiters; a markdown body is rejected (`markdown-body-not-allowed`);
- BOM is stripped, CRLF normalized, the YAML must decode cleanly;
- identity fields:
  - `schemaVersion` — positive integer, currently **1** is the only supported
    value;
  - `blueprintId` — non-empty, ≤128 chars, no whitespace/control characters,
    no `@` (reserved for the `blueprintId@revision` form);
  - `revision` — a positive integer (the shipped convention writes it
    quoted, e.g. `"1"`).

## 3. The frozen field sets (unknown fields fail)

- **Top level (14)**: `schemaVersion`, `blueprintId`, `revision`,
  `displayName`, `description`, `leader`, `members`, `requirements`,
  `teamEnvelope`, `memberEnvelopes`, `policyStates`, `quotas`,
  `capabilityPolicy`, `metadata`.
- **Template (leader and members share one schema)**: `templateId` (required),
  `displayName` (≤128), `description` (≤4096), `persona` (**required**,
  non-empty, ≤32768), `modelPreference`, `contextPolicy`, `capabilities`.
- **capabilities**: `teamTools`, `builtinToolDeny`, `skills`, `mcp` (all four
  REQUIRED when the block is present) + optional `permissions`.
- **permissions policy**: `default`, `allow`, `ask`, `deny` (all required).
- **permission rule**: `tool`, `resource`.
- **requirement**: `domain`, `name`, `optional`.
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

### 5.2 Interaction with the host preset (live-verified on a 0.1.5-rc.2 host, 2026-09-14)

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
2026-09-14; no shipped fix yet).

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
  thirteen-tool catalog — `team_archive_member` is part of it.
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
7. **Requirements** — unique `(domain, name)`.
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
- Putting an operation in both `allow` and `deny` of one envelope.
- `permissions.default: allow` — always rejected.
- Giving `bash`/`pwsh` an `exact`/`subtree` resource (any role), or an
  allow-lane `any` for a shell tool on a MEMBER template (the leader
  allow-lane exception is legal but needs the mutation-envelope exec
  token or the call downgrades to human approval — §5.1 dual gate).
- Denying the preset's own-layer spawn `subagent` in `builtinToolDeny`
  (setup fails with `unknown global tool "subagent"`), or assuming its
  absence from the gate surface means the model never sees it (on 0.1.5-rc.2
  standard-preset agents it is installed post-gate — §5.2).
- Leaving `subagent_fork` undecided on a strict standard-preset agent
  (known-sensitive unmanaged → coverage gate FATAL — §5.2).
- Expecting an edited file to change an already-created team — it does not.
- Authoring into a directory that no `blueprintDir` config points at.
