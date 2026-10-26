/**
 * fs-family/src/image-row.mjs — the governed `read_image` takeover ROW
 * Definition + presentation face (U7-9a). Same name, same meaning: the
 * parameter contract, the result value shape, and the TWO-BLOCK render
 * (text envelope + `{type:'image', attachment}` reference block — the
 * harness resolves the reference to bytes for the model; the governed row
 * NEVER inlines base64) mirror the pin639 host tool (tool-fs/src/
 * read-image.ts @639ed01539).
 *
 * The route facts ride the SAME resolution order the native gate uses
 * (request-header config, then agent options) — extracted from the host
 * exec here and handed to the injected seam; nothing is invented.
 *
 * @module fs-family/image-row
 */

/** The row's presentation face: the native value schema + two-block
 *  render (envelope text block first, then the image attachment block). */
export const IMAGE_ROW_PRESENTATION_FACE = Object.freeze({
  schema: Object.freeze({
    type: 'object',
    properties: Object.freeze({
      path: Object.freeze({ type: 'string' }),
      image: Object.freeze({
        type: 'object',
        properties: Object.freeze({
          attachmentId: Object.freeze({ type: 'string' }),
          mediaType: Object.freeze({ type: 'string', enum: Object.freeze(['image/png', 'image/jpeg', 'image/webp', 'image/gif']) }),
          bytes: Object.freeze({ type: 'integer' }),
          width: Object.freeze({ type: 'integer' }),
          height: Object.freeze({ type: 'integer' }),
          name: Object.freeze({ type: 'string' }),
          originalDimensions: Object.freeze({
            type: 'object',
            properties: Object.freeze({
              width: Object.freeze({ type: 'integer' }),
              height: Object.freeze({ type: 'integer' }),
            }),
            required: Object.freeze(['width', 'height']),
            additionalProperties: false,
          }),
        }),
        required: Object.freeze(['attachmentId', 'mediaType', 'bytes', 'width', 'height']),
        additionalProperties: false,
      }),
    }),
    required: Object.freeze(['path', 'image']),
    additionalProperties: false,
  }),
  /** Mirror of imageReadContent (read-image.ts:192-197): the envelope text
   *  block (formatImageReadOutput law, downscale advice included when the
   *  store names the pre-scale dimensions) + the attachment-reference image
   *  block. */
  render: (_args, value) => {
    const path = typeof value?.path === 'string' ? value.path : ''
    const image = value?.image ?? {}
    let scaled = ''
    if (image.originalDimensions !== undefined) {
      const x = (image.originalDimensions.width / image.width).toFixed(2)
      const y = (image.originalDimensions.height / image.height).toFixed(2)
      const advice = x === y
        ? `multiply coordinates by ${x}`
        : `multiply x coordinates by ${x} and y coordinates by ${y}`
      scaled = ` (downscaled from ${String(image.originalDimensions.width)}x${String(image.originalDimensions.height)} px; ${advice} to locate features in the original file)`
    }
    const envelope = `<path>${path}</path>\n<type>image</type>\n<content>\n${String(image.mediaType ?? '')} image, ${String(image.width ?? 0)}x${String(image.height ?? 0)} px, ${String(image.bytes ?? 0)} bytes${scaled}\n</content>`
    const attachment = {
      attachmentId: image.attachmentId,
      mediaType: image.mediaType,
      bytes: image.bytes,
      width: image.width,
      height: image.height,
      ...(typeof image.name === 'string' ? { name: image.name } : {}),
      ...(image.originalDimensions === undefined ? {} : { originalDimensions: { ...image.originalDimensions } }),
    }
    return [
      { type: 'text', text: envelope },
      { type: 'image', attachment },
    ]
  },
  presentationMeta: (_args, value) => ({ path: value.path, image: { ...value.image } }),
})

/** The native route resolution order (read-image.ts:121-123): the session's
 *  latest routed config wins, then the agent options. Defensive: every
 *  shape fault answers undefined (the gate then refuses exactly as the
 *  native gate refuses on an unresolvable route). */
function routeFactsFromExec(exec) {
  let routed
  try {
    routed = exec?.agent?.session?.requestHeader?.()?.config
  } catch {
    routed = undefined
  }
  const provider = routed?.provider ?? exec?.agent?.options?.provider
  const model = routed?.model ?? exec?.agent?.options?.model
  return {
    ...(typeof provider === 'string' ? { provider } : {}),
    ...(typeof model === 'string' ? { model } : {}),
  }
}

/**
 * Build the governed read_image row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.readImageName - the takeover spelling
 *   (Gate-0b-validated by the center BEFORE this call).
 * @param {(raw: unknown, corr: object) => Promise<unknown>} input.imageExecutor
 * @param {(i: {filePath: string, provider?: string, model?: string, signal?: unknown}) => Promise<{ok: boolean, refusal?: {code: string, text: string}}>} [input.imageRouteResolver]
 *   - the mount-resolved route gate (over the host `llm` public seam);
 *   absent = every call refuses with the native unresolvable-route
 *   sentence (never a bypass).
 */
export function buildImageRowDefinition({ readImageName, imageExecutor, imageRouteResolver }) {
  return Object.freeze({
    name: readImageName,
    description: 'Read one governed image file inside this member\'s admitted file root and attach it to the conversation. Paths resolve against that root; escaping targets are refused. The file is durably committed to the session\'s attachment store and referenced as an image block.',
    parameters: {
      type: 'object',
      // The frozen canonicalizer keys `read_image` to {file_path} (the
      // resourceKey-only projection, canonical-operation.ts
      // `case 'read_image'`) — the takeover row carries the same contract.
      properties: {
        file_path: { type: 'string', description: 'path relative to the governed root, or an absolute path inside it' },
      },
      required: ['file_path'],
    },
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const route = typeof imageRouteResolver === 'function'
        ? async ({ filePath, signal }) => {
          const facts = routeFactsFromExec(exec)
          return await imageRouteResolver({ filePath, ...facts, ...(signal === undefined ? {} : { signal }) })
        }
        : async ({ filePath }) => ({
          ok: false,
          refusal: {
            code: 'IMAGE_ROUTE_UNRESOLVED',
            text: `cannot read "${filePath}" as an image: the current model route could not be resolved`,
          },
        })
      const outcome = await imageExecutor(raw, { ...corr, route })
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'ok') {
        return { path: outcome.path, image: outcome.image }
      }
      if (outcome !== null && typeof outcome === 'object' && outcome.kind === 'cancelled') {
        return { cancelled: true, content: [{ type: 'text', text: 'read_image · cancelled' }], meta: { cancelled: true } }
      }
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-io executor-unavailable — the governed image executor produced no outcome'
      throw new Error(text)
    },
    output: IMAGE_ROW_PRESENTATION_FACE,
  })
}
