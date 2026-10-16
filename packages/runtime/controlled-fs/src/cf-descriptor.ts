/**
 * C-FS resource descriptor — `{ fs, path, fd? }` (INTERFACES-v1 C-FS).
 *
 * The lane-level handle view of a resource. The FROZEN contract identity is
 * still the PR0 `ResourceRef` ({realmId, kind, canonicalLocator, rights});
 * the descriptor is what the ControlledFs instance keeps internally and what
 * fd-carrying calls present:
 *
 *  - `fs`   — the registered instance id (which controlled tree);
 *  - `path` — the instance-RELATIVE canonical path (`'.'` = instance root).
 *             Relative `..` is refused (design §3.1), legal whitespace is
 *             preserved (a `trim()` would rename a file), POSIX separators
 *             only, no trailing/empty segments;
 *  - `fd`   — a kernel handle the CALLER claims. It is NEVER authority: the
 *             open-at-exec law re-establishes the handle under the grant and
 *             verifies identity; a presented fd is matched against the
 *             lane's own registry (see controlled-fs.ts). fd never
 *             participates in identity.
 *
 * Purity: no I/O — validation and mapping only.
 *
 * @module packages/runtime/controlled-fs/src/cf-descriptor
 */

import {
  closeRecordKeys,
  isRecord,
  parseResourceRef,
  type ParseResult,
  type ResourceRef,
  type ResourceRight,
  type ToolContractProblem,
} from '../../../domain/tool-governance/src/index.js'

/** The closed key set of the descriptor (C-FS contract, verbatim). */
export const CF_DESCRIPTOR_KEYS = ['fs', 'path', 'fd'] as const

/** The C-FS resource descriptor. */
export interface FsResourceDescriptor {
  readonly fs: string
  readonly path: string
  /** Present only while a kernel handle is (or was) claimed; never authority. */
  readonly fd?: number
}

/** Instance metadata the descriptor maps against (registered at the lane). */
export interface FsInstanceBinding {
  readonly realmId: string
  readonly rootLocator: string
}

/**
 * Strictly parse one raw descriptor: closed keys, closed path law.
 * The parse NEVER trims and NEVER normalizes case — identity is literal.
 */
export function parseFsDescriptor(raw: unknown): ParseResult<FsResourceDescriptor> {
  const problems: ToolContractProblem[] = []
  if (!isRecord(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'a C-FS descriptor must be a record' }] }
  }
  closeRecordKeys(raw, [...CF_DESCRIPTOR_KEYS], '$', problems)
  const fsRaw = raw['fs']
  if (typeof fsRaw !== 'string' || fsRaw.trim().length === 0) {
    problems.push({ code: 'field-type', path: '$.fs', detail: '`fs` must be a non-blank instance id' })
  }
  const pathRaw = raw['path']
  let path: string | undefined
  if (typeof pathRaw !== 'string' || pathRaw.length === 0) {
    problems.push({ code: 'field-type', path: '$.path', detail: '`path` must be a non-empty instance-relative path' })
  } else if (pathRaw.startsWith('/') || pathRaw.startsWith('\\')) {
    problems.push({ code: 'value-outside-closed-set', path: '$.path', detail: '`path` is instance-RELATIVE; an absolute path belongs to the ResourceRef layer' })
  } else if (pathRaw.includes('\\')) {
    problems.push({ code: 'value-outside-closed-set', path: '$.path', detail: 'descriptor paths use POSIX separators only' })
  } else if (pathRaw !== '.' && (pathRaw.startsWith('.') || pathRaw.endsWith('/'))) {
    problems.push({ code: 'value-outside-closed-set', path: '$.path', detail: 'no leading `.` hidden-path form and no trailing separator (`.` is the instance root)' })
  } else {
    const segments = pathRaw === '.' ? [] : pathRaw.split('/')
    if (segments.some((s) => s.length === 0)) {
      problems.push({ code: 'value-outside-closed-set', path: '$.path', detail: 'empty path segments are refused' })
    }
    if (segments.some((s) => s === '..' || s === '.')) {
      problems.push({ code: 'value-outside-closed-set', path: '$.path', detail: 'relative `..`/`.` segments are refused (design §3.1)' })
    }
    path = pathRaw
  }
  const fdRaw = raw['fd']
  let fd: number | undefined
  if (fdRaw !== undefined) {
    if (typeof fdRaw !== 'number' || !Number.isSafeInteger(fdRaw) || fdRaw < 0) {
      problems.push({ code: 'field-type', path: '$.fd', detail: '`fd` must be a non-negative safe integer when present' })
    } else {
      fd = fdRaw
    }
  }
  if (problems.length > 0) return { ok: false, problems }
  const value: FsResourceDescriptor = Object.freeze(
    fd === undefined ? { fs: fsRaw as string, path: path as string } : { fs: fsRaw as string, path: path as string, fd },
  )
  return { ok: true, value }
}

/** Identity is (fs, path) ONLY — a handle is never part of an identity. */
export function descriptorIdentityKey(desc: FsResourceDescriptor): string {
  return JSON.stringify([desc.fs, desc.path])
}

/**
 * Map a descriptor to the frozen `ResourceRef` identity of its instance
 * (kind `absolute-path` under the instance root). `rights` is the minimal
 * observation right unless the caller states the operation right — actual
 * authority always comes from the grant's effects, never from here.
 */
export function descriptorToResourceRef(
  desc: FsResourceDescriptor,
  binding: FsInstanceBinding,
  rights: readonly ResourceRight[] = ['meta'],
): ParseResult<ResourceRef> {
  const tail = desc.path === '.' ? '' : desc.path
  const canonicalLocator = tail.length === 0 ? binding.rootLocator : `${binding.rootLocator.replace(/\/+$/, '')}/${tail}`
  return parseResourceRef({
    realmId: binding.realmId,
    kind: 'absolute-path',
    canonicalLocator,
    rights: [...rights],
  })
}

/** Map a ResourceRef back to the descriptor, or refuse (outside the instance). */
export function resourceRefToDescriptor(
  ref: ResourceRef,
  fsId: string,
  binding: FsInstanceBinding,
): ParseResult<FsResourceDescriptor> {
  if (ref.realmId !== binding.realmId) {
    return { ok: false, problems: [{ code: 'value-outside-closed-set', path: '$.realmId', detail: 'ref belongs to another realm' }] }
  }
  const root = binding.rootLocator.replace(/\/+$/, '')
  const loc = ref.canonicalLocator
  let path: string
  if (loc === root) {
    path = '.'
  } else if (loc.startsWith(`${root}/`)) {
    path = loc.slice(root.length + 1)
  } else {
    return { ok: false, problems: [{ code: 'locator-rejected', path: '$.canonicalLocator', detail: 'locator is outside the instance root' }] }
  }
  return parseFsDescriptor({ fs: fsId, path })
}
