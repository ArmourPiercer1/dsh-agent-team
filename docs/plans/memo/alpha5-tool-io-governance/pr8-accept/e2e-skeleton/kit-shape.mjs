// PR8 E2E kit 形状占位 —— Lane G / alpha5-pr8-accept / 候选态。
// 本文件只声明形状，不实现任何断言或运行逻辑（`run: null` 一律由 PR8 正式轮替换）。
// 正式化时本对象迁入 tests/kits/alpha5-pr8-e2e/kit.mjs，路径一律从 tests/paths.mjs 取。

/**
 * @typedef {Object} KitShape
 * @property {string} id
 * @property {string} status  恒 'SKELETON'（正式轮改写）
 * @property {object} baselinePin  运行时从 tests/paths.mjs 解析，禁止在此硬编码 SHA/版本
 * @property {object} world  DSH_HOME / 端口 / teardown 约定
 * @property {object} provenance  衍生来源（PoC 原始记录只引用不改写）
 * @property {object} fuses  熔断与卫生
 * @property {Array<object>} suites  见 suites/registry.mjs
 */

export const KIT_SHAPE = {
  id: "alpha5-pr8-e2e",
  status: "SKELETON",
  baselinePin: {
    // 唯一来源 = tests/paths.mjs（AGENTS.md pin 纪律）。占位解析器，正式轮实现：
    source: "tests/paths.mjs",
    fields: ["DSH_BASELINE_VERSION", "TEST_USE_BASELINE_SHA", "CLIENT_COMMIT_HASH"],
    resolve: null, // TODO(PR8-formal): import + 断言 porcelain=0 前后
  },
  world: {
    dshHomePattern: "tests/homes/alpha5-pr8-<UTC时间戳>", // TEST_METHODS §7 临时世界
    portFamily: [3180, 3186],
    realHostPortMode: "stage2b-isolated-world(:3185 型)",
    forbidden: [":3080 稳定实例", "稳定实例 DSH_HOME"],
    teardown: "删除世界；保留必在 evidence 登记路径",
  },
  provenance: {
    derivesFrom: [
      "stage2b run-2026-10-15T22-44-01 (10/10)",
      "h6 run-h6-2026-10-15T23-15-50 (18/18)",
      "10-landlock-lanes",
      "09-web-jobs-mcp 回环 (30/30)",
    ],
    rule: "KIT 断言可更新，PoC 原始记录逐字保留（SUP-09/COORDINATION 纪律）",
  },
  fuses: {
    stormFuseThreshold: 300, // SUP-16：oracle 修正 + fuse>300 继承
    tokenPolicy: "采集即脱敏",
    evidenceRoot: "dev/agent-workflow/evidence/alpha5/pr8/<commit>/",
  },
  contracts: {
    acceptanceMatrix: "../acceptance-matrix.json", // ③ 行引用源
    migrationNegativeCases: "../migration-negative-cases.json", // ② 负例源
    schemaAdrCandidate: "../ADR-CANDIDATE-blueprint-schema-vnext.md",
  },
  suites: "see ./suites/registry.mjs", // 避免占位期相对 IO，正式轮装载
};
