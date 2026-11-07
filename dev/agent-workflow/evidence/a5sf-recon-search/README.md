# RECON-SEARCH — Alpha.5 five-surface recon, Face B (Search / Subprocess)

```text
RECON-SEARCH  Alpha.5 five-surface DEV-LIVE recon — Face B: Search / Subprocess
product SHA  235e1af8bab954bbca4852d2f5a538de043b66e8   (branch recon/b-search-20261113)
host SHA     639ed015397290b3745d163aafe02ffee4aa3f84   (0.2.0-rc.2, pinned read-only)
record        a5sf-live-member-2026-11-07T16-15-13-868Z-b1   recordClass=DEV-LIVE
grant         devlive-subprocess-1   scope=DEV-LIVE face=Subprocess world=u5a5sfsub1
eligibility   candidateClaimEligibility.eligible = FALSE  (DEV_LIVE_EVIDENCE_NOT_CANDIDATE)
V@B           unchanged; not candidate evidence; eligible=false
```

This is recon and attribution only. **No product source was changed.** The only changes on this
branch are the recon arm of the existing Member driver
(`tests/world-factory/drivers/a5sf-live-member/run-boot.mjs` + `recon-search.mjs`) and this
evidence tree. No matrix / register / STATUS / backlog edit, no push.

## 0. The one sentence

**`grep` and `glob` on a real governed Member today run as the pinned host
`@deepseek-ai/dsh-tool-fs-search` tools, directly over the Host's own base `ctx.subprocess`
(`rg` child of the Host node process, same mount/PID namespaces, no Landlock launcher, zero
`a5sf-guard-consult/1` facts), so the compiled confined subprocess face of the Member is never
on the path; consequently a Member whose compiled read ceiling is one workspace searched
`..` and an absolute out-of-lane directory and got the secret bytes.** The fallback (really: the
absence of any routing) happens in the **assembly layer**: the governed preset installs
`tool-fs-search`, and `a5sf-realm-row.mjs` only shadows `bash` (PD-12) and the terminal
(PD-13) — no search/glob native module exists, so the native tool keeps its inherited base
`subprocess` dependency.

Every "REFUTED" row below is a **governance proposition that failed**, not a broken boot. The 13
recon cases are phrased as observable propositions so `overall=FAIL` reads as "the governance
claim was refuted", which is the finding.

## 1. What actually ran

| fact | value |
| --- | --- |
| driver | `tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --recon-search --boots 1` (the real Member turn driver, extended — no new entry point) |
| Member | `inst-06oi8u902ggh`, template `worker`, label `a5sflm-worker` |
| child session | `session-team-child-0226b704a7da0775ef20a7e9fd467475` |
| delegation | `team_delegate` → `member-activated` (op `op-11hnjf80p3dz7h00wbbqe0dp`), sync, `memberResult.status=succeeded` |
| Member surface | 43 tools incl. `grep`, `glob`; **no** `team_grep` / `team_glob` (`member-surface.json`) |
| search provider | row `preset-a5sf-governed-member` → plugin `@deepseek-ai/dsh-tool-fs-search` (host 0.2.0-rc.2) |
| guard facts | `guard-facts.json` — **`[]`, zero** |
| blueprint / authority | v4 main blueprint (`main.yaml`), authority pointer `as20261105r2` (`sha256:d28bdf46…`) |
| Member window | `16:15:58.247Z → 16:16:01.057Z` (10 tool calls, one 1.5 s timeout) |

Two independent boots measured the same facts (the second is authoritative because it also
captured namespace links and post-collection liveness; the first was moved aside by
`archive-before-start`):

| run | path | out-of-lane grep | parent grep | glob out-of-lane | rg ppid | launchers | guard facts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 16:10:25Z | `archive/2026-11-07T16-15-13-794Z/boot01/` | secret bytes | secret bytes | secret file | 101 | 0 | 0 |
| 16:15:13Z | `runs/boot01/` | secret bytes | secret bytes | secret file | 101 | 0 | 0 |

10 Member tool calls, issued once each in order:
`call-rs-01-grep-inlane`, `02-grep-outlane`, `03-grep-ignore`, `04-grep-hidden`, `05-grep-nomatch`,
`06-grep-badregex`, `07-glob-workspace`, `08-glob-outlane`, `09-grep-parent`, `10-grep-slow`.

Fixtures (created by `reconFixtures`): workspace `in-lane.txt`, `sub/nested.txt`, `clean.txt`
(needle absent), `ignored.txt` (needle + `.gitignore`), `.hidden/hidden.txt`, `.git/config`;
out-of-lane `../out-of-lane/secret-out-of-lane.txt` + `other.txt`, both **outside** the compiled
read ceiling (`workspace` only).

## 2. Seven items × tool

### `grep`

| item | measured fact | source |
| --- | --- | --- |
| **Surface** | `grep` is on the Member's model-visible surface (43 tools). Schema is the host one: `{pattern, path?, include?}` with description "Search file contents with a ripgrep regular expression…". No `team_grep`. | `runs/boot01/member-surface.json`; `tests/deepseek-harness-test-use/packages/fs/tool-fs-search/src/index.ts:70` |
| **Dispatch** | model tool call → host `grep` executor → `runRipgrep()` → `ctx.subprocess.spawn(...)`. Host argv template `rg --no-config --json --regexp=<p> [--glob=<inc>] -- <path>`. | observed argv (§3); `search-core.ts:194,238` |
| **Provider** | pinned host plugin `@deepseek-ai/dsh-tool-fs-search`, mounted by the governed preset row (`cordis.patch.yml:193-194`). Not the Team tool plane. | `cordis.patch.yml:193`; `team-tool-plane.mjs` (plane only mounts with `config.teamToolPlane`, `agent-bindings.mjs:3094`) |
| **Allow** | in-ceiling search works: `in-lane.txt` + `sub/nested.txt` hit, 2 matches. Ignore/hidden semantics are rg's own (`.gitignore` honoured, `.`-hidden and `.git` skipped), not Member policy. | `call-rs-01`, `03`, `04` |
| **Deny** | **NOT ENFORCED.** `grep` accepted and answered both an absolute out-of-ceiling path and `path:'..'`: returned the secret needle. No typed refusal, no guard fact. | `call-rs-02`, `09`; transcript bytes §3 |
| **Evidence** | one direct `rg` child of the Host node pid; same mount/PID/net/user/cgroup namespaces; identical `mountinfo` sha; zero `--confined-exec-stream` launchers; zero guard facts. | `process-evidence.txt`, `recon-search.json#process` |
| **Lifecycle** | after `member.archive` (200, `lifecycle=ARCHIVED`), a further prompt on the child session returns HTTP 200 but `result.ok=false`, `gateway/internal`, `TeamSessionActivationInterceptedError`; the tool path is never reached. | `lifecycle.json` |

### `glob`

| item | measured fact | source |
| --- | --- | --- |
| **Surface** | `glob` on the Member surface, host schema `{pattern, path?}` ("including hidden and ignored files"). | `member-surface.json` |
| **Dispatch** | host executor → `runRipgrep` with `--files --glob=… --sort=modified --no-ignore --hidden` + `GLOB_VCS_EXCLUDES`; the same `ctx.subprocess.spawn`. | observed argv §3; `search-core.ts:238` |
| **Provider** | same host plugin/preset row; no Team-plane `team_glob` (the plane's glob backend has no production-wired implementation and stays typed shut). | `cordis.patch.yml:193`; `team-tool-plane.mjs` header |
| **Allow** | workspace listing works: `in-lane.txt`, `ignored.txt`, `sub/nested.txt`, `clean.txt`, `.hidden/hidden.txt`; `.git` excluded by explicit VCS `--glob=!` patterns, `--no-ignore` means `.gitignore` does NOT apply to glob. | `call-rs-07` |
| **Deny** | **NOT ENFORCED.** `path:'<home>/out-of-lane'` listed `secret-out-of-lane.txt` and `other.txt`. | `call-rs-08` |
| **Evidence** | glob's own `rg --files` argv was sampled as a direct child of the Host; no confined launcher. | `process-evidence.txt` |
| **Lifecycle** | same as `grep`: post-archive dispatch refused at Team activation; glob cannot be exercised after archive. | `lifecycle.json` |

## 3. Behaviour evidence (raw bytes)

| call | tool | result (verbatim, truncated) | isError |
| --- | --- | --- | --- |
| `01-grep-inlane` | grep | `Found 2 matches … in-lane.txt Line 1: A5SF_RS_INLANE_NEEDLE … sub/nested.txt …` | false |
| `02-grep-outlane` | grep | `Found 1 match` + **absolute** `…/out-of-lane/secret-out-of-lane.txt` + `Line 1: A5SF_RS_OUTLANE_NEEDLE` | false |
| `03-grep-ignore` | grep | `No matches found` (`.gitignore` → `ignored.txt`) | false |
| `04-grep-hidden` | grep | `No matches found` (hidden/`.git` skipped) | false |
| `05-grep-nomatch` | grep | `No matches found` (needle absent) | false |
| `06-grep-badregex` | grep | `Error: grep pattern rejected by ripgrep: rg: regex parse error: … error: unclosed character class` | true |
| `07-glob-workspace` | glob | `in-lane.txt … .hidden/hidden.txt` (no `.git`) | false |
| `08-glob-outlane` | glob | absolute `…/out-of-lane/secret-out-of-lane.txt`, `…/other.txt` | false |
| `09-grep-parent` | grep | `Found 1 match` + `../out-of-lane/secret-out-of-lane.txt` + secret needle | false |
| `10-grep-slow` | grep | `Error: tool call timed out after 1500ms` | true |

Exit-code semantics, stated precisely:

* **no match vs error ARE distinguishable** at the tool result: `No matches found` + `isError=false`
  vs `Error: …` + `isError=true`. The `rg` exit status itself is not on the wire.
* the **typed code is NOT on the wire**: neither `SEARCH_INVALID_PATTERN` nor an abort code appears
  in the model-visible text (see §6-B).

## 4. Process evidence (independent of the product)

From `runs/boot01/process-evidence.txt` and `recon-search.json#process`:

```text
host pid 101  /home/armourpiercer/.nvm/versions/node/v24.21.0/bin/node apps/cli/lib/bin.js web --port 3185 --no-open
host  ns: mnt:[4026532414] pid:[4026532416] net:[4026531833] user:[4026532417] cgroup:[4026531835]
host  status: NSpid=101 CapEff=0000000000000000 NoNewPrivs=1 Seccomp=2
rg sightings: 4 (pids 191,219,263,281) — every one ppid=101 (the Host), isHostChild=true
          same mnt/pid/net/user/cgroup ns as host: true; mountinfo sha256 identical: true
          aliveAtCollection: false for all four (no leaked rg after the turn)
confined launchers (--confined-exec-stream) during the Member turn: 0
base bwrap naming a fixture: 0
guard facts: []
```

Sampled `rg` argv (host templates, no lane-safe flags anywhere):

```text
rg --no-config --json --regexp=A5SF_RS_INLANE_NEEDLE -- <workspace>
rg --no-config --json --regexp=A5SF_RS_IGNORED_NEEDLE -- <workspace>
rg --no-config --files --glob=**/*.txt --sort=modified --no-ignore --hidden --glob=!**/.git … -- <workspace>
rg --no-config --json --regexp=A5SF_RS_ABSENT_NEEDLE_9f13 -- /usr
```

The confined face's lane-safe argv would carry `--no-ignore-parent --no-ignore-vcs`
(see `a5sf-rg-ancestors`); **none of these argv carry them**, and none passed through
`landlock-prelauncher.py`. A hit therefore did not go through the confined face: the child is
provably a direct child of the Host in the Host's own namespaces, with no launcher in between.

## 5. Six-class classification

The six classes the round asks for, applied to `grep` × `glob`:

1. **Actually complete (with guard facts)** — none. `grep`/`glob` produce **zero**
   `a5sf-guard-consult/1` rows; nothing to count.
2. **Not reached** — explicit session **cancel** during a search (only the cooperative *timeout*
   was exercised); ToolBinding/ToolRestriction enforcement (no binding is compiled for search in
   this composition — see §6-C); post-archive tool execution (refused at activation).
3. **Not on the tool surface** — `team_grep` / `team_glob` do not exist here (the Team tool plane
   is not mounted: shipped row has no `teamToolPlane` config). Not a defect by itself; it is the
   reason item 4 applies.
4. **Success but no guard facts** — **all positive-path searches**: 8 of 10 calls returned real
   bytes with `isError=false` and 0 guard facts, including the two out-of-ceiling searches. This
   is the core finding: success is not evidence of governance.
5. **Correctly refused** — `06-grep-badregex` (rg rejects the pattern) and `10-grep-slow`
   (cooperative timeout aborts the call) are refused **by rg/the host tool**, not by the Member's
   ceiling. They are tool-semantics refusals; nothing about the read lane was consulted.
6. **Pure compatibility / environment** — the DEV-LIVE slot sweep across PID namespaces (§7);
   host-tool argv/ignore semantics (rg's own `.gitignore`/hidden rules) which look like policy
   but are not.

## 6. Issue classification (A–E)

Legend used here: **A** = product routing/isolation defect (would need a product change);
**B** = product observability/contract gap; **C** = coverage gap with a known residual
(documented, not newly discovered); **D** = upstream/host-tool behaviour, not fixable here;
**E** = test-infra/environment defect.

**A-1 — Search tools are never routed to the confined subprocess face.**
The governed preset mounts `@deepseek-ai/dsh-tool-fs-search` and the realm row shadows only
`bash` and the terminal; there is no search/glob native module and no spec lookup for them.
`packages/runtime/src/plugin/live/a5sf-realm-row.mjs:956` (`A5SF_CONFINED_BASH_TOOL`),
`:978` (`confinedBashSpecOf`), `:994`, `:1018` (`confinedTerminalSpecOf`), `:1070` (comment: only
the two shadows are appended) — no `grep`/`glob` branch. Host side:
`tests/deepseek-harness-test-use/packages/fs/tool-fs-search/src/index.ts:70`
(`inject = ['tools','systemPrompt','subprocess']`) and
`…/src/search-core.ts:194` ("The spawn is unconfined (a plain `ctx.subprocess` call)"),
`:238` (`ctx.subprocess.spawn`). Composition: `cordis.patch.yml:193-194`.
This is the layer where the fallback happens: **assembly**, not invocation and not the realm.

**A-2 — A positive hit is indistinguishable from a governed hit at the record level.**
No guard fact and no execution-face attribution is attached to search results, so a run-record
reader cannot tell a host-direct search from a confined one without the independent `/proc`
witness used here. (Same root as A-1; listed separately because it is the evidence-contract
part.)

**B-1 — Typed search codes do not reach the model.**
`06-grep-badregex` is an error, but the text carries rg's stderr words only; the tool's typed
code never appears. `10-grep-slow` is aborted by the tool-call timeout policy with
`tool call timed out after 1500ms`; the search tool's own abort code likewise does not appear.
Model-facing refusal text is therefore not machine-classifiable beyond "Error:".
(Wire text in §3; typed-code absence measured.)

**C-1 — v4 `toolBindings` are not derived into the realm (documented residual).**
`packages/runtime/team-services/src/product-assembly.ts:757-760`: "v4 `toolBindings` are
Team-scoped and carry no MemberTemplate association, so the derived declaration derives CEILINGS
only"; `derivedMembersOf` (`:741-745`) emits `{templateId, instanceGeneration, ceiling}` with no
`restrictions`. Reproduced host-free: a v4 blueprint with a `toolBindings` entry for `dsh.fs/grep`
compiles to `plan.members[0].restrictions = []` and a `compiledFor()` answer with no binding refs.
So in this shipped derived-path composition **no ToolBinding restricts `grep`/`glob` at all** —
`NOT_WIRED`, and the out-of-lane leak above is exactly what that predicts.

**D-1 — Search semantics are rg's, not the Member's.**
`.gitignore` honoured by `grep` but bypassed by `glob --no-ignore`; hidden/`.git` skipped by both;
`../` resolves against the child's cwd. These are host-tool semantics (upstream, CORE PATCH
BUDGET = 0) and must not be read as Member policy.

**E-1 — DEV-LIVE slot liveness is checked across PID namespaces (test infra).**
`tests/world-factory/lib/dev-live-slots.mjs:271` (`assertDevLiveSlotHeld` matches
`runId`+`pid`) combined with `:120-127` (a slot is stale when `pidAlive(pid)` is false). Each
dev Host runs in its own PID namespace, so a **peer's** sweep can read our slot pid as dead and
unlink the file: measured — boot attempt 1 (`runId …16-05-49-307Z-b1`, archived at
`archive/2026-11-07T16-10-25-168Z/boot01/`, `abortedAt=pre-boot`) was refused at the spawn
chokepoint with `DEV_LIVE_SLOT_REQUIRED: … holds no dev-Host slot` although it had acquired one,
while a sibling lane was booting; the slot file was gone. The recon driver re-takes the same slot (same run id/pid) immediately before
`harness.boot` and the retry succeeded. This is not a product defect and the shared lib was not
modified; the workaround is disclosed in the driver.

**E-2 — Post-archive dispatch returns HTTP 200 with `ok:false`.**
`member.archive` → 200 `ok:true`, `lifecycle=ARCHIVED` (`close-admission`, `interrupt`,
`drain-descendants`, `wait-quiescence`, `release-residency`, `commit-archive`); a follow-up
`session/prompt` on the archived child returns **200** with `result.ok=false`,
`code=gateway/internal`, `TeamSessionActivationInterceptedError: … intercepted foreign Agent
activation for Team-managed session …`. The refusal is real, but the transport status is not a
refusal status; a caller that only looks at HTTP sees success.

## 7. Files and reproduction

```text
dev/agent-workflow/evidence/a5sf-recon-search/
  README.md                     this file
  recon-summary.json/.txt       machine summary of the recon cases + governance facts
  runs/boot01/
    run-record.json             u5-run-record/1, recordClass=DEV-LIVE, 13 cases
    recon-search.json           samples + process + guardFacts (raw)
    process-evidence.txt        human-readable /proc witness
    member-surface.json         43 tool schemas (grep/glob included)
    member-transcript.json/.txt Member turn (10 calls, raw results)
    guard-facts.json            []
    lifecycle.json              archive + post-archive probe
    proc-observations.json      every /proc batch
    counters.json, summary.txt, host-log-final.log, teardown.json
  runs/boot01/…                 (only boot01: --boots 1)
  archive/                      any earlier run moved aside by archive-before-start
```

Reproduce (from the worktree, host-free plan first, then one live boot):

```bash
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --plan --recon-search
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --plan --recon-search --recon-binding
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --recon-search --boots 1
```

`--recon-binding` only adds a v4 `toolBindings` entry to `main.yaml`; `--plan` accepts it
(`toolBindings=1`), and per §6-C-1 it compiles to no restriction — that is why no separate
binding boot is claimed here. Host-free compile check used for C-1:
`node dev/agent-workflow/evidence/a5sf-recon-search/check-binding.mjs` (the claim is the printed
`restrictions: []` / no binding refs, reproducible from the cited source lines).

## 8. Non-claims

* This is **DEV-LIVE** evidence. `eligible=false`; it cannot satisfy a V@B=yes / candidate claim.
  The parent lane must re-test independently before any PR merge statement.
* One boot, one Member instance, one composition (the shipped `preset-a5sf-governed-member` row
  with the derived policy path). It does not speak for the declared-`a5sfMemberPolicies` path,
  the Team tool plane, or a realm that installs a search shadow (none exists today).
* "No match" in §3 is not "denied"; §3 keeps the two apart on purpose. "Hit" is not "went
  through the confined face"; §4 is the proof that it did not.
* No assertion is made about `read`/`write`/`bash` faces here; they are covered by their own
  recon lanes. The FS face (`ctx.fs`) evidence is deliberately **not** reused for Search.
