# `a5sf-live-member` — the LIVE Member driver for the governed preset

One command boots ONE World with the **shipped** `dsh-agent-team/host` row
opted into the shipped governed preset, creates a real Member with an explicit
`memberPresetId: a5sf-governed-member`, gives that Member a prompt whose answer
must come from `bash`, and captures the Member's **own** durable transcript.

```sh
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs
```

The command runs **two boots** and writes an agreeing pair. `--boots 1` is a
development iteration; `--plan` is host-free (row/blueprint validation only,
spends no boot and no port).

## What the run proves (and what it does not)

Proven per boot, judged locally and recorded in `run-record.json`:

| case | proposition |
| --- | --- |
| `lm:member-bash-admitted` | the Member's model-visible `bash` admits an **in-ceiling** read and returns its bytes |
| `lm:member-bash-denied` | the same `bash` refuses an **out-of-ceiling** read before the shell starts: a typed `IO_READ_DENIED` tool error, zero secret bytes |
| `lm:governed-surface` | the Member's `bash` schema is the confined-terminal one (`command` / `description` / `workdir` only), not the inherited shell |
| `lm:guard-facts` | the product guard sink holds exactly one ALLOW + one DENY `shellRead` fact for the real Member identity |
| `lm:no-base-spawn` | exactly one confined-provider launch for the two commands, zero base `bwrap` runs carrying the Member's fixtures |

Not proven: network confinement (the shipped preset cannot narrow it), any
kernel claim beyond "the confined provider was the process that ran", and — by
construction — anything a `DEV-LIVE` record can never be (a candidate claim).

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
* every start appends a `DEV-LIVE` row to the shared ledger and to
  `dev/agent-workflow/evidence/a5sf-live-member/run-ledger.jsonl`.

## Inputs

| input | source |
| --- | --- |
| pinned host tree | `tests/deepseek-harness-test-use` (local real directory) or the shared checkout one level above the repo |
| dev-live grant | `dev/agent-workflow/evidence/dev-live-grant.json` (`scope: DEV-LIVE`, `face: Subprocess`, `world: u5a5sfsub1`) |
| shipped rows | `cordis.patch.yml` — the `dsh-agent-team/host` row and the `preset-a5sf-governed-member` row, parsed with the single `!!js` platform predicate **evaluated** (not stringified) |
| model | the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`) |
| env | `A5SF_GOVERNED_SCRATCH` is set by the driver to `<home>/governed-scratch` before the Host spawn; `A5SF_LM_CHAIN_TIMEOUT_MS` (development only) shortens the wait for the Leader chain |

## Composition (what is fixture, what is product)

The Team row is the shipped one, overridden only with the opt-in keys the
preset requires (`memberPresetId`, `a5sfGovernedRealm: true`,
`a5sfEvidencePath`) plus the boot/anchor fields and a **schemaVersion 4**
`blueprintSource` whose `memberIoCeilings` family reads/writes the World
workspace only. The preset row is copied **verbatim** from `cordis.patch.yml`.

The product path is real: the realm provider, the policy compiler, the guard
consult sink, the confined `terminals`/`subprocess` faces and the confined
process provider are the modules the Host loads from `packages/runtime/dist`.
Only the model is scripted. The driver adds no fixture native tool module and
no custom realm row.

## Artefacts

Per boot (`dev/agent-workflow/evidence/a5sf-live-member/runs/boot0N/`):

| file | content |
| --- | --- |
| `member-transcript.json` / `.txt` | the Member's OWN durable session log, normalised: user prompt, both `bash` calls, both tool results, final text |
| `member-surface.json` | the Member's model-facing `bash` schema (and team tools) |
| `guard-facts.json` | every guard-consult fact the product sink wrote |
| `counters.json` | confined-provider launches, pre-attach probes, base-spawn sightings, guard counts, mock request counts |
| `proc-observations.json` | raw `/proc/<pid>/cmdline` sightings (the independent witness) |
| `leader-delegate.json` | the Leader's `team_delegate` call and its result (the Member attach fact) |
| `leader-surface.json` | the Leader surface measured by the discovery turn |
| `run-record.json` / `summary.txt` | the `u5-run-record/1` DEV-LIVE record |
| `host-log-tail.log` | redacted tail of the Host stdout |
| `teardown.json` | teardown report + pinned-host porcelain |

Run-level: `agreement.json` / `agreement.txt` (the two-run table),
`driver-digest.json` (head, host pin, driver hash, parsed `!!js` substitution),
`plan-patch.yml` (the composed patch, `--plan`), `run-ledger.jsonl` (DEV-LIVE
starts), `driver.log`.

Raw Host stdout (`driver/logs/`) is driver scratch and is **not** committed: it
contains the one-time bootstrap token URL. Only its redacted tail is evidence.

## Failure discipline

Three consecutive boots failing with the same cause and no new diagnostic is
the stop condition: the driver refuses to keep spending boots. A refusal in the
Member attach is persisted in `leader-delegate.json` **before** the World home
is deleted, so a failed attach is diagnosable instead of invisible.
