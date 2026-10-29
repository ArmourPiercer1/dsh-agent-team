#!/usr/bin/env python3
"""harness-abort-watch-v3.py — start-4 (FINAL, budget 4/4) control for grading NOT_REACHED live.

RCAs of the two misses (both registered in host-starts.jsonl, both disclosed):
  v1 — controls face answers {ok:true, requests:[]} even BEFORE team.create lands;
       the kill raced the in-flight create response -> failRest FAIL (run 2).
  v2 — trigger placement-feed #2 + 1500 ms settle; guard saw 2 ask rows already
       recorded (the mock chain records asks within ~1.5 s) -> CORRECT abstention
       (run 3 completed green untouched).

v3 polls the AUTHENTICATED ledger face itself (team.getLedgerPage on CREATE_ROOT,
the same public seam the suite's approver uses):
  * pre-create: the session is absent -> not-ok -> keep polling (never kill);
  * first ok page: create is committed; wait 300 ms (create response lands, no
    in-flight truncation), re-poll;
  * zero control-request-recorded rows -> SIGKILL the single DSH_HOME-verified
    owned pid. Any ask row / unreadable face -> NO kill.
"""
import json
import os
import re
import subprocess
import time
import urllib.request

EV = os.path.join('dev', 'agent-workflow', 'evidence', 'u7r3-envblock-c2-20261029')
RUN_WORLDS = {'u5u7r3eb-20261029T15-32-10Z', 'u5u7r3eb-20261029T15-45-02Z', 'u5u7r3eb-20261029T15-47-53Z'}
HOME_ROOT = os.path.abspath(os.path.join('tests', 'homes'))
LOG = open(os.path.join(EV, 'harness-abort-control-run4.log'), 'w')


def L(msg):
    LOG.write('%s %s\n' % (time.strftime('%H:%M:%S.%f')[:-3], msg))
    LOG.flush()
    print(msg, flush=True)


def deadline(seconds, fn, what):
    t0 = time.time()
    while time.time() - t0 < seconds:
        out = fn()
        if out is not None:
            return out
        time.sleep(0.1)
    raise SystemExit(L('deadline %ds waiting for %s -> NO kill' % (seconds, what)))


def main():
    L('v3 start; prior worlds excluded: %s' % sorted(RUN_WORLDS))

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

    def boot():
        d = os.path.join(EV, 'logs', world)
        try:
            fs = [x for x in os.listdir(d) if x.startswith('instance-port')]
        except FileNotFoundError:
            return None
        if not fs:
            return None
        try:
            text = open(os.path.join(d, fs[0])).read()
        except OSError:
            return None
        m = re.search(r'instance-port(\d+)\.log', fs[0])
        tok = re.search(r'token=([A-Za-z0-9_\-]+)', text)
        return (int(m.group(1)), tok.group(1)) if 'dsh web:' in text and tok else None

    port, token = deadline(180, boot, 'boot line + launch token')
    origin = 'http://127.0.0.1:%d' % port
    L('world=%s port=%d' % (world, port))

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

    pid = deadline(60, owned_pid, 'owned pid')
    L('KILL TARGET (lane-owned): pid=%d' % pid)

    # authenticate (303 + set-cookie), same seam as the suite
    cookie = None

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):  # noqa: ANN002, ANN003
            return None

    opener = urllib.request.build_opener(NoRedirect)
    t0 = time.time()
    while cookie is None and time.time() - t0 < 120:
        try:
            resp = opener.open('%s/?token=%s' % (origin, token), timeout=10)
            if resp.status == 303:
                sc = resp.headers.get('set-cookie')
                cookie = sc.split(';', 1)[0] if sc else None
        except urllib.error.HTTPError as e:
            if e.code == 303:
                sc = e.headers.get('set-cookie')
                cookie = sc.split(';', 1)[0] if sc else None
        except Exception:  # noqa: BLE001
            pass
        if cookie is None:
            time.sleep(0.2)
    if cookie is None:
        raise SystemExit(L('no cookie -> NO kill'))
    L('authenticated (cookie ok)')

    def ledger_page():
        body = json.dumps({
            'type': 'client-request', 'rpcId': 'watch-%d' % int(time.time() * 1000),
            'method': 'team.getLedgerPage',
            'payload': {'version': 1, 'params': {'teamSessionId': create_root, 'afterSequence': 0, 'limit': 500}},
        }).encode()
        req = urllib.request.Request('%s/team-remote/team.getLedgerPage' % origin, data=body,
                                     headers={'content-type': 'application/json', 'cookie': cookie}, method='POST')
        try:
            with urllib.request.urlopen(req, timeout=8) as r:
                j = json.loads(r.read().decode('utf8', 'replace'))
        except Exception as e:  # noqa: BLE001
            return {'err': str(e)[:80]}
        res = j.get('result') or {}
        if res.get('ok') is False:
            return {'err': 'not-ok'}
        v = res.get('value')
        data = v.get('data') if isinstance(v, dict) and 'data' in v else v
        entries = (data or {}).get('entries') or []
        asks = sum(1 for e in entries if e.get('factType') == 'control-request-recorded')
        return {'ok': True, 'entries': len(entries), 'asks': asks}

    first = deadline(180, lambda: (lambda p: p if p and p.get('ok') else None)(ledger_page()), 'first ok ledger page (create committed)')
    L('ledger page live: entries=%d asks=%d; settling 300ms' % (first['entries'], first['asks']))
    time.sleep(0.3)
    p = ledger_page()
    if not p or not p.get('ok'):
        L('guard: re-poll unreadable (%s) -> NO kill' % p)
        return
    if p['asks'] > 0:
        L('guard: %d ask row(s) at re-poll -> window passed, NO kill (disclosure only)' % p['asks'])
        return
    L('WINDOW: create committed, asks=0 (entries=%d) -> SIGKILL pid=%d' % (p['entries'], pid))
    os.kill(pid, 9)
    L('SIGKILL delivered; verdicts belong to the committed law')


if __name__ == '__main__':
    main()
