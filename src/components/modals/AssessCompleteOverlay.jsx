import React, { useState } from 'react';
import { useStore } from '../../store';
import {
  getAssessmentSections,
  parseAnalysisSubsections,
} from '../../store/selectors';
import Modal from './Modal';

export default function AssessCompleteOverlay() {
  const [showRawOutput, setShowRawOutput] = useState(false);
  const showAssessCompleteModal = useStore((s) => s.showAssessCompleteModal);
  const dismissAssessCompleteModal = useStore(
    (s) => s.dismissAssessCompleteModal
  );
  const cursorAssessFolder = useStore((s) => s.cursorAssessFolder);
  const cursorFileActivity = useStore((s) => s.cursorFileActivity);
  const project = useStore((s) => s.project);
  const assessmentSections = useStore(getAssessmentSections);

  return (
    <Modal
      show={showAssessCompleteModal}
      onClose={dismissAssessCompleteModal}
      title="Assessment complete"
      size="lg"
      id="assess-complete-modal"
      footer={
        <button
          type="button"
          className="btn btn-primary"
          onClick={dismissAssessCompleteModal}
        >
          Continue
        </button>
      }
    >
      <div className="assess-complete-body overflow-auto" style={{ maxHeight: '70vh' }}>
        {cursorAssessFolder && (
          <div className="assess-complete-folder mb-3">
            <div className="text-muted small text-uppercase mb-1">
              Folder assessed
            </div>
            <div className="font-monospace small text-break">
              {cursorAssessFolder}
            </div>
          </div>
        )}
        <div className="assess-complete-section mb-4">
          <div className="text-muted small text-uppercase mb-2">
            Files scanned and read
          </div>
          <div className="assess-complete-files">
            {cursorFileActivity.map((act, i) => (
              <div
                key={i}
                className="assess-complete-file-item d-flex align-items-start gap-2 py-2 border-bottom border-secondary"
              >
                {act.done ? (
                  <span className="text-success flex-shrink-0">✓</span>
                ) : (
                  <span className="text-primary flex-shrink-0">⋯</span>
                )}
                <div className="flex-grow-1 min-w-0">
                  <span className="font-monospace small">{act.label}</span>
                  {act.count !== undefined && (
                    <span className="badge bg-secondary ms-1">
                      {act.count || 0}
                    </span>
                  )}
                  {act.files?.length > 0 && (
                    <div className="d-flex flex-wrap gap-1 mt-1">
                      {(act.files || []).slice(0, 5).map((fp, fi) => (
                        <span
                          key={fi}
                          className="badge bg-primary bg-opacity-50 small"
                        >
                          {fp.split(/[/\\]/).slice(-2).join('/')}
                        </span>
                      ))}
                      {(act.count || 0) > 5 && (
                        <span className="badge bg-secondary small">
                          +{(act.count || 0) - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        {project.assessment && (
          <div className="assess-complete-section mb-4">
            <div className="text-muted small text-uppercase mb-2">
              Overview
            </div>
            <div className="assess-complete-review p-3 rounded border overflow-auto">
              {assessmentSections ? (
                <div className="assessment-sections">
                  {assessmentSections.overview && (
                    <section className="assessment-section assessment-overview-standalone mb-3">
                      <h6 className="assessment-section-title">Overview</h6>
                      <p
                        className="assessment-section-body"
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        {assessmentSections.overview}
                      </p>
                    </section>
                  )}
                  {assessmentSections.analysis && (
                    <section className="assessment-section mb-3">
                      <h6 className="assessment-section-title">Detailed analysis</h6>
                      <div className="assessment-analysis-subsections">
                        {parseAnalysisSubsections(assessmentSections.analysis).map((sub, si) =>
                          sub.title ? (
                            <details
                              key={si}
                              className="assessment-subsection mb-2 rounded border"
                            >
                              <summary className="assessment-subsection-title px-3 py-2 cursor-pointer list-none">
                                <span className="assessment-subsection-title-text">{sub.title}</span>
                              </summary>
                              <div
                                className="assessment-subsection-body px-3 pb-3 pt-1"
                                style={{ whiteSpace: 'pre-wrap' }}
                              >
                                {sub.body
                                  .split(/\n\n+/)
                                  .filter(Boolean)
                                  .map((p, pi) => (
                                    <p key={pi} className="assessment-section-body mb-2">
                                      {p}
                                    </p>
                                  ))}
                              </div>
                            </details>
                          ) : (
                            <div
                              key={si}
                              className="assessment-subsection-body mb-3"
                              style={{ whiteSpace: 'pre-wrap' }}
                            >
                              {sub.body
                                .split(/\n\n+/)
                                .filter(Boolean)
                                .map((p, pi) => (
                                  <p key={pi} className="assessment-section-body mb-2">
                                    {p}
                                  </p>
                                ))}
                            </div>
                          )
                        )}
                      </div>
                    </section>
                  )}
                  {assessmentSections.features?.length > 0 && (
                    <section className="assessment-section">
                      <h6 className="assessment-section-title">Features identified from codebase</h6>
                      <ul className="assessment-feature-list list-unstyled mb-0">
                        {assessmentSections.features.map((f) => (
                          <li key={f.id || f.name} className="assessment-feature-item mb-2 p-2 rounded border border-secondary border-opacity-25">
                            <strong>{f.name}</strong>
                            {f.id && <span className="text-muted small"> ({f.id})</span>}
                            {f.description && (
                              <p className="assessment-feature-desc mb-0 mt-1 text-muted small" style={{ whiteSpace: 'pre-wrap' }}>
                                {f.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </div>
              ) : (
                <div className="assessment-unparsed-fallback">
                  <p className="text-muted mb-2 small">
                    Assessment could not be parsed for display.
                  </p>
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-muted"
                    onClick={() => setShowRawOutput(!showRawOutput)}
                    aria-expanded={showRawOutput}
                  >
                    {showRawOutput ? 'Hide' : 'Show'} raw output
                  </button>
                  {showRawOutput && (
                    <pre
                      className="assessment-raw-output mt-2 p-3 rounded border small"
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: '30vh',
                        overflowY: 'auto',
                      }}
                    >
                      {project.assessment}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
