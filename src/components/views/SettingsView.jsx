import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';
import API from '../../api';

const CURSOR_AGENT_MODEL_OPTIONS = [
  { value: 'Auto', label: 'Auto' },
  { value: 'claude-4.6-opus', label: 'Claude 4.6 Opus' },
  { value: 'claude-4.6-sonnet', label: 'Claude 4.6 Sonnet' },
  { value: 'composer-1.5', label: 'Composer 1.5' },
  { value: 'gemini-3-flash', label: 'Gemini 3 Flash' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-5.3-codex', label: 'GPT-5.3 Codex' },
  { value: 'grok-code', label: 'Grok Code' },
];

export default function SettingsView() {
  const projectList = useStore((s) => s.projectList);
  const defaultProjectId = useStore((s) => s.defaultProjectId);
  const setDefaultProjectId = useStore((s) => s.setDefaultProjectId);

  const [cursorAgentModel, setCursorAgentModel] = useState('Auto');
  const [settingsLoadError, setSettingsLoadError] = useState(null);

  useEffect(() => {
    API.settings
      .get()
      .then((data) => {
        if (data.cursorAgentModel != null) setCursorAgentModel(data.cursorAgentModel);
      })
      .catch(() => setSettingsLoadError('Could not load settings'));
  }, []);

  const handleCursorAgentModelChange = (e) => {
    const value = e.target.value;
    setCursorAgentModel(value);
    API.settings.update({ cursorAgentModel: value }).catch(() => {});
  };

  return (
    <div className="settings-view">
      <section className="mb-4">
        <h1 className="page-title mb-3">Settings</h1>
      </section>

      <section className="settings-section cursor-agent-section mb-4">
        <h2 className="h6 text-muted text-uppercase mb-3">Cursor agent</h2>
        <p className="text-muted small mb-3">
          Model used when running the cursor-agent CLI (plan, tasks, assessment). Auto lets Cursor choose. Custom agents assigned to tasks are managed in the Agents tab.
        </p>
        {settingsLoadError && (
          <div className="small text-warning mb-2">{settingsLoadError}</div>
        )}
        <div className="row align-items-center g-2">
          <div className="col-auto">
            <label htmlFor="cursor-agent-model" className="form-label small mb-0">
              Model
            </label>
          </div>
          <div className="col-md-4">
            <select
              id="cursor-agent-model"
              className="form-select form-select-sm"
              value={cursorAgentModel}
              onChange={handleCursorAgentModelChange}
            >
              {(
                CURSOR_AGENT_MODEL_OPTIONS.some((o) => o.value === cursorAgentModel)
                  ? CURSOR_AGENT_MODEL_OPTIONS
                  : [
                      ...CURSOR_AGENT_MODEL_OPTIONS,
                      { value: cursorAgentModel, label: cursorAgentModel },
                    ]
              ).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="settings-section default-project-section mb-4">
        <h2 className="h6 text-muted text-uppercase mb-3">Default project</h2>
        <p className="text-muted small mb-3">
          Project to load automatically when you open the app. Set to None to always start with no project selected.
        </p>
        <div className="row align-items-center g-2">
          <div className="col-auto">
            <label htmlFor="default-project" className="form-label small mb-0">
              Project
            </label>
          </div>
          <div className="col-md-4">
            <select
              id="default-project"
              className="form-select form-select-sm"
              value={defaultProjectId}
              onChange={(e) => setDefaultProjectId(e.target.value)}
            >
              <option value="">None</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name || p.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
