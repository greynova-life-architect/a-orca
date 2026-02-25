import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function BrowseModal() {
  const showBrowseModal = useStore((s) => s.showBrowseModal);
  const browseCurrentPath = useStore((s) => s.browseCurrentPath);
  const browseItems = useStore((s) => s.browseItems);
  const browseLoading = useStore((s) => s.browseLoading);
  const browseError = useStore((s) => s.browseError);
  const browseInto = useStore((s) => s.browseInto);
  const browseGoUp = useStore((s) => s.browseGoUp);
  const browseParentPath = useStore((s) => s.browseParentPath);
  const selectFolder = useStore((s) => s.selectFolder);
  const closeBrowseModal = useStore((s) => s.closeBrowseModal);

  const footer = (
    <button type="button" className="btn btn-secondary" onClick={closeBrowseModal}>
      Cancel
    </button>
  );

  return (
    <Modal
      show={showBrowseModal}
      onClose={closeBrowseModal}
      title="Select folder"
      footer={footer}
      size="lg"
      id="browseModal"
    >
      <div className="browse-path-bar mb-2">
        <span className="text-muted small font-monospace">
          {browseCurrentPath || 'Select a location'}
        </span>
      </div>
      <div className="browse-toolbar mb-2 d-flex gap-1 align-items-center">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={browseGoUp}
          disabled={!browseParentPath}
        >
          ↑ Up
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={() => useStore.getState().browseLoad()}
        >
          ↻ Refresh
        </button>
        {browseCurrentPath && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => selectFolder(browseCurrentPath)}
          >
            Select this folder
          </button>
        )}
      </div>
      {browseError && (
        <div className="alert alert-danger py-2 mb-2">{browseError}</div>
      )}
      <div
        className="browse-list border rounded"
        style={{ maxHeight: 280, overflowY: 'auto' }}
      >
        {browseItems.map((item) => (
          <div
            key={item.path}
            className={`browse-item d-flex align-items-center gap-2 px-2 py-2 border-bottom border-secondary ${item.type === 'dir' ? 'browse-item-dir' : ''}`}
            onClick={() => item.type === 'dir' && browseInto(item.path)}
          >
            <span>{item.type === 'dir' ? '📁' : '📄'}</span>
            <span className="flex-grow-1">{item.name}</span>
            {item.type === 'dir' && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  selectFolder(item.path);
                }}
              >
                Select
              </button>
            )}
          </div>
        ))}
        {browseLoading && (
          <div className="p-3 text-center text-muted">Loading...</div>
        )}
        {!browseLoading && !browseItems.length && !browseError && (
          <div className="p-3 text-center text-muted">No folders here</div>
        )}
      </div>
    </Modal>
  );
}
