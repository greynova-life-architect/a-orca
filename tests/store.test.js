/**
 * Tests for store persistence helpers and selectors.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('persistence', () => {
  it('loadRunLogs and saveRunLogs are defined', async () => {
    const persistence = await import('../src/store/persistence.js');
    assert.strictEqual(typeof persistence.loadRunLogs, 'function');
    assert.strictEqual(typeof persistence.saveRunLogs, 'function');
  });

  it('loadRunLogs returns empty object when no storage or empty projectId', async () => {
    const { loadRunLogs } = await import('../src/store/persistence.js');
    const result = loadRunLogs('');
    assert.deepStrictEqual(result, {});
  });
});

describe('selectors', () => {
  it('getColumns returns column config', async () => {
    const { getColumns } = await import('../src/store/selectors.js');
    const cols = getColumns();
    assert(Array.isArray(cols));
    assert(cols.length >= 5);
    assert(cols.some((c) => c.id === 'todo' && c.label === 'To Do'));
  });

  it('getNodesByStatus groups nodes by status', async () => {
    const { getNodesByStatus } = await import('../src/store/selectors.js');
    const state = {
      mapNodes: [
        { id: '1', status: 'todo' },
        { id: '2', status: 'done' },
        { id: '3', status: 'todo' },
      ],
    };
    const by = getNodesByStatus(state);
    assert.strictEqual(by.todo.length, 2);
    assert.strictEqual(by.done.length, 1);
  });

  it('getNodesByStatusAndFeature groups by status and feature', async () => {
    const { getNodesByStatusAndFeature } = await import('../src/store/selectors.js');
    const state = {
      features: [{ id: 'f1', name: 'F1' }],
      mapNodes: [
        { id: '1', status: 'todo', feature_id: 'f1' },
        { id: '2', status: 'todo', feature_id: '_none' },
      ],
    };
    const out = getNodesByStatusAndFeature(state);
    assert(out.todo._none);
    assert(out.todo.f1);
    assert.strictEqual(out.todo.f1.length, 1);
    assert.strictEqual(out.todo._none.length, 1);
  });
});
