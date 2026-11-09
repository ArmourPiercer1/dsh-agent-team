/**
 * input-provenance.d.mts — the declaration half of `input-provenance.mjs` (an
 * untyped `.mjs` SOURCE module), so the TypeScript surface consumes the law
 * through a typed seam instead of `@ts-ignore`.
 *
 * THE CONTRACT IS DESCRIBED FROM THE IMPLEMENTATION (the .mjs header carries
 * the full argument): the module classifies who authored a model-visible
 * input. It never decides whether something is ALLOWED.
 */

/** The producer-owned machine source kind (`plugin:dsh-agent-team`). */
export declare const TEAM_PRODUCER_SOURCE: Readonly<{ readonly kind: 'plugin:dsh-agent-team' }>

/**
 * The frozen model-visible envelopes of the Team deliveries that DO carry the
 * human `kind: 'user'` attribution (work delivery + root work). Readonly and
 * exhaustive: adding a producer is a decision, not a default.
 */
export declare const TEAM_MACHINE_ENVELOPES: readonly string[]

/** Whether the text carries a Team machine envelope at its head. */
export declare function isTeamMachineText(text: unknown): boolean

/** The message shape the classification reads (a claimed inbox input). */
export interface TeamInputMessage {
  readonly id?: unknown
  readonly source?: { readonly kind?: unknown }
  readonly content?: readonly { readonly type?: string; readonly text?: unknown }[]
}

/** Whether one claimed input is Team-originated (machine), i.e. NOT human. */
export declare function isTeamMachineInput(message: TeamInputMessage | undefined | null): boolean

/** A bounded process-local ledger of the messages this process delivered. */
export interface MachineInputLedger {
  note(sessionId: string, message: TeamInputMessage | undefined | null): void
  size(): number
  has(sessionId: string, message: TeamInputMessage | undefined | null): boolean
}

/** Build one bounded ledger (`limit` entries, oldest evicted first). */
export declare function createMachineInputLedger(limit?: number): MachineInputLedger

/** Whether a claim may clear a durable human Stop (the resume arbour's question). */
export declare function isHumanInteractionClaim(
  message: TeamInputMessage | undefined | null,
  ledger?: MachineInputLedger,
  sessionId?: string,
): boolean
