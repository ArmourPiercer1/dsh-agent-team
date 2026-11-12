# A6-off × plane takeover — the missing A6-off measurement of the A1 seven clauses

**Class: `DEV-LIVE`.** This record can never produce a `V@B=yes`, is **not**
`CANDIDATE-C2`, and is not a frozen-candidate acceptance. `osLevelNetworkIsolationClaimed: false`
(the kit's own disclosure). Host pin **0.2.0-rc.2 @ `639ed01539`**, read-only;
`CORE PATCH BUDGET = 0` — no upstream file was touched; only the A1 kit (a new
`--a6-off` mode) and this evidence directory changed.

- Branch `task/a6off-plane-takeover-20261113`, worktree
  `.worktrees/a6off-plane-takeover-20261113`, based on `origin/master` =
  `1a677c5d4` (the C2 commit that records the refusals this evidence answers).
- Product code measured = **`1a677c5d4f29cbedd28ced94ff29c46a33eda3de`**. The
  runs were taken with the instrument edits in the working tree; the only
  changed paths were `tests/kits/**` and `dev/agent-workflow/evidence/**`, and
  `packages/runtime/dist` is byte-identical to that commit (no product change
  in this lane). The instrument itself is the commit that carries this file.
- Host tree after every run: `git status --porcelain` empty, `HEAD` =
  `639ed01539…` (`tests/deepseek-harness-test-use`, shared pristine runtime;
  the kit's documented fallback for task worktrees). OS sandbox backend: `full`
  (usable) in every run (`a1-sandbox-backend.json`).
- Worlds: fresh `tests/homes/c1-smoke-<stamp>` per run, removed after
  (`teardown.json#dshHomeRemoved=true`), blueprint dirs removed. Sanctioned
  ports only; the stable instance was never touched: `:3080` probed **401**
  before and after every run, `:3180` unreachable.

## The gap this closes

Two independent C2 adjudications of `cand-v0.1.6-3` refused to sign *"with
`alpha6ReviewRouting` off, Alpha.5 behaviour is unchanged"* because **no A6-off
measurement existed on the plane-takeover composition**. `a5sf-pd33-preview-e2e`
measures A6-off but mounts **no** `config.teamToolPlane` (its governed `bash` is
typed-shut by design after #730), and every instrument that mounts the takeover
pinned `ALPHA6_OFFICER = true`. The conjunction **plane takeover ∧ A6 routing
OFF ∧ governed bash works** was unmeasured.

## The exact flag that was flipped

`alpha6ReviewRouting` in the production row config, emitted into
`$DSH_HOME/profiles/web/cordis.patch.yml`:

- A6-on (the A1 kit's arm, unchanged): `alpha6ReviewRouting: true` plus
  `alpha6WakeIntentPath: "<DSH_HOME>/alpha6-wake-intents"`.
- **A6-off (new `--a6-off` mode): `alpha6ReviewRouting: false`**, with no
  wake-intent path (nothing durable is written in this mode). This is an
  explicit false, not an omission; the product's opt-in test is `=== true`
  (`packages/runtime/src/plugin/root.ts:2509`), so the row takes the pre-Alpha.6
  code path verbatim.
- Kit source: `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs`
  — `const A6_OFF = args.includes('--a6-off')` (L125),
  `const ALPHA6_OFFICER = !A6_OFF` (L149), the OFF row config (L729), the
  legacy-Leader approval branch (L2254), and `--print-composition` (L2347).
- **Everything else is held identical**: the v5 blueprint carrying
  `memberIoCeilings` + `reviewRouting` on one document, the shipped
  `a5sf-governed-member` preset and its `-plane` variant, the plane takeover
  that adopts the pinned native `bash` over the governed PTY
  (`teamToolPlane.names.bash = bash`), `DSH_PERMISSION_MODE=danger-full-access`,
  the host pin, the ports family. The blueprint's `reviewRouting` block stays in
  the document and is **inert** with the opt-in off (Alpha.6's parser is never
  invoked) — exactly the state a release that toggles this flag ships.

## Composition sha256 before / after

`--print-composition` renders the emitted composition without booting a Host and
records the digest below (`composition-a6-on/a1-composition.json`,
`composition-a6-off/a1-composition.json`). The patch text is normalized only for
`DSH_HOME` and the per-run stamp; every other byte is verbatim. The A6-on/off
diff (`composition-diff.txt`) is **two lines and nothing else**:

```diff
-        alpha6ReviewRouting: true
-        alpha6WakeIntentPath: "<DSH_HOME>/alpha6-wake-intents"
+        alpha6ReviewRouting: false
```

| composition artifact | A6-on | A6-off |
| --- | --- | --- |
| emitted profile patch, normalized (`patch.normalizedSha256`) | `c6e2a917bfcaab0eab21904445768411cfa904f7e4a2e801f7e02de009e23985` | `44a55713bd232ac57ba544ab309e959b41b436592b6c29fe790d2ff7b3616735` |
| A1 v5 blueprint, normalized (`blueprint.normalizedSha256`) | `8478f088b4763009d2e08efee37ea62563afa1741ddfca222633cb2cb7a576cd` | `8478f088b4763009d2e08efee37ea62563afa1741ddfca222633cb2cb7a576cd` (**identical**) |
| raw patch sha256 (run-specific: `DSH_HOME` + stamp) | control `f649feee7dc9e96e55a093e46c36ec2b158a1b365160fe8820c2d82af60968d5` | run1 `195578edf3f7ba92cc3f5ef4aeb0968cc524b7206fdcd9d780e4363b14e3b91c`, run2 `33ff6ead650a5caf0ed35da75b415b0095dd5fe01c93541d229d2a46aa55bc5b` |
| product `blueprintHash` (server-computed, per-world paths) | `sha256:7e92c993…` | run1 `sha256:876f9637…`, run2 `sha256:ea8619a7…` |

The blueprint normalization proves the *document* is unchanged across the flip;
the raw hashes differ only because each world's absolute workspace path is part
of the document. Both A6-off runs produce the **same normalized patch digest**,
and the A6-on control differs from it only by the flag/wake-path lines.

## The approval path (why all seven clauses are REACHABLE with A6 off)

With the opt-in off there is no Officer review wake. A governed `bash` ask
travels the product's **legacy Leader path**: a durable
`[team-control requestId=…]` notification to the Team's Leader, which lists and
resolves the row through the production `team_list_pending_control` /
`team_resolve_control` tools (the same loop `c1-leader-approval-smoke`
measures). Evidence per A6-off run:

- `a1-leader-notifications.log` — every Leader notification turn captured:
  **11 unique `requestId`s** (one per approval leg) across 36 model-call
  appends (each notification turn makes list → resolve → done calls), each
  carrying `reviewAuthority: leader` (e.g. the first block in run1 names the
  inside write, `requestId=ctrl-…`, `leg: 1`). No `a1-officer-wakes.log` exists
  in the A6-off runs (the A6-on control has one: 528 lines).
- `a1-ledger.json` — 11 control requests, 11 decisions, 10 allow-consumptions,
  10 execution-result facts, 0 abandonments; every request's
  `reviewAuthority` is `leader`.
- `a1-deny.json` — the deny leg is the **11th** request: the row belongs to the
  `w-deny` Member, `decision: deny`, **0** execution-result facts, **0**
  consumptions, target file absent, and the Member's turn received
  `Error: the approval was denied`. **A1-7 is PASS, not NOT_REACHED**: the
  approval path exists with A6 off and its deny branch is exercised.

## Seven clauses, A6-off, run 1 and run 2

Both runs: fresh world, `alpha6ReviewRouting: false`, plane takeover mounted,
governed preset, `danger-full-access` host default. Full measured strings:
`a6off-run1/a1-arms.md`, `a6off-run2/a1-arms.md`.

| clause | proposition | run 1 | run 2 | measured fact (both runs) |
| --- | --- | --- | --- | --- |
| **A1-1** | write INSIDE the Member root is allowed | **PASS** | **PASS** | file exists, size 40, bytes equal the payload, tool saw exit 0 |
| **A1-2** | write OUTSIDE the Member ceiling is refused by the OS sandbox, zero bytes | **PASS** | **PASS** | real read after refusal = `ENOENT`; shell's own `Read-only file system`, `A1_OUTSIDE_EXIT=1`; 0 bytes |
| **A1-3** | the same Member keeps `cd` + `export` + a written file across calls | **PASS** | **PASS** | call B: `$PWD` = `workspace/a1-sub`, `$A1VAR` = `a1-value`, `marker.txt` = payload (read back) |
| **A1-4** | a second Member cannot see the first Member's PTY state | **PASS** | **PASS** | w2 has its own cwd, empty export; host PTY fds 1 → 2; process start-time differs |
| **A1-5** | wrong/prefixed session id refused BEFORE a PTY exists | **PASS** | **PASS** | 3 typed refusals (`session/not-found` ×2, `TEAM_REMOTE_FOREIGN_TEAM`); PTY fds 2 → 2; model turns 45 → 45; quiesced before the window |
| **A1-6** | the Host's `danger-full-access` default is NARROWED, not inherited | **PASS** | **PASS** | root agent writes 41 bytes outside; the Member's identical write stays absent; Member refusal signal captured |
| **A1-7** | a DENIED approval = zero native bash executions | **PASS** | **PASS** | deny row owned by the deny Member; `decision: deny`; 0 executions; 0 consumptions; 0 bytes; tool refusal seen |

Run1: 7 PASS / 0 FAIL / 0 NOT_REACHED. Run2: 7 PASS / 0 FAIL / 0 NOT_REACHED.
`a6off-agreement.json` → **`verdictsAgree: true`, `detailsAgree: true`** (the
detail compared after the kit's normalizations for stamp/ids/paths/hashes/wait
ms; this includes the new A1-5 quiesce wait).

## Same-tree A6-on control

`a6on-control-run1/` is the kit's original mode on the **same tree and
instrument revision** (the A1-on arm: `alpha6ReviewRouting: true`, Officer wake).
It is an instrument-integrity control, **not** a replacement for the four
recorded A6-on runs in `dev/agent-workflow/evidence/a1-bash-governance/` (which
are untouched). Result: **7 PASS**, `a1-officer-wakes.log` present (528 lines),
`a1on-vs-a6off-agreement.json` → **`verdictsAgree: true`, `detailsAgree: true`**.
So on one tree, flipping only the flag leaves every clause verdict and every
normalized measured detail unchanged.

## One disclosed instrument race (kept, not hidden)

`a6off-run2-turn-race/` is an A6-off run that **FAILED A1-5**, preserved on
purpose. Cause, named from its mock log: `turnsBefore=44`, `turnsAfter=45`, and
the extra request (#45) replied `A1_LEGACY_APPROVAL_DONE` — a late Leader
notification turn for an approval leg that had **already been resolved** (the
w2 leg, decisions at #41/#42). The refused session ids produced nothing; a
global model-call counter counted an unrelated in-flight turn.

Fix (measurement only): A1-5 now waits for a **quiescence barrier** (2 s without
a new model request, 15 s cap) before opening its 2 s observation window, and
`a1-precreation-window.json` names every request that lands inside it. The
proposition is unchanged, a turn caused by the refused id still lands inside the
window and still fails, and the failing run is retained so a reviewer can check
the claim rather than take it. The 2 s quiesce wait is normalized by
`compare-a1-runs.mjs` (timing artifact, like the existing wait-ms fields).

## A5 Goal path with A6 off — NOT MEASURED by this kit

The A1 kit has **no Goal arm**: it drives `bash` probes through the governed
preset's shell face and never calls `create_goal`/`get_goal`/`update_goal`, and
it drives no goal rounds. It **cannot** be used to measure "A6 off ⇒ Goals still
work" without becoming a different instrument (an eighth arm, a goal driver, a
different seven-clause record) — so this evidence says **NOT MEASURED**, not
PASS, and does not silently drop the objective's goal clause.

What is true and disclosed:

- the A6-off composition **does** mount the upstream goal rows (`command-goal`,
  `tool-goal`) in both governed presets — visible in the emitted patch inside
  `a1-composition.json` — so the tools exist in this world; that is a
  composition fact, **not** a goal-path measurement;
- the nearest existing A6-off goal evidence is
  `dev/agent-workflow/evidence/a5sf-pd29-goal-stop/` (governed Member, goal
  create → rounds → stop, Alpha.6 opt-in absent), but that composition does
  **not** mount the plane takeover;
- therefore the three-way conjunction **Goal ∧ plane takeover ∧ A6-off** remains
  unmeasured, and a release must not cite this directory for it.

## What this evidence lets a release claim

> On the plane-takeover composition (v5 `memberIoCeilings` + `reviewRouting`,
> shipped governed Member preset, pinned native `bash` adopted over the governed
> PTY, Host default `danger-full-access`), with `alpha6ReviewRouting`
> **explicitly false**, all seven A1 clauses — allowed and OS-refused writes,
> PTY persistence and cross-Member isolation, pre-creation session refusals,
> narrowing of the full-access default, and denied-approval zero-execution —
> **reproduce identically across two fresh worlds** and **match an A6-on control
> on the same tree**. The mixed composition that the two C2 refusals named is now
> measured: *plane takeover + Alpha.6 routing off + governed bash works as
> Alpha.5 specifies.*

## What it still does not claim

- **Not a candidate record.** `DEV-LIVE`, no `V@B`, never `CANDIDATE-C2`, no
  Authority/candidate-ref binding, no independent adjudication.
- **Not stability.** Two agreeing runs are agreement; one run of the same mode
  failed A1-5 for the disclosed instrument race before the quiescence barrier.
- **Not the A5 Goal path** and not any other plane tool (`fs`, `search`, `web`,
  jobs): the seven clauses measure the `bash` face only.
- **Not read-scope admission.** The governed PTY path carries no PD-13 lexical
  read allowlist; read scope rests on the OS profile (the kit's standing limit).
- **Not a proof about other A6 deployments**: only this composition, this host
  pin (`0.2.0-rc.2 @ 639ed01539`), this flag spelling (explicit `false`).
- **No P0 exposed.** Flipping A6 off did **not** break the plane-takeover bash
  path: the allow/deny/OS-refusal/persistence/isolation measurements all hold.
  No typed admission token (`A5_NATIVE_ADMISSION_UNAVAILABLE` or otherwise)
  appeared; the plane's `bash` executed under approval in both modes.

## Reproduce

```bash
# composition digests, no Host
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse <pristine-host-tree> \
  --a6-off --print-composition \
  --evidence-dir "$PWD/dev/agent-workflow/evidence/a6off-plane-takeover-20261113/composition-a6-off"

# the two measurements (fresh DSH_HOME each, sanctioned ports)
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse <pristine-host-tree> \
  --a6-off --host-port 3187 --mock-port 3496 \
  --evidence-dir ".../a6off-run1"
node tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs \
  --worktree "$PWD" --testuse <pristine-host-tree> \
  --a6-off --host-port 3188 --mock-port 3497 \
  --evidence-dir ".../a6off-run2"
node tests/kits/a1-bash-governance-20261112/compare-a1-runs.mjs \
  ".../a6off-run1" ".../a6off-run2" ".../a6off-agreement.json"
```

## Files

| path | what it is |
| --- | --- |
| `a6off-run1/`, `a6off-run2/` | the two A6-off measurements (7 clauses, ledger, notifications, world/teardown/probes) |
| `a6on-control-run1/` | same-tree A6-on control |
| `a6off-run2-turn-race/` | the retained A1-5 instrument-race failure and its mock log |
| `a6off-agreement.json`, `a6on-vs-a6off-agreement.json` | field-by-field agreement (`verdictsAgree`/`detailsAgree` true) |
| `composition-a6-on/`, `composition-a6-off/`, `composition-diff.txt` | emitted composition + the exact two-line flip |
| `a6off-run{1,2}.out`, `a6on-control-run1.out` | driver stdout/exit for each run |
