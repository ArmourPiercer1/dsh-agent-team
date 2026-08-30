/**
 * file-seam.d.mts — the tsc type surface of `file-seam.mjs` (ruling R22:
 * the harness lives in `.mjs` because only `.mjs` files may import `node:`
 * builtins; the adjacent `.d.mts` is resolved by tsc (NodeNext) for the
 * `../fault-injection/file-seam.mjs` import specifier, while the plain-node
 * runner loads the `.mjs` natively).
 *
 * The {@link FileStorageSeam} class implements the EXACT T1 seam interface
 * (`packages/storage/schema/seam.ts`): `StorageDomainSeam.open` /
 * `closeAll`, `StorageDomainHandle` (name / table / close), and
 * `StorageKvTable` (get / entries / keys / size / put / delete / update).
 *
 * @module fault-injection/file-seam
 */

import type { StorageDomainHandle, StorageDomainSeam, StorageDomainSpec } from '../../storage/schema/seam.js'

/**
 * The distinct crash-injection error: the seam-level armed fault firing
 * mid-durable-write. Carries NO seam `code` — the T1 repositories classify
 * it as an unclassified `SEAM_FAILURE` (same surface as the P4-T1
 * `FakeCrashError`).
 */
export declare class CrashFault extends Error {
  readonly name: 'CrashFault'
  constructor(message: string)
}

/** One applied (durable: tmp + rename) seam write. */
export interface FileSeamWriteLogEntry {
  readonly domain: string
  readonly table: string
  readonly key: string
  readonly op: 'put' | 'delete' | 'update'
}

/**
 * One file-backed durable domain facility: one JSON file per KvTable in a
 * scratch dir; atomic durable writes (sibling `.tmp` + `fs.renameSync`);
 * an armed sticky crash fault that leaves a crash-leftover `.tmp` file and
 * keeps the target untouched.
 *
 * @param scratchDir - the scratch dir this seam owns (created lazily on
 *   first `open`; typically the result of {@link scratchDir}).
 */
export declare class FileStorageSeam implements StorageDomainSeam {
  constructor(scratchDir: string)
  /** The scratch dir this seam owns. */
  readonly scratchDir: string
  /** Number of APPLIED (durable) writes, seam-wide (mirrors the P4-T1 fake's `writeCount`). */
  readonly writeCount: number
  /** Every applied write (the single-write-durability evidence). */
  readonly writeLog: readonly FileSeamWriteLogEntry[]
  /** True when a crash is armed. */
  readonly crashArmed: boolean
  /** Open (or re-open) the named domain from the scratch dir. */
  open(spec: StorageDomainSpec): Promise<StorageDomainHandle>
  /** Close every domain this facility has open (state persists on the medium). */
  closeAll(): Promise<void>
  /** Arm a sticky crash: the first `n` writes commit, every later write crashes mid-atomic-write. */
  armCrashAfterWrites(n: number): void
  /** Disarm the armed crash. */
  clearCrash(): void
  /** The durable dir of one domain (`<scratch>/<domain>`). */
  dirFor(domainName: string): string
  /** The durable file of one table (`<scratch>/<domain>/<table>.json`). */
  pathFor(domainName: string, table: string): string
  /** The L1 domain-stamp file (`<scratch>/<domain>.meta.json`). */
  metaPathFor(domainName: string): string
  /** Delete the scratch dir (recursive, force — a no-op when absent). */
  destroy(): void
}

/**
 * One per-test scratch dir under `packages/testkit/test/.tmp-fault/<basename>`
 * (workspace-internal; NOT created here — the seam creates it lazily).
 * @param basename - a plain `[a-z0-9._-]` name identifying the test block.
 */
export declare function scratchDir(basename: string): string
/** Delete one dir (recursive, force — a no-op when absent). */
export declare function destroyDir(absDir: string): void
/** Read one UTF-8 text file (for corruption tampering and assertions). */
export declare function readText(absPath: string): string
/**
 * Write one UTF-8 text file PLAIN (non-atomic) — the tamper helper. Parent
 * dirs are created.
 */
export declare function writeText(absPath: string, text: string): void
/** List the file names directly inside one dir. */
export declare function listFiles(absDir: string): string[]
/** The absolute dir of one committed fixture snapshot (`fixtures/<name>`). */
export declare function fixtureDir(name: string): string
/**
 * Copy one committed fixture snapshot into a FRESH scratch dir (the fixture
 * is consumed, never mutated in place).
 * @returns the new scratch dir path.
 */
export declare function copyFixtureIntoScratch(fixtureName: string, scratchBaseName: string): string
