# Release Notes — v0.1.6 (joint Alpha.5 + Alpha.6 close-out)

**Package version:** `0.1.6` (no `v`; every manifest listed in the pull request body).
**Git tag:** `v0.1.6` (annotated; cut only by the release decision — these notes do not tag).
**Base:** `origin/integration/v0.1.6` @ `f5dcb9952`.
**Distribution:** annotated Git tag + GitHub Release + installable tarball produced by `pnpm pack`. **No npm publish.**
The root package remains `private: true`.

**Phase names are not product versions.** Alpha.5 and Alpha.6 are engineering phase names. Neither appears in
the package version, the tag, or a distribution name. The version line is `0.1.6`.

This release puts two engineering planes into **one artifact**: the governed team runtime measured as the
Alpha.5 Preview, and the approval-routing plane assembled as Alpha.6. The first is stable in the sense
defined in §2; the second is **opt-in experimental** and is off by default.

---

## 1. What ships

**One bundle, both planes.** `pnpm pack` produces one `dsh-agent-team` tarball. The same artifact carries:

- **The governed team runtime (Alpha.5).** An opt-in governed Member preset (`a5sf-governed-member`)
  with a compiled per-Member I/O realm: `read`, `write`, `edit`, `grep`, `glob`, `bash`, `skill`,
  `present`, `web_fetch`, `web_search`, plus `read_image` on a route that declares `image`. The
  realm decides at the admission layer and records a guard fact / typed deny per governed call.
  The same artifact carries the Goal tools (`create_goal`, `get_goal`, `update_goal`) and per-Member
  Stop (durable `pause` + `disarm`), and installs through the ordinary
  `dsh plugin --profile web add <tarball>` / `dsh web` path.
- **The approval-routing plane (Alpha.6).** Blueprint v5 `reviewRouting`, the Officer plane
  (assigned-Officer review), review-wake creation/merge/delivery into the native Inbox, and Sticky
  Stop (a durable human-Stop marker that machine relays cannot clear). This plane is activated only
  by explicit opt-in (§2, §3.3); with the opt-in absent or `false`, the object handed to the control
  service is byte-identical to the Alpha.5 wiring and no Alpha.6 parse, member read or port exists.

The two planes are not separate products and are not shipped as separate tarballs. Alpha.6 does not
become the default by being present in the artifact.

---

## 2. Stability split

**What "stable" means here:** covered by the frozen Alpha.5 Preview contract and the live evidence it
names; we will not change these semantics without a version boundary and an entry in the next release
notes. It is a support statement about this artifact, **not** a claim that the repository's per-tool
acceptance matrix moved: no `V@B` cell is changed by these notes and no `CANDIDATE-C2` claim is made.

### 2.1 Stable

| Surface | What is stable |
| --- | --- |
| **Governed I/O** | On the opt-in governed preset, the governed I/O tools (`read`, `write`, `edit`, `grep`, `glob`, `bash`, `skill`, `present`) are served through the Member's confined faces; out-of-lane access is refused at the admission layer with a typed denial and a guard fact, before a provider call or a process exists. |
| **Goals** | `create_goal` / `get_goal` / `update_goal` work on a governed Member and automatic rounds are driven by the host goal-round driver. Stop withdraws goal continuation (durable `paused`, no new round after the ACK). |
| **Per-Member Stop** | The Member-level Stop control exists and means: after the durable `pause` is ACKed, there is no continuation (no new round, no new model request). See the exact limitation in §4. |
| **Web face** | `web_fetch` and `web_search` are served by the Member's confined web face on the governed preset: allow calls enter the provider and record an allow fact; deny calls are refused on the face before any transport. |
| **`read_image` on an `image` route** | On a model route that declares `image`, `read_image` reads through the governed fs face. On a default `['text']` route it is refused **before** provider I/O (0 facts / 0 bytes), which is the measured stable behaviour. |
| **Ordinary install** | `pnpm pack` → `dsh plugin --profile web add <tarball>` → `dsh web` executes tools with a real model. The measured run covered `web_fetch`, fs write/read, a goal of two rounds and Stop; `n=1` is an existence proof, not a stability claim. The install path does not patch the host (`CORE PATCH BUDGET = 0`). |

### 2.2 Experimental (opt-in; not on the default path)

The whole Alpha.6 plane is **opt-in experimental**. It is not covered by the Alpha.5 Preview contract
and it may refuse to boot rather than degrade silently.

| Surface | Status |
| --- | --- |
| **Approval routing** (`reviewRouting`) | Experimental. Requires a v5 blueprint and the opt-in; absent/false keeps the Alpha.5 path. |
| **Officer plane** (assigned-Officer review, transfer, escalation) | Experimental. Needs exactly one legal Officer template; zero or multiple Officers is a configuration refusal. |
| **Review wake** (merge, single-flight latch, durable intent rows, Inbox delivery) | Experimental. Needs a Host live wake seam plus a native `reviewWakeInbox`; without them the Team refuses to boot. Known defect A6-26 applies (§5). |
| **Sticky Stop** (durable human-Stop marker; machine relays cannot clear it) | Experimental. It is armed only by the Alpha.6 opt-in and its listeners are not registered when the opt-in is absent. |
| **v5 blueprints** (`schemaVersion: 5`, `TeamBlueprintV5Core`) | Experimental. v5 extends v4 and one blueprint still carries the v4 I/O ceilings; v3/v4 documents remain supported and byte-identical. |

**Default-off proof, not a promise:** the Alpha.6 opt-in is the boolean
`config.alpha6ReviewRouting === true`. With it absent or `false`, the code does not invoke the Alpha.6
composition thunk at all. This is the regression boundary the Alpha.6 tests pin.

---

## 3. Deployment preconditions

These are preconditions, not tips. If one is missing, the behaviour is the typed refusal described
below, not a degraded version of the promised behaviour.

### 3.1 `web_search` needs an Exa-compatible endpoint and key

Without an Exa-compatible endpoint and key, every `web_search` call returns the typed
**`WEB_PROVIDER_UNAVAILABLE`** and **zero search requests leave the process** (measured:
`searchServer.connections = 0`, one deny fact). It is not "searched but found nothing" and it does
not silently fall back to the host's base web. The endpoint and key are the deployer's input; the
default install graph contains no Exa provider.

### 3.2 `read_image` needs a route that declares `image`

The model route must declare `image`. On the default `['text']` route the call is refused **before any
provider I/O** (0 facts / 0 bytes), not "read then failed". The stable claim covers both the declared
route path and this refusal; successful image reading on a declared route is not a promise that every
model can see images.

### 3.3 The Alpha.6 plane needs its opt-in wiring

Enabling Alpha.6 is one explicit act with several required parts. All of the following must hold; a
missing part is a boot-time refusal (`TEAM_PLUGIN_CONFIG_INVALID`), never a silent fallback to the
Leader path:

- `alpha6ReviewRouting: true` in the Team plugin config (absent/false = Alpha.5 behaviour);
- a **v5** bound blueprint whose `reviewRouting` is enabled and which has **exactly one legal
  Officer template** (zero or two is refused);
- an **absolute, non-empty durable** `alpha6WakeIntentPath` (one wake-intent row per latch, so two
  reviewers cannot overwrite each other);
- a Host that exposes both the live review-wake delivery seam and `live.reviewWakeInbox`;
- optionally `alpha6WaitTimeoutMs` (finite positive; defaults to 600000 ms); a timeout stops the
  wait, it never decides or consumes.

No `reviewRouting` snapshot or second approval ledger is created by this release.

---

## 4. Known limits carried forward

These are unchanged by 0.1.6. Each one is a limit of the claim, not a to-do that the release silently
closes.

1. **The network axis is one boolean.** It is an admission-layer refusal, **not** OS isolation and
   **not** a per-host policy. A deny means our admission layer refused the call; it does not mean the
   operating system was asked to refuse a connection.
2. **There is no trustworthy global round budget.** `maxGoalRounds` is editable by the Member itself.
   There is no Team-side round budget that overrides it.
3. **Shell command bodies are not attributed by the service axis (BL-17).** The governed service axis
   attributes the invocation; it does not attribute the text inside a shell command body. The command
   body is visible to other processes on the same machine (`/proc/<pid>/cmdline`), as measured.
4. **Stop means "no continuation after the durable `pause` is ACKed", not "no execution after the
   click".** There is a millisecond-scale window between the click and the pause ACK in which a tool
   call may already have started. The number is measured and disclosed, not hidden.
5. **Stopping the Leader's turn does not stop delegated asynchronous work.** Once `team_delegate` is
   accepted, the Member's turn advances in its own session. Stopping the Leader ends the Leader's
   current turn; it does not cascade to the Member. Stop is also not Archive.
6. **This is not a security boundary against a malicious Member.** It is governance with
   attribution, not isolation with non-escape. A malicious Member is the subject of a later phase,
   not a property this release claims.

---

## 5. Known defect A6-26 — read before relying on review wake

**A6-26 (open; affects the experimental Alpha.6 review-wake plane).** An Inbox wake that was
**accepted but not yet claimed** can be **terminally abandoned** across a crash. The measured
consequence is:

- **no duplicate execution** and **no side effect** — the accepted window ends at-most-once;
- the durable control request is marked `control-request-abandoned` with reason
  `invocation-abandoned`;
- the request is **not decidable afterwards**: `team_resolve_control` is refused with the typed
  `CONTROL_REQUEST_ABANDONED` ("can never become an allow");
- the Inbox wake is not redelivered.

The measured run is `dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11/` (check `A6-26` FAIL,
verdict `abandoned-terminal`). A crash **at claim time** recovers: a claimed wake is replaced by
exactly one new wake and its durable request is preserved or decided
(`dev/agent-workflow/evidence/a6-gaps-g2-claimed-r10/`, `A6-25` PASS). The gap is specific to the
**accepted-but-unclaimed** window.

**Recovery is re-issue, not resolve.** Do not retry `team_resolve_control` on the abandoned request.
Re-issuing means a new ask / a new request id, after checking whether the original call could already
have had side effects. The operator procedure, including when re-issuing is **not** safe, is
[RUNBOOK-CONTROL-ABANDONED.md](./RUNBOOK-CONTROL-ABANDONED.md).

This defect is why the release-notes promise for review wake is narrow: an accepted wake may end in a
durable, discoverable, side-effect-free abandonment; it is not a promise that every accepted wake is
eventually delivered or decidable on this base.

---

## 6. Version-line note — the `0.1.1-alpha.2` → `0.1.6` jump

The previous package version was **`0.1.1-alpha.2`**. This release sets **`0.1.6`**.

This is a deliberate version-line jump, not a sequence of five releases:

- **`v0.1.2`, `v0.1.3`, `v0.1.4` and `v0.1.5` were never released, never tagged, and never existed as
  product versions.** Nothing in this repository should be read as implying that they did.
- The jump aligns the package/tag line with the integration line (`integration/v0.1.6`) that carries
  the joint close-out. `0.1.1-alpha.2` remains the name of the earlier Alpha.2 artifact recorded in
  historical documents; it is not this artifact's version.
- Forward policy: release candidates are `v0.1.6-rc.N`; later fixes are `v0.1.7`; larger evolution is
  `v0.2.0`. Alpha.5 / Alpha.6 remain phase names only.

---

## What these notes do not claim

- They do not publish, tag or merge anything. Distribution is the Git tag + GitHub Release +
  installable tarball; **npm is not used**.
- They do not move the repository's acceptance matrix, grant a `V@B`, or create a `CANDIDATE-C2`
  claim. The formal release gate remains where the repository records it.
- They do not upgrade the experimental Alpha.6 plane to stable, and they do not make the Alpha.6
  plane the default.
- They do not promise that an accepted review wake is always delivered or decidable: see A6-26 in §5.

## Evidence pointers

- Preview contract and stability boundary:
  `docs/plans/active/alpha5-sandbox-first/PREVIEW-CONTRACT-2026-11-16.md`
- Preview readiness / live measurements:
  `docs/plans/active/alpha5-sandbox-first/PREVIEW-READINESS-2026-11-15.md`
- Ordinary install and real-model run:
  `dev/agent-workflow/evidence/a5sf-pd37-installed-tools/`
- Alpha.6 close-out measurements:
  `dev/agent-workflow/evidence/a6-gaps-final/`,
  `dev/agent-workflow/evidence/a6-gaps-g2-unclaimed-r11/`,
  `dev/agent-workflow/evidence/a6-gaps-g2-claimed-r10/`
- Alpha.5 Goal authority × Alpha.6 message identity:
  `dev/agent-workflow/evidence/a56-semantics/`
