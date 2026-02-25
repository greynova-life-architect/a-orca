import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function EditFeatureModal() {
  const showEditFeatureModal = useStore((s) => s.showEditFeatureModal);
  const editingFeature = useStore((s) => s.editingFeature);
  const closeEditFeatureModal = useStore((s) => s.closeEditFeatureModal);
  const saveFeature = useStore((s) => s.saveFeature);
  const updateEditingFeature = (updates) =>
    useStore.setState((s) => ({
      editingFeature: s.editingFeature
        ? { ...s.editingFeature, ...updates }
        : null,
    }));

  const footer = (
    <>
      <button type="button" className="btn btn-secondary" onClick={closeEditFeatureModal}>
        Cancel
      </button>
      <button type="button" className="btn btn-primary" onClick={saveFeature}>
        Save
      </button>
    </>
  );

  return (
    <Modal
      show={showEditFeatureModal}
      onClose={closeEditFeatureModal}
      title={editingFeature?.name || 'Edit feature'}
      footer={footer}
      size="lg"
      id="editFeatureModal"
    >
      {editingFeature && (
        <>
          <div className="mb-2">
            <label className="form-label small">Feature name</label>
            <input
              type="text"
              className="form-control"
              value={editingFeature.name}
              onChange={(e) =>
                updateEditingFeature({ name: e.target.value })
              }
            />
          </div>
          <div className="mb-2">
            <label className="form-label small">Description</label>
            <textarea
              className="form-control"
              rows={6}
              value={editingFeature.description || ''}
              onChange={(e) =>
                updateEditingFeature({ description: e.target.value })
              }
              placeholder="Detailed context for the AI: architecture, patterns, conventions, APIs, or constraints..."
            />
            <small className="text-muted">
              Used as reference when the agent implements tasks in this feature.
            </small>
          </div>
        </>
      )}
    </Modal>
  );
}
