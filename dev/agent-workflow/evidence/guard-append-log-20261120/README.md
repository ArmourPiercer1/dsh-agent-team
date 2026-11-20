# append-only log guard — 2026-11-20

## why
Two squash merges replaced dev/agent-workflow/SESSION_ROUTER_LOG.md with only their own entries: #800 9276->26 lines, #801 (built on the truncated file) 26->48. state-freshness grades the NEWEST heading, so both passed every leg and were caught only by a human reading a diffstat.

## what the leg grades
The base revision's bytes must be an exact PREFIX of the head revision's bytes (CRLF/last-newline normalised). Shrunk, reworded, reordered or middle-inserted logs all fail.

## measured on this branch
DSH-CI-LEG leg=append-only-log verdict=pass seconds=0 detail=log preserved: base 4aaae4c0b is a byte prefix; 9312 line(s), 0 appended, 0 removed

# the real incident shape (log truncated to its first 50 lines), same leg:
DSH-CI-LEG leg=append-only-log verdict=fail seconds=0 detail=LOG_TRUNCATED_OR_REWRITTEN: first divergence at line 52; 9261 base line(s) missing or changed (base 4aaae4c0b, head 50 line(s), 9261 removed)
restored: byte-identical

# unit suite (8 arms, 4 real mutants)
ℹ tests 8
ℹ pass 8
ℹ fail 0

# wiring
EB3-CI-REQUIRED pass workflows=10 findings=0
  DISCOVERED_AND_COLLECTED 830
  UNCOLLECTED              41
DSH-TEST-CATALOG tests=885 digest=sha256:683f87721eeb6dcda82059868ccbaffa963159ae844ed3a1102845f9f2cc1ddd refused=0 findings=0
EB3-FAMILY-DEFINITIONS pass files=30 findings=0

## LIMITS (stated)
- A prefix check cannot tell a legitimate append from a rewrite that reproduces the old bytes; it says nothing about whether the new entry is TRUE.
- It needs a base revision: without origin/<base> it REFUSES (never green). pr-gate checks out with fetch-depth 0, which is what makes the base reachable.
