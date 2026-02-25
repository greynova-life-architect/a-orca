import React, { useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import {
  getCursorPhaseLabel,
  getCursorPhaseStepIndex,
  getChatTopicLabels,
  getTaskPreviewFromPlan,
  getColumns,
} from '../../store/selectors';
import AgentThinkingBlock from '../shared/AgentThinkingBlock';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { speakText, cancelSpeech, isSpeechSynthesisSupported } from '../../utils/speechSynthesis';

const MILESTONE_PROMPT_OPTIONS = [
  { label: 'By quarter', prompt: 'Break this project into quarterly phases (Q1–Q4).' },
  { label: 'By release', prompt: 'Define milestones by product release (e.g. v1.0, v1.1).' },
  { label: 'By sprint', prompt: 'Create sprint-based milestones (e.g. 2-week sprints).' },
  { label: 'By feature area', prompt: 'Organize milestones by feature area (e.g. Auth, API, UI).' },
];

export default function PlanningView() {
  const messagesEndRef = useRef(null);
  const scrollToBottom = () =>
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  const projectChatMessages = useStore((s) => s.projectChatMessages);
  const cursorWaiting = useStore((s) => s.cursorWaiting);
  const pendingQuestions = useStore((s) => s.pendingQuestions);
  const currentQuestionIndex = useStore((s) => s.currentQuestionIndex);
  const pendingPlan = useStore((s) => s.pendingPlan);
  const cursorError = useStore((s) => s.cursorError);
  const cursorTestResult = useStore((s) => s.cursorTestResult);
  const cursorPhase = useStore((s) => s.cursorPhase);
  const agentActivityLive = useStore((s) => s.agentActivity.live);
  const cursorStatusMessage = agentActivityLive?.statusMessage ?? '';
  const cursorStreamText = useStore((s) => s.cursorStreamText);
  const cursorStatus = agentActivityLive?.steps ?? [];
  const cursorAssessFolder = useStore((s) => s.cursorAssessFolder);
  const cursorAssessStep = useStore((s) => s.cursorAssessStep);
  const cursorAssessPrompt = useStore((s) => s.cursorAssessPrompt);
  const cursorAgentActivity = agentActivityLive?.files ?? [];
  const cursorFileActivity = useStore((s) => s.cursorFileActivity);
  const cursorThinkingText = useStore((s) => s.cursorThinkingText);
  const agentActivityExpanded = useStore((s) => s.agentActivityExpanded);
  const setAgentActivityExpanded = useStore((s) => s.setAgentActivityExpanded);
  const projectChatInput = useStore((s) => s.projectChatInput);
  const setProjectChatInput = useStore((s) => s.setProjectChatInput);
  const chatTopic = useStore((s) => s.chatTopic);
  const setChatTopic = useStore((s) => s.setChatTopic);
  const topicMenuOpen = useStore((s) => s.topicMenuOpen);
  const setTopicMenuOpen = useStore((s) => s.setTopicMenuOpen);
  const mapNodes = useStore((s) => s.mapNodes);
  const features = useStore((s) => s.features);
  const chatSelectedTaskIds = useStore((s) => s.chatSelectedTaskIds);
  const chatSelectedFeatureIds = useStore((s) => s.chatSelectedFeatureIds);
  const agents = useStore((s) => s.agents);
  const prevQuestion = useStore((s) => s.prevQuestion);
  const nextQuestion = useStore((s) => s.nextQuestion);
  const generatePlanFromAnswers = useStore((s) => s.generatePlanFromAnswers);
  const assignAgentToTask = useStore((s) => s.assignAgentToTask);
  const confirmPlan = useStore((s) => s.confirmPlan);
  const regeneratePlan = useStore((s) => s.regeneratePlan);
  const milestones = useStore((s) => s.milestones);
  const confirmPlanMilestoneId = useStore((s) => s.confirmPlanMilestoneId);
  const setConfirmPlanMilestoneId = useStore((s) => s.setConfirmPlanMilestoneId);
  const handleSend = useStore((s) => s.handleSend);
  const project = useStore((s) => s.project);
  const toggleChatTask = useStore((s) => s.toggleChatTask);
  const toggleChatFeature = useStore((s) => s.toggleChatFeature);
  const chatSelectedFilePaths = useStore((s) => s.chatSelectedFilePaths);
  const setChatSelectedFilePaths = useStore((s) => s.setChatSelectedFilePaths);
  const testCursor = useStore((s) => s.testCursor);
  const updatePendingQuestionAnswer = useStore(
    (s) => s.updatePendingQuestionAnswer
  );
  const pendingMilestoneQuestions = useStore((s) => s.pendingMilestoneQuestions);
  const pendingMilestonePlan = useStore((s) => s.pendingMilestonePlan);
  const updatePendingMilestoneQuestionAnswer = useStore(
    (s) => s.updatePendingMilestoneQuestionAnswer
  );
  const generateMilestonePlanFromAnswers = useStore(
    (s) => s.generateMilestonePlanFromAnswers
  );
  const confirmMilestonePlan = useStore((s) => s.confirmMilestonePlan);
  const includePivotalMilestoneInPlan = useStore((s) => s.includePivotalMilestoneInPlan);
  const stopCursorStream = useStore((s) => s.stopCursorStream);
  const voiceResponseEnabled = useStore((s) => s.voiceResponseEnabled);
  const setVoiceResponseEnabled = useStore((s) => s.setVoiceResponseEnabled);
  const milestoneOriginalPrompt = useStore((s) => s.milestoneOriginalPrompt);
  const milestoneQuestionAnswers = useStore((s) => s.milestoneQuestionAnswers);
  const setMainTab = useStore((s) => s.setMainTab);
  const reassessProject = useStore((s) => s.reassessProject);
  const openNodeModal = useStore((s) => s.openNodeModal);

  const lastSpokenMessageIndexRef = useRef(-1);
  const topicDropdownRef = useRef(null);
  const columns = getColumns();
  const nodesByStatus = (() => {
    const by = {};
    columns.forEach((c) => (by[c.id] = []));
    (mapNodes || []).forEach((n) => {
      const s = n.status || 'todo';
      if (by[s]) by[s].push(n);
      else by['todo'].push(n);
    });
    return by;
  })();
  const nextTask = (nodesByStatus.todo && nodesByStatus.todo[0]) || (nodesByStatus.ready_for_agent && nodesByStatus.ready_for_agent[0]);

  const appendToChatInput = useCallback((transcript) => {
    const state = useStore.getState();
    const current = (state.projectChatInput || '').trim();
    state.setProjectChatInput(current ? current + ' ' + transcript : transcript);
  }, []);

  const {
    isListening,
    start: startListening,
    stop: stopListening,
    supported: speechRecognitionSupported,
    error: speechRecognitionError,
  } = useSpeechRecognition({
    onResult: appendToChatInput,
    onEnd: undefined,
  });

  const handleMicClick = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    if (!voiceResponseEnabled || !isSpeechSynthesisSupported()) return;
    const messages = useStore.getState().projectChatMessages;
    if (!messages.length) return;
    const last = messages[messages.length - 1];
    if (last?.role !== 'assistant' || !last?.content) return;
    const lastIndex = messages.length - 1;
    if (lastSpokenMessageIndexRef.current >= lastIndex) return;
    lastSpokenMessageIndexRef.current = lastIndex;
    speakText(last.content);
  }, [voiceResponseEnabled, projectChatMessages]);

  const taskPreviewFromPlan = useStore(getTaskPreviewFromPlan);
  const phaseLabel = getCursorPhaseLabel(cursorPhase);
  const phaseStepIndex = getCursorPhaseStepIndex(cursorPhase);
  const chatTopicLabels = getChatTopicLabels();

  useEffect(() => {
    scrollToBottom();
  }, [projectChatMessages, pendingQuestions, pendingMilestoneQuestions, cursorStreamText]);

  useEffect(() => {
    if (projectChatMessages.length === 0) {
      lastSpokenMessageIndexRef.current = -1;
    }
  }, [projectChatMessages.length]);

  const placeholder =
    ['planning', 'tasks'].includes(chatTopic)
      ? 'Describe what you want to plan...'
      : chatTopic === 'milestones'
        ? 'Describe your project and milestones (e.g. phases, releases)...'
        : chatTopic === 'prioritization'
          ? 'Click Send to have the LLM prioritize tasks...'
          : 'Ask anything...';

  const currentQuestion = pendingQuestions?.[currentQuestionIndex];
  const currentMilestoneQuestion = pendingMilestoneQuestions?.[currentQuestionIndex];

  return (
    <div className="planning-view">
      <div className="chat-centering">
        <div className="chat-container">
          <div className="chat-messages-area">
            {!projectChatMessages.length && !cursorWaiting && (
              <div className="chat-msg-row chat-msg-assistant text-muted">
                <span className="chat-msg-role">Assistant</span>
                <div className="chat-msg-content">
                  Choose a topic, type your message, and click Send. Use Planning
                  or Tasks to create tasks with the Cursor agent.
                </div>
              </div>
            )}
            {projectChatMessages.map((m, i) => (
              <div
                key={i}
                className={`chat-msg-row chat-msg-${m.role || 'assistant'}`}
              >
                <div className="chat-msg-header d-flex align-items-center gap-2 flex-wrap">
                  <span className="chat-msg-role">
                    {m.role === 'user'
                      ? 'You'
                      : m.role === 'system'
                        ? 'Note'
                        : 'Assistant'}
                  </span>
                  {m.role === 'assistant' && isSpeechSynthesisSupported() && (
                    <button
                      type="button"
                      className="btn btn-speak-msg"
                      onClick={() => {
                        cancelSpeech();
                        speakText(m.content || '');
                      }}
                      title="Speak this message"
                      aria-label="Speak this message"
                    >
                      Speak
                    </button>
                  )}
                </div>
                <div className="chat-msg-content">{m.content}</div>
              </div>
            ))}
            {pendingQuestions !== null && !cursorWaiting && cursorStreamText && (
              <AgentThinkingBlock
                text={cursorStreamText}
                label="How the assistant arrived at these questions"
                defaultExpanded={true}
              />
            )}
            {pendingQuestions !== null && !cursorWaiting && (
              <div className="chat-questions-inline p-3 rounded border border-secondary mb-2">
                <div className="chat-context-label mb-2">Planning assistant</div>
                {pendingQuestions?.length > 0 && (
                  <span className="chat-question-count small text-muted">
                    {currentQuestionIndex + 1} of {pendingQuestions.length}
                  </span>
                )}
                {pendingQuestions?.length ? (
                  <div className="chat-msg-row chat-msg-assistant mt-2">
                    <div className="chat-msg-content">
                      {currentQuestion?.question}
                    </div>
                    {currentQuestion?.hint && (
                      <small className="text-muted d-block mt-1">
                        {currentQuestion.hint}
                      </small>
                    )}
                  </div>
                ) : (
                  <div className="chat-msg-row chat-msg-assistant mt-2">
                    <div className="chat-msg-content">
                      No clarifying questions. Proceed to create plan.
                    </div>
                  </div>
                )}
                <div className="d-flex gap-1 mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={prevQuestion}
                    disabled={currentQuestionIndex <= 0}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={nextQuestion}
                    disabled={
                      currentQuestionIndex >= (pendingQuestions?.length || 1) - 1
                    }
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={generatePlanFromAnswers}
                  >
                    Generate Plan
                  </button>
                </div>
              </div>
            )}
            {pendingMilestoneQuestions !== null && !cursorWaiting && cursorStreamText && (
              <AgentThinkingBlock
                text={cursorStreamText}
                label="How the assistant arrived at these questions"
                defaultExpanded={true}
              />
            )}
            {pendingMilestoneQuestions !== null && !cursorWaiting && (
              <div className="chat-questions-inline p-3 rounded border border-secondary mb-2">
                <div className="chat-context-label mb-2">Milestone planning</div>
                {pendingMilestoneQuestions?.length > 0 && (
                  <span className="chat-question-count small text-muted">
                    {currentQuestionIndex + 1} of {pendingMilestoneQuestions.length}
                  </span>
                )}
                {pendingMilestoneQuestions?.length ? (
                  <div className="chat-msg-row chat-msg-assistant mt-2">
                    <div className="chat-msg-content">
                      {currentMilestoneQuestion?.question}
                    </div>
                    {currentMilestoneQuestion?.hint && (
                      <small className="text-muted d-block mt-1">
                        {currentMilestoneQuestion.hint}
                      </small>
                    )}
                  </div>
                ) : (
                  <div className="chat-msg-row chat-msg-assistant mt-2">
                    <div className="chat-msg-content">
                      No clarifying questions. Proceed to propose milestones.
                    </div>
                  </div>
                )}
                <div className="d-flex gap-1 mt-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={prevQuestion}
                    disabled={currentQuestionIndex <= 0}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={nextQuestion}
                    disabled={
                      currentQuestionIndex >= (pendingMilestoneQuestions?.length || 1) - 1
                    }
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={() => generateMilestonePlanFromAnswers()}
                  >
                    Propose milestones
                  </button>
                </div>
              </div>
            )}
            {pendingMilestonePlan?.milestones?.length && !cursorWaiting && cursorStreamText && (
              <AgentThinkingBlock
                text={cursorStreamText}
                label="How the assistant proposed these milestones"
                defaultExpanded={true}
              />
            )}
            {pendingMilestonePlan?.milestones?.length && !cursorWaiting && (
              <div className="cursor-confirm-panel cursor-confirm-in-chat p-3 rounded border border-success mb-2">
                <strong>Proposed milestones</strong>
                <p className="mb-2 mt-2">Review and confirm to add these milestones to the project.</p>
                <ul className="plan-preview mb-3 list-unstyled">
                  {(pendingMilestonePlan.milestones || []).map((m, i) => (
                    <li key={m.id || i} className="mb-2">
                      <span className="fw-medium">{m.name}</span>
                      {m.description && (
                        <span className="text-muted small d-block">{m.description}</span>
                      )}
                    </li>
                  ))}
                </ul>
                {pendingMilestonePlan.pivotalMilestone && (
                  <div className="mb-3 p-2 rounded border border-secondary border-opacity-50">
                    <span className="small text-muted">Suggested for growth: </span>
                    <span className="fw-medium">{pendingMilestonePlan.pivotalMilestone.name}</span>
                    {pendingMilestonePlan.pivotalMilestone.description && (
                      <span className="text-muted small d-block">— {pendingMilestonePlan.pivotalMilestone.description}</span>
                    )}
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary mt-1"
                      onClick={includePivotalMilestoneInPlan}
                    >
                      Include
                    </button>
                  </div>
                )}
                <div className="d-flex gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-success"
                    onClick={confirmMilestonePlan}
                  >
                    Confirm milestones
                  </button>
                </div>
              </div>
            )}
            {pendingPlan && !cursorWaiting && !pendingQuestions && cursorStreamText && (
              <AgentThinkingBlock
                text={cursorStreamText}
                label="How the assistant created this plan"
                defaultExpanded={true}
              />
            )}
            {pendingPlan && !cursorWaiting && !pendingQuestions && (
              <div className="cursor-confirm-panel cursor-confirm-in-chat p-3 rounded border border-success mb-2">
                <strong>Review plan</strong>
                <p className="mb-2 mt-2">Confirm this plan to create tasks.</p>
                <div className="plan-preview mb-3">
                  <div className="plan-project">
                    <span className="project-type-badge">
                      {pendingPlan?.project?.type}
                    </span>
                    <span className="plan-name">
                      {pendingPlan?.project?.name}
                    </span>
                  </div>
                  {pendingPlan?.project?.summary && (
                    <p className="plan-summary text-muted small mt-2 mb-2">
                      {pendingPlan.project.summary}
                    </p>
                  )}
                  <ul className="plan-features">
                    {(pendingPlan?.features || []).map((f) => (
                      <li key={f.id}>
                        <span>{f.name}</span>
                        <span className="text-muted small">
                          {' — '}
                          {f.description || ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {milestones.length > 0 && (
                  <div className="mb-2">
                    <label className="form-label small mb-1">Add to milestone</label>
                    <select
                      className="form-select form-select-sm"
                      value={confirmPlanMilestoneId}
                      onChange={(e) => setConfirmPlanMilestoneId(e.target.value)}
                    >
                      <option value="">None</option>
                      {milestones.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {taskPreviewFromPlan.length > 0 && (
                  <div className="task-preview mb-3">
                    <strong className="d-block mb-2">
                      Tasks to be created
                    </strong>
                    <p className="text-muted small mb-2">
                      Assign an agent to each task, then click Create Task.
                    </p>
                    <ul className="task-preview-list task-preview-with-agents">
                      {taskPreviewFromPlan.map((t) => (
                        <li key={t.id} className="task-preview-item">
                          <div className="task-preview-main">
                            <span>{t.title}</span>
                            {t.description && (
                              <span className="text-muted small">
                                {' — '}
                                {t.description}
                              </span>
                            )}
                          </div>
                          <select
                            className="form-select form-select-sm task-agent-select"
                            value={t.agent_id}
                            onChange={(e) =>
                              assignAgentToTask(t.id, e.target.value)
                            }
                          >
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-success"
                    onClick={confirmPlan}
                  >
                    Create Task
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    onClick={regeneratePlan}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            )}
            {cursorError && (
              <div className="alert alert-danger mb-2">
                <span>{cursorError}</span>
              </div>
            )}
            {cursorTestResult && !cursorWaiting && (
              <div className="alert alert-success mb-2">
                <span>{cursorTestResult}</span>
              </div>
            )}
            {cursorWaiting && (
              <div className="cursor-status-panel cursor-status-inline mb-2">
                <div className="cursor-status-header d-flex align-items-center justify-content-between gap-2">
                  <span>
                    <strong>{phaseLabel}</strong>
                    <span className="cursor-status-badge ms-2">● Running</span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={stopCursorStream}
                  >
                    Stop
                  </button>
                </div>
                {['questions', 'plan', 'task'].includes(cursorPhase) && (
                  <div className="cursor-phase-progress mt-2 mb-2">
                    <div className="phase-steps">
                      <span
                        className={`phase-step ${phaseStepIndex > 0 ? 'phase-step-done' : ''} ${phaseStepIndex === 0 ? 'phase-step-active' : ''}`}
                      >
                        1. Questions
                      </span>
                      <span
                        className={`phase-step ${phaseStepIndex > 1 ? 'phase-step-done' : ''} ${phaseStepIndex === 1 ? 'phase-step-active' : ''}`}
                      >
                        2. Plan
                      </span>
                      <span
                        className={`phase-step ${phaseStepIndex > 2 ? 'phase-step-done' : ''} ${phaseStepIndex === 2 ? 'phase-step-active' : ''}`}
                      >
                        3. Tasks
                      </span>
                    </div>
                  </div>
                )}
                {(cursorPhase === 'milestone_questions' || cursorPhase === 'milestone_plan') && (
                  <div className="cursor-phase-progress mt-2 mb-2">
                    <div className="phase-steps">
                      <span
                        className={`phase-step ${cursorPhase === 'milestone_questions' ? 'phase-step-active' : 'phase-step-done'}`}
                      >
                        Step 1: Milestone questions
                      </span>
                      <span
                        className={`phase-step ${cursorPhase === 'milestone_plan' ? 'phase-step-active' : ''}`}
                      >
                        Step 2: Proposing milestones
                      </span>
                    </div>
                  </div>
                )}
                {cursorPhase === 'assess' && cursorAssessFolder && (
                  <div className="cursor-assess-folder">
                    <span className="cursor-assess-folder-icon">📁</span>
                    <span
                      className="cursor-assess-folder-path"
                      title={cursorAssessFolder}
                    >
                      {cursorAssessFolder}
                    </span>
                  </div>
                )}
                {cursorPhase === 'assess' && cursorAssessStep?.step > 0 && (
                  <div className="cursor-assess-steps mt-2 mb-2">
                    <div className="cursor-step-indicator">
                      Step {cursorAssessStep.step} of {cursorAssessStep.total}:{' '}
                      {cursorAssessStep.label || ''}
                    </div>
                    <div className="cursor-step-message text-muted small">
                      {cursorAssessStep.message}
                    </div>
                  </div>
                )}
                <div className="cursor-status-current">
                  {cursorStatusMessage || 'Starting Cursor Agent...'}
                </div>
                {cursorPhase !== 'assess' && (
                  <div className="cursor-agent-active-indicator">
                    <span className="agent-active-dots">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>
                    <span className="agent-active-text">Agent is working…</span>
                    <span className="agent-active-hint text-muted small">
                      (Stream is live — new output appears below)
                    </span>
                  </div>
                )}
                {cursorPhase === 'assess' && cursorAssessPrompt && (
                  <div className="cursor-assess-prompt mt-2">
                    <div className="cursor-assess-prompt-label">
                      Initial planning prompt (full context)
                    </div>
                    <pre
                      className="cursor-assess-prompt-content p-3 rounded border overflow-auto"
                      style={{
                        maxHeight: '45vh',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}
                    >
                      {cursorAssessPrompt}
                    </pre>
                  </div>
                )}
                {(cursorPhase === 'milestone_questions' || cursorPhase === 'milestone_plan') && (milestoneOriginalPrompt || (cursorPhase === 'milestone_plan' && milestoneQuestionAnswers?.length > 0)) && (
                  <div className="cursor-milestone-context mt-2">
                    <div className="cursor-assess-prompt-label">Context</div>
                    <div
                      className="cursor-assess-prompt-content p-3 rounded border overflow-auto"
                      style={{
                        maxHeight: '30vh',
                        fontSize: '0.8rem',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                      }}
                    >
                      {milestoneOriginalPrompt && (
                        <div className="mb-2">
                          <strong>User prompt:</strong>
                          <pre className="mb-0 mt-1" style={{ whiteSpace: 'pre-wrap' }}>{milestoneOriginalPrompt}</pre>
                        </div>
                      )}
                      {cursorPhase === 'milestone_plan' && milestoneQuestionAnswers?.length > 0 && (
                        <div>
                          <strong>Question answers:</strong>
                          <ul className="mb-0 mt-1 ps-3">
                            {milestoneQuestionAnswers.map((qa, i) => (
                              <li key={i}>
                                {qa.question}: {qa.answer || '(unanswered)'}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {cursorAgentActivity?.length > 0 && (
                  <div
                    className={`cursor-agent-activity cursor-agent-activity-clickable mt-2 ${agentActivityExpanded ? 'agent-activity-expanded' : ''}`}
                    onClick={() =>
                      setAgentActivityExpanded(!agentActivityExpanded)
                    }
                  >
                    <div className="cursor-agent-activity-title">
                      Agent activity (files reviewed)
                      <span className="agent-activity-count">
                        ({cursorAgentActivity.length})
                      </span>
                    </div>
                    <div
                      className={`cursor-agent-activity-list ${agentActivityExpanded ? 'agent-activity-expanded' : ''}`}
                    >
                      {!agentActivityExpanded ? (
                        <div className="agent-activity-item agent-activity-single">
                          <span className="agent-activity-label">
                            {cursorAgentActivity[cursorAgentActivity.length - 1]
                              ?.label ||
                              cursorAgentActivity[
                                cursorAgentActivity.length - 1
                              ]?.path ||
                              ''}
                          </span>
                          <span className="agent-activity-expand-hint text-muted">
                            Click to expand
                          </span>
                        </div>
                      ) : (
                        <div>
                          <div className="agent-activity-expand-hint mb-1">
                            Click to collapse ({cursorAgentActivity.length}{' '}
                            files)
                          </div>
                          {cursorAgentActivity.map((act, i) => (
                            <div key={i} className="agent-activity-item">
                              <span className="agent-activity-label">
                                {act.label || act.path}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {cursorPhase === 'assess' && cursorFileActivity?.length > 0 && (
                  <div className="cursor-file-activity">
                    <div className="cursor-file-activity-title">
                      Folders & files discovered (Step 1)
                    </div>
                    <div className="cursor-file-activity-list">
                      {cursorFileActivity.map((act, i) => (
                        <div
                          key={i}
                          className={`file-activity-item ${act.done ? 'file-activity-done' : ''}`}
                        >
                          <span className="file-activity-icon">
                            {act.action === 'dir'
                              ? '📁'
                              : act.action === 'file'
                                ? '📄'
                                : '⋯'}
                          </span>
                          <span className="file-activity-label">
                            {act.label ||
                              act.path?.split(/[/\\]/).slice(-2).join('/') ||
                              '…'}
                          </span>
                          {act.count !== undefined && (
                            <span className="file-activity-meta">
                              ({act.count || 0})
                            </span>
                          )}
                          {act.files?.length > 0 && act.done && (
                            <div className="file-activity-files">
                              {act.files.slice(0, 3).map((fp, fi) => (
                                <span
                                  key={fi}
                                  className="file-activity-path"
                                >
                                  {fp.split(/[/\\]/).slice(-2).join('/') || fp}
                                </span>
                              ))}
                              {act.count > 3 && (
                                <span>+{act.count - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {cursorPhase === 'assess' && cursorThinkingText && (
                  <AgentThinkingBlock
                    text={cursorThinkingText}
                    label="Thinking"
                    defaultExpanded={true}
                  />
                )}
                {cursorPhase !== 'assess' && (
                  <div className="cursor-status-log cursor-status-log-live">
                    {cursorStreamText ? (
                      <div className="cursor-stream-output">
                        <span>{cursorStreamText}</span>
                        {cursorWaiting && <span className="stream-cursor" />}
                      </div>
                    ) : (
                      <>
                        {cursorStatus
                          .slice(-24)
                          .map((item, i) => (
                            <div
                              key={i}
                              className={`cursor-log-line log-${item.type || 'status'}`}
                            >
                              {item.text}
                            </div>
                          ))}
                        {cursorWaiting && cursorStatus.length > 0 && (
                          <div className="cursor-log-line log-status cursor-waiting-hint">
                            Waiting for agent output…
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="chat-composer chat-composer-openwebui p-3 border rounded">
            {project?.name && (
              <div className="chat-project-pill mb-2 small text-muted">
                Project: <span className="text-primary">{project.name}</span>
                {project.root_path && (
                  <span className="ms-1" title={project.root_path}>· {project.root_path.replace(/\\/g, '/')}</span>
                )}
              </div>
            )}
            {chatTopic === 'milestones' && !pendingMilestoneQuestions?.length && !pendingMilestonePlan?.milestones?.length && (
              <div className="milestone-prompt-options d-flex flex-wrap gap-1 mb-2">
                {MILESTONE_PROMPT_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setProjectChatInput(opt.prompt)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
            <div className="composer-bar d-flex align-items-center gap-2 flex-nowrap">
              <div
                ref={topicDropdownRef}
                className="topic-pill-dropdown"
                onBlur={(e) => {
                  // Only close if focus left the dropdown (e.g. clicked outside). Use next tick so
                  // clicking a menu option doesn't close the menu before onClick runs.
                  const currentTarget = e.currentTarget;
                  requestAnimationFrame(() => {
                    if (!currentTarget.contains(document.activeElement)) {
                      setTopicMenuOpen(false);
                    }
                  });
                }}
              >
                <button
                  type="button"
                  className="topic-pill-btn"
                  onClick={() => setTopicMenuOpen(!topicMenuOpen)}
                  aria-haspopup="listbox"
                  aria-expanded={topicMenuOpen}
                >
                  <span className="topic-pill-icon">◉</span>
                  <span className="topic-pill-label">
                    {chatTopicLabels[chatTopic] || chatTopic}
                  </span>
                  <span className="topic-pill-chevron">▼</span>
                </button>
                {topicMenuOpen && (
                  <div
                    className="topic-pill-menu"
                    role="listbox"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {['planning', 'prioritization', 'tasks', 'milestones', 'general', 'agents', 'refactoring'].map(
                      (topic) => (
                        <button
                          key={topic}
                          type="button"
                          className="topic-pill-option"
                          role="option"
                          onClick={() => {
                            setChatTopic(topic);
                            setTopicMenuOpen(false);
                          }}
                        >
                          {chatTopicLabels[topic]}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
              {!pendingQuestions?.length && !pendingMilestoneQuestions?.length ? (
                <>
                  <textarea
                    className="form-control composer-input composer-textarea flex-grow-1"
                    placeholder={placeholder}
                    value={projectChatInput}
                    onChange={(e) => {
                      const v = e.target.value.replace(/^\s*-+\s*/, '');
                      setProjectChatInput(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    rows={3}
                  />
                  <button
                    type="button"
                    className={`btn btn-mic ${isListening ? 'btn-mic-active' : ''}`}
                    onClick={handleMicClick}
                    disabled={!speechRecognitionSupported}
                    title={
                      !speechRecognitionSupported
                        ? 'Speech recognition not supported in this browser'
                        : isListening
                          ? 'Stop listening'
                          : 'Speak to transcribe into the message box'
                    }
                    aria-label={
                      isListening ? 'Stop listening' : 'Listen with microphone to transcribe speech'
                    }
                  >
                    {isListening ? 'Stop' : 'Mic'}
                  </button>
                </>
              ) : pendingMilestoneQuestions?.length ? (
                <input
                  type="text"
                  className="form-control composer-input flex-grow-1"
                  placeholder={`Answer milestone question ${currentQuestionIndex + 1}`}
                  value={currentMilestoneQuestion?.answer ?? ''}
                  onChange={(e) =>
                    updatePendingMilestoneQuestionAnswer(
                      currentQuestionIndex,
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      generateMilestonePlanFromAnswers();
                    }
                  }}
                />
              ) : (
                <input
                  type="text"
                  className="form-control composer-input flex-grow-1"
                  placeholder={`Answer question ${currentQuestionIndex + 1}`}
                  value={currentQuestion?.answer ?? ''}
                  onChange={(e) =>
                    updatePendingQuestionAnswer(
                      currentQuestionIndex,
                      e.target.value
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      generatePlanFromAnswers();
                    }
                  }}
                />
              )}
              <button
                type="button"
                className="btn btn-send"
                onClick={
                  pendingMilestoneQuestions?.length
                    ? () => generateMilestonePlanFromAnswers()
                    : handleSend
                }
                title="Send"
              >
                <span className="send-icon">↑</span>
              </button>
            </div>
            <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mt-2">
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {isSpeechSynthesisSupported() && (
                  <label className="voice-response-toggle d-flex align-items-center gap-2 mb-0 small">
                    <input
                      type="checkbox"
                      checked={!!voiceResponseEnabled}
                      onChange={(e) => setVoiceResponseEnabled(e.target.checked)}
                    />
                    <span>Speak responses</span>
                  </label>
                )}
                {speechRecognitionError && (
                  <span className="speech-recognition-error small text-warning" role="alert">
                    {speechRecognitionError}
                  </span>
                )}
              </div>
              <div className="chat-next-steps text-muted small text-end">
                {nextTask ? (
                  <span>
                    Next: <span className="fw-medium text-primary">{nextTask.title}</span>
                    <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => openNodeModal(nextTask)}>Open</button>
                    <button type="button" className="btn btn-link btn-sm p-0 ms-1" onClick={() => setMainTab('board')}>Pending Tasks</button>
                  </span>
                ) : milestones.length === 0 ? (
                  <span>
                    Define your phases: create milestones to group tasks.
                    <button type="button" className="btn btn-sm btn-outline-primary ms-1" onClick={() => { setChatTopic('milestones'); setProjectChatInput('Define milestones for this project (e.g. phases, releases, sprints).'); }}>Create milestones</button>
                  </span>
                ) : !project?.assessment && project?.root_path ? (
                  <span>
                    Reassess to analyze, then create tasks.
                    <button type="button" className="btn btn-sm btn-outline-primary ms-1" onClick={reassessProject}>Reassess</button>
                  </span>
                ) : mapNodes.length === 0 ? (
                  <span>
                    Create tasks from Agent Planning.
                    <button type="button" className="btn btn-sm btn-outline-primary ms-1" onClick={() => { setChatTopic('planning'); setProjectChatInput('Plan and create tasks for this project.'); }}>Create tasks</button>
                  </span>
                ) : (
                  <span>All caught up. Create more tasks or milestones above.</span>
                )}
              </div>
            </div>
            <details className="chat-context-details mt-2">
              <summary className="chat-context-label" style={{ cursor: 'pointer' }}>
                Include in context
              </summary>
              <p className="text-muted small mb-1 mt-1">Select tasks or features to focus the assistant on them.</p>
              {mapNodes.length > 0 && (
                <div className="chat-context-tasks mt-1">
                  {mapNodes.map((n) => (
                    <label key={n.id} className="chat-context-item">
                      <input
                        type="checkbox"
                        checked={chatSelectedTaskIds.includes(n.id)}
                        onChange={() => toggleChatTask(n.id)}
                      />
                      <span className="chat-context-text">{n.title}</span>
                    </label>
                  ))}
                </div>
              )}
              {features.length > 0 && (
                <div className="chat-context-features">
                  {features.map((f) => (
                    <label key={f.id} className="chat-context-item">
                      <input
                        type="checkbox"
                        checked={chatSelectedFeatureIds.includes(f.id)}
                        onChange={() => toggleChatFeature(f.id)}
                      />
                      <span className="chat-context-text">{f.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="chat-context-files mt-2">
                <label className="chat-context-label small">Include files (paths, comma-separated)</label>
                <input
                  type="text"
                  className="form-control form-control-sm mt-1"
                  placeholder="e.g. src/app.js, lib/utils.js"
                  value={(chatSelectedFilePaths || []).join(', ')}
                  onChange={(e) => {
                    const raw = e.target.value || '';
                    const paths = raw.split(/[,\n]/).map((p) => p.trim()).filter(Boolean);
                    setChatSelectedFilePaths(paths);
                  }}
                />
              </div>
              {!mapNodes.length && !features.length && !(project?.name) && (
                <div className="text-muted small">Load a project first.</div>
              )}
              <button
                type="button"
                className="btn btn-link btn-sm text-muted mt-1 p-0 dev-test-link"
                onClick={testCursor}
                title="Test Cursor stream"
              >
                Test stream
              </button>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
