/**
 * ledger-cap.mjs — byte-capped JSONL appends for every ledger/log the factory
 * or the canary writes (FIX-T T3: ledgers must have a size cap, and be inside
 * the World's owned dir — path ownership is enforced by the factory; this
 * module enforces the cap).
 *
 * CONTRACT
 *   appendCappedLine(path, row, capBytes) never writes a byte that would push
 *   the file past `capBytes`. Rows are admitted while
 *   `size + row + LEDGER_NOTICE_RESERVE_BYTES <= capBytes` — the reservation
 *   makes the cap notice DETERMINISTIC: at the first drop the reserve is
 *   guaranteed free, so the ONE notice row (`leg:'LEDGER-CAP-REACHED'`)
 *   always fits, and later drops find the notice already logged. Rows are
 *   never rewritten or truncated (the Oracle reads history honestly: the
 *   ledger keeps its meaning as an evidence channel) while growth stays
 *   bounded. A pathological tool loop (crash victim, fuzzed runner, broken
 *   plugin) can therefore never fill the disk through a ledger — the exact
 *   residue class the factory is built to contain.
 *
 *   The file is written where it already lives (the World home; the factory
 *   refuses ledger paths outside the owned home). This module never creates
 *   paths — callers mkdir as before.
 *
 * USED BY: canary plugin + shadow-host row (inside the HOST process — the
 * factory copies this file beside them into the World profile dir), and
 * run-record.mjs (host-start budget ledger, runner side).
 */
import { appendFileSync, closeSync, fstatSync, openSync, readSync, statSync } from 'node:fs'

/** Default cap per ledger: 2 MiB — three orders above any honest run's rows. */
export const DEFAULT_LEDGER_CAP_BYTES = 2 * 1024 * 1024
/** Hard ceiling so a caller-supplied cap cannot silently mean "unbounded". */
export const MAX_LEDGER_CAP_BYTES = 16 * 1024 * 1024
/**
 * Bytes held back from data rows so the cap notice ALWAYS fits (the notice
 * itself is ~200 bytes; caps below ~512 bytes can never host it and simply
 * drop rows silently — no honest ledger is configured that small).
 */
export const LEDGER_NOTICE_RESERVE_BYTES = 256

const capNotice = (capBytes) => JSON.stringify({
  at: new Date().toISOString(),
  leg: 'LEDGER-CAP-REACHED',
  capBytes,
  note: 'further rows dropped: ledger is byte-capped (FIX-T T3) — a run cannot grow it without bound',
}) + '\n'

function noticeAlreadyLogged(path) {
  let fd
  try {
    fd = openSync(path, 'r')
    const size = fstatSync(fd).size
    const len = Math.min(size, 4096)
    const buf = Buffer.alloc(len)
    readSync(fd, buf, 0, len, Math.max(0, size - len))
    return buf.toString('utf8').includes('"LEDGER-CAP-REACHED"')
  } catch {
    return false
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch { /* best effort */ }
    }
  }
}

/**
 * @param {string} path target file (created by append if absent)
 * @param {object} row JSON-serialisable row
 * @param {number} [capBytes] hard byte cap for the WHOLE file (≤ MAX_LEDGER_CAP_BYTES)
 * @returns {{appended:boolean, capped:boolean, size:number}}
 */
export function appendCappedLine(path, row, capBytes = DEFAULT_LEDGER_CAP_BYTES) {
  const cap = Math.min(Number(capBytes) > 0 ? Number(capBytes) : DEFAULT_LEDGER_CAP_BYTES, MAX_LEDGER_CAP_BYTES)
  const line = JSON.stringify(row) + '\n'
  let size = 0
  try {
    size = statSync(path).size
  } catch {
    size = 0
  }
  if (size + Buffer.byteLength(line) > cap - LEDGER_NOTICE_RESERVE_BYTES) {
    if (!noticeAlreadyLogged(path)) {
      const notice = capNotice(cap)
      // The reservation guarantees this fits: size never exceeded
      // cap − LEDGER_NOTICE_RESERVE_BYTES, and the notice is smaller.
      if (size + Buffer.byteLength(notice) <= cap) {
        try {
          appendFileSync(path, notice)
          return { appended: false, capped: true, size: size + Buffer.byteLength(notice) }
        } catch {
          /* best-effort notice; the drop itself is the guarantee */
        }
      }
    }
    return { appended: false, capped: true, size }
  }
  try {
    appendFileSync(path, line)
    return { appended: true, capped: false, size: size + Buffer.byteLength(line) }
  } catch {
    return { appended: false, capped: false, size }
  }
}
