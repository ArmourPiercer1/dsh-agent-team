# B-TEAM rev-2 row derivation note (window-1 mount) — PREPARE ONLY, evidence per field, no invention

Sources, all READ-ONLY, all from the **packed candidate face** unless stated:
`FACE = tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b/node_modules/dsh-agent-team`
(`dsh-agent-team@0.1.1-alpha.2`, sha256 `c8dd3f07b9…`, resolved via its own `exports["./host"]`).
Patch mechanics: skill `cordis-composition-reference` §"Loader patch dialect" + the last real mounted patch
`tests/homes/a5m2-c2-r17-20261023T15-03-57Z/profiles/web/cordis.patch.yml` (**shape only — its values are the
A-TODO face and are NOT adopted**; center's probe and my own read agree: r17 line 38 `todoEnabled: true`).

## 1) The B-TEAM family is NOT a row field — the packed glue owns it (measured)

| evidence | content |
|---|---|
| `FACE/packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs:453-458` | `A5M2-B-TEAM-WIRE … import { claimTeamOpsFamily } from './governed-families/team-wiring.mjs'` — the CLAIM is computed by the bridge's own capture predicate over the member's lane set |
| same file `:2540-2548` | "THE REAL REGISTRATION SOURCE. The mount registers the B-TEAM family …" (durable registry LIVE per call) |
| same file `:2842-2843` | the B-TEAM block sits "at the site the adapter itself designates for B-TEAM registration" |
| same file `:4118-4140` | refusal path: ``agent-bindings: alpha.5 governed B-TEAM member-operation mount refused for '${sessionId}': ${teamOpsBad}`` |

Consequence (measured, not inferred): `callerGate`, `pa`, `queryFacts`, `registrationOf`, `settled` **never appear as
plane/row config keys** — `grep -nE "callerGate|queryFacts|registrationOf" …/live/team-tool-plane.mjs` returns **no
config-key hits** (they are plane-owned bridge inputs, the closed set at `team-wiring.mjs:385`). A row that tried to
declare them would be inventing vocabulary.

## 2) Field set the PACKED row validator actually requires (`…/plugin/host.js`)

| field | requirement (packed line) | window-1 draft value | status |
|---|---|---|---|
| `bootPhase` | must be `"create" \| "resume" \| "create-or-open"` (`host.js:259-260`) | `create` | derived |
| `rootSessionId` | non-empty string (`:261-262`) | `session-a5m2-team-c2-h1-<stamp>` | derived (name = convention, flagged in §4) |
| `blueprintSource` | non-empty string (`:263-264`) | the lane v3 artifact text `team.a5nx-main` (`schemaVersion: 3`, `revision: "1"`) | derived |
| `blueprintDir` | optional; non-empty when present (`:269-270`) | `<this HOME>/blueprints` | derived |
| `seedMembers` | must be an array (`:275-276`) | `[]` (window-1 creates no members) | derived |
| `glueUrl` / `seamUrl` | row-owned `config.glueUrl`; alternatively the location-derived glue/seam (`host.js:34`, `:39`) | resolved by `candidateMount()` from the face: `…/live/agent-bindings.mjs`, `…/root-binding/harness/seam.mjs` | derived (already implemented) |

## 3) Plane mount inputs (`…/live/team-tool-plane.mjs`)

| evidence | content | consequence for a B-TEAM row |
|---|---|---|
| `:868-870` | mount input shape `{ permissionPolicy, realmId, templateId, role, instanceId, plane?: { realmId, names?, confinedProvider?, definitionOwnerAuthority?, fsInstance?, globEnabled? } }` | these are the **closed** plane keys; nothing else may be declared |
| `:889-890` | `realmId` and `templateId` required, else `PLANE_CONFIG_INCOMPLETE` | both must be non-empty strings |
| `:953-965` | `plane.todoEnabled` optional boolean; **if true without an injected governed todo arm → refusal** ("the mount would mask the native tool") | **the B-TEAM row must OMIT `todoEnabled` / `writeEnabled` / `imageEnabled`** — they are the A-TODO family gates (r17 carries them; copying them would make window-1 an A-TODO mount, exactly what center warned about) |
| `grep webSearchFixed|searchMaxResults` in this file | **no hit** | not a B-TEAM row key on the packed face; it belongs to the search family and its deployment cap stays an open obligation (e78 card) |

## 4) Drafted row (shape per the loader dialect; **not written into any world, not booted**)

```yaml
# A5M2 B-TEAM window-1 mount layer (world a5m2-team-c2-h1-<stamp>): production row resolved from the
# frozen install-c8dd3f07b ROOT-level package via its OWN exports["./host"] leg.
- insert:
    - id: "dsh-agent-team"
      name: "file:///…/install-c8dd3f07b/node_modules/dsh-agent-team/packages/runtime/dist/packages/runtime/src/plugin/host.js"
      config:
        rootSessionId: "session-a5m2-team-c2-h1-<stamp>"      # host.js:261-262
        bootPhase: "create"                                    # host.js:259-260
        blueprintSource: "<v3 artifact text, team.a5nx-main>"  # host.js:263-264
        blueprintDir: "<this HOME>/blueprints"                 # host.js:269-270
        seedMembers: []                                        # host.js:275-276  (window-1 creates no members)
        generation: 1
        glueUrl: "file:///…/live/agent-bindings.mjs"           # host.js:34
        seamUrl: "file:///…/root-binding/harness/seam.mjs"
        staticModel: <GAP-STATIC-MODEL>                        # §5, not derivable
        deniedSelection: null
        mcpServers: []
        mcpServer: null
        environmentFacts: <GAP-ENV-FACTS>                       # §5, not derivable for B-TEAM
        externalPolicyFacts: { hard: {}, capabilityExists: {} }
        teamToolPlane:
          realmId: "<GAP-REALM-NAMING>"                        # plane:889-890 requires non-empty string
          # NO todoEnabled / writeEnabled / imageEnabled  (plane:953-965 — A-TODO gates only)
          fsInstance: <GAP-FS-ROOT>                            # §5
```
`config` is **replaced wholesale** by a patch layer (skill §Loader dialect: "restate every field the row needs"),
which is why the whole block is drafted rather than partially patched.

## 5) NAMED GAPS — value not derivable from the packed artifact + skills/docs (STOP, do not invent)

* **`GAP-STATIC-MODEL`** — `host.js` does not constrain the values; r17's `deepseek-official/deepseek-flash` (and the
  gate-model spelling in the kit) belong to the A-TODO face. Whether window-1 (read-only `team_list_members`, no
  member work) exercises a model route at all, and what spelling the row must carry, is **not** established by the
  packed files.
* **`GAP-ENV-FACTS`** — r17's `environmentFacts` triples (`tool/web`, `skill/base`, `persona/standard`) are the A-TODO
  disclosure set; the B-TEAM requirement set is not stated in the packed face.
* **`GAP-FS-ROOT`** — r17 sets `fsInstance.rootDir` to a *worktree's* `tests/deepseek-harness-test-use`; the law for a
  B-TEAM window world (the governed native workspace root?) is not derivable from the packed files.
* **`GAP-REALM-NAMING`** — only "non-empty string" is enforced (`:889-890`); r17's `a5m2c2-realm--<suffix>` is a kit
  convention, not law.
* **`GAP-PERMISSION-POLICY`** — `permissionPolicy` appears in the plane mount input (`:868`) but is absent from r17's
  row `config`, so it is host-supplied somewhere I have not proven; its origin stays unverified rather than guessed.
* **`GAP-LEADER-SESSION-DERIVATION`** — the create answer's leader session id is not a closed field I can point at;
  the driver refuses the members leg rather than fabricating it (`C-LEADER-MEMBERS` fails with "never faked").

## 6) Schema validation status

My kit has `validateRow()` (row-record level: family/rev/criteria/world/port/ceilings) and it passes; the **authority**
for the patch `config` is the packed `host.js` validator, which runs **only inside a booting Host** — so the draft
above is validated against the validator's *code* (line-cited), not by executing it. `MOUNT-ASSEMBLY-INCOMPLETE`
stays open until the six gaps above are answered by root/center; nothing here is booted, and no world was written.

## 7) CLOSURE (same round, after center's six answers) — all six gaps resolved; `MOUNT-ASSEMBLY-INCOMPLETE` CLOSED

| gap | resolution | evidence |
|---|---|---|
| `GAP-STATIC-MODEL` | **closed** — local scripted mock only (`provider: 'deepseek-official'`, `model: 'a5m2team-c2h1-gate-model'`), host pointed at `http://127.0.0.1:<mockPort>` with a **non-secret dummy** `DEEPSEEK_API_KEY`; localhost only, no external/paid LLM | boot body in the runner (`C-MOCK-MODEL` leg); decide = `makeLeaderMembersDecide` (exactly one `team_list_members` call, then done) |
| `GAP-ENV-FACTS` | **closed as legal-empty** — `environmentFacts: []`, nothing asserted as available; `externalPolicyFacts: { hard: {}, capabilityExists: {} }` | center answer (2); row assembly `bteamRowConfig` |
| `GAP-FS-ROOT` | **closed** — `fsInstance.rootDir` = THIS window HOME (`tests/homes/a5m2-team-c2-h1-<stamp>`) and nothing else, `kind: 'absolute-path'`, fs name `a5m2-team-c2-h1-governed`; r17's worktree-test-use root is NOT copied | `validateMountLayer` refuses any other rootDir and any path outside `tests/homes/` |
| `GAP-REALM-NAMING` | **closed** — `realmId = a5m2-team-c2-h1--<stamp-suffix>` minted with the stamp, used identically at plane and `fsInstance` | `validateMountLayer` refuses a mismatch |
| `GAP-PERMISSION-POLICY` | **closed from packed code** — the row declares **no** `permissionPolicy`; the glue supplies it from the blueprint's own template lanes: `live/agent-bindings.mjs:2310` `const permissionPolicy = boundTemplate.capabilities?.permissions`, and the plane refuses `NOT_GOVERNED` without it: `live/team-tool-plane.mjs:886-887`. The v3 blueprint's allow/ask/deny lanes keep REAL approvals; **no allow-all anywhere** (`validateMountLayer` refuses a leaked lane, `ATODO_PLANE_KEYS` also blocks a row-level `permissionPolicy`) | both cited lines + the validator |
| `GAP-LEADER-SESSION-DERIVATION` | **closed from packed code** — the leader IS the team root session: `live/agent-bindings.mjs:4744` `role: sessionId === String(teamRoot) ? 'leader' : 'member'`, restated at `:7612` ("the leader IS the root session"); the driver therefore takes the leader session from THIS create answer's `rootSessionId` at runtime and never hard-fills an older id | both cited lines; `C-LEADER-BINDING` leg |

Executed without a Host (`--window-replay`, direct `REPLAY_RC_DIRECT=0`, 13/13 legs green, saved as
`A5M2-TEAM-C2-WINDOW1-REPLAY.json`): fresh-home path+stamp, ceilings 300000 ms / 67108864 B, mount from the
package's own exports, artifact gate (`gate_status=ok id=team.a5nx-main revision=1`), identity preflight,
row assembled, mount-layer validated, profile layer rendered (34 lines, `blueprintSource` inlined per the r17
mechanism), permission source, leader binding, mock decide. `node --check` 0, cold import 0, selftest 0
(`contractTrueCount: 37, contractFalse: []`).
**Still Host-gated and NOT executed:** `C-BOOT`, `C-READINESS-BARRIER`, `C-CREATE-ONCE`, `C-LEADER-MEMBERS`,
`teardown` — the layer is written only inside the window, and the profile patch file has still never been read
by a booting Host, so `C-MOUNT-BOOTED` is asserted nowhere. Nothing booted, no world written by this round.
