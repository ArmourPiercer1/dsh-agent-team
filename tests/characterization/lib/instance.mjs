/**
 * Characterization harness — DSH instance lifecycle.
 *
 * start / stop / dump-config / row-mounting for a DSH web instance built
 * from the pinned upstream tree. Mechanism (chosen on the P2-T1 spawn-probe
 * evidence): every child is spawned with FILE-FD stdio — an fs.openSync()
 * fd as the stdio entry — so the instance's stdout/stderr land in a log
 * file the harness can read, without any piped-stdio spawn (EPERM in the
 * workspace-write sandbox; see spawn-probe.mjs P1/P2/P4).
 *
 * Launch chain per TEST_METHODS §2: `node apps/cli/lib/bin.js web --port
 * <port> --no-open` with DSH_HOME + DSH_CLIENT_COMMIT_HASH env; the success
 * marker is the `dsh web: http://127.0.0.1:<port>/?token=...` line (app-boot
 * prints it only after the plugin tree loaded — assertEntriesActivated
 * rejects startup on any entry import/activation failure, so the line is a
 * machine-level load proof).
 */
import { spawn } from 'node:child_process'
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { logTail, portInUse, waitForLogLine, waitForPortFree } from './util.mjs'

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

/** One booted (or about-to-boot) DSH instance under harness control. */
export class DshInstance {
  /**
   * @param {object} config
   * @param {string} config.hostTree - pristine upstream checkout root
   * @param {string} config.dshHome - dedicated DSH_HOME (workspace-internal)
   * @param {number} config.port
   * @param {string} config.clientCommitHash - DSH_CLIENT_COMMIT_HASH (skips in-build git spawn)
   * @param {string} config.logDir - directory for instance log files
   */
  constructor(config) {
    this.config = config
    this.child = undefined
    this.logPath = join(config.logDir, `instance-port${config.port}.log`)
    this.booted = false
  }

  /** Path of the web profile's patch layer (the public seam this harness writes). */
  get patchFile() {
    return join(this.config.dshHome, 'profiles', 'web', 'cordis.patch.yml')
  }

  get profileDir() {
    return join(this.config.dshHome, 'profiles', 'web')
  }

  /** True once the host has initialized the web profile under DSH_HOME. */
  profileInitialized() {
    return existsSync(join(this.profileDir, 'package.json')) && existsSync(this.patchFile)
  }

  /**
   * Start the web instance; resolve once the boot marker line appears (with
   * the parsed port+token url) or reject with the log tail on failure.
   */
  async start({ timeoutMs = 90_000 } = {}) {
    if (this.child !== undefined) throw new Error('instance already started')
    mkdirSync(this.config.logDir, { recursive: true })
    writeFileSync(this.logPath, '', { flag: 'w' })
    const outFd = openSync(this.logPath, 'a')
    const errFd = openSync(this.logPath, 'a')
    let child
    try {
      child = spawn(
        process.execPath,
        ['apps/cli/lib/bin.js', 'web', '--port', String(this.config.port), '--no-open'],
        {
          cwd: this.config.hostTree,
          stdio: ['ignore', outFd, errFd],
          env: {
            ...process.env,
            DSH_HOME: this.config.dshHome,
            DSH_CLIENT_COMMIT_HASH: this.config.clientCommitHash,
          },
        },
      )
    } catch (error) {
      closeSync(outFd)
      closeSync(errFd)
      throw new Error(`instance spawn failed: ${error.message}`)
    }
    this.child = child
    let exitInfo = { code: undefined, signal: undefined, exited: false }
    child.on('error', (error) => {
      exitInfo = { code: undefined, signal: 'spawn-error', exited: true, message: error.message }
    })
    child.on('close', (code, signal) => {
      exitInfo = { code, signal, exited: true }
    })
    const alive = () => !exitInfo.exited
    const line = await waitForLogLine(this.logPath, BOOT_MARKER, timeoutMs, alive)
    if (line === null) {
      const detail = exitInfo.exited
        ? `process exited (code=${exitInfo.code} signal=${exitInfo.signal ?? 'none'})`
        : `no boot marker within ${timeoutMs}ms`
      await this.stop()
      throw new Error(`instance boot failed: ${detail}\n--- log tail ---\n${logTail(this.logPath)}`)
    }
    const url = line.replace(/.*dsh web:\s*/, '')
    this.booted = true
    return { url, logPath: this.logPath }
  }

  /** Stop the instance (kill the child) and wait for the port to free. */
  async stop({ timeoutMs = 15_000 } = {}) {
    const child = this.child
    this.child = undefined
    this.booted = false
    if (child === undefined) {
      return { killed: false, portFree: await waitForPortFree(this.config.port, 2000) }
    }
    const exited = new Promise((resolveExit) => {
      child.once('close', () => resolveExit(true))
      setTimeout(() => resolveExit(false), timeoutMs)
    })
    try {
      child.kill()
    } catch {
      /* already gone */
    }
    const exitedCleanly = await exited
    const portFree = await waitForPortFree(this.config.port, timeoutMs)
    if (!portFree) {
      // Last resort: taskkill the process tree (Windows) — itself spawned with
      // file-fd stdio, so this stays inside the sandbox mechanism set.
      if (process.platform === 'win32') {
        const { spawnToLog } = await import('./util.mjs')
        await spawnToLog('taskkill', ['/F', '/T', '/PID', String(child.pid)], {
          cwd: this.config.hostTree,
          logPath: join(this.config.logDir, `taskkill-port${this.config.port}.log`),
          timeoutMs: 15_000,
        })
      }
      return { killed: exitedCleanly, portFree: await waitForPortFree(this.config.port, timeoutMs) }
    }
    return { killed: exitedCleanly, portFree }
  }

  /**
   * Run `--profile web --dump-config` (one-shot; prints the composed profile
   * tree and exits) and return the composed text.
   */
  async dumpConfig({ timeoutMs = 60_000 } = {}) {
    const logPath = join(this.config.logDir, `dump-config-port${this.config.port}.log`)
    const { spawnToLog } = await import('./util.mjs')
    const result = await spawnToLog(
      process.execPath,
      ['apps/cli/lib/bin.js', '--profile', 'web', '--dump-config'],
      {
        cwd: this.config.hostTree,
        env: {
          DSH_HOME: this.config.dshHome,
          DSH_CLIENT_COMMIT_HASH: this.config.clientCommitHash,
        },
        logPath,
        timeoutMs,
      },
    )
    if (!result.ok) {
      throw new Error(`dump-config failed (exit=${result.exitCode}): ${result.error}\n--- log tail ---\n${logTail(logPath)}`)
    }
    return { text: result.text, logPath }
  }

  /**
   * Mount probe rows through the public cordis.patch.yml seam (write the
   * profile's own patch layer; composition order bundles -> this file ->
   * --patch overlays). `rows`: [{ id, name }] where name is a file URL of a
   * probe plugin module.
   */
  mountRows(rows, header) {
    mkdirSync(this.profileDir, { recursive: true })
    const lines = [
      ...(header ?? []).map((line) => `# ${line}`),
      '- insert:',
      ...rows.flatMap((row) => [
        `    - id: ${row.id}`,
        `      name: ${JSON.stringify(row.name)}`,
      ]),
      '',
    ]
    writeFileSync(this.patchFile, lines.join('\n'))
    return this.patchFile
  }

  /** The baseline "revert" state of the patch layer (per baseline comment). */
  resetPatchLayer(header) {
    mkdirSync(this.profileDir, { recursive: true })
    writeFileSync(this.patchFile, [...(header ?? []).map((line) => `# ${line}`), '[]', ''].join('\n'))
    return this.patchFile
  }

  /** True when the composed tree (dump-config) contains the row's id+URL. */
  static rowInDump(dumpText, row) {
    return dumpText.includes(`id: ${row.id}`) && dumpText.includes(row.name)
  }
}

/**
 * Ensure the dedicated DSH_HOME has a web profile (the host self-initializes
 * it on first use — TEST_METHODS evidence §3). If missing, run one throwaway
 * boot+stop. Returns { initialized, created }.
 */
export async function ensureProfile({ instance, log, timeoutMs = 90_000 }) {
  if (instance.profileInitialized()) return { initialized: true, created: false }
  log('profile not initialized yet — running a throwaway boot to let the host create it')
  const { url } = await instance.start({ timeoutMs })
  log(`throwaway boot OK: ${url}`)
  const { portFree } = await instance.stop()
  if (!portFree) throw new Error('port did not free after throwaway boot')
  if (!instance.profileInitialized()) throw new Error('host did not initialize the web profile')
  return { initialized: true, created: true }
}

/**
 * Ensure the probe plugin's bare upstream imports resolve from its file
 * location: a `node_modules/<scope>/<pkg>` junction (Windows) or directory
 * symlink (POSIX) from the harness's probes directory into the pinned tree.
 * Idempotent; the link is gitignored runtime plumbing, never committed.
 *
 * @param {object} options
 * @param {string} options.probesDir - the probes/ directory that owns node_modules
 * @param {Array<{name: string, dir: string}>} options.packages - upstream packages to link (name + absolute package dir)
 * @param {(msg: string) => void} options.log
 */
export function ensureProbeResolution({ probesDir, packages, log }) {
  const linkRoot = join(probesDir, 'node_modules')
  mkdirSync(linkRoot, { recursive: true })
  for (const pkg of packages) {
    const scope = pkg.name.startsWith('@') ? pkg.name.slice(0, pkg.name.indexOf('/')) : null
    const bare = pkg.name.startsWith('@') ? pkg.name.slice(pkg.name.indexOf('/') + 1) : pkg.name
    const link = scope === null ? join(linkRoot, bare) : join(linkRoot, scope, bare)
    if (scope !== null) mkdirSync(join(linkRoot, scope), { recursive: true })
    if (!statSyncSafe(pkg.dir)) throw new Error(`probe resolution target missing: ${pkg.dir}`)
    let existing
    try {
      existing = lstatSync(link)
    } catch {
      existing = undefined
    }
    if (existing !== undefined) {
      const isLink =
        existing.isSymbolicLink() || (process.platform === 'win32' && existing.isDirectory() && readlinkSafe(link) !== null)
      if (isLink) continue
      rmSync(link, { recursive: true, force: true })
    }
    symlinkSync(pkg.dir, link, process.platform === 'win32' ? 'junction' : 'dir')
    log(`probe resolution link ready: ${link} -> ${pkg.dir}`)
  }
  return linkRoot
}

function statSyncSafe(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function readLinkSafe(path) {
  try {
    return readlinkSync(path)
  } catch {
    return null
  }
}
