/**
 * P8-S5A — the frozen legacy-session-reader public surface (type snapshot).
 *
 * The production root (A29, `legacy`) consumes the frozen P7-T7 reader
 * (`packages/legacy/session-reader`) WITHOUT importing its sources: the
 * reader's pre-existing type errors (TS2540 readonly assignment, TS2345
 * strict-null) must never surface inside the runtime build program, and a
 * plain-JS production entry cannot load `.ts` at all. The reader is
 * compiled separately (packages/legacy/tsconfig.build.json, `noCheck`,
 * mirror-emitted INTO the runtime dist) and the production entry loads the
 * emitted `.js` by computed URL at boot.
 *
 * This file is the runtime-side TYPE contract for that frozen surface — a
 * verbatim structural snapshot of `packages/legacy/session-reader/types.ts`
 * (the read-only home port + the closed inspection result vocabulary). The
 * legacy package is FROZEN (legacy inventory; the reader is P7-T7-final),
 * so the snapshot cannot drift; if it ever must, update both together and
 * record the deviation.
 * @module @dsh-agent-team/runtime/plugin/legacy-surface
 */
export {};
//# sourceMappingURL=legacy-surface.js.map