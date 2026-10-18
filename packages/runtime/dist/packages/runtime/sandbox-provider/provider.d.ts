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
import { type Readable, type Writable } from 'node:stream';
import { type AssuranceDimension, type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js';
import { type FdPlan } from './fd-inheritance.js';
import { type AvailabilityRow, type LegName, type LegVerdict, type RunResult } from './probe-abi.js';
/** One path allow-entry with the named access bits the launcher maps. */
export interface AllowPathEntry {
    readonly path: string;
    readonly accessBits: {
        readonly execute?: boolean;
        readonly writeFile?: boolean;
        readonly readFile?: boolean;
        readonly readDir?: boolean;
        readonly removeFile?: boolean;
        readonly makeReg?: boolean;
        readonly truncate?: boolean;
    };
}
/** One confined-spawn request (argv is an explicit array — never a shell string). */
export interface SpawnRequest {
    readonly grantFingerprint: string;
    readonly realmId: string;
    readonly bindingId: string;
    readonly memberScope: string;
    readonly argv: readonly string[];
    readonly cwd: string;
    readonly env: readonly (readonly [string, string])[];
    readonly networkProfile?: 'deny' | 'restricted';
    readonly allowPaths?: readonly AllowPathEntry[];
    /** FD inheritance declarations (fd-inheritance.ts is the law). FD CONTRACT:
     *  fd 3 is launcher-owned (handshake / ruleset reservation) — declaring it
     *  is NOT using it; `prepare()` refuses such a plan as `fd-launcher-owned`
     *  before any plan or process exists, one-shot and streaming arms alike. */
    readonly declaredFds?: readonly {
        fd: number;
        purpose: 'stdin' | 'stdout' | 'stderr' | 'delivery';
        resourceFingerprint: string;
    }[];
    /**
     * B2 EXIT-CODE FIDELITY (additive, DEFAULT OFF): ask the streaming arm to carry
     * the payload's OWN completion state as the observable exit code.
     *
     * Off (every existing caller, and this field's absence is exactly "off"), the
     * stream arm keeps its historical law: the launcher exits 0 whatever the payload
     * did and the payload's code lives only in `<out-dir>/exit.json` as bookkeeping —
     * the constant-completion law the glob and search rows were built against and
     * still pin. On, the launcher re-exports the waitpid result: a payload that
     * RETURNED is reported with the code it returned, and a payload killed by signal
     * N is reported as 128+N — a value the launcher CONSTRUCTS from the convention
     * /bin/sh uses, not a code the payload returned. The two can coincide (a payload
     * that runs `exit 137` produces the number a SIGKILL death produces), so the
     * reported number never identifies a cause of death; the raw waitpid-derived rc,
     * which does separate the two cases, stays in `<out-dir>/exit.json`.
     *
     * It changes NO policy, NO grant and NO rule: the flag rides the launcher argv
     * only, which is why `prepare()` never copies it into the policy file (an extra
     * key there would be a second source of truth for the same byte).
     */
    readonly exitPassthrough?: boolean;
}
/** The lease the provider issues (mirror of the frozen lease vocabulary). */
export interface ProviderLease {
    readonly leaseId: string;
    readonly grantFingerprint: string;
    readonly realmId: string;
    readonly bindingId: string;
    readonly memberScope: string;
    readonly executionKind: 'process';
    readonly status: 'active' | 'cancelling' | 'termination-unconfirmed' | 'terminated';
}
/** The compiled, ONE-SHOT execution plan (prepare output, execute input). */
export interface SpawnPlan {
    readonly planId: string;
    readonly phase: 'prepared';
    readonly request: SpawnRequest;
    readonly policyPath: string;
    readonly outDir: string;
    readonly fdPlan: FdPlan;
}
/** The bounded output of one confined run. */
export interface RunOutput {
    readonly stdout: string;
    readonly stderr: string;
    readonly combined: string;
}
/** Spawn receipt: the process identity AND the lease that scopes it. */
export interface SpawnReceipt {
    readonly lease: ProviderLease;
    readonly processIdentity: string;
}
/** The streaming launcher process as the injected seam exposes it. */
export interface LauncherStreamProcess {
    /** The LAUNCHER's pid; the confined payload's pid arrives on the fd-3 handshake. */
    readonly pid: number;
    readonly stdin: Writable;
    readonly stdout: Readable;
    readonly stderr: Readable;
    /** fd-3 handshake channel: launcher-owned, never crosses the payload boundary. */
    readonly handshake: Readable;
    kill(signal?: string | number): boolean;
    readonly exit: Promise<{
        code: number | null;
        signal: string | null;
    }>;
}
/** Per-call streaming windows (tests script them per leg). */
export interface StreamingOptions {
    /** Bounded wait for the launcher's fd-3 handshake line (default 15000). */
    readonly handshakeTimeoutMs?: number;
    /** SIGTERM → SIGKILL escalation point inside the terminate window (default 1500). */
    readonly graceMs?: number;
    /** Bounded confirmation window; past it the lease settles `termination-unconfirmed` (default 8000). */
    readonly deadlineMs?: number;
}
/** The live handle the streaming arm returns (receipt + pipes + lease + terminate). */
export interface StreamingSpawnHandle {
    readonly lease: ProviderLease;
    readonly processIdentity: string;
    /** The confined payload's OS pid (handshake-reported; the identity inside `processIdentity`). */
    readonly pid: number;
    readonly stdin: Writable;
    readonly stdout: Readable;
    readonly stderr: Readable;
    /**
     * Resolves when the process is OBSERVED to exit — observation never settles the
     * lease. `code` is the LAUNCHER's exit status: with the plan's `exitPassthrough`
     * unset that is the constant 0 of the historical stream arm (a 0 here therefore
     * proves nothing about the payload, which is why rows that leave the flag off
     * prove completion from the stream instead); with the flag set it is the code the
     * payload returned, or the constructed 128+signum convention for a payload killed
     * by a signal — see `SpawnRequest.exitPassthrough`, whose value can coincide with
     * a code a payload chose itself.
     */
    readonly exited: Promise<{
        code: number | null;
        signal: string | null;
    }>;
    /** The handle's termination arm: signal (SIGTERM→SIGKILL escalation), await, settle. */
    terminate(options?: StreamingOptions): Promise<ProviderResult<ProviderLease>>;
    /**
     * R1 (#337 step B, root ruling 20:12Z) — the machine-readable promise that
     * THIS arm supervises the payload through the launcher's waitpid + out-of-band
     * record. It is `true` on every streaming handle, proven by the arm's own
     * shape: the `--out-dir` token is UNCONDITIONAL on the stream argv
     * (`provider.ts:695`), the launcher writes `<out-dir>/exit.json` after
     * `waitpid` and before its own exit (`landlock-prelauncher.py:501-505`
     * precede `:513`/`:528` — single O_TRUNC writer, record before death), and
     * this provider reads it only AFTER the launcher is observed dead. The
     * one-shot arm has no such face at all — it is the legitimate no-record form
     * (its rc travels in the emit frame, launcher :420), and rows must treat an
     * absent `recordCapable` as exactly that, never as a missing record.
     */
    readonly recordCapable: true;
    /**
     * R1 — the trusted completion record, resolving after the launcher's death
     * (see `recordCapable`). A `recorded` form carries the payload's own rc
     * verbatim (signal death arrives as the launcher's negative signum, never
     * flattened); every other form is fail-closed material for the row — the
     * provider NEVER guesses a code, and a row that trusts `recordCapable` must
     * never fall back to a success reading of the streams when the record is
     * absent, corrupt or unattributable. Bookkeeping on the provider's own
     * trusted face: not wire, not a grant, not a tool permission — the same
     * class as the lease ledger.
     */
    readonly payloadExit: Promise<PayloadExitRecord>;
}
/**
 * R1 (#337 step B) — the shapes `payloadExit` resolves to. The union is
 * TOTAL: every launcher/record outcome arrives as one of these forms, and the
 * `recorded` form never invents an rc (`Number.isInteger` or it is not the
 * record law). Rows map forms onto the frozen code table; nothing here adds
 * an error code to any row face.
 */
export type PayloadExitRecord = {
    readonly form: 'recorded';
    readonly rc: number;
    readonly pid: number;
}
/** death observed, record absent — the launcher died outside its own law */
 | {
    readonly form: 'missing';
}
/** present but not attributable AS a record (bytes lie, or cannot be read) */
 | {
    readonly form: 'unparsable';
    readonly reason: 'unreadable' | 'oversize' | 'malformed';
}
/** the record names a different payload than the handshake did — binding violation */
 | {
    readonly form: 'pid-mismatch';
    readonly recordPid: number;
};
/** The injected world (tests inject a counting fake to watch ZERO calls). */
export interface ProviderDeps {
    readonly availability: () => {
        readonly rows: readonly AvailabilityRow[];
    };
    readonly run: (argv: readonly string[], timeoutMs?: number) => RunResult;
    readonly probeFacts: () => {
        readonly abiVersion: number | null;
        readonly legs: Partial<Record<LegName, LegVerdict>>;
    };
    /**
     * Streaming arm (R-1): spawn the launcher in stream mode with the fd-3
     * handshake channel. OPTIONAL — absent, the production arm (node:child_process
     * spawn) runs; injected, the leg watches ZERO/signal facts through the fake.
     */
    readonly spawnStream?: (argv: readonly string[]) => ProviderResult<LauncherStreamProcess>;
    /** Signal the PAYLOAD pid (terminate arm). Absent: `process.kill` (false = already gone). */
    readonly signalProcess?: (pid: number, signal: 'SIGTERM' | 'SIGKILL') => boolean;
    /** OS liveness of a payload pid. Absent: `/proc/<pid>` existence. */
    readonly pidAlive?: (pid: number) => boolean;
}
/**
 * THE ASSEMBLY CONFIG FACE (PR4/5 install round, pb-CONTRACT.md §1): the
 * production entry parameters the assembler OWNS and this lane never
 * hardcodes. Every field is optional — ABSENT keeps the historical lane
 * default (module-relative launcher copy, `A5P4_PYTHON` env, no byte pin,
 * no ABI floor) so the DORMANT face and every existing consumer stay exact.
 *
 * The launcher path matters because the committed install surface is tsc
 * emit, which carries NO `.py` assets: the module-relative default exists
 * for the SOURCE TREE only, and an assembly that installs the lane must
 * name the trusted launcher here (that is what the W4 row had to fake
 * through the deps spy — this face is the honest seam, `provider` never
 * asks the assembler to rewrite argv).
 */
export interface ProviderAssemblyConfig {
    /** Interpreter used for probe legs and confined-exec (default: `A5P4_PYTHON` env, else `python3`). */
    readonly pythonPath?: string;
    /** Absolute path of the trusted launcher script (default: the module-relative source-tree copy). */
    readonly launcherPath?: string;
    /** sha256 (hex, 64) of the launcher BYTES. When set it gates every probe leg and every confined-exec. */
    readonly launcherSha256?: string;
    /** Landlock ABI floor: a measured `GET_VERSION` below this refuses before any process exists. */
    readonly minAbiVersion?: number;
}
/** Provider construction options. */
export interface ProviderOptions {
    readonly realmId: string;
    readonly trustRoot: string | null;
    readonly scratchRoot: string;
    readonly deps?: ProviderDeps;
    readonly hardDimensions?: readonly AssuranceDimension[];
    readonly runnerCommand?: string | null;
    /** The assembler's entry parameters (see `ProviderAssemblyConfig`). */
    readonly assembly?: ProviderAssemblyConfig;
    /** Bound of the settled-lease audit ledger (see the ledger block in the
     *  implementation): terminal leases are audited FIFO up to this many
     *  entries, older ones are forgotten. Default 1024. */
    readonly settledLedgerCap?: number;
}
/** Create one provider instance for one realm. Probes are captured ONCE per instance. */
export declare function createConfinedProcessProvider(opts: ProviderOptions): Readonly<{
    probe: () => Promise<ProviderResult<readonly ProcessCapabilityRow[]>>;
    prepare: (request: SpawnRequest) => Promise<ProviderResult<SpawnPlan>>;
    execute: (plan: SpawnPlan) => Promise<ProviderResult<{
        receipt: SpawnReceipt;
        output: RunOutput;
        lease: ProviderLease;
    }>>;
    spawn: (request: SpawnRequest) => Promise<ProviderResult<{
        receipt: SpawnReceipt;
        output: RunOutput;
        lease: ProviderLease;
    }>>;
    spawnStreaming: (request: SpawnRequest, streaming?: StreamingOptions) => Promise<ProviderResult<StreamingSpawnHandle>>;
    executeStreaming: (plan: SpawnPlan, streaming?: StreamingOptions) => Promise<ProviderResult<StreamingSpawnHandle>>;
    requestCancellation: (lease: ProviderLease) => Promise<ProviderResult<ProviderLease>>;
    settleTermination: (lease: ProviderLease, confirmed?: boolean) => Promise<ProviderResult<ProviderLease>>;
    bookkeeping: () => {
        readonly liveLeases: number;
        readonly streamRuns: number;
        readonly settledLedger: number;
        readonly settledLedgerCap: number;
    };
}>;
//# sourceMappingURL=provider.d.ts.map