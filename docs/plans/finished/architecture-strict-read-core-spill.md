# Architecture — Strict-read + Core-spill Compatibility

**Status**: Accepted design  
**Baseline**: `dsh-agent-team` master @ `d63cb71441e0b7af0c6bd167ab4c4ccf24040777`; DSH `0.1.5-rc.2` @ `fb2c4b9e69`  
**Boundary**: plugin-layer only; no DSH source patch

## 1. Objective

Enable a Team Agent under strict-read to recover its own DSH-produced spill artifacts outside the workspace without weakening ordinary out-of-workspace read isolation.

The architecture must distinguish:

```text
"the model knows a locator"
```

from:

```text
"the runtime authenticated this exact artifact as belonging to this InstanceId"
```

Only the latter grants read authority.

## 2. Existing authority planes

### Team static permissions

Current Team operation permissions support:

- file tools: `read`, `read_image`, `write`, `edit`, `lsp`;
- shell tools: `bash`, `pwsh`;
- resources: `exact`, `subtree`, `any`;
- static priority: `deny > ask > allow > policy.default`.

The runtime additionally applies durable approval/control logic, external-hard last-mile checks, and a monotonic end-cap guard.

### DSH filesystem semantics

DSH `workspace-write` confines mutations, not reads. The Team plugin intentionally adds a stricter confidentiality boundary, so legitimate DSH spill files outside the workspace can be blocked.

### Team identity and lifecycle

Security principal = durable `InstanceId`.

A DSH Session/Agent is only a runtime incarnation.

Members follow:

```text
CREATED / RUNNING / SETTLED / ARCHIVED / DISPOSED
```

Restore is `ARCHIVED -> SETTLED`; `DISPOSED` is terminal.

## 3. High-level architecture

```text
                     DSH artifact producers
                              |
          +-------------------+--------------------+
          |                                        |
   SpillStore-backed                        shell early-spill
      producers                               foreground
          |                                        |
          v                                        v
TeamAwareLocalSpillStore                    tools/result adapter
(provider replacement)                     structured spillPath
          |                                        |
          +-------------------+--------------------+
                              |
                              v
                   TeamArtifactAuthority
                              |
                  resolve + stat + owner bind
                              |
              +---------------+----------------+
              |                                |
              v                                v
       TeamLedger fact                 ArtifactReadRegistry
   artifact-read-granted                runtime projection
              |                                |
              +---------------+----------------+
                              |
                              v
                         read gate
```

## 4. Spill provider interposition

### Why the provider is the right seam

Current DSH consumers such as:

- `dsh-spill-policy`;
- grep/glob formatted-result recovery;
- session-reference spill;

all eventually call:

```text
ctx.spillStore.saveText(...)
```

Therefore one provider replacement can capture trusted provenance for all of them without copying their policies.

### TeamAwareLocalSpillStore

The Team plugin exports a host provider subclassing public DSH `LocalSpillStore`.

Conceptual shape:

```ts
class TeamAwareLocalSpillStore extends LocalSpillStore {
  override async saveText(input) {
    const ref = await super.saveText(input)

    const authority = resolveTeamArtifactAuthority(this.ctx)
    if (authority !== undefined) {
      await authority.recordIfManaged({
        ownerSessionId: String(input.owner.sessionId),
        source: input.source,
        locator: String(ref.locator),
        bytes: ref.bytes,
      })
    }

    return ref
  }
}
```

Requirements:

- `super.saveText` remains the only storage implementation;
- inherited DSH config and cleanup remain authoritative;
- returned `SpillRef` is not rewritten;
- full spill content is not copied into Team state;
- no DSH notice or retention logic is duplicated;
- non-Team sessions behave as upstream.

## 5. Composition replacement

The `dsh-agent-team` bundle layer replaces the final effective row:

```text
id: spill-local
```

with the Team provider.

The upstream `spill-policy` row remains untouched.

A real-profile composition test must prove the effective provider; YAML inspection alone is insufficient.

## 6. TeamArtifactAuthority

Suggested runtime package:

```text
packages/runtime/artifact-read/
  types.ts
  digest.ts
  fact.ts
  registry.ts
  authority.ts
```

It is the sole owner of grant semantics.

### Input sources

Trusted producer classes:

1. SpillStore-backed artifacts:
   - owner session id;
   - `SpillSource`;
   - `SpillRef`.

2. Foreground shell:
   - current Team Agent / `InstanceId`;
   - canonical tool result;
   - structured stdout/stderr spill paths.

3. Optional background shell adapter:
   - only if a thin plugin-layer provider wrapper can observe structured `ShellProcessRead`.

## 7. Session -> InstanceId mapping

Mapping uses durable Team identity only:

```text
root Team session    -> inst-leader
member child session -> owning MemberInstance.instanceId
other session        -> unmanaged
```

Never infer identity from:

- templateId;
- label;
- group;
- workspace;
- path;
- current live map alone.

## 8. ArtifactReadGrant

Conceptual durable payload:

```ts
interface DurableArtifactGrant {
  instanceId: string
  locator: string

  targetKeyDigest: string
  versionDigest: string

  source:
    | {
        kind: 'spill-store'
        producerKind: 'tool' | 'session-reference'
        toolName?: string
        callId?: string
        label: string
      }
    | {
        kind: 'shell-foreground'
        toolName: 'bash' | 'pwsh'
        callId: string
        stream: 'stdout' | 'stderr'
      }
    | {
        kind: 'shell-background'
        toolName: 'bash' | 'pwsh'
        stream: 'stdout' | 'stderr'
        jobId?: string
      }
}
```

Exact field names are implementation details; authority semantics are not.

## 9. Opaque identity and freshness

At grant creation:

1. `ctx.fs.resolve(locator)`;
2. `ctx.fs.stat(target)`;
3. require regular file;
4. hash opaque `targetKey`;
5. hash opaque `FsVersion`;
6. persist grant;
7. install runtime candidate.

Use domain-separated hashes, e.g.:

```text
sha256("dsh-agent-team/artifact-target-key/v1\0" + token)
sha256("dsh-agent-team/artifact-version/v1\0" + token)
```

Do not interpret either opaque token.

At read authorization, repeat resolve/stat and compare digests.

Consequences:

- deleted artifact -> inactive;
- replaced artifact -> inactive;
- rewritten artifact -> inactive;
- same path reused -> inactive unless identity/version still match;
- unsupported/non-file locator -> inactive.

## 10. Durable authority

Use existing TeamLedger fact:

```text
artifact-read-granted
```

Do not add a tenth TeamDomain store.

The durable fact is audit history. `ArtifactReadRegistry` is only a projection/cache.

The grant remains recorded forever, but active authority is conditional on:

- same principal;
- valid lifecycle;
- current artifact identity/freshness;
- absence of higher-priority deny.

## 11. Lifecycle

```text
CREATED / RUNNING / SETTLED -> eligible
ARCHIVED                    -> dormant
DISPOSED                    -> terminally inactive
```

Restore reuses the same `InstanceId`, so old valid grants may become active again.

No `artifact-read-revoked` fact is added.

## 12. Permission integration

The existing pure resolver remains unchanged.

Use its provenance to distinguish explicit deny from default deny.

Pseudo-flow:

```text
canonicalize operation
  |
  +-- failure -----------------------------> DENY

canonicalize rules
  |
  +-- deny-lane failure -------------------> DENY

resolve static policy
  |
  +-- explicit deny rule -----------------> DENY

external-hard check
  |
  +-- denied ------------------------------> DENY

if tool == read:
    if valid ArtifactReadGrant for this InstanceId and exact artifact:
        mark current exec authorized
        next()

otherwise:
    existing allow / ask / default path
```

Important semantics:

- explicit deny beats grant;
- explicit ask can be bypassed by valid grant;
- default deny can be bypassed by valid grant;
- external-hard beats grant;
- artifact grants apply only to `read` in this version;
- grant-allowed executions must use the existing `authorizedExecutions` end-cap mark; do not add a second guard.

## 13. SpillStore-backed issuance

```text
DSH consumer
  |
  v
TeamAwareLocalSpillStore.saveText()
  |
  +-- super.saveText()
  |
  +-- TeamArtifactAuthority.recordIfManaged()
          |
          +-- bind owner session -> InstanceId
          +-- resolve/stat
          +-- append ledger fact
          +-- registry install
  |
  v
return SpillRef
```

For a managed strict-read session, grant persistence is awaited before returning the ref.

If storage succeeds but grant persistence fails:

```text
Team provider throws
-> upstream spill consumer uses its existing fallback
-> written file is an orphan handled by DSH cleanup
```

This preserves “visible locator implies durable grant” for SpillStore-backed artifacts.

## 14. Foreground shell

`bash` / `pwsh` foreground results already retain structured provenance:

```text
stdout.spillPath
stderr.spillPath
```

An agent-scoped `tools/result` observer issues grants from the canonical value.

Never parse result text.

## 15. Background shell

Background shell keeps structured spill paths only until `ShellProcessRead` is rendered into plain text.

If included in this version, solve only at plugin layer:

- replace `bash-sandbox` / `pwsh-sandbox` with thin Team subclasses;
- preserve all `super` execution behavior;
- bind owner from trusted DSH-managed `DSH_SESSION_ID` in `ShellExecSpec.dshEnv`;
- observe structured stream spill paths before text rendering.

If this cannot be done without copying upstream tool/executor logic, defer background-shell recovery. Do not patch DSH and do not parse `job_output` text.

## 16. Failure semantics

### Locator known by another member

Principal mismatch -> deny.

### DSH cleanup deletes file

Fresh stat fails -> inactive.

### File replaced

Version digest mismatch -> inactive.

### External hard tightens

External-hard deny -> deny.

### Blueprint later adds explicit deny

Explicit deny -> deny.

### Backend restart

Rebuild registry from durable facts, then fresh-resolve/stat before authorization.

## 17. Security invariants

1. locator strings never mint authority;
2. rendered text never mints authority;
3. only `read` consumes ArtifactReadGrant;
4. grant principal is exactly one durable `InstanceId`;
5. explicit deny and external-hard remain ceilings;
6. filesystem identity comes only from DSH `fs` seams;
7. freshness comes only from DSH `FsVersion`;
8. no DSH path format is parsed;
9. no DSH source is modified;
10. no broad temp-root exception is introduced.

## 18. Maintenance boundary

Per DSH version bump, probe only:

1. `LocalSpillStore` remains subclassable;
2. `saveText(input) -> SpillRef` is compatible;
3. `spill-local` row replacement still works;
4. `ctx.fs.resolve/stat` and `FsVersion` are compatible;
5. foreground shell canonical result still has structured spill paths;
6. optional shell-provider subclass seam still exists.

Do not mirror:

- DSH spill-policy code;
- notice strings;
- grep/glob retention;
- spill root naming;
- cleanup implementation.

## 19. Accepted debt

- no capability transfer;
- no Team-wide sharing;
- no artifact grant for grep/glob/read_image/lsp/write/edit;
- non-filesystem spill backends fail closed;
- background shell spill may be deferred if the provider wrapper is not thin enough.
