import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import { getAssessmentSections, formatAssessmentForDisplay } from '../../store/selectors';
import API from '../../api';
import PlanningView from './PlanningView';
import DashboardSidePanel from '../DashboardSidePanel';

const RECENT_TASKS_COUNT = 10;
const RECENT_ACTIONS_COUNT = 10;

export default function DashboardView() {
  const project = useStore((s) => s.project);
  const mapNodes = useStore((s) => s.mapNodes);
  const features = useStore((s) => s.features);
  const currentProjectId = useStore((s) => s.currentProjectId);
  const setMainTab = useStore((s) => s.setMainTab);
  const openProjectModal = useStore((s) => s.openProjectModal);
  const openNewProjectModal = useStore((s) => s.openNewProjectModal);
  const reassessProject = useStore((s) => s.reassessProject);
  const openNodeModal = useStore((s) => s.openNodeModal);
  const loadProject = useStore((s) => s.loadProject);
  const projectList = useStore((s) => s.projectList);

  const assessmentSections = useStore(getAssessmentSections);

  const [recentAudit, setRecentAudit] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const planningSectionRef = useRef(null);

  useEffect(() => {
    if (!currentProjectId) {
      setRecentAudit([]);
      return;
    }
    API.projects
      .audit(currentProjectId)
      .then((d) => setRecentAudit((d.audit || []).slice(0, RECENT_ACTIONS_COUNT)))
      .catch(() => setRecentAudit([]));
  }, [currentProjectId]);

  const recentTasks = (mapNodes || [])
    .slice()
    .sort((a, b) => {
      const ta = a.updated_at || a.created_at || '';
      const tb = b.updated_at || b.created_at || '';
      return tb.localeCompare(ta);
    })
    .slice(0, RECENT_TASKS_COUNT);

  const getFeatureName = (featureId) =>
    features.find((f) => f.id === featureId)?.name || featureId || '—';

  if (!project?.name) {
    return (
      <div className="dashboard-view dashboard-empty">
        <div className="dashboard-empty-content">
          <h1 className="page-title mb-3">Dashboard</h1>
          <p className="text-muted mb-4">
            Select a project to get started. Set a default project in Settings so we open it automatically next time.
          </p>
          <div className="dashboard-empty-actions mb-3">
            <button type="button" className="btn btn-primary" onClick={openNewProjectModal}>
              + New project
            </button>
          </div>
          {projectList.length > 0 && (
            <div className="dashboard-empty-list">
              <div className="small text-muted text-uppercase mb-2">Or pick a project</div>
              <div className="d-flex flex-wrap gap-2">
                {projectList.map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => loadProject(p.id)}
                  >
                    {p.name || p.id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-view">
      <div className="dashboard-center-header d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="dashboard-center-project small">
          <span className="text-muted">Project:</span>{' '}
          <span className="fw-medium">{project.name}</span>
          {project.type && (
            <span className="project-type-badge ms-1 small">{project.type}</span>
          )}
        </div>
        <div className="d-flex gap-1 flex-shrink-0">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setPanelOpen(true)}
            aria-label="Open info panel"
          >
            Info
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={openProjectModal}
          >
            Edit
          </button>
        </div>
      </div>

      <div ref={planningSectionRef} className="dashboard-planning">
        <PlanningView />
      </div>

      <DashboardSidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        project={project}
        recentTasks={recentTasks}
        recentAudit={recentAudit}
        assessmentSections={assessmentSections}
        formatAssessmentForDisplay={formatAssessmentForDisplay}
        getFeatureName={getFeatureName}
        openNodeModal={openNodeModal}
        setMainTab={setMainTab}
        openProjectModal={openProjectModal}
      />
    </div>
  );
}
