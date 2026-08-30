# P5-T6 public surfaces — real-instance harness

Every seam the P5-T6 real-instance harness (`packages/runtime/member-residency/harness/`)
drives is a PUBLIC surface: a named host service, a frozen upstream public seam, a
composition seam, or an on-disk durable artifact. No upstream source is patched, no
private/internal API is imported, and no legacy `packages/team` copy is used. The
p4t6 denylist scanner stays green at the terminal count (257 files, 15 hits, all inside
the frozen quarantine set).

## 1. Composition / mount seam

| Surface | Purpose | Origin (file:line) |
| --- | --- | --- |
| Profile-patch row mount — `<DSH_HOME>/profiles/web/cordis.patch.yml` | The ONLY mount path for the harness rows (T5 `p5t5-root-binding` boots 1–2; T6 `p5t6-member-residency` boots 3–6). Rows are appended via `DshInstance.mountRows` before each boot. | `packages/runtime/member-residency/harness/run.mjs:523-530` (ensureProfile + mountRows); T5 helper `packages/runtime/root-binding/harness/seam.mjs` |
| `--profile web --dump-config` | One-shot composed-profile dump proving each row is present in the mount (public proof of mount, per boot). | `packages/runtime/member-residency/harness/run.mjs:541-548` (DshInstance.dumpConfig + rowInDump) |

## 2. Host services (resolved by the rows at request time)

| Service | Purpose | Origin (file:line) |
| --- | --- | --- |
| `agents.create({sessionId, meta})` | Create the durable child Session with the DERIVED child session id (public agent-lifecycle seam; the pre-specified id is the derived durable identity). | `packages/runtime/member-residency/harness/plugin.mjs:761-766` (ensureFreshChild); M5 ordinary agent `plugin.mjs:994-997` |
| `agents.resume({resumeSessionId, setup})` | Cold-resume the durable child with the app-faithful setup (model-selection ref re-seed + member persona preset mount). | `packages/runtime/member-residency/harness/plugin.mjs:786-793` (resumeChildWithSetup); M5 root resume `plugin.mjs:998` |
| `agentPresets.resolve / mount / composedPreset` | Resolve/mount the DSH_HOME-local user persona presets (`p5t6-leader-persona`, `p5t6-member-persona`); composedPreset read-back is the public persona-assembly proof. | `plugin.mjs:649-661` (restoreScope mount effect), `plugin.mjs:790-791` (setup mount), `plugin.mjs:1164` (composedPreset read-back) |
| `sessions.get(SessionId)` / `sessions.list()` | Public session view: durable child visibility, event counts (M5 no-turn-submitted proof), single-session invariants (M4/I1C). | `plugin.mjs:1002-1003`, `plugin.mjs:1017-1018`, `plugin.mjs:1410-1411`, `plugin.mjs:1501-1502` |
| `sessionProjections.stateOf(session, 'modelSelection')` | Durable model-selection projection read-back after cold resume (re-seed proof, composePath `sessionProjections`). | `plugin.mjs:798-807`; T5-identical `packages/runtime/root-binding/harness/plugin.mjs:839` |
| `storageDomain` | The seam through which the row opens the `team_domain` unit (real StorageDomain backend, `storages/team_domain.json` under DSH_HOME). | `plugin.mjs:437-443` (createRealStorageDomainSeam + createTeamDomain/openTeamDomain); seam `packages/runtime/root-binding/harness/seam.mjs` |
| `systemPrompt` (persona assembly) | `assemblePersona` — the public system-prompt assembly of the resumed handle (persona section text vs blueprint). | `plugin.mjs:845-853` (assemblePersona); T5-identical pattern |
| `subagents.followup(parent, childId, content, options)` | M5 negative probe: a Member child is NOT a continuable subagent — the call must fail `SubagentError UNAUTHORIZED` before any turn is submitted (upstream: `references/deepseek-harness-test-use/packages/subagent/subagent/src/continuation.ts:506`, lineage check at `:969`). | `plugin.mjs:1008-1013` |
| `webServer.register({kind:'exact', path, handler})` | The row's scoped surface routes (`/__p5t6/health`, `/__p5t6/i1a/state`, `/__p5t6/i1a/run`, `/__p5t6/run`; T5 row: `/__p5t5/*`). | `plugin.mjs:485-491`, `:493-508`, `:510-546`, `:548-594` |

## 3. vNext control-plane surfaces (this repository — packages/storage)

| Surface | Purpose | Origin (file:line) |
| --- | --- | --- |
| `TeamDomain.repositories.memberInstances` — `put/get/delete/list` | The durable MemberInstance store (table `member_instances`, key `memberIdentityKey`). Harness-setup uses delete+put for the M3 SETTLED seed (logged as `harness-setup-*` ops); scenarios read through the read handle. | `packages/storage/repositories/member-instances.ts:50-131`; harness `plugin.mjs:1292-1296` (seed), `plugin.mjs:1406` (M4 list), `plugin.mjs:1497-1498` (I1C list) |
| `TeamDomain.repositories.sessionBindings` — `get/listByKind/delete` | The durable session-binding store (table `session_bindings`; kind `team-member` / `team-root`). | `packages/storage/repositories/session-bindings.ts`; harness `plugin.mjs:1408-1409`, `plugin.mjs:1499-1500` |
| `openTeamDomain` / `createTeamDomain` (seam spec) | The only durable control-plane open path (boot 3 creates the unit; boots 4–6 reopen it). `SCHEMA_VERSION_MISMATCH` fail-loud mapping is the I1b assertion target. | `packages/storage/repositories/team-domain.ts:94-109` (openHandle + mismatch mapping); `plugin.mjs:438-440` |

## 4. Product module under test (P5-T6, this task)

| Surface | Purpose | Origin (file:line) |
| --- | --- | --- |
| `deriveMemberIdentity(spec)` | Pure derivation of the durable member identity `(instanceId, childSessionId)` from the creation spec. | `packages/runtime/member-residency/identity.ts` (exported via `packages/runtime/member-residency/index.ts`) |
| `createFreshMember(ports, spec)` | Fresh create: derived identity, convergent durable commit (record + `team-member` binding), three overlay slots installed, admission decided. | `packages/runtime/member-residency/fresh-member.ts:155-275` |
| `rehydrateColdMember(ports, identity)` | Cold resume: rehydrate from durable state, zero fresh side effects, scope restore + admission re-decision. | `packages/runtime/member-residency/cold-member.ts` |
| `evictSettledMember(ports, identity)` | Evict a SETTLED member: drops ephemeral residency only; the handle may be absent; durable records are NOT deleted. | `packages/runtime/member-residency/evict.ts` |
| `createMemberDomainWritePort(repositories)` | The row's write port over the TeamDomain repositories (audited by the proxy in the harness). | `packages/runtime/member-residency/write-port.ts` |

## 5. Durable on-disk artifacts (DSH_HOME)

| Artifact | Purpose |
| --- | --- |
| `storages/team_domain.json` | The `team_domain` unit document (storage-json backend): I1b corrupts `unit.version`→999 pre-boot; the failed boot must fail loudly and leave the bytes UNCHANGED. |
| `sessions/<project>/…` session logs | Durable child Session logs — M2 cold resume requires the durable child; I1c deletes only the `member_instances` row (the session log survives); M5 proves the probe submitted nothing (event count unchanged). |
| `.agent-presets/p5t6-leader-persona/`, `.agent-presets/p5t6-member-persona/` | DSH_HOME-local user persona presets (the T5 row and the T6 row each compose their own). |
| `profiles/web/cordis.patch.yml` | The composition patch file the driver appends rows to before each boot. |

## 6. Test-infrastructure surfaces (owned, not product)

| Surface | Purpose | Origin |
| --- | --- | --- |
| `DshInstance` (spawn / start / dumpConfig / stop / mountRows / rowInDump) | The real-OS-process driver: spawn `node apps/cli/lib/bin.js web --port N --no-open` with file-FD stdio, wait for the boot marker, kill the real process (I1a). | `tests/characterization/lib/instance.mjs` (read-only reuse) |
| `ensureProfile` / `mountRows` / `ensureProbeResolution` / `portInUse` / `waitForPortFree` / `waitForLogLine` / `spawnToLog` / `captureGitState` | Harness plumbing (profile init, row mount, resolution farm for the prebuilt packages, port hygiene, git-pristine capture). | `packages/runtime/root-binding/harness/{run.mjs,util.mjs}` (read-only reuse) |
| mini MCP server (127.0.0.1, ports 3491–3495 candidates) | A real MCP endpoint behind the capability slot's `mcp__p5t6mini__ping` tool (no real LLM; distinct port range from T5's 3481–3485). | `packages/runtime/root-binding/harness/mini-mcp.mjs` (read-only reuse) |
| `ts-loader.mjs` (Node resolve hook) | Rewrites worktree-relative `.js` specifiers to `.ts` siblings so the rows load this repository's TS sources natively (Node ≥ 23.6 type stripping; verified on Node v24.20.0). | `packages/runtime/root-binding/harness/ts-loader.mjs` (read-only reuse) |
