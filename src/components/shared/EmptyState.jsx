import React from 'react';

/**
 * Shared empty state: title, message, optional actions (e.g. "New project").
 */
export default function EmptyState({ title, message, children, className = '' }) {
  return (
    <div className={`dashboard-view dashboard-empty ${className}`.trim()}>
      <div className="dashboard-empty-content">
        {title && <h1 className="page-title mb-3">{title}</h1>}
        {message && <p className="text-muted mb-4">{message}</p>}
        {children && <div className="dashboard-empty-actions mb-3">{children}</div>}
      </div>
    </div>
  );
}
