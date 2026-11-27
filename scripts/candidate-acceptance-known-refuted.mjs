/**
 * candidate-acceptance-known-refuted.mjs — THE enumeration of judges that may pass
 * a candidate/version gate while being REFUTED.
 *
 * ONE DECLARATION, TWO READERS. The gate (`scripts/candidate-acceptance-gate.mjs`)
 * grades its judge population against this map, and the version-gate verifier
 * (`scripts/version-gate-verify.mjs`) refuses a receipt whose known-refuted set is
 * not EXACTLY these ids. Keeping one module is why the verifier cannot drift into
 * accepting a set the gate would have failed, and why adding an exemption is a
 * visible edit to one reviewed file (2026-11-25 version-gate round).
 *
 * IT IS A LITERAL id → citation MAP. Nothing is matched by prefix, suffix or
 * pattern: a new REFUTED judge does NOT inherit an exemption, and removing an entry
 * makes both the gate and the verifier RED until the enumeration is deliberately
 * edited in review.
 *
 * Today there is exactly one such judge. It is an APPROVED PRODUCT RULING (owner,
 * 2026-11-24), not a pending fix: this generation promises allow/deny for
 * Subprocess/PTY and explicitly does NOT support per-call `ask` for process
 * execution. The refusal is fail-closed (the real ask->approval->grant consumption
 * happened, then the spawn failed with NO_BACKEND before any process existed: zero
 * process, zero bytes, settlement FAILED).
 *
 * @type {Readonly<Record<string, Readonly<{citation: string, review: string, reason: string}>>>}
 */
export const KNOWN_REFUTED = Object.freeze({
  'd4:ask-execute-process': Object.freeze({
    citation: 'dev/agent-workflow/evidence/ute-a1/SCOPE-subprocess-ask.md — STATUS: APPROVED BY OWNER (2026-11-24), §2 (what is explicitly NOT promised) and §4 (the exact current refusal evidence, both hosts)',
    review: 'docs/reviews/20261124-2120.txt ruling 1 — the owner formally APPROVED the Subprocess/PTY scope (product scope only): Process Ask is `UNSUPPORTED BY PRODUCT RULING`, the same class as PTC (review `20261124-1341` §3.1 proposed the wording; §4.3 closed the product-scope question)',
    reason: 'APPROVED BY PRODUCT RULING (2026-11-24): this generation promises `allow`/`deny` for Subprocess/PTY; per-call `ask` for process execution is NOT supported and remains fail-closed. The process ask chain really did run — a real durable ask, a real Officer allow, a consumed one-shot grant — then the persistent-bash backend lookup failed with the host\'s NO_BACKEND because the v5 per-tool bash binding realm carries no PTY terminal spec: the spawn failed BEFORE any process existed, zero bytes were produced, settlement is FAILED, and the receipt verifier was never reached. That is the approved promise, not a pending product fix; the refutation is preserved as REFUTED (never rewritten as a positive test, and never REFUSED/not-started).',
  }),
})

/** The closed id set the version gate may accept. Derived, never re-typed. */
export const KNOWN_REFUTED_IDS = Object.freeze(Object.keys(KNOWN_REFUTED).sort())
