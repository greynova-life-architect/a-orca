/**
 * Tests for cursor slice payloads: ensure we never send empty or "-" prompt
 * to API.cursor.start. Uses cursorPayloads helpers (single source of truth).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');

const DEFAULT_PLANNING =
  'Plan and create tasks for this project.';
const DEFAULT_MILESTONE =
  'Describe how you want to break this project into phases, releases, or sprints — e.g. by quarter, by release version, by feature area, or by sprint. The assistant will ask a few questions, then propose milestones you can confirm.';

describe('cursor payloads – prompt for questions', () => {
  it('returns default when projectChatInput is empty', async () => {
    const { getPromptForQuestions } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { projectChatInput: '', promptText: '' };
    const prompt = getPromptForQuestions(state);
    assert.strictEqual(prompt, DEFAULT_PLANNING);
    assert(prompt.length >= 10);
    assert(prompt !== '-');
  });

  it('returns default when projectChatInput is "-"', async () => {
    const { getPromptForQuestions } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { projectChatInput: '-', promptText: '' };
    const prompt = getPromptForQuestions(state);
    assert.strictEqual(prompt, DEFAULT_PLANNING);
    assert(prompt !== '-');
  });

  it('returns default when prompt is too short (< 10 chars)', async () => {
    const { getPromptForQuestions } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { projectChatInput: 'short', promptText: '' };
    const prompt = getPromptForQuestions(state);
    assert.strictEqual(prompt, DEFAULT_PLANNING);
  });

  it('returns chat input when valid (long enough, not "-")', async () => {
    const { getPromptForQuestions } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: 'I want to build a todo app with React and Node.',
      promptText: '',
    };
    const prompt = getPromptForQuestions(state);
    assert.strictEqual(prompt, 'I want to build a todo app with React and Node.');
    assert(prompt.length >= 10);
  });
});

describe('cursor payloads – prompt for plan', () => {
  it('returns default when no chat input and no user messages', async () => {
    const { getPromptForPlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: '',
      promptText: '',
      projectChatMessages: [],
    };
    const prompt = getPromptForPlan(state);
    assert.strictEqual(prompt, DEFAULT_PLANNING);
    assert(prompt !== '-');
  });

  it('returns last user message when chat input is empty', async () => {
    const { getPromptForPlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: '',
      promptText: '',
      projectChatMessages: [
        { role: 'user', content: 'Build a dashboard with charts and filters.' },
        { role: 'assistant', content: 'Here are some questions...' },
      ],
    };
    const prompt = getPromptForPlan(state);
    assert.strictEqual(prompt, 'Build a dashboard with charts and filters.');
  });

  it('prefers projectChatInput over last user message', async () => {
    const { getPromptForPlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: 'Updated: add dark mode and i18n.',
      promptText: '',
      projectChatMessages: [{ role: 'user', content: 'Old message here.' }],
    };
    const prompt = getPromptForPlan(state);
    assert.strictEqual(prompt, 'Updated: add dark mode and i18n.');
  });

  it('returns default when raw prompt is "-"', async () => {
    const { getPromptForPlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: '-',
      promptText: '',
      projectChatMessages: [],
    };
    const prompt = getPromptForPlan(state);
    assert.strictEqual(prompt, DEFAULT_PLANNING);
  });
});

describe('cursor payloads – prompt for milestone_plan', () => {
  it('returns default when milestoneOriginalPrompt is empty', async () => {
    const { getPromptForMilestonePlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { milestoneOriginalPrompt: '', promptText: '' };
    const prompt = getPromptForMilestonePlan(state);
    assert.strictEqual(prompt, DEFAULT_MILESTONE);
    assert(prompt !== '-');
  });

  it('returns default when milestoneOriginalPrompt is "-"', async () => {
    const { getPromptForMilestonePlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { milestoneOriginalPrompt: '-', promptText: '' };
    const prompt = getPromptForMilestonePlan(state);
    assert.strictEqual(prompt, DEFAULT_MILESTONE);
  });

  it('returns milestoneOriginalPrompt when valid', async () => {
    const { getPromptForMilestonePlan } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      milestoneOriginalPrompt: 'Break into Q1–Q4 quarters with clear deliverables.',
      promptText: '',
    };
    const prompt = getPromptForMilestonePlan(state);
    assert.strictEqual(
      prompt,
      'Break into Q1–Q4 quarters with clear deliverables.'
    );
  });
});

describe('cursor payloads – prompt for milestone_questions', () => {
  it('returns default when overridePrompt is "-" or empty', async () => {
    const { getPromptForMilestoneQuestions } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { milestoneOriginalPrompt: '', promptText: '' };
    assert.strictEqual(getPromptForMilestoneQuestions(state, '-'), DEFAULT_MILESTONE);
    assert.strictEqual(getPromptForMilestoneQuestions(state, ''), DEFAULT_MILESTONE);
    assert(getPromptForMilestoneQuestions(state, '  ').length >= 10);
  });

  it('returns overridePrompt when valid', async () => {
    const { getPromptForMilestoneQuestions } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = { milestoneOriginalPrompt: '', promptText: '' };
    const valid = 'Break the project into three phases: setup, core, polish.';
    assert.strictEqual(getPromptForMilestoneQuestions(state, valid), valid);
  });

  it('buildMilestoneQuestionsPayload never has "-" prompt', async () => {
    const { buildMilestoneQuestionsPayload } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      currentProjectId: 'p1',
      project: { type: 'Fullstack' },
      chatSelectedTaskIds: [],
      chatSelectedFeatureIds: [],
      chatSelectedFilePaths: [],
    };
    const payload = buildMilestoneQuestionsPayload(state, '-');
    assert.strictEqual(payload.phase, 'milestone_questions');
    assert(payload.prompt !== '-');
    assert(payload.prompt.length >= 10);
  });
});

describe('cursor payloads – full payloads include prompt', () => {
  it('buildQuestionsPayload always has non-empty prompt', async () => {
    const { buildQuestionsPayload } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: '-',
      promptText: '',
      chatTopic: 'planning',
      actionType: 'full_application',
      planTarget: '',
      currentProjectId: 'p1',
      project: { type: 'Fullstack' },
      chatSelectedTaskIds: [],
      chatSelectedFeatureIds: [],
      chatSelectedFilePaths: [],
    };
    const payload = buildQuestionsPayload(state);
    assert.strictEqual(payload.phase, 'questions');
    assert(typeof payload.prompt === 'string');
    assert(payload.prompt.length >= 10, 'prompt must be at least 10 chars');
    assert(payload.prompt !== '-');
  });

  it('buildPlanPayload always has non-empty prompt', async () => {
    const { buildPlanPayload } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      projectChatInput: '',
      promptText: '',
      projectChatMessages: [],
      chatTopic: 'planning',
      actionType: 'full_application',
      planTarget: '',
      currentProjectId: 'p1',
      project: { type: 'Fullstack' },
      chatSelectedTaskIds: [],
      chatSelectedFeatureIds: [],
      chatSelectedFilePaths: [],
    };
    const payload = buildPlanPayload(state, []);
    assert.strictEqual(payload.phase, 'plan');
    assert(typeof payload.prompt === 'string');
    assert(payload.prompt.length >= 10);
    assert(payload.prompt !== '-');
  });

  it('buildMilestonePlanPayload always has non-empty prompt', async () => {
    const { buildMilestonePlanPayload } = await import(
      '../src/store/slices/cursorPayloads.js'
    );
    const state = {
      milestoneOriginalPrompt: '',
      promptText: '',
      currentProjectId: 'p1',
      project: { type: 'Fullstack' },
      chatSelectedTaskIds: [],
      chatSelectedFeatureIds: [],
      chatSelectedFilePaths: [],
    };
    const payload = buildMilestonePlanPayload(state, []);
    assert.strictEqual(payload.phase, 'milestone_plan');
    assert(typeof payload.prompt === 'string');
    assert(payload.prompt.length >= 10);
    assert(payload.prompt !== '-');
  });
});
