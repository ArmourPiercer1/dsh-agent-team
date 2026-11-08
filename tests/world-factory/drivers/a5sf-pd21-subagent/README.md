# `a5sf-pd21-subagent` — the LIVE driver for the governed Member's SUBAGENT realm

One command boots ONE World with the **shipped** `dsh-agent-team/host` row opted
into the shipped governed preset, delegates to a real governed Member, and has
that Member attempt the two capability escalations PD-21 exists to settle:

1. `subagent` — spawn a child session, then have the child read a fixture that
   sits **outside** the Member's compiled read lane;
2. `team_create_member` — mint a Member of its own template and of a **wider**
   template the blueprint declares.

```sh
node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs   # 2 boots (agreeing pair)
node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs --boots 1
node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs --plan   # host-free
```

Artefacts: the driver writes `dev/agent-workflow/evidence/a5sf-pd21-subagent/runs/boot01/`
and `runs/boot02/` (one per boot; a previous pair is moved to `archive/` first) and
appends to the DEV-LIVE ledger beside them. The measured result and its reading are
in that directory's `README.md`; this file documents the driver only.

## What the run measures, per boot

| case | proposition |
| --- | --- |
| `pd21:member-confined-baseline` | the Member's `bash` still admits an in-lane read through the **confined terminal face** (the positive control) |
| `pd21:member-surface` | that `bash` schema is the confined one (`command`/`description`/`workdir`), not the inherited shell |
| `pd21:subagent-child-governed` | `subagent` produces **no** child outside the Member's realm: either absent from the surface with a typed refusal and zero children (fail-closed), or a child whose out-of-lane read is a typed `IO_READ_DENIED` with zero bytes (inheritance) |
| `pd21:no-child-byte-escape` | **zero** out-of-lane bytes reach any model request, the child transcript, or the Member's `subagent` result |
| `pd21:child-fact-attribution` | if a child exists, its refusal is a fact naming the Member, the policy revision, the tool and the call (`tool`/`callId`) |
| `pd21:confined-launcher-accounting` | exactly ONE confined-provider launcher for the Member's own command; no base `bwrap` carrying the fixtures |
| `pd21:member-create-refused` | both `team_create_member` calls are typed admission refusals and the instance count does not move |

Captured per boot: the Member's **and** the child's durable session logs (the
child is found by `delegationDepth >= 1`), the child's model-visible surface
(from the mock request log), every `a5sf-guard-consult/1` fact, an independent
`/proc/<pid>/cmdline` scan, and the Member instance count before/after the
creation attempts.

## Boot discipline

* `DSH_HOME = tests/homes/u5a5sfpd21-<stamp>` (inside the worktree, gitignored);
* ports from the **3180 family** through WorldFactory leases; `:3080` is never
  touched and no other server is started;
* the pinned host tree is **read-only**; `git status --porcelain` is verified
  empty before the first boot and after every boot;
* **one machine-wide dev-live slot per boot** via
  `tests/world-factory/lib/dev-live-slots.mjs` (owner ruling 2026-11-13: ≤ 6
  concurrent dev Hosts; the per-subagent cap of 2 is separate). This lane's boot
  authorisation is the task's own explicit DEV-LIVE instruction — the
  face-scoped `dev-live-grant.json` is `face: Subprocess`, and this face is
  `Subagent`, so it is **not** claimed;
* archive-before-start: a previous `runs/` is moved to `archive/<stamp>/`;
* teardown by identity through the World's own teardown; every start appends a
  `recordClass: 'DEV-LIVE'` ledger row.

## What is fixture (disclosed)

The model is the shared scripted mock (`packages/tools/harness/mock-deepseek.mjs`);
the `/proc` watcher and the mock request log are test instrumentation. The
product path is real: the preset row, the realm provider/compiler, the guard, the
confined terminal face, the subagent provider and the team tool router are the
shipped modules the Host loads. Boot evidence is **never** merge evidence: the
record class is `DEV-LIVE` and `candidateClaimEligibility` is false.
