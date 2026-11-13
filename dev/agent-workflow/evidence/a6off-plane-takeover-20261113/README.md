# A6-off × plane takeover — the missing A6-off measurement of the A1 seven clauses

**Class: `DEV-LIVE`.** This record can never produce a `V@B=yes`, is **not**
`CANDIDATE-C2`, and is not a frozen-candidate acceptance. `osLevelNetworkIsolationClaimed: false`
(the kit's own disclosure). Host pin **0.2.0-rc.2 @ `639ed01539`**, read-only;
`CORE PATCH BUDGET = 0` — no upstream file was touched.

- Branch `task/a6off-evidence-refresh-20261113`, worktree
  `.worktrees/a6off-evidence-refresh-20261113`, based on `origin/master` =
  **`76a86d6e9`** (the FREEZE commit that supersedes `cand-v0.1.6-3`).
- Product code measured = **`76a86d6e9`**. This lane changed **only** evidence,
  the append-only router log, and one test-driver README (the PD33 disclosure
  below); `packages/**`,
  `tests/kits/**`, Authority, candidate refs and Required-CI are untouched.
  `packages/runtime/dist` is byte-identical to `76a86d6e9`.
- The instrument is the **frozen kit in this tree**,
  `tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs` (no edits in
  this round). Its current `a1-composition.json` schema is
  `patch: {rawSha256, normalizedSha256, text}` +
  `blueprint: {rawSha256, normalizedSha256, text}`.
- Worlds: fresh `tests/homes/c1-smoke-<stamp>` per run, removed at teardown
  (`teardown.json#dshHomeRemoved=true`), blueprint dirs removed. Sanctioned
  ports only; the stable instance was never touched: `:3080` probed **401**
  before and after every run, `:3180` unreachable. OS sandbox backend: `full`
  (usable) in every run.

## Why this directory was re-cut (the C2-B refusal)

PR #745 (`0d31f9121`) landed the **claims**, and an independent C2-B
adjudicator re-measured them with the frozen kit and found them true — but
refused the **artifacts** because they were not what the instrument in the tree
writes. The artifacts committed by #745 are retained under
`superseded/20261113-original-artifacts/` with a dated `NOTE.md`; they are not
current evidence. Defect → fix, one line each:

| # | defect as found in the #745 artifacts | fixed here |
| --- | --- | --- |
| 1 | `composition-a6-{on,off}/a1-composition.json` had `blueprint: {sha256: null, text: ""}` — an old schema the frozen kit no longer emits — so the README's `blueprint.normalizedSha256 = 8478f088…` was absent from the files | composition artifacts are now the **run emission** of the frozen kit: `blueprint: {rawSha256, normalizedSha256, text}`, `normalizedSha256 = 8478f088…` present and non-null (see "Composition") |
| 2 | the committed A6-off ledgers show **6× `reviewAuthority="leader"` + 5× no field**, while the README said *every* request carries `leader` | the README now states the measured split (6 / 5), names why (the second `team-tool-execute` leg of each allow pair records no `reviewAuthority`), and states separately that all 11 decisions are by the Leader (`decider.role="leader"`) |
| 3 | `composition-a6-{on,off}/a1-composition.patch.yml` existed although the frozen kit never writes a `.patch.yml` (produced by a different, uncommitted instrument revision) | no `.patch.yml` is written by the kit or retained here; the two-line flip is shown as a diff of the JSON `patch.text` fields |

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

- A6-on (the kit's arm, unchanged): `alpha6ReviewRouting: true` plus
  `alpha6WakeIntentPath: "<DSH_HOME>/alpha6-wake-intents"`.
- **A6-off (`--a6-off`): `alpha6ReviewRouting: false`**, with no wake-intent
  path (nothing durable is written in this mode). This is an explicit false,
  not an omission; the product's opt-in test is `=== true`
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
  the document and is **inert** with the opt-in off — exactly the state a
  release that toggles this flag ships.

## Composition (what the frozen kit writes)

`composition-a6-on/a1-composition.json` and
`composition-a6-off/a1-composition.json` are **byte-identical copies** of the
`a1-composition.json` the kit wrote inside `a6on-control-run1/` and
`a6off-run1/` respectively (sha256 below). The current instrument writes that
file with a non-null blueprint at the end of a run, after it has emitted the A1
document; there is no `.patch.yml` artifact.

| composition artifact | A6-on | A6-off |
| --- | --- | --- |
| emitted profile patch, normalized (`patch.normalizedSha256`) | `5f2d77492669b0f621a36e399e9fd8388e40fb150ba8383a04b8e42d9245acb2` | `0f14331ed55084e4ab8889e2400fc6b51fa08f2a958e797fe558f49ca194a202` |
| A1 v5 blueprint, normalized (`blueprint.normalizedSha256`) | `8478f088b4763009d2e08efee37ea62563afa1741ddfca222633cb2cb7a576cd` | `8478f088b4763009d2e08efee37ea62563afa1741ddfca222633cb2cb7a576cd` (**identical**) |
| raw patch sha256 (run-specific: `DSH_HOME` + stamp) | run1 `a8984ad93c876064b9fa82262ffec6a55f5801674d5764e60f829904b276401d`, run2 `9af868d09afb7b29152e954f02ee0f0f383af3fb8dcb766cb07d6089ebe05466` | run1 `bcc86c7695fbf6980b64a1c3191dabba4d8e3ae919e5556743f09797df05c421`, run2 `c54563cb08e38ab6122e085c946d38a842bb8ea6c544776d00e6542e78505696` |
| raw blueprint sha256 (run-specific: stamp in the document) | run1 `83bfe42ee0b3f82f03b0799419feca4519392f96ab4465e44872e2def098445f`, run2 `94ce457aaa07ef5aeaa46f3188dc35c0d49c726e6d0577913e5cd47bcc4dbdae` | run1 `6b45fa21545b854fdea4b4175203738f4bb1a67e224a76a172dafd589d8f7499`, run2 `aa0184d3a5ba68f41cb433106f25349a759b64d742c3c90ca1d91df6034a51cd` |
| artifact file sha256 (run1 copy) | `ed1049bf37fdf08b679a108a6e2f1ebfe3388b1c03cc1caf66693c496ac78890` | `bff99840b0e13b8d4ff588dd39dffd07977b3de6d8a344541e4d679da95d42e2` |
| product `blueprintHash` (server-computed, per-world paths) | run1 `sha256:a4d77e080583463aade7ce039d6b6cb45663a58e887ad98af59f716598c74599`, run2 `sha256:08f6af87c38c9da3ff60fa09a1c7890cc3b3d6545a06cf22bdbb4f0e274760d7` | run1 `sha256:8fccd3209118d30fa2e4dde5ea81dc742f9cc4834f68cb19bb798e655e654464`, run2 `sha256:2ebc87215386ac2e169bf2c22545669727c694f29ecd3f8abb011b1cad80eddc` |

The blueprint normalization proves the *document* is unchanged across the flip;
the raw hashes differ only because each world's absolute workspace path / stamp
is part of the document. The two-run A6-off artifacts have the **same
normalized patch and blueprint digests**.

### `--print-composition` cross-check (and its disclosure)

`--print-composition` is **host-free**: it renders the row config, writes
`$DSH_HOME/profiles/web/cordis.patch.yml`, and hashes it. It never creates the
A1 blueprint document, so its `a1-composition.json` necessarily carries
`blueprint: {rawSha256: null, normalizedSha256: null, text: null}`. That is why
the canonical composition artifacts above are the **run emissions** (same kit,
same revision) and not the print-mode files. What print mode *does* prove is
that the patch is stable: its normalized patch digest equals the run's.

```text
--print-composition --a6-off → patch.normalizedSha256 = 0f14331ed55084e4ab8889e2400fc6b51fa08f2a958e797fe558f49ca194a202
--print-composition (A6-on)  → patch.normalizedSha256 = 5f2d77492669b0f621a36e399e9fd8388e40fb150ba8383a04b8e42d9245acb2
```

Both equal the run-emitted `patch.normalizedSha256` above. The A6-on/off diff
(`composition-diff.txt`) is **two lines and nothing else**:

```diff
-        alpha6ReviewRouting: true
-        alpha6WakeIntentPath: "<DSH_HOME>/alpha6-wake-intents"
+        alpha6ReviewRouting: false
```

## The four current runs

| run dir | mode | stamp | host/mock port | seven clauses | backend | teardown |
| --- | --- | --- | --- | --- | --- | --- |
| `a6off-run1/` | A6-off | `2026-11-12T22-43-40-h0-r052229` | 3191 / 3496 | 7 PASS, 0 FAIL, 0 NOT_REACHED | full | home+blueprints removed |
| `a6off-run2/` | A6-off | `2026-11-12T22-44-47-h0-r5e446b` | 3192 / 3497 | 7 PASS, 0 FAIL, 0 NOT_REACHED | full | home+blueprints removed |
| `a6on-control-run1/` | A6-on | `2026-11-12T22-45-45-h0-rc2e734` | 3193 / 3498 | 7 PASS, 0 FAIL, 0 NOT_REACHED | full | home+blueprints removed |
| `a6on-control-run2/` | A6-on | `2026-11-12T22-46-46-h0-rc4e332` | 3194 / 3499 | 7 PASS, 0 FAIL, 0 NOT_REACHED | full | home+blueprints removed |

## The approval path (why all seven clauses are REACHABLE with A6 off)

With the opt-in off there is no Officer review wake. A governed `bash` ask
travels the product's **legacy Leader path**: a durable
`[team-control requestId=…]` notification to the Team's Leader, which lists and
resolves the row through the production `team_list_pending_control` /
`team_resolve_control` tools. Evidence per A6-off run:

- `a1-leader-notifications.log` — 544 log lines carrying **11 unique
  `requestId`s** (one approval pair per leg; each notification turn lists →
  resolves → finishes). No `a1-officer-wakes.log` exists in the A6-off runs.
- `a1-ledger.json` — **11 control requests, 11 decisions (10 allow / 1 deny),
  10 allow-consumptions, 10 execution-result facts, 0 abandonments**.
- **`reviewAuthority` breakdown (A6-off, both runs)** — of the 11 requests,
  **6 carry `reviewAuthority: "leader"`** and **5 carry no `reviewAuthority`
  field at all**. The 6 are the `parameter-permission` legs (including the deny
  leg); the 5 are the follow-on `team-tool-execute` legs, whose recorded fact
  does not carry the field. This is a schema fact of the ledger, not a routing
  difference: **all 11 decisions name the Leader**
  (`decider.role = "leader"`, `instanceId = "inst-leader"`). The earlier README
  sentence "every request's `reviewAuthority` is `leader`" was false for
  A6-off; the corrected claim is this split.
- `a1-deny.json` — the deny leg is the **11th** request: the row belongs to the
  `w-deny` Member, `decision: deny`, **0** execution-result facts, **0**
  consumptions, target file absent, and the Member's turn received
  `Error: the approval was denied`. **A1-7 is PASS, not NOT_REACHED**.

The A6-on control has a different recorded shape, and the difference is part of
the measurement: **11/11 requests carry `reviewAuthority: "leader"`**, while
**all 11 decisions are made by the Officer Member** (`decider.role = "member"`,
`decider.kind = "instance"`), and `a1-officer-wakes.log` is present with 528
lines in both A6-on runs. The Decision record — not the request's
`reviewAuthority` label — is where the actual reviewer is read.

## Seven clauses, twice per mode

Both modes: fresh world, plane takeover mounted, governed preset,
`danger-full-access` host default. Full measured strings: each run's
`a1-arms.md`.

| clause | proposition | off run1 | off run2 | on run1 | on run2 | measured fact |
| --- | --- | --- | --- | --- | --- | --- |
| **A1-1** | write INSIDE the Member root is allowed | **PASS** | **PASS** | **PASS** | **PASS** | file exists, size 40, bytes equal the payload, tool saw exit 0 |
| **A1-2** | write OUTSIDE the Member ceiling refused by the OS sandbox, zero bytes | **PASS** | **PASS** | **PASS** | **PASS** | real read after refusal = `ENOENT`; shell's own `Read-only file system`, `A1_OUTSIDE_EXIT=1`; 0 bytes |
| **A1-3** | the same Member keeps `cd` + `export` + a written file across calls | **PASS** | **PASS** | **PASS** | **PASS** | call B: `$PWD` = `workspace/a1-sub`, `$A1VAR` = `a1-value`, `marker.txt` = payload (read back) |
| **A1-4** | a second Member cannot see the first Member's PTY state | **PASS** | **PASS** | **PASS** | **PASS** | w2 has its own cwd, empty export; host PTY fds 1 → 2; process start-time differs |
| **A1-5** | wrong/prefixed session id refused BEFORE a PTY exists | **PASS** | **PASS** | **PASS** | **PASS** | 3 typed refusals (`session/not-found` ×2, `TEAM_REMOTE_FOREIGN_TEAM`); PTY fds 2 → 2; model turns 45 → 45; quiesced before the window |
| **A1-6** | the Host's `danger-full-access` default is NARROWED, not inherited | **PASS** | **PASS** | **PASS** | **PASS** | root agent writes 41 bytes outside; the Member's identical write stays absent; Member refusal signal captured |
| **A1-7** | a DENIED approval = zero native bash executions | **PASS** | **PASS** | **PASS** | **PASS** | deny row owned by the deny Member; `decision: deny`; 0 executions; 0 consumptions; 0 bytes; tool refusal seen |

## Two-run agreement (both modes) and the cross-mode check

- A6-off: `a6off-agreement.json` → **`verdictsAgree: true`, `detailsAgree: true`**
  (7/7 clauses PASS in both runs).
- A6-on: `a6on-run1-vs-run2-agreement.json` → **`verdictsAgree: true`,
  `detailsAgree: true`** (7/7 PASS in both runs).
- A6-on vs A6-off: `a6on-vs-a6off-agreement.json` → **`verdictsAgree: true`,
  `detailsAgree: true`** — flipping only the flag leaves every clause verdict
  and every normalized measured detail unchanged.

The detail comparison is the kit's `compare-a1-runs.mjs` after its documented
normalizations for stamp/ids/paths/hashes/wait-ms (including the A1-5 quiesce
wait).

## Retained failure (history, not current evidence)

`superseded/20261113-original-artifacts/a6off-run2-turn-race/` is the old
A6-off run that **FAILED A1-5** because a late Leader notification turn for an
already-resolved leg landed inside the 2 s observation window. It is retained
there so a reviewer can check the claim; the current runs use the A1-5
quiescence barrier and agree.

## A5 Goal path with A6 off — NOT MEASURED by this kit

The A1 kit has **no Goal arm**: it drives no `create_goal`/`get_goal`/
`update_goal` and no goal rounds. It **cannot** be used to measure "A6 off ⇒
Goals still work" without becoming a different instrument, so this evidence says
**NOT MEASURED**, not PASS.

What is true and disclosed:

- the A6-off composition **does** mount the upstream goal rows (`command-goal`,
  `tool-goal`) in both governed presets — visible in the emitted patch inside
  `a1-composition.json` — so the tools exist in this world; that is a
  composition fact, **not** a goal-path measurement;
- the nearest existing A6-off goal evidence is
  `dev/agent-workflow/evidence/a5sf-pd29-goal-stop/`, which does **not** mount
  the plane takeover;
- therefore the three-way conjunction **Goal ∧ plane takeover ∧ A6-off** remains
  unmeasured, and a release must not cite this directory for it.

## PD33 disclosure (dated note)

The `PD33-SUPERSEDED` pin is a **source-text tripwire**
(`doesNotMatch(DRIVER, /teamToolPlane\s*:/)`), not a semantic composition check.
It stops the obvious silent plane mount but would not catch a computed key or a
multi-line `capabilities` block. This limit is now named in
`tests/world-factory/drivers/a5sf-pd33-preview-e2e/README.md` (2026-11-13); the
pin itself was **not weakened**. That README (plus the append-only router log
entry) is the only non-evidence change this lane made.

## What this evidence lets a release claim

> On the plane-takeover composition (v5 `memberIoCeilings` + `reviewRouting`,
> shipped governed Member preset, pinned native `bash` adopted over the governed
> PTY, Host default `danger-full-access`), with `alpha6ReviewRouting`
> **explicitly false**, all seven A1 clauses — allowed and OS-refused writes,
> PTY persistence and cross-Member isolation, pre-creation session refusals,
> narrowing of the full-access default, and denied-approval zero-execution —
> **reproduce identically across two fresh worlds** and **match an A6-on control
> on the same tree**, which itself reproduces across two runs.

## What it still does not claim

- **Not a candidate record.** `DEV-LIVE`, no `V@B`, never `CANDIDATE-C2`, no
  Authority/candidate-ref binding, no independent adjudication.
- **Not stability.** Two agreeing runs are agreement, not a stability proof.
- **Not the A5 Goal path** and not any other plane tool (`fs`, `search`, `web`,
  jobs): the seven clauses measure the `bash` face only.
- **Not read-scope admission.** The governed PTY path carries no PD-13 lexical
  read allowlist; read scope rests on the OS profile (the kit's standing limit).
- **Not a proof about other A6 deployments**: only this composition, this host
  pin (`0.2.0-rc.2 @ 639ed01539`), this flag spelling (explicit `false`).

## Reproduce

From the worktree root (paths are the ones used; substitute another sanctioned
port pair if occupied — never 3080, and `3180` is excluded from World leases):

```bash
cd .worktrees/a6off-evidence-refresh-20261113
KIT=tests/kits/a1-bash-governance-20261112/a1-bash-governance.mjs
TESTUSE=/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
E=dev/agent-workflow/evidence/a6off-plane-takeover-20261113

# 1) composition, host-free; its patch digest must match the run's below.
#    (Its blueprint fields are null by design: no A1 document is built host-free.)
node "$KIT" --worktree "$PWD" --testuse "$TESTUSE" --a6-off --print-composition \
  --evidence-dir "$PWD/.artifacts/tmp/comp-off"
node "$KIT" --worktree "$PWD" --testuse "$TESTUSE" --print-composition \
  --evidence-dir "$PWD/.artifacts/tmp/comp-on"

# 2) the four measurements (fresh DSH_HOME per run; sanctioned ports)
node "$KIT" --worktree "$PWD" --testuse "$TESTUSE" --a6-off \
  --host-port 3191 --mock-port 3496 --evidence-dir "$PWD/$E/a6off-run1"
node "$KIT" --worktree "$PWD" --testuse "$TESTUSE" --a6-off \
  --host-port 3192 --mock-port 3497 --evidence-dir "$PWD/$E/a6off-run2"
node "$KIT" --worktree "$PWD" --testuse "$TESTUSE" \
  --host-port 3193 --mock-port 3498 --evidence-dir "$PWD/$E/a6on-control-run1"
node "$KIT" --worktree "$PWD" --testuse "$TESTUSE" \
  --host-port 3194 --mock-port 3499 --evidence-dir "$PWD/$E/a6on-control-run2"

# 3) agreement, twice per mode and across modes
node tests/kits/a1-bash-governance-20261112/compare-a1-runs.mjs \
  "$E/a6off-run1" "$E/a6off-run2" "$E/a6off-agreement.json"
node tests/kits/a1-bash-governance-20261112/compare-a1-runs.mjs \
  "$E/a6on-control-run1" "$E/a6on-control-run2" "$E/a6on-run1-vs-run2-agreement.json"
node tests/kits/a1-bash-governance-20261112/compare-a1-runs.mjs \
  "$E/a6on-control-run1" "$E/a6off-run1" "$E/a6on-vs-a6off-agreement.json"

# 4) canonical composition artifacts = the run emissions (byte-identical copies)
cp "$E/a6off-run1/a1-composition.json" "$E/composition-a6-off/a1-composition.json"
cp "$E/a6on-control-run1/a1-composition.json" "$E/composition-a6-on/a1-composition.json"

# 5) the two-line flip, diffed from the JSON patch text (no .patch.yml is stored)
mkdir -p .artifacts/tmp
node -e '
const fs=require("fs"),E=process.argv[1];
const on=JSON.parse(fs.readFileSync(E+"/composition-a6-on/a1-composition.json"));
const off=JSON.parse(fs.readFileSync(E+"/composition-a6-off/a1-composition.json"));
fs.writeFileSync(".artifacts/tmp/cdiff-on.yml",on.patch.text);
fs.writeFileSync(".artifacts/tmp/cdiff-off.yml",off.patch.text);
' "$E"
diff -u --label "composition-a6-on/a1-composition.json (patch.text)" \
  --label "composition-a6-off/a1-composition.json (patch.text)" \
  .artifacts/tmp/cdiff-on.yml .artifacts/tmp/cdiff-off.yml > "$E/composition-diff.txt"

# 6) host tree must be byte-clean after the runs
git -C "$TESTUSE" status --porcelain   # empty
git -C "$TESTUSE" rev-parse HEAD      # 639ed015397290b3745d163aafe02ffee4aa3f84
```

The kit itself sets `DSH_HOME=<worktree>/tests/homes/c1-smoke-<stamp>` and
`DSH_PERMISSION_MODE=danger-full-access` for the Host; no ambient DSH variable
is required. It also probes `:3080` (must stay 401) and `:3180` (unreachable)
before and after each run.

## Files

| path | what it is |
| --- | --- |
| `a6off-run1/`, `a6off-run2/` | **current** — the two A6-off measurements (7 clauses, ledger, notifications, world/teardown/probes) |
| `a6on-control-run1/`, `a6on-control-run2/` | **current** — the two A6-on controls on the same tree and instrument revision |
| `a6off-agreement.json`, `a6on-run1-vs-run2-agreement.json`, `a6on-vs-a6off-agreement.json` | **current** — field-by-field agreement, all `verdictsAgree`/`detailsAgree` true |
| `composition-a6-on/`, `composition-a6-off/` | **current** — the run-emitted composition JSONs (non-null blueprint), byte-identical to the run1 files |
| `composition-diff.txt` | **current** — the two-line flag flip, from the JSON `patch.text` |
| `a6off-run{1,2}.out`, `a6on-control-run{1,2}.out` | **current** — driver stdout/exit for each run |
| `superseded/20261113-original-artifacts/` | **retained but superseded** — every artifact PR #745 committed (its run dirs, composition dirs with the phantom `.patch.yml`, agreements, the turn-race failure) plus `NOTE.md` saying why; do **not** cite |
