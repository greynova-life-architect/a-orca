/**
 * Cursor slice: assess stream, plan/confirm, task execution, agent activity, prioritization.
 */
import API from '../../api';
import { getTaskPreviewFromPlan, getEffectiveActionType } from '../selectors';
import { saveRunLogs } from '../persistence';
import {
  getPromptForQuestions,
  buildQuestionsPayload,
  buildPlanPayload,
  buildMilestoneQuestionsPayload,
  buildMilestonePlanPayload,
  DEFAULT_MILESTONE_PROMPT,
} from './cursorPayloads.js';

const AGENT_ACTIVITY_CAP = 500;

export function createCursorSlice(set, get) {
  return {
    addCursorLog: (text, type = 'status') => {
      set((s) => ({
        cursorStatus: [...s.cursorStatus, { text, type }].slice(-50),
      }));
    },

    // --- Agent activity ---
    agentPushStep: (text, type = 'status') =>
      set((s) => {
        const steps = [...s.agentActivity.live.steps, { text, type }].slice(-AGENT_ACTIVITY_CAP);
        const live = { ...s.agentActivity.live, steps };
        return {
          agentActivity: { ...s.agentActivity, live },
          cursorStatus: steps.slice(-50),
        };
      }),
    agentPushFile: (entry) =>
      set((s) => {
        const files = [...s.agentActivity.live.files, entry].slice(-AGENT_ACTIVITY_CAP);
        const live = { ...s.agentActivity.live, files };
        return {
          agentActivity: { ...s.agentActivity, live },
          cursorAgentActivity: files,
        };
      }),
    agentPushFileStep: (act) =>
      set((s) => {
        const fileEntry =
          act.action === 'edit' && (act.oldText != null || act.newText != null || act.patch != null)
            ? { ...act, oldText: act.oldText, newText: act.newText, patch: act.patch }
            : act;
        const files = [...s.agentActivity.live.files, fileEntry].slice(-AGENT_ACTIVITY_CAP);
        const step = {
          text: act.label || `${act.action || 'read'} ${act.path || ''}`.trim(),
          type: 'file',
          path: act.path,
          action: act.action || 'read',
        };
        if (act.action === 'edit' && (act.oldText != null || act.newText != null || act.patch != null)) {
          step.oldText = act.oldText;
          step.newText = act.newText;
          step.patch = act.patch;
        }
        const steps = [...s.agentActivity.live.steps, step].slice(-AGENT_ACTIVITY_CAP);
        const live = { ...s.agentActivity.live, steps, files };
        return {
          agentActivity: { ...s.agentActivity, live },
          cursorStatus: steps.slice(-50),
          cursorAgentActivity: files,
        };
      }),
    agentSetStatusMessage: (msg) =>
      set((s) => ({
        agentActivity: {
          ...s.agentActivity,
          live: { ...s.agentActivity.live, statusMessage: msg || '' },
        },
        cursorStatusMessage: msg || '',
      })),
    agentClearLive: () =>
      set((s) => ({
        agentActivity: {
          ...s.agentActivity,
          live: { statusMessage: '', steps: [], files: [] },
        },
        cursorStatus: [],
        cursorAgentActivity: [],
        cursorStatusMessage: '',
      })),
    agentSaveRunLog: (contextId, { steps, files } = {}) =>
      set((s) => {
        const stepsToSave = steps ?? s.agentActivity.live.steps;
        const filesToSave = files ?? s.agentActivity.live.files;
        const runLogs = {
          ...s.agentActivity.runLogs,
          [contextId]: { steps: [...stepsToSave], files: [...filesToSave] },
        };
      const projectId = get().currentProjectId;
      if (projectId) saveRunLogs(projectId, runLogs);
        return {
          agentActivity: { ...s.agentActivity, runLogs },
          taskRunLogs: { ...s.taskRunLogs, [contextId]: { steps: stepsToSave, files: filesToSave } },
        };
      }),
    agentGetRunLog: (contextId) => get().agentActivity.runLogs[contextId] ?? null,

    // --- Assessment ---
    dismissAssessCompleteModal: () =>
      set({
        showAssessCompleteModal: false,
        cursorFileActivity: [],
        cursorAssessFolder: '',
      }),

    openAssessHistoryModal: async () => {
      const id = get().currentProjectId;
      if (!id) return;
      set({ showAssessHistoryModal: true, selectedAuditEntry: null });
      try {
        const d = await API.projects.audit(id, 'assess');
        set({ assessHistory: d.audit || [] });
      } catch (_) {
        set({ assessHistory: [] });
      }
    },

    closeAssessHistoryModal: () =>
      set({
        showAssessHistoryModal: false,
        assessHistory: [],
        selectedAuditEntry: null,
      }),

    setSelectedAuditEntry: (entry) => set({ selectedAuditEntry: entry }),

    // --- Answer question / prompt review ---
    answerQuestion: (nodeId, questionId, answer) => {
      set((s) => {
        const node = s.mapNodes.find((x) => x.id === nodeId);
        if (!node) return s;
        const questions = (node.questions || []).map((q) =>
          q.id === questionId
            ? {
                ...q,
                answer,
                answered: true,
                answered_at: new Date().toISOString(),
                answered_by: s.currentUser,
              }
            : q
        );
        const nextNodes = s.mapNodes.map((n) =>
          n.id === nodeId ? { ...n, questions } : n
        );
        const editingNode =
          s.editingNode?.id === nodeId
            ? { ...s.editingNode, questions }
            : s.editingNode;
        return { mapNodes: nextNodes, editingNode };
      });
    },

    approvePrompt: () => {
      const node = get().reviewingNode;
      if (node) {
        set((s) => {
          const next = s.mapNodes.map((n) =>
            n.id === node.id
              ? { ...n, prompt_status: 'approved' }
              : n
          );
          return {
            mapNodes: next,
            showPromptModal: false,
            reviewingNode: null,
          };
        });
      }
    },

    rejectPrompt: () => {
      const node = get().reviewingNode;
      if (node) {
        set((s) => {
          const next = s.mapNodes.map((n) =>
            n.id === node.id
              ? { ...n, prompt_status: 'rejected' }
              : n
          );
          return {
            mapNodes: next,
            showPromptModal: false,
            reviewingNode: null,
          };
        });
      }
    },

    // --- Assess stream ---
    runAssessStream: (projectId) => {
      get().agentClearLive();
      get().agentSetStatusMessage('Starting project assessment...');
      set({
        cursorError: null,
        cursorWaiting: true,
        cursorPhase: 'assess',
        assessStreamProjectId: projectId,
        cursorFileActivity: [],
        cursorThinkingText: '',
        cursorAssessPrompt: '',
        cursorAssessStep: {
          step: 1,
          total: 4,
          label: 'Discovering folders and files',
          message: 'Scanning project structure...',
        },
        cursorAssessFolder: get().project?.root_path || '',
      });
    },

    clearAssessStreamProjectId: () => set({ assessStreamProjectId: null }),

    setCursorAssessState: (updates) =>
      set(typeof updates === 'function' ? updates(get()) : updates),

    // --- Plan / confirm / questions ---
    setPendingPlan: (plan) => set({ pendingPlan: plan }),
    setConfirmPlanMilestoneId: (id) => set({ confirmPlanMilestoneId: id || '' }),
    setPendingMilestoneQuestions: (questions) =>
      set({
        pendingMilestoneQuestions: questions,
        currentQuestionIndex: 0,
      }),
    updatePendingMilestoneQuestionAnswer: (questionIndex, answer) =>
      set((s) => {
        const q = [...(s.pendingMilestoneQuestions || [])];
        if (q[questionIndex]) q[questionIndex] = { ...q[questionIndex], answer };
        return { pendingMilestoneQuestions: q };
      }),
    setPendingMilestonePlan: (plan) => set({ pendingMilestonePlan: plan }),
    setPendingQuestions: (questions) =>
      set({
        pendingQuestions: questions,
        currentQuestionIndex: 0,
        cursorError: null,
      }),
    updatePendingQuestionAnswer: (questionIndex, answer) =>
      set((s) => {
        const q = [...(s.pendingQuestions || [])];
        if (q[questionIndex]) q[questionIndex] = { ...q[questionIndex], answer };
        return { pendingQuestions: q };
      }),
    clearPendingQuestions: () => set({ pendingQuestions: null }),

    nextQuestion: () => {
      const q = get().pendingQuestions || [];
      const cur = get().currentQuestionIndex;
      if (cur <= q.length - 2)
        set((s) => ({ currentQuestionIndex: s.currentQuestionIndex + 1 }));
    },
    prevQuestion: () => {
      const cur = get().currentQuestionIndex;
      if (cur >= 1)
        set((s) => ({ currentQuestionIndex: s.currentQuestionIndex - 1 }));
    },

    applyTasks: (tasksData) => {
      const nodes = (tasksData.nodes || []).map((n) => ({
        ...n,
        status: n.status || 'todo',
        feature_id: n.feature_id || '_none',
      }));
      set((s) => ({
        mapNodes: nodes,
        ...(tasksData.project ? { project: tasksData.project } : {}),
        ...(tasksData.features ? { features: tasksData.features } : {}),
      }));
    },

    confirmPlan: async () => {
      const state = get();
      const plan = state.pendingPlan;
      if (!plan) return;
      const taskPreview = getTaskPreviewFromPlan(state);
      const assignments = taskPreview.reduce((acc, t) => {
        acc[t.id] = t.agent_id;
        return acc;
      }, {});
      get().agentSetStatusMessage('Creating tasks and generating prompts...');
      set({ cursorWaiting: true });
      try {
        const data = await API.cursor.confirm({
          agentAssignments: assignments,
          project_id: state.currentProjectId,
          milestone_id: state.confirmPlanMilestoneId || null,
        });
        get().agentSetStatusMessage('');
        set({ cursorWaiting: false });
        if (data.ok && data.tasks) {
          set({
            project: data.tasks.project || plan.project || state.project,
            features: data.tasks.features || plan.features || state.features,
          });
          get().applyTasks(data.tasks);
          set({ pendingPlan: null });
          const taskIds = (data.tasks.nodes || []).map((n) => n.id);
          set({ taskTriggerQueue: taskIds });
          get().triggerNextTask();
        } else if (data.error) {
          set({ cursorError: data.error });
        }
      } catch (e) {
        set({
          cursorWaiting: false,
          cursorStatusMessage: '',
          cursorError: e.message,
        });
      }
    },

    regeneratePlan: async () => {
      const state = get();
      const effectiveActionType =
        getEffectiveActionType(state.chatTopic, state.actionType) ||
        state.projectType;
      if (!effectiveActionType) {
        set({ cursorError: 'Select Planning or Tasks topic first.' });
        return;
      }
      const payload = buildPlanPayload(state, []);
      set({ pendingPlan: null });
      try {
        const data = await API.cursor.start(payload);
        if (data.ok) get().runCursorStream('plan');
        else if (data.error) set({ cursorError: data.error });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    triggerNextTask: () => {
      const queue = get().taskTriggerQueue;
      if (!queue.length) {
        set({ cursorPhase: 'plan' });
        return;
      }
      const [taskId, ...rest] = queue;
      set({ taskTriggerQueue: rest });
      get().runCursorStream('task', taskId);
    },

    runTask: async (node) => {
      const projectId = get().currentProjectId;
      if (!projectId) return;
      try {
        await API.tasks.update(projectId, node.id, { status: 'in_progress' });
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === node.id);
          const next = [...s.mapNodes];
          if (idx >= 0)
            next[idx] = { ...next[idx], status: 'in_progress' };
          return { mapNodes: next };
        });
        get().runCursorStream('task', node.id);
        get().openNodeModal(node, { defaultTab: 'activity' });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    runCursorStream: (phase, taskId) => {
      get().agentClearLive();
      get().agentSetStatusMessage(
        {
          questions: 'Generating clarifying questions…',
          plan: 'Creating implementation plan…',
          milestone_questions: 'Generating milestone questions…',
          milestone_plan: 'Proposing milestones…',
          prioritize: 'Generating prioritization…',
          task: 'Running task agent…',
        }[phase] || 'Starting cursor-agent…'
      );
      set({
        cursorPhase: phase,
        cursorStreamTaskId: taskId || null,
        cursorWaiting: true,
        agentActivityExpanded: false,
        cursorStreamText: '',
      });
    },

    setCursorStreamState: (updates) =>
      set(typeof updates === 'function' ? updates(get()) : updates),

    stopCursorStream: () => {
      const ref = get().cursorStreamCloseRef;
      if (ref?.current) {
        ref.current();
        ref.current = null;
      }
    },

    startPlanPhase: async (answers = []) => {
      const state = get();
      const payload = buildPlanPayload(state, answers);
      get().agentSetStatusMessage('Starting plan generation...');
      set({
        cursorError: null,
        cursorWaiting: true,
        pendingQuestions: null,
      });
      try {
        const data = await API.cursor.start(payload);
        if (!data.ok && data.error) throw new Error(data.error);
        get().runCursorStream('plan');
      } catch (e) {
        set({
          cursorError: e.message,
          cursorWaiting: false,
          cursorStatusMessage: '',
        });
      }
    },

    generatePlanFromAnswers: async () => {
      const state = get();
      const questions = state.pendingQuestions || [];
      const answers = questions.map((q) => ({
        id: q.id,
        question: q.question,
        hint: q.hint,
        answer: q.answer || '',
      }));
      const anyAnswered = answers.some((a) => (a.answer || '').trim());
      if (questions.length > 0 && !anyAnswered) {
        set({ cursorError: 'Answer at least one question.' });
        return;
      }
      await get().startPlanPhase(answers);
    },

    generateWithCursor: async () => {
      const state = get();
      set({ cursorError: null, cursorTestResult: null, pendingPlan: null, pendingQuestions: null });
      const effectiveAction =
        getEffectiveActionType(state.chatTopic, state.actionType) ||
        state.actionType ||
        state.projectType;
      if (!effectiveAction) {
        set({ cursorError: 'Select Planning or Tasks topic first.' });
        return;
      }
      const prompt = getPromptForQuestions(state);
      if (prompt) {
        set((s) => ({
          projectChatMessages: [...s.projectChatMessages, { role: 'user', content: prompt }],
          projectChatInput: '',
        }));
      }
      const payload = buildQuestionsPayload(state);
      if (!state.currentProjectId) {
        try {
          const d = await API.projects.create({
            name: (payload.prompt || 'New project').slice(0, 80),
            type: payload.projectType,
          });
          if (d.id) {
            await get().fetchProjects();
            await get().loadProject(d.id);
          }
        } catch (e) {
          set({ cursorError: e.message });
          return;
        }
      }
      try {
        const data = await API.cursor.start({ ...payload, project_id: get().currentProjectId });
        if (!data.ok && data.error) throw new Error(data.error);
        get().runCursorStream('questions');
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    generateMilestonesWithCursor: async (prompt) => {
      const state = get();
      if (!state.currentProjectId) {
        set({ cursorError: 'Load a project first.' });
        return;
      }
      const payload = buildMilestoneQuestionsPayload(state, prompt);
      const raw = (prompt != null ? String(prompt) : '').trim();
      const noCustomInput = !raw || raw === '-' || /^-+$/.test(raw) || raw.length < 10;
      if (noCustomInput && payload.prompt === DEFAULT_MILESTONE_PROMPT && !(state.milestoneOriginalPrompt || '').trim()) {
        set({ cursorError: 'Enter a description of how you want to break the project into milestones, or use a preset above.' });
        return;
      }
      set({
        cursorError: null,
        cursorWaiting: true,
        pendingMilestoneQuestions: null,
        pendingMilestonePlan: null,
        milestoneOriginalPrompt: payload.prompt,
      });
      try {
        const data = await API.cursor.start(payload);
        if (!data.ok && data.error) throw new Error(data.error);
        get().runCursorStream('milestone_questions');
      } catch (e) {
        set({
          cursorError: e.message,
          cursorWaiting: false,
        });
      }
    },

    generateMilestonePlanFromAnswers: async (answers) => {
      const state = get();
      if (!state.currentProjectId) return;
      const derived = Array.isArray(answers)
        ? answers
        : (state.pendingMilestoneQuestions || []).map((q) => ({
            id: q.id,
            question: q.question,
            answer: q.answer ?? '',
          }));
      get().agentSetStatusMessage('Proposing milestones…');
      set({
        cursorError: null,
        cursorWaiting: true,
        pendingMilestoneQuestions: null,
        milestoneQuestionAnswers: derived,
      });
      const payload = buildMilestonePlanPayload(state, derived);
      try {
        const data = await API.cursor.start(payload);
        if (!data.ok && data.error) throw new Error(data.error);
        get().runCursorStream('milestone_plan');
      } catch (e) {
        set({
          cursorError: e.message,
          cursorWaiting: false,
          cursorStatusMessage: '',
        });
      }
    },

    includePivotalMilestoneInPlan: () => {
      const plan = get().pendingMilestonePlan;
      if (!plan?.pivotalMilestone || !plan.milestones) return;
      const newMilestone = {
        id: plan.pivotalMilestone.id || 'mp',
        name: plan.pivotalMilestone.name,
        description: plan.pivotalMilestone.description || null,
        sort_order: plan.milestones.length,
      };
      set({
        pendingMilestonePlan: {
          milestones: [...plan.milestones, newMilestone],
          pivotalMilestone: null,
        },
      });
    },

    confirmMilestonePlan: async () => {
      const state = get();
      const plan = state.pendingMilestonePlan;
      if (!plan?.milestones?.length) return;
      const projectId = state.currentProjectId;
      if (!projectId) return;
      get().agentSetStatusMessage('Creating milestones…');
      set({ cursorWaiting: true });
      try {
        const data = await API.cursor.confirmMilestones({
          project_id: projectId,
          milestones: plan.milestones,
        });
        set({ cursorWaiting: false });
        if (data.ok && data.milestones) {
          set({ milestones: data.milestones, pendingMilestonePlan: null });
        } else if (data.error) {
          set({ cursorError: data.error });
        }
      } catch (e) {
        set({
          cursorWaiting: false,
          cursorStatusMessage: '',
          cursorError: e.message,
        });
      }
    },

    runPrioritizationFlow: async () => {
      const state = get();
      if (!state.currentProjectId || !state.mapNodes.length) {
        set({ cursorError: 'Load a project with tasks first.' });
        return;
      }
      get().agentClearLive();
      get().agentSetStatusMessage('LLM is prioritizing tasks...');
      set((s) => ({
        projectChatMessages: [
          ...s.projectChatMessages,
          { role: 'user', content: 'Prioritize these tasks for implementation order.' },
        ],
        projectChatInput: '',
        cursorPhase: 'prioritize',
        cursorWaiting: true,
        cursorStreamText: '',
      }));
      const url =
        API.base() +
        '/api/cursor/stream?phase=prioritize&project_id=' +
        encodeURIComponent(state.currentProjectId);
      const es = new EventSource(url);
      const setState = set;
      const getState = get;
      es.addEventListener('status', (e) => {
        try {
          const d = JSON.parse(e.data);
          getState().agentSetStatusMessage(d.message || '');
          getState().agentPushStep(d.message || '', 'status');
        } catch (_) {}
      });
      es.addEventListener('output', (e) => {
        try {
          const d = JSON.parse(e.data);
          const t = d.text ?? '';
          if (t !== '') {
            const suffix = d.type === 'stderr' ? '\n[stderr] ' + t : t;
            setState((s) => ({
              cursorStreamText: (s.cursorStreamText || '') + suffix,
            }));
          }
        } catch (_) {}
      });
      es.addEventListener('agentActivity', (e) => {
        try {
          const d = JSON.parse(e.data);
          getState().agentPushFile(d);
        } catch (_) {}
      });
      es.addEventListener('done', (e) => {
        es.close();
        setState((s) => ({
          cursorWaiting: false,
          cursorStreamText: '',
        }));
        try {
          const d = JSON.parse(e.data);
          const st = getState();
          if (d.orderedTaskIds?.length) {
            setState((s) => ({
              projectChatMessages: [
                ...s.projectChatMessages,
                {
                  role: 'assistant',
                  content:
                    'Prioritized order:\n' +
                    d.orderedTaskIds
                      .map((id, i) => {
                        const n = st.mapNodes.find((x) => x.id === id);
                        return (i + 1) + '. ' + (n?.title || id);
                      })
                      .join('\n') +
                    '\n\nOrder applied.',
                },
              ],
              pendingOrderedTaskIds: d.orderedTaskIds,
            }));
            get().applySuggestedOrder();
          } else if (d.error) {
            setState((s) => ({
              projectChatMessages: [
                ...s.projectChatMessages,
                { role: 'assistant', content: d.error },
              ],
            }));
          }
        } catch (_) {}
      });
      es.addEventListener('error', () => {
        es.close();
        setState((s) => ({
          cursorWaiting: false,
          cursorStreamText: '',
          projectChatMessages: [
            ...s.projectChatMessages,
            {
              role: 'assistant',
              content: 'Stream ended. Check that cursor-agent is configured.',
            },
          ],
        }));
      });
    },

    testCursor: () => {
      set({
        cursorError: null,
        cursorTestResult: null,
        cursorPhase: 'test',
      });
      get().runCursorStream('test');
    },
  };
}
