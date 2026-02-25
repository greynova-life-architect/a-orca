import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function ProjectModal() {
  const showProjectModal = useStore((s) => s.showProjectModal);
  const editProjectName = useStore((s) => s.editProjectName);
  const editProjectType = useStore((s) => s.editProjectType);
  const editProjectSummary = useStore((s) => s.editProjectSummary);
  const editProjectAssessment = useStore((s) => s.editProjectAssessment);
  const closeProjectModal = useStore((s) => s.closeProjectModal);
  const saveProject = useStore((s) => s.saveProject);

  const setEditProjectName = (v) => useStore.setState({ editProjectName: v });
  const setEditProjectType = (v) => useStore.setState({ editProjectType: v });
  const setEditProjectSummary = (v) =>
    useStore.setState({ editProjectSummary: v });
  const setEditProjectAssessment = (v) =>
    useStore.setState({ editProjectAssessment: v });

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeProjectModal}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={saveProject}>
        Save
      </button>
    </>
  );

  return (
    <Modal
      show={showProjectModal}
      onClose={closeProjectModal}
      title="Edit project"
      footer={footer}
      id="projectModal"
    >
      <div className="mb-2">
        <label className="form-label small">Project name</label>
        <input
          type="text"
          className="form-control"
          value={editProjectName}
          onChange={(e) => setEditProjectName(e.target.value)}
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Project type</label>
        <input
          type="text"
          className="form-control"
          value={editProjectType}
          onChange={(e) => setEditProjectType(e.target.value)}
          placeholder="e.g. Web App, API"
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Description</label>
        <textarea
          className="form-control"
          rows={3}
          value={editProjectSummary}
          onChange={(e) => setEditProjectSummary(e.target.value)}
          placeholder="Brief description of the project..."
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Full assessment</label>
        <textarea
          className="form-control font-monospace"
          rows={8}
          value={editProjectAssessment}
          onChange={(e) => setEditProjectAssessment(e.target.value)}
          placeholder="Detailed analysis from assessment..."
        />
        <small className="text-muted">
          From Reassess or Attach. Edit to refine.
        </small>
      </div>
    </Modal>
  );
}
