# Subprocess face — layer B (native-tool contract) acceptance, host-free

Task: **layer B acceptance of the Subprocess capability face** — the per-native-tool
contract that the shared face-level (layer A) arms cannot cover.
Branch `task/a5sf-sub-contract-20261107` (worktree `.worktrees/a5sf-sub-contract`),
based on `origin/master` = `12f3c4a30` (`FS-CONTRACT-2`, #613). Predecessor shape:
`dev/agent-workflow/evidence/a5sf-fs-face/README.md`; this document copies the
**shape** (proven / not-proven-with-boot-command / layer ownership / mutation
controls / host precondition), not its content.

Host starts spent this round: **0** (the three earmarked starts remain untouched).
`CORE PATCH BUDGET = 0`: no `packages/**` file is changed by this branch (the
mutation runner edits one product source file in-process, restores it byte-for-byte,
and re-asserts the sha256 — see §6). No upstream file was modified. No grade,
no `V@B`, no candidate claim; the matrix gained evidence pointers only (§8).

Voice note: every number below is copied from a run whose command is printed next to
it, on **this** host. §5 lists what is NOT proven and the exact boot command that
would be needed. §4 reports two product findings that are **reported, not fixed**.

---

## 1. What layer B is, and why these arms are not layer A

| layer | question it answers | already owns (do not restate) |
| --- | --- | --- |
| **A** — capability face × permission axis | is the LANE around a call correct: ceiling ∩ restriction, read/write axes, ask/deny, member isolation, fact attribution | `a5sf-member-policy.test.ts`, `a5sf-product-assembly.test.mjs`, `a5sf-tool-axis.test.mjs`, `a5sf-bash.test.mjs` (21 arms) |
| **B** — per-native-tool contract | does the REAL face behave as its own contract says **inside** an admitted call: argv boundary, program-vs-class precedence, probe shape, write-axis ordering, child environment | **this document** |
| **C** — frozen-candidate live | does the assembled Host + preset + provider actually do it | previous boot rounds; not re-run here |

The discipline: an arm was written only where the assertion is about the
**face's** semantics or the **order/identity** of side effects. No arm here
concludes "the lane refused". Where a deny fact appears it is the
ordering/attribution witness for a property this layer owns (P2, P4). The
existing 21 `a5sf-bash.test.mjs` arms already cover the admission's existence, a
write-only lane, out-of-lane `chmod`/create, the network refusal by code, and the
PTY refusal; **none** of them pins the precise argv predicate, the
program-vs-class precedence with two arms differing only in the declared class,
the probe's **shape** (capability vs measurement), or measures the child
environment against upstream. Those are the increments below.

## 2. What is REAL in the world (and what each piece has to be)

`tests/world-factory/lib/a5sf-sub-contract-world.mjs` is the one world builder; no
second harness exists.

| piece | real artifact | why |
| --- | --- | --- |
| confinement / composition | **PRODUCT** `mountA5sfRealm` (`packages/runtime/team-services/src/mount.ts:792`) with `subprocess: { effective, provider, shellClass }` (install spec, `install.ts:106-133`) | this is the call the live Member setup makes; an arm must drive the face the product actually mounted, not `createConfinedSubprocessClass` by hand |
| base service | **PINNED** `LocalSubprocessRuntime` (`@deepseek-ai/dsh-subprocess-local`, `639ed01539`) mounted on the root as `ctx.subprocess` | it is the service the realm SHADOWS, and its own `spawn` is the UNCONFINED comparison path (it goes through `childEnv → scrubbedParentEnv`) |
| native module | **PINNED** `@deepseek-ai/dsh-bash-local` `LocalBashExecutor`, mounted **inside** the Member's isolated scope through `realm.mountNativeToolModules` | the shipped executor that injects `subprocess` and builds the shell spawn spec; mounting it proves the product composition resolves the confined face |
| OS provider | **PRODUCT** `createConfinedProcessProvider` (P1-07) with the real Landlock launcher pin (`packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py`, sha256 pinned) wrapped once by `countingProvider` | a refusal arm's `spawns.before === spawns.after` is a measurement of the provider boundary; the wrapper only counts, records the request and forwards the real result/error |
| env comparison | **PINNED** `scrubbedParentEnv` (`packages/subprocess/subprocess/src/index.ts:66`) and `installProxyFromEnvironment` (`packages/util/http-proxy`) | the divergence arm must compare against upstream's actual overlay, not a copy of it |

A real child process IS created by the admitted arms (the BL-16 precedent); that is a
process, not a Host boot. No port, no `DSH_HOME`, no `tests/homes/**`.

## 3. The arms

File: `tests/world-factory/a5sf-sub-contract.test.mjs` — **15** `node:test` cases.
Run: `node --test tests/world-factory/a5sf-sub-contract.test.mjs` →
`tests 15 / pass 15 / fail 0` (`suite.log`).

### 3.1 P1 — the argv admission boundary (where exactly `ARGV_UNSUPPORTED` fires)

**Semantics found.** `shellClassAdmissionRefusal` is a pure, synchronous predicate
with a **fixed order** (`packages/runtime/team-services/src/subprocess.ts:582-644`):

1. `isShellClassSpawn` (is `argv[0]`'s basename a shell/interpreter class) — a
   non-shell program returns `undefined` here (`:586`; the class set is
   `:326-330`);
2. **no declared class** → `SUBPROCESS_SHELL_NOT_DECLARED` (`:589-597`);
3. program not in `admission.programs` → `SUBPROCESS_SHELL_PROGRAM_NOT_ADMITTED`
   (`:598-605`);
4. no `spec.shell` declaration → `SUBPROCESS_SHELL_INVOCATION_UNDECLARED`
   (`:606-614`);
5. declaration names another program → `PROGRAM_NOT_ADMITTED` (`:615-622`);
6. **`SUBPROCESS_SHELL_ARGV_UNSUPPORTED`** fires here and only here (`:623-629`):
   `argv.length === 3 && argv[1] === '-c' && typeof argv[2] === 'string' &&
   argv[2].trim() !== ''`;
7. declared roots must be non-empty strings (`:631-644`).

Before all of that, `assertSpawnSpec` refuses a non-absolute `argv[0]`
(`:1230-1238`) and a non-absolute `cwd` (`:1239-1241`). After it, the lane consults
happen (`:1365-1452`).

So the predicate is a **shape** rule, not a body-content rule and not the program
allow-list. It does **not** inspect quotes, `;`, `$()`, NUL bytes or length — the
body is opaque by design (the declared roots are the only statically attributable
input). It does not fire for a non-shell program (`/bin/cat` is judged by the
program allow-list) and it cannot fire before the class/program/declaration checks.

**Assertion (`P1-ARGV-ACCEPTED-BOUNDARY`, `P1-ARGV-SHAPE-REJECTED`,
`P1-PRECEDENCE`).** A 10-vector table, driven twice: through the pure predicate and
through the product face. Admitted / looks-dangerous-but-admitted:
`['/bin/bash','-c','true']`, nested quoting + command substitution, a NUL byte in
the body, a 200 kB body. Rejected / looks-benign-but-rejected: a whitespace-only
body, an empty body, a non-string body, `-lc`, an extra operand, `-c` not at
`argv[1]`. Every rejected vector is `SUBPROCESS_SHELL_ARGV_UNSUPPORTED` with
`spawns.before === spawns.after === 0` and exactly one `deny` fact on `/bin/bash`.
The precedence arm pins the four earlier refusals: bare `bash` →
`SUBPROCESS_PROGRAM_NOT_ABSOLUTE`; `/bin/cat` with a class declared →
`IO_READ_DENIED` (program code, never `ARGV_UNSUPPORTED`); `/bin/dash` outside the
class with a malformed argv → `PROGRAM_NOT_ADMITTED`; a declaration naming `dash`
for a `/bin/bash` argv → `PROGRAM_NOT_ADMITTED`.

**RED→GREEN.** On the pre-BL-17 file (the source before `8b1615121`) the suite is
all-red because the contract surface does not exist (`red-first-run.log`); with the
shipped file all 15 are green. **Mutation control M1** drops the shape condition
(`:623 → if (false)`) → exactly `P1-ARGV-SHAPE-REJECTED` reds. **M6** drops the
absolute-program check (`:1230 → if (false)`) → `P1-PRECEDENCE` and
`GEN-NATIVE-MODULE-BOUNDARY` red (declared multi-arm control, §6).

**Honest boundary (not a bug).** The NUL-body and 200 kB vectors are **admitted by
the declared rule** and do reach a real provider request; the predicate promises
nothing about body content. On this host the NUL vector exits 0 with empty output
(the launcher/exec boundary truncates the body), which is a property of the OS
hand-off, not of the admission. The body is never scanned for "dangerous" strings.

### 3.2 P2 — program admission vs shell class (precedence, neither masks the other)

**Semantics found.** The shell-class decision is computed **before** the program
allow-list and before intent extraction (`:1365-1374`); when a shell refusal exists
the face records one read-axis deny fact and throws the **shell** code
(`:1376-1387`), never `IO_READ_DENIED` as the surfaced error. When the shell
admission passes, `programWriteLaneRefusal` still runs as the identity check
(`:1394`), and a non-shell program never enters the shell gate at all.

**Assertion.** `P2-CLASS-UNDECLARED` and `P2-CLASS-DECLARED` are the pair that
differs **only** in `shellClass` (same argv, same declaration, same lane, same
world options): undeclared → `SUBPROCESS_SHELL_NOT_DECLARED`, 1 deny fact on
`/bin/bash`, 0 provider calls, empty stdout; declared `{programs:['bash']}` →
real allow fact, 1 provider call, real stdout
`IN-LANE-SUBPROCESS-BYTES\n`. `P2-SHELL-PROGRAM-NOT-IN-CLASS`: `/bin/dash` with
`['bash']` → `PROGRAM_NOT_ADMITTED`; the **same call** in a world declaring
`['bash','dash']` is admitted and really runs `dash` — the class membership is the
only difference. `P2-NON-SHELL-PROGRAM-UNAFFECTED`: `/bin/cat` with a class
declared → `IO_READ_DENIED`, and never a shell code — the class does not widen the
program allow-list.

**RED→GREEN + control.** **M2** makes the undeclared branch skip its refusal (the
admission dereferences an absent class) → exactly `P2-CLASS-UNDECLARED` reds; the
declared sibling stays green, which is what makes the pair discriminating.

### 3.3 P3 — `probeNetworkDenial` shape (capability statement, not a measurement)

**Semantics found.** There is exactly **one** probe implementation
(`probeNetworkDenial`, `:982-1017`); the web face imports it (`web.ts`), the
subprocess face calls it at `:1413`. On this host the real provider's probe returns
(for the network row):

```
dimension: 'network-destination'
level:     'unsupported'
mechanism: null
evidence:  null
note:      'landlock ABI v7: Landlock ABI v4 mediates only TCP port bind/connect
            inside the domain; UDP, IPv6 raw paths, AF_UNIX sockets, inherited
            socket FDs and out-of-band routes are NOT covered — this is not a
            general no-network guarantee (PoC-4b)'
```

`mechanism: null` and `evidence: null` are the observable distinction from the
`content-read`/`write` rows, which carry a mechanism string and an
`evidence://a5p4/...` URI. The network dimension has **no recorded measurement**.
`probeNetworkDenial` maps **any** level other than `enforced`, a missing probe, a
throwing probe, a refused probe and a missing network row to `unsupported` with a
"cannot be proven" note (`:993-1010`); the shipped gate independently refuses
`deny` with `IO_POLICY_UNSUPPORTED` (`packages/runtime/sandbox-provider/network.ts:40-54`).

**Assertion.** `P3-PROBE-SHAPE` asserts the real row above, the five absence
shapes, and `assertCapabilityNotMeasurement` (no "observed zero connections", no
"zero transport entries", no "syscalls recorded") on every note.
`P3-DENY-REFUSES-BEFORE-SPAWN` drives a `network: 'deny'` lane through the product
face: `NETWORK_UNCONFINED_REALM`, `spawns.before === spawns.after === 0`, **zero**
`SpawnRequest` objects built (no `networkProfile: 'deny'` ever reaches the
provider), and the detail names the capability (`network-destination='unsupported'`)
rather than a measurement. This is the reuse-of-probe law measured: one probe, and
the deny path **refuses to spawn** rather than spawning and hoping.

**Finding: no conflation found.** The code never reads "no transport entries" as
a syscall observation; absence is phrased as "enforcement cannot be proven". The
arm pins that reading so a future "the child made no connections, so deny works"
edit reds here. **M3** drops `capability.level !== 'enforced'` (`:1414 → if
(false)`) → exactly `P3-DENY-REFUSES-BEFORE-SPAWN` reds: the request is built and
the real provider refuses it at its own gate (`SUBPROCESS_PROVIDER_REFUSED`,
`spawns` increments), which is the "spawn and hope" shape the arm forbids.

**Do not read any arm in this file as OS-level network confinement.** The only
measurable fact here is the **position** of the refusal. See §7 for what a
network-isolation claim would additionally require.

### 3.4 P4 — write-lane ordering and attribution (the FS face's bug class)

**Semantics found.** `createMemberSubprocessWriteGuard(policy)` evaluates the
**write** lane with the one evaluator (`:922-939`; `SHELL_WRITE_GUARD_METHOD =
'spawn:write'`, `:914`). The spawn path consults declared reads on the read axis
and declared `writes` + `chmod` targets on the write axis **before**
`confinedSpawnAllowPaths` and the `SpawnRequest` (`:1440-1461`). The method name is
what makes the fact say which axis was consulted.

**Assertion (the anti-mis-attribution construction).** The world's **read** lane
includes `outside`, the **write** lane does not. The declaration asks for
`reads: [outside]` and `writes: [outside/created.txt]`. Facts:
`[spawn / allow / outside]` then `[spawn:write / deny / outside/created.txt]`;
error `IO_WRITE_DENIED`; `spawns` 0; the target file is absent. The read-axis
**allow** fact on the same directory is the witness that the read axis admitted the
call — an arm that passed because "the other axis refused" cannot pass this one.
`P4-WRITE-CONTROL` widens **only** the write lane: same argv/declaration →
admitted, 1 real spawn, file created with `A5SF` bytes, facts
`[spawn allow, spawn:write allow]`. `P4-CHMOD-WRITE-AXIS` pins that `chmod` uses the
same write axis: `IO_WRITE_DENIED`, one `spawn:write` deny fact, 0 spawns, mode and
bytes unchanged.

**RED→GREEN + control.** **M4** points the write guard at `policy.read` (`:927`) →
`P4-WRITE-AXIS-ATTRIBUTION` and `P4-CHMOD-WRITE-AXIS` red (declared multi-arm
control: both consult that one guard); the write control stays green.

### 3.5 P5 — `confinedChildEnvironment` (what the child actually receives)

**Semantics found.** `confinedChildEnvironment(overrides)` (`:1071-1083`) copies
the ambient environment, drops names matching `/KEY|PASSWORD|SECRET|TOKEN/i` or
starting with `DSH_` **case-insensitively**, then applies the spec's overrides (a
string is an opt-in; `undefined` is a tombstone). The spawned request merges it as
`{ ...confinedChildEnvironment(spec.env), ...options.env }` (`:1461`). It has **no
proxy overlay**.

Upstream's `scrubbedParentEnv()` (`@deepseek-ai/dsh-subprocess`,
`packages/subprocess/subprocess/src/index.ts:66-80`) performs the same scrub and
then applies `proxyEnvironmentForChild()` (`:75`): it adds `NODE_USE_ENV_PROXY='1'`
and restores the user's proxy names. The unconfined path uses it through
`childEnv` (`packages/subprocess/subprocess-local/src/spawn.ts:44-54`).

**Measured divergence (this host, real children).** With a real proxy policy
installed through the pinned `installProxyFromEnvironment`:

| child | `NODE_USE_ENV_PROXY` | `HTTP_PROXY` | `A5SF_SECRET_TOKEN` |
| --- | --- | --- | --- |
| UNCONFINED (`LocalSubprocessRuntime` → `scrubbedParentEnv`) | `1` | `http://user-proxy.example:8080` | dropped |
| CONFINED (the product face → `confinedChildEnvironment`) | *(absent)* | `http://user-proxy.example:8080` | dropped |

So a **confined child currently differs from an unconfined one in proxy
behaviour**: it inherits the raw/published proxy variables but not the flag a node
child needs to honour them, so a Node child in the confined lane connects
**directly** while its unconfined sibling proxies. This is the known divergence
recorded by the FS/adapter review (`subprocess.ts:1071` vs
`subprocess/src/index.ts:66`) — **measured here, reported, not fixed** (fixing it
would either add an upstream dependency to `team-services` or re-implement the
overlay; both are owner decisions, and `pnpm-lock.yaml` is out of scope).

**Assertion.** `P5-ENV-SCRUB`: real confined and unconfined children print their
env; both drop `A5SF_SECRET_TOKEN`, `DSH_HOME` and lowercase `dsh_lower`, keep
`A5SF_VISIBLE`, and agree with no proxy policy active; an explicit spec entry
survives the scrub and an explicit `undefined` removes a preserved name.
`P5-PROXY-DIVERGENCE`: the direct helper comparison **and** the two real children
show `NODE=1` unconfined vs `NODE=` confined. **M5** adds the overlay effect to the
confined scrub when a proxy is published → exactly `P5-PROXY-DIVERGENCE` reds.

### 3.6 The real native module boundary (`GAP-SUB-CONTRACT-1`)

**Measured.** The pinned `@deepseek-ai/dsh-bash-local` executor, mounted through
`realm.mountNativeToolModules` into the Member scope, resolves the confined face
(`ctx.shell` exists; 1 fiber). Its first `execute({command,…})` is refused with
`SUBPROCESS_PROGRAM_NOT_ABSOLUTE` and **0 provider calls**, because
`LocalBashExecutor.execute` builds `['bash','-c',spec.command]` — a bare PATH name
(`packages/shell/bash-local/src/index.ts:188`) — and `spawnSpec` also carries a
`spill` stdio disposition the confined face refuses. The **same executor on an
unconfined root runs** and returns `IN-LANE-SUBPROCESS-BYTES\n`, so the refusal is
the face's absolute-program rule, not a broken module.

**Finding `GAP-SUB-CONTRACT-1` (reported, not fixed).** The shipped transient-shell
executor cannot ride the confined `subprocess` face: its argv is not absolute and
its stdio carries a spill file. This is consistent with M-09's `NOT_WIRED` state,
but it means an admitted shell path for a native module does not exist today; the
admitted vectors in P1/P2 are driven at the face with the face's declared shape.
Severity: fail-closed (nothing executes), no confinement hole.

## 4. Findings summary — test-coverage gaps vs product defects

**Test-coverage gaps (semantics found correct; only the pin was missing):**

- **P1** — no arm pinned the precise argv predicate (the existing arm covers only
  "a non-`-c` shape is refused"). The predicate is correct as declared; the
  dangerous-looking admitted vectors are the honest boundary.
- **P2** — no arm proved the precedence with two arms differing **only** in the
  declared class; the code is correct (shell gate first, program list never
  masks it).
- **P3** — no arm pinned the probe's **shape** (null mechanism/evidence) or the
  distinction between "capability unproven" and "no transport observed". The code
  does **not** conflate them; this is a coverage gap, not a defect.
- **P4** — the existing write-only arm used a target outside **both** lanes, so it
  could pass because the read axis would also have refused; the new arm makes the
  read axis **allow** the same directory and requires the write method/allow-deny
  pair. The semantics were correct; the anti-mis-attribution construction was
  missing.

**Product defects / divergences (reported, not fixed):**

- **P5** — `confinedChildEnvironment` lacks upstream's proxy overlay; a confined
  Node child ignores inherited proxy variables (measured above). This is a real
  behavioural divergence from every unconfined child, with routing/correctness
  impact, and the owner must decide whether `team-services` takes the dependency or
  duplicates the overlay.
- **`GAP-SUB-CONTRACT-1`** (new, not one of the five) — the pinned `bash-local`
  executor cannot execute on the confined face (bare `bash` + spill stdio).
- **Observation, not a defect** — the admission admits a NUL byte / arbitrarily
  long body because the body is opaque; the OS hand-off then truncates/rejects it.
  The face's declared rule is the boundary, and it is stated as such in §3.1.

## 5. What is NOT proven (and the exact one-shot command a boot would run)

**None of the following is claimed by any arm here.**

| not proven | why it needs a Host | one-shot command a boot would run |
| --- | --- | --- |
| a live Member/preset reaching this face with the model-visible `bash`/`grep` | the preset registry, binding glue and capability deny lane are assembled by the product row inside a boot | `node dev/agent-workflow/evidence/a5sf-candidate1/run-boot.mjs` (the frozen-candidate boot runner; port/allocation is the operator's) |
| a real persistent shell / PTY session on a governed realm | PTY allocation and the `terminals` lane are Host services; the face refuses `spawnTerminal` by design | same boot runner; the `M-08`/`M-13` live rows |
| the shipped executor on an **admitted** path | requires `GAP-SUB-CONTRACT-1` to be resolved by a composition (absolute argv + no spill) before a live module can be tested | same boot runner, after the composition fix |
| OS-level network confinement | **not measurable by refusal**: the refusal happens in our own admission code; the OS was never asked | a provider that reports `network-destination: enforced` with a recorded evidence row, plus a real child attempt under `deny` and an out-of-band transport observation — see §7 |
| the `enforced` branch (`networkProfile: 'deny'` reaching the provider) | no provider in this tree reports `enforced`; the real provider refuses `deny` itself | only after a netns/seccomp provider exists; a boot would not change the probe's answer |

`NOT_REACHED` in this document means exactly the rows above. Nothing in §3 is
simulated: refusals are measured at the provider counter, admitted calls are real
children under the real Landlock launcher.

## 6. Mutation controls (one per property, plus the native-module boundary)

`dev/agent-workflow/evidence/a5sf-subprocess-face/mutations.mjs` applies a literal
single-occurrence edit to
`packages/runtime/team-services/src/subprocess.ts`, runs the SAME suite, records the
red set, restores the file in a `finally`, and re-asserts its sha256. Run:

```
node dev/agent-workflow/evidence/a5sf-subprocess-face/mutations.mjs
```

Result (`mutations.log`): `MUTATION-CONTROLS-PASS`.

| control | edit | reds (declared) |
| --- | --- | --- |
| `M1` P1 | drop the closed argv shape (`:623`) | `P1-ARGV-SHAPE-REJECTED` |
| `M2` P2 | skip the no-class refusal (`:589`) | `P2-CLASS-UNDECLARED` |
| `M3` P3 | drop `level !== 'enforced'` (`:1414`) | `P3-DENY-REFUSES-BEFORE-SPAWN` |
| `M4` P4 | write guard uses `policy.read` (`:927`) | `P4-WRITE-AXIS-ATTRIBUTION`, `P4-CHMOD-WRITE-AXIS` (**declared multi-arm**) |
| `M5` P5 | add the proxy-overlay effect to the confined scrub (`:1082`) | `P5-PROXY-DIVERGENCE` |
| `M6` native/P1 | drop the absolute-program check (`:1230`) | `P1-PRECEDENCE`, `GEN-NATIVE-MODULE-BOUNDARY` (**declared multi-arm**) |

Two controls inevitably red more than one arm because the mechanism they remove is
shared by two arms of the same property: `M4` (one write guard serves `writes` and
`chmod`) and `M6` (one absolute-program check serves the precedence arm and the
shipped-executor arm). Each is declared here, as the FS lane declared `M12`; no
control reds an arm outside its property.

The baseline control (no edit) is green: `PASS baseline: red=[] expected=[]`.

## 7. What evidence would be required before anyone may claim Bash is network-isolated

Refusing to spawn is **not** evidence of network isolation: it is a statement about
our own admission code, made before the OS was asked. A claim would require all of
the following **observable facts**, on the tree being claimed:

1. **A capability row with a mechanism and recorded evidence**, not just a level:
   `network-destination: enforced`, a non-null `mechanism` (e.g. `netns` + seccomp
   + no inherited sockets), and an `evidence://` row bound to the realm id and
   launcher trust root, with the ABI/coverage listed (TCP **and** UDP, IPv6, raw
   sockets, AF_UNIX, inherited FDs, out-of-band routes — the list
   `LANDLOCK_TCP_NOTE` says Landlock v4 does **not** cover).
2. **A real child attempt that would otherwise reach the network and fails inside
   the deny lane**, with the failure being a kernel/transport denial (not a tool
   error and not our refusal): e.g. a spawned client against a listening socket,
   under `network: deny`, with the provider's `enforced` row as the precondition.
3. **A positive control on the same invocation without the confinement** (same
   argv, no lane / no profile) that **succeeds** and is observed on the wire — so
   "it failed" cannot be the command's own bug.
4. **An out-of-band observation** of the transport itself (a packet/socket counter,
   a listener that records zero accepted connections, a DNS log) for the deny-lane
   child, plus the same observation showing traffic for the control. "Zero
   transport entries" in a probe result is exactly what must **not** be used as
   this observation unless the probe says it measured syscalls/transport — this
   host's network row carries `mechanism: null` and `evidence: null`, i.e. it is a
   capability statement.
5. **A second consumer path** (the live Host preset) showing the same deny lane on
   the model-visible `bash`, because the host-free face is not the product's live
   wiring.

Until 1–5 exist, the strongest honest statement is the one this document makes:
*on this host, a `network: deny` lane refuses at the admission layer with zero
processes, because the provider's own probe reports `network-destination:
unsupported`; the OS was never asked to deny anything.*

## 8. Matrix pointers (no grade, no `V@B` change)

`docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md`:

- `M-08 bash persistent` ⑥ gains the layer-B pointer (the five contract properties;
  live still zero coverage, `V@B=no` unchanged).
- `M-09 bash transient` ⑥ gains the layer-B pointer **and** the
  `GAP-SUB-CONTRACT-1` pointer (the shipped executor is refused at `argv[0]`);
  `NOT_WIRED` unchanged.
- A paragraph after the summary table records the same for the shared
  `subprocess` face (`M-06`/`M-07` ride it) and states explicitly that none of
  these arms is a live/level evidence for those rows.

No grade moved, no `V@B` changed, no candidate claim.

## 9. Gates measured this round

| gate | command | result |
| --- | --- | --- |
| new suite | `node --test tests/world-factory/a5sf-sub-contract.test.mjs` | **15/15 pass** (`suite.log`) |
| all a5sf world-factory suites | `node --test tests/world-factory/a5sf-*.test.mjs` | **375 tests, 375 pass, 0 fail** (`a5sf-suites.log`) |
| targeted vitest | `pnpm exec vitest run packages/runtime/test/a5sf-{confined-subprocess,subprocess-contract,subprocess-unconfined-realm,bl16-grep-realm}.test.ts packages/runtime/test/a5p4-network-closure.test.ts` | **5 files / 60 tests pass** (`vitest.log`) |
| typecheck | `pnpm -r typecheck` | **rc 0**, 0 `error TS` (`typecheck.log`) |
| mutations | `node dev/.../mutations.mjs` | **MUTATION-CONTROLS-PASS** (`mutations.log`) |
| host refusal | `A5SF_SUB_CONTRACT_HOST_ROOT=/tmp/a5sf-sub-contract-host-absent node --test …` | one `A5SF-SUB-CONTRACT-HOST-REFUSED` line, **15 skipped / pass 0** (`host-refusal-simulation.log`) |
| `git diff --check` | `git diff --check` | **rc 0** |

`tests/world-factory/a5sf-*.test.mjs` needs the gitignored pinned checkout at
`tests/deepseek-harness-test-use` (and, because `a5sf-tool-axis.test.mjs` reads the
worktree-relative path, a symlink to it inside the task worktree); the count above
is the real count on this host with that checkout present.

## 10. Host precondition (the three states)

`tests/world-factory/a5sf-sub-contract.test.mjs` loads four **built** pinned entries:

```
packages/subprocess/subprocess/lib/index.js        (scrubbedParentEnv)
packages/subprocess/subprocess-local/lib/index.js  (LocalSubprocessRuntime)
packages/shell/bash-local/lib/index.js             (LocalBashExecutor)
packages/util/http-proxy/lib/index.js              (installProxyFromEnvironment)
```

1. **host absent** → one machine-readable `A5SF-SUB-CONTRACT-HOST-REFUSED …` line
   and every case registered as **SKIPPED** (counted as not-run, `pass 0`), never
   as pass. Measured in `host-refusal-simulation.log`.
2. **host present but an entry missing** → hard failure
   `A5SF-SUB-CONTRACT-HOST-INCOMPLETE`: a partial/older checkout is a pin
   violation, not an absence.
3. **host present and complete** → every arm runs.

`A5SF_REQUIRE_PINNED_HOST=1` turns state 1 into a hard failure, for a lane that is
SUPPOSED to provision the host. `A5SF_SUB_CONTRACT_HOST_ROOT` exists only to
exercise states 1/2 without moving the checkout; product code never reads it.

**Provisioning proposal (not done here):** either build the pinned checkout in the
lane (`pnpm install && pnpm -r build` inside `tests/deepseek-harness-test-use`, the
gitignored tree), or add the four pinned npm packages as devDependencies so the
suite imports the published `0.2.0-rc.2` artifacts from `node_modules`. The second
needs a lockfile regeneration; this sandbox's registry resolution failed in the FS
round (`ECONNRESET`), so it is an owner decision, not a test-only change.

## 11. Census / boundaries of this branch

- **`.mjs` only.** Added two `.mjs` files under `tests/world-factory/` plus the
  evidence `.mjs`; no scannable `.ts` was added, so no
  `packages/testkit/test/p4t6-bookings/` booking is required.
- **No new production consumer** of the confined-provider lane was added, so no
  `a5p4` named-mount ledger entry is required.
- **No `packages/**` change** on this branch. The mutation runner and the RED
  baseline touched `subprocess.ts` only inside their own process and restored it
  byte-for-byte (sha256 re-asserted; `git diff` is empty for `packages/**`).
- **0 Host boots**, 3 earmarked starts untouched. Real child processes were
  created by the admitted arms (the BL-16 precedent); no Live Host, no port, no
  `DSH_HOME`, no `tests/homes/**`.
