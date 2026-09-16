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
  `[a-z][a-z0-9._-]{0,127}`).
- **member envelope entry**: `templateId`, `envelope`.
- **policy state**: `id` (lowercase slug ≤64), `description`, `fields`.
- **quota spec**: `team`, `members`; each `{maxInstances, maxConcurrent}`.
- the legacy field `memberId` is rejected at **any** depth.

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
- `mcp` — allow/deny entry for MCP servers.

`items` entries are non-empty strings, max 128 chars.

### 5.1 `permissions` (static parameter-aware operation permissions)

```yaml
permissions:
  default: ask          # REQUIRED: ask | deny (a default of 'allow' is REJECTED)
  allow:
    - { tool: read, resource: { kind: subtree, value: /home/user/data } }
    - { tool: write, resource: { kind: exact, value: out/report.md } }
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
  - `exact` is rejected in EVERY lane (an exact key is a file key and can
    never match the tool-level shell resource);
  - `subtree` is rejected in EVERY lane (a subtree root is a file target);
  - `any` in the **allow** lane is rejected (no positive whole-tool
    permission for shell); `any` in the `ask` / `deny` lanes is the minimal
    legal shell permission.

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
`subagent`, but its only managed tool `bash` cannot take an allow-lane rule —
§5.1 shell class), or keep `subagent_fork` in `builtinToolDeny` and accept
that the model will still see `subagent` post-gate (open P1 finding as of
2026-09-14; no shipped fix yet).

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
   `kind` in {exact, subtree, any}; the shell-class rejections of §5.1.
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
- Giving `bash`/`pwsh` an `exact`/`subtree` resource, or an allow-lane `any`
  for a shell tool.
- Denying the preset's own-layer spawn `subagent` in `builtinToolDeny`
  (setup fails with `unknown global tool "subagent"`), or assuming its
  absence from the gate surface means the model never sees it (on 0.1.5-rc.2
  standard-preset agents it is installed post-gate — §5.2).
- Leaving `subagent_fork` undecided on a strict standard-preset agent
  (known-sensitive unmanaged → coverage gate FATAL — §5.2).
- Expecting an edited file to change an already-created team — it does not.
- Authoring into a directory that no `blueprintDir` config points at.
