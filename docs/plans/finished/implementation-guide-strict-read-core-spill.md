# Implementation Guide — Strict-read + Core-spill

**Audience**: local implementation agent  
**Goal**: implement the accepted plugin-layer architecture with no DSH core edits.  
**Baseline**: `dsh-agent-team` master @ `d63cb71441e0b7af0c6bd167ab4c4ccf24040777`; DSH `0.1.5-rc.2` @ `fb2c4b9e69`.

## 0. Hard constraints

Do not:

- edit or patch the user's DSH checkout;
- edit `tests/deepseek-harness-test-use`;
- add `patch-package`;
- copy `dsh-spill-policy`;
- parse spill notice text as authority;
- whitelist `/tmp`, spill root, `dsh-spill-*`, or any path prefix;
- broaden Team policy to `read:any`;
- bump TeamDomain schema;
- add a tenth TeamDomain store;
- implement capability transfer;
- expand artifact grants beyond `read`;
- duplicate the existing monotonic permission guard.

`CORE PATCH BUDGET = 0` must remain green.

---

## 1. Start with a RED compatibility probe

Before product code, prove these against the pinned DSH baseline / installed profile:

1. `@deepseek-ai/dsh-spill-local` exports `LocalSpillStore`.
2. A subclass can override `saveText` and call `super.saveText`.
3. The subclass still provides normal `ctx.spillStore`.
4. the effective bundle can replace the base row id `spill-local`;
5. generic spill-policy uses the replaced provider;
6. over-cap grep and glob use the replaced provider;
7. session-reference uses the replaced provider where reachable;
8. `ctx.fs.resolve(locator)` + `ctx.fs.stat(target)` sees the saved artifact;
9. replacing the file changes current target/version identity;
10. foreground bash/pwsh result exposes structured `stdout.spillPath` / `stderr.spillPath`;
11. permission resolver provenance distinguishes explicit rule-deny from default-deny.

If a probe fails, adapt the plugin to the public seam. Do not work around it by patching DSH.

---

## 2. Add the artifact-read runtime module

Create:

```text
packages/runtime/artifact-read/
  index.ts
  types.ts
  digest.ts
  fact.ts
  registry.ts
  authority.ts
```

### 2.1 `types.ts`

Define plugin-internal types.

Conceptual shape:

```ts
type ArtifactSource =
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

interface DurableArtifactGrant {
  instanceId: string
  locator: string
  targetKeyDigest: string
  versionDigest: string
  source: ArtifactSource
}
```

Do not persist upstream branded objects.

### 2.2 `digest.ts`

Implement domain-separated SHA-256 over opaque strings.

Example domains:

```text
dsh-agent-team/artifact-target-key/v1
dsh-agent-team/artifact-version/v1
```

Return `sha256:<hex>`.

Never parse target key/version.

### 2.3 `fact.ts`

Own the new fact type:

```text
artifact-read-granted
```

Implement:

- builder;
- strict parser;
- type guard;
- projection from `LedgerEntry`.

No I/O.

### 2.4 `registry.ts`

Implement an in-memory candidate index.

Suggested API:

```ts
install(grant)
listForInstance(instanceId)
findCandidates(instanceId, targetKeyDigest)
clear()
```

Registry is not final authority; freshness is checked through filesystem seams.

### 2.5 `authority.ts`

Own all live artifact authority logic.

Use injected ports rather than plugin globals.

Suggested ports:

```ts
interface ArtifactFsPort {
  resolve(path: string, cwd?: string): Promise<{
    target: unknown
    targetKey: string
  }>
  stat(target: unknown): Promise<{
    type: 'file' | 'directory' | 'other'
    version: string
  } | undefined>
}

interface ArtifactIdentityPort {
  instanceForSession(sessionId: string): {
    rootSessionId: string
    instanceId: string
    lifecycle?: string
    isLeader: boolean
  } | undefined
}

interface ArtifactLedgerPort {
  appendGranted(rootSessionId: string, grant: DurableArtifactGrant): Promise<void>
  listGranted(rootSessionId?: string): readonly DurableArtifactGrant[]
}
```

Required responsibilities:

- map session -> durable Team principal;
- resolve/stat locator;
- verify regular file;
- compute opaque token digests;
- append grant fact;
- install runtime grant;
- validate current lifecycle and file identity on read.

---

## 3. Wire durable storage through TeamLedger

Use the existing ledger repository.

### Write sequence

For one grant:

1. allocate ledger sequence;
2. put `artifact-read-granted`;
3. only after successful put install the runtime grant.

For SpillStore-backed artifacts this must happen before returning the `SpillRef`.

### Recovery

At production root creation/open:

- read artifact grant facts;
- parse defensively;
- rebuild candidate registry;
- fresh-resolve/stat before final authorization;
- stale/missing artifacts remain inactive.

Do not delete stale facts.

### UI/remote

Do not add artifact-grant facts to user-facing lifecycle/activity semantics.

If they appear as generic ledger rows, keep presentation terse and do not expose opaque target/version digests as meaningful UI data.

Do not redesign remote contracts in this task.

---

## 4. Add one TeamArtifactAuthority per production root

Primary assembly point:

```text
packages/runtime/src/plugin/root.ts
```

Create exactly one registry/authority for the Team production root, sharing the same opened TeamDomain as existing runtime services.

Expose a narrow port, e.g.:

```ts
interface TeamArtifactAuthorityPort {
  recordSpillStoreArtifact(args): Promise<void>
  recordForegroundShellArtifact(args): Promise<void>
  authorizeRead(args): Promise<boolean>
}
```

Do not expose raw repositories to producer adapters.

If the process-global spill provider needs routing to Team roots, use a plugin-owned service/ref/bridge. Prefer Cordis/plugin ownership over `globalThis`.

---

## 5. Replace the local spill provider

Create a host-only entry, e.g.:

```text
packages/runtime/src/plugin/team-spill-local.ts
```

Conceptual implementation:

```ts
export class TeamAwareLocalSpillStore extends LocalSpillStore {
  override async saveText(input) {
    const ref = await super.saveText(input)

    const bridge = resolveArtifactBridge(this.ctx)
    if (bridge !== undefined) {
      await bridge.recordIfManaged({
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

Rules:

- call `super.saveText` exactly once;
- preserve returned locator/bytes/hint;
- do not copy cleanup/config/root/session-dir logic;
- do not read or copy the spilled content into Team state;
- non-Team sessions return normally;
- managed strict-read Team sessions await durable grant creation.

If artifact storage succeeds but grant persistence fails for a managed strict-read Team session, reject `saveText`. Let the upstream consumer execute its existing fallback.

---

## 6. Package and composition wiring

### Package export

Add a host subpath export such as:

```text
./spill-local
```

Ensure its built artifact is included in published package files.

If the independent entry cannot resolve upstream packages through the existing host resolver, fix resolution in the plugin package layer:

- prefer proper dependency/peer resolution;
- otherwise reuse the existing plugin-owned upstream resolver bootstrap;
- never change DSH.

### `cordis.patch.yml`

Change the effective composition so row:

```text
id: spill-local
```

loads the Team provider instead of the upstream provider.

Leave:

```text
id: spill-policy
name: @deepseek-ai/dsh-spill-policy
```

unchanged.

Add a real composition smoke assertion for the effective provider.

---

## 7. Map producer session to InstanceId

Use durable Team identity.

Rules:

```text
root session    -> LEADER_INSTANCE_ID
member session  -> member_instances/session_bindings owner InstanceId
other session   -> unmanaged
```

Never infer from template, label, workspace, group, or current live residency.

---

## 8. Foreground shell provenance

Add a small agent-scoped adapter installed from:

```text
packages/runtime/src/plugin/live/agent-bindings.mjs
```

Prefer an imported adapter module over inline logic.

Register `tools/result`.

For successful `bash` / `pwsh` only:

- inspect canonical `result.value`;
- read structured stdout/stderr spill path fields;
- call `recordForegroundShellArtifact`;
- bind to the already-known durable `InstanceId`;
- never parse `result.content`.

Put the disposer in existing `toolDisposers`.

Cold resume must reinstall it through the existing `agentSetup` path.

---

## 9. Integrate grants into pre-execute permission enforcement

Primary file:

```text
packages/runtime/operation-permission/pre-execute-adapter.ts
```

Do not change the pure resolver's frozen semantics.

Add an injected artifact authorization callback.

Example:

```ts
authorizeArtifactRead?: (args: {
  instanceId: string
  rawPath: string
  canonicalResourceKey: string
}) => Promise<boolean>
```

### Required decision order

After canonicalization and static resolution:

1. if decision provenance is an explicit deny rule -> DENY;
2. apply external-hard last-mile;
3. if tool is `read`, ask artifact authority;
4. if exact valid grant -> mark current exec in existing `authorizedExecutions` WeakSet, then `await next()`;
5. otherwise continue the existing static allow / ask / default path unchanged.

Critical cases:

```text
explicit deny + grant  -> DENY
explicit ask + grant   -> ALLOW, no control request
default deny + grant   -> ALLOW
default deny, no grant -> unchanged
ask, no grant          -> unchanged durable approval path
external hard + grant  -> DENY
```

Artifact grant applies only to `read`.

Do not add a second guard.

---

## 10. External-hard reuse

Reuse the existing A2C-4 last-mile mechanism.

If necessary, refactor only enough to call the same check from the artifact branch.

Do not duplicate external-policy parsing.

Non-artifact behavior must remain unchanged.

---

## 11. Lifecycle

Authority eligibility:

```text
CREATED/RUNNING/SETTLED -> active
ARCHIVED                 -> dormant
DISPOSED                 -> permanently inactive
```

Restore reuses the same `InstanceId`.

No revoke write on archive/dispose.

Leader remains governed by existing root invariants.

---

## 12. Background shell: bounded optional task

Probe whether thin plugin-layer wrappers can subclass:

```text
@deepseek-ai/dsh-bash-sandbox
@deepseek-ai/dsh-pwsh-sandbox
```

Useful baseline facts:

- both are public classes;
- shell specs carry trusted DSH-managed `dshEnv`;
- `DSH_SESSION_ID` is reserved and derived from `execution.agent.session.header.id`;
- `ShellProcessRead` contains structured stdout/stderr spill paths before render.

Acceptable:

- thin subclass/wrapper;
- all execution delegated to `super`;
- observe structured spill paths;
- bind via trusted `DSH_SESSION_ID`.

Reject the subtask if it requires:

- copying `tool-bash`;
- copying `tool-pwsh`;
- copying local executor internals;
- parsing `job_output` text;
- modifying DSH.

Main strict-read + SpillStore fix must not be blocked by this optional lane.

---

## 13. Tests

### Pure artifact core

Test:

- fact parser/build;
- digest domain separation;
- registry ownership;
- malformed grant rejection;
- no raw target/version persistence.

### Authority

Test:

- correct session -> InstanceId mapping;
- leader mapping;
- unmanaged session ignored;
- regular file required;
- target mismatch denied;
- version mismatch denied;
- missing file denied;
- member A grant unusable by B;
- archive dormant;
- restore active again;
- disposed terminal.

### Permission adapter

Extend existing A5/H1-style tests:

1. explicit deny + valid grant -> deny;
2. explicit ask + valid grant -> allow without request;
3. default deny + valid grant -> allow;
4. no grant -> existing behavior;
5. external-hard deny + grant -> deny;
6. grant-authorized execution survives end-cap;
7. hostile prepend-allow remains blocked;
8. artifact grant does not affect `read_image/write/edit/lsp/bash/pwsh`.

### Spill provider

Using real upstream LocalSpillStore behavior, prove:

- ref output unchanged;
- content unchanged;
- inherited config/cleanup behavior preserved;
- non-Team save creates no Team grant;
- strict-read Team save creates exactly one durable grant;
- authority failure rejects wrapper after storage.

### Real producer integration

Trigger:

- generic oversized spill-policy result;
- over-cap grep;
- over-cap glob;
- session-reference spill where test harness exposes it.

For each:

```text
producer InstanceId can read locator
another InstanceId cannot
ordinary unrelated temp file remains denied
```

This is the decisive provider-replacement proof.

### Foreground shell

Force stdout and stderr spill.

Prove:

- producer can read;
- another member cannot;
- explicit deny still wins.

### Cold restart

1. create strict-read Team member;
2. generate spill;
3. read succeeds;
4. stop backend;
5. restart same home;
6. rematerialize same `InstanceId`;
7. old artifact still readable if identity/version match;
8. replace/delete artifact;
9. read becomes denied.

### Non-Team compatibility

A normal non-Team DSH session must retain upstream spill behavior.

### Regression gates

Run:

```text
pnpm typecheck
pnpm build
pnpm build:composition
pnpm check:artifacts
pnpm test
```

Compare failure set with pre-change baseline.

Run zero-core verifier and require pristine DSH test-use tree.

---

## 14. Expected files/modules to change

Primary:

```text
packages/runtime/artifact-read/**                     NEW
packages/runtime/operation-permission/pre-execute-adapter.ts
packages/runtime/operation-permission/index.ts        if export required
packages/runtime/src/plugin/root.ts
packages/runtime/src/plugin/live/agent-bindings.mjs
packages/runtime/src/plugin/types.ts                  narrow additive port
packages/runtime/src/plugin/team-spill-local.ts       NEW
packages/runtime/test/*artifact*                      NEW
packages/runtime/test/a5a-pre-execute.test.ts         extend
packages/runtime/test/h1a-pre-execute-endcap.test.ts  extend if needed
cordis.patch.yml
package.json
scripts/place-dist-glue.mjs                           only if packaging requires it
targeted smoke/probe kit
plugin docs/status
```

Optional background shell:

```text
packages/runtime/src/plugin/team-bash-sandbox.ts
packages/runtime/src/plugin/team-pwsh-sandbox.ts
cordis.patch.yml
package.json
```

Do not touch upstream DSH source.

---

## 15. Recommended implementation sequence

### Phase A — pure authority core

1. types/digests/fact;
2. registry;
3. authority with fake ports;
4. unit tests.

### Phase B — permission lane

1. inject artifact callback;
2. explicit-deny ceiling;
3. external-hard reuse;
4. end-cap mark;
5. adversarial tests.

### Phase C — spill provider replacement

1. subclass LocalSpillStore;
2. package export;
3. effective row replacement;
4. composition probe;
5. generic/grep/glob integration.

### Phase D — foreground shell

1. `tools/result` adapter;
2. lifecycle install/dispose;
3. shell spill tests.

### Phase E — restart/lifecycle

1. rebuild registry from ledger;
2. archive/restore/dispose;
3. same-home restart smoke.

### Phase F — optional background shell

Only if provider subclassing remains thin and maintainable.

---

## 16. Definition of Done

All must hold:

1. ordinary out-of-workspace reads remain governed by strict-read;
2. producing InstanceId can read its own valid SpillStore artifact;
3. generic spill-policy works;
4. grep/glob spill works without copied policy;
5. foreground shell spill works;
6. other Team instances cannot use the locator;
7. explicit deny still wins;
8. external-hard still wins;
9. restart preserves valid grant for same InstanceId;
10. replaced/deleted artifact does not inherit stale authority;
11. non-Team DSH sessions behave as upstream;
12. TeamDomain remains v2;
13. DSH checkout/test-use remains pristine;
14. zero-core verification passes.
