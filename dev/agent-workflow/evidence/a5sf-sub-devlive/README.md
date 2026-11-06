# SUB-DEVLIVE — the Subprocess face, measured live (2026-11-06)

One question set, one isolated World per Host start, **eleven** starts under the
owner's standing DEV-LIVE authorisation (`devlive-subprocess-1`, face
`Subprocess`). Nothing here is candidate evidence: `recordClass: DEV-LIVE`,
`osLevelNetworkIsolationClaimed: false`, `CORE_PATCH_BUDGET = 0`, no merge.

- Worktree: `.worktrees/a5sf-sub-devlive`, branch `task/a5sf-sub-devlive-20261110`
- Host: pinned checkout `tests/deepseek-harness-test-use` @
  `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2), read-only; porcelain
  verified empty before every start and after the last one.
- Ports: host 3183/3185 (family 3180), mock 3492–3495. `:3080` never touched.
- World home: `tests/homes/u5u5a5sfsub1-<stamp>` (one per start, all deleted).
- Per-start records, ports, teardown and failure attribution: [RUNS.md](RUNS.md).
- Machine-readable per-run artefacts: `runs/boot1…boot11/` (boots 10 and 11 are
  the agreeing pair under the final driver; `sha256(run-boot.mjs) =
  a05c62cbbcdb092a65333f3c7fcfe61e0e9da74a643045d220d7d3579bf6cd4a`).

## 1. The five questions, answered

### Q1 — which executor does a Member's `bash` actually reach?

**Observation (boots 10, 11; same in 4, 5, 8, 9).** Member `worker` (template
`worker`, network allow) called the model-visible `bash` tool with
`printf '<bashTag>'; sleep 1.5`, `workdir` = the World workspace. The tool result
is `isError=false` and its stdout is the tag. The instrumentation recorded:

| record | what it says |
| --- | --- |
| `shell-service` (1) | the `shell` service is present exactly once |
| `shell-exec` (1) | `executor: "SandboxBashExecutor"`, the exact command, the World workdir, `sandboxPolicy {mode:'workspace-write', workspaceRoot:<pristine host tree>}` |
| `base-spawn` (20 in the final pair) | 18 are the Team's own git plumbing (`rev-parse`/`add`/`write-tree`); the other 2 are `bwrap` children — this `bash` call and the deny-lane one of §Q5: `bwrap --ro-bind / / --dev /dev --unshare-pid --proc /proc --die-with-parent --tmpfs /tmp --bind <hostTree> <hostTree> -- bash -c '<command>'` |
| `provider-call` (1) | the confined provider was called exactly once — for the fixture's `/bin/bash -c` vector, **not** for the `bash` tool |
| `/proc` (38 batches) | the marker is visible in an OS process argv |

**Attribution layer (LOCUS).** The Member's `bash` is
`@deepseek-ai/dsh-tool-bash` → `ctx.shell.execute` → the base bundle's
`bash-sandbox` row, which re-registers the `shell` service as
`SandboxBashExecutor extends LocalBashExecutor`
(`tests/deepseek-harness-test-use/packages/shell/bash-sandbox/src/index.ts:45`)
→ the inherited base `subprocess` service → `bwrap`. The rows are in
`packages/bundle/base/cordis.patch.yml` (`sandbox-policy`, `bash-sandbox`,
`tool-bash`). The Member's **confined face was never called**: `confined-spawn`
with the bash marker = 0, `provider-call` with the bash marker = 0, while the
shipped executor ran. "Unconfined" below means *unconfined by the a5sf Member
face*, not "no OS confinement": the child is still inside the host's
`workspace-write` bwrap sandbox.

**Verdict: PROVEN.** A Member's `bash` reaches the **shipped host executor on the
inherited base subprocess service**, and the two-axis ceiling compiled for that
Member's `subprocess` does not govern it.

**Not proven / limits.** This says nothing about whether the shipped executor is
*correct*; it says which service it is. The `workspaceRoot` in that record is the
pristine host tree, not the World workspace (see §5).

### Q2 — is the confined face's argv predicate enforced live, and is a violation refused or handed on?

**Observation.** Four vectors through the product-mounted confined face, one
Member, one Host:

| vector | argv | result | provider calls | base-spawn with the body |
| --- | --- | --- | --- | --- |
| `shipped_argv` | `['bash','-c',body]` | `SUBPROCESS_PROGRAM_NOT_ABSOLUTE` ("argv[0] must be an absolute executable path; \"bash\" would make the executable allowance a PATH-wide grant") | 0 | 0 |
| `argv_lc` | `['/bin/bash','-lc','true']` | `SUBPROCESS_SHELL_ARGV_UNSUPPORTED` | 0 | 0 |
| `argv_empty_body` | `['/bin/bash','-c','   ']` | `SUBPROCESS_SHELL_ARGV_UNSUPPORTED` | 0 | 0 |
| `argv_extra_operand` | `['/bin/bash','-c','true','extra']` | `SUBPROCESS_SHELL_ARGV_UNSUPPORTED` | 0 | 0 |

**Attribution layer (LOCUS).** All four are decided in the confined face's own
admission (`packages/runtime/team-services/src/subprocess.ts`): the closed
predicate is `argv.length === 3 && argv[1] === '-c' && typeof argv[2] === 'string'
&& argv[2].trim() !== ''` (line 624), the absolute-path rule is `assertSpawnSpec`
(line 1225). The three shell-shape refusals each write **exactly one** guard fact
with `method:'spawn'`, `decision:'deny'`, `decidedBy:'IO_READ_DENIED'`,
`locator:'/bin/bash'`, `realm:'member'` — the typed code is on the caller's
refusal, the fact carries the observed transport (the body's reads cannot be
attributed). `consultations.jsonl` for the run holds 5 rows: 2 allow (the
positive control's `spawn`/`spawn:write`) + 3 these denials. The bare-PATH
refusal throws before any guard, so it writes no fact — an asymmetry, recorded,
not a defect.

**Refused, not handed on.** The unconfined executor never sees these calls: 0
`base-spawn` records carry any of the four bodies, and the `shell` service saw
only the one `bash` tool call of Q1.

**Delivery shape (measured, no claim about why).** `['bash',…]` throws
synchronously from `spawn()`; the three shell-shape refusals are decided before
any provider call but surface on the returned handle's `done` (the guard is
async). Both are refusals before the OS.

**Verdict: PROVEN.**

### Q3 — where does `network: deny` refuse, and is the honest sentence "zero processes"?

**Observation.** Member `worker-deny` (template `worker-deny`, `network.access:
'deny'`), one vector `['/bin/bash','-c',"printf '<denyTag>'; touch '<denyMarker>';
sleep 1.5"]` through the confined face:

- refused with **`NETWORK_UNCONFINED_REALM`**, message: *"the effective lane
  requests network=deny, but the confined provider's capability probe reports
  network-destination='unsupported' (landlock ABI v7: …); refusing before any
  process instead of running a network-capable child under a deny claim this host
  cannot enforce."*
- **0** `provider-call` with the body, **0** `confined-spawn`, **0** `base-spawn`
  with the body, **0** `/proc` sightings of the deny marker, marker file absent.
- **0** guard facts with `decidedBy: NETWORK_UNCONFINED_REALM`.

**Attribution layer (LOCUS).** The refusal is thrown by the confined face's
network admission, `packages/runtime/team-services/src/subprocess.ts:1409-1424`,
**after** one `provider.probe()` capability question (the `network-probe` record;
`dimension: 'network-destination'`, `level: 'unsupported'`) and **before** the
spawn. It does not run through the guard, which is why it writes no fact — unlike
the argv refusals in Q2, which do. This is an asymmetry in the refusal record,
stated as measured.

**The honest sentence.** *On this host a `network: deny` lane refuses at the
admission layer with zero processes, because the provider's own probe reports
`network-destination: unsupported`; the OS was never asked to deny anything.*
That is a statement about our own admission code, not about isolation.

**Verdict: PROVEN** (as an admission refusal with zero processes).
**`osLevelNetworkIsolationClaimed: false`.**

### Q4 — positive control on the same Host

**Observation.** In the same Team, same Host, same run: the allow-lane Member's
face-shaped call `['/bin/bash','-c',"printf '<allowTag>'; touch
'<allowMarker>'; sleep 1.5"]` was **admitted**: 1 `provider-call`, 1
`confined-spawn`, 1 `confined-exit` with `code:0`, stdout carries the tag, and the
**child-created marker file exists** (an OS fact, not our counter — the provider
runs a launcher, so the confined child's own argv never appears in `/proc`, see
§6). The `bash` tool child of Q1 ran on the same Host too.

**Verdict: PROVEN.** The deny result is distinguishable from "this lane cannot run
anything".

### Q5 — the surprising capability row for the end-state table

> **A `network: deny` Member whose ceiling applies to the confined face can still
> run a shell command through the model-visible `bash` tool, and that path is not
> refused and carries no network namespace: the deny is a property of the face,
> not of the Member.**

**Observation (new, boots 10–11, case `sub:network-deny-bash-lane`).** The SAME
`worker-deny` Member, on the SAME lane, after the face refused its probe, called
the model-visible `bash` tool with `printf '<denyBashTag>'`:

- tool result `isError=false`, stdout carries the tag; **no** confined-face
  refusal code appears anywhere in the result;
- `shell-exec` = 1, executor `SandboxBashExecutor`; the confined provider was
  called **0** times with that marker;
- an OS process carried the command (1 independent `/proc` sighting);
- the deployment sandbox argv for that child is
  `bwrap … --unshare-pid … -- bash -c 'printf …'` — it carries **no
  `--unshare-net`**, i.e. the child stays in the host network namespace.

So `network: deny` — which the host cannot enforce anyway — is not even consulted
on the bash path. **What is NOT claimed:** we did not attempt real egress (the
authority forbids real external network here), so this is "not refused, and no
network namespace was requested", not "the child reached the internet".

## 2. The §7 bar, quoted verbatim

From `dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7, unchanged:

> ## 7. What evidence would be required before anyone may claim Bash is network-isolated
>
> Refusing to spawn is **not** evidence of network isolation: it is a statement about
> our own admission code, made before the OS was asked. A claim would require all of
> the following **observable facts**, on the tree being claimed:
>
> 1. **A capability row with a mechanism and recorded evidence**, not just a level:
>    `network-destination: enforced`, a non-null `mechanism` (e.g. `netns` + seccomp
>    + no inherited sockets), and an `evidence://` row bound to the realm id and
>    launcher trust root, with the ABI/coverage listed (TCP **and** UDP, IPv6, raw
>    sockets, AF_UNIX, inherited FDs, out-of-band routes — the list
>    `LANDLOCK_TCP_NOTE` says Landlock v4 does **not** cover).
> 2. **A real child attempt that would otherwise reach the network and fails inside
>    the deny lane**, with the failure being a kernel/transport denial (not a tool
>    error and not our refusal): e.g. a spawned client against a listening socket,
>    under `network: deny`, with the provider's `enforced` row as the precondition.
> 3. **A positive control on the same invocation without the confinement** (same
>    argv, no lane / no profile) that **succeeds** and is observed on the wire — so
>    "it failed" cannot be the command's own bug.
> 4. **An out-of-band observation** of the transport itself (a packet/socket counter,
>    a listener that records zero accepted connections, a DNS log) for the deny-lane
>    child, plus the same observation showing traffic for the control. "Zero
>    transport entries" in a probe result is exactly what must **not** be used as
>    this observation unless the probe says it measured syscalls/transport — this
>    host's network row carries `mechanism: null` and `evidence: null`, i.e. it is a
>    capability statement.
> 5. **A second consumer path** (the live Host preset) showing the same deny lane on
>    the model-visible `bash`, because the host-free face is not the product's live
>    wiring.
>
> Until 1–5 exist, the strongest honest statement is the one this document makes:
> *on this host, a `network: deny` lane refuses at the admission layer with zero
> processes, because the provider's own probe reports `network-destination:
> unsupported`; the OS was never asked to deny anything.*

Against that bar this lane delivers **item 5's negative half** (the live Host
preset measured, showing the deny lane does *not* reach the model-visible `bash`)
and **item 3's shape is still absent** (the positive control we have is
"admitted-lane child runs", not "the same network attempt succeeds unconfined and
is observed on the wire"). Items 1, 2 and 4 are untouched: the provider's network
row is `level:'unsupported'`, `mechanism` is null for network-destination, and no
transport was observed. **`osLevelNetworkIsolationClaimed: false`.**

## 3. Fixture vs product — what drove what

**Product (unmodified, pinned):** the `sandbox-policy` / `bash-sandbox` /
`tool-bash` rows and `SandboxBashExecutor`; the base `subprocess` service and
`bwrap`; `packages/runtime/team-services/src/{subprocess,mount,product-assembly}.ts`
(the confined face, its admission, the network check); the route-C
`a5sfNativeToolModules` surface-neutral shadow rule; `team_delegate` and the Team
runtime.

**Fixture (this directory, evidence-owned):**
`driver/a5sf-sub-devlive-realm-row.mjs` — the World row that declares the two
Members' two-axis ceilings (`worker` network allow, `worker-deny` network deny),
mounts the realm, and wraps the base `spawn`, the `shell` service and the
provider to count calls without changing behaviour;
`driver/sub-probe-module.mjs` — the native module that SHADOWS `sub_probe` inside
the Member scope and drives one declared argv through `ctx.subprocess`;
`driver/sub-probe-stub.mjs` — the preset-scope definition of `sub_probe` that
makes the shadow surface-neutral (see §4);
`driver/preflight-bundle.mjs` + `driver/run-boot.mjs` — the zero-boot preflight,
the isolate/boot/drive/teardown cycle and the judges.

`shellClass: Object.freeze({ programs: ['bash'] })` in the World row is a
**composition input** authored by this fixture: the face admits a shell only for a
program in the declared class (BL-17/BL-16). Without it every shell is refused, so
any shell-argv question becomes unaskable. It is not the Member widening its own
allowance — the declaration lives in the row the composition mounts.

**One product invariant the fixture had to obey (measured, boot 2).** The route-C
mount refuses a native module that CHANGES a Member's model-visible surface:
`agent-bindings: the configured a5sfNativeToolModules would CHANGE the Member's
model-visible tool surface (added: ["sub_probe"]) … refusing to mount the native
shadow — a scoped registration is outside the inherited tools.restrict filter, so
a re-mounted tool could re-enable a builtinToolDeny lane`. The fix was to declare
`sub_probe` in the PRESET (the stub) so the module only shadows it. That refusal
is correct product behaviour, and it is why the stub exists.

## 4. Why the network denial is not a preflight case

The zero-boot preflight's case table is lane-shaped and closed: `axis:
read|write|network`, `expected: allow|deny`, and `caseClass: 'admission-refusal'`
only for a network case. A network case also triggers
`checkDriverCallerSurface`, which demands a **web-surfacing, non-strict Member
caller** (the web tool pair) — a shape this face does not have. Declaring one here
would force a false web preset into the composition to satisfy a checker, which is
exactly the kind of mis-declaration the preflight exists to prevent. The live
refusal also carries **zero** guard facts, which the admission-refusal class
cannot express either.

So the preflight tables only what it can grade honestly —
`sub:product-bash-executor` (read/allow, locator `paths.workspace`) and
`sub:face-admitted` (read/allow, locator `paths.inLaneFile`) — and the denial is
still a **SELECTED** run-record case (`sub:network-deny`), so its verdict folds
into the run's `overall` exactly like the tabled ones (boots 10–11: 4/4 PASS). The
observation lands in `probe-report.json` and `consultations.jsonl`, and the
preflight bundle documents the exclusion in its own header
(`driver/preflight-bundle.mjs`, `NOT TABLED` block).

## 5. One lab fact that matters beyond this lane

`shell-exec.sandboxPolicy.workspaceRoot` resolves to the **pristine host tree**
(`tests/deepseek-harness-test-use`), not the World workspace, and the child's
`bwrap` argv binds that tree read-write. The resolver is
`resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot)`
(`tests/deepseek-harness-test-use/packages/sandbox/sandbox-policy/src/index.ts:168`):
the **session** cwd wins, and the World gives the Team a session cwd of the host
tree. Two fixture attempts are recorded in `RUNS.md` (boots 6–7) because the
negative results are the useful part:

- writing `<home>/cordis.patch.yml` does nothing — the host reads
  `<home>/profiles/web/cordis.patch.yml`, which the World rewrites from `rows`
  immediately before the spawn. (The FS dev-live driver still writes the former
  path; verified by reading `a5sf-fs-devlive/driver/run-boot.mjs:639-654`, not by
  re-running that lane.)
- a `sandbox-policy` insert-override row must restate `name` (a config-only row
  replaces the plugin with a nameless row; the loader disables it, `sandboxPolicy`
  never rises, and bash/fs/permission stay pending — boot 6), and even with `name`
  it does not win against a session cwd (boot 7).

Consequence: in this lab a Member's `bash` child can write into the pinned host
tree, not into its World workspace. Nothing was written there in these runs
(porcelain empty before and after; the fixture's bash commands only `printf`), but
any future lane whose command writes must fix the session cwd first.

## 6. Instrument limits (disclosed, not worked around)

1. **`/proc` cannot witness a confined child.** The provider runs a launcher, so
   the child's argv is the launcher's; the bwrap sandbox also uses
   `--unshare-pid`. The independent witness for an admitted face call is
   therefore the **child-created marker file** (distinct path from the deny
   lane's), not a `/proc` sighting.
2. **`/proc` DOES witness the bash-tool child** because the bwrap argv carries the
   whole command. That is a sighting of a process carrying the marker, not proof
   that the marker's own process survived to run (the stdout tag is the stronger
   evidence there).
3. **Fixture-side counters are not independent.** `shell-exec`,
   `provider-call`, `confined-spawn`, `network-probe` and `base-spawn` are
   wrappers installed by the evidence row. Every verdict therefore also rests on
   at least one fact that does not come from them: stdout, the marker file's
   existence, the `/proc` sighting, or the refusal code returned to the caller.
4. **No real external network** was used (authority), so no on-the-wire claim of
   any kind is made.

## 7. Verdicts, and what is deliberately not proven

| proposition | verdict | strongest independent fact |
| --- | --- | --- |
| a Member's `bash` runs on the shipped `SandboxBashExecutor` via the base `subprocess`, not the confined face | PROVEN | bwrap argv with the command + 38 `/proc` sightings + 0 confined provider calls for that marker |
| the face admits the declared `/bin/bash -c <non-empty>` shape and a real child runs | PROVEN | the child-created marker file exists |
| the face refuses a bare PATH program with `SUBPROCESS_PROGRAM_NOT_ABSOLUTE` | PROVEN | typed code + 0 provider calls + 0 base-spawn with the body |
| the face refuses `-lc`, an empty body and an extra operand with `SUBPROCESS_SHELL_ARGV_UNSUPPORTED` | PROVEN | 3 typed refusals + 3 guard facts + 0 base-spawn with the bodies |
| `network: deny` refuses at admission with zero processes | PROVEN (as a refusal) | `NETWORK_UNCONFINED_REALM` + provider row `network-destination:'unsupported'` + 0 provider calls/spawns/sightings + marker absent |
| a `network: deny` lane does not govern the Member's model-visible `bash` | PROVEN | command ran, no refusal code, `SandboxBashExecutor`, bwrap argv with no `--unshare-net` |
| **Bash is network-isolated** | **NOT PROVEN — not claimed** | `osLevelNetworkIsolationClaimed: false`; §7 items 1/2/4 absent |

**Not proven, explicitly:** that the shipped bash path can or cannot reach the
network (no egress attempted); that `network: restricted` behaves like deny (not
tested); that a Member-writable binary named `bash` is refused (the face's identity
check exists, not exercised here); that the refusal record's fact asymmetry is
intentional (observed, not adjudicated).

## 8. Honest answers

- **Is a Member's shell network-isolated?** No. On this Host a Member's `bash` runs
  through the shipped `SandboxBashExecutor`, which the Member's face never sees and
  which requests no network namespace; the face's `network: deny` refuses its own
  calls before any process but does not reach that path.
- **What would change it?** Route the Member's shell through the confined face (a
  surface-neutral shadow of `bash`, the way `read`/`write`/`grep` are shadowed in
  the FS lane), and give the provider a network-destination capability row that
  proves enforcement (`netns`/seccomp with `enforced` + `evidence://`), then satisfy
  §7 items 1–4 with a transport observation.

## 9. What the next dev cycle needs

1. **Shadow `bash` inside the Member scope** (surface-neutral native module) and
   re-ask Q1/Q5: does the confined face admit `['/bin/bash','-c',body]` through the
   `shellClass` declared for the Member, and is the network deny then consulted?
2. **A network-destination capability probe that can say `enforced`** — without it
   the deny lane can only ever refuse, so §7 items 1, 2 and 4 stay out of reach.
3. **Fix the session cwd in the World fixture** so a Member's sandbox root is its
   World workspace, not the pinned host tree (and stop writing
   `<home>/cordis.patch.yml` in the FS driver, which is inert).
4. **Decide the refusal-record asymmetry**: shell-argv refusals write one
   `IO_READ_DENIED` fact; `NETWORK_UNCONFINED_REALM` and `SUBPROCESS_PROGRAM_NOT_ABSOLUTE`
   write none. If refusals are to be auditable, the fact should be emitted for all
   of them (or the asymmetry documented as intended).
5. **The egress experiment** the authority withheld here (needs a sandboxed
   listener, not the real network): same argv, deny lane vs allow lane, transport
   counters on both sides.

**Cost, honestly:** eleven Host starts (~35 s of runtime each, ~25 min wall clock
including diagnosis) plus one wasted pair of boots (6–7) on the sandbox-root pin.
Four of the eleven starts failed for four different reasons, and every one of them
produced a fact that changed the driver — the two that were purely my defects
(boot 1's discovery-turn selection; the `overall` computation) are corrected in
the ledger rather than hidden. No product code was modified; nothing was merged.
