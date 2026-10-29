# PR360-EXTRACT — governed-families and adjacent assets on `origin/feat/a5-m2-integration` @ `bef38934f`

Assessment for U6: which PR #360 modules are reusable as **Family Contributions** (target architecture §4),
which carry **center-internal dependencies** that must be re-expressed through the Contribution contract, and
what is **WIP-only** (branch-local wiring that must NOT be inherited). Read-only source evaluation; PR #360 is
kept "as extraction asset, not merged evidence" per execution-plan U1.

Scale: PR diff vs master = 1130 files / +261,241 (evidence-heavy); `packages/**` = 386 files / +160,448
(includes dist mirrors + tests). Production corpus:
- `packages/runtime/src/plugin/live/governed-families/` — **50 .mjs modules, 28,915 LOC** (+ .d.mts type surfaces, + dist mirrors — the .mjs rows ride the dist mirror co-commit law)
- `packages/runtime/controlled-fs/src/` — **post-consume execution closures, ~2,065 new lines**: `post-consume-write.ts` (470), `post-consume-create.ts` (433), `post-consume-edit.ts` (390), `post-consume-sre.ts` (521), `governed-image-read-port.ts` (159), `bounded-bytes-read.ts` (92)
- `packages/tools/a5p5-tools/src/write-slice.ts` — 678 (write-slice law shared by family arms)
- `packages/runtime/web-gateway/src/` — ~1,038 (destination-envelope 207, index 558, types 273) — web/browser supply lane
- `tool-admission/approval-case.ts` +81, `admission-kernel.ts` +38 — family-rule grammar additions (kernel-side; review carefully before adopting)
- `pa-mount-registry.mjs` +66 — `A5_GOVERNED_FAMILIES` table + `registerA5GovernedFamily` / `a5GovernedFamilyFor` (see §3)
- **91 new C1 test files** (`packages/runtime/test/a5m2-*`, `a5m2w-*`, `a5p5-tools/test/a5m2-write-slice*`) + C2 kit `tests/kits/a5m2-schedule-c2` (846) + `tests/checks/a5m2-g3a-contract-precheck.mjs` (337)

The PR's **center swell** is the anti-pattern U6 exists to kill: `agent-bindings.mjs` +6,308 lines and
`team-tool-plane.mjs` +5,978 lines of per-family imports/mounts/funnels (REGION-MAP at
`dev/agent-workflow/evidence/a5m2-assembly-regions/REGION-MAP-2026-10-23.md` literally coordinates owners by
*line regions inside the two center files*, e.g. "mount-moment registration blocks: todo :3542, write :3563,
image :3594 … NEW sibling blocks go AFTER the image block"). Extract the families; DO NOT extract the wiring.

## 1. Module inventory (src LOC, dependency on center internals, C1 tests)

Legend — deps: **clean** = node builtins + domain/tool-governance + controlled-fs closures only;
**plane-adj** = imports `../plane-effect-backends.mjs` (lexicalAnchor) or a5p5-tools;
**g1-base** = rides `g1-surface-adapters.mjs`; **wiring** = assembles host services/ctx (bridge/wiring shape, not a pure arm).

### FS / shell family (U6 slices 2–3 candidates)
| module | LOC | deps | C1 tests | note |
|---|---|---|---|---|
| `write.mjs` (B-WRITE) | 476 | clean (post-consume-write/create) | write-existing-c1, write-newfile-c1, write-handoff-c1, post-consume-write-c1, + a5p5 write-slice(2) + defect-repro | **prime contribution shape**: pure classify → kernel ONE final edge → post-consume closure called with ZERO args; "no fallback face" law in header |
| `edit.mjs` (B-EDIT) | 424 | clean (post-consume-edit) | edit-c1, edit-sre-handoff-c1, edit-vertical-c1 | same shape |
| `sre.mjs` (B-SRE) | 485 | clean (post-consume-sre) | sre-c1, sre-arm-c1, sre-vertical-c1 | str_replace_editor arm |
| `search.mjs` (B-SEARCH) | 380 | plane-adj (lexicalAnchor + a5p5 parse/runToolCall) | bsearch-team-c1, bsearch vertical evidence | needs `lexicalAnchor` exported from a shared family lib, not imported from the center row |
| `g3-fsproc-adapters.mjs` | **2,970** | ptc row (PTC_ESCALATION_MODES) + big fs/shell adapter surface | g3-fsproc, g3-bindings-union-c1, fs-bounded-read-c1 | mixed: adapters + escalation interplay; **split before reuse** — the fs/shell adapter half is Family, the PTC mode half is Bridge |
| `pwsh-arm.mjs` / `pwsh-wiring.mjs` | 276/303 | wiring (shell service capture) | pwsh-arm, pwsh-mount | pwsh Family arm + its host-shell bridge wiring |

### Session/query/admin family arms (pure classify→consume→execute shape)
| module | LOC | deps | C1 tests | note |
|---|---|---|---|---|
| `todo.mjs` (B-SESSION) | 465 | **clean** (zero imports but crypto) | todo-assembly-c1 | the "classify is PURE" LAW module cited by write.mjs header; best reference arm |
| `image.mjs` (B-IMAGE) + `image-attachment.mjs` | 743/257 | plane-adj (lexicalAnchor) + image read port | image-row-c1, image-handoff-c1, image-read-port-c1, readimg-c1, readimg-arm-c2c3 | read_image arm |
| `g5-goal-service.mjs` / `g5-goal-wiring.mjs` | 1,041/509 | service-shaped | g5-goal-service-c1, goal-service-drift-proxy, goal-wiring, g5-mount-arm | create_goal/get_goal/update_goal — durable service + arm |
| `g6-session-query.mjs` / `-wiring` / `-pa-supply` | 1,758/618/131 | wiring + PA supply | g6-session-query-c1 (52 legs), wiring, pa-supply-c1, plane-mount-c1 | session_* family |
| `present.mjs` / `human.mjs` / `skill.mjs` / `g1-present-arm.mjs` | 164/191/160/91 | g1-base | g1-present-c1, g1-human-c1, g1-skill-c1, g1-present-arm | thin G1 arms |

### G1/G2 read-surface + team-ops (bridge-flavoured)
| module | LOC | deps | C1 tests | note |
|---|---|---|---|---|
| `g1-query-assembly.mjs` / `g1-query-wiring.mjs` / `g1-surface-adapters.mjs` / `g1-trusted-topology-supply.mjs` | 400/624/1,404/188 | trusted-topology supply (control/plugin reads = trusted-source shape) | g1-query-assembly, g1-query-wiring(18), g1-surface-adapters, g1-trusted-topology-supply, g1-wire-c1, g1-control-handover-c1, g1-dependency-pa, g1-plugin-c1, g1-profile-fresh-member-c1 | read-only Team surface adapters (present/human/skill host them) |
| `g2-team-mount.mjs` / `g2-team-assembly.mjs` / `g2-connector-adapters.mjs` / `g2-provider-seams.mjs` / `g2-web-supply.mjs` | 780/535/1,054/1,143/215 | worker-execute + consumed-proof approval creation; browser/MCP/web ports | g2-team-assembly, g2-connector-adapters, g2-provider-seams, g2-wire-c1, g2-mcp-sdk-contract, g2-web… | **Bridge-shaped** (MCP/browser/Web = CA-03 named bridges), plus `g2-team-browser/mcp ports` |
| `team-adapters.mjs` / `team-wiring.mjs` / `team-governed-provider.mjs` / `upstreamteam.mjs` | 912/859/313/271 | team ops (claimTeamOpsFamily) | team-adapters, team-wiring-c1, team-plane-mount-c1, team-governed-provider, upstreamteam-adapters | the 15 team_* tools' governed adapter layer |

### Subagent / workflow / jobs / schedule / lsp / ptc
| module | LOC | deps | C1 tests | note |
|---|---|---|---|---|
| `subagent-adapters.mjs` / `subagent-wiring.mjs` / `subagent-spawn-adapters.mjs` / `subagent-spawn-wiring.mjs` / `child-identity-bridge.mjs` | 756/471/608/299/148 | familyRegistrations() → registerA5GovernedFamily | subagent-adapters, subagent-wiring, subagent-spawn-*(4), child-identity-bridge, subagent-plane-mount-c1 | B-SUBAGENT; child-identity-bridge = identity law for delegated agents (CI-03) |
| `workflow-adapters.mjs` / `workflow-wiring.mjs` | 547/305 | clean adapters | workflow-adapters, workflow-wiring, b-orch-plane-mount | B-ORCHESTRATION |
| `job-adapters.mjs` / `job-wiring.mjs` | 263/249 | ctx.jobs (public jobs face) | job-adapters?(→job-wiring, job-plane-mount) | B-JOB — overlaps master's shipped `createGovernedJobsBridge`; PR#360's version = arm+wiring split |
| `schedule-adapters.mjs` / `-wiring` / `-carrier` / `-bind-after-def` / `-trigger-governance` | 1,040/546/219/497/156 | ctx.schedule service capture; bind-after-def (post-publish binding) | schedule-adapters(29), schedule-wiring, schedule-production, schedule-carrier-c1, schedule-fork-trigger, schedule-trigger-governance, spawn-bind-after-def-c1, bind-after-def | + C2 kit `tests/kits/a5m2-schedule-c2` — **the only a5m2 lane with a C2 real-Host kit**; bind-after-def is the §10.2 publish-then-bind law's field proof |
| `lsp-realm-supply.mjs` / `g3-lsp-wiring.mjs` | 632/478 | sandbox-provider LSP realm assembly | g3-lsp-realm-supply-c1, g3-lsp-mount-c1, lsp-wiring-c1 | LSP persistent Realm = named bridge |
| `g3-ptc-wiring.mjs` | 905 | ptc row + parseRequestedEffectSet | g3-ptc-wiring | PTC named bridge wiring |
| `g3-terminal-wiring.mjs` | 656 | route identity helper | g3-terminal-wiring | terminal_* surface |

## 2. The `governed-arm` contract PR #360 proved (extract this law)

`write.mjs` header states the shape verbatim: **classify (PURE, zero I/O: parse closed arg shape, anchor
lexically, snapshot binding generations, freeze review payload, derive parametersFingerprint) → kernel's ONE
final edge (consume) → execute = mint execution closure ONLY from frozen plan facts + REAL consumed proof,
call it with zero args, at most once** → map typed answers honestly (`undetermined` keeps `sideEffectPossible`),
**no fallback face** (native masked by the row), DRAINING refuses new entries. Pairing law: the consumed grant
must answer THIS plan (callId / parametersFingerprint / binding generations) or nothing runs.
This is exactly the architecture §4 "Effects & Constraints / Execution & Settlement" boundary — U6's
Contribution schema should be codified FROM this law (plus todo.mjs as the minimal exemplar), NOT from a new abstraction.

## 3. What is WIP-only / must not be inherited as-is

1. **The whole branch is WIP** (never merged; unmerged = unreviewed against master's current U4/U5-delta tree).
   Treat everything as source material needing re-review against master.
2. **All wiring in `agent-bindings.mjs` / `team-tool-plane.mjs` +6.3k/+6.0k lines** — per-family import blocks,
   mount-moment registration blocks, the `paAdmitBody` funnel split — is exactly the center-branch model ARC-D
   forbids ("旧中心分支迁入 Registry…形成隐性中心"). Extract arms; re-wire through U6's Registry.
3. **`A5_GOVERNED_FAMILIES` in `pa-mount-registry.mjs`** (+66 lines): the registration law
   (definitionIdentity key, {familyId, adapterRevision, providerIdentity} frozen shape, one-identity-one-family
   collision throw, one table three readers) is GOOD and belongs in the Registry; the **module-level mutable
   table living in pa-mount-registry + per-caller fill calls in agent-bindings** is WIP shape (and
   pa-mount-registry is otherwise U6-protected).
4. **`tool-admission/approval-case.ts` +81 / `admission-kernel.ts` +38** — family-grammar edits INTO the kernel
   lane; they must be re-expressed as contribution data (closed-world schema fields), not kernel code branches.
5. **`g3-fsproc-adapters.mjs` (2,970 LOC)** is one-file-several-families; needs splitting before any use.
6. **"Wired" claims**: REGION-MAP rule 5 reserves "wired" for production-path capture→PA→consume→dispose proofs;
   several lanes are factory-assembly-tested (registry+input.admit) only — re-verify per lane before reuse.
   The lanes with production-path C1 mount tests (todo/write/edit/image/sre/subagent(-spawn)/team/g1/g2/g3-plane/g5/g6/schedule)
   are the strongest extraction candidates.
7. `web-gateway/` + browser/MCP adapters ride `ctx` supply seams that changed under U4/U5 — rebase cost, plus
   the browser bridge belongs to a CA-03 bridge PR, not the kernel PRs.

## 4. Recommended extraction order for U6 (maps to U6-SLICE-PLAN)

| U6 slice | take from #360 | leave behind |
|---|---|---|
| PR1 (kernel skeleton) | the arm contract law (write.mjs/todo.mjs headers), `registerA5GovernedFamily` collision law (re-homed into the Registry), `a5m2-family-rules-c1` + `verify-surface-*` test shapes | any table in pa-mount-registry |
| PR2 (read/FS) | `write/edit/sre.mjs` arms + `controlled-fs/post-consume-*` (they are already center-lane reviewed law) + their 13 C1 tests; `write-slice.ts` | plane funnel hunks |
| PR3 (bash/process) | `pwsh-arm/wiring` split pattern, `g3-fsproc-adapters` (split), `a5m2-overlay-strict-b` | the PTC half (→ bridge PR) |
| PR4 (Jobs bridge) | `job-adapters/wiring` arm/bridge split shape + `job-plane-mount` tests | wiring bytes |
| PR5 (family additions) | `todo/present/human/skill/image/g1-*` arms (zero-center-diff proof families); C1 suite per family | G1 control-handover specials |
| PR6 (adversarial/ARC-D) | `verify-surface-neg4-preset-selfregister`, `r17-drift-repro-c1`, `g2-mcp-sdk-contract` negative shapes; schedule `bind-after-def` law tests | region-map culture |
