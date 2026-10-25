# Rejected / invalid intermediate GREEN runs (FIX-T T1 protocol iterations)

- PROTOCOL-V1-rename-claim-race-natural.json — the rename-claim protocol (move the
  slot by rename + link-restore) measured 3 violations / 200 trials
  (winners:[1100,1109] displaced:[1100] window: a reclaimer moved a FRESH lease,
  a third creator filled the gap, restore returned 'superseded'). Rejected:
  any protocol that empties the slot even transiently keeps the race.
- PROTOCOL-V3-mixed-run-*.json — INVALID by construction: these runs were
  launched against lib/port-lease.mjs while it was being rewritten underneath
  them (directory-slot v2 → append-ordered v3 mid-flight). Kept only to show
  the EEXIST/legacy-coexistence churn, no protocol conclusion.

Final GREEN evidence = ../race-*-POST-fix.json (append-ordered claim protocol,
zero violations: 300 natural + 80 inject-stale + 80 inject-reclaim, single
winner in 460/460 trials).
