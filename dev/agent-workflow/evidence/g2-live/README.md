# G2 live half — BL-14 … BL-18, `edit`, `read_image` on `origin/master @ 0f4f4f8eb`

**Record class: `DEV-LIVE`. This is development evidence, not candidate acceptance.**
It cannot produce `V@B=yes` or a matrix grade (`candidateClaimEligibility.eligible=false`,
code `DEV_LIVE_EVIDENCE_NOT_CANDIDATE`, recorded in every run record). It is the **live half**
of the G2 row set, measured on one head so a reviewer can decide the gate. Nothing here edits
the matrix grade cells, `docs/STATUS.md`, the debt register, or the Authority pointer.

- **Measured head:** `0f4f4f8eb2bbe991f78b55ed1f98abb18c504087` (`origin/master`, branch
  `task/g2-live-20261109`, worktree `.worktrees/g2-live`, cut at exactly that commit).
- **Host pin:** `639ed015397290b3745d163aafe02ffee4aa3f84` (0.2.0-rc.2, `tests/deepseek-harness-test-use`,
  porcelain empty before and after every boot).
- **CORE PATCH BUDGET = 0.** No product file is modified by this lane and no file under `tests/`
  is committed. The three instruments are **relocated copies** committed beside this README
  (see §1.2); their non-import code is byte-identical to the in-tree drivers.
- **Authorisation:** `DEV-LIVE` self-authorisation for the faces named below, per
  `docs/ROUTER_RULES.md` §0.1 item 4 and `docs/DEV-LIVE-OPERATOR-GUIDE.md`; grant row at
  `dev-live-grant.json` (`grantId=devlive-g2-live-1`, face `FS Provider`, world `u5a5sfdev1`).
  The PD-33/PD-30 drivers are capacity-leased under their own face labels (`GoalStop`, `WebEgress`).

## 0. TL;DR verdict table

| BL / row | tool(s) | verdict on this head | decisive measurement |
| --- | --- | --- | --- |
| **BL-14** | `read` | **PASS** | shipped-preset out-of-lane read: `IO_READ_DENIED`, 1 deny fact, 0 provider read; FS axis: `READ_A_ALLOWED_AND_CONFINED`, `BINDING_DENY_ON_READ_PATH`, `REFUSED_WITHOUT_WIDENING` |
| **BL-15** | `write` | **PASS** (live half; coverage caveat §2.2) | `CEILING_WRITE_IN_LANE_READABLE` + `CEILING_WRITE_ALLOWED_READ_NOT_IMPLIED`; every write fact on the ceiling realm, `diskUnchanged=true` |
| **BL-16** | `grep` / `glob` | **PASS** | `OUT_OF_LANE_REFUSED_BEFORE_ANY_PROCESS`: `confinedSpawns=0`, `baseSpawns=0`, 1 deny `spawn` fact; positive `IN_LANE_GREP_ALLOWED_AND_CONFINED`, `confinedSpawns=1` |
| **BL-17** | shell / PTY | **NOT-RUN** (admission + write axis measured; network probe not exercised) | bash is `{"kind":"confined-terminal","sessionId":"confined-pty-2"}`; out-of-lane write `Permission denied`, `outsideFileExists=false`; guard admitted the spawn (`allow`,`allow`) |
| **BL-18** | `web` | **PASS** (deny + positive) | deny: `NETWORK_UNCONFINED_REALM`, `connections=0`, 1 deny fact, `hostWebCalls=0`; allow: verbatim body, `connections=1`, 1 allow fact |
| — | `edit` | **PASS (conditional)** | in-lane edit served (`writeCalls=1`, 3 facts); outside-ceiling edit refused (`writeCalls=0`, `guardFacts=0`) but locus is **host read-before-write policy**, not the Team guard |
| — | `read_image` | **NOT-REACHED / conditional** | text-only model route refuses before provider (`facts=0`, 0 bytes); no image-capable route was exercised |

## 1. Method, instruments, effective preset

### 1.1 Three instruments, six Host starts, one head

| instrument | command | starts | covers |
| --- | --- | --- | --- |
| PD-33 Preview E2E, shipped opt-in preset | `node dev/agent-workflow/evidence/g2-live/pd33/run-boot.mjs --arms e2e --boots 2` | 2 | read/grep/glob/write/edit/bash/web on the **shipped** `a5sf-governed-member` preset, plus out-of-lane refusals |
| FS/Search 14-row, axis detail | `node dev/agent-workflow/evidence/g2-live/fs/run-boot.mjs` (run twice) | 2 | read axis A/B/C, write 4a/4b, grep/glob zero-process law, edit, read_image |
| PD-30 web preview, deny arm | `node dev/agent-workflow/evidence/g2-live/pd30/run-boot.mjs --arm deny --boots 2` | 2 | `network: deny` lane refusal **before** the provider, on the shipped web face |

Every start was preceded by a **zero-boot preflight PASS**: the FS driver's own bundle
(`PASS 18/18`, in each `run-01/run-02/run.log`), and each driver's `--plan` on this head.
`:3080` was never touched. Ports came from the 3180 family through WorldFactory leases.
`DSH_HOME` lived under the workspace (`tests/homes/u5…`); all six Worlds were torn down and
their homes deleted (no `u5u5a5sf*` directory remains).

**Machine concurrency:** never more than 2 dev Hosts. Two pairs overlapped in wall time
(FS run-01 + PD-30 boot-1); the port lease serialised the listening window (FS released 3191 at
`00:03:34`, PD-30's Host listened from `00:03:36`).

### 1.2 Drivers (committed here, with digests)

| copy | sha256 | provenance |
| --- | --- | --- |
| `fs/run-boot.mjs` | `ad1e4a4dfc82d6737e53c2f2d7aa04d6b7b2d45eaa12bb09ad71fb52dd766633` | byte-identical to `dev/agent-workflow/evidence/a5sf-fs-devlive/driver/run-boot.mjs` |
| `fs/a5sf-fs-devlive-realm-row.mjs` | `6c9d61ba6beb2eea71a18c561287a722cd838d0cd837f80f03c8dd7c07e69b2c` | byte-identical |
| `fs/preflight-bundle.mjs` | `80a0408c1fdcdfbb89de8639602ed5814836b24b6e8d077c18a1fdac32e1a235` | byte-identical |
| `pd33/run-boot.mjs` | `274e08286fb53f002de5344e570f70aef87f17aa7342de4e55c0a0644eb57fbc` | copy of `tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs`; **only** the 8 import specifiers, `REPO_ROOT` depth and the `EVIDENCE` path changed (10 changed lines per side) |
| `pd33/pd33-base-web-tripwire.mjs` | `a474c0db5409cd76b6a87370271cb85615022d451a8a8c720b7b702b197bd752` | byte-identical copy |
| `pd30/run-boot.mjs` | `2f6d0951f0e2281c93e9ab0d789e5e071de2fd7a270d321c9448f21ff3b641ea` | copy of `tests/world-factory/drivers/a5sf-pd30-web-preview/run-boot.mjs`; same relocation-only change (11 changed lines per side) |
| `pd30/pd30-base-web-tripwire.mjs` | `2dca6575989903dcc9a674d30b888a6cb1efd2291197ff2987efc7cda98ed5d0` | byte-identical copy |

The relocation is disclosed because a copy is what ran; the judge/arm code is unchanged, so a
verdict here is comparable to the accepted runs in `a5sf-fs-devlive/`, `a5sf-pd33-preview-e2e/`
and `a5sf-pd30-web-preview/`.

### 1.3 Effective preset, and the Alpha.6 plane

- PD-33/PD-30 mount the **shipped** rows (`dsh-agent-team/host` + `preset-a5sf-governed-member`
  + `a5sf-web-transport`) through a World install graph
  (`profiles/web/node_modules/dsh-agent-team -> <repo>`); the model is the scripted mock.
  `runs/boot01/preset-effective.json`: `preset-a5sf-governed-member`, `memberPresetId:
  a5sf-governed-member`, `a5sfGovernedRealm: true`, 17 governed-preset plugins
  (`persona,agent-instructions,tool-bash,tool-fs,tool-fs-search,tool-jobs,tool-skill,tool-present,
  tool-web,command-goal,tool-goal,plan-mode,compaction-basic,command-compact,tool-result-pruner,
  tool-todo,tool-plugin-manager`); no row name is rewritten (PD-30 asserts `rewrites` empty;
  PD-33's `preset-effective.json` records the shipped row names).
- **The Alpha.6 plane is not loaded.** `grep -c alpha6 runs/boot01/preset-effective.json` = `0`;
  no row config contains `alpha6ReviewRouting` (all five rows: absent). These measurements are
  therefore governed **Alpha.5** behaviour, not the experimental Alpha.6 review/approval plane.
- The FS/Search 14-row instrument is an **axis-detail lane**, not the shipped preset: it mounts
  the accepted candidate-1 realm composition (`a5sf-fs-devlive-realm-row.mjs`, product
  `installToolBindingRealm` + the product's own `intersectPathRuleSets`) and an evidence preset
  `preset-a5sf-fs-devlive-base`. This is the same fixture limitation disclosed in
  `a5sf-fs-devlive/README.md` §1; the shipped-preset confirmation comes from PD-33.

## 2. Per-BL evidence

Each row gives both run directories. The two runs agree at verdict **and** at decisive-number
granularity (`fs/agreement.txt`, `fs/agreement.json`, `pd33/agreement-e2e.txt`,
`pd30/agreement-deny.txt`).

### 2.1 BL-14 — `read`: **PASS**

**Positive (shipped preset, PD-33 `pd33:member-a-io-chain`).** Both boots:
`factless=[] counts={"read":3,"grep":1,"glob":1,"web_fetch":2,"web_search":1,"write":1,"skill":2,"edit":1,"bash":56,"present":2}`.
The in-lane read was dispatched, settled, and left 3 read facts.

**Minimal-permission negative (shipped preset, PD-33 `pd33:member-a-authorization`).** Verbatim
(workspace path elided):
`codes=["IO_READ_DENIED"] text=Error: authored locator '…/AGENTS.md' is outside every allow subtree of the lane`,
`facts=1`, `decisions=["deny"]`.

**Axis detail (FS 14-row).**
- `live:row1-read-a-inside-both-allowed` → `READ_A_ALLOWED_AND_CONFINED`, `allowFacts=2`,
  `bindingAllowFacts=2`, `counterRows=1` (the confined provider actually served it).
- `live:row2-read-b-binding-deny-on-read-path` → `BINDING_DENY_ON_READ_PATH`,
  `readPathFacts=1`, `readPathMethods=["stat"]`, `readPathDecisions=["deny"]`,
  `everyReadPathFactOnBindingLane=true`, `counterRows=0`.
- `live:row3-read-c-refused-no-widening` → `REFUSED_WITHOUT_WIDENING`,
  `ceilingDenies=true, restrictionAllows=true, effectiveDenies=true, noWidenedAllow=true`,
  `noProviderRead=true`.

Run dirs: `fs/run-01/`, `fs/run-02/`; `pd33/runs/boot01/`, `pd33/runs/boot02/`.
**Would be falsified by:** any out-of-lane read returning bytes, a read-path fact on the
`member` realm instead of the binding realm, a provider read after a deny, or row 3 granting an
allow that the ceiling does not contain.

### 2.2 BL-15 — `write`: **PASS** (live half; caveats below)

**Positive (FS `live:row4a-write-in-lane-readable-allowed-ceiling-only`).**
Verbatim: `"checks":{"notError":true,"diskMatches":true,"allowFactPresent":true,"everyWriteFactOnCeiling":true,"confinedProviderServed":true}`.
The written file is byte-exact on disk and every write fact is on the **ceiling** realm.

**Minimal-permission negative / write does not imply read
(FS `live:row4b-write-b-ceiling-allowed-read-not-implied`).**
Verbatim: `"checks":{"isError":true,"ceilingWriteAllowed":true,"noReadLaneWriteAllow":true,"notTeamLaneRefusal":true,"notReadCouplingRefusal":true,"noPlantedBytesReturned":true,"diskUnchanged":true}`.
The refusal is the native `write` tool's own read-before-write contract, not a Team lane; the
planted bytes never came back and the prompt-injected disk content is unchanged.

**Shipped-preset confirmation (PD-33 `pd33:member-a-io-chain`).** `write` and `edit` each leave
their own guard fact; the artefact contains `A5SF_PD33_A_EDIT_AFTER` on disk.

**Coverage caveats (not measured here, so not claimed):** a native `write` to a path outside the
Member ceiling is **not** a separate row (the driver's write rows are 4a/4b; the out-of-lane
write probe is a `bash` write, §2.4); atomic replace / version check is not exercised by this
instrument. Those are the BL-15 items that remain open; they are not turned green by this run.

Run dirs: `fs/run-01/`, `fs/run-02/`; `pd33/runs/boot01/`, `pd33/runs/boot02/`.
**Would be falsified by:** a write fact outside the ceiling realm, a byte change on a refused
write, or a read becoming possible because a write was allowed.

### 2.3 BL-16 — `grep`/`glob`: **PASS**, including the BL-16 law

**Out-of-ceiling search refused before any process exists.** Verbatim from
`fs/run-01/oracle-samples.json` (`live:search-row2-grep-outside-ceiling-refused`):
```
"confinedSpawns": 0,
"baseSpawns": 0,
"factCount": 1
```
The single fact is `method="spawn"`, `decision="deny"`, `decidedBy="IO_READ_DENIED"`,
`locator` = the declared out-of-ceiling root. The tool error is
`Error: grep subprocess failed before reporting an outcome (ripgrep provider failure)` and no
forbidden token is present (`leakedTokens=[]`). The run-02 numbers are identical.

**Positive.** `live:search-row1-grep-in-lane-allowed` → `IN_LANE_GREP_ALLOWED_AND_CONFINED`,
`confinedSpawns=1`, `baseSpawns=0`, `factCount=1`; `M-07 glob: in-lane=PROVEN(IN_LANE_GREP_ALLOWED_AND_CONFINED)`.
**Restriction is narrower than the ceiling.** `live:search-row3-grep-outside-restriction-refused`
→ `RESTRICTION_NARROWER_THAN_CEILING_REFUSED_AT_ADMISSION`, `confinedSpawns=0`, `baseSpawns=0`.

**Shipped-preset confirmation (PD-33).** `grep:1`, `glob:1` guard facts in
`pd33:member-a-io-chain` on the 36-name governed surface.

Run dirs: `fs/run-01/`, `fs/run-02/`; `pd33/runs/boot01/`, `pd33/runs/boot02/`.
**Would be falsified by:** any `confinedSpawns>0` or `baseSpawns>0` (or a `confined-spawn-attempt`
row) on the out-of-ceiling search, a missing/allow deny fact, forbidden bytes in the result, or
a glob result from outside the lane.

### 2.4 BL-17 — shell/PTY: **NOT-RUN** (2 of 3 clauses measured)

This row is **not** green and is not reported as green.

- **Shell-class admission — measured (PASS).** PD-33 `pd33:member-a-io-chain` +
  `pd33:member-a-authorization`: the Member's `bash` result is
  `{"kind":"confined-terminal","sessionId":"confined-pty-2",…}`; the shell leaves 56 `bash`
  guard facts and is dispatched on the governed surface. It is the confined terminal face, not
  the inherited legacy PTY of `a5sf-pty-devlive/` (that lane's subject was an older tree).
- **Write axis — measured, with an explicit locus.** `pd33:shell-write-boundary` (both boots,
  PASS as its own proposition): the guard **admits** the spawn
  (`codes=["ALLOW","ALLOW"]`, `decisions=["allow","allow"]`) and the **OS profile** stops the
  write: `"/bin/bash: line 1: ../a5sf-pd33-outside.txt: Permission denied"`, `exitCode=1`,
  `outsideFileExists=false`. Safety holds; the service axis is not the barrier. That is the
  disclosed BL-17 boundary, reproduced on this head — it is not a service-level write refusal.
- **Network probe — NOT-RUN.** No shipped composition in this lane declares `network: deny` for
  the shell, and the Host's providers report network enforcement `unsupported`. A live
  deny-lane bash was therefore not exercised; the host-free position
  (`NETWORK_UNCONFINED_REALM` before the guard, 0 processes) is not re-labelled as live.
  Building a new blueprint arm to make this clause green would be inventing a driver, which this
  brief forbids.

Run dirs: `pd33/runs/boot01/`, `pd33/runs/boot02/` (no BL-17-specific driver was spent).
**Would be falsified by:** a bash call served on a deny lane, a shell schema that is not the
confined terminal, or out-of-lane write bytes on disk. The network clause stays unmeasured until
a live deny-lane shell can be declared.

### 2.5 BL-18 — `web`: **PASS**

**Deny-lane refusal before the provider (PD-30 `--arm deny` `pd30:web-deny`, both boots).**
Verbatim:
```
call-refused      = isError=true
typed-refusal     = text=Error: NETWORK_UNCONFINED_REALM: the effective lane requests network=deny, but the web provider's capability probe reports network-destination='unsupported' …
zero-connections  = connections=0 requests=[]
one-deny-fact     = facts=[["web:fetch","deny","NETWORK_UNCONFINED_REALM"]]
no-inherited-transport = host web calls=0
```
The fixture's own connection counter is 0, so the refusal is before the wire, not after a
timeout.

**Positive, allow lane (PD-33 `pd33:member-b-web`, both boots).** `fetch-body-verbatim` with
`A5SF_PD33_KNOWN_BODY_BYTES`, `connections=1`, `pathHits={"/known":1}`,
`fetch-allow-fact facts=1`; `web_search` is the shipped typed gap
(`WEB_PROVIDER_UNAVAILABLE`, `POST /search=0`, 1 fact — never a fabricated answer).

**`read_image` on an `image` route — conditional, measured as a refusal.** PD-33
`pd33:read-image-route`: the text-only model route refuses **before any provider I/O**:
`model "deepseek-v4-flash" does not declare image input`, `facts=0`, `isError=true`. The FS
instrument's `fs:read-image-observation` is `NOT_REACHED` for the same reason
(`READ_IMAGE_ROUTE_REFUSED_MODEL_DECLARES_NO_IMAGE_INPUT`, `guardFacts=0`). No image-capable
route exists on this head, so `read_image` is **not** claimed as a working positive.

Run dirs: `pd30/runs/deny/boot01/`, `pd30/runs/deny/boot02/`; `pd33/runs/boot01/`,
`pd33/runs/boot02/`.
**Would be falsified by:** one connection or one request on the deny lane, a second guard fact,
an inherited host-web call, a fabricated search answer, or a text-only route that reaches the
provider.

### 2.6 `edit` — **PASS (conditional)**

- Positive: FS `fs:edit-in-lane` → `CEILING_EDIT_ALLOWED_AND_CONFINED`, `writeCalls=1`, `facts=3`.
- Negative: FS `fs:edit-outside-ceiling` →
  `OUTSIDE_CEILING_EDIT_REFUSED_BEFORE_PROVIDER_LOCUS_host-read-before-write-observation-policy`,
  `writeCalls=0`, `guardFacts=0`, verbatim
  `Error: cannot modify "…/ceiling-outside-edit/secret.txt": file has not been read — read the file, then retry`.
  The refusal is real and pre-provider, but its locus is the **host's** read-before-write
  observation policy, not the Team guard. The Team guard's own out-of-lane edit refusal remains
  unmeasured on a live Host.
- PD-33 independently confirms the shipped-preset `edit` leaves its own fact and the artefact is
  on disk.

Run dirs: `fs/run-01/`, `fs/run-02/`; `pd33/runs/boot01/`, `pd33/runs/boot02/`.
**Would be falsified by:** an outside-ceiling edit with a guard fact attributed to the Team lane
(that would move the locus), or an in-lane edit that does not reach the provider.

## 3. Two-run agreement and the one record-level red

- **FS/Search:** 14 cases, 13 `PASS` + 1 `NOT_REACHED` on **both** boots; agreement on verdict,
  reason and decisive numbers is `true` (`fs/agreement.json`). The `NOT_REACHED` case is
  `read_image` (text-only route), not a product failure.
- **PD-33:** the 10 executed E2E cases are `PASS` in both boots and agree
  (`pd33/agreement-e2e.txt`). The run-record `overall=FAIL` is **not** a product failure: the
  driver's `selectedCases` is a static 18 and `--arms e2e` does not narrow it, so the 8 lifecycle
  arms that were not run are filled fail-closed with
  `{"reason":"selected case produced no verdict (fail-closed)"}`. They are listed in
  `pd33/agreement-e2e.json#not_run_arms_driver_filler_fail`; none of them is a G2 row. This is a
  driver-selection defect, disclosed rather than patched mid-measurement.
- **PD-30 deny:** 2/2 boots `PASS`, all counters identical (`pd30/agreement-deny.txt`).

## 4. Exact commands

```bash
# host-free first (each driver has its own --plan; spend no boot)
node dev/agent-workflow/evidence/g2-live/pd33/run-boot.mjs --plan
node dev/agent-workflow/evidence/g2-live/pd30/run-boot.mjs --plan
node dev/agent-workflow/evidence/g2-live/fs/run-boot.mjs --plan

# the measured pairs
node dev/agent-workflow/evidence/g2-live/pd33/run-boot.mjs --arms e2e --boots 2
node dev/agent-workflow/evidence/g2-live/fs/run-boot.mjs     # run-01
node dev/agent-workflow/evidence/g2-live/fs/run-boot.mjs     # run-02
# the second start archives the first start's top-level files into fs/runs/<stamp>/;
# this lane copied that first set to fs/run-01/ and the live set to fs/run-02/
node dev/agent-workflow/evidence/g2-live/pd30/run-boot.mjs --arm deny --boots 2
```

Console transcripts are in `.artifacts/g2-live/` at the worktree root (untracked scratch) and, for the decisive
verdicts, in each run directory's `run-record.json` / `verdicts.json` / `run.log`.

## 5. Boot ledger (6 starts, all self-authorised `DEV-LIVE`)

| # | driver | World / `DSH_HOME` | port | start (UTC) | outcome | teardown |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PD-33 | `u5u5a5sfpd33-20261109T23-50-47Z` | 3191 | 2026-11-09T23:50:47Z | 10/10 executed E2E PASS | home deleted, slot released |
| 2 | PD-33 | `u5u5a5sfpd33-20261109T23-53-04Z` | 3191 | 2026-11-09T23:53:04Z | same, agreeing | home deleted, slot released |
| 3 | FS | `u5u5a5sfdev1-20261109T23-56-26Z` | 3191 | 2026-11-09T23:56:26Z | 13 PASS / 1 NOT_REACHED | home deleted, host dead, no orphan |
| 4 | PD-30 | `u5u5a5sfpd30-20261110T00-02-27Z` | 3191 | 2026-11-10T00:02:27Z | 4/4 PASS | home deleted, slot released (3191 reused after FS run-01 released it) |
| 5 | FS | `u5u5a5sfdev1-20261110T00-04-37Z` | 3192 | 2026-11-10T00:04:37Z | identical 13/1 | home deleted, host dead, no orphan |
| 6 | PD-30 | `u5u5a5sfpd30-20261110T00-04-31Z` | 3191 | 2026-11-10T00:04:31Z | 4/4 PASS, agreeing | home deleted, slot released |

`:3080` untouched; no port outside `tests/paths.mjs` ranges. Every start row is in
`pd33/run-ledger.jsonl`, `fs/run-ledger.jsonl`, `pd30/run-ledger.jsonl` (the FS file is the
cumulative FS/Search DEV-LIVE ledger: 2 intent rows, 2 boot rows, 2 outcome rows). All rows carry `recordClass=DEV-LIVE`.

## 6. What this does **not** establish

- **No CANDIDATE-C2.** Every record is `DEV-LIVE`; `candidateClaimEligibility` is
  `{eligible:false, code:"DEV_LIVE_EVIDENCE_NOT_CANDIDATE"}`. No frozen candidate, no
  independent adjudication, no release claim.
- **No `V@B` or grade change.** Per the operator guide, a DEV-LIVE record cannot produce
  `V@B=yes`; the matrix's ⑧/⑨ cells are the coordinator's to book, not this lane's.
- **Single-tree evidence.** Everything is `0f4f4f8eb` only. It says nothing about any other
  head, and it does not re-establish the earlier `1484fa4ee`/`44babbfcf` claims.
- **No network confinement.** The deny lane refuses because this host cannot prove
  `enforced`; that is fail-closed, not an offline sandbox. BL-17's network clause, BL-42 and any
  OS-level egress claim remain open.
- **No image capability.** `read_image` is measured only as a conditional refusal
  (text-only route); no image-declaring route was exercised.
- **No atomic/versioned write, no native write-outside-ceiling case, no dual-Member
  concurrency** for the FS rows, and no shell network-deny live arm.
- **The PD-33 record-level `overall=FAIL`** is the unselected-arm filler described in §3, not a
  product refusal. A reviewer who needs an `overall=PASS` record should run the full arm set
  (not done here because it spends boots on lifecycle arms outside G2).
- **Fixtures are fixtures.** The model is the shared scripted mock; the FS lane's ceiling /
  restriction inputs and confined face come from an evidence provider row; the web origins are
  local fixtures. The product path (preset row, compiler, guards, confined faces, providers) is
  the shipped one on the PD-33/PD-30 instruments.

## 7. Files

```
README.md                       this file
dev-live-grant.json             the DEV-LIVE authorisation row
fs/                             FS/Search instrument (byte-identical to a5sf-fs-devlive/driver)
  run-01/ run-02/               the two full run directories (records, oracle samples, counters, teardown)
  agreement.json / .txt         two-run agreement at verdict+reason+decisive-number granularity
  run-ledger.jsonl              the two start rows
pd33/                           PD-33 instrument (relocated copy, diff = imports/paths only)
  runs/boot01/ runs/boot02/     per-boot: run-record, verdicts, e2e, guard-facts, preset-effective, teardown
  agreement-e2e.json / .txt     the 10 executed cases + the 8 filler FAILs, explicitly separated
  derived-key-clauses.json      per-boot key clause details for the BL rows
  run-ledger.jsonl              the two start rows
pd30/                           PD-30 web deny instrument (relocated copy, diff = imports/paths only)
  runs/deny/boot01/ boot02/     run-record, counters, guard-facts, transcript, teardown
  agreement-deny.json / .txt    two-run agreement
  run-ledger.jsonl              the two start rows
```
