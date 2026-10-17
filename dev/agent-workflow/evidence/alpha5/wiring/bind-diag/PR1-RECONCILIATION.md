# PR1-world reconciliation (measured, 2026-10-17)

Question: the PR1 kit (`tests/kits/a5-pr1-guard-dispatch`, rerun green **41/41
today at 06:33:56 on THIS dist**) records its governed `strict` member READ and
WRITE as RAN (`member-model-views.json` seed content + sideeffect; guard
observations show NO "cannot be verified" refusal). The a5bd worlds refuse the
identical scenario (leader AND members) with the w7m2 text verbatim. Both
mount the tool plane only through the PRESET (`smokePresetPlugins`). The
register had to reconcile this before pinning attribution.

Method: a read-only clone of the PR1 kit (`tests/kits/a5p1diag/`, same repo,
import paths unchanged) with the a5bd observer row
(`a5bd-diag-row.mjs`, no behavior — pure `tools.schemas()` / scoped-view
measurement) mounted as one extra profile-patch row. The clone ran UNMODIFIED
otherwise: **41/41 pass, strict governed read/write RAN** — the PR1 record is
reproduced exactly, including "no refusal anywhere" (only the `team_follow_up`
guard-denial). Then the same faces were measured in that very world.

Measured facts (clone run dir swept per kit convention; facts mirrored here as
`runs/a5p1clone-facts-recon.json`, clone verdict stream `runs/a5p1clone-run.log`
+ `runs/a5p1clone-kit.log`; the rerun of the PRISTINE PR1 kit whose record is
reproduced lives at `runs/pr1-rerun-06-33-56/` — 41/41,
`member-model-views.json` strict reads/writes RAN, `guard-observations.txt` has
no unverified refusal, only the `team_follow_up` guard-denial):

| face (PR1 clone world, after the RAN legs) | globalNames | perName read/write/bash |
| --- | --- | --- |
| created-team leader | `[]` | agent not resolvable at measure time (null) |
| strict member (governed, read RAN) | `[]` | `globalPresent=false`, `scopedPresent=true`, `sameDefinition=false` |

Compare a5bd P world (same dist, same preset mount shape, `runs/preset-matrix.log`):
identical faces (`globalN=0`, `globalPresent=false`) — but there the dispatch
refuses with `Error: team tool guard: the Tool Binding for "<name>" cannot be
verified at dispatch time (no fallback to the native body)` (bash byte-identical
to w7m2's verbatim; refused = 0 install refusals, surfaceEvents = 6
`published-surface-unverified`).

Conclusion (all three legs measured, none inferred):

1. **In the PR1 green world the governed fs names were never verified**
   (global view empty, `sameDefinition=false` for every name). Its reads/writes
   ran NOT because the binding was verified but because that world never
   reaches the R-a dispatch refusal — the unverified inherited binding is
   ABSTAINED there (fall-through to the permission layer), which is exactly
   what the PR1 kit's own note says: "PR1 binds publish-time native names as
   inherited; refusing them is the permission layer's job"
   (`inherited-native-observation.json`). The A5-PR1-guard-lane record and the
   a5bd record therefore do NOT contradict: they measured two different
   host behaviors of the same unverified state, never a verified state.
2. **No world on this dist shows a verified inherited binding from a
   preset-realm tool mount** — measured in 3 shapes (w7m2-shape, a5bd-shape,
   PR1-shape): `globalNames=[]` every time. The w7m2 refusal is therefore not
   a bash quirk and not world-specific: it is the assembly-level absence of
   any GLOBAL native face (web bundle disables root `tool-fs`/`tool-bash`
   rows; preset-realm registrations never reach `tools.schemas()`), which the
   R-a law turns into `unattributed` refusal wherever that law fires.
3. **The fix path is public and measured** (hostplane mode, `globalNames=5`,
   `sameDefinition=true`, every leg RAN, background bash registered): declare
   the tool packages as top-level profile-patch rows (`@deepseek-ai/dsh-tool-
   fs` / `@deepseek-ai/dsh-tool-bash`) instead of only inside the preset.
   Kit-side assembly completion — attribution (i). No adjudication question is
   required for "can a governed team run a verified bash at all": it can.
4. What remains genuinely open (and NOT solvable kit-side): whether the
   product WILL fire the dispatch refusal on unverified inherited names
   (a5bd/w7m2 behavior) or abstain (PR1-green behavior) — that is a Guard-
   semantics property of the host assembly, outside the profile-patch surface.
   This does not change attribution: under EITHER behavior, mounting the
   tool plane globally makes bindings verified, and under the refusing
   behavior it is the only way to run them.
