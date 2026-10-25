# BLOCKED-D1 — machine `active_plan` cannot name PR #364's plan without changing frozen semantics

**Status: STOPPED AND REPORTED** (per the FIX-D work package: "if a rule cannot be satisfied without
changing semantics, stop and report"). The authority pointer stays at `as20261025r1`; no snapshot was
published; `switch-authority.mjs` was not invoked (its byte precondition on the old pointer is therefore
trivially untouched — this package contains **no switch transaction**).

## What was attempted (the proper path only)

1. Draft snapshot `as20261026r1` (supersedes `as20261025r1`), built to the frozen schema and F0 canonical
   rules, keeping `phase_id` / `backlog` / `matrix` / `baseline` / `baseline_collected` byte-equal to
   `as20261025r1`, with `current_phase_statement` that does **not** name the retired `current_contract`
   block, and `active_plan = docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md`
   (the PR #364 plan AGENTS.md already names as the sole implementation plan).
   Draft: `./d1-draft-as20261026r1.json`, digest `sha256:189b1a7041efedda6ceef054b102a6433bbf08262c1a4bdee33dd0d018469184`
   (digest of the draft is recorded here for a future re-derivation; the draft is NOT published and lives
   in evidence, not in `dev/engineering/authority-snapshots/`).
2. `node scripts/publish-authority.mjs check <draft>` → **REFUSED(2)** —
   `PATTERN current_contract.active_plan: "docs/plans/memo/unified-baseline-alpha5-20261025/execution-plan.md" does not match ^docs/plans/active/`
   (receipt: `./d1-publisher-refusal.txt`). The publisher is the ONLY sanctioned snapshot writer, so the
   snapshot cannot exist in history without a schema change.
3. Even past the publisher, `scripts/ci-pr-gate.mjs` `checkContractValues` Q2 independently refuses the
   same value: `Q2: active_plan must live under docs/plans/active/ (got docs/plans/memo/…)`
   (receipt: `./d1-q2-refusal.txt`). After the switch, `checkPointerCurrentContract` runs these rules on
   every PR-gate, so a hand-placed snapshot would also break every gate — and every consumer read goes
   through `scripts/current-authority.mjs` → `loadCandidateAuthority` → same frozen schema →
   `CANDIDATE_SHAPE` refusal. Fail-closed everywhere; there is no compliant way to express the value.

## Why satisfying the rules would be a semantic change (not a minimal additive edit)

- Editing `dev/engineering/authority-snapshot.schema.json` (`active_plan` pattern) or the ci-pr-gate Q2
  prefix law = changing the frozen contract the G2 switchover (PR #365) was reviewed and passed under.
  The schema's own `$id`/`x-status` mark it a frozen candidate reviewed by root; Q2's comment states the
  intent verbatim: "active plan must be an ACTIVE plan, not a memo". Both are root-ruling territory.
- Moving/copying the #364 plan under `docs/plans/active/` would (a) contradict the user ruling that names
  the memo path, (b) create a second canonical copy of the plan (two sources — the exact failure class
  this repo keeps eliminating), and (c) write into `docs/plans/active/`, which AGENTS.md reserves to the
  user/main agent ("禁 worker 改动").

## What IS done in this package (D1 remainder)

- `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md` top banner: superseded as
  implementation plan by PR #364 (user ruling 2026-10-25), retained for backlog/matrix context, pointer
  switch pending this blocker. Q6 carrier lines (`phase-baseline-ref` → pointer, `phase-identity` →
  `alpha5-tool-io-governance`) untouched and remain the first matches in the file.
- `docs/plans/memo/unified-baseline-alpha5-20261025/gates/GATE-LEDGER.md` records the machine-authority
  position next to the gate history.
- Pointer verified unchanged and green: `node scripts/current-authority.mjs status` → `POINTER` /
  `as20261025r1` / digest `sha256:22042721…5062`, `two_current_findings: []`; `--print-baseline` →
  `9b2ee57bc5afd30e89855e09d1769d2e5ec83912` (see `./verification.txt`).
- Derived view regeneration: `docs:sync --write` = **no-op** (no drift; regeneration requirement
  satisfied-by-nothing-to-do).

## Two compliant unblock paths (owner decision required — either unblocks a re-run of this work)

1. **Root ruling amends the frozen shape** (schema `active_plan` pattern + ci-pr-gate Q2 prefix law, with
   the usual review cycle). Then publish `as20261026r1` from the recorded draft basis — NOTE: the #364 plan
   file itself will additionally need the two Q6 carrier comment lines (`phase-baseline-ref:
   dev/engineering/current-authority.json`, `phase-identity: alpha5-tool-io-governance`) — the additive
   edits that WERE within scope of this package (`./d1-q2-refusal.txt` lists them as findings 2–3) —
   then `switch-authority.mjs --snapshot-version as20261026r1 --expected-digest <recomputed>
   --expect-pointer-digest sha256:<current pointer file bytes>`.
2. **User/main-agent places a one-line carrier at a `docs/plans/active/` path** naming PR #364's plan as
   the sole implementation plan (the active/ dir is worker-forbidden but user/main-agent authored). Then
   publish + switch with `active_plan` = that carrier, no schema change at all.

Path 2 is smaller (no frozen-contract edit); path 1 is more honest about what the memo path is. Neither
is a worker call.
