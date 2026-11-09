# V016-FIX — the two P1 fix-ups before the 0.1.6 candidate freeze

**Register id:** **PD-40 (STICKY-LATCH)** — the latch-scoped Sticky Stop limit, disclosed here.

**Task:** correct the independent review of the v0.1.6 candidate
(`dev/agent-workflow/evidence/v016-review/REVIEW.md`, reviewed against `c66fa8b03`) where it needs a
product/doc change: **P1-3** (a machine relay removed `create_goal` authority even with Alpha.6 OFF)
and **P1-2** (Sticky Stop is latch-scoped, not session-scoped), plus the cheap text defects N1–N4.
P1-1 (install smoke) is owned by another lane and is **not** measured here.

- **base:** `c66fa8b03` (`origin/integration/v0.1.6`)
- **branch:** `task/v016-fix-20261109`
- **worktree:** `.worktrees/v016-fix`
- **evidence class:** host-free targeted tests + repository gates. **0 boots.** No `V@B`, no matrix
  grade, no `CANDIDATE-C2` claim.

---

## 1. P1-3 — the relay attribution is now gated on the Alpha.6 opt-in

**Before** (`agent-bindings.mjs`, relay/`team_send_message` producer): every model/Leader relay was
delivered with `source: { kind: 'plugin:dsh-agent-team' }` **unconditionally**. Upstream
`hasDirectHumanInput` (`tests/deepseek-harness-test-use/packages/goal/tool-goal/src/authority.ts`,
`requireDirectHuman`) accepts `create_goal` only when the open turn contains a `user/message` whose
`source.kind === 'user'`, so a Member whose turn began with a relay lost goal authority **with
Alpha.6 off** — the Alpha.5 path was not literally unchanged.

**After:** the machine kind is used only when the **same flag that constructs the review plane** is
true — `config.alpha6ReviewRouting === true`, the exact expression `root.ts` passes to
`createAlpha6RootWiring(...)` (`root.ts:2454`). No new config key and no second policy source:

- **A6 off** (absent/false) ⇒ `source.kind === 'user'` — the base (`87484ded1`) attribution; there is
  no Sticky Stop listener registered, so the machine kind protected nothing and cost goal authority.
- **A6 on** ⇒ a machine relay carries `plugin:dsh-agent-team`; a human `member.send`
  (`attribution.fromHumanId` present) still carries `user` and can clear a Sticky Stop.

The ledger still records the machine relay in both polarities (`machineInputs.note`), so truthful
provenance survives even on the A5 path.

**Measured (host-free, the exact producer seam):**

- `npx vitest run packages/runtime/test/a56-input-provenance.test.ts` → **11/11 passed**
  (`Test Files 1 passed`, `Tests 11 passed`, 2026-11-09).
  - A6 OFF world: a Leader relay is delivered with `source = {kind:'user'}` (the exact predicate
    upstream reads for `create_goal`) and is still `isTeamMachineInput(...) === true` via the ledger.
  - A6 ON world: the same relay is `{kind:'plugin:dsh-agent-team'}` (Sticky Stop protection holds);
    a human relay stays `{kind:'user'}`.
- A full `team.create` → relay → `create_goal` boot was **not** run here; the targeted test pins the
  delivered message shape at the producer, which is the only input `authority.ts` reads. The
  A6-off leg is `A6 OFF: a relay restores the base user attribution (relay-started goals work)`.

The experimental-plane limitation that remains **with A6 on** is disclosed as release-notes §4.8.

## 2. P1-2 — Sticky Stop is latch-scoped (disclosed, not redesigned)

The independent review measured (its M11, production root, A6 ON, one Officer instance, **no review
latch**): `alpha6WakeUserStop(<officer child session>)` returned **false** and wrote **no**
`stopped-*` file. The code confirms why: the marker writer is inside
`if (coordinator === undefined) return false` (`root.ts:2755-2762`), and `alpha6WakeBySession` is
populated only by a wake dispatch or by boot recovery from an intent/stopped row. A human Stop
between asks — or after a restart before the next ask — therefore writes nothing, and the next
review wake can activate the "stopped" reviewer.

**Fixed by disclosure only** (the task forbids a session-scoped durable marker in this PR; that is a
design change with crash semantics):

- `RELEASE-NOTES-0.1.6.md` §2.2 (Sticky Stop row) and §4.7 now state the latch-scoped condition.
- the `root.ts` doc comment above `alpha6WakeUserStop` states it and names PD-40.
- **PD-40 (STICKY-LATCH)** is opened in `PRODUCT-DEBT-REGISTER.md` with the reviewer's falsifier:
  *call the stop hook on a session with no latch and observe a `stopped-*` marker; or show a
  production path that creates a coordinator for every live reviewer at boot.*

## 3. N1–N4 text fixes

- **N1:** `handoff-context ` added to `TEAM_MACHINE_ENVELOPES` (the producer's literal prefix — the
  text is token-leading but **not bracketed**; the review's suggested `[handoff-context ` would never
  match). Classification leg added. Comment records why the omission was latent (a handoff target is
  a fresh root with no marker).
- **N2:** release-notes §5 now cites `a6-gaps-g2-unclaimed-r11/run.log` and its `FAIL A6-26 …
  verdict=abandoned-terminal` text, and says the `A6-26 PASS` in `a56-semantics/` is a different
  assertion.
- **N3:** "zero or multiple Officers is a configuration refusal" reworded: it is a **per-query**
  refusal (`officer-instance-count`) when a review is attempted; a zero-Officer Team boots. Boot
  checks only the declared `officerTemplateId`.
- **N4:** the stale "unwired in production today" note in `alpha6/assigned-officer-facts.ts` is
  replaced with the dated wiring statement (`createAlpha6LiveRootComposition` →
  `createAlpha6ControlPorts` → `root.ts:3180-3190`).

## 4. Gates run for this lane

Recorded in the PR body and the execution log. The A6 family, `a56-input-provenance`, typecheck, the
debt-register gate and `check:artifacts:head` are the release-facing ones; `agent-bindings.mjs` is
compiled into `packages/runtime/dist`, so the ARC-A named override is appended when its bytes change.
