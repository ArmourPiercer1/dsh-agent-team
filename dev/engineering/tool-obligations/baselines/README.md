# baselines — pinned C2 live observations (U7-0 / EB2-A)

One pinned live snapshot per World class, taken at the host pin recorded in
`baselines.manifest.json` through the world-factory public seams (2 host
starts, budget-ledgered). These are OBSERVATIONS, not obligations: the
expected side stays `../expected-tool-obligations.v1.json`.

- `observed-non-team.20261026.json` — plain World, one session lane. Its
  `snapshot_digest` reproduced BYTE-IDENTICALLY in the earlier run of the
  same day (two independent boots): this is the "fixed snapshot digest"
  law proven on live data — per-boot fields (`def#N`, change_seq, boot id)
  are recorded but digest-excluded by design.
- `observed-governed-team.20261026.json` — governed Team World (production
  Team row, ENFORCING plane, anchor blueprint): global + a real governed
  leader lane (`team_lane:true`, classified by its team-layer names) + a
  boot-root legacy session lane. The leader surface denies the row tools
  per the alpha2 coverage law (deny IS coverage — see the evidence README).
- `reconcile.20261026.json` — the three-way verdicts for both inventories
  plus the cross-boot leg (team-observed vs non-team-baseline: drift 0 —
  shape/source columns stand across boots; per-boot columns excluded by
  unique boot ids).
- `RUN.20261026.json` — the passing RUN record (cases, boots, leak check,
  :3080 read-only probe before/after).

Honest count disclosure (live worlds are TEST profiles, not the full
shipped bundle): MISSING rows are host rows that this profile does not
mount (opt-in/preset-gated: lsp, pwsh, run_code, plugin_manager, mcp
static rows, cordis rows, str_replace_editor, list_subagent_models) plus
team-lane obligations the anchor blueprint deliberately does not grant the
leader (13 of the 15 team tools; the allow-list arms only
team_list_members/team_create_member, and the plane alias rows appear as
observed). Every row carries the authoritative-source column so the
reader sees WHICH side disagrees. UNKNOWN = exactly the two test-row
tools (`u5_canary`, `u7_census`), each `authorized:false`. OUT_OF_SCOPE
observed = 0 in both live inventories.
