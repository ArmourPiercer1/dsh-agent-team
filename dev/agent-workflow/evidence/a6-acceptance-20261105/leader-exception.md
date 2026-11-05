# Declared Leader exception (real Host)

Run: `a6-exception-r2`. Env:
`C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXCEPTION=1`.
Root: `session-c1-smoke-a6-2026-11-05T18-48-56`.

The A6 saved blueprint declares exactly one ordinary-tool Leader exception:

```yaml
leaderExceptions:
  - memberTemplateId: worker
    tool: { owner: dsh-agent-team, name: bash }
```

`owner` is the PA operation-tool provider id (`dsh-agent-team`), not the shell
coordinate seen on the legacy guard ask; the first attempt used `dsh.shell` and
correctly did **not** match the plane leg.

Observed on the real Host:

- 3 Leader control notifications, **0** `[team-review-wake` turns.
- Guard `parameter-permission` and plane PA `team-tool-execute` both routed to
  the Leader; the PA decision is
  `ctrl-1s00b320zywn7l0lz6gio0xt` / `case-0489qdp1tu4c0e0uj33p70iy`,
  decider `{kind:'instance', instanceId:'inst-leader', role:'leader'}`.
- Allow consumed; original command executed once; ledger ends 2/2/2/0.
- `A6-10 PASS`: the PA leg was decided by the Leader, never the Officer.

This proves the authored exception is honored on the plane leg and does not
create an Officer wake. It is not a production-policy change: only the kit's
declared blueprint differs.
