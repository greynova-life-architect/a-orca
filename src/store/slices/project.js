/**
 * Project slice: project data, features, milestones, tasks, folder tree, browse.
 * Actions for load, CRUD, drag/drop, and run-log persistence.
 */
import API from '../../api';
import { loadRunLogs } from '../persistence';

export function createProjectSlice(set, get) {
  return {
    // --- Helpers (project/task) ---
    getChildren: (featureId) =>
      get().mapNodes.filter((n) => n.feature_id === featureId),
    formatTs: (ts) => {
      if (!ts) return '';
      return new Date(ts).toLocaleString();
    },

    // --- Projects ---
    fetchProjects: async () => {
      try {
        const d = await API.projects.list();
        set({ projectList: d.projects || [] });
      } catch (_) {
        set({ projectList: [] });
      }
    },

    setDefaultProjectId: async (id) => {
      const value = id ? String(id).trim() : '';
      try {
        await API.settings.update({ defaultProjectId: value });
        set({ defaultProjectId: value });
      } catch (_) {}
    },

    addMilestone: async (data) => {
      const projectId = get().currentProjectId;
      if (!projectId) return;
      try {
        const d = await API.projects.milestones.create(projectId, data);
        if (d.id) {
          const list = await API.projects.milestones.list(projectId);
          set({ milestones: list });
        }
      } catch (e) {
        set({ cursorError: e.message });
      }
    },
    updateMilestone: async (milestoneId, data) => {
      const projectId = get().currentProjectId;
      if (!projectId) return;
      try {
        await API.projects.milestones.update(projectId, milestoneId, data);
        const list = await API.projects.milestones.list(projectId);
        set({ milestones: list });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },
    deleteMilestone: async (milestoneId) => {
      const projectId = get().currentProjectId;
      if (!projectId) return;
      try {
        await API.projects.milestones.delete(projectId, milestoneId);
        const list = await API.projects.milestones.list(projectId);
        set({ milestones: list });
        const mapNodes = (get().mapNodes || []).map((t) =>
          t.milestone_id === milestoneId ? { ...t, milestone_id: null } : t
        );
        set({ mapNodes });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    loadProject: async (projectId) => {
      if (!projectId) {
        set((s) => ({
          project: { name: '', type: '' },
          features: [],
          milestones: [],
          mapNodes: [],
          currentProjectId: '',
          folderTree: null,
          projectChatMessages: [],
          agentActivity: { ...s.agentActivity, runLogs: {} },
        }));
        return;
      }
      const prevId = get().currentProjectId;
      if (prevId !== projectId) set({ projectChatMessages: [] });
      try {
        const d = await API.projects.get(projectId);
        if (d.project) {
          const runLogs = loadRunLogs(projectId);
          set((s) => ({
            project: d.project,
            features: d.features || [],
            milestones: d.milestones || [],
            mapNodes: (d.tasks || []).map((t) => ({
              ...t,
              status: t.status || 'todo',
              feature_id: t.feature_id || '_none',
            })),
            currentProjectId: projectId,
            agentActivity: { ...s.agentActivity, runLogs },
            mainTab: 'dashboard',
          }));
          if (d.project.root_path) get().fetchFolderTree();
          else set({ folderTree: null });
        }
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    fetchFolderTree: async () => {
      const id = get().currentProjectId;
      if (!id) return;
      try {
        const d = await API.projects.folder(id);
        set({ folderTree: d && !d.error ? d : null });
      } catch (_) {
        set({ folderTree: null });
      }
    },

    // --- Browse ---
    browseLoad: async () => {
      set({ browseLoading: true, browseError: null });
      try {
        const d = await API.browse(get().browseCurrentPath);
        if (d.error) throw new Error(d.error);
        set({
          browseItems: d.items || [],
          browseCurrentPath: d.path,
          browseParentPath: d.parentPath || null,
        });
      } catch (e) {
        set({
          browseItems: [],
          browseError: e.message || 'Failed to load folders',
        });
      }
      set({ browseLoading: false });
    },

    browseInto: (path) => {
      set({ browseCurrentPath: path });
      get().browseLoad();
    },

    browseGoUp: () => {
      const parent = get().browseParentPath;
      if (!parent) return;
      set({ browseCurrentPath: parent });
      get().browseLoad();
    },

    selectFolder: (path) => {
      set({ attachPath: path, showBrowseModal: false, showAttachModal: true });
    },

    // --- Project CRUD ---
    saveProject: async () => {
      const id = get().currentProjectId;
      if (!id) return;
      try {
        await API.projects.update(id, {
          name: get().editProjectName,
          type: get().editProjectType,
          summary: get().editProjectSummary,
          assessment: get().editProjectAssessment,
        });
        set({
          project: {
            ...get().project,
            name: get().editProjectName,
            type: get().editProjectType,
            summary: get().editProjectSummary,
            assessment: get().editProjectAssessment,
          },
          showProjectModal: false,
        });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    createNewProject: async () => {
      const name = (get().newProjectName || '').trim() || 'New project';
      try {
        const d = await API.projects.create({ name });
        if (d.id) {
          set({ showNewProjectModal: false, newProjectName: '' });
          await get().fetchProjects();
          await get().loadProject(d.id);
          set({ projectType: '', actionType: '', planTarget: '', promptText: '' });
        } else if (d.error) throw new Error(d.error);
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    attachProject: async () => {
      const pathVal = (get().attachPath || '').trim();
      const name =
        (get().attachName || '').trim() ||
        pathVal.split(/[/\\]/).filter(Boolean).pop() ||
        pathVal ||
        'Attached project';
      if (!pathVal) {
        set({ cursorError: 'Enter a folder path.' });
        return;
      }
      try {
        const d = await API.projects.create({ name, root_path: pathVal });
        if (!d.id) throw new Error(d.error || 'Failed');
        set({
          showAttachModal: false,
          attachPath: '',
          attachName: '',
        });
        await get().fetchProjects();
        await get().loadProject(d.id);
        get().runAssessStream(d.id);
      } catch (e) {
        set({
          cursorWaiting: false,
          cursorStatusMessage: '',
          cursorError: e.message,
        });
      }
    },

    deleteProject: async () => {
      const id = get().currentProjectId;
      if (!id || !window.confirm('Remove this project? All features and tasks will be deleted.'))
        return;
      try {
        await API.projects.delete(id);
        await get().fetchProjects();
        get().loadProject('');
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    reassessProject: () => {
      const id = get().currentProjectId;
      const root = get().project?.root_path;
      if (!id || !root) return;
      get().runAssessStream(id);
    },

    // --- Features ---
    addFeature: async () => {
      const projectId = get().currentProjectId;
      const name = (get().newFeatureName || '').trim();
      if (!projectId || !name) {
        set({ cursorError: 'Enter a feature name.' });
        return;
      }
      try {
        const d = await API.features.add(projectId, {
          name,
          description: (get().newFeatureDescription || '').trim(),
        });
        if (d.error) throw new Error(d.error);
        set((s) => ({
          features: [
            ...s.features,
            {
              id: d.id,
              name,
              description: (get().newFeatureDescription || '').trim(),
            },
          ],
          showAddFeatureModal: false,
        }));
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    saveFeature: async () => {
      const projectId = get().currentProjectId;
      const feat = get().editingFeature;
      if (!projectId || !feat) return;
      const { id, name, description } = feat;
      try {
        await API.features.update(projectId, id, {
          name,
          description: description || '',
        });
        set((s) => {
          const idx = s.features.findIndex((f) => f.id === id);
          const next = [...s.features];
          if (idx >= 0)
            next[idx] = { id, name, description: description || '' };
          return {
            features: next,
            showEditFeatureModal: false,
            editingFeature: null,
          };
        });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    deleteFeature: async (featureId) => {
      const projectId = get().currentProjectId;
      if (
        !projectId ||
        !window.confirm(
          'Delete this feature? Tasks in it will move to "No feature".'
        )
      )
        return;
      try {
        await API.features.delete(projectId, featureId);
        set((s) => ({
          features: s.features.filter((f) => f.id !== featureId),
          mapNodes: s.mapNodes.map((n) =>
            n.feature_id === featureId ? { ...n, feature_id: '_none' } : n
          ),
        }));
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    // --- Tasks ---
    saveTask: async () => {
      const projectId = get().currentProjectId;
      const n = get().editingNode;
      if (!projectId || !n) return;
      const payload = {
        title: n.title,
        description: n.description,
        status: n.status,
        priority: n.priority || null,
        feature_id: n.feature_id || '_none',
        milestone_id: n.milestone_id || null,
        assignee_id: n.assignee_id || null,
        prompt: n.prompt || null,
        agent_id: n.agent_id || null,
      };
      try {
        await API.tasks.update(projectId, n.id, payload);
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === n.id);
          const next = [...s.mapNodes];
          if (idx >= 0) next[idx] = { ...next[idx], ...payload };
          return {
            mapNodes: next,
            showNodeModal: false,
            editingNode: null,
          };
        });
      } catch (e) {
        set({ cursorError: e.message });
      }
    },

    assignAgentToNode: async (node, agentId) => {
      const projectId = get().currentProjectId;
      if (!projectId) return;
      const prev = node.agent_id;
      try {
        await API.tasks.update(projectId, node.id, {
          agent_id: agentId || null,
        });
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === node.id);
          const next = [...s.mapNodes];
          if (idx >= 0)
            next[idx] = { ...next[idx], agent_id: agentId || null };
          return { mapNodes: next };
        });
      } catch (e) {
        set({ cursorError: e.message });
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === node.id);
          const next = [...s.mapNodes];
          if (idx >= 0) next[idx] = { ...next[idx], agent_id: prev };
          return { mapNodes: next };
        });
      }
    },

    assignNode: async (node, userId) => {
      const projectId = get().currentProjectId;
      if (!projectId) return;
      const prev = node.assignee_id;
      try {
        await API.tasks.update(projectId, node.id, {
          assignee_id: userId || null,
        });
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === node.id);
          const next = [...s.mapNodes];
          if (idx >= 0)
            next[idx] = { ...next[idx], assignee_id: userId || null };
          return { mapNodes: next };
        });
      } catch (e) {
        set({ cursorError: e.message });
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === node.id);
          const next = [...s.mapNodes];
          if (idx >= 0) next[idx] = { ...next[idx], assignee_id: prev };
          return { mapNodes: next };
        });
      }
    },

    dragNode: (ev, node) => {
      ev.dataTransfer.setData('nodeId', node.id);
      if (ev.target.classList) ev.target.classList.add('dragging');
    },

    dropNode: async (ev, status) => {
      ev.preventDefault();
      const id = ev.dataTransfer.getData('nodeId');
      const state = get();
      const n = state.mapNodes.find((x) => x.id === id);
      if (!n || !state.currentProjectId) {
        set({ dragOverColumn: null });
        return;
      }
      const prevStatus = n.status;
      set((s) => {
        const idx = s.mapNodes.findIndex((x) => x.id === id);
        const next = [...s.mapNodes];
        if (idx >= 0) next[idx] = { ...next[idx], status };
        return { mapNodes: next, dragOverColumn: null };
      });
      try {
        const d = await API.tasks.update(state.currentProjectId, id, { status });
        if (d.error) throw new Error(d.error);
      } catch (e) {
        set((s) => {
          const idx = s.mapNodes.findIndex((x) => x.id === id);
          const next = [...s.mapNodes];
          if (idx >= 0) next[idx] = { ...next[idx], status: prevStatus };
          return { mapNodes: next, cursorError: e.message };
        });
      }
    },

    setTaskRunLog: (taskId, { steps, files }) =>
      set((s) => ({
        taskRunLogs: {
          ...s.taskRunLogs,
          [taskId]: { steps: steps || [], files: files || [] },
        },
      })),

    setMapNodeStatus: (taskId, status) =>
      set((s) => {
        const idx = s.mapNodes.findIndex((x) => x.id === taskId);
        if (idx < 0) return {};
        const next = [...s.mapNodes];
        next[idx] = { ...next[idx], status };
        return { mapNodes: next };
      }),

    // --- Folder tree ---
    toggleFolder: (path) => {
      set((s) => ({
        folderExpanded: {
          ...s.folderExpanded,
          [path]: !(s.folderExpanded || {})[path],
        },
      }));
    },
  };
}
