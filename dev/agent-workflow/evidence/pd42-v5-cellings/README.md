# PD-42 — v5 blueprints as a `memberIoCeilings` source (`PD42-V5-CEILINGS`)

**Branch:** `task/pd42-v5-cellings-20261111` (worktree `.worktrees/pd42`), base
`origin/master` @ `1dfc6d37c`. **Committed:** `955dc548a` (product fix +
dist + unit tests), `04f6a8ea6` (live same-Team harness, test kit only).
**Class:** repo **live** evidence (nothing was frozen as a candidate; the two
live runs are `CANDIDATE-C2`-style only in discipline — fresh `DSH_HOME`, pinned
host — not in claim).

## Result (read this first)

The **product fix works**: a `schemaVersion: 5` blueprint that carries BOTH
`memberIoCeilings` and `reviewRouting` is now accepted as a Member-ceiling
source by `derivedMembersOf()`, and the same document's A6 review route runs on
a real Host. Unit + real-Host evidence below.

The **same-Team combination is only half-proven on a real Host**:

| proposition | verdict |
| --- | --- |
| one v5 document, both families, admitted by `team.create` | **PASS** (A6-1) |
| Officer wake from a governed Member ask, Officer resolves by `team_resolve_control` | **PASS** (A6-2, A6-3) |
| approved call executed exactly once, one durable `succeeded` execution-result | **PASS** (A6-4, A6-27) |
| the same Member's fs calls governed by the v5 ceiling (allow inside / typed deny outside + guard facts) | **NOT PROVEN on a real Host** (PD42-1..4 fail; cause below) |
| Goal-from-direct-human-input, Sticky Stop, relay `GOAL_TOOL_AUTHORITY_REQUIRED` in the same Team | **NOT RUN** (see "What is not proven") |

**Cause of the ceiling-arm failure, measured, not inferred.** With
`alpha6ReviewRouting` on, the approved call is re-dispatched by the Alpha.5
Team tool **PLANE** (`teamToolPlane`), which owns the model-visible `bash`
binding. The governed realm is mounted (the v5 ceilings compile — a v5 document
without the family is refused at boot, see below), but the plane's binding
displaces the realm's confined terminal on that scope: the approved `bash`
runs through the plane and writes **zero** guard facts to the realm sink. The
realm's other faces are not usable here either: with a declared permissions
policy, `write`/`read` are refused by the closed-world guard with
`the Tool Binding for "write" cannot be verified at dispatch time` (identical
with `a5sfGovernedRealm` and with a derived `a5sfMemberAuthority`, and with
and without the plane). With the plane **absent**, the A6 ask does not reach
the Officer (`wakes=0`) and the approved call is refused the same
`TOOL_BINDING_UNVERIFIED` way, so the realm's `bash` and the A6 execute leg
cannot both be the same binding in this composition.

This is **not** a version-gate problem and **not** a second v4-only site: it is
the A6 tool-plane / Alpha.5 realm ownership of the `bash` name. No product code
was widened to work around it.

## Exact product change (`955dc548a`)

`packages/runtime/team-services/src/product-assembly.ts`, `derivedMembersOf()`:

* new `const MEMBER_IO_CEILINGS_SCHEMA_VERSIONS = Object.freeze([4, 5])`;
* gate (was `if (bound.schemaVersion !== 4)`):
  `if (!MEMBER_IO_CEILINGS_SCHEMA_VERSIONS.includes(bound.schemaVersion)) refuse('MEMBER_POLICY_WITHOUT_BLUEPRINT', ...)`
  — the message now says the document is schemaVersion *N* and that only 4 and
  5 declare the family;
* the family is still read from the same `bound` value
  (`core.memberIoCeilings ?? []`, no re-parse, no default);
* an empty/absent family keeps the typed refusal with **version-specific**
  wording: v5 says "is schemaVersion 5 and declares no `memberIoCeilings`
  family (absent or empty); the v5 face is the v4 face plus the optional
  `reviewRouting` family …" — never "v5 unsupported"; v4 says the v4 document
  declares no family;
* no lane, `ToolRestriction`, Authority reference or realm-plan code changed;
  nothing outside this gate was touched. `CORE PATCH BUDGET = 0`.

No second v4-only site was found: `packages/runtime/member-io-policy/src/compile.ts`
reads `boundBlueprint.blueprint.memberIoCeilings` with no version gate, the v5
validator already hands its core face to the v4 validator, and
`toHashableBlueprintV5()` delegates to `toHashableBlueprintV4()` (family is in
the hash).

Rebuilt committed dist: `packages/runtime/dist/packages/runtime/team-services/src/product-assembly.{js,js.map,d.ts.map}`.
`node scripts/check-artifacts-committed.mjs` → `verdict=ok compared=2082`.

## Unit / host-free proof (committed)

`node --test tests/world-factory/a5sf-governed-preset.test.mjs` → **17/17 pass**
(`G2d`: v5 with both families derives the ceiling, mounts the governed realm,
in-lane read succeeds, out-of-lane read refused `IO_READ_DENIED` with one
ALLOW + one DENY guard fact; `G2e`: v5 without the family refuses with the v5
wording and no "unsupported"; `G2f`: host-free product-assembly declaration
reads the family out of a v5 document).

`node --test tests/world-factory/a5sf-product-assembly.test.mjs` → **15/15 pass**.

## Same-Team real-Host proof (two runs, fresh `DSH_HOME`, agreeing)

Command (per run; host port 3182, mock 3491, `:3080` never touched):

```sh
C1_PD42_CELLINGS=1 C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 node \
  tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --worktree "$PWD" --testuse /home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use \
  --host-port 3182 --mock-port 3491 --evidence-dir <dir> --keep
```

One Team, one saved v5 blueprint (`team.c1-a6-officer`, `contentHash` differs
per run), carrying `memberIoCeilings` for `worker` and `officer` (read/write
restricted to the kit workspace, network allow) **and** `reviewRouting`
(officer, `ordinaryToolApprovals.default: officer`, `whenOfficerUnavailable: hold`).
Pinned host `639ed01539`. Raw evidence:
`.artifacts/tmp/c1pd42-run1/`, `.artifacts/tmp/c1pd42-run2/` (gitignored).

| field | run 1 | run 2 |
| --- | --- | --- |
| v5 `team.create` with both families | PASS (200, contentHash `sha256:…`) | PASS (200, contentHash `sha256:…`) |
| Officer wakes / leader wakes | 3 / 0 | 3 / 0 |
| Officer `team_resolve_control` calls | 1 | 1 |
| durable requests / decisions / consumptions | 2 / 2 / 2 (guard-principal leg + PA leg, each consumed once) | 2 / 2 / 2 |
| approved command executed (file bytes) | `c1-a6-allow-<stamp>` | `c1-a6-allow-<stamp>` |
| PA durable execution-result | `succeeded`, 1 fact | `succeeded`, 1 fact |
| realm guard facts on the approved path | 0 | 0 |
| in-ceiling `write` allowed | **no (TOOL_BINDING_UNVERIFIED)** | **no (TOOL_BINDING_UNVERIFIED)** |
| out-of-ceiling `write` | not reached (no IO_WRITE_DENIED fact) | not reached |
| out-of-ceiling `read` | **no (TOOL_BINDING_UNVERIFIED)** | **no (TOOL_BINDING_UNVERIFIED)** |

The two runs agree on every field.

## Refusal matrix (typed `MEMBER_POLICY_WITHOUT_BLUEPRINT`)

| bound document | result |
| --- | --- |
| v3 (family impossible) | refused; message names `schemaVersion 3` and "only schemaVersion 4 and 5 declare the memberIoCeilings family" |
| v4, family absent/empty | refused; "is schemaVersion 4 and declares no memberIoCeilings family (absent or empty)" |
| v5, family absent/empty | refused; "is schemaVersion 5 and declares no memberIoCeilings family (absent or empty); the v5 face is the v4 face plus the optional `reviewRouting` family …" — no "unsupported" |
| v5, family present | **accepted**; members derived from the same bound, hashed document |
| v4, family present | unchanged (accepted) |

The v5-without-family wording was also observed at boot in the live kit when
the anchor v5 document omitted the family (boot aborts with that exact typed
refusal), which is the real-Host counterpart of unit `G2e`.

## Regression

* `node --test tests/world-factory/a5sf-*.test.mjs` → **642 tests, 616 pass,
  8 fail**. All 8 failures are the pre-existing "provision
  `tests/deepseek-harness-test-use`" environment reds in this worktree (no host
  tree checked out here): `a5sf-pd17-fs-read-axis`, `a5sf-pd19-fact-attribution`,
  `a5sf-tool-axis`, `a5sf-pd30-web-preview` (plus their file-level aborts).
  None touch blueprint/product-assembly code and none changed with this fix.
* `npx vitest run packages/runtime/test/a5sf-member-policy.test.ts packages/runtime/test/a5sf-approval-takeover.test.ts packages/domain/test/a5sf-v4-member-ceiling-projection.test.ts`
  → **61/61 pass** (17 + 23 + 21), the member-io-policy / approval surface.
* `pnpm typecheck` → **exit 0**, all 10 workspace projects `Done`.
* `node scripts/check-artifacts-committed.mjs` → `verdict=ok`.
* `node scripts/verify-blueprint-version-clean.mjs` → unchanged pre-existing
  dirty set; the c1 kit was already an OFFENDING baseline entry (line numbers
  moved only), **no new identity**, so no a4p7 DEFERRALS row and no fence
  baseline re-record.
* Not run in this worktree: `eslint .`, `check:install-manifest` (known
  pre-existing reds, out of scope), and the `a6-*` suites do not exist as a
  separate file family here — Alpha.6 coverage is the c1 A6 checks above plus
  `packages/runtime/test/a6-*`, which are unaffected by a gate that only this
  product-assembly function consults.

## What is NOT proven / not done

1. **The v5 ceiling on a real Host through the realm.** Only host-free `G2d`
   proves the v5-derived realm allow/deny + facts. On the real Host the A6 plane
   owns `bash`, and `write`/`read` are `TOOL_BINDING_UNVERIFIED` for any Member
   with a declared permissions policy, so the ceiling guard fact cannot be
   measured on the same Member turn as the A6 execution.
2. **Goal from direct human input, ≥2 rounds, then Stop with no continuation**
   and **relay refusal (`GOAL_TOOL_AUTHORITY_REQUIRED`)** were not added to the
   kit. The Goal arm needs a Member whose turn starts from a human prompt and
   whose goal tools survive the A2C-2 coverage gate; the existing `a5sf-pd29-*`
   drivers cover Goal/Stop on their own world, not in this Team.
3. **Sticky Stop on the review-wake path** in PD42 mode: the c1 A6-22/23 arms
   were attempted and failed before PD42-specific assertions (`markers=` empty,
   `wakes=1->1`) because the PD42 world's wake/inbox shape differs from the
   smoke world those arms were written against. Baseline (non-PD42) c1 A6
   remains green, so this is a harness-shape gap, not a measured product
   regression.
4. `a5sf-os-runner` P1-07, `u7-f`, `eslint .`, `check:install-manifest` are
   known pre-existing reds and were not fixed.
5. No push/tag/merge was performed beyond the branch commits; push and PR
   creation depend on credentials outside this sandbox.

## Harness disclosure (test kit, not product)

`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` gains a
`C1_PD42_CELLINGS=1` mode only:

* reads the SHIPPED `preset-a5sf-governed-member` row from `cordis.patch.yml`
  (the single `!!js` platform predicate is evaluated in-process);
* drops `tool-web` (this bare `dsh web` profile provides no `web` service, so
  the row never starts and Member activation fails) — an environment
  accommodation, recorded here;
* mounts a MEMBER copy of the preset with `tool-bash` dropped, because the A6
  plane owns `bash` (a second registration is `PLANE_PLACEMENT_CONFLICT`);
* adds the governed preset's out-of-vocabulary faces to `builtinToolDeny` for
  the A2C-2 coverage gate (`create_goal, exit_plan_mode, get_goal, glob, grep,
  job_kill, job_list, job_output, present, skill, update_goal`);
* fixes the non-plane A6 blueprint's `deny` indentation (it emitted invalid
  YAML at `resource:`);
* extends the Member turn with the ceiling arm (`write` inside, `write`
  outside, `read` outside) and writes `pd42-ceiling.json` with the sink facts.

Nothing in the shipped preset, the product row, or any product source is
changed by the kit mode.
