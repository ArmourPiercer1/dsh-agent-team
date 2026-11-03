# a5sf LIVE NATIVE 2 — one boot, spent on a composition defect; the question is still open

**Task.** Prove, in a booted Host, that a **model-visible native `read`** executes through the
**Member's confined provider** now that the scope-key fix (#558, `a5sfAgentToolSurface(root,
runtimeAgent)` + the attach forwarding `resolveSetupAgent(...)`) supplies the runtime Agent.

**Answer delivered by this run: NOT ANSWERED.** The ONE authorised Host start spawned, then the
Host process exited `code=1` at Loader compose — before its boot marker, before any Team session,
before any Member, before any model turn. The cause is a **defect in this lane's test
composition**, not the product. It is diagnosed below from the Host's own preserved instance log,
the corrected composition is written, and a pre-boot guard now makes that class unable to spend
another start.

Both halves of the reviewer's question therefore remain **open**: neither "the confined route
served it" nor "the base route served it" was observed.

> There are **no** `consultations.jsonl` / `transcript.json` in this directory. No consultation
> happened and no model turn happened; empty files would fabricate the appearance of a capture.
> The evidence is the failure itself: the instance log, the composed profile, and the ledger.

---

## 1. Budget, ledger, world (the accounting)

| item | value |
| --- | --- |
| pool | `dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json` (20 boots) |
| allocation charged | **P2-01 live read (BL-14 / G2 live half)** — 1 of its 3 boots |
| reserve used | **none**; F1's remaining 2 were re-allocated to route C / binding acceptance by `SESSION_ROUTER_LOG.md` sync22 ("3 次 F1 预算只用 1 次，其余转给路线 C 与绑定验收"), so nothing is charged to F1 |
| grant | `grant.json` — `maxStarts: 2` = 1 intent row + 1 boot, `boundCommit 56a669d930097bb5ea8871299f7651cb9f08f9be` |
| gate | `preRegisterReadBudget` → intent row written BEFORE the World existed (`rowsBeforeIntent=0 rowsAfterIntent=1 remaining=1`) |
| ledger | `ledger.jsonl`, 2 rows: `budget-intent` then `a5sf-live-native2-boot1` |
| spawn | ONE, through `harness.boot()` → `TestWorld.startHost()` → `DshInstance` |
| world | `tests/homes/u5a5sflive2-20261103T13-02-54Z`, port **3183**, mock **3493**, home **deleted** after teardown (verified: `tests/homes` is empty) |
| `:3080` | untouched |

The start row was appended to the shared ledger **before** the spawn (`13:03:01.210Z`); the process
then exited at `13:03:24.891Z`. By the lane's own fail-closed rule the boot is **spent**: a failed
spawn is still a start.

## 2. What the boot observed (ground truth only)

`run.log`:

```
[2026-11-03T13:03:01.209Z] mock started on 3493
[2026-11-03T13:03:24.891Z] RUN FAILED: Error: instance boot failed: process exited (code=1 signal=none)
[2026-11-03T13:03:24.895Z] ledger rows (2): budget-intent:grant-a5sf-live-native2-56a669d93009 | a5sf-live-native2-boot1:u5a5sflive2-20261103T13-02-54Z
[2026-11-03T13:03:24.895Z] RUN-SUMMARY run=a5sf-live-native2-2026-11-03T13-02-54-748Z suite=a5sf-live-native2 overall=FAIL cases=7 FAIL:7 worlds=none
```

`worlds=none` is the runner's own word for it: no World became ready. The mock never received a
model request (the Host never started a session).

**The six points, honestly disposed:**

| # | point | disposition | what was actually captured |
| --- | --- | --- | --- |
| 1 | Member with `a5sfEvidencePath` + `a5sfNativeToolModules` activates; surface has exactly ONE `read` | **NOT_REACHED** | Host died at compose; no Team session, no Member, no model-visible surface |
| 2 | native `read` outside the ceiling REFUSED by the Guard (not crash / raw ENOENT) | **NOT_REACHED** | no Member, no turn, no `read` call issued |
| 3 | sink holds exactly ONE `a5sf-guard-consult/1` deny fact (`IO_READ_DENIED`) | **NOT_REACHED** | the sink file was never created (the Guard never ran). **Absent ≠ "zero facts"** — it is not a product observation |
| 4 | native `read` inside the ceiling succeeds with matching bytes | **NOT_REACHED** | no turn, no read |
| 5 | base provider's read counter did not move; confined route served it | **NOT_REACHED** | the counter installs at plugin apply; the Host never applied the rows, so **no counter rows exist**. Absent ≠ "did not move" |
| 6 | deny-native Member fails loudly with the surface-neutrality refusal, not the unscoped-ctx TypeError | **NOT_REACHED** | no Member setup ran; neither text exists |

`run-record.json` (the machine record) maps the abort to `FAIL`/`RUN_ABORTED` for all seven — that
is the runner's conservatism, not a claim that the product refused. `rejudged.json` (written by
`rejudge.mjs`, which does not touch the machine record) re-disposes them to `NOT_REACHED` with the
per-case reason, using the record's own definition ("the DRIVE never arrived at the asserted
step").

## 3. The finding: a two-row composition is refused by the host's client-modules registry

The Host's launcher stdout is kept as RUN evidence (never inside the deleted home):
`logs/u5a5sflive2-20261103T13-02-54Z/instance-port3183.log`. Verbatim, the decisive part:

```
dsh: startup failed: 1 required plugin did not activate

Failed plugins (1):
  modules (required)
    Package: @deepseek-ai/dsh-client-modules
    AggregateError: client-modules: 1 client package failed to compose:
      other failures:
        - client-modules: package dsh-agent-team resolves from multiple active Loader sources: "file:///home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-live-native2/dev/agent-workflow/evidence/a5sf-live-native2/a5sf-base-read-counter-row.mjs" from file:///…/tests/homes/u5a5sflive2-20261103T13-02-54Z/profiles/web/, "file:///home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-live-native2/dev/agent-workflow/evidence/a5sf-live-native2/a5sf-native-provider-row.mjs" from file:///…/tests/homes/u5a5sflive2-20261103T13-02-54Z/profiles/web/; remove one entry
        at new ClientModuleRegistry (…/tests/deepseek-harness-test-use/packages/client/modules/lib/index.js:544:34)
```

**Mechanism.** This lane mounts its test-composition rows as `file://` URLs in the profile patch
layer. The client-modules plugin resolves each such Loader source to a **package identity** by the
nearest `package.json`. The evidence directory has no `package.json`, so **both** row files
resolved to the repo root package `dsh-agent-team`, whose `package.json` declares a client half
(`"dsh": { "client": { "platform": "web" } }`). The registry refuses one package sourced from two
distinct module URLs: *"remove one entry"*. The rows themselves are unrelated (`globalThis`-level
`ctx` only, no client entry); the collision is purely the package identity of the directory they
live in.

**Why the first boot (`evidence/a5sf-live-native/`) got away with it:** it mounted exactly ONE row
from that directory (the provider row), so the root package had a single Loader source. Adding a
second row — the base-read counter for point 5 — is what crossed the line. The composed patch is
preserved: `logs/…/composed-profile-b62c84cf…patch.yml` (two `file://` rows from the same
directory, both listed in the same `insert:` layer).

**A secondary line in the same log is COLLATERAL, not a second finding:**

```
[dsh-agent-team] bootstrap FAILED: TeamDomainError: store 'schema_meta' operation 'put' was rejected: the TeamDomain is closed
```

The host's own final verdict names `modules` as the one failed required plugin. The Team row's
async bootstrap was still in flight while the Loader unwound the failed composition, and stamped
into a domain that had already been closed (`logs/…/setup-failure.json`). It must be re-checked on
the next boot, but it is not the cause.

**What this boot DID prove (narrow, host-witnessed):** at host pin `639ed01539`, a profile patch
that mounts two `file://` rows from a package-less directory fails composition with the message
above — so evidence rows must be **one per package identity**. That is a real constraint on this
lane's own tooling (captured in §5).

## 4. Nothing about the scope-key fix was tested

No claim is made, in either direction, about:

- whether the attach now receives a scoped Agent (`a5sfAgentToolSurface(root, runtimeAgent)`),
- whether a managed Member activates at all,
- whether the native `read` shadow mounts under the isolated `fs` scope,
- whether the Guard refuses an outside-ceiling read on the live path,
- whether the base provider serves the call (the counter never installed),
- whether the deny-native setup refuses with the surface-neutrality law.

The scope-key evidence on `origin/master` (`evidence/a5sf-scope-key/`) remains **host-free only**;
this boot neither confirms nor weakens it.

## 5. The corrected composition (written, NOT yet run in a Host)

1. **One evidence row per package identity.** The base-read counter is folded into
   `a5sf-native-provider-row.mjs` behind `config.counterPath` (installed through
   `ctx.inject(['fs'], …)`, so the row's apply order — and therefore `ctx.provide('teamA5sfRealm')`
   before the Team row — is exactly the first boot's). The separate
   `a5sf-base-read-counter-row.mjs` is deleted. The counter still wraps the four read methods on
   the live provider class prototype, passes calls through unchanged, and records
   `{ leg:'read-call', method, path, instance, isBase }`.
2. **A pre-boot guard** (`rowIdentityCheck` in `run-boot.mjs`) walks each `file://` row to its
   nearest `package.json` and refuses, **before the grant and before any ledger row**, if two rows
   would share a package that declares a client half. It also runs in `--plan` mode and in the boot
   before the gate. Its two paths are reproducible without a World or a start
   (`--identity-check <file...>`):

   ```
   $ node run-boot.mjs --identity-check dev/…/a5sf-native-provider-row.mjs
   identity-check PASS {"ok":true,"rows":[{"rowId":"row-0","packageName":"dsh-agent-team","hasClientHalf":true}]}

   $ node run-boot.mjs --identity-check dev/…/a5sf-native-provider-row.mjs dev/…/rejudge.mjs
   identity-check REFUSED {"ok":false,"reason":"DUPLICATE_CLIENT_PACKAGE_SOURCES",
     "detail":"package dsh-agent-team (…/package.json) would be sourced from 2 file-URL rows:
      row-0, row-1 — the host client-modules registry refuses this (\"remove one entry\")", …}
   ```

   (The second invocation uses `rejudge.mjs` as a stand-in second file from the same
   package-less directory; the spent boot's own pair was `a5sf-base-read-counter-row.mjs` +
   `a5sf-native-provider-row.mjs`.)

**This correction is UNVERIFIED in a Host.** It was validated only host-free (plan mode + the
route-C suite, 8/8, run before the boot in this worktree), which cannot prove that the Loader
accepts the profile — that is exactly what the spent boot failed to do.

## 6. Completion conditions the corrected boot must meet

`run-boot.mjs` implements these; they are restated so the next runner can challenge them.

| # | assertion | where the witness comes from |
| --- | --- | --- |
| 1 | a Member request exists whose visible surface has exactly ONE `read`, no duplicate names, and no extra `tool:read` prompt section vs the boot-root discovery prompt | the mock's captured request bodies (the model-visible surface) |
| 2 | the outside-ceiling `read` result `isError:true`, text is the Guard's own refusal (`outside every allow subtree of the lane`), **not** a stack/`TypeError`/`ENOENT`, and the planted claim appears nowhere | the tool result content |
| 3 | exactly ONE `a5sf-guard-consult/1` fact for that locator, `decision:"deny"`, `decidedBy:"IO_READ_DENIED"` | the product sink `a5sfEvidencePath`, copied to `consultations.jsonl` |
| 4 | the inside-ceiling `read` returns the planted bytes and its consultations are `allow` | tool result + sink |
| 5 | zero counter rows for the outside path, zero `isBase:true` rows for either path, ≥1 `isBase:false` row for the inside path | the counter JSONL (`base-reads.json`) |
| 6 | after archive, is a residual shadow observable? The driver enumerates the seams and records **NOT_REACHED** unless a real post-stop read witness exists (the archived agent is gone; `/__p6t6/tool` answers `NO_LIVE_AGENT`). No witness is invented | product lifecycle + `/__p6t6/state` + host log |
| 7 | the deny-native `team_create_member` result contains `would CHANGE the Member's model-visible tool surface` and NOT `needs a SCOPED agent Context` | tool result |

## 7. Residual risks for the corrected boot

- **Route C may still not mount the shadow.** The real host `tool-fs` module injects
  `tools`/`fs`/`systemPrompt`; if the Member's isolated scope lacks one, Cordis defers the plugin
  and the surface check sees "no change" — the read would then be served by the BASE provider.
  The counter distinguishes that case (`isBase:true`) and the run reports it as FAIL with data,
  not as a crash.
- **The attach's surface-neutrality check can refuse the worker** if the shadow's registration
  would add a tool the preset row did not already expose (e.g. `read_image` when attachments
  resolve differently on the isolated scope). That would fail closed at Member setup; case 1
  reports it verbatim.
- **The deny-native text may differ.** The assertion is on the shipped refusal phrase; if the
  product words it differently the case fails and the text is quoted, never upgraded.
- **Point 6's teardown check is expected to be NOT_REACHED again** — the live product exposes no
  read-after-stop seam for a disposed agent scope. The host-free N4 arm remains the only evidence
  for the dispose contract.
- **The counter is test instrumentation, not a product counter.** The pinned host ships no read
  counter; quoting this one as the product's would be dishonest. It is prototype-level, in-memory,
  pass-through, and disclosed in the case detail.
- **The compiled ceiling is a fixture** supplied by the test provider row (no v3→compiled product
  bridge at this base). The guard semantics under test are the shipped ones.

## 8. Disposition and the next question

- **Six points:** 0 PROVEN, 0 REFUTED, **7 cases NOT_REACHED** (six reviewer points + the split
  surface/first-read case). The one host-witnessed finding is the composition law in §3.
- **Boots:** 1 spent (P2-01, of 3). **2 remain in P2-01's allocation.** No reserve entry used.
- **Recommended next use of a P2-01 boot:** re-run the corrected composition — the one question it
  asks is: *"With the runtime Agent supplied as the scope key, does a model-visible native `read`
  on an admitted Member execute through the confined provider (outside refused by the Guard with
  exactly one deny fact, inside served with matching bytes, base provider untouched) — or does it
  still fall through to the base route / refuse at setup?"* That boot must be authorised as
  P2-01's second; this lane's grant (`maxStarts: 2`, ledger already at 2) is exhausted by design.

## 9. Files

| file | what it is |
| --- | --- |
| `run-boot.mjs` | the ONE-boot driver (seven cases, `--plan` mode); corrected composition in §5 |
| `a5sf-native-provider-row.mjs` | the single test-composition row: `teamA5sfRealm` + the disclosed read counter |
| `grant.json` | the per-run grant bound to `56a669d93` |
| `ledger.jsonl`, `ledger-rows.json` | the shared-ledger intent + start rows |
| `run.log` | the runner's own log of this boot |
| `run-record.json` | the machine RUN record (all seven `FAIL`/`RUN_ABORTED`) |
| `rejudge.mjs`, `rejudged.json` | honest re-disposition to `NOT_REACHED` (machine record untouched) |
| `logs/u5a5sflive2-20261103T13-02-54Z/instance-port3183.log` | **the witness**: verbatim Host startup failure |
| `logs/…/composed-profile-b62c84cf….patch.yml` | the exact bytes launched (two file-URL rows) |
| `logs/…/setup-failure.json` | the collateral TeamDomain error |
| `rejudge` note | `consultations.jsonl` / `transcript.json` are absent by design (see header) |

### Reproduction

```bash
node dev/agent-workflow/evidence/a5sf-live-native2/run-boot.mjs --plan   # no gate, no spawn
node dev/agent-workflow/evidence/a5sf-live-native2/run-boot.mjs --identity-check <a.mjs> <b.mjs>
node scripts/eb3-evidence-guard.mjs
```

`pnpm ci:local` on this branch: **`DSH-CI-LOCAL verdict=pass steps=4 failed=0 coverage=determined
files=0 wall=13.4s`** — it proves only the static legs (docs probe, docs sync, CI shape, typecheck);
`files=0` means it did not execute any test files, so it says nothing about this boot.
