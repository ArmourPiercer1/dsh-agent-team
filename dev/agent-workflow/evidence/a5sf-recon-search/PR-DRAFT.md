RECON-SEARCH — Alpha.5 Face B (Search / Subprocess): DEV-LIVE recon, no product change

## What this is

A recon/attribution round on the **Search / Subprocess** face of the Alpha.5 five-surface
split. It answers, with a real governed Member and independent OS evidence: **are `grep`/`glob`
today running under the Member's confined subprocess face, and if not, where does the fallback
happen?**

Evidence: `dev/agent-workflow/evidence/a5sf-recon-search/README.md` (seven items × tool,
raw bytes, six-class list, issue classes A–E with file:line).

## Result (one sentence)

`grep`/`glob` are the pinned host `@deepseek-ai/dsh-tool-fs-search` tools running directly on the
Host's base `ctx.subprocess` — `rg` child of the Host node process, same mount/PID namespaces, no
Landlock launcher, **zero `a5sf-guard-consult/1` facts** — so the compiled confined subprocess
face is not on the path; a Member whose compiled read ceiling is one workspace searched `..` and
an absolute out-of-lane directory and received the secret bytes.

The fallback is in the **assembly layer**: the governed preset mounts `tool-fs-search` and
`a5sf-realm-row.mjs` shadows only `bash` (PD-12) and the terminal (PD-13); no search/glob shadow
module exists, so the native tool keeps its inherited base `subprocess` dependency
(`a5sf-realm-row.mjs:956/978/994/1018`; `tool-fs-search/src/index.ts:70`;
`search-core.ts:194,238`; `cordis.patch.yml:193`).

## Measurements

* 2 live DEV-LIVE boots, same governed Member (`inst-06oi8u902ggh`, `worker`), 10 search calls
  each, identical facts.
* Positive path works (in-lane hit, `glob` listing, ignore/hidden = rg semantics).
* Out-of-lane: absolute path **and** `path:'..'` both return the secret needle; `glob` lists the
  out-of-lane file. No typed refusal, no guard fact.
* `rg` sightings: ppid = Host pid for every child; same mnt/pid/net/user/cgroup ns; identical
  `mountinfo` sha; 0 `--confined-exec-stream` launchers; host argv without the lane-safe
  `--no-ignore-parent --no-ignore-vcs`.
* No-match vs error **are** distinguishable (`No matches found` vs `Error: …`), but the typed
  codes (`SEARCH_INVALID_PATTERN`, abort) are **not** on the wire.
* Timeout: `tool call timed out after 1500ms`, process not leaked.
* Lifecycle: `member.archive` 200 `ARCHIVED`; post-archive prompt refused
  (`TeamSessionActivationInterceptedError`) though the transport status is 200.
* ToolBinding: a v4 blueprint `toolBindings` entry is **not derived** into the realm
  (`product-assembly.ts:757-760`; host-free check prints `restrictions: []`) — `NOT_WIRED`.

## Issue classes

A-1 search not routed to confined face; A-2 no execution-face attribution on search results;
B-1 typed codes absent from model-visible text; C-1 v4 `toolBindings` not derived (documented
residual); D-1 search semantics are rg's, not the Member's; E-1 DEV-LIVE slot liveness checked
across PID namespaces (test infra); E-2 post-archive dispatch returns HTTP 200 with `ok:false`.

## Non-claims

DEV-LIVE, `candidateClaimEligibility.eligible=false`; not candidate evidence; parent lane must
re-test. Single composition (shipped governed preset, derived policy path). No matrix / register /
STATUS change. No product source change. No push.

## Test plan

```bash
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --plan --recon-search
node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs --recon-search --boots 1
```
