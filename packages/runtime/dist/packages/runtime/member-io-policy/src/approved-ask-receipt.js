/**
 * Alpha.5 P1-09 — the ApprovedAskReceipt (R3 of owner ruling 20261124-0151 §2).
 *
 * WHAT IT IS: the ONE object a confined Provider may read to satisfy a compiled
 * `ask` disposition. It is minted by the CENTRE at the exact moment the host
 * Tool Guard consumes the one-shot Grant, bound to the execution that was
 * approved, and available ONLY inside that execution's own tool body.
 *
 * WHAT IT IS NOT: it is not a second approval authority, not a second grant,
 * not a global callId map, and not a reusable token. It mints nothing on its
 * own: the durable Control decision and the one-shot grant consumption are the
 * authority, and the receipt is their non-model-forgeable projection for the
 * Provider plane.
 *
 * LAWS (machine-checked by the R3 arms in `vnext-admission.test.mjs`):
 *  - EXECUTION-SCOPED: `mintApprovedAskReceipt` is registered against the HOST
 *    EXECUTION OBJECT (a module-private WeakMap key), never against a callId
 *    string. A different execution with the same callId finds nothing.
 *  - DELIVERED ONCE, INSIDE THE BODY: the receipt is only readable through the
 *    `AsyncLocalStorage` scope opened by the centre's `tools/execute` listener
 *    for that exact execution and closed when the body returns. A closed
 *    receipt is `RECEIPT_CLOSED` even if its object was captured.
 *  - CANONICAL OPERATION: the receipt names the Provider-resolved path and a
 *    content digest. The Provider re-resolves the real access path and refuses
 *    if the receipt does not cover THAT operation; a symlink retarget between
 *    approval and the effect is therefore a mismatch, not an alias.
 *  - BOUNDS: the receipt carries the lane snapshot it was approved under. The
 *    Provider checks the operation against BOTH the live lane and that
 *    snapshot; `deny` always wins and is checked before any receipt.
 *  - REVOCATION: the receipt carries the invocation binder's `binderEpoch` and
 *    `memberEpoch` at consumption. A later `bumpEpoch()`/`revoke(member)` makes
 *    it dead without a second revocation ledger.
 *  - NOT MODEL-FORGEABLE: the object is branded in a module-private WeakSet,
 *    frozen, and never returned to the model, the tool arguments or the durable
 *    log; a structural copy is refused (`RECEIPT_UNKNOWN`). The only writer of
 *    the scope is the centre's own port.
 *
 * THIS ROUND COVERS THE FIVE NATIVE FS MUTATIONS, one operation kind each:
 * `write`→`writeText`, `edit`→`editText`, `patch_text`→`patchText`,
 * `delete_file`→`deleteFile`, `move_file`→`moveFile` (BOTH paths). The kind is
 * part of the operation identity, so a receipt for one method can never satisfy
 * another. Every other tool/method keeps the R4 fail-closed
 * `IO_ASK_REQUIRES_APPROVAL` refusal (the subprocess face is explicitly NOT
 * covered by this extension; see the ADR).
 *
 * @module @dsh-agent-team/runtime/member-io-policy/approved-ask-receipt
 */
import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { matchLocator } from './path-rules.js';
import { NODE_PATH_IDENTITY_RESOLVER, resolveTargetIdentity, } from './provider-capabilities.js';
/** The one record schema. A reader that does not know it must fail loud. */
export const APPROVED_ASK_RECEIPT_SCHEMA = 'a5sf-approved-ask-receipt/2';
/**
 * Closed refusal vocabulary. NONE of these starts with `ADMISSION_`: a
 * Provider refusal happens AFTER the body started, and the execution-fact
 * classifier must settle it as the real phase (FAILED / body-started), never
 * as a pre-execution `REFUSED / not-started`.
 */
export const APPROVED_ASK_RECEIPT_REFUSAL_CODES = [
    'RECEIPT_NOT_IN_SCOPE',
    'RECEIPT_UNKNOWN',
    'RECEIPT_CLOSED',
    'RECEIPT_REUSED',
    'RECEIPT_MEMBER_MISMATCH',
    'RECEIPT_TOOL_MISMATCH',
    'RECEIPT_POLICY_GENERATION_MISMATCH',
    'RECEIPT_AUTHORITY_UNAVAILABLE',
    'RECEIPT_REVOKED',
    'RECEIPT_OPERATION_MISMATCH',
    'RECEIPT_CONTENT_MISMATCH',
    'RECEIPT_CONTENT_UNAVAILABLE',
    'RECEIPT_PATH_UNRESOLVED',
    'RECEIPT_DENIED',
    'RECEIPT_BOUNDS_VIOLATION',
    'RECEIPT_INPUT_INVALID',
    /** The process face's fixed shell class differs from the one the receipt binds. */
    'RECEIPT_PROCESS_CLASS_MISMATCH',
    /** The command about to be spawned differs from the command the approval named. */
    'RECEIPT_COMMAND_MISMATCH',
];
/** The Provider method each operation kind authorizes, exactly. */
export const APPROVED_ASK_METHOD_OF_KIND = Object.freeze({
    'fs-write': 'writeText',
    'fs-edit': 'editText',
    'fs-patch': 'patchText',
    'fs-delete': 'deleteFile',
    'fs-move': 'moveFile',
});
const RECEIPT_BRAND = new WeakSet();
const RECEIPT_STATE = new WeakMap();
const SCOPE_BRAND = new WeakSet();
/**
 * execution object -> minted receipt. Keyed by the HOST EXECUTION OBJECT, not
 * by `callId`: a second execution carrying the same callId cannot find it, so
 * "look up an allow by callId" is structurally impossible here.
 */
const PENDING_BY_EXECUTION = new WeakMap();
/**
 * A NEW carrier for AUTHORIZATION (not the guard-observability attribution
 * store, whose contract is attribution-only). It is populated only by
 * `runWithApprovedAskExecutionScope`, one `run()` per host execution.
 */
const EXECUTION_SCOPE = new AsyncLocalStorage();
let receiptSequence = 0;
function invalid(detail) {
    return { ok: false, code: 'RECEIPT_INPUT_INVALID', detail };
}
function isNonBlank(value) {
    return typeof value === 'string' && value.trim() !== '';
}
function freezeRuleSet(rules) {
    return Object.freeze({
        mode: rules.mode,
        allow: Object.freeze([...rules.allow]),
        ask: Object.freeze([...rules.ask]),
        deny: Object.freeze([...rules.deny]),
    });
}
function canonicalJson(value) {
    if (Array.isArray(value))
        return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
    if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${canonicalJson(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}
function sha256Hex(value) {
    return createHash('sha256').update(value).digest('hex');
}
/**
 * The operation fingerprint: one deterministic digest of the approved effect.
 *
 * It is recomputed by `mintApprovedAskReceipt` from the operation's own fields, so a caller cannot
 * smuggle a fingerprint that disagrees with the paths/payload it carries. Kept for auditability and
 * for the receipt's own self-consistency check.
 */
export function approvedAskOperationFingerprint(operation) {
    const material = { schema: APPROVED_ASK_RECEIPT_SCHEMA, kind: operation.kind };
    if (operation.kind === 'fs-move') {
        material.toolName = operation.toolName;
        material.source = { canonicalPath: operation.source.canonicalPath };
        material.destination = { canonicalPath: operation.destination.canonicalPath };
    }
    else if (operation.kind === 'process-exec') {
        material.toolName = operation.toolName;
        material.executionBoundary = operation.executionBoundary;
        material.implementationOrigin = operation.implementationOrigin;
        material.processClass = { program: operation.processClass.program, programs: [...operation.processClass.programs] };
        material.commandSha256 = operation.commandSha256;
        material.cwd = operation.cwd;
    }
    else {
        material.toolName = operation.toolName;
        material.canonicalPath = operation.canonicalPath;
        if (operation.kind === 'fs-write')
            material.contentSha256 = operation.contentSha256;
        if (operation.kind === 'fs-edit') {
            material.oldStringSha256 = operation.oldStringSha256;
            material.newStringSha256 = operation.newStringSha256;
            material.replaceAll = operation.replaceAll;
            material.editSha256 = operation.editSha256;
        }
        if (operation.kind === 'fs-patch')
            material.hunksSha256 = operation.hunksSha256;
        if (operation.kind === 'fs-delete')
            material.bytesReadBack = operation.bytesReadBack;
    }
    return `sha256:${sha256Hex(canonicalJson(material))}`;
}
/** Digest of the exact declared command text a process approval names. */
export function approvedAskCommandSha256(command) {
    return `sha256:${sha256Hex(command)}`;
}
/** Digest of the exact literal transformation an `editText` call receives. */
export function approvedAskEditSha256(edit) {
    return `sha256:${sha256Hex(canonicalJson({
        oldString: edit.oldString,
        newString: edit.newString,
        replaceAll: edit.replaceAll,
    }))}`;
}
/** Digest of the exact hunk payload a `patchText` call receives. */
export function approvedAskHunksSha256(hunks) {
    return `sha256:${sha256Hex(canonicalJson(hunks))}`;
}
async function resolveWritePath(locator, resolver) {
    const resolution = await resolveTargetIdentity({
        locator,
        access: 'write',
        resolver: resolver ?? NODE_PATH_IDENTITY_RESOLVER,
    });
    if (!resolution.ok)
        return { ok: false, code: 'IO_ASK_RECEIPT_UNPREPARABLE', detail: `${resolution.code}: ${resolution.detail}` };
    return { ok: true, resolved: resolution.value.resolved };
}
function unpreparable(detail) {
    return { ok: false, code: 'IO_ASK_RECEIPT_UNPREPARABLE', detail };
}
/**
 * Prepare the operation a native `write` approval would cover — the ONE
 * canonicalization the receipt binds. Async because the Provider resolution is
 * async; the caller (the centre) does this BEFORE the wait so the receipt can
 * be minted synchronously at grant consumption.
 */
export async function prepareApprovedWriteOperation(input) {
    if (!isNonBlank(input.locator))
        return unpreparable('the write names no locator');
    if (typeof input.content !== 'string')
        return unpreparable('the write carries no content string');
    const resolution = await resolveWritePath(input.locator, input.resolver);
    if (!resolution.ok)
        return resolution;
    const contentSha256 = `sha256:${sha256Hex(input.content)}`;
    const base = {
        kind: 'fs-write',
        toolName: 'write',
        locator: input.locator,
        canonicalPath: resolution.resolved,
        contentSha256,
    };
    return { ok: true, value: Object.freeze({ ...base, fingerprint: approvedAskOperationFingerprint({ ...base, fingerprint: '' }) }) };
}
/**
 * THE DECLARED NATIVE TOOL SHAPES this round can prepare a receipt for. It is closed: a tool name
 * that is not here prepares nothing, so its `ask` keeps the R4 fail-closed refusal.
 *
 * `write` and `edit` are SHIPPED native tools of the pinned baseline. `patch_text`, `delete_file`
 * and `move_file` are the declared argument shapes for the three rc.5 Provider methods that have no
 * shipped native tool in this product's preset today; a call carrying one of these names exercises
 * the same admission port, binder, Control and Provider, but the native-tool wiring is NOT claimed
 * (see the ADR's "not proven" section — a multi-file `apply_patch` prepares nothing and stays R4).
 */
export const APPROVED_ASK_TOOL_SHAPES = Object.freeze(['write', 'edit', 'patch_text', 'delete_file', 'move_file']);
/**
 * Prepare the operation an approval for `toolName` would cover, from the tool's OWN arguments.
 *
 * A recognised tool that cannot be canonicalised is `IO_ASK_RECEIPT_UNPREPARABLE` (the centre
 * refuses the call); an unrecognised tool is `IO_ASK_RECEIPT_TOOL_UNSUPPORTED` (the centre mints no
 * receipt, so the Provider keeps R4). No shape is guessed from a substring: the dispatch is exact.
 */
export async function prepareApprovedFsOperation(input) {
    const args = input.arguments ?? {};
    if (!APPROVED_ASK_TOOL_SHAPES.includes(input.toolName)) {
        return { ok: false, code: 'IO_ASK_RECEIPT_TOOL_UNSUPPORTED', detail: `this round can prepare a receipt for ${APPROVED_ASK_TOOL_SHAPES.join(' / ')}, not '${input.toolName}'` };
    }
    if (input.toolName === 'write') {
        const locator = args['file_path'];
        const content = args['content'];
        if (typeof locator !== 'string' || typeof content !== 'string')
            return unpreparable('the write call carries no file_path/content pair');
        return prepareApprovedWriteOperation({ locator, content, ...(input.resolver === undefined ? {} : { resolver: input.resolver }) });
    }
    if (input.toolName === 'edit') {
        const locator = args['file_path'];
        const oldString = args['old_string'];
        const newString = args['new_string'];
        const replaceAll = args['replace_all'];
        if (typeof locator !== 'string' || !isNonBlank(locator))
            return unpreparable('the edit call names no file_path');
        if (typeof oldString !== 'string' || oldString.length === 0)
            return unpreparable('the edit call carries no non-empty old_string');
        if (typeof newString !== 'string')
            return unpreparable('the edit call carries no new_string');
        if (oldString === newString)
            return unpreparable('old_string and new_string are equal: the native edit refuses a guaranteed no-op');
        if (replaceAll !== undefined && typeof replaceAll !== 'boolean')
            return unpreparable('replace_all must be a boolean when present');
        const resolution = await resolveWritePath(locator, input.resolver);
        if (!resolution.ok)
            return resolution;
        const edit = { oldString, newString, replaceAll: replaceAll === true };
        const base = {
            kind: 'fs-edit',
            toolName: 'edit',
            locator,
            canonicalPath: resolution.resolved,
            oldStringSha256: `sha256:${sha256Hex(oldString)}`,
            newStringSha256: `sha256:${sha256Hex(newString)}`,
            replaceAll: edit.replaceAll,
            editSha256: approvedAskEditSha256(edit),
        };
        return { ok: true, value: Object.freeze({ ...base, fingerprint: approvedAskOperationFingerprint({ ...base, fingerprint: '' }) }) };
    }
    if (input.toolName === 'patch_text') {
        const locator = args['file_path'];
        const hunks = args['hunks'];
        if (typeof locator !== 'string' || !isNonBlank(locator))
            return unpreparable('the patch call names no file_path');
        if (!Array.isArray(hunks))
            return unpreparable('the patch call carries no hunk array');
        const resolution = await resolveWritePath(locator, input.resolver);
        if (!resolution.ok)
            return resolution;
        const base = {
            kind: 'fs-patch',
            toolName: 'patch_text',
            locator,
            canonicalPath: resolution.resolved,
            hunksSha256: approvedAskHunksSha256(hunks),
        };
        return { ok: true, value: Object.freeze({ ...base, fingerprint: approvedAskOperationFingerprint({ ...base, fingerprint: '' }) }) };
    }
    if (input.toolName === 'delete_file') {
        const locator = args['file_path'];
        if (typeof locator !== 'string' || !isNonBlank(locator))
            return unpreparable('the delete call names no file_path');
        const resolution = await resolveWritePath(locator, input.resolver);
        if (!resolution.ok)
            return resolution;
        const base = {
            kind: 'fs-delete',
            toolName: 'delete_file',
            locator,
            canonicalPath: resolution.resolved,
            bytesReadBack: false,
        };
        return { ok: true, value: Object.freeze({ ...base, fingerprint: approvedAskOperationFingerprint({ ...base, fingerprint: '' }) }) };
    }
    // move_file — BOTH paths are prepared and bound; one missing path is un preparable.
    const sourceLocator = args['file_path'];
    const destinationLocator = args['destination_path'];
    if (typeof sourceLocator !== 'string' || !isNonBlank(sourceLocator))
        return unpreparable('the move call names no source file_path');
    if (typeof destinationLocator !== 'string' || !isNonBlank(destinationLocator))
        return unpreparable('the move call names no destination_path');
    const source = await resolveWritePath(sourceLocator, input.resolver);
    if (!source.ok)
        return source;
    const destination = await resolveWritePath(destinationLocator, input.resolver);
    if (!destination.ok)
        return destination;
    const base = {
        kind: 'fs-move',
        toolName: 'move_file',
        source: { locator: sourceLocator, canonicalPath: source.resolved },
        destination: { locator: destinationLocator, canonicalPath: destination.resolved },
    };
    return { ok: true, value: Object.freeze({ ...base, fingerprint: approvedAskOperationFingerprint({ ...base, fingerprint: '' }) }) };
}
/**
 * ROUND 99 — the process face's DECLARED TOOL SHAPES. Closed, like the FS table: a name that is
 * not here prepares nothing, so its `ask` keeps the R4 fail-closed refusal. `bash` is the only
 * shipped process tool whose execution authorization this product compiles.
 */
export const APPROVED_ASK_PROCESS_TOOL_SHAPES = Object.freeze(['bash']);
/**
 * Prepare the process operation an approval for `toolName` would cover.
 *
 * The OPERATION binds what the centre can know for THIS execution: the tool, the compiled
 * `executionBoundary`/`implementationOrigin`, the composition's fixed shell class, the declared
 * command text's digest and the authored working directory. It does NOT bind (and must not claim)
 * the OS profile: that is compiled by the spawn point from the Member's three lanes, unchanged.
 *
 * A process ask whose execution facts are missing, or whose composition fixes no shell class, is
 * `IO_ASK_RECEIPT_UNPREPARABLE` — refused, never executed under an approval no receipt can name.
 */
export function prepareApprovedProcessOperation(input) {
    if (!APPROVED_ASK_PROCESS_TOOL_SHAPES.includes(input.toolName)) {
        return { ok: false, code: 'IO_ASK_RECEIPT_TOOL_UNSUPPORTED', detail: `this round can prepare a process receipt for ${APPROVED_ASK_PROCESS_TOOL_SHAPES.join(' / ')}, not '${input.toolName}'` };
    }
    const execution = input.execution;
    if (execution === undefined || !isNonBlank(execution.executionBoundary) || !isNonBlank(execution.implementationOrigin)) {
        return unpreparable('the compiled per-tool answer carries no execution authorization (implementationOrigin/executionBoundary); a process ask is bound to the declaration it was admitted on');
    }
    const processClass = input.processClass;
    if (processClass === undefined || !Array.isArray(processClass.programs) || processClass.programs.length === 0 ||
        processClass.programs.some((program) => !isNonBlank(program))) {
        return unpreparable('the composition fixes no shell class for this process face; a process receipt must bind the class it may run');
    }
    const args = input.arguments ?? {};
    const command = args['command'];
    if (typeof command !== 'string')
        return unpreparable('the process call carries no command string');
    const cwd = typeof args['workdir'] === 'string' ? args['workdir'] : '';
    const base = {
        kind: 'process-exec',
        toolName: 'bash',
        executionBoundary: execution.executionBoundary,
        implementationOrigin: execution.implementationOrigin,
        processClass: Object.freeze({
            program: typeof processClass.program === 'string' ? processClass.program : '',
            programs: Object.freeze([...processClass.programs].sort()),
        }),
        // A command that DID arrive is bound exactly; the PTY spawn point cannot compare it (the
        // process precedes any command text) and the ADR says so.
        commandSha256: command === '' ? null : approvedAskCommandSha256(command),
        cwd,
    };
    return { ok: true, value: Object.freeze({ ...base, fingerprint: approvedAskOperationFingerprint({ ...base, fingerprint: '' }) }) };
}
function validateOperation(operation) {
    if (operation === undefined || operation === null)
        return 'a receipt binds the operation it authorizes';
    const isPath = (value) => {
        const path = value;
        return path !== undefined && path !== null && isNonBlank(path.locator) && isNonBlank(path.canonicalPath);
    };
    switch (operation.kind) {
        case 'fs-write':
            if (!isPath(operation))
                return 'a write operation must carry its authored locator and canonical path';
            return isNonBlank(operation.contentSha256) ? undefined : 'the approved write must carry its content digest';
        case 'fs-edit':
            if (!isPath(operation))
                return 'an edit operation must carry its authored locator and canonical path';
            if (!isNonBlank(operation.oldStringSha256) || !isNonBlank(operation.newStringSha256) || !isNonBlank(operation.editSha256)) {
                return 'the approved edit must carry the digests of the exact transformation it authorizes';
            }
            return typeof operation.replaceAll === 'boolean' ? undefined : 'the approved edit must carry replaceAll as a boolean';
        case 'fs-patch':
            if (!isPath(operation))
                return 'a patch operation must carry its authored locator and canonical path';
            return isNonBlank(operation.hunksSha256) ? undefined : 'the approved patch must carry its hunk-payload digest';
        case 'fs-delete':
            if (!isPath(operation))
                return 'a delete operation must carry its authored locator and canonical path';
            return operation.bytesReadBack === false ? undefined : 'a delete operation reads no bytes back; that fact is part of its scope';
        case 'fs-move':
            if (!isPath(operation.source) || !isPath(operation.destination))
                return 'a move operation must carry BOTH the source and destination paths';
            return undefined;
        case 'process-exec':
            if (!isNonBlank(operation.executionBoundary))
                return 'a process operation must carry the declared executionBoundary it was approved under';
            if (!isNonBlank(operation.implementationOrigin))
                return 'a process operation must carry the declared implementationOrigin';
            if (operation.processClass === undefined || operation.processClass === null)
                return 'a process operation must carry the composition\'s fixed shell class';
            if (!Array.isArray(operation.processClass.programs) || operation.processClass.programs.length === 0 ||
                operation.processClass.programs.some((program) => !isNonBlank(program))) {
                return 'a process operation must carry the admitted shell-class programs it may run (a class that admits nothing is not a class)';
            }
            if (operation.commandSha256 !== null && !isNonBlank(operation.commandSha256)) {
                return 'a process operation must carry the approved command digest, or the literal null when the call carried none';
            }
            if (typeof operation.cwd !== 'string')
                return 'a process operation must carry the authored working directory (an empty string when none was given)';
            return undefined;
        default:
            return `unknown approved operation kind '${String(operation.kind)}'`;
    }
}
/**
 * Mint the receipt. Called by the centre AFTER `binder.consume` returned ok —
 * there is no code path that mints a receipt for an unconsumed grant.
 */
export function mintApprovedAskReceipt(input) {
    if (!isNonBlank(input.executionId))
        return invalid('a receipt needs the execution identity it belongs to');
    if (!isNonBlank(input.callId))
        return invalid('a receipt needs the call identity it belongs to');
    const member = input.member;
    if (member === undefined || member === null ||
        !isNonBlank(member.teamId) || !isNonBlank(member.memberInstanceId) || !isNonBlank(member.templateId) ||
        !Number.isSafeInteger(member.instanceGeneration) || member.instanceGeneration < 0) {
        return invalid('a receipt binds a complete trusted Member identity (teamId / memberInstanceId / templateId / instanceGeneration)');
    }
    if (!isNonBlank(input.toolName))
        return invalid('a receipt needs the tool it authorizes');
    const operationProblem = validateOperation(input.operation);
    if (operationProblem !== undefined)
        return invalid(operationProblem);
    // The fingerprint is RECOMPUTED here so a prepared operation cannot carry a digest that
    // disagrees with the paths/payload it names.
    if (input.operation.fingerprint !== approvedAskOperationFingerprint(input.operation)) {
        return invalid('the approved operation fingerprint does not match its own fields');
    }
    if (input.operation.toolName !== input.toolName) {
        return invalid(`the approved operation is for tool '${input.operation.toolName}', not '${input.toolName}'`);
    }
    if (!isNonBlank(input.policyGeneration))
        return invalid('a receipt is bound to the policy generation the reviewer approved');
    if (input.approval === undefined || input.approval === null || !isNonBlank(input.approval.requestId)) {
        return invalid('a receipt names the durable approval request that authorized it');
    }
    if (input.grant === undefined || input.grant === null || input.grant.consumed !== true) {
        return invalid('a receipt is minted only after the one-shot grant was consumed');
    }
    if (!Number.isSafeInteger(input.grant.memberEpoch) || !Number.isSafeInteger(input.grant.binderEpoch)) {
        return invalid('the grant consumption must carry the binder/member epochs it was spent under');
    }
    const receiptId = `a5sf-receipt:${++receiptSequence}`;
    const receipt = Object.freeze({
        schema: APPROVED_ASK_RECEIPT_SCHEMA,
        receiptId,
        executionId: input.executionId,
        callId: input.callId,
        member: Object.freeze({
            teamId: member.teamId,
            memberInstanceId: member.memberInstanceId,
            templateId: member.templateId,
            instanceGeneration: member.instanceGeneration,
        }),
        toolName: input.toolName,
        toolBindingIdentity: input.toolBindingIdentity,
        operation: Object.freeze({ ...input.operation }),
        policyGeneration: input.policyGeneration,
        approval: Object.freeze({
            requestId: input.approval.requestId,
            decisionId: input.approval.decisionId,
            caseId: input.approval.caseId,
            legOrdinal: input.approval.legOrdinal,
        }),
        grant: Object.freeze({
            consumed: true,
            memberEpoch: input.grant.memberEpoch,
            binderEpoch: input.grant.binderEpoch,
        }),
        bounds: Object.freeze({
            read: freezeRuleSet(input.bounds.read),
            write: freezeRuleSet(input.bounds.write),
        }),
    });
    RECEIPT_BRAND.add(receipt);
    RECEIPT_STATE.set(receipt, { available: false, closed: false, used: false });
    return { ok: true, value: receipt };
}
/**
 * Register a minted receipt against the HOST EXECUTION OBJECT that spent the
 * grant. The `tools/execute` listener takes it back by object identity.
 */
export function registerPendingApprovedAskReceipt(execution, receipt) {
    if (typeof execution !== 'object' || execution === null)
        throw new TypeError('approved-ask-receipt: the pending receipt is keyed by the host execution object');
    if (!RECEIPT_BRAND.has(receipt))
        throw new TypeError('approved-ask-receipt: only a minted receipt can be registered');
    PENDING_BY_EXECUTION.set(execution, receipt);
}
/** Take (and forget) the receipt registered for exactly this execution object. */
export function takePendingApprovedAskReceipt(execution) {
    if (typeof execution !== 'object' || execution === null)
        return undefined;
    const receipt = PENDING_BY_EXECUTION.get(execution);
    if (receipt !== undefined)
        PENDING_BY_EXECUTION.delete(execution);
    return receipt;
}
/** The receipt is no longer available to any execution, ever. Idempotent. */
export function closeApprovedAskReceipt(receipt) {
    const state = RECEIPT_STATE.get(receipt);
    if (state === undefined)
        return;
    state.available = false;
    state.closed = true;
}
/**
 * Run ONE tool body inside the receipt's authorization scope. The scope is
 * opened only here, only for the receipt's own execution object, and closed in
 * `finally` — so completion, Stop or a throw all end availability.
 */
export async function runWithApprovedAskExecutionScope(receipt, run) {
    const state = RECEIPT_STATE.get(receipt);
    if (state === undefined || state.closed)
        throw new TypeError('approved-ask-receipt: a closed or unknown receipt cannot open an execution scope');
    const scope = Object.freeze({
        schema: APPROVED_ASK_RECEIPT_SCHEMA,
        executionId: receipt.executionId,
        callId: receipt.callId,
        memberIdentity: receipt.member.memberInstanceId,
        toolName: receipt.toolName,
        receipt,
    });
    SCOPE_BRAND.add(scope);
    state.available = true;
    try {
        return await EXECUTION_SCOPE.run(scope, run);
    }
    finally {
        state.available = false;
        state.closed = true;
    }
}
/** The receipt scope of the body this async context is inside, if any. */
export function currentApprovedAskExecutionScope() {
    return EXECUTION_SCOPE.getStore();
}
function refuse(code, detail) {
    return { ok: false, code, detail };
}
/**
 * The Provider-side check. It NEVER decides `allow` beyond what the receipt
 * covers: `deny` is checked first by the caller, the receipt must still be
 * live, the current lane must still ask for the target, the canonical path and
 * the content digest must match, and the operation must lie inside the lane
 * snapshot approved. A receipt that fails any clause is a refusal.
 */
export async function authorizeAskWithReceipt(input) {
    const scope = EXECUTION_SCOPE.getStore();
    if (scope === undefined)
        return refuse('RECEIPT_NOT_IN_SCOPE', 'no approved-ask execution scope is active for this Provider call; an ask is refused rather than approved by ambient state');
    if (!SCOPE_BRAND.has(scope) || !RECEIPT_BRAND.has(scope.receipt)) {
        return refuse('RECEIPT_UNKNOWN', 'the execution scope or its receipt was not minted by this module');
    }
    const receipt = scope.receipt;
    const state = RECEIPT_STATE.get(receipt);
    if (state === undefined || !state.available || state.closed) {
        return refuse('RECEIPT_CLOSED', `receipt ${receipt.receiptId} is no longer available: it was closed with its execution and never reopens`);
    }
    if (state.used) {
        return refuse('RECEIPT_REUSED', `receipt ${receipt.receiptId} already authorized one Provider effect; the consumed grant authorizes exactly one`);
    }
    if (scope.executionId !== receipt.executionId || scope.callId !== receipt.callId) {
        return refuse('RECEIPT_UNKNOWN', 'the active scope does not name the execution/receipt pair it carries');
    }
    if (scope.memberIdentity !== receipt.member.memberInstanceId) {
        return refuse('RECEIPT_UNKNOWN', 'the active scope names a different Member than its receipt');
    }
    if (receipt.member.memberInstanceId !== input.memberIdentity) {
        return refuse('RECEIPT_MEMBER_MISMATCH', `receipt ${receipt.receiptId} was minted for '${receipt.member.memberInstanceId}', not '${input.memberIdentity}'`);
    }
    // EXACT METHOD ↔ OPERATION KIND. A receipt minted for one operation can never authorize another:
    // a `writeText` receipt cannot satisfy `editText`, and a delete receipt cannot satisfy a write.
    const operation = receipt.operation;
    // The FS verifier owns the FS kinds only; a process receipt is refused here (its own verifier is
    // `authorizeProcessAskWithReceipt`) so the two faces can never satisfy each other.
    const expectedMethod = operation.kind === 'process-exec' ? undefined : APPROVED_ASK_METHOD_OF_KIND[operation.kind];
    if (expectedMethod === undefined || input.method !== expectedMethod) {
        return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers '${String(expectedMethod)}' (${operation.kind}), not method '${input.method}'`);
    }
    // Explicit narrowing: the FS verifier never reads a process operation's fields (the process
    // verifier is the only reader of `process-exec`).
    if (operation.kind === 'process-exec') {
        return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers a process execution, not an FS Provider method`);
    }
    if (input.toolBindingIdentity !== undefined && input.toolBindingIdentity !== '' &&
        receipt.toolBindingIdentity !== '' && input.toolBindingIdentity !== receipt.toolBindingIdentity) {
        return refuse('RECEIPT_TOOL_MISMATCH', `receipt ${receipt.receiptId} was minted for binding '${receipt.toolBindingIdentity}', not '${input.toolBindingIdentity}'`);
    }
    if (receipt.policyGeneration !== input.policyRevision) {
        return refuse('RECEIPT_POLICY_GENERATION_MISMATCH', `receipt ${receipt.receiptId} was approved under policy generation '${receipt.policyGeneration}', but the Provider is enforcing '${input.policyRevision}'`);
    }
    const binder = input.authority?.binder;
    if (binder === undefined) {
        return refuse('RECEIPT_AUTHORITY_UNAVAILABLE', 'the Provider was not given the invocation binder, so receipt liveness (cold start / member revocation) cannot be proven');
    }
    if (binder.currentEpoch() !== receipt.grant.binderEpoch) {
        return refuse('RECEIPT_REVOKED', `receipt ${receipt.receiptId} was spent under binder epoch ${String(receipt.grant.binderEpoch)}, but the binder is at ${String(binder.currentEpoch())} (cold start)`);
    }
    if (binder.currentMemberEpoch(receipt.member.memberInstanceId) !== receipt.grant.memberEpoch) {
        return refuse('RECEIPT_REVOKED', `receipt ${receipt.receiptId} was spent under member epoch ${String(receipt.grant.memberEpoch)}, but '${receipt.member.memberInstanceId}' is at ${String(binder.currentMemberEpoch(receipt.member.memberInstanceId))} (revoked)`);
    }
    // PAYLOAD BINDING, per kind. Each kind checks the ONLY evidence its effect has; a method whose
    // evidence is missing is refused rather than checked against nothing.
    if (operation.kind === 'fs-write') {
        if (typeof input.content !== 'string') {
            return refuse('RECEIPT_CONTENT_UNAVAILABLE', 'the Provider call carries no content string, so the approved bytes cannot be checked');
        }
        const contentSha256 = `sha256:${sha256Hex(input.content)}`;
        if (contentSha256 !== operation.contentSha256) {
            return refuse('RECEIPT_CONTENT_MISMATCH', `receipt ${receipt.receiptId} approved different bytes (${operation.contentSha256}) than the Provider is about to write (${contentSha256})`);
        }
    }
    else if (operation.kind === 'fs-edit') {
        const edit = input.edit;
        if (edit === undefined || typeof edit.oldString !== 'string' || typeof edit.newString !== 'string' || typeof edit.replaceAll !== 'boolean') {
            return refuse('RECEIPT_CONTENT_UNAVAILABLE', 'the Provider call carries no complete edit triple, so the approved transformation cannot be checked');
        }
        const editSha256 = approvedAskEditSha256({ oldString: edit.oldString, newString: edit.newString, replaceAll: edit.replaceAll });
        if (editSha256 !== operation.editSha256) {
            return refuse('RECEIPT_CONTENT_MISMATCH', `receipt ${receipt.receiptId} approved a different edit (${operation.editSha256}) than the Provider is about to apply (${editSha256})`);
        }
    }
    else if (operation.kind === 'fs-patch') {
        if (input.hunks === undefined) {
            return refuse('RECEIPT_CONTENT_UNAVAILABLE', 'the Provider call carries no hunk payload, so the approved patch cannot be checked');
        }
        const hunksSha256 = approvedAskHunksSha256(input.hunks);
        if (hunksSha256 !== operation.hunksSha256) {
            return refuse('RECEIPT_CONTENT_MISMATCH', `receipt ${receipt.receiptId} approved a different patch (${operation.hunksSha256}) than the Provider is about to apply (${hunksSha256})`);
        }
    }
    // `fs-delete` has NO payload clause by design: nothing is read back, and the scope is the path.
    /** The path pairs this receipt must cover, exactly. */
    const paths = operation.kind === 'fs-move'
        ? [
            { authored: input.locator, canonical: operation.source.canonicalPath, role: 'source' },
            ...(typeof input.destinationPath === 'string' && isNonBlank(input.destinationPath)
                ? [{ authored: input.destinationPath, canonical: operation.destination.canonicalPath, role: 'destination' }]
                : []),
        ]
        : [{ authored: input.locator, canonical: operation.canonicalPath, role: 'target' }];
    if (operation.kind === 'fs-move' && paths.length !== 2) {
        return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers a move, but the Provider call names no destination path`);
    }
    const resolvedPaths = [];
    for (const entry of paths) {
        // DENY WINS, on the authored name and on the canonical resolution.
        if (matchLocator(input.lane, entry.authored) === 'deny') {
            return refuse('RECEIPT_DENIED', `'${entry.authored}' (${entry.role}) is explicitly denied by the live lane; deny wins over any receipt`);
        }
        const resolution = await resolveTargetIdentity({
            locator: entry.authored,
            access: input.access,
            resolver: input.resolver ?? NODE_PATH_IDENTITY_RESOLVER,
        });
        if (!resolution.ok) {
            return refuse('RECEIPT_PATH_UNRESOLVED', `${resolution.code}: ${resolution.detail}`);
        }
        const resolved = resolution.value.resolved;
        if (matchLocator(input.lane, resolved) === 'deny') {
            return refuse('RECEIPT_DENIED', `'${entry.authored}' (${entry.role}) resolves to '${resolved}', which the live lane explicitly denies`);
        }
        // THE ORIGINAL HARD BOUNDS. The approval cannot be replayed onto a locator
        // the lane snapshot did not cover, even if the live lane happens to.
        if (matchLocator(receipt.bounds.write, entry.authored) === 'deny' || matchLocator(receipt.bounds.write, resolved) === 'deny') {
            return refuse('RECEIPT_BOUNDS_VIOLATION', `'${resolved}' (${entry.role}) is outside the lane snapshot the approval was granted under`);
        }
        if (entry.canonical !== resolved) {
            return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers ${entry.role} '${entry.canonical}', but this call resolves '${entry.authored}' to '${resolved}'`);
        }
        resolvedPaths.push(resolved);
    }
    const resolved = resolvedPaths[0];
    if (resolved === undefined) {
        return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} names no path for method '${input.method}'`);
    }
    state.used = true;
    return operation.kind === 'fs-move'
        ? { ok: true, resolved, resolvedDestination: resolvedPaths[1], receipt }
        : { ok: true, resolved, receipt };
}
/**
 * The process-face verifier. It is called at the GOVERNED SPAWN POINT, before any process exists,
 * and only when the compiled process disposition is `ask` (the caller checks `deny` first and never
 * calls this for `allow`). It can authorize a spawn that THIS execution's consumed grant paid for;
 * it can never add a writable, executable or kernel capability, because it returns no policy and
 * the caller's OS profile was compiled from the Member's three lanes before this ran.
 */
export function authorizeProcessAskWithReceipt(input) {
    const scope = EXECUTION_SCOPE.getStore();
    if (scope === undefined) {
        return refuse('RECEIPT_NOT_IN_SCOPE', 'no approved-ask execution scope is active for this spawn; a process ask is refused rather than approved by ambient state');
    }
    if (!SCOPE_BRAND.has(scope) || !RECEIPT_BRAND.has(scope.receipt)) {
        return refuse('RECEIPT_UNKNOWN', 'the execution scope or its receipt was not minted by this module');
    }
    const receipt = scope.receipt;
    const state = RECEIPT_STATE.get(receipt);
    if (state === undefined || !state.available || state.closed) {
        return refuse('RECEIPT_CLOSED', `receipt ${receipt.receiptId} is no longer available: it was closed with its execution and never reopens`);
    }
    if (state.used) {
        return refuse('RECEIPT_REUSED', `receipt ${receipt.receiptId} already authorized one effect; the consumed grant authorizes exactly one`);
    }
    if (scope.executionId !== receipt.executionId || scope.callId !== receipt.callId) {
        return refuse('RECEIPT_UNKNOWN', 'the active scope does not name the execution/receipt pair it carries');
    }
    if (scope.memberIdentity !== receipt.member.memberInstanceId || receipt.member.memberInstanceId !== input.memberIdentity) {
        return refuse('RECEIPT_MEMBER_MISMATCH', `receipt ${receipt.receiptId} was minted for '${receipt.member.memberInstanceId}', not '${input.memberIdentity}'`);
    }
    const operation = receipt.operation;
    if (operation.kind !== 'process-exec') {
        return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} covers '${operation.kind}', not a process execution`);
    }
    if (operation.toolName !== input.toolName) {
        return refuse('RECEIPT_TOOL_MISMATCH', `receipt ${receipt.receiptId} covers tool '${operation.toolName}', not '${input.toolName}'`);
    }
    if (input.toolBindingIdentity !== undefined && input.toolBindingIdentity !== '' &&
        receipt.toolBindingIdentity !== '' && input.toolBindingIdentity !== receipt.toolBindingIdentity) {
        return refuse('RECEIPT_TOOL_MISMATCH', `receipt ${receipt.receiptId} was minted for binding '${receipt.toolBindingIdentity}', not '${input.toolBindingIdentity}'`);
    }
    if (receipt.policyGeneration !== input.policyRevision) {
        return refuse('RECEIPT_POLICY_GENERATION_MISMATCH', `receipt ${receipt.receiptId} was approved under policy generation '${receipt.policyGeneration}', but the spawn point is enforcing '${input.policyRevision}'`);
    }
    const binder = input.authority?.binder;
    if (binder === undefined) {
        return refuse('RECEIPT_AUTHORITY_UNAVAILABLE', 'the process face was not given the invocation binder, so receipt liveness (cold start / member revocation) cannot be proven');
    }
    if (binder.currentEpoch() !== receipt.grant.binderEpoch) {
        return refuse('RECEIPT_REVOKED', `receipt ${receipt.receiptId} was spent under binder epoch ${String(receipt.grant.binderEpoch)}, but the binder is at ${String(binder.currentEpoch())} (cold start)`);
    }
    if (binder.currentMemberEpoch(receipt.member.memberInstanceId) !== receipt.grant.memberEpoch) {
        return refuse('RECEIPT_REVOKED', `receipt ${receipt.receiptId} was spent under member epoch ${String(receipt.grant.memberEpoch)}, but '${receipt.member.memberInstanceId}' is at ${String(binder.currentMemberEpoch(receipt.member.memberInstanceId))} (revoked)`);
    }
    // THE DECLARED PROCESS OPERATION, exactly. A receipt minted for a different boundary or a
    // different shell class is a different process and can never satisfy this spawn.
    if (operation.executionBoundary !== input.executionBoundary) {
        return refuse('RECEIPT_OPERATION_MISMATCH', `receipt ${receipt.receiptId} was approved for executionBoundary '${operation.executionBoundary}', but this spawn is '${input.executionBoundary}'`);
    }
    const wantPrograms = [...input.processClass.programs].sort();
    const havePrograms = [...operation.processClass.programs].sort();
    if (wantPrograms.length !== havePrograms.length || wantPrograms.some((program, at) => program !== havePrograms[at])) {
        return refuse('RECEIPT_PROCESS_CLASS_MISMATCH', `receipt ${receipt.receiptId} was approved for shell class [${havePrograms.join(', ')}], but this face admits [${wantPrograms.join(', ')}]`);
    }
    if (isNonBlank(operation.processClass.program) && isNonBlank(input.processClass.program) &&
        operation.processClass.program !== input.processClass.program) {
        return refuse('RECEIPT_PROCESS_CLASS_MISMATCH', `receipt ${receipt.receiptId} was approved for shell program '${operation.processClass.program}', but this face runs '${input.processClass.program}'`);
    }
    // THE COMMAND, when the spawn point can see it. A receipt that named command A cannot spawn
    // command B; when the spawn point cannot see the command at all (the persistent PTY), it says so
    // by omitting `command` and this clause is not fabricatable from the receipt's own field.
    if (input.command !== undefined) {
        if (operation.commandSha256 === null) {
            return refuse('RECEIPT_CONTENT_UNAVAILABLE', `receipt ${receipt.receiptId} bound no command text, so the command about to spawn cannot be checked against it`);
        }
        const wanted = approvedAskCommandSha256(input.command);
        if (wanted !== operation.commandSha256) {
            return refuse('RECEIPT_COMMAND_MISMATCH', `receipt ${receipt.receiptId} approved a different command (${operation.commandSha256}) than the one about to spawn (${wanted})`);
        }
    }
    state.used = true;
    return { ok: true, receipt };
}
//# sourceMappingURL=approved-ask-receipt.js.map