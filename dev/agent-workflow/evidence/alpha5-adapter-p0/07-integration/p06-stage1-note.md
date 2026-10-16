# P0-6 stage 1 — pristine host cold boot (fixture-adjacent REAL host evidence)
- time 2026-10-15T21:36Z; port 3181 (TEST_METHODS §2 chain verbatim: DSH_HOME=<workspace world> node apps/cli/lib/bin.js web --port 3181 --no-open)
- launch line PRESENT; no-token GET / -> 401 (auth gate); token GET / -> 303 (server live; full 200 GUI needs apps/web/dist — out of lane, TEST_METHODS §2.3)
- :3080 untouched: read-only GET status pre/post unchanged (401) — no operations performed
- test-use tree after boot: git status --porcelain (tracked) = 0; HEAD 639ed01539...
- launch token REDACTED from this log per TEST_METHODS §3.5
- stage 2 (team plugin mount + BND re-run on host) pending: mount seam = DSH_HOME/profiles/web bundles / cordis.patch.yml per TEST_METHODS §4 P1-T5
