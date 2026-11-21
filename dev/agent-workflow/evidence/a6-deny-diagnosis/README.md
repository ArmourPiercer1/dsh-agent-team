# A6 deny-arm diagnosis — product regression, instrument precondition, or measurement error?

**Record class: DEV-LIVE.** No `V@B`, no grade, no `CANDIDATE-C2` claim, no re-run of C2. Every number
below is a real Host boot on a pinned tree.

## 0. Answer

**Instrument precondition — not a product regression, and not a silent measurement error.** The
`A6-28`/`A6-29` deny arm needs the kit's **Officer template to declare an ask rule for `bash`** (and the
Officer member envelope to admit `request-control`). In the kit, both are emitted **only** when
`C1_A6_RECIPIENTS=1` (or `C1_A6_HANDOFF=1`) is set, through `A6_EXTRA`
(`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs:330`,
`:817-819`, `:833-843`). The v0.1.6 acceptance deny boots *did* set that flag — that is why they
passed. The C2 adjudication did not, so with `C1_A6_EXEC_NEG=1` alone the Officer's bash is
`default: deny` with `ask: []`, the exec fingerprint is answered deny by the static fallback *before
any approval lane exists*, and `A6-28` can only report `request=none`.

The decisive experiment is a 2×2 that holds the kit constant and varies only the tree and the flag:

| tree | `C1_A6_EXEC_NEG=1` only | `+ C1_A6_RECIPIENTS=1` |
| --- | --- | --- |
| `c66fa8b03` (previously measured good) | **FAIL** A6-28/A6-29 (`runs/prev-r1`) | **PASS** A6-28/A6-29 (`runs/prev-r2-recipients`) |
| `168266dbf` (candidate) | **FAIL** A6-28/A6-29 (`runs/cand-r1`) | **PASS** A6-28/A6-29 (`runs/cand-r2-recipients`) |

Both points behave identically in both cells. **The candidate delta is not the cause**, and #697's
attribution change cannot be: the deny arm's failure reproduces on the very tree where the acceptance
recorded PASS, and the PASS reproduces on both trees once the kit gets the flag it needs.

## 1. Identity (what was measured)

| field | candidate | previously measured good tree |
| --- | --- | --- |
| ref | `refs/heads/candidate/v0.1.6-1` | none (detached) |
| commit | `168266dbfe7f2de091d998431bd56ce4dba0dbb5` | `c66fa8b0377c21f653d3dfd58bea0798cd5d41a5` |
| relationship | — | **not** an ancestor; content comparison |
| worktree | `.worktrees/a6deny-cand` (detached at the commit) | `.worktrees/a6deny-prev` (detached at the commit) |
| product source delta | `packages/runtime/src/plugin/live/agent-bindings.mjs` (+20/−7), `input-provenance.mjs` (+10), `root.ts` (+9, comment) — only the attribution gate is behavioural, and under `alpha6ReviewRouting === true` it is the same expression as the old line | — |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH 0.2.0-rc.2) | same |
| kit | `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs` @ each commit (byte-identical between the two points) | same |
| Authority pointer / candidate ref | **not touched** | not touched |

The kit loads `WORKTREE/packages/runtime/dist/...`; both worktrees' committed `dist` match their `src`
(the candidate `dist` carries the `alpha6ReviewRouting` gate at
`dist/packages/runtime/src/plugin/live/agent-bindings.mjs:5451`; the `c66fa8b03` `dist` carries the
unconditional `fromHumanId` form). So each cell measures its own tree's shipped artifact, not a stale
build.

## 2. Runs (all fresh boots, no `:3080`, no `:3180`)

Every run is one Host boot + one mock model. The runs were issued **sequentially** (never more than
one boot alive at a time), each on its own host/mock port pair; `DSH_HOME` was created under
`<worktree>/tests/homes/` and is torn down with the throwaway worktrees.

| run dir | boot | command (env prefix + kit) | exit | A6-28 | A6-29 |
| --- | --- | --- | --- | --- | --- |
| `runs/cand-r1` | cand, 3183/3483 | `C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1` | 2 | FAIL | FAIL |
| `runs/prev-r1` | prev, 3184/3484 | same | 2 | FAIL | FAIL |
| `runs/acceptworktree-r1` | `.worktrees/v016-accept` (the acceptance worktree itself), 3185/3485 | same | 2 | FAIL | FAIL |
| `runs/prev-r2-recipients` | prev, 3184/3484 | same **+ `C1_A6_RECIPIENTS=1`** | 0 | **PASS** | **PASS** |
| `runs/cand-r2-recipients` | cand, 3183/3483 | same **+ `C1_A6_RECIPIENTS=1`** | 0 | **PASS** | **PASS** |

Exact invocation (see `run-deny-arm.sh`, the script actually used):

```
env C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1 [C1_A6_RECIPIENTS=1] \
  node <WORKTREE>/tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs \
  --host-port <3183|3184|3185> --mock-port <3483|3484|3485> --evidence-dir <repo>/dev/agent-workflow/evidence/a6-deny-diagnosis/runs/<tag>
```

Worktrees: `git worktree add .worktrees/a6deny-prev c66fa8b03 --detach` and
`git worktree add .worktrees/a6deny-cand 168266dbfe7f2de091d998431bd56ce4dba0dbb5 --detach`.
No `pnpm install` was needed — the kit imports only relative modules and the Host runs from the
pinned `tests/deepseek-harness-test-use` checkout; boot reached the row ready in every run.

The third boot (`acceptworktree-r1`) is the control that rules out "the re-runs differ because they
used a fresh worktree": it is the **same worktree, same path, same local `tests/deepseek-harness-test-use`**
that produced the recorded PASS on 2026-11-09 19:01, and it also fails today without the flag.

## 3. Decisive lines

**Without the flag** (candidate, `runs/cand-r1/run.log`; `prev-r1` and `acceptworktree-r1` are
character-for-character equivalent apart from ids/stamps):

```
A6-DENY prompt status=200 body=...{"accepted":true}
FAIL A6-28: a DENIED call is refused after its durable decision: zero consumption, zero side effect,
  and NO execution-result fact — request=none decision=none consumed=false execFacts=0 file=false done=true
FAIL A6-29: ... — request=none consumed=false execFacts=none callId=none done=true
```

`runs/cand-r1/a6-exec-negatives.json` → `"deny": {"request": null, "responses": []}` and
`"throw".memberToolResults[0] = "Error: permission denied: exec fingerprint sha256:c0cbeb3e… answered deny from the fallback"`.

`runs/cand-r1/instance.log` has exactly **one** `a5-admission: event=admission-requires-approval` — the
allow leg's Member call. There is **no** admission event for the Officer's bash call at all: the call
was refused before the governed admission lane, so no control request could exist.

**With `C1_A6_RECIPIENTS=1`** (candidate, `runs/cand-r2-recipients/run.log`; `prev-r2-recipients`
identical in shape):

```
PASS A6-28: ... — request=ctrl-0ahby1g13g62pn0n54edu02u decision=deny consumed=false execFacts=0 file=false done=true
PASS A6-29: ... — request=ctrl-1nbw54d1xzn8za02arryn1wf consumed=true execFacts=failed callId=team-inst-01uk46d0xsmb-bash:hexec:…-2 done=true
PASS A6-7: Officer self-ask is routed to the Leader, not back to the Officer — … leaderDecided=true executed=true
```

and `runs/cand-r2-recipients/instance.log` now has **four** `admission-requires-approval` events
(the allow leg, the deny leg's guard + PA legs, and the throw leg), exactly the count in the recorded
acceptance boot `dev/agent-workflow/evidence/v016-acceptance/a6-deny-r1/instance.log` (4).

## 4. Why the flag is the precondition (instrument locus, not product)

In `tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`, the A6 blueprint's Officer
template is built by `savedBlueprintA6Yaml()`:

- `:814-820` — `permissions: { default: deny, allow: [], ask: [] }` unless `A6_EXTRA`, in which case
  `ask: [{ tool: bash, resource: { kind: any } }]`;
- `:833-843` — the Officer `memberEnvelopes` entry allows only `resolve-control` unless `A6_EXTRA`, in
  which case it also allows `request-control`;
- `:330` — `A6_EXTRA = A6_RECIPIENTS || A6_HANDOFF`.

`A6-28` prompts the **Officer's own session** (`:2122`) and waits for a fresh durable request on the
Officer instance. With `ask: []` + `default: deny`, the Officer's bash has no ask rule; the effective
exec-fingerprint answer is `deny` from the `fallback` source and the guard refuses with the exact string
C2 quoted. Even if the ask had fired, the Officer envelope would have refused `request-control`, so no
durable row could be written. Both halves of the precondition are gated on the *same* flag.

## 5. What the acceptance record actually ran (documentation defect)

`dev/agent-workflow/evidence/v016-acceptance/README.md:45` records the deny arm as
`C1_A6_EXEC_NEG=1 (deny arm)` and lists `A6-7` among its PASS checks. `A6-7` is only executed under
`A6_RECIPIENTS` (`:2246`), and both recorded deny boots contain `a6-self-review.json` /
`a6-self-mock.json`. Therefore the acceptance deny invocation **did** carry `C1_A6_RECIPIENTS=1`;
the flags column is simply incomplete. C2 reproduced the *recorded* invocation, which is not the
invocation that produced the recorded PASS. This is a **record/instrument defect**, not a product
defect and not an unexplained measurement error.

Smallest honest instrument fix (not applied here — this task is diagnosis only):

1. Record the deny arm as `C1_A6_EXEC_NEG=1 C1_A6_RECIPIENTS=1` (or make `A6_EXEC_NEG` imply the
   Officer ask rule at `:817-819` / `:833-843`, since the negative controls *inherently* need an ask).
2. Make the precondition self-diagnosing: if `A6_EXEC_NEG=1` runs without the Officer ask rule, `A6-28`
   should fail with a distinct `PRECONDITION: officer bash ask rule absent` rather than the ambiguous
   `request=none`, which reads like a product regression.

No `packages/**` file needs changing for A6-28/A6-29 to pass; no product fix is implied by this
evidence.

## 6. What this does **not** prove

- It does **not** prove the candidate is good for the deny path in general. It proves that the two
  trees are indistinguishable under this kit, and that the kit passes the deny arm on both once the
  Officer ask rule exists. A different instrument that drives a *real member* ask (not the Officer's own
  session) could still find a deny-path regression in the `#692`–`#706` delta; this experiment does not
  look for one.
- It does **not** clear C2-B as a whole. C2-B's other rows (sticky Stop, the `A6-12` disagreement,
  the `A6-26` abandonment) are outside this diagnosis and are untouched.
- It does **not** re-establish the v0.1.6 acceptance. `A6-28`/`A6-29` on `c66fa8b03` are reproducible
  only with the flag; whether the *acceptance record* should be corrected or re-run is a call for its
  owner (this file only records the discrepancy).
- It does **not** test #697 causally. Because the two points did not differ, the planned local-only
  revert of `agent-bindings.mjs:5451` in a throwaway worktree was **not** run: with
  `alpha6ReviewRouting === true` the new expression reduces to the old one, so that experiment could
  not have separated anything, and running it would have produced a "local experiment" that adds no
  discriminating power. It was not performed and is not cited.
- `A6-28`/`A6-29` still do not measure a *human* attribution. The ask here is on the Officer's own
  session prompted over `/api/session/prompt`; the kit's deny negative is an instrument control, and
  the tool result is never the oracle — the oracle is the durable
  `control-request-recorded`/`control-decision-recorded` pair plus the absent consumption/execution
  facts and the absent effect file.

## 7. Hygiene

- Two temporary worktrees at the two commits, both **detached** (no branch, never pushed, never
  merged); removed with `git worktree remove --force` after the runs.
- `:3080` was only read (pre-probe `401`) and `:3180` was never used; every Host port is 3183–3185 in
  the 3180 family.
- `DSH_HOME` = `<worktree>/tests/homes/c1-smoke-<stamp>`; the homes die with the worktrees.
- No product file, no `.github/workflows/`, no Authority pointer, no candidate ref was modified.
- `runs/*/stdout.log` was dropped where it is byte-identical to `run.log`; every retained file is the
  kit's own durable output.
