# A5W4 live wiring run — phase pos · 2026-10-17T02-26-25Z

- host: pinned 0.2.0-rc.2 @ `639ed01539` · port 3182 · world `tests/homes/a5w4-pos-2026-10-17T02-26-25Z` · realm `a5w4-realm-2026-10-17T02-26-25Z`
- pinned tree: head `639ed0153972` porcelain=true (before) / true (after)
- launcher (tracked source copy; dist carries no .py — disclosed): sha256 `cee10ed55f12123f`
- bare ABI probe (pre-boot, this host): `{"kind":"abi-available","abi_version":4,"raw":["[SC] create_ruleset(NULL,0,GET_VERSION): rc=4 errno=0 strerror='Success'`
- ENFORCE grading (from live rows): ENFORCE-CONFIRMED (fixture/subprocess-grade OS_ENFORCED: rules compiled by the tracked lane launcher, real Landlock domain, real execve; realm/trust-root fixture-grade by the lane wording — not an OS-anchored identity)
- residual prelauncher processes after the run: `183 bash -c pgrep -af 'landlock-prelauncher' | head -5 || true`

- criteria: 22/22 pass

- [x] W4-PIN: pinned tree @639ed01539 · porcelain 0 · HEAD==pin — head=639ed0153972 porcelain=true
- [x] W4-DIST: provider factory reachable through the dist PUBLIC barrel only — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-wire-pr4/packages/runtime/dist/packages/runtime/sandbox-provider/index.js
- [x] W4-LAUNCHER: trusted pre-launcher is the TRACKED source copy (disclosed: dist emit carries no .py assets) — sha256=cee10ed55f12123f (trustRoot names it)
- [x] W4-REVOKE-SELFTEST: revocation wrapper really removes the enforcement plane: bare probe finds the ABI, wrapper probe answers EACCES — bare rc=0 {"kind":"abi-available","abi_version":4,"raw":["[SC] create_ · wrapper rc=2 {"kind":"abi-unavailable","abi_version":null,"raw":["[SC] create_ruleset(NULL,0,GET_VERSIO
- [x] W4-PORTS: port 3182 free at start (IF-2 self-proof; netstat) — port 3182: no listener
- [x] W4-BOOT: test instance boots, token gate returns 303, row health answers — booted=true health={"ok":true,"pid":73,"applied":true,"barrel":true,"agents":[]}
- [x] W4-SESSION: the host public session/create entry returned a real sessionId — status=200 sid=session-4a55638c-a5ee-42
- [x] W4-SETUP: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — setup=200
- [x] W4-AGENT: the row resolved the real Agent through the PUBLIC ctx.agents seam and assembled — assemble={"ok":true,"assembled":true,"label":"session-4a55638c-a5ee-42ff-93b9-2ea17e493e51","registration":{"ok":true,"name":"a5w4_confined_exec","via":"agent-ctx-tools-
- [x] W4-REGISTER: the row registered exactly the ONE restricted exec tool on the live Agent scope (argv row-fixed, model picks mode only) — registration={"ok":true,"name":"a5w4_confined_exec","via":"agent-ctx-tools-register"}
- [x] W4-PROMPT: turn accepted (202/200) — prompt=200
- [x] W4-TURN: the scripted chain ran to its DONE marker on the mock (fuse not tripped) — turn=A5W4W20261017T022625Z_RUN_DONE 3 results: A5W4-RES tag=A5W4W20261017T022625Z_RUN-pos-1-supported-deny mode=supported-deny ok=true code=null rc=1 pid=155 lease=terminated stage=provider-executed | A5W4
- [x] W4-STABLE: :3080 read-only probed before/after, untouched — before=401 after=401
- [x] W4-POS-SPAWN: positive control: REAL confined spawn — provider ok, launcher rc=0, payload pid real, lease terminated — ok=true rc=0 pid=153 lease=terminated spyDelta=1(probe legs included) ceDelta=1
- [x] W4-POS-SPILL: spill observation: launcher out/err refs EXIST under the plan dir; provider read-back matches the fixture content — out=true err=true match=true stdout=A5W4-OK-CONTROL 2026-10-17T02-26-25Z

- [x] W4-DOMAIN-DENY: OS enforcement plane ACTS on the payload: the same domain refuses the PRIVATE fixture (cat rc!=0, stderr EACCES, zero leak) — rc=1 eacces=true leaked=false stderr=/usr/bin/cat: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-wire-pr4/tests/homes
- [x] W4-RC-SURFACE: exit codes observed through the public deps spy (seam RunOutput carries NO rc — disclosed 观察-1 gap) — supported rc=0 · supported-deny rc=1 · launcherRc=0/0
- [x] W4-ENFORCE-LIVE: ENFORCE grading COMPUTED FROM LIVE ROWS: content-read & write enforced (double evidence), ABI present, network honestly unsupported, enforcement legs answered clean — abi=v4 content-read=enforced write=enforced network=unsupported legVerdicts={"selective":"ENFORCE-CONFIRMED","denyall":"ENFORCE-CONFIRMED","badhandled":"DEMO-CONFIRMED"} (badhandled DEMO = the false-ABSENT discriminator)
- [x] W4-HARD-REALM: hard realm correctly configured (观察 2): hardDimensions set on every instance; accepted spawns passed verifyHardProfileEvidence against the REAL captured evidence — hardDims=["content-read","write"] evidence=evidence://a5p4/probe/a5w4-realm-2026-10-17T02-2 realm=a5w4-realm-2026-10-17T02-26-25Z mechanism-names-double-evidence=true
- [x] W4-CHAN-OBS: G-6/G-7 observation plumbing reused at the provider face: ONE legal registry move on the row’s own Definition, the row-owned control subscription saw the REAL registry deliver (provider seam itself emits no §5 events — recorded, no closure claim; G-g posture unchanged) — controlEvents 1→3 move=disposed-reregistered
- [x] W4-POS-E2E: the tool calls rode the REAL dispatch path (model-driven: tool_result texts visible in the transcript the model read) — toolResults=3 transcriptToolResults=3
- [x] W4-PRISTINE: pinned tree porcelain = 0 at the end — porcelain=true

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.