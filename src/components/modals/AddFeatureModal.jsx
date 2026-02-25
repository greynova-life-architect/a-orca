import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function AddFeatureModal() {
  const showAddFeatureModal = useStore((s) => s.showAddFeatureModal);
  const newFeatureName = useStore((s) => s.newFeatureName);
  const newFeatureDescription = useStore((s) => s.newFeatureDescription);
  const closeAddFeatureModal = useStore((s) => s.closeAddFeatureModal);
  const addFeature = useStore((s) => s.addFeature);

  const setNewFeatureName = (v) =>
    useStore.setState({ newFeatureName: v });
  const setNewFeatureDescription = (v) =>
    useStore.setState({ newFeatureDescription: v });

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeAddFeatureModal}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={addFeature}>
        Add
      </button>
    </>
  );

  return (
    <Modal
      show={showAddFeatureModal}
      onClose={closeAddFeatureModal}
      title="Add feature"
      footer={footer}
      id="addFeatureModal"
    >
      <div className="mb-2">
        <label className="form-label small">Feature name</label>
        <input
          type="text"
          className="form-control"
          value={newFeatureName}
          onChange={(e) => setNewFeatureName(e.target.value)}
          placeholder="e.g. Authentication"
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Description</label>
        <textarea
          className="form-control"
          rows={5}
          value={newFeatureDescription}
          onChange={(e) => setNewFeatureDescription(e.target.value)}
          placeholder="Detailed context for the AI: architecture, patterns, conventions, APIs, or constraints for this feature..."
        />
        <small className="text-muted">
          Used as reference when the agent implements tasks in this feature.
        </small>
      </div>
    </Modal>
  );
}
