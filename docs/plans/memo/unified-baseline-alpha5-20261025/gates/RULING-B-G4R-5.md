# Main-agent ruling B-G4R-5 — USER PRE-AUTHORIZATION for boot budgets (G4-R + G5 candidate-C2 evidence lanes) — 2026-10-28

**Issuer.** The user, directly, 2026-10-28, effective immediately for the unsupervised window. This
document records and operationalizes the user's instruction; it adds nothing the user did not say and
omits nothing. Verbatim original (Chinese) is quoted at the bottom — the quote is the authority, this
section is the operational reading.

**Operational terms (each traced to the user's text).**

1. **Ceiling.** Boot limit for the G4-R lane AND the G5 candidate-C2 evidence lane is pre-authorized to
   **25 total**, explicitly INCLUDING voided attempts and ENV failures; the pre-spawn ledger accounting
   ("boot 前计数法") is unchanged — every start is still declared in its leg ledger before spawn, no
   post-hoc counting.
2. **The stop-on-same-failure law is NOT exempted.** Two consecutive SAME-CLASS failures ⇒ line stops.
   Pre-authorization must not be used to extend a dying line ("不得用预授权续命"). Restart requires a
   root-cause correction document (B-G4R-3/B-G4R-4 style, dated) FIRST, and only then may pre-authorized
   budget be spent again. The correction must be a NEW, dated document issued AFTER the stop: "B-G4R-3/4
   style" names the FORM, not those documents themselves. An earlier ruling never lifts a stop that its
   own retry caused — B-G4R-4 authorized the ONE retry after the first failure; it cannot exempt a second
   consecutive same-class failure from stopping ("如 B-G4R-3/4 式" 是格式示例，非既往豁免引用).
3. **Per-cell disclosure stands.** Every boot cell beyond the ORIGINAL envelope (R1's 6) still requires:
   a named ruling + an independent re-review signature + a `disclosed` marking. Not one of the three may
   be skipped ("一条不能省"). For the ARC-A ENV retry — chronologically the 5th boot of the lane, which
   B-G4R-4 authorized while computing an eventual G4-R ceiling of 10 (its lines 46–51; "10" is the
   ceiling position, never a boot number) — the named rulings are B-G4R-4 (scope: that exact retry) and
   this document (budget basis); the independent re-review signature for B-G4R-4 was recorded before
   merge (og `deepseek-v4.1-flash`, artifact `.artifacts/reviews/R434-og.md`, verdict PASS). Retries
   beyond that each need their own ruling + review + disclosure.
4. **Hard exclusions — pre-authorization does NOT touch**: capability-scope or security-semantics
   changes; deletion of historical evidence; G5 PRODUCT-GATE release verdicts; any plan §4
   reserved-matters item. Such questions are logged and QUEUED for the user ("入账排队"), never answered
   on their behalf.
5. **Expiry.** Whichever comes FIRST: (a) submission of the G4 full-PASS application (the R2 promotion
   review request), or (b) the user returning to supervise — expected 2026-10-29 12:00 (UTC+8), may
   drift a few hours either way. Unused budget does NOT carry over to new work packages after G5.

**Effect on B-G4R-4.** B-G4R-4 remains valid as the named ruling for boot 10 (ARC-A ENV retry) with its
honest failure record and ENV-class grounding. Its ceiling arithmetic (9 → 10) was computed when no
pre-authorization existed; the user's 25-boot ceiling SUPERSEDES that ceiling for the total, while
B-G4R-4's per-retry scope, stop condition ("same class ⇒ stop, report"), and disclosure remain in force
as B-G4R-5 §3 requires. This ruling does not rewrite B-G4R-4; it sits on top, dated, append-only.

**Same-class counter reset note.** The stop law counts CONSECUTIVE same-class failures. Leg 1 attempt 1
was ENV-class; if the retry fails with the SAME ENV class again, that is two consecutive same-class
failures ⇒ STOP the lane and report; the lane resumes only after a root-cause correction document per §2.

**Boot-sequence deviation disclosed (this session).** The lane brief requires the authorizing ruling to
be MERGED before the spawn it authorizes. That prerequisite is NOT waived by the ceiling raise; it is
separately overridden only by the user's own words "失聯期間生效" / effective on issue — the user's
authorization is in force the moment it was issued, so it authorizes the ARC-A retry (chronologically the
5th boot) without waiting for THIS recording document's CI. That is the sole basis for the deviation, and
it is a deviation, disclosed here and in the lane README per §3 — it does not exempt any future spawn whose
authority is a main-agent ruling rather than a directly user-issued authorization. B-G4R-4 landed via the
already-merged PR #434; THIS ruling (B-G4R-5) lands via its own PR #436 as the tracked record (they are
not in the same merge — #434 records B-G4R-4 only). The pre-flight conditions of B-G4R-4 (candidate HEAD,
clean trees, sandbox probe `partial`/`full`, :3080 probe) were all re-checked immediately before the spawn
and recorded.

## Verbatim user text (authority)

> 预授权（用户 2026-10-28，失联期间生效）：
>
> G4-R 及 G5 候选 C2 证据车道的 boot 上限一次性预批至 25（含作废、含 ENV 失败，boot 前计数法不变）；
> 不豁免即停律：同类失败连续 2 次仍停线入账，不得用预授权续命——要解停必须先出根因更正（如 B-G4R-3/4 式 dated correction），再依本预授权续花；
> 每格超出原包络仍须具名裁决 + 独立复审署名 + disclosed 标注，一条不能省；
> 本授权不触碰：能力范围/安全语义变更、历史证据删除、G5 PRODUCT-GATE 发布裁决、任何计划 §4 保留事项——此类问题一律入账排队等你回来，不代答；
> 失效条件：G4 完整 PASS 申请提交时，或我回来可以继续监督当前工作（预计时间 2026-10-29 12:00 (UTC+8)，可能前后波动几小时），先到为止；剩余授权不结转 G5 之后的新工作包。
