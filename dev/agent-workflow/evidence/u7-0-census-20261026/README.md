# U7-0 evidence — dynamic tool census (EB2-A), 2026-10-26

Task: ExpectedToolObligations artifact (tracked) + ObservedRuntimeInventory
collector + three-way reconciler + CI hook (C1) + ONE live C2 census at the
pinned Host baseline (`0.2.0-rc.2 @ 639ed015`, port 3180-family,
`tests/homes/<world>`, HTU pristine, :3080 untouched).

This directory carries SMALL sanitized receipts. Raw per-boot host logs,
census ledgers, inventories and RUN records live under
`.artifacts/tmp/u7-0-census-live/` (gitignored era: raw stays raw); the
PINNED live snapshots themselves are promoted to
`dev/engineering/tool-obligations/baselines/` (tracked, digest-pinned).

## Receipts (fill from RUN records; every claim below is machine-checkable)

<!-- RUN-RECEIPTS:BEGIN -->
RUN-2 (PINNING) `u7-0-census-2026-10-26T10-47-58-816Z` — overall PASS 5/5:
  c2-non-team PASS (live1 snapshot, 2 scopes, seam refusals 0)
  c2-governed-team PASS (team lane observed: leader lane classified
    team_lane:true via team-layer names; boot-root legacy lane classified
    non-team; global row layer of a Team host carries only the row tools —
    recorded verbatim)
  reconcile PASS; leak-check PASS; stable-instance-unchanged PASS
    (:3080 probe 401 -> 401, read-only)
  snapshot digests (pinned, baselines/):
    non-team        sha256:e540b89b5ba36e0d8122fa8708a19ee929d7b02586f42776c37913d69bdf2ebf
    governed-team   sha256:a2430e1a71b0ffcb946e38901f670a718ed7ff3da8c5129db0e4f24ef3e5a708
  verdict digests:
    non-team        sha256:58fd7e88436aa86fe689614e3eae777d5d2d245dbb5054d1c8eeb62269f37888
    governed-team   sha256:972f170360e01e1651585e3b65e056ed4c0974f472771fbd26a0493a6c051e5f
    cross-boot leg  sha256:23e1324867ee6516c7c1fac403a52306e5c64253f12526a85ed13ea30806e53b (drift 0)
  counts (live, honest): non-team missing 11 / unknown 2 (test rows only,
    authorized:false) / drift 0 / oos 0 / scope-gaps 18;
    governed-team missing 24 (11 host profile-gated + 13 team-lane tools
    the anchor blueprint does not grant) / unknown 2 / drift 0 / oos 0 /
    gaps 0 (the team-lane class WAS observed — no silent coverage hole).
  CROSS-BOOT DIGEST STABILITY, live-proven: the non-team snapshot digest
  is BYTE-IDENTICAL between RUN-1 (10:41) and RUN-2 (10:47) — two
  independent boots of the same pinned host — while per-boot fields moved.
  Budget: RUN-1 ledger 2/2 starts, RUN-2 ledger 2/2 starts (separate
  ledgers, both fail-closed at the cap BEFORE spawn); every start logged
  before spawn. HTU HEAD/porcelain asserted before every spawn + post-run,
  stayed at 639ed015/empty.
<!-- RUN-RECEIPTS:END -->

## RUN ledger (honesty of counts)

- RUN-1 `.artifacts/tmp/u7-0-census-live/2026-10-26T10-41-16-540Z/` —
  overall FAIL(1): `c2-governed-team` failed for a REAL reason the census
  itself surfaced as a harness bug (NOT a product finding): the alpha2
  permission-coverage gate refused the governed leader bootstrap because
  the two row-layer test tools (`u5_canary`, `u7_census`) sat
  `unknown-unmanaged` on the leader surface. Fix per the measured u6-fs
  law (deny IS coverage): the anchor blueprint now carries both names in
  the leader `builtinToolDeny`, and the census call rides the boot-root
  legacy session lane (the proven u6-fs trigger-lane pattern). The same
  run exposed the per-boot `def#N` cross-boot mis-pairing (both boots
  carried the literal boot_id `boot-1`), fixed by world-unique boot ids.
  Both fixes are harness-side; zero product semantics involved.
- RUN-2 — the pinned run (see receipts block).

## Negative controls (C1, planted counterexamples — architecture §10.5-6)

1. inject `mcp__planted_server__planted_tool` → UNKNOWN
   (`dynamic-instance-unadmitted`, `authorized:false`,
   `in_authoritative_sources:false`) — verdict digest moves;
   a non-prefixed brand-new name lands `not-in-obligations` the same way;
2. replace an execution Definition → DRIFT: same-boot spelling plants a
   placement-identity move (`definition-identity`), the cross-boot spelling
   moves the model-facing shape digest (`definition-shape`) and the pinned
   snapshot digest;
3. drop `read` from every scope → MISSING (1),
   `in_authoritative_sources:true`, `expected_in:'native-scope'`.
Every plant asserts the EXACT count delta + the named row + a moved
`verdict_digest`; the authorization law leg asserts no output on any plant
carries `authorized:true` (§10.4: discovery reports, never authorizes).
`packages/testkit/test/u7-0-census-reconcile.test.ts` — 11/11 PASS offline.

## Digest law (pinned)

- `snapshot_digest` covers only cross-boot-stable facts
  (scope kind/team_lane, per tool: name / shape digest / identity_vs_global)
  — rewriting every `def#N`, every change_seq and the boot id leaves it
  byte-identical (asserted);
- `full_digest` covers every recorded byte (audit binding);
- `verdict_digest` covers the whole three-way diff;
- artifact digests + generator sha are in
  `dev/engineering/tool-obligations/manifest.json` (replay:
  `node dev/engineering/tool-obligations/build-expected-tool-obligations.mjs --check`).

## Budget / non-interference

- Host starts: RUN-1 = 2, RUN-2 = 2 (each its own budget ledger; the
  factory refuses a spawn once its ledger reaches `--max-host-starts`);
  every start logged BEFORE spawn.
- Ports: leased 3180-family + mock 3491-3500 (lease v5, shared
  `.artifacts/tmp/port-leases` root); :3080 probed READ-ONLY before/after
  (status stable, 401 unauthenticated as expected) — case
  `stable-instance-unchanged` PASS in every RUN record.
- HTU base (`tests/deepseek-harness-test-use`, the main checkout's pristine
  0.2.0-rc.2 tree, used READ-ONLY via the factory `hostTree` seam — the
  shared `/srv/workspace/dsh-stable-3-0.2.0-rc.2` baseline is absent in
  this environment, disclosed): HEAD/porcelain asserted before EVERY
  spawn and after the run (`assertHostBase`), porcelain stayed empty.
- Homes under `tests/homes/` (workspace), deleted at teardown; leak-check
  (pids/ports/leases/home) PASS in every RUN record.

## CI receipts (PR #386, head 512d164856942cea31655d0e90b7628bd78329a1)

- pr-gate PASS (1m19s); candidate-protection PASS (14s); census-runtime
  PASS (18m18s — the no-exemption leg: pinned pristine host provisioned,
  nine-root census with NO refusals, transcript re-graded).
- Root vitest vs pristine master (496a3980f) measured IN THIS ENVIRONMENT:
  the only regression the branch introduced was the a5p0 lane-audit
  consumer-mention hit (code-string mention of the lane name; zero import
  edges — fixed by rewording, commit 512d16485, no consumer booking).
  All 11 remaining reds reproduce identically on pristine master here
  (HTU/environment legs); zero NEW reds from this PR.
- PR left OPEN for reviewer merge (DO-NOT-MERGE discipline per task).
