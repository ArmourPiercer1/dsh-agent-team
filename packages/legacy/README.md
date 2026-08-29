# @dsh-agent-team/legacy — empty slot (reference-only)

**vNext does not depend on legacy code.** This package is the intentionally
empty slot of the frozen 9-package layout (TaskDoc §11 package-boundary rule).
No legacy source is copied here, and no package in this repo may import
`@dsh-agent-team/legacy` or any legacy fork package.

- The legacy fork is frozen as a read-only reference (tag
  `legacy-agent-team-pre-vnext`); its behavior inventory and per-file reuse
  decisions live in `docs/migration/` (`legacy-behavior-inventory.md`,
  `reuse-map.md`).
- Reuse levels govern how legacy *behavior* re-enters vNext: A/B/C-level
  ports are rewritten into the target packages against vNext contracts;
  D-level content stays in Git history. Legacy code is **reference-only** and
  never vendored into this repo.
- This `package.json` carries no `main` / `exports` / `scripts` on purpose:
  the slot holds no buildable code until a later phase says otherwise.
