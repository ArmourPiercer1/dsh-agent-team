# P1-02 · MemberPolicy / EffectiveIo compiler — evidence

- **Task**: P1-02 of `docs/plans/memo/alpha5-sandbox-first-20261101/IMPLEMENTATION-PLAN.md`
  (Gate **G1.2**).
- **Branch / worktree**: `task/a5sf-p1-01-20261102` @ `.worktrees/a5sf-p1-01`
  (base = PR #531 head `8bff512d1`). Commit `e9410d268`.
- **Lane**: `packages/runtime/member-io-policy/src/{types,compile,path-rules}.ts`
  (new runtime lane; typechecked through `packages/runtime/tsconfig.json`).
- **Test**: `packages/runtime/test/a5sf-member-policy.test.ts` — **16/16**.
  Evidence log `green-tests.log` (16/16 policy + 21/21 P1-01 + tsc rc=0 for both packages).

## 1. What was built

```
compileMemberPolicy(input): CompileResult<MemberPolicy>
  trusted TeamDomain identity → v4 member ceiling (P1-01) → projected rule sets
  + stable content-addressed revision (sha256 over identity/blueprint/authority/io)

compileEffectiveIo(member, tool, invocation): CompileResult<EffectiveIoPolicy>
  EffectiveIo = MemberCeiling ∩ ToolRestriction, per axis:
    - allow: narrower subtree of each related pair (segment containment)
    - deny:  union (a deny on either axis survives)
    - ask:   stricter disposition, never promoted to allow
    - network: boolean AND (deny wins)

projectToolIoRestriction(binding): CompileResult<ToolIoRestriction>
  v4 tool binding → `no-additional-narrowing` for `mode: all`,
  `unsupported` for a destination-restricted network lane
```

`path-rules.ts` was added as the algebra P1-02 needs (segment containment, prefix
boundary `/work/a` ≠ `/work/ab`, subtree intersection). P1-03 owns and extends the
same module with Provider-resolved identity (symlink/hardlink), keeping one algebra.

## 2. Fail-closed laws pinned (each is a test)

| Law | Refusal |
|---|---|
| incomplete / foreign / stale Member identity | `MEMBER_IDENTITY_UNTRUSTED`, `MEMBER_GENERATION_STALE` |
| team mismatch | `TEAM_MISMATCH` |
| template not declared by the blueprint | `MEMBER_TEMPLATE_UNKNOWN` |
| **no declared ceiling ⇒ no policy** (never synthesized allow-all) | `MEMBER_CEILING_UNDECLARED` |
| Member Alpha.4 admission false | `AUTHORITY_REFUSED` |
| destination-restricted network (ceiling **or** tool) | `IO_POLICY_UNSUPPORTED`, `TOOL_NETWORK_UNSUPPORTED` |
| invocation minted for another member / tool / stale revision | `INVOCATION_MISMATCH`, `STALE_POLICY_REVISION` |

Positive laws: A/B never cross; the same Member's read tool narrows further
(`/work/a` ∩ `/work/a/docs` = `/work/a/docs`); an unknown CLI receives the same
Member ceiling; write-only never implies read; locators stay verbatim
(directory vs single file, both preserved); the same inputs produce the same
revision, a widened ceiling or a new Alpha.4 revision produces a new one; results
are frozen.

## 3. Authority boundary (what P1-02 deliberately does NOT do)

- **No approval logic**: `Alpha4EffectiveAuthority` is consumed as already-computed
  input. `approvedOnce: true` is machine-checked to produce EXACTLY the same
  effective policy as `false` — a one-shot approval cannot widen the ceiling.
- **No second ledger**: nothing here stores grants; the binder (P1-04) owns per-call
  state and references this policy revision.
- **No I/O enforcement**: no consumer yet. Wiring into `ctx.fs` / `ctx.web` /
  `ctx.subprocess` is P1-05/P1-07; until then this lane is provable but inert.
- **No v5 syntax**: the authoring surface is P1-01's additive v4 family only.

## 4. Residual risks handed to later tasks

1. Path matching is authored-string based. Provider-realpath identity (symlinks,
   hardlink aliases, `nix`-style bind mounts) is P1-03.
2. The `ask` disposition is preserved but its *enforcement point* (where an approval
   is requested) is P1-05/P1-07.
3. Revision is derived from content + authority revision, not from a monotonic
   counter — a rollback to an older ceiling would reproduce the older revision. That
   is intentional (content-addressed, auditable) and must be considered when the
   persistent-process teardown logic (P1-08) compares revisions.

## 5. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-member-policy.test.ts
node_modules/.bin/tsc -p packages/runtime/tsconfig.json --noEmit
```
