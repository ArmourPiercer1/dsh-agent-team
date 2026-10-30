# PROPOSAL-PLACEMENT — where these two memos belong if accepted (one-pager)

> **DRAFT — proposal memo for public-interface process.** This page decides nothing; it names the
> options so the coordinator/user can. Lane `u7r3-o2memo`, real UTC 2026-10-30T14:0xZ, seat:
> delegated subagent on the harness-reported model qwen3.8-flash-next (disclosed).
> Repo base `e2f14c71bd65e3671ed72bffe9b7092db8d1b3b8` (origin/master tip at spawn); Host pin
> `639ed015397290b3745d163aafe02ffee4aa3f84` (verified this lane, porcelain 0). **No file outside
> this evidence directory was written; neither memo was placed in `docs/plans/memo/` — placement is
> not this lane's authority.**
>
> **Date law (CLOCK-ANCHOR):** banners carry real UTC (`date -u` measured this lane); lane/evidence
> labels follow the session calendar whose mapping to real UTC is ruled in
> `dev/agent-workflow/gates/CLOCK-ANCHOR-20261030.md` §3 (`:55` 真实 UTC = 标签日期 − 1 天). This
> round's lane labels carry the real-UTC date of their run; the cited `USER-RULING-20261031.md` /
> `BOOT-BUDGET-20261031C.md` are session-calendar names (real UTC 2026-10-30).

## What is being placed

| memo | shape of the ask | who owns the decision |
| --- | --- | --- |
| `O2-A-ask-port-agent-binding.md` | the governed ask port carries no Agent; three candidate shapes (S1 per-call carrier, S2 capability key, S3 trusted-mount binding), all on already-public faces | our repo's lane/centre owners (upstream owns nothing here) |
| `O2-B-present-publish-service.md` | no reviewed publish SERVICE exists to delegate to; four candidate shapes (N1 status quo, N2 Host publish service via `cap.hostService`, N3 trusted-mount imitation, N4 new centre capability) | Host public-interface process for N2; owner ruling for N3 |

Both are **design/selection questions with ranked options and open questions**, i.e. exactly the
form the six-question memo family carries (`docs/plans/memo/unified-baseline-alpha5-20261025/state-home/PRODUCTION-HOME-DESIGN.md`;
the pattern the owner asked for at `dev/agent-workflow/gates/USER-RULING-20261031.md:22` §一.2).

## Why they are here now, and not in `docs/plans/memo/`

1. **Authority.** `docs/plans/memo/` is a tracked design/selection memo set whose files become
   demand-side authority (AGENTS.md 目录约定; the STATE_HOME family carries dated banners and an
   erratum trail precisely because it is cited as authority). Moving a lane draft into it is an
   editorial/ruling act — the coordinator's or user's — not the drafting lane's. The two lanes this
   one reads agree: `PRESENT-PUBLISH-GAP-MEMO.md` self-labels 「状态：DRAFT，非 memo 正本」 and asks
   the coordinator where the 正本 lands (`task/u7r3-uileg0-20261030`, PR #489), and the STATE_HOME
   family only became citable after being placed by the owner.
2. **Evidence-only lane discipline.** This task's contract is evidence-only (`1 task = 1 branch =
   1 worktree = 1 writer`, `docs/ROUTER_RULES.md` git discipline). An evidence directory is the
   honest location for a document that has not been reviewed: it cannot be mistaken for a ruling,
   and `dev/agent-workflow/evidence/` is exempt from the current-state-doc rules by construction
   (`scripts/doc-checks.mjs:56-58` HISTORICAL_PREFIXES).
3. **The two memos are cross-repo in one case.** O2-B's main candidate asks the Host for a public
   surface. That ask needs an addressee outside this repo (see option I below); parking it silently
   in a memo directory does not send it.

## Options if accepted (not mutually exclusive)

**M — `docs/plans/memo/<active-phase-dir>/ui-port-binding/` (recommended for the decision record).**
The memo family is the repo's existing home for ranked-options design memos with dated banners and
errata; the STATE_HOME precedent shows the exact life-cycle (lane draft → owner placement → ledger
row citing it, cf. `docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md:110`
R-STATE-HOME-1 OPEN/G5-blocking row). Fit: O2-A lands fully here (it needs no upstream action);
O2-B lands here as the decision record for N1-vs-N2 with its open questions. Cost: a placement
needs a banner stating what it supersedes (O2-B rewrites the #489 six-question draft materially —
the 91-vs-128 recount, the `remote-events.ts:47` anchor fix, the N-shape ranking), so the placement
act should say so explicitly rather than leave two drafts pointing at each other.

**I — an upstream/Host issue (recommended as the *second*, narrower step, for one specific ask).**
O2-B candidate N2 (`ctx.deliverables`-style publish service) is a request for public behaviour the
Host does not have; the repo's own rulebook treats "we need public behavior X" as something to send
upstream, not to absorb (`docs/ROUTER_RULES.md:130` CORE_SEAM_BLOCKER's format is the extreme case,
and this lane is NOT filing it). An issue is the right shape because it has an external addressee,
a life-cycle independent of our Gate machinery, and it can carry the minimal-face sketch plus the
`@Remote`-variant exclusion note. O2-A needs no such issue (its three shapes are all in-repo);
O2-A's S2 — one new capability key on **our** closed enum — is the in-repo analogue of an issue,
and if chosen it should open as such against this repo so the independent security review is
tracked on the issue itself (`USER-RULING-20261031.md:24`).

**E — stay in `dev/agent-workflow/evidence/` (status quo, recommended default until a ruling).**
Correct while unreviewed; keeps `docs:probe` honest; costs discoverability (the memos are only
findable if a ledger/GATE-LEDGER row or the coordinator's note points at them).

**G — a GATE-LEDGER row (additive, whichever of M/I/E is chosen).** The UI L4 cells are already
G5-blocking content (`USER-RULING-20261031.md:60` lists the UI blockers; R-STATE-HOME-1 shows the
row shape at `gates/GATE-LEDGER.md:110`). Whatever the placement, the durable register for "these
two cells have a proposal, here is its status" is the ledger — the memos are arguments, the ledger
is the state.

## Recommended combination (one sentence each)

- **Now:** keep E (this evidence directory) and add the two GATE-LEDGER rows (G) that cite it, so
  the UI L4 cells stop being cited as open with no proposal attached.
- **For O2-B's ask:** file I (upstream issue) with N2's minimal face, keeping N1 as the stated
  interim state and stating explicitly that `CORE_SEAM_BLOCKER` is *not* filed (O2 is not proven
  impossible — that is what the memo is for).
- **For O2-A:** decide S1 vs S3 in the lane/review loop; place the memo as M only if the decision
  record is wanted in the tracked family, with the S2 variant opened as an in-repo issue if a
  capability-key route is preferred.
- **Do not** let either memo be read as a blueprint/default ruling, an acceptance, or a `present`
  imitation authorisation — both carry the non-goals section for that reason.
