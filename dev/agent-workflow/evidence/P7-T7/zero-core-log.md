# P7-T7 zero-core log

Scope: every `.ts` file under `packages/legacy/` (session-reader module +
test suites) must carry **no `node:` imports and no `require(`** — the vNext
plugin packages are pure TypeScript; platform capabilities (filesystem,
process) reach them only through injected ports or the runner environment.
The e2e harness files under `packages/legacy/session-reader/e2e/*.mjs` are
`.mjs` driver code and are outside the zero-core rule (they legitimately use
Node APIs to boot a real instance).

## Check

Command (ripgrep over the legacy package, `.ts` only):

```
grep -nE "node:|require\(" packages/legacy/**/*.ts
```

Executed from the worktree root `D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P7-T7`
at HEAD `c53f1b008d59b803f51d2c107ffffb7846a8bb9c` (branch
`task/P7-T7-legacy-session-reader`), re-verified after the final test
fixes (2026-08-31, post chain `attempt1-post.log`).

## Hits (4 — ALL in comments)

| # | File | Line | Context (comment only) |
| --- | --- | --- | --- |
| 1 | `packages/legacy/test/p7t7-helpers.ts` | 7 | `discipline: no `node:` imports in `.ts`), so the reader's injected` |
| 2 | `packages/legacy/test/p7t7-mutation-reject.test.ts` | 21 | `Zero-core: in-memory home tree behind the recording port (no `node:`` |
| 3 | `packages/legacy/test/p7t7-legacy-read.test.ts` | 20 | `in-memory home tree behind the recording port (no `node:` imports).` |
| 4 | `packages/legacy/session-reader/format.ts` | 9 | `stays a pure module — no `node:` imports) plus the injective decoder the` |

No `import 'node:...'`, no `require(...)`, no `process`/`Buffer`/`fetch`
global usage in any legacy `.ts` file. The reader's filesystem access is
exclusively the injected read-only `LegacyHomePort` (`listDir`/`readFile`);
the test suites use in-memory home trees.

## Verdict

**PASS** — zero-core discipline holds for `packages/legacy/**/*.ts`.
