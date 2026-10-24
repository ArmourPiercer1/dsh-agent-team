# DRAFT (NOT APPLIED) — functional-window fixture: member.workspace ≡ tool target ≡ THIS FSROOT

Root ruling 2026-10-24: the NEXT functional window is NOT the old
reproduction — member.workspace and the tool target unify on this fixture's
FSROOT, args carry an EXPLICIT ABSOLUTE notes.txt, IO allows stay `kind:
exact` on that file, and there is NO Host-cwd fallback anywhere. Applies
together with the new-package constants sync (new composed SHA / out-<sha>-
prefix / tgz name / pack sha256 / install dir — constants-sync-card class,
logic untouched); NOT against 37646 ("不用37646宣修复").

## Anchored new-package identity (CENTER receipt 2026-10-24; doc alignment
only — applying anything below still awaits the root's window GO)

- source SHA (int tip; carries EDIT/SRE handoff `87245b1ba` + vocabulary
  registration `0c15d1448` + the 2676 fix):
  `4a26ac9a904dc6ad1cef56b8b1c096ab88e131de`
- tgz `dsh-agent-team-0.1.1-alpha.2.tgz`, sha256
  `sha256:e3e845f082bb4bdc843f52e715ee5d30385495f37c70bc53d02497003720bc9f`
  (4,337,935 B / 1,866 entries; recomputed by CENTER)
- INSTALL_DIR `/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-e3e845f0`
  (frozen offline RC0; live mount 55/55 incl. edit/write all-0)
- fixture pkg-lock hash for THIS pack: `d23fe07ca7d7935562083dee5c7bb255afd4517199f0033021c9646fda67d9c0`
- constants-sync items at GO time (runner :40-:60, constants ONLY):
  `COMPOSED_SHA -> 4a26ac9a…`; `A5M2_EDIT_PACK_SHA256 -> sha256:e3e845f0…`;
  `A5M2_EDIT_INSTALL_DIR -> …/install-e3e845f0`; tgz NAME unchanged
  (`dsh-agent-team-0.1.1-alpha.2.tgz`); `EXPECTED_TGZ_DIR_PREFIX` — the
  receipt names no `out-<sha>-` dir; resolve the pack's actual
  `out-…-*/` directory in the field AT APPLICATION and confirm the prefix
  there (the fail-closed check :225 stays authoritative — never relax it);
  EDIT/SRE arm blob expectations re-measured against the new dist (if the
  handoff touched arm blobs, the identity.json expectation updates from the
  MEASURED bytes, never guessed).

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
