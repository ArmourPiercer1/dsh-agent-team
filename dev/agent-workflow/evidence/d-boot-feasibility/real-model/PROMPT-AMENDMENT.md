# PROMPT AMENDMENT — real-mode scenario prompts (dated 2026-11-26, round 120)

**Scope:** `tests/world-factory/drivers/d-boot-feasibility/run-real-model.mjs` — the `--model real`
arm ONLY. The `--model scripted` prompts are byte-identical to the prompts this driver has always
sent, and the scripted run remains the positive control.

## Why an amendment is allowed here, and what it is NOT

Round 119 measured the real route answering HTTP 200 with the full 43-tool surface, and then the
real model **did not perform the scripted choreography**: the driver prompted bare marker strings
(`DBOOT_D4_DISC`, `DBOOT_D4_DELEGATE_OFFICER`, …) which name no tool, no argument and no success
token. The model answered with unrelated `bash`/`grep` calls. That is the ONE case the round's
rules allow a scenario-prompt improvement for: *the model never got far enough to trigger the
situation*.

**No judge assertion changed. No judge was removed. No `knownRefuted` entry was added.** The
prompts now name the same tool and the same exact arguments the scenario already required; the
product under test is unchanged, and the same predicates locate the same calls.

## The amendment (old prompt → new prompt), scripted arm unchanged

| stage | prompt sent in **scripted** mode (retained verbatim; the mock keys on it) | prompt sent in **real** mode |
| --- | --- | --- |
| discovery | `DBOOT_D4_DISC` | "You are the Leader of the dboot d4 probe team. Call the `bash` tool exactly once with `{"command":"pwd"}`. After it returns, reply with the single token `DBOOT_D4_DISC` and nothing else." |
| officer delegation | `DBOOT_D4_DELEGATE_OFFICER` | "Create the review Officer now. Call the `team_delegate` tool exactly once with these exact arguments: {rootSessionId, requestToken `dboot-d4-delegate-officer`, delegationTemplateId `officer`, label, prompt, taskSummary}. After the tool returns, reply with `DBOOT_D4_OFFICER_DELEGATED`…" (the nested member prompt names the Officer's `read` file, the exact final token, and the wake rule) |
| worker delegation | `DBOOT_D4_DELEGATE_WORKER` | same shape, `delegationTemplateId: worker`; the nested member prompt lists the three steps (write path 1, write path 2, final token) with exact `file_path`/`content` per step |
| deny resolve | `DBOOT_D4_RESOLVE_ASK` | exact `team_resolve_control` arguments, `decision: "deny"`, requestId supplied by the driver |
| process resolve | `DBOOT_D4_PROCESS_ASK_RESOLVE` | same, `decision: "allow"`, requestId supplied by the driver |
| Sticky-Stop hold | `DBOOT_D4_OFFICER_HOLD hold the turn open for a real human cancel` | "Call the `bash` tool exactly once with `{"command":"sleep 45"}` so this turn stays open…" (same hold tag for the landed check) |
| resume | `DBOOT_D4_OFFICER_RESUME resume` | "The human resumes this session. If a machine review-wake message arrives naming a requestId, call `team_resolve_control` … decision allow." (the literal marker is deliberately NOT in any user prompt — see amendment 2) |
| third write | `DBOOT_D4_WORKER_THIRD_ASK issue the third write` | exact `write` arguments for path 3 |
| process probe | `DBOOT_D4_WORKER_BASH_TURN run the process probe command` | exact `bash` command (in-lane write + out-of-lane attempt) |
| collect | `REAL_MODEL_COLLECT Use the team_collect tool …` | exact `team_collect` arguments |
| duplicate approval | `REAL_MODEL_DUPLICATE_APPROVAL Repeated review attempt: …` | exact `team_resolve_control` arguments (second decision attempt) |

The blueprint personas gain a real-mode variant with the same job: the scripted YAML is unchanged
(`MODEL_MODE === 'scripted'` selects the old persona strings verbatim), and the real-mode persona
states the same scenario in words a real model can follow. The in-process `centreConfigViolation`
calls receive the SAME mode-appropriate YAML, so the enablement/refusal judges are unaffected.

## What this amendment does NOT do

- It does not relax a single judge predicate. If the real model still does not emit the named call
  with the named argument, discovery reports `DISCOVERY-MISS(<slot>): <predicate> matched no
  observed tool_use block in N observed turn(s)` and the judge stays REFUTED.
- It does not widen a timeout, add a retry loop, or skip a stage.
- It does not touch the `--model scripted` prompts; the scripted 20/20 control is the evidence that
  the discovery refactor changed evidence LOCATION only.

## Amendment 2 — 2026-11-26, same round, after the first full run

Two wording changes, both forced by measured behaviour, both disclosed here with the old text.

### 2a. The literal wake marker is not written in user prompts

**Old (real mode):** the nested Officer task said *"Later, whenever a user message contains
`[team-review-wake`, call `team_resolve_control` exactly once …"*, and the resume prompt said *"If a
user message contains `[team-review-wake` …"*.

**Measured defect:** the judge `rm:wake-delivered` finds every user message that contains that literal
marker and requires **all** of them to be machine-attributed (`plugin:dsh-agent-team`). Because the
driver's own delegation/resume text carried the marker with source `user`, the judge correctly saw two
HUMAN "wakes" and REFUTED the row — with the product's own delivery already green. The evidence is
`archive/2026-11-25T19-07Z-real-legacy-attempt2-wake-prompt-self-taint/` (detail:
`wake input sources=["user","plugin:dsh-agent-team",…] expected="plugin:dsh-agent-team"`).

**New:** the prompts name the event — *"whenever a machine review-wake message arrives (it names a
requestId)"* / *"If a machine review-wake message arrives naming a requestId"*. The judge is unchanged:
it still requires ≥1 wake-marked user message and all of them machine-attributed.

### 2b. The worker task forbids a text-only first action

**Old (real mode, opening):** *"You are the governed worker for this team. Step 1: call the `write`
tool with {…}."*

**Measured defect:** on the next host's second boot the worker answered with TEXT and never called
`write`, so the deny arm raised no Control request and was recorded `ARM FAILED: the ask-denied arm
never raised a pending Control request` (`archive/2026-11-25T20-13Z-real-next-attempt1-boot2-worker-text-only/`).

**New:** one added opening line — *"Do NOT answer with text. Your first action MUST be the Step 1 tool
call; do not run bash, do not read files, do not explore the repository."* The task, the paths and the
success token are unchanged; no judge changed.

### 2c. Not a prompt change, recorded here for completeness: the deny arm interrupts the Leader's turn

A real Leader kept exploring the repository after its delegation turn, so the deny prompt sat queued
and zero `team_resolve_control` calls appeared in 30 observed turns
(`archive/2026-11-25T19-33Z-real-legacy-attempt4-deny-no-team-resolve/`). The driver now performs
`session/cancel` on the Leader before sending the deny prompt — the same effect a human's next prompt
has on a busy agent — then sends the prompt. Scripted mode is untouched.
