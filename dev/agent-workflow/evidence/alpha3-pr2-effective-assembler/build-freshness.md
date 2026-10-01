BUILD + INSTALL-SURFACE FRESHNESS — Alpha.3 PR2
2026-10-01T19:38:39Z

Order (the install-surface rule: a source change that touches packages/runtime ships
its rebuilt artifacts in the SAME commit; `check:artifacts` without a preceding build is a
false green, so the gate was only ever run AFTER `pnpm build`).

1) $ pnpm build                                -> exit 0   (all nine packages "Done")
2) $ pnpm build:composition                   -> exit 1   (check-artifacts-committed: disk != index, i.e. the drift was REAL)
   the B/C list it printed:
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/effective-policy/permission-assembler.d.ts
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/effective-policy/permission-assembler.d.ts.map
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/effective-policy/permission-assembler.js
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/effective-policy/permission-assembler.js.map
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/permission-governance/types.d.ts
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/permission-governance/types.d.ts.map
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/permission-governance/types.js
       B produced-but-untracked (git add): packages/runtime/dist/packages/runtime/permission-governance/types.js.map
       B produced-but-untracked (git add): packages/runtime/dist/packages/storage/schema/permission-overlay.d.ts
       B produced-but-untracked (git add): packages/runtime/dist/packages/storage/schema/permission-overlay.d.ts.map
       B produced-but-untracked (git add): packages/runtime/dist/packages/storage/schema/permission-overlay.js
       B produced-but-untracked (git add): packages/runtime/dist/packages/storage/schema/permission-overlay.js.map
       C content-drift (git add): packages/runtime/dist/packages/runtime/effective-policy/index.d.ts
       C content-drift (git add): packages/runtime/dist/packages/runtime/effective-policy/index.d.ts.map
       C content-drift (git add): packages/runtime/dist/packages/runtime/effective-policy/index.js
       C content-drift (git add): packages/runtime/dist/packages/runtime/effective-policy/index.js.map
3) $ git add <packages/runtime/dist paths listed by the gate>   (explicit paths, no -A)
4) $ pnpm build:composition                   -> exit 0   (OK: 1384 files; incl. 1 glue placement)
5) $ pnpm check:artifacts                     -> exit 0   (same, standalone)

The build was run a SECOND time after the import rewiring (the leaf-module fix changes
the emitted import specifier), the dist was re-staged, and steps 4-5 were green again.

=== raw tails ===
--- pnpm build ---
    packages/domain build: Done
    packages/legacy build: Done
    packages/remote build: Done
    packages/contracts build: Done
    packages/storage build: Done
    packages/testkit build: Done
    packages/tools build: Done
    packages/runtime build: Done
    packages/client build: Done
    [pnpm build exit: 0]
--- pnpm build:composition (post-stage) ---
    $ node scripts/place-dist-glue.mjs && node scripts/build-client-composition.mjs packages/client packages/client/composition-shim && node scripts/check-artifacts-committed.mjs
    [check-artifacts-committed] OK: 1384 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))
    [build:composition exit: 0]
