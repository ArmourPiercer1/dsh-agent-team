/**
 * THE CONFINED PROCESS PROVIDER — the lane's implementation of the frozen
 * `ConfinedProcessProvider` seam shape (probe / spawn / requestCancellation /
 * settleTermination) over the C-PROC phase closed set, the Linux P1 posture
 * (the trusted launcher self-locks at child entry, THEN execs the untrusted
 * argv — the DSH host process never calls `landlock_restrict_self`), and the
 * NO-FALLBACK law: when the launcher is absent, the ABI does not answer, or
 * a hard-required dimension lacks its double evidence, the refusal is typed
 * and happens BEFORE any process exists. "Sandbox unavailable → run naked"
 * cannot be expressed through this seam.
 *
 * DORMANT: this provider is wired to nothing. `prepare`/`execute` are exposed
 * as a real split (plan PoC-4c: async launch may hold prepare aside from
 * execute; a plan is ONE-SHOT — consuming it twice is a second spawn without
 * a second grant, so the second execute is refused). Cancellation settles
 * through the lease law (`settleTermination` is the only path to
 * `terminated`; an unconfirmed settlement keeps its `sideEffectUnknown`).
 *
 * R-1 STREAMING ARM (user ruling 07:53Z, PARALLEL-ADDITIVE): `spawnStreaming`
 * reuses the SAME prepare ladder, byte-pin double gate, one-shot plan law and
 * lease/termination vocabulary, and hands back a LIVE handle (stdin Writable,
 * stdout/stderr Readers, lease, terminate). `spawn`/`RunOutput` and every old
 * call site keep their exact historical behavior.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/provider
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn as spawnChildProcess } from 'node:child_process';
import {} from 'node:stream';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { refuse } from './contract-stub.js';
import { advancePhase } from './phases.js';
import { compileFdPlan, fdPlanToPayload } from './fd-inheritance.js';
import { evaluateNetworkRequirement } from './network.js';
import { createLauncherDeps, probeToCapabilities, runAbiProbe, runAvailabilityPreflight, runEnforcementLeg, verifyLauncherIntegrity, ENFORCEMENT_LEGS, } from './probe-abi.js';
import { recordLegEvidence, verifyHardProfileEvidence } from './realm-evidence.js';
const EVIDENCE_BASE = 'evidence://a5p4/probe';
/** Create one provider instance for one realm. Probes are captured ONCE per instance. */
export function createConfinedProcessProvider(opts) {
    // Accessor casts: the runtime program carries the plugin node-min ambient
    // shim (src/plugin/node-min.d.ts) which structurally narrows the `process`
    // and `URL` globals; the lane reads env and module paths through globalThis
    // so the SHARED typecheck (`pnpm -r run typecheck`) passes untouched.
    const laneProcess = globalThis.process;
    const assembly = opts.assembly ?? {};
    const launcher = createLauncherDeps({
        pythonPath: assembly.pythonPath ?? laneProcess?.env?.['A5P4_PYTHON'] ?? 'python3',
        launcherPath: assembly.launcherPath ?? join(dirname(fileURLToPath(import.meta.url)), 'launcher', 'landlock-prelauncher.py'),
    });
    const deps = opts.deps ?? {
        availability: () => ({
            rows: runAvailabilityPreflight({
                pythonPath: launcher.pythonPath,
                launcherPath: launcher.launcherPath,
                runnerCommand: opts.runnerCommand ?? null,
            }),
        }),
        run: launcher.run,
        probeFacts: () => {
            const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
            const abi = runAbiProbe(launcher);
            const legs = {};
            for (const leg of ENFORCEMENT_LEGS)
                legs[leg] = runEnforcementLeg(launcher, leg, join(opts.scratchRoot, `probe-${stamp}`, leg));
            return { abiVersion: abi.abiVersion, legs };
        },
    };
    const plans = new Map();
    const consumedPlans = new Set();
    const leases = new Map();
    let captured = null;
    const streamRuns = new Map();
    const osProcess = globalThis.process;
    const defaultSpawnStream = (argv) => {
        try {
            const child = spawnChildProcess(launcher.pythonPath, [...argv], { stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
            const handshake = child.stdio[3];
            if (child.pid === undefined || handshake === undefined) {
                try {
                    child.kill('SIGKILL');
                }
                catch { /* already gone */ }
                return refuse('SANDBOX_UNAVAILABLE', 'streaming launcher spawn produced no pid/fd-3 channel');
            }
            const guard = (s) => { s?.on('error', () => { }); };
            guard(child.stdin);
            guard(child.stdout);
            guard(child.stderr);
            const exit = new Promise((resolve) => {
                child.once('exit', (code, signal) => resolve({ code: typeof code === 'number' ? code : null, signal: typeof signal === 'string' ? signal : '' }));
                child.once('error', () => resolve({ code: null, signal: 'spawn-error' }));
            });
            return {
                ok: true,
                value: Object.freeze({
                    pid: child.pid,
                    stdin: child.stdin,
                    stdout: child.stdout,
                    stderr: child.stderr,
                    handshake,
                    kill: (signal) => { try {
                        return child.kill(signal);
                    }
                    catch {
                        return false;
                    } },
                    exit,
                }),
            };
        }
        catch (error) {
            return refuse('SANDBOX_UNAVAILABLE', `streaming launcher spawn failed: ${String(error?.message ?? error).slice(0, 160)}`);
        }
    };
    const streamSpawn = deps.spawnStream ?? defaultSpawnStream;
    const signalProcess = deps.signalProcess
        ?? ((pid, signal) => { try {
            osProcess?.kill?.(pid, signal);
            return true;
        }
        catch {
            return false;
        } });
    const pidAlive = deps.pidAlive ?? ((pid) => existsSync(`/proc/${pid}`));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    /** Read the launcher's single-line fd-3 handshake, bounded; null = missing/unparsable/timed out. */
    function readHandshake(stream, timeoutMs) {
        return new Promise((resolve) => {
            let buffer = '';
            let done = false;
            const onData = (chunk) => {
                buffer += String(chunk);
                const nl = buffer.indexOf('\n');
                if (nl < 0)
                    return;
                const line = buffer.slice(0, nl).trim();
                if (line.length === 0)
                    return;
                try {
                    const parsed = JSON.parse(line);
                    finish(typeof parsed === 'object' && parsed !== null ? parsed : null);
                }
                catch {
                    finish(null);
                }
            };
            const onEnd = () => { finish(null); };
            const onError = () => { finish(null); };
            const finish = (value) => {
                if (done)
                    return;
                done = true;
                clearTimeout(timer);
                stream.off('data', onData);
                stream.off('end', onEnd);
                stream.off('error', onError);
                resolve(value);
            };
            const timer = setTimeout(() => { finish(null); }, timeoutMs);
            stream.on('data', onData);
            stream.on('end', onEnd);
            stream.on('error', onError);
        });
    }
    /** Own the SIGNAL sequence for one streaming run (single flight; never settles a lease). */
    function beginKillSequence(run, graceMs, deadlineMs) {
        if (run.killStarted)
            return;
        run.killStarted = true;
        const t0 = Date.now();
        let termSent = false;
        let killSent = false;
        const tick = () => {
            if (run.exited && !pidAlive(run.payloadPid))
                return; // gone; settling is the lease law's job
            if (!run.exited && pidAlive(run.payloadPid)) {
                if (!termSent) {
                    signalProcess(run.payloadPid, 'SIGTERM');
                    termSent = true;
                }
                else if (!killSent && Date.now() - t0 >= graceMs) {
                    signalProcess(run.payloadPid, 'SIGKILL');
                    run.process.kill('SIGKILL'); // the launcher supervisor too — never leave a supervisor behind
                    killSent = true;
                }
            }
            if (Date.now() - t0 >= deadlineMs + 1_000)
                return; // signal loop is bounded too
            setTimeout(tick, 25);
        };
        tick();
    }
    /**
     * The byte-pin gate (assembly.launcherSha256). UNPINNED passes — that is
     * the historical lane face. When pinned, the bytes at the configured
     * launcher path must hash to the pin; this gate runs before any probe leg
     * and again before every confined-exec (bytes swapped AFTER a clean probe
     * still never reach `run`).
     */
    function launcherIntegrityGate() {
        if (assembly.launcherSha256 === undefined)
            return { ok: true, value: true };
        const verdict = verifyLauncherIntegrity({ launcherPath: launcher.launcherPath, launcherSha256: assembly.launcherSha256 });
        if (verdict.kind === 'PINNED-MATCH')
            return { ok: true, value: true };
        return refuse('SANDBOX_UNAVAILABLE', `launcher integrity gate: ${verdict.detail}`);
    }
    /** probe(): availability → byte-pin gate → real legs → capability rows (cached per instance). */
    async function probe() {
        if (captured !== null)
            return { ok: true, value: captured.rows };
        const avail = deps.availability();
        const missing = avail.rows.filter((r) => !r.present && r.subject !== 'runner-command');
        if (missing.length > 0) {
            return refuse('SANDBOX_UNAVAILABLE', `confined spawn unavailable: ${missing.map((m) => m.note).join('; ')}`);
        }
        const integrity = launcherIntegrityGate();
        if (!integrity.ok)
            return integrity;
        const facts = deps.probeFacts();
        const evidenceRef = `${EVIDENCE_BASE}/${opts.realmId}/${Date.now().toString(36)}`;
        const legs = Object.entries(facts.legs).map(([leg, v]) => recordLegEvidence(leg, v?.verdict ?? 'MIXED/FAILED', evidenceRef, ['--enforce-leg', leg]));
        const rows = probeToCapabilities({ kind: facts.abiVersion === null ? 'abi-unavailable' : 'abi-available', abiVersion: facts.abiVersion, rawLines: [], syscall: 'landlock_create_ruleset(NULL,0,GET_VERSION)' }, facts.legs, { realmId: opts.realmId, trustRoot: opts.trustRoot, evidenceRef });
        captured = { rows, evidence: { realmId: opts.realmId, trustRoot: opts.trustRoot, abiVersion: facts.abiVersion, legs, capabilities: rows } };
        return { ok: true, value: rows };
    }
    /** prepare(): every gate BEFORE any process exists; compiles the launcher policy. */
    async function prepare(request) {
        if (request.argv.length === 0 || request.argv.some((a) => typeof a !== 'string' || a.length === 0)) {
            return refuse('IO_POLICY_UNSUPPORTED', 'argv must be a non-empty array of non-empty strings (explicit argv, never a shell string)');
        }
        if (request.realmId !== opts.realmId) {
            return refuse('IO_POLICY_UNSUPPORTED', `realm confusion: request carries realm '${request.realmId}', this provider is bound to '${opts.realmId}'`);
        }
        const net = evaluateNetworkRequirement(request.networkProfile, request.realmId);
        if (!net.ok)
            return net;
        const p = await probe();
        if (!p.ok)
            return p;
        if (captured !== null && captured.evidence.abiVersion === null) {
            // The authoritative probe measured NO landlock ABI on this host.
            // Confinement is impossible and the naked-spawn arm does not exist.
            return refuse('SANDBOX_UNAVAILABLE', 'confined spawn refused: the authoritative probe measured no landlock ABI on this host; an unconfined fallback is forbidden by construction');
        }
        if (assembly.minAbiVersion !== undefined && captured !== null) {
            // The ABI pin (assembly floor): the assembler decides which kernel ABI
            // its realm's policies need; a measured answer below the floor refuses
            // here — BEFORE any process exists — never "runs on a weaker plane".
            const measured = captured.evidence.abiVersion;
            if (measured === null || measured < assembly.minAbiVersion) {
                return refuse('SANDBOX_UNAVAILABLE', `ABI pin: the authoritative probe measured ${String(measured)}, below the assembly-pinned floor v${String(assembly.minAbiVersion)} — confined spawn refused before any process exists`);
            }
        }
        if ((opts.hardDimensions?.length ?? 0) > 0 && captured !== null) {
            const check = verifyHardProfileEvidence(captured.evidence, { realmId: request.realmId, hardDimensions: opts.hardDimensions ?? [] });
            if (!check.ok)
                return check;
        }
        const compiled = compileFdPlan(request.declaredFds ?? []);
        if (!compiled.ok) {
            return refuse('IO_POLICY_UNSUPPORTED', `fd inheritance declaration refused: ${compiled.problems.map((x) => `${x.path}: ${x.detail}`).join('; ')}`);
        }
        const planId = `plan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const plansDir = join(opts.scratchRoot, 'plans');
        mkdirSync(plansDir, { recursive: true });
        const outDir = join(opts.scratchRoot, 'out', planId);
        mkdirSync(outDir, { recursive: true });
        const policyPath = join(plansDir, `${planId}.json`);
        const policy = {
            argv: [...request.argv],
            cwd: request.cwd,
            env: request.env.map(([k, v]) => [k, v]),
            runtime_base: true,
            allow: (request.allowPaths ?? []).map((a) => ({
                path: a.path,
                bits: {
                    execute: a.accessBits.execute === true,
                    write_file: a.accessBits.writeFile === true,
                    read_file: a.accessBits.readFile === true,
                    read_dir: a.accessBits.readDir === true,
                    remove_file: a.accessBits.removeFile === true,
                    make_reg: a.accessBits.makeReg === true,
                    truncate: a.accessBits.truncate === true,
                },
            })),
            fd_plan: fdPlanToPayload(compiled.plan),
            close_extra_fds: true,
        };
        writeFileSync(policyPath, JSON.stringify(policy));
        const plan = Object.freeze({ planId, phase: 'prepared', request, policyPath, outDir, fdPlan: compiled.plan });
        plans.set(planId, plan);
        return { ok: true, value: plan };
    }
    /** execute(): consumes a prepared plan EXACTLY ONCE; runs the launcher confined-exec. */
    async function execute(plan) {
        if (!plans.has(plan.planId) || consumedPlans.has(plan.planId)) {
            return refuse('IO_POLICY_UNSUPPORTED', `plan '${plan.planId}' was already consumed — re-executing a plan is a second spawn without a second grant`);
        }
        const moved = advancePhase('prepare', 'execute');
        if (!moved.ok)
            return refuse('IO_POLICY_UNSUPPORTED', 'phase machine refused prepare → execute (impossible on this lane; kept defensive)');
        // Re-gate the pinned bytes IMMEDIATELY before the spawn: bytes swapped
        // after a clean probe still never reach `run`. The refusal happens
        // BEFORE the plan is consumed — the one-shot grant is not burned by a
        // refusal that stopped nothing (at most one spawn per grant stays true
        // because the gate re-opens only when the bytes match the pin again).
        const integrity = launcherIntegrityGate();
        if (!integrity.ok)
            return integrity;
        consumedPlans.add(plan.planId);
        const r = deps.run([launcher.launcherPath, '--confined-exec', '--policy', plan.policyPath, '--out-dir', plan.outDir], 60_000);
        let answer = null;
        try {
            const line = r.stdout.trim().split('\n').filter((l) => l.length > 0).pop();
            if (line !== undefined)
                answer = JSON.parse(line);
        }
        catch {
            answer = null;
        }
        if (answer === null) {
            return refuse('SANDBOX_UNAVAILABLE', `launcher answer unparseable (rc=${String(r.rc)}); the confined run's outcome is unknown — never assumed benign: ${(r.stderr || r.stdout).slice(0, 240)}`);
        }
        if (answer['abi_unavailable'] === true) {
            return refuse('SANDBOX_UNAVAILABLE', 'the confined launcher measured no landlock ABI at exec time and refused to run the payload unconfined');
        }
        const readOut = (ref) => {
            if (typeof ref !== 'string')
                return '';
            try {
                return readFileSync(ref, 'utf8').slice(0, 64 * 1024);
            }
            catch {
                return '';
            }
        };
        const stdout = readOut(answer['out_ref']);
        const stderr = readOut(answer['err_ref']);
        const leaseId = `lease-${plan.planId}`;
        const status = 'terminated'; // spawnSync semantics: the child is reaped when run() returns
        const lease = Object.freeze({
            leaseId,
            grantFingerprint: plan.request.grantFingerprint,
            realmId: plan.request.realmId,
            bindingId: plan.request.bindingId,
            memberScope: plan.request.memberScope,
            executionKind: 'process',
            status,
        });
        leases.set(leaseId, lease);
        const pid = typeof answer['pid'] === 'number' ? answer['pid'] : 0;
        const receipt = Object.freeze({ lease, processIdentity: `pid:${pid}:${plan.planId}` });
        return { ok: true, value: Object.freeze({ receipt, output: Object.freeze({ stdout, stderr, combined: stdout + stderr }), lease }) };
    }
    /** spawn(): prepare + execute as ONE call (the frozen seam's shape). */
    async function spawn(request) {
        const prepared = await prepare(request);
        if (!prepared.ok)
            return prepared;
        return execute(prepared.value);
    }
    /**
     * executeStreaming(): the R-1 arm over a PREPARED plan — same one-shot plan
     * law and same byte-pin re-gate (refusal BEFORE consumption never burns the
     * grant), then the launcher's stream mode with live pipes. The handle's
     * lease starts `active`; only `settleTermination` ever makes it terminal.
     */
    async function executeStreaming(plan, streaming) {
        if (!plans.has(plan.planId) || consumedPlans.has(plan.planId)) {
            return refuse('IO_POLICY_UNSUPPORTED', `plan '${plan.planId}' was already consumed — re-executing a plan is a second spawn without a second grant`);
        }
        const moved = advancePhase('prepare', 'execute');
        if (!moved.ok)
            return refuse('IO_POLICY_UNSUPPORTED', 'phase machine refused prepare → execute (impossible on this lane; kept defensive)');
        const integrity = launcherIntegrityGate();
        if (!integrity.ok)
            return integrity; // BEFORE consumption: the grant survives a gate refusal (same law as execute)
        consumedPlans.add(plan.planId);
        const spawned = streamSpawn([launcher.launcherPath, '--confined-exec-stream', '--policy', plan.policyPath, '--out-dir', plan.outDir]);
        if (!spawned.ok)
            return spawned;
        const proc = spawned.value;
        const handshakeTimeoutMs = streaming?.handshakeTimeoutMs ?? 15_000;
        const handshake = await readHandshake(proc.handshake, handshakeTimeoutMs);
        if (handshake === null || handshake['stream'] !== true || typeof handshake['pid'] !== 'number') {
            // no half-lived handles: the launcher is killed, and its reap is awaited BOUNDED
            proc.kill('SIGKILL');
            await Promise.race([proc.exit.catch(() => undefined), sleep(2_000)]);
            if (handshake?.['abi_unavailable'] === true) {
                return refuse('SANDBOX_UNAVAILABLE', 'the confined launcher measured no landlock ABI at stream-exec time and refused to run the payload unconfined');
            }
            return refuse('SANDBOX_UNAVAILABLE', `streaming launcher handshake missing, unparsable or timed out (${String(handshakeTimeoutMs)}ms) — no streaming handle is issued`);
        }
        const payloadPid = handshake['pid'];
        const leaseId = `lease-${plan.planId}`;
        const lease = Object.freeze({
            leaseId,
            grantFingerprint: plan.request.grantFingerprint,
            realmId: plan.request.realmId,
            bindingId: plan.request.bindingId,
            memberScope: plan.request.memberScope,
            executionKind: 'process',
            status: 'active',
        });
        const run = { leaseId, process: proc, payloadPid, exited: false, exitInfo: null, exitWaiters: [], killStarted: false, terminating: null };
        void proc.exit.then((info) => {
            run.exited = true;
            run.exitInfo = info;
            for (const w of run.exitWaiters.splice(0))
                w(info);
        }, () => {
            run.exited = true;
            run.exitInfo = { code: null, signal: 'exit-error' };
            for (const w of run.exitWaiters.splice(0))
                w(run.exitInfo);
        });
        leases.set(leaseId, lease);
        streamRuns.set(leaseId, run);
        const exited = new Promise((resolve) => {
            if (run.exited && run.exitInfo !== null)
                resolve(run.exitInfo);
            else
                run.exitWaiters.push(resolve);
        });
        const terminate = (options) => {
            if (run.terminating !== null)
                return run.terminating;
            run.terminating = (async () => {
                const held0 = leases.get(leaseId);
                if (held0 === undefined)
                    return refuse('IO_POLICY_UNSUPPORTED', `lease '${leaseId}' is not one of this provider's leases`);
                if (held0.status === 'terminated')
                    return { ok: true, value: held0 };
                const held = held0.status === 'active'
                    ? (() => { const m = Object.freeze({ ...held0, status: 'cancelling' }); leases.set(leaseId, m); return m; })()
                    : held0;
                const graceMs = options?.graceMs ?? 1_500;
                const deadlineMs = options?.deadlineMs ?? 8_000;
                beginKillSequence(run, graceMs, deadlineMs);
                const t0 = Date.now();
                let confirmed = false;
                for (;;) {
                    if (run.exited && !pidAlive(payloadPid)) {
                        confirmed = true;
                        break;
                    }
                    if (Date.now() - t0 >= deadlineMs)
                        break;
                    await sleep(25);
                }
                return settleTermination(held, confirmed);
            })();
            return run.terminating;
        };
        const handle = Object.freeze({
            lease,
            processIdentity: `pid:${payloadPid}:${plan.planId}`,
            pid: payloadPid,
            stdin: proc.stdin,
            stdout: proc.stdout,
            stderr: proc.stderr,
            exited,
            terminate,
        });
        return { ok: true, value: handle };
    }
    /** spawnStreaming(): prepare + executeStreaming as ONE call (the R-1 parallel entry). */
    async function spawnStreaming(request, streaming) {
        const prepared = await prepare(request);
        if (!prepared.ok)
            return prepared;
        return executeStreaming(prepared.value, streaming);
    }
    /** requestCancellation(): the REQUEST leg — moves the lease, settles via the sync reap. */
    async function requestCancellation(lease) {
        const held = leases.get(lease.leaseId);
        if (held === undefined) {
            return refuse('IO_POLICY_UNSUPPORTED', `lease '${lease.leaseId}' is not one of this provider's leases`);
        }
        const run = streamRuns.get(lease.leaseId);
        if (run !== undefined) {
            // Async streaming semantics (R-1): the REQUEST moves the lease to
            // 'cancelling' and starts the signal sequence — it NEVER settles the
            // lease itself; only settleTermination does (the frozen law).
            if (held.status === 'active') {
                const moved = Object.freeze({ ...held, status: 'cancelling' });
                leases.set(lease.leaseId, moved);
                beginKillSequence(run, 1_500, 8_000);
                return { ok: true, value: moved };
            }
            return { ok: true, value: held };
        }
        if (held.status === 'terminated')
            return { ok: true, value: held };
        // Sync spawn semantics: when run() returned the child is already reaped,
        // so the request settles confirmed HERE. An async provider settles with
        // settleTermination instead — the request never settles itself.
        const settled = Object.freeze({ ...held, status: 'terminated' });
        leases.set(held.leaseId, settled);
        return { ok: true, value: settled };
    }
    /** settleTermination(): the ONLY path to a terminal lease status. */
    async function settleTermination(lease, confirmed = true) {
        const held = leases.get(lease.leaseId);
        if (held === undefined) {
            return refuse('IO_POLICY_UNSUPPORTED', `lease '${lease.leaseId}' is not one of this provider's leases`);
        }
        if (held.status === 'terminated')
            return { ok: true, value: held };
        const next = confirmed
            ? Object.freeze({ ...held, status: 'terminated' })
            : Object.freeze({ ...held, status: 'termination-unconfirmed' });
        leases.set(held.leaseId, next);
        return { ok: true, value: next };
    }
    return Object.freeze({ probe, prepare, execute, spawn, spawnStreaming, executeStreaming, requestCancellation, settleTermination });
}
//# sourceMappingURL=provider.js.map