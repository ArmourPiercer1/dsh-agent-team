# WP1 (P0) — Sticky Stop, measured on both sides of the latch

**CANDIDATE-C2** · candidate `cand-v0.1.6-2` @ `bb3c158eb1f76f8db429da01e9a4c5a0e118ca90`
(`candidate/v0.1.6-2`; measured in worktree `.worktrees/wp1-sticky`, branch
`task/wp1-sticky-20261111`). Host: pristine test runtime
`tests/deepseek-harness-test-use` @ `639ed01539` (0.2.0-rc.2). Driver:
`tests/kits/wp1-sticky-stop/wp1-sticky-stop.mjs`.

This is a **measurement**, not a fix. No product source was changed (the only code
file in the task commit is the kit). Nothing below revises the release notes; where
the wording is imprecise it is named as such.

**Evidence class.** One boot per arm per run, `n=2` per arm on two independent
`DSH_HOME` worlds. **n=2 is agreement, not stability.** One run alone proves
existence of a behaviour; two agree on it.

Measured 2026-11-11, 15:53–15:59Z. Ports: A1 15001/15051, A2 15002/15052,
B1 15003/15053, B2 15004/15054 (loopback only). The stable instance `:3080` was
probed read-only before/after every run (`401` both times); it was never touched.

---

## 1. What was measured, and why both arms

The release notes (0.1.6 §2.2/§4.7) state that the Sticky Stop marker is
**latch-scoped**: the only writer sits behind
`if (coordinator === undefined) return false`
(`packages/runtime/src/plugin/root.ts:2755-2762`). So the product claims:

* a Human Stop **with an active review latch** is durable across a Host restart;
* a Human Stop **without a latch** is *not* protected (PD-40), and the next
  review wake may activate the reviewer again.

The second C2 round measured only the no-latch case; that is one side of the
claim. This kit measures **both**, on the same Host, through the same human Stop.

Arm A uses the supported path: a real v5 Team, a real review wake, then the human
Stop. Arm B uses the same Host and Team shape with **no review wake and no
recovery row**, then the same Stop.

## 2. How the Stop is issued (both arms)

`POST /api/session/cancel` on the Officer's child session → upstream
`session/cancel` → `turn/end` with `reason.kind='aborted'`,
`reason.reason.kind='user'` → the production listener
(`packages/runtime/src/plugin/host.ts:3105-3120`) calls
`alpha6WakeUserStop(sessionId)`. The returned boolean is **discarded** by
production (`void … .catch()`), so the `true`/`false` return is **inferred** in
this evidence, never observed directly:

* `true` is inferred from the marker write — the only `false` return is the
  coordinator-undefined branch, which happens **before** any write;
* `false` is inferred from that branch + the absence of a marker.

## 3. Arm A — supported path (with a latch)

Sequence per run: boot Host A6 opt-in (`config.alpha6ReviewRouting`) with plane
takeover → `team.create` of a v5 Team → Officer + worker → worker's bash ask mints
a `parameter-permission` leg (Leader) and its allowed PA leg (`team-tool-execute`,
operation-tool facts) routed to the Officer → **real review wake dispatched** →
human Stop on the Officer session → relay test → SIGKILL + cold boot on the same
`DSH_HOME` → a fresh review ask for the same reviewer.

### 3.1 Results

| criterion | A1 | A2 |
| --- | --- | --- |
| **A1** wake before Stop (durable intent row + model-visible turn) | `wake-4d0d4438.json`, model seq **14** | `wake-6d24ff71.json`‑family, model seq **14** |
| **A2/A3** human Stop accepted (`/api/session/cancel` → 200, `ok:true`) | ✓ | ✓ |
| **A3** marker written, name/path/key/content match | `stopped-4d0d4438.json` ✓ | `stopped-6d24ff71.json` ✓ |
| **A5a** machine `member.send` (Leader caller) | 200, outcome `delivered`, marker intact, wakes 1→1 | same |
| **A5b** machine `member.followup` | 200, outcome `executed`, marker intact, wakes 1→1 | same |
| **A4a** marker survives SIGKILL + cold boot byte-identical, no wake at boot | ✓, wakes 1→1 | ✓, wakes 1→1 |
| **A4b** new review leg for the SAME reviewer after boot | legs 2→**4** (`parameter-permission`, `team-tool-execute` ×2), **0** new wake turns, marker intact | same |

Both runs: **6/6**. The decisive fields agree.

### 3.2 Exact marker (A1)

Path (under the documented `<alpha6WakeIntentPath>/`):

```
<DSH_HOME>/alpha6-wake-intents/stopped-4d0d4438.json
```

(concretely `…/tests/homes/wp1-sticky-a1-2026-11-11T15-53-42/alpha6-wake-intents/stopped-4d0d4438.json`)

Content, byte-for-byte:

```json
{"key":{"reviewerInstanceId":"inst-0oe8p9h1dxat","rootSessionId":"session-wp1-team-2026-11-11T15-53-42","sessionGeneration":1},"ownerRootSessionId":"session-wp1-root-2026-11-11T15-53-42","stopped":true,"targetSessionId":"session-team-child-5fad3fe7e0385ae5ea420364927ea6c5"}
```

A2 differs only in the ids (its own latch hash `stopped-6d24ff71.json`). The
filename is the FNV-1a hash of the latch key
(`rootSessionId \u001f reviewerInstanceId \u001f sessionGeneration`,
`packages/runtime/alpha6/wake-intent-directory.ts`).

**One wording correction worth carrying into the docs:** `ownerRootSessionId` is
the **mount (boot) root that wrote the marker** — `session-wp1-root-…` — **not**
the created Team root (`markRoot`/`markStopped(key, targetSessionId, rootSid)`,
`root.ts:2770`). The release-note text reads as if it were the Team root; it is
not.

The wake intent row (`wake-4d0d4438.json`) was **withdrawn** by the Stop: the
durable wake row list is empty after A3. Existence of the marker *is* the Stop;
there is no "stop fact" in the team ledger.

### 3.3 Relay resistance — measured, and narrower than the phrase suggests

With the stopped reviewer session still live:

* `member.send` (machine caller = the durable Leader `inst-leader`, the production
  `team_send_message` surface) returns **200 / `delivered`**. The team layer does
  **not** refuse the message. The message reaches the stopped reviewer: a model
  request whose last user text contains the relay text was observed (A1:
  `modelSawRelay=true`).
* `member.followup` returns **200 / `executed`** (work admitted). No model turn
  carrying the work text was observed in the 8 s window (`modelSawWork=false`).

In **both** cases the marker file persisted unchanged and the wake count stayed
1→1: neither machine surface **clears the Stop**, and neither re-delivers the
withdrawn review wake. That is the claim the evidence supports.

What it does **not** support is a broader reading of "relay resistance": a
machine message can still be delivered into (and processed by) the stopped
reviewer's session; the followup can still be admitted as work. The Sticky Stop
stops **review wakes**, not every message or work unit reaching the member. If
the intended semantics are "no work reaches the stopped reviewer at all", that is
not what the Host does — and this measurement should not be quoted as if it were.

### 3.4 Cold recovery — the marker is consulted

* SIGKILL, cold boot on the same `DSH_HOME`; marker present and **byte-identical**
  (compared as raw bytes, not parsed JSON).
* Zero new wake turns at boot (wakes 1→1).
* A fresh bash ask from a **second, idle worker created before the Stop** mints
  **new durable legs for the same reviewer**: ledger goes 2→4
  (`parameter-permission`, `team-tool-execute`, `parameter-permission`,
  `team-tool-execute`), yet **no new wake turn** reaches the model and the marker
  is unchanged.

That is the observed consultation: boot recovery registers the marker's latch as
stopped (`root.ts:2936-2952`) and dispatch skips a stopped coordinator
(`packages/runtime/alpha6/wake-dispatch.ts:351`). It is an observed consequence,
not a direct read of the in-memory coordinator.

*Harness note:* the post-boot work is delivered with a **human** `member.followup`
to the idle worker. A Team-managed root cannot be prompted directly after boot
(the host refuses foreign Agent activation: `TeamSessionActivationInterceptedError`,
measured), and a synchronous followup never settles because its member decision
wait is — correctly — held by the stopped reviewer. The driver records the call as
`pending` and witnesses admission through the worker's bash ask and the new legs
instead. This is a measurement-order choice, not a product behaviour claim.

### 3.5 A note on counting wakes

Wakes are counted as **distinct `wakeId`s** observed as a chain's last user text,
not as model requests and not by `messageCount === 1`. A wake turn may make several
model calls, and a recipient session may already carry earlier turns; the earlier
heuristic under-counted in exactly the post-restart case (a re-delivered wake on a
session with history would have been invisible). The corrected counter is what
produced A4a/A4b's 1→1.

## 4. Arm B — documented-unsupported path (no latch)

Sequence per run: the same boot and Team shape, but **no review wake is ever
dispatched** (the worker's only pre-Stop turn is a text-only work unit) → the same
human Stop on the Officer → then one ordinary human turn re-engages the reviewer
(there is no marker; nothing is "cleared") → the Leader delegates a fresh ask to
the worker → the next review wake.

### 4.1 Results

| criterion | B1 | B2 |
| --- | --- | --- |
| **B1** no wake was ever dispatched; no coordinator | `wakeRows=[]`, `stopped=[]`, `wakeTurns=0`, control legs 0 | same |
| **B3** human Stop accepted; no marker; `false` inferred | cancel `ok:true`, `markers=[]`, `wakeRows=[]` | same |
| **B3b** nothing claims durable protection | 0 hits in instance log + every team-domain ledger fact | same |
| **B4** after the Stop + one human turn, next review wake activates the reviewer | new `wakeId` …, model seq **21**, wakes 0→1, 2 new legs, `markers=[]` | new `wakeId` …, seq **21**, wakes 0→1, 2 new legs, `markers=[]` |

Both runs: **4/4**.

B3b's scan covers the host instance log and every durable ledger entry
(`team_domain.json#ledger/<seq>`), excluding the blueprint source blob (it
legitimately contains product text and produced a false positive in a probe).
Zero hits: the no-latch path makes **no** durable or UI claim that the reviewer
was "stopped".

### 4.2 What the next wake does — plainly

After the Stop, with **no** further human interaction, the immediately next review
ask **does not reach the model and writes no wake intent row**. This was seen in
exploratory probes (4/4), and a control run with **no Stop at all** dispatched the
same ask immediately. The refusal is therefore **Host session state (the aborted
session), not a durable fact**: it disappears as soon as the session runs another
turn, and it would not survive a restart.

Because that refusal is not the product claim under test, the archived B4 sequence
includes exactly that one ordinary human turn, and then observes the disclosed
limit directly: the next review ask is dispatched, a **new** `[team-review-wake …]`
turn starts at the model (`wakes 0→1`, new `wakeId`), and no marker exists before or
after. The reviewer a human "stopped" is active again.

This nuance matters for PD-40 and is stated here rather than hidden: the no-latch
path is not "instantly re-wakeable"; it has transient, session-scoped suppression.
What it does **not** have is anything durable — no marker, no fact, no claim — so
one turn restores it, and a restart leaves nothing behind.

## 5. Agreement

| field | A1 | A2 | agree |
| --- | --- | --- | --- |
| wake before Stop (intent row + model turn) | ✓ seq 14 | ✓ seq 14 | ✓ |
| marker written, documented name/key/content | ✓ | ✓ | ✓ |
| machine send clears marker / re-delivers wake | no / no | no / no | ✓ |
| machine followup clears marker / re-delivers wake | no / no | no / no | ✓ |
| marker byte-identical across SIGKILL+cold boot | ✓ | ✓ | ✓ |
| post-boot new legs for same reviewer / new wake turns | 2→4 / 0 | 2→4 / 0 | ✓ |
| B: coordinator exists before Stop | no | no | ✓ |
| B: marker after Stop | none | none | ✓ |
| B: "stopped" claim on the no-latch path | 0 | 0 | ✓ |
| B: next wake after Stop + one human turn | delivered, seq 21 | delivered, seq 21 | ✓ |

n=2 agreement, **not** a stability claim.

## 6. PD-40 — recommendation

PD-40 ("Sticky Stop is latch-scoped, not session-scoped") is **still a real limit
and is disclosed correctly**, but the release-note wording should be tightened in
two places:

1. **Supported path holds, exactly in the coded sense.** With a review latch, a
   human Stop is durable: `stopped-<hash>.json` at the documented path, survives
   SIGKILL + cold boot byte-identically, and is consulted by the next dispatch.
   The supported claim is **proven under the latch**, not merely asserted. Its
   real scope is narrower than "stop": machine messages/work can still reach the
   stopped reviewer; only review wakes are suppressed (see §3.3).
2. **Unsupported path.** Without a latch there is no marker, no fact and no
   claim — so the limit is real and is *not* misrepresented by the product. The
   precise behaviour is better than "instantly re-woken": the aborted session
   suppresses the immediately next wake until it runs another turn. But that
   suppression is **session state, not durability**, so one human turn (or a
   restart) removes it, and the next review wake activates the reviewer. PD-40
   should keep saying "not durable / not protected", and should **not** be
   upgraded to "protected in practice".

Recommended status: **keep OPEN — disclosed, not fixed**; add one sentence to the
release notes that the Stop governs review wakes, not all member traffic, and that
`ownerRootSessionId` is the mount root that wrote the marker.

## 7. Reproduce

```bash
C1_PLANE_TAKEOVER=1 node tests/kits/wp1-sticky-stop/wp1-sticky-stop.mjs \
  --arm a --run-label a1 --host-port 15001 --mock-port 15051
C1_PLANE_TAKEOVER=1 node tests/kits/wp1-sticky-stop/wp1-sticky-stop.mjs \
  --arm b --run-label b1 --host-port 15003 --mock-port 15053
```

`C1_PLANE_TAKEOVER=1` is required (without it the saved-source blueprint is
invalid YAML and `team.create` fails with a misleading "blueprint not found").
Ports are loopback only, in the 1500x/1505x families; never `:3080`. Exit codes:
`0` all criteria pass, `2` a criterion failed, `1` fatal setup/boot failure.
Each run materialises its own `DSH_HOME` under `tests/homes/` and tears it down
(no `--keep` in the archived runs).

## 8. What this does not prove

* The `true`/`false` return values are inferred (production discards them), as
  described in §2.
* It does not count Inbox deliveries; it counts distinct wake ids at the mock.
* It does not grade the explicit human-resume arbour (A6-24) beyond the Arm B
  re-engagement turn.
* It does not prove the absence of other paths to the reviewer; it measures the
  production Stop listener and the documented wake machinery only.
* The immediate next-wake refusal in Arm B is an exploratory observation (§4.2),
  not part of the archived n=2 criteria.
* One Host version, one mock model, two runs per arm.

## 9. Artifacts

`run-a1/`, `run-a2/` — `a1-latch-witness.json`, `a3-marker.json`,
`a5-relay-resistance.json`, `a4-cold-boot.json`, `a4-postboot-work.json`,
`arm-a.json`, `summary.json`, `run-manifest.json`, `team-blueprint.yaml`,
`mock.log`, `mock-decide.log`, `instance.log`, `run.log`, stable probes.

`run-b1/`, `run-b2/` — `b1-no-latch.json`, `b3-no-marker.json`,
`b4-next-wake.json`, `arm-b.json`, `summary.json`, `run-manifest.json`,
`team-blueprint.yaml`, `mock.log`, `mock-decide.log`, `instance.log`, `run.log`,
stable probes.

Every `run-manifest.json` records the candidate SHA, host baseline SHA, ports and
the `DSH_HOME` path; the homes themselves were torn down after the runs.
