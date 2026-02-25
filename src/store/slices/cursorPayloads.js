/**
 * Pure helpers to build prompt and payload for API.cursor.start.
 * Used by the cursor slice so we never send empty or "-" prompt.
 * Tested in tests/cursorSlice.test.js.
 * Kept standalone (no selectors import) so Node test runner can load without assessment chain.
 */
export const DEFAULT_PLANNING_PROMPT = 'Plan and create tasks for this project.';
export const DEFAULT_MILESTONE_PROMPT =
  'Describe how you want to break this project into phases, releases, or sprints — e.g. by quarter, by release version, by feature area, or by sprint. The assistant will ask a few questions, then propose milestones you can confirm.';

function getEffectiveActionType(chatTopic, actionType) {
  if (chatTopic === 'planning') return 'full_application';
  if (chatTopic === 'tasks') return 'new_feature';
  return actionType || '';
}

/**
 * Get the prompt string to send for phase 'questions' (first planning step).
 * Never returns empty or "-".
 */
export function getPromptForQuestions(state) {
  const raw = (state.projectChatInput || state.promptText || '').trim();
  if (!raw || raw === '-' || raw.length < 10) return DEFAULT_PLANNING_PROMPT;
  return raw;
}

/**
 * Get the prompt string to send for phase 'plan' (regeneratePlan or startPlanPhase).
 * Uses chat input, promptText, or last user message. Never returns empty or "-".
 */
export function getPromptForPlan(state) {
  const raw =
    (state.projectChatInput || state.promptText || '').trim() ||
    (state.projectChatMessages || [])
      .filter((m) => m.role === 'user')
      .pop()
      ?.content?.trim() ||
    '';
  if (!raw || raw === '-' || raw.length < 10) return DEFAULT_PLANNING_PROMPT;
  return raw;
}

/**
 * Get the prompt string to send for phase 'milestone_plan'.
 * Never returns empty or "-".
 */
export function getPromptForMilestonePlan(state) {
  const raw = (state.milestoneOriginalPrompt || state.promptText || '').trim();
  if (!raw || raw === '-' || raw.length < 10) return DEFAULT_MILESTONE_PROMPT;
  return raw;
}

/**
 * Get the prompt for phase 'milestone_questions' (initial milestone flow).
 * When starting, the caller may pass overridePrompt (e.g. from chat input).
 * Never returns empty or "-".
 */
export function getPromptForMilestoneQuestions(state, overridePrompt) {
  const raw = (overridePrompt != null ? String(overridePrompt) : state.milestoneOriginalPrompt || state.promptText || '').trim();
  if (!raw || raw === '-' || /^-+$/.test(raw) || raw.length < 10) return DEFAULT_MILESTONE_PROMPT;
  return raw;
}

/**
 * Build the full payload for API.cursor.start for phase 'questions'.
 */
export function buildQuestionsPayload(state) {
  const effectiveActionType = getEffectiveActionType(
    state.chatTopic,
    state.actionType
  );
  const projectTypeForApi =
    state.project?.type ||
    (effectiveActionType === 'full_application' ? 'Fullstack' : 'Feature');
  const prompt = getPromptForQuestions(state);
  return {
    projectType: projectTypeForApi,
    actionType: effectiveActionType,
    planTarget: state.planTarget || '',
    prompt,
    phase: 'questions',
    project_id: state.currentProjectId || 'default',
    selectedTaskIds: state.chatSelectedTaskIds || [],
    selectedFeatureIds: state.chatSelectedFeatureIds || [],
    referencedFilePaths: state.chatSelectedFilePaths || [],
  };
}

/**
 * Build the full payload for API.cursor.start for phase 'plan'.
 */
export function buildPlanPayload(state, questionAnswers = []) {
  const effectiveActionType = getEffectiveActionType(
    state.chatTopic,
    state.actionType
  );
  const projectTypeForApi =
    state.project?.type ||
    (effectiveActionType === 'full_application' ? 'Fullstack' : 'Feature');
  const prompt = getPromptForPlan(state);
  return {
    projectType: projectTypeForApi,
    actionType: effectiveActionType,
    planTarget: state.planTarget || '',
    prompt,
    questionAnswers,
    phase: 'plan',
    project_id: state.currentProjectId || 'default',
    selectedTaskIds: state.chatSelectedTaskIds || [],
    selectedFeatureIds: state.chatSelectedFeatureIds || [],
    referencedFilePaths: state.chatSelectedFilePaths || [],
  };
}

/**
 * Build the full payload for API.cursor.start for phase 'milestone_questions'.
 */
export function buildMilestoneQuestionsPayload(state, overridePrompt) {
  const projectKind = state.project?.type ? 'coding' : 'coding';
  const prompt = getPromptForMilestoneQuestions(state, overridePrompt);
  return {
    phase: 'milestone_questions',
    prompt,
    project_id: state.currentProjectId || 'default',
    projectKind,
    selectedTaskIds: state.chatSelectedTaskIds || [],
    selectedFeatureIds: state.chatSelectedFeatureIds || [],
    referencedFilePaths: state.chatSelectedFilePaths || [],
  };
}

/**
 * Build the full payload for API.cursor.start for phase 'milestone_plan'.
 */
export function buildMilestonePlanPayload(state, questionAnswers = []) {
  const projectKind = state.project?.type ? 'coding' : 'coding';
  const prompt = getPromptForMilestonePlan(state);
  return {
    phase: 'milestone_plan',
    questionAnswers,
    prompt,
    project_id: state.currentProjectId || 'default',
    projectKind,
    selectedTaskIds: state.chatSelectedTaskIds || [],
    selectedFeatureIds: state.chatSelectedFeatureIds || [],
    referencedFilePaths: state.chatSelectedFilePaths || [],
  };
}
