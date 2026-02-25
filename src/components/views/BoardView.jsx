import React from 'react';
import { useStore } from '../../store';
import { getNodesByStatusAndFeature, getColumns } from '../../store/selectors';
import BoardColumn from '../board/BoardColumn';
import ProjectHeader from '../shared/ProjectHeader';

export default function BoardView() {
  const project = useStore((s) => s.project);
  const setMainTab = useStore((s) => s.setMainTab);
  const openProjectModal = useStore((s) => s.openProjectModal);
  const reassessProject = useStore((s) => s.reassessProject);
  const openAssessHistoryModal = useStore((s) => s.openAssessHistoryModal);
  const deleteProject = useStore((s) => s.deleteProject);

  const columns = getColumns();
  const nodesByStatusAndFeature = useStore(getNodesByStatusAndFeature);
  const features = useStore((s) => s.features);

  return (
    <div className="board-view">
      <ProjectHeader project={project}>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary"
          onClick={() => setMainTab('settings')}
          title="Add, edit, or remove AI agents"
        >
          Manage agents
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openProjectModal}>
          Edit
        </button>
        {project?.root_path && (
          <>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={reassessProject}>
              Reassess
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={openAssessHistoryModal}>
              Assessment history
            </button>
          </>
        )}
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={deleteProject}>
          Remove
        </button>
      </ProjectHeader>
      {!project.summary && !project.assessment && project.root_path && (
        <div className="project-assessment mt-3 p-3 rounded border border-warning">
          <p className="text-muted mb-0 small">
            No assessment yet. Run <strong>Reassess</strong> to analyze this
            project.
          </p>
        </div>
      )}
      <section className="board-section">
        <div className="board-columns">
          {columns.map((col) => (
            <BoardColumn
              key={col.id}
              column={col}
              colData={nodesByStatusAndFeature[col.id]}
              features={features}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
