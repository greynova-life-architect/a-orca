/**
 * Agents slice: agents list, CRUD, task assignments.
 */
import API from '../../api';

export function createAgentsSlice(set, get) {
  return {
    getUserById: (id) => get().users.find((u) => u.id === id),
    getAgentById: (id) => get().agents.find((a) => a.id === id),

    fetchAgents: async () => {
      try {
        const res = await API.agents.list();
        if (res.agents && res.agents.length > 0) {
          set({ agents: res.agents });
        }
      } catch (_) {}
    },

    setAgents: (agents) => set({ agents }),

    addAgent: async ({ name, description = '', system_prompt = '' }) => {
      try {
        const res = await API.agents.create({ name: name || 'New agent', system_prompt });
        const id = res.id;
        const next = [...get().agents, { id, name: name || 'New agent', system_prompt, description }];
        set({ agents: next });
        return id;
      } catch (_) {
        const id = 'a' + Date.now().toString(36);
        const next = [...get().agents, { id, name: name || 'New agent', system_prompt, description }];
        set({ agents: next });
        return id;
      }
    },

    updateAgent: async (id, { name, description, system_prompt }) => {
      const patch = {};
      if (name !== undefined) patch.name = name;
      if (system_prompt !== undefined) patch.system_prompt = system_prompt;
      try {
        await API.agents.update(id, patch);
      } catch (_) {}
      const next = get().agents.map((a) =>
        a.id === id
          ? {
              ...a,
              ...(name !== undefined && { name }),
              ...(description !== undefined && { description }),
              ...(system_prompt !== undefined && { system_prompt }),
            }
          : a
      );
      set({ agents: next });
    },

    deleteAgent: async (id) => {
      try {
        await API.agents.delete(id);
      } catch (_) {}
      const next = get().agents.filter((a) => a.id !== id);
      set({ agents: next });
    },

    assignAgentToTask: (taskId, agentId) =>
      set((s) => ({
        taskAgentAssignments: {
          ...s.taskAgentAssignments,
          [taskId]: agentId,
        },
      })),

    toggleChatTask: (id) => {
      const s = get();
      const i = s.chatSelectedTaskIds.indexOf(id);
      set({
        chatSelectedTaskIds:
          i >= 0
            ? s.chatSelectedTaskIds.filter((x) => x !== id)
            : [...s.chatSelectedTaskIds, id],
      });
    },

    toggleChatFeature: (id) => {
      const s = get();
      const i = s.chatSelectedFeatureIds.indexOf(id);
      set({
        chatSelectedFeatureIds:
          i >= 0
            ? s.chatSelectedFeatureIds.filter((x) => x !== id)
            : [...s.chatSelectedFeatureIds, id],
      });
    },

    setChatSelectedFilePaths: (paths) =>
      set({
        chatSelectedFilePaths: Array.isArray(paths) ? paths : [],
      }),
  };
}
