# O2-A — `ask_user_question`: the governed port carries no Agent (public-interface proposal)

> **DRAFT — proposal memo for public-interface process.** Nothing here is a ruling, a plan
> change or a product change; whether this lands at all, under what name and in which directory
> is the coordinator's/user's decision (see `PROPOSAL-PLACEMENT.md` next to this file).
>
> **Dated banner (real UTC 2026-10-30T14:0xZ, lane `u7r3-o2memo`, seat: delegated subagent on the
> harness-reported model qwen3.8-flash-next, disclosed; ROUTER_RULES §0.2 — independence =
> independent sessions, not a model identity).** Format mirrors the STATE_HOME six-question memo
> `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`
> (dated banner → lettered question sections → ranked options → guards unchanged → acceptance
> core → open questions), whose six-question pattern is itself the one
> `dev/agent-workflow/gates/USER-RULING-20261031.md:22` (§一.2 「六问裁决」) answered; the pattern
> is named as the model for exactly this class of gap by `.artifacts/ops/UI-BLOCKER-SCOPING-20261030.md:92`
> and by the `present` sister memo `PRESENT-PUBLISH-GAP-MEMO.md` banner (`task/u7r3-uileg0-20261030`,
> PR #489). Authority for what the Host *is*: pristine
> `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`
> (this lane `rev-parse` = that SHA, `status --porcelain` = 0 lines — read-only, never edited).
> Authority for what we are: this repository at branch `task/u7r3-o2memo-20261030`, base
> `e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8` (origin/master tip at spawn).
> **MEMO-ONLY: zero starts, zero boots, zero `packages/**` change, host tree untouched.**
> **Date law (CLOCK-ANCHOR):** banners carry real UTC (`date -u` measured this lane);
> lane/evidence labels follow the session calendar whose mapping to real UTC is ruled in
> `dev/agent-workflow/gates/CLOCK-ANCHOR-20261030.md` §3 (`:55` 真实 UTC = 标签日期 − 1 天); this
> round's lane labels (`u7r3-o2memo-20261030`, and the read lanes `u7r3-uif4-20261030` /
> `u7r3-uileg0-20261030`) carry the real-UTC date of their run, while the cited
> `USER-RULING-20261031.md` / `BOOT-BUDGET-20261031C.md` are session-calendar names (real
> UTC 2026-10-30 per that mapping and its §5 addendum).
> **Citation status:** the two chains this memo rests on are the *pending-merge* lane records —
> `dev/agent-workflow/evidence/u7r3-uif4-20261030/` (branch `task/u7r3-uif4-20261030`, **PR #491**)
> and `dev/agent-workflow/evidence/u7r3-uileg0-20261030/` (branch `task/u7r3-uileg0-20261030`,
> **PR #489**). Neither path exists on origin/master yet; they are cited as pending-merge paths and
> were read with `git show <branch>:<path>` in this lane. Every host/plane `file:line` below was
> spot-verified by this lane at the pin; no chain was re-derived.

## (a) Question 1 — current behaviour, step by stepped

The governed `ask_user_question` row is reached, approved and consumed correctly, and then cannot
be answered, because the request it emits carries **no Agent** and the Host's answering face is
reachable only for requests that do. The chain, each link at the pin:

1. **The row hands the transport three fields and drops the carrier.**
   `packages/tools/ui-family/src/ask-row.mjs:151-156` — `execute: async (raw, exec)` builds
   `corr` from `exec?.token`, `exec?.tokenKey`, `exec?.signal` only. The Host delivers the live
   carrier on the very same object (see (c)2), and the row does not read it.
2. **The port is built once, at mount, with no Agent binding.**
   `packages/tools/families/ui.mjs:79-83` — `portRef()` resolves the injected port else
   `cap.hostService('userQuestions')` and returns `createUserQuestionsPort(service)` —
   **one argument, no binding**. The adapter's second parameter exists and is the documented
   Agent seam: `packages/tools/ui-family/src/ui-interaction-port.mjs:83-94`
   (`{ agent = undefined }`, `withAgent(request)` at `:87-90` — "the mount's OWN live agent,
   resolved lazily when the mount has one", `:73-79`). Nothing in production passes it.
3. **Nothing in the family capability set could pass it.** The closed enumeration a family is
   allowed to see — `packages/runtime/src/plugin/live/family-assembly.mjs:60-74`
   (`CAPABILITY_KEYS`: identity, mount config, `decide`/`pa`, backends,
   `presentationFace`/`transport`/`logBackend`/`createShutBackend`/`hostService`/`hostPin`,
   `injected`) — carries **no live-agent handle**, and `makeFamilyCapabilities`
   (`:83-92`) refuses any key outside it (`FAMILY_CAPABILITY_UNKNOWN`). The capability object is
   assembled at `packages/runtime/src/plugin/live/team-tool-plane.mjs:1610-1632`; the mount's
   agent-scoped ctx arrives later, at `mount(agentCtx)` (`:2039`), and is stored only as a
   service-lookup root (`hostServices.ctx = agentCtx`, `:2048`; lookups are
   `ctx.get(name)`, `:1602-1608`).
4. **So the Host service is called without an Agent, and takes the unscoped arm.**
   `packages/interaction/user-questions/src/index.ts:287` (`async ask(request)`),
   `:294-295` (`const agent = request.agent; if (agent !== undefined) this.assertLiveRoot(agent)`),
   `:322-330` — **with** an Agent the dispatch is scoped
   (`this.ctx.waterfall(scopeTarget(agent, agent), 'user-questions/request', { ...request, agent }, noAnswerer)`);
   **without** one it is the plain `this.ctx.waterfall('user-questions/request', request, noAnswerer)`
   (`:323-324`), and `noAnswerer` is `NO_PROVIDER`
   (`:318-321`: "no user-questions answerer accepted the request").
5. **The public answering face only ever sees scoped traffic.**
   `user-questions/request` is on the forwarded-events allowlist as
   `mode: 'waterfall'` (`packages/api/remotes/src/remote-events.ts:47`), and the forwarder's law is
   `packages/api/remotes/src/index.ts:57-75`: the listener takes `carrierAgent = carrierKeyOf(this)`
   (`:62`), returns `next()` when the carrier has no scope key (`:63`), **throws** unless the
   request carries its Agent and it *is* the carrier
   (`:64-67`: `if (agent === undefined || agent !== carrierAgent) throw new TypeError(...)`), and
   only then `forwardWaterfall(...)` (`:68-74`) onto the mux the browser/GUI answerer rides.
   Unscoped traffic therefore never leaves the process: the default `next()` chain ends at
   `noAnswerer`.
6. **The row reports the Host's typed refusal honestly and stops.**
   `packages/tools/ui-family/src/ask-executor.mjs:176-180` (post-consume `port.ask(request)`,
   request built from `questions` + signal only) and `:197-198`
   (`governed-ask port-failed detail=…` → `refused('io','UI_INTERACTION_PORT_FAILED', …)`).

**Live witness (PR #491, 2 of 3 starts, one World, Host `639ed01539…`):** in the same boot the
Host's OWN `ask_user_question` (a plain session whose call site passes `exec.agent`,
`packages/interaction/tool-ask-user/src/index.ts:107`; timed arm `timed.ts:196-197`) came back
`{"answers":[{"id":"uif4-nq1","selected":["Native A"]}]}` through public faces only
(`GET /?token` cookie → `/api/remote.mux` `$events` → `POST /api/$events/result`,
`result.ok:true`), while the governed member row — approval created, allowed via
`team.resolveControl` with `decider.kind:"human"`, allow consumed — died at
`governed-ask port-failed detail=no user-questions answerer accepted the request`
(`u7r3-uif4-20261030/README.md` "The one-paragraph answer" + per-cell table `ui:ask-approved-ran`
**FAIL** / `ui:answer-wire` **PASS**; verbatim lines `c2/run-p2.stdout.log:5-7,11`). That run also
left `ui:live-root-law` **NOT_REACHED**: `assertLiveRoot`
(`packages/interaction/user-questions/src/index.ts:131-144`, `CALLER_NOT_LIVE` / `DELEGATED_CALLER`)
is only entered when a request carries an Agent, so the governed path never exercises it.

**Therefore:** the public answering face is *not* the missing piece — it works. The missing piece
is a carrier binding between our row and the Host's `userQuestions.ask`.

## (b) Question 2 — who is affected

- **Every governed `ask_user_question` row on every production mount.** Production injects no UI
  port at all (`packages/runtime/src/plugin/live/agent-bindings.mjs:2811-2814` — the `backends`
  trio is `{jobs, backgroundJobs}` only; ledger reason line
  `dev/agent-workflow/ledgers/u7-tool-acceptance.json:647`), so the adapter arm is the ONLY arm,
  and it is the arm described above. The tool's `L4-positive` is `DISCLOSED` today for exactly this
  reason (`…u7-tool-acceptance.json:622-651`), and Alpha.5's exit criterion is item-by-item
  functional positive control (`docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md:148`).
- **The UI family's timed variant is strictly worse off**: the Host's `askTimed` *requires* an
  Agent (`packages/interaction/user-questions/src/index.ts:234-235` —
  `request: AskUserQuestionRequest & { agent: Agent }`, `:242` `assertLiveRoot(request.agent)`),
  and the native tool says so outright (`tool-ask-user/src/timed.ts:196`: "timed questions require
  a live agent"). Through today's adapter (`ui-interaction-port.mjs:93`) the timed face can never
  succeed for a governed row.
- **Every later lane that assumed "port mounted ⇒ answerable".** `ui:live-root-law` cannot be
  witnessed until a governed request carries an Agent (PR #491, "What the coordinator should take
  from this lane" items 1 and 4). Any ledger or plan sentence of the form "L4 positive is reachable
  via the family port alone" needs re-reading.
- **Not affected / not claimed:** the Host's own tools (they pass `exec.agent`), the kit/test arm
  (`cap.injected`/`injected.uiInteraction`, `packages/tools/families/ui.mjs:78-80`; the C1 fake
  rides it — `packages/runtime/test/u7-f-ui-c1.test.ts:133`), the refusal arms already PROVEN in
  #405 (absent-face refusal, default-deny, PA deny, replay), and `present` — a different gap,
  sister memo `O2-B`.

## (c) Question 3 — which public surfaces are touched

*Host side (pinned 0.2.0-rc.2 — this memo asks for nothing from it):*

1. `userQuestions.ask(request)` / `askTimed(request, callId, timeoutMs)` —
   `packages/interaction/user-questions/src/index.ts:287`, `:234`; the service is the public
   `ctx.userQuestions` (`:78-85`, `super(ctx, 'userQuestions')`) and is on the generated public
   ctx catalog (`packages/extensions/tool-cordis/src/api-catalog.ts:3407`).
2. **The per-call carrier is already public surface**: `ToolExecutionInput.agent?: Agent`
   ("The agent on whose behalf the call runs (set by the agent loop)",
   `packages/core/tools/src/index.ts:326-339`), `ToolExecution extends ToolExecutionInput`
   (`:393`), and the definition-owned entry point is `execute(args, exec: ToolRunContext)` with
   `ToolRunContext extends ToolExecution` (`:236`, `:418`). The native ask tool reads exactly this
   field (`tool-ask-user/src/index.ts:107`).
3. The scoped waterfall + forwarding law: `packages/api/remotes/src/index.ts:57-75`,
   `packages/api/remotes/src/remote-events.ts:47`; the answering transport
   (`/api/remote.mux` `$events`, `POST /api/$events/result`) is proven live end-to-end
   (PR #491 `ui:answer-wire`).
4. The root-ownership law that any binding must still satisfy:
   `packages/interaction/user-questions/src/index.ts:131-144` (exact live instance + `agents.roots()`).

*Our plane (the only side a fix would touch):*

5. `packages/tools/families/ui.mjs:78-83` — the port-resolution closure (injected arm, then the one-argument adapter call).
6. `packages/tools/ui-family/src/ui-interaction-port.mjs:83-94` — the adapter's Agent-binding
   parameter, present and unused in production.
7. `packages/tools/ui-family/src/ask-row.mjs:151-157` — the row transport (drops the carrier).
8. `packages/runtime/src/plugin/live/family-assembly.mjs:60-74` (+`:83-92`) — the closed
   `CAPABILITY_KEYS` enum and its refusal law; this is **our own centre interface**, not upstream.
9. `packages/runtime/src/plugin/live/team-tool-plane.mjs:1610-1632`, `:2039-2048` — where a
   capability object is minted and where the mount's agent ctx arrives.
10. `packages/runtime/src/plugin/live/agent-bindings.mjs:2810-2816` — the production mount's
    `backends` set (the trusted-mount seam `input.backends` → `cap.injected`).

## (d) Question 4 — the minimal PUBLIC surface that would close it (candidates, ranked)

Framing law, stated once: this is **not** an upstream-patch question. Every face the fix needs is
already public on the pinned Host ((c)1-4). Ranked as in the STATE_HOME memo's (b) section.

**S1 (RECOMMENDED) — thread the already-public per-call carrier through our own row transport.**
Read `exec.agent` in the row (the Host hands it, `packages/core/tools/src/index.ts:339`), carry it
in `corr`, and pass it into the adapter seam that already exists
(`createUserQuestionsPort(service, { agent })`, `ui-interaction-port.mjs:83-90`).
*Public surface added: none* — neither Host nor `CAPABILITY_KEYS` changes; the change is inside
the reviewed family lane plus the row transport. *Precedent in-repo:* the agent-control rows
already treat this field as the dispatch-provided caller —
`packages/tools/agent-control-family/src/spawn-row.mjs:41-43` ("trusted transport data — the model
cannot express or restate it"), and its siblings `fork-row.mjs:40`, `workflow-row.mjs:34`,
`list-agents-row.mjs:24`, `list-models-row.mjs:28`; the plane itself reads `exec.agent?.id` as the
caller fence for the host job faces (`team-tool-plane.mjs:1684`,
`packages/runtime/src/plugin/live/jobs-family-bridge.mjs:63,73`).
*Costs / risks:* the family then handles a live `Agent` object per call (ownership question:
`Agent` is a carrier, not an authority handle, but the boundary audit books outward edges per lane —
`scripts/eb3-family-boundaries.mjs:166`); per-call resolution must stay lazy (no mount-time
capture); and `agent` is deliberately NOT a `CORRELATION` field — it must never be stringified onto
a ledger row (the lane's existing law: `packages/tools/a5p5-tools/src/register.ts:202-209,238`).

**S2 — ctx-level live-agent handle on the family capability object.**
One new enumerated key (e.g. `liveAgent: () => Agent | undefined`) in `CAPABILITY_KEYS`
(`family-assembly.mjs:60-74`), minted by the plane at `mount(agentCtx)`
(`team-tool-plane.mjs:2039-2048`), consumed by `ui.mjs:82` as the adapter's binding.
*Public surface added:* exactly one key on **our own** closed family-facing contract — the same
shape of decision as `hostService`/`injected` already are.
*Costs / risks:* it is a protected-centre interface change → the standing gate applies (any centre
interface change goes through independent security review first — the structure of
`dev/agent-workflow/gates/USER-RULING-20261031.md` §一.2, `:24`); every family then sees a live
Agent (capability widening beyond the UI lane, against the by-construction minimalism stated at
`family-assembly.mjs:38-44` and enforced by `FORBIDDEN_CAPABILITY_KEYS` `:77-80`); a mount-time
closure must still resolve lazily or it goes stale across restarts.

**S3 — trusted-mount port binding (no family change at all).**
The production mount injects `backends.uiInteraction` already bound to the live agent
(`agent-bindings.mjs:2811-2814` is where the trio lives; `ui.mjs:78-80` already prefers an injected
port; `ui-interaction-port.mjs:73-79` documents this arm as "the mount's OWN live agent").
*Public surface added:* none — the seam already exists and C1 already exercises it
(`packages/runtime/test/u7-f-ui-c1.test.ts:133`).
*Costs / risks:* the trusted mount becomes a reviewed production UI-port owner (a new trust
surface: this port is the face that talks to a human, `packages/tools/ui-family/README.md`
"Owner role"); the law "the family owns no UI face" stays intact but the review moves to the glue;
and it hard-codes one answerer shape per mount.

**S4 (rejected here) — an upstream/Host-side change.** Not required by any of the above, and
unnecessary to state as a demand: the Host already refuses non-carrier traffic *by design*
(`api/remotes/src/index.ts:64-67`) and already routes carriers end-to-end. Asking it to answer
agent-less governed requests would be asking it to drop the ownership law that keeps a child agent
from blocking forever (`interaction/user-questions/src/index.ts:138-143` —
`DELEGATED_CALLER`). Not proposed; **`CORE_SEAM_BLOCKER` is not the finding of this memo.**

**Honest limit, common to S1-S3.** Binding the Agent is *necessary, not sufficient*: after binding,
the Host's `assertLiveRoot` still decides (`interaction/user-questions/src/index.ts:131-144`), and
whether a governed Team member's Agent is a registry **root** is UNWITNESSED
(PR #491 `ui:live-root-law` = NOT_REACHED; PR #489 README Q3 records the same as `L2 NOT_VERIFIED`).
If it is not a root, the correct outcome is the Host's typed `DELEGATED_CALLER` refusal surfaced
verbatim — which the adapter is already written to do (`ui-interaction-port.mjs:76-79`). The
proposal therefore promises a *reachable* positive arm, not a guaranteed one, and the difference is
settled by one live leg, not by more prose.

## (e) Question 5 — migration and governance

- **Who owns the decision.** S1 and S3 are *lane-owned* changes: reviewed family/row code and the
  production mount, carried by an ordinary implementation PR through the PR-level review loop.
  S2 is a **centre** decision — one key on the closed capability contract — and the standing
  discipline for that is "public/reuse path first, independent security review before any centre
  interface change" (`dev/agent-workflow/gates/USER-RULING-20261031.md` §一.2, `:24`); the centre
  (this repo) owns it, not the lane. Upstream/Host owns nothing here: no Host behaviour is being
  requested. **Recommendation: try S1; keep S3 as the fallback if S1's ownership question is
  refused at review; treat S2 as a last resort with its security review attached.**
- **Zero-flip migration.** S1/S3 change behaviour only on mounts that already carry the UI family
  (`uiFamilyEnabled`, `packages/tools/families/ui.mjs:62,66`); the absent-key world stays
  byte-equal and the native tools ride untouched, so no existing World or ledger cell moves without
  a new witness. Nothing migrates on disk: no state, no home, no durable row changes shape.
- **Ledger honesty.** `ask_user_question` `L4-positive` stays `DISCLOSED`
  (`dev/agent-workflow/ledgers/u7-tool-acceptance.json:645-648`) until a real-Host positive arm
  lands; the reason line may be updated to cite this memo (the machine honesty checker
  `scripts/eb3-tool-acceptance.mjs` keeps auditing it either way, GATE-LEDGER R-G4R-3 note).
  The existing C1 (41 legs, #405) and C2 refusal arms (f3/f4) are unaffected: a positive arm never
  weakens a negative arm, and the negative arms must still be reproducible with the knob off.
- **Sequencing (no boot budget is spent by this memo).** Offline: decide S1 vs S3 (this memo is the
  input). Live: ONE World, ONE leg, pool 「其他 Family 的 L3/L4 验收」
  (`dev/agent-workflow/gates/USER-RULING-20261031.md:11`), judging on `governed-ask RAN` + the
  answer verbatim in the tool_result + an independent on-disk witness + `ui:live-root-law` now
  reachable; ≤3 starts (f1–f3 precedent), pre-registration law respected
  (`dev/agent-workflow/gates/BOOT-BUDGET-20261031C.md`).
- **Docs drift found by this lane (fix inside the pending PRs, not here).**
  (i) PR #489's README (Q1 row) cites `packages/api/remotes/src/remote-events.ts:45` for the
  `user-questions/request` allowlist row; at the pin that row is `:47` (`:45` sits above it).
  (ii) PR #489's README states the generated ctx catalog has 128 `ctx.<key>` entries; this lane's
  recount of `api-catalog.ts:83-3758` gives **91** (and `+8` client-platform keys in
  `packages/extensions/cordis-client-runner/src/client/api-catalog.ts`). Both conclusions the lane
  drew from the scan are unaffected (no publish/deliverable key exists under either count), but the
  number should not propagate.

## (f) Question 6 — non-goals (what this memo deliberately does not decide)

1. **No blueprint or default-value rulings.** Nothing here says which blueprint, template or policy
   state should enable the UI family or set `default: ask`; blueprint default rulings are the
   coordinator's/user's and PR #367's lane. The lane-scoped-allow law is unchanged: lane-scoped
   `always`/`ask` still never enters blueprint data (GATE-LEDGER `:23` R-U6P3-1).
2. **No verdict on whether a governed member *should* be able to interrupt a human.** That is the
   Host's ownership law (`assertLiveRoot`) and a product question for the owner; this memo only
   states which surface is missing and which are not.
3. **No acceptance, no gate movement.** No L1–L4 cell moves; `L4-positive` remains DISCLOSED; no
   G5 claim; nothing here may be quoted as "verified" — this lane ran no boot and no test beyond
   `docs:probe`.
4. **No C2/C1 design.** The one-leg live sketch in (e) is a sketch for the coordinator, not a run
   plan; boot budgets, pre-registration and the stop-after-same-class rule stay exactly as ruled
   (`dev/agent-workflow/gates/USER-RULING-20261031.md` §一.1, §三.3).
5. **No `present` decision.** The publication gap is a different shape (no publish SERVICE at all,
   not a missing binding) and is deliberately argued separately in `O2-B` so the two cannot be
   merged into one ruling — the same separation `PRESENT-PUBLISH-GAP-MEMO.md` (e) asks for.
6. **No imitation, no vocabulary claims.** This memo does not authorise writing any Host event
   vocabulary from the plane, and it does not assert the vocabulary is private — only that a
   reviewed service/binding face is what governance needs.

## Guards that stay UNCHANGED whatever shape is chosen

- The port gate stays BEFORE any authority force: absent face = typed
  `UI_INTERACTION_PORT_ABSENT` with zero PA consumption and zero port calls
  (`packages/tools/ui-family/src/ask-executor.mjs:110-119`).
- Post-consume interaction stays ONLY through the port, and the injected signal rides into the port
  request (`ask-executor.mjs:174-180`; the cancel-boundary sentence
  `packages/tools/families/ui.mjs:114`).
- The fail-closed law and the "no port = no interaction path" shape
  (`packages/tools/ui-family/src/ui-interaction-port.mjs:6-12`, `56-58`), and the timeout law's
  pending-is-never-an-answer rule (`packages/tools/ui-family/src/ui-mechanics.mjs`, README law block).
- The capability contract's authority ban (`family-assembly.mjs:77-80`) — a live-agent key in S2
  must be a carrier, never an approval/grant/registry handle.
- Correlation discipline: the real execution token never travels as text
  (`packages/tools/a5p5-tools/src/register.ts:202-209,238`).
- The Host's own law stays second-guessed by nobody: the adapter surfaces
  `CALLER_NOT_LIVE`/`DELEGATED_CALLER` verbatim (`ui-interaction-port.mjs:76-79`).

## Open questions (for the coordinator / owner)

1. **S1 vs S3**: is the reviewed family lane allowed to hold a per-call `Agent` carrier
   (precedent: agent-control rows, `spawn-row.mjs:41-43`), or must the carrier stay in the trusted
   mount? That single question picks the shape.
2. Is **S2** (one `CAPABILITY_KEYS` key) worth its security-review cost while only one family needs
   a carrier? (STATE_HOME precedent: the `homePath` centre capability was retired as unnecessary
   once a public path was proven — `state-home/PRODUCTION-HOME-DESIGN.md` (g).)
3. Root-ness: do we spend ONE pre-registered start to witness `assertLiveRoot` for a governed
   member (`ui:live-root-law`), or decide S1 on the reading that a Team member's Agent is its own
   Session root?
4. Ledger presentation at G5: does the `ask_user_question` `L4-positive` reason line move to cite
   this memo now (with `pr:` still `#405`), or only when a positive arm lands?
5. Placement and addressee of this memo (`docs/plans/memo/…` vs `docs/issues/…`) — see
   `PROPOSAL-PLACEMENT.md`; naming and landing are the coordinator's/user's call.
