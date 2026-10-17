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
import type { RenderedPresentation, SearchOutcome, SearchPresentationMeta, ShellOutcome, ShellPresentationMeta, SpillPointer } from './types.js';
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
export declare class RenderClosedValueViolation extends Error {
    readonly field: string;
    readonly value: unknown;
    constructor(field: string, value: unknown);
}
/** The footer marker — structural, renderer-owned (see law 2). */
export declare const META_PREFIX = "a5p5-meta ";
/** The body indent — every untrusted line wears exactly one (see law 2). */
export declare const BODY_PREFIX = "> ";
/** Default per-stream bound for the presentation (chars; Spill is a later slice). */
export declare const DEFAULT_MAX_STREAM_CHARS = 65536;
/** Options shared by both renderers (Phase 2 spill slice). */
export interface RenderOptions {
    /**
     * The attribution pointer when the FULL payload lives in the spill store.
     * The renderer only states the fact — reading the pointer re-checks
     * authorization at read time (`spill.ts`); the inline presentation stays
     * bounded and sanitized exactly as before.
     */
    readonly spill?: SpillPointer;
}
/** Render one search outcome into the bounded, structure-safe presentation. */
export declare function renderSearchResult(outcome: SearchOutcome, options?: RenderOptions): RenderedPresentation<SearchPresentationMeta>;
/** Options of the shell renderer. */
export interface ShellRenderOptions extends RenderOptions {
    /** Per-stream character bound for the PRESENTATION (executor bounds may be smaller). */
    readonly maxBytes?: number;
}
/** Render one shell outcome into the bounded, structure-safe presentation. */
export declare function renderShellResult(outcome: ShellOutcome, options?: ShellRenderOptions): RenderedPresentation<ShellPresentationMeta>;
//# sourceMappingURL=render.d.ts.map