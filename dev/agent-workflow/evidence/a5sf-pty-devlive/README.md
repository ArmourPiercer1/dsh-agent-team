# a5sf-pty-devlive — what a Member's shell actually is (DEV-LIVE)

**Record class: `DEV-LIVE`.** Every host start in this lane was made under the
owner ruling of 2026-11-09 (`docs/DEV-LIVE-OPERATOR-GUIDE.md`) with the grant at
[`dev-live-grant.json`](dev-live-grant.json). A `DEV-LIVE` record **can never
produce a `V@B=yes`** or any frozen-candidate claim; `run-record.mjs#finalize`
refuses that by construction, and every artefact in this tree carries
`osLevelNetworkIsolationClaimed: false`.

**Task.** Get a real, stable, live answer to *"what is a Member's shell today"*
on the pinned Host, and prove or disprove the **"no confined terminal face"**
claim on a real Host — not on a host-free contract test.

**Result in one paragraph.** A Member's `bash` tool is **not** the governed,
confined `subprocess` face. It is the product preset's inherited, legacy-generation
persistent shell: `@deepseek-ai/dsh-tool-bash-persistent` → the isolated
`@deepseek-ai/dsh-terminal` `TerminalSessionService` → the `shell`/node-pty backend
from `@deepseek-ai/dsh-terminal-bash` → a real `/dev/pts/N`. One Member's several
`bash` calls share **one** PTY and **one** live shell process (state survives),
while a second Member gets its own (`pty-2`). That shell has **no read axis at
all**: it read a file the confined write-only lane declares unreadable and
returned its bytes. The same read **is** refused on the confined `subprocess`
face, on the read axis, before any provider call. The disclosed `chmod` gap
**reproduces**. `network: deny` refuses at the confined face's capability probe,
before any process. So the claim to test is **confirmed**: there is no confined
terminal face today, and a Member's shell is outside the governed realm's reach.

| # | Case (question) | Verdict (stable pair) | One-line answer | Attribution layer (LOCUS) |
|---|---|---|---|---|
| 1 | `member-terminal-face` — what terminal does a Member get? | **PASS** | a real PTY (`/dev/pts/0`, `tty_nr` major 136), served by the preset's `TerminalSessionService` (`backends: ['shell']`, one session `pty-1`) | **product preset** (inherited legacy PTY), not a realm face |
| 2 | `same-pty-multi-command` — do commands share one PTY? | **PASS** | yes: one Member, two commands, one shell (`export`/`cd` state survives); a second Member gets `pty-2` and sees `UNSET` | product preset (one live shell process) |
| 3a | `product-shell-read-unlanned` — read axis on the product path? | **PASS** (proposition = the product shell returns the bytes) | **no read axis**: the Member's own `bash` read the write-only secret and returned it, exit 0 | product preset — the realm is never consulted |
| 3b | `write-only-read-denied` — read refusal on the confined face | **PASS** | refused on the **read** axis: guard fact `IO_READ_DENIED` (method `spawn`, decision `deny`), **0** provider calls, **0** bytes | a5sf admission (confined `subprocess` face), pre-provider |
| 4 | `chmod-gap` — the disclosed gap | **PASS** (gap **reproduced**) | `chmod 600` on an in-read/out-write file changed the mode `644 → 600` with **no** `chmod` declaration | **neither** admission (nothing declared) **nor** kernel (Landlock has no chmod right) |
| 5 | `network-deny-refusal` — where does `network: deny` refuse? | **PASS** | typed `NETWORK_UNCONFINED_REALM`, **0** processes, the body never ran, **0** guard facts | confined face's `probeNetworkDenial`, which throws **before** the guard |

Stable pair: [`runs/run-08`](runs/run-08) and [`runs/run-09`](runs/run-09) —
six identical verdicts and identical facts, no code change between them. The
seven earlier starts and what each one taught are in [`RUNS.md`](RUNS.md); four of
them were **instrument** defects, one of which (run 05/06) was a **false pass**
this lane catches on itself.

---

## 1. What a Member's terminal is today

**Observation (the Member's own model turn, mock-issued `bash` call).** The
Member's model-facing surface contains `bash` (24 names, see
[`surface.json`](runs/run-08/surface.json)); the call was served and the shell
printed, from **inside itself**:

```
A5SF_PTY_PID=2
A5SF_PTY_PS= 2 0 ? 1
A5SF_PTY_FD0=/dev/pts/0
A5SF_PTY_TTYCMD=/dev/console
A5SF_PTY_PPID=1
A5SF_PTY_SESS=0
A5SF_PTY_TTYNR=34816          # major 136 = the Linux pts major, minor 0
A5SF_PTY_START_CWD=/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use
```

**The service, asked directly** (`pty_observe`, mounted *inside* the same preset
group as the `bash` tool, so it reads the same isolated `terminals` instance):

```json
{"backends": ["shell"],
 "sessions": [{"sessionId": "pty-1", "type": "shell", "pid": 141, "status": {"kind": "running"}}],
 "owner": {"id": "session-team-child-…", "cwd": "…/tests/deepseek-harness-test-use"}}
```

**Attribution chain (why this is the service, not an inference).**

1. The composed profile for this World declares exactly one `bash` tool:
   `@deepseek-ai/dsh-tool-bash-persistent`, inside the preset group that also
   mounts `@deepseek-ai/dsh-terminal` and `@deepseek-ai/dsh-terminal-bash`
   ([`composed-profile.patch.yml`](runs/run-08/composed-profile.patch.yml)).
2. That tool's **only** PTY seam is `inject: ['tools','terminals']`
   (`tests/deepseek-harness-test-use/packages/shell/tool-bash-persistent/lib/index.js:353`),
   so it cannot run a command without a `terminals` service.
3. The service itself answered: registered backend types `["shell"]` (the type
   `dsh-terminal-bash` registers) and **one** owner-scoped session (`pty-1`,
   `type: "shell"`, `pid: 141`, `running`).
4. The kernel agrees from the process side: `tty_nr` major 136 (pts) and
   `/proc/$$/fd/0` → `/dev/pts/0`, with the device numbers matching
   (`34816` = 136:0).
5. The confined `subprocess` provider recorded **zero** `confined-spawn-attempt`
   rows for that command, so the shell did not come from the confined face
   ([`counter-rows.json`](runs/run-08/counter-rows.json)).

**LOCUS.** The request path is
`tool route → agent tools → dsh-tool-bash-persistent → ctx.terminals → TerminalSessionService → dsh-terminal-bash → node-pty → /dev/pts/N`.
The **governed realm is not on that path**.

**Match/mismatch with the host-free expectation.** Match. The expectation was
that no governed realm installs a terminal face and the Member inherits the
host's `tool-bash-persistent` over `dsh-terminal`; that is exactly what the live
run shows. One thing the host-free picture did **not** predict, recorded rather
than smoothed: the shell's **starting cwd is the Host checkout**
(`tests/deepseek-harness-test-use`), not the World workspace
(`owner.session.header.cwd`), and it is readable/writable by that shell outside
any a5sf lane (see §7.3).

**What would prove it harder.** A run in which the preset's
`@deepseek-ai/dsh-terminal` row is *absent* from the composed profile: the `bash`
call should then fail to spawn (`OWNER_NOT_LIVE` / no backend) instead of
succeeding. That is a deliberate negative arm for a later cycle — it would cost a
start and change the product under test, so it is not in this lane.

**Limits.** This is an attribution of **which service served the call on this
composition**; it is not a claim that the pinned PTY service is safe, confined or
isolated. `pid: 141` is the PTY child as the Host process sees it; `$$`=2 is the
same process's view from inside its PID namespace — the per-run
`outerProc` block records that boundary explicitly and is **never** gated on.

---

## 2. Same PTY across commands

Two sequential `bash` calls **in one Member turn**, with three distinct commands
so that the second call cannot create what it observes:

| command | what it does | what it printed |
|---|---|---|
| call 1 — `setup` | records start cwd, `export A5SF_PTY_SHARED=<token>`, `cd <lane/inside>`, identity block | `CWD=…/lane/inside`, `SHARED_SEEN=<token>` |
| call 2 — `read` | identity block + `pwd` + `${A5SF_PTY_SHARED:-UNSET}`; **no export, no cd** | `CWD=…/lane/inside`, `SHARED_SEEN=<token>` |
| control — `read` (a **second Member**) | the read command verbatim | `CWD=…/tests/deepseek-harness-test-use`, `SHARED_SEEN=UNSET`, `TTYNR=34817` |

The service side: the measured Member holds one session `pty-1`; the control
holds `pty-2` (`pid` 243 vs 141). **LOCUS:** one live persistent shell process in
the product preset.

**What the host-free picture did not predict, and what it cost.** The obvious
"same pid" and "same tty" checks are **worthless** here: every Member's shell
lives in its own PID namespace and every one of them reports `$$`=2,
`/dev/pts/0`, `session=0`. Runs 01–07 measured exactly that, and it produced
first a wrong FAIL, then — worse — a **false PASS** (run 05/06) when the second
command was derived from the first by renaming and therefore re-exported and
re-`cd`'ed the state it was supposed to observe. The state commands above are the
fix; the control arm is what makes the observation falsifiable.

**Limits.** This says several commands reach **one** PTY/one shell process. It
says nothing about process isolation between that shell and anything else.

---

## 3. The read axis: present on the confined face, absent on the product path

This is the question the task calls the "write-only read denial live", and the
honest answer has **two** halves with **two different LOCI**.

### 3a. On the product path — no read axis at all (**PASS as a finding**)

The Member's own `bash` call #3 ran `echo start; cat <write-only>/secret-product.txt; echo status=$?`
and printed the secret's bytes, exit status `0`
([`item3-product-shell-read.json`](runs/run-08/item3-product-shell-read.json)).
No a5sf guard fact names that locator: the confined write-only lane was **never
consulted**, because the shell is not on the confined path (§1).

The bundle tables this case as `axis: read, expected: deny` — that is the
**lane's** declared expectation. The judged proposition (recorded in the bundle
as `judgeProposition`, and in the artefact as `verdictMeaning`) is *"the Member's
own bash reads it and returns its bytes"*; a `PASS` therefore means **the lane's
deny was not delivered on the product path**. That sentence is the finding, not
a pass of confinement.

### 3b. On the confined `subprocess` face — refused on the read axis (**PASS**)

`bash_probe` (a test-composition caller that only calls the shipped confined
face) asked to read the **same class** of locator from the write-only root:

```json
{"answer": "YES on the confined subprocess face", "axis": "read",
 "fact": {"name": "IO_READ_DENIED", "method": "spawn", "decision": "deny",
          "locator": "…/lane/write-only/secret-face.txt", "decidedBy": "IO_READ_DENIED"},
 "refusalReasonCodes": {"guardFact": "IO_READ_DENIED", "probeRow": "IO_READ_DENIED"},
 "probe": {"confinedSpawnRows": [], "realmProbeRows": 1, "presetProbeRows": 0}}
```

- fact: `IO_READ_DENIED`, method `spawn`, decision `deny`, locator = the write-only file
  ([`guard-facts.json`](runs/run-08/guard-facts.json));
- **0** provider calls (`confined-spawn-attempt` count = 0), **0** bytes returned;
- the probe ledger row is on the **realm** mount, not the preset mount — the
  call really reached the confined face
  ([`probe-ledgers.json`](runs/run-08/probe-ledgers.json)).

**Supplementary arm** (`item4b`, *not* a case, tabled nowhere): the same body with
an **in-lane** read declared — the admission **admits**, a child runs, and the
**OS profile** refuses the out-of-lane `cat` (no bytes, non-zero child exit).
That separates the two layers: the admission decides on declarations, the kernel
enforces the profile.

**LOCUS summary.** Product path: no axis (product preset). Confined face: the
shipped admission on the **read** axis, before any provider call; the kernel only
matters for an *admitted* call whose child reaches outside the lane.

**Limits.** An admission refusal is a statement about our own admission code, not
about OS confinement. The kernel arm is an OS-profile observation about a
declared in-lane read; it is not a general file-permission claim about the Member's
shell (which has none).

---

## 4. The `chmod` gap reproduces

`bash_probe` ran `chmod 600 <lane/inside>/mode.txt; stat -c '%a' …` with **no**
`chmod` declaration at all. Mode **644 → 600**. The file is inside the **read**
lane and outside the **write** lane, so a declared write would have been refused;
the point is that the mode change was never declared and never needed to be.

**LOCUS:** *neither* layer. The admission never saw it (no declaration ⇒ nothing
to consult, no guard fact — `facts` for this spawn = 0) and the OS profile has no
`chmod` right (Landlock has no such permission bit). Confirmed on two independent
starts (03, 04) and again on the stable pair (08, 09); the `644 → 600` result is
identical each time.

**Verdict semantics.** `PASS` here means **the disclosure was reproduced**. A
refusal would have been the *better* product outcome and would have judged
`GAP_REFUTED`; the artefact states which one happened
([`item5-chmod-gap.json`](runs/run-08/item5-chmod-gap.json) `finding`).

**Limits.** A `chmod` on a file whose read/write axis is enforced still changes
the mode. This is the disclosed gap; it is not a new finding, and it is **not**
evidence of a wider escape — creating/renaming/deleting the same file *is*
refused (`IO_WRITE_DENIED`, host-free contract arms).

---

## 5. Where `network: deny` refuses

A third Member template (`nether`) declares `network.access: deny`; the
`bash_probe` call with an in-lane read was refused:

```
NETWORK_UNCONFINED_REALM: the effective lane requests network=deny, but the
confined provider's capability probe reports network-destination='unsupported'
…refusing before any process instead of running a network-capable child under a
deny claim this host cannot enforce.
```

Observed: typed code `NETWORK_UNCONFINED_REALM`, **0** `confined-spawn` rows,
the body's marker never appeared, and — a **LOCUS** fact, not a defect — **0**
guard-consult facts. The refusal is thrown by the shipped confined face itself
(`packages/runtime/team-services/src/subprocess.js`, the `probeNetworkDenial`
branch) **before** it ever calls the guard, so the guard sink is legitimately
empty on this path. Runs 01–03 read that empty sink as "no refusal" and judged
FAIL; the judge was wrong, not the product.

**No OS-level claim is made.** Verbatim, from
`dev/agent-workflow/evidence/a5sf-subprocess-face/README.md` §7:

> Refusing to spawn is **not** evidence of network isolation: it is a statement about our own admission code, made before the OS was asked.

The artefact carries that sentence (`limitQuotedVerbatim`) and
`claimsConfinement: false`.

**Limits.** This says `network: deny` **fails closed at admission**. It says
nothing about what a process that *was* admitted can do with the network — which
is why no `enforced` claim is made anywhere in this tree.

---

## 6. Can a Member be said to have a "confined shell" today?

**No.** The deciding evidence, in the order it should be read:

1. `RealmServiceFaces` has exactly two faces — `{ fs: 'confined', subprocess: ConfinedSubprocessSurface | null }`
   (`packages/runtime/team-services/src/types.ts:141-146`). There is **no
   `terminals` face** for a realm to install. The claim "no confined terminal
   face" is therefore a product-interface fact, and this lane confirms its live
   consequence rather than assuming it.
2. The Member's `bash` call was served by the **preset's** `TerminalSessionService`
   (`backends: ['shell']`, session `pty-1`) with **0** confined spawns and **0**
   guard facts — the governed realm never saw the command (§1).
3. The same shell read a file the confined write-only lane declares unreadable
   and returned its bytes (§3a). A confined shell cannot do that.
4. The confined `subprocess` face, when asked the same question, refuses on the
   read axis with `IO_READ_DENIED` (§3b) — so the confinement machinery exists and
   works; it is simply **not on the terminal path**.

What a Member's shell **is**: the product preset's inherited, legacy-generation
persistent PTY. Not confined, not realm-governed, and — on this composition —
starting in the Host checkout directory.

---

## 7. Other observations (recorded, not scored)

1. **The shell starts in the Host checkout.**
   `owner.session.header.cwd = …/tests/deepseek-harness-test-use` and the first
   `pwd` confirms it. The Member's persistent shell therefore begins outside the
   World workspace. Nothing in this lane calls that a violation (the preset is
   the product's own and its session cwd is the Host's), but any future claim
   about "the Member's workspace" must not assume the shell starts in it.
2. **PID/session numbers are namespace-local.** `$$`=2, `ps -o tty=` → `?`,
   `/proc/$$/stat` session → `0`, while `tty_nr`=34816 (136:0) and
   `/dev/pts/0` agree. This is the platform sandbox's PID namespace, not a
   product defect — but it is why three of this lane's judges were wrong before
   they were right.
3. **`tty` resolves `/dev/console`** inside that namespace while `fd0` is
   `/dev/pts/0`. Recorded as-is (`channel.ttyCmd`); not gated on.
4. **The probe tool is mounted twice on purpose** — on the Member preset *and*
   in `a5sfNativeToolModules` — because route C refuses an attach that would
   **add** a model-visible name (`a5sf-realm-provider-row.mjs`). The two mounts
   write **different ledgers**, which is how the LOCUS of every `bash_probe`
   call is proved rather than assumed.

---

## 8. The instruments, and how to run this lane

| file | role |
|---|---|
| [`run-boot.mjs`](run-boot.mjs) | the driver: `--plan` (host-free) and `--evidence <dir>` (one start). Discovery-first leader blueprint + **polling** health gate (both inherited from the web lane), five tabled cases + one declared-untabled case, per-run artefacts, ledger rows, teardown receipts. |
| [`a5sf-pty-realm-provider-row.mjs`](a5sf-pty-realm-provider-row.mjs) | composes one Member's confined realm: the effective lane (ceiling ∩ restriction), the confined `subprocess` face with a spawn counter, the `realm-member` record (`faces`, `hasTerminalsFace`). |
| [`a5sf-pty-bash-probe-tool.mjs`](a5sf-pty-bash-probe-tool.mjs) | `bash_probe` — a caller, not a judge: it calls the shipped confined face with an explicit declaration and records what happened. |
| [`a5sf-pty-session-observer.mjs`](a5sf-pty-session-observer.mjs) | `pty_observe` — Q1's LOCUS witness, mounted **inside** the shell group so it reads the same isolated `terminals` instance. |
| [`preflight-bundle.json`](preflight-bundle.json), [`preflight.log`](preflight.log) | the zero-boot preflight plan and its `PASS 18/18` transcript. |

```bash
# host-free (zero starts): rewrites the bundle and grades it
node dev/agent-workflow/evidence/a5sf-pty-devlive/run-boot.mjs --plan

# one start, one evidence directory (a re-run REFUSES a stale bundle)
node dev/agent-workflow/evidence/a5sf-pty-devlive/run-boot.mjs \
  --evidence dev/agent-workflow/evidence/a5sf-pty-devlive/runs/run-NN
```

The driver refuses to spawn unless: the bundle is bound to the current `HEAD`,
the shared preflight re-run reports `PASS`, the authority pointer has not moved,
the row composition is intact, and a dev-live machine slot is actually **held**
(`DEV_LIVE_SLOT_LIMIT = 2`; asserted right after `lease.boot()`).

### The one case outside the preflight table

`network-deny-refusal` is declared in `driver.untabledCases` with a
machine-readable reason: the shared schema grades a network refusal only through
the `admission-refusal` class, and that class then **requires** a declared legacy
Member whose preset surfaces `web_fetch`+`web_search` through the pinned web
module. A Shell/PTY network refusal has a `subprocess` caller and no web preset;
tabling it would have meant declaring a caller this boot does not have. It is
judged by the driver with the same strictness and carried into
`run-record.json#selectedCases`, so it cannot be silently omitted (BL-17's
`BUNDLE_CASE_UNDECLARED` lesson).

---

## 9. What the next dev cycle needs

1. **A confined terminal face, or an explicit decision not to build one.** The
   blocker is structural: `RealmServiceFaces` has no `terminals`, so route C can
   never mount `dsh-terminal` on a realm (its own attach rules would refuse the
   ADDED name). A future cycle must either add the face to the product interface
   (`RealmServiceFaces.terminals` + an install path) or state that Members keep
   the legacy PTY. Until then, "Member shell confinement" has no mechanism.
2. **One PTY stack, one owner.** If a realm terminal lands, the preset's
   `persistent-shell` group must stop mounting `dsh-terminal` for Members, or the
   Member will hold two terminals (one governed, one not) and Q1's answer will
   fork.
3. **`chmod` needs a decision, not a test.** The gap is in the OS profile
   (Landlock has no chmod right) and in the admission (nothing to declare). A
   product answer could be "declare chmod and refuse it", or a seccomp/LSM
   complement; until one exists, do not claim "the mode is part of the lane".
4. **Network: keep the current fail-closed posture and never phrase it as
   isolation.** If a backend ever reports `enforced`, this lane's judge will see
   a spawn instead of `NETWORK_UNCONFINED_REALM`, and the artefact will say so.
5. **Instruments worth keeping.** `pty_observe` (a service-side witness) and the
   two-ledger probe mount are directly reusable for any future face; they turned
   Q1 from an inference into an answer.

---

## 10. Loop cost, honestly

Nine starts, two of them (run-08, run-09) carrying the stable verdicts, and the
loop did **not** converge cheaply: **five** starts burned on instrument defects,
one of which was a **false pass** (run 05/06) that only a raw-evidence read
caught. Every one of those defects is a real trap for the next face (namespace
blindness, marker prefixes, self-satisfying scripts, divergent parsers, product
codes read from the wrong field). The per-start cause → fix → result table is in
[`RUNS.md`](RUNS.md); the three-consecutive-same-cause escalation rule was never
triggered because no two consecutive failures shared a cause.
