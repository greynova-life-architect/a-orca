import React, { useEffect } from 'react';
import { useStore } from './store';
import { useAssessStream } from './hooks/useAssessStream';
import { useCursorStream } from './hooks/useCursorStream';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import MainTabs from './components/MainTabs';
import NodeModal from './components/modals/NodeModal';
import PromptModal from './components/modals/PromptModal';
import AttachModal from './components/modals/AttachModal';
import BrowseModal from './components/modals/BrowseModal';
import ProjectModal from './components/modals/ProjectModal';
import AddFeatureModal from './components/modals/AddFeatureModal';
import EditFeatureModal from './components/modals/EditFeatureModal';
import NewProjectModal from './components/modals/NewProjectModal';
import AssessCompleteOverlay from './components/modals/AssessCompleteOverlay';
import AssessHistoryModal from './components/modals/AssessHistoryModal';

export default function App() {
  const init = useStore((s) => s.init);

  useAssessStream();
  useCursorStream();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="app-wrapper">
      <Sidebar />
      <div className="app-content">
        <Header />
        <main className="app-main">
          <MainTabs />
        </main>
      </div>
      <NodeModal />
      <PromptModal />
      <AttachModal />
      <BrowseModal />
      <ProjectModal />
      <AddFeatureModal />
      <EditFeatureModal />
      <NewProjectModal />
      <AssessCompleteOverlay />
      <AssessHistoryModal />
    </div>
  );
}
