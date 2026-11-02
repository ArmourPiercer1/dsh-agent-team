# P-INBOX seam witness — DSH 0.2.0-rc.2 @ 639ed01539

The upstream files are fetched verbatim into `upstream/` from the pinned SHA
(`packages/core/agent-loop/src/inbox.ts`, `agent.ts`). Line numbers below are
the lines of those fetched copies.

## The public facts the light-wake design relies on

| Fact | Evidence | Consequence for PR #536 §3.4 |
| --- | --- | --- |
| Pending input is durable projection state in two lists (`next-turn`, `next-step`) | `inbox.ts:22,30` | The coordinator never needs its own task store; the Host Inbox is the carrier. |
| `claim(target, turn)` removes ALL `next-step` plus ONE `next-turn`, emits `agent/inbox/claimed` per message | `inbox.ts:109-113` | A claimed message is no longer pending: post-claim cancellation is impossible. The final decision must re-read the Case. |
| `remove(messageId)` / `replace(messageId, …)` return `false` once the message is no longer pending | `inbox.ts:140-156` | A stale generic wake can be withdrawn ONLY before claim. Do not promise recall after claim. |
| `hasPending` covers both lists | `inbox.ts:92-95` | "No pending work" is a cheap authoritative read, but it is not the same as "no fresh actionable work". |
| The agent loop claims at the step boundary (`preStep` → `inbox.claim`) | `agent.ts:267-271` | Activation can be coalesced up to the claim point; after that the turn owns the batch. |
| `send(input, 'next-turn', true)` sets a wake; waking after abort opens a new turn | `agent.ts:155-164` | A wake is a hint, not a decision. The plugin can enqueue a generic review prompt without carrying an approval payload. |
| Turn loop: `turn()` claims; `run` loops while `await this.turn()` | `agent.ts:254-260,295-305` | `turn/end` is the natural re-scan boundary for the latch. |

## What this does NOT prove

Reading the seam cannot prove that three concurrent asks produce one model turn
on a real Host, nor that a crash between claim and decision recovers without a
double allow. Those are **host-behavior** claims and are marked ENV_BLOCK in
`RESULTS.md`; they become executable only after PR-A6-3/PR-A6-4 exist.

## Verdict

**PASS (seam only)** — every primitive the design needs is public: append,
claim, remove-before-claim, pending read, turn lifecycle, durable projection.
No new Core patch or private API is required for the carrier itself.
