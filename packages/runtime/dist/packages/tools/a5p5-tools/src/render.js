/**
 * `a5p5-tools` Phase 1 — the Team-drawn presentation of Search/Shell results
 * (design pipeline final stage "render/presentationMeta"; S0 D-3: the R3
 * renderer draws `presentationMeta` itself — a UI-card degradation is an
 * accepted, REGISTERED difference, not a silently missing fact).
 *
 * THE PRESENTATION LAW (threat model: result bytes are UNTRUSTED — a hostile
 * repository or command crafts them to forge structure):
 *
 *  1. CONTROL BYTES NEVER SURVIVE RAW. Every C0 control (except `\n` inside
 *     block text), DEL and every C1 control is rewritten to a visible
 *     `<0xHH>` escape — ANSI clears, BEL, NUL and CR overwrites become
 *     inert, readable text. In INLINE positions (paths, one-line matches)
 *     even `\n` is escaped: a filename must not split a presentation line.
 *  2. STRUCTURE IS THE RENDERER'S ALONE. Every untrusted line is indented
 *     `> `; header lines (`search · …`, `bash · …`, `stderr:`) and the
 *     `a5p5-meta ` footer are the only unindented lines, so a forged footer
 *     or fake exit header survives only as an inert quote — anchored at the
 *     line start it can never match.
 *  3. THE META TWIN STATES THE TRUE FACTS. `presentationMeta` is built from
 *     the OUTCOME object, never from anything a stream said; a renderer-side
 *     bound forces `truncated: true` (Spill attribution arrives in a later
 *     PR5 slice — until then truncation is honestly terminal).
 *  4. OUTCOME FACTS ARE NOT SUGGESTED. An unobserved exit prints
 *     `exit=not-observed`; `timed-out` and `cancelled` keep their own shapes
 *     (C-GW/C-PROC: a job that has not finished is never rendered as stopped,
 *     a cancel never as a clean exit).
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/render
 */
import { deepFreezeContracts } from '../../../domain/tool-governance/src/parse-util.js';
import { GREP_OUTPUT_MODES } from './types.js';
/**
 * A closed-set value on the presented outcome is OUTSIDE the vocabulary the
 * renderer's header law is written over. The header line interpolates
 * `outputMode` UNESCAPED (renderer-owned structure, law 2), so a value that
 * erased its way past the type (JSON round-trip, hostile backend) — including
 * one carrying a newline — would mint structure. The closed law: REFUSE at
 * the entry; the pipeline maps this class to a typed
 * `denied / outcome-outside-closed-set` failure and presents NOTHING.
 * (Lane D review ③ / B3, closed at the wiring gate.)
 */
export class RenderClosedValueViolation extends Error {
    field;
    value;
    constructor(field, value) {
        super(`render refused: ${field} is outside its closed set (${JSON.stringify(value)})`);
        this.name = 'RenderClosedValueViolation';
        this.field = field;
        this.value = value;
    }
}
/** The footer marker — structural, renderer-owned (see law 2). */
export const META_PREFIX = 'a5p5-meta ';
/** The body indent — every untrusted line wears exactly one (see law 2). */
export const BODY_PREFIX = '> ';
/** Default per-stream bound for the presentation (chars; Spill is a later slice). */
export const DEFAULT_MAX_STREAM_CHARS = 65_536;
function escapeCodePoint(codePoint) {
    const hex = codePoint.toString(16).toUpperCase();
    return `<0x${hex.length > 2 ? hex.padStart(4, '0') : hex.padStart(2, '0')}>`;
}
/** Law 1: rewrite control bytes to visible escapes; blocks keep `\n`, inlines keep nothing. */
function escapeControls(text, keepNewline) {
    let out = '';
    for (const char of text) {
        const codePoint = char.codePointAt(0);
        if (codePoint === 0x0a && keepNewline) {
            out += char;
            continue;
        }
        if (codePoint < 0x20 || codePoint === 0x7f || (codePoint >= 0x80 && codePoint <= 0x9f)) {
            out += escapeCodePoint(codePoint);
            continue;
        }
        out += char;
    }
    return out;
}
const inline = (text) => escapeControls(text, false);
const block = (text) => escapeControls(text, true);
/** Law 2: indent every line of a (block-escaped) untrusted block. */
function indented(text) {
    return block(text)
        .split('\n')
        .map((line) => BODY_PREFIX + line);
}
function footer(meta) {
    // Key order is the interface order — the footer is a stable, greppable twin
    // of the structured meta, never a re-parsed source of truth.
    return META_PREFIX + JSON.stringify(meta);
}
/** Render one search outcome into the bounded, structure-safe presentation. */
export function renderSearchResult(outcome, options = {}) {
    // Closed-set gate FIRST (see RenderClosedValueViolation): the header below
    // prints `outputMode` unescaped, so this is a structure question, decided
    // before a single byte is presented.
    if (!GREP_OUTPUT_MODES.includes(outcome.outputMode)) {
        throw new RenderClosedValueViolation('outputMode', outcome.outputMode);
    }
    const meta = {
        kind: 'search',
        outputMode: outcome.outputMode,
        totalMatches: outcome.totalMatches,
        truncated: outcome.truncated,
        ...(options.spill ? { spill: options.spill } : {}),
    };
    const lines = [`search · ${outcome.outputMode} · ${outcome.totalMatches} matches`];
    if (outcome.outputMode === 'content') {
        for (const match of outcome.matches) {
            const where = [
                inline(match.path),
                ...(match.line === undefined ? [] : [String(match.line)]),
                ...(match.column === undefined ? [] : [String(match.column)]),
            ].join(':');
            lines.push(`${BODY_PREFIX}${where}: ${inline(match.text)}`);
        }
    }
    else if (outcome.outputMode === 'count') {
        for (const row of outcome.counts) {
            lines.push(`${BODY_PREFIX}${inline(row.path)}: ${row.count}`);
        }
    }
    else {
        for (const file of outcome.files) {
            lines.push(`${BODY_PREFIX}${inline(file)}`);
        }
    }
    if (lines.length === 1)
        lines.push(`${BODY_PREFIX}(no matches)`);
    if (outcome.truncated)
        lines.push(`${BODY_PREFIX}… truncated …`);
    lines.push(footer(meta));
    return deepFreezeContracts({ text: lines.join('\n'), presentationMeta: meta });
}
/** Render one shell outcome into the bounded, structure-safe presentation. */
export function renderShellResult(outcome, options = {}) {
    const maxChars = options.maxBytes ?? DEFAULT_MAX_STREAM_CHARS;
    const stdoutCut = outcome.stdout.length > maxChars;
    const stderrCut = outcome.stderr.length > maxChars;
    const meta = {
        kind: 'shell',
        exitCode: outcome.exitCode,
        timedOut: outcome.timedOut,
        cancelled: outcome.cancelled,
        truncated: outcome.truncated || stdoutCut || stderrCut,
        ...(options.spill ? { spill: options.spill } : {}),
    };
    const lines = [
        outcome.cancelled
            ? 'bash · cancelled'
            : `bash · exit=${outcome.exitCode === null ? 'not-observed' : outcome.exitCode}${outcome.timedOut ? ' · timed-out' : ''}`,
    ];
    const stdout = stdoutCut ? outcome.stdout.slice(0, maxChars) : outcome.stdout;
    if (stdout.length === 0) {
        lines.push(`${BODY_PREFIX}(empty stdout)`);
    }
    else {
        lines.push(...indented(stdout));
    }
    if (meta.truncated)
        lines.push(`${BODY_PREFIX}… output truncated …`);
    const stderr = stderrCut ? outcome.stderr.slice(0, maxChars) : outcome.stderr;
    if (stderr.length > 0) {
        lines.push('stderr:');
        lines.push(...indented(stderr));
    }
    lines.push(footer(meta));
    return deepFreezeContracts({ text: lines.join('\n'), presentationMeta: meta });
}
//# sourceMappingURL=render.js.map