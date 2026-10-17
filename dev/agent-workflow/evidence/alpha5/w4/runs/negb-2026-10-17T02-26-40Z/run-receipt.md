# A5W4 live wiring run — phase negb · 2026-10-17T02-26-40Z

- host: pinned 0.2.0-rc.2 @ `639ed01539` · port 3182 · world `tests/homes/a5w4-negb-2026-10-17T02-26-40Z` · realm `a5w4-realm-2026-10-17T02-26-40Z`
- pinned tree: head `639ed0153972` porcelain=true (before) / true (after)
- launcher (tracked source copy; dist carries no .py — disclosed): sha256 `cee10ed55f12123f`
- bare ABI probe (pre-boot, this host): `{"kind":"abi-available","abi_version":4,"raw":["[SC] create_ruleset(NULL,0,GET_VERSION): rc=4 errno=0 strerror='Success'`
- pos contrast receipt: `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-wire-pr4/dev/agent-workflow/evidence/alpha5/w4/runs/pos-2026-10-17T02-26-25Z/run-receipt.md`
- residual prelauncher processes after the run: `172 bash -c pgrep -af 'landlock-prelauncher' | head -5 || true`

- criteria: 18/18 pass

- [x] W4-PIN: pinned tree @639ed01539 · porcelain 0 · HEAD==pin — head=639ed0153972 porcelain=true
- [x] W4-DIST: provider factory reachable through the dist PUBLIC barrel only — /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-wire-pr4/packages/runtime/dist/packages/runtime/sandbox-provider/index.js
- [x] W4-LAUNCHER: trusted pre-launcher is the TRACKED source copy (disclosed: dist emit carries no .py assets) — sha256=cee10ed55f12123f (trustRoot names it)
- [x] W4-REVOKE-SELFTEST: revocation wrapper really removes the enforcement plane: bare probe finds the ABI, wrapper probe answers EACCES — bare rc=0 {"kind":"abi-available","abi_version":4,"raw":["[SC] create_ · wrapper rc=2 {"kind":"abi-unavailable","abi_version":null,"raw":["[SC] create_ruleset(NULL,0,GET_VERSIO
- [x] W4-PORTS: port 3182 free at start (IF-2 self-proof; netstat) — port 3182: no listener
- [x] W4-BOOT: test instance boots, token gate returns 303, row health answers — booted=true health={"ok":true,"pid":66,"applied":true,"barrel":true,"agents":[]}
- [x] W4-SESSION: the host public session/create entry returned a real sessionId — status=200 sid=session-83219b49-6c85-44
- [x] W4-SETUP: the real session ran a setup turn to a model reply (an Agent now exists behind the session) — setup=200
- [x] W4-AGENT: the row resolved the real Agent through the PUBLIC ctx.agents seam and assembled — assemble={"ok":true,"assembled":true,"label":"session-83219b49-6c85-441c-acc1-9f429b738472","registration":{"ok":true,"name":"a5w4_confined_exec","via":"agent-ctx-tools-
- [x] W4-REGISTER: the row registered exactly the ONE restricted exec tool on the live Agent scope (argv row-fixed, model picks mode only) — registration={"ok":true,"name":"a5w4_confined_exec","via":"agent-ctx-tools-register"}
- [x] W4-PROMPT: turn accepted (202/200) — prompt=200
- [x] W4-TURN: the scripted chain ran to its DONE marker on the mock (fuse not tripped) — turn=A5W4W20261017T022640Z_RUN_DONE 1 results: A5W4-RES tag=A5W4W20261017T022640Z_RUN-negb-0-revoked mode=revoked ok=false code=SANDBOX_UNAVAILABLE rc=null pid=null lease=null stage=provider-refused
- [x] W4-STABLE: :3080 read-only probed before/after, untouched — before=401 after=401
- [x] W4-NEGB-REFUSE: 负控 B OS-revoked contrast: SAME factory + SAME request shape with the enforcement plane OS-revoked (seccomp EACCES) → probe measures abi-unavailable → SANDBOX_UNAVAILABLE before spawn, zero confined-exec — code=SANDBOX_UNAVAILABLE abi=null eaccesInRaw=true ceDelta=0
- [x] W4-NEGB-FILTER-EVIDENCE: the revocation is OS-enforced and observed: the ABI probe run THROUGH THE WRAPPER answered with the kernel EACCES in its raw line (not a userspace mock) — raw="{"kind":"abi-unavailable","abi_version":null,"raw":["[SC] create_ruleset(NULL,0,GET_VERSION): rc=-1 errno=EACC…"
- [x] W4-NEGB-ZEROWRITE: no naked spawn left any trace: zero plan/out paths for the revoked instance (only probe scratch, disclosed), fixture world byte-unchanged, zero exec-answer rows — revokedProbePaths=0 revSpawnPaths=0 fixtures=2
- [x] W4-NEGB-CONTRAST: the CONTRAST is recorded: this request shape SUCCEEDED in the pos phase (real pid/rc) and is typed-refused here — the no-fallback law leaves no naked arm; system-wide (sysctl/boot) revocation is out of reach unprivileged (recorded constraint) — pos receipt cited: /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-wire-pr4/dev/agent-workflow/evidence/alpha5/w4/runs/pos-2026-10-17T02-26-25Z/run-receipt.md
- [x] W4-PRISTINE: pinned tree porcelain = 0 at the end — porcelain=true

token: launch token redacted at capture (REDACTED-<sha8>); raw instance log deleted after redaction.