/**
 * A5-PR3 (Lane B) — C-FS resource descriptor {fs, path, fd?} contract tests.
 *
 * RED-first: this file was written and observed failing (module not yet
 * implemented) BEFORE any file under `src/` existed — raw output in
 * `dev/agent-workflow/evidence/alpha5/pr3/runs/`.
 *
 * @module packages/runtime/controlled-fs/test/cf-descriptor
 */
import { describe, expect, it } from 'vitest'

import {
  CF_DESCRIPTOR_KEYS,
  descriptorIdentityKey,
  descriptorToResourceRef,
  parseFsDescriptor,
} from '../src/index.js'

const OK = { fs: 'ctl', path: 'public/a.txt' }

describe('C-FS descriptor {fs, path, fd?} — closed shape', () => {
  it('closed key set is exactly fs/path/fd', () => {
    expect([...CF_DESCRIPTOR_KEYS].sort()).toEqual(['fd', 'fs', 'path'])
  })

  it('accepts {fs, path} and {fs, path, fd}', () => {
    expect(parseFsDescriptor(OK).ok).toBe(true)
    const withFd = parseFsDescriptor({ ...OK, fd: 7 })
    expect(withFd.ok && withFd.value.fd).toBe(7)
  })

  it('rejects unknown keys, blank fs, blank path', () => {
    expect(parseFsDescriptor({ ...OK, extra: 1 }).ok).toBe(false)
    expect(parseFsDescriptor({ fs: '', path: 'a' }).ok).toBe(false)
    expect(parseFsDescriptor({ fs: 'ctl', path: '' }).ok).toBe(false)
  })

  it('rejects relative `..` segments and absolute-style paths (path is instance-RELATIVE)', () => {
    expect(parseFsDescriptor({ fs: 'ctl', path: 'a/../b' }).ok).toBe(false)
    expect(parseFsDescriptor({ fs: 'ctl', path: '/etc/passwd' }).ok).toBe(false)
    expect(parseFsDescriptor({ fs: 'ctl', path: '..' }).ok).toBe(false)
  })

  it('keeps legal whitespace — never trims (trim would rename the object)', () => {
    const parsed = parseFsDescriptor({ fs: 'ctl', path: 'dir /file ' })
    expect(parsed.ok && parsed.value.path).toBe('dir /file ')
  })

  it('fd must be a non-negative safe integer when present', () => {
    expect(parseFsDescriptor({ ...OK, fd: -1 }).ok).toBe(false)
    expect(parseFsDescriptor({ ...OK, fd: 1.5 }).ok).toBe(false)
    expect(parseFsDescriptor({ ...OK, fd: '3' }).ok).toBe(false)
  })

  it('identity is (fs, path) — fd NEVER participates (a handle is not an identity)', () => {
    expect(descriptorIdentityKey(OK as never)).toBe(descriptorIdentityKey({ ...OK, fd: 9 } as never))
  })

  it('maps to a realm-bound ResourceRef through the frozen parser', () => {
    const ref = descriptorToResourceRef(
      { fs: 'ctl', path: 'public/a.txt' } as never,
      { realmId: 'realm-1', rootLocator: '/srv/root' },
    )
    expect(ref.ok && ref.value.realmId).toBe('realm-1')
    expect(ref.ok && ref.value.kind).toBe('absolute-path')
    expect(ref.ok && ref.value.canonicalLocator).toBe('/srv/root/public/a.txt')
  })
})
