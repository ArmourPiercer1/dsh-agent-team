# A5M2-G6 real-Host window — world data prep (root 21:22/21:30; DATA ONLY, no new hooks/systems)

REVIEW CANDIDATE: 94ad605911e68d05a9f0241529e3c7ee427e63a6 (feat/a5m2-wire-g6).
Blob facts measured this round: adapter :1359 carries the OMISION law
(`...(spec.portFamily === 'search' ? { maxSearchResults } : {})`); wiring :343
binds the FULL-VALUE callerSnapshot (`canonicalValue(classified.plan.callerSnapshot)`
+ full-value comparison after every await). bf4/b999 packs carry NEITHER
(maxSearchResults:undefined mint + no signed callerSnapshot) — NOT G6-acceptable;
this lane makes no bf4-inclusion claim (root 21:30 correction accepted).
Package gate: no center-cut/frozen rootpack per 94ad => NO GO. Ports 3186/3187
hard free-check; total new bytes hard cap 250MB; ONE boot, C1-C10; first
unexpected outcome halts remaining cases; no second boot without root ruling.

## Execution surfaces (all EXISTING kit, zero new)
- POST /__p6t6/tool {name,args,as,callId} — one registered tool exec as bound agent.
- GET /__p6t6/state — durable read-back (members, teamSession, control requests/
  decisions/consumptions, activity facts, restart-recovery).
- GET /__p6t6/health — readiness/setupError (boot gate before any case).
- APPROVAL PATH for PA pairings: EXISTING leader tool via the tool route —
  team_resolve_control (as the leader agent, request token from the pairing's
  Control row). team_request/pending-approval surfaces also existing.
  Evidence pairing = SAME callId/correlation token across route 回包,
  Control ledger row, PA pairing ledger line (existing host/plane logs).

## World seed (single team world; the ONLY content per root 21:22)
- TeamSession root R with leader agent L; member agents M1 (active), M2 (to be
  ARCHIVED mid-run via existing lifecycle tool for C7).
- Real sessions: S_L (leader, >=1 completed step => real turnBoundary
  lastStepStartSeq), S_M1, S_M2 (member sessions), S_OUT (a session NOT in
  ceiling: created outside team or after M2 archive), each with >=2 durable
  events carrying a unique MARKER string for real-byte verification.
- Search backend: mount-time census observation (search facet present?);
  present:false => C3/C4 search rows reclassified census-NEG, never faked.

## Case matrix (one boot, ordered; stop on first unexpected)
- C1 P session_trace {session_id: S_M1} as L after allow — 回包 contains S_M1
  real event bytes incl MARKER; Control+PA ledger same-call pair.
- C2 P session_event_trace + session_event_read {session_id: S_M1, seq} as L.
- C3 P session_event_search {query: MARKER, session_id: S_M1} as L (census-gated).
- C4 P session_event_search {query: MARKER} CURRENT session (S_L) — clamp to
  real turnBoundary lastStepStartSeq (row-internal; seq-range honesty).
- C5 P ceiling-positive: session_trace {session_id: S_M2(archived=LATER)} as L
  BEFORE archiving (live member) — serve.
- C6 N ceiling-deny: session_trace {session_id: S_OUT} — native boundary deny,
  zero event bytes, no PA pairing opened beyond plane law.
- C7 N archived: after M2 archive tool, repeat C5 — denied (ARCHIVED excluded
  from fresh memberInstances ceiling read).
- C8 N no-step: fresh member session S_FRESH with zero completed steps as caller
  CURRENT — row's own SESSION_QUERY_TOOL_NO_CURRENT_STEP.
- C9 N caller drift: open pairing for {session_id:S_M1} as L, PA-pending; flip
  exec-owner observation to another session BEFORE allow; allow => refusal at
  callerSnapshot full-value comparison (P_G6_* / plan-stale class per signed law),
  zero forwarding. (If world cannot flip the real header deterministically, this
  case is recorded NOT-ATTEMPTED-with-reason, never faked.)
- C10 N unknown target: session_trace {session_id:'no-such-session'} — native
  not-found boundary denial (typed passthrough, no fabricated payload).

## Budget enforcement (real numbers, 13G free is NOT the budget)
- du -sm of tests/homes/a5m2-g6host-* at teardown <= 200 (hard cap; expect 5-20).
- evidence dir text total <= 5MB. Zero checkout/dep copies.
- RUNTIME SOURCE (measured): PRIMARY = shared read-only 已核 checkout
  tests/deepseek-harness-test-use @639ed0153 (main tree; built; porcelain+HEAD
  re-verify before/after) per root 21:13 只读共享已核Host639 => 0 new bytes.
  The AGENTS per-worktree clone alternative is MEASURED-INFEASIBLE here:
  shared baseline /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness is
  a 44K snapshots/vendor stub (NOT a git repo — env migration gap); fallback
  clone --local --no-hardlinks of the main checkout = 497M .git + 343M work
  ~= 840M source, AND pnpm store v11 lives on /home while workspaces are on
  /srv (different filesystems => no hardlinks => ~2.2G fresh dependency copy)
  — prohibited by root 不复制大deps. Deviation from the clone convention
  DISCLOSED: root's 只读共享 directive governs; if per-lane isolation is
  later ruled mandatory, that is a new budget ruling (>=3G), not my call.
- Host package build (center-cut tree) lives in CENTER's tree — zero bytes in
  my window budget. My window cap stays TOTAL <= 250MB new bytes.
