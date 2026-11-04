// Minimal standalone ESLint config for the ONE rule that matters on the boot path: `no-undef`.
// The repo's own config is not used because these drivers live outside the linted package tree,
// and importing the repo config would make this check depend on files a boot must not touch.
export default [
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        AbortController: 'readonly',
        Buffer: 'readonly',
        TextDecoder: 'readonly',
        TextEncoder: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setImmediate: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        structuredClone: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      // THE TDZ CLASS. `homePin is not defined` (08:11Z) was a use-before-define in the SAME
      // function: the evidence record cited it at :1004 while the `const` sat at :1044 inside the
      // try. `no-undef` stays silent there and the Host-path crash only surfaces at runtime, after
      // an intent row. This rule is positional, so it sees it.
      'no-use-before-define': ['error', { functions: false, classes: false, variables: true, allowNamedExports: true }],
    },
  },
]
