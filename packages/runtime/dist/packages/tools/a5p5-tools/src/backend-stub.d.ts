/**
 * `a5p5-tools` Phase 2 — the CONTRACT-STUB side of the parity matrix: a
 * fixture backend that speaks the C-PROC closed stage walk
 * probe → prepare → execute → terminate (INTERFACES-v1.md), reports pre-
 * execute refusals as typed C-FS failures (denied/hidden/undetermined —
 * hidden legs stay typed, never silent), and settles runs with the lease-
 * plane settlement facts. `terminate ≠ cancel`: the stage walk always ends
 * at `terminate`; the WHY of an end lives in the settlement.
 *
 * This is the shape PR3/PR4 will speak. Parity with the direct implementation
 * is claimed ONLY over the shared fixture table (`test/a5p5-parity.test.ts`).
 *
 * Purity: no `node:*`; the only side effect is what the injected sink does.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/backend-stub
 */
import type { ScenarioTable, ToolEffectBackend } from './backend-contract.js';
export declare function createContractStubBackend(table: ScenarioTable): ToolEffectBackend;
//# sourceMappingURL=backend-stub.d.ts.map