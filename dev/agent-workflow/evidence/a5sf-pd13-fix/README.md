# a5sf-pd13-fix — the confined terminal face and its read axis (DEV-LIVE)

**Draft PR: [#642](https://github.com/ArmourPiercer1/dsh-agent-team/pull/642)** (branch
`task/a5sf-pd13-terminal-20261111`, first line `PD13-FIX`). No merge, no settle.

**Record class: `DEV-LIVE`.** Development evidence. This lane does not move V@B, does not become a
candidate claim, and does not certify a matrix row. Every Host start in `driver/run-ledger.jsonl`
carries `recordClass: "DEV-LIVE"`.

This directory closes **PD-13** (`READ-AXIS`) in
[`PRODUCT-DEBT-REGISTER.md`](../../../../docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md):
*the terminal path has no read axis — a Member's own shell read a write-only-lane secret and returned
its bytes.* The defect was measured in [`a5sf-pty-devlive`](../a5sf-pty-devlive/README.md) §3a/§3b.
PD-12 (`a5sf-pd12-fix`) routed the Member's `bash` into the confined **subprocess** face for the
network axis; its own residual said that did not give a shell body's reads an attribution. This lane
builds the face that does.

## 1. What changed

| # | mechanism | where |
| --- | --- | --- |
| 1 | `RealmServiceFaces.terminals` — a TOTAL answer (`ConfinedTerminalSurface \| null`) | `team-services/src/types.ts` |
| 2 | `installMemberIoProviders` installs a **confined terminal face** on the Member's isolated scope, with three install-time refusals | `team-services/src/install.ts` |
| 3 | the **confined terminal face** itself: session API + lexical read attribution + guard admission | `team-services/src/terminal.ts` (new) |
| 4 | the mount seam admits a `terminals`-consuming module **iff** `faces.terminals !== null` (else the unchanged `TERMINALS_LEGACY_PTY_REFUSED`) | `team-services/src/mount.ts` |
| 5 | the model-visible `bash` is shadowed onto the face (route C), surface-neutral | `runtime/src/plugin/live/confined-terminal-tool.mjs` (new), `a5sf-realm-row.mjs` |
| 6 | the double-terminal fork is **refused** | `install.ts` (`TERMINALS_DOUBLE_TERMINAL_REFUSED`) |

No upstream source was touched (`CORE PATCH BUDGET = 0`): the face is our package's module mounted
through the existing isolate/plugin seam.

## 2. The pin and its flip

`tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs` arm **P0** is the defect pin: it asserts
**today's pre-fix behaviour**, so it is green before the change and must go RED after.

| tree | P0 | the other 12 arms | log |
| --- | --- | --- | --- |
| pre-fix (`origin/master` `550815c97`) | **PASS** | D1/D2/A1/C2/C3/C4/C5 **FAIL** (they assert the fix) | [`pin-before.log`](pin-before.log) |
| fixed tree | **FAIL** | 12/12 PASS | [`pin-after.log`](pin-after.log) |

`A5SF_PD13_PIN=1` enables the pin; the default suite run skips it (a pin is a one-way marker, not a
regression guard).

## 3. The face's design

**Sessions are command-scoped, not a PTY.** A PTY cannot ride the confined execution profile
(`subprocess.ts#spawnTerminal` refuses one), so the face answers the pinned `terminals` shape
(`spawn`/`startSend`/`read`/`signal`/`kill`/`list`) while each command runs as a **fresh confined
child** of the confined `subprocess` face mounted on the same isolated scope.

**The read axis is lexical attribution, before the spawn.** For every command body, the face
tokenises the text (quotes and escapes honoured; unquoted control operators end a token), skips
flags/assignments/patterns, skips redirection **targets** (a `>` target is a write, not a read), and
treats a token as a declared read when it is absolute or already exists relative to the session cwd.
Each declared read is consulted against the **same observed Member guard** the confined `fs` face
uses, under method **`shellRead`** (the READ lane).

A denied read therefore produces:

* **exactly one** guard-consult fact (`method: "shellRead"`, `decision: "deny"`,
  `decidedBy: "IO_READ_DENIED"`, `realm: "member"`, the real `memberIdentity`, `locator` = resolved path);
* **zero bytes** — the command never runs, so the confined provider is called **0** times;
* a **typed** `IO_READ_DENIED` error on the send's `done` (the tool surfaces the code, not an empty
  success).

**Attribution to the Member**: the guard is built from the realm's compiled `EffectiveIo` (the same
intersection the subprocess face uses) and wrapped with the realm's observer, so every fact carries
the Member instance identity and the policy revision — not a global or a guess.

**What the face is NOT** (stated, not hidden):

* it is **not** an OS-level PTY-isolation claim. The admitted command runs under the confined
  subprocess face's Landlock profile; the kernel is the boundary for what the admission did not name.
* a **dynamic** read (`$(…)`, backticks, a path assembled from `$VAR`) is not lexically attributable
  and is **not** refused at admission. Arm **C6** pins this weakness; the OS profile is its boundary.
* there is **no persistent shell state**: `cd`/`export` do not survive a command, there is no
  interactive stdin. That is the capability cost of a governed shell on this host, disclosed.
* redirection targets are **writes**; the read axis is the only axis the face adds. The write axis
  remains the confined process face's declared `shell.writes`.

## 4. The shadow is surface-neutral

`confinedTerminalSpecOf` appends the module only when (a) the agent can already see `bash`,
(b) `faces.terminals !== null`, (c) no configured module already owns `bash`. It **supersedes** PD-12's
subprocess shadow (one name, one serving face, and the terminal face is the stronger one). Arm **S1**
asserts exactly one `bash` and the same name set before/after; **A1** asserts the result says
`kind: "confined-terminal"`; **D2** asserts the model resolves the confined terminal definition
(`faces.terminals !== null` and a description naming the confined terminal).

## 5. The double-terminal problem — resolution: REFUSE the fork

A preset that mounts `persistent-shell` / `dsh-terminal` leaves an ungoverned `terminals` service on
an ancestor scope. `installMemberIoProviders` refuses the install with
**`TERMINALS_DOUBLE_TERMINAL_REFUSED`** when a terminal face is declared and `root.get('terminals')`
already resolves — 0 legacy allocations. It also refuses (`TERMINALS_UNCONFINED_REALM`) a terminal
face with **no confined subprocess face** or whose program the declared **shell class** does not admit.

**Disclosure.** The chosen resolution is "no Member holds two shells", and its cost is that a
composition keeping `persistent-shell` **and** declaring a terminal face gets **no** Member shell at
all (fail closed). No shipped composition declares a terminal face today, so nothing shipped changes;
the composition that wants a governed shell must drop the legacy row. This is arm **C4** (and C3/C5
for the other two refusals).

## 6. Mutation controls

[`mutation-controls.mjs`](mutation-controls.mjs) edits the REAL sources and requires the protected arms
to go RED while the rest stay GREEN. Verdicts in [`mutation-controls.json`](mutation-controls.json).

| control | mutation | observed RED | observed GREEN |
| --- | --- | --- | --- |
| **MA** read axis removed | the face enumerates no reads, so `shellRead` is never consulted | **D1, A1** | D2, A2, A3, S1, C1–C6 |
| **MB** shadow removed | neither the terminal nor the PD-12 module is appended (the pre-fix composition) | **D1, D2, A1, A2, A3, C2, C6** | S1, C1, C3, C4, C5 |

MA is the discriminating control: the lane denial is untouched, and only the arms that require the
*read axis* flip. MB's wider RED set is the honest signature of removing the wiring every
confined-route arm measures.

## 7. Live (DEV-LIVE)

Driver: [`driver/`](driver) — derived from the accepted PD-12 subprocess dev-live procedure. The
evidence provider row is `driver/a5sf-pd13-realm-row.mjs`; it declares, for the Member realm,
`terminal: { program: "/bin/bash" }` beside the confined subprocess face. The preset is the shipped
`tool-bash` + `tool-fs` shape; the Member's `bash` is served by the confined terminal face through
route C. The world label is `u5a5sfsub1` (the **same face's** DEV-LIVE authorisation,
`devlive-subprocess-1` — uncapped, recorded per start); homes live under `tests/homes/`.

**Two consecutive agreeing starts** are the stable pair: `runs/boot05` and `runs/boot06`, both
`overall: PASS`, all six cases PASS, same facts, no code change between them
(`run-record.json` in each is bound to `teamSha 550815c97…` / `hostSha 639ed01539…`). Starts before
them are the development iterations of this driver; `driver/run-ledger.jsonl` carries every row with
`recordClass: "DEV-LIVE"`.

| fact | boot05 | boot06 |
| --- | --- | --- |
| `pd13:shell-read-denied` | **PROVEN** — typed `IO_READ_DENIED`, **0 bytes**, **1** `shellRead` deny fact, **0** confined provider calls | identical |
| `pd13:shell-read-admitted` | **PROVEN** — `kind: "confined-terminal"`, exit 0, lane bytes, **1** provider call, **1** spawn, **1** ALLOW fact | identical |
| child terminal (measured by the child's own `tty`) | `not a tty` → **no controlling terminal, not a PTY** | identical |
| child state (child's own `ps`) | `S` (sleeping, not `Z`) | identical |
| child pid / `ps` row | 161 — `161 0 ? S` | 166 — `166 0 ? S` |

**`LOCUS` (the attribution layer of the refusal)** — from `runs/boot05/read-axis.json`:

```json
{ "schema": "a5sf-guard-consult/1", "realm": "member",
  "memberIdentity": "inst-0u3ell71ucz7", "toolBindingIdentity": null,
  "policyRevision": "a5sf-sub:inst-0u3ell71ucz7:g1",
  "method": "shellRead",
  "locator": "…/tests/homes/u5u5a5sfsub1-…/ceiling-outside/secret.txt",
  "decision": "deny", "decidedBy": "IO_READ_DENIED", "sequence": 1 }
```

The allow control records the same shape with `decision: "allow"`, `decidedBy: "ALLOW"`,
`locator: …/workspace/lane/pd13-in-lane.txt`, `sequence: 2` — so a right verdict with the wrong
attribution could not pass: the fact names **which realm, which Member instance, which policy
revision and which method** decided.

**One measured asymmetry, kept as evidence:** the first attempt to read the child's own
`/proc/self/stat` from inside the command was **refused by the read axis**
(`method: "shellRead"`, `locator: "/proc/self/stat"`, `IO_READ_DENIED`) — the face attributing a read
outside the lane even for a path the command did not intend as a data read. The command now reports
its facts with `tty`/`ps`, which name no path in the body. That refusal is the read axis working, and
it is recorded rather than papered over.

## 8. Residuals

1. **Dynamic reads are not attributed** (`$(…)`, backticks, `$VAR` paths) — arm C6; the OS profile
   is their boundary.
2. **No persistent shell state** (`cd`/`export`, interactive stdin) — each command is a fresh
   confined child; capability deliberately given up.
3. **Write axis is not per-target** — a redirection target is not a read intent; writes are governed
   by the confined process face's declared `shell.writes`.
4. **No shipped composition declares a terminal face** — the product's Member shell is still the
   preset's until an owner declares `terminal` for Members. The refusals above are the fail-closed
   answer meanwhile. (Matrix rows M-08/M-13 stay `NOT_WIRED` for this reason, not for a missing face.)
5. **Ancestor-scope modules still resolve the inherited service** — `faces` gates route-C mounts; a
   `terminals` consumer mounted on an ancestor scope is outside this fix's reach.
6. **The persistent-shell preset row is not automatically removed** — the fix refuses the fork; the
   composition must drop the row (see §5).

## 9. Gates

| gate | result |
| --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **482 tests, 480 pass, 0 fail, 2 skipped** (the P0 pins) — [`a5sf-family.log`](a5sf-family.log) |
| `packages/runtime/test/a4-*` + terminal/confined package tests | 12 files / 218 tests PASS |
| `pnpm -r typecheck` | PASS |
| `npx eslint` on new files | PASS (no Node globals assumed; `setTimeout`/`cwd` imported) |
| `node scripts/check-artifacts-committed.mjs` | PASS after the dist rebuild + new placement |
| `node scripts/doc-checks.mjs` | PASS |
| register test `a5sf-debt-register.test.mjs` | PASS |
| `ci-pr-gate --only state-freshness` | PASS |
| `ci-pr-gate --only census` | **FAIL, pre-existing / environmental** — a tree with **no PD-13 change** (`a5sf-pd12` worktree, master + PD-12) fails the same leg with the same capture population (668f/8824l vs the baseline document's 626/7936). Control: [`census-master-pd12.log`](census-master-pd12.log). The p4t6 scan itself is GREEN after booking the measured delta 1435 → 1437. |
| p4t6 booking | `packages/testkit/test/p4t6-bookings/a5sfpd13.json`, measured 1435 → 1437 |

## 10. The honest answer to "can a Member now be said to have a confined shell?"

**On the route-C path, yes — when the composition declares a terminal face.** Exactly: the realm's
compiled input carries `terminal` → `installMemberIoProviders` mounts the confined `terminals` face on
the Member's isolated scope (refusing a double terminal) → the route-C attach appends the
confined-terminal `bash` module → the model-visible `bash` is that face → each command's lexically
declared reads are admitted against the compiled read lane, and a denied read returns no bytes with a
typed `IO_READ_DENIED`.

**In the shipped product today, no** — no shipped composition declares the face yet (residual 4), so
the product's Member shell is still the preset's. That is a wiring/owner decision, not a missing
mechanism; and the accounting above is deliberately split so the two claims cannot be confused.
