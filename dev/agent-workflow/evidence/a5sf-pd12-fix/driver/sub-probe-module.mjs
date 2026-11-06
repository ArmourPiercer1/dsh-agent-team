/**
 * sub-probe-module.mjs — a FIXTURE native tool module that drives the Member's
 * confined `subprocess` face with a fixed, fixture-side argv table.
 *
 * WHY IT EXISTS. A model-facing `bash` tool cannot express the vectors this
 * measurement needs: its own executor decides the argv (the shipped
 * `bash-local` builds `['bash','-c',command]`, a bare PATH name), and the whole
 * question is what the FACE does with argv shapes. This module is mounted
 * through the SAME product seam a native tool module rides
 * (`realm.mountNativeToolModules` -> the Member's isolated scope), so its
 * `ctx.subprocess` IS the product-mounted confined face, and it registers ONE
 * tool (`sub_probe`) whose body selects a vector from a table that lives HERE,
 * not in the model's arguments.
 *
 * WHAT IS FIXTURE AND WHAT IS PRODUCT:
 *   - FIXTURE: the tool definition, the argv table and the declared shell
 *     invocation (all authored by this file);
 *   - PRODUCT: the `ctx.subprocess` service it resolves (the confined face the
 *     realm installed), the admission, the provider, the launcher and the OS.
 *
 * The tool returns a JSON string (the transcript keeps it verbatim): the
 * vector, its argv, the settlement shape and whether a child was requested.
 * It never decides a verdict — the driver judges from this plus the provider
 * counter, the guard-fact sink and an independent /proc observation.
 *
 * @module dev/agent-workflow/evidence/a5sf-pd12-fix/driver/sub-probe-module
 */
export const name = 'a5sf-sub-probe'
export const inject = ['tools', 'subprocess']

const MAX_BYTES = 1 << 18

/**
 * The fixture argv table. Every admitted vector is the face's declared shape
 * (`length === 3`, `-c`, non-empty body); every rejected vector is the same
 * class of violation the contract suite pins host-free.
 *
 * @param {object} config the row-supplied fixture paths
 * @returns {Record<string, {label: string, argv: string[], expect: 'admitted'|'rejected'}>}
 */
export function vectorTable(config) {
  const allowTag = config.allowTag
  const denyTag = config.denyTag
  const denyMarker = config.denyMarker
  const allowMarker = config.allowMarker
  return {
    // Q4 positive control for the deny lane's command SHAPE: printf + sleep,
    // no file write (so the deny lane's marker file cannot be aliased).
    face_control: {
      label: 'face-shaped /bin/bash -c (printf + marker write + sleep); the positive control',
      expect: 'admitted',
      // The marker WRITE is the independent witness: the confined child's argv
      // is not visible in /proc (the provider runs a launcher), so the OS fact
      // that a child really ran is the file it created. A different path from
      // `net_deny`'s marker, so the two witnesses can never alias.
      argv: ['/bin/bash', '-c', `printf '${allowTag}\\n'; touch '${allowMarker}'; sleep 1.5`],
    },
    // The deny lane's body. It WOULD write its marker if a child ever ran.
    net_deny: {
      label: 'the same printf+sleep shape plus a marker write, on the network=deny lane',
      expect: 'admitted-on-network-allow',
      argv: ['/bin/bash', '-c', `printf '${denyTag}\\n'; touch '${denyMarker}'; sleep 1.5`],
    },
    // The SHIPPED bash-local executor's own shape: a bare PATH name (PD-6).
    shipped_argv: {
      label: "the pinned bash-local shape ['bash','-c',body] — a bare PATH name",
      expect: 'rejected',
      argv: ['bash', '-c', "printf 'a5sf-sub-shipped\\n'"],
    },
    // The argv predicate itself: -c must be argv[1] and the body non-empty.
    argv_lc: {
      label: '-lc (flag before -c)',
      expect: 'rejected',
      argv: ['/bin/bash', '-lc', 'true'],
    },
    argv_empty_body: {
      label: 'whitespace-only body',
      expect: 'rejected',
      argv: ['/bin/bash', '-c', '   '],
    },
    argv_extra_operand: {
      label: 'extra positional operand after the body',
      expect: 'rejected',
      argv: ['/bin/bash', '-c', 'true', 'extra'],
    },
  }
}

function textOfCollected(handle) {
  try {
    return String(handle?.collected?.stdout?.readFrom(0)?.text ?? '')
  } catch {
    return ''
  }
}

export function apply(ctx, config) {
  const vectorTag = typeof config?.allowTag === 'string' ? config.allowTag : 'A5SF_SUB_ALLOW'
  const denyTag = typeof config?.denyTag === 'string' ? config.denyTag : 'A5SF_SUB_DENY'
  const workspace = String(config?.workspace ?? '')
  const table = vectorTable({ allowTag: vectorTag, denyTag, denyMarker: String(config?.denyMarker ?? ''), allowMarker: String(config?.allowMarker ?? '') })

  ctx.tools.register({
    name: 'sub_probe',
    description:
      'Fixture measurement tool (dev-live evidence). Drives ONE declared argv vector through the Member\'s '
      + 'mounted confined subprocess face and returns a JSON record of what the face did. '
      + 'Vectors: ' + Object.keys(table).join(', ') + '.',
    parameters: {
      type: 'object',
      properties: {
        vector: {
          type: 'string',
          description: 'One vector id from the fixture table: ' + Object.keys(table).join(', '),
        },
      },
      required: ['vector'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, result) => [{ type: 'text', text: String(result) }],
    },
    async execute(args) {
      const id = String(args?.vector ?? '')
      const vector = table[id]
      if (vector === undefined) {
        return JSON.stringify({ vector: id, error: 'UNKNOWN_VECTOR', known: Object.keys(table) })
      }
      const spec = {
        argv: [...vector.argv],
        cwd: workspace,
        stdio: { stdin: 'ignore', stdout: { maxBytes: MAX_BYTES }, stderr: { maxBytes: MAX_BYTES } },
        graceMs: 5_000,
        shell: { program: 'bash', reads: [workspace], writes: [workspace] },
      }
      const record = {
        vector: id,
        label: vector.label,
        expect: vector.expect,
        argv: vector.argv,
        cwd: workspace,
        spawnReturned: false,
        ok: null,
        code: null,
        message: null,
        stdout: '',
        stderr: '',
      }
      let handle
      try {
        handle = ctx.subprocess.spawn(spec)
        record.spawnReturned = true
      } catch (error) {
        record.code = typeof error?.code === 'string' ? error.code : null
        record.message = String(error?.message ?? error)
        return JSON.stringify(record)
      }
      const settled = await handle.done.then(() => undefined, (error) => error)
      if (settled !== undefined && settled !== null) {
        record.code = typeof settled?.code === 'string' ? settled.code : null
        record.message = String(settled?.message ?? settled)
        record.ok = false
      } else {
        record.ok = true
      }
      record.stdout = textOfCollected(handle)
      try { record.stderr = String(handle?.collected?.stderr?.readFrom(0)?.text ?? '') } catch { record.stderr = '' }
      return JSON.stringify(record)
    },
  })
}
