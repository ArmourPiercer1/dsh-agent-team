# bind-diag — w7m2 "second gap" attribution: measured, closed as assembly completion (i)

Writer lane: BIND-DIAG (independent attribution before any fix; authorized-scope fix).
Base `master@1869460a`, branch `alpha5-bind-diag`, host pin `0.2.0-rc.2 @
639ed015397290b3745d163aafe02ffee4aa3f84` (porcelain-clean before AND after every
world; C0b/C7b in every run). All worlds spawned on port **3186** with a live
port self-proof (`runs/*/port-self-proof.json`); the stable `:3080` instance was
read-only probed before/after (401→401, never operated); all `tests/homes/a5bd-*`
worlds swept (verified absent); shared files (`agent-bindings.mjs`, `install.ts`,
`closed-world-guard.mjs`, `preset-seam.mjs`, `packages/tools/harness/plugin.mjs`)
untouched — the entire method is TWO new files here + one measurement-only clone
(`tests/kits/a5p1diag/`).

## Verdict

The refusal

```
Error: team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)
```

(reproduced byte-identical to w7m2's verbatim, `runs/preset-matrix.log` C5) is
**attribution (i): assembly completion — a public path exists**. It is NOT a
host defect and NOT bash-specific: the Guard's verification stage reads the
GLOBAL tool face (`tools.schemas()` without scope, the `nativeNames` source in
the guard glue); in the web profile that face is EMPTY by design (the web
bundle disables the root `tool-fs`/`tool-bash` rows) and preset-realm tool
registrations never reach it. Mounting the same reviewed packages
(`@deepseek-ai/dsh-tool-fs`, `@deepseek-ai/dsh-tool-bash`) as TOP-LEVEL
profile-patch rows — a public seam, kit-side only — makes every binding on the
governed face verified and every leg runs. No adjudication question is needed.

## The measured law chain (no step inferred)

1. Refusal text ⇒ guard decision `unverifiedReason='unattributed'` ⇒ name ∉
   `nativeNames` ⇒ name ∉ global `tools.schemas()` at publish
   (closed-world-guard glue needles, pinned at live lines in every run's
   `repo-citation-anchors.json`).
2. MEASURED (diag row, read-only observer mounted as a plain profile-patch
   row): w7m2-shape world → `globalNames=[]` for leader AND members;
   `globalPresent=false` for every name → refusal, verbatim, six times
   (C5 bash + C3 read + C4 write + bashbg + C8b anchor-member read + C7d
   created-team-member read; `surfaceEvents=6` `published-surface-unverified`,
   zero install refusals).
3. MEASURED (same kit, only delta = two top-level tool rows): `globalNames=
   [bash,edit,read,read_image,write]`, `sameDefinition=true` → leader read
   RAN, write RAN, bash RAN (marker file), background bash returned
   `started background job bash-2`, member read RAN; `surfaceEvents=0`.
4. w7m2's recorded "second gap" is actually a WHOLE-FACE gap (read/write/
   edit/read_image too, leader and members, both boot-anchor and team.create
   paths) — w7m2 measured bash only. Its trio results (T-allow/T-iso/T-deny)
   live on the registry/gateway planes and are UNAFFECTED; the w7m2 suite was
   re-run green 16/16 on this host the same day.

## The cell matrix (all six cells + reconciliation shapes, one kit)

`a5bd-kit.mjs --mode preset|hostplane|pr1shape` — same blueprints (w7m2 anchor
shape: strict, trio deny = the coverage gate's remediation (a), bash
permission-gated), same lanes, same markers; ONLY the mount plane differs.

| cell (leg on a governed agent, permission-allowed) | preset realm (w7m2 shape) | host plane (fix demo) | pr1shape (PR1's own preset stack) |
| --- | --- | --- | --- |
| leader read / write | REFUSED / REFUSED (verbatim) | RAN / RAN | REFUSED / REFUSED |
| leader bash (model-driven) | REFUSED — w7m2 verbatim | RAN (`A5BD_BASH_OK`) | REFUSED |
| leader background bash | REFUSED | job started (`bash-2`) | (not pinned; refusal class) |
| boot-anchor member read (C8, PR1's shape) | REFUSED | RAN | REFUSED |
| team.create member read (w7m2's shape) | REFUSED | RAN | REFUSED |
| faces `globalNames` / `sameDefinition` | `[]` / — | 5 names / `true` | `[]` / — |

FINAL evidence runs: `runs/preset-2026-10-17T06-42-31Z` + `runs/preset-matrix.log`
(17/17), `runs/hostplane-2026-10-17T06-42-42Z` + `runs/hostplane-matrix.log`
(17/17), `runs/pr1shape-2026-10-17T06-48-22Z` + `runs/pr1shape.log` (17/17).
Env equality with w7m2 is exact for the preset world: the
`DSH_PERMISSION_MODE: danger-full-access` deployment override (documented in
the base patch itself; this host has no bubblewrap/Landlock backend, so the
sandbox BODY below the guard would fail closed and blur verdicts) is set in
HOSTPLANE mode ONLY — the preset/pr1shape worlds boot without it.

## PR1-world reconciliation (honesty item — settled by measurement)

PR1's kit reran green TODAY (41/41, same dist) with its governed member reads
RAN — apparently contradicting the refusal law. A measurement-only clone of the
PR1 kit with this observer row mounted (`tests/kits/a5p1diag/`, ran 41/41
again, `runs/a5p1clone-run.log`, facts `runs/a5p1clone-facts-recon.json`) shows
its faces are `globalNames=[]`, `sameDefinition=false` — **PR1's reads ran on
UNVERIFIED inherited bindings because that world ABSTAINS instead of refusing**
(the PR1 kit's own note says exactly that). No world ever showed a VERIFIED
binding from a preset-realm mount. Full write-up + the one genuinely-open host
question: `PR1-RECONCILIATION.md`.

## Jobs promised-goal delivery table (PR249 §10 / PoC-7b, line by line)

| promise (verbatim fragment) | today's measured state | attribution |
| --- | --- | --- |
| Jobs: "`job_output/list/kill` 的执行身份、Job Owner" (user-callable entries carry execution identity + owner) | FULFILLED on the public host face: w7m2 T-allow-row (real `ctx.jobs` registration → listable under the OWNER caller's fence, cross-caller refusal verbatim; 16/16 rerun on this host 2026-10-17). Model-driven background-bash registration now ALSO proven end-to-end under an armed Guard (H-world C5-bg: `started background job bash-2`). | host plane proven; preset-realm governed path was blocked → now attributed (i) with measured public fix |
| "创建时 Grant/ExecutionLease" | FULFILLED at the Team gateway seam (w7m2 gateway legs: lease hygiene, RELEASED states, owner-mismatch refusal verbatim). Native creation runs under the host permission plane in H-world legs. Gateway LANE (jobs-gateway assembly) remains DORMANT per `ALPHA5-ACCEPTANCE-STATUS.md:19` — not this lane's scope. | wiring (G-d), unchanged |
| "Cancel requested vs terminated" | NOT exercised by any governed-team leg; trio is denied on governed faces (w7m2 scene; C1c asserts trio-absent in all three worlds here). | explicit BOUNDED-DEFER |
| "长期 Job 作用域与跨 Member 输出隔离" | FULFILLED: w7m2 T-iso (registry fence refusal verbatim + gateway owner-mismatch) + T-deny (zero registration, registry delta []). | host/gateway planes proven |
| PoC-7b: "否则 Team Job Gateway 强制 owner 映射、或禁止跨 Member 查询和控制" | The "禁止跨 Member 查询和控制" alternative is the PROVEN branch (negative controls above). Positive owner-carrier-through-restart remains DORMANT (acceptance status). | unchanged |
| 验收: "所有主张有正负控或显式 BOUNDED-DEFER" | This register supplies the missing POSITIVE control for the model-driven governed entry (H world) against the sealed negative (P world, verbatim), and marks the cancel-semantics row BOUNDED-DEFER explicitly. | closed here |

## Reproduce

```
cd dev/agent-workflow/evidence/alpha5/wiring/bind-diag
node a5bd-kit.mjs --mode preset    --port 3186 --evidence-dir "$(pwd)/runs/<dir>"   # 17/17, refusal verbatim
node a5bd-kit.mjs --mode hostplane --port 3186 --evidence-dir "$(pwd)/runs/<dir>"   # 17/17, all legs run
node a5bd-kit.mjs --mode pr1shape  --port 3186 --evidence-dir "$(pwd)/runs/<dir>"   # 17/17, refusal again
node tests/kits/a5p1diag/a5p1-kit.mjs                                               # 41/41 + a5bd-facts-recon.json
```

Note on criteria ids: the archived FINAL logs (2026-10-17) label the two
environment-hygiene legs `C7a`/`C7b` (colliding with the member-phase ids, a
cosmetic log clash only — every one of them passed). The kit now labels them
`C9a`/`C9b`; fresh runs print the distinct ids, the archived logs keep the
historical ones.

Files: `a5bd-kit.mjs` (worlds/legs/criteria; `--mode` switches ONLY the mount
plane), `a5bd-diag-row.mjs` (read-only faces observer: `/__a5bd/health`,
`/__a5bd/facts`, `/__a5bd/members`), `PR1-RECONCILIATION.md`, `runs/` (finals +
the two documented pr1shape boot-failure captures: `setup-failure.json` =
`tools.restrict()` trio-absence fatal and the coverage-gate glob/grep fatal —
both kept because they prove the gate is live and its remediation (a) is
honored, never removed).
