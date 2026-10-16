// PR8 E2E 套件登记（候选桩）—— Lane G / alpha5-pr8-accept。
// 只登记"套件↔矩阵行↔负例↔证据类型"的关系形状；`run: null` = 断言实现归 PR8 正式轮。
// matrixRows 引用 ../acceptance-matrix.json 的 row_id；negativeCases 引用 ../migration-negative-cases.json 的 case id。

export const SUITES = [
  {
    id: "00-guard-dispatch",
    title: "closed-world Guard + 有序装配 真实 Host 复跑（dynRan→typed deny；NEG-1/2/12 负控不削弱）",
    ownerPr: "PR1/PR1r 已落地面 × PR8 复验",
    derivesFrom: ["stage2b", "h6 H-A/H-D", "NEG-1 hazard 对照"],
    matrixRows: ["M-14", "SUP-09", "SUP-11"],
    evidenceTypes: ["real-host-receipt", "independent-reviewer-rerun", "baseline-diff-matrix"],
    run: null,
  },
  {
    id: "10-admission-grant",
    title: "Operation Admission + 多 Effect 单 ASK + one-shot Grant + hard-envelope 证据链",
    ownerPr: "PR2（#256 尾差收口面）× PR8",
    derivesFrom: ["PR2 lane 套件", "hard-envelope-admin-audit 复现形状"],
    matrixRows: ["M-01", "M-02", "M-03", "SUP-11"],
    evidenceTypes: ["fixture", "real-host-receipt"],
    run: null,
  },
  {
    id: "20-controlled-fs",
    title: "ControlledFs：deny-before-open（strace open=0）、Diff 偷读封禁、别名/TOCTOU 窄 Profile",
    ownerPr: "PR3 × PR8",
    derivesFrom: ["03-fs p03 (11/11)", "h6 H-A/HD-deny", "NEG-11"],
    matrixRows: ["M-01", "M-02", "M-03", "M-04", "M-05", "SUP-10"],
    evidenceTypes: ["fixture", "real-host-receipt", "os-probe"],
    run: null,
  },
  {
    id: "30-confined-process",
    title: "ConfinedProcessProvider：子进程入口自锁、旧 FD/CLOEXEC、network/metadata 维度独立负控",
    ownerPr: "PR4 × PR8",
    derivesFrom: ["10-landlock-lanes", "04-process corrections-addendum"],
    matrixRows: ["M-07", "SUP-01", "SUP-02", "SUP-03", "SUP-04", "SUP-05", "SUP-06", "SUP-13"],
    evidenceTypes: ["os-probe", "real-host-receipt"],
    run: null,
  },
  {
    id: "40-search-shell",
    title: "grep/glob R3 parity（真 rg、deny-before-spawn、Spill 归属）+ ShellAdapter 语义保留",
    ownerPr: "PR5 × PR8",
    derivesFrom: ["02-search p02 (12/12)+spill", "h6 H-B/HD-ask"],
    matrixRows: ["M-06", "M-07", "SUP-12", "SUP-13"],
    evidenceTypes: ["fixture", "real-host-receipt", "perf-measurement"],
    run: null,
  },
  {
    id: "50-ptc-lsp",
    title: "PTC 外层真实进程+内层逐次 Guard（PoC-6a 面）；LSP Strict deny 兜底与 per-Member 池（若 PoC-6b 通过）",
    ownerPr: "PR6 × PR8",
    derivesFrom: ["05-ptc p05+ptc-outer", "06-lsp p05 11 腿", "h6 HC3"],
    matrixRows: ["M-08", "M-09", "SUP-14", "SUP-15", "SUP-18"],
    evidenceTypes: ["fixture", "real-host-receipt"],
    run: null,
  },
  {
    id: "60-web-jobs-mcp-domain",
    title: "Web/Jobs/MCP 回环复跑+真实面申请项标注（ENV_BLOCK 如实）；Domain mock CAS/veto=0 side effects",
    ownerPr: "PR7 × PR8",
    derivesFrom: ["09-web-jobs-mcp 30/30", "p09-{web,jobs,mcp}-result.json"],
    matrixRows: ["M-10", "M-11", "M-12", "M-13", "SUP-07", "SUP-08"],
    evidenceTypes: ["loopback-mock", "real-host-receipt", "review-report"],
    run: null,
  },
  {
    id: "70-schema-migration",
    title: "严格 Schema + v3→vNext 迁移：消费 ② 负例全表（33 例逐条 verdict 断言）+ 权限不升高不变式机检",
    ownerPr: "PR8（依赖本 lane ①②启用）",
    derivesFrom: ["②migration-negative-cases.json"],
    matrixRows: ["M-14"],
    negativeCases: "ALL（N-V*/N-F*/N-D*/N-E*/N-M*/N-P*/N-C*）",
    evidenceTypes: ["fixture", "review-report"],
    run: null,
  },
  {
    id: "90-final-matrix-gate",
    title: "矩阵总 Gate：③每行 final_declaration 复跑（SUPPORTED→固定 HEAD 独立复现；UNSUPPORTED→运行时确实拒绝；DEFERRED→如实标注）+ 冷恢复 + Zero-Core scan + baseline-diff",
    ownerPr: "PR8",
    derivesFrom: ["REG-01 重跑模式", "S0 §6 自检清单形状"],
    matrixRows: "ALL-M + 展开后的 OS×Provider×profile 行",
    evidenceTypes: ["real-host-receipt", "independent-reviewer-rerun", "baseline-diff-matrix", "perf-measurement"],
    run: null,
  },
];

// 覆盖自检（PR8 正式轮实现的机检项形状，桩）：
export const COVERAGE_CHECK = {
  everyMatrixMRowCoveredBySomeSuite: null, // TODO(PR8-formal)
  everyRejectNegativeCaseAssertedSomewhere: null, // TODO(PR8-formal)
  noSuiteAssertsPreviewAsOsSyscall: null, // 审查项非代码项，登记于此防遗忘
};
