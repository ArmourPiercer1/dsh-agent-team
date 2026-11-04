# a5sf PRODUCT ASSEMBLY — the product consumes the confined Member realm (2026-11-05)

<!-- phase-baseline-ref: dev/engineering/current-authority.json -->
<!-- phase-identity: alpha5-sandbox-first -->

**Task**: `task/a5sf-product-assembly-20261105` (branch off `master` @ `b4941a971`).
**Scope**: product-visible assembly only. **No Host boot**, no `:3080`, no new dependency,
**CORE PATCH BUDGET = 0** (`tests/deepseek-harness-test-use` untouched, pristine `639ed01539`),
`packages/runtime/src/plugin/live/agent-bindings.mjs` untouched
(sha256 `df9b46af67cd903641285760cd72a78e57986e87959b2fbdbaf3f86dd6c6464b`, unchanged).

## §0. What this closes, in one paragraph

The external Alpha.5 review's finding was: *the new system is largely built inside the acceptance
profile; the product assembly does not yet consume it.* That was literally true — the confined
Member realm (`installMemberIoProviders` / `mountA5sfRealm` / `installToolBindingRealm`) was
reachable only from evidence rows and test presets, and the production row's only enablement was
`config.a5sfEvidencePath` (an evidence **sink** path) plus a `teamA5sfRealm` service that no product
code provided. The search live round measured the consequence: a World composed from the acceptance
preset alone gave **no agent** a confined search face. This round adds the missing **product-visible
declaration** — `config.a5sfMemberPolicies` — and drives the **same** install/mount seams from it,
with the **same** compiler. It does not add a second evaluator, a forked policy or a new mechanism.

## §1. The config surface (name it, document it, make it product-visible)

| | |
|---|---|
| Key | `a5sfMemberPolicies` (Team row `config:`) |
| Constant | `A5SF_MEMBER_POLICIES_KEY` (`team-services/src/product-assembly.ts`, re-exported by the row) |
| Schema token | `a5sf-product-member-policies/1` (`A5SF_PRODUCT_REALM_SCHEMA`) |
| Shape | `{ schema, teamId, blueprintRevision, authority: { revision, admitted }, members: [{ templateId, instanceGeneration, ceiling, toolRestrictions? }] }` |
| Type surface | `packages/runtime/team-services/src/product-assembly.ts`; documented on `TeamPluginConfig` in `packages/runtime/src/plugin/types.ts` |
| Public export | `packages/runtime/team-services/src/index.ts` (`A5SF_MEMBER_POLICIES_KEY`, `A5SF_PRODUCT_REALM_SCHEMA`, `parseProductRealmDeclaration`, `createProductRealmProvider` + types) |

**Why this is product-visible and not a hidden switch**

1. It is authored by the composition in the **same closed v4 vocabulary already in the product**:
   `ceiling` is exactly v4 `memberIoCeilings[].io`, `toolRestrictions[]` are exactly v4
   `toolBindings[]` entries (`owner`/`name`/`authorization`/`io`/`execution`). There is no new
   dialect to learn and no second grammar.
2. It is **typed on the product config interface** (`TeamPluginConfig.a5sfMemberPolicies`), so a
   composition author sees it in the product surface, and the row reads it via the same
   `a5sfRealmConfigOf` that already reads `a5sfEvidencePath`.
3. It is **enforcement**, not observation: the declaration — not a file path — is what makes the
   realm required. With a declaration present, `a5sfEvidencePath` is demoted to an **optional
   observation sink** (omitted ⇒ `onGuardConsult` is not installed at all, the installer's
   default-preserving path).
4. Enablement law (corrected in `a5sf-realm-row.mjs` and in the `TeamPluginConfig` doc):
   realm mounts **iff** `a5sfEvidencePath` **or** `a5sfMemberPolicies` is present. With neither, the
   row returns `undefined` before touching the provider, the filesystem or the mount seam —
   byte-identical legacy path.

**One authority, referenced not re-decided**: `authority: { revision, admitted }` is the
composition's **reference** to the Alpha.4 effective authority that ControlService already computed.
This lane evaluates no approval, mints no case, and passes `approvedOnce: false` when compiling the
binding lane. A wrong/false reference cannot widen the hard ceiling: the compiler refuses
`AUTHORITY_REFUSED` (`MEMBER_POLICY_UNAVAILABLE`), and call-time admission stays Alpha.4's job.

## §2. The single assembly path (no fork)

```
config.a5sfMemberPolicies
  → a5sfRealmConfigOf          (row; parses via parseProductRealmDeclaration — typed refusals at assembly)
  → mountMemberA5sfRealm       (row; builds createProductRealmProvider(plan) — ONE provider source)
  → mountA5sfRealm             (team-services; unchanged)
  → installMemberIoProviders   (ceiling realm, unchanged)
  → installToolBindingRealm    (binding realm, unchanged)
```

Compilation inside `createProductRealmProvider(plan).compiledFor(member)`:

- `compileMemberPolicy({trustedMember, boundBlueprint, effectiveAuthority})` — the **one** ceiling compiler;
- `projectToolIoRestriction(v4Binding)` — the **one** right-factor projector;
- `compileEffectiveIo(policy, restriction, invocation)` — the **one** intersection compiler
  (`EffectiveIo ⊆ MemberCeiling ∩ ToolRestriction` on read/write/network).

The declaration is validated by expanding it into a minimal **valid v4 blueprint document** (one
reserved scaffold leader + one template per declared Member + the declared `memberIoCeilings` **and
the declared `toolBindings`**) and handing it to the shipped **`parseBlueprintV4`**. So lane/grammar
defects are found by the shipped v4 validator, at its own path, and the resulting `contentHash` is
the real content identity of exactly the declared ceilings **and bindings**. The reserved scaffold
template id (`a5sf-product-scaffold-leader`) may never name a managed Member (typed refusal).

The binding family used to be OUTSIDE that document (it was projected directly by
`projectToolIoRestriction` before the parse). The review-fix round (§10, B4/B8) moved it IN: a bogus
`authorization`/`implementationOrigin` or a malformed locator list is now refused by the same shipped
tables, and editing a restriction changes the `contentHash` — hence the Member policy `revision`.

Two provider sources are refused: a config carrying **both** `a5sfMemberPolicies` and a live
`teamA5sfRealm` service would give one Member two compiled-realm authorities, so
`mountMemberA5sfRealm` throws `TypeError` (`two compiled-realm sources`).

## §3. Unmanaged Members are byte-identical (the discriminating pair, measured)

Arm **PA2** (`tests/world-factory/a5sf-product-assembly.test.mjs`) mounts on **one** root with
**one** config declaring only template `worker`, plus an evidence sink so both halves are
observable:

| | declared template `worker` | undeclared template `bystander` |
|---|---|---|
| `compiledFor` | compiled plan | **`undefined`** |
| realm mounted | yes (ceiling + binding realm) | **no** (`mountMemberA5sfRealm` → `undefined`) |
| read outside the declared restriction | **`IO_READ_DENIED`**, 0 provider reads | **served by the base provider** (`C\n`) — the pre-existing surface |
| guard-consult facts added | allow + deny facts | **none** (fact count unchanged) |

That is the discriminator: the exact call the managed Member is refused is *served* for the
unmanaged one, on the same root, with the same config. Unmanaged Members keep the legacy provider,
with no mount, no observer and no fact of their own.

## §4. What refuses, with which typed code (fail closed, before any tool exists)

All refusals use the existing `TeamServiceInstallError` idiom and the **closed** install vocabulary
(`TEAM_SERVICE_INSTALL_CODES`); callers compare tokens, never message text.

| Declared thing | Code | When | Why not faked |
|---|---|---|---|
| ToolBinding with `execution.executionBoundary: confined-subprocess` | `SUBPROCESS_UNCONFINED_REALM` (BL-17's code, reused verbatim) | **row assembly** (`a5sfRealmConfigOf`) | A tool-binding realm owns a confined `fs` and **no** confined `subprocess` face; the search live round measured this as `UNSUPPORTED`. |
| `executionBoundary: delegated-remote` | `NETWORK_UNCONFINED_REALM` (new) | row assembly | The realm owns no remote/web face; a local claim would be a lie. |
| `ceiling.network` narrowing (`mode` ≠ `allow`) | `NETWORK_UNCONFINED_REALM` (new) | row assembly | No web face is installed, so a network narrowing could not be enforced. Refused early so the answer is specific, not a generic projection failure. |
| ToolBinding `io.network` narrowing | `NETWORK_UNCONFINED_REALM` (new) | row assembly | Same reason; checked on the projected restriction. |
| Malformed/ambiguous declaration: unknown or missing field, wrong schema, blank ids, empty members, duplicate template, reserved scaffold id, duplicate binding, a ceiling OR a `toolRestrictions` entry the shipped v4 validator refuses | `REALM_DECLARATION_INVALID` (new) | row assembly | A declaration that cannot be read must never be treated as "no declaration" (that would silently unmanage the Member). Since §10/B4 the restriction family rides the shipped `toolBindings` grammar, so this row covers both families. |
| `toolRestrictions[].authorization` outside `allow/ask/deny`, or `authorization: "deny"` | `REALM_DECLARATION_INVALID` | row assembly | §10/B3: the enum is checked against `BLUEPRINT_V4_AUTHORIZATIONS`; a `deny` binding is REFUSED rather than mounted as decoration (dropping it would leave the tool on the wider base/ceiling surface). Call-time allow/ask stays Alpha.4's. |
| A declared ceiling that exceeds the row's OWN bound blueprint (`config.blueprintSource`, same team) on read/write/network, or names a template the blueprint declares no ceiling for | `REALM_DECLARATION_EXCEEDS_BLUEPRINT` (new, §10/B2) | row assembly | A row-config edit must never widen a ceiling without a new blueprint/authority revision. A blueprint for a DIFFERENT team is not this Team's authority and is not reconciled; an absent source skips the guard (both forms keep working). |
| Compiler/projector refusal of a declared lane (e.g. `authority.admitted: false` → `AUTHORITY_REFUSED`, `network: restricted` → `IO_POLICY_UNSUPPORTED`) | `MEMBER_POLICY_UNAVAILABLE` with the compiler's own code in the detail | `compiledFor` (per Member, before the realm mounts) | The one compiler's refusal is surfaced, never overridden. |
| Member descriptor without `instanceId`/`templateId` | `MEMBER_IDENTITY_INVALID` | `compiledFor` | A template ceiling cannot bind an unknown identity, and cannot be guessed. |

**Zero tool calls on refusal (measured)**: PA4 asserts each refusal happens at `a5sfRealmConfigOf`
(so no mount is attempted), `providerReads === 0`, and the root still serves the bare base provider
(`root.get('fs') instanceof TestFileSystem`).

## §5. Evidence arms

Suite: `tests/world-factory/a5sf-product-assembly.test.mjs` — **host-free** (in-process Cordis unit
root + `mkdtemp` fixtures), no boot, no port, no DSH_HOME.

| Arm | Proves |
|---|---|
| PA1 | The declaration alone (no evidence path, provider accessor answering `undefined`) mounts the ceiling + binding realm through `mountMemberA5sfRealm`; in-lane reads succeed on both realms; no sink file is written. |
| PA2 | The discriminating pair of §3 (managed confined vs unmanaged base-served, no new facts). |
| PA3 | Intersection binds **both ways**: ceiling-wide/restriction-narrow → the restriction refuses a ceiling-allowed path; ceiling-narrow/restriction-wide → the ceiling refuses a restriction-allowed path. Both refusals reach no provider. The published `effective` lane is the intersection. |
| PA4 | Typed refusals at row assembly for subprocess face / remote boundary / network narrowing / malformed declarations; zero provider calls; nothing mounted. |
| PA5 | **Regression arm**: the evidence-era shape (`a5sfEvidencePath` + a `teamA5sfRealm` provider) is byte-identical (`deepEqual { evidencePath }`), still mounts, still writes `a5sf-guard-consult/1` facts (`realm: 'member'`). |
| PA6 | Two provider sources (declaration + service) refuse instead of picking one. |
| PA7 | The declaration compiles through the one compiler; unmanaged template → `undefined`; missing `templateId` → `MEMBER_IDENTITY_INVALID`; `admitted: false` → `MEMBER_POLICY_UNAVAILABLE` naming `AUTHORITY_REFUSED`. |
| PA8 (§10/B1) | A legal v4 `mode: all` + `deny` restriction KEEPS its deny: the plan carries it, the sibling read is still served, the denied subtree is refused at the binding realm with `IO_READ_DENIED` and **zero provider reads**, and the file exists (the refusal is the lane, not a missing file). |
| PA9 (§10/B2) | Reconciliation with `config.blueprintSource`: a narrowing declaration mounts and reads; a widening read ceiling, an `all` ceiling over a restricted blueprint, and a template the blueprint declares no ceiling for each refuse `REALM_DECLARATION_EXCEEDS_BLUEPRINT` at row assembly with **zero provider calls**; an unparseable source refuses `REALM_DECLARATION_INVALID`; another team's blueprint and an absent source are not reconciled (both forms keep working). |
| PA10 (§10/B3+B4) | `authorization: "deny"` and an out-of-enum authorization refuse `REALM_DECLARATION_INVALID`; a bogus `implementationOrigin` and a scalar-shaped `allow` are refused by the SHIPPED v4 validator (the scalar shape used to become deny-all silently); an object-shaped `allow` is refused at projection (`MEMBER_POLICY_UNAVAILABLE`) — measured, not assumed. |
| PA11 (§10/B8) | Two declarations with identical ceilings and different restrictions have different blueprint `contentHash`es, different `MemberPolicy.revision`s, and the binding's `effective.policyRevision` equals the Member revision — the bindings are inside the content identity. |

**RED before GREEN (honest)**: with the pre-change tracked sources restored by `git stash` (new
module + new suite still on disk), the suite reads **7 tests / 2 pass / 5 fail** — every product-path
arm (PA1, PA2, PA3, PA4, PA6) fails; only the evidence regression (PA5) and the module-only arm
(PA7) pass. Log: `gates/red-product-assembly.log`. Implementation then turns it **7/7**
(`gates/green-product-assembly.log`).

**Review-fix round RED (honest, 2026-11-05)**: with the FIX-ROUND sources stashed (the new arms on
disk), the same command reads **11 tests / 7 pass / 4 fail** — PA8, PA9, PA10, PA11 fail and PA1–PA7
stay green (the fix touches neither the assembly path nor the evidence regression). PA8's failure is
the reviewer's mechanism verbatim: `Missing expected rejection` — the denied file was **served**.
The projector arm separately reads `expected 'no-additional-narrowing' to deeply equal
{mode:'all', …, deny:['/work/a/secret']}`. Logs: `gates/red-fix-round-product.log`,
`gates/red-b1-projector.log`. After the fix: `11/11` and `17/17` (§6, §10).

## §6. Gates (verbatim)

| Gate | Result | Log |
|---|---|---|
| New suite RED (pre-change row) | `tests 7 / pass 2 / fail 5` | `gates/red-product-assembly.log` |
| New suite GREEN | `tests 7 / pass 7 / fail 0` | `gates/green-product-assembly.log` |
| `node --test tests/world-factory/a5sf-*.test.mjs` | `tests 208 / pass 208 / fail 0` (baseline 201 + 7) | `gates/world-factory-a5sf.log` |
| Runtime a5sf suites (`a5sf-member-policy`, `a5sf-service-install`, `a5sf-provider-composition`, `a5sf-bl16-grep-realm`, `a5sf-subprocess-unconfined-realm`) | `Test Files 5 passed / Tests 51 passed` | (session log) |
| `tsc -p packages/runtime/tsconfig.json --noEmit` | rc=0 | (session log) |
| `pnpm -r run typecheck` | all packages `Done`, `0` × `error TS` | `gates/typecheck-recursive.log` |
| `packages/testkit/test/p4t6-session-event-scan.test.ts` | `Test Files 1 passed / Tests 20 passed`; census **1432 → 1433** via booking `p4t6-bookings/a5sfprodasm.json` | `gates/p4t6-census.log` |
| `pnpm run build` + `place-dist-glue` + `build-client-composition` | rc=0 (`101 placement(s)`; client `96 modules`, bundle 1 308 108 B) | `gates/build-dist.log` |
| `node scripts/check-artifacts-committed.mjs` | rc=0 — `verdict=ok compared=1960 glue=101` | `gates/artifacts-committed.log` |
| `node scripts/check-artifacts-at-head.mjs` | rc=0 — `rev=HEAD verdict=ok compared=1960 drift=0` (HEAD carries its own build) | `gates/artifacts-at-head.log` |
| `git diff --check origin/master...HEAD` | rc=0 | `gates/diff-check.log` (and the final battery) |
| `sha256sum packages/runtime/src/plugin/live/agent-bindings.mjs` | `df9b46af…6464b` (unchanged) | `gates/protected-glue-sha256.log` |

### §6.2 Review-fix round (2026-11-05) — the same gates, re-run

| Gate | Result | Log |
|---|---|---|
| Product suite RED (fix-round sources stashed) | `tests 11 / pass 7 / fail 4` (PA8–PA11 fail) | `gates/red-fix-round-product.log` |
| Projector arm RED (pre-fix `compile.ts`) | `Tests 1 failed / 16 passed` — `expected 'no-additional-narrowing' …` | `gates/red-b1-projector.log` |
| Product suite GREEN | `tests 11 / pass 11 / fail 0` | `gates/green-fix-round-product.log` |
| `a5sf-member-policy.test.ts` GREEN | `Tests 17 passed (17)` | `gates/green-b1-projector.log` |
| `node --test tests/world-factory/a5sf-*.test.mjs` | `tests 212 / pass 212 / fail 0` (baseline 208 + 4) | `gates/fix-round-world-factory-a5sf.log` |
| Runtime a5sf suites (`a5sf-member-policy`, `a5sf-service-install`, `a5sf-provider-composition`, `a5sf-bl16-grep-realm`, `a5sf-subprocess-unconfined-realm`) | `Test Files 5 passed / Tests 52 passed` (was 51) | `gates/fix-round-runtime-a5sf-suites.log` |
| `tsc -p packages/runtime/tsconfig.json --noEmit` + `pnpm -r run typecheck` | rc=0; all packages `Done`; `0` × `error TS` | `gates/fix-round-tsc-runtime.log`, `gates/fix-round-typecheck-recursive.log` |
| census (`p4t6-session-event-scan`) | `Test Files 1 passed / Tests 20 passed`; count unchanged at **1433** (no new scannable `.ts`; the existing booking still covers the edited files) | `gates/fix-round-p4t6-census.log` |
| CI shape (`node scripts/eb3-ci-required.mjs`) | `EB3-CI-REQUIRED pass workflows=9 findings=0` | `gates/fix-round-ci-required.log` |
| eslint on touched paths | rc=0 on every touched TS path EXCEPT `host.ts`; `host.ts` carries 2 findings that are **PRE-EXISTING at HEAD** (`'TemplatePermissionPolicy' is defined but never used` at :112, empty block at :3311/3314) — proven by linting `git show HEAD:…/host.ts` via stdin, same 2 findings; this round's only `host.ts` hunk is a comment and adds none. The `.mjs` test file is eslint-ignored (warning only) | `gates/fix-round-eslint.log`, `gates/fix-round-eslint-baseline-host.log` |
| `pnpm run build` + `place-dist-glue` + `build-client-composition` | rc=0; `101 placement(s)`; client bundle 1 308 108 B (unchanged — no client code touched) | `gates/fix-round-build-dist.log` |
| both artifact gates (committed tree) | `committed: verdict=ok compared=1960 glue=101`; `at-head: verdict=ok rev=HEAD compared=1960 drift=0` | `gates/fix-round-artifacts.log`, `gates/fix-round-artifacts-at-head.log`, `gates/fix-round-final-verification.log` |
| `git diff --check origin/master...HEAD` | rc=0 | `gates/fix-round-final-verification.log` |
| protected glue hash | `df9b46af…6464b` (unchanged) | `gates/fix-round-final-verification.log` |

### §6.1 Artifact gates — the command that is actually run

Both artifact gates compare the committed index/HEAD against a fresh build, so they are only
meaningful **after** the artifacts are committed in the same commit. They were run after the commit;
the logs in `gates/` are the committed-tree measurement. `gates/FINAL-VERIFICATION.log` records one
final battery at the committed tree (tsc, both node suites, the census, the runtime a5sf suites, both
artifact gates, the whitespace gate and the protected-glue hash) with a `rc=` line after each
command. Re-running the head gate on the final amend reproduced the same verdict and the same
`compared=1960 drift=0`, because the amend touched only evidence logs — which are outside both
install surfaces.

## §7. Proven host-free vs. needs a live Host vs. deliberately not reachable

**Proven host-free (this round)**: the product declaration is a real assembly input; a declared
Member gets the compiled ceiling + binding realms through the one seam; an undeclared Member is
byte-identical; the two-axis intersection binds in both directions; the faces the realm does not own
refuse with typed codes before any tool/mount; the evidence path still works unchanged; two provider
sources refuse.

**Needs a live Host (NOT proven here — boot budget is still 0)**:

1. That a real Host's composition **declares** `a5sfMemberPolicies` and that the resulting Member's
   model-visible tool surface is the confined one (the `member-install → delegate-dispatch →
   confined consult` chain, `evidence/a5sf-search-live/README.md` §10, was never reached and is
   still unreached).
2. The Alpha.4 authority **reference** (`revision`/`admitted`) being fed from the live
   authority/ControlService rather than a composition constant — the seam consumes it verbatim;
   wiring the live bridge is out of this lane.
3. `grep`/`glob` native shadow behaviour end-to-end on a live agent (BL-16's rows remain the only
   search evidence; they are not product-preset evidence).

**Deliberately NOT reachable from product config (refused, not faked)**:

1. **Confined `subprocess`/search face.** It needs a composition-built P1-07
   `ConfinedProcessProvider` + launcher pin. A config string cannot name a launcher/binary assembly,
   so the declaration cannot request a process face; `executionBoundary: confined-subprocess` is
   refused (`SUBPROCESS_UNCONFINED_REALM`). This is *why* the preset-only World still has no
   confined `grep`/`glob` — the matrix rows are NOT upgraded by this round.
2. **Network narrowing.** The realm installs no web face; any `network ≠ allow` refuses
   (`NETWORK_UNCONFINED_REALM`).
3. **Binding-scoped process restriction.** `installToolBindingRealm` still mounts `fs` only and
   reports `faces.subprocess = null`; a binding-mounted subprocess consumer is refused by BL-17's
   existing law.

**No shipped composition/preset in this repository declares `a5sfMemberPolicies`.** The product
*seam* now exists and is exercised; shipping a preset that uses it is a composition decision that
requires the two residuals above (process face) to be answered first.

## §8. Files touched

- **New**: `packages/runtime/team-services/src/product-assembly.ts` (declaration + parser + provider),
  `tests/world-factory/a5sf-product-assembly.test.mjs`, `packages/testkit/test/p4t6-bookings/a5sfprodasm.json`,
  this README + `gates/`.
- **Edited** (round 1): `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (enablement law, product
  provider, optional sink), `packages/runtime/team-services/src/types.ts` (2 closed codes),
  `packages/runtime/team-services/src/index.ts` (exports), `packages/runtime/src/plugin/types.ts`
  (`TeamPluginConfig` doc + type), `packages/runtime/tsconfig.build.json` (emit),
  `docs/plans/active/alpha5-sandbox-first/{ALPHA5-SANDBOX-BACKLOG,TOOL-ACCEPTANCE-MATRIX}.md`,
  regenerated `packages/runtime/dist/**`.
- **Edited** (review-fix round, §10): `packages/runtime/member-io-policy/src/compile.ts` (B1 projector;
  the all-lane sentinel now needs an empty deny), `packages/runtime/member-io-policy/src/path-rules.ts`
  (`toPathRuleSet` normalizer + `laneWithinLane` predicate), `packages/runtime/member-io-policy/src/index.ts`
  (exports), `packages/runtime/team-services/src/product-assembly.ts` (B2 reconciliation, B3/B4
  validation, B5 comments, B8 bindings in the content hash), `packages/runtime/team-services/src/types.ts`
  (`REALM_DECLARATION_EXCEEDS_BLUEPRINT`), `packages/runtime/src/plugin/live/a5sf-realm-row.mjs`
  (forward `config.blueprintSource`), `packages/runtime/src/plugin/{host.ts,types.ts}` (B6 docs),
  `packages/runtime/test/a5sf-member-policy.test.ts` (B1 projector arm),
  `tests/world-factory/a5sf-product-assembly.test.mjs` (PA8–PA11),
  `.github/workflows/ci-integration.yml` + `dev/ci/eb3-ci-manifest.json` (B7),
  `docs/plans/active/alpha5-sandbox-first/TOOL-ACCEPTANCE-MATRIX.md` (§0 claim note),
  regenerated `packages/runtime/dist/**`.
- **Untouched**: `packages/runtime/src/plugin/live/agent-bindings.mjs` (protected, hash above),
  `tests/deepseek-harness-test-use` (pristine), every `:3080`/Host surface.

## §9. Open design decision for the owner

The declaration currently **embeds** the v4 ceiling/restriction families in the Team row config
(self-contained, no bootstrap dependency, but a second place where a Team's IO facts are written).
The alternative is deriving the same declaration **from the Team's resolved bound blueprint at host
bootstrap** (no duplication; requires the live authority/resolver bridge and makes the product seam
depend on the live blueprint resolver). This lane chose the embedded form because it is expressible,
testable and host-free; the owner should confirm that choice before a shipped preset adopts it.

**Coordinator ruling (2026-11-05, review finding B2): the decision is still open, but it is now ONLY
about duplication — not about a widening channel.** A row-config edit can no longer raise a ceiling
above the bound blueprint without a new blueprint/authority revision: when
`config.blueprintSource` parses to the same team, `parseProductRealmDeclaration` refuses a
declaration that is not a per-axis narrowing of the blueprint's `memberIoCeilings[template]`
(`REALM_DECLARATION_EXCEEDS_BLUEPRINT`, arm PA9). The derived form (if the owner chooses it) would
remove the duplicated facts; it would not remove an authority check that now already exists. Both
forms keep working: no `blueprintSource` ⇒ the guard is skipped (host-free assembly), a
`blueprintSource` for a different team ⇒ it is not this Team's authority and is not reconciled.

## §10. Review-fix round (2026-11-05) — B1–B8, measured then fixed

An independent reviewer reproduced a blocking defect. Everything below was **re-measured on this
branch before any edit** (scratch reproductions in `.scratch/`, not committed), then fixed, then
re-measured. `CORE PATCH BUDGET = 0` held: no upstream file, no new dependency, `:3080` untouched,
`agent-bindings.mjs` hash unchanged.

### B1 (BLOCKING, mechanism) — the projector dropped a legal all-lane deny

**Re-measured first.**

```
projectToolIoRestriction({owner:'dsh.fs',name:'read',authorization:'ask',
  io:{read:{mode:'all',deny:['/dir/secret']}, write:{mode:'all',deny:[]}, network:{mode:'allow'}},
  execution:{implementationOrigin:'dsh-native',executionBoundary:'trusted-host'}})
  → read: "no-additional-narrowing"          (WRONG: the deny vanished)

realm-level, same declaration with ceiling read=[dir]:
  parsed restriction  → { read:'no-additional-narrowing', write:'no-additional-narrowing' }
  realm.bindings[0].fs.readText(dir/secret) → "SECRET\n"   providerReads = 1
```

The shape is **legal v4**: `BLUEPRINT_V4_IO_RW_FIELDS_BY_MODE` makes `deny` REQUIRED in the `all`
form, so `{mode:'all', deny:[...]}` is the ONLY way to write an all-lane. Collapsing it to the
identity sentinel is a **mechanism** defect, not a product-seam one: any caller whose restriction has
that shape leaves the intersection invariant through the projector, which is why the fix belongs in
`compile.ts` and why the matrix's invariant claim (§0 of `TOOL-ACCEPTANCE-MATRIX.md`) is amended.

**Fix** (`packages/runtime/member-io-policy/src/compile.ts`): the identity sentinel is returned
**only when the all-lane's `deny` list is empty**. Otherwise the lane is projected as its
`PathRuleSet` (`mode:'all'`, the deny kept) and `intersectPathRuleSets` binds — it already unions
deny across both axes, and `matchLocator`/`locatorWithinRuleSet` already give deny precedence over
`mode:'all'`, so **no new shape and no new vocabulary** were needed. There is no branch that turns a
non-empty deny into the identity; a future consumer that could not represent the shape would have to
refuse typed, never widen (stated in the function's doc comment).

**Why the shape cannot widen any more** (checked, not asserted):

1. projector: `deny.length === 0` is the ONLY sentinel condition;
2. intersection: `deny = union(member.deny, tool.deny)` — an all-lane's deny survives a restricted
   ceiling and a restricted tool lane alike (`intersectPathRuleSets` was already correct; it is now
   reachable with this shape);
3. matching: `matchLocator` checks `laneCoversDeny` FIRST, so `mode:'all'` cannot re-open a denied
   subtree;
4. the only other consumer of the sentinel (`intersectLane`) treats it as true identity, so returning
   a deny-carrying rule set cannot be mis-read as "no narrowing".

**Regression arms (both levels, RED → GREEN):**

- **Projector**: `packages/runtime/test/a5sf-member-policy.test.ts` — *a mode-all restriction that
  carries a deny narrows read AND write (deny is never dropped)*. Asserts the projected lanes keep the
  deny on **both** axes, the effective lanes carry it, `locatorWithinRuleSet` refuses the denied
  subtree while the sibling is still `true`, and the empty-deny form still returns
  `'no-additional-narrowing'` (the pre-existing law is extended, not weakened; the old arm at
  `a5sf-member-policy.test.ts:232-240` covered only the empty-deny form — the reviewer was right).
  RED: `expected 'no-additional-narrowing' to deeply equal { mode:'all', allow:[], ask:[], deny:['/work/a/secret'] }`
  (`gates/red-b1-projector.log`).
- **Product realm**: `tests/world-factory/a5sf-product-assembly.test.mjs` PA8 — the same declaration
  through `a5sfRealmConfigOf` → `mountMemberA5sfRealm`: the sibling read is served, the denied path is
  refused with `IO_READ_DENIED`, **zero provider reads**, and the file is still on disk. RED:
  `Missing expected rejection` — the denied file was served (`gates/red-fix-round-product.log`).

### B2 — the declaration is now reconciled with `config.blueprintSource` (coordinator ruling)

The reviewer was right: the declaration was never reconciled with the row's bound blueprint, so a
row-config edit could widen a ceiling without an authority revision. `parseProductRealmDeclaration`
takes an optional `{ blueprintSource }` context (the row passes `config.blueprintSource`); when that
source **parses to the same team**, every declared ceiling must be a per-axis narrowing of
`memberIoCeilings[template]`:

- **read/write**: `laneWithinLane` (new pure predicate in `path-rules.ts`) — every declared `allow`
  locator must be covered by the blueprint ceiling and not denied by it; a declared `mode:'all'` is a
  narrowing only of a blueprint `mode:'all'` whose deny list it covers; `ask` never counts as a
  permission and `deny` only narrows. One normalizer (`toPathRuleSet`) reads both lanes, so the two
  documents cannot be compared under two different meanings.
- **network**: the declaration is `allow` by law (else `NETWORK_UNCONFINED_REALM`), so the blueprint
  ceiling must be `allow` too.

Refusal is a **new precise typed code**, `REALM_DECLARATION_EXCEEDS_BLUEPRINT`
(`TEAM_SERVICE_INSTALL_CODES`), used for "wider than the bound authority"; an **unparseable**
`blueprintSource` is `REALM_DECLARATION_INVALID` (it cannot establish "same team", so it must not be
silently skipped). Scope follows the ruling exactly: a different team's blueprint is not reconciled,
and an absent source skips the guard — **both declaration forms keep working** (PA1–PA8 pass no
`blueprintSource` and are unchanged). Restrictions are NOT reconciled: a restriction can only narrow
the intersection, so it is not a widening channel (their grammar is B4's subject).

### B3 — `authorization` validated and `deny` refused (documented choice)

`authorization` is validated against the shipped `BLUEPRINT_V4_AUTHORIZATIONS` table. For
`authorization: "deny"` this lane **refuses** (`REALM_DECLARATION_INVALID`) instead of mounting: the
realm owns an enforced IO face for an authorized tool and has no call-time authorization decision, so
it cannot both serve and deny one binding; **not mounting the binding** would be worse — the tool
would fall back to the wider base/ceiling surface, i.e. it would be widened. The honest expression of
"the Team must not run this tool" is absence from this declaration (or a deny the Alpha.4 permission
lane owns), which the refusal's message says verbatim. Arm PA10.

### B4 — the restriction family runs through the shipped v4 validator

`toolRestrictions` are now emitted into the synthetic document as the real `toolBindings` family
(absent when empty, so a restriction-less declaration keeps its byte-identical content hash), which
means the shipped `parseBlueprintV4` validates their closed shapes with the same tables as a
blueprint: `authorization` and `implementationOrigin`/`executionBoundary` enums, the exact keys per
lane/mode, and locator lists. The refusal detail now carries the validator's collected
`details.problems` (path + reason), so it NAMES the defect.

Measured corrections to the reviewer's wording: an **object-shaped** `allow` was already refused
before this round (the mapping engine flattens leaves, so `allow.dir` is an unmapped field →
`MEMBER_POLICY_UNAVAILABLE`, never silent deny-all). The **scalar-shaped** `allow` (`allow: '/x'`) is
the one that silently became deny-all (the projector filters non-arrays), and it is now refused by
the shipped validator (`REALM_DECLARATION_INVALID`). Both shapes are pinned in PA10 with their real
codes.

### B5 — declared-not-bound, in the code and here

`teamId`, `blueprintRevision` and `instanceGeneration` in the declaration are **row-config values**,
not facts read from the live TeamDomain/blueprint/member row. Only `instanceId` and `templateId` come
from the row's Member descriptor, and the compiler's `TrustedMemberIdentity` means "consumed verbatim
by the compiler", NOT "verified against the live Team". Consequences, stated so they cannot be read
as done: a stale declared generation cannot be detected here
(`MEMBER_GENERATION_STALE` compares only what the caller passes); a wrong `teamId` is caught only
indirectly (B2 refuses when the bound blueprint's `blueprintId` differs from the declaration's — it
skips reconciliation, it does not reject the declaration); and `blueprintRevision` is a human string
stamped into the synthetic document, not a claim about the live blueprint's revision. Code comments
in `product-assembly.ts` carry the same statement at both fields and at the identity construction.

### B6 — stale docs corrected

- `host.ts` (`a5sfRealmProvider` accessor): said the realm needs **both** the accessor and
  `a5sfEvidencePath`. Corrected to the enablement law: `a5sfMemberPolicies` (no provider needed) OR
  `a5sfEvidencePath` (needs this accessor); neither ⇒ legacy path.
- `a5sf-realm-row.mjs` (`a5sfRealmConfigOf`): the `@returns` said `{ evidencePath: string, … }`
  although `evidencePath` is optional and `memberPolicies` was missing. Corrected (and it documents
  the B2 context now being forwarded).
- README §2/§4/§5 wording: §2 now says both families ride the shipped validator (B4/B8); §4 gained
  the B2/B3 rows; §5 gained PA8–PA11 and the fix-round RED paragraph.

### B7 — CI enrolment

`tests/world-factory/a5sf-product-assembly.test.mjs` is now an explicit step in
`.github/workflows/ci-integration.yml` (after the route-C step, following the enumerated a5sf
steps) and a leg in `dev/ci/eb3-ci-manifest.json` with the file path in its `check` list — the
shape checker (`node scripts/eb3-ci-required.mjs`) reports `pass workflows=9 findings=0`, so the
workflow and the manifest agree.

### B8 — the revision covers the tool restrictions

Because the restrictions are now inside the synthetic document (B4), `blueprint.contentHash` covers
them, and `contentHash` is an input to `compileMemberPolicy`'s `derivePolicyRevision`. So editing a
restriction changes the Member `revision`, and `EffectiveIoPolicy.policyRevision` (the value the
binding realm and the invocation authority carry) moves with it. Arm PA11 measures: same ceilings +
different restriction ⇒ different `contentHash`, different Member revision, and
`bindings[0].effective.policyRevision === members[0].policy.revision`. Granularity note (honest): the
hash covers the WHOLE declaration document, so a restriction edit on one Member changes the revision
of every declared Member of that row; the property that matters — a restriction edit can never be
invisible to the revision — holds, and over-invalidation is the conservative direction.

### What the review claimed that could not be reproduced

- "An object-shaped `allow` silently becomes deny-all": not reproduced — it was already refused
  (`MEMBER_POLICY_UNAVAILABLE`) by the mapping engine. The scalar-shaped `allow` is the real instance
  of that class (now refused, PA10).
- Nothing else in the review was contradicted; B1, B2, B3, B4, B8 were reproduced exactly as stated.

### Gates for this round (verbatim)

See §6's fix-round rows (`gates/green-fix-round-product.log`, `gates/red-fix-round-product.log`,
`gates/red-b1-projector.log`, `gates/fix-round-final-verification.log`).
