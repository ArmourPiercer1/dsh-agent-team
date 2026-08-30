/**
 * The P5-T2 persona overlay contract surface (TaskDoc §11.5 P5-T2; DevPlan
 * §18.2/§18.3; Architecture §13, §40.4).
 *
 * This module defines:
 *
 * - {@link ScopedPersonaIdentity} — the scoped identity the compatible
 *   (non-complete) preset case installs: the Team Blueprint persona text
 *   scoped onto the target's AgentPreset substrate (DevPlan §18.3 "Team
 *   Blueprint persona → scoped identity");
 * - the two read-only sources the adapter composes from: the public
 *   AgentPreset substrate seam (./../preset, imported by the adapter) and
 *   {@link TeamBlueprintPersonaSource} (the Blueprint-owned persona text,
 *   Architecture §13.3);
 * - {@link ScopedPersonaPromptSurface} — the public system-prompt seam the
 *   scoped identity is installed onto (the runtime context of the Team
 *   prompt/policy surface, §40.4); mock-first in T2, real DSH public
 *   binding in T5/T6;
 * - {@link PersonaOverlaySlotOptions} — the construction options of the
 *   persona overlay slot (all dependencies injected, fail-fast validated).
 *
 * Pure module: no I/O, no live Agent, no `node:` builtin, no runtime
 * environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/persona/types
 */

import type { CompatibilityEvaluationInput, CompatibilityResult } from '../../../domain/compatibility/src/index.js'
import type { AgentPresetSeam } from '../preset/index.js'

/**
 * The scoped identity of one team agent's Team persona (lossless-JSON
 * value; no live references).
 *
 * Formed EXACTLY as DevPlan §18.3 / Architecture §13.3–13.4 prescribe:
 * the Team Blueprint owns the persona TEXT (LeaderTemplate / MemberTemplate
 * `persona`), the AgentPreset owns the ASSEMBLY semantics — the scoped
 * identity records the composition (which preset substrate, which
 * blueprint-provided text) and is installed as a scoped prompt section
 * (§40.4), never by modifying the preset.
 *
 * Every field's rationale:
 *
 * 1. `kind` — the bound session kind (root or member): the two templates'
 *    persona texts are distinct, so the identity records which one;
 * 2. `rootSessionId` — the TeamSession id (invariant 9): the durable scope
 *    the identity belongs to;
 * 3. `instanceId` — the member's stable composite identity component
 *    (invariant 18; member only): distinguishes members sharing a template;
 * 4. `presetId` — the inherited substrate identity (member: the ROOT's
 *    preset, §13.1): provenance of the assembly-semantics side of the
 *    composition;
 * 5. `personaOrigin` — fixed `'blueprint'`: the text ownership marker
 *    (§13.3: the Blueprint owns the persona text, the preset owns the
 *    assembly);
 * 6. `personaText` — the scoped runtime-context content (the Leader/Member
 *    Template `persona` prose) installed onto the prompt surface.
 */
export interface ScopedPersonaIdentity {
  /** The bound session kind. */
  readonly kind: 'root' | 'member'
  /** The TeamSession id (= RootSessionId, invariant 9). */
  readonly rootSessionId: string
  /** The member's stable instance id (member only, invariant 18). */
  readonly instanceId?: string
  /** The inherited AgentPreset substrate identity (member: the root's preset). */
  readonly presetId: string
  /** The persona-text ownership marker: always `'blueprint'` (§13.3). */
  readonly personaOrigin: 'blueprint'
  /** The Team Blueprint persona prose (the scoped section content). */
  readonly personaText: string
}

/**
 * The read-only source of the Team Blueprint persona text (Architecture
 * §13.3: "Team Blueprint 拥有 LeaderTemplate.persona text /
 * MemberTemplate.persona text").
 *
 * The source resolves the immutable Blueprint snapshot the TeamSession
 * binds (invariant 10) internally — the slot hands it only the durable
 * identities the step context carries (root session id, and the member
 * template id from the MemberInstance record). Mock-first in T2 (a scripted
 * map); the real implementation (T5/T6) reads the durable snapshot store.
 *
 * Every member's rationale:
 *
 * 1. `getLeaderPersona` — the ROOT scoped identity's text: the bound
 *    snapshot's LeaderTemplate `persona` (required, non-empty by blueprint
 *    validation);
 * 2. `getMemberPersona` — the MEMBER scoped identity's text: the bound
 *    snapshot's MemberTemplate `persona` for the record's `templateId`
 *    (static template identity, invariant 19). Members carry no other
 *    persona source: there is deliberately no per-member selector here
 *    either (DevPlan §18.2).
 */
export interface TeamBlueprintPersonaSource {
  /**
   * The bound snapshot's LeaderTemplate persona text for one root session.
   * @param rootSessionId - the root DSH session id (= TeamSessionId).
   * @returns the LeaderTemplate persona prose.
   */
  getLeaderPersona(rootSessionId: string): string
  /**
   * The bound snapshot's MemberTemplate persona text for one template.
   * @param rootSessionId - the root DSH session id (= TeamSessionId).
   * @param templateId - the member's static template id (invariant 19).
   * @returns the MemberTemplate persona prose.
   */
  getMemberPersona(rootSessionId: string, templateId: string): string
}

/**
 * The public system-prompt seam the scoped identity is installed onto
 * (Architecture §40.4: the public scoped prompt section —
 * `deployment:persona`-style scope shadow; mock-first in T2, real DSH
 * public binding in T5/T6).
 *
 * This seam carries the persona overlay's runtime-context installation:
 * the scoped identity (persona text + provenance) becomes the runtime
 * context of the Team prompt/policy surface. The surface is CLOSED to one
 * effect on purpose: the adapter can only install the scoped section — it
 * can never modify, replace, or delete the preset's own assembly (the
 * "upstream assembly semantics preserved" acceptance criterion holds by
 * construction).
 *
 * Member's rationale:
 *
 * 1. `installScopedPersona` — the FRESH-time public Agent setup effect,
 *    once per session per bind: the real implementation (T5/T6) registers
 *    the scoped prompt section on the target's live residency (idempotent
 *    per session — re-installation converges to the same section); the
 *    T2 mock records the call. The COLD path never calls this seam: the
 *    binder's scope restoration re-attaches the slot set without fresh-time
 *    effects (DevPlan §18.5).
 */
export interface ScopedPersonaPromptSurface {
  /**
   * Install the scoped persona identity (runtime context) on the target's
   * live agent residency.
   * @param sessionId - the bound DSH session id (root or member child).
   * @param identity - the scoped identity to install.
   */
  installScopedPersona(sessionId: string, identity: ScopedPersonaIdentity): void
}

/**
 * One compatibility evaluation of the adapter (the P3-T5 engine's pure
 * signature). Injectable so tests can count / wrap the real engine
 * (semantics stay the real engine's: the default IS the real pure engine).
 */
export type CompatibilityEvaluator = (
  input: CompatibilityEvaluationInput,
) => CompatibilityResult

/**
 * The construction options of the persona overlay slot (all dependencies
 * injected; construction is fail-fast — a malformed dependency throws a
 * `TypeError`, a programming error, mirroring the binder constructor).
 */
export interface PersonaOverlaySlotOptions {
  /** The injected public AgentPreset substrate seam (mock-first, T5/T6 real). */
  readonly presetSeam: AgentPresetSeam
  /** The read-only Team Blueprint persona source (mock-first, T5/T6 real). */
  readonly personaSource: TeamBlueprintPersonaSource
  /** The public scoped-prompt installation surface (mock-first, T5/T6 real). */
  readonly promptSurface: ScopedPersonaPromptSurface
  /**
   * Optional compatibility evaluator override; absent = the real P3-T5
   * pure engine (the default).
   */
  readonly evaluateCompatibility?: CompatibilityEvaluator
}
