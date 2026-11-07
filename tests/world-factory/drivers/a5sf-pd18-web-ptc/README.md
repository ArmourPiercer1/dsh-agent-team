# `a5sf-pd18-web-ptc` — the LIVE Member driver for PD-18

One command boots TWO Worlds with the **shipped** `dsh-agent-team/host` row
opted into the shipped governed preset, creates a real Member with an explicit
`memberPresetId: a5sf-governed-member`, and measures the PD-18 disposition:

- the governed Member's **`workflow`** call and **`web_fetch`** call are typed
  host-router refusals (`unknown tool`), with **zero execution**, **zero PTC
  child**, and **zero requests** to a controlled loopback endpoint;
- the governed Member's **`bash`** still works through the confined terminal
  face (in-lane bytes, out-of-lane `IO_READ_DENIED`, guard facts);
- the **same Host tree**, on the standard `BOOT_ROOT` preset (outside the
  governed preset), still executes `workflow` and returns its deterministic
  `42` — the capability is not broken, it is removed from one preset.

```sh
node tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs          # two boots
node tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs --boots 1
node tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs --plan   # host-free
```

## What the run proves (and what it does not)

Proven per boot, judged locally and recorded in `run-record.json`:

| case | proposition |
| --- | --- |
| `pd18:member-bash-admitted` | the Member's model-visible `bash` admits an **in-ceiling** read and returns its bytes |
| `pd18:member-bash-denied` | the same `bash` refuses an **out-of-ceiling** read before the shell starts: typed `IO_READ_DENIED`, zero secret bytes |
| `pd18:member-surface-closed` | the full governed Member surface names no `workflow` / `web_fetch` / `web_search` / `run_code`; `bash` is still present; the endpoint saw zero requests |
| `pd18:member-workflow-typed-refusal` | `workflow` is `isError=true` `unknown tool "workflow"`, returns no `42`, creates no PTC child |
| `pd18:member-web-typed-refusal` | `web_fetch` is `isError=true` `unknown tool "web_fetch"`, is **not** the host SSRF refusal, endpoint 0 requests / 0 bytes |
| `pd18:leader-workflow-allowed` | the standard BOOT_ROOT preset executes `workflow` and returns `42` (the positive control) |
| `pd18:guard-facts-shell-only` | exactly one ALLOW + one DENY `shellRead` fact for the real Member identity; no web/PTC fact exists |
| `pd18:no-member-code-exec` | one confined launcher for two commands; zero `ptc-runtime` processes in the Member window; zero base `bwrap` children with the Member fixtures |

Not proven: network confinement (the shipped governed preset no longer has a
web surface at all), subagent child-session realm assembly (unmeasured), or
anything a `DEV-LIVE` record can never be (a candidate claim / `V@B`).

## Boot discipline

* `DSH_HOME = tests/homes/<world>` (inside the worktree, gitignored);
* ports from the **3180 family** through WorldFactory leases; `:3080` is never
  touched and no other server is started;
* the pinned host tree is **read-only**; its `git status --porcelain` is
  verified empty before the first boot and after every boot;
* **≤ 2 concurrent dev Hosts** via `tests/world-factory/lib/dev-live-slots.mjs`
  (this driver holds one slot per boot);
* **archive-before-start**: an existing `runs/` is moved to
  `archive/<stamp>/` before the run writes anything;
* teardown by identity through the World's own `teardown()`;
* every start appends a `DEV-LIVE` row to this task's ledger
  (`dev/agent-workflow/evidence/a5sf-pd18-web-ptc/run-ledger.jsonl`).

## Inputs

| input | source |
| --- | --- |
| pinned host tree | `tests/deepseek-harness-test-use` (local real directory) or the shared checkout one level above the repo |
| dev-live grant | `dev/agent-workflow/evidence/dev-live-grant.json` (`scope: DEV-LIVE`, `face: Subprocess`, `world: u5a5sfsub1`) |
| shipped rows | `cordis.patch.yml` — the `dsh-agent-team/host` row and the `preset-a5sf-governed-member` row, parsed with the single `!!js` platform predicate **evaluated** (not stringified) |
| model | the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`) |
| loopback endpoint | the driver starts a plain `node:http` server on `127.0.0.1:0`; its URL is given to the Member's `web_fetch` call and its hits are persisted (`web-endpoint-observations.json`) |
| env | `A5SF_GOVERNED_SCRATCH` is set by the driver to `<home>/governed-scratch` before the Host spawn; `A5SF_PD18_CHAIN_TIMEOUT_MS` (development only) shortens the wait for the Leader chain |

## Composition (what is fixture, what is product)

The Team row is the shipped one, overridden only with the opt-in keys the
preset requires (`memberPresetId`, `a5sfGovernedRealm: true`,
`a5sfEvidencePath`) plus the boot/anchor fields and a **schemaVersion 4**
`blueprintSource` whose `memberIoCeilings` family reads/writes the World
workspace only. The preset row is copied **verbatim** from `cordis.patch.yml`
— after PD-18 it carries neither `tool-web` nor `workflow-ptc`/`tool-workflow`.

The product path is real: the realm provider, the policy compiler, the guard
consult sink, the confined `terminals`/`subprocess` faces and the confined
process provider are the modules the Host loads from `packages/runtime/dist`.
Only the model, the loopback endpoint and the /proc watcher are fixtures. The
driver adds no fixture native tool module and no custom realm row.

## Artefacts

Per boot (one directory per boot under
`dev/agent-workflow/evidence/a5sf-pd18-web-ptc/runs/`):

| file | content |
| --- | --- |
| `member-transcript.json` / `.txt` | the Member's OWN durable session log: user prompt, both `bash` calls, the `workflow` and `web_fetch` refusals, final text |
| `member-surface.json` | the **full** model-facing tool-name list (unfiltered) + the `bash` schema |
| `guard-facts.json` | every guard-consult fact the product sink wrote |
| `counters.json` | confined launches, pre-attach probes, base-spawn sightings, `ptcRuntimeInMemberWindow`, endpoint requests, guard counts |
| `proc-observations.json` | raw `/proc/<pid>/cmdline` sightings (the independent witness) |
| `web-endpoint-observations.json` | the controlled endpoint's request log (must be empty) |
| `leader-workflow.json` | the standard-preset `workflow` positive control (`return 42`) |
| `leader-delegate.json` | the Leader's `team_delegate` call and its result |
| `leader-surface.json` | the standard Leader surface measured by discovery (still carries web/workflow) |
| `run-record.json` / `summary.txt` | the `u5-run-record/1` DEV-LIVE record |
| `host-log-final.log` | redacted tail of the Host stdout |
| `teardown.json` | teardown report + pinned-host porcelain |

Run-level: `agreement.json` / `agreement.txt` (the two-run table),
`driver-digest.json` (head, host pin, driver hash, parsed `!!js` substitution),
`plan-patch.yml` (the composed patch, `--plan`), `run-ledger.jsonl` (DEV-LIVE
starts), `driver.log`.

Raw Host stdout (`driver/logs/`) is driver scratch and is **not** committed: it
contains the one-time bootstrap token URL. Only redacted tails are evidence.

## Failure discipline

Three consecutive boots failing with the same cause and no new diagnostic is
the stop condition: the driver refuses to keep spending boots. A refusal in the
Member attach is persisted in `leader-delegate.json` **before** the World home
is deleted, so a failed attach is diagnosable instead of invisible.
