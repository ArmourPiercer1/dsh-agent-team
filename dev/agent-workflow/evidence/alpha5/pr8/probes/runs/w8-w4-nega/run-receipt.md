# A5W4 live wiring run — phase nega · 2026-10-17T03-07-18Z

- host: pinned 0.2.0-rc.2 @ `639ed01539` · port 3186 · world `tests/homes/a5w8-nega-2026-10-17T03-07-18Z` · realm `a5w4-realm-2026-10-17T03-07-18Z`
- pinned tree: head `639ed0153972` porcelain=true (before) / true (after)
- launcher (tracked source copy; dist carries no .py — disclosed): sha256 `cee10ed55f12123f`
- bare ABI probe (pre-boot, this host): `{"kind":"abi-available","abi_version":4,"raw":["[SC] create_ruleset(NULL,0,GET_VERSION): rc=4 errno=0 strerror='Success'`
- ENFORCE grading (from live rows): n/a (negative phase)
- residual prelauncher processes after the run: `173 bash -c pgrep -af 'landlock-prelauncher' | head -5 || true`

- criteria: 19/19 pass

- [x] W4-PIN: pinned tree @639ed01539 · porcelain 0 · HEAD==pin — head=639ed0153972 porcelain=true
- [x] W4-DIST: provider factory reachable through the dist PUBLIC barrel only — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w8/packages/runtime/dist/packages/runtime/sandbox-provider/index.js
- [x] W4-LAUNCHER: trusted pre-launcher is the TRACKED source copy (disclosed: dist emit carries no .py assets) — sha256=cee10ed55f12123f (trustRoot names it)
- [x] W4-REVOKE-SELFTEST: revocation wrapper really removes the enforcement plane: bare probe finds the ABI, wrapper probe answers EACCES — bare rc=0 {"kind":"abi-available","abi_version":4,"raw":["[SC] create_ · wrapper rc=2 {"kind":"abi-unavailable","abi_version":null,"raw":["[SC] create_ruleset(NULL,0,GET_VERSIO
- [x] W4-PORTS: port 3186 free at start (IF-2 self-proof; netstat) — port 3186: no listener
- [x] W4-BOOT: test instance boots, token gate returns 303, row health answers — booted=true health={"ok":true,"pid":64,"applied":true,"barrel":true,"agents":[]}
- [x] W4-SESSION: the host public session/create entry returned a real sessionId — status=200 sid=session-1b41ed37-ad6f-46
- [x] W4-SETUP: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — setup=200
- [x] W4-AGENT: the row resolved the real Agent through the PUBLIC ctx.agents seam and assembled — assemble={"ok":true,"assembled":true,"label":"session-1b41ed37-ad6f-4680-855e-5ce0a0d33f40","registration":{"ok":true,"name":"a5w4_confined_exec","via":"agent-ctx-tools-
- [x] W4-REGISTER: the row registered exactly the ONE restricted exec tool on the live Agent scope (argv row-fixed, model picks mode only) — registration={"ok":true,"name":"a5w4_confined_exec","via":"agent-ctx-tools-register"}
- [x] W4-PROMPT: turn accepted (202/200) — prompt=200
- [x] W4-TURN: the scripted chain ran to its DONE marker on the mock (fuse not tripped) — turn=A5W4W20261017T030718Z_RUN_DONE 5 results: A5W4-RES tag=A5W4W20261017T030718Z_RUN-nega-3-pty mode=pty ok=false code=IO_POLICY_UNSUPPORTED rc=undefined pid=undefined lease=undefined stage=wiring-boundar
- [x] W4-STABLE: :3080 read-only probed before/after, untouched — before=401 after=401
- [x] W4-NEG-NET: 负控 A network class: deny AND restricted (PoC-4b honesty) plus the forged unconfined all typed-refused IO_POLICY_UNSUPPORTED BEFORE any process — counting spy ZERO, originals recorded — net-deny: code=IO_POLICY_UNSUPPORTED spyDelta=0 msg="network profile 'deny' is not offered in realm 'a5w4-realm-2026-10-17T…" | net-restricted: code=IO_POLICY_UNSUPPORTED spyDelta=0 msg="network profile 'restricted' is not offered in realm 'a5w4-realm-2026-…" | net-forged: code=IO_POLICY_UNSUPPORTED spyDelta=0 msg="network profile 'unconfined' is outside the closed set (deny | restric…"
- [x] W4-NEG-PTY: 负控 A PTY class (unexpressible on the frozen seam): typed IO_POLICY_UNSUPPORTED at the WIRING BOUNDARY before any provider entry point (a silent capability downgrade is not representable) — code=IO_POLICY_UNSUPPORTED stage=wiring-boundary-before-provider
- [x] W4-NEG-MISSING: 负控 A 缺件 class: launcher absent → SANDBOX_UNAVAILABLE typed (no-fallback law) with ZERO confined-exec; existence preflight (python3 --version / test -f) recorded as precondition probes, not payload spawns — code=SANDBOX_UNAVAILABLE ceDelta=0 msg="confined spawn unavailable: precondition check: launcher script '/srv/workspace/dsh-plugin…"
- [x] W4-NEG-ZEROSPAWN: zero-spawn evidenced STRUCTURALLY: zero exec-answer rows, zero confined-exec spy rows, zero plans/out paths anywhere under scratch, fixture world byte-unchanged (2 seeded files) — execAnswerRows=0 ceSpyRows=0 scratchSpawnPaths=0 fixtures=2
- [x] W4-NEG-E2E: every refusal rode the REAL dispatch path into the transcript (refusal text reached the model, originals in the ledger) — toolResults=5 ledgerToolRows=5
- [x] W4-PRISTINE: pinned tree porcelain = 0 at the end — porcelain=true

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.