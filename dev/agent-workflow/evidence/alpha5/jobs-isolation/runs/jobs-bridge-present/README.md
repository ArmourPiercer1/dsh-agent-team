# jobs-bridge-present - root BLOCK close (render contract) + ② repro (no fix)

## ① render contract (FIXED on-branch)
- `render-RED-unbooked.log` - the 4 contract legs against the OLD bridge: all RED
  (log narration leaked into model text; no [stderr] section; no gap/spill notice;
  running-timedout vs finished-empty collapsed to one body). Existing 25 legs stayed green.
- Fix = plane-effect-backends jobOutput reassembly ALIGNED TO THE PINNED HOST
  (render.ts:75-84 renderModelDelta + index.ts:330-335 statusLine-last): log filter,
  one [stderr] section, dropped-output notice with SCOPED spill presentation
  (file name only - the governed face never echoes the host's absolute world path;
  recorded as the sanctioned divergence in the receipt), one-time result tail,
  status line LAST (detail = progress ?? detail). dist mirror + glue IN THE SAME COMMIT.
- `host-receipt.mjs` / `host-receipt-output.log` - machine check @639ed01539: runs the
  HOST'S OWN BUILT installed code (tool-jobs/lib/types/render.js) over the SAME
  mixed-channel and two-shape reads side by side with our DIST-MIRROR bridge; every
  check ok, verdict RECEIPT-VERDICT all-checks-passed. (Receipt instruments only -
  no runtime import of host internals anywhere in our plugin.)
- Honest limit: live background-job two-shape needs a native-bash producer world
  (host has no job_start; the governed world has no producer - J8 law on record);
  the receipt covers the installed render face + bridge parity over identical reads.

## ② shared realm+tool gateway key (REPRODUCED RED, FIX HELD FOR ROOT)
- `identity-RED-repro.log` - two members, two bridges, two definition identities,
  ONE shared scopeKey ('realm-jobs' = a5PlaneRealmId at agent-bindings:2441):
  B's mount LAST-WRITE-WINS over A's; A's bridge-local unchanged-identity skip never
  re-registers; A's admission pins `bash@B-def` (assertion `expected 'bash@B-def'
  to be 'bash@A-def'`). CONDITIONAL producer bug: the production creation producer
  is ABSENT, so NO misattributed job exists today - mandatory fix before any
  wiring/boundary claim. The repro leg is deliberately NOT committed (red stays out
  of the census); it ran from the exact committed tree and was reverted byte-clean.
- Fix direction held for root (two options reported):
  X (recommended, one-line, my window): member-scoped scopeKey at the construction
  site (realm + instanceId) - gateway indexing untouched, each member's bridge owns
  its definition rows; test pins re-home with it.
  Y: re-key inside jobs-gateway-assembly (wider blast radius).
