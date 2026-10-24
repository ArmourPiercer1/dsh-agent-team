# @dsh-agent-team/testkit

Written by the EB-E0/E1 documentation line. A README is a **snapshot, not authority**: on
conflict, `dev/agent-workflow/graph.yaml` and the newest `SESSION_ROUTER_LOG.md` entry win
(`AGENTS.md`, "状态与恢复").

In the frozen 9-package structure (TaskDoc §11), this is the shared test-support package. Its
own `src/index.ts` states the one rule that matters most: *"fixtures and helpers the other
packages' tests share — fault-injection / restart fixtures, golden fixtures, shared
assertions. **Testkit is consumed by tests only; no production package may depend on it.**"*

## Responsible for

- `fault-injection/` — `file-seam.mjs` (+ `.d.mts`), a file-backed `StorageDomainSeam` used to
  inject faults and restarts (ruling R22), and `session-event-scan.mjs` (+ `.d.mts`), a
  committed scanner that proves no Team SessionEvent vocabulary exists anywhere in the
  9-package tree (P4-T6, ruling R24; the rule itself is `AGENTS.md`, 红线).
- `fault-injection/fixtures/committed-world/` — the committed world fixture (`team_domain` plus
  `team_domain.meta.json`).
- `domain/` — the P3-T6 domain-integration bundle: `src/scenario.ts` builds a
  `Blueprint → N MemberInstances` composition with a canonical serializer, and
  `src/import-graph.ts` carries the closed import-graph data used to show the domain has no live
  Agent dependency (G3-1). Note that `domain/` has its own `tsconfig.json` and is **not** wired
  into this package's build tsconfigs.
- `test/` — 30 `*.test.ts` plus 2 helpers: the `t6-1`…`t6-10` contract series, `p4t5-*`
  (corrupt-version, crash-matrix, retry-restart), `a4p7-*` (merge gate, composition-smoke
  classification), `rc2-kit-*` (fault injection, fixture invariants, pin hygiene, preset seam,
  wire shape), `a3p1-*`, `bp1h-blueprint-authoring`, `a5-current-contract`,
  `plugin-dsh-compat`, `p4t6-session-event-scan`, `a4-artifacts-nonempty`.

## NOT responsible for

- Production behaviour of any kind. The declared entry `src/index.ts` exports only a
  `PACKAGE_ID` marker (20 lines), so anything real is reached by direct specifier:
  `../../testkit/domain/src/…` or `../../testkit/fault-injection/…`.
- Being depended on by shipped code, and the rule is currently honoured — with a wording
  correction, because the obvious grep does **not** come back empty. Every testkit **import** in
  `packages/runtime` sits inside `test/`: counting import specifiers outside `test/` and outside
  the committed `dist/` gives **zero**. Three files outside `test/` do contain the word
  `testkit`, all three in doc comments describing what gets injected in tests --
  `member-residency/index.ts:31` and `root-binding/index.ts:22` ("*the unit layer … binds the P4
  repositories over the testkit `FileStorageSeam*`") and
  `agent-setup/binder/read-handle.ts:20` ("*tests: the P4 repositories over the testkit file seam
  or an in-memory seam*"). Text-grep and import-graph are different claims; the second is what
  the rule governs, and it is clean.
- Node built-ins in `.ts` sources: `src/index.ts` and `domain/src` contain no `node:` imports
  (the only occurrence in `domain/src` is inside a comment). Test files and the two
  `fault-injection/*.mjs` modules do use them.
- **Recorded, not fixed**: the header of `fault-injection/file-seam.mjs` calls itself *"the ONLY
  testkit module allowed to touch `node:` builtins (it is `.mjs`; the zero-`node:`-builtin rule
  for `.ts` files is absolute…)"*, while `fault-injection/session-event-scan.mjs` also imports
  `node:` builtins. Both facts are reported here rather than reconciled by editing either file:
  either the exemption is broader than its wording, or the second module predates it. The
  `.ts`-files-absolute half of the rule is unaffected.

**Not established**: whether testkit is network-free. `fetch(` / `WebSocket` were not grepped
inside this package as a dedicated check, so no absence is claimed. Nothing was executed while
writing this file.

## Source, contract and test entry points

| what | where |
| --- | --- |
| declared entry | `src/index.ts` (marker only) |
| fault injection | `fault-injection/file-seam.mjs`, `fault-injection/session-event-scan.mjs` |
| committed world fixture | `fault-injection/fixtures/committed-world/{team_domain,team_domain.meta.json}` |
| domain integration bundle | `domain/src/{scenario,import-graph,index}.ts` (own `tsconfig.json`) |
| tests | `test/*.test.ts` |
| cross-package imports | `domain` (58 lines), `contracts` (22), `storage` (11), and exactly **1** import of `runtime` — `test/a3p1-team-domain-tenth-store.test.ts` pulling `../../runtime/test/permission-overlay-helpers.js`, i.e. test-to-test |

No JSON Schema file lives in this package. Commands in `package.json` — **entry points, none
run for this document**: `build` (`tsc -p tsconfig.build.json`), `typecheck`
(`tsc -p tsconfig.json`), `test` (`vitest run`). The test-host checkout, `DSH_HOME` world
naming and port family are defined by `docs/TEST_METHODS.md` and `tests/paths.mjs`, which are
the single source for pins; this file repeats none of them.

## Owner

**No owner is recorded for this package.** It appears in neither `dev/engineering/registry.yaml`
nor `docs/contracts/engineering-baseline/ids.yaml`. The nearest declared role strings in those
files are `Test Maintainer` (owns EB0-2 and EB0-5, both read-only audits) and `CI/Test/Doc
Owner` (owns `IDEA-EB-0001`); neither is stated anywhere as the owner of this package, and this
file does not appoint one.
