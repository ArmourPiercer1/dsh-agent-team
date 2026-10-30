# O2-B — `present`: no reviewed publish SERVICE exists to delegate to (public-interface proposal)

> **DRAFT — proposal memo for public-interface process.** Not a ruling, not a plan change, not a
> product change; whether it lands, under what name, and in which directory is the coordinator's/
> user's decision (see `PROPOSAL-PLACEMENT.md` next to this file).
>
> **Dated banner (real UTC 2026-10-30T14:0xZ, lane `u7r3-o2memo`, seat: delegated subagent on the
> harness-reported model qwen3.8-flash-next, disclosed; ROUTER_RULES §0.2 — independence =
> independent sessions).** Format mirrors the STATE_HOME six-question memo
> `docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`
> (dated banner → lettered question sections → ranked options → guards unchanged → acceptance core
> → open questions), the pattern named for exactly this gap by
> `.artifacts/ops/UI-BLOCKER-SCOPING-20261030.md:92` and followed by the memo this one supersedes
> as its starting point, `PRESENT-PUBLISH-GAP-MEMO.md` (PR #489, banner: 「格式比照 … 六问式」).
> **`CORE_SEAM_BLOCKER` STAYS UNNAMED — this is not a blocker filing.** The blocker's own proof
> obligation (`docs/ROUTER_RULES.md:130`: 定位精确缺失的 public behavior → **证明无既有 public
> composition path** → 停掉该 feature → fixed-format output) is *not* met, and this memo is the
> attempt that tries to meet the "is there a public-interface route?" question head-on:
> **this memo IS the O2 attempt.** If it is judged insufficient later, that is a later, dated
> decision with this document as its input — not a conclusion of this one.
> Authority for what the Host *is*: pristine `tests/deepseek-harness-test-use` @
> `639ed015397290b3745d163aafe02ffee4aa3f84` (this lane `rev-parse` = that SHA,
> `status --porcelain` = 0 lines; read-only, never edited). Authority for what we are: this
> repository at branch `task/u7r3-o2memo-20261030`, base `e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8`
> (origin/master tip at spawn). **MEMO-ONLY: zero starts, zero boots, zero `packages/**` change.**
> **Date law (CLOCK-ANCHOR):** banners carry real UTC (`date -u` measured this lane);
> lane/evidence labels follow the session calendar whose mapping to real UTC is ruled in
> `dev/agent-workflow/gates/CLOCK-ANCHOR-20261030.md` §3 (`:55` 真实 UTC = 标签日期 − 1 天); this
> round's lane labels (`u7r3-o2memo-20261030`, and the read lanes `u7r3-uif4-20261030` /
> `u7r3-uileg0-20261030`) carry the real-UTC date of their run, while the cited
> `USER-RULING-20261031.md` / `BOOT-BUDGET-20261031C.md` are session-calendar names (real
> UTC 2026-10-30 per that mapping and its §5 addendum).
> **Citation status:** `dev/agent-workflow/evidence/u7r3-uileg0-20261030/` (PR #489) and
> `dev/agent-workflow/evidence/u7r3-uif4-20261030/` (PR #491) do not exist on origin/master; they
> are cited as pending-merge paths and were read with `git show <branch>:<path>`. Every
> host/plane `file:line` was spot-verified at the pin by this lane; no chain was re-derived.

## (a) Question 1 — current behaviour, and the shape of the gap

| row | fact | anchor |
| --- | --- | --- |
| the acceptance cell | `present` is `L1/L2/L3 = PROVEN`, **`L4-positive = DISCLOSED`**, reason line verbatim: 「the present publication face exists on no host ctx service」 | `dev/agent-workflow/ledgers/u7-tool-acceptance.json:653-682` (reason `:678`, `pr: #405`); G5 criterion = item-by-item functional positive control, `docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md:148` |
| our row's law | the family adapter **deliberately answers NO `present` face**, so a present row mounted through it fails closed on its port check: 「the host has NO session-facing service for deliverables (`present` writes its own Session append from the tool row)」 | `packages/tools/ui-family/src/ui-interaction-port.mjs:35-40`, faces enum `:49`, gate `:56-58`; `packages/tools/families/ui.mjs:32-39`; refusal `packages/tools/ui-family/src/present-executor.mjs:203-205` (`UI_PRESENT_PORT_ABSENT`, zero effect) |
| the Host's reality | native `present` is **not a service**: the tool row itself validates (agent Session `:77`, open turn `:78-79`, `maxFiles` `:80`, per-file lstat/resolve/stat `:87-93`), returns `{turn, files}` `:96-97`, and a `tools/result` hook on the SAME row performs the durable publication `session.append('deliverables/presented', { turn, callId, files })` `:100-108`; its injected services are `['tools','fs','sessionProjections']` `:26` | `packages/deliverables/tool-present/src/index.ts:26,76-79,80,87-93,96-97,100-108` |
| the catalog | the generated public ctx catalog — the exhaustive set `cap.hostService(name)` can ever reach — contains **no** deliverable/publish/present service key; the four signatures carrying those words mean something else: `publish(topic, payload, monotonicMs)` (inspector telemetry), `presentAs(mode)` (tool presentation mode), `dispatch(delivery)` (webhook), `configure(presentation)` (fiber) | `packages/extensions/tool-cordis/src/api-catalog.ts:83-3758` (`SERVICE_API`), near-miss signatures at that range; the plane seam is `packages/runtime/src/plugin/live/team-tool-plane.mjs:1602-1608,1629` |
| the live witness | with the family mounted on a real Host, `governed-present port-refusal` fired, the tool_result carried `refused-admission UI_PRESENT_PORT_ABSENT`, the planted file's SHA was unchanged, and the cell took **zero extra boots** | PR #491 `u7r3-uif4-20261030/README.md` per-cell row `ui:present-env-truth` **PASS**; `c2/run-p2.stdout.log:12` |

So the gap is **not** "no bytes can reach disk". The event *type* is registered in core
(`packages/core/session/src/known-event-types.ts:36` — `'deliverables/presented'`) and the append
channel is the Session's own public API, so the vocabulary is forgeable by any row that can name a
Session. What is missing is a **reviewed publish SERVICE a governed row may delegate to** — the
thing that makes the effect attributable, admitted, and shaped. That is what makes this
capability-gap-class rather than verification-class (the distinction `.artifacts/ops/
UI-BLOCKER-SCOPING-20261030.md` §0 draws between the two UI L4 cells), and it is structurally the
same family as `read_image`'s attachment-store cell
(`dev/agent-workflow/ledgers/u7-tool-acceptance.json:120-121`: the closed admission grammar has no
grantable rung for `domain-ref(attachment-store)`) — **same class, different vocabulary and rung:
the two must not be decided together** (`PRESENT-PUBLISH-GAP-MEMO.md` (e)).

**Dated correction this lane owes the record.** The #489 lane records (memo (a) row 2; README Q1 at
`:43`) state the ctx catalog has 128 `ctx.<key>` keys. This lane's recount of the same generated file at the pin gives **91** `SERVICE_API`
entries (`api-catalog.ts:83-3758`), plus 8 client-platform keys in
`packages/extensions/cordis-client-runner/src/client/api-catalog.ts` (6 of them client-only:
`layout`, `locale`, `slots`, `theme`, `uiWorkspace`, `workspaces`). The conclusion is
count-independent — under any of those counts there is no publish/deliverable key — but the number
should be fixed in #489 rather than propagate. Second drift, same file: the #489 memo cites
`tool-present/src/index.ts:27,75-77,105`; at the pin the injected-service list is `:26` and the
agent/open-turn/`maxFiles` law is `:77-80` (the `:105` append line matches).

## (b) Question 2 — who is affected

- **`present`'s `L4-positive` cell**, and through it the Alpha.5 item-by-item positive-control
  criterion (`execution-plan.md:148`); the tool's honest state today is "refuses, verifiably, by
  design", recorded as DISCLOSED and machine-audited (`scripts/eb3-tool-acceptance.mjs`, honesty
  checker per GATE-LEDGER R-G4R-3 note).
- **The `ui-presentation` Domain Authority declaration**: the contribution declares the publication
  effect plus one realm-file READ per presented file (`packages/tools/ui-family/src/ui-family-contribution.mjs:12-15`),
  and that declaration is the whole truth only because the injected-port shape makes "no port
  mounted = no interaction path at all" real. A publish face appearing without a matching reviewed
  effect would break the declared-equals-requested law the #390 review made structural.
- **Any future lane tempted by the imitation route** (append the native vocabulary directly): the
  public faces technically allow it — the event type is core (`known-event-types.ts:36`), `append`
  is the Session's public API (used that way by the native row, `tool-present/src/index.ts:105`),
  and the carrier `exec.agent` is public (`packages/core/tools/src/index.ts:339`) — so an
  injected-in-glue `present` face could exist *tomorrow* without touching upstream. Cost: the
  native law that rides the tool row (`turnBoundary` open-turn `:78-79`, `maxFiles` `:80`, the
  `tools/result` pairing `:100-108`) has to be re-implemented by the imitator, and the plane then
  speaks with the Host's voice. That is the semantic-impersonation risk, stated by the #489 memo
  (c) as a coordinator/owner ruling slot, not a lane decision.
- **Not affected:** the already-PROVEN arms (anchor refusal before port check before PA; the
  byte-identity/exec-time re-read law `present-executor.mjs:109-112,146-148,302-320`; the turn-less receipt
  refusal `UI_PRESENT_RECEIPT_INVALID` `:356-357`, review F-405-3), the Host's own `present`, the
  GUI consumption side (`packages/client/ui-deliverables/src/presented.ts:7,10` — the
  `/api/present.open` / `/api/present.host` routes are registered browser-side by the client
  deliverables plugin, `present-open.ts:20-24`, and read durable events; they are not a delegable
  service), and `read_image`'s cell (separate decision).

## (c) Question 3 — which public surfaces are touched

*Host side (pinned 0.2.0-rc.2):*

1. `ctx.deliverables` — **does not exist**. The exhaustive public enumeration is
   `packages/extensions/tool-cordis/src/api-catalog.ts:83-3758` (91 keys at the pin; freshness-gated
   by `pnpm run verify-cordis-api`, generator `scripts/gen-cordis-api.ts` per that file's header).
2. Neighbour faces, each excluded for a named reason: `sessionProjections` (`register`/`stateOf`/
   `snapshot` — derived read state; the native row only *reads* `turnBoundary` through it,
   `tool-present/src/index.ts:26,78`), `attachments` (prompt-attachment storage, and the very key
   whose admission rung is missing at `u7-tool-acceptance.json:120-121`),
   `fileReferences`/`sessionFileReferences`/`workspaceFiles`/`workspaceChanges` (read/inspect only),
   and the client-side `/api/present.*` routes (read side of the GUI).
3. The publication vocabulary and channel: `packages/core/session/src/known-event-types.ts:36`,
   `Session.append(...)` as used by the native row `packages/deliverables/tool-present/src/index.ts:105`.
4. `tools/execute`-pipeline ownership: the durable append is a *side effect of the tool row's own*
   `tools/result` listener (`:100-108`), which is why no separate service exists to be found.

*Our plane:*

5. `packages/tools/ui-family/src/ui-interaction-port.mjs:49,83-94` — the port contract and its
   three-face enum (`ask`, `askTimed`, `present`); the `present` face is defined and never satisfied
   in production.
6. `packages/runtime/src/plugin/live/family-assembly.mjs:60-74` + `team-tool-plane.mjs:1602-1608,1629`
   — the two existing seams a publish service would ride **without any new plane surface**:
   `cap.hostService(name)` (a lookup by public service name) and `cap.injected` (trusted-mount
   backends, `agent-bindings.mjs:2811-2814`).
7. `packages/tools/ui-family/src/present-executor.mjs:203-205`, `:356-357` — the fail-closed arms
   that must survive whatever is chosen.

## (d) Question 4 — candidate public shapes for a publish service (ranked)

Ranked in the style of `state-home/PRODUCTION-HOME-DESIGN.md` (b): *reuse an existing public path
first; add the smallest centre/Host capability only once the reuse route is proven insufficient;
never patch upstream.*

**N1 — keep the environment truth (status quo, recommended *until N2 is answered*).**
The present arm records its typed refusal as environment truth
(`UI_PRESENT_PORT_ABSENT`, `present-executor.mjs:203-205`; witnessed live with a zero-delta disk
oracle, PR #491 `ui:present-env-truth`), the ledger reason line keeps pointing at a memo, and no
knob is invented (the USER-RULING §三.3/#446 discipline: no dial turned to manufacture a
witness — `dev/agent-workflow/gates/USER-RULING-20261031.md:32-35,60`).
*Cost:* zero, and zero starts. *Limit:* the L4 cell stays DISCLOSED into G5.

**N2 (RECOMMENDED direction) — a reviewed Host-side publish SERVICE, consumed through the seam that
already exists.** Ask for one service on the public ctx catalog — the `cap.hostService('deliverables')`
shape — with a minimal, auditable face: one `publish(files, { callId, signal })` call that owns the
`turnBoundary` open-turn law, the `maxFiles` law and the `tools/result` pairing internally, and
answers `{ turn, files }` (exactly the receipt our port already requires and our row already
validates — `ui-interaction-port.mjs:25-31`, `present-executor.mjs:356-357`).
*Public surface added:* **one key on the Host catalog**; **zero new surface on our plane** — the
lookup seam (`family-assembly.mjs:71`, `team-tool-plane.mjs:1602-1608`) and the port face
(`ui-interaction-port.mjs:49`) already exist, so our adapter would gain a `present` face the same
way it gained `ask`/`askTimed`. *Why this is the正解 direction:* it is the only shape that gives
governance something to review and admit — the effect has an owner, a receipt and a refusal
vocabulary. *Costs/risks:* a cross-repo cycle we do not schedule; the face's shape must match the
native tool's laws or the two publication paths diverge (GUI sees one, plane the other); the Host
may answer with a different decomposition (e.g. a `@Remote` face like
`packages/interaction/user-questions/src/index.ts:164-165`, which serves HTTP callers rather than
plane rows — that variant would NOT close our cell and should be named in the proposal so the
answer cannot quietly be that).

**N3 — a trusted-mount injected `present` face over the public Session append (the imitation
route, in glue, not in the family).** The mount already receives the agent-scoped ctx
(`team-tool-plane.mjs:2039-2048`) and can inject `backends.uiInteraction`
(`agent-bindings.mjs:2811-2814`), and the carrier is public (`core/tools/src/index.ts:339`), so a
mount-owned port could perform the append natively.
*Public surface added:* none upstream; one reviewed glue component on our side.
*Costs/risks:* it re-implements the native row's laws (`tool-present/src/index.ts:78-80,100-108`)
in a second voice; the plane becomes the author of a Host vocabulary row, i.e. the semantic
impersonation the #489 memo (c) books as an owner decision; a divergence in `turn`/`callId` pairing
would be invisible to the GUI consumer. **Not recommended without an explicit, dated ruling.**

**N4 — a new centre capability (plane-side session/append handle in `CAPABILITY_KEYS`).** Strictly
worse than N3: to imitate, the family would also need a Session handle the closed capability enum
deliberately does not carry (`family-assembly.mjs:60-74`, refusal law `:83-92`; the enum's stated
purpose is that a family is handed nothing that reaches authority, `:39-44`). It widens the
protected centre to buy nothing N3 does not already buy. **Not recommended.**

**N5 — declare `CORE_SEAM_BLOCKER` now.** **Not reached, and this memo does not reach it.** The
rule's own precondition is that no existing public composition path exists
(`docs/ROUTER_RULES.md:130`); N2 is a public-interface route that has not been answered, N3 is
technically reachable today, and the pin itself offers a public enumeration to prove a negative
against (the catalog). Filing the blocker today would stop a feature on an unproven negative — the
same class of error the STATE_HOME lane avoided by proving the public `home-paths` export existed
before proposing a centre capability (`state-home/PRODUCTION-HOME-DESIGN.md` (b), (g): the
`homePath` centre interface was **retired as unnecessary** once the public path was proven). The
honest state is: *publish face absent on the pin; route proposed; owner decision pending.*

## (e) Question 5 — migration and governance

- **Who owns each decision.** N2's *face shape* belongs to the Host public-interface process
  (this repo proposes, upstream owns the surface — the same division the STATE_HOME ruling used
  when it required the production home to come from a trusted Host config/public interface,
  `dev/agent-workflow/gates/USER-RULING-20261031.md` §一.2, `:24`). N3/N4 touch **our** centre and
  our trusted mount, and both therefore sit behind the standing gate that precedes any centre
  interface change: independent security review first (`USER-RULING-20261031.md:24`). Whether
  semantic imitation is permissible at all is an **owner (user/coordinator) ruling slot**, not a
  lane's call — the #489 memo books it the same way.
- **Zero-flip migration.** Nothing here changes behaviour on any mount that does not carry the UI
  family (`uiFamilyEnabled`, `packages/tools/families/ui.mjs:62,66`), and no durable data migrates:
  `deliverables/presented` rows are append-only session facts and no historical row is rewritten.
  Under N2 the family gains a port face; under N1 nothing moves at all.
- **Ledger honesty through the transition.** `present` `L4-positive` stays `DISCLOSED`
  (`u7-tool-acceptance.json:676-681`) until a real positive arm exists; the reason line may be
  retargeted at this memo (the `pr:` field stays `#405`), and the honesty checker keeps auditing the
  cell either way. No L1/L2/L3 status moves.
- **If N2 lands, the positive arm is cheap and already specified** (the #489 memo (f) + PR #491's
  proven answering transport): ONE World, ONE leg, judging on publish-receipt `turn` integer + the
  refs verbatim in the tool_result + a GUI-side read-back through the existing
  `/api/present.*` consumption face + an independent on-disk witness; the port-absent negative arm
  must remain reproducible with the knob off; ≤3 starts in the 「其他 Family 的 L3/L4 验收」 pool
  (`USER-RULING-20261031.md:11`), pre-registered per `BOOT-BUDGET-20261031C.md`. **This memo spends
  none of it.**
- **Process hygiene this lane observed.** #489's own memo already declares itself
  「状态：DRAFT，非 memo 正本」 and asks the coordinator where the 正本 lands; this memo keeps that
  posture (evidence dir, DRAFT header) rather than self-promoting into `docs/plans/memo/`.

## (f) Question 6 — non-goals (what this memo deliberately does not decide)

1. **No `CORE_SEAM_BLOCKER` filing** and no claim that O2/N2 is impossible — the banner states the
   reverse: this memo is the attempt, and the blocker's proof obligation is unmet.
2. **No permission to imitate the Host vocabulary.** N3 is described so an owner can rule on it,
   not endorsed; nothing here authorises a plane row appending `deliverables/presented`.
3. **No blueprint or template rulings.** No statement about which blueprints should be allowed to
   present, what `ui-presentation` Domain Authority should default to, or which policy state
   enables it; blueprint default rulings stay with the owner/PR #367 lane, and the lane-scoped-allow
   law is untouched (GATE-LEDGER `:23` R-U6P3-1).
4. **No acceptance or gate movement.** No L-cell changes, no G5 claim, no "verified" language —
   this lane ran no boot and no test beyond `docs:probe`.
5. **No merge with `read_image`.** Same gap-class, different event vocabulary and different
   admission rung; the #489 memo's separation law stands (`PRESENT-PUBLISH-GAP-MEMO.md` (e)).
6. **No GUI work.** The consumption side (`/api/present.*`, turn-deliverables folding) is cited as
   an existing read-back target, not as a thing to build or change.
7. **No upstream patch, ever, from this repo.** AGENTS.md red line and `CORE PATCH BUDGET = 0`;
   N2 is a *proposal to* upstream, not a change to it, and nothing in this lane wrote a byte
   outside this evidence directory.

## Guards that stay UNCHANGED whatever shape is chosen

- The present row's order law: anchor refusal → port check → PA admission
  (`present-executor.mjs:203-205`; the OUTSIDE canary + byte-identity law already live-witnessed
  in #405's f3).
- Exec-time re-read and identity probes stay in the row: escape/drift/hard-link-alias/oversize
  refusals (`present-executor.mjs:146-148,302-320`) — a publish face never buys publication of what the
  member could not read (`ui-family-contribution.mjs:12-16`).
- The receipt law: a turn-less receipt is `UI_PRESENT_RECEIPT_INVALID`, never a silent success
  (`present-executor.mjs:356-357`; port contract `ui-interaction-port.mjs:25-31`).
- The port stays injected, never owned; absent face = typed refusal with zero effect
  (`ui-interaction-port.mjs:6-12,56-58`; `packages/tools/ui-family/README.md` "Owner role").
- Independent on-disk oracle in the positive arm (the runner reads the disk itself, not the row's
  word) — u7-f's runner-own-disk-reads pattern, required by the #489 memo (e).
- `scripts/eb3-tool-acceptance.mjs` continues to audit the ledger cell's honesty.

## Open questions (for the coordinator / owner)

1. **Addressee and shape of the N2 proposal**: one host-facing proposal document for
   `ctx.deliverables.publish(files, {callId, signal}) → {turn, files}`, or a combined
   "UI public-interface" document with O2-A (ask carrier) as its sister section? Should the proposal
   explicitly reject the `@Remote`-only variant so the answer cannot be a face the plane cannot call?
2. **G5 presentation** under N1: does `present`'s L4 go to G5 as a disclosed structural gap (the
   `:678` reason-line shape, cross-referenced to this memo), or does the plan hold the cell open
   until N2 lands?
3. **Is imitation (N3) ever admissible**, and if the owner wants it considered, does it need the
   independent security review that a centre change would (`USER-RULING-20261031.md:24`) — it does
   not touch the centre, but it does widen what the plane can speak as?
4. **Rung parity**: does `read_image`'s attachment-store rung (`u7-tool-acceptance.json:120-121`)
   get its own proposal document so the two same-class cells are decided separately and on their
   own facts?
5. **The 91-vs-128 correction** (see (a)): fix in #489 before merge, or let this memo's dated
   correction stand as the record?
6. Placement and addressee of the two memos — `PROPOSAL-PLACEMENT.md`.
