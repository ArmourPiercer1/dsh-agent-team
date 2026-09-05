/**
 * The `catalog` category handler (design note §3): pre-creation blueprint
 * discovery. Backed by the {@link RemoteCatalogPort} (host wiring:
 * `BlueprintCatalog`, `packages/domain/blueprint`).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/catalog
 */
import type { RemoteMethodParams } from '../contracts/params.js';
import type { RemoteCatalogPort } from './ports.js';
/** The catalog category handler (`catalog.list`, `catalog.get`). */
export declare function createRemoteCatalogHandler(deps: RemoteCatalogPort): (method: string, params: RemoteMethodParams) => {
    readonly data: unknown;
};
//# sourceMappingURL=catalog.d.ts.map