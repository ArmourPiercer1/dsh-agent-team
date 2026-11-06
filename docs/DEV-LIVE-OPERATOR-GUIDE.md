# DEV-LIVE operator guide — owning a face's real-Host development loop

**One page. Owner ruling 2026-11-09.** This is the operator half of
`docs/ROUTER_RULES.md` §0.1 item 4 and `docs/TEST_METHODS.md` §10. It changes
WHO may authorise a development boot and HOW OFTEN — it does not change
isolation, evidence, teardown, review or acceptance (Q7 / CI / `V@B` unchanged;
`DEV-LIVE` is a record label, not a grade).

## 1. What you may do, and with what

You are a **Capability Implementer** for one face (pilot order: FS/Search, then
Web, then Shell/PTY and the rest). Once the owner has given that face a
**dev-live scope authorisation**, you may start real Hosts **repeatedly, on your
own authority**, inside your own isolated test World, to develop, debug and run
positive/negative tests. There is **no fixed cumulative cap** and **no per-start
human approval**.

Still required for every start:

1. a **PASS** from `scripts/a5sf-preflight.mjs` (zero-boot pre-flight);
2. your own isolated `tests/homes/<world>` and its own logs (WorldFactory owns
   them — never touch `:3080` or its home);
3. a **ledger row** for the start (the gate and harness write it for you);
4. the **machine-wide cap: at most 2 dev Hosts**. A third is refused.

## 2. The scope authorisation file (written once per face)

A dev-live grant is one JSON row. `grantedBy` names the owner ruling; the
implementer may write this file itself under its evidence directory.

```json
{
  "grantId": "devlive-fs-search-1",
  "scope": "DEV-LIVE",
  "grantedBy": "owner 2026-11-09 ruling, relayed by <you>: scope authorisation for the FS Provider face",
  "face": "FS Provider",
  "world": "*",
  "note": "repeated development starts for BL-14/BL-16 live halves; no candidate claim"
}
```

- `face` must equal the face you declare at boot (default for `a5sf-read`:
  `FS Provider`). It never widens to another face.
- `world` is your isolated World line, or `"*"` for any World in your own lane.
- There is deliberately **no** `maxStarts` requirement (if present it is
  recorded, not enforced) and **no** `boundCommit` equality: a development
  branch moves. The commit actually executed is written to the ledger.
- This file is **not** a candidate grant. It can never fund a
  `CANDIDATE-C2` run, and a candidate grant can never fund a dev boot.

## 3. Boot

```bash
export A5SF_BUDGET_GRANT=$PWD/dev/agent-workflow/evidence/<your-lane>/dev-live-grant.json
node tests/world-factory/u5-canary-runner.mjs \
  --suite a5sf-read \
  --line u5a5sfdev1 \
  --record-class DEV-LIVE \
  --evidence .artifacts/<your-lane>/run-<timestamp> \
  --budget-ledger .artifacts/<your-lane>/run-<timestamp>/ledger.jsonl
```

- `--record-class DEV-LIVE` is mandatory: the gate refuses a dev-live grant on
  a `CANDIDATE-C2` record (`RECORD_CLASS_MISMATCH`), and vice versa.
- `--line` is your World; `face` comes from the suite (`--face` is honoured by
  `run()` when a driver passes it).
- Do not reuse a candidate evidence directory. Use one directory per run.

## 4. What must be recorded (the gate writes 1 and 2; you write 3)

1. `budget-intent` — grantId, grantedBy, face, world, `headCommit` (version),
   plannedStarts.
2. the start row — written by `a5sf-harness.mjs` **before** the spawn (world,
   phase, suite; the port lease and `DSH_HOME` are WorldFactory receipts).
3. `dev-live-outcome` — call `lease.finish({ overall, cases, teardown })` with
   the run's result, the case verdicts and the World teardown receipt. This also
   releases your concurrency slot.

The RUN record additionally carries `recordClass` and
`candidateClaimEligibility`. Leave the ledger and teardown receipts in the
evidence directory; they are what PR review reads.

## 5. Forbidden (no exceptions)

- The stable instance `:3080`, its `DSH_HOME`, or any port outside
  `tests/paths.mjs`'s test ranges.
- Real external systems / real network egress (unless the face's own approved
  evidence plan says otherwise).
- Moving the shared Authority pointer (`dev/engineering/current-authority.json`)
  or publishing a candidate snapshot.
- Treating a dev run as release-candidate acceptance.
- Claiming `V@B=yes` (or any matrix grade) from a `DEV-LIVE` record. The
  validator refuses it (`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`); the matrix edit
  right stays with the owner.
- Editing another face's shared boundary, or the shared Host assembly files
  (`install.ts` / `mount.ts` / `index.ts` / `product-assembly.ts` /
  `a5sf-realm-row.mjs` / product entry / Member lifecycle) — those remain
  Integration-Owner-only.
- Raising the concurrency cap yourself; it is a code constant
  (`DEV_LIVE_SLOT_LIMIT = 2`) until the owner measures resources.

## 6. Escalation after 3 same-cause failures

The retry rule replaces total-count limits:

> **Same failure cause + no new diagnostic information, 3 times in a row ⇒
> stop blind retries and escalate.**

On the third such failure, stop and write a short escalation note in your
evidence README:

1. the exact failure (typed code / line / exit code), quoted verbatim;
2. the three attempts and what changed (or that nothing did);
3. the hypotheses you eliminated and the **one new fact** a next attempt would
   need;
4. what you need from the Integration Owner (shared wiring, resource
   scheduling) or from the owner (a ruling, a new backend, a candidate freeze).

Escalate to the Coordination/Integration Owner; do not spend a fourth boot on
the same unchanged cause. A genuinely new diagnostic fact resets the count.
