# 06 — The Team public-capability contract (what the two replaced entries were actually for)

> `agent-bindings.mjs` (7,138 lines) and `root.ts` (5,243 lines) are **replaced**, not
> deleted-and-forgotten. That is only safe if somebody enumerates what those 12,381 lines were
> *doing for the product*, and marks each item **preserved / tested / dropped / deferred**.
> This chapter is that enumeration. A build that compiles is not evidence that a capability
> survived.

## Why a capability list and not a file list

The two entries are assembly: they name rows, wire services, and hold the top-level
lifecycle. Their *files* tell you nothing about the product. Their *capabilities* do — and the
failure mode after a wholesale replacement is not a compile error, it is a capability that
quietly stops being wired while every test that remains stays green.

## Phase split (owner ruling): final capability vs when it returns

| rows | disposition | returns |
| --- | --- | --- |
| C1–C5, C8 | preserve | **A1** — C8 (Stop) must work in the first executable version |
| C6, C7 | preserve, may be unavailable in A1 | C/D, with the explicit-disable rule below |
| C9 | preserve | when the new entry returns |
| C10 | preserve | C, never on by default while unmanaged |
| C11 | preserve (native services) | verified in C/D |
| C12, C13 | preserve / replace — the centre itself | A1/B |
| C14 | **drop implementations** (C14b preserved) | A0 frozen |
| C15, C16 | preserve, re-homed | C |
| C17, C18 | **drop** | A0 frozen (C18 deleted in A1) |

## The list (A1 must dispose of every row)

| # | capability | where it lives today | disposition | evidence it survived |
| --- | --- | --- | --- | --- |
| C1 | the **15** `team_*` tools (member/template/delegation/control board) | **`packages/tools/src/tools.ts` — a KEPT module** (verified: 15 distinct names declared there, e.g. `team_list_members`, `team_create_member`, `team_delegate`, `team_request_control`) | **preserve** — not the retired plane; the earlier draft credited the plane, which was wrong | `team_*` board suite |
| C2 | member create / resume / archive | `root.ts`, `agent-bindings.mjs` | **preserve** | lifecycle suite |
| C3 | work delegation + delivery receipts | `agent-bindings.mjs` (`send_message`/work delivery legs) | **preserve** | delivery suite |
| C4 | Blueprint binding + identity generation | `bound-blueprint.ts`, `alpha6/authority-generation.ts` | **preserve** (KEEP module) | identity suite |
| C5 | Control: ask / grant / deny / consume | `packages/runtime/control` | **preserve** (KEEP module), fed by the three contracts | `ute2-settlement` + new contract arms |
| C6 | Officer assignment + ReviewCapability routing | `packages/runtime/alpha6/*` | **preserve** (KEEP module) | alpha6 suite |
| C7 | durable Wake intents + cold wake | `alpha6/wake-*` | **preserve** | cold-wake kit |
| C8 | Stop (sticky, durable, non-replaying) | `control` + settlement | **preserve** | stop-fence + SIGKILL arms |
| C9 | remote entry (`s6-remote`, remote control surface) | `s6-remote.ts`, `remote/**` | **preserve** | remote suite |
| C10 | MCP catalog + initial grant + live loss | `agent-bindings.mjs` MCP legs | **preserve** | MCP suites |
| C11 | state projections (`sessionProjections`) | `projection/**` + `todo`/`goal` faces | **preserve** | projection suite |
| C12 | tool admission (guard, builtin deny, selector) | `packages/tools/src` | **preserve** (KEEP module) | guard suites |
| C13 | confined I/O faces (fs/web/subprocess/terminals/userQuestions) | the five shadows + family bodies | **replace** with provider lanes | probe ladder rungs 1–6 |
| C14 | **old governed-family execution implementations**: each family's own tool body, its duplicated policy computation, and the historical per-family semantic-equivalence requirement (the old `pwsh` parity demand, the old web redirect-ownership hop logic) | the eight family bodies | **dropped** — the host rows own execution now, and the equivalence criterion is retired with the bodies; the differences that mattered were defects of the deleted body (`SD-SEARCH-1`) | census §2 |
| C14b | **the safety invariants those families enforced**: path read/write upper bounds, network allow/deny, Control authority, Stop | the centre (provider lanes + admission + settlement) | **preserved** — never implied by C14's drop; see the note below | probe ladder rungs 1–6 + P1–P5 |
| C15 | `team_skill` | `inspect-family` | **preserve, re-homed** — Team skill provider into a host-shaped row | new row test |
| C16 | `subagent_fork` | `agent-control-family` | **preserve, re-homed** — row over `subagent-fork-in-process` | new row test |
| C17 | **Team's own `exit_plan_mode` tool** — not DSH plan mode, and not the goal tools | `agent-state-family` | **dropped by owner ruling** — the host has only a `claude-code-mods` name mapping, and re-creating a plan-mode state machine is out of scope. `get_goal`/`create_goal`/`update_goal` are untouched | — |
| C18 | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | `packages/tools/a5p5-tools` | **dropped** — dormant, nothing dispatched | dormant audit |

## C14 is a DROP OF IMPLEMENTATIONS, never of safety

The one way this contract can do real damage is by letting a `dropped` label take the
security semantics with it. So C14 is split in two rows, and only the first is dropped:

- **Dropped (C14):** the old families' own tool bodies, their duplicated policy computation,
  and the historical equivalence requirements (pwsh parity, web redirect-hop ownership).
- **Preserved (C14b):** the unified centre's path read/write bounds, network allow/deny,
  Control authority and Stop. These were *also* things the old families did; they are not
  theirs to drop.

## The FS observation guard is OFF in A1 (owner ruling, 2026-11-21)

`fs-observation-policy` stays at the shipped default `disabled: true` through A1 and B. It
guards **blind overwrite and stale writes** — "has this agent observed the current version?" —
which is a different question from UTE's "**may** this agent write this path at all?". Making
it on by default in A1 would (a) depart from native semantics while the goal is to keep them,
(b) add cross-call state (`exec.agent.session` ownership + event scope) that B would then have
to prove correct alongside the bounds it is actually about, and (c) refuse legitimate
workflows (an agent that knows a config's content and may write it).

- **A1/B:** default off. The dialogue is graded on bounds + Control, not on observation.
- **C/D:** the native plugin's optional enablement is tested in **both** states, with real
  negative arms (unobserved write refused when on, accepted when off; stale version after a
  read; cross-agent isolation; observation dropped by cold recovery).
- **If the product later turns it on,** it turns on *DSH's* policy — the Team never builds an
  observation guard of its own.

**Wording rule for the acceptance matrix** (owner edit — the active plan is not worker-owned):
say "**writing an existing file does not require a prior observation**", never "writes are
unguarded". The write path bound, Control admission and the OS sandbox are all still in force.

## The rule that makes this list enforceable

A1 may not merge while a row is blank. "Deferred" is allowed and must name the phase that
picks it up; "preserved" must name the suite that proves it; **"dropped" must name the owner
ruling** (C14 and C17 do; a future drop without one is a silent capability loss).

**Deferral is a schedule, not a licence.** "Temporarily unavailable in A1" never authorises
shipping a product that silently lacks C1–C13, C15 or C16. Two rows need their own guard:

- **C6/C7 (Officer routing, ReviewCapability, Wake):** if Alpha.6 is not wired at some point in
  the window, the corresponding approval and auto-wake paths must be **explicitly disabled**,
  never silently fall back to a Leader path that is not the decided behaviour. Cold-start
  manual recovery stays the rule.
- **C10 (MCP):** may land in C, but must never be enabled by default while unmanaged.

Two rows deserve emphasis because they are the ones a wholesale replacement loses first:

- **C9/C10 (remote entry, MCP):** they are wired *inside* `agent-bindings.mjs` as incidental
  legs, not as modules. Re-authoring the entry is exactly when they disappear from the
  composition while every remaining test still passes.
- **C3 (delivery receipts):** work delivery is the Team's reason to exist; its ledger is
  written from the assembly, not from the tool.

## What this does not do

It does not test anything by itself. It is the checklist A1 is graded against, and its rows
become test names; a row with no test is a claim, which is why the last column exists.
