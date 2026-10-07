import type { EnvelopeContains, GovernanceEnvelopeView, GovernanceWarningDocsPort } from '../../governance-warning/index.js';
import type { PermissionAuthorityFacts } from './permission-plane.js';
import type { TeamPluginConfig } from './types.js';
/**
 * The structural projection of the Cordis plugin context this entry uses
 * (the concrete context is proxied by the loader; only these members are
 * consumed — plan §19.2 keeps the entry independent of the Cordis types).
 *
 * Exported under the stable name the P1-T4 baseline test pins; only the
 * member surface evolved (the production entry provides `teamRoot`
 * synchronously, arms the row-stop backstop effect plus the remote-mount
 * watcher when the mount waits for the connection service, and reports a
 * missing row config through the facade's `ready` rejection).
 */
export interface TeamPluginHostContext {
    get(name: string): unknown;
    provide(name: string, value: unknown): void;
    effect(factory: () => () => void, label?: string): void;
    /**
     * Cordis event registration: the listener is owned by this row's fiber
     * and disposed with the row. Optional in this structural projection —
     * the entry keeps Cordis-type independence (plan §19.2) and minimal
     * structural doubles omit it; the consumers (the 0.1.5 `webServer`
     * property-read seam and the 0.1.7-rc.1 Team activation fence — the
     * AWAITED `agent/created` veto + the `agent/disposed` rollback barrier,
     * both registered in {@link apply} with `{ global: true }`) guard the
     * absence. On every real host the Cordis context proxy always provides
     * it.
     *
     * Structural overloads (NOT the upstream `Context` type — the entry
     * keeps its deliberate structural independence, guide §4.1):
     *
     * - `'internal/get'` — the property-read waterfall (the 0.1.5
     *   `webServer` compatibility seam);
     * - `'agent/created'` — the awaited serial activation announcement
     *   (the listener's rejection propagates into the create/resume and
     *   the upstream AgentLoop rolls the unpublished agent back — the
     *   fence's veto point, guide §8.1);
     * - `'agent/disposed'` — the fire-and-forget disposal announcement
     *   (the fence's exact-generation rollback barrier, guide §8.2).
     */
    on?(name: 'internal/get', listener: (readerCtx: TeamPluginHostContext, prop: string, error: Error, next: () => unknown) => unknown, options?: boolean | Record<string, unknown>): void;
    on?(name: 'agent/created', listener: (payload: {
        readonly agent: unknown;
        readonly source: string;
        readonly signal?: AbortSignal;
    }) => void | Promise<void>, options?: boolean | Record<string, unknown>): void;
    on?(name: 'agent/disposed', listener: (payload: {
        readonly agent: unknown;
    }) => void, options?: boolean | Record<string, unknown>): void;
}
/**
 * Validate the row `config` channel loudly (plan §19.2: the row config is
 * the entry's ONLY input channel — a malformed composition must reject
 * apply, not degrade).
 * @param raw - the unvalidated `config:` of the row.
 * @returns the validated config.
 * @throws {TeamPluginError} TEAM_PLUGIN_CONFIG_INVALID with the failing field.
 */
export declare function validateTeamPluginConfig(raw: unknown): TeamPluginConfig;
/**
 * The default live-agent glue URL, derived from this host entry's own
 * module location: the dist layout carries the byte-copied mirror
 * (place-dist-glue.mjs) next to the emitted host.js, and the source layout
 * carries the original .mjs next to host.ts — one relative specifier, both
 * layouts. An explicit `config.glueUrl` always wins.
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the derived glue file URL.
 */
export declare function defaultGlueUrl(hostModuleUrl: string): string;
/**
 * The row config with the default-workspace derivation applied
 * (plugin-bundle-form D9): an explicit `config.defaultWorkspace` always
 * wins; when absent the team rows inherit the directory the operator
 * launched the host from. The machine-agnostic bundle row (root
 * `cordis.patch.yml`) can carry no absolute path, but the projection fold
 * REQUIRES a resolvable effective workspace on every team row (member row
 * workspace ?? team default ?? fail-closed ProjectionError — a created
 * team without one is unprojectable end-to-end), and the glue's own
 * `effectiveRootWorkspace` falls back to the same config value — so the
 * entry supplies the launch directory and both surfaces agree.
 * @param config - the validated row config.
 * @param launchCwd - the host process's working directory.
 * @returns the config with `defaultWorkspace` guaranteed present.
 */
export declare function withDefaultWorkspace(config: TeamPluginConfig, launchCwd: string): TeamPluginConfig;
/**
 * The default storage-seam URL candidates, per module layout (the dist
 * entry sits five directory levels below the runtime package root —
 * `dist/packages/runtime/src/plugin` — the source entry two — the same
 * layout-agnostic candidate pattern as `loadLegacyInspect`). An explicit
 * `config.seamUrl` always wins.
 * @param hostModuleUrl - this entry's `import.meta.url`.
 * @returns the candidate file URLs, dist layout first.
 */
export declare function defaultSeamUrlCandidates(hostModuleUrl: string): readonly string[];
/**
 * A4-PR6 review round 1 (fix 2/6) — the WARNING lane's docs adapter,
 * exported so the HOST ADAPTER ITSELF is testable (the review's finding:
 * the blocker lived in this glue and was invisible to the fake-port
 * suites). The pre-fix shape read the leader envelope through the
 * lane-facing `permissionEnvelope` fact, whose abstention value is the
 * zero-authority document `{ rules: [] }` and whose `ok` flag is dropped:
 * on an UNKNOWN binding, a canonicalization fault, or binding drift
 * across the canonicalization await, the comparator saw a leader with NO
 * claims, answered `consistent`, and the gate opened — an UNREADABLE
 * authority document silently passing the gate, reachable from the wire.
 * The adapter now consumes the three-state `permissionEnvelopeState`: a
 * faulted read maps to `{ stage: 'unreadable' }` → the closed
 * `authority-document-unreadable` corrupt arm (fail closed, never
 * acknowledgeable). The lane polarity stays exactly as documented: an
 * abstained EXPANSION read still means zero authority on the approval
 * plane (widening is the failure mode there); only the COMPARATOR gets
 * the third state.
 */
/** The envelope-document shape both authority documents share. */
export type AuthorityEnvelopeDocument = {
    readonly rules: readonly {
        readonly operationClass: string;
        readonly matcher: {
            readonly kind: 'exact' | 'subtree' | 'fingerprint';
            readonly resource: string;
        };
        readonly maximumEffect: 'deny' | 'ask' | 'allow';
    }[];
};
export declare function buildGovernanceWarningDocs(deps: {
    readonly blueprintSchemaVersion: PermissionAuthorityFacts['blueprintSchemaVersion'];
    readonly blueprintContentHash: PermissionAuthorityFacts['blueprintContentHash'];
    readonly permissionEnvelopeState: PermissionAuthorityFacts['permissionEnvelopeState'];
    readonly teamHardEnvelope: PermissionAuthorityFacts['teamHardEnvelope'];
    readonly envelopeView: (document: AuthorityEnvelopeDocument) => GovernanceEnvelopeView;
    readonly leaderInstanceId: string;
}): GovernanceWarningDocsPort;
/** Structural view of the one legal containment seam on the fs provider. */
export interface GovernanceWarningFsProvider {
    contains?: (parent: {
        targetKey: string;
    }, child: {
        targetKey: string;
    }) => unknown;
}
/**
 * A4-PR6 review round 1 (fix 3/6) — the WARNING lane's containment
 * predicate: THREE-STATE BY CONSTRUCTION (never throws, `undefined` =
 * undeterminable). The permission PLANE's `fsContainsKeys` keeps its own
 * documented law (absent `contains` THROWS → the kernel's typed
 * `PERMISSION_EFFECT_CONTEXT_UNAVAILABLE`); the warning lane must not
 * inherit that shape: a throw escaped `runGate`/`governanceStartGate`
 * unmapped as `internal-error`, and the plane's `=== true` coercion
 * collapsed every non-`true` provider answer (including "I cannot
 * answer") to a fabricated `false` — which made the comparator's
 * `undetermined` verdict UNREACHABLE in production, replacing
 * "coverage unknown → warning" with a guess. Here: absent provider or
 * absent seam → `undefined`; a throwing provider → `undefined`; a
 * non-boolean answer → `undefined`; only a real `true`/`false` decides.
 * (Pinned end to end by `a4p6-governance-warning-host-adapter.test.ts`:
 * the real service over the real adapters reaches `undetermined` →
 * `warning-required`.)
 */
export declare function buildGovernanceWarningContains(fsBackend: () => GovernanceWarningFsProvider): EnvelopeContains;
/**
 * The plugin name (Cordis named-export protocol; the row id is
 * `dsh-agent-team`).
 */
export declare const name = "dsh-agent-team";
/**
 * The hard host service dependencies (Cordis inject protocol): the Loader
 * keeps this row INACTIVE until all four exist and applies it once they
 * do (the pre-S5A harness row injected the same set minus
 * `sessionPersistence`, which it resolved lazily — R122 swapped that seam:
 * rc.1 removed `sessionPersistence.ensureMaterialized`, and the stock
 * `sessions` service's `flush(session)` is the upstream ACP's own
 * replacement, present in both eras, so waiting on it can only ever delay,
 * never deadlock, the bootstrap). M2 (plan §15.5): `workspaceRegistry`
 * joins the set as a HARD dependency — the web profile's workspace row
 * provides it, and a composition without that row parks this row forever
 * (the team surface is absent, never half-wired); the entry re-checks the
 * service in code (fail-closed, before any durable effect) so a
 * malformed provider can never reach the closure. The entry still passes
 * a LAZY accessor under the frozen glue's `sessionPersistence` deps key
 * so any call that races the provider fails with a stable code instead of
 * a TypeError.
 */
export declare const inject: string[];
/**
 * The plugin entry (Cordis named-export protocol: the loader awaits the
 * apply fiber). The apply body itself never rejects: it provides the
 * `teamRoot` facade synchronously and tracks every setup failure through
 * the facade's `ready` promise (a rejected apply fiber is absorbed into
 * the Cordis logger, which the harness never observes — `ready` is the
 * single observable failure channel).
 * @param ctx - the plugin context (services via `ctx.get`; this entry
 *   provides `teamRoot`).
 * @param config - the row `config:` (validated loudly; see
 *   {@link validateTeamPluginConfig}).
 */
export declare function apply(ctx: TeamPluginHostContext, config?: unknown): Promise<void>;
//# sourceMappingURL=host.d.ts.map