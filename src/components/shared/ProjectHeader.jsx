import React from 'react';

/**
 * Shared project header: title, type badge, optional summary, and action buttons.
 * Use when a view shows a single project context.
 */
export default function ProjectHeader({ project, children, showSummary = true }) {
  if (!project?.name) return null;
  return (
    <section className="project-title-section mb-3">
      <div className="d-flex align-items-start gap-2 flex-wrap">
        <div className="flex-grow-1">
          <h1 className="page-title mb-0">{project.name}</h1>
          {project.type && <span className="project-type-badge">{project.type}</span>}
          {showSummary && project.summary && (
            <div className="project-summary-block mt-2">
              <div className="text-uppercase small text-muted mb-1">Project summary</div>
              <p className="project-summary-text mb-0">{project.summary}</p>
            </div>
          )}
        </div>
        {children && <div className="d-flex gap-1 flex-wrap">{children}</div>}
      </div>
    </section>
  );
}
