/**
 * artifact-read-digest-fact.test.ts — Strict-read + Core-spill Phase A:
 * the pure digest + fact machinery of the `artifact-read-granted` family
 * (implementation guide §2.2/§2.3):
 *
 * - digests: `sha256:<64 hex>` format, determinism, domain separation
 *   (targetKey vs version, same raw token → different digests), raw
 *   tokens never appear in digests;
 * - fact: the builder emits the CLOSED payload shape (exact key set);
 *   the strict parser accepts well-formed rows and rejects every
 *   corruption class (foreign factType, wrong payload version, extra or
 *   missing keys, malformed digests, malformed source shapes, wrong
 *   field types/bounds); `rootSessionId` is projected from the ENTRY,
 *   not the payload;
 * - builder → parser round-trip (the durable-replay guarantee: a built
 *   fact parses back to the same grant under its entry's root).
 *
 * @module @dsh-agent-team/runtime/test/artifact-read-digest-fact
 */
import { describe, expect, it } from 'vitest'
import {
  TARGET_KEY_DIGEST_DOMAIN,
  VERSION_DIGEST_DOMAIN,
  isDigest,
  targetKeyDigest,
  versionDigest,
} from '../artifact-read/index.js'
import {
  ARTIFACT_READ_GRANTED_FACT_TYPE,
  buildArtifactReadGrantedPayload,
  isArtifactReadGrantedFact,
  parseArtifactReadGranted,
} from '../artifact-read/index.js'
import type { ArtifactLedgerEntry, ArtifactSource } from '../artifact-read/index.js'

// --- fixtures -------------------------------------------------------------------

const TK1 = 'fs-local:/var/lib/dsh/spill/session-1/tool-ab12cd34-00000001-0000000000000000-0000000000000000.log'
const TK2 = 'fs-local:/var/lib/dsh/spill/session-1/tool-ab12cd34-00000001-0000000000000000-0000000000000001.log'
const V1 = '64765:131075:12345:1753900000000000000:1753900000000000000'
const V2 = '64765:131076:12346:1753900001000000000:1753900001000000000'

const LOCATOR = TK1
const INSTANCE_ID = 'inst-worker-1'

const TOOLSOURCE: ArtifactSource = {
  kind: 'spill-store',
  spillSource: { kind: 'tool', toolName: 'bash', callId: 'call-001', label: 'bash #1' },
}
const SESSIONREFSOURCE: ArtifactSource = {
  kind: 'spill-store',
  spillSource: { kind: 'session-reference', sessionId: 'session-ref-9', label: 'ref' },
}
const SHELLFGSOURCE: ArtifactSource = {
  kind: 'shell-foreground',
  toolName: 'bash',
  callId: 'call-002',
  stream: 'stdout',
}

function entry(factType: string, payload: Record<string, unknown>, rootSessionId = 'team-root-1'): ArtifactLedgerEntry {
  return {
    schemaVersion: 2,
    sequence: 1,
    rootSessionId,
    factType,
    payload,
    createdAt: '2026-09-20T00:00:00.000Z',
  }
}

// --- digests ----------------------------------------------------------------------

describe('digests', () => {
  it('emits the sha256:<64 hex> format for both domains', () => {
    const tk = targetKeyDigest(TK1)
    const v = versionDigest(V1)
    expect(isDigest(tk)).toBe(true)
    expect(isDigest(v)).toBe(true)
    expect(tk.startsWith('sha256:')).toBe(true)
    expect(tk.length).toBe(7 + 64)
    expect(v.length).toBe(7 + 64)
  })

  it('is deterministic for the same token and domain', () => {
    expect(targetKeyDigest(TK1)).toBe(targetKeyDigest(TK1))
    expect(versionDigest(V1)).toBe(versionDigest(V1))
  })

  it('differs across distinct tokens', () => {
    expect(targetKeyDigest(TK1)).not.toBe(targetKeyDigest(TK2))
    expect(versionDigest(V1)).not.toBe(versionDigest(V2))
  })

  it('is domain-separated: the same raw token digests differently in the two domains', () => {
    expect(targetKeyDigest(V1)).not.toBe(versionDigest(V1))
    expect(targetKeyDigest(TK1)).not.toBe(versionDigest(TK1))
    expect(TARGET_KEY_DIGEST_DOMAIN).not.toBe(VERSION_DIGEST_DOMAIN)
  })

  it('never embeds the raw token in the digest', () => {
    expect(targetKeyDigest(TK1).includes('spill')).toBe(false)
    expect(versionDigest(V1).includes('64765')).toBe(false)
  })

  it('rejects malformed digest strings in the guard', () => {
    expect(isDigest('sha256:abc')).toBe(false)
    expect(isDigest('md5:' + '0'.repeat(32))).toBe(false)
    expect(isDigest('sha256:' + 'G'.repeat(64))).toBe(false)
    expect(isDigest('sha256:' + '0'.repeat(63))).toBe(false)
    expect(isDigest(123)).toBe(false)
    expect(isDigest(null)).toBe(false)
  })
})

// --- fact builder -----------------------------------------------------------------

describe('fact builder', () => {
  it('emits the closed payload shape (exact key set) for every source kind', () => {
    for (const source of [TOOLSOURCE, SESSIONREFSOURCE, SHELLFGSOURCE]) {
      const payload = buildArtifactReadGrantedPayload({
        instanceId: INSTANCE_ID,
        locator: LOCATOR,
        targetKeyDigest: targetKeyDigest(TK1),
        versionDigest: versionDigest(V1),
        source,
      })
      expect(Object.keys(payload).sort()).toEqual([
        'instanceId',
        'locator',
        'schemaVersion',
        'source',
        'targetKeyDigest',
        'versionDigest',
      ])
      expect(payload['schemaVersion']).toBe(1)
    }
  })

  it('encodes each source kind losslessly (round-trips through the parser)', () => {
    for (const source of [TOOLSOURCE, SESSIONREFSOURCE, SHELLFGSOURCE]) {
      const grant = parseArtifactReadGranted(
        entry(
          ARTIFACT_READ_GRANTED_FACT_TYPE,
          buildArtifactReadGrantedPayload({
            instanceId: INSTANCE_ID,
            locator: LOCATOR,
            targetKeyDigest: targetKeyDigest(TK1),
            versionDigest: versionDigest(V1),
            source,
          }),
          'root-A',
        ),
      )
      expect(grant).toBeDefined()
      expect(grant?.rootSessionId).toBe('root-A')
      expect(grant?.instanceId).toBe(INSTANCE_ID)
      expect(grant?.locator).toBe(LOCATOR)
      expect(grant?.source).toEqual(source)
    }
  })
})

// --- fact parser --------------------------------------------------------------------

describe('fact parser', () => {
  const goodPayload = buildArtifactReadGrantedPayload({
    instanceId: INSTANCE_ID,
    locator: LOCATOR,
    targetKeyDigest: targetKeyDigest(TK1),
    versionDigest: versionDigest(V1),
    source: TOOLSOURCE,
  })

  it('accepts a well-formed row and projects rootSessionId from the entry', () => {
    const grant = parseArtifactReadGranted(entry(ARTIFACT_READ_GRANTED_FACT_TYPE, goodPayload, 'root-B'))
    expect(grant).toBeDefined()
    expect(grant?.rootSessionId).toBe('root-B')
    expect(isArtifactReadGrantedFact(ARTIFACT_READ_GRANTED_FACT_TYPE)).toBe(true)
    expect(isArtifactReadGrantedFact('activity-progress-recorded')).toBe(false)
  })

  it('rejects a foreign factType', () => {
    expect(parseArtifactReadGranted(entry('artifact-read-granted-x', goodPayload))).toBeUndefined()
    expect(parseArtifactReadGranted(entry('control-requested', goodPayload))).toBeUndefined()
  })

  it('rejects a wrong payload version', () => {
    const payload = { ...goodPayload, schemaVersion: 2 }
    expect(parseArtifactReadGranted(entry(ARTIFACT_READ_GRANTED_FACT_TYPE, payload))).toBeUndefined()
  })

  it('rejects extra or missing payload keys', () => {
    expect(
      parseArtifactReadGranted(
        entry(ARTIFACT_READ_GRANTED_FACT_TYPE, { ...goodPayload, extraKey: 'x' }),
      ),
    ).toBeUndefined()
    const { instanceId: _drop, ...rest } = goodPayload
    expect(parseArtifactReadGranted(entry(ARTIFACT_READ_GRANTED_FACT_TYPE, rest))).toBeUndefined()
  })

  it('rejects malformed digests and field types/bounds', () => {
    expect(
      parseArtifactReadGranted(
        entry(ARTIFACT_READ_GRANTED_FACT_TYPE, { ...goodPayload, targetKeyDigest: 'not-a-digest' }),
      ),
    ).toBeUndefined()
    expect(
      parseArtifactReadGranted(
        entry(ARTIFACT_READ_GRANTED_FACT_TYPE, { ...goodPayload, versionDigest: 42 }),
      ),
    ).toBeUndefined()
    expect(
      parseArtifactReadGranted(
        entry(ARTIFACT_READ_GRANTED_FACT_TYPE, { ...goodPayload, instanceId: '' }),
      ),
    ).toBeUndefined()
    expect(
      parseArtifactReadGranted(
        entry(ARTIFACT_READ_GRANTED_FACT_TYPE, { ...goodPayload, locator: 'x'.repeat(2049) }),
      ),
    ).toBeUndefined()
    expect(parseArtifactReadGranted(entry(ARTIFACT_READ_GRANTED_FACT_TYPE, {}))).toBeUndefined()
    expect(parseArtifactReadGranted(entry(ARTIFACT_READ_GRANTED_FACT_TYPE, null as never))).toBeUndefined()
  })

  it('rejects every source-shape corruption class', () => {
    const corruptSource = (mutate: (s: Record<string, unknown>) => void) => {
      const source = JSON.parse(JSON.stringify(goodPayload['source'])) as Record<string, unknown>
      mutate(source)
      return parseArtifactReadGranted(
        entry(ARTIFACT_READ_GRANTED_FACT_TYPE, { ...goodPayload, source }),
      )
    }
    // unknown kind
    expect(corruptSource((s) => { s['kind'] = 'shell-unknown' })).toBeUndefined()
    // unknown spill source kind
    expect(
      corruptSource((s) => {
        const spill = s['spillSource'] as Record<string, unknown>
        spill['kind'] = 'other'
      }),
    ).toBeUndefined()
    // missing spillSource field
    expect(
      corruptSource((s) => {
        const spill = s['spillSource'] as Record<string, unknown>
        delete spill['callId']
      }),
    ).toBeUndefined()
    // non-object spillSource
    expect(corruptSource((s) => { s['spillSource'] = 'nope' })).toBeUndefined()
    // extra source field
    expect(corruptSource((s) => { s['evil'] = true })).toBeUndefined()
    // bad stream value
    expect(
      corruptSource((s) => {
        s['kind'] = 'shell-foreground'
        s['spillSource'] = undefined
        s['callId'] = 'c1'
        s['toolName'] = 'bash'
        s['stream'] = 'both'
      }),
    ).toBeUndefined()
  })
})
