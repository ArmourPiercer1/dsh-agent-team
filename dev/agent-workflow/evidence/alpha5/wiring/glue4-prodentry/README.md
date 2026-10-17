# glue4-prodentry — GLUE-4 scoped-visibility reconnaissance: measured verdict = NO public scoped-visibility assembly surface FOR THE DISCOVERY-STYLE / INHERITED-NATIVE LANE (stop + adjudication) — scope since amended by **Q4 / R1 placement** (see AMENDMENT)

Writer lane: GLUE-4 (受治理 team 工具面 = 生产装配入口补齐). Base `master@a2473203`
(≥ `a2473203` + `8e554d4a` anchors both in-tree), branch `alpha5-glue4-prodentry`,
host pin `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain-clean
before AND after every world; G1 in every run). Worlds on port **3187** (free
self-proved G2a); `:3080` read-only probed 401→401, never operated (G2b); all
`tests/homes/a5g4-*` swept (G3, verified absent). IF-5 shared surface
(`packages/`, `scripts/`, root `vitest.config.ts`, root `cordis.patch.yml`)
byte-untouched (G1b): the whole method is the two files in THIS directory.
No `DSH_PERMISSION_MODE` knob anywhere — no tool ever executes in this kit;
catalog faces are read, never driven.

## AMENDMENT (2026-10-17, per RA-REVIEW `4ba92b77` on `alpha5-ra-review`; **Q4 = root approval as implementation completion WITHIN the original authorization semantics (the wiring phase's standing authorization) — not a new user adjudication; Q2 rejected on R5, Q1 demoted, Q3 rejected all stand**)

The NO verdict below is the measured law of the **discovery-style /
inherited-native lane** — verified INHERITED bindings earned through the
unscoped trusted GLOBAL read (`nativeNames` ← `tools.schemas()`,
agent-bindings.mjs:2248-2266). It stands verbatim for that lane (and the guard's
inherited-side reads are NOT revisable — counter-proved, RA-REVIEW ①). It does
**not** extend to the **R1 PLACEMENT lane** the frozen design itself prescribes
(`docs/plans/memo/alpha5-tool-io-governance/post-poc-technical-design.md:42`):
the Team assembles its OWN reviewed Definitions into each governed Agent's
**own layer** (the ONE non-inherited layer — law 3's own-registration
carve-out), so scoped visibility is INTRINSIC (non-team sessions see byte-zero
delta; RA-REVIEW H9 re-measured `minimal=["bash"]` unchanged with the assembly
mounted) and verified-ness is **placement attribution**: assembly performs the
`register` itself, pins the object IT placed, and every call re-reads
`get(name, agent)` to compare identity — NOT a discovery-style comparison-side
swap (that variant verifies the SHADOWING body = the exact R-a attack; RA-REVIEW
R5 falsification ⇒ it is rejected as Q2).

**R1 placement is verifiable TODAY with production parts already shipping**
(line numbers re-checked by this lane on base `a2473203`):
`packages/runtime/tool-dispatch/install.ts:987-1029` (`bindAll`: pins the
scoped `readDefinition` fingerprint and stamps `verified: true` through
`dispatcher.bind`), `install.ts:1106` (`bindOwnTools`),
`install.ts:1062-1063` (owned names are FILTERED OUT of `nativeNames` — team-own
never rides the inherited lane), and the production call site
`packages/runtime/src/plugin/live/agent-bindings.mjs:2460-2471` (STEP-5 PUBLISH
`bindOwnTools`, fail-closed throw on any unbindable name). Evidence:
`evidence/alpha5/wiring/ra-review/` @ `4ba92b77` — Tier-A synthetic world on the
REAL compiled guard GREEN 11/11 (verified under team assembly with an EMPTY
global face + `minimal` non-team byte-zero + NC-1 cross-realm / NC-2
revocation-regeneration / NC-3 forged-scope negative controls, R5 counter-proof)
and Tier-B pinned-host read-only probe GREEN 10/10.

**Consequence for the adjudication questions below:** the generalization
"assembly is blocked until Q1/Q2/Q3" is WITHDRAWN — it was scoped to the
discovery-style reads this kit measured and did not weigh the placement lane.
**Q4 (R1 placement; R-a frozen semantics UNCHANGED) is root approval as
implementation completion WITHIN the original authorization semantics (the
wiring phase's standing authorization) — NOT a new user adjudication**; **Q2 is
REJECTED** on the R5 falsification; **Q1 is DEMOTED** to an optional upstream
ask for a `dsh-native` audit label (placement bindings honestly carry
`implementationOrigin:'team-trusted-extension'`, `install.ts:1004-1007`). **Q3
(global mount + waived negative control) stays REJECTED, and the data below is
retained in full:** G5/G7/G8 — the process-wide trusted-face flip and the
measured `minimal`-preset expansion — remain the standing evidence that the
production entry must NOT mount the tool plane globally.

## Verdict (the GLUE-4 reconnaissance gate, answered NO with a measured consequence)

**A public assembly surface that is simultaneously (a) visible to the Guard's
trusted GLOBAL read and (b) invisible to non-team sessions DOES NOT EXIST on
this host generation.** (Scope per AMENDMENT: the discovery-style /
inherited-native lane — exactly what this kit measured; the R1 placement lane
reaches verified governed tools without ever touching the trusted GLOBAL face.)
Top-level profile rows are NOT gated by agentPreset /
policy / session — the law chain, every link pinned:

1. **Row presence is process-wide.** The bundle-patch grammar is exactly
   `{insert, id-addressed whole-row replacement, disabled}` with last-write-wins
   (`packages/bundle/base/cordis.patch.yml:6-8` "a patch replaces the targeted
   row's whole `config`… last write winning per row"; the row-override semantics
   are restated in this repo's root `cordis.patch.yml` header). `disabled` is a
   `!!js` expression evaluated in the BOOT context (e.g.
   `disabled: !!js process.platform === 'win32'` in
   `packages/bundle/web-app/presets/standard.patch.yml:23`) — there is no
   per-session/per-preset visibility word anywhere in the row schema.
2. **Registration lands on the mounting row's plane.**
   `tools.register()` registers "globally or in the calling agent scope"
   (`packages/core/tools/src/index.ts:1058-1063`) — a top-level profile row's
   ctx IS the global layer; preset-realm rows register into their agent scope.
3. **The global layer is inherited by EVERY scope.** `view(scope)` starts from
   `this.layers.global.tools` and chains every scope's layers onto it
   (`index.ts:1178-1215`); `schemas(scope)` projects that view
   (`index.ts:1260-1262`). A name on the global face is model-visible to every
   agent that does not SHADOW or RESTRICT it.
4. **`tools.restrict()` cannot be aimed from outside.** It throws without a
   scoped ctx — "a context-global restriction would mask every agent"
   (`index.ts:1097-1100`). Team glue can mask its OWN sessions' scopes
   (agent-bindings.mjs holds `agentCtx`), and nothing can mask a foreign or a
   not-yet-created session's scope from the plugin side.
5. **Guard fact-3 admits no substitute.** The closed world verifies an inherited
   native only when the UNSCOPED `tools.get(name)` resolves and is the SAME
   definition the agent scope pins (`packages/runtime/tool-dispatch/
   closed-world-guard.ts` R-a facts 1-3; production read site
   `packages/runtime/src/plugin/live/agent-bindings.mjs:2248-2266`). Preset-realm
   registrations can therefore NEVER verify (bind-diag law, re-proved here at
   G4 without any team in the world).

## Measured consequence (two worlds, one delta = the two top-level tool rows)

`a5g4-negctl-kit.mjs --port 3187` — BOTH worlds boot the pinned web host (root
`tool-fs`/`tool-bash` disabled by the bundle, `web-app/cordis.patch.yml:450,469`),
create TWO NON-team sessions through the public `session/create` entry selecting
the SHIPPED presets `standard` (mounts tool-fs/tool-bash in its preset realm)
and `minimal` (ships NO tool-fs/tool-bash rows —
`packages/bundle/web-app/presets/minimal.patch.yml` carries only the
terminal/persistent-shell family), run one mock-model turn each, and read every
face through the read-only observer row (`a5g4-observer-row.mjs`: FACE 1 unscoped
`tools.schemas()`, FACE 2 `tools.schemas(agent)` for every live Agent, agent
handles via the public `agents` service) AND the WIRE catalog (the `tools[]`
array of the outbound model request captured by the scripted mock; a per-turn
marker barrier proves every setup turn really reached the model before the
faces are read — each turn shows as TWO wire records, the turn request carrying
`tools[]` plus a follow-up without it; `captureDump` records both per request).
Criteria-clean final run: **`runs/2026-10-17T07-38-38Z`, GREEN 8/8**
(`criteria.json`; per-world facts incl. `scopedNames`, `perName`,
`captureDump`, wire catalogs):

| face | baseline (observer only) | globalmount (+ 2 top-level rows) | reading |
| --- | --- | --- | --- |
| trusted GLOBAL `tools.schemas()` | `[]` (G4) | `["bash","edit","read","read_image","write"]` (G5) | one process-wide view — it flips for EVERY session (G8) |
| NON-team `standard` scoped catalog | 26 names | 26 names — delta `+[]/-[]` on BOTH the registry-scoped face and the wire `tools[]` (G6) | own preset copy shadows → zero-delta, but `sameDefinition=false` for all five (R-a: nothing verifies) |
| NON-team `minimal` scoped catalog | registry `["bash"]`, wire `["bash"]` | registry `["bash","edit","read","read_image","write"]`, wire identical `n=5` (G7) | **+4 names on BOTH faces = EXPANSION MEASURED** — a shipped, unshadowing preset directly gains read/write/edit/read_image from the global mount |

So the shape a production entry would ship (top-level `@deepseek-ai/dsh-tool-fs`
/ `@deepseek-ai/dsh-tool-bash` rows, i.e. bind-diag's hostplane fix demo promoted
into this repo's assembly layer) **verifies the governed team face (bind-diag
proved) but simultaneously (i) flips the trusted face process-wide — the literal
negative control "non-team session globalNames unchanged" is impossible — and
(ii) measurably expands any non-shadowing preset, shipped (`minimal`) or
user-created via the Web editor (fail-open: nothing gates or masks it).**
Masking from our side is not public-aimable (law 4), and editing other presets'
plugin lists would own the operator's preset surface and still miss
not-yet-created presets.

## The precise seam that is missing (one sentence for upstream/root)

A public assembly surface that lets a DEPLOYMENT register tool definitions into
the GLOBAL trusted face **with visibility scoped by agent preset / policy** —
e.g. a row-level visibility gate on the profile-patch schema, or a public
global-plane `register(definition, { visibility: presetOrPolicy })` — such that
`tools.schemas()` (no scope) shows the definition (Guard fact-3 verifiable)
while `view(scope)` for non-qualifying scopes does NOT inherit it (least
privilege). Today `view()` has exactly one non-inherited layer (a scope's own
registrations, `index.ts:1180-1183` "Chain-blind on purpose") and `restrict()`
is scoped-only (law 4): there is no third shape.

(AMENDMENT scope: this seam is missing for the wish "verify an INHERITED native
body WITHOUT a global face". It is no longer the GLUE-4 blocker: Q4 takes the
governed team face off the inherited lane entirely — Team-placed Definitions in
the own layer with placement attribution — so no host word is required for the
governed-team tool plane. The seam stands as the DEMOTED optional Q1 ask.)

## Adjudication questions (root) — RESOLVED 2026-10-17: **Q4 (R1 placement) APPROVED as implementation completion within the original authorization semantics (not a new user adjudication); Q2 REJECTED (R5), Q1 DEMOTED, Q3 REJECTED — all stand**

- **Q4 (approved as implementation completion within the original authorization semantics — the wiring phase's standing authorization — not a new user adjudication):** governed team tools ride the frozen-design **R1 placement
  lane** (`post-poc-technical-design.md:42`; production parts at
  `install.ts:987-1029/1106/1062-1063` + `agent-bindings.mjs:2460-2471`,
  evidence `ra-review@4ba92b77`): Team assembles reviewed Definitions into each
  governed Agent's own layer, pins the placed object, per-call scoped identity
  comparison; R-a (inherited-side, unscoped trusted read) stays byte-unchanged.
  The GLUE-4 assembly route is thereby UNBLOCKED for the follow-up that places
  the reviewed `tool-fs`/`tool-bash` definitions team-side — no global mount.
- **Q1 (demoted, optional upstream ask):** the host word described above
  (global-plane registration with preset/policy-gated visibility) remains a
  legitimate future ask (also for a "verified dsh-native" audit label),
  no longer a blocker.
- **Q2 (REJECTED on RA-REVIEW R5):** a discovery-style comparison-side swap
  (scoped self-pin of whatever resolves) stamps the SHADOWING body
  `verified:true` — the exact R-a attack; rejected with counter-proof, R-a is
  not revised.
- **Q3 (REJECTED):** global mount + waived negative control is not taken; the
  measured `minimal`-preset expansion (G7) and the process-wide trusted-face
  flip (G8) stand as the standing evidence that the production entry must not
  mount the tool plane globally.

Not pursued (recorded): disable+reinsert the host's `preset-minimal` with a
mask-plugin row — public syntax but it owns operator presets, is fail-open for
Web-editor-created presets, and still violates the literal negative control
(globalNames flips process-wide).

## Reproduce

```
cd dev/agent-workflow/evidence/alpha5/wiring/glue4-prodentry
node a5g4-negctl-kit.mjs --port 3187     # two worlds sequential, ~3 min
# GREEN expected: G1 G1b G2a G2b G3 G4 G5 G6 G7 G8 (G7 GREEN = the EXPANSION, i.e. the discovery-style-lane seam gap CONFIRMED + the standing Q3 rejection ground — per AMENDMENT, not a claim about the R1 placement lane)
```

Files: `a5g4-negctl-kit.mjs` (two worlds, criteria, sweeps, redaction),
`a5g4-observer-row.mjs` (read-only faces row), `runs/<stamp>/` (per-world
`world-*.json` facts incl. `scopedNames`/`perName`/`captureDump`, sealed
`instance-*.log`, `criteria.json`).

## Close-out ledger (本 PR 部分 — GLUE-4, seam-gap branch)

- 实现文件: ONLY the two evidence files here (zero production delta — the
  production entry is NOT changed by this lane, per the stop branch).
- 调用入口: none added; the investigation target remains the root
  `cordis.patch.yml` bundle layer (unchanged) + agent-bindings.mjs (unchanged).
- root 构建/默认装配是否含: N/A (zero source change); `vitest.config.ts`,
  `packages/`, `scripts/`, root `cordis.patch.yml` byte-identical to base
  `a2473203` (G1b + `git diff` empty). Gate suite on this branch (evidence-only
  delta): `pnpm run lint` = 129 errors / 32 warnings = BYTE-IDENTICAL problem
  set with the files moved aside (pre-existing base debt, lane adds 0);
  `lint:identities` OK (1244 files); `check:artifacts` OK 1680; root `vitest run`
  full suite `runs/2026-10-17T07-38-38Z/root-vitest-run2.log`: **6999/7010,
  6 files failed** — 4 files/9 tests = verbatim the recorded debt list (t2-blueprint-hash
  1 / p6t3-mediation 5 / p6t3-restart 2 / p6t6-actions 1, signatures byte-shaped
  identical to the logged baseline), 2 ENVIRONMENTAL (a4p7-merge-gate:
  `packages/client/dist` not built in this worktree — the leg itself says
  "run `pnpm build` and re-run": after `pnpm build` + `pnpm build:composition`
  (BUILD_EXIT=0, tracked tree left byte-clean, check:artifacts still OK 1680)
  that file is 7/7 GREEN; a5p5-dormant-audit: ENOENT racing another
  test's `.tmp-fault/` dir mid-walk — 5/5 GREEN in isolation). ZERO new code
  failures (the lane delta cannot reach `packages/` by construction). Coverage
  face untouched by construction (no source delta ⇒ the w7m2 coverage-gate
  posture unchanged).
- 用户可用面: unchanged (nothing shipped by this lane); under approved Q4 the
  governed-team tool plane lands via the team-side placement follow-up
  (R1 lane), never via a global mount.
- 剩余阻塞: none for the mechanism — Q4 approval removes the "blocked until
  Q1/Q2/Q3" posture this lane had recorded for the general case; what remains
  is the R1-placement assembly follow-up (place the reviewed `tool-fs`/
  `tool-bash` Definitions team-side per RA-REVIEW ②, incl. its NC-1/2/3
  negative-control kit legs) — an implementation lane, not a ruling. The
  verified INHERITED-native wish remains refused by R-a as designed (fact-3
  unchanged), which is correct, not a blocker.
