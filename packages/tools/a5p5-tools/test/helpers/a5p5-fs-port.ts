/**
 * Test-side `node:fs` adapter for the spill port + a call ledger.
 *
 * The lane `src/` stays pure (no `node:*`): every byte that hits a disk in the
 * spill tests goes through THIS adapter, and the ledger is what lets a test
 * assert "refused BEFORE touch" — a typed refusal that still counted an fs
 * call would be a silent escape, not a refusal.
 *
 * @module test/helpers/a5p5-fs-port
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'

import type { SpillFsPort } from '../../src/spill.js'

/** Per-operation call counters (the "deny BEFORE I/O" evidence). */
export interface PortCalls {
  ensureDir: number
  writeFile: number
  appendFile: number
  readText: number
  sizeBytes: number
  list: number
  remove: number
  exists: number
}

export function newPortCalls(): PortCalls {
  return { ensureDir: 0, writeFile: 0, appendFile: 0, readText: 0, sizeBytes: 0, list: 0, remove: 0, exists: 0 }
}

export interface CountedPort {
  readonly port: SpillFsPort
  readonly calls: PortCalls
}

export function createNodeFsPort(): CountedPort {
  const calls = newPortCalls()
  const port: SpillFsPort = {
    ensureDir(path) {
      calls.ensureDir += 1
      mkdirSync(path, { recursive: true })
    },
    writeFile(path, text) {
      calls.writeFile += 1
      writeFileSync(path, text, 'utf8')
    },
    appendFile(path, text) {
      calls.appendFile += 1
      appendFileSync(path, text, 'utf8')
    },
    readText(path) {
      calls.readText += 1
      return readFileSync(path, 'utf8')
    },
    sizeBytes(path) {
      calls.sizeBytes += 1
      return statSync(path).size
    },
    list(dir) {
      calls.list += 1
      return readdirSync(dir)
    },
    remove(path) {
      calls.remove += 1
      rmSync(path)
    },
    exists(path) {
      calls.exists += 1
      return existsSync(path)
    },
  }
  return { port, calls }
}
