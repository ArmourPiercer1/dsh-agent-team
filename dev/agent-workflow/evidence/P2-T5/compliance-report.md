# P2-T5 Compliance Report — Storage / Fork-Lineage / Descendant Seams

Task worker: P2-T5 (leaf; no subagents). This report discloses every runtime-surface mutation,
environment fact, incident, and recorded finding from the task, and attests the red lines.

## 1. Red-line attestations

| rule | status |
| --- | --- |
| CORE PATCH BUDGET = 0 — no upstream source modification | **Held.** Upstream tree `references/deepseek-harness-test-use` @ `cd5ef8148158c3a752a658978873241fdf8e2bbc` is byte-clean at start *and* end of the canonical run (`git status --porcelain` empty, `git diff` empty, HEAD unchanged — `run/run-log.txt` preflight + byte-clean sections, `run/logs/git-state-after.json`). No patch-package / pnpm patch / postinstall. |
| Public APIs only — no private/internal upstream imports | **Held.** The payload imports only `@deepseek-ai/dsh-storage-domain` (plus host-injected services `sessions`/`agents`/`subagents`/`sessionQuery` consumed via `ctx`). The live public surface admits those imports; the `private-import-host.js` negative fixture proves the runtime whitelist rejects a private subpath (`ERR_PACKAGE_PATH_NOT_EXPORTED` for `@deepseek-ai/dsh-subagent/lib/continuation.js`) — statically and (smoke group) at boot. |
| No TeamDomain/TeamSession implementation | **Held.** The probe proves the underlying public mechanisms only (storage domain, session fork/lineage, subagent continuation). |
| Owned paths only in commits | **Held.** Only `tests/characterization/probes/storage-fork-descendants/**` and `dev/agent-workflow/evidence/P2-T5/**` are committed on branch `task/P2-T5-storage-fork-descendants`. |
| No push | **Held.** No push performed. |
| Stable dev instance untouched (`:3080`, `D:\deepseek-harness\`) | **Held.** All instance boots ran on ports 3384/3394 against DSH_HOME `references/.dsh-test-p2t5` inside the worktree. |

## 2. Test infrastructure

- Reused the P2-T1 characterization harness **untouched** (`tests/characterization/run.mjs` and
  sections); added only my probe group directory and the evidence directory.
- Canonical evidence = full harness run (all seven sections), written node-side via
  `--report-dir dev/agent-workflow/evidence/P2-T5/run` (UTF-8, no console Tee).
- Observation protocol: per-boot directive file `<DSH_HOME>/p2t5-directive.json` → in-instance
  probe plugin runs the phase and writes `obs-{seed,verify,isolate}.json` to the report dir;
  group polls with partial-write retry; stale obs files deleted at group start.
- Three fixture boots per run: #1 SEED (main home, 3384), #2 VERIFY (same home, fresh process,
  3384), #3 ISOLATE (fresh scratch home, 3394). Plus the smoke group's own boots and the static
  negative-boot (3384) run by the harness.

## 3. Environment facts & model resolution

- `envFacts`: `hasEnvApiKey=false`, `envBaseUrl=null` (recorded in `run/p2t5-run-meta.json`).
- The web-app persona template resolves `{{model}}` from `agent.options.model`; with no
  environment key/base, the fixture root was therefore created through the public
  `agents.create({agentOptions:{provider:'deepseek-official', model:'deepseek-v4-flash'}})`.
  Fork children inherit agent options through the public subagent child-option resolution —
  no private API used.
- LLM endpoint: in-process blackhole HTTP server, `listen(0, '127.0.0.1')` (canonical run
  port **60494**), responds with an SSE comment line and never ends the stream, so fixture
  turns hang *held* mid-turn — the precondition for interrupt/drain probes. Routed via the
  main-home `settings.yaml` override `llm-deepseek.baseURL` (see §4). Teardown:
  `closeAllConnections()` + `close()`; port freed and verified.
- `drainContinuableDescendants` resolves fast (103 ms in the canonical run) because fetch
  aborts propagate when the blackhole socket closes.

## 4. Runtime-surface mutations (all reversible; all restored & self-checked)

| surface | mutation | restoration | verified |
| --- | --- | --- | --- |
| `<mainHome>/settings.yaml` | created with `llm-deepseek.baseURL: "http://127.0.0.1:60494"` | deleted (pre-group snapshot: did not exist) | run-log “PASS cleanup: settings.yaml state matches the pre-group snapshot”; current state: absent |
| `<mainHome>/.credentials.yaml` | group wrote a fake key `sk-p2t5-blackhole-fake` for the duration of the boots | byte-exact restore of the pre-group snapshot | run-log “PASS cleanup: .credentials.yaml state matches the pre-group snapshot”; current content verified: only the harness's own `client-connection/browser-session` grant record, **no fake key** |
| `<mainHome>/profiles/web/cordis.patch.yml` | replaced by `mountRows` with the probe group's mount rows (payload + negative fixtures) | exact pre-group snapshot bytes restored | pre-group snapshot kept in group memory; restored in the finally-cleanup |
| `<home>/p2t5-directive.json` (per home, per boot) | written before each boot | deleted at group end | no directives remain |
| scratch home `<mainHome>/scratch/isolation-home` | created fresh per group (deleted at group start, re-created by boot #3) | left in place **as evidence** for S2.ISO | — |
| stale fixture session dirs (main home `sessions/…`) | 5 leftover fixture dirs from previous debug runs | deleted at group start (“removed N stale fixture session dir(s)” in run-log) | — |
| blackhole HTTP server | in-process on ephemeral 127.0.0.1:60494 | closed in cleanup | ports 3384/3394 verified free after teardown |

## 5. Findings (upstream behavioral facts — recorded, not patched)

- **F1 — interrupt of an absent target is an accepted silent no-op.** Authority checks
  (wrong-parent / self-ancestor `UNAUTHORIZED`) fire for **live** targets; for an absent
  (settled/detached or unknown) target, `subagents.interrupt` resolves without throwing
  regardless of authority (observed live: S3.3, `threw:false`). Task guidance expected a loud
  failure for unknown targets — discrepancy recorded in `seam-report.md` (S3.3). The authority
  mechanism itself is proven (S3.2, S3.4).
- **F2 — child session detach race (design fact).** When a subagent child's interrupted turn
  settles, the subagent manager disposes the AgentHandle and the session detaches from the
  live store (cold-resume is re-materialized from persistence on the next send). Consequently
  live-store polling for a child's `turn/end` can observe the session already gone.
  Reliable observation points: the synchronous `session/event` store observer (fires inside the
  commit, before detach — the same seam upstream session-persistence/projection plugins
  consume) and the durable log via `sessionQuery`. The probe uses the observer for capture and
  the durable log for verification.
- **F3 — live store is process-scoped.** After restart the live store is empty for every
  fixture id (S2.O, recorded); durable reads go through `sessionQuery`.
- **F4 — trace vs. entries.** `sessionQuery.trace(root)` walks *session* lineage (header
  `parentSession` links) and includes plain-fork sessions (`origin:null`);
  `subagents.listDescendants` enumerates *subagent entries* only. Both views are public and
  consistent.

## 6. Attempt ledger (max 3)

| # | dir | outcome | cause & resolution |
| --- | --- | --- | --- |
| 1 | `debug1/` (full run) | FAIL (exit 1) | probe-side bug: zod junction double-prefix when resolving the probes dir → literal `probesDir` path fix |
| 2 | `run-attempt2/` (full run; renamed from `run/` before attempt 3 so the canonical dir holds the final green run) | FAIL (exit 1) | probe-side bug: `ctx.get('sessionQuery')` undefined at `apply` time (late registration) → bounded 30 s wait loop in the payload |
| 3 | `run/` (full run, canonical) | **PASS (exit 0, 109/0)** | — |

Internal debug runs (not attempts, per the execution cap rules): `debug2/` (obs writer not
awaited), `debug3/` (richest pre-model-fix run), `debug4/` (scope-hoist bug + stale fixture
session dirs discovered → group-start cleanup block), `debug5/` (fixture phase proven; exposed
the F2 detach race: correct-shape `turn/end` present in the durable log yet invisible to
live-store polling), `debug6/` (observer fix proven; sole remaining failure S3.2 — fixture
ordering, see below), `debug7/` (S3.2 reorder proven, all probes green).

## 7. Incidents (disclosed)

- **S3.2 fixture ordering.** The wrong-parent negative originally ran *after* the successful
  interrupt, when the grandchild had settled/detached — the call then hit the documented
  absent-target no-op path (F1) and returned `absent`. Fixed by reordering: the wrong-parent
  attempt now runs **before** the successful interrupt, while the target is live (authority
  check fires → `UNAUTHORIZED`). Verified in `debug7/` and the canonical run.
- **Credentials contamination.** `.credentials.yaml` in the main home was left containing the
  fake key after early runs (self-perpetuating: each group snapshot captured the contaminated
  file and restore rewrote it). Resolved with a one-time removal **plus** post-restore state
  self-checks for both `settings.yaml` and `.credentials.yaml`. Note: the harness itself
  manages `.credentials.yaml` (it writes its own `client-connection/browser-session` grant
  there at instance boot) — the `preExisted:true` recorded from `debug6/` onward reflects that
  harness-owned grant file, not residual contamination; its current content was verified to
  contain only the grant record.
- **run-log anomaly (attempt 1 only).** `debug1/run-log.txt` is missing tail lines although
  `debug1/summary.json` proves the full execution; `summary.json` + `git-state-after.json`
  were treated as authoritative for that run. The canonical run's log is complete.
- **S2.7.1 check-bug fix.** The group initially asserted `traceError === undefined`; the
  payload always writes `null` — the check now accepts both (null/undefined).

## 8. Evidence index

| path | content |
| --- | --- |
| `run/` | **canonical** full run: `run-log.txt` (137 lines, node-side UTF-8), `summary.json` (ok:true, failures:[]), `obs-{seed,verify,isolate}.json`, `p2t5-run-meta.json`, `logs/` (instance logs per boot, `git-state-after.json`, `dump-config-*.log`) |
| `run-attempt2/` | attempt-2 full run artifacts (failure evidence) |
| `debug1/` … `debug7/` | internal debug runs and their purpose (see §6) |
| `seam-report.md` | per-seam criterion → mechanism → evidence → negatives → verdict |
| scratch home (left behind) | `<mainHome>/scratch/isolation-home` — S2.ISO evidence |

Canonical run numbers: total ≈33.5 s (19:32:32.224Z → 19:33:05.685Z); seed phase 1.8 s
(19:32:57.919Z → 19:32:59.686Z), verify 0.5 s, isolate 0.5 s; interrupt `turn/end` captured
in-process at `seq 7` (reason `{kind:'aborted', reason:{kind:'user'}}`); drain 103 ms;
persistence gate passed early within its 30 s budget; 109 PASS / 0 FAIL.
