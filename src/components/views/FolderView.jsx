import React from 'react';
import { useStore } from '../../store';
import { flattenFolderTree } from '../../store/selectors';
import ProjectHeader from '../shared/ProjectHeader';

export default function FolderView() {
  const project = useStore((s) => s.project);
  const folderTree = useStore((s) => s.folderTree);
  const folderExpanded = useStore((s) => s.folderExpanded);
  const fetchFolderTree = useStore((s) => s.fetchFolderTree);
  const toggleFolder = useStore((s) => s.toggleFolder);

  const flatList = folderTree
    ? flattenFolderTree(folderTree, 0, folderExpanded, [])
    : [];

  return (
    <div className="folder-view">
      <ProjectHeader project={project} showSummary={false} />
      <section className="folder-section">
        <div className="tree-container">
          <div className="folder-tree-header mb-2 d-flex justify-content-between align-items-center">
            <span className="text-muted small">Explorer</span>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={fetchFolderTree}
            >
              Refresh
            </button>
          </div>
          {folderTree && (
            <div className="folder-tree">
              {flatList.map(({ node, depth }) => (
                <div
                  key={node.path}
                  className="folder-tree-row"
                  style={{ paddingLeft: depth * 16 }}
                  onClick={() =>
                    node.type === 'dir' &&
                    node.children?.length &&
                    toggleFolder(node.path)
                  }
                >
                  {node.type === 'dir' && node.children?.length && (
                    <span className="tree-toggle">
                      {folderExpanded[node.path] !== false ? '▼' : '▶'}
                    </span>
                  )}
                  <span className="tree-icon">
                    {(node.type || 'dir') === 'dir' ? '📁' : '📄'}
                  </span>
                  <span className="tree-name font-monospace">{node.name}</span>
                </div>
              ))}
            </div>
          )}
          {project.root_path && !folderTree && (
            <div className="text-muted small">Loading folder structure...</div>
          )}
          {project.root_path && folderTree === null && (
            <div className="text-muted small">
              Could not load folder structure.
            </div>
          )}
          {!project.root_path && (
            <div className="text-muted small">
              No folder path. Attach a project with a root path to see its
              structure.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
