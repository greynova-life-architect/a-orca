import React, { useState } from 'react';
import { useStore } from '../../store';
import {
  getAssessmentSections,
  parseAnalysisSubsections,
} from '../../store/selectors';
import ProjectHeader from '../shared/ProjectHeader';

export default function AnalysisView() {
  const project = useStore((s) => s.project);
  const assessmentSections = useStore(getAssessmentSections);
  const [showRawOutput, setShowRawOutput] = useState(false);

  return (
    <div className="analysis-view">
      <div className="analysis-centering">
        <ProjectHeader project={project} showSummary={false} />
        <div
          className="assessment-content p-4 rounded border"
          style={{ maxHeight: '70vh', overflowY: 'auto' }}
        >
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
                    {parseAnalysisSubsections(assessmentSections.analysis).map(
                      (sub, si) =>
                        sub.title ? (
                          <details
                            key={si}
                            className="assessment-subsection mb-2 rounded border"
                          >
                            <summary className="assessment-subsection-title px-3 py-2 cursor-pointer list-none">
                              <span className="assessment-subsection-title-text">
                                {sub.title}
                              </span>
                            </summary>
                            <div
                              className="assessment-subsection-body px-3 pb-3 pt-1"
                              style={{ whiteSpace: 'pre-wrap' }}
                            >
                              {sub.body
                                .split(/\n\n+/)
                                .filter(Boolean)
                                .map((p, pi) => (
                                  <p
                                    key={pi}
                                    className="assessment-section-body mb-2"
                                  >
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
                                <p
                                  key={pi}
                                  className="assessment-section-body mb-2"
                                >
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
          ) : project.assessment ? (
            <div className="assessment-unparsed-fallback">
              <p className="text-muted mb-2">
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
                    maxHeight: '40vh',
                    overflowY: 'auto',
                  }}
                >
                  {project.assessment}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-muted">
              No overview yet. Load a project and run Reassess to generate overview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
