import React, { useState, useEffect, useRef } from 'react';

export function formatRelative(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day ago`;
  return d.toLocaleDateString();
}

export default function DashboardSidePanel({
  open,
  onClose,
  project,
  recentTasks,
  recentAudit,
  assessmentSections,
  formatAssessmentForDisplay,
  getFeatureName,
  openNodeModal,
  setMainTab,
  openProjectModal,
}) {
  const [tasksExpanded, setTasksExpanded] = useState(false);
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (open) {
      setVisible(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      <div
        className="dashboard-side-panel-overlay"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={`dashboard-side-panel ${visible ? 'is-visible' : ''}`}
        role="dialog"
        aria-label="Dashboard info"
      >
        <div className="dashboard-side-panel-header d-flex align-items-center justify-content-between">
          <span className="dashboard-side-panel-title">Info</span>
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-muted"
            onClick={onClose}
            aria-label="Close panel"
          >
            Close
          </button>
        </div>
        <div className="dashboard-side-panel-content">
          {project && (
            <section className="dashboard-side-panel-section">
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <span className="fw-medium">{project.name}</span>
                {project.type && (
                  <span className="project-type-badge small">{project.type}</span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => {
                    openProjectModal();
                    onClose();
                  }}
                >
                  Edit
                </button>
              </div>
              {project.summary && (
                <p className="text-muted small mb-0 mt-1">
                  {project.summary.slice(0, 120)}
                  {project.summary.length > 120 ? '…' : ''}
                </p>
              )}
            </section>
          )}

          <section className="dashboard-side-panel-section">
            <div className="d-flex align-items-center justify-content-between mb-1">
              <h6 className="text-muted text-uppercase small mb-0">Overview</h6>
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-muted small"
                onClick={() => {
                  setMainTab('overview');
                  onClose();
                }}
              >
                See full
              </button>
            </div>
            <div className="dashboard-analysis-content small">
              {assessmentSections ? (
                <div className="assessment-sections">
                  {assessmentSections.overview && (
                    <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>
                      {assessmentSections.overview.slice(0, 400)}
                      {assessmentSections.overview.length > 400 ? '…' : ''}
                    </p>
                  )}
                  {assessmentSections.analysis && (
                    <p className="mb-0 text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                      {assessmentSections.analysis.slice(0, 300)}
                      {assessmentSections.analysis.length > 300 ? '…' : ''}
                    </p>
                  )}
                </div>
              ) : project?.assessment ? (
                <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                  {formatAssessmentForDisplay(project.assessment).slice(0, 500)}
                  {'…'}
                </p>
              ) : (
                <p className="text-muted mb-0">No overview yet. Run Reassess to generate.</p>
              )}
            </div>
          </section>

          <section className="dashboard-side-panel-section">
            <h6 className="text-muted text-uppercase small mb-2">Recent tasks</h6>
            <div className="rounded border border-secondary border-opacity-25 overflow-hidden">
              {!recentTasks.length ? (
                <div className="p-3 text-muted small">No tasks yet.</div>
              ) : (
                <>
                  <ul
                    className={`list-group list-group-flush dashboard-recent-list ${tasksExpanded ? 'expanded' : ''}`}
                  >
                    {recentTasks.map((t) => (
                      <li
                        key={t.id}
                        className="list-group-item list-group-item-action py-2 px-3 d-flex justify-content-between align-items-center gap-2"
                      >
                        <div className="min-width-0 flex-grow-1">
                          <button
                            type="button"
                            className="btn btn-link btn-sm p-0 text-start text-decoration-none text-dark text-truncate d-block w-100"
                            onClick={() => {
                              openNodeModal(t);
                              onClose();
                            }}
                          >
                            {t.title}
                          </button>
                          <div className="small text-muted">
                            {t.status} · {getFeatureName(t.feature_id)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary flex-shrink-0"
                          onClick={() => {
                            openNodeModal(t);
                            onClose();
                          }}
                        >
                          Open
                        </button>
                      </li>
                    ))}
                  </ul>
                  {recentTasks.length > 3 && (
                    <div className="p-2 border-top border-secondary border-opacity-25 text-center">
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted"
                        onClick={() => setTasksExpanded((e) => !e)}
                      >
                        {tasksExpanded ? 'Show less' : `Show rest (${recentTasks.length - 3} more)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          <section className="dashboard-side-panel-section">
            <h6 className="text-muted text-uppercase small mb-2">Recent actions</h6>
            <div className="rounded border border-secondary border-opacity-25 overflow-hidden">
              {!recentAudit.length ? (
                <div className="p-3 text-muted small">No recent actions.</div>
              ) : (
                <>
                  <ul
                    className={`list-group list-group-flush dashboard-recent-list ${actionsExpanded ? 'expanded' : ''}`}
                  >
                    {recentAudit.map((entry) => (
                      <li key={entry.id} className="list-group-item py-2 px-3 small">
                        <span className="text-capitalize fw-medium">
                          {entry.phase || 'activity'}
                        </span>
                        <span className="text-muted ms-2">
                          {formatRelative(entry.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {recentAudit.length > 3 && (
                    <div className="p-2 border-top border-secondary border-opacity-25 text-center">
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted"
                        onClick={() => setActionsExpanded((e) => !e)}
                      >
                        {actionsExpanded
                          ? 'Show less'
                          : `Show rest (${recentAudit.length - 3} more)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
