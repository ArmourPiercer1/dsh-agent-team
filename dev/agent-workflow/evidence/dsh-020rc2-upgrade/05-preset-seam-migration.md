# Preset seam: what the kits and harnesses actually did, and what they do now

Round: `task/dsh-020rc2-upgrade-20261003` (PR #62, draft). 2026-10-03, commits
`f8c7f75f … 0c56d5ca`. Host chains stayed paused: **nothing here was booted**; every
claim below is either read from source or checked by a test that needs no host.

## First, the count in the PR body was wrong — here is the real one

The PR said "5 other kits still use the removed `.agent-presets` seam". Grepping the
sources splits that differently:

| file | state before this round | now |
| --- | --- | --- |
| `tests/kits/c1-leader-approval-smoke` | wrote `.agent-presets/rc2-smoke/agent.cordis.yml` | declaration row on the patch seam |
| `tests/kits/exec-contract-live-smoke` | wrote it **twice** (`HOME_A`, `HOME_B`) | declaration row in **both** worlds |
| `tests/kits/send-message-liveness-smoke` | wrote `.agent-presets/sml-smoke/…` | declaration row on the patch seam |
| `tests/kits/work-completion-wakeup-smoke` | already mounted the host-shipped `standard` preset (migrated in the 0.1.7 round) | unchanged, now covered by the ledger |
| `tests/kits/pr-d-control-real-host` | already declared **no** preset id (deliberately the shipped default, documented at its create call) | unchanged, now covered by the ledger |
| `packages/runtime/root-binding/harness/run.mjs` | wrote `.agent-presets/p5t5-team-persona/…` with `config: { text: … }` | persona declaration row, written with the plugin row |
| `packages/runtime/member-residency/harness/run.mjs` | wrote **two** such fixtures (leader + member) with `text` | two persona declaration rows |

So: **3 kits and 2 harnesses were broken; 2 kits were already fine.** "5 kits" was an
unverified carry-over from my own earlier prose — the same failure mode as the "73
evidence files" number. Recount from the sources, not from this file.

## Why the old shape was worse than doing nothing

Two independent defects, both host-verified at `639ed01539…`:

1. **Nobody reads the directory.** `grep -rn ".agent-presets" packages/preset/**/*.ts`
   in the pinned tree returns only `'agent-presets-invariant'` (a row name). A preset
   is a `@deepseek-ai/dsh-agent-preset` **declaration row** on a patch layer
   (`packages/preset/agent-preset/package.json`, version `0.2.0-rc.2`), with roster
   identity `config.id`.
2. **The key was wrong even in the retired file.** `packages/preset/persona/src/index.ts`
   declares `Config = z.object({ prefix: z.string().required(), suffix: …, complete: …,
   includeRuntimeContext: … })` — there is **no `text` key**, and `prefix` is required.
   The fixtures all wrote `config: { text: … }`.

Net effect: a kit or harness documented a persona/tool surface, asserted against it,
and ran on the shipped default preset. For `exec-contract-live-smoke` that is the
world whose external hard-deny of the tools cell the dual gate is measured against;
for the two harnesses it is the leader/member persona property under test.

## What they do now

`tests/kits/_shared/preset-seam.mjs` is the single definition (no filesystem access):
persona row (`prefix`, never `text`) + optional `dsh-tool-fs` + the persistent shell
group, wrapped by `presetDeclarationRow({ id, … })`, emitted by `emitPatchLayer()`.
The emitter is **copied** from the rc2 kit's writer rather than re-derived — two YAML
writers in one repo is how a kit starts emitting something the host parses
differently — and its output is pinned by a golden-string test.

Content is deliberately unchanged per fixture: the kits keep persona + tool-fs +
bash stack with **no delegation group** (the 0.1.5 `subagent` row is still a deferred
own-layer install, un-restrictable and KNOWN_SENSITIVE under the Coverage Gate); the
harnesses keep persona **only**, since that is what they assert.

Both harnesses now write plugin rows *and* preset rows in one patch-layer write
(`DshInstance.mountRows()` expresses only `{ id, name }`, and a declaration needs
nested `config`), and each added a **pre-boot invariant** that fails the run if any
row id — plugin or preset — is missing from the emitted layer, so a later refactor
cannot silently drop the preset again.

## The guard is an assertion, not a comment

`packages/testkit/test/rc2-kit-preset-seam.test.ts` (15 tests, no host):

- **P1** golden patch-layer text; output contains no retired path.
- **P2/P3** row shape, roster `config.id`, and `prefix`-not-`text`.
- **P4** the host side, read from the mandated runtime tree via `tests/paths.mjs`:
  version, persona schema, `PERSONA_PREFIX_SECTION` / `PERSONA_SUFFIX_SECTION` exist
  and **`PERSONA_SECTION` does not**, and no preset source reads the retired directory.
- **P5** the migration ledger: migrated files are checked strictly, the unmigrated set
  must match exactly (it is **empty** now, kept as the shape the guard compares
  against), and a guard-self-test pins the pattern against the historical shapes taken
  from the base commit so the guard cannot be dulled into matching only its own syntax.
- **P6** the four files still importing the bare `PERSONA_SECTION` are enumerated by
  scan with their owner named (independent persona-residue patch). They are **not**
  touched here and **not** called debt: the set fails if it grows, and fails if a file
  is fixed without the ledger moving.

## Still owed on this lane (do not read the above as verification)

1. **No kit or harness was run.** The preset rows are statically correct; whether the
   host composes them as expected is a live-host question, blocked with the paused
   chains. The cheapest first check when that gate lifts: `dump-config` must show
   `@deepseek-ai/dsh-agent-preset` with the kit's `config.id`, and the leader surface
   must contain `bash`.
2. **The two harnesses still cannot boot on 0.2** — `plugin.mjs` / `slots.mjs` /
   `slots-t6.mjs` import `PERSONA_SECTION`, which the pinned host does not export.
   Owned by the persona-residue patch, deliberately untouched here.
3. `tests/characterization/lib/instance.mjs` still offers only `mountRows({id,name})`.
   Left alone on purpose: it is shared by the characterization probes, and this round
   emits the layer instead of widening shared infrastructure mid-review.
