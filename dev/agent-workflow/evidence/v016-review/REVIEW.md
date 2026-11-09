# V016-REVIEW — independent review of the joint Alpha.5 + Alpha.6 close-out

**Candidate:** `c66fa8b03` (`origin/integration/v0.1.6`), worktree `.worktrees/v016-review`, branch
`review/v016-20261109`.
**Candidate stack:** `c66fa8b03` V016-VERSION (#695) → `df58993f9` PD-38/PD-39 (#694) →
`f5dcb9952` A6-GAPS (#693) → `0f1106ae0` A56-SEMANTICS (#692).
**Reviewer posture:** adversarial, read-only on product code. No product file was modified. Two
temporary host-free test files were created under `packages/runtime/test/`, run, and deleted before
this commit (`git status --porcelain` clean apart from this document).
**Evidence class of this review:** measurements below are host-free or repository gates; no `V@B`,
no matrix grade, no release grade is granted or implied.

---

## 0. What was run / read

| # | What | Result |
| --- | --- | --- |
| M1 | `npx vitest run packages/runtime/test/a6-` | **200/200 passed** (21 files), incl. `a6-root-wiring` 11/11 |
| M2 | `npx vitest run packages/runtime/test/a56-input-provenance.test.ts` | **9/9 passed** |
| M3 | `npx vitest run packages/tools/a5p5-tools/test/a5p5-parity.test.ts` | **17/17 passed** |
| M4 | `npx vitest run packages/runtime/test/member-stop-model.test.ts` + `packages/client/test/team-member-stop.client.spec.tsx` | **13/13 + 8/8 passed** |
| M5 | `npx vitest run packages/runtime/test/plugin-dsh-compat.test.ts` | **7/13 passed; 6 fail** with `Cannot find module …/app-boot/lib/index.js` because the pristine host checkout is unbuilt (`lib/` is gitignored) — environment, not candidate. The **#689 manifest-pin leg passes**. |
| M6 | `node scripts/check-artifacts-at-head.mjs` / `check-artifacts-committed.mjs` | `verdict=ok compared=2082 drift=0` / `verdict=ok compared=2082 glue=111` |
| M7 | `node scripts/docs-probe.mjs --base f5dcb9952` | `blocking=0 non_blocking=0 advisories=2` (both `DOC_IMPACT_*`, advisory) |
| M8 | `pnpm -r run typecheck` | **9/9 packages Done** |
| M9 | `node scripts/lint-identities.mjs` | 0 findings, exit 0 |
| M10 | `node scripts/check-install-manifest.mjs` on `c66fa8b03` **and** on `87484ded1` | **both FAIL with the same 14 computed-specifier issues** (555 base visits vs 578 head visits) — pre-existing on Preview master, not a candidate regression (see N5) |
| M11 | **Scratch boot A** (production root, stub model, A6 ON, one Officer instance, **no review latch**): call `root.alpha6WakeUserStop(officerChildSessionId)` | returned **`false`**, **no `stopped-*` file** under the configured `alpha6WakeIntentPath` (see P1-2) |
| M12 | **Scratch boot B** (production root, stub model, A6 ON, **zero** Officer instance rows): boot | **booted** — no `TEAM_PLUGIN_CONFIG_INVALID` (see N3) |
| M13 | `/tmp` probe of `input-provenance.mjs` internals (no repo change): classify work / root-work / handoff-context, with and without a noted ledger entry, after 1024 evictions, and human text starting with an envelope | work & root-work: machine in every case (durable envelope); **`handoff-context …`: machine only while the process-local ledger remembers it, human after a fresh ledger / eviction**; human text starting with `[team-work requestToken=` is machine; two leading spaces or a mid-body occurrence are human (see N1, N6) |

Read in full for this review: `docs/ROUTER_RULES.md` §0, `docs/TEST_METHODS.md`,
`docs/plans/active/alpha5-sandbox-first/RELEASE-NOTES-0.1.6.md`,
`PREVIEW-CONTRACT-2026-11-16.md`, `PRODUCT-DEBT-REGISTER.md` (PD-36…PD-39),
`RUNBOOK-CONTROL-ABANDONED.md`, the evidence READMEs/logs under `a56-semantics/`, `a6-gaps-final/`,
`a6-gaps-g1-normal-r14/`, `a6-gaps-g1-neg-r13/`, `a6-gaps-g2-unclaimed-r11/`,
`a6-gaps-g2-claimed-r10/`, `a5sf-pd37-installed-tools/`, `a5sf-pd34-member-stop/`,
`a5sf-pd35-stop-outcome/`, `a5sf-pd31-read-image/`, plus the source and dist around
`input-provenance.mjs`, `host.ts` (A6 listeners), `agent-bindings.mjs` (producers/ledger/port),
`root.ts` (wake wiring, recovery), `alpha6/*.ts`, `control/service.ts`
(`assignedOfficerCapability`), `packages/tools/src/tools.ts`, `packages/tools/a5p5-tools/src/*`,
`cordis.patch.yml`, `package.json`.

---

## Blockers (P0)

**None found.** Stated plainly because it is the load-bearing negative of this review:

- the provenance arbiter is **fail-closed** at the only call site that matters (a throwing or
  malformed arbiter is treated as `machine === true`, so an exception cannot clear a Sticky Stop —
  `host.ts:3131-3143`);
- the ledger is bounded (1024, FIFO) and the two deliveries that *must* carry the human attribution
  for A5 goal authority (work, root-work) are covered by the **durable** text envelope, so restart
  amnesia and eviction do not downgrade them (M13);
- a `Member` cannot obtain resolver authority by passing `assignedOfficer: true`: with the trusted
  ports absent the service fails closed with `CONTROL_RESOLVER_NOT_AUTHORIZED` before any write
  (`control/service.ts:2993-3022`, `3237-3265`); M1's PR5 suite drives the negative legs;
- a machine cancel no longer writes a human Sticky Stop: every remaining `cancel({kind:'user'})`
  producer is gone from product source (`agent-bindings.mjs` work-delivery abort and PD-29 interrupt
  now use `{kind:'hook', …}`; only a doc comment at `agent-bindings.mjs:314` still lists the old
  shape);
- A6 is off by construction when the opt-in is absent: the composition thunk is never invoked and
  the control service receives no A6 port (`root.ts:3180-3191`, `alpha6/root-composition.ts:77-92`),
  pinned by M1.

---

## Should-fix (P1)

### P1-1 — The Stable "Ordinary install" row is evidence transferred from a *different artifact*; the 0.1.6 tarball was never packed or installed

- **Claim:** `RELEASE-NOTES-0.1.6.md:56` — "**Ordinary install** | `pnpm pack` → `dsh plugin
  --profile web add <tarball>` → `dsh web` executes tools with a real model. The measured run
  covered …" — placed in the table §2.1 defines as *stable* ("we will not change these semantics
  without a version boundary").
- **Reality:** the only measured run is `dev/agent-workflow/evidence/a5sf-pd37-installed-tools/`,
  and its artifact is **`dsh-agent-team-0.1.1-alpha.2.tgz`, 4 210 077 bytes, sha256 `61fd2e48…`**
  (`README.md:85-86`), built on the PD-37 tree `b5233f440`. The measured product head is **281 files
  and 27 257 lines away** from `c66fa8b03` (`git diff --stat b5233f440..c66fa8b03 -- . ':!dev'
  ':!docs' ':!*.md'`), including the A6 host/root/bindings merge, the a56 provenance law, the A6-GAPS
  tool-pipeline change and every rebuilt `dist` file. No `0.1.6` tarball exists anywhere in
  `dev/`/`docs/` (search for `0.1.6.tgz` / `dsh-agent-team-0.1.6`: zero hits).
- **Second defect in the same row:** "`n=1` is an existence proof, **not a stability claim**" sits
  inside the table whose rows are defined as stable — a self-contradicting classification.
- **What was run/read:** the PD-37 README and its artifact hash; the diff between the PD-37 tree and
  the candidate; the manifest diff (the only change is `version`, so the *mechanism* is
  manifest-identical — this is why the finding is P1 and not P0).
- **Severity:** P1 — evidence integrity. The artifact the notes vouch for is not the artifact that
  was exercised, and the classifier of the row contradicts its own text. A reader cannot tell
  whether "ordinary install" is measured on 0.1.6 or inherited.
- **Would falsify:** pack `c66fa8b03`, install the resulting tarball into a pristine profile with
  the documented command, and run the PD-37 driver against it (real model, `web_fetch`, fs
  write/read, a two-round goal, Stop). If that passes, the finding downgrades to "relabel the row
  as re-measured" — the wording still has to lose the stable/existence-proof contradiction.

### P1-2 — Sticky Stop is *latch-scoped*, not session-scoped: a human Stop with no pending review latch is silently dropped (measured)

- **Claim:** `RELEASE-NOTES-0.1.6.md:68` — "**Sticky Stop** (durable human-Stop marker; machine
  relays cannot clear it)"; `root.ts:2747-2752`'s own comment — "The marker is written BEFORE the
  reducer so a restart between the two cannot lose the Stop"; PD-38's backstop — "a human Stop
  leaves a durable marker, survives SIGKILL+restart".
- **Reality:** the only writer is inside a branch that requires an **existing in-memory latch
  coordinator for that session**:
  `root.ts:2755-2762` — `const coordinator = alpha6WakeBySession.get(targetSessionId); if
  (coordinator === undefined) return false` → `alpha6WakeIntents.markStopped(...)`.
  `alpha6WakeBySession` is populated only by a wake dispatch (`root.ts:2608`) or by boot recovery
  from an intent row / stopped marker (`root.ts:2942`, `3026`); a reviewer between asks — or after a
  restart before the next ask — has **no coordinator**. The host listener (`host.ts:3113-3120`) calls
  the function on a real `turn/end` abort with `kind:'user'`, discards the boolean, and the Stop is
  forgotten.
- **Measured (M11):** production root booted with A6 ON and exactly one Officer instance, no latch:
  `alpha6WakeUserStop(<officer child session>)` → **`false`**, and no `stopped-*` file was created
  under `alpha6WakeIntentPath`. Consequence: the next review wake for that reviewer dispatches
  normally (the marker that recovery/`whenStopped` would consult does not exist), i.e. a human Stop
  issued between asks does not stick. This is not a machine *clearing* a marker (the marker was never
  written), so it is not an escalation from machine to human — it falsifies the unqualified
  "durable human-Stop marker" and the claim's "every automatic activation is suspended" intent.
- **What was run/read:** the root stop body, every `alpha6WakeBySession.set` site, the host listener,
  the boot-recovery marker/intent loops, and the scratch boot A above.
- **Severity:** P1 — a stated guarantee of the experimental plane is conditional and the condition
  is not disclosed; the failure mode is silence (no typed refusal, no fact, no log).
- **Would falsify:** call `alpha6WakeUserStop` on a session with no latch and observe a `stopped-*`
  file (then the finding is only about my scratch harness), or show a production path that creates a
  coordinator for every live reviewer session at boot.
- **Smallest honest fix:** either persist a **session-scoped** stop marker that boot recovery can
  adopt into a future latch (the marker store already keys by root/reviewer/generation; a
  reviewer-level row would do), or state the latch-scoped condition in §2.2 and §4 and stop calling
  the marker unconditional.

### P1-3 — A machine relay now removes `create_goal` authority from the relay-started turn, unconditionally and undisclosed; the Stable "Goals" row reads as if it cannot happen

- **Claim:** `RELEASE-NOTES-0.1.6.md:52` — "**Goals** | `create_goal` / `get_goal` /
  `update_goal` work on a governed Member …" (stable table). §2.2's default-off statement is
  narrower ("the object handed to the control service is byte-identical", line 33), so the notes
  never say the *default path's* message identity also changed.
- **Reality:** `agent-bindings.mjs:5447-5456` (relay/`team_send_message` producer) now sets
  `source: input.attribution.fromHumanId === undefined ? TEAM_PRODUCER_SOURCE : { kind: 'user' }`
  and notes the machine message. This is **not** gated on `config.alpha6ReviewRouting`; on
  `87484ded1` the same producer was `{kind:'user'}` unconditionally. Upstream
  `hasDirectHumanInput` (`tests/deepseek-harness-test-use/packages/goal/tool-goal/src/authority.ts:80-84,100-103`)
  refuses `create_goal` unless the open turn contains a `user/message` with `source.kind === 'user'`,
  so a Member whose turn was started by a Leader's `team_send_message` (or any machine relay) can no
  longer create a goal — **with Alpha.6 off**. The a56 lane chose this split deliberately (a relay
  with `user` would clear a human Sticky Stop), and `a56-semantics/README.md:153-162` says "A6 off
  (default) ⇒ Alpha.5 behaviour", but the 19/19 E2E it cites exercises *delegate work*, not
  a relay-started goal turn; the statement is therefore stronger than its evidence.
- **What was run/read:** the producer diff against `87484ded1`, the upstream authority predicate, the
  a56 README §6 and its 19/19 log, the E2E driver's tool roster (it denies the host `send_message`,
  never exercises `team_send_message`).
- **Severity:** P1 — the notes' stable Goals row overstates what a governed Member can do; this is
  not a security regression (the machine cannot gain human authority), but it is exactly the kind of
  undisclosed behavioural divergence a close-out review exists to catch.
- **Would falsify:** boot a Team with A6 off and a Leader/relay-started Member turn, call
  `create_goal` in it, and show it succeeds; or point to the release-note sentence that discloses the
  limitation (I found none; §4 has no goal-authority item).
- **Smallest honest fix:** add a §4 known-limit entry ("a turn started by a machine
  relay/message carries the producer kind and cannot authorize `create_goal`; work delivery,
  root-work and a human `member.send` can"), or gate the relay attribution on the A6 opt-in so the
  Alpha.5 path is literally unchanged — and then say which one the release promises.

---

## Notes (P2)

### N1 — `handoff-context` is a third human-attributed producer that is not in `TEAM_MACHINE_ENVELOPES`, and the law's "complete list" claim is false

- `input-provenance.mjs:70-76` says "adding one here is a decision about a NEW producer, and the
  classification suite pins the list against the producers"; PD-38 `PRODUCT-DEBT-REGISTER.md:1043`
  item (5) says the durable half is "the frozen envelopes … a new producer that renders a different
  text shape must add its envelope". But `root.ts:622` builds
  `` `handoff-context ${contextToken}\n…` `` and `agent-bindings.mjs:5747` delivers it with
  `source: machineSource ? TEAM_PRODUCER_SOURCE : { kind: 'user' }` plus a ledger note — a
  human-attributed, **envelope-less** delivery. Measured (M13): with a fresh ledger (the restart case)
  or after 1024 evictions, `handoff-context …` classifies as **human**.
- Impact today is latent: the B6 handoff target is a freshly created root and Sticky Stop markers
  exist only for reviewer sessions with a wake coordinator, so I found no reachable machine→human
  escalation. The defect is that the law's enumeration and its "the suite pins the producers" claim
  are incomplete, and the next human-attributed producer added on a stopped session will silently
  clear the marker. Add `[handoff-context ` to the envelope list (it is token-leading) and a
  classification leg.
- Falsifier: a restart with an unclaimed `handoff-context` message on a session carrying a Sticky
  Stop, showing the marker survives.

### N2 — `A6-26` / `A6-27` are reused for different assertions in different evidence sets

`a56-semantics/05-a6-kit-run.log:17-18` defines A6-26 = "relay/work delivery does not clear Sticky
Stop" (PASS) and A6-27 = the work-delivery arm (PASS); `a6-gaps-g2-unclaimed-r11/run.log:16` defines
A6-26 = the accepted-not-claimed abandonment (FAIL) and `a6-gaps-g1-normal-r14/run.log:22` defines
A6-27 = execution-result `succeeded` (PASS). `RELEASE-NOTES-0.1.6.md:154` then cites a bare "check
`A6-26` FAIL". A reader following that id into `a56-semantics/` lands on a PASS for a different
assertion. Cite `a6-gaps-g2-unclaimed-r11/run.log` by path and text, or rename the A6-GAPS ids
(e.g. `A6G-26`), before the register and the notes are read together.

### N3 — "zero or multiple Officers is a configuration refusal" is not a boot-time refusal (measured)

`RELEASE-NOTES-0.1.6.md:66` and `:104-105` say a missing part is a boot-time
`TEAM_PLUGIN_CONFIG_INVALID` and that "zero or two [Officers] is refused". The live composition never
reads members at boot — it passes a synthetic one-element list
(`alpha6/root-composition.ts`, `activeMemberTemplateIds: [officerTemplateId]`), so only a missing or
Leader-equal `officerTemplateId` can refuse at boot (`alpha6/composition.ts:63-82`). **Measured
(M12): a Team with zero Officer instance rows boots successfully.** The zero/multiple check is the
per-query `officer-instance-count` refusal in `alpha6/assigned-officer-facts.ts:386-437` (fail-closed,
which is good). Reword to "zero or multiple live Officers is refused when a review is attempted"
rather than "configuration refusal"/"boot-time refusal".

### N4 — Stale "unwired in production today" note in the authority-adjacent module

`alpha6/assigned-officer-facts.ts:62-65`: "The module is unwired in production today (see the PR5
design note)". It **is** wired: `createAlpha6LiveRootComposition` calls `createAlpha6ControlPorts`
and passes both ports to the control service (`alpha6/assigned-officer-facts.ts:524-575`,
`root.ts:3180-3190`). A reviewer relying on that sentence would under-estimate that a Member can be
a resolver when the trusted current-reviewer port confirms it. Delete or date the sentence.

### N5 — `check:install-manifest` is red at HEAD, but at the same value as the base — do not attribute it to this candidate

M10: 14 computed-specifier issues on both `c66fa8b03` and `87484ded1` (the touched files are the
web-family / realm-row / team-services web transports, untouched by the A6 merge). The repo has
precedent for "same as base" on this gate (`SESSION_ROUTER_LOG.md:8359` records "8 issues = base
树同值"). I record it so the next reader does not mistake it for candidate drift, and because the
"Ordinary install" row should rest on the packed-tarball smoke (P1-1), not on this gate.

### N6 — Envelope forgery is human→machine only (fail-closed, self-inflicted)

A human chat message whose text starts with `[team-work requestToken=` (or starts with newlines that
the classifier strips) is classified **machine**, so it cannot clear that human's own Sticky Stop; a
mid-body occurrence or a two-space indent stays human (M13). This is the safe direction (a machine
input can never be forged *into* human), but it is worth a one-line disclosure next to the envelope
list: the prefix is reserved in model-visible text.

---

## 1. Claims vs implementation — classification

`(a)` measured on this candidate · `(b)` inferred from code read on this candidate · `(c)` unsupported
on this candidate.

| Claim (source) | Class | Basis |
| --- | --- | --- |
| "A6 default-off: with the opt-in absent/false the composition thunk is not invoked" (`RELEASE-NOTES:36-38`) | **(a)** | M1 `a6-root-wiring` 11/11 incl. thunk-never-invoked + no legacy A6 surfaces; `root.ts:3182-3190` adds no port in `legacy` |
| "…the object handed to the control service is byte-identical to the Alpha.5 wiring and no A6 parse/member read/port exists" (`:33`) | **(a)** for "no port / no parse at boot"; **(b)** for "byte-identical object" | M1 + `root.ts:3160-3191`; no test byte-compares the constructed object |
| "Sticky Stop: durable human-Stop marker; machine relays cannot clear it" (`:68`) | **(a)** for "machine relays cannot clear it" (arbiter + claim path); **falsified as stated** for "durable human-Stop marker" (P1-2, M11) | M1/M2, M11, `root.ts:2755-2762` |
| "Per-Member Stop: after the pause ACK there is no continuation" (`:53-54`) | **(a)** for 20 000 ms / two boots on the Preview line (`a5sf-pd34-member-stop/` agreement 6/6, 0 rounds / 0 calls / 0 requests); **(b)** for unbounded continuation | the candidate changes only the *classification* of the stop outcome; the host stop path, `goals.pause`/`goals.disarm` and the goal driver are byte-identical to `87484ded1` (`git diff` on `host.ts` is A6-only, confined faces empty) |
| "Goals work on a governed Member" (`:52`) | **(a)** for a work-delivery-started turn (19/19 E2E); **overstated** for a relay-started turn (P1-3) | M1/M2; producer diff; upstream `hasDirectHumanInput` |
| "Ordinary install … measured run" (`:56`) | **(c) on this artifact** | P1-1 |
| "Officer plane … zero or multiple Officers is a configuration refusal" (`:66`) | **falsified as stated** (N3, M12) | M12; per-query check only |
| "Review wake needs the wake seam + `reviewWakeInbox`; without them the Team refuses to boot" (`:67`) | **(a)** | M1 (`a6-root-wiring`: two refusal legs) |
| "A6-26: accepted-but-unclaimed wake is terminally abandoned; not decidable; no duplicate" (`:143-158`) | **(a)** | `root.ts` recovery/abandonment code read; `a6-gaps-g2-unclaimed-r11` log + JSON; `RUNBOOK-CONTROL-ABANDONED.md` |
| "PD-39 gap 1 (execution-result writer) fixed; durable `succeeded` fact" | **(a)** | `register.ts:269-276` (hook now in the deps object) + `pipeline.ts:186-201`; `a6-gaps-g1-normal-r14` `outcome=succeeded facts=1`; product source identical between measured `9ab4b5768` and merged `f5dcb9952` (empty diff in `packages/runtime/src` + `packages/tools/a5p5-tools/src`) |
| "read_image conditionality / governed web / confined I/O unchanged" | **(a)** for read_image evidence, **(b)** for "unchanged" | `a5sf-pd31-read-image/`; `git diff 87484ded1..c66fa8b03` on the confined-face modules and `a5sf-realm-row.mjs` is **empty** |
| "#689 manifest fix (15 optional peers, no profile `dsh-tools`)" | **(a)** | M5 manifest-pin leg; `package.json` peer block read (15 entries, all `optional: true`, all `0.2.0-rc.2`) |
| "No `reviewRouting` snapshot or second approval ledger is created" (`:110-111`) | **(b)** | no `reviewCase*`/second ledger found; review legs ride `approvalCaseId` on the control ledger |

**Seam answers explicitly asked for:**

- *Exception behaviour:* fail-closed to machine, measured by code at the only call site
  (`host.ts:3131-3143`); not pinned by a unit leg (the arbiter's own throw path is not exercised by
  `a56-input-provenance.test.ts`). I would add that leg, but its absence is not a defect in the
  current wiring.
- *Member marker/envelope forgery:* a Member cannot write the marker store through the governed
  faces (the path is deployer config, outside the confined faces) — **(b)**; a Member cannot forge a
  human message (all its producers are machine) — **(a)/(b)**; a *human* can accidentally type the
  envelope (N6, self-DoS only).
- *Ledger bounding/exhaustion:* 1024 FIFO, `note()` silently skips id-less messages
  (`input-provenance.mjs:127-130`) — fail-open toward the envelope (safe for work/root-work, unsafe
  for handoff, N1).
- *Restart amnesia:* disclosed (`a56 README §7.1`, PD-38 item 5); correct for the two envelopes,
  incomplete for handoff (N1).
- *Machine↔human conversion:* only handoff-context (N1, latent) and the human-typed envelope (N6,
  fail-closed). No machine→human path that widens authority.

---

## 2. A5 regression risk (shipped guarantees)

- **PD-29 / PD-34 stop semantics:** the candidate's `host.ts` diff is A6-only (every added hunk is
  the sticky-stop/listener block; no change to `session/cancel`, the goal driver, or the turn/end
  stop path), and `packages/runtime/src/plugin/live/confined-*.mjs` + `a5sf-realm-row.mjs` are
  untouched (empty diff). PD-34's evidence therefore transfers on mechanism; its 20 s window remains
  the measured bound.
- **PD-35 three-way outcome:** only the classification/reporting changed (`packages/client/src/model/member-stop.ts`
  and the client spec); the three outcomes and the "pause's 200 is never the oracle" rule match the
  code and the PD-35 evidence (`stopped` / `pause-contradicted` / `pause-unverified`). M4 green.
- **#689 manifest fix:** present and pinned; no `dsh-tools` in the profile graph; 15 optional peers at
  the host pin.
- **Web / `read_image` conditionality:** unchanged at file level; the `read_image` deny-before-I/O
  behaviour rests on PD-31 evidence and the untouched realm row.
- **Artifacts:** the shipped `dist` is fresh against source at HEAD (M6, drift 0 over 2082 files).

---

## 3. Evidence hygiene

- **Good:** no evidence README claims `V@B`, a matrix grade, or `CANDIDATE-C2`; the `DEV-LIVE` class
  is used honestly (`a6-gaps-final/README.md:5`, `a5sf-pd37-installed-tools/README.md:6,171`). The
  PD-37 artifact hash change is recorded with a dated superseding note rather than silently moved.
  PD-39's two findings are kept separate and the owner ruling (no automatic redelivery) is recorded
  in both the register and the runbook.
- **Bad:** the install row's artifact transfer (P1-1); the A6 id collision (N2); the missing
  `handoff-context` producer in the "pinned list" (N1).

---

## 4. Verdict

**P0: none.** The artifact's default path is the Alpha.5 path (A6 wiring is not constructed when the
opt-in is absent), the arbiter is fail-closed, the two goal-bearing deliveries keep their durable
coverage, and the A5 stop/realm/manifest semantics are unchanged at file level. The A6 plane's known
abandonment defect is disclosed with a runbook and a narrowed promise.

**Fit to tag `v0.1.6-rc.1`?** Not with the release notes as written: the three P1s are the release's
own contract — one transferred measurement, one silently dropped guarantee, one undisclosed
behavioural narrowing. All three are correctable without touching product architecture (re-pack and
smoke the exact 0.1.6 tarball; either persist a session-scoped stop marker or state the
latch-scoped condition; add the relay goal-authority limit to §4 or gate the attribution). The
product bits themselves are rc-ready for an *experimental* A6 plane; the stable Alpha.5 plane shows
no regression I could find.

**Before `v0.1.6` (final):** (1) fix or disclose P1-2 and, if the fix is a marker change, prove it
with a boot that has no latch and a restart; (2) install-smoke the exact `0.1.6` tarball (P1-1);
(3) settle P1-3 in the notes; (4) close N1 before *any* new human-attributed producer ships, and N2 /
N3 / N4 as text fixes. N5 is pre-existing and should stay attributed to the base; N6 is a one-line
disclosure.

*Reviewed against `c66fa8b03`; no product file modified; scratch test files removed. If a later
commit changes the findings above, this document is superseded, not amended.*
