/**
 * `a5p5-tools` Phase 2 — the DIRECT implementation side of the parity matrix:
 * the lane's own shaping of a scenario into the closed outcome shapes. It
 * speaks NO contract stages (that is the stub's plane; the parity law puts
 * the trace outside the comparable set), performs its pre-execute binding
 * check the same way the contract path refuses at `prepare`, and streams the
 * same fixture chunks into the same sink while "executing".
 *
 * Same fixture table as `backend-stub.ts`, written as a SEPARATE
 * implementation — the parity test is what proves the two agree.
 *
 * Purity: no `node:*`; the only side effect is what the injected sink does.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/backend-direct
 */
import type { ScenarioTable, ToolEffectBackend } from './backend-contract.js';
export declare function createDirectBackend(table: ScenarioTable): ToolEffectBackend;
//# sourceMappingURL=backend-direct.d.ts.map