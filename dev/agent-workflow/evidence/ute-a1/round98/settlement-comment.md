**[dated label settlement, 2026-11-24 — the two older owner rulings implemented: realmless Option B + the Shape-B recursive-search negative control, head `954835b717c6768c6208281f80545af445b164c9`]**

Round 98 on `vnext/a1-cut`, final branch head **`954835b71`** (code/artifacts head `a95be5f11`, then
one docs-only commit recording this head in the PR body). Sole writer worktree
`.worktrees/vnext-a1-cut`; no other worktree, no history rewrite, no merge, no port-3080 contact;
PR #822 stays **DRAFT and unmerged**. `docs/reviews/20261124-0151.txt` §4 is the ruling implemented.

## What this round had to do

Implement the two rulings that had been carried as OPEN in `OWNER-DECISIONS.md`:

1. **Realmless admission — RULING option B.** A governed Team Member with NO enforceable confined
   provider must be REFUSED; an UNGOVERNED host run mode may keep DSH's own permission model but must
   be plainly IDENTIFIED as ungoverned and never reported as UTE-protected.
2. **Search face — RULING Shape B is the declared support level, NOT full dynamic permission
   governance.** Overlay deny on ordinary file reads does not automatically deny `grep`/`glob`; the
   Overlay returns `no-opinion` out of vocabulary. Required negative control: allow a parent, DENY a
   child, and prove recursive search does not read/return the protected child's contents — not merely
   check the root path passed to `grep`.

## 1. Realmless admission = OPTION B (implemented, `ADM-44`/`ADM-44b`)

**Code.** `memberAdmissionGate` (`packages/runtime/src/plugin/vnext/centre-config.ts`) returns
`{ mode: 'governed' | 'ungoverned', uteProtected, refusal? }`. It is called in
`agent-bindings.mjs` **after `mountMemberA5sfRealm` and on the MOUNT RESULT**
(`a5sfMountedRealm !== undefined`), before `installMemberExecution`, the preset mount, the deny lane and
every tool body. The report is exposed as `admissionModeOf(sessionId)` and one
`UTE-GOVERNANCE ungoverned` observation.

**The placement hole that was closed.** The old round-35 check ran BEFORE the mount and only asked
whether the row DECLARED a realm source. A row that declared one whose provider compiled no realm for
this template (`compiledFor → undefined`; a v4 template outside `memberIoCeilings`) slipped past it and
ran with no centre. The gate now sees both roads to "no confined provider" as the same refusal.

**Typed code: `MEMBER_CENTRE_UNWIRED` is KEPT** (deliberate, justified in `OWNER-DECISIONS.md`). The
ruling allowed `ADMISSION_PROVIDER_UNCONFINED`; the existing string is the identifier ADM-44/readers
already use and is NOT in the closed `AdmissionRefusalCode`/`HOST_SURFACE_REFUSALS` tables. Renaming
would buy wording, not enforcement; the message states the accurate semantics ("configured for the
centre ... no confined-provider realm ... refused instead of running unmediated").

**Arms (measured, `node --test packages/runtime/test/vnext-admission.test.mjs`: 157 tests, 156 pass,
1 disclosed skip, 0 fail):**

| arm | result |
| --- | --- |
| governed + unmounted | refusal matches `MEMBER_CENTRE_UNWIRED`, `no confined-provider realm`, the member id; `uteProtected=false`; the temp centre state dir stays EMPTY (zero admission facts/settlements); |
| governed + mounted | `{ mode: 'governed', uteProtected: true }`, no refusal |
| ungoverned | no refusal, `{ mode: 'ungoverned', uteProtected: false }` — allowed on DSH's model, never UTE-protected |
| placement pin | source order: gate reads the MOUNT RESULT and precedes the preset/tool surface; the old `mountedRealm: false` pre-check is absent; `installMemberExecution` is syntactically inside the mounted-realm guard |
| label pin | `admissionModeOf: (sessionId) => admissionModes.get(String(sessionId))`, `UTE-GOVERNANCE ungoverned`, `uteProtected=false` are in the bindings source |

## 2. Search face = Shape B declared + the recursive parent-allow/child-deny control (`SLICE-39`)

**Declared support level, stated plainly:** Shape B is what this generation supports and it is **NOT
full dynamic permission governance**. A durable Overlay deny aimed at ordinary file reads does **not**
deny `grep`/`glob`; the Overlay classifies out-of-vocabulary tools as `noOpinion` and `decide()` returns
`'no-opinion'`, so the compiled FS Read Lane alone judges the search. The fact records
`overlayOutcome: 'no-opinion'`. Full cross-tool dynamic revocation is Shape A's scope and is **not
delivered here**.

**The required negative control is GREEN over the REAL search tool paths**
(`@deepseek-ai/dsh-tool-fs-search` + the real confined P1-07 provider), 39/39 in
`packages/runtime/test/vnext-fs-slice.test.mjs`:

| arm | measured bytes |
| --- | --- |
| unit (mechanism) | `compileExecutionProfile(read allow=/parent, deny=/parent/protected)` ⇒ `ok=false`, `code=PATH_NESTED_DENY_UNEXPRESSIBLE` |
| POSITIVE CONTROL | parent allowed, NO child deny, real `grep`: result is not an error, contains `PROTECTED-CHILD-TOKEN-4c1f` and `secret.txt` — the child really is reachable without the deny |
| NEGATIVE | same parent allowed, child DENIED: `grep` result `isError=true`; **no token, not even the child path `secret.txt`**; error matches `ripgrep launch failed`; centre fact count 1, `toolName=grep`, `decision=allow` (the lane allows the ROOT); execution fact `outcome=failed`; protected file still exists byte-unchanged |

**Why this is not root-only checking.** `grep`/`glob` spawn the packaged ripgrep through the Member
realm's confined `subprocess` face; that face compiles the effective lane ONCE with
`compileExecutionProfile`. Landlock is additive (no negative rules), so a deny nested inside an allowed
subtree is `PATH_NESTED_DENY_UNEXPRESSIBLE`; `createConfinedSubprocessClass` remembers the refusal and
every spawn from that realm is refused before a process exists. The dangerous scope is therefore
**FORBIDDEN wholesale, not filtered**, and the control's positive arm proves the negative arm's failure
is the deny, not the environment. The centre still judges the ROOT (Shape B), so the arm cannot pass by
root-checking alone.

**Limit disclosed, not softened:** the provider answer to a nested deny is a wholesale refusal of the
confined process face for that realm (a shell on the same realm is refused too), not per-file carving.
Shape A (a subtree search face in the closed vocabulary) remains the only shape that can express a
nested deny precisely, and it is future work.

## Gate evidence (all at final head `954835b71` unless a line names its own run)

```
DSH-TEST-DISPATCH mode=run leg=ute-vnext-a1 suites=7 files=7 exit=0 set=sha256:edd4f1c494a777b941baa47a286d29455f79eb71d20ae7e48cf46a5580c8a975
  (242 tests, 239 pass, 0 fail, 3 disclosed skips; +ADM-44b, +SLICE-39 over round 97)
DSH-TEST-CATALOG tests=785 digest=sha256:da8a452d65130a3a7f62ef90b549a5289909e689e1ff619c4b3e0c45d5f5ed32 refused=0 findings=0
UTE-CUT-CLOSURE pass deleted=148 references=3 prodRefs=0 distResiduals=0 cut=cut(0/148) dupNames=0 retiredSurfaces=12 placements=self findings=0
UTE-P0-ASSETS pass modules=37 files=180 lines=69512 delete=146 replace=2 keep=32 wave1=146 wave2=0 cut=cut(148/148) findings=0
docs:sync --check: docs=193 notes=4 plans=152(0 declaring) findings=0 blocking=0 contracts=20 pairs compared
place-dist-glue: done (35 placement(s))
EB3-CI-REQUIRED pass workflows=10 findings=0
EB3-LAYER layer=ci-security verdict=PASS suites=14 files=14 describes=62 passed=222 failed=0 clock_ms=20000
EB3-LAYER layer=ci-integration verdict=PASS suites=15 files=15 describes=76 passed=238 failed=0 clock_ms=30000
UTE G1 argv (9 files): tests 89 / pass 89 / fail 0 / skipped 0
DSH-CI-VERDICT pass pass=10 fail=0 skip=0 skipped=none legs=10 refused=0 refusedlegs=none seconds=293.1
```

Full log: `dev/agent-workflow/evidence/ute-a1/round98/ci-pr-gate.log`.

## What is NOT proven (the honest list)

- **No booted AgentSetup arm for the realmless refusal.** The gate is proven in-process (`ADM-44b`) and
  its placement by a source-order pin; no live host boot drives a governed row to that throw.
- **No PRODUCT-PROVEN row.** Both changes are MECHANISM (in-process, pinned host), not a bound
  executable gate.
- **Shape B is not dynamic permission governance.** An Overlay deny on ordinary reads still cannot deny
  `grep`/`glob`; no subtree search face exists. Shape A is future work.
- **The nested-deny answer is wholesale, not per-file.** A parent-allow/child-deny lane refuses the
  realm's confined process face entirely; it does not carve out one subtree for search.
- **No per-tool narrowed search lane was exercised.** A ToolBinding that targets the search module is
  refused at composition (a binding realm owns no confined `subprocess` face), which is why a narrower
  per-tool search lane cannot silently become an enforced-looking traversal; this composition refusal
  was reasoned from the mount rule and is not a new live arm in this round.
- **No real-model, Windows, or cross-platform claim.** Same platform limits as the rest of the
  candidate.

## Settlement

`pr-settlement-gate` (with `GH_TOKEN=$(gh auth token)`), run after this comment was posted:

```
DSH-SETTLEMENT-VERDICT PASS marker=none matches=1 candidates=29
verdict: PASS — valid dated settlement covering the current head sha (§8.5.2)
```
