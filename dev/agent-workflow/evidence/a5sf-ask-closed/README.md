# A5-DUAL-PLANE-01 — the `ask` lane fails CLOSED at admission (no approval flow invented)

**Status: DONE for the interim state.** An `ask` decision that cannot be consumed now **refuses**; it is never
silently upgraded to `allow`. No approval flow was built: `resolveAskClassCall` stays unwired (BL-30 owns
one-shot consumption, persistent-Bash drain and cancel-vs-terminate).

- Finding: **A5-DUAL-PLANE-01** (the open divergence recorded by BL-33 / P4-05A,
  `dev/agent-workflow/evidence/a5sf-p4-05a/`)
- Branch: `task/a5sf-ask-closed-20261105`; worktree `.worktrees/a5sf-ask-closed`; base `origin/master = 4bedb4350`
- **No Host boot**: zero ports, zero `DSH_HOME`, zero pristine-host tree. Cordis unit roots + the real product
  mount (`a5sfRealmConfigOf` → `mountMemberA5sfRealm` → `installMemberIoProviders` / `installToolBindingRealm`).
- **CORE PATCH BUDGET = 0**: no upstream file, no dependency, no lockfile, no protected glue touch
  (`agent-bindings.mjs` sha256 stays `fd7770c5…`).

---

## 0. The answer that matters

> **Can any input still reach a tool with an `ask` decision that was never consumed?**

**No.** On both execution faces that consume the compiled Alpha.5 lanes — the confined `fs` Provider and the
confined `subprocess` guard — an `ask`-covered locator is refused **before** the base Provider / spawn runs:

- authored `ask` → typed refusal `IO_ASK_REQUIRES_APPROVAL` (checked before any path resolution);
- `ask` reached through a **symlink alias** → the refusal is taken on the **resolved** identity, so an allow-named
  alias onto an asked-for file is refused too;
- an existing write target whose **read** lane is ask-covered → also refused (the read prerequisite refuses, the
  write never happens).

There is **one** residual class, and it is not an unconsumed `ask`: a Member with **no** compiled realm at all
(the unmanaged / no-`a5sfMemberPolicies` path) runs on the base Provider and has **no Alpha.5 lane**, hence no
`ask` decision exists to consume. That is the pre-existing byte-identical legacy path, not a fail-open of this
lane. See §8 for the full enumeration (including the two non-granting subprocess helpers).

## 1. Reachability first — is the lane live in shipped configs?

**No shipped preset / blueprint / policy declares an Alpha.5 `ask` lane, or any Alpha.5 io lane at all.**
Measured (`reachability.log`):

1. `memberIoCeilings` / `toolBindings` / `a5sfMemberPolicies` appear in **zero** tracked YAML/JSON except
   comments and CI manifests. No shipped config declares an `a5sfMemberPolicies` row key.
2. The shipped ops blueprints (`opshome/.dsh/blueprints/{main,anchor}.yaml`) are `schemaVersion: 3` and declare
   only the **legacy Alpha.4 tool-permission plane** (`permissions: {default: ask, ask: []}`); every `ask` list
   there is **empty**. That is a different plane with its own (already existing) approval pipeline — not the
   Alpha.5 io lane this finding concerns.
3. `ask` is declared by the **v4 GRAMMAR** (`BLUEPRINT_V4_AUTHORIZATIONS = ['allow','ask','deny']`) and by the
   lane compiler/intersection, so a future blueprint or row declaration can instantiate it. Non-empty ask lanes
   exist **only in test fixtures** (4 files, §6).
4. `resolveAskClassCall` — the designed consumption seam — still has **no production caller** (`git grep`
   finds only its definition, barrel export and its own spec).

**Consequence:** severity today is **latent, not live**. The fix is defence in depth against (a) the first
shipped declaration that writes a non-empty `ask` list, (b) the projection/assembly path that carries such a
lane to admission, and (c) any row-config `a5sfMemberPolicies` declaration. Had a shipped config declared it,
this would have been a silent auto-approval of an approval-requiring path — the highest-severity shape in this
vertical. It does not today.

## 2. The mechanism (smallest that makes the decision visible)

The defect was not a missing decision: `matchLocator` and the compiler already answer `ask`, and the compiled
lane the guard receives **does carry the ask list**. The guard simply never READ it: `evaluateLocatorAccess`
consulted only `lane.deny` and "inside an allow", and `locatorWithinRuleSet` answers `true` for a locator that an
`ask` also covers. The smallest honest mechanism is therefore **to read the field that was already there**, at
the two places the guard already takes its decision:

| Change | Why it is the minimum |
| --- | --- |
| `laneCoversAsk(lane, locator)` in `member-io-policy/src/path-rules.ts` | the pure sibling of the existing `laneCoversDeny`; no new algebra, same `coversLocator` relation |
| two ask checks in `evaluateLocatorAccess` (**authored**, then **resolved**) | this is the ONE admission chokepoint shared by the fs guard AND the subprocess guard; putting it here is what makes the symlink alias correct (the existing deny check already works this way) |
| `'ask'` as a `PathGuardRefused` decision + `IO_ASK_REQUIRES_APPROVAL` in `PATH_GUARD_REFUSAL_CODES` | `ask` is a decision, not a path error; the refusal is a separate typed fact from "cannot prove admission" |
| `IO_ASK_REQUIRES_APPROVAL` in `TEAM_IO_DENIAL_CODES`; mapped in `fs.ts` and `subprocess.ts` | the per-call typed code the tool layer and the fact carry |
| `guard-observability.ts` maps that code to the `ask` lane | the `a5sf-guard-consult/1` fact must report the lane the guard DECIDED ON (`ask`, not a relabelled `deny`), while the effect still shows a refusal |

Deliberately **not** done: no approval request, no `resolveAskClassCall` wire-up, no new call site, no lane
re-derivation, no second policy compiler, no change to the protected glue. Net product delta: **6 source files**,
two of them a closed-vocabulary addition and its two mappings.

## 3. Does the projection drop the lane anywhere?

**No — measured, not assumed.** This vertical already shipped a projector that FLATTENED a legal lane and
silently dropped it (`projectToolIoRestriction` collapsed `{mode:'all', deny:[…]}` to the identity sentinel —
review B1, fixed in `f84f2e9ff`). The new arm **DP-PROJ** reads the ACTUAL projection the admission plane
consumes:

`a5sfRealmConfigOf` → `createProductRealmProvider` → `compileMemberPolicy` (Member realm) /
`compileEffectiveIo` (binding realm).

For all seven ask-shaped cases it asserts the lane the guard consumes still contains the declared ask locator,
and that the ask sits **inside** an allow subtree (exactly the shape that used to be auto-approved). The chain
retains it end-to-end: v4 authoring map `rw.restricted` maps `ask`; `toPathRuleSet` copies `ask`;
`intersectPathRuleSets` keeps an ask only where the intersection still allows it; `freezeRuleSet` freezes it.
Both the member lane and the **effective intersection** carry it. No branch on this path flattens it.

## 4. RED (what was actually observed)

1. **Baseline reproduction** (unchanged harness at `4bedb4350`): the three DISAGREE cases were
   `{"plane1":"ask","plane2":"allow","plane3":"ask"}`, `outlier=plane2`, `decidedBy=ALLOW`, and the table read
   `allow 17 / deny 20 / ask 0` over 37 cases — the read returned bytes, the write changed the file.
2. **RED of the new arms against the pre-fix behaviour** (the mutation run is byte-for-byte the pre-fix
   admission): `mutation-control.log` → **10 fail / 43 pass** over 53 tests. The failures are exactly:
   the 7 ask-covering cases + `DP1` (aggregate) + `DP-SUM` + `DP-REFUSE`. Everything else stays green:
   allow, deny, the **unrelated ask** rule (a lane-carried ask that does not cover the call), `DP-PROJ`,
   MUT-1…5, B2, FENCE. This is also the **mutation control**.

## 5. GREEN + the three-way counts (exceptions unchanged)

`green-dual-plane.log` — `node --test tests/world-factory/a5sf-dual-plane.test.mjs` → **53 tests, 53 pass**.

```
# BL-33 / P4-05A three-way table (42 cases)
AGREE 37 · EXCEPTION 5 · DISAGREE 0 · total 42
admitted outcome (plane 2): allow 15 · ask 7 · deny 20
EX-1-CEILING-OUTRANKS-TOOL-ADMISSION 3
EX-3-TOOL-ASK-DROPPED-BY-INTERSECTION 1
EX-2-ADMISSION-READ-BEFORE-WRITE 1
overall = ALIGNED_WITH_CITED_EXCEPTIONS
```

**0 DISAGREE**, the **same five exceptions** (same ids, same triples, same counts) and the exceptions were not
re-opened or loosened. The three former DISAGREE cases are now `ask/ask/ask` **AGREE**: plane 2 reports the lane
it decided on (`ask`) while the effect is a refusal — the refusal and the lane are separate channels on purpose.

New shapes added (8 cases → 42 total):
`read-member-subtree-ask-under-allow`, `write-member-subtree-ask-under-allow` (ask in **both** realms),
`write-binding-subtree-allow-symlink-into-ask` (ask via symlink on the **write** axis),
`read-binding-subtree-ask-narrower-subtree` (ask on a **narrower subtree**, target a descendant),
`read-binding-subtree-ask-unrelated-locator` (ask carried by the lane but covering **no part** of the call →
ordinary allow, nothing affected).

Refusal-path facts asserted for **every** ask call (`DP-REFUSE`): exactly **one** guard consultation, `decision:
ask`, `decidedBy: IO_ASK_REQUIRES_APPROVAL`, thrown `error.code` identical to the fact, **zero** base-provider
reads, **zero** writes, bytes on disk unchanged, and a guard fact `sequence: 1` (no approval-request pass is even
attempted). Plus no over-refusal: a plain allow still serves the call, a deny keeps `IO_READ_DENIED`.

## 6. Which existing cases encoded the bug?

**Exactly the three former DISAGREE cases** — `read-binding-subtree-ask-under-allow`,
`read-binding-subtree-allow-symlink-into-ask`, `write-binding-subtree-ask-under-allow`. Each asserted
`plane2: 'allow'` and `verdict: 'DISAGREE'`; they were the measurement of the bug, and their expect triples are
changed with a dated `A5-DUAL-PLANE-01 (2026-11-05)` comment in the case table. Nothing was loosened.

No **currently-passing** case relied on allow-over-ask:

| surviving ask fixture | why it is not allow-over-ask |
| --- | --- |
| `tests/world-factory/a5sf-evidence.test.mjs` A1 | models a **CONSUMED** Alpha.4 approval (approval row + consumption correlation) for its `ask` disposition; it records chain facts and never calls `createMemberFsGuard`. Green unchanged. It is the BL-30 end state, not silent allow. |
| `packages/runtime/test/a5sf-member-policy.test.ts` | compile-level: asserts the compiled lane **retains** `ask`. Unchanged by design. |
| `packages/runtime/test/a5sf-approval-takeover.test.ts` | the unwired consumption seam itself. Unchanged. |
| `packages/domain/test/a5sr2-blueprint-v4-grammar.test.ts` | grammar acceptance of `ask`. Unchanged. |

`node --test tests/world-factory/a5sf-*.test.mjs` → **272 tests, 272 pass** (265 baseline + 7 new ask cases;
the baseline count grows by `42 + 11 − (37 + 9)` = 7 net test entries and no existing case was weakened).

## 7. Gates (verbatim results)

| Gate | Result |
| --- | --- |
| arms RED → GREEN (dual-plane) | RED 10 fail / 43 pass (pre-fix mutation) → GREEN **53 pass / 0 fail** |
| mutation control: remove ONLY the two ask arms | **10 fail / 43 pass**, failures = 7 ask cases + DP1 + DP-SUM + DP-REFUSE; allow/deny/unrelated-ask/DP-PROJ/MUT/B2/FENCE green; file restored byte-identically (`cmp` clean) |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **tests 272 / pass 272 / fail 0** (265 baseline) |
| runtime a5sf + lifecycle + glue + domain ceiling (40 files) | **Test Files 40 passed (40) / Tests 522 passed (522)** |
| `tsc -p packages/runtime/tsconfig.json --noEmit` | rc **0** |
| `pnpm -r typecheck` | rc **0**, 9 workspace projects |
| eslint on touched paths | **0 errors** (2 warnings: `tests/world-factory/**` is ignored by the tracked flat config, exactly as in prior rounds) |
| dist mirror | `pnpm run build` rc 0; **24** changed dist files, exactly the six changed sources; `place-dist-glue` 101 placements byte-identical; `build-client-composition` 96 modules, shim unchanged |
| protected glue | `agent-bindings.mjs` sha256 `fd7770c5…` **unchanged** (src and dist) — no booking needed |
| census booking | **none required**: no new scannable `.ts` test file was added (the new arms live in the existing BL-33 `.mjs` harness) |
| `git diff --check` | rc **0** |

## 8. Full enumeration — can an input still reach a tool with an unconsumed `ask`?

| Surface | reads the ask lane? | On `ask` |
| --- | --- | --- |
| confined `fs` (read/list/stat/watch/readBytes/readText/…) | **yes** (authored + resolved) | throws `IO_ASK_REQUIRES_APPROVAL` before `super.<method>` |
| confined `fs` write/edit | **yes** (write lane, authored + resolved) | throws `IO_ASK_REQUIRES_APPROVAL` before the write |
| write/edit read prerequisite | **yes** (read lane) | refuses (`IO_WRITE_REQUIRES_READ`), write never happens |
| confined `subprocess` guard (`spawn`-class target reads) | **yes** (read lane, authored + resolved) | throws `IO_ASK_REQUIRES_APPROVAL` before any process |
| `programWriteLaneRefusal` (is `argv[0]` caller-writable?) | via the same evaluator | ask ⇒ not caller-writable ⇒ **returns "no attribution refusal"**; this function GRANTS NOTHING — the spawn is separately admitted by the guard above, and an ask write means the caller cannot replace the program's bytes. No unconsumed ask reaches execution here. |
| `ancestorsStayInLane` (rg ancestor discovery) | via the same evaluator | ask ⇒ treated as not-in-lane ⇒ **adds** ignore flags (tightens) |
| `matchLocator` (exported algebra) | n/a | still answers `'ask'`; **no production caller** in `packages/**/src` (only tests) — a future consumer that ignored it would reintroduce this class, which is why the admission chokepoint, not the helper, is the enforced seam |
| a Member with no compiled realm | no lane exists | base Provider; **no ask decision exists** — pre-existing unmanaged path, out of this lane |

Until BL-30 wires real one-shot approval consumption, `ask` **always** refuses. That is the intended interim
state: an author who wants per-call approval gets a typed refusal, never a silent allow.

## 9. Files changed

Product (6): `packages/runtime/member-io-policy/src/path-rules.ts`,
`.../provider-capabilities.ts`, `packages/runtime/team-services/src/{fs,types,guard-observability,subprocess}.ts`
(+ their 24 `packages/runtime/dist` mirror files, byte-identical rebuild).
Harness (2): `tests/world-factory/lib/a5sf-dual-plane.mjs`, `tests/world-factory/a5sf-dual-plane.test.mjs`.
Evidence: this directory. Prior evidence `dev/agent-workflow/evidence/a5sf-p4-05a/README.md` gains a dated
addendum pointing here (its 3 DISAGREE rows are the historical measurement, not current state).

## Run log (append-only)

- `node --test tests/world-factory/a5sf-dual-plane.test.mjs` (baseline tree) → 46 tests / 46 pass; table 37
  cases, 29 AGREE / 5 EXCEPTION / **3 DISAGREE**, `allow 17 / deny 20 / ask 0`, overall = REFUTED.
- `node --test tests/world-factory/a5sf-*.test.mjs` (baseline) → **265 / 265 pass**, 0 fail.
- RED + mutation: `mutation-control.log` → 53 tests, **43 pass / 10 fail**; only the ask arms removed; restore
  verified with `cmp`; green re-run 53/53.
- `node --test tests/world-factory/a5sf-*.test.mjs` (fixed) → **272 / 272 pass**, 0 fail.
- vitest 40-file gate → 40 files / 522 passed.
- `npx tsc -p packages/runtime/tsconfig.json --noEmit` → rc 0.
- `pnpm -r typecheck` → rc 0 (9 projects).
- eslint touched paths → 0 errors, 2 ignored-file warnings.
- `pnpm run build` rc 0; `node scripts/place-dist-glue.mjs` rc 0 (101 byte-identical);
  `node scripts/build-client-composition.mjs …` rc 0; `git status --porcelain` = 32 entries, all expected.
- `git diff --check` → rc 0.
