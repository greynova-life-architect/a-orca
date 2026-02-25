/**
 * Integration tests: start server and hit key endpoints.
 */
process.env.PORT = '3458'; // Before any config load

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');

const PORT = 3458;
let server = null;

const get = (path) =>
  new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${PORT}${path}`, (res) => {
      let body = '';
      res.on('data', (ch) => (body += ch));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });

const post = (path, data) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': body.length,
        },
      },
      (res) => {
        let b = '';
        res.on('data', (ch) => (b += ch));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });

describe('integration', () => {
  before(async () => {
    const { initForTest } = require('../src/db/index');
    initForTest(); // Clean in-memory DB for integration
    const { createServer } = require('../src/server');
    server = createServer();
    await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  });

  after(() => {
    if (server) server.close();
  });

  it('GET /api/projects returns 200 and array', async () => {
    const { status, body } = await get('/api/projects');
    assert.strictEqual(status, 200);
    const obj = JSON.parse(body);
    assert.ok(Array.isArray(obj.projects));
  });

  it('POST /api/projects creates project', async () => {
    const { status, body } = await post('/api/projects', {
      name: 'Integration Test',
      type: 'web',
    });
    assert.strictEqual(status, 200);
    const obj = JSON.parse(body);
    assert.ok(obj.id);
  });
});
