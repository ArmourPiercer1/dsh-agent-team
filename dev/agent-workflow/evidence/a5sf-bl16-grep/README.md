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
| `packages/runtime/team-services/src/subprocess.ts` (new) | `readIntentsOf` (declared read roots), `programAttributionRefusal` + `CONFINED_SUBPROCESS_STATIC_PROGRAMS` (the typed statically-attributable allow-list: `rg`), `createMemberSubprocessGuard` (the SAME `FsGuard` shape, the SAME `evaluateLocatorAccess` decision, the SAME `TeamIoDenial` codes), `createConfinedOutputReader` (bounded, offset-based collect), `createConfinedSubprocessClass` (the Service subclass that replaces `spawn`) |
| `packages/runtime/team-services/src/install.ts` / `mount.ts` / `src/plugin/live/a5sf-realm-row.mjs` | an **optional** `subprocess` face: `compiledFor` may answer `{ effective, provider, realmId? }`; the installer nests `root.isolate('fs', label).isolate('subprocess', label2)` so the confined process service lives in the SAME isolated chain the route-C native modules are re-mounted into |

Two layers, and neither one is a filter over results:

1. **ADMISSION (before any process).** Two decisions, in this order:
   **(a) attribution** — a spawn whose reads cannot be statically attributed to the
   declared read roots is refused: `sh`, `bash`, `dash`, `zsh`, `python*`, `node`,
   `perl`, `ruby`, `awk`, `xargs`, `find`, … and every binary not on the declared,
   typed allow-list (`CONFINED_SUBPROCESS_STATIC_PROGRAMS = ['rg']`) fail closed, and
   for `rg` the argv contract is enforced (`--no-config` required; `--pre`,
   `--search-zip`/`-z` refused). This refusal is a typed `TeamIoDenial`
   (`IO_READ_DENIED`) carrying the truthful attribution reason, plus exactly one
   `a5sf-guard-consult/1` fact (`decision=deny`, `locator=argv[0]`) — and **zero**
   provider calls. **(b) lane** — the request's declared read roots (operands after
   `--`, resolved against `cwd`; `cwd` itself when the argv names no operand) are
   consulted one by one against the **effective** lane (`ceiling ∩ restriction`, the
   output of the ONE compiler `compileEffectiveIo`). A root outside it throws the same
   typed denial and one fact, again **before** `provider.spawnStreaming`. The negative
   control is a counter, not a string: `spawns=0->0` (§4 `SHELL-DENY`, `GREP-OUT`).
2. **CONTAINMENT (the OS).** The same effective policy is compiled by the SAME
   P1-07 compiler (`compileExecutionProfile`) into a Landlock allowlist, and the child
   runs under the real launcher. **Its boundary is narrower than "everything the
   admission did not name":** the profile is
   `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc` (the first four and the
   program directory are added by this face for exec/loader; `/etc` and `/proc`
   READ_FILE/READ_DIR come from the shared launcher's own `runtime_base`). The kernel
   serves a direct `/etc/passwd`, `/usr/lib/os-release`, `/proc/self/status` read, an
   in-lane symlink to any of them, and a pre-existing in-lane hardlink to an outside
   inode; it refuses an out-of-lane path (`/home`, `/srv`, `/var`, a scratch sibling)
   and a symlink whose target is outside the allowance. §4 `PIN-ETC`, `PIN-SYMLINK`,
   `PIN-HARDLINK` pin both sides. The admission is the ONLY layer for a **declared**
   root inside that allowance.

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

The first version of (A) disclosed a real asymmetry and left it open: a command whose
*body* named a path the argv did not name (`sh -c 'cat /etc/passwd'`) reached the
kernel and, because the launcher's `runtime_base` grants `/etc` (and `/proc`), was
**served** — with no guard fact. Review round 2 closes that general-face hole by
**admission, not string filtering**: the spawn is refused before any process because
its reads cannot be statically attributed. The negative control is the same counter
discipline as `GREP-OUT`:

```
SHELL-DENY  sh -c 'cat /etc/passwd; cat <outside>/secret.txt'
            → spawns=0->0, providerCalls=0,
              one fact member/null/member-bl16-probe/spawn/deny/IO_READ_DENIED//bin/sh,
              bytes returned = ""
```

The declared allow-list is `rg` (the binary the shipped `grep`/`glob` argv executes),
not a heuristic shell-name filter: an unknown binary cannot be proven to read only its
operands, so it fails closed until a future tool adds its program **and its argv
contract** deliberately. `rg`'s contract is enforced too (`--no-config` mandatory, so a
ripgrep config file can never be read off-operand; `--pre`/`--search-zip` rejected
because they execute another program). Consequence, stated because it is a real
limitation: the shipped search argv still executes, but an ad-hoc caller that omits
`--no-config` is refused (the reviewer's own probe passes such an argv, and it now
denies — see §4.3). The kernel stays as defence in depth; it is no longer the layer
that a shell body reaches.


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
SHELL-DENY (shell body refused at ADMISSION: one deny fact, spawns unchanged): spawns=0->0 providerCalls=0->0 denial=IO_READ_DENIED facts=[member/null/member-bl16-probe/spawn/deny/IO_READ_DENIED//bin/sh] bytes=""
KERNEL (raw provider: out-of-lane refused, in-lane served): facts=0 stdout="cat: <outside>/secret.txt: Permission denied\nRC=1\nINSIDE-NEEDLE\n"
PIN-ETC (raw provider: direct /etc, /usr and /proc reads SUCCEED, zero guard facts): kernelRead=/etc/passwd+/usr/lib/os-release+/proc/self/status SUCCEEDED facts=0 … stdout="root:x:0:0:root:/root:/bSEP\nPRETTY_NAME=\"Ubuntu 26.0SEP\nName:\thead\nUmask:\t0022\n…"
PIN-CAPS (raw provider: write-file yes; mkdir/symlink/execve DENIED; in-lane hardlink ALLOWED): mkdir=DENIED writeFile=ALLOWED symlink=DENIED(symInLane+symToEtc) hardlinkInLane=ALLOWED inLaneExecve=DENIED …
PIN-SYMLINK (in-lane symlink -> /etc/passwd served; one ALLOW fact): symlinkTarget=/etc/passwd SERVED result="<inside>/link-passwd:root:x:0:0:root:/root:/b" facts=[member/null/member-bl16-probe/spawn/allow/ALLOW/<inside>]
PIN-PROGDIR (a Member-writable copy named rg EXECUTES; the allow-list is by name): memberWritableProgram EXECUTED result="<inside>/needle.txt:INSIDE-NEEDLE" (programDir grant; residual #3)
PIN-HARDLINK (pre-existing in-lane hardlink to an outside inode served; one ALLOW fact): outsideInode SERVED result="<inside>/hard-secret:OUTSIDE-SECRET-MUST-NOT-" facts=[member/null/member-bl16-probe/spawn/allow/ALLOW/<inside>]

15 arms measured; receipt -> dev/agent-workflow/evidence/a5sf-bl16-grep/arms.json
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
* `SHELL-DENY` is review round 2's closure: the same `sh -c 'cat /etc/passwd; cat
  <outside>/secret.txt'` request that used to be SERVED (measured before the edit: the
  file came back) is now refused at admission — **one** fact, `locator=/bin/sh`,
  `decision=deny`, `decidedBy=IO_READ_DENIED`, `spawns=0->0`, and the collected bytes
  are empty. The detail says the reads are not statically attributable, not "does not
  exist".
* `KERNEL` is now measured at **layer 2 alone** (raw provider, admission deliberately
  bypassed): the out-of-lane read is refused (`Permission denied`, `RC=1`) while the
  in-lane read succeeds. This is what the kernel still contributes after the shell
  path is closed — defence in depth for an inner-root symlink/hardlink, not the primary
  boundary.
* `PIN-ETC` is the measured limit, not a claim: a direct `/etc/passwd`,
  `/usr/lib/os-release` and `/proc/self/status` read **succeeds** with **zero guard
  facts** when the admission is bypassed. The allowance is
  `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc`; the admission is the only
  layer for a declared root inside it.
* `PIN-SYMLINK` / `PIN-HARDLINK`: with the declared root `inside` (in lane), an
  in-lane symlink to `/etc/passwd` and a pre-existing in-lane hardlink to an outside
  inode are both **served**, each with one `ALLOW` fact on the in-lane root. That is
  the residual aid the kernel gives a nested link; no claim here says otherwise.
* `PIN-CAPS` measures the in-lane capability narrowing: file write succeeds; `mkdir`,
  symlink creation and in-lane `execve` are **DENIED**; a hardlink between two in-lane
  paths **IS created** (the profile has no link bit). The shorthand "no link creation"
  would have been false for hardlinks and is not used.
* `PIN-PROGDIR` measures the allow-list's limit: a Member-writable copy **named `rg`**
  executes through the in-lane program-directory grant and reads the in-lane needle.
  The admission keys on the basename, not on the binary's bytes.

### 4.2 The CI-collected suites

```
node_modules/.bin/vitest run packages/runtime/test/a5sf-confined-subprocess.test.ts
  → 16 tests passed
node_modules/.bin/vitest run packages/runtime/test/a5sf-bl16-grep-realm.test.ts
  → 6 tests passed
```

`a5sf-confined-subprocess.test.ts` (unit, no process) pins: intent extraction
(operands after `--`, cwd fallback, a pattern/`--flag=` is never a path; a shell `-c`
body is not a path); the attribution allow-list (`rg` admitted, `sh` refused with a
truthful detail, unknown binaries refused, `--no-config` required, `--pre`/`-z`
refused); admission allow + the request's `allowPaths` bits + the fact shape; refusal
outside the CEILING; refusal INSIDE the ceiling but OUTSIDE the tool restriction (the
two-axis algebra is not a single-axis check); a `..` escape through cwd; cwd-out-of-lane
when no operand is named; `mode:'all'` refusal; stdio refusals; `spawnTerminal` refusal;
exit `0/1/2` fidelity; `{form:'missing'}` rejection; signal death; cancellation
terminating the child. Its real-OS leg now does both halves: (a) the shell body is
refused at admission with `providerCalls=0` and one deny fact; (b) the raw provider
(same request builder) serves `/etc/passwd` and refuses `../outside` — the kernel
boundary pinned rather than described.

`a5sf-bl16-grep-realm.test.ts` (product seam, real pinned module, real rg) pins:
`R0/R1` the preset definition reaches the INHERITED service (its tripwire throws) while
the shadow reaches the confined one (the tripwire is never called again) — the
discriminating pair; `R2` out-of-lane refused with `spawns` unchanged and one
`IO_READ_DENIED` fact; `R3` no-match is not an error; `R4` invalid pattern is an error;
`G1/G2` glob rides the SAME face (in-lane lists, out-of-lane refused); `R5` shell body
refused at admission (one fact, zero spawns) **plus** the direct layer-2 measurement
(`/etc` served, outside refused).

### 4.3 The reviewer's probes, re-run against this build

The five probes in `.reviewer-tmp/` were written independently of the author's arms.
Their outcomes on the corrected build, verbatim from the run:

```
probe-q1.mjs                  A..K shell arms ALL "DONE REJECTED IO_READ_DENIED";
                              leaked=false; RG arms also rejected (their argv omits
                              --no-config, so the rg contract refuses them); admission
                              arm root=hardlink still ALLOW (layer 1 cannot see an
                              inode alias)
probe-symlink-allowance.mjs   aborts on the first arm: TeamIoDenied IO_READ_DENIED,
                              target '/bin/sh' (previously: /etc/passwd,
                              /usr/lib/os-release, /proc/self/status all returned)
probe-narrow.mjs              aborts on the first arm: TeamIoDenied IO_READ_DENIED,
                              target '/bin/sh' (the same capabilities are re-measured
                              at layer 2 by PIN-CAPS)
probe-order.mjs               providerCalls: 0, facts: 1, order: [FACT:deny] — the
                              fact is recorded before any provider call
probe-isolate.mjs             member fs confined, ctx subprocess confined, root
                              services unchanged; out-of-lane fs read refused
```

The two probes that abort do so **because the shell hole is closed**: they call
`sh -c` and await `done` without a rejection handler. Their old measurements are
preserved by the new raw-provider arms (`PIN-ETC`, `PIN-CAPS`), which are labelled as
layer 2. The reviewer's rg probe argv is refused for a second, deliberate reason:
it omits `--no-config`, so its reads are not statically attributable. The shipped
module passes it, which is why `GREP-IN`/`GLOB-IN` still execute.

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
* A shell/interpreter/unknown-argv spawn is refused at ADMISSION with one typed
  `IO_READ_DENIED` fact, no process, and no bytes (`SHELL-DENY`; the same `sh -c`
  command was measured returning `/etc/passwd` before the edit).
* Exit `0/1/2` fidelity, an unrecordable exit rejection, signal death, cancellation.
* Layer 2, measured directly: the kernel refuses an out-of-lane read while an in-lane
  read in the same process succeeds (content-read ENFORCED on this host), **and** it
  serves direct `/etc`, `/usr`, `/proc`, in-lane symlinks to them, and a pre-existing
  in-lane hardlink (`PIN-ETC`/`PIN-SYMLINK`/`PIN-HARDLINK`).

### 6.2 Needs a live Host (not run; no boot authorised — P2-01 start budget spent)
* That the production preset/glue actually supplies a `subprocess` face and that the
  real Member's routed `grep`/`glob` are the ones measured here.
* The real tool SURFACE (`grep`/`glob` visible once, prompt sections, deny lane) under
  the confined subprocess face — the suite measures the definitions, not the live
  agent surface.
* Whether the host's `subprocess` service shape matches the sampled base class beyond
  `spawn`/`spawnTerminal`.

### 6.3 Residual risks (disclosed, not mitigated)
1. **The runtime allowance is a widening OUTSIDE the lane, and it is larger than this
   README first said.** The OS profile carries
   `lane ∪ /bin,/usr,/lib,/lib64,programDir ∪ /etc,/proc`. The first four and the
   program directory are added by this face (execute + read); `/etc` and `/proc`
   READ_FILE/READ_DIR are added by the **shared launcher's own `runtime_base`**
   (`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`, the same
   builder both exec arms use). Consequence, measured: a direct `/etc/passwd`,
   `/usr/lib/os-release`, `/proc/self/status` read SUCCEEDS; an in-lane symlink to any
   of them succeeds; a pre-existing in-lane hardlink to an outside inode succeeds. The
   kernel refuses `/home`, `/srv`, `/var` and scratch siblings. **The admission is the
   only layer for a declared root inside the allowance.** Narrowing the shared base is
   P1-07 code and an owner decision, recorded as backlog BL-39 — it may be needed by
   other tools, so this lane does not change it.
2. **Nested links/hardlinks inside an admitted root are served with an ALLOW fact.**
   The admission consults the declared ROOT, not every entry under it. A nested symlink
   to `/etc` or a hardlink to an outside inode therefore reads successfully and records
   `decision=allow` on the in-lane root (`PIN-SYMLINK`, `PIN-HARDLINK`). This is the
   kernel allowance above showing through the search path; no claim in this file says
   the admission inspects the tree.
3. **The allow-list is by program NAME, not program BYTES — measured, not inferred.**
   `rg` is admitted by basename; the face does not hash the binary. `PIN-PROGDIR`
   copied the pinned `rg` into the Member's write lane and executed it successfully
   through the program-directory grant. A Member-writable executable named `rg` is
   therefore executed. The shipped binary is outside the Member write lane, and no
   Member-write path to the shipped binary was measured; a binary-identity check is
   follow-up, not done.
4. **The model-facing text of a refusal is generic.** The pinned module catches the
   `done` rejection and reports `grep subprocess failed before reporting an outcome
   (ripgrep provider failure)`; the typed code lives in the thrown `TeamIoDenial` and
   in the recorded fact, not in the tool text. Making the text typed would require
   shadowing the module's error mapping (an upstream-internal concern).
5. **`grep`/`glob` share one face, and the install spec has no field to set the binding
   identity.** `ConfinedSubprocessOptions.toolBindingIdentity` exists and defaults to
   `null`; `ConfinedSubprocessRealmSpec` (the install/realm input) exposes no such
   field, so every fact in §4 records `toolBindingIdentity=null`. The `createConfinedSubprocessClass`
   caller may pass it, but the product mount does not. For search this is not a loss:
   search has no `dsh.fs/*` binding, so the ceiling realm is the intended fact realm;
   a future binding-scoped subprocess lane would need the field wired through.
6. **The binding-realm gap (BL-17 hazard).** `mountNativeToolModules` routes a
   binding-owned mount to `binding?.ctx`; `installToolBindingRealm` isolates `fs` only
   and mounts **no** `subprocess` face. A future binding-mounted native module that
   injects `subprocess` would resolve the inherited, unconfined host service, silently.
   Search does not hit this (it mounts on the ceiling `memberTarget`), but BL-17 must
   not be built on the premise that the binding realm confines processes.
7. **The in-lane capability set is narrower than a normal shell.** Measured
   (`PIN-CAPS`, raw provider): file write succeeds; `mkdir`, symlink creation and
   in-lane `execve` are DENIED; a hardlink between two in-lane paths **is created**
   (there is no link bit in the profile). A shell/PTY row (BL-17) must be designed
   against this narrowed capability set — the shorthand "no link creation" would be
   wrong for hardlinks and is not used.
8. **OS-level vs string-level.** The admission is a string/path-level decision over
   DECLARED intents (with `evaluateLocatorAccess`'s symlink resolution); the kernel is
   the OS-level layer. They are not the same mechanism and this README never calls the
   admission "OS confinement".
9. **Real `rg` vs a test double.** The product-seam arms use the real binary; the unit
   suite uses a deterministic fake for the refusal/exit matrix, so a future change in
   `rg`'s argv could pass the unit suite and fail the probe (which is why both exist).

### 6.4 The fork for the owner, after review round 2
(A) — a general confined `ctx.subprocess` — is still the only shape the seam can
express without a second evaluator, but it is now (A) + a **declared admission
allow-list** (`rg` only). The owner decision that remains is BL-17's: a shell/PTY row
cannot run under this rule (shell class is refused by design), so it needs a separate,
fact-carrying path whose reads are attributed some other way (e.g. a declared command
list), not a widening of this one. That is recorded as backlog BL-40 (BL-17 depends on
this rule).

## 7. Gates (verbatim verdicts, run on the final tree)

| Gate | Command | Verdict |
| --- | --- | --- |
| typecheck (all packages) | `pnpm -r run typecheck` | **exit 0** — every workspace project with a typecheck script ran and finished (`packages/runtime` Done) |
| typecheck (the touched program) | `node_modules/.bin/tsc -p packages/runtime/tsconfig.json --noEmit` | **clean**, no output |
| lint (touched files) | `eslint` on the 4 touched TS paths + the evidence script | **0 errors**; the evidence script is eslint-ignored (one warning, not an error); earlier `prefer-const`/`no-explicit-any` were fixed, not suppressed |
| lint (repo-wide, NOT a gate) | `pnpm lint` | **red: 129 errors / 32 warnings, ALL in files this branch does not touch** (`action-router/effects.ts`, `control/service.ts`, `src/plugin/host.ts`, …). Pre-existing debt; disclosed, not attributed to this lane |
| new unit suite | `vitest run packages/runtime/test/a5sf-confined-subprocess.test.ts` | **16/16 pass** |
| new realm suite | `vitest run packages/runtime/test/a5sf-bl16-grep-realm.test.ts` | **6/6 pass** |
| lane-hygiene suite (touched ledger) | `vitest run packages/runtime/test/a5p4-lane-hygiene.test.ts` | **8/8 pass** (the new types-only edge is booked with its pinned import line) |
| product-seam probe | `node dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs` | **15/15 arms**, receipt `arms.json` |
| reviewer probe set | `node .reviewer-tmp/probe-{q1,symlink-allowance,narrow,order,isolate}.mjs` | re-run against this build; outcomes in §4.3 (shell closure measured; two probes abort on the now-closed shell path) |
| world-factory (node:test) | `node --test tests/world-factory/a5sf-{native-route-c,p2-wiring,f1-ctx,assembly}.test.mjs` | **61/61 pass** |
| scripts/checks (node:test) | `node --test scripts/ci-local.test.mjs`, `node --test tests/checks/dist-placements.test.mjs` | **pass / pass** |
| whitespace | `git diff --check origin/master...HEAD` | **clean, rc=0** (the earlier "clean" was the WORKING TREE only; the reviewer was right — two trailing-blank-line findings are fixed) |
| full runtime suite (parallel) | `vitest run packages/runtime` | **6008/6015 pass**; the 7 failures were all 5 s vitest timeouts under full-suite load — isolation proof below (`runtime-full.verdict.txt`) |
| L0 CI | `pnpm ci:local` | **NOT RUN this round.** Known load-flaky on this host and the reviewer already isolated all four identities as flakes (`alpha5-search-backend` P11, `a5g6-install-face-render`, `a5p4-lane-hygiene` tsc leg, `alpha5-glob-backend`). Historical two-run verdicts are kept in §7.1; no green is claimed. |

Raw verdict extracts live next to this file: `ci-local-1.verdict.txt`,
`ci-local-2.verdict.txt`, `runtime-full.verdict.txt`, `red-1.log`, `arms.json`,
`reviewer-probes.log`
(the full 1.2 MB CI logs are NOT committed — the extracts carry every failure identity
and the verdict line).

### 7.1 The historical `ci:local` verdicts (pre-review-round-2; not re-run)

These two runs belong to the AUTHOR's original tree. This correction round did not run
`pnpm ci:local` (known load-flaky; the reviewer already isolated all four flake
identities). They are kept because they are the reason the flake set is known, not as
a current verdict.

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
