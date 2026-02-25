/**
 * UI slice: modals, tabs, editing state, drag-over, sidebar.
 * All open/close modal actions and UI setters.
 */
export function createUISlice(set, get) {
  return {
    // --- Modals: open/close ---
    openNewProjectModal: () =>
      set({ showNewProjectModal: true, newProjectName: '' }),
    closeNewProjectModal: () => set({ showNewProjectModal: false }),

    openAttachModal: () =>
      set({ showAttachModal: true, attachPath: '', attachName: '' }),
    closeAttachModal: () => set({ showAttachModal: false }),

    openBrowseModal: () => {
      set({
        showAttachModal: false,
        showBrowseModal: true,
        browseCurrentPath: null,
        browseParentPath: null,
        browseItems: [],
        browseError: null,
      });
      get().browseLoad();
    },
    closeBrowseModal: () => {
      set({ showBrowseModal: false, showAttachModal: true });
    },

    openProjectModal: () =>
      set({
        showProjectModal: true,
        editProjectName: get().project.name || '',
        editProjectType: get().project.type || '',
        editProjectSummary: get().project.summary || '',
        editProjectAssessment: get().project.assessment || '',
      }),
    closeProjectModal: () => set({ showProjectModal: false }),

    openAddFeatureModal: () =>
      set({
        showAddFeatureModal: true,
        newFeatureName: '',
        newFeatureDescription: '',
      }),
    closeAddFeatureModal: () => set({ showAddFeatureModal: false }),

    openEditFeatureModal: (feat) =>
      set({
        showEditFeatureModal: true,
        editingFeature: feat ? { ...feat } : null,
      }),
    closeEditFeatureModal: () =>
      set({ showEditFeatureModal: false, editingFeature: null }),

    openNodeModal: (node, options) =>
      set({
        showNodeModal: true,
        editingNode: node ? { ...node } : null,
        editModalTab: options?.defaultTab ?? 'details',
      }),
    closeNodeModal: () => set({ showNodeModal: false, editingNode: null }),
    updateEditingNode: (updates) =>
      set((s) => ({
        editingNode: s.editingNode ? { ...s.editingNode, ...updates } : null,
      })),

    openPromptModal: (node) =>
      set({ showPromptModal: true, reviewingNode: node ? { ...node } : null }),
    closePromptModal: () => set({ showPromptModal: false, reviewingNode: null }),
    updateReviewingNode: (updates) =>
      set((s) => ({
        reviewingNode: s.reviewingNode ? { ...s.reviewingNode, ...updates } : null,
      })),

    setEditModalTab: (tab) => set({ editModalTab: tab }),

    setDragOverColumn: (colId) => set({ dragOverColumn: colId }),

    // --- UI state ---
    setMainTab: (tab) => set({ mainTab: tab }),
    setCurrentUser: (id) => set({ currentUser: id }),
    setChatTopic: (topic) => set({ chatTopic: topic }),
    setTopicMenuOpen: (open) => set({ topicMenuOpen: open }),
    setProjectChatInput: (v) => set({ projectChatInput: v }),
    setEditingNode: (node) => set({ editingNode: node }),
    setReviewingNode: (node) => set({ reviewingNode: node }),
    setAgentActivityExpanded: (v) => set({ agentActivityExpanded: v }),
  };
}
