/**
 * Unit tests for config loading and validation.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('config', () => {
  it('loads config module without throwing', () => {
    const config = require('../src/server/config/index.js');
    assert.strictEqual(typeof config.PORT, 'number');
    assert.ok(config.PORT >= 1 && config.PORT <= 65535);
    assert.strictEqual(typeof config.PUBLIC_DIR, 'string');
    assert.ok(config.PUBLIC_DIR.length > 0);
  });
});
