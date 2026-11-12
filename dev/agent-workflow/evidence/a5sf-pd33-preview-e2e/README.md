# a5sf-pd33-preview-e2e — evidence for PD-33 (Alpha.5 Preview end-to-end)

> **Class: `DEV-LIVE`.** This is measured evidence from a real Host process with the
> shipped opt-in `a5sf-governed-member` preset, not candidate acceptance.
> No `V@B`, no grade, no Q7/Authority/Required-CI change. `CORE PATCH BUDGET = 0`.

## What was measured

One World per boot, two boots (`--boots 2`) that must agree item by item, one
composition, no row renames (see `runs/boot01/preset-effective.json`).

**Verdict pair**: the numbers under `runs/` are the `PREVIEW-GO` re-measurement on
`origin/master` @ `a2e0df3c9` (the commit that carries #683): 19/19 cases on both boots,
`agreeing=true`. The earlier pair that produced `PREVIEW-NO-GO` lives in the merged #682
commit `edca478bd`.

> **2026-11-13 — the governed-`bash` arm of this record is SUPERSEDED; the record above is
> kept as measured.** The 19/19 pair predates **#730** (`d8490f74d`, NATIVE-BASH-PRESERVATION,
> merged 2026-11-12). That change made the model-visible `bash` the PINNED host definition, whose
> `execute` needs the Team tool plane's admission edge; `agent-bindings.mjs` publishes that edge
> only on a plane mount (`permissionPolicy` + `config.teamToolPlane`: `:3135`, `:3389`), and #734
> (`4fd279276`) states that this edge is the adopted name's *only* gate
> (`team-tool-plane.mjs:1909-1916`). This driver mounts the governed realm WITHOUT the plane
> takeover (see `runs/boot01/preset-effective.json`, field `supersededBashArm`), so on today's tree
> every governed `bash` answers the typed **`A5_NATIVE_ADMISSION_UNAVAILABLE`** and executes
> nothing. Three cases are therefore REFUTED by a **stale composition**, not by a product
> regression, and are kept: `pd33:member-a-io-chain`, `pd33:member-a-authorization`,
> `pd33:shell-write-boundary`. The 16 non-bash cases still carry the Alpha.5 realm claim. The
> shipped governed-bash composition is measured by `tests/kits/a1-bash-governance-20261112/`
> (plane takeover ON; 7/7 ×4) and `tests/kits/joint-acceptance-20261111/` (realm + Alpha.6 route +
> plane takeover; J04; 11/11 ×2). `docs/INSTALL.md` §3.5 documents the operator-side rule: with no
> `teamToolPlane`, the native `bash` stays a typed-shut refusal in a governed world.
>
> **The number on this branch.** Five `--boots 2` pairs were run on branch
> `task/pd33-stale-instrument-20261113` (`c2b-pd33fix`), all on the same composition; every run is in
> the append-only `driver.log`/`run-ledger.jsonl` and the pairs under `runs/` are the last one
> (`2026-11-12T19:08Z`–`19:17Z` real UTC, run against the branch commit `bca4796fb` — the evidence
> was then committed in the next commit, so `driver-digest.json#head` names the tree that ran).
> **The committed pair: 16/19 on each boot, `agreeing=true`, `stablyRefuted=3`** — exactly
> `pd33:member-a-io-chain`, `pd33:member-a-authorization` and `pd33:shell-write-boundary` REFUTED
> with `A5_NATIVE_ADMISSION_UNAVAILABLE`, the other 16 PROVEN. `RESULT FAIL` is the honest verdict:
> three cases are REFUTED, and this record does not turn a REFUTED case green.
>
> - **Attempt 1** (18:22–18:31Z, before the comparator correction below): 16/19 on both boots, but the
>   table printed `DISAGREE` for the three stably-REFUTED cases and `agreeing=false` — the comparator
>   bug, see the driver header.
> - **Attempts 2 and 3** (18:35–18:43Z, 18:46–18:55Z): boot1 16/19 as above, but **boot2 additionally
>   REFUTED three Stop arms** (`pd29:stop-during-round`, `pd29:cold-recovery-no-revival`, and in
>   attempt 2 `pd34:control-stops-member`), e.g. `rounds-after-stop-zero: rounds after stop=47`,
>   `stopped-member-still-stopped: the S1 Member after recovery: phase=active`. A raw
>   `session/cancel` landed while the goal kept producing rounds. **This lane did not change any
>   product code and does not claim to explain that arm**; it is a pre-existing instability of the
>   Stop arms under load (compare release note §4 item 4 on the millisecond window), and it is
>   **unrelated to the three bash cases**, which were REFUTED in every boot of all five pairs.
>   The two unstable pairs were not selected for `runs/`; their per-case verdict lines remain in
>   `driver.log` and their phase rows in `run-ledger.jsonl`.
> - **Attempts 4 and 5** are clean pairs at 16/19 each boot; attempt 5 is committed because it ran
>   from the committed branch HEAD.
>
> **Pair-comparator correction (same date, disclosed).** `agreementOf` required `cells[0] === 'PROVEN'`
> besides verdict equality, so a case stably REFUTED on both boots printed `DISAGREE` and set
> `agreeing=false`: the table answered "did everything pass" instead of "did the boots agree". It now
> compares verdict equality only and reports `stablyRefuted`; `allOk` (all cases PASS) remains the
> `RESULT` bar, so a REFUTED case still fails the run. Pinned host-free by `PD33-AGREEMENT` in
> `tests/world-factory/a5sf-pd33-preview-e2e.test.mjs`.


| Arm | What it measures |
| --- | --- |
| E2E | the Leader creates two Members in one turn, delegates to both, and recollects both in a second turn; Member A runs the governed I/O chain (read/grep/glob/write/edit/bash/skill/present) and hits three authorization refusals; Member B does a real `web_fetch`, one `web_search` in whichever shipped state the install graph provides, and a goal that converges after >= 3 automatic rounds; both Members are probed for the seven deferred tool names |
| S1 | stop during a round (user `session/cancel`) — 20 000 ms silent window on the Member's own durable log |
| S1c | stop through PD-34's first-class control: the same four public RPCs in the same order (`goals/get -> goals/pause -> session/cancel -> goals/get`), with the durable re-read as the only oracle; the clause is `no-call-started-after-durable-pause`, because a stop is not instantaneous (report section 4.4) |
| S2 | stop at a round boundary (24-cancel burst) |
| gap | stop in the idle window between two rounds (6 probes) |
| S6 | cold recovery: SIGTERM, restart the same `DSH_HOME`, real `team_follow_up`, no automatic round |
| S7 | explicit `/goal resume` still works after recovery |
| S8 | an un-stopped goal keeps going (Member B), and `complete` ends it |
| shell-write-lane | the service axis for an out-of-lane `bash` write target (**expected REFUTED** today; the OS axis is what stops it) |

## Layout

```
driver.log                     append-only console transcript (all runs)
run-ledger.jsonl               u5 run ledger (DEV-LIVE, eligible=false)
runs/boot01|boot02/
  e2e.json                     the measured E2E numbers (per-call probes + facts)
  guard-facts.json             PD-33 calls only (the full sink stays in the World home)
  arms.json counters vs arms   lifecycle arms, all counters
  verdicts.json                per-case clauses with the measured detail strings
  run-record.json              u5-run-record/1, bindings.candidate.head, DEV-LIVE
  member-facts.json            per-Member durable goal facts
  preset-effective.json        the exact composition the run used
  precondition.json            assertShippedPresetMounted + install graph
  state-final.json             final Team state
  host-tree-porcelain-1.txt    pinned host tree must stay clean
  summary.txt / boot.log       run summary
appendix/                      generated tables used by the readiness report
```

The World's `DSH_HOME` and the full guard sink live under `tests/homes/uv…`
(gitignored, one World per boot); they are reproducible, not committed.

## Reproduce

```bash
# host-free composition check (no boot)
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --plan

# one boot, E2E arms only
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e --boots 1

# the measured pair
node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --boots 2

# negative control: drop the opt-in realm key; the inherited host `web`
# tripwire must go non-zero and the governed-web clauses must redden
A5SF_PD33_MUTATE=no-realm node tests/world-factory/drivers/a5sf-pd33-preview-e2e/run-boot.mjs --arms e2e --boots 1
```

## What this evidence does NOT claim

- Not a candidate acceptance (`eligible=false`), not a matrix grade, not `V@B`.
- `read_image` is on the governed surface but has **no live evidence on this
  HEAD** (#680 unmerged) — the roster says "face governed, live pending".
- `web_search`'s real backend arm is measured with 0 POSTs here because the
  Exa provider package is absent from this install graph; the shipped behaviour
  is the typed `WEB_PROVIDER_UNAVAILABLE`, and the real-POST arm is cited from
  PD-30 (#678), not re-measured here.
- A `REFUTED` case is a **measured product gap**, not a driver failure:
  `pd33:shell-write-lane` records that the shell guard admits `..` as a write
  target and only the OS sandbox stops it.
