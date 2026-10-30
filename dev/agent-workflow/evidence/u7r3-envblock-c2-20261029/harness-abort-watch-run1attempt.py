#!/usr/bin/env python3
"""harness-abort-watch.py — start-2 control for the R-ENVBLOCK-1 live C2 (boot 2).

PURPOSE (disclosed harness perturbation, obligation (b)):
  NOT_REACHED is defined by tests/world-factory/lib/arm-verdict.mjs as a fact
  about THIS TEST HARNESS ("the drive never got to the asserted step"). A fully
  green real-Host chain (run 1) never produces one, so the class is graded live
  by honestly perturbing the HARNESS: an external watcher SIGKILLs the
  runner-owned Host child in the window between team.create-OK and the FIRST
  durable PA ask row. Nothing inside the product, the suite, or the law is
  touched; no environment signal is offered or forged. The committed law must
  then grade the unwitnessed arms NOT_REACHED (harness fact) — never ENV_BLOCK
  (no signal exists), never PASS. This mirrors the repo's established
  classification controls (u5 negatives 'interrupt-classified'/'timeout-
  classified', mutation-control RED logs).

KILL DISCIPLINE: exactly ONE pid, proven to be this lane's own Host process —
  (1) it owns the LISTEN socket on the port named by the new world's
      instance-port<NNNN>.log, AND
  (2) its /proc/<pid>/environ carries DSH_HOME=<this workspace>/tests/homes/<world>
      for the NEW world directory (not run 1's).
  Kill only ever fires on a positive window read (controls face ok:true with
  ZERO ask rows). Any miss/timeout => NO kill, the run completes untouched.
"""
import json
import os
import re
import subprocess
import sys
import time
import urllib.request

EV = os.path.join('dev', 'agent-workflow', 'evidence', 'u7r3-envblock-c2-20261029')
RUN1_WORLD = 'u5u7r3eb-20261029T15-32-10Z'
HOME_ROOT = os.path.abspath(os.path.join('tests', 'homes'))
LOG = open(os.path.join(EV, 'harness-abort-control.log'), 'w')


def L(msg):
    LOG.write('%s %s\n' % (time.strftime('%H:%M:%S'), msg))
    LOG.flush()
    print(msg, flush=True)


def get(url, timeout=5):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return json.loads(r.read().decode('utf8', 'replace'))
    except Exception as e:  # noqa: BLE001
        return {'err': str(e)[:120]}


def deadline(seconds, fn, what):
    t0 = time.time()
    while time.time() - t0 < seconds:
        out = fn()
        if out is not None:
            return out
        time.sleep(0.15)
    raise SystemExit(L('ABORT-CONTROL: deadline %ds elapsed waiting for %s; NO kill performed' % (seconds, what)))


def main():
    L('start; run1 world excluded: %s' % RUN1_WORLD)

    def new_world():
        logs = os.path.join(EV, 'logs')
        if os.path.isdir(logs):
            for d in sorted(os.listdir(logs)):
                if d.startswith('u5u7r3eb-') and d != RUN1_WORLD:
                    return d
        return None

    world = deadline(240, new_world, 'new world directory')
    rs = world.lower()
    create_root = 'session-u7fweb-team-%s' % rs
    home = os.path.join(HOME_ROOT, world)
    L('world=%s createRoot=%s home=%s' % (world, create_root, home))

    def port_ready():
        d = os.path.join(EV, 'logs', world)
        try:
            fs = [x for x in os.listdir(d) if x.startswith('instance-port')]
        except FileNotFoundError:
            return None
        if not fs:
            return None
        m = re.search(r'instance-port(\d+)\.log', fs[0])
        port = int(m.group(1))
        try:
            text = open(os.path.join(d, fs[0])).read()
        except OSError:
            return None
        return port if 'dsh web:' in text else None

    port = deadline(180, port_ready, 'host boot line on a test-band port')
    L('host port=%d (boot line seen)' % port)

    def owned_pid():
        out = subprocess.run(['ss', '-tlnp'], capture_output=True, text=True).stdout
        m = re.search(r':%d\s.*?pid=(\d+)' % port, out)
        if not m:
            return None
        pid = int(m.group(1))
        try:
            env = open('/proc/%d/environ' % pid, 'rb').read().decode('utf8', 'replace').split('\0')
        except OSError:
            return None
        return pid if ('DSH_HOME=%s' % home) in env else None

    pid = deadline(60, owned_pid, 'pid owning the port AND DSH_HOME=%s' % home)
    L('KILL TARGET (this lane\'s own process): pid=%d port=%d world=%s' % (pid, port, world))

    def window():
        c = get('http://127.0.0.1:%d/__u7fweb/controls?session=%s' % (port, create_root))
        if c.get('ok') is True:
            if len(c.get('requests', [])) == 0:
                return ('window', c)
            return ('missed', c)
        return None

    state, facts = deadline(180, window, 'team session to appear with zero ask rows')
    if state == 'window':
        L('WINDOW READ ok:true requests=[] (team.create landed, zero PA asks) -> SIGKILL pid=%d' % pid)
        os.kill(pid, 9)
        L('SIGKILL delivered. The drive is now a harness-abort; verdicts belong to the committed law.')
    else:
        L('WINDOW MISSED: ask rows already present at first ok:true read (%d); NO kill; disclosure only' % len(facts.get('requests', [])))


if __name__ == '__main__':
    main()
