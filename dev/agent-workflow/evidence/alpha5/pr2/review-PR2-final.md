# Review-FINAL — Alpha.5 PR2 deny-source projection, final head (`520a250d..a51b903d`)

- **Reviewer**: independent (rounds 1/2/3/4; ≠ writer). Model column: `qwen3.8-flash-next`. Harness (separate): `DeepSeek Harness`.
- **Object**: `a51b903d`. `520a250d` **is an ancestor** (verified — no rewrite, no force-push). Order: `e701d274` RED (3 red identities by name, incl. the pre-fix "leader leg MINTS, registrations 1") → `b1dcc262` implementation → `a51b903d` evidence. RED really precedes the code, and it precedes the design extension my review demanded.
- **Code delta**: `approval-case.ts` (+~120), `admission-kernel.ts` (+~55), `index.ts` (+1), **`governance/runtime-authority.ts` (+1 export: `rungAbove`)**, 2 lane specs + harness, rebuilt `dist`, README. 33 files, +790/−65; **0 tracked files deleted**.
- **三值**: `PASS` / `可裁` / `FAIL`. All probes were throwaway specs in my own worktree, deleted after the run (universe verified back to **1172**).

## 0. Verdict

**补充内容.** The user's escalation item is **closed, and closed the way the ruling asked**: my round-3 repro (silent envelope ⇒ Leader lifts a Team deny) is now a typed refusal with zero mints, and the six-state table is real — three source states over byte-identical policy + envelope produce three different, pinned behaviors. What is left is two narrow gaps I found by probing (F-1 ambiguity, F-2 provenance widening), each with a ≤5-line closure, plus one inherent boundary recorded as an observation. If the user prefers to *pin F-2 as intended* rather than tighten it, this round becomes `通过` with nothing open.

## 1. The projection, read before it was run

`PolicyDenySource` (`approval-case.ts:132`) = `(realmId, effectKind, matcher, ownerAuthority, sourceRef, sourceVersion)`, supplied by a **reader** (`admission-kernel.ts:112`, `denySources?: () => readonly PolicyDenySource[]`) — read-time, per call, no store: `ABSENT` is the unwired state (`approval-case.ts:287`), `sourceCovers` (`:147`) needs exact equality or subtree **with the seam**, version must equal the call's generation (`:294`), a top-owned deny has no rung above it (`:305`), and only then does the walk run, with the case riding `max(walk rung, rungAbove(ownerAuthority))` (`:362`). `rungAbove` is the ladder's own successor exported from governance (`runtime-authority.ts:160`) rather than a second ordering, and its consumer set is policed **by name** in `a3p3-governance-lane-hygiene.test.ts:904-907` (`[RUNTIME_AUTHORITY, A5_TOOL_ADMISSION_CASE]`) — that is the right way to widen a governance file: one export, one consumer, pinned.

## 2. The user's escalation item — PASS

My round-3 probe replayed verbatim (policy deny + `emptyHardDocs()`, no projection): **`refused TOOL_BINDING_UNVERIFIED/deny-source-unattributed`, `registrations = 0`** (was `OPEN@leader` + MINTED). Envelope never a source: a *matching* envelope `deny` rule over the same scope with no projection entry → same refusal (measured), and rows a/b/c of `r1a-source-contrast.md` hold under my own runs — owner=leader opens at `human-user` with the Leader's own presentation refused; unwired never opens; owner=human-user opens one rung higher at `human-admin` (**floor from the source, not the envelope**). Both drift directions (`sourceVersion` 0 and 2 against g1) → `deny-source-version-drift`; top-owned → `deny-owner-above-ladder`; two denies with only one projected → **whole-set refusal**; subtree entry without the seam → unattributed; the no-deny path is untouched (`rung=leader`, `deniedEffects=[]`). The two-plane no-match law is genuinely unmoved: `a5p0-planes` (19) green and the source gate applies only to indices expansion already decided as denied.

Issue-side reproof is not a memo: withdrawing the projection between plan and issue → `deny-source-unattributed` at issue, `regs=0`; escalating the owner between plan and issue → rung-mismatch `APPROVAL_STALE`, `regs=0`.

## 3. R-2a / R-1b / the NIT — all three closed

- **R-2a**: `ask-has-no-upper-rung` is its own leg (`approval-case.ts:340-350` → `admission-kernel.ts:325`, `APPROVAL_STALE` + `refusal='ask-has-no-upper-rung'`, message pointing at spec §8.2), pinned at `a5p2-admission-kernel.test.ts:621,630` with the explicit "NOT deny-source-unattributed" assertion, and README states it as its own arm.
- **R-1b**: `EffectSetApprovalPlan.deniedEffects` (`approval-case.ts:388`) + the `admission-requires-approval` observe row; my own read: `deniedEffects=[{"effectIndex":0,"requiredAuthority":"human-user"}]` in both channels, with the PR3 presenter contract named (INTERFACES-v1 C-ADM, and the file's absence is disclosed rather than pretended).
- **NIT**: the admin control now *asserts* byte-identity (`a5p2-admission-kernel.test.ts:445,449`), which is what my round-3 probe had to supply from outside.

## 4. New findings

| # | severity | evidence | verdict |
| --- | --- | --- | --- |
| **F-1** | 可裁 | **Ambiguous projections resolve by array order.** `denySources.find(...)` (`approval-case.ts:290`) takes the FIRST covering entry. Same authority state, two entries covering one denied scope with different owners: member-first ⇒ `OPEN@human-user`(escalating env)/`OPEN@leader`(silent env, and the Leader leg then **MINTS** — my `X1b`), human-admin-first ⇒ `deny-owner-above-ladder`. So the ordering decides between "a rung may lift it" and "nobody may", i.e. the laxer entry laundering the stricter one — the one laundering channel that is decidable **inside** the lane, and the lane refuses ambiguity everywhere else (an unreadable document is a refusal, not a preference). Fix: collect all covering entries; more than one distinct `ownerAuthority` ⇒ precise refusal (`deny-source-ambiguous`), zero registrations. | 可裁 |
| **F-2** | 可裁 | **The provenance set can widen between plan and issue while the rung does not.** The reproof compares only the MAX rung (`admission-kernel.ts:491`). Measured: case opens `@human-user` with `deniedEffects=[{index 1 …}]`; a deny then arrives for the *other* effect, same owner (floor below the case rung) ⇒ issue **MINTED**, `registrations=1`, now covering **two** lifted denys. No ladder law breaks (the second deny is proved, its floor is below the approved rung, all-or-none held), but the very statement R-1b exists to make — "this case lifts exactly these denys at these rungs" — is false at mint time, and the human never saw the second one. Fix: in the same leg compare `deniedEffects` (or `perEffectRequired`) pairs, or pin the behavior as intended with a test + one README sentence. | 可裁 |
| **F-3** | observation (boundary, not a defect) | `ownerAuthority` truthfulness is assembly-trusted and `sourceRef` resolves to nothing inside the lane — a forged entry (`ownerAuthority:'member'`, `sourceRef:'ref:does-not-exist-anywhere'`) passes the proof. The mitigating property is real and I verified it: the floor only ever **raises** (`max(walk, rungAbove(owner))`), so a forged owner can never pull a case below the walk's answer (forged `member` under an escalating envelope still opened at `human-user` with the Leader leg refused). README already declares the projection trusted-derived and states that PR3 must authenticate the admin channel. Residual obligation to carry into PR3: `ownerAuthority` must come from the mutation record's authoring rung (blueprint authorship / overlay entry author), and `sourceRef` should be resolvable by the presenter, or it stays a diagnostic string. | PASS, recorded |

## 5. No rollback (spot-checked again)

F-1 identity leg intact: cross-member presentation and forged `approvalCaseId` both `approval-case-identity-mismatch`, `regs=0`. H1: `clock: NaN` at issue → `clock-not-finite` with **`probeCalls=0`, `regs=0`**. H2: enforced CLAIM + no observation → `TOOL_BINDING_UNVERIFIED/assurance-runtime-verification`, sequence exactly `["probe:content-read"]`. One-shot and expiry semantics untouched this round (`grant-mint.ts` absent from the diff) and their suites are inside the green set.

## 6. Gates — PASS, with one evidence NIT

`pnpm -r run typecheck` **exit 0**; committed `dist` reproduces **byte-identically** from my `tsc` rebuild for both `tool-admission/` and `governance/` (only `.map` `sources` differ); lint universe **1172**, `new 0`; audit script OK — still **9** consumer files, 12 lane files, no cycles (DORMANT intact); fail-set **independently recomputed**: `only_in_after = ∅`, `only_in_base = 1` (the a4p7 build-state leg), 21 identities **identical to last round's set**, and the census `after-census-r1.json` says `6760 / 6739 passed / 21 failed`; token scan of `520a250d..a51b903d` → **0** credential-shaped strings; porcelain in the writer's worktree = `?? runs/` only, nothing of mine or of another effort's touched. The **131/131** claim reproduced exactly once I identified the set — 6 lane suites + `a3p3-governance-lane-hygiene` + `a5p0-planes` + `a5p0-layer-audit` = 9 files, 131 tests, all green. NIT: `runs/green-tail-r1-round.log` is a 2-line summary and `runs/after-suite-r1.log` is a 7-line tail, so neither the 9-suite set nor `NEW=0` is recoverable from the captures themselves (I had to search for the set and fall back to the identity files + census) — earlier rounds' logs carried the command and the per-test `FAIL` lines; worth restoring for the freeze package.

## 7. Before merge

1. **F-1**: ambiguity ⇒ refusal (not array order).
2. **F-2**: compare the provenance pairs at issue, or pin it as intended in a test + one sentence.
3. Gate logs: record the suite list/command and keep the per-test `FAIL` lines in the tail captures.
4. Carry F-3 into PR3 as a named obligation (`ownerAuthority` provenance, `sourceRef` resolution, admin-channel authentication).

Nothing here touches H1, H2, F-1's identity leg, the one-shot edge, the two-plane no-match law, or the DORMANT status.
