# BL-16 — a confined `subprocess` Provider for the Member realm (host-free evidence)

Task: `BL-16 | P2-03 原生 grep（OS rg 真实拒绝、exit 0/1、取消、结果裁剪）`.
Branch: `task/a5sf-bl16-grep-20261104` (worktree `.worktrees/a5sf-bl16-grep`, based on
`origin/master` = `11e5a95c315a279c584202ff886a87e1e07ab3a6`).
Claimed grade when this README was written: **`ENFORCE-PARTIAL`**, `V@B = no`
(host-free proof only — **no Host boot was authorised or run**, see §7).

Voice note: this file states what was MEASURED, on which host, and what it does NOT
prove. Every number below is copied from a run whose command is printed next to it.
Nothing in this file should be read as "grep/glob are accepted": they are not, and the
matrix rows keep a grade below `ENFORCE` for the reasons in §6.

---

## 1. The gap this task closes (already measured, not re-derived)

`dev/agent-workflow/evidence/a5sf-fs-tools/README.md` (SEARCH-0 … SEARCH-3) measured
that the pinned `@deepseek-ai/dsh-tool-fs-search` module (0.2.0-rc.2 @ `639ed01539`)
declares `inject: ["tools", "systemPrompt", "subprocess"]` — **`subprocess`, not `fs`**
— and executes its packaged ripgrep through `ctx.subprocess.spawn`. The Member realm
(`packages/runtime/team-services/src/install.ts`) confined **`fs`** only, so the routed
`grep`/`glob` definitions kept resolving the **inherited, unconfined** host service:

```
SEARCH-3 (from a5sf-fs-tools): readAllow excludes the searched dir,
          grep=EXECUTED, glob=EXECUTED, guardFacts=0, outside content returned.
SEARCH-0 (control): the same out-of-lane search runs on the HOST preset before any
          attach — the hole pre-exists the routed mount.
```

That measurement is the reason this task is not "wire another tool": the lane needed a
Service-shadowing provider on the **process** axis, not on the `fs` axis.

## 2. What was built

Three additions, all on existing seams (no new policy evaluator, no upstream patch):

| File | What it does |
| --- | --- |
| `packages/runtime/team-services/src/subprocess.ts` (new) | `readIntentsOf` (declared read roots), `createMemberSubprocessGuard` (the SAME `FsGuard` shape, the SAME `evaluateLocatorAccess` decision, the SAME `TeamIoDenial` codes), `createConfinedOutputReader` (bounded, offset-based collect), `createConfinedSubprocessClass` (the Service subclass that replaces `spawn`) |
| `packages/runtime/team-services/src/install.ts` / `mount.ts` / `src/plugin/live/a5sf-realm-row.mjs` | an **optional** `subprocess` face: `compiledFor` may answer `{ effective, provider, realmId? }`; the installer nests `root.isolate('fs', label).isolate('subprocess', label2)` so the confined process service lives in the SAME isolated chain the route-C native modules are re-mounted into |

Two layers, and neither one is a filter over results:

1. **ADMISSION (before any process).** The request's *declared* read roots — the
   operands after `--`, resolved against `cwd`, or `cwd` itself when the argv names no
   operand — are consulted one by one against the **effective** lane
   (`ceiling ∩ restriction`, the output of the ONE compiler `compileEffectiveIo`). A
   root outside it throws `TeamIoDenial('IO_READ_DENIED' | 'IO_POLICY_UNSUPPORTED')`
   and writes exactly one `a5sf-guard-consult/1` fact via the existing `observeGuard`
   transport — **before** `provider.spawnStreaming` is called. The negative control is
   a counter, not a string: `spawns=0->0` (§4).
2. **CONTAINMENT (the OS).** The same effective policy is compiled by the SAME
   P1-07 compiler (`compileExecutionProfile`) into a Landlock allowlist, and the child
   runs under the real launcher. A read the admission could not name (a shell body, a
   `--pre` program, a symlink hop) is refused by the KERNEL: the bytes are never read.
   Profiled in §4 `KERNEL`.

Refusals are typed and fail closed. This face refuses, instead of degrading:
`mode: 'all'` lanes (`PATH_LANE_UNRESTRICTED` — a default-deny OS ruleset cannot
express "everything"); a bare (non-absolute) `argv[0]` (it would make the executable
allowance a PATH-wide grant); stdio `control` (fd 3 is the launcher handshake, not a
caller channel); `spill` files (no recovery path is produced, so a lossy tail is
refused rather than silently returned); `inherit` output (the launcher owns fd 1/2);
`spawnTerminal` (a PTY cannot ride the profile — this face owns no terminal).

### 2.1 The handle adaptation, and why it is not a wrapper around a native handle

`toSubprocessHandle` in `sandbox-provider` exposes `collected` as **strings**, while the
native seam the search module consumes needs a published `SubprocessOutputReader`
(`readFrom(fromByte) → { text, nextOffset, lossy }`, non-consuming). Depending on the
upstream package's internal collector would be an upstream-internal import, so the
collector is re-implemented locally against the PUBLISHED contract
(`createConfinedOutputReader`) and the outcome is derived from the payload's own exit
record:

* `payloadExit.form === 'recorded'` → `rc >= 0` ⇒ `{ exitCode: rc, signal: null }`;
  `rc < 0` ⇒ `{ exitCode: null, signal: <name> }` (a signal death is never an exit code).
* any other form (`missing`/`unparsable`/`pid-mismatch`) ⇒ the handle's `done`
  **rejects** with `SUBPROCESS_EXIT_UNRECORDABLE`. It never fabricates `0`: a search
  that "succeeded" with an unrecorded exit would silently turn a crash into "no
  matches".

The child environment is the ambient environment minus credential-shaped names
(`/KEY|PASSWORD|SECRET|TOKEN/i`) and minus `DSH_*`, then the spec's explicit entries
(`undefined` = tombstone). The scrub is implemented locally for the same reason: this
package has no dependency on the upstream subprocess package, and adding one would be a
lockfile change outside this lane.

## 3. The design fork (stated, not chosen silently)

Two defensible designs existed:

* **(A) a general `ctx.subprocess` replacement** — everything a Member spawns goes
  through the confined provider, including bash-style commands;
* **(B) a narrow grep/glob-only provider** — only the search module's spawns are
  confined.

**(A) was implemented**, because (B) cannot be expressed on this seam: the module
resolves a SERVICE (`ctx.subprocess`), and a service cannot tell grep's spawn from any
other caller's spawn without a caller-identity check that does not exist on the
subprocess contract. Narrowing per-tool would require a second, tool-aware wrapper —
exactly the second policy evaluator this lane must not add.

The tradeoff, disclosed: with (A) a command whose *body* names a path the argv does not
name (e.g. `sh -c 'cat /etc/passwd'`) is refused by the KERNEL with **no guard fact**
(the admission had nothing to consult). That is a real asymmetry between "declared read
intent" (typed refusal + fact) and "undeclared read attempt" (kernel errno + no fact).
For `grep`/`glob` the root is always in the argv (`--`) or is `cwd`, so the acceptance
arms do produce facts. **Owner question** in §6.

## 4. What the arms measured (this host, this run)

Host: WSL2, kernel `6.18.33.2`, node `v24.21.0`; launcher
`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`, sha256
`1264ea584e3438d6…`; real `rg` = the pinned baseline's
`@vscode/ripgrep-linux-x64@1.18.0` binary.

### 4.1 The product-seam probe (real pinned module, real rg)

```
node dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs
```

```
PROBE: content-read=enforced write=enforced launcherSha=1264ea584e3438d6 rg=…/@vscode/ripgrep-linux-x64@1.18.0/bin/rg
GREP-PRE (unconfined control, before the confined face): executed=yes outsideBytes=LEAKED facts=0
GREP-IN (in-lane, confined): result="Found 1 match" spawns=1 facts=[member/null/member-bl16-probe/spawn/allow/ALLOW/<inside>]
GREP-OUT (out-of-lane, refused before any process): spawns=0->0 result="Error: grep subprocess failed before reporting an outcome (ripgrep provider failure)" facts=[member/null/member-bl16-probe/spawn/deny/IO_READ_DENIED/<outside>]
GREP-EXIT1 (no match is not an error): result="No matches found"
GREP-EXIT2 (invalid pattern is a failure): result="Error: grep pattern rejected by ripgrep: rg: regex parse error: …"
GLOB-IN (in-lane): result="<inside>/quiet.txt\n<inside>/needle.txt" facts=[member/null/member-bl16-probe/spawn/allow/ALLOW/<inside>]
GLOB-OUT (out-of-lane, refused): spawns=0->0 facts=[member/null/member-bl16-probe/spawn/deny/IO_READ_DENIED/<outside>]
KERNEL (unnamed read refused by the OS profile): stdout="cat: <outside>/secret.txt: Permission denied\nRC=1\nINSIDE-NEEDLE\n"

9 arms measured; receipt -> dev/agent-workflow/evidence/a5sf-bl16-grep/arms.json
```

Reading the lines, precisely:

* `GREP-PRE` is the control for the WHOLE lane: the same fixture, the same module, the
  same out-of-lane path, **before** the confined face — the search EXECUTES, the
  outside bytes are returned, and zero facts exist. The difference between this line
  and `GREP-OUT` is attributable to the confined provider, not to the tool.
* `GREP-OUT`/`GLOB-OUT`: `spawns=0->0` is the **negative control against
  "filter the results after the fact"**. No process was created, so no byte of the
  outside tree was ever read into this process, let alone filtered. The typed decision
  is the fact (`decidedBy=IO_READ_DENIED`), not a substring match.
* `GREP-EXIT1` vs `GREP-EXIT2`: exit `1` (no match) is a NORMAL result while exit `2`
  (invalid pattern) is an ERROR. Both survive the handle adaptation; a flattened exit
  code would have collapsed one into the other.
* `KERNEL`: `cwd` is in lane, so the admission admits it; the shell body then reads
  `../outside/secret.txt`. The kernel refuses it (`Permission denied`, `RC=1`), the
  in-lane read still succeeds, and the outside file still holds its secret on the host
  (the refusal is a read refusal, not a deletion). **No guard fact exists for this
  arm** — see §6.1.

### 4.2 The CI-collected suites

```
node_modules/.bin/vitest run packages/runtime/test/a5sf-confined-subprocess.test.ts
  → 16 tests passed
node_modules/.bin/vitest run packages/runtime/test/a5sf-bl16-grep-realm.test.ts
  → 6 tests passed
```

`a5sf-confined-subprocess.test.ts` (unit, no process) pins: intent extraction
(operands after `--`, cwd fallback, a pattern/`--flag=` is never a path); admission
allow + the request's `allowPaths` bits + the fact shape; refusal outside the CEILING;
refusal INSIDE the ceiling but OUTSIDE the tool restriction (the two-axis algebra is
not a single-axis check); a `..` escape through cwd; cwd-out-of-lane when no operand is
named; `mode:'all'` refusal; stdio refusals; `spawnTerminal` refusal; exit `0/1/2`
fidelity; `{form:'missing'}` rejection; signal death; cancellation terminating the
child. Its real-OS leg runs a shell body that reads `../outside` with `cwd` in lane.

`a5sf-bl16-grep-realm.test.ts` (product seam, real pinned module, real rg) pins:
`R0/R1` the preset definition reaches the INHERITED service (its tripwire throws) while
the shadow reaches the confined one (the tripwire is never called again) — the
discriminating pair; `R2` out-of-lane refused with `spawns` unchanged and one
`IO_READ_DENIED` fact; `R3` no-match is not an error; `R4` invalid pattern is an error;
`G1/G2` glob rides the SAME face (in-lane lists, out-of-lane refused); `R5` the kernel
arm above.

## 5. RED first

The RED state of `packages/runtime/test/a5sf-confined-subprocess.test.ts` was the
missing module, verbatim:

```
FAIL  packages/runtime/test/a5sf-confined-subprocess.test.ts [ … ]
Error: Cannot find module '../team-services/src/subprocess.js' imported from
  …/packages/runtime/test/a5sf-confined-subprocess.test.ts
 ❯ packages/runtime/test/a5sf-confined-subprocess.test.ts:35:1
```

After the module existed, the behaviour-level failures were the real RED steps (kept in
`red-1.log` … see the run log in this directory): the profile-refusal arm failed
because the refusal was thrown synchronously where the test expected it on `done`, and
the real-OS leg initially refused because `cwd` was out of lane — both are the test
sharpening the CONTRACT, and both were resolved by changing the test's expectation to
the contract actually shipped (typed refusal delivered through `handle.done`, because
the identity resolution is asynchronous and a synchronous re-implementation would be a
second policy evaluator).

## 6. What is NOT proven, and the residual risks

### 6.1 Proven host-free
* The shadow resolves on the Member's isolated scope for the REAL pinned module.
* In-lane `grep`/`glob` execute through the confined provider and record one ALLOW fact
  on the Member realm (`realm=member`, `toolBindingIdentity=null`).
* Out-of-lane `grep`/`glob` are refused with NO process created and one typed
  `IO_READ_DENIED` fact.
* Exit `0/1/2` fidelity, an unrecordable exit rejection, signal death, cancellation.
* The kernel layer refuses an **undeclared** outside read while an in-lane read in the
  same process succeeds (content-read ENFORCED on this host).

### 6.2 Needs a live Host (not run; no boot authorised — P2-01 start budget spent)
* That the production preset/glue actually supplies a `subprocess` face and that the
  real Member's routed `grep`/`glob` are the ones measured here.
* The real tool SURFACE (`grep`/`glob` visible once, prompt sections, deny lane) under
  the confined subprocess face — the suite measures the definitions, not the live
  agent surface.
* Whether the host's `subprocess` service shape matches the sampled base class beyond
  `spawn`/`spawnTerminal`.

### 6.3 Residual risks (disclosed, not mitigated)
1. **The runtime allowance is a widening OUTSIDE the lane.** The OS profile carries the
   effective lane PLUS `/bin`, `/usr`, `/lib`, (`/lib64`), and the program's own
   directory (execute+read), because a child cannot exec or load without them. It is
   the same allowance the governed search rows already ship, and it is exactly why
   layer 1 (admission) is load-bearing for grep/glob: the kernel would ALLOW a read
   under `/usr/...` that the lane does not. An argv naming `/usr/share/...` is refused
   by the admission, but the OS alone would not refuse it.
2. **Undeclared reads have no fact.** See §3: kernel refusal, no `a5sf-guard-consult/1`
   line. A future acceptance that greps the sink for a denial would see nothing.
3. **The model-facing text of a refusal is generic.** The pinned module catches the
   `done` rejection and reports `grep subprocess failed before reporting an outcome
   (ripgrep provider failure)`; the typed code lives in the thrown `TeamIoDenial` and
   in the recorded fact, not in the tool text. Making the text typed would require
   shadowing the module's error mapping (an upstream-internal concern).
4. **`grep`/`glob` share one face.** A future binding-specific subprocess lane (the
   RIGHT factor for search) does not exist: search has no `dsh.fs/*` binding, so the
   ceiling realm enforces the effective intersection supplied by the composition.
   `toolBindingIdentity` is therefore `null` in every fact below.
5. **OS-level vs string-level.** The admission is a string/path-level decision over
   DECLARED intents (with `evaluateLocatorAccess`'s symlink resolution); the kernel is
   the OS-level layer. They are not the same mechanism and this README never calls the
   admission "OS confinement".
6. **Real `rg` vs a test double.** The product-seam arms use the real binary; the unit
   suite uses a deterministic fake for the refusal/exit matrix, so a future change in
   `rg`'s argv could pass the unit suite and fail the probe (which is why both exist).

### 6.4 The fork for the owner
Whether (A) — a general confined `ctx.subprocess` — is the intended product shape, or
whether bash-style tools should keep a SEPARATE, fact-carrying path (the §3 asymmetry
above). This lane implemented (A) because it is the only shape the seam can express
without a second evaluator; the alternative needs a decision, not a patch.

## 7. Gates

## 7. Gates (verbatim verdicts, run on the final tree)

| Gate | Command | Verdict |
| --- | --- | --- |
| typecheck (all packages) | `pnpm -r run typecheck` | **exit 0** — 9/10 projects typechecked (`legacy` has no script); `packages/runtime` Done |
| typecheck (the touched program) | `node_modules/.bin/tsc -p packages/runtime/tsconfig.json --noEmit` | **clean**, no output |
| lint (touched files) | `eslint` on all 8 touched paths + the evidence script | **clean** (a `prefer-const` and two `no-explicit-any` were fixed, not suppressed) |
| lint (repo-wide, NOT a gate) | `pnpm lint` | **red: 129 errors / 32 warnings, ALL in files this branch does not touch** (`action-router/effects.ts`, `control/service.ts`, `src/plugin/host.ts`, …). Pre-existing debt; disclosed, not attributed to this lane |
| new unit suite | `vitest run packages/runtime/test/a5sf-confined-subprocess.test.ts` | **16/16 pass** |
| new realm suite | `vitest run packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | **6/6 pass** |
| lane-hygiene suite (touched ledger) | `vitest run packages/runtime/test/a5p4-lane-hygiene.test.ts` | **8/8 pass** (the new types-only edge is booked with its pinned import line) |
| product-seam probe | `node dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs` | **9/9 arms**, receipt `arms.json` |
| world-factory (node:test) | `node --test tests/world-factory/a5sf-{native-route-c,p2-wiring,f1-ctx,assembly}.test.mjs` | **61/61 pass** |
| scripts/checks (node:test) | `node --test scripts/ci-local.test.mjs`, `node --test tests/checks/dist-placements.test.mjs` | **pass / pass** |
| whitespace | `git diff --check` | **clean** |
| full runtime suite (parallel) | `vitest run packages/runtime` | **6008/6015 pass**; the 7 failures were all 5 s vitest timeouts under full-suite load — isolation proof below (`runtime-full.verdict.txt`) |
| L0 CI | `pnpm ci:local` | **FAIL (exit 1) — reported honestly, see below** |

Raw verdict extracts live next to this file: `ci-local-1.verdict.txt`,
`ci-local-2.verdict.txt`, `runtime-full.verdict.txt`, `red-1.log`, `arms.json`
(the full 1.2 MB CI logs are NOT committed — the extracts carry every failure identity
and the verdict line).

### 7.1 The `ci:local` verdicts, exactly

```
run #1 @ 18:57  DSH-CI-LOCAL verdict=fail steps=5 failed=1 coverage=determined files=4 wall=275.1s
  identity: packages/runtime/test/alpha5-search-backend.test.ts
            "P11 overflow/Spill class …" → X3-style cancel arm:
            expect(cancelled.result.settlement.kind).toBe('cancelled')   (line 661)
  isolation: that FILE alone = 42/42 pass, three consecutive runs.
run #2 @ 19:03  DSH-CI-LOCAL verdict=fail steps=5 failed=1 coverage=determined files=4 wall=245.8s
  identities (ALL THREE are on this lane's known-flake list):
    packages/runtime/test/a5g6-install-face-render.test.ts   (5015 ms → vitest timeout)
    packages/runtime/test/a5p4-lane-hygiene.test.ts          (5446 ms → vitest timeout, in-process tsc leg;
                                                              the same file passes 8/8 alone, and its subject —
                                                              my new file — typechecks clean under the real tsc)
    packages/runtime/test/alpha5-glob-backend.test.ts        (X3 timeout arm, 419 ms, cancel race)
```

Both runs report `coverage=determined` (not the exit-2 "undetermined" case), i.e. CI-local
believes it knows what ran; the failures are cancellation races and 5 s timeouts, both of
which reproduce ONLY under the full-suite load and NOT in isolation:

```
vitest run <the 7 files that timed out in the parallel run>        → 177/177 pass
vitest run packages/runtime/test/alpha5-search-backend.test.ts    → 42/42 pass, 3/3 runs
vitest run packages/runtime/test/a5p4-lane-hygiene.test.ts        → 8/8 pass
```

**What this lane did NOT do**: it did not re-run `ci:local` a third time hoping for green,
it did not skip the failing files, and it does not report these as passes. The two runs
named different identities, which is the signature of a load-sensitive flake set, not of a
regression: no failure touches a file, symbol, or behaviour this branch changed, and every
one of them is green alone.

### 7.2 One environment note (for reproducibility)

This worktree had to symlink each package's `node_modules` to the main checkout's (a fresh
git worktree carries none). Four of those symlinks were initially DANGLING
(`contracts`/`remote`/`storage`/`tools`), and `a3p3-governance-lane-hygiene` walks
`packages/**` with a bare `statSync` — it therefore failed at COLLECTION with
`ENOENT … packages/tools/node_modules`. Removing the dangling links fixed it (21/21).
This is worktree hygiene, not a product change: the same test passes on the main checkout,
where pnpm has created those directories.

