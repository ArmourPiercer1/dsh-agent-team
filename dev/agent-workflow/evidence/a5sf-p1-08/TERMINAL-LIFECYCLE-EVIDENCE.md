# P1-08 · PTY / persistent-process lifecycle — evidence

- **Task**: P1-08 (Gate **G1.8**), branch `task/a5sf-p1-01-20261102`.
- **Lane**: `packages/runtime/team-sandbox/src/terminal.ts` (new).
- **Tests**: `packages/runtime/test/a5sf-terminal-lifecycle.test.ts` — **6/6**;
  `tsc` rc=0 (`green-tests.log`).

## 1. Laws pinned (the registry is a pure state machine over an injected PTY port)

| Law | Test |
|---|---|
| identity = trusted TeamDomain member + tool binding; a caps/label/argv-like or incomplete identity is `OWNER_UNTRUSTED` | `refuses a stale caller revision and a forged/untrusted owner` |
| the domain records creation-time **policyRevision + backend + PTY pid** | `creates one domain … and REUSES it` |
| same generation ⇒ REUSE the live shell (no restart per command) | same test: exactly one PTY exists |
| tightened revision ⇒ domain stale, `REVISION_STALE` on command check, old shell SIGKILLed, new one built | `kills and rebuilds when the revision tightens` |
| revocation ⇒ kill + refuse new shells for that member | `revocation kills the domain` |
| `danger-full-access`-style spec still records the revision and obeys revocation (ceiling not erased) | same + `stores no approval` |
| a one-shot approval is never stored as a PTY grant | `stores no approval` (no approval/grant field in the domain record) |
| shutdown receipt carries pid, live descendants, revision, killed | `shutdown reports pid, descendants …` |
| no wall-clock read in the lane (`now` injected) | `now: () => 'fixed'` assertion |

## 2. Honest gaps

- The PTY port is a test double here. The real terminal backend (`terminal-bash` /
  `bash-sandbox`) wiring, real PID/descendant observation and the native
  `spawnTerminal` contract are NOT proven by this file; they are the P2/P1-07
  integration leg, and Gate G1.8 is **CONDITIONAL** until a real PTY run records
  the same receipts.
- The PTY-domain→`ctx.shell` binding (installing `team-shell` per the native
  `backendType`) is the Native Integrator's change; the lifecycle law is ready for it.

## 3. Reproduce

```bash
cd .worktrees/a5sf-p1-01
node_modules/.bin/vitest run packages/runtime/test/a5sf-terminal-lifecycle.test.ts
```
