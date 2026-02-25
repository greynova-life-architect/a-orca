/**
 * Pure selectors: take state (or store getState()) and return derived data.
 * Expensive selectors are memoized so they only recompute when state reference changes.
 */
import {
  parseAssessmentToStructured as parseAssessment,
  formatAssessmentForDisplay,
  formatThinkingForDisplay,
} from './assessment';

export {
  formatAssessmentForDisplay,
  formatThinkingForDisplay,
  parseAnalysisSubsections,
} from './assessment';

/**
 * Memoizes a selector by state reference. When used with Zustand, only recomputes when the store state changes.
 */
function createSelector(selector) {
  let lastState = null;
  let lastResult = null;
  return function memoized(state) {
    if (state === lastState) return lastResult;
    lastState = state;
    lastResult = selector(state);
    return lastResult;
  };
}

const COLUMNS = [
  { id: 'todo', label: 'To Do' },
  { id: 'ready_for_agent', label: 'Ready for Agent' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
];

function getNodesByStatusInner(state) {
  const by = {};
  COLUMNS.forEach((c) => (by[c.id] = []));
  (state.mapNodes || []).forEach((n) => {
    const s = n.status || 'todo';
    if (by[s]) by[s].push(n);
    else by['todo'].push(n);
  });
  return by;
}

export const getNodesByStatus = createSelector(getNodesByStatusInner);

function getNodesByStatusAndFeatureInner(state) {
  const out = {};
  const features = state.features || [];
  COLUMNS.forEach((c) => {
    out[c.id] = { _none: [] };
    features.forEach((f) => (out[c.id][f.id] = []));
  });
  (state.mapNodes || []).forEach((n) => {
    const s = n.status || 'todo';
    const col = out[s] || out['todo'];
    const fid = n.feature_id || '_none';
    const arr = col[fid] || col._none;
    arr.push(n);
  });
  return out;
}

export const getNodesByStatusAndFeature = createSelector(getNodesByStatusAndFeatureInner);

export function getTreeRoots(state) {
  return state.features || [];
}

export function getCursorPhaseStepIndex(phase) {
  const map = { questions: 0, plan: 1, task: 2 };
  return map[phase] ?? 1;
}

export function getCursorPhaseLabel(phase) {
  const labels = {
    assess: 'Assessing project',
    test: 'Test: Stream LLM response',
    questions: 'Phase 1 of 3: Clarifying questions',
    plan: 'Phase 2 of 3: Creating plan',
    task: 'Phase 3 of 3: Running tasks',
    prioritize: 'Prioritizing tasks',
    milestone_questions: 'Milestone questions',
    milestone_plan: 'Proposing milestones',
  };
  return labels[phase] ?? 'Working…';
}

export const DEFAULT_MILESTONE_PROMPT =
  'Describe how you want to break this project into phases, releases, or sprints — e.g. by quarter, by release version, by feature area, or by sprint. The assistant will ask a few questions, then propose milestones you can confirm.';

export const DEFAULT_PLANNING_PROMPT =
  'Plan and create tasks for this project.';

export function getChatTopicLabels() {
  return {
    planning: 'Planning',
    prioritization: 'Prioritization',
    tasks: 'Tasks',
    milestones: 'Create milestones',
    general: 'General',
    agents: 'Agents',
    refactoring: 'Refactoring',
  };
}

export function getEffectiveActionType(chatTopic, actionType) {
  if (chatTopic === 'planning') return 'full_application';
  if (chatTopic === 'tasks') return 'new_feature';
  return actionType || '';
}

export function getTaskPreviewFromPlan(state) {
  const plan = state.pendingPlan;
  const agents = state.agents || [];
  const assignments = state.taskAgentAssignments || {};
  if (!plan || !plan.features) return [];
  return (plan.features || []).map((f, i) => {
    const id = 'n_' + (f.id || 'f' + i).replace(/^f/, '');
    return {
      id,
      title: f.name,
      description: f.description || '',
      feature_id: f.id,
      agent_id: assignments[id] || agents[0]?.id || 'cursor',
    };
  });
}

export function getSortedAudit(node) {
  return (node?.audit || []).slice().sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

export function getColumns() {
  return COLUMNS;
}

export function flattenFolderTree(node, depth, folderExpanded, out = []) {
  if (!node) return out;
  out.push({ node, depth });
  if (node.children && (folderExpanded || {})[node.path] !== false) {
    for (const c of node.children)
      flattenFolderTree(c, depth + 1, folderExpanded, out);
  }
  return out;
}

function getAssessmentSectionsInner(state) {
  const raw = state.project?.assessment;
  if (!raw || typeof raw !== 'string') return null;
  return parseAssessment(raw);
}

export const getAssessmentSections = createSelector(getAssessmentSectionsInner);
