import json, re
W = 'tests/homes/mpr-2026-10-01T13-21-34/storages/team_domain.json'
d = json.load(open(W))
print('tables:', sorted((d.get('tables') or {}).keys()))
T1 = 'session-mpr-t1-mpr-2026-10-01T13-21-34'
mi = (d.get('tables') or {}).get('member_instances') or {}
rows = []
for k, v in mi.items():
    r = json.loads(v) if isinstance(v, str) else v
    if r.get('rootSessionId') == T1:
        rows.append((r.get('instanceId'), r.get('templateId'), r.get('label'), r.get('lifecycle')))
ids = {'wCreate': 'inst-1722vhu1h1z1', 'expertId': 'inst-1qazuqc1ylx9',
       'controlId': 'inst-0e84f9t1xgok', 'wDeleg': 'inst-0iin89s0dvix'}
print('\nT1 members in the durable store (%d):' % len(rows))
for r in sorted(rows, key=lambda x: str(x[1])):
    print('   instanceId=%s template=%-8s label=%-12s lifecycle=%s' % r)
print("\nid -> real template (the guard's contract):")
for name, i in ids.items():
    m = [r for r in rows if r[0] == i]
    print('  %-9s %s -> %-8s lifecycle=%s' % (name, i, m[0][1] if m else 'NOT FOUND', m[0][3] if m else '-'))
