import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function NewProjectModal() {
  const showNewProjectModal = useStore((s) => s.showNewProjectModal);
  const newProjectName = useStore((s) => s.newProjectName);
  const closeNewProjectModal = useStore((s) => s.closeNewProjectModal);
  const createNewProject = useStore((s) => s.createNewProject);

  const setNewProjectName = (v) =>
    useStore.setState({ newProjectName: v });

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeNewProjectModal}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={createNewProject}>
        Create
      </button>
    </>
  );

  return (
    <Modal
      show={showNewProjectModal}
      onClose={closeNewProjectModal}
      title="New project"
      footer={footer}
      id="newProjectModal"
    >
      <p className="text-muted small">
        Create a new project and use Generate with Cursor to build a plan.
      </p>
      <div className="mb-2">
        <label className="form-label small">Project name</label>
        <input
          type="text"
          className="form-control"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="My Project"
        />
      </div>
    </Modal>
  );
}
