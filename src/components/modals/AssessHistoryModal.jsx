import React from 'react';
import { useStore } from '../../store';
import { formatAssessmentForDisplay } from '../../store/selectors';
import { formatAuditDate } from '../../utils/format';
import Modal from './Modal';

export default function AssessHistoryModal() {
  const showAssessHistoryModal = useStore((s) => s.showAssessHistoryModal);
  const closeAssessHistoryModal = useStore((s) => s.closeAssessHistoryModal);
  const assessHistory = useStore((s) => s.assessHistory);
  const selectedAuditEntry = useStore((s) => s.selectedAuditEntry);
  const setSelectedAuditEntry = useStore((s) => s.setSelectedAuditEntry);

  return (
    <Modal
      show={showAssessHistoryModal}
      onClose={closeAssessHistoryModal}
      title="Assessment history — Full data logs"
      size="xl"
      id="assess-history-modal"
      footer={
        <button
          type="button"
          className="btn btn-secondary"
          onClick={closeAssessHistoryModal}
        >
          Close
        </button>
      }
    >
      <div className="assess-history-body overflow-auto" style={{ maxHeight: '70vh' }}>
        {!assessHistory.length ? (
          <div className="text-muted">
            No assessment history yet. Run Reassess to create logs.
          </div>
        ) : (
          <div className="assess-history-list">
            {assessHistory.map((entry) => (
              <div
                key={entry.id}
                className={`assess-history-entry border rounded p-3 mb-3 ${selectedAuditEntry?.id === entry.id ? 'border-primary' : ''}`}
              >
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="text-muted small">
                    {formatAuditDate(entry.created_at)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={() =>
                      setSelectedAuditEntry(
                        selectedAuditEntry?.id === entry.id ? null : entry
                      )
                    }
                  >
                    {selectedAuditEntry?.id === entry.id
                      ? 'Hide logs'
                      : 'Show full logs'}
                  </button>
                </div>
                {selectedAuditEntry?.id === entry.id && (
                  <>
                    <div className="small text-muted mb-1">
                      <strong>Prompt:</strong>
                      <pre
                        className="audit-log-pre mb-2 mt-1 p-2 rounded overflow-auto"
                        style={{ maxHeight: 150 }}
                      >
                        {entry.prompt_text}
                      </pre>
                    </div>
                    <div className="small">
                      <strong>Full response (agent output):</strong>
                      <pre
                        className="audit-log-pre mt-1 p-2 rounded overflow-auto"
                        style={{
                          maxHeight: 400,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {formatAssessmentForDisplay(entry.response_text)}
                      </pre>
                    </div>
                  </>
                )}
                {selectedAuditEntry?.id !== entry.id && (
                  <div className="small">
                    {(entry.response_text || '').slice(0, 200)}
                    {(entry.response_text || '').length > 200 ? '...' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
