module.exports = {
  env: { node: true, es2022: true },
  extends: ['eslint:recommended'],
  parserOptions: { ecmaVersion: 2022 },
  ignorePatterns: ['node_modules/', 'public/', 'db/', '**/*.db', '*.min.js', 'test-cursor-agent.js'],
  rules: {
    'no-empty': ['error', { allowEmptyCatch: true }],
    'no-async-promise-executor': 'warn',
  },
};
