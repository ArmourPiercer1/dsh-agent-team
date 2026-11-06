export default [{
  files: ['**/*.mjs'],
  languageOptions: {
    ecmaVersion: 2023,
    sourceType: 'module',
    globals: {
      console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly',
      URLSearchParams: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
      setInterval: 'readonly', clearInterval: 'readonly', TextEncoder: 'readonly',
      TextDecoder: 'readonly', fetch: 'readonly', AbortController: 'readonly',
      AbortSignal: 'readonly', structuredClone: 'readonly', queueMicrotask: 'readonly',
      performance: 'readonly', crypto: 'readonly', globalThis: 'readonly',
    },
  },
  rules: { 'no-undef': 'error', 'no-unused-vars': 'off' },
}]
