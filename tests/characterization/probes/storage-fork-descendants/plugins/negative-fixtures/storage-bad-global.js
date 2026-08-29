/**
 * P2-T5 negative fixture — nullable domain global (seam: storage).
 *
 * defineDomain rejects, at spec construction, a global schema that accepts
 * null: null is the storage medium's "never written" sentinel, so a nullable
 * global could not round-trip through a reopen (a stored null would silently
 * revert to `initial` on the next open). This module performs that invalid
 * construction at top level and MUST therefore fail to import; the probe
 * group imports it directly and records the rejection (the message must
 * name the null guard). It is never mounted into a booted instance.
 */
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import * as z from 'zod'

export const spec = defineDomain({
  name: 'p2t5_bad_global',
  version: 1,
  global: {
    schema: z.union([z.object({ note: z.string() }), z.null()]),
    initial: null,
  },
  tables: {},
})
