import React from 'react';
import { useStore } from '../store';

export default function Sidebar() {
  const projectList = useStore((s) => s.projectList);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const defaultProjectId = useStore((s) => s.defaultProjectId);
  const loadProject = useStore((s) => s.loadProject);
  const setDefaultProjectId = useStore((s) => s.setDefaultProjectId);
  const openNewProjectModal = useStore((s) => s.openNewProjectModal);
  const openAttachModal = useStore((s) => s.openAttachModal);

  const handleDefaultClick = (e, projectId) => {
    e.preventDefault();
    e.stopPropagation();
    setDefaultProjectId(defaultProjectId === projectId ? '' : projectId);
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-header">
        <span className="logo">a-orca</span>
      </div>
      <div className="sidebar-actions">
        <button
          type="button"
          className="btn btn-sidebar-primary"
          onClick={openNewProjectModal}
        >
          + New project
        </button>
        <button
          type="button"
          className="btn btn-sidebar-secondary"
          onClick={openAttachModal}
        >
          Attach
        </button>
      </div>
      <div className="sidebar-projects">
        <div className="sidebar-label">Projects</div>
        {projectList.length === 0 ? (
          <div className="sidebar-empty">No projects yet</div>
        ) : (
          projectList.map((p) => (
            <div
              key={p.id}
              className={`sidebar-project-item-wrap ${currentProjectId === p.id ? 'active' : ''}`}
            >
              <button
                type="button"
                className="sidebar-project-item"
                onClick={() => loadProject(p.id)}
              >
                <span className="project-item-name">{p.name || p.id}</span>
              </button>
              <button
                type="button"
                className="sidebar-project-default-btn"
                onClick={(e) => handleDefaultClick(e, p.id)}
                title={defaultProjectId === p.id ? 'Clear default project' : 'Set as default project'}
                aria-label={defaultProjectId === p.id ? 'Clear default project' : 'Set as default project'}
              >
                {defaultProjectId === p.id ? '★' : '☆'}
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
