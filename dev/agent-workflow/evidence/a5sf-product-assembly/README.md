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
reserved scaffold leader + one template per declared Member + the declared `memberIoCeilings`) and
handing it to the shipped **`parseBlueprintV4`**. So lane/grammar defects are found by the shipped
v4 validator, at its own path, and the resulting `contentHash` is the real content identity of
exactly the declared ceilings. The reserved scaffold template id
(`a5sf-product-scaffold-leader`) may never name a managed Member (typed refusal).

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
| Malformed/ambiguous declaration: unknown or missing field, wrong schema, blank ids, empty members, duplicate template, reserved scaffold id, duplicate binding, a ceiling the shipped v4 validator refuses | `REALM_DECLARATION_INVALID` (new) | row assembly | A declaration that cannot be read must never be treated as "no declaration" (that would silently unmanage the Member). |
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

**RED before GREEN (honest)**: with the pre-change tracked sources restored by `git stash` (new
module + new suite still on disk), the suite reads **7 tests / 2 pass / 5 fail** — every product-path
arm (PA1, PA2, PA3, PA4, PA6) fails; only the evidence regression (PA5) and the module-only arm
(PA7) pass. Log: `gates/red-product-assembly.log`. Implementation then turns it **7/7**
(`gates/green-product-assembly.log`).

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
- **Edited**: `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` (enablement law, product provider,
  optional sink), `packages/runtime/team-services/src/types.ts` (2 closed codes),
  `packages/runtime/team-services/src/index.ts` (exports), `packages/runtime/src/plugin/types.ts`
  (`TeamPluginConfig` doc + type), `packages/runtime/tsconfig.build.json` (emit),
  `docs/plans/active/alpha5-sandbox-first/{ALPHA5-SANDBOX-BACKLOG,TOOL-ACCEPTANCE-MATRIX}.md`,
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
