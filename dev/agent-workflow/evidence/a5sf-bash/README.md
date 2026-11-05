# BL-17 (P2-04) native persistent `bash` — BACKEND half (host-free evidence)

Task row: `BL-17 | P2-04 原生持久 bash（同 PTY 多命令、只写不读、chmod/新建文件负控、禁网、旧代 PTY 拒用）`.
Branch: `task/a5sf-bash-20261105` (worktree `.worktrees/a5sf-bash`), based on `origin/master`
= `472bd0b5b`.
Claimed state when this README was written: **backend half only** — the refusal / admission
half is proven host-free; the LIVE half is **NOT PROVEN**. `V@B = no`, **no Host boot, no PTY,
no real shell run was authorised or executed this round**. BL-17 stays **NOT DONE** in
`ALPHA5-SANDBOX-BACKLOG.md`; the row now records exactly which half exists.

Voice note: every number below is copied from a run whose command is printed next to it. Nothing
here says "persistent bash is accepted" — the native module is, on every governed realm in this
tree, **refused at composition time** (§7).

---

## 1. What the row asks, and which half this is

| Row clause | This round |
| --- | --- |
| 同 PTY 多命令 (several commands through ONE persistent shell) | **NOT PROVEN.** Needs a real PTY + Host boot. The `terminals` path is refused (§7), so no product path can reach it. |
| 只写不读 (a write-only lane cannot read) | **PROVEN host-free** (arms `WRITE-ONLY-*`, effects measured on the compiled kernel profile). |
| `chmod` / 新建文件负控 (out-of-lane mode change / create refused, bytes+mode unchanged) | **PROVEN host-free** (arms `CREATE-OUTSIDE`, `CHMOD-OUTSIDE`), with the Landlock limitation disclosed in §6. |
| 禁网 (network denied) | **PROVEN AS A REFUSAL, NOT AS A NETWORK DENIAL** (arms `NETWORK-*`, `CAPABILITY-PROBE`; §5). |
| 旧代 PTY 拒用 (a governed Member is refused the legacy-generation PTY) | **PROVEN host-free on the product seam** (arms `PTY-LEGACY-MOUNT`, `PTY-LEGACY-DEFERRED`, `PTY-FACE`). |

## 2. What was built (no new policy evaluator, no upstream patch)

| File | Change |
| --- | --- |
| `packages/runtime/team-services/src/subprocess.ts` | **`ConfinedShellClassAdmission` / `ConfinedShellDeclaration`** (a composition-declared shell class + one declared invocation), **`shellClassAdmissionRefusal`** (the closed argv shape `<program> -c <body>`, the declared-program check, the declared-root list) with the closed code set `SUBPROCESS_SHELL_{NOT_DECLARED,PROGRAM_NOT_ADMITTED,INVOCATION_UNDECLARED,ARGV_UNSUPPORTED}`; **`SHELL_WRITE_GUARD_METHOD = 'spawn:write'`** + **`createMemberSubprocessWriteGuard`** (the write lane, `IO_WRITE_DENIED`, and deliberately NO write-implies-read rule); **`probeNetworkDenial`** (the backend's own capability probe, `unsupported` on absence/throw/refusal/missing row) and the new per-spawn code `NETWORK_UNCONFINED_REALM`; the spawn path now consults declared read roots on the read lane and declared `writes`/`chmod` roots on the write lane **before** any provider call |
| `packages/runtime/team-services/src/types.ts` | `TERMINALS_LEGACY_PTY_REFUSED` added to the closed install vocabulary (symmetric with `SUBPROCESS_UNCONFINED_REALM` / `NETWORK_UNCONFINED_REALM`) |
| `packages/runtime/team-services/src/mount.ts` | `A5SF_TERMINALS_LEGACY_PTY_REFUSED`; the **pre-mount** refusal for any module whose declared `inject` contains `terminals`, and the **deferred** refusal for a child that defers `ctx.inject(['terminals'], …)` — both at composition time, before any fiber |
| `packages/runtime/team-services/src/install.ts` | `shellClass?` on `ConfinedSubprocessRealmSpec`, forwarded verbatim to the confined face |
| `tests/world-factory/lib/a5sf-bash-arms.mjs` + `tests/world-factory/a5sf-bash.test.mjs` | the 21 arms (§4) |
| `dev/agent-workflow/evidence/a5sf-bash/mutation-controls.mjs` | the three mutation controls (§4.2) |

### 2.1 The admission, and why it is NOT a second permission computation

The faces already had ONE compiler: `compileEffectiveIo` (ceiling ∩ tool restriction) →
`EffectiveIoPolicy` → `compileExecutionProfile` (the OS profile). This round adds **no second
intersection and no second evaluator**:

* the lane decision is still `evaluateLocatorAccess` from `member-io-policy`, producing the same
  `TeamIoDenial` codes (`IO_READ_DENIED`, `IO_WRITE_DENIED`, …) — the write lane is the *same*
  evaluator consulted with the *same* policy, differing only in which axis it reads;
* the fact stream is still `observeGuard` with schema `a5sf-guard-consult/1`; the write consult
  adds a `method` value (`spawn:write`) on that same transport, not a new sink;
* the shell class is not a permission at all: it is a **declaration of what can be statically
  attributed**, supplied by the COMPOSITION on the install spec (next to the launcher pin and the
  process provider). It cannot be supplied or widened by a Member, a tool call, a blueprint, or a
  row config — the arms assert the field does not exist on the effective lane or the service barrel
  (`COMPOSITION`).

So the new code answers three questions the existing lanes could not, all on existing machinery:
**(1)** is this program class admitted here at all, **(2)** is the invocation's root set declared
(a shell body has no statically attributable operands), **(3)** does this host actually enforce the
network dimension the lane asks for. Each answer is a typed refusal or a fact; none of them
recomputes a lane.

`SUBPROCESS_UNCONFINED_REALM` remains the FIRST gate: a realm that owns no confined `subprocess`
face refuses a `subprocess`-consuming module at composition time, so a `shellClass` can only ever
exist on a realm that already owns the confined face. `RG-UNCHANGED` pins that the rg allow-list is
untouched (no `--no-config` → refused; unknown program → refused, even when a shell class is
declared).

## 3. Gates measured on the final tree

| Gate | Command | Verdict |
| --- | --- | --- |
| runtime typecheck | `node_modules/.bin/tsc -p packages/runtime/tsconfig.json --noEmit` | **clean** (no output) |
| workspace typecheck | `pnpm -r typecheck` | **exit 0**, every package `Done` |
| lint (touched sources) | `eslint packages/runtime/team-services/src/{subprocess,mount,install,types,index}.ts` | **0 errors** (the world-factory `.mjs` arms and the evidence script are eslint-ignored by the repo config, matching every other lane) |
| world-factory (ALL a5sf) | `node --test tests/world-factory/a5sf-*.test.mjs` | **301/301 pass, 0 fail** — measured baseline before this round was **280/280**; this round adds 21 (`node-tests-all.log`) |
| BL-17 backend arms | `node --test tests/world-factory/a5sf-bash.test.mjs` | **21/21 pass** (`arms-green.log`) |
| mutation controls | `node dev/agent-workflow/evidence/a5sf-bash/mutation-controls.mjs` | **control: PASS**, 3/3 `RED-AS-REQUIRED` (`mutation-controls.json`, `.scratch/mutation.log`) |
| runtime vitest groups | `vitest run packages/runtime/test/a5sf-*.test.ts a5g6-install-face-render.test.ts a3p4-permission-lifecycle-e2e.test.ts p7t3-lifecycle-fact.test.ts` | **16 files, 234/234 pass** |
| whitespace | `git diff --check` | **rc 0** |
| artifact gate (index) | `node scripts/check-artifacts-committed.mjs` | **verdict=ok compared=1960 glue=101** |
| artifact gate (head) | `node scripts/check-artifacts-at-head.mjs` | see §3.1 |

### 3.1 Artifact gate

This branch changes `packages/runtime/team-services/src/*.ts`, which feeds the committed install
surface. `check-artifacts-at-head.mjs` is the gate that answers "does the commit carry its own
build"; its verdict for the final commit is recorded in `artifacts-head.verdict.txt` next to this
file (the command is `node scripts/check-artifacts-at-head.mjs`). The index-side verdict above says
only that the tree matches the index — it does not claim a build produced those bytes.

## 4. The 21 arms, RED → GREEN

TDD shape per arm: the arm was written first and executed against the **pristine `origin/master`
sources** (implementation stashed with `git stash push -- <the five src files>`), then the
implementation was restored and the same file re-run. Both logs are committed:

* `arms-red.log` — pristine sources: **17 of 21 fail**. The 4 that pass are *context* arms whose
  subject pre-exists this round and must NOT change: `RG-UNCHANGED` (rg's admission),
  `CAPABILITY-PROBE` (the shipped network gate's own refusal), `PTY-FACE` (the face already owns no
  terminal) and `COMPOSITION` (no `shellClass` on the lane/barrel).
* `arms-green.log` — this branch: **21/21 pass**.

| Arm | Pins |
| --- | --- |
| `ADMIT` | a declared `bash -c` reaches the confined provider; request argv/cwd; exactly one ALLOW fact per declared root, on the right axis (`spawn`, `spawn:write`) |
| `NOT-DECLARED` | no `shellClass` ⇒ `SUBPROCESS_SHELL_NOT_DECLARED`, **one deny fact**, **0 spawns** |
| `PROGRAM-NOT-ADMITTED` | `dash` under a `bash`-only class ⇒ `SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED`, 0 spawns |
| `INVOCATION-UNDECLARED` | admitted program, no declared roots ⇒ `SUBPROCESS_SHELL_INVOCATION_UNDECLARED`, 0 spawns |
| `ARGV-SHAPE` | `-lc` / extra operands ⇒ `SUBPROCESS_SHELL_ARGV_UNSUPPORTED`, 0 spawns |
| `RG-UNCHANGED` | declaring a shell class does not weaken rg: `rg` without `--no-config` ⇒ `IO_READ_DENIED`; `/bin/cat` ⇒ `IO_READ_DENIED`; 0 spawns (green before AND after) |
| `WRITABLE-PROGRAM` | a Member-writable file named `bash` ⇒ `IO_READ_DENIED` ("WRITE lane"), 0 spawns (name is not identity) |
| `WRITE-ONLY-READ` | a declared read of a write-only root ⇒ `IO_READ_DENIED`, one deny fact, 0 spawns, bytes unchanged, **and the compiled kernel profile grants no read bit** |
| `WRITE-ONLY-WRITE` | the SAME root is writable (`spawn:write` ALLOW, 1 spawn) while its kernel read bit stays `false`; the read witness is proven **sensitive** on a read-permitted twin (it reports `true` there) — so the negative control can catch a read |
| `WRITE-ONLY-WRITE-OUTSIDE` | declared write outside the write lane ⇒ `IO_WRITE_DENIED`, 0 spawns |
| `CREATE-OUTSIDE` | declared create outside the lane ⇒ `IO_WRITE_DENIED`, 0 spawns, **file never appears** |
| `CHMOD-OUTSIDE` | declared `chmod` outside the lane ⇒ `IO_WRITE_DENIED`, 0 spawns, **mode and bytes unchanged** |
| `CREATE/CHMOD-INSIDE` | the same two declarations INSIDE the write lane are admitted — the refusal is the lane, not the command |
| `NETWORK-DENY-UNENFORCED` | `network: deny` ⇒ `NETWORK_UNCONFINED_REALM`, 0 spawns, detail carries the probed row (`network-destination='unsupported'`) |
| `NETWORK-DENY-ENFORCED` | a provider that PROVES `enforced` is the only configuration admitted, and its request carries `networkProfile: 'deny'` |
| `NETWORK-ALLOW` | with the network axis allowed the request carries **no** `networkProfile` (the face claims nothing it did not probe) |
| `CAPABILITY-PROBE` | the shipped `evaluateNetworkRequirement('deny')` refuses with `IO_POLICY_UNSUPPORTED`, and `networkProbeRow` reports `network-destination: unsupported` — the environment fact behind §5 |
| `PTY-LEGACY-MOUNT` | a `terminals`-consuming module on a governed realm ⇒ `TERMINALS_LEGACY_PTY_REFUSED`, detail names 旧代 PTY / legacy-generation, **inherited PTY never consulted (0 calls)**, 0 provider spawns, no attach record, `tools.get('bash')` undefined |
| `PTY-LEGACY-DEFERRED` | a module that defers `ctx.inject(['terminals'])` ⇒ the same typed code via the deferred check |
| `PTY-FACE` | the confined subprocess face still owns no terminal (`spawnTerminal` ⇒ `SUBPROCESS_TERMINAL_UNSUPPORTED`) |
| `COMPOSITION` | `shellClass` exists on neither the service barrel nor the effective lane (composition-only declaration) |

### 4.2 The three mutation controls (`mutation-controls.json`)

Each control removes ONE mechanism from the REAL source with a literal single-occurrence edit,
runs the SAME arm file, restores the bytes, and re-asserts the sha256 of every touched file
(`control: PASS`; the file is restored in `finally` too).

| Mutant | Mechanism removed | Measured failures (all other 17-19 arms green) |
| --- | --- | --- |
| `M1-shell-admission-removed` | `shellClassAdmissionRefusal` always answers "no refusal" | `NOT-DECLARED`, `PROGRAM-NOT-ADMITTED`, `INVOCATION-UNDECLARED`, `ARGV-SHAPE` |
| `M2-network-probe-assumes-enforcement` | `probeNetworkDenial` returns `enforced` regardless of the measured row | `NETWORK-DENY-UNENFORCED` |
| `M3-pty-refusal-dropped` | both PTY refusal branches made unreachable (pre-mount + deferred) | `PTY-LEGACY-MOUNT`, `PTY-LEGACY-DEFERRED` |

`M1` leaves `ADMIT` green on purpose: with admission gone a declared shell still spawns — what
breaks is every arm that measures the REFUSAL. No mutation reddens an arm outside its own
mechanism, so each half is independently load-bearing.

## 5. The network capability probe (measured on THIS host)

Command: the probe script is reproducible from `mutation-controls.mjs`'s sibling logic; the exact
output is committed as `capability-probe.log` (real `createConfinedProcessProvider(...).probe()`):

```
landlock ABI v7 (measured)
network-destination : unsupported
  note: Landlock ABI v4 mediates only TCP port bind/connect inside the domain; UDP, IPv6 raw
        paths, AF_UNIX sockets, inherited socket FDs and out-of-band routes are NOT covered —
        this is not a general no-network guarantee (PoC-4b)
evaluateNetworkRequirement('deny') => ok:false IO_POLICY_UNSUPPORTED
  "no provider in this lane demonstrates full network deny (PoC-4b); Landlock TCP bits do not count"
```

Meaning: **this environment cannot deny the network.** The face therefore ASKS the backend at
spawn time and refuses a `network: deny` lane with `NETWORK_UNCONFINED_REALM` (0 spawns) rather
than running a network-capable child under a claim it cannot keep. `enforced` is the ONLY level
that admits the spawn (`NETWORK-DENY-ENFORCED`), and no provider in this tree reports it. The probe
is cached per spawn, never assumed, never simulated.

## 6. What a declared shell does NOT get (disclosed, not hidden)

1. **The body is opaque.** Declared roots are consulted; the commands inside the body are not. A
   body that reads a different in-lane path than declared is not distinguishable at admission. The
   OS profile is the boundary; admission is fact-carrying defence in depth (the BL-40/BL-41
   posture, restated in the file header).
2. **Undeclared `chmod` is not mediated by Landlock.** Landlock has no "change mode" right at all:
   a same-uid inode the shell can reach can be `chmod`-ed even if the composition did not declare
   it. This is why `chmod` targets are a DECLARATION (consulted on the write lane) and why §7 is a
   refusal: an admitted shell with ambient filesystem reach is not something this round presents
   as a governed persistent shell.
3. **Runtime read allowance.** The compiled profile still carries the runtime entries (`/usr`,
   `/bin`, `/etc`, `/proc`, …) the launcher needs; a shell body inherits them.
4. **No terminal semantics**: no same-PTY multi-command, no drain/kill across generations, no
   session identity.

## 7. Answer: can a governed Member reach an unconfined or network-capable execution through the new `bash` path?

**Not through any path this tree can build.** Stated precisely, in two layers:

**(a) Product composition — no.** Nothing in this tree supplies `shellClass` to a realm:
`ConfinedSubprocessRealmSpec` carries it optionally and `mountA5sfRealm` forwards only what the
row composition gives it; no row/config/blueprint field maps to it. So on every product-built
realm the value is `undefined` and a shell argv is refused with `SUBPROCESS_SHELL_NOT_DECLARED`
(0 spawns, one deny fact). Independently, the native persistent-`bash` module injects
`terminals`, so mounting it on a governed realm is refused at composition time with
`TERMINALS_LEGACY_PTY_REFUSED` — that refusal IS product-reachable (it lives in
`mountNativeToolModules`, the seam `attachA5sfNativeToolModules` calls). And the native `bash`
tool is not mounted anywhere else.

**(b) The seam, under exactly one declared configuration — yes, with the following declared limits.**
If a composition explicitly supplies
`shellClass: { programs: ['bash'] }` on a realm that already owns the confined `subprocess` face,
and the spawn declares `shell: { program: 'bash', reads: [...] }` with argv exactly
`['/bin/bash','-c',<body>]`, and the effective lane's `network.access !== 'deny'`, then:
the body runs inside the Landlock profile (filesystem lane enforced by the kernel), with **ambient
outbound network** (no netns; §5), with the runtime read allowance (§6.3), and with **undeclared
`chmod` outside the admission's reach** (§6.2). With `network.access === 'deny'` the same
configuration is REFUSED (`NETWORK_UNCONFINED_REALM`) **on this host**, because the probe reports
`unsupported`; a backend that reports `network-destination: enforced` would be the only
configuration to admit it, and none exists here. There is therefore **no admitted configuration
that both runs a shell body and denies the network** on this environment.

That is exactly why the backend is wired but left **unreachable from the product**: declaring a
shell class today would hand a promoted tool an ambient network egress plus an unmediated
`chmod`, which is the opposite of the row's 禁网 / chmod 负控 clauses. The refusal half is the
honest product state until a network-denying backend and a terminal face land.

## 8. NOT proven (the live half) — one-shot acceptance checklist

None of the following was run this round: no Host boot, no PTY, no real shell. A future operator
with boot authorisation runs these IN ORDER; each is one command, and each must be recorded with
its exact output before BL-17 can claim the row.

1. Host boots with the pinned runtime and a world DSH_HOME (TEST_METHODS §7) — the standard
   two-process boot the other live rows use; verify `curl`-level liveness of the Member's tool
   plane, not just the process.
2. Attach the native module `@deepseek-ai/tool-bash-persistent` through the product row
   (`a5sfNativeToolModules`) and record the refusal: expect `TERMINALS_LEGACY_PTY_REFUSED`, no
   `bash` tool definition visible to the model, no PTY process created.
3. Declare a shell class on a Member realm (composition input only) and call `bash -c 'true'` once:
   record argv, `pid` existence window, one `spawn` ALLOW fact and one `spawn:write` fact (or none
   if no writes declared), and that no `terminals` service was consulted.
4. Same-PTY multi-command: two sequential commands through ONE shell handle; record the SAME pid
   and the second command's output after the first. (This is the clause that cannot be faked
   host-free.)
5. 只写不读 under the real kernel: `cat <write-only>/secret` inside the body must FAIL at the
   kernel (EACCES / exit≠0), while writing the same root succeeds; record both exit codes.
6. `chmod` negative control: `chmod 600 <read-only-inode>` inside the body and record that the
   mode CHANGED (the disclosed gap, §6.2) — this is expected to be a finding, and the row must
   then decide whether the lane is re-scoped or the shell class is withdrawn.
7. 禁网: `curl`/TCP connect attempt inside the body; record the observed outcome and, on this
   host, the expected refusal BEFORE the body runs when `network: deny` is declared.
8. Cross-generation PTY: revoke the Member's policy revision while a shell is live; record that the
   shell is killed/refused, not drained.

## 9. Honest intermediate state (why BL-17 is still NOT DONE)

* The backend half (admission, write-only lane, create/chmod negatives, network refusal, legacy-PTY
  refusal) is proven host-free and mutation-controlled.
* The live half (a real persistent shell, same-PTY multi-command, kernel-observed read denial,
  observed chmod gap, observed egress attempt, PTY drain/kill across generations) is **unproven**.
* Product wiring is deliberately left reverted/unreachable: no product composition declares a shell
  class, and the native `terminals` consumer is refused. The row's own 禁网 clause cannot be met by
  this host's backend, so "run bash in the product" would be a regression dressed as progress.
* `ALPHA5-SANDBOX-BACKLOG.md` row BL-17 records this state verbatim (BACKEND-PARTIAL, V@B = no) and
  the matrix row M-08 keeps a grade below `ENFORCE`.
