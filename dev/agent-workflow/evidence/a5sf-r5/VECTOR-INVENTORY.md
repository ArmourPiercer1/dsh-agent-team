# R5 / BL-13 — old golden-vector inventory and dispositions

- **Task**: BL-13 (R5 黄金向量转换) of the Alpha.5 Sandbox-First plan.
- **Branch**: `task/a5sf-r5-golden-20261102`, based on `origin/master` @ `180088813`.
- **Law**: reclamation class C (`dev/agent-workflow/evidence/a5sf-reclaim/ASSET-RECLAMATION-REGISTRY.md`
  §0, R5-a…g). A converted vector is a **regression input**, never new acceptance evidence.
- **Converted kit**: `tests/kits/a5sf-golden/` (schema + corpus + comparator + host-free suite).

## 0. How the inventory was built (reproducible)

```bash
git ls-files | grep -Ei 'golden|vector|fixture' | grep -E '^(dev|tests|packages)/'
grep -rn "MASTER_CORPUS_DIGEST\|MASTER_VECTOR_COUNT" packages/runtime/test/
grep -rn "golden\|GOLDEN" packages/tools/a5p5-tools/test packages/runtime/test --include='*.ts'
# the claim that the new lane computes no operation fingerprint (measured 2026-11-02):
grep -rn "canonicalizeOperation" packages/runtime/member-io-policy \
  packages/runtime/team-services packages/runtime/team-sandbox | wc -l   # → 0
```

The tracked recordings live in `dev/agent-workflow/evidence/u6-pr2-20261025/`,
`u6-pr3-20261026/`, `u6-pr5-20261026/`, `u7-9a-fs-20261026/`. They are large
single-line JSON / digests; the table cites the gate `file:line` plus the
recorded-corpus path (`line 1`) and the vector index used for conversion.

## 1. What exists (old golden material, by corpus)

| # | Old golden material | Gate / assertion source | Recording | Vectors | Disposition |
|---|---|---|---|---|---|
| 1 | **read canonicalization** | `packages/runtime/test/u6-pr2-read-golden-vectors.test.ts:54` (digest), `:55` (count); generator `packages/runtime/test/u6-pr2-golden-corpus.mts:28-105`; path classes `:33,:34,:37,:44` | `dev/agent-workflow/evidence/u6-pr2-20261025/golden-vectors-round2-family.json:1` (`bfa69f58…`, 2893) | 2893 | **split**: 4 path-identity claims REPLAY; the operation fingerprint RETIREs |
| 2 | **shell canonicalization** | `packages/runtime/test/u6-pr3-shell-golden-vectors.test.ts:48` (digest), `:49` (count); generator `u6-pr3-golden-corpus.mts` | `dev/agent-workflow/evidence/u6-pr3-20261026/golden-vectors-master.json:1` (`efb096a6…`, 299) | 299 | **RETIRE** (command-string fingerprint) |
| 3 | **search surface + `rg` argv** | `packages/runtime/test/u6-pr5-search-golden-vectors.test.ts:53` (digest), `:54` (count); generator `u6-pr5-search-golden-corpus.mts` | `dev/agent-workflow/evidence/u6-pr5-20261026/golden-vectors-master.json:1` (`0dabc187…`, 409) | 409 | **RETIRE** (the argv builder dies with the family; the new OS runner is argv-taking) |
| 4 | **write/edit/read_image canonical law** | `packages/runtime/test/u7-9a-mutation-golden-vectors.test.ts:34` (digest), `:35` (count); generator `packages/runtime/test/u7-9a-mutation-golden-corpus.mts:87-103` | `dev/agent-workflow/evidence/u7-9a-fs-20261026/golden-recording.txt:10` (`91fee9a6…`, 1440) | 1440 | **split**: read_image UNUSABLE; write/edit fingerprint RETIREs |
| 5 | **grep argv spelling (A5-SRGP control)** | `packages/runtime/test/alpha5-search-backend.test.ts:205-213` ("R1 pins its argv form verbatim") | — (assertion in test) | 2 argv shapes | **RETIRE** |
| 6 | **web_fetch admission delivery** | `packages/runtime/test/u7f-web-c1.test.ts:242-257` (W-1 ask + approval, bytes delivered) | — (live C1) | 1 behaviour | **RETIRE** |
| 7 | **direct-vs-stub effect parity** | `packages/tools/a5p5-tools/test/a5p5-parity.test.ts:11` (parity law), `:196` (`effectFingerprint`) | — (family-plane test) | 1 matrix | **UNUSABLE** |

**Total recorded vectors found: 5,041** (2893 + 299 + 409 + 1440), plus three
adjacent single-assertion output expectations (#5, #6, #7). All remain in the
tree; the legacy vitest gates keep running in the legacy world. BL-13 does
**not** delete or rewrite them.

## 2. Converted corpus — 10 vectors, dispositions, owners

`tests/kits/a5sf-golden/vectors.json`; `file:line` is the old source, and
`newLane` is the NEW owner of the equivalent effect.

| id | source (`file:line`) | what the old vector asserted | new-lane owner | disposition |
|---|---|---|---|---|
| `read-path-unicode-nfc-locator` | `u6-pr2…/golden-vectors-round2-family.json:1` idx 875; producer `u6-pr2-read-golden-vectors.test.ts:54`; path class `u6-pr2-golden-corpus.mts:33` | `read('café.txt')` → `file:café.txt`, NFC preserved | `member-io-policy#toLocatorKey` | **REPLAY-AS-REGRESSION** |
| `read-path-nfd-not-folded` | same recording idx 1019; path class `u6-pr2-golden-corpus.mts:34` | `read('cafe\u0301.txt')` stayed distinct from NFC (no normalization) | `member-io-policy#toLocatorKey` | **REPLAY-AS-REGRESSION** |
| `read-path-dotdot-literal` | same recording idx 1451; path class `u6-pr2-golden-corpus.mts:37` | `read('../escape.txt')` → `file:../escape.txt` (`..` never folded) | `member-io-policy#toLocatorKey` | **REPLAY-AS-REGRESSION** |
| `read-path-absolute-outside-denied` | same recording idx 2459; path class `u6-pr2-golden-corpus.mts:44` | absolute path outside the root | `member-io-policy#matchLocator` | **REPLAY-AS-REGRESSION** (derived: deny under a restricted `/work` lane) |
| `read-golden-operation-fingerprint` | `u6-pr2-read-golden-vectors.test.ts:54-55` | read calls addressed by a 2893-vector `canonicalizeOperation` digest | `member-io-policy#compileEffectiveIo` | **RETIRE-AS-OLD-SEMANTICS** |
| `shell-golden-command-fingerprint` | `u6-pr3-shell-golden-vectors.test.ts:48-49` | bash command strings canonicalized into approval fingerprints | `sandbox-provider-os-runner#createTeamConfinedRunner` | **RETIRE-AS-OLD-SEMANTICS** |
| `search-rg-argv-spelling` | `alpha5-search-backend.test.ts:205-213` | the family's exact `rg` argv (`-rIn` quirks) | `sandbox-provider-os-runner#createTeamConfinedRunner` | **RETIRE-AS-OLD-SEMANTICS** |
| `web-family-admission-delivery` | `u7f-web-c1.test.ts:242-257` | ask + approval delivering web bytes counted as a web success | `sandbox-provider-os-runner#compileExecutionProfile` | **RETIRE-AS-OLD-SEMANTICS** |
| `read-image-attachment-projection` | `u7-9a-mutation-golden-corpus.mts:97,101-103`; gate `u7-9a-mutation-golden-vectors.test.ts:34` | `read_image` projected a resource key only | `team-services#installToolBindingRealm` | **UNUSABLE** |
| `effect-fingerprint-backend-parity` | `a5p5-parity.test.ts:11,196` | direct vs C-PROC stub parity on `effectFingerprint`/settlement/spill | `team-services#createMemberFsGuard` | **UNUSABLE** |

**Converted dispositions: REPLAY-AS-REGRESSION 4 · RETIRE-AS-OLD-SEMANTICS 4 · UNUSABLE 2 (total 10).**

### Why each RETIRE changed an invariant

- **read operation fingerprint** — the new lane does not address a call by an
  operation projection. It compiles `EffectiveIo` and consumes a one-shot
  invocation capability; `canonicalizeOperation` has **zero** importers in
  `member-io-policy` / `team-services` / `team-sandbox` (measured, see §0).
  Keeping the 2893-vector digest as a new-lane requirement would assert an
  identity the new lane does not compute.
- **shell command fingerprint** — the OS runner takes an explicit non-empty
  argv and refuses `EMPTY_ARGV` with *"never a shell string"*
  (`packages/runtime/team-sandbox/src/runner.ts:66`); shell interpretation is
  the native bash tool's job (BL-17, matrix `NOT_WIRED`). A command-string
  projection is no longer an execution input.
- **search `rg` argv** — argv synthesis is not an OS-runner responsibility. The
  new runner executes the argv it is handed; the native grep row owns its own
  argv (BL-16, matrix `NOT_WIRED`). Pinning the retired spelling would
  resurrect the retired row builder.
- **web admission delivery** — admission-only is not a network hard ceiling.
  The new lane enforces network as a boolean hard ceiling and refuses
  destination-restricted as `UNSUPPORTED`; old delivery is not network
  evidence (registry §4 anti-pattern).

### Why the two UNUSABLE vectors have no equivalent

- **read_image** — the new lane has no bound attachment/image provider (matrix
  M-04 `NOT_WIRED`); the attachment store is outside the Member I/O model, so
  there is no new-lane observation to compare.
- **direct-vs-stub parity** — the new lane forbids re-introducing
  `RequestedEffectSet` (`current-implementation-plan.md:24`) and has no
  stub-backend parity surface; the family pipeline it compared is retired.

## 3. What was deliberately NOT converted

- **5,031 of the 5,041 recorded vectors** — the corpora are atomic digest gates
  over old projections. Importing them would either (a) re-assert a dead
  fingerprint, or (b) require copying thousands of old expectations blindly.
  They stay in their evidence dirs and keep running in the legacy vitest world.
  The converted 10 are the explainable sample.
- **write/edit content fingerprint** — same class as the read fingerprint
  (RETIRE); not duplicated as a separate converted vector because the mutation
  corpus digest already covers it in the legacy world and the new lane computes
  no content projection. `read_image` was converted because it is genuinely
  UNUSABLE (different reason).
- **symlink/hardlink read vectors** — the recorded read vectors disclose a
  resolver-supplied target key; the new lane's symlink law is a real-fs
  resolver in `provider-capabilities.ts`, not a pure string projection. A
  host-free comparator cannot honestly replay it (it would need a fixture
  filesystem; that belongs to P1-03/P2, which already pin it with real-fs
  tests).

## 4. Honest limits — effects that have **no old vector at all**

R5 cannot pin these, and no claim is made that it does:

| Effect | Why no old vector exists | Where it must be evidenced |
|---|---|---|
| OS-level confinement of a real child (Landlock read/write deny) | the old architecture never ran a confined child; P1-07 is the first real measurement | `evidence/a5sf-p1-07/OS-RUNNER-EVIDENCE.md`, P2 oracles |
| network as a **hard** ceiling (boolean + destination refusal) | old `web-family` measured admission only; destination granularity was never implemented | P2 `a5sf-web` (BL-18), P4 network matrix |
| per-Member Service realm, provider binding, install rollback, stale generation | no old tool-family concept (it is the new seam) | P1-05 / G1.5 |
| approval single-use / revocation / epoch / no-widening | Alpha.4 governance semantics, not tool-family output | P1-04, P4 one-shot matrix |
| persistent PTY lifecycle (real receipts) | old bash evidence measured approval-envelope behaviour, not a PTY receipt; the new port is still a test double | P1-08 / G1.8, BL-17 |
| large-file read window / streaming (>10 MiB middle window) | old read vectors are canonicalization-only (no output window) | BL-14 |
| spill / truncation of tool output in the new pipeline | family-plane spill was part of the retired `a5p5` pipeline | P2–P4, independent oracle |

## 5. Reproduce

```bash
cd .worktrees/a5sf-r5-golden
node --test tests/kits/a5sf-golden/compare.test.mjs
node tests/kits/a5sf-golden/compare.mjs \
  --vector read-path-unicode-nfc-locator \
  --observation '{"absolute":false,"segments":["café.txt"]}'
```

RED/GREEN logs: `dev/agent-workflow/evidence/a5sf-r5/{red-test.log,green-tests.log}`.
