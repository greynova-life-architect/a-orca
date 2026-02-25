/**
 * Unit tests for database CRUD (projects, features, tasks).
 */
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initForTest } = require('../src/db/index');
const dbProjects = require('../src/db/projects');

describe('database', () => {
  beforeEach(() => {
    initForTest();
  });

  it('listProjects returns empty initially', () => {
    const list = dbProjects.listProjects();
    assert.strictEqual(list.length, 0);
  });

  it('createProject and getProject', () => {
    const id = dbProjects.createProject({ name: 'Test Project', type: 'web' });
    assert.ok(id);
    const got = dbProjects.getProject(id);
    assert.ok(got);
    assert.strictEqual(got.project.name, 'Test Project');
    assert.strictEqual(got.project.type, 'web');
    assert.strictEqual(got.features.length, 0);
    assert.strictEqual(got.tasks.length, 0);
  });

  it('updateProject updates name and root_path', () => {
    const id = dbProjects.createProject({ name: 'A' });
    dbProjects.updateProject(id, { name: 'B', root_path: '/tmp/proj' });
    const got = dbProjects.getProject(id);
    assert.strictEqual(got.project.name, 'B');
    assert.strictEqual(got.project.root_path, '/tmp/proj');
  });

  it('deleteProject removes project and related data', () => {
    const id = dbProjects.createProject({ name: 'X' });
    const fid = dbProjects.addFeature(id, { id: 'f1', name: 'F1' });
    dbProjects.addTask(id, { id: 't1', title: 'T1', feature_id: fid });
    dbProjects.deleteProject(id);
    assert.strictEqual(dbProjects.getProject(id), null);
  });

  it('addFeature and removeFeature', () => {
    const id = dbProjects.createProject({ name: 'P' });
    const fid = dbProjects.addFeature(id, { name: 'Auth' });
    assert.ok(fid);
    let got = dbProjects.getProject(id);
    assert.strictEqual(got.features.length, 1);
    assert.strictEqual(got.features[0].name, 'Auth');
    dbProjects.removeFeature(id, fid);
    got = dbProjects.getProject(id);
    assert.strictEqual(got.features.length, 0);
  });

  it('upsertTasks and updateTask', () => {
    const id = dbProjects.createProject({ name: 'P' });
    dbProjects.addFeature(id, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(id, [
      { id: 'n1', title: 'Task 1', status: 'todo', feature_id: 'f1' },
      { id: 'n2', title: 'Task 2', status: 'in_progress', feature_id: 'f1' },
    ]);
    let got = dbProjects.getProject(id);
    assert.strictEqual(got.tasks.length, 2);
    assert.strictEqual(got.tasks[0].status, 'todo');

    dbProjects.updateTask(id, 'n1', { status: 'done', assignee_id: 'u1' });
    got = dbProjects.getProject(id);
    const t1 = got.tasks.find((t) => t.id === 'n1');
    assert.strictEqual(t1.status, 'done');
    assert.strictEqual(t1.assignee_id, 'u1');
  });

  // --- Task dependencies ---

  it('addTaskDependency creates an edge and getTaskDependencies returns it', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'Setup DB', status: 'done', feature_id: 'f1' },
      { id: 't2', title: 'Build API', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    const deps = dbProjects.getTaskDependencies('t2');
    assert.strictEqual(deps.length, 1);
    assert.strictEqual(deps[0].id, 't1');
    assert.strictEqual(deps[0].title, 'Setup DB');
  });

  it('getTaskDependents returns downstream tasks', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'Core', status: 'done', feature_id: 'f1' },
      { id: 't2', title: 'API', status: 'todo', feature_id: 'f1' },
      { id: 't3', title: 'UI', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    dbProjects.addTaskDependency('t3', 't1');
    const dependents = dbProjects.getTaskDependents('t1');
    assert.strictEqual(dependents.length, 2);
    const ids = dependents.map((d) => d.id).sort();
    assert.deepStrictEqual(ids, ['t2', 't3']);
  });

  it('removeTaskDependency removes an edge', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'done', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    assert.strictEqual(dbProjects.getTaskDependencies('t2').length, 1);
    dbProjects.removeTaskDependency('t2', 't1');
    assert.strictEqual(dbProjects.getTaskDependencies('t2').length, 0);
  });

  it('areTaskDependenciesSatisfied returns true when all deps are done', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'done', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'done', feature_id: 'f1' },
      { id: 't3', title: 'C', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t3', 't1');
    dbProjects.addTaskDependency('t3', 't2');
    assert.strictEqual(dbProjects.areTaskDependenciesSatisfied('t3'), true);
  });

  it('areTaskDependenciesSatisfied returns false when a dep is not done', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'done', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'in_progress', feature_id: 'f1' },
      { id: 't3', title: 'C', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t3', 't1');
    dbProjects.addTaskDependency('t3', 't2');
    assert.strictEqual(dbProjects.areTaskDependenciesSatisfied('t3'), false);
  });

  it('areTaskDependenciesSatisfied returns true when task has no deps', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
    ]);
    assert.strictEqual(dbProjects.areTaskDependenciesSatisfied('t1'), true);
  });

  it('addTaskDependency prevents self-dependency', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
    ]);
    assert.throws(() => dbProjects.addTaskDependency('t1', 't1'), {
      message: /cannot depend on itself/i,
    });
  });

  it('addTaskDependency prevents circular dependency', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'todo', feature_id: 'f1' },
      { id: 't3', title: 'C', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    dbProjects.addTaskDependency('t3', 't2');
    assert.throws(() => dbProjects.addTaskDependency('t1', 't3'), {
      message: /circular/i,
    });
  });

  it('getProjectTaskDependencies returns all edges for a project', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'todo', feature_id: 'f1' },
      { id: 't3', title: 'C', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    dbProjects.addTaskDependency('t3', 't1');
    dbProjects.addTaskDependency('t3', 't2');
    const edges = dbProjects.getProjectTaskDependencies(pid);
    assert.strictEqual(edges.length, 3);
  });

  it('getProject includes dependencies in response', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    const proj = dbProjects.getProject(pid);
    assert.ok(Array.isArray(proj.dependencies));
    assert.strictEqual(proj.dependencies.length, 1);
    assert.strictEqual(proj.dependencies[0].task_id, 't2');
    assert.strictEqual(proj.dependencies[0].depends_on_task_id, 't1');
  });

  it('deleteProject cascades to task_dependencies', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    dbProjects.deleteProject(pid);
    assert.strictEqual(dbProjects.getProject(pid), null);
  });

  it('removeTask cleans up dependency edges', () => {
    const pid = dbProjects.createProject({ name: 'Deps' });
    dbProjects.addFeature(pid, { id: 'f1', name: 'F1' });
    dbProjects.upsertTasks(pid, [
      { id: 't1', title: 'A', status: 'todo', feature_id: 'f1' },
      { id: 't2', title: 'B', status: 'todo', feature_id: 'f1' },
      { id: 't3', title: 'C', status: 'todo', feature_id: 'f1' },
    ]);
    dbProjects.addTaskDependency('t2', 't1');
    dbProjects.addTaskDependency('t3', 't2');
    dbProjects.removeTask(pid, 't2');
    const proj = dbProjects.getProject(pid);
    assert.strictEqual(proj.dependencies.length, 0);
  });

  it('logPromptAudit and getPromptAudit', () => {
    const id = dbProjects.createProject({ name: 'P' });
    dbProjects.logPromptAudit(id, 'phase1', 'prompt text', 'response text');
    const audit = dbProjects.getPromptAudit(id);
    assert.strictEqual(audit.length, 1);
    assert.strictEqual(audit[0].phase, 'phase1');
    assert.strictEqual(audit[0].prompt_text, 'prompt text');
    assert.strictEqual(audit[0].response_text, 'response text');
  });
});
