#!/usr/bin/env python3
# Throwaway (lane C-testkit §7.4 group 3): migrate every BASELINE-LISTED
# document site of the twelve simple kits + (with --pr) the two pr-kits'
# live docs from v1/v2 to v3, adding the two envelopes v3 requires.
# Site list = the captured baseline scan output (no guessing). The V1
# historical anchor block (const V1_ANCHOR_SOURCE = [ ... ].join) is
# PROTECTED byte-for-byte. Ledger-object lines (pr-e/pr-f) are handled
# only with --ledger (group 4 step), never as doc sites.
import re
import sys

SITES = {
  'tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs': [506, 628],
  'tests/kits/exec-contract-live-smoke/blueprint.mjs': [168, 194],
  'tests/kits/f15-mcp-live-loss-smoke/f15-mcp-live-loss-smoke.mjs': [628, 701],
  'tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs': [475, 510],
  'tests/kits/model-preference-routing-smoke/model-preference-routing-smoke.mjs': [337, 359, 417],
  'tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs': [688, 748],
  'tests/kits/pr-c-mcp-isolation-smoke/pr-c-mcp-isolation-smoke.mjs': [569, 622, 661],
  'tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs': [1158, 1292],
  'tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs': [603, 643],
  'tests/kits/send-message-liveness-smoke/send-message-liveness-smoke.mjs': [480, 601],
  'tests/kits/team-view-sync-complete-e2e/team-view-sync-complete-e2e.mjs': [217],
  'tests/kits/work-completion-wakeup-smoke/work-completion-wakeup-smoke.mjs': [489, 604],
  'tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs': [1155, 1322, 1409, 1496],
  'tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs': [1175, 1352, 1446, 1490, 1577, 1664],
}
LEDGER = {
  'tests/kits/pr-e-requirement-recovery-smoke/pr-e-requirement-recovery-smoke.mjs': [795, 810],
  'tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs': [787, 802],
}
do_pr = '--pr' in sys.argv
do_ledger = '--ledger' in sys.argv

ARRAY = re.compile(r"^(\s*)'schemaVersion: ([12])',$")
TEMPLATE = re.compile(r"^schemaVersion: ([12])\s*$")
PS = re.compile(r"^(\s*)('?)policyStates")
LED = re.compile(r"^(\s*)schemaVersion: 2,$")

def anchor_block(lines):
    start = None
    for i, l in enumerate(lines):
        if l.startswith('const V1_ANCHOR_SOURCE = ['):
            start = i
            break
    if start is None:
        return None
    for j in range(start, len(lines)):
        if "].join('\\n')" in lines[j]:
            return (start, j)
    raise SystemExit('unterminated anchor block')

for path, sites in SITES.items():
    if not do_pr and path in LEDGER:
        continue
    lines = open(path).read().split('\n')
    prot = anchor_block(lines)
    delta = 0
    log = []
    for s in sorted(sites):
        i = s - 1 + delta
        if prot and prot[0] <= i <= prot[1]:
            raise SystemExit(f'{path}:{s} unexpectedly inside the protected V1 anchor block')
        line = lines[i]
        m = ARRAY.match(line)
        t = TEMPLATE.match(line)
        if m:
            lines[i] = f"{m.group(1)}'schemaVersion: 3',"
            # forward to this doc's policyStates line
            j = i + 1
            while j < len(lines) and not PS.match(lines[j]):
                if ARRAY.match(lines[j]) or TEMPLATE.match(lines[j]):
                    raise SystemExit(f'{path}:{s}: hit another schemaVersion before policyStates')
                j += 1
            pm = PS.match(lines[j])
            if not pm:
                raise SystemExit(f'{path}:{s}: no policyStates forward')
            ind, q = pm.group(1), pm.group(2)
            if q != "'":
                raise SystemExit(f'{path}:{s}: policyStates not in array form')
            block = [f"{ind}'permissionMutationEnvelope:',", f"{ind}'  rules: []',", f"{ind}'teamHardEnvelope:',", f"{ind}'  rules: []',"]
            lines[j:j] = block
            delta += 4
            log.append(f'L{s}: v{m.group(2)}->v3 + envelopes @policyStates L{j+1}')
        elif t:
            lines[i] = 'schemaVersion: 3'
            j = i + 1
            while j < len(lines) and not PS.match(lines[j]):
                if ARRAY.match(lines[j]) or TEMPLATE.match(lines[j]):
                    raise SystemExit(f'{path}:{s}: hit another schemaVersion before policyStates')
                j += 1
            if not PS.match(lines[j]):
                raise SystemExit(f'{path}:{s}: no policyStates forward')
            lines[j:j] = ['permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []']
            delta += 4
            log.append(f'L{s}: v{t.group(1)}->v3 + envelopes @policyStates L{j+1}')
        else:
            raise SystemExit(f'{path}:{s}: site line not array/template doc form: {line[:60]!r}')
    if do_ledger and path in LEDGER:
        for s in sorted(LEDGER[path]):
            i = s - 1 + delta
            lm = LED.match(lines[i])
            if not lm:
                raise SystemExit(f'{path}:{s}: ledger site mismatch: {lines[i][:50]!r}')
            lines[i] = f'{lm.group(1)}schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,'
            log.append(f'L{s}: ledger literal 2 -> TEAM_DOMAIN_SCHEMA_VERSION')
        if 'TEAM_DOMAIN_SCHEMA_VERSION' not in path:
            # add the import next to the other dist storage imports
            for k, l in enumerate(lines):
                if l.startswith("import {") and 'storage/schema/stores.js' in l:
                    break
            else:
                # place after the last import line
                last = max(k for k, l in enumerate(lines) if l.startswith('import '))
                lines.insert(last + 1, "import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../../packages/runtime/dist/packages/storage/schema/stores.js'")
    open(path, 'w').write('\n'.join(lines))
    print(f'{path}: ' + ' | '.join(log))
