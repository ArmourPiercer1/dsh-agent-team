# The hosted L2 on `b87adf358` (run 44343691531) — what it caught that local evidence could not

Two separate findings from the same run. One was a real defect **in the assertions**; the other is an
unexplained flake that this file records rather than explains away.

## 1. ci-census / B4/1 — the P3 network arms pinned one host's capability (fixed)

Hosted, twice (deterministic; the second attempt repeated it):

```text
✖ P3-PROBE-SHAPE (BL-42 flip): the real probe says network-destination=enforced WITH a mechanism and a realm-bound evidence row; absence is still a capability gap
  AssertionError: probe note: landlock ABI v8: Landlock ABI v4 mediates only TCP port bind/connect inside the domain; … (PoC-4b)
  actual: 'unsupported'   expected: 'enforced'
✖ P3-DENY-KERNEL-REFUSED (BL-42 flip): a network=deny lane now reaches the provider once and its child runs in a DISTINCT netns …
  AssertionError: the deny lane must now be admitted: NETWORK_UNCONFINED_REALM
  actual: ConfinedSubprocessRefusal: NETWORK_UNCONFINED_REALM: … refusing before any process instead of running a network-capable child under a deny claim this host cannot enforce
```

**The product was right.** Its probe answered `network-destination=unsupported` for that kernel, so it
refused to run a network-capable child under a deny claim the host cannot enforce — before spawning
anything. The arms asserted the answer of a machine whose Landlock reports `enforced`.

### The fix: assert the PAIRING, in one helper used by both arms

`assertCapabilityPairing` (`tests/world-factory/a5sf-sub-contract.test.mjs`) encodes the contract once:

| capability | probe must yield | deny lane must be |
| --- | --- | --- |
| `enforced` | `mechanism` matching `netns` **and** an `evidence://…` row bound to the realm id and the launcher trust root, with the measurement note | admitted **once** (`spawns.after - before === 1`), child reports `NS <inode>`, its own connect attempt carries a **kernel** errno (`101|111|113`) |
| `unsupported` | `mechanism === null`, `evidence === null`, and a **note that names the gap** (`landlock ABI v\d+` / `does not mediate` / `not enforce`) | refused **before spawn**: `NETWORK_UNCONFINED_REALM`, `spawns.after === before === 0`, `text === undefined` — nothing ran, so nothing spoke |

Red in every other direction, kept as its own control: a fabricated `enforced` with **no mechanism**
(`{dimension, level:'enforced', note:'trust me'}`) is `unsupported` with `NO mechanism` in the note; an
empty note is a silent unknown; and a network=deny lane is never silently allowed (the refusal code and
the spawn counter are what rule that out).

### Both halves are proven on EVERY host

A developer box cannot reproduce the runner's ABI, so the hosted capability is **injected at the provider
seam** — `makeSubContractWorld({ capabilityOverride })`, which replaces `counted.provider.probe` and
nothing else (the spawn path stays the product's, so a refusal measured there is the product's admission
decision over a simulated capability, not a simulated refusal):

```text
✔ P3-PROBE-SHAPE (capability-paired): enforced WITH a mechanism and a realm-bound evidence row, OR unsupported WITH a note naming the ABI gap; a bare enforced is red
✔ P3-PROBE-SHAPE (hosted capability simulated): unsupported WITH the ABI-v8 gap note, no mechanism, no evidence — and not a measurement
✔ P3-DENY-KERNEL-REFUSED (capability-paired): enforced ⇒ admitted once and refused by the KERNEL in a distinct netns; unsupported ⇒ refused BEFORE SPAWN with NETWORK_UNCONFINED_REALM and zero children
✔ P3-DENY-REFUSED-BEFORE-SPAWN (hosted capability simulated): NETWORK_UNCONFINED_REALM with zero provider calls and no child
ℹ tests 17   ℹ pass 17   ℹ fail 0
```

Local box = `enforced` (real case (a)); the simulated world = the runner's `unsupported` (case (b), end to
end). On the runner the same two cases swap roles, so the leg is green there for a measured reason.

The leg's manifest `why` (`dev/ci/eb3-ci-manifest.json`, `b4/1 subprocess boundary …`) now records the
pairing and quotes the hosted ABI v8 transcript, and `docs/plans/memo/m7b1-b4-20261116/README.md` §3c
states the same.

## 2. ci-integration / `tinf-instruments` — one red, then green on the identical head (flake hunt)

Attempt 1 of run 44343691531: step "test catalog + TINF instruments" exited 1. The rerun on the SAME head
passed (48 suites, `set=sha256:9ea399ec…`). The failing suite's name is not recoverable from the job log
(it is truncated mid-line, `GAP1a a bind` from `a5sf-assembly.test.mjs`, 2 231 of the job's lines) — so
this is investigated by re-running the leg in the CI shape rather than by reading a log.

See `flake-hunt.txt` in this directory: N consecutive runs of

```text
node scripts/dispatch-tests.mjs --run --leg tinf-instruments
```

in a **fresh full clone** of the pushed head, its own `pnpm install --frozen-lockfile` + `pnpm run build`,
**host tree absent** (a fresh clone carries none), one bash invocation so `/tmp` is shared between runs —
the runner's shape, and the shape in which a `/tmp`- or port-sharing suite would show up.

The suspects the search explicitly looks for, per run:

1. the **shared-state class**: any run that leaves the tree dirty (`git status --porcelain` count before vs
   after) would poison the next run — recorded per run;
2. suites that share fixed paths/ports (`a5sf-assembly` in particular, whose refusal text appears in the
   truncated hosted log);
3. anything reading `git status`/`dirty_paths` — the class that already bit this repo twice.

If no run is red, this section records UNKNOWN with the transcript and the exact command, rather than a
guess (see `flake-hunt.txt` for the verdict).
