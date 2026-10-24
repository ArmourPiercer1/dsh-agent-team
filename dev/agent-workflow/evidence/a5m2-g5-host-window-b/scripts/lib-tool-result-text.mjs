// A5M2 G5 — the Messages tool_result TEXT law (root protocol card, 2026-10-24).
// Host639 serialize.ts pins the wire shape: tool results ride as
//   content: [{ type: 'text', text: <result-as-text> }]  (+ is_error when set)
// — input() at :64-65 maps text blocks, the tool_result block at :121 wraps
// them. The CONTAINER array is NEVER the business JSON: harvesting must extract
// the TEXT BLOCKS verbatim before any business parse. JSON.stringify of the
// whole array escapes the inner quotes (`\"goal\":null`) and silently blinds
// every criterion — a SUCCESSFUL get_goal reads as red and a lossless
// status:"rejected" hides. This module is the single law shared by the runner
// and the offline microtest; is_error and the same-callId pairing stay owned by
// the caller, and the untouched foreign-block residue is retained as evidence.

export function toolResultText(content) {
  if (typeof content === 'string') return { text: content, container: null }
  if (Array.isArray(content)) {
    const texts = content
      .filter((p) => p?.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
    const foreign = content.filter((p) => p?.type !== 'text')
    return { text: texts.join('\n'), container: foreign.length > 0 ? JSON.stringify(foreign).slice(0, 800) : null }
  }
  // honest fallback: anything the serialize law does not describe is recorded
  // verbatim-stringified but can never satisfy a business parse (parseBusiness
  // of a non-JSON container is null) — container-blindness fails LOUD, not green.
  return { text: JSON.stringify(content ?? ''), container: null }
}

export const parseBusiness = (text) => {
  try {
    const v = JSON.parse(String(text ?? ''))
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : null
  } catch {
    return null
  }
}

// LOSSLESS-REJECTED: business object status === 'rejected' (parsed from the
// EXTRACTED text, never the container); regex only as a same-text fallback.
export const isLosslessRejected = (text) => {
  const b = parseBusiness(text)
  if (b !== null && b.status === 'rejected') return true
  return /"status"\s*:\s*"rejected"/.test(String(text ?? ''))
}

// POSITIVE-CONTROL serve: a business object carrying goal === null (the
// canonical goalValue(undefined) projection) — parsed, not substring-searched.
export const goalServedNull = (text) => {
  const b = parseBusiness(text)
  return b !== null && 'goal' in b && b.goal === null
}
