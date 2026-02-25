import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function PromptModal() {
  const showPromptModal = useStore((s) => s.showPromptModal);
  const reviewingNode = useStore((s) => s.reviewingNode);
  const updateReviewingNode = useStore((s) => s.updateReviewingNode);
  const closePromptModal = useStore((s) => s.closePromptModal);
  const approvePrompt = useStore((s) => s.approvePrompt);
  const rejectPrompt = useStore((s) => s.rejectPrompt);

  const footer = (
    <>
      <button type="button" className="btn btn-danger" onClick={rejectPrompt}>
        Reject
      </button>
      <button type="button" className="btn btn-secondary" onClick={closePromptModal}>
        Cancel
      </button>
      <button type="button" className="btn btn-success" onClick={approvePrompt}>
        Approve
      </button>
    </>
  );

  return (
    <Modal
      show={showPromptModal}
      onClose={closePromptModal}
      title={`Review prompt — ${reviewingNode?.title || ''}`}
      footer={footer}
      size="lg"
      id="promptModal"
    >
      {reviewingNode && (
        <>
          {reviewingNode.complexity && (
            <div className="mb-2">
              <span
                className={`complexity-badge mb-1 complexity-${reviewingNode.complexity}`}
              >
                {(reviewingNode.complexity || '').replace('_', ' ')}
              </span>
              <span className="text-muted small ms-1">
                {reviewingNode.complexity === 'complex'
                  ? '— Requires detailed review before approval'
                  : reviewingNode.complexity === 'medium'
                    ? '— Review recommended'
                    : '— Quick review'}
              </span>
            </div>
          )}
          <div className="mb-2">
            <label className="form-label small">
              Agent prompt (editable before approval)
            </label>
            <textarea
              className="form-control font-monospace"
              rows={6}
              value={reviewingNode.prompt || ''}
              onChange={(e) =>
                updateReviewingNode({ prompt: e.target.value })
              }
              placeholder="Generated instruction"
            />
          </div>
        </>
      )}
    </Modal>
  );
}
