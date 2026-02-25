/**
 * Chat slice: project chat messages, send, apply order.
 */
import API from '../../api';

export function createChatSlice(set, get) {
  return {
    setVoiceResponseEnabled: (enabled) =>
      set({ voiceResponseEnabled: enabled }),

    handleSend: async () => {
      const state = get();
      if (state.pendingQuestions?.length) return get().generatePlanFromAnswers();
      if (state.pendingMilestoneQuestions?.length)
        return get().generateMilestonePlanFromAnswers();
      const raw = (state.projectChatInput || state.promptText || '').trim();
      const text = raw.replace(/^-+/, '').trim();
      if (!text && state.chatTopic !== 'prioritization') return;
      if (state.chatTopic === 'milestones') {
        set((s) => ({
          projectChatMessages: text ? [...s.projectChatMessages, { role: 'user', content: text }] : s.projectChatMessages,
          projectChatInput: '',
        }));
        return get().generateMilestonesWithCursor(text);
      }
      if (['planning', 'tasks'].includes(state.chatTopic))
        return get().generateWithCursor();
      if (state.chatTopic === 'prioritization')
        return get().runPrioritizationFlow();
      if (!state.currentProjectId) {
        set({ cursorError: 'Load a project first to chat.' });
        return;
      }
      return get().sendProjectChatMessage();
    },

    sendProjectChatMessage: async () => {
      const state = get();
      const text = (state.projectChatInput || '').trim();
      if (!text || !state.currentProjectId) return;
      set((s) => ({
        projectChatMessages: [...s.projectChatMessages, { role: 'user', content: text }],
        projectChatInput: '',
        projectChatWaiting: true,
      }));
      try {
        const d = await API.projects.chat(state.currentProjectId, {
          message: text,
          selectedTaskIds: state.chatSelectedTaskIds,
          selectedFeatureIds: state.chatSelectedFeatureIds,
        });
        set((s) => ({
          projectChatMessages: [
            ...s.projectChatMessages,
            { role: 'assistant', content: d.reply || d.error || 'No response.' },
          ],
          projectChatWaiting: false,
        }));
        if (d.orderedTaskIds?.length) {
          set((s) => ({
            projectChatMessages: [
              ...s.projectChatMessages,
              {
                role: 'system',
                content: 'Order applied: task sort order saved.',
              },
            ],
            pendingOrderedTaskIds: d.orderedTaskIds,
          }));
          await get().applySuggestedOrder();
        }
      } catch (e) {
        set((s) => ({
          projectChatMessages: [
            ...s.projectChatMessages,
            {
              role: 'assistant',
              content:
                'Error: ' +
                e.message +
                (e.message === 'Failed to fetch' ? '. Is the server running?' : ''),
            },
          ],
          projectChatWaiting: false,
        }));
      }
    },

    applySuggestedOrder: async () => {
      const ids = get().pendingOrderedTaskIds;
      const projectId = get().currentProjectId;
      if (!ids?.length || !projectId) return;
      try {
        const d = await API.projects.reorder(projectId, { taskIds: ids });
        if (d.ok) {
          set({ pendingOrderedTaskIds: null });
          await get().loadProject(projectId);
        }
      } catch (e) {
        set({ cursorError: e.message });
      }
    },
  };
}
