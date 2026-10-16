/**
 * A5-PR3 (Lane B) — PoC3 fixture world + grant fixtures.
 *
 * The fixture world is a REAL filesystem world under
 * `tests/homes/a5p3-<UTC>/` (TEST_METHODS §7 temp-world protocol): real
 * directories, real symlinks, real renames — PoC3 is a negative-control
 * probe set on the REAL FS, not a mock. One world per probe file; the world
 * is destroyed in teardown and the deletion is recorded in the lane evidence.
 *
 * Layout (all content SYNTHETIC):
 *   world/
 *     controlled/                     <- the instance root (realm-1, fs='ctl')
 *       public/a.txt                  'A-CONTENT\n'
 *       private/secret.txt            'PRIVATE-SECRET\n'   (cross-member private)
 *       mine/.draft.txt               'DRAFT-HIDDEN\n'     (hidden-by-policy)
 *       escape/alias-out.txt          -> ../../outside/secret.txt
 *       stage/in.txt                  'STAGE-IN\n'         (race swap leg)
 *       out/                          (writable dir)
 *     outside/secret.txt              'OUTSIDE-SECRET\n'   (outside the anchor)
 *     outside/recycled-victim.txt     'RECYCLED-BYTES\n'   (fd-recycle leg)
 *     outside2/other.txt              'OTHER-SECRET\n'     (race swap target)
 *
 * This module imports ONLY `node:*` and the frozen PR0 domain contracts —
 * never the lane implementation — so the RED-first run fails on the
 * implementation import, not on the fixtures.
 *
 * @module packages/runtime/controlled-fs/test/poc3-harness
 */
import { createHash } from 'node:crypto'
import {
  existsSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  parseOperationGrant,
  parseRequestedEffectSet,
  parseResourceRef,
  type MemberRef,
  type OperationGrant,
  type ResourceKind,
  type ResourceRef,
  type ResourceRight,
} from '../../../domain/tool-governance/src/index.js'

const HERE = dirname(fileURLToPath(import.meta.url))
/** .../packages/runtime/controlled-fs/test -> repo root. */
export const REPO_ROOT = realpathSync(join(HERE, '..', '..', '..', '..'))

export const REALM = 'realm-1'
export const FS_ID = 'ctl'

export const MEM_A: MemberRef = Object.freeze({ teamSessionId: 'ts-1', instanceId: 'member-a' })
export const MEM_B: MemberRef = Object.freeze({ teamSessionId: 'ts-1', instanceId: 'member-b' })

export interface Poc3World {
  readonly world: string
  readonly ctrl: string
  readonly outside: string
  readonly outside2: string
}

/** sha256 with the contract's fingerprint spelling (matches reqFingerprint). */
export function sha256(text: string): string {
  return `sha256:${createHash('sha256').update(text, 'utf8').digest('hex')}`
}

function stamp(): string {
  return `${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}Z-${process.pid}`
}

/** Create the real fixture world under tests/homes/a5p3-<UTC>. */
export function createPoc3World(): Poc3World {
  const world = join(REPO_ROOT, 'tests', 'homes', `a5p3-${stamp()}`)
  if (existsSync(world)) throw new Error(`world already exists: ${world}`)
  const ctrl = join(world, 'controlled')
  mkdirSync(join(ctrl, 'public'), { recursive: true })
  mkdirSync(join(ctrl, 'private'), { recursive: true })
  mkdirSync(join(ctrl, 'mine'), { recursive: true })
  mkdirSync(join(ctrl, 'escape'), { recursive: true })
  mkdirSync(join(ctrl, 'stage'), { recursive: true })
  mkdirSync(join(ctrl, 'out'), { recursive: true })
  mkdirSync(join(world, 'outside'), { recursive: true })
  mkdirSync(join(world, 'outside2'), { recursive: true })
  writeFileSync(join(ctrl, 'public', 'a.txt'), 'A-CONTENT\n')
  writeFileSync(join(ctrl, 'private', 'secret.txt'), 'PRIVATE-SECRET\n')
  writeFileSync(join(ctrl, 'mine', '.draft.txt'), 'DRAFT-HIDDEN\n')
  writeFileSync(join(ctrl, 'stage', 'in.txt'), 'STAGE-IN\n')
  writeFileSync(join(world, 'outside', 'secret.txt'), 'OUTSIDE-SECRET\n')
  writeFileSync(join(world, 'outside', 'recycled-victim.txt'), 'RECYCLED-BYTES\n')
  writeFileSync(join(world, 'outside2', 'other.txt'), 'OTHER-SECRET\n')
  // The race-swap target keeps the SAME file name so the guarded open
  // SUCCEEDS at the OS level and the exec-time re-read is what catches it.
  writeFileSync(join(world, 'outside2', 'in.txt'), 'OTHER-SECRET\n')
  symlinkSync(join('..', '..', 'outside', 'secret.txt'), join(ctrl, 'escape', 'alias-out.txt'))
  // The instance anchor must be symlink-free for the race/escape legs to be
  // unambiguous; assert, never assume.
  if (realpathSync(ctrl) !== ctrl) throw new Error(`fixture anchor not canonical: ${ctrl}`)
  return { world, ctrl, outside: join(world, 'outside'), outside2: join(world, 'outside2') }
}

/** TEST_METHODS §7: temp worlds are deleted at teardown (recorded in runs/). */
export function destroyPoc3World(world: string): void {
  rmSync(world, { recursive: true, force: true })
  if (existsSync(world)) throw new Error(`world teardown failed: ${world}`)
}

// ---------------------------------------------------------------------------
// Ref + grant fixtures (built through the frozen parsers — invalid fixture
// data cannot enter a test by construction).
// ---------------------------------------------------------------------------

export function fileRef(world: Poc3World, rel: string, rights: readonly ResourceRight[]): ResourceRef {
  return refOf(world, 'absolute-path', rel, rights)
}

export function dirRef(world: Poc3World, rel: string, rights: readonly ResourceRight[]): ResourceRef {
  return refOf(world, 'directory', rel, rights)
}

function refOf(world: Poc3World, kind: ResourceKind, rel: string, rights: readonly ResourceRight[]): ResourceRef {
  const parsed = parseResourceRef({
    realmId: REALM,
    kind,
    canonicalLocator: join(world.ctrl, rel),
    rights,
  })
  if (!parsed.ok) throw new Error(`fixture ref rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export interface EffectFixture {
  readonly kind: 'read' | 'write' | 'list' | 'meta'
  readonly resource: ResourceRef
}

export interface GrantFixture {
  readonly member: MemberRef
  readonly effects: readonly EffectFixture[]
  readonly authorityGeneration?: number
  readonly expiresAt?: number | null
  readonly grantId?: string
}

let grantSeq = 0

/** Build one contract-valid grant over the given effect resources. */
export function makeGrant(fx: GrantFixture): OperationGrant {
  const effectsParsed = parseRequestedEffectSet(fx.effects.map((e) => ({ kind: e.kind, resource: e.resource })))
  if (!effectsParsed.ok) {
    throw new Error(`fixture effects rejected: ${JSON.stringify(effectsParsed.problems)}`)
  }
  const raw = {
    grantId: fx.grantId ?? `grant-${++grantSeq}`,
    member: fx.member,
    callId: `call-${grantSeq}`,
    realmId: REALM,
    bindingId: 'binding-1',
    bindingRevision: 1,
    authorityGeneration: fx.authorityGeneration ?? 1,
    parametersFingerprint: sha256(`params-${grantSeq}`),
    effects: effectsParsed.value,
    singleUse: true,
    issuedAt: 0,
    expiresAt: fx.expiresAt ?? null,
  }
  const parsed = parseOperationGrant(raw)
  if (!parsed.ok) {
    throw new Error(`fixture grant rejected: ${JSON.stringify(parsed.problems)}`)
  }
  return parsed.value
}

/** The raw text of a world file (test-side observation, never via the lane). */
export function readRaw(file: string): string {
  return readFileSync(file, 'utf8')
}
