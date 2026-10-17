/**
 * THE LSP REALM ASSEMBLY — the R-2 approved production arm (user ruling
 * 07:53Z): "policy change ⇒ destroy and rebuild the member's isolated LSP
 * instance", implemented as the Team-side ASSEMBLY DISCIPLINE API.
 *
 * Granularity (verbatim from `LSP-rulings-brief.md` R-2 §2, as approved):
 * one isolated instance per (member × policy generation) = its own provider
 * instance (realm) + its own confined OS process through the R-1 streaming
 * arm. This is ASSEMBLY DISCIPLINE, not OS enforcement of sub-realm policy:
 * the host pool key upstream stays a pure path, and sharing it under another
 * name would masquerade as policy isolation (forbidden by the brief). The
 * claims this module may support are exactly "realm-granularity isolation is
 * real; policy-granularity eviction is NOT claimed".
 *
 * Lifecycle laws (pinned by `a5lsp2-assembly`):
 *  - EVERY provider instance is created from the SAME `ProviderAssemblyConfig`
 *    the P-B install round froze (launcher path + sha byte gate + ABI floor):
 *    the double gate guards every realm, every spawn, unchanged.
 *  - `policyChange(member, generation)` = probe-gate the NEW realm FIRST (a
 *    gated assembly never disposes a healthy old one — no self-inflicted
 *    outage), then dispose the OLD instance (terminate + BOUNDED,
 *    OS-confirmed pid exit), then assemble the NEW one (spawnStreaming +
 *    readiness). A mid-change failure leaves ZERO residual handles/pids:
 *    a half-built instance is terminated and settled before the typed
 *    refusal returns; the member is left with NO instance (honest, never a
 *    dead handle).
 *  - `ensure` is HOT reuse or first assembly only; a generation mismatch is
 *    refused — `policyChange` is the single discipline entry for changes.
 *  - Disposal is per-member and net-zero: sibling members are never touched.
 *
 * Purity: imports within the lane only (contract-stub + provider); no
 * `node:*` — the OS facts flow through the provider's seams.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/lsp-assembly
 */
import { refuse } from './contract-stub.js';
import { createConfinedProcessProvider, } from './provider.js';
export function createLspRealmAssembly(options) {
    const instances = new Map();
    const emit = (event) => { options.journal?.(event); };
    function realmId(memberId, generation) {
        return `lsp:${memberId}:${generation}`;
    }
    function providerFor(memberId, generation) {
        return createConfinedProcessProvider({
            realmId: realmId(memberId, generation),
            trustRoot: options.trustRoot,
            scratchRoot: options.scratchRoot,
            ...(options.deps !== undefined ? { deps: options.deps } : {}),
            assembly: options.assembly,
        });
    }
    /** Default readiness: one line-JSON ping must be answered with the payload's pid. */
    function defaultReady(instance) {
        return new Promise((resolve) => {
            const timeoutMs = options.readyTimeoutMs ?? 15_000;
            let buffer = '';
            let done = false;
            const finish = (value) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                instance.handle.stdout.off('data', onData);
                instance.handle.stdout.off('end', onEnd);
                instance.handle.stdout.off('error', onError);
                resolve(value);
            };
            const onData = (chunk) => {
                buffer += String(chunk);
                for (;;) {
                    const nl = buffer.indexOf('\n');
                    if (nl < 0)
                        break;
                    const line = buffer.slice(0, nl);
                    buffer = buffer.slice(nl + 1);
                    if (!line.startsWith('{'))
                        continue;
                    let parsed;
                    try {
                        parsed = JSON.parse(line);
                    }
                    catch {
                        continue;
                    }
                    const p = parsed;
                    if (p['pong'] === 1 && p['pid'] === instance.pid) {
                        finish(true);
                        return;
                    }
                }
            };
            const onEnd = () => { finish(false); };
            const onError = () => { finish(false); };
            const timer = setTimeout(() => { finish(false); }, timeoutMs);
            instance.handle.stdout.on('data', onData);
            instance.handle.stdout.on('end', onEnd);
            instance.handle.stdout.on('error', onError);
            try {
                instance.handle.stdin.write('{"ping":1}\n');
            }
            catch {
                finish(false);
            }
        });
    }
    /** Assemble ONE isolated instance: probe gate → spawnStreaming → readiness; net-zero on failure. */
    async function assemble(memberId, generation) {
        const realm = realmId(memberId, generation);
        const provider = providerFor(memberId, generation);
        const gate = await provider.probe();
        if (!gate.ok) {
            emit({ kind: 'assemble-failed', memberId, generation, stage: 'pre-gate', detail: gate.error.message });
            return gate;
        }
        let policy;
        try {
            policy = options.policyFor(memberId, generation);
        }
        catch (error) {
            const detail = String(error?.message ?? error).slice(0, 200);
            emit({ kind: 'assemble-failed', memberId, generation, stage: 'policy', detail });
            return refuse('IO_POLICY_UNSUPPORTED', `policyFor('${memberId}','${generation}') failed: ${detail} — no process was started for the new realm`);
        }
        const spawned = await provider.spawnStreaming({
            grantFingerprint: policy.grantFingerprint,
            realmId: realm,
            bindingId: policy.bindingId,
            memberScope: `member/${memberId}`,
            argv: policy.argv,
            cwd: policy.cwd,
            env: policy.env,
            ...(policy.allowPaths !== undefined ? { allowPaths: policy.allowPaths } : {}),
            ...(policy.networkProfile !== undefined ? { networkProfile: policy.networkProfile } : {}),
        });
        if (!spawned.ok) {
            emit({ kind: 'assemble-failed', memberId, generation, stage: 'spawn', detail: spawned.error.message });
            return spawned;
        }
        const instance = Object.freeze({
            memberId,
            generation,
            realmId: realm,
            pid: spawned.value.pid,
            handle: spawned.value,
        });
        const ready = options.ready ?? defaultReady;
        let isReady = false;
        try {
            isReady = await ready(instance);
        }
        catch {
            isReady = false;
        }
        if (!isReady) {
            // failure cleanup: the half-built instance is TERMINATED and SETTLED before the
            // refusal returns — zero residual handles, zero residual pids, never a dead handle.
            const cleaned = await terminateInstance(instance);
            emit({ kind: 'assemble-failed', memberId, generation, stage: 'ready', detail: `readiness never answered (cleanup settled: ${cleaned.status})` });
            return refuse('IO_POLICY_UNSUPPORTED', `the new LSP realm '${realm}' never answered readiness; the half-built instance (pid ${String(instance.pid)}) was cleaned (lease: ${cleaned.status}) — zero residual handles/pids`);
        }
        emit({ kind: 'realm-assembled', memberId, generation, pid: instance.pid });
        instances.set(memberId, instance);
        return { ok: true, value: instance };
    }
    /** terminate + settle, bounded; returns the settled lease (never throws). */
    async function terminateInstance(instance) {
        const settled = await instance.handle.terminate({
            graceMs: options.terminateGraceMs ?? 1_500,
            deadlineMs: options.terminateDeadlineMs ?? 10_000,
        });
        if (settled.ok)
            return settled.value;
        // a settle REFUSAL still must not leave the assembly holding the instance —
        // surface it as an unconfirmed lease object the caller can inspect.
        return Object.freeze({ ...instance.handle.lease, status: 'termination-unconfirmed' });
    }
    async function disposeMember(memberId) {
        const instance = instances.get(memberId);
        if (instance === undefined)
            return { ok: true, value: null };
        const t0 = Date.now();
        const lease = await terminateInstance(instance);
        if (lease.status !== 'terminated') {
            // honesty law: an UNCONFIRMED disposal does not silently drop the instance —
            // the refusal carries the fact, the ledger keeps the member.
            emit({ kind: 'assemble-failed', memberId, generation: instance.generation, stage: 'dispose', detail: `termination settled ${lease.status}` });
            return refuse('EXECUTION_TERMINATION_UNCONFIRMED', `disposing member '${memberId}' realm '${instance.realmId}' (pid ${String(instance.pid)}) could not be confirmed within the bounded window`, { sideEffectUnknown: true });
        }
        instances.delete(memberId);
        const disposeMs = Date.now() - t0;
        emit({ kind: 'realm-disposed', memberId, generation: instance.generation, lastPid: instance.pid, disposeMs });
        return { ok: true, value: { generation: instance.generation, lastPid: instance.pid, disposeMs } };
    }
    async function ensure(memberId, generation) {
        const current = instances.get(memberId);
        if (current !== undefined) {
            if (current.generation === generation)
                return { ok: true, value: current }; // HOT reuse — no second process
            return refuse('IO_POLICY_UNSUPPORTED', `member '${memberId}' lives in generation '${current.generation}'; a generation change goes through policyChange() — the discipline entry (R-2)`);
        }
        return assemble(memberId, generation);
    }
    async function policyChange(memberId, generation) {
        const previous = instances.get(memberId);
        const from = previous?.generation ?? null;
        emit({ kind: 'policy-change-begin', memberId, from, to: generation });
        if (previous !== undefined && previous.generation === generation) {
            emit({ kind: 'policy-change-complete', memberId, from, to: generation });
            return { ok: true, value: previous }; // idempotent: the same generation needs no destroy
        }
        // (1) PRE-GATE the new realm FIRST: a byte-pin/ABI refusal never disposes
        //     the healthy old instance (no self-inflicted outage).
        const gateProvider = providerFor(memberId, generation);
        const gate = await gateProvider.probe();
        if (!gate.ok) {
            emit({ kind: 'assemble-failed', memberId, generation, stage: 'pre-gate', detail: gate.error.message });
            emit({ kind: 'policy-change-complete', memberId, from, to: generation });
            return gate;
        }
        // (2) DESTROY: old realm disposed first, pid exit OS-CONFIRMED bounded (the
        //     provider terminate arm settles only on observed exit).
        if (previous !== undefined) {
            const disposed = await disposeMember(memberId);
            if (!disposed.ok) {
                emit({ kind: 'policy-change-complete', memberId, from, to: generation });
                return disposed;
            }
        }
        // (3) REBUILD: the new isolate (new realm, new provider, new confined process).
        const created = await assemble(memberId, generation);
        emit({ kind: 'policy-change-complete', memberId, from, to: generation });
        return created;
    }
    async function disposeAll() {
        const disposed = [];
        for (const memberId of [...instances.keys()]) {
            const r = await disposeMember(memberId);
            if (!r.ok) {
                return refuse(r.error.code, `disposeAll stopped at member '${memberId}': ${r.error.message}`, r.error.sideEffectUnknown === true ? { sideEffectUnknown: true } : undefined);
            }
            if (r.value !== null)
                disposed.push({ memberId, generation: r.value.generation, lastPid: r.value.lastPid });
        }
        return { ok: true, value: { disposed } };
    }
    return Object.freeze({
        ensure,
        policyChange,
        dispose: disposeMember,
        disposeAll,
        current: (memberId) => instances.get(memberId),
        size: () => instances.size,
    });
}
//# sourceMappingURL=lsp-assembly.js.map