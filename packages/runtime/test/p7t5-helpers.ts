/**
 * p7t5-helpers — shared world factory and fakes for the P7-T5
 * (Start Team from Here) tests (TaskDoc §11.8 P7-T5; DevPlan §20.5;
 * Architecture §34).
 *
 * Contents:
 *
 * - {@link P7T5_FIXTURE} — the P7-T5 fixture identities (distinct from
 *   the P4 / P5 / P6 fixture values);
 * - {@link makeSurface} — one mutable default source canonical surface
 *   (the fake's backing store — returned by reference on read, so a
 *   service that fails to DETACH the snapshot would leak mutations);
 * - {@link FakeSourceSurface} — the mock-first
 *   {@link HandoffSourceSurfacePort}: call recording (`readCount`),
 *   one-shot fault injection (`failNextRead`), live-mutation helpers
 *   (`addMessage` / `setTitle` / `setMetadata`);
 * - {@link FakeSummarizer} — the mock-first
 *   {@link HandoffSummarizerPort}: deterministic summary, call
 *   recording (`summarizeCount`), one-shot and sticky fault injection;
 * - {@link FakeTeamCreation} — the mock-first
 *   {@link HandoffTeamCreationPort}: full intent recording (the
 *   one-shot creation-entry evidence channel), idempotent per
 *   `intentToken` (the stable operation identity contract), one-shot
 *   fault injection;
 * - {@link createP7T5World} — one handoff service world over the fakes
 *   with the default deterministic clock;
 * - {@link assertHandoffCode} — the closed-code assertion (mirrors the
 *   p6t1 `assertActivationCode`);
 * - {@link DEFAULT_CLOCK} — the deterministic fixture clock (ISO-8601).
 *
 * Mock-first (ruling R28): every external boundary (the public session
 * query/read surface, the Host/Team creation auxiliary summarizer, the
 * public Team creation entry) is a fake; the handoff service itself is
 * REAL. The fakes' call counters are the "snapshot once" /
 * "failure before root create" evidence channels.
 *
 * @module @dsh-agent-team/runtime/test/p7t5-helpers
 */

import type {
  HandoffPorts,
  HandoffSourceSurfacePort,
  HandoffSummary,
  HandoffSummarizerPort,
  HandoffTeamCreationPort,
  HandoffTeamIntent,
  SourceCanonicalSurface,
  TeamCreationOutcome,
} from '../handoff/index.js'
import { HandoffError, createHandoffService } from '../handoff/index.js'
import type { HandoffService } from '../handoff/index.js'
import { canonicalJsonStringify } from '../../contracts/src/index.js'
import type { RemoteSafeRecord } from '../../contracts/src/index.js'
import { sha256Hex } from '../../domain/blueprint/src/index.js'

/** The deterministic fixture clock (ISO-8601). */
export const DEFAULT_CLOCK = '2026-08-29T12:00:00.000Z'

/**
 * T12-B5 (plan §7-B3) — the canonical composite identity, re-derived
 * here INDEPENDENTLY of the service (the tests pin the plan contract,
 * not the implementation): the ONE digest over the canonical JSON of
 * the `(sourceSessionId, requestToken)` pair, carried as the 40-hex
 * digit suffix of both tokens (different prefixes, same digest).
 */
export function compositeHandoffDigest(sourceSessionId: string, requestToken: string): string {
  return sha256Hex(canonicalJsonStringify({ requestToken, sourceSessionId })).slice(0, 40)
}

/** The expected one-shot handoff context token of one operation. */
export function expectedContextToken(sourceSessionId: string, requestToken: string): string {
  return `handoff-ctx-${compositeHandoffDigest(sourceSessionId, requestToken)}`
}

/** The expected stable team intent token of one operation. */
export function expectedIntentToken(sourceSessionId: string, requestToken: string): string {
  return `handoff-intent-${compositeHandoffDigest(sourceSessionId, requestToken)}`
}

/**
 * The deterministic target root derivation (root.ts `createHandoffTeam`,
 * re-derived here independently for the T12-B5 cross-source BC):
 * `session-handoff-` + the 40-hex-digit digest of the canonical
 * `{ intentToken }`.
 */
export function expectedTargetRoot(intentToken: string): string {
  return `session-handoff-${sha256Hex(canonicalJsonStringify({ intentToken })).slice(0, 40)}`
}

/** The P7-T5 fixture identities (distinct from P4 / P5 / P6 fixtures). */
export const P7T5_FIXTURE = {
  /** The ordinary (non-team) source DSH session A. */
  sourceSessionId: 'session-p7t5-src',
  /** The new team root DSH session B (invariant 9: = the TeamSession id). */
  newRootSessionId: 'session-p7t5-new',
  /** The default request token. */
  requestToken: 'tok-p7t5-default',
} as const

/** A MUTABLE backing surface (structurally assignable to
 *  {@link SourceCanonicalSurface}): the fakes' mutation channel — the
 *  fake returns it BY REFERENCE on read, so only a service that DETACHES
 *  the snapshot survives the `source mutate` scenarios. */
export interface MutableSourceSurface {
  readonly sessionId: string
  title: string | null
  readonly createdAt: string
  messages: { readonly role: string; readonly text: string }[]
  metadata: RemoteSafeRecord
}

/**
 * One mutable default source canonical surface (the fake's backing
 * store). A PLAIN mutable object on purpose: the fake returns it by
 * reference, so only a DETACHED copy inside the service can survive the
 * `source mutate` scenarios.
 */
export function makeSurface(): MutableSourceSurface {
  return {
    sessionId: P7T5_FIXTURE.sourceSessionId,
    title: 'Baseline task',
    createdAt: '2026-08-29T00:00:00.000Z',
    messages: [
      { role: 'user', text: 'build the baseline' },
      { role: 'assistant', text: 'baseline committed' },
    ],
    metadata: {},
  }
}

/**
 * The mock-first public session query/read surface: returns its backing
 * surface BY REFERENCE (live), records every read, and supports one-shot
 * fault injection.
 */
export class FakeSourceSurface implements HandoffSourceSurfacePort {
  /** The live backing surface (mutable — the mutation channel). */
  private backing: MutableSourceSurface
  /** Number of `readCanonicalSurface` calls (the "snapshot once" channel). */
  readCount = 0
  /** Every source id that was read, in order. */
  readonly reads: string[] = []
  /** When true, the next read throws (then clears). */
  failNextRead = false

  /**
   * @param backing - the live backing surface (defaults to {@link makeSurface}).
   */
  constructor(backing: MutableSourceSurface = makeSurface()) {
    this.backing = backing
  }

  /**
   * Read the current canonical surface (live reference).
   * @param sourceSessionId - the requested source session id.
   */
  async readCanonicalSurface(sourceSessionId: string): Promise<SourceCanonicalSurface> {
    this.readCount += 1
    this.reads.push(sourceSessionId)
    if (this.failNextRead) {
      this.failNextRead = false
      throw new Error('source surface read failed (injected)')
    }
    return this.backing
  }

  /** Append one message to the live backing surface (source mutates). */
  addMessage(role: string, text: string): void {
    this.backing.messages.push({ role, text })
  }

  /** Replace the live backing title (source mutates). */
  setTitle(title: string | null): void {
    this.backing.title = title
  }

  /** Replace the live backing metadata (source mutates). */
  setMetadata(metadata: RemoteSafeRecord): void {
    this.backing.metadata = metadata
  }

  /** A deep detached copy of the current backing surface (test oracle). */
  snapshotOracle(): SourceCanonicalSurface {
    return JSON.parse(JSON.stringify(this.backing)) as SourceCanonicalSurface
  }
}

/**
 * The mock-first one-shot summarize/compress auxiliary capability
 * (Architecture §34.4 — NOT the Leader/Member model): deterministic,
 * call-recording, fault-injectable.
 */
export class FakeSummarizer implements HandoffSummarizerPort {
  /** Number of `summarize` calls (the "one-shot summary" channel). */
  summarizeCount = 0
  /** Every surface (detached copy) that was summarized, in order. */
  readonly summarized: SourceCanonicalSurface[] = []
  /** When true, the next summarize throws (then clears). */
  failNext = false
  /** When true, every summarize throws (sticky). */
  failSticky = false

  /**
   * Summarize one frozen surface deterministically: the title echoes the
   * source session id; one bullet per message (`role: text`).
   * @param surface - the detached frozen source surface.
   */
  async summarize(surface: SourceCanonicalSurface): Promise<HandoffSummary> {
    this.summarizeCount += 1
    this.summarized.push(JSON.parse(JSON.stringify(surface)) as SourceCanonicalSurface)
    if (this.failSticky || this.failNext) {
      if (!this.failSticky) this.failNext = false
      throw new Error('summarization failed (injected)')
    }
    return {
      title: `handoff:${surface.sessionId}`,
      bullets: surface.messages.map((m) => `${m.role}: ${m.text}`),
    }
  }
}

/**
 * The mock-first public Team creation entry: records every staged
 * TeamIntent it was called with (the creation-entry evidence channel),
 * is idempotent per `intentToken` (the stable operation identity
 * contract), and supports one-shot fault injection.
 */
export class FakeTeamCreation implements HandoffTeamCreationPort {
  /** Every staged TeamIntent received, in order (detached copies). */
  readonly intents: HandoffTeamIntent[] = []
  /** Number of `createTeam` calls. */
  callCount = 0
  /** The committed outcome per intentToken (the idempotency store). */
  private readonly outcomes = new Map<string, TeamCreationOutcome>()
  /** When true, the next call throws (then clears). */
  failNext = false

  /**
   * Create (or idempotently re-create) the team for one staged intent.
   * @param intent - the staged TeamIntent (stable `intentToken`).
   */
  async createTeam(intent: HandoffTeamIntent): Promise<TeamCreationOutcome> {
    this.callCount += 1
    this.intents.push(JSON.parse(JSON.stringify(intent)) as HandoffTeamIntent)
    if (this.failNext) {
      this.failNext = false
      throw new Error('team creation failed (injected)')
    }
    const existing = this.outcomes.get(intent.intentToken)
    if (existing !== undefined) return existing
    const outcome: TeamCreationOutcome = {
      teamSessionId: P7T5_FIXTURE.newRootSessionId,
      rootSessionId: P7T5_FIXTURE.newRootSessionId,
    }
    this.outcomes.set(intent.intentToken, outcome)
    return outcome
  }
}

/** One handoff service world over the mock-first fakes. */
export interface P7T5World {
  /** The handoff service under test (REAL). */
  readonly service: HandoffService
  /** The mock-first source surface port. */
  readonly source: FakeSourceSurface
  /** The mock-first summarizer port. */
  readonly summarizer: FakeSummarizer
  /** The mock-first team creation port. */
  readonly creation: FakeTeamCreation
  /** The ports this world is wired with. */
  readonly ports: HandoffPorts
}

/**
 * Build one handoff world: the REAL service over the three mock-first
 * ports and the deterministic fixture clock.
 *
 * @param source - optional pre-seeded source surface fake.
 * @param summarizer - optional pre-seeded summarizer fake.
 * @param creation - optional pre-seeded creation fake.
 * @param clock - optional clock (defaults to {@link DEFAULT_CLOCK}).
 */
export function createP7T5World(
  source: FakeSourceSurface = new FakeSourceSurface(),
  summarizer: FakeSummarizer = new FakeSummarizer(),
  creation: FakeTeamCreation = new FakeTeamCreation(),
  clock: () => string = () => DEFAULT_CLOCK,
): P7T5World {
  const ports: HandoffPorts = {
    sourceSurface: source,
    summarizer,
    teamCreation: creation,
    clock,
  }
  return {
    service: createHandoffService(ports),
    source,
    summarizer,
    creation,
    ports,
  }
}

/**
 * Assert that `error` is a {@link HandoffError} with exactly `code`
 * (the closed vocabulary assertion — mirrors the p6t1
 * `assertActivationCode`).
 * @throws a plain Error when the shape or the code does not match.
 */
export function assertHandoffCode(error: unknown, code: string): void {
  if (!(error instanceof HandoffError)) {
    throw new Error(
      `assertHandoffCode: expected a HandoffError but got ${
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertHandoffCode: expected HandoffError code '${code}' but got '${error.code}' (${error.message})`,
    )
  }
}
