# OOM diagnostic — install-entry kit, run 2026-10-17 (~16:4xZ, run6)

**What died:** the KIT process (mock loop host), `FATAL ERROR: Reached heap limit` (V8
old-space OOM). The host instances were healthy; worlds are run SEQUENTIALLY — at most
ONE host + ONE kit process ever exist. Not host-count × memory.

**Which stage ate it — diagnosis (not speculation):**
- The kit's in-process mock model server retained the FULL JSON body of every chat
  request for post-run wire scanning (`mock.requests[].body`).
- A fully booted governed host emits a sustained request storm at boot BEFORE any
  prompt: measured 25–50 chat requests/s (kit `--heartbeat` lines, mockReqs rate),
  each body carrying the full system persona + tool catalog (~50–150 KB each).
  30 s of boot ≈ 1–3 GB retained → heap limit.
- Trigger became deterministic once the governed worlds grew (persona + catalog size).

**Retained evidence (honesty notes):**
- run6's raw stdout went to `/tmp` which does NOT persist across tool calls here — the
  heap-limit transcript text is recorded in this note and the SESSION_ROUTER_LOG entry,
  not as a raw file. Disclosed non-persistence.
- Ongoing resource evidence: kit built-in `--heartbeat` self-reports
  `rss / heapUsed / mockReqs` every ~5 s into `recorded-run.log` (the process that
  OOMed reporting its own footprint). Post-fix recorded values: rss ≈ 118 MB flat,
  heap ≈ 15–30 MB across all worlds; world sizes: expansion 1732 files +
  29-package dependency closure; DSH_HOME worlds < 1 MB at boot.
- External `ps` is PID-namespace-isolated from harness background jobs in this
  sandbox — kit self-reported RSS is the available signal (disclosed).

**Fix — NO cap was raised, NO concurrency added (root 16:55Z boundary):**
1. `digestRequest()`: at decide time the kit now computes the wire facts it will ever
   need (marker hits, tool_use names, tool_result bodies, counts) and PRUNES each
   request body after the last 6 records. Retention is bounded, the wire evidence is
   kept as digests in `wire-digests-<mode>.jsonl` per world.
2. Storm guard `--storm-limit` (default 250 requests/world): if a world's OWN request
   count exceeds the limit the kit writes `storm-diagnostic-<mode>.json` (sample of 8
   requests) and dies FAST with a diagnostic instead of OOMing. The limit is a
   diagnostic tripwire, not a memory cap; it never fired in runs 8–final.
3. Worlds remain sequential; batch policy unchanged.

**Post-fix status:** the recorded final run shows flat rss ~118 MB end-to-end
(`[hb] rss=118MB heap=15MB` lines in `recorded-run.log`). No OOM since run6.
