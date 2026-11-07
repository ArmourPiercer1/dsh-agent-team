/**
 * a5sf-pd17-fs-policy.test.ts — PD-17: the confined `fs` Provider's per-call
 * HOST policy is FORWARDED but NARROWED.
 *
 * WHY THIS FILE EXISTS. PD-17 puts the model-visible `read`/`write`/`edit`/
 * `read_image` on the realm's confined Provider. The host `write`/`edit` tools
 * build a per-call `SandboxExecutionPolicy` from the CALLING SESSION (mode +
 * the session workspace root) and hand it to the provider on every mutation.
 * The confined Provider used to DROP that argument (a deliberate 2026-11 guard
 * against an approved escalation weakening the host fence). Dropping the whole
 * object also dropped the SESSION WORKSPACE ROOT, so the base `fs-sandbox`
 * fell back to the DEPLOYMENT default root and refused a write the Member lane
 * had just admitted inside its own ceiling — measured live on a real Host
 * (PD-17 boot01: Member A reads `workspace/lane-a/a.txt`, then `write
 * workspace/lane-a/written-by-a.txt` → `FS_SANDBOX_DENIED` under
 * `workspace-write`).
 *
 * THE LAW THIS FILE PINS (both halves, each with its own arm):
 *
 *   1. the caller's `workspaceRoot` survives (in-lane mutations keep working);
 *   2. the caller's `mode` is capped at this deployment's own default
 *      (`read-only` < `workspace-write` < `danger-full-access`), so an
 *      escalation stamp can never make the HOST fence weaker than the
 *      deployment's own default;
 *   3. a `read-only` caller stays `read-only` (narrowing is not "always
 *      workspace-write");
 *   4. the Member ceiling still decides FIRST: with an out-of-lane locator the
 *      guard refuses and the base Provider is never called, whatever mode the
 *      caller stamped (escalation cannot bypass the lane).
 *
 * The base here is a recording double with a `sandboxMode` getter, the same
 * shape the real `SandboxedFileSystem` exposes; the guard is the REAL
 * `createMemberFsGuard` over the REAL compiled `MemberPolicy`, so arm 4 tests
 * the production admission path, not a stub.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-pd17-fs-policy
 */
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { MemberPolicy, PathRuleSet } from '../member-io-policy/src/types.js'
import { createConfinedFileSystemClass, createMemberFsGuard } from '../team-services/src/fs.js'

const IDENTITY = Object.freeze({
  teamId: 'team-pd17',
  memberInstanceId: 'member-pd17',
  templateId: 'worker',
  instanceGeneration: 1,
})

const SESSION_WORKSPACE = join(process.cwd(), '.artifacts', 'tmp', 'a5sf-pd17-fs-policy')
const READ_ROOT = join(SESSION_WORKSPACE, 'lane-a')
const WRITE_ROOT = READ_ROOT
const OUTSIDE_ROOT = join(SESSION_WORKSPACE, 'lane-b')

beforeAll(async () => {
  await mkdir(READ_ROOT, { recursive: true })
  await mkdir(OUTSIDE_ROOT, { recursive: true })
})
afterAll(async () => {
  await rm(SESSION_WORKSPACE, { recursive: true, force: true })
})

function lane(allow: readonly string[]): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function policyOf(): MemberPolicy {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: 'rev-pd17',
    read: lane([READ_ROOT]),
    write: lane([WRITE_ROOT]),
    network: Object.freeze({ access: 'allow' as const }),
  })
}

interface Recorded {
  readonly method: string
  readonly policy: unknown
}

/** A recording Provider with the shipped sandboxing deployment's `sandboxMode`. */
class RecordingFileSystem extends Service {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    super(ctx, 'fs')
    this.config = config
  }

  readonly config: Record<string, unknown>
  readonly calls: Recorded[] = []

  get sandboxMode(): string {
    return 'workspace-write'
  }

  processPath(target: unknown): string {
    return (target as { hostPath: string }).hostPath
  }

  contains(parent: unknown, child: unknown): boolean {
    return this.processPath(child).startsWith(this.processPath(parent))
  }

  async resolve(path: string): Promise<{ hostPath: string; displayPath: string }> {
    return { hostPath: path, displayPath: path }
  }

  async writeText(target: unknown, content: string, _expected?: unknown, _signal?: AbortSignal, policy?: unknown) {
    this.calls.push({ method: 'writeText', policy })
    return { operation: 'create', version: 'v1', before: null, after: content, hostPath: this.processPath(target) }
  }

  async editText(target: unknown, edit: { oldString: string; newString: string }, _expected?: unknown, _signal?: AbortSignal, policy?: unknown) {
    this.calls.push({ method: 'editText', policy })
    return { version: 'v2', before: edit.oldString, after: edit.newString, hostPath: this.processPath(target) }
  }
}

/** A Provider that is NOT a sandboxing backend (no `sandboxMode`). */
class PlainFileSystem extends RecordingFileSystem {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    super(ctx, config)
    // Delete the getter for THIS instance's prototype chain by shadowing it.
    Object.defineProperty(this, 'sandboxMode', { value: undefined, configurable: true })
  }
}

async function mountConfined(Base: typeof RecordingFileSystem) {
  const root = new Context()
  const Confined = createConfinedFileSystemClass(Base as never, createMemberFsGuard(policyOf()))
  await root.plugin(Confined, {})
  const fs = root.get('fs') as RecordingFileSystem
  return { root, fs }
}

const callerPolicy = (mode: string) => ({ mode, workspaceRoot: SESSION_WORKSPACE })

describe('PD-17 confined fs: the per-call host policy is forwarded but narrowed', () => {
  it('keeps the caller workspace root and caps danger-full-access at the deployment default', async () => {
    const { root, fs } = await mountConfined(RecordingFileSystem)
    try {
      const target = { hostPath: join(WRITE_ROOT, 'in-lane.txt') }
      await fs.writeText(target, 'content\n', undefined, undefined, callerPolicy('danger-full-access'))
      expect(fs.calls).toHaveLength(1)
      expect(fs.calls[0]?.policy).toMatchObject({ mode: 'workspace-write', workspaceRoot: SESSION_WORKSPACE })
    } finally {
      await root.fiber.dispose()
    }
  })

  it('never WIDENS a read-only caller (narrowing is not "always workspace-write")', async () => {
    const { root, fs } = await mountConfined(RecordingFileSystem)
    try {
      await fs.writeText({ hostPath: join(WRITE_ROOT, 'read-only.txt') }, 'content\n', undefined, undefined, callerPolicy('read-only'))
      expect(fs.calls[0]?.policy).toMatchObject({ mode: 'read-only', workspaceRoot: SESSION_WORKSPACE })
    } finally {
      await root.fiber.dispose()
    }
  })

  it('forwards an absent policy as absent (the base deployment default applies)', async () => {
    const { root, fs } = await mountConfined(RecordingFileSystem)
    try {
      await fs.editText({ hostPath: join(WRITE_ROOT, 'no-policy.txt') }, { oldString: 'a', newString: 'b' })
      expect(fs.calls[0]?.policy).toBeUndefined()
    } finally {
      await root.fiber.dispose()
    }
  })

  it('forwards the caller policy untouched when the base has no deployment mode', async () => {
    const { root, fs } = await mountConfined(PlainFileSystem)
    try {
      await fs.writeText({ hostPath: join(WRITE_ROOT, 'plain.txt') }, 'content\n', undefined, undefined, callerPolicy('danger-full-access'))
      expect(fs.calls[0]?.policy).toMatchObject({ mode: 'danger-full-access', workspaceRoot: SESSION_WORKSPACE })
    } finally {
      await root.fiber.dispose()
    }
  })

  it('the Member ceiling decides FIRST: an out-of-lane write is refused with IO_WRITE_DENIED and the base is never called, even with danger-full-access', async () => {
    const { root, fs } = await mountConfined(RecordingFileSystem)
    try {
      const outside = { hostPath: join(OUTSIDE_ROOT, 'out-of-lane.txt') }
      await expect(fs.writeText(outside, 'content\n', undefined, undefined, callerPolicy('danger-full-access')))
        .rejects.toMatchObject({ code: 'IO_WRITE_DENIED' })
      expect(fs.calls).toHaveLength(0)
    } finally {
      await root.fiber.dispose()
    }
  })
})
