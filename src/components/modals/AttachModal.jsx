import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function AttachModal() {
  const showAttachModal = useStore((s) => s.showAttachModal);
  const attachPath = useStore((s) => s.attachPath);
  const attachName = useStore((s) => s.attachName);
  const closeAttachModal = useStore((s) => s.closeAttachModal);
  const openBrowseModal = useStore((s) => s.openBrowseModal);
  const attachProject = useStore((s) => s.attachProject);

  const setAttachPath = (v) => useStore.setState({ attachPath: v });
  const setAttachName = (v) => useStore.setState({ attachName: v });

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeAttachModal}>
        Cancel
      </button>
      <button
        type="button"
        className="btn btn-primary"
        onClick={attachProject}
        disabled={!attachPath}
      >
        Attach and assess
      </button>
    </>
  );

  return (
    <Modal
      show={showAttachModal}
      onClose={closeAttachModal}
      title="Attach existing project"
      footer={footer}
      id="attachModal"
    >
      <p className="text-muted small">
        Select the folder of an existing codebase. The agent will assess it and
        produce a features list.
      </p>
      <div className="mb-2">
        <label className="form-label small">Project name</label>
        <input
          type="text"
          className="form-control"
          value={attachName}
          onChange={(e) => setAttachName(e.target.value)}
          placeholder="My Project"
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Folder path</label>
        <div className="d-flex gap-2">
          <input
            type="text"
            className="form-control font-monospace"
            value={attachPath}
            onChange={(e) => setAttachPath(e.target.value)}
            placeholder="Select a folder..."
            readOnly
          />
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={openBrowseModal}
          >
            Browse
          </button>
        </div>
      </div>
    </Modal>
  );
}
