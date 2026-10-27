# AC-1 C2 boot budget (declared before the first boot)

- Budget: **3 live Host boots** for the whole lane (ROUTER §0 / #406 precedent).
- Each boot is appended to `c2/boot-budget.jsonl` by `c2/run-c2.mjs` BEFORE the
  Host starts; the runner refuses a 4th declaration (`boot budget exhausted`).
- Every boot runs from a committed-clean drive script (`run-c2.mjs` +
  `ac1-assembly.mjs`) and a clean product tree; the runner refuses otherwise
  and records `bindings.driveScriptClean` / `teamTreeClean` in the record.
- Host: `tests/deepseek-harness-test-use` (worktree-local pristine copy of the
  root checkout, HEAD 639ed015397290b3745d163aafe02ffee4aa3f84, porcelain empty),
  asserted before and after each boot. Ports: World-factory 3181+ / mock 3491+;
  :3080 is read-only status-probed before/after (leak-check), never booted.
