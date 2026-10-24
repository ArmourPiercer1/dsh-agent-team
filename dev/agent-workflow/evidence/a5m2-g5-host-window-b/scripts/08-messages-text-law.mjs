// A5M2 G5 — OFFLINE microtest of the Messages tool_result TEXT law (root
// protocol card 2026-10-24). No Host, no spawn: the shapes below are the ones
// Host639 serialize.ts puts on the wire (input() :64-65 maps text blocks to
// {type:'text',text}; the tool_result block :121 wraps them and carries
// is_error when set). Proves: (1) text blocks are extracted VERBATIM and the
// business facts PARSED (goal===null; status:'rejected'); (2) the OLD
// whole-container JSON.stringify approach MISSES both — the misjudgement the
// card names (a successful get_goal would read red); (3) is_error and the
// foreign-block residue survive. Run: node 08-messages-text-law.mjs
import { toolResultText, parseBusiness, isLosslessRejected, goalServedNull } from './lib-tool-result-text.mjs'

const results = []
const check = (id, name, ok, detail = '') => {
  results.push({ id, name, ok, detail })
  console.log(`${ok ? 'OK ' : 'FAIL'} ${id} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exit(1) // first error stops
}

// ── ALLOW leg: success serve, wire shape exactly serialize.ts :121 ──
const allowContent = [{ type: 'text', text: JSON.stringify({ goal: null }) }]
const allow = toolResultText(allowContent)
check('T1', 'extracted text is the verbatim business JSON, not the container', allow.text === '{"goal":null}', `text=${allow.text}`)
check('T2', 'goalServedNull parses goal === null', goalServedNull(allow.text) === true)
check('T3', 'the naive container-stringify BLINDS the old check (root finding pinned)',
  JSON.stringify(allowContent).includes('"goal":null') === false && JSON.stringify(allowContent).includes('\\"goal\\":null') === true,
  JSON.stringify(allowContent))

// ── DENY leg: refusal text as an error result (is_error true) ──
const denyContent = [{ type: 'text', text: 'APPROVAL_DENIED — durable Control request pa-x1 answered deny' }]
const deny = toolResultText(denyContent)
check('T4', 'deny text extracted, no business JSON (no served projection)', goalServedNull(deny.text) === false && parseBusiness(deny.text) === null)
check('T5', 'refusal face exactness works on the extracted text', deny.text.includes('APPROVAL_DENIED'))

// ── REJECTED leg: lossless status:"rejected" must be caught ──
const rejectedContent = [{ type: 'text', text: JSON.stringify({ status: 'rejected', reason: 'some-refusal' }) }]
const rej = toolResultText(rejectedContent)
check('T6', 'isLosslessRejected catches the PARSED business status', isLosslessRejected(rej.text) === true)
check('T7', 'the naive container-stringify would MISS status:"rejected" too (root finding pinned)',
  /"status"\s*:\s*"rejected"/.test(JSON.stringify(rejectedContent)) === false)
check('T8', 'a plain success text is NOT rejected', isLosslessRejected(allow.text) === false && isLosslessRejected('some prose') === false)

// ── evidence retention: non-text blocks never vanish ──
const mixed = [{ type: 'image', source: { x: 1 } }, { type: 'text', text: '{"goal":null}' }]
const mix = toolResultText(mixed)
check('T9', 'text blocks join verbatim; foreign residue retained as rawContainer evidence',
  mix.text === '{"goal":null}' && typeof mix.container === 'string' && mix.container.includes('"image"'), mix.container)

console.log(`MICROTEST OK (${results.length} checks) — Messages text law holds offline; no Host was involved`)
