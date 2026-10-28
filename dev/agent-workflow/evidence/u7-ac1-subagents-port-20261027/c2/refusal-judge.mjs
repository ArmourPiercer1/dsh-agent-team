/** Pure C1 judge for refusal calls: refusal asks are always zero, independent of positives. */
export function judgeRefusal({ results, asks, needles, requestIdPattern = /requestId[=: ]+([A-Za-z0-9_-]+)/g }) {
  const requestIds = new Set(results.flatMap((r) => [...String(r.text ?? '').matchAll(requestIdPattern)].map((m) => m[1])))
  const asksForCase = asks.filter((ask) => requestIds.has(ask.requestId))
  const ok = results.length === 1 && results[0].isError === true
    && needles.every((needle) => String(results[0].text ?? '').includes(needle))
    && asksForCase.length === 0
  return { ok, requestIds, asksForCase }
}
