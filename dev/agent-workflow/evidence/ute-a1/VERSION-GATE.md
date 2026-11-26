# VERSION-GATE.md — the Candidate Acceptance Gate as a VERSION gate (owner ruling, 2026-11-25)

This file is the operational half of the owner ruling recorded in `OWNER-DECISIONS.md` §"ROUND 117". It
states the definition now in force, the receipt schema, the exact branch/tag protection configuration the
owner must apply, and the freeze procedure — copy-paste reproducible, no interpretation needed.

Worktree `.worktrees/vnext-a1-cut`, branch `vnext/a1-cut`, PR **#822 DRAFT**. Nothing in this file claims
the gate HAS been exercised as a version gate end-to-end: it has not (see §8).

---

## 1. The ruling and the definition now in force

**The Candidate Acceptance Gate is a VERSION gate, not a per-PR gate.**

- It is **NOT required on ordinary PRs**. An every-PR 84-minute dual-host run (round 109 measured
  `83 m 48 s`; 16 real host boots) is a **10x slowdown of the daily loop** for no added value on
  docs/script PRs, and it must not become a merge gate.
- It **IS the formal gate for a candidate/release version**: it must run, be green, and be **Required**
  at the **frozen candidate SHA** before a version is declared deliverable.
- The **rejected alternative** is "required on every PR" (rejected by the owner for the cost/relevance
  reason above; recorded in `OWNER-DECISIONS.md`).

**`PRODUCT-PROVEN` (the single definition, in force):**

> A capability row is **PRODUCT-PROVEN** only when a candidate/release **version** has been frozen: the
> version gate ran at the **frozen candidate SHA**, is **green** there, its `version-gate-receipt.json`
> verifies (head == frozen SHA, verdict `pass`, `envLimited` 0, known-refuted set exactly the enumerated
> one), **and** the `version-gate` context is **Required** by the release branch/tag protection rule.
> It is **NOT** "covered by every PR's Required CI". No row is PRODUCT-PROVEN today; none becomes so
> until such a version gate is frozen, Required and green at that SHA.

**ROUND 118 vocabulary (owner ruling 2026-11-25, `OWNER-DECISIONS.md` §"ROUND 118").** Two words, two
facts, never interchangeable: **`CANDIDATE-ACCEPTED`** = the row's deterministic acceptance evidence ran on
**both** pinned hosts in one candidate round, with the selected generation proven per run
(`HOST-VERSION-GUARD host=<mode> resolved=<version> pin=<version>`) and a classified result on each;
**`PRODUCT-PROVEN`** = the frozen-version fact above. `CANDIDATE-ACCEPTED` is a precondition for the freeze,
not a substitute. Model-behaviour rows need a real-model run at the pin to reach `CANDIDATE-ACCEPTED`; that
run is a later round and is not started. **No row is PRODUCT-PROVEN.**

## 2. What the gate covers — exactly the 31 judges, nothing more

Per host the gate grades **31 judges** (44 sign-off rows / claims are NOT this population). Per the
gate's own declaration (`scripts/candidate-acceptance-gate.mjs` `DRIVERS`):

| driver | judges | contract rows it can speak to |
| --- | --- | --- |
| `d` (6) | `d:member-read-admitted`, `d:member-read-denied`, `d:native-read-surface`, `d:guard-facts`, `d:centre-facts`, `d:remote-creation` | C12 (admission/guard), C13 base (fs read faces), C9 (remote create) |
| `d2` (4) | `d2:multi-member-concurrency`, `d2:revocation`, `d2:stop`, `d2:remote-delivery` | C2 (archive/restore), C8 (Stop), C9 (remote delivery), C12 |
| `d3` (4) | `d3:persistent-subprocess`, `d3:crash-cold-recovery`, `d3:work-delivery`, `d3:alpha6` | C3 (work delivery), C13 base (subprocess/PTY face), C6 (refusal side) |
| `d4` (17) | `enablement`, `officer-up`, `officer-binding`, `routed-wake`, `case-created`, `router-officer`, `wake-delivered`, `officer-decides`, `ask-executes-after-review`, `duplicate-route`, `sticky-stop`, `refusal`, `ask-execute`, `ask-execute-2`, `ask-execute-process`, `ask-denied`, `ask-stopped` | C5 (ask/grant/deny/Stop), C6 (routed wake), C8 (Sticky Stop), C13 (process-ask arm as the single enumerated REFUTED) |

**Rows the gate covers (its judges can be the executed evidence):** C2, C3, C5, C6, C8, C9, C12, and
C13's **fs/subprocess base faces**. Even for these, PRODUCT-PROVEN additionally needs the version freeze
(§1).

**Rows the gate will NEVER cover** — no judge in the population asserts them, so no freeze can promote
them:

| row | why the gate never covers it |
| --- | --- |
| **C1** (15 `team_*` tools, closed set) | the in-process arms + an observation; no candidate-gate judge lists the model-visible 15-tool set |
| **C4** (Blueprint binding + identity generation) | `TB-1…TB-6` are in-process; no live judge asserts the identity chain |
| **C7** (durable wake intents + **cold** wake) | `d4:wake-delivered` is a live delivery; the cold-restart consumption half has no judge |
| **C10** (MCP catalog + live loss) | `ADM-96/97` mount a real server in-process; no booted MCP judge |
| **C11** (state projections / `sessionProjections`) | `ADM-107…109` are in-process; the host `stateOf` face is not judged live |
| **C13 — PTC arm** (`run_code`) | ruled out; the refusal arms are Required CI (`ADM-76/79/87`), not the gate |
| **C13 — web / terminals / userQuestions faces** | no live `web_fetch`, no live terminal/user-question judge |
| **C14** (dropped governed-family implementations) | absence/accounting proof (`ute-cut-closure`, `ute-p0-assets`), not a boot |
| **C14b** (preserved safety invariants) | the gate touches path bounds / Control / Stop carriers, but **never the network-deny invariant** (ENV-LIMITED on the hosted runner), so the row cannot be PRODUCT-PROVEN from this gate |
| **C15** (`team_skill`), **C16** (`subagent_fork`) | `ADM-32` host-capability binding; no live skill/fork judge |
| **C17**, **C18** | dropped-as-ruled / dormant; provable by absence, never by the gate |

**No blanket coverage may be inferred.** "The gate is green" means those 31 judges on each pinned host;
it is not a statement about C1/C4/C7/C10/C11/C14/C14b/C15/C16/C17/C18 or about C13's web/terminals/user
faces.

## 3. The receipt — schema and where it lands

A green grading run publishes ONE file:

```
dev/agent-workflow/evidence/candidate-acceptance-gate/version-gate-receipt.json
```

(stable path, overwritten per run; the run's per-host evidence stays under the timestamped sibling
directory). Schema, exactly (no extra keys — an unknown key is schema drift to the verifier):

```json
{
  "schemaVersion": 1,
  "kind": "version-gate-receipt",
  "head": "<40-hex frozen candidate SHA>",
  "verdict": "pass",
  "judges": { "proven": 60, "knownRefuted": 2, "envLimited": 0 },
  "knownRefutedIds": ["d4:ask-execute-process"],
  "hosts": ["legacy", "next"],
  "startedAt": "2026-11-24T23:43:47.693Z",
  "finishedAt": "2026-11-25T01:07:00.000Z",
  "gateVersion": "candidate-acceptance-gate/1",
  "verdictFile": {
    "path": "dev/agent-workflow/evidence/candidate-acceptance-gate/<run>/verdict.json",
    "digest": "sha256:<64 hex over the verdict.json bytes>"
  }
}
```

- `judges.knownRefuted` counts **occurrences** (the same approved refusal is graded once per host);
  `knownRefutedIds` is the **distinct** id set and must equal the gate's enumeration
  (`scripts/candidate-acceptance-known-refuted.mjs`).
- `verdictFile` is the ONLY reference to the driver evidence: no second evidence format is invented. The
  `sha256` digest is the binding — a verdict whose bytes changed after the receipt was published is
  refused.
- Producer: `scripts/version-gate-receipt.mjs` (refuses a non-pass verdict, a head mismatch, a
  non-partitioning judges block, or `envLimited != 0`).
- Consumer: `scripts/version-gate-verify.mjs` (exit 0 only on a full pass). Codes, closed:
  `VERSION_GATE_RECEIPT_MISSING`, `_RECEIPT_UNREADABLE`, `_SCHEMA_DRIFT`, `_SCHEMA_VERSION_UNSUPPORTED`,
  `_HEAD_INVALID`, `_HEAD_MISMATCH`, `_VERDICT_NOT_PASS`, `_TIME_INVALID`, `_VERDICT_FILE_MISSING`,
  `_VERDICT_DIGEST_MISMATCH`, `_VERDICT_UNREADABLE`, `_VERDICT_SCHEMA_UNSUPPORTED`,
  `_VERDICT_HEAD_MISMATCH`, `_JUDGES_MISMATCH`, `_ENV_LIMITED_NONZERO`, `_KNOWN_REFUTED_UNEXPECTED`,
  `_KNOWN_REFUTED_MISSING`, `_HOSTS_MISMATCH`, `_HEAD_UNRESOLVED`, `_USAGE`.
  Its negative controls are `scripts/version-gate-verify.test.mjs` (collected; leg
  `version-gate-verify-unit`).

## 4. The check names (why there are two jobs)

A GitHub protection rule requires a **stable, literal context name**. A check name that carries the
graded SHA cannot be required. So the workflow has two jobs:

| job | check name | purpose |
| --- | --- | --- |
| `candidate-acceptance` | `candidate-acceptance (VERSION GATE, NOT per-PR Required) head=<sha>` on the version path, `candidate-acceptance (opt-in, not required) head=<sha>` on the PR-label path | provisions both pinned hosts, runs the gate, asserts `graded == checked-out == requested`, publishes the receipt |
| `version-gate` | **`version-gate (Required at frozen candidate SHA)`** | stable required context; downloads the receipt artifact and runs the verifier with `--head <requested>`. Runs on the version path only, with `if: always()`, so a failed grading job REFUSES instead of being skipped green |

## 5. Branch / tag protection configuration (exact, copy-paste)

> **Rule to create:** a **Ruleset** (or classic branch protection) targeting the release branch pattern
> `release/**` — never `master`/the default-branch PR rule.

1. GitHub → **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. **Target branches:** `release/**` (add `candidate/**` too if candidate branches are used as the
   freeze surface). **Do NOT** add this ruleset to `master` or to the repository's default-branch
   protection; the version gate must never be a per-PR requirement.
3. **Rules:** enable **Require a pull request before merging** (if that is the release process) and
   **Require status checks to pass**. In the check list select exactly:

   ```
   version-gate (Required at frozen candidate SHA)
   ```

   Leave `ci-required` (the default-branch PR context) on the default-branch rule where it already is;
   do not add `candidate-acceptance … head=<sha>` to any rule — its name is per-run and cannot be
   required.
4. **Bypass list:** empty (or the release manager only, if the owner wants a documented break-glass;
   a bypass is visible in the ruleset audit log).
5. **Tag protection (release tag, e.g. `v*` or the exact release tag):** create a **tag ruleset**
   restricting **creation/update/deletion** to the release manager. GitHub's tag rulesets do not offer
   required status checks (branch rulesets do). The tag is therefore cut from a commit whose
   `version-gate` context is green **and** whose receipt verifies — that pair is the tag-side freeze, and
   §6 is the procedure that proves it.

**Verification that the rule is right (copy-paste):**

```bash
gh api repos/{owner}/{repo}/rulesets --jq '.[] | select(.target=="branch") | {name, target, enforcement, conditions}'
gh api repos/{owner}/{repo}/rulesets/<id> --jq '.rules[] | select(.type=="required_status_checks")'
```

The second command must print `version-gate (Required at frozen candidate SHA)` and nothing that looks
like `candidate-acceptance … head=`.

## 6. Freeze procedure (the order is the rule)

1. **Freeze the SHA.** Choose the candidate SHA `S` (the commit that will be tagged). No non-evidence
   commit may be added to `S` after this point; a documentation/evidence commit that changes
   `packages/*/src` re-opens the freeze.
2. **Run the version gate at `S`.** Either push `S` to `release/**` (the `push` trigger) or dispatch it:

   ```bash
   gh workflow run candidate-acceptance.yml \
     --ref release/<candidate> \
     -f head=<S>
   ```

   The run's grading job is named `candidate-acceptance (VERSION GATE, NOT per-PR Required) head=<S>`.
3. **Collect the receipt.** From the run's artifacts (`version-gate-bundle-<run_id>`), or from the
   checked-out evidence tree if the run was local. Verify it — this is the gate's own check, and it must
   exit 0:

   ```bash
   node scripts/version-gate-verify.mjs \
     --receipt dev/agent-workflow/evidence/candidate-acceptance-gate/version-gate-receipt.json \
     --head <S>
   # VERSION-GATE-VERIFY pass head=<S> hosts=legacy,next proven=… known-refuted=… env-limited=0
   ```

   A non-zero exit is a typed `REFUSED VERSION_GATE_*` line; the version is **not** deliverable.
4. **Confirm the Required context is green at `S`.** The `version-gate (Required at frozen candidate
   SHA)` check-run at `S` must be `success`:

   ```bash
   gh api repos/{owner}/{repo}/commits/<S>/check-runs \
     --jq '.check_runs[] | select(.name=="version-gate (Required at frozen candidate SHA)") | {name, conclusion, head_sha}'
   ```

5. **Freeze.** Record the receipt path + digest + `S` in the release record. From here on `S` takes **no
   non-evidence commits**. If one is required, return to step 1 and re-run.
6. **Cut the tag** from `S` (restricted by the tag ruleset, §5.5).

## 7. Local dry run — the honest maximum without dispatching

Round 117 ran the writer + verifier against the repository's OWN latest gate verdict
(`dev/agent-workflow/evidence/candidate-acceptance-gate/2026-11-24T23-43-47-693Z/verdict.json`, head
`92be91dfb`), in a temp directory, and exercised the refusals (wrong head, missing receipt). Log:
`round117/version-gate-dryrun.log`. **No receipt was committed** for that SHA: a committed receipt for an
unfrozen head would be mistakable for a freeze.

## 8. What remains unexercised (do not round this up)

- **The version gate has NOT run end-to-end as a version gate.** No `push` to `release/**`/`candidate/**`
  and no `v*` tag has been created, and no `workflow_dispatch` with a `head` input has been fired. The
  workflow logic is reviewed, and the receipt writer/verifier are exercised locally and by their
  controls; the hosted two-job path (artifact upload → download → verify) is **not** measured.
- **No branch/tag protection rule has been applied.** The instructions in §5 are for the owner; until the
  owner applies them, `version-gate` is a job with the right shape and no requirement behind it.
- **No row is PRODUCT-PROVEN** and none can be until §5 + §6 have actually been performed at a frozen
  SHA.

## 9. Operational finding, round 124 (2026-11-26) — what a frozen-SHA run needs, and the Required-set path

Measured on the first frozen-SHA dispatch, run `45727813248` (`workflow_dispatch`, `head=0d66cf8eb`,
event `workflow_dispatch`, job `candidate-acceptance (VERSION GATE …)`). The head-binding and next-host
halves passed (next host 31/31); **all four legacy drivers refused before the first boot**:

```
HostBaseError: host base guard: sandbox pre-flight refused before the first host start:
host-sandbox-assets: DESTINATION_DIGEST_MISMATCH:
bin/glibc/system.node in …/tests/deepseek-harness-test-use hashes dfa6d5861f51ddb5112a7c92e560752d79c2a89362c0634c8d4f0fc888b21487,
the pinned manifest says 54a9c25c05186c17520f6b7a5ced5f005752c08044c3eb76524cd517287600bc
```

**Cause.** The workflow built the rc.2 host but did not run the native-asset provisioning leg, so the
gate saw the runner's own build bytes. The manifest's `transport` field documents exactly this hazard: a
hosted runner's build produces different `bin/glibc/system.node` bytes; the fixed published asset is the
standard, and the sha256 pin is never moved to match a build.

**Fix (one step, the canonical leg, no new flags).** `.github/workflows/candidate-acceptance.yml` now
runs, after the rc.2 build and before the gate, the SAME command the census lane runs
(`dev/ci/eb3-ci-manifest.json`, `ci-census` leg `host-sandbox assets (pinned published package)`):

```
node scripts/provision-host-assets.mjs --from-package @deepseek-ai/node-addon-system-linux-x64@0.1.2
```

It fetches only the exact pinned tarball, verifies the registry `dist.integrity` (sha512) **and** the
committed tarball sha256 (`77fb771b…cc20`), then verifies every installed file's sha256 + length + mode
before publishing it under the destination `bin/`. A mismatched runner build is replaced by the fixed
published bytes; good pinned bytes are re-verified, never overwritten with different bytes; no local tree
is copied and the pin is unchanged. Local proof at this tree (`HOST-ASSETS-PROVISIONED … files=2
host=639ed01539…` followed by an idempotent re-run whose receipt shows `preExistingSha256 == sha256` for
both files) is in `round124/asset-provision.log`.

**The hosted Required set at the frozen SHA: the exact event/merge-ref truth.** Run `45727883993`
(`ci-required`, event `pull_request`, created `2026-11-26T00:19:14Z` by PR #822's `ready_for_review`
flip) did **not** fail on an event or merge-ref guard. Its layer jobs checked out
`refs/pull/822/merge` (`Uses: …/ci-fast.yml@refs/pull/822/merge`) = `23df45eb`, first parent = master tip
`a19d1df0`, head = `0d66cf8e`; the `EVENT_NAME=pull_request` and two-parent-commit guards all passed. The
text `event ${EVENT_NAME} is not supported` that appears in a raw log is the step's **command echo**, not
a fired error. The reds — identical in the preceding draft run `45727536793` — were four mechanical
infrastructure failures, now fixed (round 124):

| layer | measured red | fix |
| --- | --- | --- |
| `ci-fast` | `EB3-IMPACT REFUSED BASE_UNRESOLVABLE: spawnSync git ENOBUFS` — the branch's `git diff --name-only a19d1df0..HEAD` is **1,105,461 B** (10,254 files), over Node's 1 MiB default buffer | `scripts/eb3-impact.mjs` raises the git buffer to 64 MiB (capacity only; selection logic unchanged) |
| `ci-integration` | `EB3-EVIDENCE-GUARD fail … findings=6` — six preserved round-120 real-model transcripts > 1 MiB | six entries with reasons in `dev/ci/evidence-large-allowlist.json` (the guard's own reviewed mechanism; bound unchanged, census-capture names still refused) |
| `ci-security`, `ci-product` | vitest died at config load: `lstat …/tests/deepseek-harness-test-use ENOENT` — round 118's resolver realpathed the (gitignored) pristine legacy tree eagerly, which a hosted checkout never has | `tests/next-host/host-select.mjs`: a missing legacy tree is "nothing to decline" (legacy resolution is the repo install); a missing **next** tree still refuses; regression test added |

**The supported way to obtain a full Required set (with census), and the SHA it grades.** The census is
skipped while the PR is a draft, so a **draft** run is red by design (the deferred tier). The supported
procedure is to **make the PR ready, or push a `synchronize` commit while it is ready**, so the event's
`refs/pull/N/merge` exists; that run executes all four layers **and** `ci-census`, and `ci-required`
grades them. That run grades the **merge commit** `M = merge(master tip, event head)` — for the measured
run, `M = 23df45eb`, **not** the event head `0d66cf8e`. After restoring the PR to draft, GitHub
re-evaluates and `ci-required` goes red because census is skipped; that is the draft mechanism, not a
candidate red. The **frozen candidate SHA itself** is graded only by this workflow's
`workflow_dispatch -f head=<S>` run, whose `version-gate` job is the separate Required-at-frozen-SHA
context. `ci-required` intentionally has no `workflow_dispatch` trigger: its synthesize job requires the
two-parent merge checkout only GitHub's PR merge ref provides, and no layer guard was weakened to change
that.

