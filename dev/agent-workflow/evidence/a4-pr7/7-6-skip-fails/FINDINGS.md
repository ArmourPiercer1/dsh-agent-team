# A4-PR7 7.6 — the composition gate: a SKIPPED step now fails the run

Lane: 7.6 skip-fails (single writer).
Worktree `.worktrees/a4-skip-fails`, branch `fix/a4-skip-fails-gate`.
Base `a2059c738419430362004a1a6085a010876502a5` (= `origin/master` = `master` at dispatch; the
main checkout moved `bd78be23 → a2059c73` mid-round and `bd78be23` is an ancestor of the base,
so the base contains it).
Head with this record: **the commit that adds this file**; the code+test commit is
**`12a76047`** (`A4-PR7 7.6 [skip-fails]: a SKIPPED step now fails the composition gate`).
Nothing pushed. No host booted. No root `pnpm test`.

---

## 1. Where the task framing was wrong — said here rather than implemented past

**(a) "the residual-disclosure lines … `scripts/composition-smoke-bundle.mjs` around `:372`/`:375`"
— wrong file.** The residual-window disclosure is not in the bundle module. Measured:

```
$ grep -rn "residual" scripts/*.mjs
scripts/composition-smoke.mjs:370:  // That second result is the residual window, recorded here so nobody has to
```

(at base; the sentence before it, `and here is a FAIL. Not closed by this, and not claimable as
closed: …`, is at base `:364`). The block is **`scripts/composition-smoke.mjs:364-371` at base**,
and it is now **`scripts/composition-smoke.mjs:376-383`** — shifted **+12 lines** by the header
repair below, text byte-identical, nothing relocated or rewritten. `scripts/composition-smoke-bundle.mjs`
is **untouched by this change** (`git show --stat 12a76047` lists no such file). Its own
`WHAT IS STILL NOT MECHANICALLY CLOSED` header is the three mutes, which is a different passage.

**(b) "Inject the skip through a `globalThis` read that esbuild cannot constant-fold" — the
mechanism was refused, and the reason is recorded as a test.** A `globalThis` read is not a
test-side trick in this file family: for the gate to observe it, the *gate* has to consult a
global, i.e. a runtime override on a security-adjacent gate. This family already carries that
property as a measured, load-bearing claim —
`scripts/composition-smoke-closure.mjs:729` (base numbering; `:740` after this round's header repair):

> `there is no environment or CLI knob (measured: grep -nE 'process\.env|argv|maxFiles' scripts/composition-smoke.mjs matches nothing)`

and the phase's own doctrine (three mutes, A4-PR6's six `eslint-disable no-explicit-any`) is that
a knob on a gate is the door a mute walks through: an arm-adding knob is one argument away from an
arm-removing knob, and it would be shipped behind a test that proves it works. So the synthetic
skip is injected as a **FILE**: a third-party fixture package inside the fixture repository's own
`node_modules` asking for a package nothing installs, reached by the **real** classifier, the
**real** child-`node` import failure and the **real** `SKIP` line. This is *more* constant-fold
proof than the requested shape, not less: the decision the gate makes is an `existsSync` /
`readFileSync` over a tree written at run time — a read no bundler can see at build time at all —
whereas a `globalThis` read is a constant the bundler could in principle be argued about. The
log rule that motivated the request (`SESSION_ROUTER_LOG.md:5411`: an `if (false) continue`
mutant "is **erased by esbuild**", making "non-constant-foldable the only safe mutation shape") is
honoured; the mechanism named in the brief is not, and this paragraph is the deviation.
Compensating assertions, in the suite:
* the only non-`PASS` step line in the skipping run **is** the `SKIP ` line naming the injected
  package (`@a4p75/no-such-clsx`) and the closure-gated arm by name, and the other step lines are
  all `PASS` — so the red cannot come from anywhere but the injected skip;
* a leg pins the emptiness rather than weakening it: `scripts/composition-smoke.mjs`,
  `-bundle.mjs`, `-targets.mjs` contain no `process.env`, `process.argv` or `globalThis` at all.

**(c) "arm count is 11 (2 plugin + 9 bundle)" is a measurement, and the brief itself forbids
writing it down.** No line of code, test or doc states a count. The count is
`PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length`; both lists are enumerated by name in the new
legs, and the fixture entries are generated from the arm records themselves (path, expected plugin
name, contract, pinned typed code), so an arm added to the gate adds a fixture and a required leg
in the same commit, and an arm renamed or dropped cannot be quietly satisfied by an old fixture.
To make the plugin half derivable at all it had to leave the entry point — importing
`scripts/composition-smoke.mjs` to read its array would *run* the gate — hence the new
side-effect-free module `scripts/composition-smoke-targets.mjs`.

**(d) The exit-code claim was in the operative text, and the brief named one of the two places.**
X11 says an amendment governs nothing until the operative text is repaired. Two sentences
*specified* the old behaviour: `scripts/composition-smoke.mjs` ("Exit code: 0 with no FAIL (a SKIP
is allowed)") **and** `scripts/composition-smoke-closure.mjs:27` ("prints `SKIP` … and exits 0").
Both repaired. A third, `composition-smoke-closure.mjs:143`, reads in present tense
(`the healthy pnpm smoke:composition output … (md5 …: …, exit 0)`) — it is a 7.5 review receipt,
not a contract, so it was qualified in place rather than rewritten (a reader must not "fix" the
verdict back to match it). Every other `exit 0` mention in the family
(`composition-smoke.mjs:366,367,373,381`; `composition-smoke-bundle.mjs:115,158,422`;
`composition-smoke-closure.mjs:143,504`; test `:383,555`) is past-tense measurement and was left
alone deliberately.

**(e) The consequence nobody asked about, stated instead of hidden: the composition gate is now
permanently red in this workspace.** `pnpm run smoke:composition` exits 1 here and will keep
doing so, because the client leg cannot run in this install surface (17 unresolvable upstream
packages; 25 with the hoist fallback removed) and the fix is precisely that an unrun step is not
a pass. That is the honest state, but it has three consequences the coordinator has to rule on,
none of which this lane decided:
  1. any merge/PR gate line that runs `smoke:composition` **in this workspace** now fails,
     including on this branch — so either that leg moves to a tree that supplies the client
     closure (a host install), or the gate splits into the part that can be green here
     (`composition-smoke-bundle.mjs` arms + host plugin arm) and the client-entry leg;
  2. `pnpm run setup && pnpm run smoke:composition` as a "did I break composition?" command is
     now a red command here, which reads as a regression to whoever runs it next;
  3. the 7.5 suite is unaffected and stays green here because it calls `checkCompositionSurface`
     in-process rather than executing the gate — including the leg
     `requires by id every arm this repository actually reports`.
  A green composition gate is reproducible for *testing* (the suite builds one: fixture repo with
  a complete closure ⇒ `PASS composition-smoke`, exit 0) but not for *this repository's own*
  artifact, and no amount of work in this lane changes that.

---

## 2. Base behaviour, verbatim (`raw/00-base-gate.txt`)

Worktree, after `pnpm -r run build` (`raw/build-base.log`, EXIT=0, `git status` clean afterwards):

```
PASS host plugin (packages/runtime): name="dsh-agent-team", apply fails loud on degenerate context (ready code=TEAM_PLUGIN_CONFIG_INVALID)
SKIP client plugin (packages/client): host module closure unavailable — 17 unresolvable: @shikijs/langs, anser, clsx, katex, mdast-util-from-markdown, mdast-util-gfm, mdast-util-math, micromark-core-commonmark, micromark-extension-gfm, micromark-extension-math, micromark-factory-space, micromark-util-character, micromark-util-classify-character, micromark-util-sanitize-uri, micromark-util-symbol, shiki, simple-icons
PASS client bundle composition-output-present (packages/client/composition-shim): packages/client/composition-shim/ carries client-bundle.js, index.js, package.json
PASS client bundle composition-bundle-is-install-surface (packages/client/composition-shim): all 5 path(s) the built shim manifest advertises land inside an install surface check:artifacts compares (packages/runtime/dist, packages/client/composition-shim)
PASS client bundle manifest-targets-resolve (packages/client/composition-shim): every root and shim manifest target resolves on disk
PASS client bundle shim-recorded-values (packages/client/composition-shim): shim manifest records name/version/dsh.client.platform/files as the builder writes them (v0.1.1-alpha.2)
PASS client bundle plugin-row-registrations (packages/client/composition-shim): registers both client row ids: dsh-agent-team, @dsh-agent-team/client
PASS client bundle bundle-module-graph-evaluates (packages/client/composition-shim): module graph evaluated with 4 inert module-table namespace(s) and no browser host
PASS client bundle plugin-row-exports (packages/client/composition-shim): name="dsh-agent-team-client", apply is a function, inject lists 7 seam service(s)
PASS client bundle external-specifier-set (packages/client/composition-shim): requires exactly the host module table: @deepseek-ai/dsh-client-store, @deepseek-ai/dsh-client-ui-primitives, react, react/jsx-runtime
PASS client bundle derived-urls-resolve (packages/client/composition-shim): 3 runtime-derived URL(s) resolve on disk (glue + seam candidates)
PASS composition-smoke — 1 step NOT RUN and NOT passed: client plugin (packages/client). A skipped step is an unverified claim, not a green one.
[exit 0]
```

Eleven step lines (counted off the transcript above, never asserted anywhere as a number), one of
them a SKIP, and `exit 0` beside a footer that says the run did not pass.

## 3. The two mutations, verbatim

**A — the hoist fallback removed** (`raw/02-mutation-hoist-off.txt`;
`mv node_modules/.pnpm/node_modules node_modules/.pnpm/__HOIST_OFF__`, restored after):

```
SKIP client plugin (packages/client): host module closure unavailable — 25 unresolvable: @deepseek-ai/dsh-client-store, @deepseek-ai/dsh-util-code-language, @deepseek-ai/dsh-util-workspace-path, @shikijs/langs, anser, clsx, diff, immer, katex, mdast-util-from-markdown, … react, react-dom, shiki, simple-icons, zustand
PASS composition-smoke — 1 step NOT RUN and NOT passed: client plugin (packages/client). A skipped step is an unverified claim, not a green one.
[exit 0]
```

**B — sixteen upstream packages stubbed so that exactly one (`clsx`) is absent**
(`raw/04-mutation-only-clsx-hidden.txt`; this is the shape the plan's Task 7.5 line describes as
"the missing `clsx` dependency"):

```
SKIP client plugin (packages/client): host module closure unavailable — 1 unresolvable: clsx | 5 UNTRAVERSED — present package, no manifest target this scan could follow: shiki/core (asked for by …/@deepseek-ai/dsh-client-ui-primitives/lib/index.js), shiki/engine/javascript, @shikijs/langs/typescript, @shikijs/langs/shellscript, @shikijs/langs/json
PASS composition-smoke — 1 step NOT RUN and NOT passed: client plugin (packages/client). A skipped step is an unverified claim, not a green one.
[exit 0]
```

`1 unresolvable` — one package out of the whole graph — and still exit 0. The `5 UNTRAVERSED`
clause is an artefact of **my stubs**, not a classifier defect: `make-stub.mjs` gave each stub
`exports: { "./*": "./*.js" }`, and `resolvePackageEntryFile` does not follow `*` patterns, so the
scan could not follow the stubs' subpaths. Disclosed so nobody reads it as a finding about the
real tree. Restored after; `raw/05-after-restore-base-reproduced.txt` is byte-identical to
`raw/00-base-gate.txt` ("RESTORE-VERIFIED").

**Real defects stayed red at base and were restored sha256-identical each time**
(`mutate.sh`, `mut-*.txt`, `snap-*/{before,after}.sha256`), each `FAIL composition-smoke`, exit 1:

| mutation | line |
| --- | --- |
| own bare import in `packages/client/dist/.../client.js` | `FAIL client plugin (packages/client): our own artifact imports specifiers this workspace cannot resolve (@a4-skip-fails/not-installed) — an undeclared dependency in this repo, not the host module closure, so this is never skippable` |
| dangling relative import (`./no-such-chunk.js`) | same message class |
| renamed bundle name | `FAIL client bundle plugin-row-exports (packages/client/composition-shim): name "dsh-agent-team-clientx" != "dsh-agent-team-client"` (SKIP line still printed, footer `FAIL composition-smoke`) |

So: the classifier already refused to launder our own defects. What it did not do was make the
*unrun* step cost the run anything — and that is the whole of this change.

## 4. The change

* `scripts/composition-smoke.mjs` — the verdict tail is now
  `if (failed || skipped.length > 0) { …throw… }`: it prints
  `FAIL composition-smoke — 1 step NOT RUN and NOT passed: … A skipped step is an unverified claim,
  not a green one.` and throws (`composition smoke did not run every step: …`). The footer text is
  the base sentence verbatim, moved from the `PASS` branch; only the verdict word changes. When
  nothing skipped, the footer is exactly `FAIL composition-smoke` as before, and `PASS
  composition-smoke` is printed only when every step passed. The `skip` **classification** is
  untouched: `scripts/composition-smoke-closure.mjs`'s classifier did not change by one character
  of logic (only two header paragraphs — see §1(d)).
  Nit kept on purpose: the inherited footer says `${skipped.length} step` for any count — base text,
  and the brief said the footer is the only thing that ever told the truth here, so it was not
  touched. Worth a separate wording commit if anyone wants `steps`.
* `scripts/composition-smoke-targets.mjs` (new) + `.d.mts` (new, repo convention for `scripts/*.mjs`
  so the test imports typed rather than `any`) — the plugin arm list, side-effect-free.
* `scripts/composition-smoke-closure.mjs` — two header paragraphs (the exit-code contract, and the
  present-tense 7.5 receipt qualified). No code change.
* `packages/testkit/test/a4p75-composition-smoke-classification.test.ts` — `buildSurface` gained an
  optional root (default unchanged), and two new describes at the end: the gate as a whole over
  three fixture repositories, and the same contract asserted against this repository's own run.

The contract, now written where the next integrator reads it (script header, above `Run:`):

```
Exit code: 0 only when every step printed PASS; 1 on any FAIL **or any SKIP**.

THE CONTRACT A CALLER MAY ASSERT … a caller asserts three things about the OUTPUT,
and never a step count —
  1. no line matches `^SKIP ` (a step that did not run is not a pass);
  2. the client leg is present BY NAME — `PASS client plugin (packages/client)` — …
  3. the footer contains no `NOT RUN` clause.
The step count is `PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length` and BOTH sides are derived …
```

and the same three clauses exist as a function in the suite (`notGreenBecause`), driven **both
ways** — green output ⇒ no reasons, skipping output ⇒ all three reasons, failing output ⇒ exactly
the by-name clause — because a contract form nobody has seen fail is a contract form that might be
satisfied by anything.

## 5. Red-first, then green

Red first, with the base verdict restored (`raw/base-composition-smoke.mjs` from
`git show HEAD:scripts/composition-smoke.mjs`, gate output re-captured at
`raw/07-gate-at-base-verdict.txt`: footer `PASS composition-smoke — 1 step NOT RUN …`, `[exit 0]`):

```
$ npx vitest run packages/testkit/test/a4p75-composition-smoke-classification.test.ts   # raw/08
 FAIL … > composition-smoke verdict: an unrun step is not a passing gate > exits non-zero when a step is skipped, and still prints the SKIP line with its reason
AssertionError: expected +0 not to be +0 // Object.is equality
    1349|     expect(skipped.status).not.toBe(0)

 FAIL … > composition-smoke verdict against this repository > never reports a passing gate over a step it did not run
AssertionError: expected +0 not to be +0 // Object.is equality
    1431|     expect(run.status).not.toBe(0)

 Test Files  1 failed (1)
      Tests  2 failed | 51 passed (53)
```

Green after the fix (`raw/11-composition-suites.txt`): `Test Files 7 passed (7) / Tests 141 passed (141)`.
The `:1349` / `:1431` in the red-first frame above are the line numbers as of that run; the file has
grown by the header paragraph and the `closureGatedArm()` helper since, and the assertions are
unchanged.
And the gate itself, after (`raw/10-gate-after-fix.txt`): the **same eleven step lines in the same
order**, the SKIP line byte-identical, footer `FAIL composition-smoke — 1 step NOT RUN and NOT
passed: client plugin (packages/client). A skipped step is an unverified claim, not a green one.`,
**`[exit 1]`** (the eleven lines are the same measurement caveat as above: nothing asserts a count).

## 6. Teeth: assertions deleted one at a time

Four passes, kept as `raw/09-teeth-matrix.txt` (counts), `raw/15-teeth-matrix-with-assertions.txt`
(counts + gate digests), `raw/16-teeth-which-assertion.txt` (**which assertion catches each
phase**), `raw/17-teeth-stdout-clause-isolated.txt` (the clause the cumulative pass never
reached). Scripts: `teeth.py`, `teeth2.py`, `teeth3.py`, `teeth4.py`, `teeth5.py`.

With the **base** gate (`gate=ee315922f47c`, i.e. `git show HEAD:scripts/composition-smoke.mjs`) the
report clauses are layered — deleting one moves the red to the next, so the leg cannot be satisfied
by a partial fix:

| state (base gate) | failing assertion |
| --- | --- |
| control, untouched | `expected +0 not to be +0` at `expect(skipped.status).not.toBe(0)` |
| − `expect(skipped.status).not.toBe(0)` | `expected [] to have a length of 1 but got +0` at `expect(skipped.failures).toHaveLength(1)` — at base the footer sits behind `PASS`, so there is no `FAIL ` line at all |
| − that one too | `expected undefined to be 'FAIL composition-smoke — 1 step NOT R…'` at `expect(skipped.failures[0]).toBe(…)` |
| − that one too | **inconclusive**: my deletion harness corrupted the file (the balanced-statement scan mis-handled the multi-line `toBe(…)`), vitest reported `Tests  no tests`. Re-run isolated in `raw/17`: with all three earlier clauses commented out, the surviving clause fires — `expected 'PASS host plugin (packages/runtime): …' not to contain 'PASS composition-smoke'`, with the whole base output in the diff including `SKIP client plugin (packages/client): host module closure unavailable — 1 unresolvable: @a4p75/no-such-clsx` |

The real-repo leg has a single catcher, and removing it removes the red entirely:

| state | result |
| --- | --- |
| P3 base gate, leg untouched | `1 failed` — `expected +0 not to be +0` at `expect(run.status).not.toBe(0)` |
| P3b base gate, that assertion deleted | **`1 passed`** (`exit=0`) — it was the only thing catching it |
| P3c fixed gate, leg restored | `1 passed` — `gate=706fdf749689` |

*Disclosure:* the first pass (`teeth.py`) mislabelled its P3 rows — a `restore()` call sat between
the base-gate copy and the run, so those two rows measured the fixed gate (both `1 passed`, which
is the only reason the mislabel was visible). `teeth2.py`/`teeth3.py` are the corrected sequences
quoted above; the mislabelled lines stay in `raw/09-teeth-matrix.txt` rather than being edited out.

Gate mutations, so the teeth are not only about the exit code:

| mutation on the fixed gate | failing assertion |
| --- | --- |
| SKIP line renumbered (`SKIP ${label}` → `note ${label}`) — report goes quiet | `expected [] to have a length of 1 but got +0` at `expect(skipped.skips).toHaveLength(1)` |
| footer reworded (`…unverified claim, not a green one.` → `…is not verified.`) | `expected 'FAIL composition-smoke — 1 step NOT R…' to be 'FAIL composition-smoke — 1 step NOT R…'` at the footer clause |
| verdict forced always-red (`… > 0) {` → `… > 0 || true) {`) | `expected 'FAIL composition-smoke' to be 'PASS composition-smoke'` at `expect(green.footer)` — the green leg is not decoration either |
| the bug re-added (`if (failed \|\| skipped.length > 0)` → `if (failed)`) | `expected +0 not to be +0` at `expect(skipped.status).not.toBe(0)` |

After every phase both files were restored by `cp` from the pre-mutation copies and re-compared
(`restored: True True`, `gate=706fdf749689` at the end). No restore in this round ever used
`git checkout --`.

## 7. Gates run, verbatim

| gate | result |
| --- | --- |
| `node scripts/composition-smoke.mjs` before | 11 step lines, SKIP, footer `PASS composition-smoke — …`, `[exit 0]` (`raw/00`) |
| `node scripts/composition-smoke.mjs` after | same 11 step lines, same SKIP line, footer `FAIL composition-smoke — …`, **`[exit 1]`** (`raw/10`) |
| classification suite | `Test Files 1 passed (1) / Tests 53 passed (53)` |
| all 7 suites matching `composition` (`grep -l composition packages/testkit/test/*.test.ts`) | `Test Files 7 passed (7) / Tests 141 passed (141)` (`raw/11`) |
| `pnpm -r run typecheck` | exit 0 (`raw/13`) — first attempt errored `test/a4p75-composition-smoke-classification.test.ts(1327,61): error TS18048: 'CLIENT_ARM' is possibly 'undefined'`, fixed by deriving through a helper that throws instead of relying on module-scope narrowing |
| `npx eslint` on all five touched files | exit 0, no findings (`raw/12`) |
| `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` (run **in the worktree**) | `lint-identities: 160 identity lines, 76 distinct (target .)` / `baseline …: 76 distinct; new 0, resolved 0` |
| `node scripts/check-artifacts-committed.mjs` | `OK: 1508 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))`, exit 0 — no staging needed, nothing in the install surface is rebuilt by this change, so no `content-drift (git add)` |

`pnpm build` / `build:composition` were **not** re-run for this change (nothing in `packages/**`
sources or the composition builder is touched); the worktree's `pnpm -r run build` was run once at
base to make the gate runnable at all (`raw/build-base.log`).

## 8. Environment deviations, with the error text

* `pnpm install --frozen-lockfile --ignore-scripts` in the worktree:
  `[ERR_SQLITE_ERROR] unable to open database file` (the store is read-only here). Per the brief,
  `node_modules` was hardlink-copied from the main checkout with `cp -al` for the root and
  `packages/{client,domain,runtime,testkit,tools}`. **Deleted at the end of the round** — see §9.
* `packages/client/dist/**` is gitignored, so a fresh worktree's gate **fails** with "built entry
  is missing" until `pnpm -r run build`. Recorded because a reviewer who runs the gate in a fresh
  worktree will see exit 1 for a different reason than this change, and the script's own
  precondition line (`after \`pnpm build\``) is what they should read.
* `/tmp` is private per command in this harness: the first build log went to `/tmp/build-base.log`
  and was invisible to every later command; the job was killed and the log rewritten inside the
  repo scratch. All scratch for this round lives in `raw/`.
* `raw/make-stub.mjs` had two bugs worth recording because they nearly produced a false
  measurement: it derived its clean-up list from a fresh scan of `node_modules` (which returns
  nothing once the stubs exist) instead of from `stub-receipt.json`, and its `repoRoot` resolution
  walked one level too far (`findRepoRoot()` now walks to `pnpm-workspace.yaml`). It also refuses
  to overwrite an existing package directory. `mutate.sh` v1 had the same wrong-root bug plus a
  `bash -c "fn_$fn"` indirection that could not see shell functions; both rewritten, bad artifacts
  removed, `sha256sum -c` and `git status` verified afterwards.
* **My own teeth harness clobbered two committed edits, and `git status` caught it before the
  commit did.** `raw/fixed-test.ts.keep` was snapshotted *before* two later edits to the test file
  (this round's file-header paragraph, and the `closureGatedArm()` helper that satisfied
  `TS18048`), so when `teeth3/4/5.py` "restored" it they silently reverted them — 21 lines gone.
  Every suite stayed green, because the reverted content was a comment and a type-level narrowing
  helper rather than behaviour: which is exactly the shape of incident that reads as harmless.
  Detection was `git status --porcelain` showing `M` on a file that should have been clean against
  `HEAD`. It was restored with `git show HEAD:<path> > <path>` (read-into-file, then `cp`, never
  `git checkout --`), verified byte-identical to the HEAD blob (`8fe7b7c21ce8…`), and the keep file
  re-taken from it; the stale copy is kept as `raw/fixed-test.ts.STALE-snapshot-do-not-use`.
  **The teeth results stand**: every phase ran a test file differing from the committed one only by
  that paragraph and that helper, and the gate digest is recorded per phase (`gate=706fdf749689`
  fixed, `ee315922f47c` base). Lesson for the next lane: a restore source has to come from the
  *commit*, not from a working copy, or a mutation harness doubles as a rewind button.
* `raw/18-final-battery.txt` re-runs the battery against the committed tree after that incident:
  gate `exit 1` with the FAIL footer, suite `53 passed`, `eslint` exit 0 on all five touched files,
  `pnpm --filter @dsh-agent-team/testkit run typecheck` exit 0, and the digests
  `composition-smoke.mjs 706fdf749689…`, `composition-smoke-closure.mjs a31deaf89be4…`,
  `composition-smoke-targets.mjs dd55ffd23f71…`, the test `8fe7b7c21ce8…`.
* `raw/NOTE-dropped-byte-copies.txt`: the three `snap-*/before` byte copies were dropped (one was
  1.3 MB of tracked composition bundle); their `before.sha256` / `after.sha256` manifests are kept
  and each original is recoverable with `git show a2059c73:<path>`.

## 9. Housekeeping and ownership

Touched, and nothing else (`git show --stat`): `scripts/composition-smoke.mjs`,
`scripts/composition-smoke-closure.mjs` (header only), `scripts/composition-smoke-targets.mjs` +
`.d.mts` (new), `packages/testkit/test/a4p75-composition-smoke-classification.test.ts`, plus this
evidence directory. Not touched: `scripts/check-artifacts-committed.mjs` (other lane),
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `packages/client/package.json` (third lane),
`scripts/verify-blueprint-version-clean.mjs` and its test (fourth lane), `docs/**`,
`dev/agent-workflow/SESSION_ROUTER_LOG.md`, `master`, `stable`, `:3080` and its DSH_HOME,
`tests/deepseek-harness-test-use`, `references/**`, every other worktree. Nothing pushed.

At the end of the round: the hardlinked `node_modules` copies in this worktree are removed, the
fixture scratch under `packages/testkit/test/.tmp-fault/` is gone (the new describes `rmSync` their
own roots in `beforeAll`/`afterAll`), and `git status --porcelain` in the worktree lists nothing
but this evidence directory.
