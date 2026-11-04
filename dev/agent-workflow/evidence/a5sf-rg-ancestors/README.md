# a5sf-rg-ancestors — a lane-scoped search must not depend on outside data

**Status: host-free repair measured (RED → GREEN). The live row is NOT re-judged
here and no row is promoted.** The `grep`/`glob` matrix rows stay
`ENFORCE-PARTIAL`, V@B = no; the live lane still owns the re-judgment.

- Defect source: `a5sf-search-live`, run `2026-11-04T20-17-23-485Z`, case
  `live:search-row1-grep-in-lane-allowed`, verdict **FAIL** /
  `ROW1_CLAUSE_FAILED`, failed clauses `resultNotError`, `matchReturned`,
  `fileNamed`.
- Fix source: `packages/runtime/team-services/src/subprocess.ts`
  (`laneSafeSearchArgv`, `SEARCH_IGNORE_DISCOVERY_FLAGS`,
  `SEARCH_IGNORE_DISCOVERY_NOTES`), plus the optional `annotations` field on
  `a5sf-guard-consult/1` (`guard-observability.ts`, `fs.ts`).
- Date: 2026-11-05. Base: `c63f4d347` (`origin/master`).

---

## 1. The measured defect (the live bytes, kept verbatim)

The Member's declared search root was
`…/.worktrees/a5sf-search-live2/tests/homes/u5a5sfsrch-20261019Z/workspace/lane/inside`
(the live run's real path; abbreviated here as `<root>`). The lane admitted
`<root>` and denied the worktree's `.git`. The confined `grep` ran:

```
<rg> --no-config --json --regexp=A5SF_SEARCH_NEEDLE_<id> -- <root>
```

and the tool result was:

```
Error: grep search failed (exit 2): rg: /home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-search-live2/.git: Permission denied (os error 13)
```

with the exact `confined-exit` record:

```json
{"leg":"confined-exit","code":2,"signal":"",
 "stderr":"rg: /home/…/.worktrees/a5sf-search-live2/.git: Permission denied (os error 13)\n",
 "stderrBytes":115}
```

The match record for the needle was on stdout. The lane's decision was correct:
ONE `allow` fact for `<root>`, zero processes outside it. **The sandbox was
right; the invocation was wrong.** `rg` performs VCS/ancestor ignore discovery
ABOVE the search root, reads the worktree's `.git` **file**, and treats the
kernel's refusal of that read as fatal (`exit 2`). So a confined search inside a
git worktree — the normal case for this product — always failed.

## 2. The boot-free reproduction (RED arm)

`repro.mjs` (this directory) is the smallest host-free composition of that
shape. It builds a temp tree that IS a git worktree on disk — a `.git` **file**
containing `gitdir: …`, the layout `git worktree add` writes, which is what makes
`rg` read a file (a directory is only stat'ed) — gives the confined face a lane
that admits only `…/repo-wt/lane/inside`, and launches the packaged
`@vscode/ripgrep-linux-x64@1.18.0` through the SHIPPED confined `subprocess`
Provider (real Landlock launcher, `content-read=enforced`).

```
$ node dev/agent-workflow/evidence/a5sf-rg-ancestors/repro.mjs red   # pre-fix build
REPRO content-read=enforced rg=…/@vscode/ripgrep-linux-x64@1.18.0/bin/rg world=/tmp/a5sf-rg-anc-… expect=red
PASS A1: {"exit":{"exitCode":2,"signal":null},
          "stderr":"rg: /tmp/a5sf-rg-anc-…/repo-wt/.git: Permission denied (os error 13)\n",
          "argv":[…,"--no-config","--json","--regexp=A5SF_RG_ANC_NEEDLE","--","/tmp/a5sf-rg-anc-…/repo-wt/lane/inside"]}
PASS A1M (flags stripped => RED): {… same exit 2 / same stderr …}
PASS A2 (.git root refused at admission): {… "spawns":0, one deny/IO_READ_DENIED fact …}
PASS A2K (.git still kernel-denied): {"output":"cat: /tmp/…/repo-wt/.git: Permission denied\nRC=1\n"}
PASS A3 (lane-inclusive root keeps .gitignore): {… exit 0, ignored.md absent, no flags …}
PASS A3M (unconditional flags => .gitignore lost, RED for A3): {… ignored.md appears …}

6/6 arms matched the 'red' expectation
```

The RED log is `repro.red.log` (captured on the pre-change build). The GREEN log
is `repro.green.log`. The reproduction is deterministic: no Host, no port, no
DSH_HOME, no boot, no network.

## 3. The fix: the flags, and the condition under which they apply

`laneSafeSearchArgv(argv, readLane)` runs before the provider call (inside the
async admission, after the declared argv passed the allow-list):

1. Only for `rg`; `--no-ignore` already disables all ignore handling (and, measured,
   the `.git` walk), so the shipped **glob** argv is left untouched.
2. For each declared directory root, it walks UP through directories the lane
   ALLOWS (never inspecting an outside path) looking for `.git`:
   - `.git` found and **allowed** → discovery stops inside the lane; keep the
     shipped argv;
   - `.git` found but **denied** (e.g. an explicit `deny`) → not contained;
   - the next ancestor is **outside the lane** → not contained;
   - reached `/` through allowed paths → nothing above to read; contained.
   A FILE operand is skipped (measured: `rg` does no parent discovery for a file).
3. If any root is not contained, add **both** flags after `--no-config` (before
   the first `--`, so the operand list is unchanged):
   `--no-ignore-parent --no-ignore-vcs`.
   Both are needed: `--no-ignore-parent` alone still reads `.git` and still exits
   2; `--no-ignore-vcs` is the one that stops the VCS walk.

**The condition is exactly "the search root's ancestor discovery would leave the
effective read lane".** A lane that includes the worktree root keeps the shipped
argv and ordinary `.gitignore` semantics — there is no global semantic change.

### What the Member's `grep` output now means in a repo checkout

| Lane shape | argv | `.gitignore` / `.git/info/exclude` |
| --- | --- | --- |
| Lane includes the worktree root, or a `.git` inside the lane | unchanged | applied exactly as before |
| Lane admits only the search root (the live row-1 shape) | `+ --no-ignore-parent --no-ignore-vcs` | **NOT applied**: files a `.gitignore` would hide under the search root ARE searched; parent ignore files are not read; `.git` is not read |

The second row is a deliberate, disclosed trade: a usable search with fewer
ignore rules beats a search that cannot run. `.ignore` files under the root still
apply (only VCS/parent discovery is disabled).

### The disclosure (explicit, on the same fact)

Because the fix changes what the Member can rely on, it is recorded in the fact
stream. `a5sf-guard-consult/1` gained one OPTIONAL field, `annotations`, attached
to the SAME allow fact the lane decision produced — no extra fact, no extra
process:

```
annotations: [
  "search-ignore-discovery=disabled: rg ran with --no-ignore-parent --no-ignore-vcs because an ancestor of the search root is outside the effective read lane, so ancestor/VCS ignore discovery would leave the lane and the kernel would deny it",
  "search-ignore-semantics: .gitignore and .git/info/exclude are NOT applied (rg --no-ignore-vcs) and parent ignore files are NOT read (--no-ignore-parent); files they would ignore under this search root ARE searched. .git was not read"
]
```

A fact without annotations is byte-identical to the previous schema (the key is
absent, not `undefined`), so old sinks and the `a5sf-service-install` round-trip
are unchanged.

## 4. Why `.git` confidentiality is unchanged

The lane was NOT widened. `.git` remains outside the lane in the row-1 shape, and
both layers still refuse it:

- **Admission**: an explicit `grep`/`glob` rooted at `<worktree>/.git` is refused
  with one typed `IO_READ_DENIED` deny fact and **zero** provider calls
  (`A2`, suite `(ii)`), exactly as before.
- **Kernel**: the raw provider (admission bypassed) running `cat '<worktree>/.git'`
  under the same profile still gets `Permission denied`, and the file is still on
  the host (`A2K`, suite `(ii-KERNEL)`).

The repair removes a *dependency* on that read; it does not grant it. No
`allowPaths` entry, no profile rule and no runtime allowance changed.

## 5. The five arms (all host-free, real launcher + real packaged rg)

Files: `packages/runtime/test/a5sf-confined-subprocess.test.ts` (provider-level)
and `packages/runtime/test/a5sf-bl16-grep-realm.test.ts` (REAL routed tool through
the realm). The RED capture is `tests.red.log`, produced with the augmentation
disabled by a one-line early return (the PRE-change build is `repro.red.log`);
the mutation controls below are permanent in-suite RED arms.

| # | Arm | GREEN | Mutation control (must be RED) |
| --- | --- | --- | --- |
| i | in-lane search in a git worktree returns the match; exactly ONE allow fact carries the disclosure; ONE process | provider `(i)`, realm `R6` | `(i-MUTATION)` / `R6m`: strip the two flags at the provider boundary → **exit 2, `…/.git: Permission denied (os error 13)`**, and the routed tool returns the exact live error text |
| ii | `.git` cannot be read directly | `(ii)` admission deny + 0 spawns; `(ii-KERNEL)` raw-provider `Permission denied` | the denial is itself the control; no flag can reach it (flags are ignore-only) |
| iii | lane includes the worktree root keeps ordinary `.gitignore` semantics | `(iii)`, realm `R7`: ignored file absent, argv unchanged, no annotation | `(iii-MUTATION)` / `R7m`: force the flags → the ignored file appears → the "ordinary semantics" assertion goes RED |
| iv | invalid pattern still surfaces the real `rg` stderr as a tool error | `(iv)`: exit 2 + `regex parse error`; realm `R4` now asserts the tool text contains `regex parse error` | n/a (regression arm) |
| v | flags add neither a fact nor a process | `(v)`: facts length 1, spawns 1 | the counter is the control |

RED evidence from `tests.red.log` (augmentation disabled):

```
× … > (i) an in-lane search inside a git worktree returns the match; one allow fact carries the disclosure
× … > R6: live row 1 through the REAL grep tool …
   → the routed grep must not fail on a worktree search; tool text:
     Error: grep search failed (exit 2): rg: /tmp/a5sf-bl16-realm/w-…/repo-wt/.git: Permission denied (os error 13)
× … > ADDS --no-ignore-parent/--no-ignore-vcs when an ancestor is outside the lane
× … > an explicit `deny: [<root>/.git]` still forces the flags
× … > admits an in-lane search root and hands it to the confined provider
Tests  5 failed | 40 passed (45)
```

(`R6m`/`R7m` PASS in that run by design: they assert the RED behaviour that the
missing flags produce. GREEN run: 45/45.)

## 6. Alternatives considered and REMOVED

1. **Widen the lane / kernel allowance to include `.git` — REMOVED.** This was
   the tempting one-line "fix". It trades a usability bug for a confidentiality
   hole: `.git` carries the main repo's config, refs, packed objects, reflogs,
   hooks and (for a worktree) a pointer to every other worktree. A Member that
   can `rg` `.git` can exfiltrate repository history and cross-lane worktree
   data. The task's own rule — the sandbox is right — decides this.
2. **Pass the flags unconditionally — REMOVED.** It would disable `.gitignore`
   for every Member search, including lanes that include the worktree root, i.e.
   a silent global semantic change (`A3M`/`R7m` measure the loss). The flags are
   conditional on ancestor containment.
3. **Refuse the shape with a typed error instead — not chosen.** The task's
   preference order puts (a) before (b); the deterministic condition above exists
   and the GREEN arms prove a usable search. Refusing would leave the common
   in-repo search unavailable for no confidentiality gain.
4. **`--no-messages` — not used.** It would hide the stderr line but not the
   exit code (`rg` still exits 2 on the denied `.git`), so the tool would still
   fail; and the search-family row deliberately omits it (§4 fact 4 of
   `evidence/alpha5/srgp/probes/README.md`).
5. **`--no-ignore-global` — not added.** Measured: an unreadable global gitignore
   source is silently skipped by `rg` (rc 0), unlike the `.git` file, so it is
   not part of this defect. Global ignore rules outside the lane are still
   unreadable and therefore not applied; that is a selection consequence of the
   lane, not a new grant.

## 7. Evidence and gates (verbatim, this tree)

```
$ node dev/agent-workflow/evidence/a5sf-rg-ancestors/repro.mjs green
6/6 arms matched the 'green' expectation

$ vitest run packages/runtime/test/a5sf-confined-subprocess.test.ts \
             packages/runtime/test/a5sf-bl16-grep-realm.test.ts \
             packages/runtime/test/a5sf-subprocess-unconfined-realm.test.ts
 ✓ a5sf-subprocess-unconfined-realm.test.ts (4 tests)
 ✓ a5sf-confined-subprocess.test.ts (35 tests)
 ✓ a5sf-bl16-grep-realm.test.ts (10 tests)
 Tests  49 passed (49)

$ vitest run packages/runtime/test/a5sf-member-policy.test.ts \
             packages/runtime/test/a5sf-service-install.test.ts
 ✓ a5sf-service-install.test.ts (16 tests)
 ✓ a5sf-member-policy.test.ts (17 tests)
 Tests  33 passed (33)

$ node --test tests/world-factory/a5sf-*.test.mjs
 ℹ tests 212   ℹ pass 212   ℹ fail 0

$ node_modules/.bin/tsc -p packages/runtime/tsconfig.json --noEmit   → clean
$ pnpm -r run typecheck                                              → every project Done
$ eslint <3 touched src + 2 touched test paths>                      → 0 errors
$ node scripts/place-dist-glue.mjs                                    → done (101 placements)
$ node scripts/build-client-composition.mjs packages/client packages/client/composition-shim
                                                                     → 96 modules, 12 css
$ node scripts/check-artifacts-committed.mjs
  DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1960 glue=101
$ node scripts/check-artifacts-at-head.mjs --store-dir .review-scratch/store-root
  DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=ok compared=1960 drift=0
$ git diff --check origin/master...HEAD                               → rc=0
$ sha256sum packages/runtime/src/plugin/live/agent-bindings.mjs → df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b (unchanged)
```

`check-artifacts-at-head` materialises HEAD in a scratch worktree and installs it;
the default pnpm store is read-only under this harness's file policy, so the run
used a workspace COPY of the store (`.review-scratch/store-root/v11`, `cp -a`,
removed after the gate) through the script's own `--store-dir` flag. A NOT-RUN is
not a pass; this was a real `verdict=ok`.

## 8. What the live lane must do to re-judge row 1 (no new investigation)

The row-1 shape now produces, through the real routed tool:

1. `grep` result `isError=false`, the match text present, the file named.
2. ONE `confined-spawn` record whose argv contains
   `--no-ignore-parent --no-ignore-vcs` immediately after `--no-config`
   (this is the recorded answer to "which invocation ran").
3. ONE `a5sf-guard-consult/1` allow fact for the declared root (unchanged
   `realm=member`, `toolBindingIdentity=null`, `decidedBy=ALLOW`), now carrying
   `annotations` with `search-ignore-discovery=disabled` and
   `search-ignore-semantics: .gitignore … NOT applied`.
4. Zero base-service spawns; the `.git` file is never read.

The judge's existing row-1 clauses (`resultNotError`, `matchReturned`,
`fileNamed`, one allow fact on the declared root) should pass unchanged; the
`allowFact` projection ignores the additive `annotations` field. **Do not**
strengthen row 1 to assert `.gitignore` behavior inside the worktree lane — in
this lane shape it is deliberately off (the alternative is `exit 2`). A live
re-judge still requires a fresh start ruling; this round spent none (no boot).

## 9. Residual risk (tell the owner)

1. **`.gitignore` semantics are off for a worktree search whose lane does not
   include the worktree root** (the common Member lane). Ignored build output /
   vendored trees under the search root become searchable: more matches, slower
   walks, and possible exposure of files the repo owner expected to be ignored
   *within* the lane's own subtree. This is disclosed on the fact, not silent.
2. **The condition is structural, not a `.git` probe above the lane.** Once an
   ancestor leaves the lane the face cannot know whether a VCS root exists above
   it (that would be an outside read), so it assumes one and disables VCS
   discovery. For a non-VCS tree whose roots happen to sit below the lane
   boundary, `.gitignore` is disabled even though `rg` would not have walked
   out. Same disclosure; the alternative is depending on outside metadata.
3. **Global gitignore / core.excludesFile are still read-if-readable and
   silently skipped-if-denied** (measured non-fatal). Selection can therefore
   vary with the host's `HOME` configuration when `HOME` happens to be in the
   lane; in the confined Member lane it is outside and not applied.
4. **A file operand is not walked.** `rg` does no parent discovery for a file
   argument (measured), so no flags are added; if a future `rg` version changes
   that, the file case would fail again. The suite's file-operand arm pins the
   current measurement.
5. **The annotation is evidence transport, not a UI surface.** The Member's tool
   text is produced by the pinned upstream module and does not mention the
   flags; the recorded answer lives in the guard fact and the `confined-spawn`
   argv. Do not claim the agent sees it.
6. Everything already residual in `evidence/a5sf-bl16-grep/README.md` §6.3
   (the `/etc`+`/proc` runtime allowance, in-lane hardlinks, `spec.env`) is
   unchanged by this round.
