# Playwright Permission Diagnostic — F3-F11-F9-T1.4 (repair)

**Type:** Minimal Playwright permission diagnostic (NOT a product test)
**Date:** 2026-09-08 15:25 (+08:00)
**Workspace:** `D:\AgentDev\dsh-plugins\dsh-agent-team`
**File policy (session):** `workspace-write`
**Actor:** delegated subagent (fixed permission scope; approval prompts disabled — no `sandbox_permissions` escalation possible from inside this session)

**Constraints honored (all verified):**
- No DSH host started.
- `:3080` (stable instance) untouched.
- No upstream modification.
- No git edit / no push.
- Credential contents never printed — presence reported as boolean only.

---

## Result summary

| # | Check | Result |
|---|-------|--------|
| 1 | `tests/mock/.dsh-home-repair-r1` exists | **TRUE** (directory) |
| 2 | Credential presence (boolean) | **TRUE** |
| 3 | `playwright-cli --version` | exit **0**, version `0.1.19` |
| 4 | `playwright-cli open about:blank` | exit **1**, `EPERM` (out-of-workspace write denied) |
| 5 | Snapshot + close | **N/A** (step 4 failed, no page opened) |
| 6 | Controlled out-of-workspace write probe | **DENIED** (confirms sandbox boundary) |

**Classification: `sandbox issue`** (workspace-write file sandbox denies playwright-cli's
out-of-workspace daemon write). Root trigger = subagent session is missing the
`PWTEST_DAEMON_SESSION_DIR` env var that would relocate the daemon dir into the workspace.
**Not** a missing-credential issue (credentials present), **not** success, and **not** a
harness approval/escalation "subagent-permission" issue (no approval was requested or denied).

---

## Step 1 — Mock directory + credential presence (boolean only)

Path checked: `D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.dsh-home-repair-r1`

```
exists=True
isDirectory=True
top-level entries:
  [dir]  profiles
  [dir]  sessions
  [dir]  storages
  [file] .anonymous-user-id
  [file] .credentials.yaml
  [file] p6t6-directive.json
  [file] settings.yaml
```

Credential presence (booleans only — **no contents/values printed**):

```
credentials_file_exists   = True      # .credentials.yaml present
credentials_file_nonempty = True      # has content
# non-secret metadata only:
credentials_file_length_bytes = 161
credentials_line_count        = 7
```

> `profiles/web/**` is a plugin bundle (node_modules: `dsh-*`, `cordis*`, `@deepseek-ai`, …),
> **not** a credential store. The only credential artifact is the top-level `.credentials.yaml`.
> **Credential presence = TRUE.**

---

## Step 2 — `playwright-cli --version`

```powershell
playwright-cli --version
```

```
exit_code = 0
output    = 0.1.19
```

PASS — the CLI binary is present and invocable.

Install location (from later stack trace):
`C:\Users\user\AppData\Local\nvm\v24.20.0\node_modules\@playwright\cli\`

---

## Step 3 — `playwright-cli open about:blank`

```powershell
playwright-cli open about:blank
```

```
exit_code = 1
```

Redacted error (no secrets present; paths shown verbatim):

```
node:fs:622
  return binding.open(
                 ^
Error: EPERM: operation not permitted,
  open 'C:\Users\user\AppData\Local\ms-playwright\daemon\a464ccf0618f34da\default.err'
    at Object.openSync (node:fs:622:18)
    at Session.startDaemon (…\@playwright\cli\node_modules\playwright-core\lib\tools\cli-client\session.js:126:35)
    at async startSession (…\cli-client\program.js:263:10)
    at async program     (…\cli-client\program.js:130:23)
  errno: -4048, code: 'EPERM', syscall: 'open',
  path: 'C:\\Users\\user\\AppData\\Local\\ms-playwright\\daemon\\a464ccf0618f34da\\default.err'
Node.js v24.20.0
```

Key facts:
- Fails **before any browser launches**, inside `Session.startDaemon` → `openSync(default.err)`.
- Target path `C:\Users\user\AppData\Local\ms-playwright\daemon\…` is **outside** the session workspace.
- This is a filesystem write denial, not a missing-browser or network error.

Since `open` failed, the "take one snapshot and close" step does **not** apply.

---

## Step 4 — Controlled probe (isolate sandbox vs. playwright-specific)

A trivial file write to the **same** out-of-workspace location the daemon needed:

```powershell
Set-Content -LiteralPath 'C:\Users\user\AppData\Local\ms-playwright\_dsh_diag_probe.txt' -Value 'probe'
```

```
wrote_outside_workspace = False
error = Access to the path 'C:\Users\user\AppData\Local\ms-playwright\_dsh_diag_probe.txt' is denied.
probe_cleaned_up        = n/a          # file never created
daemon_dir_exists       = True          # C:\Users\user\AppData\Local\ms-playwright\daemon
```

A plain (non-node, non-playwright) write to that path is also **denied** → the physical
blocker is the **workspace-write file-sandbox boundary** (consistent with
`docs/TEST_METHODS.md` §5: "工作区外写入 → 拒绝"), not a playwright-specific fault.

---

## Root-cause analysis

**Daemon dir resolution** (`playwright-core/lib/tools/cli-client/registry.js`):

```js
function computeBaseDaemonDir() {
  if (process.env.PWTEST_DAEMON_SESSION_DIR)
    return process.env.PWTEST_DAEMON_SESSION_DIR;   // ← workspace-local override
  // win32 fallback:
  localCacheDir = process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  return join(localCacheDir, "ms-playwright", "daemon");  // ← out-of-workspace default
}
daemonProfilesDir = join(baseDaemonDir(), workspaceDirHash);
```

- `PWTEST_DAEMON_SESSION_DIR` in **this** subagent session = **empty** (verified:
  `Get-ChildItem env:` shows no `PWTEST_*`/`PLAYWRIGHT*` vars set).
  → falls back to `C:\Users\user\AppData\Local\ms-playwright\daemon` → **denied** by sandbox.
- `workspaceDirHash` = `a464ccf0618f34da`. Because there is **no `.playwright` marker dir**
  in the workspace tree (the workspace has `.playwright-cli`, which `findWorkspaceDir()` does
  **not** match), `workspaceDir` resolves to `undefined` and the hash is computed from the
  playwright-core **packageRoot**:
  `sha1("C:\Users\user\AppData\Local\nvm\v24.20.0\node_modules\@playwright\cli\node_modules\playwright-core").substring(0,16)
   = a464ccf0618f34da` (reproduced and matched). This is a **per-installation constant**,
  not workspace-specific.

**Evidence the workspace-local override was used before:**
`D:\AgentDev\dsh-plugins\dsh-agent-team\.playwright-cli\diagnostic-main\a464ccf0618f34da\default.err`
already exists in the workspace (0 bytes) — the **same** session hash. A prior run set
`PWTEST_DAEMON_SESSION_DIR` to `.playwright-cli\diagnostic-main` (a workspace-local dir), so its
daemon write landed **inside** the workspace and was allowed. That override was **not**
propagated into this subagent session.

---

## Classification (four-way)

| Candidate | Verdict | Reasoning |
|-----------|---------|-----------|
| **sandbox issue** | **✅ PRIMARY** | Physical blocker is the workspace-write file sandbox denying an out-of-workspace write (EPERM / "Access to the path … is denied"), confirmed by the controlled probe. |
| missing-credential issue | ❌ | `.credentials.yaml` exists and is non-empty → credential presence = TRUE. |
| success | ❌ | `open` exited 1; no page opened. |
| subagent-permission issue | ❌ (as a harness approval/escalation fault) | No harness approval was requested or auto-denied; no `sandbox_permissions` was needed or attempted. The missing piece is an **environment variable**, not an approval. (Loose sense: it is a subagent-session *environment/scope* gap — see remediation.) |

**Precise statement:** The workspace-write sandbox (root physical cause) rejects
`playwright-cli`'s daemon write to `C:\Users\user\AppData\Local\ms-playwright\daemon\…`
because `PWTEST_DAEMON_SESSION_DIR` is unset in this subagent session, so playwright-cli
used the out-of-workspace AppData default instead of a workspace-local dir.

---

## Remediation hint (for the delegating agent — NOT applied here; diagnostic only)

Setting the daemon dir inside the workspace avoids the sandbox boundary entirely, with **no
sandbox escalation required**:

```powershell
$env:PWTEST_DAEMON_SESSION_DIR = 'D:\AgentDev\dsh-plugins\dsh-agent-team\.playwright-cli\diagnostic-main'
playwright-cli open about:blank   # daemon write now lands in-workspace → expected to succeed
```

This matches the proven prior state (`.playwright-cli\diagnostic-main\a464ccf0618f34da\`
already exists). The env var must be present **at subagent spawn time**; it cannot be added by
escalation from inside this fixed-scope session. No other sandbox/approval change is implied.

---

## Redaction & safety notes

- `.credentials.yaml` **contents were never read or printed**; only existence + size + line
  count (non-secret metadata) were reported.
- The `playwright-cli` error output contained **no secrets** (paths only); reproduced verbatim.
- No DSH host was started; `:3080` was not contacted; no upstream file was modified; no git
  edit/push was performed. The only workspace writes were the controlled probe (which failed /
  created nothing) and this report file.

## Reproduction commands (exact)

```powershell
# 1. mock dir + credential booleans (no content)
Test-Path -LiteralPath 'D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.dsh-home-repair-r1'
(Get-Item  'D:\AgentDev\dsh-plugins\dsh-agent-team\tests\mock\.dsh-home-repair-r1\.credentials.yaml').Length

# 2. version
playwright-cli --version                      # -> 0.1.19, exit 0

# 3. open (fails under workspace-write)
playwright-cli open about:blank               # -> exit 1, EPERM on AppData\…\default.err

# 4. boundary probe
Set-Content 'C:\Users\user\AppData\Local\ms-playwright\_probe.txt' 'x'   # -> Access denied
```
