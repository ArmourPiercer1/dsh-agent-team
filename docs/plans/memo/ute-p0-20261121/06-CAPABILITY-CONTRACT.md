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

## The list (A1 must dispose of every row)

| # | capability | where it lives today | disposition | evidence it survived |
| --- | --- | --- | --- | --- |
| C1 | the 13 `team_*` tools (member/template/delegation/control board) | `packages/runtime/src/plugin/live/team-tool-plane.mjs` + `packages/team/tool-agent-team` | **preserve** — host-side board tools, not the retired plane | `team_*` board suite |
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
| C14 | per-family governed semantics (path policy, redirect ownership, pwsh parity) | the eight family bodies | **dropped** — the host rows own these now; the differences that mattered are defects of the deleted body (`SD-SEARCH-1`) | census §2 |
| C15 | `team_skill` | `inspect-family` | **preserve, re-homed** — Team skill provider into a host-shaped row | new row test |
| C16 | `subagent_fork` | `agent-control-family` | **preserve, re-homed** — row over `subagent-fork-in-process` | new row test |
| C17 | `exit_plan_mode` | `agent-state-family` | **dropped by owner ruling** — the host has only a `claude-code-mods` name mapping | — |
| C18 | `a5p5-tools` lane helpers (arg parsing, effects, render, spill) | `packages/tools/a5p5-tools` | **dropped** — dormant, nothing dispatched | dormant audit |

## The rule that makes this list enforceable

A1 may not merge while a row is blank. "Deferred" is allowed and must name the phase that
picks it up; "preserved" must name the suite that proves it; **"dropped" must name the owner
ruling** (C14 and C17 do; a future drop without one is a silent capability loss).

Two rows deserve emphasis because they are the ones a wholesale replacement loses first:

- **C9/C10 (remote entry, MCP):** they are wired *inside* `agent-bindings.mjs` as incidental
  legs, not as modules. Re-authoring the entry is exactly when they disappear from the
  composition while every remaining test still passes.
- **C3 (delivery receipts):** work delivery is the Team's reason to exist; its ledger is
  written from the assembly, not from the tool.

## What this does not do

It does not test anything by itself. It is the checklist A1 is graded against, and its rows
become test names; a row with no test is a claim, which is why the last column exists.
