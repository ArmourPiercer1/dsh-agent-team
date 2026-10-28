# Routing Liveness Probe — og-flash

- Repo: /srv/workspace/dsh-plugins/dsh-agent-team
- HEAD (short): c2b03fc34 (branch master)

## VERDICT_SEVERITY definition

Defined in: tests/world-factory/lib/run-record.mjs (lines 28–37)

```js
/** Higher = worse. `overall` takes the max severity over selected cases. */
export const VERDICT_SEVERITY = Object.freeze({
  PASS: 0,
  SKIP: 1,
  REFUSED: 2,
  ENV_BLOCK: 3,
  TIMEOUT: 4,
  START_FAILED: 5,
  FAIL: 6,
})
```

Full value: Object.freeze({ PASS: 0, SKIP: 1, REFUSED: 2, ENV_BLOCK: 3, TIMEOUT: 4, START_FAILED: 5, FAIL: 6 })

Related (same file, line 26): VERDICTS = ['PASS','FAIL','REFUSED','ENV_BLOCK','SKIP','TIMEOUT','START_FAILED']

TOOL_ROUND_OK
