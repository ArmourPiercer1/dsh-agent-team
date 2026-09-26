/**
 * diag-hook.mjs — runtime OBSERVATION hook (no source modification).
 * Loaded via NODE_OPTIONS='--import <this file>' into the test host.
 *
 * Logs (all prefixed [diag-hook]):
 *  - every net.Socket 'error' / 'close' event (code/message/stack)
 *  - every net.Socket destroy()/end() call with call stack
 *  - every ws WebSocket terminate()/close() call with the full call stack,
 *    so the exact terminate()/close() call site is captured.
 *
 * Socket tagging: each socket gets [diag-hook]#N + localPort/remotePort at
 * first touch so events can be correlated across the pair.
 */
import net from 'node:net'
import { createRequire } from 'node:module'
import { join } from 'node:path'

const TESTUSE = '/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
const T = () => (process.uptime() * 1000).toFixed(0).padStart(9, ' ')
const log = (line) => { try { console.error(`[diag-hook t=${T()}ms] ` + line) } catch {} }

let nextId = 0
const tag = (socket) => {
  let t = socket.__diagTag
  if (t === undefined) {
    t = `S${++nextId}`
    socket.__diagTag = t
  }
  const lp = socket.localPort ?? '?'
  const rp = socket.remotePort ?? '?'
  return `${t}(l${lp}->r${rp})`
}

const stack = () => String(new Error('stack').stack).split('\n').slice(2, 10).join('\n')

const origEmit = net.Socket.prototype.emit
net.Socket.prototype.emit = function emit(ev, ...args) {
  if (ev === 'error') {
    const e = args[0]
    log(`net ERROR ${tag(this)} code=${e?.code} errno=${e?.errno} sys=${e?.syscall} msg=${String(e?.message).slice(0, 120)}`)
    log(`net ERROR ${tag(this)} source-stack:\n${stack()}`)
  } else if (ev === 'close') {
    log(`net CLOSE ${tag(this)} hadError=${this.__hadError ?? false}`)
  } else if (ev === 'end') {
    log(`net END(peer FIN) ${tag(this)}`)
  } else if (ev === 'drain') {
    /* noisy; skip */
  }
  if (ev === 'error') this.__hadError = true
  return origEmit.call(this, ev, ...args)
}

const origDestroy = net.Socket.prototype.destroy
net.Socket.prototype.destroy = function destroy(err) {
  if (!this.__destroyLogged) {
    this.__destroyLogged = true
    log(`net DESTROY ${tag(this)} hadError=${this.__hadError ?? false} err=${err ? String(err.message ?? err).slice(0, 80) : 'none'}\n${stack()}`)
  }
  return origDestroy.call(this, err)
}

const origEnd = net.Socket.prototype.end
net.Socket.prototype.end = function end(...a) {
  log(`net END(call) ${tag(this)}\n${stack()}`)
  return origEnd.apply(this, a)
}

try {
  const requireFromCli = createRequire(join(TESTUSE, 'apps', 'cli', 'package.json'))
  const wsMod = requireFromCli('ws')
  const WS = wsMod.WebSocket ?? wsMod
  for (const method of ['terminate', 'close']) {
    const orig = WS.prototype[method]
    WS.prototype[method] = function patched(...a) {
      log(`ws ${method}() code=${a[0] ?? '-'} reason=${JSON.stringify(a[1] ?? '').slice(0, 80)} readyState=${this.readyState} sock=${this._socket ? tag(this._socket) : '?'}\n${stack()}`)
      return orig.apply(this, a)
    }
  }
  {
    const origPing = WS.prototype.ping
    WS.prototype.ping = function patchedPing(...a) {
      log(`ws PING() sock=${this._socket ? tag(this._socket) : '?'} readyState=${this.readyState}`)
      return origPing.apply(this, a)
    }
  }
  {
    const origSend = WS.prototype.send
    WS.prototype.send = function patchedSend(data, ...rest) {
      const len = typeof data === 'string' ? data.length : data?.length ?? -1
      const head = typeof data === 'string' ? data.slice(0, 70).replace(/\n/g, ' ') : '<binary>'
      log(`ws SEND() len=${len} sock=${this._socket ? tag(this._socket) : '?'} head=${head}`)
      return origSend.call(this, data, ...rest)
    }
  }
  log('ws prototype patched (terminate/close/ping/send)')
} catch (e) {
  log(`ws patch skipped: ${String(e?.message ?? e).slice(0, 160)}`)
}
