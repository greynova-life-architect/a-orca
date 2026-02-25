import React, { useState } from 'react';
import { useStore } from '../../store';
import { getTreeRoots } from '../../store/selectors';
import ProjectHeader from '../shared/ProjectHeader';

function FeatureCard({ feature }) {
  const [open, setOpen] = useState(false);
  const getChildren = useStore((s) => s.getChildren);
  const getUserById = useStore((s) => s.getUserById);
  const openEditFeatureModal = useStore((s) => s.openEditFeatureModal);
  const deleteFeature = useStore((s) => s.deleteFeature);
  const children = getChildren(feature.id);

  const statusCounts = children.reduce((acc, n) => {
    const s = n.status || 'todo';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});
  const statusSummary =
    Object.keys(statusCounts).length > 0
      ? Object.entries(statusCounts)
          .map(([k, v]) => `${v} ${k.replace('_', ' ')}`)
          .join(', ')
      : '';

  return (
    <div className="feature-card card bg-dark border-secondary border-opacity-25 mb-3">
      <div className="card-body py-3 px-3">
        <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
          <div className="flex-grow-1 min-width-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-link btn-sm p-0 text-muted border-0"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
              >
                {open ? '▼' : '▶'}
              </button>
              <span className="fw-semibold feature-card-name">{feature.name}</span>
              <span className="text-muted small">
                {children.length} {children.length === 1 ? 'module' : 'modules'}
              </span>
              {statusSummary && (
                <span className="text-muted small">({statusSummary})</span>
              )}
            </div>
            {feature.description && (
              <p
                className="feature-card-desc text-muted small mt-1 mb-0"
                style={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: open ? 'none' : '2.4em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {feature.description}
              </p>
            )}
          </div>
          <div className="d-flex gap-1 flex-shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              title="Edit feature"
              onClick={() => openEditFeatureModal(feature)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              title="Delete feature"
              onClick={() => deleteFeature(feature.id)}
            >
              Delete
            </button>
          </div>
        </div>
        {open && (
          <div className="feature-card-modules mt-3 pt-2 border-top border-secondary border-opacity-25">
            {children.length === 0 ? (
              <p className="text-muted small mb-0">No tasks yet for this feature.</p>
            ) : (
              <ul className="list-unstyled mb-0 small">
                {children.map((mod) => (
                  <li
                    key={mod.id}
                    className="d-flex align-items-center gap-2 py-1 flex-wrap"
                  >
                    <span className={`badge status-${mod.status}`}>{mod.status}</span>
                    <span>{mod.title}</span>
                    <span className="text-muted">
                      {getUserById(mod.assignee_id)?.name}
                    </span>
                    {mod.progress !== undefined && (
                      <span className="text-muted">{mod.progress || 0}%</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeaturesView() {
  const project = useStore((s) => s.project);
  const getChildren = useStore((s) => s.getChildren);
  const openAddFeatureModal = useStore((s) => s.openAddFeatureModal);
  const treeRoots = useStore(getTreeRoots);

  const featuresWithTasks = treeRoots.filter((f) => getChildren(f.id).length > 0);
  const featuresWithoutTasks = treeRoots.filter((f) => getChildren(f.id).length === 0);

  return (
    <div className="features-view">
      <ProjectHeader project={project} showSummary={false} />
      <section className="features-section">
        <h2 className="h6 text-muted text-uppercase mb-1">Project features and modules</h2>
        <p className="text-muted small mb-3">
          Features you&apos;ve added for planning; add tasks from Agent Planning or Pending Tasks.
        </p>
        <div className="d-flex align-items-center justify-content-between mb-3">
          <span className="text-muted small" />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={openAddFeatureModal}
          >
            + Add feature
          </button>
        </div>

        {treeRoots.length === 0 ? (
          <div className="text-muted small py-4 rounded border border-secondary border-opacity-25 text-center">
            No features yet. Add a feature to plan work.
          </div>
        ) : (
          <>
            {featuresWithTasks.length > 0 && (
              <div className="mb-4">
                <h3 className="h6 text-muted mb-2">In progress</h3>
                <p className="text-muted small mb-2">
                  Features that have at least one task (module).
                </p>
                {featuresWithTasks.map((feat) => (
                  <FeatureCard key={feat.id} feature={feat} />
                ))}
              </div>
            )}
            {featuresWithoutTasks.length > 0 && (
              <div>
                <h3 className="h6 text-muted mb-2">Planned (no tasks yet)</h3>
                <p className="text-muted small mb-2">
                  Future features; add tasks from Agent Planning or Pending Tasks.
                </p>
                {featuresWithoutTasks.map((feat) => (
                  <FeatureCard key={feat.id} feature={feat} />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
