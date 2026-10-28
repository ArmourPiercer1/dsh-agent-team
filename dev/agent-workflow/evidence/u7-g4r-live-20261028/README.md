# G4-R phase 2 — live candidate C2 lane (evidence only; no gate verdict)

Lane: `task/u7-g4r-live-20261028` (single writer, worktree `.worktrees/u7-g4r2`),
executing the three live legs of
`docs/plans/memo/unified-baseline-alpha5-20261025/gates/G4-PROMOTION-REVIEW-R1.md`
§"What closes it" on ONE freshly frozen clean candidate. This packet reports the
records exactly as the harness produced them. **No gate verdict is claimed here**
and the gate ledger was not touched. CORE PATCH BUDGET = 0 honored; nothing under
`packages/**` changed; no judge/assembly/suite logic modified in this lane; the
stable instance `:3080` and its DSH_HOME were only read via the sanctioned
read-only GET `/` probe (401 before and after every leg — runner fields + manual
curl in each `run.log` era).

## Candidate (frozen BEFORE any boot)

- `CANDIDATE.md` was committed first; the frozen candidate SHA is that commit:
  **`ef9fbad53323893ecdb3651a7c2cdd7c8c0839a8`** (base `origin/master`
  `6457b9675ea2f1e940923f23ae344ad2587da798` = PR #426 "persist World profile and
  per-suite oracle bindings").
- Both live records bind `teamSha = ef9fbad533…` — exactly the frozen SHA — with
  `teamTreeClean: true` (ARC-D) at launch; Host `639ed015397290b3745d163aafe02ffee4aa3f84`
  pristine porcelain-empty before and after; authority pointer `as20261026r1` /
  `sha256:93692d7aeb…1516a4d4` (same digest as the G4-I packet's inputSnapshot).
- Byte pins, toolchain, port baseline (`ss -ltn`), and the 401 probe: see
  `CANDIDATE.md`, `ss-ltn-baseline.txt`, `stable-3080-probe-pre.txt`.

## The three runs — commands and start count

| leg | command (verbatim per named lane README / runner usage header) | host boots |
|---|---|---|
| ARC-B | `node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs` | **0** (refused pre-spawn, see below) |
| ARC-D (start 1) | `node tests/world-factory/u5-canary-runner.mjs --suite u6-arc-d --line g4rd --evidence dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d --budget-ledger dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d/host-starts.jsonl --max-host-starts 1` (no `--run-record` — operator omission) | 1 |
| ARC-D (start 2, persisted record) | `node tests/world-factory/u5-canary-runner.mjs --suite u6-arc-d --line g4rd2 --evidence dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d --run-record dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d/run-record.json --budget-ledger dev/agent-workflow/evidence/u7-g4r-live-20261028/arc-d/host-starts-retry.jsonl --max-host-starts 1` | 1 |
| Jobs | `node tests/world-factory/u7-4a-jobs-suite.mjs --run-id u7g4r-jobs-1 --line g4rj --evidence dev/agent-workflow/evidence/u7-g4r-live-20261028/jobs --budget-ledger dev/agent-workflow/evidence/u7-g4r-live-20261028/jobs/host-starts.jsonl --max-host-starts 1` | 1 |

**Start count: 3 Host boots total** (ARC-D ×2, Jobs ×1), within the parent budget
"3 starts +1 only for an ENV failure — never for a FAIL verdict". The ARC-D pair:
start 1 (`run.log`, world `u5g4rd-20261028T11-21-33Z`) ran to completion
(`RUN-SUMMARY … overall=PASS cases=12 PASS:12`) but I omitted the documented
`--run-record` flag, so no finalized record was persisted; that is an operator
error, not a FAIL, and the +1 budget covered the corrected re-run. Start 1's
retained digest (`u5-u6-arc-d-g4rd-2026-10-28T11-21-33-789Z.digest.json`),
oracle artifact and redacted host log remain here for audit; it is **not** the
acceptance record. ARC-B's refusal spawned no Host (0 starts). Every World home
was removed by normal teardown (`tests/homes/` empty after each leg), `ps` shows
no stray `apps/cli|canary-runner` process, and shared lease files are only
reclaimable dead-pid slots.

## ARC-B leg — BLOCKED by the named runner's own committed boot-budget (0 starts)

`arc-b/BLOCKED.md` + `arc-b/run-attempt.log`: the merged lane's
`c2/boot-budget.jsonl` already holds 7 boot declarations against the runner's
hardcoded `const BUDGET = 7`, so `declareBoot` fails closed:
`FATAL Error: boot budget exhausted: 7/7 declared in …/u7-tbash-l4-20261027/c2/boot-budget.jsonl`.
The runner has no lane-independent `--evidence/--budget-ledger` seam and
hardcodes its `evidence[]` citations to the OLD lane directory, so on this
committed tree there is **no** way to boot ARC-B that does not either edit
another lane's committed harness/ledger (forbidden here: "do not fix it here")
or produce a record whose evidence pointers resolve to a different run's files
(misattribution this gate cannot accept). No dry-run substitution is claimed
(`--dry-run` is `mode:"dry-run"` judge output, never a live C2 record). The
attempt created one World home before the refusal (`tests/homes/u5u7tb-20261028T11-18-52Z`,
ownership marker `createdBy` = the just-exited runner pid, no boot, no token);
it and the empty scratch dir were removed and disclosed in the receipt.
ARC-B therefore has **no candidate-bound live record from this lane**; boot 7
remains HISTORICAL-ONLY exactly as R1 grades it. Closing ARC-B needs a
main-agent ruling (raise that lane's budget with disclosure, or land a runner
change with a lane-independent seam) — deliberately not done in this lane.

## Per-record table (as produced)

### ARC-D — `arc-d/run-record.json`

| field | value |
|---|---|
| schema | `u5-run-record/1` |
| finalized | yes (all 11 selected `arcd:*` cases judged + `stable-instance-unchanged` post-check; `finishedAt 2026-10-28T11:23:48.963Z`; fail-closed law in `createRunRecord.finalize`) |
| overall | **PASS** (12/12) |
| teamSha | `ef9fbad53323893ecdb3651a7c2cdd7c8c0839a8` = frozen SHA |
| teamTreeClean | `true` |
| hostTreePristine | `hostSha = hostTreeSha = 639ed015397290b3745d163aafe02ffee4aa3f84`, `hostPorcelainEmptyAtStartup: true` |
| composedProfileDigest | `{u5g4rd2-20261028T11-22-54Z: [sha256:708c516e…b705a2]}` (per-boot; evidence bytes `arc-d/logs/u5g4rd2-*/composed-profile-708c51….patch.yml`) |
| worldOracle | digest `sha256:16e25d723a5ca36e30ef50f353162654dbc38939ea33a3afed086592fbe330b5`, `complete: true`, entry `tests/world-factory/suites/050-u6-arc-d.mjs`, 4 sources; cited artifact `arc-d/u5-u6-arc-d-g4rd2-….oracle.json` (sha256 `e982783f…39698f2`, graded by eb3 RUN_EVIDENCE rules) |
| trustedSources.unavailableReason | "The runner public World/HTTP surface exposes no plane TrustedSources/admission source document or digest. authoritative-tool-sources.v1.json is census inventory, not the plane admission document; it cannot substitute." (explicit, not fabricated) |
| cases | `arcd:mounted` PASS · `arcd:positive` PASS · `arcd:spoof-zero-authority` PASS · `arcd:swap-refused` PASS · `arcd:unbound-refused` PASS · `arcd:replay-refused` PASS · `arcd:ci03-native-parity` PASS · `arcd:restrict-veto` PASS · `arcd:lift-control` PASS · `arcd:marker-ledger` PASS · `arcd:teardown-honest` PASS · `stable-instance-unchanged` PASS (`:3080` 401→401 `unchanged:true`) |
| start | 1 boot, ledger `arc-d/host-starts-retry.jsonl`; port 3184; teardown honest (`arcd:teardown-honest` PASS, home removed) |

Direct-disk CI-03: `nativeEvidence {readFromDisk:true, present:true,
contentMatches:true}` inside the record — a real native read→edit, not the
pair's test-only writer.

### Jobs Bridge — `jobs/u7g4r-jobs-1.u74a-run-record.json`

| field | value |
|---|---|
| schema | `u5-run-record/1` |
| finalized | yes (all 12 selected cases judged; `finishedAt 2026-10-28T11:26:02.495Z`) |
| overall | **FAIL** — by the harness's own worst-of law, caused **solely** by the ENV-native leg below; the 11 Team/Bridge functional cases are PASS. Reported unrelabelled; no retry (a FAIL is never retried under the budget law) |
| teamSha | `ef9fbad53323893ecdb3651a7c2cdd7c8c0839a8` = frozen SHA |
| teamTreeClean | **absent field** — this runner records no `teamTreeClean` cell (as produced; not retrofitted) |
| hostTreePristine | `hostSha = hostTreeSha = 639ed01539…` (`assertHostBase` at startup and after) |
| composedProfileDigest | `{u5g4rj-20261028T11-24-11Z: [sha256:4b9c6f61…a97be0]}` (evidence bytes `jobs/logs/u5g4rj-*/composed-profile-4b9c6f….patch.yml`) |
| worldOracle | digest `sha256:52d884f3e641763282eb598f72430e059fe1dd58e475dbf8d66de1d4b4c1b86b`, `complete: true`, entry `tests/world-factory/u7-4a-jobs-suite.mjs`; cited artifact `jobs/u7g4r-jobs-1.oracle.json` (sha256 `f9bcf46e…22fc0f`) |
| trustedSources.unavailableReason | same explicit public-surface-limitation sentence as ARC-D (verbatim in record) |
| cases | `u74a:mounted` PASS · `u74a:bg-receipt-carries-host-job-id` PASS · `u74a:attributed-server-side` PASS · `u74a:ring-bytes-via-job-output-wait` PASS · `u74a:list-shows-owner` PASS · `u74a:kill-live-requested` PASS · `u74a:kill-finished-honest` PASS · `u74a:foreign-cross-scope-refusal` PASS · `u74a:planted-unattributed` PASS · **`u74a:native-ctl-unaffected` FAIL** · `u74a:exactly-once-approvals` PASS · `stable-instance-unchanged` PASS |
| start | 1 boot, ledger `jobs/host-starts.jsonl`; port 3187 |

### ENV_BLOCK note (the one FAIL, with the recorded detail — never PASS)

The FAIL is the CI-03 native control leg (`u74a:native-ctl-unaffected`), a
**host-environment block** identical in cause to G4-R carried risk R-G4R-2, not
a Team defect. Judge-recorded detail (verbatim fields in the record):
`laneDone` all true (the leg drove to completion), `rootKernelMentions: 0`, and
`ctlHead` = the host's own refusal returned as the native bash tool result:

> `Error: sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux), ensure sandbox-exec is usable (macOS), or ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.`

Full text retained in `jobs/logs/u5g4rj-20261028T11-24-11Z/u7g4r-jobs-1.u74a-evidence.json`
(`ctlResult`). At this host/pin the refusal renders in that wording (the token
`SANDBOX_UNAVAILABLE` itself appears nowhere in this build's output — the
fail-closed law is the sentence above, so it is quoted exactly rather than
relabeled). Because the native foreground bash never ran, the claim string it
was to write cannot appear, and the judge's law (claim present + zero kernel
vocabulary + laneDone) is not satisfiable on this host — per
`G4-PROMOTION-REVIEW-R1.md`: "ENV_BLOCK is never PASS". The bwrap probe is
recorded at `jobs/bwrap-probe.log`:

> `bwrap: No permissions to create new namespace, likely because the kernel does not allow non-privileged user namespaces. …` (exit=1)

Per the gate doc, the Bridge verdict must not depend on this leg: the named
Bridge functionality (attribution, ring bytes, list owner, live kill,
finished-kill honesty, cross-scope/unattributed refusal, exactly-once approval
through the public `team.resolveControl` v4 seam) is the 11 PASS legs; whether
an overall that is non-PASS **solely** because of this ENV leg can count toward
G4 is explicitly the reviewer's ruling, not this lane's. No sandbox relaxation,
no native substitution, no product patch was used.

## Gates and delivery

Commands run on the final committed tree, logs in this directory:
`node scripts/eb3-run-manifest.mjs --new-since origin/master`
(`run-manifest.log`: pass, records=101, findings=0),
`node scripts/eb3-evidence-guard.mjs --new-since origin/master`
(`evidence-guard.log`: pass, added=32, findings=0),
`git diff --check origin/master...HEAD` (`diff-check.log`: first run exit 2 on
ss-capture column padding in 3 files, whitespace-only normalization commit,
final run clean), `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store`
(`ci-pr-gate.log`: 7 pass / 0 fail / 1 named census skip, exit 0).
Delivery: PR **#427** (base master, plain push, no merge); remote CI
conclusions are recorded in the session log, not asserted here.

## What this lane did NOT do

No `packages/**` change, no upstream patch, no judge/assembly/suite edit, no
ledger edit, no merge, no force-push, no `git add -A`; nothing but the evidence
paths was committed until after all boots finished; `:3080` never booted nor
written; no gate verdict claimed; the ARC-B blockage and the Jobs ENV leg are
reported as-is.
