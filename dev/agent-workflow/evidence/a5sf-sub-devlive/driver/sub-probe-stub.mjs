/**
 * sub-probe-stub.mjs — the PRESET-SCOPE definition of `sub_probe`, the name the
 * fixture measurement module shadows inside a Member's isolated scope.
 *
 * WHY THIS FILE EXISTS. The product's route-C attach refuses a native module
 * that CHANGES a Member's model-visible tool surface (`added`/`removed` must be
 * empty): a scoped registration is outside the inherited `tools.restrict`
 * filter, so a newly added name could re-enable a `builtinToolDeny` lane. That
 * invariant is correct, and this lane must not work around it. So the name is
 * declared in the PRESET first (this stub, one entry on the preset surface) and
 * the measurement module SHADOWS it inside the Member scope — the same shape
 * the accepted FS lane uses for `read`/`write`/`grep`/`glob`.
 *
 * If the shadow ever stops happening, this stub answers the call with
 * `STUB_NOT_SHADOWED` and the driver records a composition failure instead of
 * a verdict about the confined face.
 *
 * @module dev/agent-workflow/evidence/a5sf-sub-devlive/driver/sub-probe-stub
 */
export const name = 'a5sf-sub-probe-stub'
export const inject = ['tools']

const VECTORS = ['face_control', 'net_deny', 'shipped_argv', 'argv_lc', 'argv_empty_body', 'argv_extra_operand']

export function apply(ctx) {
  ctx.tools.register({
    name: 'sub_probe',
    description:
      'Fixture measurement tool (dev-live evidence). This PRESET definition is a stub: inside a Member scope the '
      + 'a5sf native module of the same name shadows it and drives one declared argv vector through the confined '
      + `subprocess face. Vectors: ${VECTORS.join(', ')}.`,
    parameters: {
      type: 'object',
      properties: {
        vector: { type: 'string', description: `One vector id: ${VECTORS.join(', ')}` },
      },
      required: ['vector'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, result) => [{ type: 'text', text: String(result) }],
    },
    async execute(args) {
      return JSON.stringify({
        vector: String(args?.vector ?? ''),
        error: 'STUB_NOT_SHADOWED',
        message: 'the preset-scope stub answered: the a5sf native measurement module did not shadow `sub_probe` in this scope, so no confined-face call was made',
      })
    },
  })
}
