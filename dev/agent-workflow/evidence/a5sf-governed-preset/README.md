# GOVERNED-PRESET — the opt-in governed Member realm, assembled by the product

Owner ruling **2026-11-11** (`GOVERNED-PRESET`). Base: `origin/master` = `64f689901`
("FACE-DECL-IMPACT: measure what declaring the governed faces costs a Member (#647)").
Branch: `task/a5sf-governed-preset-20261111`. Worktree: `.worktrees/a5sf-governed-preset`.

This lane adds the **product assembly** for the Alpha.5 governed faces a Member actually
gets: a shipped opt-in agent preset whose model-visible `bash` runs on the PD-13 confined
terminal face, a realm provider that compiles from the Team's **bound** blueprint and the
live Alpha.4 authority, and one neutral enablement key on the Team row. It changes no
default: `standard` stays the deployment default, the shipped layer names no preset, the
Leader never becomes a Member, and nothing auto-enters a realm.

It does **not** move any grade, any `V@B` cell, or the Authority pointer. `CORE PATCH
BUDGET = 0`; no upstream file was touched. Core/Q7/Authority/network-deny semantics and
Required-CI are unchanged.

---

## 1. What shipped (files)

| File | Change |
| --- | --- |
| `packages/runtime/src/plugin/live/a5sf-governed-realm.mjs` | **NEW** — the shipped governed realm provider. Resolves the bound blueprint, reads the live authority, compiles through the ONE product compiler, and returns the realm object with the confined `subprocess` + `terminal` faces. |
| `packages/runtime/src/plugin/live/a5sf-governed-realm.d.mts` | **NEW** — the typed half of the `.mjs` seam (the `pa-mount-registry.d.mts` precedent). |
| `packages/runtime/src/plugin/host.ts` | Builds the provider **only** when the row carries `a5sfGovernedRealm: true`; wires the BP-F `resolveBoundBlueprint` and the durable authority read (overlay generation + MemberInstance lifecycle). |
| `packages/runtime/src/plugin/live/a5sf-realm-row.mjs` | The neutral key's config parsing (`true`/absent; `false` refused), the two-compiled-realm-source refusal, and the mount-time "governed but no provider ⇒ refuse" guard. |
| `packages/runtime/src/plugin/types.ts` | `a5sfGovernedRealm?: boolean` with the full semantics comment. |
| `packages/runtime/team-services/src/product-assembly.ts` | `A5SF_GOVERNED_REALM_KEY`; `boundBlueprint` accepted by the parse context (a caller-supplied **already-parsed** bound blueprint is validated, never re-parsed/guessed); `deriveProductRealmPlanFromBlueprint()` — no second compiler. |
| `packages/runtime/team-services/src/index.ts` | re-exports the above. |
| `cordis.patch.yml` | **NEW shipped preset row** `preset-a5sf-governed-member` (`id: a5sf-governed-member`, order 50): the pinned `standard` preset verbatim **minus `tool-pwsh`**, plus nothing. Not selected anywhere in this layer. |
| `scripts/dist-placements/150-a5sf-governed-preset.json` | **NEW** — the dist-mirror placement for the new `.mjs` (without it the installed Host would fail at import). |
| `scripts/a5sf-governed-preset-surface.mjs` | **NEW** — the measurement instrument for the tool-surface delta (`tool-surface.json`). |
| `tests/world-factory/a5sf-governed-preset.test.mjs` | **NEW** — the product-composition suite (G0–G7). |
| `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md` | **Anchor maintenance only** — PD-11 (`host.ts`) and PD-13 (`a5sf-realm-row.mjs`) line anchors moved by this lane's insertions; symbols and statuses unchanged. |

## 2. The enablement key, and why it is a boolean marker

`a5sfGovernedRealm: true` carries **no blueprint path, no policy, no authority reference,
no filesystem path**. It is a neutral claim: *this row's compiled-realm source is the
composition's `teamA5sfRealm` provider; the row itself compiles nothing*. Three
consequences, each asserted:

1. **It cannot fork the compiler.** A row with this key has no `memberPolicies` of its
   own, so there is exactly one compiled-realm source.
2. **It still refuses the fork.** The same row carrying `a5sfMemberPolicies` **or**
   `a5sfMemberAuthority` refuses `REALM_DECLARATION_INVALID` — "two compiled-realm
   sources for one Member is ambiguous — keep exactly one" (config time), and the mount
   seam keeps its own two-source refusal (mount time).
3. **It cannot be a silent no-op.** A governed row with no provider refuses at mount
   ("would leave the Member with NO realm"). `false`, `null` and a missing key are three
   different things: `false` is refused (a half-written opt-out must not look like a
   default), `null`/absent is the legacy path.

Why not an evidence-file path as the key? `a5sfEvidencePath` was the only pre-existing
non-forking key, but it is a **machine path in a shipped layer** and it is a *sink*, not
an enablement. It may ride along beside the neutral key; it can never be the switch.

## 3. The facts the realm compiles from (no static exemplar as authority)

- **Blueprint** — the Team's **bound** blueprint through the BP-F resolver
  (`resolveBoundBlueprint(teamRootSessionId)`), i.e. the live binding, never the row
  anchor. Supplying an already-parsed blueprint is validated
  (`blueprintId`/`revision`/`schemaVersion`) and refuses otherwise; nothing is re-parsed
  or defaulted.
- **Authority** — the durable Alpha.4 overlay **generation** (the highest-generation
  snapshot, the port's own `latest()` law, the same number the A5-M1 reader hands the tool
  Guard) plus the durable **MemberInstance lifecycle** admission. `ARCHIVED` / `DISPOSED`
  / a vanished row are not admitted. `governedAuthorityReference()` is the ONE mapping,
  used by the Host wiring and by the tests.
- **Identity/generation** — the live glue's descriptor (`instanceId`, `teamRootSessionId`,
  `templateId`) plus that same durable generation; the provider re-asserts the compiled
  identity and generation (`MEMBER_IDENTITY_UNTRUSTED`).
- **The lanes** — `deriveProductRealmPlanFromBlueprint` → `parseProductRealmDeclaration` →
  `compileMemberPolicy`: the ONE compiler. No second policy evaluation, no second
  permission fact source.

Exemplar values from the impact study (`memberPolicies` literals,
`authority.admitted: true`, `instanceGeneration: 1`) appear **nowhere** in the shipped
provider; they exist only in test fixtures that are labelled as fixtures.

**Honesty note on `instanceGeneration`.** The domain has no separate durable
`instanceGeneration` field; this provider feeds the member-io-policy `instanceGeneration`
from the durable authority generation (the number the Guard stamps into every Binding) and
`authority.revision` is `a4:overlay-generation:<g>`. The assembly function's own
`instance-generation-declared-not-bound` residual therefore remains a true statement about
*that function*, and is disclosed rather than papered over.

## 4. v3/v4 compatibility (no silent, no opt-in-free change)

| World | Behaviour | Proof |
| --- | --- | --- |
| Shipped default (v3, no keys) | byte-identical legacy path; the provider is never built; a Member mounts nothing | `G2c` |
| v4 blueprint **without** `memberIoCeilings` | refused `MEMBER_POLICY_WITHOUT_BLUEPRINT` ("empty memberIoCeilings family") — **no implicit ceiling** | `G2b` |
| v3 blueprint + governed keys | refused `MEMBER_POLICY_WITHOUT_BLUEPRINT` naming `schemaVersion 3` — **no silent relaxation and no silent deny-all** | `G2` |
| v4 + ceilings + both opt-in keys | compiles and mounts | `G3`, `G4` |

The shipped `standard`/`rootPresetId` path is untouched: `G0` asserts the shipped layer
sets neither `memberPresetId` nor `rootPresetId` nor `a5sfGovernedRealm`, and `G2c`
asserts an unconfigured row still mounts nothing.

## 5. The model-visible tool-surface delta (measured, not described)

Source of truth: [`tool-surface.json`](./tool-surface.json), produced by
`node scripts/a5sf-governed-preset-surface.mjs` — the pinned `standard` preset
(`tests/deepseek-harness-test-use/.../standard.patch.yml`, 0.2.0-rc.2 @ `639ed01539`) vs
the shipped preset, plus the **resolved** `bash` definition mounted in a unit root.

Declaration delta: **29 → 28 rows; removed `tool-pwsh`; added none; changed none.**

| Capability | Standard | Governed preset | Note |
| --- | --- | --- | --- |
| `bash` | `@deepseek-ai/dsh-tool-bash`, params `command, description, timeoutMs, workdir` | same name, served by the **confined terminal face**, params `command, description, workdir` | `timeoutMs` is gone; the face is per-call fresh and owner-scoped. `run_in_background` / `sandbox_permissions` / `justification` **do not exist in this baseline's schema at all**, so they are not "lost here" — they are losses the *impact table* predicted for other generations; the measured baseline delta is `timeoutMs` plus the result shape (`kind: confined-terminal`, bounded text) and the inability to hand a command to a job. |
| `tool-pwsh` | present (Windows only) | **removed** | a second, uninstrumented shell would keep an un-attributed read path beside the governed `bash` |
| `tool-jobs` | present | **retained** | no producer on this preset: the confined face cannot background a command, so the tools exist but stay idle |
| skills (`skill-filesystem`, `tool-skill`) | present | **retained** | nothing about the realm touches them |
| fs / fs-search / web / goal / plan / todo / present / ask / subagent / workflow / compaction / instructions / persona | present | **retained** | identical rows (verbatim copy) |
| persistent shell / `terminals` producer | absent | **absent** | a legacy PTY beside the confined face is refused `TERMINALS_DOUBLE_TERMINAL_REFUSED` (`G7`) |

`G0` also asserts every non-group plugin name in the shipped preset resolves in this
workspace, so the row cannot rot into an unresolvable name.

## 6. Tests — the real product composition

`tests/world-factory/a5sf-governed-preset.test.mjs` (**12 tests, all green**; run:
`node --test tests/world-factory/a5sf-governed-preset.test.mjs`). It imports the SHIPPED
modules — `a5sf-realm-row.mjs`, `a5sf-governed-realm.mjs`, `product-assembly.ts`,
`mountA5sfRealm`/`installMemberIoProviders`, the route-C attach — and mounts a real Cordis
root. Two doubles only, each labelled in the file: the confined OS process provider (no
kernel process is spawned; no confinement claim is made from this suite) and the durable
authority **read** (the mapping and every refusal are the real ones).

| Arm | What it proves |
| --- | --- |
| `G0` | the shipped preset is declared, opt-in, shell-free, resolvable |
| `G1` | the neutral key's contract; the two-source fork refuses both ways; governed-without-provider refuses at mount |
| `G1b` | (same refusal, measured at the mount seam) |
| `G2` | v3 bound blueprint refuses — no silent ceiling |
| `G2b` | v4 without ceilings refuses |
| `G2c` | non-opt-in v3 row keeps the legacy path (mounts nothing) |
| `G3` | **positive read** (in-lane, one confined child, zero host spawns) and **Member-ceiling denial** (`IO_READ_DENIED`, zero bytes, zero confined calls, one ALLOW + one DENY guard fact) |
| `G4` | **native surface == actual execution provider**: the model-visible `bash` schema is the confined terminal tool's and the executed result is `kind: 'confined-terminal'`; exactly one `bash` |
| `G5` | **Member lifecycle revocation**: ARCHIVED / DISPOSED / vanished ⇒ `governedAuthorityReference().admitted === false` ⇒ the ONE compiler refuses `AUTHORITY_REFUSED` inside `MEMBER_POLICY_UNAVAILABLE`; no realm, no faces |
| `G5b` | the negative arm is not vacuous: CREATED/RUNNING/SETTLED are admissions |
| `G6` | **denial after invalidation**: the generation is read per attach (revision follows it), and a stale pairing is refused `MEMBER_GENERATION_STALE` |
| `G7` | a persistent shell beside the governed realm refuses `TERMINALS_DOUBLE_TERMINAL_REFUSED`, zero legacy allocations |

**What the revocation test means.** It is not "a flag was flipped". It is: the durable
Member row's lifecycle (or its absence) is read at attach; the mapped authority reference
is `admitted: false`; the ONE compiler refuses with `AUTHORITY_REFUSED`; the provider
propagates `MEMBER_POLICY_UNAVAILABLE`; and the mount seam never creates a realm. So a
revoked Member cannot get a compiled policy, a confined face, or a `bash` shadow — the
denial is at compile time, before any tool could run.

## 7. DEV-LIVE — a two-boot pair (boot/config level), and what it does NOT prove

A **real Host** (pinned `tests/deepseek-harness-test-use`, 0.2.0-rc.2 @ `639ed01539`) was
booted twice with a `DSH_HOME` under `tests/homes/` whose profile patch opts the shipped
Team row into the governed preset: schemaVersion 4 blueprint with a `memberIoCeilings`
family (read/write = the Member workspace, network allow), `memberPresetId:
a5sf-governed-member`, `a5sfGovernedRealm: true`.

| Run | Port | Log | Verdict |
| --- | --- | --- | --- |
| 1 | `3180` | [`run-1-host.log`](./run-1-host.log) `:3` | row MOUNTED (`remote mount: MOUNTED channel=/team-remote`), TeamDomain created with the v4 design, no config/realm refusal |
| 2 | `3190` | [`run-2-host.log`](./run-2-host.log) `:3` | same signature, same durable v4 design |

**LOCUS**
- `run-1-host.log:3` — `[dsh-agent-team] remote mount: MOUNTED channel=/team-remote`
- `run-2-host.log:3` — same
- `tests/homes/a5sf-governed-preset-{1,2}/storages/team_domain.json` — one occurrence of
  `memberIoCeilings` and the stored design's `"schemaVersion": 4` in both worlds
- both worlds: `tests/homes/.../a5sf-governed-consult.jsonl` **absent** — no Member turn
  ran, so no read decision exists to attribute

**What this pair proves:** the shipped YAML composes, the dist mirror is importable by a
real Host, the row accepts the three opt-in keys without refusing, the v4 design is the
durable one, and the governed realm wiring does not break the boot.

**What it does NOT prove (stated, not hidden):** no Member session was driven, so this is
not a live Member `bash` read, and it is **not** `V@B` evidence and not candidate
acceptance. The in-repo live driver for a Member turn does not exist: `150-a5sf-read.mjs
--live` still refuses `LIVE_SEAM_UNAVAILABLE` by design, and building a Member-turn driver
is a separate lane. The DEV-LIVE record class cannot fund a `CANDIDATE-C2` claim
(`acceptance-claim.mjs`), and none is made here.

Reproduction: `node dev/agent-workflow/evidence/a5sf-governed-preset/world.mjs
tests/homes/<world>` then
`DSH_HOME=<world> node tests/deepseek-harness-test-use/apps/cli/lib/bin.js web --port
<318x> --no-open`. The world script's `A5SF_HOST_ENTRY` env var exists only because a
gitignored pristine host tree cannot resolve this package by name; the SHIPPED row uses
`dsh-agent-team/host`.

## 8. Limitations kept (no claim moved)

- **BL-39 / PD-5** — unchanged. The confined face's OS profile is the existing
  `landlock-prelauncher` lane; this lane adds no new sandbox mechanism and no stronger
  isolation claim. `network: allow` only: a narrowed network lane is refused at assembly
  (`NETWORK_UNCONFINED_REALM`) and **no** network-deny/netns behaviour is claimed for the
  governed preset. BL-42's subprocess proof is not reused for the Web face (PD-15 face
  binding stays).
- **Dynamic shell reads** — `$(...)`/backticks are not lexically attributable and are not
  refused at admission; that is the OS profile's problem (PD-13 C6 pins the weakness).
- **Workspace / scratch Team isolation** — `NOT_WIRED`. The realm's scratch root is a Host
  temp directory (`A5SF_GOVERNED_SCRATCH` may override); no per-Team isolation of that
  root is claimed.
- **Background jobs / timeouts / sandbox escalation on the member shell** — `UNSUPPORTED`
  on the confined face: the face is one fresh confined child per command.
- **Persistent shell** — not offered; fail-closed (double terminal refused).
- **`instance-generation-declared-not-bound`** — still a true residual of the assembly
  function, see §3.
- **No global read whitelist, no full network isolation, no grade movement.**
- **`tool-jobs` on the governed preset** — present but has no producer (declared, not a
  capability claim).

## 9. Gates run in this worktree

| Gate | Result |
| --- | --- |
| `node --test tests/world-factory/a5sf-*.test.mjs` | **520 tests, 516 pass, 0 fail, 4 skipped** (env-gated pins) |
| `node --test tests/world-factory/a5sf-governed-preset.test.mjs` | 12/12 pass |
| `node --test tests/world-factory/a5sf-pd13-terminal-read-axis.test.mjs` + `a5sf-product-assembly.test.mjs` | 27 pass, 1 skipped pin |
| `pnpm -r typecheck` | every package except `packages/client` passes; `packages/client` fails **only** on missing `react` / `@testing-library/react` in this worktree's copied `node_modules` (environment gap, see below) |
| `eslint` on the changed files | clean except two **pre-existing** errors in untouched `host.ts` regions (`TemplatePermissionPolicy` unused at L114; empty `try` block at L3384) — both present verbatim in `HEAD` |
| `node scripts/check-artifacts-committed.mjs` | STALE before commit (expected: the rebuilt dist + the new placement are committed together); re-run after the commit-worthy `git add` is clean |
| `node scripts/ci-pr-gate.mjs` (default legs) | 5 pass / 3 fail / 1 skip; failures are environmental: `install` (pnpm store outside the sandbox), `typecheck` (same `react` gap), `artifacts-at-head` (store not writable ⇒ NOT-RUN). `blueprint-fence`, `lint-identities`, `graph-parse`, `kit-home-guard`, `state-freshness` PASS. |
| `node scripts/doc-checks.mjs` | exit 0 |
| `node scripts/doc-consistency-controls.mjs` | 96 controls, 8 pre-existing failures in synthetic-fixture positive controls (`docs-sync --check --root` does not honour `--root` in this tree); unrelated to the changed files |
| `node scripts/composition-smoke.mjs` | host/client composition legs pass except the client leg's `react` resolution (same environment gap) |

**Environment gaps (not caused by this lane).** This worktree's `node_modules` was
materialised by hardlink-copying an existing install (the pnpm store is outside the
sandbox, so `pnpm install` fails with `ERR_SQLITE_ERROR`). `react`/`@testing-library/react`
are therefore absent, which is what breaks `packages/client`'s typecheck and the
client-side smoke legs. `@types/node` and the `@deepseek-ai/*` scope/tools packages were
linked to the worktree's own store so the suites see ONE module instance (the duplicate
`@deepseek-ai/dsh-scope` instance is exactly what makes the route-C shadow refuse to
register as an agent-scoped shadow).

## 10. What is NOT satisfied, in one place

1. **No live Member-turn DEV-LIVE proof.** §7 is a two-boot Host pair, not a live Member
   `bash` round trip; the in-repo live driver does not exist. The five required
   product-composition behaviours are proven host-free through the real product modules.
2. **No candidate claim.** `CANDIDATE-C2` acceptance remains independent and unrun here;
   nothing in this evidence is `V@B`.
3. **Client-side gates are blocked by the environment**, not by the change; they must be
   re-run in a complete install before merge.
4. **The governed preset is shipped but unselected.** Enabling it is an operator act on a
   Team row (both keys); no Team in this repository selects it.

## 2026-11-12 — census 记账（两个新文件进入被扫描总体）

本 lane 新增两个**被 census 扫描的**文件（`a5sf-governed-realm.mjs` + 其 `.d.mts`），因此 `p4t6` 总体必须记账。
实测：scanner 报 **1439**，未 booking 时台账推导 **1437**，差值恰为这两个文件；已在
`packages/testkit/test/p4t6-bookings/a5sfgovpreset.json` 记 `1437 → 1439`（数字是**在本树实测**的，不是抄链上值）。

上一轮 PD-12/PD-13 lane 也各记过一笔；这次是本 lane 自己漏记后由 CI 抓出，属修正而非新增放宽——定律仍精确：
`scanner total === 983 + Σ(unbased bookings)`。

## 2026-11-12 — census 第二红：命名挂载点必须登记（并回到公共面）

`census` 第二次红，原因不是记账而是**两条真实的接线法则**：

1. `a5w-integration-wiring` / `a5p4-lane-hygiene` 都要求：**每个引用 confined provider lane 的生产文件必须是一条
   booked 的命名挂载**，并且只能有一条**公共面**（`sandbox-provider/index.js`）的 import 边。
   新模块当时用 `sandbox-provider/provider.js`（**深层导入**）——这正是法则要禁的形状，即便它今天能用。
2. 处理方式：产品代码改回**公共面**导入；两条法则各自登记一条命名行（`file` + 唯一边），两处列表同步移动。

这不是为了让门禁变绿而放宽：法则的牙齿（未登记即红、深层导入即红、登记行必须真的调用工厂）一个都没有动。
`check-artifacts-committed` 随后在 dist 重建后 `verdict=ok compared=1971`。
