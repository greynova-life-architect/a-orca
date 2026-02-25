import React from 'react';
import { useStore } from '../store';
export default function Header() {
  const project = useStore((s) => s.project);
  const features = useStore((s) => s.features);
  const mapNodes = useStore((s) => s.mapNodes);
  const users = useStore((s) => s.users);
  const currentUser = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const mapNodesLength = mapNodes.length;

  return (
    <header className="app-header">
      <div className="header-left">
        {project.name ? (
          <>
            <span className="project-title">{project.name}</span>
            <span className="project-meta">
              {project.type} · {features.length} features · {mapNodesLength} tasks
            </span>
          </>
        ) : (
          <span className="project-title placeholder">Select a project</span>
        )}
      </div>
      <div className="header-right">
        <select
          className="form-select form-select-sm user-select"
          style={{ width: 'auto' }}
          value={currentUser}
          onChange={(e) => setCurrentUser(e.target.value)}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
