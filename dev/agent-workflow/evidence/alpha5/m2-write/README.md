# M2-WRITE-01 — governed `write` face (C1 fixture round)

> **SUPERSEDED FOR THE SLICE LAW (2026-10-23 07:13 root security ruling; fix round 1).**
> The stub-graded C1 described below could not offset the three reproduced defects.
> The CURRENT state of the card is `runs/2026-10-23T07-36Z-fix1/README-fix1.md`:
> three mandated repairs (full-plan freeze via the M1 canonicalizer; sole consumption
> point + cancel semantics + token single-flight; ANCHOR-DRIFT agreement), the pre-fix
> reproduction suite (`repro/` + `a5m2-write-slice-defect-repro.test.ts`, 3/3) and the
> fix-round C1 over REAL parts (real kernel/ledger/canonicalizer/gated lane, 26/26,
> lawful ask/deny grammar). The production-assembly row direction is WITHDRAWN — its
> two artifacts live PARKED under `parked/` (not delivered, not wired). Everything
> below documents the FIRST revision and its 20 stub legs, kept unaltered as history.

# M2-WRITE-01 — governed `write` face (C1 fixture round)

Card: M2 首批 `M2-WRITE-01` (sole owner) · tool = `write` (matrix row `write (M-02)`).
Baseline: branch `feat/a5-m1-center-kernel` @ `7a3540937e39aa5b90ec…` (HEAD at run time;
M1 merged master `929fc4af2`, reviewed tree `7a3540937`). CORE PATCH BUDGET = 0 observed
(host tree `tests/deepseek-harness-test-use` read-only, zero bytes touched).
Zero Host starts, zero ports, `:3080` untouched. No commit, no push, no `git add -A`.

## Files owned by this card

- `packages/tools/a5p5-tools/src/write-slice.ts` — NEW (this card). The governed write
  row body as a pure module (no `node:*`, no I/O, no clock; every external face is
  constructor-injected). Contains NO import specifier and NO text occurrence of the
  frozen-lane names ⇒ it enters the audit consumer set as NO new edge (see §Registration).
- `packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts` — NEW (this card). C1
  positive + negative controls, 20 titled tests, real FS world `tests/homes/m2w-*`
  created/destroyed in-suite (TEST_METHODS §7, nothing kept).
- `dev/agent-workflow/evidence/alpha5/m2-write/` — this README + `runs/` captures.
- Shared files touched: NONE. `team-tool-plane.mjs` / `agent-bindings.mjs` /
  `pa-mount-registry.mjs` / `plane-effect-backends.mjs` / the matrix — READ ONLY.

## 1. `write` — the REAL host schema (pinned source, `tests/deepseek-harness-test-use` @ `639ed01539`)

Registration entry: `packages/fs/tool-fs/src/index.ts:77` — `applyWriteTool(ctx, sandbox)`
(one `FsSandboxController` shared with `edit`, built at `:76` off `ctx.fs.sandboxMode`).

Tool definition `packages/fs/tool-fs/src/write.ts:72-152`:

| field | type | required | source line |
| --- | --- | --- | --- |
| `file_path` | string | YES (`required: true`) | write.ts:76 |
| `content` | string | YES (`required: true`) | write.ts:77 |
| `sandbox_permissions` | string enum (escalation modes) | conditional | write.ts:78 spread + sandbox.ts:59-72 — advertised ONLY when `sandbox.escalationModes.length > 0` (a confining fs backend is mounted) |
| `justification` | string | conditional | same spread |

Value law beyond the schema DSL: `parseWriteArgs` write.ts:24-27 — blank `file_path`
throws; EMPTY `content` is legitimate (writes an empty file).

Output schema write.ts:80-105: `{ path: string req, operation: 'create'|'update' req,
before: (string|null) req, after: string req }`; the model-facing render
(formatWriteOutput write.ts:35-42) echoes NO content; `presentationMeta` builds the diff
from `before`/`after`. Execution order (write.ts:106-132): parse → `sandbox.resolvePolicy`
→ `ctx.fs.resolve` → waterfall `fs/write-intent` → `ctx.fs.writeText` → `fs/observed` emit.
This is the INHERITANCE face the matrix ③/④ columns describe — host-native, not a governed
plane row.

## 2. plane takeover-table state (verbatim, `packages/runtime/src/plugin/live/team-tool-plane.mjs`)

```js
const PLANE_SUPPORTED_NATIVE_TAKEOVERS = Object.freeze({
  bash: Object.freeze(['bash']),
  read: Object.freeze(['read']),
  grep: Object.freeze([]),
  glob: Object.freeze([]),
  jobs: Object.freeze(['job_output', 'job_list', 'job_kill']),
})
```
(team-tool-plane.mjs:465-479 — NO `write` key). `verifyPlaneNames` rows are closed
(`:487`: `[['grep'],['glob'],['bash'],['read']]`); the same-name claim on a reserved
spelling is refused at `:493-494`:

> `PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED` — `plane row '<cls>' cannot mount under reserved
> native name '<spelling>' — this install surface assembles no same-name, same-meaning
> implementation for that pair (supported: bash row at 'bash', read row at 'read'); coarse
> permission class is not tool-implementation equivalence`

The ledger's own comment (`:327-341`) records the measured pre-fix impostor: a governed
READER mounted as `write` MASKS the host writer and answers with a read schema — which is
why the write pairing stays UNSUPPORTED until this card's executor is mounted through the
C2 proposal. Matrix row ③/④ confirmed: the write row is host-native inheritance only;
governed plane write arm = NOT_IMPLEMENTED/NOT_WIRED at baseline.

## 3. C1 — executed (fixture level; commands + exits)

Runner = the repo's existing vitest entry (root `vitest.config.ts` already includes
`packages/tools/a5p5-tools/test/**/*.test.ts`). No new test platform.

```
node_modules/.bin/vitest run packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts   → RUNNER_EXIT=0  (20/20)
node_modules/.bin/vitest run packages/tools/a5p5-tools/test                            → RUNNER_EXIT=1  (96 passed / 1 failed — see §4)
node scripts/audit-a5-tool-governance-imports.mjs                                      → exit 0 (26 consumers, unchanged)
node node_modules/typescript/lib/tsc.js -p packages/tools/a5p5-tools/tsconfig.build.json → exit 0
node node_modules/typescript/lib/tsc.js -p packages/tools/a5p5-tools/tsconfig.json      → exit 0 (src+test typecheck)
node_modules/.bin/eslint packages/tools/a5p5-tools/src/write-slice.ts packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts → exit 0
node_modules/.bin/vitest run packages/domain/test/a5p0-layer-audit.test.ts             → exit 0 (consumers toEqual UNCHANGED)
```

Lane full suite ran ONCE (收一次即停 per root ruling #1): 96 passed / 1 failed, the ONLY
red = the barrel REGISTRATION gate (§4) — closed by R1, which CENTER lands as single
writer. No further full/census/pr-gate runs from this card.

**Production reachability split (ruling #4)**: everything above is local/fixture level.
The C2 plane-row landing (three shared files, §5) is CENTER's single-writer edit; the
**Host leg** (real Host boot, mount `writeName:'write'`, model-driven writes, 逐 command
C2/C3 acceptance per TEST_METHODS §2) is **ENV_BLOCK for this card** (no Host starts
from a worker session; single Host owner runs serially) — queued to CENTER.

Raw captures: `runs/2026-10-23T06-56-34Z/` (`c1-focused.raw`, `lane-full.raw`,
`audit-imports.txt` + `.exit`, `tsc-build.txt`, `tsc-typecheck.txt`,
`a5p0-layer-audit.raw`, `git-status-porcelain.txt`).

FIRST REAL FAILURE (kept verbatim in the lane history, NOT rewritten): the first focused
run failed 10/20 — root cause was the FIXTURE granting a `write`-only effect set while the
slice canonicalizes `tool-invoke + write` ⇒ `fingerprint-divergence` at the binding seam
before the port (which is itself the law working), plus two expectation-shape bugs. Fixed
in the fixture (same closed grammar for the grant) + `ok:false` discriminant on the
refusal record; second run 20/20 GREEN.

Legs (closed map, C1 per card):
- P1 create — governed write lands, receipt = `{canonicalLocator, writtenFingerprint}`
  (M-02: never old content), ledger shows `writeText:open-issued` + `writeText:fd-closed`,
  the exec-time port saw exactly the BOUND fingerprint, PA walked once.
- P2 empty `content` writes an empty file (host value law).
- P3 overwrite — new bytes land; `OLD-SECRET-CONTENT` appears NOWHERE in the outcome;
  no `before` field (the diff-suppressed variant is the STATED face; see §5 D-C2-1).
- N1-N3 schema lane: blank path / non-string content / the host escalation pair
  (`write-escalation-ungoverned` — refused, never silently dropped).
- N4-N5 escape: lexical `..` and absolute-outside refused BEFORE admission — zero PA
  walk, zero fs access, the outside secret never appears in refusal text.
- N6-N9 admission: lane deny / default-deny(+exact-allow flips it green) / PA deny
  (code verbatim) / PA **PENDING = refusal `PA_PENDING_NOT_ALLOW`, never allow**.
- N10-N15 fs edge (all through `createAdmissionGatedControlledFs` + frozen parsers):
  grant not covering the target (`denied/effect-outside-grant`, `TOOL_BINDING_UNVERIFIED`),
  one-shot consumption (`APPROVAL_STALE`/`grant-consumed`, zero second write), symlink
  alias refused before open (target keeps bytes), hidden-write typed LOUD
  (`hidden/hidden-write`, diagnostic non-empty, no object appears), exec-time port
  refusal (`recheck refused` before any open), diverging grant fingerprint never
  reaches the port (`fingerprint-divergence`, `portCalls=0`).

Honesty: this is FIXTURE level (the INTERFACES rule) — "verified against the fixture".
The plane write row does NOT exist yet; `pa` and the recheck PORT are fixture-graded
stubs; the durable PR2 ledger is stood in by an injected read-only `consumed` view.
None of this is a Host/production claim.

## 4. The one red, verbatim (registration gate, NOT a design refusal)

`packages/tools/a5p5-tools/test/a5p5-barrel-emit.test.ts` (lane-owned gate, law: "the
barrel IS the install face; no orphan module off the export face"):

```
FAIL … > src/index.ts re-exports EVERY src module by its './<name>.js' specifier
AssertionError: barrel must name './write-slice.js': expected '/**\n * `@dsh-agent-team/tools/a5p5-t…' to contain 'from './write-slice.js''
```

The lane rule is a REGISTRATION requirement (every new src module must be re-exported);
it does not forbid the addition. Per root ruling the registration entries below are for
CENTER to land (coordinator lands registrations in the open, "not from inside a gate").

## 5. Registration entries + C2 (all for CENTER; this card touches none of these files)

### R1 — lane barrel (one line, `packages/tools/a5p5-tools/src/index.ts`, append after `:87`)

```ts
// M2-WRITE-01 — the governed WRITE slice (row body for the future plane write-takeover
// row; fixture-level C1 pinned by test/a5m2-write-slice.test.ts; nothing registers or
// dispatches from the barrel, the dormant-audit posture is unchanged).
export * from './write-slice.js'
```

(Explicit named re-export form if preferred — the gate only requires the specifier
`from './write-slice.js'` to be present:)

```ts
export {
  createGovernedWriteExecutor, parseWriteSliceArgs, lexicalWriteAnchor,
  WRITE_SLICE_REFUSAL_CLASSES,
  type WriteSliceOutcome, type WriteSliceRefusal, type WriteSliceWritten,
  type WriteToolArgsView, type GovernedWriteExecutorDeps, type GovernedWriteCall,
  type SlicePaRequest, type SlicePaVerdict,
} from './write-slice.js'
```

### R2 — census identities (CENTER re-records the population baseline after R1 lands)

New collected file `packages/tools/a5p5-tools/test/a5m2-write-slice.test.ts` —
1 file identity + 20 titled tests (2 pure-law + P1-P3 + N1-N15; exact titles =
`describe/it` text in the file). Known-red baseline unchanged: the ONLY failing leg is
the barrel registration leg itself, which closes with R1 (no new titled red should be
recorded once R1 lands).

### R3 — consumer set: NO entry required, stated with reason

`scripts/audit-a5-tool-governance-imports.mjs` (consumer walk `:263-289`, law: a file
counts as a consumer when its CODE carries text `tool-governance|tool-dispatch` after
comment-stripping). `write-slice.ts` contains ZERO occurrences (external faces are
constructor-injected structural views — the `backend-contract.ts` ToolCancelSignal
precedent); audit ran exit 0 with the SAME 26 consumers, and
`packages/domain/test/a5p0-layer-audit.test.ts` (exact `toEqual` on the consumer list)
passed UNCHANGED. The test file lives under `test/` (walk skips `test/` + `*.test.ts`).
If a future src change needs a real import edge, THAT is the reviewed consumer-set edit.

### C2 — plane write-takeover row (minimal proposal; CENTER authors the three shared files)

C2-minimal (one new mount knob `writeName`; absent/`undefined` = ZERO new rows — byte-identical
mount today):

1. `team-tool-plane.mjs`
   - `PLANE_SUPPORTED_NATIVE_TAKEOVERS` gains `write: Object.freeze(['write'])` (the
     same-name claim becomes ledger-true ONLY once 2. is assembled — keep the pair in the
     SAME commit as the executor mount).
   - `verifyPlaneNames(names, readName)` → `verifyPlaneNames(names, readName, writeName)`;
     rows array gains `['write', writeName]` ONLY when `writeName !== undefined`
     (closed-class law otherwise unchanged: `names` stays grep/glob/bash-only; shape,
     distinctness, reserved-check order untouched).
   - row assembly (next to `readExecutor`): when `writeName` is set AND `fsInstance`
     carries a `rootDir`, build `createGovernedWriteExecutor({…})` over the SAME
     `fsInstance.rootDir` + `paAdmit` + `permissionPolicy` + `decide` (no second fs
     algebra), and push the def: `name: writeName`,
     `parameters: { file_path: string, content: string }` required BOTH — pinned host
     grammar (write.ts:75-79; the host escalation pair is NOT advertised here — this
     face assembles no escalation lane, and the slice REFUSES it typed if it ever
     arrives), execute = the slice body, `output: PLANE_PRESENTATION_FACE`.
2. `plane-effect-backends.mjs` — `createGovernedWriteExecutor`: port of
   `packages/tools/a5p5-tools/src/write-slice.ts` (the module was written DI-pure for
   exactly this port; the plane row additionally injects the REAL `pa` (mints through
   the PA admission kernel, one-shot inside `pa`), the exec-time recheck PORT, and the
   durable `consumed` view — the three fixture stubs of this card).
3. `agent-bindings.mjs` — C2-minimal needs NO change (no `tools/result` hand-off for the
   write arm until D-C2-1 resolves; the read hand-off face is untouched).

**D-C2-1 (the one semantic decision CENTER must rule)**: the pinned host result carries
`before` (old content) for the diff card; the governed C-FS receipt NEVER echoes old
content (M-02). C1 P3 pins the governed face's answer: **diff-suppressed variant**
(`before:null` is legal in the host output schema — write.ts:87-93 — and the host's own
presentation already treats a null oldText as "no diff to show"). The alternative
(extend the grant with the matching READ effect and answer the full four-field native
window through the same governed read arm) is the C2-full increment; C2-minimal ships
the stated suppression, disclosed in the row's result contract.

**Host legs (single Host owner, serial, after C2 merges)** — exact commands for the Host
owner (this card ran NONE): per TEST_METHODS §2 boot on the 3180 family with a
`tests/homes/<world>` world, mount the plane with `writeName:'write'`, then per the
card's C2 acceptance set: 逐 command 批准后写入正确内容 / 拒绝时无 open 无 write /
别名与 symlink 逃逸拒 / C3 取消·单飞·DRAINING 不 native fallback·冷重启不重跑旧批准.
Fixture-level C1 above is the pre-wiring proof that the law order refuses typed and
commits exactly once; it is NOT the Host leg and does not stand in for it.
