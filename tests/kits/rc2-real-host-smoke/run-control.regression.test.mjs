import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { setTimeout as delay } from 'node:timers/promises'
import test from 'node:test'
import { createRunControl } from './run-control.mjs'

const alive = (pid) => {
  try { process.kill(pid, 0); return true } catch (error) {
    if (error.code === 'ESRCH') return false
    throw error
  }
}
const exited = (child) => child.exitCode !== null || child.signalCode !== null
async function cleanup(child) {
  if (!exited(child) && child.pid !== undefined) {
    const exit = once(child, 'exit')
    child.kill('SIGKILL')
    await exit
  }
}
async function sleeper(stubborn = false) {
  const child = spawn(process.execPath, ['-e', `${stubborn ? "process.on('SIGTERM',()=>{});" : ''}process.send('ready');setInterval(()=>{},1000)`], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
  await once(child, 'message')
  return child
}

test('owned stop observes exit, escalates past SIGTERM and preserves the decoy', async () => {
  const child = await sleeper(true)
  const decoy = await sleeper()
  const rc = createRunControl({})
  try {
    rc.bindChild(child)
    assert.equal(typeof rc.stopChild, 'function', 'owner cleanup must be awaitable')
    const pending = rc.stopChild({ graceMs: 20, killWaitMs: 1000 })
    assert.equal(rc.stopChild(), pending, 'cleanup is idempotent')
    const result = await pending
    assert.equal(result.exited, true)
    assert.equal(result.escalated, true)
    assert.equal(exited(child), true)
    assert.equal(alive(child.pid), false)
    assert.equal(alive(decoy.pid), true)
    assert.equal(rc.state.watchdog, null)
  } finally {
    rc.dispose()
    await cleanup(child)
    await cleanup(decoy)
  }
})

test('bind lifetime override fires without requests or waits', async () => {
  const child = await sleeper()
  const rc = createRunControl({ limits: { childLifetimeMs: 10_000 } })
  try {
    rc.bindChild(child, { lifetimeMs: 20, watchdogIntervalMs: 5 })
    await delay(120)
    assert.equal(rc.signal.aborted, true, 'the per-bind deadline overrides the default')
    assert.equal(rc.state.watchdogFired, true)
    await rc.stopChild()
    assert.equal(alive(child.pid), false)
  } finally { rc.dispose(); await cleanup(child) }
})

test('a child bound after cancellation is stopped immediately', async () => {
  const child = await sleeper(true)
  const rc = createRunControl({})
  try {
    rc.requestAbort('already cancelled')
    rc.bindChild(child)
    await delay(100)
    assert.equal(exited(child), true)
    await rc.stopChild()
    assert.equal(alive(child.pid), false)
  } finally { rc.dispose(); await cleanup(child) }
})

test('abort does not confuse a sent SIGTERM with child exit', async () => {
  const child = await sleeper(true)
  const rc = createRunControl({})
  try {
    rc.bindChild(child)
    child.kill('SIGTERM')
    assert.equal(child.killed, true)
    rc.requestAbort('must still kill the running child')
    await delay(100)
    assert.equal(exited(child), true)
    await rc.stopChild()
  } finally { rc.dispose(); await cleanup(child) }
})

test('a failed spawn leaves no watchdog or unresolved cleanup', async () => {
  const rc = createRunControl({})
  const child = spawn('/no-such-rc2-regression-executable', [], { stdio: 'ignore' })
  const error = new Promise((resolve) => child.once('error', resolve))
  rc.bindChild(child, { lifetimeMs: 10_000 })
  await error
  try {
    assert.equal(rc.state.watchdog, null, 'failed spawn has no live lifetime to watch')
    const result = await rc.stopChild({ graceMs: 10, killWaitMs: 100 })
    assert.equal(result.exited, true)
  } finally { rc.dispose() }
})

test('owned POSIX group removes a grandchild after its leader exits, preserving decoy', { skip: process.platform !== 'linux' }, () => {
  // A Linux subreaper keeps synthetic orphan reaping independent of the
  // container's PID 1. It owns only this test's descendants, never any host.
  const driver = `
    import assert from 'node:assert/strict';
    import {spawn} from 'node:child_process';
    import {once} from 'node:events';
    import {createRunControl} from ${JSON.stringify(new URL('./run-control.mjs', import.meta.url).href)};
    const live=p=>{try{process.kill(p,0);return true}catch{return false}};
    const leader=spawn(process.execPath,['-e',\"const {spawn}=require('node:child_process');const c=spawn(process.execPath,['-e',\\\"process.on('SIGTERM',()=>{});process.send('ready');setInterval(()=>{},1000)\\\"],{stdio:['ignore','ignore','ignore','ipc']});c.once('message',()=>process.send(c.pid));setInterval(()=>{},1000)\"],{detached:true,stdio:['ignore','ignore','ignore','ipc']});
    const [grandchild]=await once(leader,'message');
    const decoy=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
    const rc=createRunControl({});
    try {
      rc.bindChild(leader,{processGroup:true});
      assert.equal(typeof rc.stopChild,'function');
      const result=await rc.stopChild({graceMs:30,killWaitMs:1000});
      assert.equal(result.exited,true);assert.equal(live(leader.pid),false);
      assert.equal(live(grandchild),false);assert.equal(live(decoy.pid),true);
      console.log('group-cleaned-decoy-alive');
    } finally {
      rc.dispose();try{process.kill(-leader.pid,'SIGKILL')}catch{}
      const exit=once(decoy,'exit');decoy.kill('SIGKILL');await exit;
    }
  `
  const reaper = `
import ctypes,subprocess,os,sys,time
ctypes.CDLL(None).prctl(36,1,0,0,0)
p=subprocess.Popen([sys.argv[1],'--input-type=module','-e',sys.argv[2]],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
while p.poll() is None:
 try:
  # poll() owns the driver's status; waitid with WNOWAIT identifies only
  # reparented grandchildren without accidentally consuming the driver.
  info=os.waitid(os.P_ALL,0,os.WEXITED|os.WNOHANG|os.WNOWAIT)
  if info is not None and info.si_pid != p.pid: os.waitpid(info.si_pid,0)
 except ChildProcessError: pass
 time.sleep(.005)
out,err=p.communicate();sys.stdout.write(out);sys.stderr.write(err)
while True:
 try: os.waitpid(-1,0)
 except ChildProcessError: break
sys.exit(p.returncode)
`
  const output = execFileSync('python3', ['-c', reaper, process.execPath, driver], { encoding: 'utf8', timeout: 5000 })
  assert.match(output, /group-cleaned-decoy-alive/)
})
