# @dsh-agent-team/legacy — frozen legacy session inspection (read-only reader)

**vNext does not depend on legacy team logic.** This package holds ONE narrow
piece of frozen legacy surface: the read-only **session-reader**
(`packages/legacy/session-reader/`), which inspects legacy Team session files
and exposes inspection facts to vNext through the `inspectLegacyTeam` entry.

- **Build:** the reader is compiled separately into the **runtime dist mirror**
  (`tsconfig.build.json`, `noCheck`, `outDir: ../runtime/dist`) and ships with
  the install-surface artifacts (`packages/runtime/dist/packages/legacy/
  session-reader/...`).
- **Runtime:** the host plugin loads the reader **unconditionally at apply**
  (`loadLegacyInspect()`, layout-agnostic candidate search, production dist
  mirror first); if no candidate loads it fails closed with
  `TEAM_PLUGIN_GLUE_UNAVAILABLE` — no silent fallback.
- **Boundary:** the reader is the ONLY legacy code in this repo. No other
  legacy source is copied here, and no package in this repo may import the
  legacy fork or any legacy fork package. The frozen fork (tag
  `legacy-agent-team-pre-vnext`) remains a read-only reference; its behavior
  inventory and per-file reuse decisions live in `docs/migration/`
  (`legacy-behavior-inventory.md`, `reuse-map.md`).
- Reuse levels govern how legacy *behavior* re-enters vNext: A/B/C-level
  ports are rewritten into the target packages against vNext contracts;
  D-level content stays in Git history.

> 勘误留痕（2026-09-28，PR #36 审查轮）：本 README 旧版把本包描述为"空槽 /
> 无 scripts / 无可构建代码"——与 P7-T7 集成后的实际不符（session-reader 自
> P7 起在本包并随 runtime dist 分发）。外部冻结 fork 仅为参考的表述保持不变。
