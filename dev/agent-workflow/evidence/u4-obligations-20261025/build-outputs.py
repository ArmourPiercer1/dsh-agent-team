#!/usr/bin/env python3
# U4-B (G1-F) builder — ExpectedToolObligations / mechanism-groups / feasibility
# Static classification ONLY. Every claim cites a file:line that was re-read in this
# work package (this session) or carries an explicit provenance label
# (U1-C census = build-time re-asserted lines; matrix = docs/plans/active file).
import json, hashlib, os

OUT = os.path.dirname(os.path.abspath(__file__))

MASTER = "master@3288567d36794394ce2af0401cee4fe218b11d03"
HOST   = "tests/deepseek-harness-test-use @639ed015397290b3745d163aafe02ffee4aa3f84 (0.2.0-rc.2, read-only)"
BR360  = "origin/feat/a5-m2-integration@bef38934f (PR #360, OPEN/DRAFT, NOT merged — WIP asset, evaluated by source only, never assumed assembled)"
CENSUS = "dev/agent-workflow/evidence/u1-closure-20261025/u1c/host-tools.json (U1-C; every file:line build-time re-asserted)"
TEAMC  = "dev/agent-workflow/evidence/u1-closure-20261025/u1c/team-tools.json (U1-C; pin 4aaaa7b2, anchors re-verified on master 3288567d this session)"
SEED   = "dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/route-records-v3c.json"
SEEDC  = "dev/agent-workflow/evidence/s1-m0-closure-v3-seeds/M0-B-FAMILY-TARGET-CONTRACTS.md"
BACKLOG= "docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md"
# matrix = docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md; L<n> = line in that file (re-read on master this session)
MX = "docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md"

# --- verified public-seam anchors, host @639ed015 (all personally re-read this session) ---
RT = "tests/deepseek-harness-test-use/packages/core/tools/src/index.ts"
H_SEAM = {
  "register":  RT + ":1063 (public tools.register(definition) -> disposer)",
  "guard":     RT + ":1136 (public tools.guard(guard)); guard evaluation loop " + RT + ":768-770",
  "restrict":  RT + ":1121 (layer.restrictions.append; masked names)",
  "resolve":   RT + ":1247-1252 (resolveExecution: name+scope -> ToolDefinition)",
  "toctou":    RT + ":1578-1581 (AFTER the pre/guard stage, dispatch RE-RESOLVES by name and invokes the body; re-resolve also at :1807 and :1876) — this is the H0 target",
  "schemas":   RT + ":1259 (public scoped schemas view)",
}

# --- verified team/master anchors (personally re-read this session at 3288567d) ---
TTP = "packages/runtime/src/plugin/live/team-tool-plane.mjs"
AB  = "packages/runtime/src/plugin/live/agent-bindings.mjs"
T_SEAM = {
  "plane_header": TTP + ":8 (mount = tools.register of each reviewed Definition into the governed agent's own layer)",
  "plane_names":  TTP + ":84 (DEFAULT_PLANE_NAMES team_grep/team_glob/team_bash)",
  "reserved":     TTP + ":402-403 (PLANE_RESERVED_NATIVE, pinned host 0.2.0-rc.2@639ed01539; 68 names per U1-C seed-diff reservedNameTableVsHost)",
  "prefix":       TTP + ":464 (PLANE_RESERVED_NATIVE_PREFIXES=['mcp__'])",
  "takeovers":    TTP + ":465-477 (PLANE_SUPPORTED_NATIVE_TAKEOVERS: bash:['bash'], read:['read'], grep/glob:[], jobs:['job_output','job_list','job_kill'])",
  "claim_refuse": TTP + ":492-494 (PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED: no same-name/same-meaning implementation assembled = mount refused; this is why write/edit/'todo' cannot take native names today)",
  "glob_off":     TTP + ":759-767 (globEnabled closed consumption key)",
  "jobs_off":     TTP + ":775-783 (jobsEnabled default OFF: enabled only when === true)",
  "jobs_rows":    TTP + ":1684-1722 (governed job_list/job_kill rows at fixed native spellings, shut face when bridge absent)",
  "read_row":     TTP + ":1726-1780 (governed read takeover row definition, native file_path shape)",
  "ab_mcp_prefix": AB + ":723-725 (GUARD_NATIVE_TRUST_EXCLUDED_MCP_PREFIX='mcp__'; mcp__ never inherits dsh-native guard trust)",
  "ab_mcp_name":  AB + ":1567 (agent-scope prefix mcp__<server>__)",
  "ab_guard":     AB + ":2324,2491 (per-agent a5p1 Guard built + installed in the setup callback)",
  "ab_trusted":   AB + ":2359-2460 (trusted-native-list harvest, fail-closed empty list on error)",
  "ab_team_reg":  AB + ":2536-2555 (team tool selector + registration loop via agentCtx.tools.register at :2553)",
  "ab_plane":     AB + ":2623 (createTeamToolPlaneAssembly), :2697 (built.value.mount(agentCtx))",
  "ab_mcp_mount": AB + ":2927 (filterMcpServers), :3003 (bindOwnTools), :3017 (bindMcpTools), :3027 (publish)",
  "install_seq":  "packages/runtime/tool-dispatch/install.ts:1-12 (documented order: tools.guard -> tools.restrict mask -> tools.register dispatcher -> validate -> PUBLISH)",
  "cwc":          "packages/runtime/tool-dispatch/closed-world-guard.ts:357 (createGovernedSurface), :553 (guardDecision)",
  "pa_mount":     "packages/runtime/src/plugin/live/pa-mount-registry.mjs:1-15 (CURRENT mount index + call-level facts; NO name lookup believed)",
  "admit":        "packages/runtime/tool-admission/admission-kernel.ts (1132 lines, PA admission kernel; file present on master)",
  "control":      "packages/runtime/control/service.ts + packages/tools/src/guard.ts:72-91 (consultGuard -> ControlService.guardOperation, fail-closed)",
  "jobs_bridge":  "packages/runtime/src/plugin/live/plane-effect-backends.mjs:1579 (createGovernedJobsBridge over host JobRegistry public face)",
  "rg_public":    "packages/runtime/src/plugin/live/plane-effect-backends.mjs:296-306,512 (host PUBLIC buildGrepCommand/parseGrepMatches/resolveRgPath over confined rg)",
  "sandbox":      "packages/runtime/sandbox-provider/provider.ts:146,731 (spawnStreaming arm; launcher --confined-exec-stream)",
  "lsp_asm":      "packages/runtime/sandbox-provider/lsp-assembly.ts:174-191 (per-instance spawnStreaming assembly)",
  "ptc_row":      "packages/runtime/src/plugin/live/ptc-escalation-row.mjs:1-14 (PTC fs escalation row on host public approval/request waterfall)",
  "cov_gate":     "packages/runtime/operation-permission/permission-coverage.ts:1-9 (Coverage Gate: every final model-facing tool needs an authority owner)",
  "team_tools":   "packages/tools/src/tools.ts:498..:1197 literal team_* ToolSpecs + :1373 grant/revoke + :1524 createTeamTools; consumed packages/runtime/src/plugin/root.ts:3919",
  "a5p5_dormant": "packages/tools/a5p5-tools/src/index.ts:12-13 (DORMANT: nothing registers, nothing dispatches)",
}

# M0-B §2 role hints (M0-B-FAMILY-TARGET-CONTRACTS.md §2; roles are engineering roles,
# "待中心分配给实际writer" -> person owner is UNKNOWN everywhere)
ROLE = {"CENTER":"M0-B §2 CENTER","AUTH":"M0-B §2 AUTH","FS-PROC":"M0-B §2 FS-PROC",
        "SERVICE":"M0-B §2 SERVICE","CONNECTOR":"M0-B §2 CONNECTOR","CONTROL":"M0-B §2 CONTROL",
        "PLUGIN":"M0-B §2 PLUGIN"}

W360 = "packages/runtime/src/plugin/live/governed-families/"  # #360-branch family adapters

def E(path_note): return path_note

def entry(name, obligation, source, scope, effect, route, evid, unknowns,
          out_reason=None, role=None, matrix=None):
    d = {
        "name": name,
        "obligation": obligation,                      # REQUIRED | OUT_OF_SCOPE
        "source": source,
        "scope_variant": scope,
        "effect_class": effect,
        "candidate_route": route,
        "supporting_evidence": evid,
        "owner": "UNKNOWN",
        "owner_role_hint": role or "UNKNOWN (M0-B §2 assigns role classes, no named writer yet)",
        "unknowns": unknowns,
        "matrix_row": matrix,
    }
    if obligation == "OUT_OF_SCOPE":
        d["out_of_scope_reason"] = out_reason
    return d

HOSTSRC = lambda f, l, extra="": f"host {f}:{l} ({extra}registered site per {CENSUS})" if extra else f"host {f}:{l} ({CENSUS})"

HOST_ROWS = []  # rows: name, file, line, obligation, scope, effect, route, matrix, extra_ev, unknowns, out_reason, role

# ---- FS family ----
HOST_ROWS += [
 dict(n="read", f="packages/fs/tool-fs/src/read.ts", l=77, ob="REQUIRED",
      sc="host base bundle (bundle/base/cordis.patch.yml:281-282) + Team plane takeover row at native spelling 'read'",
      ec="read-fs", rt="ordinary-family", mx="L21 main row M-01 (LIVE-CONFIRMED scope=@dad3, baseline NOT re-verified, V@B=no)",
      ev=[T_SEAM["takeovers"], T_SEAM["read_row"], T_SEAM["ab_plane"], T_SEAM["pa_mount"], T_SEAM["admit"]],
      un=["row-level approval positive not re-verified on baseline (matrix L21)", "H0 dispatch-identity property unproven"]),
 dict(n="write", f="packages/fs/tool-fs/src/write.ts", l=72, ob="REQUIRED",
      sc="host base bundle; NO Team governance arm on master",
      ec="write-fs", rt="ordinary-family", mx="L22 main row M-02 (NOT_IMPLEMENTED/NOT_WIRED)",
      ev=[T_SEAM["claim_refuse"] + " — native-name takeover for 'write' is refused today",
          "WIP #360: " + BR360.split(' ')[0] + " " + W360 + "write.mjs + packages/tools/a5p5-tools/src/write-slice.ts (unmerged, C2 pending)"],
      un=["no governed write row on master; #360 arm is WIP (PR body: 'NOT mounted', 'C2 pending')", "pre-Body deny for a replaced write row depends on H0"]),
 dict(n="edit", f="packages/fs/tool-fs/src/edit.ts", l=84, ob="REQUIRED",
      sc="host base bundle; no Team arm on master",
      ec="write-fs", rt="ordinary-family", mx="L23 main row M-03 (NOT_IMPLEMENTED/NOT_WIRED)",
      ev=["WIP #360: " + W360 + "edit.mjs (unmerged)"],
      un=["read-before-edit semantics untested", "no master implementation"]),
 dict(n="str_replace_editor", f="packages/fs/tool-str-replace-editor/src/index.ts", l=429, ob="REQUIRED",
      sc="host catalog name; NOT mounted in any shipped bundle/preset (census gating line) — obligation attaches only if mounted",
      ec="write-fs", rt="ordinary-family", mx="L24 main row M-04 (NOT_IMPLEMENTED); A-1 L62 '[独立包；装载条件待核（default 未证）]'",
      ev=[SEED + " record req=REQ-COND gap=NONE_SHIPPED"],
      un=["Host-side registration condition for shipped worlds unverified", "subcommand-level mapping is design-only (matrix L24)"]),
 dict(n="read_image", f="packages/fs/tool-fs/src/read-image.ts", l=209, ob="REQUIRED",
      sc="host base bundle; additionally mounted only with ctx.attachments (docs/tool-catalog.md note via census)",
      ec="read-fs", rt="ordinary-family", mx="L25 main row M-05 (NOT_VERIFIED)",
      ev=["attachment-write side effect identified in " + SEEDC + " §3 B-IMAGE (attachment-store create)",
          "WIP #360: " + W360 + "image.mjs + image-attachment.mjs (unmerged)"],
      un=["whole chain untested (matrix L25)", "attachment-store write is not a pure read — dual effect"]),
 dict(n="grep", f="packages/fs/tool-fs-search/src/grep.ts", l=284, ob="REQUIRED",
      sc="host base bundle (native name, unmasked on Team default plane: takeover grep=[])",
      ec="read-fs", rt="ordinary-family", mx="L26 main row M-06 native (NOT_VERIFIED; confined-rg backend belongs to alias/plane lane, not this native row)",
      ev=[T_SEAM["takeovers"] + " (grep/glob rows cannot take native names today)", T_SEAM["rg_public"]],
      un=["native row-level effect proof not done (matrix L26)"]),
 dict(n="glob", f="packages/fs/tool-fs-search/src/glob.ts", l=306, ob="REQUIRED",
      sc="host base bundle (native name; independent shut key a5-globoff)",
      ec="read-fs", rt="ordinary-family", mx="L28 main row M-06 native (NOT_VERIFIED); A-1 L64",
      ev=[T_SEAM["glob_off"]],
      un=["runtime re-verification of #342/#343/#354 judgement lines is open backlog BL-19 (" + BACKLOG + " L36)"]),
 dict(n="team_grep", f="packages/runtime/src/plugin/live/team-tool-plane.mjs", l=84, ob="REQUIRED",
      sc="Team plane alias row (governed agents only)", ec="read-fs", rt="ordinary-family",
      mx="L27 main row M-06 alias (WIRED: production registration proven, row-level acceptance missing)",
      ev=[T_SEAM["plane_names"], T_SEAM["rg_public"], T_SEAM["ab_plane"]],
      un=["approval loop for this row NOT_VERIFIED (matrix L27)"]),
 dict(n="team_glob", f="packages/runtime/src/plugin/live/team-tool-plane.mjs", l=84, ob="REQUIRED",
      sc="Team plane alias row", ec="read-fs", rt="ordinary-family",
      mx="L29 main row M-06 alias (WIRED)",
      ev=[T_SEAM["plane_names"], T_SEAM["glob_off"]],
      un=["approval loop NOT_VERIFIED (matrix L29)"]),
]

# ---- shell / jobs ----
HOST_ROWS += [
 dict(n="bash", f="packages/shell/tool-bash/src/index.ts", l=373, ob="REQUIRED",
      sc="host base bundle (one-shot variant; persistent same-name only in minimal/sdk-minimal presets) + Team native takeover at 'bash'",
      ec="process", rt="ordinary-family", mx="L30 main row M-07 native (LIVE-CONFIRMED scope=@1fb14c4d front-takeover, baseline NOT re-run)",
      ev=[T_SEAM["takeovers"], T_SEAM["sandbox"], T_SEAM["admit"]],
      un=["background producer arm not merged (backlog BL-17, " + BACKLOG + " L34)", "host bash body itself not personally re-read (matrix L30)"]),
 dict(n="team_bash", f="packages/runtime/src/plugin/live/team-tool-plane.mjs", l=84, ob="REQUIRED",
      sc="Team plane alias row; default-ask combination is the reproduced R2 breach",
      ec="process", rt="ordinary-family", mx="L31 main row M-07 alias (BLOCKED-FOR-RELEASE)",
      ev=[BACKLOG + " L13 BL-01: OPEN RELEASE BLOCKER — approval penetration request=0/body=1 under real ToolRuntime+Guard isolation",
          T_SEAM["sandbox"]],
      un=["R2 must be closed before any G1-F PASS claim for this row (BL-01)", "penetration diagnosis evidence not yet in git (BL-18)"]),
 dict(n="pwsh", f="packages/shell/tool-pwsh/src/index.ts", l=383, ob="REQUIRED",
      sc="host base bundle; presets platform-gate disabled-unless-win32 (seed reqSrc); win32-only parity",
      ec="process", rt="ordinary-family", mx="L32 main row M-07 (NOT_VERIFIED)",
      ev=["WIP #360: " + W360 + "pwsh-arm.mjs + pwsh-wiring.mjs (unmerged; PR body marks the win32 leg ENV-NOT-AVAILABLE)"],
      un=["no win32 provider/environment on this Linux test host", "cannot reuse bash acceptance (M0-B §3 B-PROCESS: pwsh must be really Windows-proven)"]),
 dict(n="job_list", f="packages/jobs/tool-jobs/src/index.ts", l=351, ob="REQUIRED",
      sc="host base bundle + Team governed jobs rows at FIXED spelling under jobsEnabled (default off)",
      ec="process", rt="bridge:Jobs", mx="L33 main row M-11 (LIVE-CONFIRMED scope=@efb5bb55 C3 24/24, baseline NOT re-run)",
      ev=[T_SEAM["jobs_rows"], T_SEAM["jobs_off"], T_SEAM["jobs_bridge"]],
      un=["production JobRegistry body not diffed (matrix L33)", "default-off = not default-published"]),
 dict(n="job_output", f="packages/jobs/tool-jobs/src/index.ts", l=310, ob="REQUIRED",
      sc="same trio as job_list", ec="process", rt="bridge:Jobs", mx="L34 main row M-11 (LIVE-CONFIRMED)",
      ev=[T_SEAM["jobs_rows"], T_SEAM["jobs_bridge"]], un=["full-dependency applicability NOT_VERIFIED (matrix L34)"]),
 dict(n="job_kill", f="packages/jobs/tool-jobs/src/index.ts", l=371, ob="REQUIRED",
      sc="same trio; kill-requested != terminated semantics kept", ec="process", rt="bridge:Jobs",
      mx="L35 main row M-11 (LIVE-CONFIRMED)",
      ev=[T_SEAM["jobs_rows"], T_SEAM["jobs_bridge"]],
      un=["terminated-confirmation uncertainty on record (matrix L35)"]),
 dict(n="terminal_open", f="packages/terminal/tool-terminal/src/index.ts", l=163, ob="OUT_OF_SCOPE",
      sc="opt-in package, zero rows in packages/bundle (census gating)", ec="process", rt="ordinary-family",
      mx="A-2 L69-75 [opt-in] rows are UNKNOWN gap registrations, not acceptance rows",
      ev=[SEED + " req=REQ-COND gap=OPTIN_UNMANAGED_IF_MOUNTED"], out_reason="not mounted in shipped bundle (opt-in package); obligation attaches only if a Team config mounts it (seed PB15 rule)", un=[]),
 dict(n="terminal_close", f="packages/terminal/tool-terminal/src/index.ts", l=359, ob="OUT_OF_SCOPE",
      sc="same as terminal_open", ec="process", rt="ordinary-family", mx="A-2", ev=[], out_reason="opt-in; not mounted in shipped bundle", un=[]),
 dict(n="terminal_list", f="packages/terminal/tool-terminal/src/index.ts", l=390, ob="OUT_OF_SCOPE",
      sc="same as terminal_open", ec="process", rt="ordinary-family", mx="A-2", ev=[], out_reason="opt-in; not mounted in shipped bundle", un=[]),
 dict(n="terminal_read", f="packages/terminal/tool-terminal/src/index.ts", l=301, ob="OUT_OF_SCOPE",
      sc="same as terminal_open", ec="process", rt="ordinary-family", mx="A-2", ev=[], out_reason="opt-in; not mounted in shipped bundle", un=[]),
 dict(n="terminal_send", f="packages/terminal/tool-terminal/src/index.ts", l=198, ob="OUT_OF_SCOPE",
      sc="same as terminal_open", ec="process", rt="ordinary-family", mx="A-2",
      ev=[SEED + " gap adds shell-rules-key-bash-pwsh-only(plane:519)"], out_reason="opt-in; not mounted in shipped bundle", un=[]),
 dict(n="terminal_signal", f="packages/terminal/tool-terminal/src/index.ts", l=334, ob="OUT_OF_SCOPE",
      sc="same as terminal_open", ec="process", rt="ordinary-family", mx="A-2", ev=[], out_reason="opt-in; not mounted in shipped bundle", un=[]),
]

# ---- lsp / web / skill / todo ----
HOST_ROWS += [
 dict(n="lsp", f="packages/lsp/tool-lsp/src/index.ts", l=109, ob="REQUIRED",
      sc="opt-in host package (not in shipped bundle rows) + Team P-LSP production assembly face on master; runtime needs a registered ctx.lsp provider",
      ec="process", rt="bridge:LSP", mx="L40 main row M-09 (LIVE-CONFIRMED scope=@1d0d03d0 real clangd/tsserver minimal interaction; family-level GO not claimed)",
      ev=[T_SEAM["lsp_asm"], T_SEAM["sandbox"]],
      un=["not mounted in default shipped presets (census gating line)", "Strict Profile/UI/family GO not reached (matrix L40)", "applicability to baseline NOT_VERIFIED (matrix L40)"]),
 dict(n="web_fetch", f="packages/web/tool-web/src/fetch.ts", l=456, ob="REQUIRED",
      sc="host base bundle; NO production Team provider assembly", ec="network", rt="ordinary-family",
      mx="L37 main row M-10 (NOT_VERIFIED; loopback deny-list at fetch call site, fixture 10/10)",
      ev=["fixture evidence @PR7: evidence/alpha5/pr7/ per matrix L37"],
      un=["real outbound endpoint never tested; no authorized outbound = ENV (matrix L37)", "Web belongs to the MCP/Web Bridge candidate list (this-package refs/center-assembly-architecture.md §6 L135)"]),
 dict(n="web_search", f="packages/web/tool-web/src/search.ts", l=325, ob="REQUIRED",
      sc="host base bundle; no production provider assembly", ec="network", rt="ordinary-family",
      mx="L36 main row M-10 (NOT_VERIFIED)", ev=[],
      un=["search-target vs result-URL two-layer object unresolved (matrix L36)", "no authorized network in test env = ENV"]),
 dict(n="skill", f="packages/skill/tool-skill/src/index.ts", l=81, ob="REQUIRED",
      sc="host base bundle", ec="read-fs", rt="ordinary-family",
      mx="A-3 L83 [分档未核] — matrix-listed; no acceptance row yet",
      ev=["host body resolves skill files by exec.agent cwd (tests/deepseek-harness-test-use/packages/skill/tool-skill/src/index.ts:133,186 — personally re-read)"],
      un=["no governance mount on master; no matrix acceptance row (gap registration)"]),
 dict(n="load_workspace_dependencies", f="packages/skill/tool-workspace-dependencies/src/index.ts", l=249, ob="OUT_OF_SCOPE",
      sc="mounted only in sdk-app bundle (census gating line)", ec="write-fs", rt="ordinary-family",
      mx="A-3 L84 [分档未核]", ev=[SEED + " req=REQ-COND (sdk-app env-gate) gap=READ_KIND_MASKS_WRITE(index.ts:275)"],
      out_reason="not part of the shipped web/Team composition (sdk-app bundle only)", un=[]),
 dict(n="todo_write", f="packages/todo/tool-todo/src/index.ts", l=135, ob="REQUIRED",
      sc="host base bundle; Team plane reserved name (governed-scope, not excluded)", ec="session/agent-control",
      rt="ordinary-family", mx="L45 main row M-14 (NOT_VERIFIED; static registration proven)",
      ev=[T_SEAM["reserved"] + " (todo_write in the 68-name reserved table)",
          "WIP #360: " + W360 + "todo.mjs (unmerged; PR body: '未 mount')"],
      un=["per-tool approval/functionality never verified (matrix L45)"]),
]

# ---- goal / schedule / session ----
GOALEV = []
HOST_ROWS += [
 dict(n="create_goal", f="packages/goal/tool-goal/src/index.ts", l=207, ob="REQUIRED",
      sc="host base bundle", ec="session/agent-control", rt="ordinary-family",
      mx="A-4 L88 [分档未核] — matrix-listed; UNKNOWN gap",
      ev=["host body persists a same-session goal (tests/deepseek-harness-test-use/packages/goal/tool-goal/src/index.ts:3 — personally re-read)"],
      un=["no governance mount on master; effect identity = session state write, no enumerated Bridge covers it"]),
 dict(n="get_goal", f="packages/goal/tool-goal/src/index.ts", l=195, ob="REQUIRED",
      sc="host base bundle", ec="session/agent-control", rt="ordinary-family", mx="A-4 L89", ev=[],
      un=["no governance mount; no acceptance row"]),
 dict(n="update_goal", f="packages/goal/tool-goal/src/index.ts", l=234, ob="REQUIRED",
      sc="host base bundle", ec="session/agent-control", rt="ordinary-family", mx="A-4 L90", ev=[],
      un=["no governance mount; no acceptance row"]),
 dict(n="schedule_create", f="packages/schedule/schedule/src/tools.ts", l=416, ob="OUT_OF_SCOPE",
      sc="NOT mounted as tool rows in shipped bundles; registers only while the Schedule service is loaded (census gating)", ec="session/agent-control",
      rt="ordinary-family", mx="A-4 L91", ev=[SEED + " req=REQ-COND shipped-off"],
      out_reason="no shipped-bundle tool rows today; obligation attaches if a world loads the Schedule service", un=[]),
 dict(n="schedule_delete", f="packages/schedule/schedule/src/tools.ts", l=469, ob="OUT_OF_SCOPE",
      sc="same as schedule_create", ec="session/agent-control", rt="ordinary-family", mx="A-4", ev=[], out_reason="no shipped-bundle tool rows", un=[]),
 dict(n="schedule_list", f="packages/schedule/schedule/src/tools.ts", l=451, ob="OUT_OF_SCOPE",
      sc="same as schedule_create", ec="session/agent-control", rt="ordinary-family", mx="A-4", ev=[], out_reason="no shipped-bundle tool rows", un=[]),
 dict(n="schedule_update", f="packages/schedule/schedule/src/tools.ts", l=492, ob="OUT_OF_SCOPE",
      sc="same as schedule_create", ec="session/agent-control", rt="ordinary-family", mx="A-4", ev=[], out_reason="no shipped-bundle tool rows", un=[]),
 dict(n="session_search", f="packages/session-query/tool-session-query/src/index.ts", l=65, ob="OUT_OF_SCOPE",
      sc="opt-in package: no row in packages/bundle (census gating)", ec="read-fs", rt="ordinary-family",
      mx="A-4 L95 [opt-in]", ev=[SEED + " req=REQ-COND shipped零挂载"],
      out_reason="not mounted in shipped bundle (opt-in; openAt:never per seed reqSrc)", un=[]),
 dict(n="session_trace", f="packages/session-query/tool-session-query/src/index.ts", l=85, ob="OUT_OF_SCOPE",
      sc="same as session_search", ec="read-fs", rt="ordinary-family", mx="A-4", ev=[], out_reason="not mounted in shipped bundle", un=[]),
 dict(n="session_event_read", f="packages/session-query/tool-session-query/src/index.ts", l=108, ob="OUT_OF_SCOPE",
      sc="same as session_search", ec="read-fs", rt="ordinary-family", mx="A-4",
      ev=[SEED + " gap secrets-in-raw-events"], out_reason="not mounted in shipped bundle", un=[]),
 dict(n="session_event_search", f="packages/session-query/tool-session-query/src/index.ts", l=75, ob="OUT_OF_SCOPE",
      sc="same as session_search", ec="read-fs", rt="ordinary-family", mx="A-4", ev=[], out_reason="not mounted in shipped bundle", un=[]),
 dict(n="session_event_trace", f="packages/session-query/tool-session-query/src/index.ts", l=95, ob="OUT_OF_SCOPE",
      sc="same as session_search", ec="read-fs", rt="ordinary-family", mx="A-4", ev=[], out_reason="not mounted in shipped bundle", un=[]),
]

# ---- subagent / orchestration / interaction ----
HOST_ROWS += [
 dict(n="subagent", f="packages/subagent/tool-subagent/src/index.ts", l=379, ob="REQUIRED",
      sc="host base bundle toolName:subagent route; registers only when the provider route is live (census gating)",
      ec="session/agent-control", rt="ordinary-family", mx="A-5 L102 — matrix-listed; UNKNOWN gap",
      ev=[T_SEAM["install_seq"] + " (mask/register seams are the generic route for inherited agent-control names)"],
      un=["no acceptance row; spawn-class effect identity (new agent sessions) has no enumerated Effects kind (" + SEEDC + " §1.1)", "governance mount absent on master"]),
 dict(n="subagent_fork", f="packages/subagent/tool-subagent/src/index.ts", l=379, ob="REQUIRED",
      sc="host base bundle second composed route (enabled)", ec="session/agent-control", rt="ordinary-family",
      mx="A-5 L103", ev=[], un=["same class gaps as subagent"]),
 dict(n="subagent_codex", f="packages/subagent/tool-subagent/src/index.ts", l=379, ob="OUT_OF_SCOPE",
      sc="shipped preset routes disabled:true (standard.patch.yml:105 / ptc / cordis per census)", ec="session/agent-control",
      rt="ordinary-family", mx="A-5 L104 [disabled:true]", ev=[SEED + " req=REQ-COND preset disabled"],
      out_reason="shipped default DISABLED (preset disabled:true); enablement = preset config change, re-classify then", un=[]),
 dict(n="subagent_claude_code", f="packages/subagent/tool-subagent/src/index.ts", l=379, ob="OUT_OF_SCOPE",
      sc="shipped preset routes disabled:true (standard.patch.yml:113)", ec="session/agent-control",
      rt="ordinary-family", mx="A-5 L105 [disabled:true]", ev=[SEED + " req=REQ-COND preset disabled"],
      out_reason="shipped default DISABLED", un=[]),
 dict(n="list_subagent_models", f="packages/subagent/tool-subagent/src/list-models.ts", l=87, ob="REQUIRED",
      sc="conditional registration iff model-selection policy configured; web-app mounts model-selection-settings (census gating)",
      ec="session/agent-control", rt="ordinary-family", mx="A-5 L106",
      ev=[], un=["conditional mount status must be pinned per profile; no governance mount"]),
 dict(n="send_message", f="packages/subagent/tool-subagent-control/src/index.ts", l=28, ob="REQUIRED",
      sc="host base bundle (default subagent-control route). SECOND same-name registration route = experimental tool-agent-team (packages/experimental/tool-agent-team/src/index.ts:215) which is NOT mounted in shipped bundles -> that variant is OUT_OF_SCOPE inside this entry",
      ec="session/agent-control", rt="ordinary-family", mx="A-5 L109 (subagent 族) + A-9 L138 (upstream team 族, same-name separate implementation)",
      ev=["collision-by-design per census gating line 'collides by design with the default tool-subagent-control route when both mounted'"],
      un=["no governance mount; cross-agent addressing identity unproven", "same-name two-route dispatch must be pinned by H0-style identity checks"]),
 dict(n="interrupt_agent", f="packages/subagent/tool-subagent-control/src/index.ts", l=74, ob="REQUIRED",
      sc="host base bundle; second (experimental, unmounted) route same-name — variant OUT_OF_SCOPE as with send_message",
      ec="session/agent-control", rt="ordinary-family", mx="A-5 L107 + A-9 L136", ev=[],
      un=["same-class gaps as send_message"]),
 dict(n="list_agents", f="packages/subagent/tool-subagent-control/src/list-agents.ts", l=86, ob="REQUIRED",
      sc="host base bundle separate row; experimental same-name route unmounted", ec="session/agent-control",
      rt="ordinary-family", mx="A-5 L108 + A-9 L137", ev=[], un=["same-class gaps"]),
 dict(n="workflow", f="packages/workflow/tool-workflow/src/index.ts", l=328, ob="REQUIRED",
      sc="host base bundle", ec="session/agent-control", rt="ordinary-family", mx="A-5 L110",
      ev=["body orchestrates subagents and appends session records (tests/deepseek-harness-test-use/packages/workflow/tool-workflow/src/index.ts:102 — personally re-read)"],
      un=["nested fan-out effects: one model call -> N governed subagent dispatches; aggregation identity unmodeled (no acceptance row)"]),
 dict(n="ralph", f="packages/workflow/tool-ralph/src/index.ts", l=410, ob="OUT_OF_SCOPE",
      sc="mounted but disabled:true by default (bundle/base/cordis.patch.yml:447-449 per census)", ec="session/agent-control",
      rt="ordinary-family", mx="A-5 L111 [默认 disabled]", ev=[SEED + " gap UNMANAGED_IF_ENABLED"],
      out_reason="shipped default disabled; obligation attaches only if enabled", un=[]),
 dict(n="ask_user_question", f="packages/interaction/tool-ask-user/src/index.ts", l=38, ob="REQUIRED",
      sc="mounted per preset; default mode legacy; a same-name timed variant registers only under config mode:timed (" + CENSUS + " two rows)",
      ec="ui/interaction", rt="ordinary-family", mx="A-5 L112 [分档未核]",
      ev=[], un=["interaction lane: pending-user wait inside a governed session interacts with Control ask lanes — unverified", "timed-variant mount status per profile"]),
 dict(n="exit_plan_mode", f="packages/plan/plan-mode/src/index.ts", l=278, ob="REQUIRED",
      sc="host base bundle; execute refuses outside plan mode (docs note via census)", ec="session/agent-control",
      rt="ordinary-family", mx="A-5 L113", ev=[], un=["no acceptance row"]),
 dict(n="present", f="packages/deliverables/tool-present/src/index.ts", l=38, ob="REQUIRED",
      sc="mounted per web preset (standard:142-143, cordis:150-151)", ec="ui/interaction", rt="ordinary-family",
      mx="A-5 L114", ev=["body stats/resolves files via ctx.fs (tests/deepseek-harness-test-use/packages/deliverables/tool-present/src/index.ts:81-89 — personally re-read)",
                          "WIP #360: " + W360 + "present.mjs + g1-present-arm.mjs (unmerged)"],
      un=["fs-metadata read + deliverable publish side not in any acceptance row"]),
]

# ---- plugin / cordis / mcp-resource ----
HOST_ROWS += [
 dict(n="plugin_manager", f="packages/boot/plugin-manager/src/tools.ts", l=19, ob="REQUIRED",
      sc="host base bundle; profile-global mutation + install may execute allowed build scripts (description text re-read at host file :21)",
      ec="process", rt="other:plugin-manager", mx="A-6 L117 [默认 disabled/creator 条件] — matrix lists it; the census shows the tools row mounted at bundle/base/cordis.patch.yml:16-17",
      ev=["" + SEEDC + " §2 PLUGIN role: profile-global change + script execution is its own scope"],
      un=["executes build scripts = process+fs+network compound; no acceptance row; highest-risk un-governed mounted name found in this static pass"]),
 dict(n="cordis_inspect_list", f="packages/extensions/tool-cordis/src/index.ts", l=22, ob="REQUIRED",
      sc="mounted in cordis preset only (presets/cordis.patch.yml:141-142)", ec="read-fs", rt="ordinary-family",
      mx="A-6 L118 [creator]", ev=[], un=["read-only inspect surface per description; governance row absent"]),
 dict(n="cordis_inspect_query", f="packages/extensions/tool-cordis/src/index.ts", l=41, ob="REQUIRED",
      sc="cordis preset only", ec="read-fs", rt="ordinary-family", mx="A-6 L119", ev=[],
      un=["queries may reach live client surfaces (this session's own tool list shows client queries); scope unproven"]),
 dict(n="list_mcp_resources", f="packages/mcp/mcp-resources/src/tools.ts", l=33, ob="REQUIRED",
      sc="host base bundle; static names (NOT dynamic mcp__ rows — matrix A-6 warns against mixing)", ec="dynamic-mcp",
      rt="bridge:MCP", mx="A-6 L121 [分档未核]", ev=[SEED + " req=REQ-COND gap=MCP_GOVERNANCE_DORMANT"],
      un=["reaches connected MCP servers; appears only when >=1 server connected (seed reqSrc)"]),
 dict(n="list_mcp_resource_templates", f="packages/mcp/mcp-resources/src/tools.ts", l=42, ob="REQUIRED",
      sc="host base bundle", ec="dynamic-mcp", rt="bridge:MCP", mx="A-6 L120", ev=[SEED + " MCP 三件同证"], un=["same as list_mcp_resources"]),
 dict(n="read_mcp_resource", f="packages/mcp/mcp-resources/src/tools.ts", l=51, ob="REQUIRED",
      sc="host base bundle", ec="dynamic-mcp", rt="bridge:MCP", mx="A-6 L122", ev=[SEED + " MCP 三件同证"], un=["same as list_mcp_resources"]),
]

# ---- run_code + experimental team (host) ----
HOST_ROWS += [
 dict(n="run_code", f="packages/core/tools/src/ptc.ts", l=335, ob="REQUIRED",
      sc="host lazy ToolRuntime registration in PTC mode (index.ts:945 createRunCodeTool per census); Team mode must mount on Team's PTC (matrix L38 note); outer+nested are two faces of one name (matrix L38/L39)",
      ec="process", rt="bridge:PTC", mx="L38 outer (PROBE-GATED) + L39 nested (ENFORCE-PARTIAL scope=@8eb93ddd inner edge)",
      ev=[T_SEAM["ptc_row"], "host " + RT + " PTC sub-dispatch waterfall tools/ptc-dispatch-log (:179-190 — personally re-read)"],
      un=["net/process-visibility partial gap registered upstream (#332, backlog BL-16)", "whole-row effect guarantee unverified (matrix L38)"]),
 dict(n="spawn_teammate", f="packages/experimental/tool-agent-team/src/index.ts", l=175, ob="OUT_OF_SCOPE",
      sc="opt-in experimental plugin; NOT mounted in any shipped bundle (test overlay only, census gating)", ec="team-coordination",
      rt="team-native", mx="A-9 L139 — gap registration only", ev=[SEED + " req=REQ-COND 默认关"],
      out_reason="experimental plugin not mounted in shipped bundles", un=[]),
 dict(n="wait_agent", f="packages/experimental/tool-agent-team/src/index.ts", l=242, ob="OUT_OF_SCOPE",
      sc="same experimental plugin (exclusive to it)", ec="team-coordination", rt="team-native", mx="A-9 L144",
      ev=[], out_reason="experimental plugin not mounted in shipped bundles", un=[]),
 dict(n="team_task_create", f="packages/experimental/tool-agent-team/src/index.ts", l=289, ob="OUT_OF_SCOPE",
      sc="same experimental plugin", ec="team-coordination", rt="team-native", mx="A-9 L140", ev=[],
      out_reason="experimental plugin not mounted in shipped bundles", un=[]),
 dict(n="team_task_list", f="packages/experimental/tool-agent-team/src/index.ts", l=313, ob="OUT_OF_SCOPE",
      sc="same experimental plugin", ec="team-coordination", rt="team-native", mx="A-9 L142", ev=[],
      out_reason="experimental plugin not mounted in shipped bundles", un=[]),
 dict(n="team_task_get", f="packages/experimental/tool-agent-team/src/index.ts", l=345, ob="OUT_OF_SCOPE",
      sc="same experimental plugin", ec="team-coordination", rt="team-native", mx="A-9 L141", ev=[],
      out_reason="experimental plugin not mounted in shipped bundles", un=[]),
 dict(n="team_task_update", f="packages/experimental/tool-agent-team/src/index.ts", l=360, ob="OUT_OF_SCOPE",
      sc="same experimental plugin", ec="team-coordination", rt="team-native", mx="A-9 L143", ev=[],
      out_reason="experimental plugin not mounted in shipped bundles", un=[]),
 dict(n="structured_output", f="packages/subagent/subagent-in-process-driver/src/structured.ts", l=74, ob="OUT_OF_SCOPE",
      sc="internal child-session tool (structured-output capture); NOT in docs/tool-catalog.md; NOT in PLANE_RESERVED_NATIVE (flagged by U1-C for reviewer judgement, not asserted as drift)",
      ec="session/agent-control", rt="ordinary-family", mx="not listed in the matrix at all",
      ev=[CENSUS + "; U1-C seed-diff newNames classification UNKNOWN/NOT_VERIFIED — never authorized"],
      out_reason="internal child-internal capture tool, never a shipped model-facing surface (U1-C); outside the matrix catalog — tracked in the U7 dynamic-census UNKNOWN queue", un=[]),
]

# stagehand six
for nm, ln in [("stagehand_navigate",179),("stagehand_tabs",179),("stagehand_screenshot",179),
               ("stagehand_act",179),("stagehand_observe",179),("stagehand_extract",179)]:
    HOST_ROWS.append(dict(n=nm, f="packages/experimental/browser-use-stagehand-native/src/index.ts", l=ln, ob="OUT_OF_SCOPE",
        sc="opt-in experimental; no row in packages/bundle (census gating); name built stagehand_${method}", ec="network",
        rt="other:browser", mx="A-7 L124-130 [experimental] gap registrations", ev=[SEED + " gap=NO_APPROVAL_LANE_MCP_CLASS"],
        out_reason="experimental, not mounted in shipped bundles; obligation attaches if a Team config mounts it (seed PB15 rule)", un=[]))

TEAM = [
 ("team_list_members", 498), ("team_list_templates", 520), ("team_inspect_config", 542),
 ("team_create_member", 572), ("team_delegate", 614), ("team_follow_up", 710), ("team_collect", 772),
 ("team_send_message", 817), ("team_report_progress", 856), ("team_request_control", 960),
 ("team_resolve_control", 1017), ("team_list_pending_control", 1119), ("team_archive_member", 1197),
 ("team_grant_permission", 1373), ("team_revoke_permission", 1373),
]

# ============================ assemble entries ============================
entries = []

for r in HOST_ROWS:
    evid = [f"host registration: {r['f']}:{r['l']} (via {CENSUS.split(' (')[0]})"] + r["ev"]
    entries.append(entry(
        r["n"], r["ob"], f"host {r['f']}:{r['l']} @639ed015",
        r["sc"], r["ec"], r["rt"], evid, r["un"],
        out_reason=r.get("out_reason"), matrix=r["mx"]))

for nm, ln in TEAM:
    entries.append(entry(
        nm, "REQUIRED",
        f"team packages/tools/src/tools.ts:{ln} ({MASTER})",
        "Team own-layer leader tool; registered per capabilities.teamTools allow-list via " + T_SEAM["ab_team_reg"],
        "team-coordination", "team-native",
        [T_SEAM["team_tools"], T_SEAM["control"], T_SEAM["cov_gate"]],
        ["per-name approval/function verification NOT_VERIFIED (matrix L44: static route proven, 15-name expansion; not per-name GO)"],
        matrix="L44 main row M-14 team_* (ENFORCE-PARTIAL scope=@0e0b605a real-Host approval-chain historical round) + A-10 L147-161 per-name lines"))

entries.append(entry(
    "mcp__<server>__<tool> (dynamic class)", "REQUIRED",
    "dynamic-class host packages/mcp/mcp-client/src/tools.ts:81-82 (name rule), :150 (syncTools per connected server) @639ed015",
    "every connected MCP server; per-server dynamic names, individual names NOT enumerable at build time (U1-C dynamicSourceClasses)",
    "dynamic-mcp", "bridge:MCP",
    [T_SEAM["ab_mcp_prefix"], T_SEAM["ab_mcp_name"], T_SEAM["ab_mcp_mount"], T_SEAM["prefix"],
     "matrix L41 (MCP stdio, WIRED-NOT-ACCEPTED) + L42 (MCP HTTP dynamic domain, NOT_VERIFIED)",
     "seed surfaces surface:mcp_stdio / surface:mcp_http_dynamic map here (U1-C seed-diff)"],
    ["guard binding-completeness for mcp__ names UNVERIFIED (matrix L41)",
     "dynamic server addition -> guard bind effectiveness UNVERIFIED (matrix L42)",
     "stdio subprocess confinement unproven (matrix L41: :1756-1768 evidence is the streamable-http/loopback path)",
     "no runtime inventory snapshot exists for concrete server/tool names (matrix L42)"],
    role=ROLE["CONNECTOR"], matrix="L41+L42 main rows M-12"))

entries.append(entry(
    "client-plugin dynamic tools (any name via harness.defineTool; dynamic class)", "REQUIRED",
    "dynamic-class host packages/extensions/cordis-host-runner/src/guard.ts:495 (assertDynamicTool gate), :628 (registration passthrough) @639ed015",
    "client plugins register model-facing tools at runtime (e.g. browser_*); enumeration at build time impossible (U1-C)",
    "dynamic-mcp", "other:client-plugin-registration",
    ["matrix L46 main row NEG-4 Preset/Team 自注册覆盖 (WIRED-NOT-ACCEPTED): preset-realm registration does not reach global tools.schemas() face (bind-diag @248aff73, 三世界 17/17×3)",
     "seed surface surface:neg4_preset_selfregister maps here (U1-C seed-diff)"],
    ["inheritance at the ABSTAIN layer — 'never VERIFIED' (bind-diag quote in matrix L46)",
     "no world has shown preset-realm VERIFIED inheritance (matrix L46)"],
    matrix="L46 main row NEG-4"))

entries.append(entry(
    "surface:domain_family (family obligation — no registered names)", "REQUIRED",
    "no source tool name on either side (U1-C seed-diff: ABSENT as a name; the other 3 seed surfaces map to dynamic classes)",
    "design-semantic family (HPC/RPC/research-state/device) — NOT proven registered names; concrete external domains need config/registry input (" + SEEDC + " and matrix L43)",
    "UNKNOWN", "UNKNOWN",
    ["matrix L43 main row M-13 Domain (NOT_VERIFIED): '尚未枚举缺口 = domain 工具面未定义，无逐名输入'; fail-closed clauses are design-only; S0 explicit NOT_RUN",
     "CI-10 Domain veto stays independent (" + "refs/center-assembly-architecture.md §2 L36)"],
    ["no enumerable names today; obligation cannot be per-name satisfied in G1-F — recorded as named gap, NOT as covered",
     "do not invent hpc_* class names (matrix L43)"],
    matrix="L43 main row M-13"))

cua_ev = entry(
    "cua_driver_native__<tool> (dynamic class)", "OUT_OF_SCOPE",
    "dynamic-class host packages/experimental/computer-use-cua-driver-native/src/index.ts:97 (name rule), :117 (register) @639ed015 (U1-C dynamicSourceClasses)",
    "experimental driver-list dynamic; not mounted in shipped bundles", "process", "other:computer-use",
    [CENSUS + " dynamicSourceClasses entry"],
    ["if ever mounted, becomes a dynamic source class requiring the MG-MCP-DYNAMIC-style admission path"],
    out_reason="experimental, not mounted in shipped bundles (U1-C)", matrix="not listed in the matrix")
entries.append(cua_ev)

# ============================ mechanism groups ============================
GROUPS = [
 dict(id="MG-FS-READ", name="FS-read (governed read row)",
      members=["read"],
      interception="own-layer same-name takeover Definition registered via public tools.register (" + H_SEAM["register"] + ") at " + T_SEAM["read_row"] + "; PA admission inside the row body (" + T_SEAM["admit"] + "); install order " + T_SEAM["install_seq"],
      governed_on_master=True,
      gov_cite=[T_SEAM["takeovers"], T_SEAM["read_row"], T_SEAM["ab_plane"] + " — matrix L21 historical LIVE-CONFIRMED (baseline not re-run)"],
      poc="PoC-2 (shared read/search/process lifecycle PoC; no separate PoC)",
      h0=True),
 dict(id="MG-FS-WRITE", name="FS-write (write/edit/str_replace/read_image write side)",
      members=["write", "edit", "str_replace_editor", "read_image"],
      interception="same register/PA seam as MG-FS-READ, but NO governed arm exists on master: native-name claim is refused today (" + T_SEAM["claim_refuse"] + "); route = Family Contribution writing through ControlledFs-style post-consume closures (#360 write.mjs WIP)",
      governed_on_master=False,
      gov_cite=["master: none (matrix L22/L23 NOT_IMPLEMENTED/NOT_WIRED); WIP: " + BR360 + " " + W360 + "write.mjs/edit.mjs/image.mjs + packages/tools/a5p5-tools/src/write-slice.ts"],
      poc="PoC-1 (governed write row: Family Contribution + pre-Body deny; doubles as ARC-A minimal proof)",
      h0=True),
 dict(id="MG-SEARCH", name="Search (native grep/glob + team aliases over confined rg)",
      members=["grep", "glob", "team_grep", "team_glob"],
      interception="alias rows via DEFAULT_PLANE_NAMES registration; native grep/glob rows NOT taken over (takeover grep/glob = []); confined-rg through host PUBLIC buildGrepCommand/parseGrepMatches/resolveRgPath; glob shut key",
      governed_on_master=True,
      gov_cite=[T_SEAM["plane_names"], T_SEAM["rg_public"], T_SEAM["glob_off"], "matrix L27/L29 WIRED (row-level acceptance missing)"],
      poc="PoC-2",
      h0=True),
 dict(id="MG-PROCESS", name="Process (bash/team_bash/pwsh over confined sandbox provider)",
      members=["bash", "team_bash", "pwsh"],
      interception="plane shell row + sandbox-provider prepare/execute/spawnStreaming with launcher --confined-exec-stream; native 'bash' takeover assembled (" + T_SEAM["takeovers"] + "); pwsh has no arm on master",
      governed_on_master=True,
      gov_cite=[T_SEAM["sandbox"], "matrix L30 LIVE-CONFIRMED @1fb14c4d; team_bash = OPEN R2 approval-penetration blocker (" + BACKLOG + " L13); pwsh ENV win32 missing"],
      poc="PoC-2 (bash arm); pwsh separately ENV-BLOCKED, not PoC'd on Linux",
      h0=True),
 dict(id="MG-JOBS-BRIDGE", name="Named Bridge: Jobs (JobRegistry owner/lease face)",
      members=["job_list", "job_output", "job_kill"],
      interception="createGovernedJobsBridge over host JobRegistry PUBLIC face; rows at FIXED native spelling under closed jobsEnabled key (no config spelling, no Gate 0b surface)",
      governed_on_master=True,
      gov_cite=[T_SEAM["jobs_bridge"], T_SEAM["jobs_rows"], T_SEAM["jobs_off"], "matrix L33-35 LIVE-CONFIRMED @efb5bb55 C3 24/24 (baseline not re-run)"],
      poc="PoC-3 (named-Bridge representative, ARC-C minimal; re-anchor owner-fence + cancel semantics on current SHA)",
      h0=True),
 dict(id="MG-PTC-BRIDGE", name="Named Bridge: PTC (run_code outer/nested)",
      members=["run_code"],
      interception="PTC escalation row on host PUBLIC approval/request waterfall (" + T_SEAM["ptc_row"] + "); inner/outer two execution faces of one name must stay separated (CA-03)",
      governed_on_master=True,
      gov_cite=[T_SEAM["ptc_row"], "matrix L38 PROBE-GATED outer (fs half-arm merged #334) / L39 ENFORCE-PARTIAL nested inner edge"],
      poc="PoC-3 alternate (if PTC is chosen as the single Bridge representative instead of Jobs)",
      h0=True),
 dict(id="MG-LSP-BRIDGE", name="Named Bridge: LSP (per-realm server pool)",
      members=["lsp"],
      interception="sandbox-provider LSP assembly: probe gate -> spawnStreaming -> readiness, policy-generation rebuild (" + T_SEAM["lsp_asm"] + ")",
      governed_on_master=True,
      gov_cite=[T_SEAM["lsp_asm"], "matrix L40 LIVE-CONFIRMED @1d0d03d0 real clangd/tsserver; host tool-lsp package itself opt-in/unmounted (census gating)"],
      poc="none beyond H0 for G1-F (existing real-server evidence + master assembly face; family-level GO stays open)",
      h0=True),
 dict(id="MG-WEB", name="Network (web_fetch/web_search)",
      members=["web_fetch", "web_search"],
      interception="would ride the same register/mask seam (row per tool); no production provider assembly exists on master; loopback deny-list is host-side fixture evidence",
      governed_on_master=False,
      gov_cite=["matrix L36/L37 NOT_VERIFIED; no Team web row on master; #360 g2-web-supply.mjs is WIP"],
      poc="PoC-4a (deny-side effect boundary: refused fetch/spawn = zero socket, loopback refusal before the fetch call site); full positive is ENV-BLOCKED (no authorized outbound)",
      h0=True),
 dict(id="MG-MCP-DYNAMIC", name="Dynamic source class: mcp__* + MCP-resource trio (Bridge: MCP)",
      members=["mcp__<server>__<tool> (class)", "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"],
      interception="mount gates: filterMcpServers + durable facet + template allow (" + T_SEAM["ab_mcp_mount"] + "); trust exclusion (" + T_SEAM["ab_mcp_prefix"] + "); admission per call via bindMcpTools-bound identity; NEW servers must go through the single DynamicSourceAdmissionRecord path (refs/center-assembly-architecture.md §10.4)",
      governed_on_master=True,
      gov_cite=[T_SEAM["ab_mcp_mount"], T_SEAM["ab_mcp_name"], "matrix L41 WIRED-NOT-ACCEPTED / L42 NOT_VERIFIED — guard binding-completeness UNVERIFIED"],
      poc="PoC-4b (dynamic source: post-Guard late-binding, same-name override, new-server-no-auto-authorize)",
      h0=True),
 dict(id="MG-CLIENT-PLUGIN-DYNAMIC", name="Dynamic source class: client-plugin registrations (NEG-4)",
      members=["client-plugin dynamic tools (class)"],
      interception="host cordis-host-runner assertDynamicTool gate + registration passthrough (guard.ts:495/:628 @639ed015); Team side must bind or refuse unbound names at the Coverage Gate",
      governed_on_master=False,
      gov_cite=["matrix L46 bind-diag: preset-realm never reaches global schemas face; ABSTAIN layer never VERIFIED; Coverage Gate exists (" + T_SEAM["cov_gate"] + ") but the admission lane for this class is unwired"],
      poc="PoC-5 (client-plugin late registration negative controls: unbound name refused, no Grant inheritance)",
      h0=True),
 dict(id="MG-TEAM-NATIVE", name="Team own-layer leader tools (15 team_*)",
      members=[n for n, _ in TEAM],
      interception="own-layer registration only (" + T_SEAM["ab_team_reg"] + "); own-layer typed refusal for reserved names; last-mile consultGuard -> ControlService (packages/tools/src/guard.ts:72-91)",
      governed_on_master=True,
      gov_cite=[T_SEAM["ab_team_reg"], T_SEAM["control"], "matrix L44 ENFORCE-PARTIAL @0e0b605a (historical round)"],
      poc="PoC-6b (per-name approval-chain negative spot-check rides PoC-6 harness; no separate launcher)",
      h0=True),
 dict(id="MG-AGENT-CONTROL", name="Session/agent-control inherited names (subagent/workflow/goal/todo/skill/present/interaction/plugin-manager/cordis)",
      members=["subagent", "subagent_fork", "list_subagent_models", "send_message", "interrupt_agent",
               "list_agents", "workflow", "create_goal", "get_goal", "update_goal", "todo_write",
               "skill", "present", "ask_user_question", "exit_plan_mode", "plugin_manager",
               "cordis_inspect_list", "cordis_inspect_query"],
      interception="no governance mount exists on master for this class; only the generic public seams (tools.restrict mask / tools.register replacement / tools.guard) are available (" + T_SEAM["install_seq"] + "); Coverage Gate forces an authority owner per final-surface name",
      governed_on_master=False,
      gov_cite=["matrix A-3..A-6 per-name UNKNOWN gap registrations (no acceptance rows); #360 governed-families/* (subagent-*, workflow-*, g5-goal-*, todo.mjs, human.mjs, present.mjs, sre.mjs...) is unmerged WIP"],
      poc="PoC-6 (agent-control negatives: cross-agent send_message/interrupt refused, spawn-class effect identity mapped to an admitted effect kind, plugin_manager deny = zero process)",
      h0=True),
]
for g in GROUPS:
    g["blocked_by_H0"] = True
    g["h0_note"] = ("Host dispatch re-resolves the tool by NAME after the pre/guard stage (" + H_SEAM["toctou"] + "). "
                    "Every group above ultimately admits/intercepts on that name-keyed dispatch, so all groups inherit H0's "
                    "pre-Body-identity verdict. H0 PoC is owned by a separate agent; no group may be declared READY before H0 PASS.")

# ============================ feasibility ============================
FEAS = {}
def add(name, status, reason):
    FEAS[name] = {"name": name, "status": status, "reason": reason}

R_H0 = "governed row exists on master, but dispatch-identity (pre-Body) property is H0-pending; no static classification may claim real-Host PASS"
add("read", "CONDITIONAL", "master governed read row + PA/admission chain; " + R_H0 + "; baseline re-run missing (matrix L21 V@B=no)")
add("write", "CONDITIONAL", "no governed write arm on master (native-name claim refused, team-tool-plane.mjs:492-494); #360 write.mjs/write-slice.ts WIP extractable; same public register seam as read — no missing-seam evidence")
add("edit", "CONDITIONAL", "same as write; #360 edit.mjs WIP; read-before-edit untested (matrix L23)")
add("str_replace_editor", "CONDITIONAL", "required by matrix L24 but not shipped (census: NOT mounted in any shipped bundle/preset); obligation governs only the if-mounted case")
add("read_image", "CONDITIONAL", "read arm + attachment-store write face; #360 image.mjs/image-attachment.mjs WIP; whole chain untested (matrix L25)")
add("grep", "CONDITIONAL", "native name NOT taken over (takeover []); governed alias exists; native row effect proof missing (matrix L26); H0-pending")
add("glob", "CONDITIONAL", "same as grep + shut key in code (matrix L28; BL-19 runtime re-verify pending)")
add("team_grep", "CONDITIONAL", "alias row wired (matrix L27); row-level approval closed-loop unverified; H0-pending")
add("team_glob", "CONDITIONAL", "same as team_grep (matrix L29)")
add("bash", "CONDITIONAL", "native takeover assembled + sandbox provider on master (matrix L30 historical LIVE-CONFIRMED); baseline re-run missing; H0-pending")
add("team_bash", "CONDITIONAL", "route exists but OPEN R2 approval-penetration blocker must close first (" + BACKLOG + " L13 BL-01, RELEASE BLOCKER)")
add("pwsh", "ENV-BLOCKED", "win32 provider/platform unavailable on this Linux test host; presets platform-gated; bash acceptance not transferable (M0-B B-PROCESS)")
add("job_list", "CONDITIONAL", "master Jobs bridge over public JobRegistry face + historical C3 @efb5bb55 (matrix L33); baseline re-run missing; default-off")
add("job_output", "CONDITIONAL", "same trio (matrix L34)")
add("job_kill", "CONDITIONAL", "same trio; terminated-confirmation uncertainty on record (matrix L35)")
add("lsp", "CONDITIONAL", "master assembly face (lsp-assembly.ts:174-191) + historical real-server evidence (matrix L40); host package opt-in/unmounted in default presets; applicability-to-baseline NOT_VERIFIED")
add("web_fetch", "ENV-BLOCKED", "no authorized outbound + no production provider assembly on master (matrix L37); deny-side lane still PoC-able (PoC-4a)")
add("web_search", "ENV-BLOCKED", "same (matrix L36); search-target vs result-URL object split unresolved")
add("run_code", "CONDITIONAL", "PTC escalation row merged (fs half-arm); net/process-visibility partial gap registered (#332/BL-16); whole-row guarantee unverified (matrix L38/L39)")
add("todo_write", "CONDITIONAL", "static registration proven + reserved-name in-table (matrix L45); no acceptance; #360 todo.mjs WIP; row is a session-state write face")
for nm, _ in TEAM:
    add(nm, "CONDITIONAL", "own-layer registration on master + historical ENFORCE-PARTIAL approval chain (matrix L44); per-name verification NOT_VERIFIED; ControlService guard fail-closed (packages/tools/src/guard.ts:72-91)")
add("mcp__<server>__<tool> (dynamic class)", "CONDITIONAL", "mount/reconcile + trust-exclusion on master (matrix L41/L42); guard binding-completeness UNVERIFIED; dynamic re-validation unproven; no runtime inventory snapshot")
add("client-plugin dynamic tools (any name via harness.defineTool; dynamic class)", "UNKNOWN", "NEG-4 lane WIRED-NOT-ACCEPTED; ABSTAIN-layer inheritance never VERIFIED (matrix L46); admission route undefined")
add("surface:domain_family (family obligation — no registered names)", "UNKNOWN", "family has no enumerable names on any side (U1-C ABSENT; matrix L43 尚未枚举缺口); cannot be satisfied per-name in G1-F — named gap, not covered")
for nm in ["subagent", "subagent_fork", "list_subagent_models", "send_message", "interrupt_agent",
           "list_agents", "workflow", "create_goal", "get_goal", "update_goal", "skill", "present",
           "ask_user_question", "exit_plan_mode", "plugin_manager", "cordis_inspect_list", "cordis_inspect_query",
           "list_mcp_resources", "list_mcp_resource_templates", "read_mcp_resource"]:
    add(nm, "UNKNOWN", "matrix lists the name (Appendix A) with per-name UNKNOWN and no acceptance row; no governance mount on master; route presumed ordinary-family via the same public register/restrict seams but unverified")
add("plugin_manager", "UNKNOWN", "overridden above, refined here: mounted + can execute build scripts (host tools.ts:21 description re-read); un-governed today; highest-risk gap of MG-AGENT-CONTROL — mask/restrict seam exists so not yet a CORE_SEAM_BLOCKER")

# ============================ outputs ============================
req = [e for e in entries if e["obligation"] == "REQUIRED"]
oos = [e for e in entries if e["obligation"] == "OUT_OF_SCOPE"]

oblig_doc = {
  "meta": {
    "package": "U4-B (G1-F ExpectedToolObligations export)",
    "generated_utc": "2026-10-25",
    "pins": {"team_master": MASTER, "host": HOST, "wip_asset": BR360,
             "census": "dev/agent-workflow/evidence/u1-closure-20261025/u1c/ (U1-C)",
             "seed": SEED + " (93 records; historical seed, NOT a permanent whitelist)"},
    "required_rule": ("source of 'required' = the active plan/backlog/matrix on master "
      "(docs/plans/active/alpha5-tool-io-governance/TOOL-CAPABILITY-MATRIX-9b2.md + ALPHA5-EFFECTIVE-BACKLOG.md). "
      "A name with a MAIN acceptance row (L21-L46, expansions included) is REQUIRED. A name listed only in Appendix A "
      "that is mounted in a shipped bundle/preset is REQUIRED (obligation attaches even though the matrix per-name status is UNKNOWN). "
      "Names the matrix/census flag disabled (preset disabled:true), default-disabled, experimental/unmounted opt-in are "
      "OUT_OF_SCOPE with that reason (obligation re-attaches if mounted/enabled — seed PB15 rule); "
      "names absent from the matrix entirely are OUT_OF_SCOPE. Dynamic sources are recorded as classes, never enumerated. "
      "The Domain family obligation (matrix M-13) has no names and is REQUIRED as an obligation with the enumeration gap recorded."),
    "static_only": "no Host boot, no real-Host PASS claims; feasibility statuses are static classifications (execution-plan.md U4: 逐工具静态分类不得升级成真实 Host PASS)",
    "counts": {"entries": len(entries), "required": len(req), "out_of_scope": len(oos)},
  },
  "obligations": entries,
}

groups_doc = {
  "meta": {"note": "one PoC per shared mechanism group; groups blocked_by_H0=true cannot be declared ready before the H0 PoC (owned by a separate agent). H0 target evidence: " + H_SEAM["toctou"],
           "shared_interception_seam_reference": {k: v for k, v in H_SEAM.items()},
           "counts": {"groups": len(GROUPS), "h0_blocked": sum(1 for g in GROUPS if g["blocked_by_H0"])}},
  "groups": GROUPS,
}

order = list(FEAS.keys())
feas_doc = {
  "meta": {"legend": {"READY-PUBLIC": "fixed public seam + guarantees — NONE statically assignable in this package (that label is reserved for H0+PoC evidence)",
                      "CONDITIONAL": "route exists / public seams present, named conditions (H0, baseline re-run, open blocker, WIP extraction) apply",
                      "ENV-BLOCKED": "environment/credential/platform unavailable",
                      "CORE_SEAM_BLOCKER": "public Host behavior proven missing — none asserted statically; see core_seam_blocker_candidates",
                      "UNKNOWN": "not classifiable from frozen sources without a PoC"},
           "counts": {}, "only_required_tools_classified": True},
  "tools": [FEAS[n] for n in order if n in FEAS],
  "core_seam_blocker_candidates": [
    {"candidate": "H0: pre-Body definition-identity pin at Host dispatch",
     "precise_missing_public_behavior": ("after the ordered pre-execute/guard gate (host core/tools/src/index.ts:768-770 via public tools.guard :1136), "
       "dispatch RE-RESOLVES the body by name+scope (resolveExecution :1247-1252 invoked at :1578/:1807/:1876) instead of executing the Definition the Guard validated; "
       "no public seam observed that pins a validated Definition identity for the body invocation. If H0 shows a window where an unverified Body executes, every name-based "
       "group becomes CORE_SEAM_BLOCKER. Status: PENDING (separate agent owns H0) — this is the single CSB candidate, asserted as a candidate, not as a proven blocker.")},
    {"candidate": "mcp__ guard binding-completeness",
     "precise_missing_public_behavior": ("not proven missing — UNVERIFIED: whether the Team Guard's native-trust exclusion + bindMcpTools binding covers every globally-registered "
       "mcp__ name across late binding (matrix L41/L42). PoC-4b decides; if unbindability is proven, becomes CSB for the MCP class only.")},
  ],
}
cc = {}
for t in feas_doc["tools"]:
    cc[t["status"]] = cc.get(t["status"], 0) + 1
feas_doc["meta"]["counts"] = cc

for name, doc in [("expected-tool-obligations.json", oblig_doc),
                  ("mechanism-groups.json", groups_doc),
                  ("feasibility.json", feas_doc)]:
    with open(os.path.join(OUT, name), "w") as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    print("wrote", name)

# quick self-check: every REQUIRED entry must appear in feasibility (names as used there)
missing = [e["name"] for e in req if e["name"] not in FEAS]
print("REQUIRED entries missing from feasibility:", missing)
rc = {}
for e in req:
    rc[e["candidate_route"]] = rc.get(e["candidate_route"], 0) + 1
print("route counts:", rc)
ec = {}
for e in req:
    ec[e["effect_class"]] = ec.get(e["effect_class"], 0) + 1
print("effect counts:", ec)
