# DRAFT (NOT APPLIED, NOT EXECUTED) — absolute-path fixture fix, kept separate per root convergence 2026-10-24

Root ruling: the diagnostic window RETAINS the relative `file_path: 'notes.txt'`
input to reproduce the observed behavior and ONLY adds the read-only
observation row; `workspace=Host源码根` is a **recorded fixture issue** (ledger
fact: provision-member-instance payload `workspace =
/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use`,
matching the control-request `authorityScope.matcher.resource` cwd-spelling).
Do NOT add an IO fallback for the Host root and do NOT treat the path change
as the root cause.

## The one-line change (when a future GO authorizes it)

File: `dev/agent-workflow/evidence/a5m2-edit-host-window/scripts/05-edit-window-runner.mjs`

```diff
-    if (text.startsWith('EDIT-ALLOW')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-ALLOWED' } }))
-    if (text.startsWith('EDIT-DENY')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'alpha', new_string: 'ALPHA-DENIED' } }))
+    if (text.startsWith('EDIT-ALLOW')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: join(FSROOT, 'notes.txt'), old_string: 'beta', new_string: 'BETA-ALLOWED' } }))
+    if (text.startsWith('EDIT-DENY')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: join(FSROOT, 'notes.txt'), old_string: 'alpha', new_string: 'ALPHA-DENIED' } }))
```

(Exact current lines are 05-edit-window-runner.mjs :484-485 relative-args
emitters; FSROOT is already in closure scope. The R/F permission allows stay
`kind: exact` under THIS HOME/fsroot — never Host source roots.)

Status: prepared-draft only; NOT part of the diagnostic entry; NO boot.
