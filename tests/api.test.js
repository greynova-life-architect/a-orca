/**
 * Tests for API client: error handling and ApiError.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('api', () => {
  it('ApiError has name, message, status, code', async () => {
    const { ApiError } = await import('../src/api.js');
    const e = new ApiError('Not found', 404, 'NOT_FOUND');
    assert.strictEqual(e.name, 'ApiError');
    assert.strictEqual(e.message, 'Not found');
    assert.strictEqual(e.status, 404);
    assert.strictEqual(e.code, 'NOT_FOUND');
  });

  it('API.json throws ApiError on non-ok response', async () => {
    const { default: API, ApiError } = await import('../src/api.js');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: 'Not found' })),
      });
    try {
      await API.json('http://localhost/test');
      assert.fail('should throw');
    } catch (e) {
      assert.strictEqual(e.name, 'ApiError');
      assert.strictEqual(e.status, 404);
      assert.ok(e.message.includes('Not found'));
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('API.json returns parsed JSON on success', async () => {
    const { default: API } = await import('../src/api.js');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({ projects: [] })),
      });
    try {
      const data = await API.json('http://localhost/api/projects');
      assert.deepStrictEqual(data, { projects: [] });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
