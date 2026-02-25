/**
 * Root Zustand store composed from domain slices.
 * Single store for compatibility; state and actions are organized in store/slices/.
 * DevTools middleware is enabled in development for state inspection.
 */
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import API from '../api';

import initialState from './slices/initialState';
import { createProjectSlice } from './slices/project';
import { createUISlice } from './slices/ui';
import { createAgentsSlice } from './slices/agents';
import { createCursorSlice } from './slices/cursor';
import { createChatSlice } from './slices/chat';

const storeImpl = (set, get) => ({
  ...initialState,

  /**
   * App init: fetch projects and agents, load default project if set.
   */
  init: async () => {
    await get().fetchProjects();
    await get().fetchAgents();
    try {
      const settings = await API.settings.get();
      const id = (settings.defaultProjectId || '').trim();
      set({ defaultProjectId: id });
      const list = get().projectList;
      if (id && list.some((p) => p.id === id)) {
        await get().loadProject(id);
      }
      set({ mainTab: 'dashboard' });
    } catch (_) {
      set({ mainTab: 'dashboard' });
    }
  },

  ...createProjectSlice(set, get),
  ...createUISlice(set, get),
  ...createAgentsSlice(set, get),
  ...createCursorSlice(set, get),
  ...createChatSlice(set, get),
});

export const useStore = create(
  devtools(storeImpl, { name: 'OrcaStore' })
);
