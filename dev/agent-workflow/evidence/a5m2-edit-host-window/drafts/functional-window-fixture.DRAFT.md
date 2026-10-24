# DRAFT (NOT APPLIED) — functional-window fixture: member.workspace ≡ tool target ≡ THIS FSROOT

Root ruling 2026-10-24: the NEXT functional window is NOT the old
reproduction — member.workspace and the tool target unify on this fixture's
FSROOT, args carry an EXPLICIT ABSOLUTE notes.txt, IO allows stay `kind:
exact` on that file, and there is NO Host-cwd fallback anywhere. Applies
together with the new-package constants sync (new composed SHA / out-<sha>-
prefix / tgz name / pack sha256 / install dir — constants-sync-card class,
logic untouched); NOT against 37646 ("不用37646宣修复").

## 1) Plugin row config (writePatch, dsh-agent-team row): pin the workspace

Law pinned read-only at 37646 host.ts: `defaultWorkspace` is a public config
string (validate :885); `withDefaultWorkspace` (:1031-1033) keeps an
explicit value ALWAYS, injecting `launchCwd` only when absent — and absent
is exactly what produced every window's `workspace =
…/tests/deepseek-harness-test-use` provision fact and the cwd-spelled
matcher. Add to the row's config block:

```diff
     '        seedMembers: []',
+    `        defaultWorkspace: ${JSON.stringify(FSROOT)}`,
```

Effect: member.workspace ≡ $FSROOT (world dir), no Host cwd reaches the
blueprint or any matcher. (Boot-anchor row keeps its own current default —
anchor never runs tools.)

## 2) Mock args (runner :484-485 today): explicit absolute target

```diff
-    if (text.startsWith('EDIT-ALLOW')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'beta', new_string: 'BETA-ALLOWED' } }))
-    if (text.startsWith('EDIT-DENY')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: 'notes.txt', old_string: 'alpha', new_string: 'ALPHA-DENIED' } }))
+    if (text.startsWith('EDIT-ALLOW')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: join(FSROOT, 'notes.txt'), old_string: 'beta', new_string: 'BETA-ALLOWED' } }))
+    if (text.startsWith('EDIT-DENY')) return emitOrClose(text, () => ({ name: 'edit', args: { file_path: join(FSROOT, 'notes.txt'), old_string: 'alpha', new_string: 'ALPHA-DENIED' } }))
```

`lexicalAnchor(instanceRootDir, args.file_path)` keeps an absolute lexeme's
placement (arm law); with workspace==FSROOT the absolute spelling is also
the workspace-consistent one. E2 target file joins FSROOT already.

## 3) Permissions unchanged (already exact-this-file; NO fallback)

read/write `kind: exact, path: <FSROOT>/notes.txt` + ask edit {kind: any} —
root-approved lanes, dense-3-effect scenario intact (needed for the fixed
producer's 3-rung mixed case).

## Application order (awaiting root's functional GO + new-package receipt)

1) constants sync (new identity) → 2) blocks 1-2 here → 3) DRY + REAL
validateBlueprintDocument PASS + materialized-blueprint check → 4) single
window under the standard monitor law. No auto-approval of any second Ask;
first-error stop.
