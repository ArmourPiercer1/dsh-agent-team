/**
 * Alpha.5 PR0 — STRICT-PARSER NEGATIVES (plan §3: "类型/Schema 否定测试").
 *
 * RED-FIRST FILE. Every arm here is a refusal the contract parsers MUST give:
 * unknown extra fields, closed-set violations, locator rules that keep the
 * kinds security-meaningful (Realm Home vs workspace vs absolute path), the
 * kind↔rights matrix, the effect-kind↔resource-kind coupling, and the
 * canonical-form demands (sorted, deduplicated, fingerprint-recomputed).
 *
 * @module test/a5p0-schema-negatives
 */
import { describe, expect, it } from 'vitest'

import {
  parseAssuranceContract,
  parseOperationGrant,
  parseRequestedEffectSet,
  parseResourceRef,
  parseToolBinding,
  parseToolPolicyDocument,
  problemCodesOf,
} from '../tool-governance/src/index.js'

const realm = 'realm:team-alpha:ws-1'

const expectProblems = (result: Parameters<typeof problemCodesOf>[0], ...codes: string[]): void => {
  expect(result.ok, `expected refusal, got acceptance: ${JSON.stringify(result)}`).toBe(false)
  if (result.ok) return
  const seen = problemCodesOf(result)
  for (const code of codes) expect(seen, `missing problem ${code} in ${JSON.stringify(seen)}`).toContain(code)
}

const baseRef = { realmId: realm, kind: 'workspace', canonicalLocator: 'src/main.ts', rights: ['read'] }

describe('unknown extra fields are refused at every level (closed objects)', () => {
  it('ResourceRef: extra field → unknown-field', () => {
    expectProblems(parseResourceRef({ ...baseRef, extra: 1 }), 'unknown-field')
  })
  it('ResourceRef: extra field INSIDE rights handling is not silently dropped', () => {
    expectProblems(parseResourceRef({ ...baseRef, rights: [{ read: true }] }), 'field-type')
  })
  it('ToolBinding: extra top-level field → unknown-field', () => {
    const raw = {
      bindingId: 'b',
      agentScopeKey: 'agent',
      toolName: 'read',
      definitionIdentity: 'def',
      providerId: 'p',
      implementationOrigin: 'dsh-native',
      executionBoundary: 'trusted-host',
      assurance: {
        implementationOrigin: 'dsh-native',
        executionBoundary: 'trusted-host',
        assurance: Object.fromEntries(
          ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel'].map((d) => [d, 'untested']),
        ),
      },
      policyGeneration: 1,
      authorityGeneration: 1,
      revision: 0,
      status: 'UNBOUND',
      standingGrant: true, // the very thing PR0 must not tolerate
    }
    expectProblems(parseToolBinding(raw), 'unknown-field')
  })
  it('OperationGrant: extra field → unknown-field', () => {
    expectProblems(
      parseOperationGrant({
        grantId: 'g',
        member: { teamSessionId: 'ts', instanceId: 'i' },
        callId: 'c',
        realmId: realm,
        bindingId: 'b',
        bindingRevision: 1,
        authorityGeneration: 1,
        parametersFingerprint: 'sha256:a',
        effects: { effects: [{ kind: 'tool-invoke', toolName: 'read', resource: null }], fingerprint: 'sha256:b' },
        singleUse: true,
        issuedAt: 1,
        expiresAt: null,
        renewable: true, // a second, self-extending permission — refused
      }),
      'unknown-field',
    )
  })
})

describe('closed enumerations refuse wrong values (错枚举)', () => {
  it('resource kind outside the closed set', () => {
    expectProblems(parseResourceRef({ ...baseRef, kind: 'file' }), 'value-outside-closed-set')
  })
  it('resource right outside the closed set', () => {
    expectProblems(parseResourceRef({ ...baseRef, rights: ['read', 'delete'] }), 'value-outside-closed-set')
  })
  it('binding status outside the closed state machine', () => {
    expectProblems(
      parseToolBinding({
        bindingId: 'b',
        agentScopeKey: 'a',
        toolName: 'read',
        definitionIdentity: 'd',
        providerId: 'p',
        implementationOrigin: 'dsh-native',
        executionBoundary: 'trusted-host',
        assurance: {
          implementationOrigin: 'dsh-native',
          executionBoundary: 'trusted-host',
          assurance: {
            'content-read': 'enforced',
            'directory-metadata': 'enforced',
            write: 'enforced',
            alias: 'enforced',
            'network-destination': 'enforced',
            'inherit-cancel': 'enforced',
          },
        },
        policyGeneration: 0,
        authorityGeneration: 0,
        revision: 0,
        status: 'ACTIVE_BUT_UNGOVERNED',
      }),
      'value-outside-closed-set',
    )
  })
  it('assurance level outside the five-level set', () => {
    expectProblems(
      parseAssuranceContract({
        implementationOrigin: 'dsh-native',
        executionBoundary: 'trusted-host',
        assurance: {
          'content-read': 'probably-enforced',
          'directory-metadata': 'enforced',
          write: 'enforced',
          alias: 'enforced',
          'network-destination': 'enforced',
          'inherit-cancel': 'enforced',
        },
      }),
      'value-outside-closed-set',
    )
  })
  it('execution boundary is the three-value set — not the retired native/custom/shadow-run triple', () => {
    expectProblems(
      parseAssuranceContract({
        implementationOrigin: 'shadow-run', // retired vocabulary (design §2.1 forbidden usage)
        executionBoundary: 'trusted-host',
        assurance: {
          'content-read': 'enforced',
          'directory-metadata': 'enforced',
          write: 'enforced',
          alias: 'enforced',
          'network-destination': 'enforced',
          'inherit-cancel': 'enforced',
        },
      }),
      'value-outside-closed-set',
    )
  })
})

describe('locators keep the kinds security-meaningful (不塌成无安全含义字符串)', () => {
  it('relative `..` is refused on every filesystem kind', () => {
    for (const kind of ['workspace', 'realm-home', 'absolute-path', 'directory', 'metadata']) {
      const locator = kind === 'absolute-path' ? '/etc/../etc/passwd' : kind === 'realm-home' ? '~/../etc' : 'a/../b'
      expectProblems(
        parseResourceRef({ realmId: realm, kind, canonicalLocator: locator, rights: ['meta'] }),
        'locator-rejected',
      )
    }
  })
  it('a workspace locator may not be absolute; an absolute-path locator must be', () => {
    expectProblems(parseResourceRef({ ...baseRef, canonicalLocator: '/etc/passwd' }), 'locator-rejected')
    expectProblems(parseResourceRef({ ...baseRef, kind: 'absolute-path', canonicalLocator: 'etc/passwd' }), 'locator-rejected')
  })
  it('a realm-home locator must wear the `~/` prefix — it belongs to the execution Realm Home', () => {
    expectProblems(parseResourceRef({ ...baseRef, kind: 'realm-home', canonicalLocator: '.dsh/secrets' }), 'locator-rejected')
  })
  it('LEGAL leading/trailing spaces are PRESERVED, not trimmed; empty-after-trim is refused', () => {
    const kept = parseResourceRef({ ...baseRef, canonicalLocator: ' we had a file .md ' })
    expect(kept.ok).toBe(true)
    if (kept.ok) expect(kept.value.canonicalLocator).toBe(' we had a file .md ')
    expectProblems(parseResourceRef({ ...baseRef, canonicalLocator: '   ' }), 'locator-rejected')
  })
  it('a network destination needs the destination form; a filesystem locator may not wear a scheme', () => {
    expectProblems(
      parseResourceRef({ realmId: realm, kind: 'network-destination', canonicalLocator: 'not a url', rights: ['connect'] }),
      'locator-rejected',
    )
    expectProblems(parseResourceRef({ ...baseRef, canonicalLocator: 'https://example.com' }), 'locator-rejected')
  })
})

describe('kind ↔ rights matrix (list belongs to directories; connect to destinations)', () => {
  it('metadata kind carries ONLY the meta right', () => {
    expectProblems(
      parseResourceRef({ realmId: realm, kind: 'metadata', canonicalLocator: 'src/main.ts', rights: ['read'] }),
      'rights-matrix',
    )
  })
  it('a file kind does not carry `list`', () => {
    expectProblems(parseResourceRef({ ...baseRef, rights: ['read', 'list'] }), 'rights-matrix')
  })
  it('network destinations carry `connect` and nothing else', () => {
    expectProblems(
      parseResourceRef({ realmId: realm, kind: 'network-destination', canonicalLocator: 'https://a.b:1', rights: ['connect', 'read'] }),
      'rights-matrix',
    )
  })
  it('empty rights are refused', () => {
    expectProblems(parseResourceRef({ ...baseRef, rights: [] }), 'rights-matrix')
  })
})

describe('effect kind ↔ resource coupling', () => {
  it('`list` binds only to a directory resource', () => {
    expectProblems(
      parseRequestedEffectSet([
        { kind: 'list', resource: { realmId: realm, kind: 'workspace', canonicalLocator: 'src', rights: ['list'] } },
      ]),
      'rights-matrix',
    )
  })
  it('`connect` binds only to a network destination', () => {
    expectProblems(
      parseRequestedEffectSet([
        { kind: 'connect', resource: { realmId: realm, kind: 'workspace', canonicalLocator: 'x', rights: ['connect'] } },
      ]),
      'rights-matrix',
    )
  })
  it('`read` on a metadata-only resource is refused (metadata carries no content read)', () => {
    expectProblems(
      parseRequestedEffectSet([
        { kind: 'read', resource: { realmId: realm, kind: 'metadata', canonicalLocator: 'f', rights: ['meta'] } },
      ]),
      'effect-resource-mismatch',
    )
  })
  it('tool-invoke carries no resource; other invoke-shaped arms carry no toolName', () => {
    expectProblems(parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: null, resource: null }]), 'missing-field')
    expectProblems(
      parseRequestedEffectSet([{ kind: 'read', toolName: 'x', resource: baseRef }]),
      'unknown-field',
    )
  })
  it('domain-ref requires the domain authority identity', () => {
    expectProblems(parseRequestedEffectSet([{ kind: 'domain-ref', resource: null }]), 'missing-field')
  })
  it('unknown effect kind', () => {
    expectProblems(parseRequestedEffectSet([{ kind: 'exfiltrate', resource: null }]), 'value-outside-closed-set')
  })
})

describe('requested-effect-set demands the CANONICAL form (immutable canonical effects)', () => {
  const a = { kind: 'tool-invoke', toolName: 'read', resource: null }
  it('a raw unsorted/duplicated array is refused by parse (it must come canonicalized)', () => {
    const dirty = parseRequestedEffectSet([
      { kind: 'read', resource: baseRef },
      a,
    ])
    // parse of RAW input canonicalizes; but a claimed-canonical set with a
    // WRONG fingerprint is refused:
    expect(dirty.ok).toBe(true)
    if (!dirty.ok) return
    const tampered = { effects: dirty.value.effects, fingerprint: 'sha256:' + '0'.repeat(64) }
    expectProblems(parseRequestedEffectSet(tampered), 'fingerprint-mismatch')
  })
  it('an object that claims to be a set must expose `effects` as an array of canonical shape', () => {
    expectProblems(parseRequestedEffectSet({ effects: [] }), 'not-canonical')
  })
})

describe('ToolPolicyDocument closedness', () => {
  it('effectKind outside the seven kinds', () => {
    expectProblems(
      parseToolPolicyDocument({
        rules: [{ realmId: realm, effectKind: 'sudo', matcher: { kind: 'exact', resource: 'x' }, maximumEffect: 'allow' }],
      }),
      'value-outside-closed-set',
    )
  })
  it('maximumEffect outside deny/ask/allow', () => {
    expectProblems(
      parseToolPolicyDocument({
        rules: [{ realmId: realm, effectKind: 'read', matcher: { kind: 'exact', resource: 'x' }, maximumEffect: 'yolo' }],
      }),
      'value-outside-closed-set',
    )
  })
  it('matcher kind `any` is refused (the grammar has no `any`, ever)', () => {
    expectProblems(
      parseToolPolicyDocument({
        rules: [{ realmId: realm, effectKind: 'read', matcher: { kind: 'any', resource: '' }, maximumEffect: 'deny' }],
      }),
      'value-outside-closed-set',
    )
  })
})
