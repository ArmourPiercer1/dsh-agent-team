# Q2 — Persistent user-visible error after successful Team takeover (0.1.7-rc.1 published client)

**Run 20 (keep-mode) browser leg — world `rst017-spike-2026-09-26T07-03-12`, host :3492, kit PID 3, banner 07:03:12Z.**
Client = 0.1.7-rc.1 published web build (`0.1.7-rc.1-46a87f68` badge). Browser tab 757204183 (Agent Window, session tmnr).

## Question

After a cold Team root session is opened in ordinary mode (fence veto → client error state), does a
**successful** Team-mode takeover leave a persistent user-visible error in the published 0.1.7 client?

## Answer

**YES within the page load in which the veto occurred; NO across reload / subsequent opens.**

- The rejected ordinary-mode promotion puts the composer into a locked error state
  (`会话不可用` — "session unavailable", all composer controls disabled).
- A successful Team-mode takeover (server-side: one-shot permit consumed, `ensureRootLive` path
  completed, leader active) does **NOT** clear that state in the live client. The composer remains
  locked for the rest of the page load.
- A full page reload (or any subsequent session open) recovers cleanly: the client re-opens the
  session directly in **Team mode**, composer enabled, session fully functional (verified by sending
  a message that the leader processed: 2nd round completed, 4K tok).

So the user-visible symptom on a real restart is: *open cold Team session → "会话不可用" → click
以 Team 模式 打开 → still "会话不可用" (takeover had actually succeeded) → must reload to recover.*
No data loss, no permanent corruption, no extra model traffic from the takeover itself — but the
client's error state machine is not reconciled with the successful takeover.

## Server-side timeline (probe `__fence/events`, authoritative)

| t (UTC) | kind | veto | permit | note |
| --- | --- | --- | --- | --- |
| 07:03:52.255Z | armed | — | — | kit auto-arm after boot-3 (fence covers `session-rst017-dyn-2026-09-26T07-03-12`) |
| 07:03:52.527Z | agent/created (BOOT root, source=resume) | false | false | boot root re-adopted, **unvetoed** (B0 PASS) |
| 07:12:23.148Z | agent/created (DYN, source=resume) | **true** | false | browser ordinary-mode open #1 → veto |
| 07:12:23.150Z | agent/disposed (DYN) | — | — | rejection rollback |
| 07:12:23.152Z | api-session/error (DYN) | — | — | `resume failed … intercepted foreign Agent activation for Team-managed session "session-rst017-dyn-2026-09-26T07-03-12"` — exact C1 fence wording on the wire |
| 07:12:23.180Z | agent/created (DYN, source=resume) | **true** | false | client's second promote attempt (follow promote re-fire) → veto again |
| 07:12:23.182Z | agent/disposed (DYN) | — | — | |
| 07:12:23.365Z | permit (DYN) | — | — | kit watcher granted one-shot permit after observing browser-triggered veto (banner+15 s guard respected: veto at +551 s) |
| 07:13:12.649Z | agent/created (DYN, source=resume) | **false** | **true** | **Team-mode takeover consumed the permit — PASSED** (client click 以 Team 模式 打开 / 回到 Leader) |

No `api-session/error` after 07:12:23.152Z. No further vetoes. No model requests from the takeover
itself (the only post-restart model request on the mock is the 15:16 leader reply to the manual
verification message, which is expected Team-mode work, not foreign activation).

## Client-side observations (accessibility tree, tab 757204183)

1. **Ordinary open (cold)** — `banner "session-rst017-dyn-2026-09-26T07-03-12"` (raw ID header),
   conversation history renders (snapshot), `region "团队" → 团队 1 运行中`, composer:
   `textbox "会话不可用" [disabled]` + all composer controls disabled. → `01-vetoed-session-unavailable.png`
2. **Immediately after the permitted takeover (same page load)** — header switches to the session
   title (`RST017_DONE RST017DONE_2026-09-26T07-03-12`), member-group shows `leader · 1 活跃` +
   `StaticText "Team 模式"` badge, `用 VS Code 打开` appears — but composer **still**
   `textbox "会话不可用" [disabled]`. The takeover success is NOT acknowledged by the composer state.
3. **After full page reload** — composer `textbox "发消息或创建任务, / 调用指令, @ 文件或对话" [empty]`
   (enabled), no new agent/created event fired (no ordinary promote — the client re-opens the
   session directly in Team mode after a successful takeover; the 普通模式 badge is settable but an
   in-place mode switch does not re-trigger a promote). → `03-post-recovery-team-mode-functional.png`
4. **Functional proof** — verification message sent from the recovered composer:
   `Q2 post-takeover verification. Answer with the token RST017DONE_… and stop.` → leader replied
   `RST017_DONE RST017DONE_2026-09-26T07-03-12` (15:16 local), footer `2 轮 2 步 · 4K tok`.

## Implications for the Phase-0 verdict

- The published 0.1.7 client's ordinary-open error state is **sticky within the SPA page load**:
  it is set by the veto and never cleared by a subsequent successful Team-mode takeover. Users must
  reload. This is a **client-side state-machine gap in the published client**, not a fence defect:
  the fence did exactly the designed thing (veto foreign activation, exact wording, rollback,
  recoverable via permit), and the takeover path worked end-to-end.
- For the C1 design this means: after the fence veto, the client's 以 Team 模式 打开 flow is the
  correct recovery, and the C1 client-side two-phase open (Commit 3) should reconcile the composer
  state on the takeover success signal — otherwise the user-facing symptom ("stuck on 会话不可用,
  must reload") ships with the fix.
- Does **not** rise to a NO-GO: no permanent corruption, no data loss, no security issue,
  one-reload recovery, and the underlying server behavior is exactly as designed.
