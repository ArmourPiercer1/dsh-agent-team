# P1-05 · per-Member Service realm and Provider binding

- **Task**: P1-05 (Gate **G1.5**) of `docs/plans/memo/alpha5-sandbox-first-20261101/IMPLEMENTATION-PLAN.md`.
- **Branch/worktree**: `task/a5sf-p1-01-20261102` @ `.worktrees/a5sf-p1-01`.
- **Lane**: `packages/runtime/team-services/src/{types,fs,install,index}.ts` (new).
  Typechecked through `packages/runtime/tsconfig.json` (include entry added).
- **Test**: `packages/runtime/test/a5sf-service-install.test.ts` — **10/10**; lane total
  **81/81** with all P1 tests (`green-tests.log`), `tsc` rc=0. RED log preserved
  (`red-test.log`: module missing, no tests collected).

## 1. What was built

```
installMemberIoProviders({ root, members, providerClass? })
  validate EVERY member (compiled policy? identity match? duplicate? already installed?)
  sample the LIVE provider class: Object.getPrototypeOf(root.get('fs')).constructor
  inspect the managed surface (11 methods) → typed PROVIDER_INCOMPATIBLE if short
  per member: root.isolate('fs', Symbol(member)) → mount the confined subclass
  → MemberServiceInstallation { identity, serviceIdentity, ctx, fs, dispose }
  on any failure: dispose everything already mounted, throw typed, mount nothing

createConfinedFileSystemClass(Base, guard)
  subclass of the LIVE provider: read*/listDir/stat/lstat/watch → read axis;
  writeText/editText → write axis AND read coverage of an EXISTING target
  (write ⇒ read); every permit delegates to super, so host semantics survive

createMemberFsGuard(policy, resolver?)
  P1-03 evaluateLocatorAccess per call (authored containment + provider realpath),
  closed denials IO_READ_DENIED / IO_WRITE_DENIED / IO_WRITE_REQUIRES_READ /
  IO_POLICY_UNSUPPORTED; fail-closed on resolver failure
```

## 2. Laws pinned (10 tests, real Cordis + real `tools.register` seam)

| Law | Evidence |
|---|---|
| one Provider instance per Member, root untouched | `a.fs !== b.fs`; `root.get('fs')` stays the base instance |
| read ceiling per Member | A reads A, B reads B; A→B, B→A and A→outside are `IO_READ_DENIED` |
| write ceiling + `write ⇒ read` | write outside axis `IO_WRITE_DENIED`; existing target with read axis narrower `IO_WRITE_REQUIRES_READ`; both-cover write succeeds and lands on disk |
| call-time service identity | the SAME `read_file` implementation shape registered in both scopes resolves its OWN provider: A's tool body reads A, and A's tool cannot read B's file |
| install atomicity | refused compile → `MEMBER_POLICY_UNAVAILABLE`; duplicate identity → `MEMBER_DUPLICATE`; no root Provider → `PROVIDER_UNAVAILABLE`; short Provider surface → `PROVIDER_INCOMPATIBLE` |
| dispose | removes the Member Provider from its scope (`ctx.get('fs')` undefined), idempotent |
| closed vocabularies | `TEAM_IO_DENIAL_CODES` / `TEAM_SERVICE_INSTALL_CODES` exported and used by tests |

## 3. Honest scope of the G1.5 claim

- **Proven**: registration-time scope isolation through the public Cordis
  `ctx.isolate('fs')` seam, and call-time resolution of a real `tools.register`
  definition against the Member's own provider. The Provider is a real `Service`
  over `node:fs` mounted through the public seams; the install samples the live
  class exactly as it will sample `fs-local`/`fs-sandbox`.
- **Not proven here (deferred, disclosed)**: the upstream `@deepseek-ai/dsh-tool-fs`
  binary itself, and per-agent same-name tool variants (registered through
  `agent.ctx`). Both require the real Host composition; `packages/runtime` cannot
  import `dsh-tool-fs`/`dsh-fs-local` — they are not in its dependency closure and
  `pnpm install` is unavailable in this sandbox (`ERR_SQLITE_ERROR`, store DB).
  That leg is the P2 host/E2E run, not a silently claimed PASS.
- The confinement is enforced in-process (a malicious same-realm plugin can still
  call node:fs directly); OS-level effect is P1-07/P2.

## 4. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-service-install.test.ts
```
