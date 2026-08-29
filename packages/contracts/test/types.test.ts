import { describe, expect, it } from 'vitest'

import { PACKAGE_ID } from '../src/index.js'
import type {
  BlueprintSnapshotRef,
  ChildSessionId,
  InstanceId,
  MemberIdentity,
  MemberInstanceRecordDto,
  MemberLifecycleState,
  RootSessionId,
  SessionBindingDto,
  SessionBindingTeamMember,
  TeamContractError,
  TeamContractSchemaVersion,
  TeamSessionId,
  TeamSessionRecordDto,
  TemplateId,
} from '../src/index.js'

/*
 * Type-level invariants of contracts v1. These assertions are enforced by
 * `tsc` (see the canonical typecheck step): a broken invariant makes the
 * build fail, not a runtime test.
 */

type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Assert<T extends true> = T

// invariant 9: TeamSessionId is literally RootSessionId — no second team id
type _T9 = Assert<Eq<TeamSessionId, RootSessionId>>

// invariant 18: the member runtime identity has EXACTLY two components
type _T18 = Assert<Eq<keyof MemberIdentity, 'rootSessionId' | 'instanceId'>>

// schema version: the v1 type is the literal 1
type _TVER = Assert<Eq<TeamContractSchemaVersion, 1>>

// §29: exactly five frozen lifecycle states
type _TLIFECYCLE = Assert<
  Eq<MemberLifecycleState, 'CREATED' | 'RUNNING' | 'SETTLED' | 'ARCHIVED' | 'DISPOSED'>
>

// branded ids remain plain strings at the value level (lossless JSON, §5.1)
type _TSTR_ROOT = Assert<Eq<RootSessionId extends string ? true : false, true>>
type _TSTR_CHILD = Assert<Eq<ChildSessionId extends string ? true : false, true>>
type _TSTR_INST = Assert<Eq<InstanceId extends string ? true : false, true>>
type _TSTR_TPL = Assert<Eq<TemplateId extends string ? true : false, true>>

// the DTO field sets are exactly the frozen v1 field sets
type _TEAM_FIELDS = Assert<
  Eq<
    keyof TeamSessionRecordDto,
    | 'schemaVersion'
    | 'rootSessionId'
    | 'blueprint'
    | 'defaultWorkspace'
    | 'createdAt'
    | 'generation'
  >
>
type _MEMBER_FIELDS = Assert<
  Eq<
    keyof MemberInstanceRecordDto,
    | 'schemaVersion'
    | 'rootSessionId'
    | 'instanceId'
    | 'templateId'
    | 'label'
    | 'groupId'
    | 'childSessionId'
    | 'workspace'
    | 'lifecycle'
    | 'createdAt'
    | 'activityVersion'
  >
>
type _SNAPSHOT_FIELDS = Assert<
  Eq<keyof BlueprintSnapshotRef, 'blueprintId' | 'revision' | 'contentHash'>
>

// A plain string must NOT satisfy a branded id: identity is explicit.
// @ts-expect-error a plain string is not a RootSessionId
const _notRoot: RootSessionId = 'session-1'
// @ts-expect-error a plain string is not an InstanceId
const _notInst: InstanceId = 'inst-a'

// Cross-brand identity is rejected at the type level: the branded id types
// are mutually distinct (the Eq of two different brands must be `false`).
// (Checked as a type, not a value: `declare const` bindings are erased by
// Node type-stripping and must not be referenced at runtime.)
type _T_CROSS = Assert<Eq<Eq<RootSessionId, InstanceId>, false>>
type _T_CROSS2 = Assert<Eq<Eq<TeamSessionId, ChildSessionId>, false>>

// The SessionBindingDto discriminated union narrows on `kind`.
function _narrow(binding: SessionBindingDto): string {
  if (binding.kind === 'team-member') {
    const member: SessionBindingTeamMember = binding
    return member.rootSessionId
  }
  return binding.kind
}

function _assertNever(x: never): never {
  return x
}

// Exhaustiveness: a new binding kind would be a compile error here.
function _exhaustive(kind: SessionBindingDto['kind']): string {
  switch (kind) {
    case 'ordinary':
      return 'ordinary'
    case 'team-root':
      return 'team-root'
    case 'team-member':
      return 'team-member'
    default:
      return _assertNever(kind)
  }
}

// Consumers branch on the frozen code, which is always present.
function _errCode(err: TeamContractError): string {
  return err.code
}

void _notRoot
void _notInst
void _narrow
void _exhaustive
void _errCode

describe('contracts v1 — type-level invariants (enforced by tsc)', () => {
  it('this file compiling proves the Eq assertions and @ts-expect-error lines above', () => {
    expect(PACKAGE_ID).toBe('contracts')
  })
})
