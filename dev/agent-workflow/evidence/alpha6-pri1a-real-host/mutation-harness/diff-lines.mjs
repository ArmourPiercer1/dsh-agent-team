/**
 * The minimum line comparison `law.mjs verify` needs: the common prefix and the common suffix of the two
 * files, and therefore the exact span in the middle that differs, with absolute line numbers. No library.
 *
 * This is deliberately strict rather than clever. It never tries to align a large middle section: if more
 * than one line is left between the shared prefix and the shared suffix, `verify` reports `other` and the
 * run fails. That is the property the METHOD LAW wants — a mutation that also moved any other line, anywhere
 * else in the file, cannot pass, because any other moved line lands in the middle span.
 */
export function diffLines(beforeText, afterText) {
  const before = beforeText.split('\n')
  const after = afterText.split('\n')
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1
  let suffix = 0
  while (
    suffix < before.length - prefix
    && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1
  const midBefore = before.slice(prefix, before.length - suffix)
  const midAfter = after.slice(prefix, after.length - suffix)
  const oneForOne = midBefore.length === 1 && midAfter.length === 1
  const insertion = midBefore.length === 0 && midAfter.length === 1
  return {
    removed: midBefore,
    added: midAfter,
    removedAt: midBefore.map((_l, i) => prefix + i + 1),
    addedAt: midAfter.map((_l, i) => prefix + i + 1),
    other: !(oneForOne || insertion),
  }
}
