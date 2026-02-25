/**
 * API client for Project Map.
 * Centralized fetch calls for projects, features, tasks, cursor flows.
 * Non-2xx responses throw ApiError; success returns parsed JSON.
 */

export class ApiError extends Error {
  constructor(message, status = 0, code = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseJsonSafe(res) {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text || res.statusText || 'Invalid response' };
  }
}

const API = {
  base: () => (typeof window !== 'undefined' ? window.location.origin : ''),
  json: async (url, opts = {}) => {
    const res = await fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      throw new ApiError(
        data.error || data.message || res.statusText || 'Request failed',
        res.status,
        data.code ?? null
      );
    }
    return data;
  },

  projects: {
    list: () => API.json(API.base() + '/api/projects'),
    get: (id) =>
      API.json(API.base() + '/api/projects/' + encodeURIComponent(id)),
    create: (data) =>
      API.json(API.base() + '/api/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      API.json(API.base() + '/api/projects/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      API.json(API.base() + '/api/projects/' + encodeURIComponent(id), {
        method: 'DELETE',
      }),
    folder: (id) =>
      API.json(
        API.base() + '/api/projects/' + encodeURIComponent(id) + '/folder'
      ),
    fileDiff: (id, filePath) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(id) +
          '/file-diff?path=' +
          encodeURIComponent(filePath)
      ),
    audit: (id, phase) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(id) +
          '/audit' +
          (phase ? '?phase=' + encodeURIComponent(phase) : '')
      ),
    chat: (id, data) =>
      API.json(
        API.base() + '/api/projects/' + encodeURIComponent(id) + '/chat',
        { method: 'POST', body: JSON.stringify(data) }
      ),
    reorder: (id, data) =>
      API.json(
        API.base() + '/api/projects/' + encodeURIComponent(id) + '/reorder',
        { method: 'POST', body: JSON.stringify(data) }
      ),
    assessStreamUrl: (id) =>
      API.base() +
      '/api/projects/' +
      encodeURIComponent(id) +
      '/assess/stream',
    milestones: {
      list: (id) =>
        API.json(API.base() + '/api/projects/' + encodeURIComponent(id)).then(
          (d) => d.milestones || []
        ),
      create: (id, data) =>
        API.json(
          API.base() + '/api/projects/' + encodeURIComponent(id) + '/milestones',
          { method: 'POST', body: JSON.stringify(data) }
        ),
      update: (id, mid, data) =>
        API.json(
          API.base() +
            '/api/projects/' +
            encodeURIComponent(id) +
            '/milestones/' +
            encodeURIComponent(mid),
          { method: 'PATCH', body: JSON.stringify(data) }
        ),
      delete: (id, mid) =>
        API.json(
          API.base() +
            '/api/projects/' +
            encodeURIComponent(id) +
            '/milestones/' +
            encodeURIComponent(mid),
          { method: 'DELETE' }
        ),
    },
  },
  features: {
    add: (projectId, data) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/features',
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
    update: (projectId, id, data) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/features/' +
          encodeURIComponent(id),
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        }
      ),
    delete: (projectId, id) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/features/' +
          encodeURIComponent(id),
        { method: 'DELETE' }
      ),
  },
  tasks: {
    update: (projectId, taskId, data) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/tasks/' +
          encodeURIComponent(taskId),
        { method: 'PATCH', body: JSON.stringify(data) }
      ),
    dependencies: (projectId, taskId) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/tasks/' +
          encodeURIComponent(taskId) +
          '/dependencies'
      ),
    addDependency: (projectId, taskId, dependsOnTaskId) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/tasks/' +
          encodeURIComponent(taskId) +
          '/dependencies',
        {
          method: 'POST',
          body: JSON.stringify({ depends_on_task_id: dependsOnTaskId }),
        }
      ),
    removeDependency: (projectId, taskId, dependsOnTaskId) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/tasks/' +
          encodeURIComponent(taskId) +
          '/dependencies/' +
          encodeURIComponent(dependsOnTaskId),
        { method: 'DELETE' }
      ),
  },
  cursor: {
    start: (payload) =>
      API.json(API.base() + '/api/cursor/start', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    streamUrl: (phase, projectId, taskId) => {
      let u =
        API.base() + '/api/cursor/stream?phase=' + encodeURIComponent(phase);
      if (projectId) u += '&project_id=' + encodeURIComponent(projectId);
      if (taskId) u += '&taskId=' + encodeURIComponent(taskId);
      return u;
    },
    confirm: (payload) =>
      API.json(API.base() + '/api/cursor/confirm', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    confirmMilestones: (payload) =>
      API.json(API.base() + '/api/cursor/confirm-milestones', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  settings: {
    get: () => API.json(API.base() + '/api/settings'),
    update: (data) =>
      API.json(API.base() + '/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
  agents: {
    list: () => API.json(API.base() + '/api/agents'),
    get: (id) =>
      API.json(API.base() + '/api/agents/' + encodeURIComponent(id)),
    create: (data) =>
      API.json(API.base() + '/api/agents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      API.json(API.base() + '/api/agents/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      API.json(API.base() + '/api/agents/' + encodeURIComponent(id), {
        method: 'DELETE',
      }),
  },
  browse: (path) =>
    API.json(
      API.base() +
        '/api/browse' +
        (path ? '?path=' + encodeURIComponent(path) : '')
    ),
};

export default API;
