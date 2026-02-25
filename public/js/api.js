/**
 * API client for Project Map.
 * Centralized fetch calls for projects, features, tasks, cursor flows.
 */
const API = {
  base: () => (typeof window !== 'undefined' ? window.location.origin : ''),
  json: (url, opts = {}) =>
    fetch(url, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    }).then((r) => r.json()),

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
    audit: (id, phase) =>
      API.json(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(id) +
          '/audit' +
          (phase ? '?phase=' + encodeURIComponent(phase) : '')
      ),
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
      fetch(
        API.base() +
          '/api/projects/' +
          encodeURIComponent(projectId) +
          '/features/' +
          encodeURIComponent(id),
        {
          method: 'DELETE',
        }
      ).then((r) => r.json()),
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
  },
  browse: (path) =>
    API.json(
      API.base() +
        '/api/browse' +
        (path ? '?path=' + encodeURIComponent(path) : '')
    ),
};
