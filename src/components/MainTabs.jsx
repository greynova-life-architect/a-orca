import React from 'react';
import { useStore } from '../store';
import DashboardView from './views/DashboardView';
import PlanningView from './views/PlanningView';
import AnalysisView from './views/AnalysisView';
import BoardView from './views/BoardView';
import FeaturesView from './views/FeaturesView';
import FolderView from './views/FolderView';
import SettingsView from './views/SettingsView';
import AgentsView from './views/AgentsView';

export default function MainTabs() {
  const mainTab = useStore((s) => s.mainTab);
  const setMainTab = useStore((s) => s.setMainTab);
  const project = useStore((s) => s.project);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'planning', label: 'Agent Planning' },
    { id: 'overview', label: 'Overview' },
    { id: 'board', label: 'Pending Tasks' },
    { id: 'features', label: 'Features' },
    ...(project?.root_path ? [{ id: 'folder', label: 'Explorer' }] : []),
    { id: 'agents', label: 'Agents' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <>
      <div className="main-tabs-wrap">
        <div className="main-tabs">
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={`btn btn-sm main-tab-btn ${mainTab === tab.id ? 'btn-primary' : ''}`}
              onClick={() => setMainTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      {mainTab === 'dashboard' && <DashboardView />}
      {mainTab === 'planning' && <PlanningView />}
      {mainTab === 'overview' && <AnalysisView />}
      {mainTab === 'board' && <BoardView />}
      {mainTab === 'features' && <FeaturesView />}
      {mainTab === 'folder' && <FolderView />}
      {mainTab === 'agents' && <AgentsView />}
      {mainTab === 'settings' && <SettingsView />}
    </>
  );
}
