/**
 * Project Map - Alpine.js app with Cursor CLI integration.
 * Uses cursor-agent via server (WSL on Windows). No fallback.
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('projectMapApp', () => ({
    project: { name: '', type: '' },
    features: [],
    mapNodes: [],
    users: [
      { id: 'u1', name: 'Dev' },
      { id: 'u2', name: 'Reviewer' },
    ],
    agents: [
      { id: 'cursor', name: 'Cursor Agent' },
      { id: 'claude', name: 'Claude' },
      { id: 'gpt4', name: 'GPT-4' },
    ],
    currentUser: 'u1',
    currentProjectId: '',
    projectList: [],
    projectType: '',
    actionType: '',
    planTarget: '',
    chatTopic: 'planning',
    topicMenuOpen: false,
    promptText: '',
    attachPath: '',
    attachName: '',
    editProjectName: '',
    editProjectType: '',
    editProjectSummary: '',
    editProjectAssessment: '',
    newFeatureName: '',
    newFeatureDescription: '',
    editingFeature: null,
    browseItems: [],
    browseCurrentPath: null,
    browseParentPath: null,
    browseLoading: false,
    browseError: null,
    newProjectName: '',
    viewMode: 'board',
    mainTab: 'planning',
    folderTree: null,
    folderTreeOpen: false,
    columns: [
      { id: 'todo', label: 'To Do' },
      { id: 'ready_for_agent', label: 'Ready for Agent' },
      { id: 'in_progress', label: 'In Progress' },
      { id: 'in_review', label: 'In Review' },
      { id: 'done', label: 'Done' },
    ],
    cursorWaiting: false,
    cursorPhase: 'plan',
    cursorStatusMessage: '',
    cursorStatus: [],
    cursorStreamText: '',
    cursorFileActivity: [],
    cursorAgentActivity: [],
    agentActivityExpanded: false,
    currentQuestionIndex: 0,
    cursorThinkingText: '',
    cursorAssessPrompt: '',
    cursorAssessStep: { step: 0, total: 4, label: '', message: '' },
    cursorAssessFolder: '',
    showAssessCompleteModal: false,
    showAssessHistoryModal: false,
    assessHistory: [],
    selectedAuditEntry: null,
    pendingPlan: null,
    pendingQuestions: null,
    taskTriggerQueue: [],
    taskAgentAssignments: {},
    cursorError: null,
    cursorTestResult: null,
    editingNode: null,
    editModalTab: 'details',
    reviewingNode: null,
    dragOverColumn: null,
    chatSidebarOpen: true,
    projectChatMessages: [],
    projectChatInput: '',
    chatSelectedTaskIds: [],
    chatSelectedFeatureIds: [],
    projectChatWaiting: false,
    pendingOrderedTaskIds: null,

    get cursorPhaseStepIndex() {
      const map = { questions: 0, plan: 1, task: 2 };
      return map[this.cursorPhase] ?? 1;
    },
    get cursorPhaseLabel() {
      const labels = {
        assess: 'Assessing project',
        test: 'Test: Stream LLM response',
        questions: 'Phase 1 of 3: Clarifying questions',
        plan: 'Phase 2 of 3: Creating plan',
        task: 'Phase 3 of 3: Running tasks',
        prioritize: 'Prioritizing tasks',
      };
      return labels[this.cursorPhase] ?? 'Working…';
    },
    get nodesByStatus() {
      const by = {};
      this.columns.forEach((c) => (by[c.id] = []));
      this.mapNodes.forEach((n) => {
        const s = n.status || 'todo';
        if (by[s]) by[s].push(n);
        else by['todo'].push(n);
      });
      return by;
    },
    get nodesByStatusAndFeature() {
      const out = {};
      this.columns.forEach((c) => {
        out[c.id] = { _none: [] };
        this.features.forEach((f) => (out[c.id][f.id] = []));
      });
      this.mapNodes.forEach((n) => {
        const s = n.status || 'todo';
        const col = out[s] || out['todo'];
        const fid = n.feature_id || '_none';
        const arr = col[fid] || col._none;
        arr.push(n);
      });
      return out;
    },
    get treeRoots() {
      return this.features;
    },
    get assessmentSections() {
      return this.parseAssessmentToStructured(this.project?.assessment);
    },
    get taskPreviewFromPlan() {
      if (!this.pendingPlan || !this.pendingPlan.features) return [];
      return this.pendingPlan.features.map((f, i) => {
        const id = 'n_' + (f.id || 'f' + i).replace(/^f/, '');
        return {
          id,
          title: f.name,
          description: f.description || '',
          feature_id: f.id,
          agent_id:
            this.taskAgentAssignments[id] || this.agents[0]?.id || 'cursor',
        };
      });
    },
    assignAgentToTask(taskId, agentId) {
      this.taskAgentAssignments = {
        ...this.taskAgentAssignments,
        [taskId]: agentId,
      };
    },

    getUserById(id) {
      return this.users.find((u) => u.id === id);
    },
    getAgentById(id) {
      return this.agents.find((a) => a.id === id);
    },
    getChildren(featureId) {
      return this.mapNodes.filter((n) => n.feature_id === featureId);
    },
    formatTs(ts) {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleString();
    },
    getSortedAudit(node) {
      return (node?.audit || [])
        .slice()
        .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    },

    addCursorLog(text, type = 'status') {
      this.cursorStatus.push({ text, type });
      this.cursorStatus = this.cursorStatus.slice(-50);
    },

    init() {
      this.fetchProjects();
    },

    openNewProjectModal() {
      this.newProjectName = '';
      const el = document.getElementById('newProjectModal');
      if (el) new bootstrap.Modal(el).show();
    },

    openAttachModal() {
      this.attachPath = '';
      this.attachName = '';
      const el = document.getElementById('attachModal');
      if (el) new bootstrap.Modal(el).show();
    },

    async openBrowseModal() {
      this.browseCurrentPath = null;
      this.browseParentPath = null;
      this.browseItems = [];
      this.browseError = null;
      bootstrap.Modal.getInstance(
        document.getElementById('attachModal')
      )?.hide();
      const el = document.getElementById('browseModal');
      if (el) new bootstrap.Modal(el).show();
      await this.browseLoad();
    },

    async browseLoad() {
      this.browseLoading = true;
      this.browseError = null;
      try {
        const url = this.browseCurrentPath
          ? window.location.origin +
            '/api/browse?path=' +
            encodeURIComponent(this.browseCurrentPath)
          : window.location.origin + '/api/browse';
        const r = await fetch(url);
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        this.browseItems = d.items || [];
        this.browseCurrentPath = d.path;
        this.browseParentPath = d.parentPath || null;
      } catch (e) {
        this.browseItems = [];
        this.browseError = e.message || 'Failed to load folders';
      }
      this.browseLoading = false;
    },

    async browseInto(path) {
      this.browseCurrentPath = path;
      await this.browseLoad();
    },

    async browseGoUp() {
      if (!this.browseParentPath) return;
      this.browseCurrentPath = this.browseParentPath;
      await this.browseLoad();
    },

    selectFolder(path) {
      this.attachPath = path;
      bootstrap.Modal.getInstance(
        document.getElementById('browseModal')
      )?.hide();
      setTimeout(() => {
        const attachEl = document.getElementById('attachModal');
        if (attachEl) new bootstrap.Modal(attachEl).show();
      }, 300);
    },

    closeBrowseModal() {
      bootstrap.Modal.getInstance(
        document.getElementById('browseModal')
      )?.hide();
      setTimeout(() => {
        const attachEl = document.getElementById('attachModal');
        if (attachEl) new bootstrap.Modal(attachEl).show();
      }, 300);
    },

    openProjectModal() {
      this.editProjectName = this.project.name || '';
      this.editProjectType = this.project.type || '';
      this.editProjectSummary = this.project.summary || '';
      this.editProjectAssessment = this.project.assessment || '';
      const el = document.getElementById('projectModal');
      if (el) new bootstrap.Modal(el).show();
    },

    async saveProject() {
      if (!this.currentProjectId) return;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: this.editProjectName,
              type: this.editProjectType,
              summary: this.editProjectSummary,
              assessment: this.editProjectAssessment,
            }),
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        this.project = {
          ...this.project,
          name: this.editProjectName,
          type: this.editProjectType,
          summary: this.editProjectSummary,
          assessment: this.editProjectAssessment,
        };
        bootstrap.Modal.getInstance(
          document.getElementById('projectModal')
        )?.hide();
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    openAddFeatureModal() {
      this.newFeatureName = '';
      this.newFeatureDescription = '';
      const el = document.getElementById('addFeatureModal');
      if (el) new bootstrap.Modal(el).show();
    },

    openEditFeatureModal(feat) {
      this.editingFeature = { ...feat };
      const el = document.getElementById('editFeatureModal');
      if (el) new bootstrap.Modal(el).show();
    },

    async saveFeature() {
      if (!this.currentProjectId || !this.editingFeature) return;
      const { id, name, description } = this.editingFeature;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/features/' +
            encodeURIComponent(id),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description: description || '' }),
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        const idx = this.features.findIndex((f) => f.id === id);
        if (idx >= 0)
          this.features[idx] = { id, name, description: description || '' };
        bootstrap.Modal.getInstance(
          document.getElementById('editFeatureModal')
        )?.hide();
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    async addFeature() {
      if (!this.currentProjectId) return;
      const name = (this.newFeatureName || '').trim();
      if (!name) {
        this.cursorError = 'Enter a feature name.';
        return;
      }
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/features',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              description: (this.newFeatureDescription || '').trim(),
            }),
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        this.features = [
          ...this.features,
          {
            id: d.id,
            name,
            description: (this.newFeatureDescription || '').trim(),
          },
        ];
        bootstrap.Modal.getInstance(
          document.getElementById('addFeatureModal')
        )?.hide();
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    runAssessStream(projectId) {
      this.cursorError = null;
      this.cursorWaiting = true;
      this.cursorPhase = 'assess';
      this.cursorStatusMessage = 'Starting project assessment...';
      this.cursorStatus = [];
      this.cursorFileActivity = [];
      this.cursorAgentActivity = [];
      this.cursorThinkingText = '';
      this.cursorAssessPrompt = '';
      this.cursorAssessStep = { step: 0, total: 4, label: '', message: '' };
      this.cursorAssessFolder = this.project?.root_path || '';
      const base = window.location.origin;
      const url = `${base}/api/projects/${encodeURIComponent(projectId)}/assess/stream`;
      const es = new EventSource(url);
      const self = this;

      es.addEventListener('folder', (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.rootPath) self.cursorAssessFolder = d.rootPath;
        } catch (_) {}
      });

      es.addEventListener('prompt', (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.prompt) self.cursorAssessPrompt = d.prompt;
        } catch (_) {}
      });

      es.addEventListener('step', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorAssessStep = {
            step: d.step || 0,
            total: d.total || 4,
            label: d.label || '',
            message: d.message || '',
          };
          if (d.message) self.cursorStatusMessage = d.message;
        } catch (_) {}
      });

      es.addEventListener('status', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorStatusMessage = d.message || '';
          if (d.rootPath) self.cursorAssessFolder = d.rootPath;
          if (d.phase !== 'assess') self.addCursorLog(d.message, 'status');
        } catch (_) {}
      });

      es.addEventListener('agentActivity', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorAgentActivity = [...self.cursorAgentActivity, d].slice(-100);
        } catch (_) {}
      });

      es.addEventListener('fileActivity', (e) => {
        try {
          const d = JSON.parse(e.data);
          if (d.done && self.cursorFileActivity.length) {
            const last =
              self.cursorFileActivity[self.cursorFileActivity.length - 1];
            const same =
              last.action === d.action &&
              (last.path === d.path || last.pattern === d.pattern);
            if (same && !last.done) {
              self.cursorFileActivity[self.cursorFileActivity.length - 1] = d;
              return;
            }
          }
          self.cursorFileActivity = [...self.cursorFileActivity, d].slice(-50);
        } catch (_) {}
      });

      es.addEventListener('output', (e) => {
        try {
          const d = JSON.parse(e.data);
          const t = d.text || '';
          if (t && (d.type || '') === 'thinking') {
            const prev = self.cursorThinkingText || '';
            const needsSpace =
              prev.length > 0 &&
              !/[\s.,;:!?)]$/.test(prev) &&
              !/^[\s.,;:!?(]/.test(t);
            self.cursorThinkingText = prev + (needsSpace ? ' ' : '') + t;
          }
          /* do not add to log - thinking has its own block; raw output is filtered server-side */
        } catch (_) {}
      });

      es.addEventListener('done', (e) => {
        try {
          const d = JSON.parse(e.data);
          es.close();
          self.cursorWaiting = false;
          self.cursorStatusMessage = '';
          self.cursorThinkingText = '';
          self.cursorAgentActivity = [];
          self.cursorAssessPrompt = '';
          self.cursorAssessStep = { step: 0, total: 4, label: '', message: '' };
          if (d.error) {
            self.cursorError = d.error;
            self.cursorAssessFolder = '';
            return;
          }
          self.cursorError = null;
          self.loadProject(projectId);
          self.showAssessCompleteModal = true;
        } catch (_) {}
      });

      es.addEventListener('error', (e) => {
        let errMsg = 'Connection lost or server error.';
        if (e.data) {
          try {
            const d = JSON.parse(e.data);
            if (d.error) errMsg = d.error;
          } catch (_) {}
        }
        es.close();
        self.cursorWaiting = false;
        self.cursorStatusMessage = '';
        self.cursorThinkingText = '';
        self.cursorAgentActivity = [];
        self.cursorAssessPrompt = '';
        self.cursorAssessStep = { step: 0, total: 4, label: '', message: '' };
        self.cursorAssessFolder = '';
        self.cursorError = errMsg;
      });
    },

    dismissAssessCompleteModal() {
      this.showAssessCompleteModal = false;
      this.cursorFileActivity = [];
      this.cursorAssessFolder = '';
    },

    async openAssessHistoryModal() {
      if (!this.currentProjectId) return;
      this.showAssessHistoryModal = true;
      this.selectedAuditEntry = null;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/audit?phase=assess'
        );
        const d = await r.json();
        this.assessHistory = d.audit || [];
      } catch (e) {
        this.assessHistory = [];
      }
    },

    closeAssessHistoryModal() {
      this.showAssessHistoryModal = false;
      this.assessHistory = [];
      this.selectedAuditEntry = null;
    },

    formatAuditDate(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      return d.toLocaleString();
    },

    parseAssessmentToStructured(raw) {
      if (!raw || typeof raw !== 'string') return null;
      const unescape = (s) => (s || '').replace(/\\n/g, '\n').trim();
      const toStructured = (parsed) => {
        if (!parsed || typeof parsed !== 'object') return null;
        if (Array.isArray(parsed)) {
          return {
            overview: '',
            analysis: '',
            features: parsed.map((f) => ({
              id: f?.id,
              name: f?.name || f?.id || 'Feature',
              description: unescape(f?.description),
            })),
          };
        }
        const desc = unescape(parsed.description);
        const analysis = unescape(parsed.analysis || parsed.assessment);
        const feats = (parsed.features || []).map((f) => ({
          id: f?.id,
          name: f?.name || f?.id || 'Feature',
          description: unescape(f?.description),
        }));
        if (!desc && !analysis && !feats.length) return null;
        return { overview: desc, analysis, features: feats };
      };
      if (raw.includes('```json') || raw.includes('```\n{')) {
        let best = null;
        for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)) {
          try {
            const parsed = JSON.parse(m[1].trim());
            const s = toStructured(parsed);
            if (s) {
              const score = (s.features?.length || 0) * 10 + (s.analysis?.length || 0) + (s.overview?.length || 0);
              if (!best || score > (best.score || 0)) best = { structured: s, score };
            }
          } catch (_) {}
        }
        if (best?.structured) return best.structured;
      }
      try {
        const s = toStructured(JSON.parse(raw.trim()));
        if (s) return s;
      } catch (_) {}
      if (raw.includes('━━━')) {
        const sections = raw.split(/━━━\s*(.+?)\s*━━━/);
        const out = { overview: '', analysis: '', features: [] };
        for (let i = 1; i < sections.length; i += 2) {
          const title = (sections[i] || '').trim().toLowerCase();
          const body = (sections[i + 1] || '').trim();
          if (title.includes('overview')) out.overview = body;
          else if (title.includes('detailed analysis') || title.includes('analysis')) out.analysis = body;
          else if (title.includes('features')) {
            const blocks = body.split(/\n\n+/);
            for (const block of blocks) {
              const first = block.split(/\n/)[0] || '';
              const m = first.match(/^[•\-*]\s+(.+?)(?:\s*\(([^)]+)\))?\s*$/);
              if (m) {
                const desc = block.replace(/^[•\-*]\s+.+?(?:\s*\([^)]+\))?\s*\n?/, '').replace(/^\s+/gm, '').trim();
                out.features.push({ id: m[2], name: m[1].trim(), description: desc });
              } else if (first.trim()) out.features.push({ name: first.replace(/^[•\-*]\s+/, '').trim(), description: '' });
            }
          }
        }
        if (out.overview || out.analysis || out.features.length) return out;
      }
      return null;
    },

    formatAssessmentForDisplay(raw) {
      if (!raw || typeof raw !== 'string') return raw || '';
      const s = this.parseAssessmentToStructured(raw);
      if (s) {
        const parts = [];
        if (s.overview) parts.push('━━━ Overview ━━━\n' + s.overview);
        if (s.analysis) parts.push('━━━ Detailed Analysis ━━━\n' + s.analysis);
        if (s.features?.length) {
          const lines = s.features.map((f) => (f.description ? `• ${f.name}${f.id ? ' (' + f.id + ')' : ''}\n  ${f.description}` : `• ${f.name}${f.id ? ' (' + f.id + ')' : ''}`));
          parts.push('━━━ Features Identified ━━━\n' + lines.join('\n\n'));
        }
        if (parts.length) return parts.join('\n\n');
      }
      if (raw.includes('━━━') && !raw.includes('```json')) return raw;
      return raw;
    },

    formatThinkingForDisplay(text) {
      if (!text) return '';
      const t = text.trim();
      if (
        (t.startsWith('{') && t.includes('"description"')) ||
        (t.startsWith('{') && t.includes('"analysis"') && t.includes('"features"'))
      ) {
        return 'Compiling structured assessment (Overview, Analysis, Features)...';
      }
      return text.replace(/\s+/g, ' ').replace(/\.\s+/g, '.\n\n').trim();
    },

    async reassessProject() {
      if (!this.currentProjectId || !this.project.root_path) return;
      this.runAssessStream(this.currentProjectId);
    },

    async deleteProject() {
      if (
        !this.currentProjectId ||
        !confirm('Remove this project? All features and tasks will be deleted.')
      )
        return;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId),
          { method: 'DELETE' }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        await this.fetchProjects();
        this.loadProject('');
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    async deleteFeature(featureId) {
      if (
        !this.currentProjectId ||
        !confirm('Delete this feature? Tasks in it will move to "No feature".')
      )
        return;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/features/' +
            encodeURIComponent(featureId),
          {
            method: 'DELETE',
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        this.features = this.features.filter((f) => f.id !== featureId);
        this.mapNodes = this.mapNodes.map((n) =>
          n.feature_id === featureId ? { ...n, feature_id: '_none' } : n
        );
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    async fetchProjects() {
      try {
        const r = await fetch(window.location.origin + '/api/projects');
        const d = await r.json();
        this.projectList = d.projects || [];
      } catch (_) {
        this.projectList = [];
      }
    },

    async createNewProject() {
      const name = (this.newProjectName || '').trim() || 'New project';
      try {
        const r = await fetch(window.location.origin + '/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const d = await r.json();
        if (d.id) {
          bootstrap.Modal.getInstance(
            document.getElementById('newProjectModal')
          )?.hide();
          this.newProjectName = '';
          await this.fetchProjects();
          await this.loadProject(d.id);
          this.projectType = '';
          this.actionType = '';
          this.planTarget = '';
          this.promptText = '';
        } else if (d.error) throw new Error(d.error);
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    async attachProject() {
      const pathVal = (this.attachPath || '').trim();
      const name =
        (this.attachName || '').trim() ||
        pathVal.split(/[/\\]/).filter(Boolean).pop() ||
        pathVal ||
        'Attached project';
      if (!pathVal) {
        this.cursorError = 'Enter a folder path.';
        return;
      }
      try {
        const r = await fetch(window.location.origin + '/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, root_path: pathVal }),
        });
        const d = await r.json();
        if (!d.id) throw new Error(d.error || 'Failed');
        bootstrap.Modal.getInstance(
          document.getElementById('attachModal')
        )?.hide();
        this.attachPath = '';
        this.attachName = '';
        await this.fetchProjects();
        this.loadProject(d.id);
        this.runAssessStream(d.id);
      } catch (e) {
        this.cursorWaiting = false;
        this.cursorStatusMessage = '';
        this.cursorError = e.message;
      }
    },

    async loadProject(projectId) {
      if (!projectId) {
        this.project = { name: '', type: '' };
        this.features = [];
        this.mapNodes = [];
        this.currentProjectId = '';
        this.folderTree = null;
        this.projectChatMessages = [];
        return;
      }
      if (this.currentProjectId !== projectId) this.projectChatMessages = [];
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(projectId)
        );
        const d = await r.json();
        if (d.project) {
          this.project = d.project;
          this.features = d.features || [];
          this.mapNodes = (d.tasks || []).map((t) => ({
            ...t,
            status: t.status || 'todo',
            feature_id: t.feature_id || '_none',
          }));
          this.currentProjectId = projectId;
          if (d.project.root_path) this.fetchFolderTree();
          else this.folderTree = null;
        }
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    async fetchFolderTree() {
      if (!this.currentProjectId) return;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/folder'
        );
        const d = await r.json();
        this.folderTree = d && !d.error ? d : null;
      } catch (_) {
        this.folderTree = null;
      }
    },

    flattenFolderTree(node, depth = 0, out = []) {
      if (!node) return out;
      out.push({ node, depth });
      if (node.children && (this.folderExpanded || {})[node.path] !== false) {
        for (const c of node.children)
          this.flattenFolderTree(c, depth + 1, out);
      }
      return out;
    },

    folderExpanded: {},

    toggleFolder(path) {
      const next = { ...this.folderExpanded };
      next[path] = next[path] === false;
      this.folderExpanded = next;
    },

    testCursor() {
      this.cursorError = null;
      this.cursorTestResult = null;
      this.cursorPhase = 'test';
      this.runCursorStream('test');
    },

    get chatTopicLabels() {
      return {
        planning: 'Planning',
        prioritization: 'Prioritization',
        tasks: 'Tasks',
        general: 'General',
        agents: 'Agents',
        refactoring: 'Refactoring',
      };
    },
    get effectiveActionType() {
      if (this.chatTopic === 'planning') return 'full_application';
      if (this.chatTopic === 'tasks') return 'new_feature';
      return this.actionType || '';
    },

    async generateWithCursor() {
      this.cursorError = null;
      this.cursorTestResult = null;
      this.pendingPlan = null;
      this.pendingQuestions = null;
      const effectiveAction = this.effectiveActionType || this.actionType || this.projectType;
      if (!effectiveAction) {
        this.cursorError = 'Select Planning or Tasks topic first.';
        return;
      }
      if (this.actionType === 'enhance_feature' && !this.planTarget) {
        this.cursorError = 'Select a target feature.';
        return;
      }
      const prompt = (this.projectChatInput || this.promptText || '').trim();
      if (prompt) {
        this.projectChatMessages.push({ role: 'user', content: prompt });
        this.projectChatInput = '';
      }
      const effectiveActionType = this.effectiveActionType || this.actionType;
      const projectTypeForApi =
        this.project?.type || (effectiveActionType === 'full_application' ? 'Fullstack' : 'Feature');
      if (!this.currentProjectId) {
        try {
          const cr = await fetch(window.location.origin + '/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: (prompt || 'New project').slice(0, 80),
              type: projectTypeForApi,
            }),
          });
          const cd = await cr.json();
          if (cd.id) {
            await this.fetchProjects();
            await this.loadProject(cd.id);
          }
        } catch (e) {
          this.cursorError = e.message;
          return;
        }
      }

      try {
        const base = window.location.origin;
        const r = await fetch(`${base}/api/cursor/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectType: projectTypeForApi,
            actionType: effectiveActionType,
            planTarget: this.planTarget,
            prompt,
            phase: 'questions',
            project_id: this.currentProjectId,
          }),
        });
        const data = await r.json();
        if (!r.ok || data.error)
          throw new Error(data.error || 'Failed to start');
        this.runCursorStream('questions');
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    async startPlanPhase(answers = []) {
      this.cursorError = null;
      this.cursorWaiting = true;
      this.cursorStatusMessage = 'Starting plan generation...';
      const effectiveActionType = this.effectiveActionType || this.actionType;
      const projectTypeForApi =
        this.project?.type || (effectiveActionType === 'full_application' ? 'Fullstack' : 'Feature');
      try {
        const base = window.location.origin;
        const r = await fetch(`${base}/api/cursor/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectType: projectTypeForApi,
            actionType: effectiveActionType,
            planTarget: this.planTarget,
            questionAnswers: answers,
            phase: 'plan',
            project_id: this.currentProjectId,
          }),
        });
        const data = await r.json();
        if (!r.ok || data.error)
          throw new Error(data.error || 'Failed to start');
        this.pendingQuestions = null;
        this.runCursorStream('plan');
      } catch (e) {
        this.cursorError = e.message;
        this.cursorWaiting = false;
        this.cursorStatusMessage = '';
      }
    },

    nextQuestion() {
      const q = this.pendingQuestions || [];
      if (this.currentQuestionIndex < q.length - 1) {
        this.currentQuestionIndex += 1;
      }
    },
    prevQuestion() {
      if (this.currentQuestionIndex > 0) {
        this.currentQuestionIndex -= 1;
      }
    },

    async generatePlanFromAnswers() {
      const questions = this.pendingQuestions || [];
      const answers = questions.map((q) => ({
        id: q.id,
        question: q.question,
        hint: q.hint,
        answer: q.answer || '',
      }));
      const anyAnswered = answers.some((a) => (a.answer || '').trim());
      if (questions.length > 0 && !anyAnswered) {
        this.cursorError = 'Answer at least one question.';
        return;
      }
      await this.startPlanPhase(answers);
    },

    toggleChatTask(id) {
      const i = this.chatSelectedTaskIds.indexOf(id);
      if (i >= 0) {
        this.chatSelectedTaskIds = this.chatSelectedTaskIds.filter((x) => x !== id);
      } else {
        this.chatSelectedTaskIds = [...this.chatSelectedTaskIds, id];
      }
    },
    toggleChatFeature(id) {
      const i = this.chatSelectedFeatureIds.indexOf(id);
      if (i >= 0) {
        this.chatSelectedFeatureIds = this.chatSelectedFeatureIds.filter((x) => x !== id);
      } else {
        this.chatSelectedFeatureIds = [...this.chatSelectedFeatureIds, id];
      }
    },

    async runPrioritizationFlow() {
      if (!this.currentProjectId || !this.mapNodes.length) {
        this.cursorError = 'Load a project with tasks first.';
        return;
      }
      const msg = 'Prioritize these tasks for implementation order.';
      this.projectChatMessages.push({ role: 'user', content: msg });
      this.projectChatInput = '';
      this.cursorPhase = 'prioritize';
      this.cursorWaiting = true;
      this.cursorStatusMessage = 'LLM is prioritizing tasks...';
      this.cursorStatus = [];
      this.cursorStreamText = '';
      this.cursorAgentActivity = [];
      try {
        const r = await fetch(window.location.origin + '/api/cursor/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phase: 'prioritize',
            project_id: this.currentProjectId,
            selectedTaskIds: this.chatSelectedTaskIds.length
              ? this.chatSelectedTaskIds
              : this.mapNodes.map((n) => n.id),
          }),
        });
        const d = await r.json();
        if (d.error) {
          this.cursorError = d.error;
          this.cursorWaiting = false;
          this.projectChatMessages.push({
            role: 'assistant',
            content: d.error,
          });
          return;
        }
      } catch (e) {
        this.cursorError = e.message;
        this.cursorWaiting = false;
        this.projectChatMessages.push({
          role: 'assistant',
          content: 'Error: ' + e.message,
        });
        return;
      }
      const url =
        window.location.origin +
        '/api/cursor/stream?phase=prioritize&project_id=' +
        encodeURIComponent(this.currentProjectId);
      const es = new EventSource(url);
      const self = this;
      const PRIORITIZE_TIMEOUT_MS = 90000;
      const timeoutId = setTimeout(() => {
        es.close();
        if (self.cursorWaiting) {
          self.cursorWaiting = false;
          self.projectChatMessages.push({
            role: 'assistant',
            content: 'Prioritization timed out. Try again.',
          });
        }
      }, PRIORITIZE_TIMEOUT_MS);

      es.addEventListener('status', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorStatusMessage = d.message || '';
          self.addCursorLog(d.message, 'status');
        } catch (_) {}
      });
      es.addEventListener('output', (e) => {
        try {
          const d = JSON.parse(e.data);
          const t = d.text ?? '';
          if (t !== '') {
            const suffix = d.type === 'stderr' ? '\n[stderr] ' + t : t;
            self.cursorStreamText = (self.cursorStreamText || '') + suffix;
          }
        } catch (_) {}
      });
      es.addEventListener('agentActivity', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorAgentActivity = self.cursorAgentActivity || [];
          self.cursorAgentActivity.push(d);
        } catch (_) {}
      });

      es.addEventListener('done', (e) => {
        clearTimeout(timeoutId);
        es.close();
        self.cursorWaiting = false;
        self.cursorStreamText = '';
        try {
          const d = JSON.parse(e.data);
          if (d.orderedTaskIds && d.orderedTaskIds.length) {
            self.projectChatMessages.push({
              role: 'assistant',
              content:
                'Prioritized order:\n' +
                d.orderedTaskIds
                  .map((id, i) => {
                    const n = self.mapNodes.find((x) => x.id === id);
                    return `${i + 1}. ${n?.title || id}`;
                  })
                  .join('\n') +
                '\n\nOrder applied: task sort order was saved (first = highest priority). Board and task lists now use this order.',
            });
            self.pendingOrderedTaskIds = d.orderedTaskIds;
            self.applySuggestedOrder();
          } else if (d.error) {
            self.projectChatMessages.push({
              role: 'assistant',
              content: d.error,
            });
          }
        } catch (_) {
          self.projectChatMessages.push({
            role: 'assistant',
            content: 'Invalid response from server.',
          });
        }
      });
      es.addEventListener('error', () => {
        clearTimeout(timeoutId);
        es.close();
        if (self.cursorWaiting) {
          self.cursorWaiting = false;
          self.cursorStreamText = '';
          self.projectChatMessages.push({
            role: 'assistant',
            content: 'Stream ended. Check that cursor-agent is configured and the server is running.',
          });
        }
      });
    },

    async handleSend() {
      if (this.pendingQuestions && this.pendingQuestions.length) {
        return this.generatePlanFromAnswers();
      }
      const text = (this.projectChatInput || this.promptText || '').trim();
      if (!text && this.chatTopic !== 'prioritization') return;
      if (['planning', 'tasks'].includes(this.chatTopic)) {
        return this.generateWithCursor();
      }
      if (this.chatTopic === 'prioritization') {
        return this.runPrioritizationFlow();
      }
      if (!this.currentProjectId) {
        this.cursorError = 'Load a project first to chat.';
        return;
      }
      return this.sendProjectChatMessage();
    },

    async sendProjectChatMessage() {
      const text = (this.projectChatInput || '').trim();
      if (!text || !this.currentProjectId) return;
      this.projectChatMessages.push({ role: 'user', content: text });
      this.projectChatInput = '';
      this.projectChatWaiting = true;
      try {
        const url =
          window.location.origin +
          '/api/projects/' +
          encodeURIComponent(this.currentProjectId) +
          '/chat';
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            selectedTaskIds: this.chatSelectedTaskIds,
            selectedFeatureIds: this.chatSelectedFeatureIds,
          }),
        });
        const raw = await r.text();
        let d = {};
        if (raw) {
          try {
            d = JSON.parse(raw);
          } catch (_) {
            this.projectChatMessages.push({
              role: 'assistant',
              content:
                'Server returned invalid response. ' +
                (r.ok ? 'Response: ' + raw.slice(0, 200) : 'Status ' + r.status + ': ' + raw.slice(0, 200)),
            });
            return;
          }
        }
        if (!r.ok) {
          this.projectChatMessages.push({
            role: 'assistant',
            content: d.error || 'Request failed (' + r.status + ').',
          });
          return;
        }
        this.projectChatMessages.push({
          role: 'assistant',
          content: d.reply || d.error || 'No response.',
        });
        if (d.orderedTaskIds && Array.isArray(d.orderedTaskIds) && d.orderedTaskIds.length) {
          this.pendingOrderedTaskIds = d.orderedTaskIds;
          this.projectChatMessages.push({
            role: 'system',
            content: 'Order applied: task sort order saved to the project; Board and lists show the new order.',
          });
          await this.applySuggestedOrder();
        }
      } catch (e) {
        this.projectChatMessages.push({
          role: 'assistant',
          content:
            'Error: ' +
            e.message +
            (e.message === 'Failed to fetch' ? '. Is the server running?' : ''),
        });
      } finally {
        this.projectChatWaiting = false;
      }
    },

    async applySuggestedOrder() {
      if (!this.pendingOrderedTaskIds?.length || !this.currentProjectId) return;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/reorder',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskIds: this.pendingOrderedTaskIds }),
          }
        );
        const d = await r.json();
        if (d.ok) {
          this.pendingOrderedTaskIds = null;
          await this.loadProject(this.currentProjectId);
        }
      } catch (e) {
        this.cursorError = e.message;
      }
    },

    runCursorStream(phase, taskId) {
      this.cursorPhase = phase;
      this.cursorWaiting = true;
      this.agentActivityExpanded = false;
      const phaseMsgs = {
        questions: 'Generating clarifying questions…',
        plan: 'Creating implementation plan…',
        prioritize: 'Generating prioritization…',
        task: 'Running task agent…',
      };
      this.cursorStatusMessage = phaseMsgs[phase] || 'Starting cursor-agent…';
      this.cursorStatus = [];
      this.cursorStreamText = '';
      this.cursorAgentActivity = [];

      const base = window.location.origin;
      let url = taskId
        ? `${base}/api/cursor/stream?phase=${phase}&taskId=${encodeURIComponent(taskId)}`
        : `${base}/api/cursor/stream?phase=${phase}`;
      if (this.currentProjectId)
        url += '&project_id=' + encodeURIComponent(this.currentProjectId);
      const es = new EventSource(url);
      const self = this;

      es.addEventListener('status', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorStatusMessage = d.message || '';
          self.addCursorLog(d.message, 'status');
        } catch (_) {}
      });

      es.addEventListener('output', (e) => {
        try {
          const d = JSON.parse(e.data);
          const t = d.text ?? '';
          if (t !== '') {
            const suffix = d.type === 'stderr' ? '\n[stderr] ' + t : t;
            self.cursorStreamText = (self.cursorStreamText || '') + suffix;
          }
        } catch (_) {}
      });

      es.addEventListener('agentActivity', (e) => {
        try {
          const d = JSON.parse(e.data);
          self.cursorAgentActivity = self.cursorAgentActivity || [];
          self.cursorAgentActivity.push(d);
        } catch (_) {}
      });

      es.addEventListener('done', (e) => {
        try {
          const d = JSON.parse(e.data);
          es.close();
          self.cursorWaiting = false;
          self.cursorStreamText = '';
          if (d.error) {
            self.cursorError = d.error;
            return;
          }
          if (d.phase === 'test') {
            if (d.error) {
              self.cursorError = d.error;
              self.cursorTestResult = null;
            } else {
              self.cursorError = null;
              const out = (d.output || '').trim();
              self.cursorTestResult = out
                ? 'LLM response: ' + out
                : d.success
                  ? 'Connected (no output)'
                  : 'No response received';
            }
            return;
          }
          if (d.phase === 'questions') {
            if (d.questions && d.questions.length > 0) {
              self.pendingQuestions = d.questions.map((q) => ({
                ...q,
                answer: '',
              }));
              self.currentQuestionIndex = 0;
              self.cursorError = null;
            } else {
              self.pendingQuestions = null;
              self.cursorError = null;
              self.startPlanPhase([]);
            }
          } else if (d.phase === 'plan') {
            if (d.plan) {
              self.pendingPlan = d.plan;
              self.taskAgentAssignments = {};
              self.cursorError = null;
            } else if (d.error) {
              self.cursorError = d.error;
            }
          } else if (d.phase === 'tasks' && d.tasks) {
            self.applyTasks(d.tasks);
            self.pendingPlan = null;
            self.cursorError = null;
          } else if (d.phase === 'task') {
            self.triggerNextTask();
          }
        } catch (_) {}
      });

      es.addEventListener('error', () => {
        es.close();
        self.cursorWaiting = false;
        self.cursorStreamText = '';
        if (!self.pendingPlan && !self.cursorError) {
          self.cursorError = 'Connection lost or server error.';
        }
      });
    },

    confirmPlan() {
      if (!this.pendingPlan) return;
      const assignments = this.taskPreviewFromPlan.reduce((acc, t) => {
        acc[t.id] = t.agent_id;
        return acc;
      }, {});
      this.cursorWaiting = true;
      this.cursorStatusMessage = 'Creating tasks and generating prompts...';
      fetch(window.location.origin + '/api/cursor/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentAssignments: assignments,
          project_id: this.currentProjectId,
        }),
      })
        .then((r) => r.json())
        .then((data) => {
          this.cursorWaiting = false;
          this.cursorStatusMessage = '';
          if (data.ok && data.tasks) {
            this.project = data.tasks.project || this.pendingPlan.project || {};
            this.features =
              data.tasks.features || this.pendingPlan.features || [];
            this.applyTasks(data.tasks);
            this.pendingPlan = null;
            this.taskTriggerQueue = (data.tasks.nodes || []).map((n) => n.id);
            this.triggerNextTask();
          } else if (data.error) {
            this.cursorError = data.error;
          }
        })
        .catch((e) => {
          this.cursorWaiting = false;
          this.cursorStatusMessage = '';
          this.cursorError = e.message;
        });
    },

    triggerNextTask() {
      if (!this.taskTriggerQueue.length) {
        this.cursorPhase = 'plan';
        return;
      }
      const taskId = this.taskTriggerQueue.shift();
      this.runCursorStream('task', taskId);
    },

    regeneratePlan() {
      this.pendingPlan = null;
      const effectiveActionType = this.effectiveActionType || this.actionType || this.projectType;
      if (!effectiveActionType) {
        this.cursorError = 'Select Planning or Tasks topic first.';
        return;
      }
      const projectTypeForApi =
        this.project?.type || (effectiveActionType === 'full_application' ? 'Fullstack' : 'Feature');
      const body = {
        projectType: projectTypeForApi,
        actionType: effectiveActionType,
        planTarget: this.planTarget,
        phase: 'plan',
      };
      if (this.currentProjectId) body.project_id = this.currentProjectId;
      fetch(window.location.origin + '/api/cursor/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) {
            this.runCursorStream('plan');
          } else if (data.error) {
            this.cursorError = data.error;
          }
        })
        .catch((e) => (this.cursorError = e.message));
    },

    applyTasks(tasksData) {
      const nodes = tasksData.nodes || [];
      this.mapNodes = nodes.map((n) => ({
        ...n,
        status: n.status || 'todo',
        feature_id: n.feature_id || '_none',
      }));
      if (tasksData.project) this.project = tasksData.project;
      if (tasksData.features) this.features = tasksData.features;
    },

    dragNode(ev, node) {
      ev.dataTransfer.setData('nodeId', node.id);
      ev.target.classList.add('dragging');
    },
    async dropNode(ev, status) {
      ev.preventDefault();
      const id = ev.dataTransfer.getData('nodeId');
      const n = this.mapNodes.find((x) => x.id === id);
      if (!n || !this.currentProjectId) {
        this.dragOverColumn = null;
        return;
      }
      const prevStatus = n.status;
      n.status = status;
      this.dragOverColumn = null;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/tasks/' +
            encodeURIComponent(id),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
      } catch (e) {
        this.cursorError = e.message;
        n.status = prevStatus;
      }
    },
    async assignNode(node, userId) {
      const prev = node.assignee_id;
      node.assignee_id = userId || null;
      if (!this.currentProjectId) return;
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/tasks/' +
            encodeURIComponent(node.id),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignee_id: userId || null }),
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
      } catch (e) {
        this.cursorError = e.message;
        node.assignee_id = prev;
      }
    },
    async saveTask() {
      if (!this.currentProjectId || !this.editingNode) return;
      const n = this.editingNode;
      const payload = {
        title: n.title,
        description: n.description,
        status: n.status,
        priority: n.priority || null,
        feature_id: n.feature_id || '_none',
        assignee_id: n.assignee_id || null,
        prompt: n.prompt || null,
      };
      try {
        const r = await fetch(
          window.location.origin +
            '/api/projects/' +
            encodeURIComponent(this.currentProjectId) +
            '/tasks/' +
            encodeURIComponent(n.id),
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        const d = await r.json();
        if (d.error) throw new Error(d.error);
        bootstrap.Modal.getInstance(document.getElementById('nodeModal'))?.hide();
      } catch (e) {
        this.cursorError = e.message;
      }
    },
    openNodeModal(node) {
      this.editingNode = node;
      this.editModalTab = 'details';
      const modal = document.getElementById('nodeModal');
      if (modal && typeof bootstrap !== 'undefined') {
        new bootstrap.Modal(modal).show();
      }
    },
    openPromptModal(node) {
      this.reviewingNode = node;
      const modal = document.getElementById('promptModal');
      if (modal && typeof bootstrap !== 'undefined') {
        new bootstrap.Modal(modal).show();
      }
    },
    approvePrompt() {
      if (this.reviewingNode) this.reviewingNode.prompt_status = 'approved';
      document.querySelector('[data-bs-dismiss="modal"]')?.click();
    },
    rejectPrompt() {
      if (this.reviewingNode) this.reviewingNode.prompt_status = 'rejected';
      document.querySelector('[data-bs-dismiss="modal"]')?.click();
    },
    answerQuestion(node, questionId, answer) {
      const q = (node.questions || []).find((x) => x.id === questionId);
      if (q) {
        q.answer = answer;
        q.answered = true;
        q.answered_at = new Date().toISOString();
        q.answered_by = this.currentUser;
      }
    },
  }));
});
