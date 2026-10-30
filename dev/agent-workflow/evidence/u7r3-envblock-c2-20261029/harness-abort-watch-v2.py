#!/usr/bin/env python3
"""harness-abort-watch-v2.py — start-3 control (attempt 2 at grading the NOT_REACHED class live).

RCA of the seq-2 miss (harness-abort-control-run2.log): v1 killed on
`/__u7fweb/controls?session=CREATE_ROOT` answering {ok:true, requests:[]}, but that
face answers ok:true EVEN BEFORE team.create lands, so the kill raced the in-flight
team.create response and the suite failRest'd all arms FAIL.

v2 discriminator (registered in host-starts.jsonl seq 3): the SECOND
`placement-feed rows=` line in the runner-owned instance log of the NEW world
(green run 1 saw exactly two: boot census + team placement), THEN a 1500 ms settle
so the team.create HTTP response lands (no in-flight truncation), THEN a last-moment
guard: the controls face must still show ZERO ask rows. All three hold -> ONE
SIGKILL of the ONE pid proven to own the boot port AND carry
DSH_HOME=<workspace>/tests/homes/<new world>. Any miss/timeout/guard-hit -> NO kill.
"""
import json
import os
import re
import subprocess
import time
import urllib.request

EV = os.path.join('dev', 'agent-workflow', 'evidence', 'u7r3-envblock-c2-20261029')
RUN_WORLDS = {'u5u7r3eb-20261029T15-32-10Z', 'u5u7r3eb-20261029T15-45-02Z'}
HOME_ROOT = os.path.abspath(os.path.join('tests', 'homes'))
LOG = open(os.path.join(EV, 'harness-abort-control-run3.log'), 'w')


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
        time.sleep(0.1)
    raise SystemExit(L('ABORT-CONTROL v2: deadline %ds waiting for %s -> NO kill' % (seconds, what)))


def main():
    L('v2 start; prior worlds excluded: %s' % sorted(RUN_WORLDS))

    def new_world():
        logs = os.path.join(EV, 'logs')
        if os.path.isdir(logs):
            for d in sorted(os.listdir(logs)):
                if d.startswith('u5u7r3eb-') and d not in RUN_WORLDS:
                    return d
        return None

    world = deadline(240, new_world, 'new world directory')
    create_root = 'session-u7fweb-team-%s' % world.lower()
    home = os.path.join(HOME_ROOT, world)
    L('world=%s createRoot=%s' % (world, create_root))

    def boot_seen():
        d = os.path.join(EV, 'logs', world)
        try:
            fs = [x for x in os.listdir(d) if x.startswith('instance-port')]
        except FileNotFoundError:
            return None
        if not fs:
            return None
        port = int(re.search(r'instance-port(\d+)\.log', fs[0]).group(1))
        try:
            text = open(os.path.join(d, fs[0])).read()
        except OSError:
            return None
        return (port, text) if 'dsh web:' in text else None

    port, _ = deadline(180, boot_seen, 'boot line on a test-band port')
    L('host port=%d' % port)

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

    pid = deadline(60, owned_pid, 'pid owning port AND DSH_HOME=%s' % home)
    L('KILL TARGET (lane-owned): pid=%d port=%d world=%s' % (pid, port, world))

    inst_log = os.path.join(EV, 'logs', world)

    def placement2():
        try:
            d = os.path.join(inst_log, '')
            fs = [x for x in os.listdir(inst_log) if x.startswith('instance-port')]
            text = open(os.path.join(inst_log, fs[0])).read()
        except OSError:
            return None
        return text if len(re.findall(r'placement-feed rows=', text)) >= 2 else None

    deadline(240, placement2, 'SECOND placement-feed line (team placement)')
    L('placement-feed #2 seen; settling 1500 ms so team.create response lands')
    time.sleep(1.5)

    c = get('http://127.0.0.1:%d/__u7fweb/controls?session=%s' % (port, create_root))
    asks = len(c.get('requests', [])) if c.get('ok') is True else None
    if asks is None:
        L('GUARD: controls face unreadable (%s) -> NO kill' % c)
        return
    if asks > 0:
        L('GUARD: %d ask row(s) already recorded -> window passed, NO kill (disclosure only)' % asks)
        return
    L('WINDOW: team placement landed, zero PA ask rows -> SIGKILL pid=%d (harness-abort; verdicts belong to the committed law)' % pid)
    os.kill(pid, 9)
    L('SIGKILL delivered')


if __name__ == '__main__':
    main()
