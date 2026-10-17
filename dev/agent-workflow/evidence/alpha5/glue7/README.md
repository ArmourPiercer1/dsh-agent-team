# GLUE-7 — production backend assembly for the governed Team tool plane

Branch `alpha5-glue7-backend` · one-time worktree @ base master `28d31f2a` (#315 G1) ·
task: stop shipping interface/fixture-only evidence for the plane's effect face —
**assemble the REAL backends the repo already has** (no new executor architecture),
keep every fail-closed law untouched, prove it LIVE on this host.

## 1. Inventory — what got wired, and the existing implementation each row rides

| plane row | class | backend (this round) | rides (file:line, this branch) | live proof |
| --- | --- | --- | --- | --- |
| `team_bash` | shell | `createConfinedShellBackend` (`plane-effect-backends.mjs:204`) | confined Process provider `sandbox-provider/provider.ts:228` + P-LSP streaming arm `provider.ts:661`, Landlock pre-launcher `sandbox-provider/launcher/landlock-prelauncher.py`, launcher byte-pin double gate (pb-CONTRACT §1 `ProviderAssemblyConfig`) | REAL Landlock ABI v4 on this host: echo token + `exit=0` on the wire, write inside the governed root lands on disk, outside-root read refused by the KERNEL (`Permission denied`, secret never on the wire) — unit legs G3/G4 + live L3/L4 |
| `team_grep` | fs (read-only search) | `createAnchoredSearchBackend` (`plane-effect-backends.mjs:132`) | the W5 wiring round's REAL grep search ported verbatim: argv `dev/agent-workflow/evidence/alpha5/wiring/w5/a5w5-fixtures.mjs:287` + outcome/shaping `:308`; governed anchor = controlled-fs instance root `controlled-fs/src/controlled-fs.ts:73` (`ControlledFsInstance`) with the lane's own containment law `isBeneath` `controlled-fs/src/open-at-exec.ts:53` | live L2: anchored grep hits the token line over the wire; unit G1/G2 (+ `..` refused at parse, symlink escape refused at realpath) |
| `read` (takeover placement) | fs | `createGovernedReadExecutor` (`plane-effect-backends.mjs:324`) | same controlled-fs instance root; deny-lane re-check BEFORE any byte (G1 law), template-default-deny honored (an effect the policy never names never runs); placement identity → pb §6 feed (`tool-dispatch/install.ts:116` `definitionIdentityOf`, feed gates `:1073`+) | live L1: real file bytes ride the wire, int-a5b T5 refusal gone on the assembled row; unit G7 (feed row realm pairing + identity equality) |
| `team_glob` | fs | **REAL — confined rg (scope-probe `fd9d4454` closed the PR5 commitment; TOCTOU-hardened)** | `createAnchoredGlobBackend` (`plane-effect-backends.mjs`): host public-root `buildGlobCommand`/`GLOB_MAX_RESULTS`/`resolveRgPath` (the plan :128 named face) + `resolveAnchored` + verified directory pre-open + the SAME confined Landlock provider — the rg walk runs INSIDE the sandbox (`glob/README.md` ruling + disclosure; live legs L6-L9) |

Assembly rows (the delivery gap int-a5b named — "seam 精确到挂载行缺 backends 入参"):

* `src/plugin/live/team-tool-plane.mjs:370/373/420/448` — production backends built
  from `planeCfg.fsInstance` / `planeCfg.confinedProvider`, placement record minted
  at placement time; `:471` `placementFeed` face. Unconfigured rows are
  byte-identical to before (the shut face is the default; **R-a closed world: no
  configuration invents a root**).
* `src/plugin/live/agent-bindings.mjs:2228/2231` — the one realm + the placement-feed
  map; `:2309-2310` the Guard gets `realmId` + `bindingFeed` (the #313 入参面,
  landed here by `cherry-pick -x 94abdd90`); `:2409` the plane assembly shares the
  SAME realm constant (pairing can never drift); `:2440` feed rows handed over
  before `bindOwnTools` runs.
* Kit-compat: the public `backends` override seam still wins outright (unit G9);
  an injected fixture search keeps carrying glob exactly as a5p5's fallback did.

## 1b. The DORMANT ledgers this round legitimately ends (booked, law kept)

The provider/search lanes were frozen DORMANT ("zero production consumers")
by PR0 — three ledger tests pin that form. GLUE-7 is the instruction-backed
end of that state, so the BOOKINGS keep the named-set law (a second importer
is accretion; a vanished one is a broken wire):

* `packages/runtime/test/a5p4-lane-hygiene.test.ts` — DORMANT leg →
  `WIRED (GLUE-7)`, offenders pinned to exactly
  `runtime/src/plugin/live/plane-effect-backends.mjs`;
* `packages/runtime/test/a5w-integration-wiring.test.ts` — provider-dormancy
  leg → exactly-one-live-glue-importer, same named file;
* `scripts/audit-a5-tool-governance-imports.mjs` `PR1_CONSUMERS` +
  `packages/domain/test/a5p0-layer-audit.test.ts` — the plane row joins the
  governance-consumer set (its §6 feed import `definitionIdentityOf` is the
  #313 入参面's first production caller). 26/26 green, non-accretion bites.

## 2. Stacked commits — the merge LANDED (disclosed dedup fired as pre-announced)

* `6c550080` = `cherry-pick -x 3b1b515f` (GLUE-6 shipped-face + ContentBlock[] render) —
  required: without the render fix EVERY successful dispatch dies in host result
  assembly (`content.some is not a function`), so a live positive was structurally
  impossible on base. p4t6 dedup: files identical when the GLUE-6 PR lands.
* `a1229de2` = `cherry-pick -x 94abdd90` (P-B §6 binding-feed 入参面: `realmId` /
  `bindingFeed` / `definitionIdentityOf`) — the task's "#313 已备好入参面".
* Both picks' p4t6 ledger conflicts resolved by measurement; the chain RE-TIES on
  this branch: GLUE-6 `1170-1169`, feed `1171-1170`, GLUE-7 `1173-1171`.
  **PRE-ANNOUNCEMENT for the integration re-tie**: when these stacked commits land
  on master, the cherry-picked files DE-DUPLICATE (same files, `cherry-pick -x`
  records); the GLUE-6/PBR2/GLUE-7 tie lines re-tie around merge order and the
  chain total for this file set stays 1173 — no file counts twice.

## 3. RED-first receipts (all under `runs/` + the captures beside this README)

* `suite-RED-before-assembly.txt` — the unit suite BEFORE the glue rows: 7 red
  target legs (`a5p5-refused kind=backend-failed code=IO_POLICY_UNSUPPORTED`
  verbatim) + 3 current-form pins that stay green forever (shut-face verbatim,
  glob typed-shut, override seam intact).
* `suite-GREEN-after-assembly.txt` — 10/10 after the glue (2 REAL-Landlock legs).
* `p4t6-GLUE7-RETIE-RED.txt` (`expected 1173 to be 1171`) → booking → GREEN;
  the two cherry-picks' own RED/GREEN pairs are beside them (`p4t6-GLUE6-*`,
  `p4t6-PBR2-*`). ALL prior red receipts stay in the tree; nothing rewritten.

## 4. Disclosed limits (honest marks, not gaps hidden by wording)

* **glob**: REAL since the scope probe + ruling (`glob/README.md`: 在其原授权语义内，
  无需新裁决). Disclosed residuals of that row: the streaming arm can read rg's
  hard exit as 0 on this host (walker-error detection rides rg's own stderr —
  `rg-walker-error`, probes in `glob/`); provider scratch defaults INSIDE the
  governed root on the shell row (the glob row defaults its own scratch outside;
  the shell-row default is left for #321 review, disclosed not touched).
* **Per-call C-FS grant gating for the read row**: the production plane has NO
  `admitCall` consumer (measured: zero), so the read row is anchored + lane-gated
  (deny-before-read, default-deny) but NOT gated per-call through the admission
  kernel — that is the PTC-L2 lane's own unfinished face; disclosed, not
  invented around (fabricating AdmissionRequest bindings was rejected as
  dishonest).
* **Launcher not on the published face**: tsc never emits `.py`; the assembly
  names `assembly.launcherPath` + `launcherSha256` as deployment inputs and the
  provider double-gates every probe/exec on those bytes (pb-CONTRACT §1). The
  live kit passes the source-tree launcher path — one disclosed deployment input.
* **Network dimension**: the confined provider REFUSES a `deny` network profile
  (PoC-4b honesty: nothing demonstrates full network deny); the shell row makes
  NO network claim — its assurance rows say so (`probe` legs land in the lease
  evidence).
* `background: true` bash: refused BY NAME (`background-not-supported`), never
  reinterpreted as a foreground run.
* Host scratch: the provider's scratchRoot must sit inside the workspace
  (sandbox constraint); the plane row defaults it to the governed root.

### 4b. TOCTOU class (independent review ①(c)) — audit line, kept even after the fix

The independent security review (`a5g7rev` VERDICT, ①(c) FAIL) measured a
check-vs-open decoupling leak on the read and grep rows: an EXTERNAL process
renaming the anchored path to a symlink in the µs window between
`realpathSync` and the consumer's own open. Reviewer evidence: read leaked
1/20000 (iter 23), grep-file-arg 1/400 (iter 1), grep-dir-arg 0/400.

FIX (this branch, same law reused, no new architecture, no new permission):

* **read row**: the lane's own safe-open law — `open(O_RDONLY|O_NOFOLLOW)` +
  `verifyOpenedHandle` (`controlled-fs/src/open-at-exec.ts`, the exec-time
  re-read shipped since PoC3-B: `/proc/self/fd` containment + fstat-vs-snapshot
  drift) + bytes read from the VERIFIED handle only; the size cap now enforces
  on the verified identity.
* **grep row, file target**: same pre-open + exec-time verify, and the child
  receives ONLY the inherited descriptor (`/proc/self/fd/3` — spawn stdio slot,
  child-side numbering measured) — no path string ever reaches grep; the
  presented output remaps the fd view back to the anchored spelling
  byte-identically (S3 pins it).
* **grep row, dir target**: keeps the string (`grep -r` neither descends a
  command-line symlinked dir nor follows in-tree symlinks — asymmetric follow
  law, measured 0/400 TWICE: reviewer and this re-run). NOT exempted: an
  external mutator could in principle swap a mid-component before grep's own
  resolve; no public interface closes a recursive walk without `OpenAtPort`
  (declared seam, no native helper — the trichotomy's evidence of interface
  absence). Disclosed as residual.
* **glob row (ships now, same bar from birth)**: walk root pre-open
  O_DIRECTORY|O_NOFOLLOW + verify (rg DOES follow command-line symlinked dirs
  — measured, so the pre-refusal layer is load-bearing here); the walk root
  reaches rg only as `.` through the launcher cwd, and any swap that slips the
  window lands the child on a target the Landlock rule set (root-only
  read_dir/read_file) kernel-refuses — zero bytes. The rg child's own in-tree
  walk never follows symlinks (measured). Inside-root redirect integrity
  residual disclosed, boundary escape refused by two layers.

ADVERSARIAL RE-RUN (reviewer-shaped external rename→symlink attacker, same
templates, driven against the compiled DIST MIRROR — the production face):
`toctou-fix/re-run-toctou.mjs`, RED-FIRST recorded (pre-fix mirror leaked
C1@iter18, C2@iter0 — reproduces the reviewer's class) and post-fix
**GREEN 8/8: read 0/20000, grep-file 0/400, grep-dir 0/400, glob-walk 0/200
swaps leaked, while every positive control really ran** (read real bytes,
grep real hits, glob real walk, final-symlink still typed-refused).
Output: `toctou-fix/re-run-output.txt`.

## 5. Live kit

`a5g7-live-kit.mjs` — STRICT public install face (`files:["dist"]` + declared deps,
nothing backfilled — the face GLUE-6 made bootable), pinned pristine host
@`639ed01539` (porcelain 0 before/after), ports 3183/3184 self-proved free→used→free,
`:3080` read-only probe before/after, worlds `tests/homes/a5g7-*` swept, mock ONLY
at the LLM position. Three worlds, one run:

* `preassembly` — the row WITHOUT the new config: the three legs land their
  verbatim RED posture live (`cannot be verified at dispatch time (no fallback
  to the native body)`; `IO_POLICY_UNSUPPORTED` ×2) — the int-a5b gap captured
  on THIS commit's artifact, on the wire;
* `assembled` — the row WITH `fsInstance`+`confinedProvider`: three live positives
  (read bytes / grep hit / confined bash + kernel-refused outside read) + the deny
  negative (`template-deny-lane`, sentinel fs-probed ABSENT) + the assembly's own
  log rows (placement-feed list, capability OK, `confined-shell ran`, `governed-read RAN`);
* `baseline` — no `teamToolPlane`: zero plane rows; non-team preset sessions show
  registry Δ=[] ∧ wire Δ=[] against it, zero `team_*` names.

Recorded run + criteria verdict: see `runs/<stamp>/` (this README names the
criteria; `criteria.json` is the machine record).

## 6. What the live round caught that 31 unit legs did not (the point of live assembly)

The unit layer stayed green across ALL of this — the §6 guard and the frozen
canonicalizer failed CLOSED on real integration, each refusal recorded:

1. **eager feed identity** (run-5): the placement record snapshotted
   `definitionIdentityOf(def)` at plane-build time; the seam mints `def#N`
   later, in the session install flow → the guard read
   `provider placed undefined but the seam resolves def#8` and refused a
   legitimate `team.create` (`TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED`).
   Fixed by resolving the identity LAZILY at guard-lookup time — in BOTH
   layers (the plane row AND the agent-bindings closure that re-snapshotted
   it one level up, run-7).
2. **nested feed-entry shape** (run-7): the seam's `BindingFeedEntry` is
   FLAT `{definitionIdentity, realmId}` (install.ts:133, the shape #317's
   own live world ships); my entries nested under `binding` → same verbatim
   refusal. Shape fixed, unit G7 now pins the flat shape + `def#N` form.
3. **canonical spelling for the takeover `read`** (run-8): the frozen
   operation-permission canonicalizer keys `read` to its `file_path`
   extractor — a `{path}` schema died with `canonicalization failed for
   tool "read": file-path-missing` BEFORE reaching the backend. The row now
   declares the native `file_path` (executor keeps `path` as a
   placement-direct alias).
4. kit-side (disclosed): DEPS_STORE level miscount (run-1/2), peer-dependency
   BFS gap (`dsh-storage-domain` imports its peer at runtime, run-3),
   CREATE_ROOT must be its own session id (a5ie-proven, run-4).

Runs 1-9 are retained under `live-kit-run-N.log` + `runs/<stamp>/` (failed
runs keep their `fatal.json` + partial world); the GREEN recorded run is
`runs/2026-10-17T21-05-44Z/` — **VERDICT GREEN (23/23)** (`criteria.json`
is the machine record; `live-kit-run-11-GREEN.log` the console capture).
TOCTOU+glob round (2026-10-18): the GREEN recorded run is
`runs/2026-10-17T22-04-41Z/` — **VERDICT GREEN (27/27)** — on head
`e58ebcb2`+this evidence: three preassembly RED-posture legs verbatim,
four glob live legs (L6 real rg hit on the wire / L7 GLOB_MAX_RESULTS bound
with the honest `truncated` marker over 105 seeds / L8 typed `rg-walker-error`
shape / L9 symlink-final refused with ZERO secret bytes), L5 extended to also
require the `anchored-glob ran` line, and the pre-GREEN L7-red round retained
at `runs/2026-10-17T22-02-32Z/` (capture-window fix in `a5g7-live-kit.mjs`:
the 400B tool-result slice hid the marker tail — widened to 2400B).
Kit iteration disclosure: 11 launches to GREEN (10 debugged rounds — the
install-entry kit's precedent was 10; every round's raw failure is on disk,
none rewritten). The GREEN round also re-proved, same boot: H0/H3 (:3080
401→401 read-only probe, test-use porcelain 0), H2 (3183/3184 free→used→
free), W1 (three worlds booted from the STRICT face, swept), C1/C2 (worlds
+ expansion swept, launch tokens redacted).
