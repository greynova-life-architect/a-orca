/**
 * Unit tests for extractors service.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  extractPlanFromOutput,
  extractTasksFromOutput,
  extractQuestionsFromOutput,
  extractAssessmentFromOutput,
  extractPromptsFromOutput,
  formatAssessmentForDisplay,
  parseAssessmentToStructured,
  extractResultFromStreamJson,
} = require('../src/server/services/extractors');

describe('extractors', () => {
  it('extractPlanFromOutput parses json block', () => {
    const output =
      'Some text\n```json\n{"project":{"name":"Test"},"features":[{"id":"f1","name":"Auth"}]}\n```';
    const r = extractPlanFromOutput(output);
    assert.ok(r);
    assert.strictEqual(r.project.name, 'Test');
    assert.strictEqual(r.features.length, 1);
    assert.strictEqual(r.features[0].name, 'Auth');
  });

  it('extractPlanFromOutput returns null for invalid', () => {
    assert.strictEqual(extractPlanFromOutput(''), null);
    assert.strictEqual(extractPlanFromOutput('no json here'), null);
    assert.strictEqual(extractPlanFromOutput('{"foo":1}'), null);
  });

  it('extractTasksFromOutput parses nodes', () => {
    const output = '```json\n{"nodes":[{"id":"n1","title":"Task 1"}]}\n```';
    const r = extractTasksFromOutput(output);
    assert.ok(r);
    assert.strictEqual(r.nodes.length, 1);
    assert.strictEqual(r.nodes[0].title, 'Task 1');
  });

  it('extractQuestionsFromOutput parses questions array', () => {
    const output = '{"questions":[{"id":"q1","question":"What?"}]}';
    const r = extractQuestionsFromOutput(output);
    assert.ok(r);
    assert.strictEqual(r.questions.length, 1);
    assert.strictEqual(r.questions[0].id, 'q1');
  });

  it('extractAssessmentFromOutput returns structure', () => {
    const output =
      '```json\n{"features":[{"id":"f1"}],"description":"x","analysis":"y"}\n```';
    const r = extractAssessmentFromOutput(output);
    assert.ok(r);
    assert.strictEqual(r.features.length, 1);
    assert.strictEqual(r.description, 'x');
    assert.strictEqual(r.assessment, 'y');
  });

  it('extractPromptsFromOutput extracts by taskId', () => {
    const output = '{"prompts":[{"taskId":"n1","prompt":"Do X"}]}';
    const r = extractPromptsFromOutput(output, ['n1', 'n2']);
    assert.ok(r.n1);
    assert.strictEqual(r.n1, 'Do X');
    assert.strictEqual(r.n2, undefined);
  });

  it('formatAssessmentForDisplay formats extracted assessment', () => {
    const extracted = {
      description: 'A web app.',
      assessment: 'Node.js with Express.',
      features: [
        { id: 'f1', name: 'Auth', description: 'JWT auth.' },
        { id: 'f2', name: 'API' },
      ],
    };
    const out = formatAssessmentForDisplay(extracted);
    assert.ok(out.includes('Overview'));
    assert.ok(out.includes('A web app.'));
    assert.ok(out.includes('Detailed Analysis'));
    assert.ok(out.includes('Node.js with Express.'));
    assert.ok(out.includes('Features Identified'));
    assert.ok(out.includes('Auth'));
    assert.ok(out.includes('JWT auth.'));
  });

  it('extractResultFromStreamJson accumulates assistant text from NDJSON', () => {
    const ndjson =
      '{"type":"assistant","message":{"content":[{"text":"```json\\n"}]}}\n' +
      '{"type":"assistant","message":{"content":[{"text":"{\\"questions\\":[{\\"id\\":\\"q1\\",\\"question\\":\\"What?\\"}]}"}]}}\n' +
      '{"type":"assistant","message":{"content":[{"text":"\\n```"}]}}';
    const text = extractResultFromStreamJson(ndjson);
    assert.ok(text);
    assert.ok(text.includes('questions'));
    const q = extractQuestionsFromOutput(text);
    assert.ok(q);
    assert.strictEqual(q.questions.length, 1);
    assert.strictEqual(q.questions[0].id, 'q1');
  });

  it('parseAssessmentToStructured parses json block and format', () => {
    const fromJson = parseAssessmentToStructured(
      '```json\n{"description":"X","analysis":"Y","features":[{"id":"f1","name":"A","description":"D"}]}\n```'
    );
    assert.ok(fromJson);
    assert.strictEqual(fromJson.overview, 'X');
    assert.strictEqual(fromJson.analysis, 'Y');
    assert.strictEqual(fromJson.features.length, 1);
    assert.strictEqual(fromJson.features[0].name, 'A');
    assert.strictEqual(fromJson.features[0].description, 'D');

    const fromFormat = parseAssessmentToStructured(
      '━━━ Overview ━━━\nX\n\n━━━ Detailed Analysis ━━━\nY\n\n━━━ Features Identified ━━━\n• A (f1)\n  D'
    );
    assert.ok(fromFormat);
    assert.strictEqual(fromFormat.overview, 'X');
    assert.strictEqual(fromFormat.analysis, 'Y');
    assert.strictEqual(fromFormat.features.length, 1);
    assert.strictEqual(fromFormat.features[0].name, 'A');
  });
});
