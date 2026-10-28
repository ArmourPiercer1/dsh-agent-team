/** Raw output schemas compiled from the pinned Host author DSL. */
const child = { type: 'object', additionalProperties: false, required: ['kind', 'id', 'label', 'status'], properties: { kind: { type: 'string', enum: ['child'] }, id: { type: 'string' }, label: { type: 'string' }, status: { type: 'string', enum: ['running', 'inactive'] }, parent: { type: 'string' }, depth: { type: 'number' } } }
const diagnostic = { type: 'object', additionalProperties: false, required: ['kind', 'id', 'reason'], properties: { kind: { type: 'string', enum: ['diagnostic'] }, id: { type: 'string' }, reason: { type: 'string', enum: ['corrupt', 'unsupported', 'unavailable'] }, parent: { type: 'string' }, depth: { type: 'number' } } }
const delegation = {
  oneOf: [
    { type: 'object', additionalProperties: false, required: ['kind', 'jobId'], properties: { kind: { type: 'string', const: 'background' }, jobId: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['kind', 'subagentId'], properties: { kind: { type: 'string', const: 'continuable' }, subagentId: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['kind', 'runId', 'output'], properties: { kind: { type: 'string', const: 'foreground' }, runId: { type: 'string' }, output: { type: 'array', items: {} } } },
  ],
}
export const nativeOutputSchemas = Object.freeze({
  subagent: delegation,
  subagent_fork: delegation,
  send_message: { type: 'object', additionalProperties: false, required: ['messageId'], properties: { messageId: { type: 'string' } } },
  interrupt_agent: { type: 'object', additionalProperties: false, required: ['accepted'], properties: { accepted: { type: 'boolean' } } },
  list_agents: { type: 'array', items: { oneOf: [child, diagnostic] } },
  list_subagent_models: { type: 'string' },
  workflow: { oneOf: [
    { type: 'object', additionalProperties: false, required: ['kind', 'jobId', 'runId'], properties: { kind: { type: 'string', const: 'background' }, jobId: { type: 'string' }, runId: { type: 'string' } } },
    { type: 'object', additionalProperties: false, required: ['kind', 'runId', 'agentsStarted', 'result'], properties: { kind: { type: 'string', const: 'foreground' }, runId: { type: 'string' }, agentsStarted: { type: 'integer' }, result: {} } },
  ] },
})
