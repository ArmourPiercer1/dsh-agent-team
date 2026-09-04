# Finding — LIFECYCLE descendant family: structural composition cause (run #14, T12-V16)

Date: 2026-09-03 (run #14, nonce `mtktg7nu58c6d0`, 00:58:06Z → 01:13:31Z UTC)
Status: PINNED — scenario/composition mismatch, NOT a core, row, or window defect.
Not fixed in-lane (see "Why not fixed in-lane").

## The observation

LIFECYCLE (plan §11.2) requires "a real archive of a member with a live background
descendant (truly recursive drain, honest numeric drained count)". Run #14: the
SUBSPAWN member.send was DELIVERED at admission (T12-V16 verified — prompt in the
child's durable log within ~1 s; mock request seq8 @00:58:22.788 is the model's reply
to it, a scripted `subagent` tool-call `call_sub_mtktg7nu58c6d0`). The runtime then
relayed, verbatim, as a `role:'tool'` message:

```
Error: unknown tool "subagent"
```

(seq9 @00:58:23.416 carries that relay; the model acknowledged with a text reply.)
No descendant session was ever created, so the runner's 900 s discovery window timed
out honestly. Resulting failures (4 of the 9 LIFECYCLE assertions):

1. "a real descendant session was created under the member child session" — `<not found within 900s>`
2. "descendant session header marks origin=subagent with parentSession == member child" — `origin=undefined`
3. "descendant turn settled against the mock" — `<desc ack not in descendant log within 900s>`
4. "archive reports an HONEST numeric drained count >= 1" — `drained=0`

The other 5 PASS, and their passing is the substantive point: `member.archive`
executed with the full quiescence-gate step chain
(close-admission → interrupt → drain-descendants → wait-quiescence →
release-residency → commit-archive), `residencyDropped=true`, `drained=0` is a
genuine number (a non-numeric/failed drain would have failed the gate),
`member.restore` committed (lifecycle SETTLED, activityVersion 5), follow-up
admitted (work-admitted, sequence 12, lifecycleCommitted) and settled against the
mock (FOLLOWUP_ACK, seq10 @01:13:27.961).

## The cause (pinned, measured)

The vertical-slice composition gives **no session a `subagent` tool**:

- **All 11 mock requests of run #14 carry `tools=10`** — exactly the 10 frozen
  shipped team tools (`team_create_member, team_delegate, team_follow_up,
  team_inspect_config, team_list_members, team_list_templates,
  team_report_progress, team_request_control, team_resolve_control,
  team_send_message`). Root session (seq1) and member child (seq3+) identical.
  No core/preset tools (read/write/pwsh/subagent/…) exist in any session toolset.
  (seq2/seq4 are title-generation calls with `tools=0`.)
- The instance home (`references/.dsh-test-t12-a`) has **no `.agent-presets/`
  directory and no `package.json`** `dsh.profile.bundles`: `profiles/web/cordis.yml`
  is an explicit empty list ("The tree is composed as patches: each bundle in
  package.json's dsh.profile.bundles, then cordis.patch.yml…"), and the runner's
  patch layer (`cordis.patch.yml`) inserts exactly TWO rows — the production
  `dsh-agent-team` row and the `p6t6-team-tools` observability row. No agent preset
  row exists, so no agent-contributed tools exist.
- The row's tool set is the frozen `EXPECTED_TOOL_COUNT=10` (shipped team tools);
  the row does not — and per the frozen task decomposition must not — contribute a
  `subagent` tool.
- Consequence: when the scripted model attempts `subagent`, the real DSH agent loop
  fails the call in the tool registry and relays the error to the model. That is
  correct runtime behavior. A descendant session (origin=subagent,
  parentSession = member child) is structurally impossible in this composition.

## Why the pre-fix runs (#5–#13) masked this

Pre-T12-V16, the SUBSPAWN prompt was never delivered (window latch — see
`t12v-finding-360s-first-turn.md`), so the model never even attempted the
`subagent` tool call. The 900 s descendant timeout in runs #5–#13 had the latch as
its proximate cause; the structural toolset absence was the latent second cause.
T12-V16 removed the latch and exposed the second cause — evidence the fix works:
delivery now happens, and the only remaining failure mode is the composition
limitation, with a clean, honest, measured signature (verbatim `unknown tool`
relay 628 ms after the tool-call).

## Why not fixed in-lane

- **Not a core defect**: the agent loop's unknown-tool relay is correct behavior;
  zero core patches remain the invariant (budget 0).
- **Not a row defect**: the production row ships the frozen 10 team tools; adding
  subagent capability to the row would change the shipped tool contract
  (EXPECTED_TOOL_COUNT) — outside T12 scope and the row's design.
- **Not a runner timing issue**: no budget change can help; the descendant cannot
  exist.
- The remaining option — inserting an agent-preset row (or equivalent) into the
  slice composition so sessions gain a `subagent` tool — would change WHAT THE
  VERTICAL SLICE IS TESTING (a 10-tool minimal composition becomes a
  subagent-capable one), i.e. a scope/design decision for the parent, not a T12
  builder change. Flagged here for the T12-decision.md ruling: if the LIFECYCLE
  "live background descendant" sub-scenario must go green, the slice composition
  needs a subagent-capable agent row; if the condition is satisfiable with
  "honest drain of a quiescent member + quiescence gate integrity", run #14 ALREADY
  demonstrates it (drained=0 genuine, gate step chain complete, residency dropped,
  restore + follow-up real).

## Evidence pointers

- `t12v-summary-run14.json` — LIFECYCLE scenario, 9 assertions, evidence block
  (archiveResult steps/drained/residencyDropped; restoreResult; followup effect
  sequence 12 / settledSequence 15).
- `t12v-mock-capture-run14.json` — seq8 (tool-call `subagent`,
  `call_sub_mtktg7nu58c6d0`), seq9 (verbatim `Error: unknown tool "subagent"`
  relay + DEFAULT_ACK), per-request tool names (10 team tools on every agent
  request).
- `t12v-run14-correlate.txt` — glue timeline (no admission→drain gaps; the single
  904 s gap = the runner's own discovery wait starting 00:58:24 →
  deliver:enter @01:13:27.803).
- `run14-home-a/profiles/web/cordis.yml` (empty list) + `cordis.patch.yml`
  (two-row insert) — composition snapshot.
- `run14-instances/A1-instance-port3181.log` — `[t12v-wl]` glue lines (77).
