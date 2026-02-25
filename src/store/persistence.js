/**
 * Client-side persistence helpers for the store.
 * Run logs are keyed by project ID so they can be loaded when switching projects.
 */

const RUN_LOGS_PREFIX = 'orca_runLogs_';

export function loadRunLogs(projectId) {
  if (typeof window === 'undefined' || !projectId) return {};
  try {
    const raw = localStorage.getItem(RUN_LOGS_PREFIX + projectId);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveRunLogs(projectId, runLogs) {
  if (typeof window === 'undefined' || !projectId) return;
  try {
    localStorage.setItem(RUN_LOGS_PREFIX + projectId, JSON.stringify(runLogs));
  } catch {
    // ignore quota or parse errors
  }
}
