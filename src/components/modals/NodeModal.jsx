import React from 'react';
import { useStore } from '../../store';
import { getSortedAudit } from '../../store/selectors';
import API from '../../api';
import Modal from './Modal';
import AgentThinkingBlock from '../shared/AgentThinkingBlock';
import DetailsTab from './NodeModal/DetailsTab';
import AuditTab from './NodeModal/AuditTab';

export default function NodeModal() {
  const showNodeModal = useStore((s) => s.showNodeModal);
  const editingNode = useStore((s) => s.editingNode);
  const editModalTab = useStore((s) => s.editModalTab);
  const setEditModalTab = useStore((s) => s.setEditModalTab);
  const updateEditingNode = useStore((s) => s.updateEditingNode);
  const features = useStore((s) => s.features);
  const milestones = useStore((s) => s.milestones);
  const users = useStore((s) => s.users);
  const agents = useStore((s) => s.agents);
  const getAgentById = useStore((s) => s.getAgentById);
  const cursorStreamTaskId = useStore((s) => s.cursorStreamTaskId);
  const cursorWaiting = useStore((s) => s.cursorWaiting);
  const agentActivityLive = useStore((s) => s.agentActivity?.live ?? { statusMessage: '', steps: [], files: [] });
  const agentRunLog = useStore((s) =>
    editingNode ? (s.agentActivity?.runLogs?.[editingNode.id] ?? null) : null
  );
  const getUserById = useStore((s) => s.getUserById);
  const formatTs = useStore((s) => s.formatTs);
  const closeNodeModal = useStore((s) => s.closeNodeModal);
  const saveTask = useStore((s) => s.saveTask);
  const answerQuestion = useStore((s) => s.answerQuestion);
  const projectRootPath = useStore((s) => (s.project?.root_path || '').replace(/\\/g, '/'));
  const currentProjectId = useStore((s) => s.currentProjectId);

  const auditEntries = editingNode ? getSortedAudit(editingNode) : [];
  const unansweredCount = (editingNode?.questions || []).filter(
    (q) => !q.answered
  ).length;

  if (!showNodeModal) return null;

  const handleClose = () => {
    saveTask().then(() => closeNodeModal()).catch(() => closeNodeModal());
  };
  const footer = (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={handleClose}
    >
      Close
    </button>
  );

  return (
    <Modal
      show={showNodeModal}
      onClose={closeNodeModal}
      title={editingNode?.title || 'Task'}
      footer={footer}
      size="xl"
      id="nodeModal"
    >
      {!editingNode ? null : (
        <>
          <ul className="nav nav-tabs node-modal-tabs mb-3">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${editModalTab === 'details' ? 'active' : ''}`}
                onClick={() => setEditModalTab('details')}
              >
                Details
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link d-flex align-items-center gap-1 ${editModalTab === 'audit' ? 'active' : ''}`}
                onClick={() => setEditModalTab('audit')}
              >
                Audit
                {editingNode.audit?.length > 0 && (
                  <span className="badge bg-secondary">
                    {editingNode.audit.length}
                  </span>
                )}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link d-flex align-items-center gap-1 ${editModalTab === 'questions' ? 'active' : ''}`}
                onClick={() => setEditModalTab('questions')}
              >
                Questions
                {unansweredCount > 0 && (
                  <span className="badge bg-warning text-dark">
                    {unansweredCount}
                  </span>
                )}
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link ${editModalTab === 'activity' ? 'active' : ''}`}
                onClick={() => setEditModalTab('activity')}
              >
                Activity
              </button>
            </li>
          </ul>

          {editModalTab === 'details' && (
            <DetailsTab
              editingNode={editingNode}
              updateEditingNode={updateEditingNode}
              features={features}
              milestones={milestones}
              users={users}
              agents={agents}
            />
          )}

          {editModalTab === 'audit' && (
            <AuditTab
              editingNode={editingNode}
              auditEntries={auditEntries}
              getAgentById={getAgentById}
              getUserById={getUserById}
              formatTs={formatTs}
            />
          )}

          {editModalTab === 'questions' && (
            <div className="questions-section">
              <p className="text-muted small mb-2">
                Questions the LLM needs answered to continue this task. Add your
                answer below.
              </p>
              {(editingNode.questions || []).map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  editingNode={editingNode}
                  getAgentById={getAgentById}
                  getUserById={getUserById}
                  formatTs={formatTs}
                  answerQuestion={answerQuestion}
                />
              ))}
              {(editingNode.questions || []).length === 0 && (
                <div className="text-muted small">No questions yet</div>
              )}
            </div>
          )}

          {editModalTab === 'activity' && (
            <ActivityTab
              projectRootPath={projectRootPath}
              projectId={currentProjectId}
              isLive={cursorStreamTaskId === editingNode.id && cursorWaiting}
              live={agentActivityLive}
              runLog={agentRunLog}
            />
          )}
        </>
      )}
    </Modal>
  );
}

const DIFF_MAX_LINES = 50;
const DIFF_MAX_CHARS = 2048;

function DiffView({ oldText, newText, patch }) {
  const [showMore, setShowMore] = React.useState(false);
  if (!patch && oldText == null && newText == null) return null;
  const truncate = (str, maxLines = DIFF_MAX_LINES, maxChars = DIFF_MAX_CHARS) => {
    if (!str || typeof str !== 'string') return { text: '', truncated: false };
    const lines = str.split('\n');
    const truncated = lines.length > maxLines || str.length > maxChars;
    const text =
      lines.length > maxLines
        ? lines.slice(0, maxLines).join('\n') + (truncated ? '\n…' : '')
        : str.length > maxChars
          ? str.slice(0, maxChars) + '…'
          : str;
    return { text, truncated };
  };
  if (patch) {
    const { text, truncated } = truncate(patch);
    return (
      <div className="diff-view diff-view-patch mt-2 p-2 rounded border border-secondary border-opacity-25">
        {truncated && showMore ? (
          <pre className="diff-pre mb-0 small" style={{ maxHeight: '300px', overflow: 'auto' }}>{patch}</pre>
        ) : (
          <>
            <pre className="diff-pre mb-0 small">{text}</pre>
            {truncated && (
              <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => setShowMore(true)}>
                Show more
              </button>
            )}
          </>
        )}
      </div>
    );
  }
  const oldRes = truncate(oldText);
  const newRes = truncate(newText);
  return (
    <div className="diff-view diff-view-before-after mt-2 p-2 rounded border border-secondary border-opacity-25">
      <div className="row g-2">
        <div className="col-md-6">
          <div className="text-muted small text-uppercase mb-1">Before</div>
          <pre className="diff-pre mb-0 small bg-dark bg-opacity-25 p-2 rounded">{oldRes.text}</pre>
          {oldRes.truncated && !showMore && (
            <button type="button" className="btn btn-link btn-sm p-0 mt-1" onClick={() => setShowMore(true)}>
              Show more
            </button>
          )}
        </div>
        <div className="col-md-6">
          <div className="text-muted small text-uppercase mb-1">After</div>
          <pre className="diff-pre mb-0 small bg-dark bg-opacity-25 p-2 rounded">{newRes.text}</pre>
          {newRes.truncated && !showMore && (
            <span className="text-muted small">(truncated)</span>
          )}
        </div>
      </div>
      {showMore && (
        <div className="row g-2 mt-2">
          <div className="col-md-6">
            <pre className="diff-pre mb-0 small bg-dark bg-opacity-25 p-2 rounded" style={{ maxHeight: '200px', overflow: 'auto' }}>{oldText}</pre>
          </div>
          <div className="col-md-6">
            <pre className="diff-pre mb-0 small bg-dark bg-opacity-25 p-2 rounded" style={{ maxHeight: '200px', overflow: 'auto' }}>{newText}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function fileActionLabel(act) {
  const a = act.action || 'read';
  if (a === 'edit') return { short: 'Edit', class: 'activity-action-edit' };
  if (a === 'read') return { short: 'Read', class: 'activity-action-read' };
  if (a === 'list') return { short: 'List', class: 'activity-action-list' };
  if (a === 'grep') return { short: 'Grep', class: 'activity-action-grep' };
  if (a === 'glob') return { short: 'Glob', class: 'activity-action-glob' };
  if (a === 'blocked') return { short: 'Blocked', class: 'activity-action-blocked' };
  return { short: a, class: '' };
}

/** Show path relative to project root when possible; otherwise last segment(s). */
function toLocalPath(rootPath, fullPath) {
  if (!fullPath || typeof fullPath !== 'string') return fullPath || '';
  const p = fullPath.replace(/\\/g, '/').trim();
  if (!rootPath) return p.length > 60 ? p.split('/').slice(-2).join('/') : p;
  const root = rootPath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (root && (p === root || p.startsWith(root + '/'))) return p.slice(root.length).replace(/^\/+/, '') || p.split('/').pop();
  return p.length > 60 ? p.split('/').slice(-2).join('/') : p;
}

/** Group steps into thought blocks, file blocks (consecutive file steps), and single steps. */
function groupStepsIntoBlocks(steps) {
  const blocks = [];
  let thoughtBuffer = [];
  let fileBuffer = []; // { item, index }[]
  const flushThoughts = () => {
    if (thoughtBuffer.length > 0) {
      blocks.push({ type: 'thoughts', items: thoughtBuffer });
      thoughtBuffer = [];
    }
  };
  const flushFiles = () => {
    if (fileBuffer.length > 0) {
      blocks.push({ type: 'files', items: fileBuffer });
      fileBuffer = [];
    }
  };
  for (let i = 0; i < steps.length; i++) {
    const item = steps[i];
    if (item.type === 'context' || item.type === 'thinking') {
      flushFiles();
      thoughtBuffer.push(item);
    } else if (item.type === 'file') {
      flushThoughts();
      fileBuffer.push({ item, index: i });
    } else {
      flushThoughts();
      flushFiles();
      blocks.push({ type: 'step', item, index: i });
    }
  }
  flushThoughts();
  flushFiles();
  return blocks;
}

function ConfirmationSummary({ steps, files, projectRootPath = '', lastAgentMessage = '', onViewDiff }) {
  const stepCount = steps?.length ?? 0;
  const fileCount = files?.length ?? 0;
  const editedFiles = files?.filter((f) => f.action === 'edit') ?? [];
  const edited = editedFiles.length;
  const readOnly = fileCount - edited;
  const lastMessage = typeof lastAgentMessage === 'string' && lastAgentMessage.trim()
    ? (lastAgentMessage.length > 120 ? lastAgentMessage.trim().slice(0, 120) + '…' : lastAgentMessage.trim())
    : '';
  return (
    <div className="confirmation-summary mb-3 p-3 rounded border border-success border-opacity-50 bg-success bg-opacity-10">
      <div className="d-flex align-items-center gap-2 mb-2">
        <span className="badge bg-success">Run completed</span>
      </div>
      <div className="text-muted small mb-2">
        {stepCount} step{stepCount !== 1 ? 's' : ''} · {fileCount} file{fileCount !== 1 ? 's' : ''} touched
        {edited > 0 && ` (${edited} edited, ${readOnly} read/list)`}
      </div>
      {edited > 0 && (
        <div className="small mb-2">
          <span className="text-muted">Files changed: </span>
          {editedFiles.map((f, i) => {
            const hasDiff = f.oldText != null || f.newText != null || f.patch != null;
            return (
              <span key={i}>
                {i > 0 && ', '}
                <code className="activity-local-path">{toLocalPath(projectRootPath, f.path || f.label)}</code>
                {hasDiff && onViewDiff && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 activity-view-diff"
                      onClick={() => onViewDiff(`change-${i}`)}
                    >
                      View diff
                    </button>
                  </>
                )}
              </span>
            );
          })}
        </div>
      )}
      {lastMessage && (
        <div className="small text-muted fst-italic">Last: {lastMessage}</div>
      )}
    </div>
  );
}

function ActivitySummary({ steps, files, isComplete, projectRootPath = '', statusMessage = '' }) {
  const stepCount = steps?.length ?? 0;
  const fileCount = files?.length ?? 0;
  const editedFiles = files?.filter((f) => f.action === 'edit') ?? [];
  const edited = editedFiles.length;
  const readOnly = fileCount - edited;
  if (stepCount === 0 && fileCount === 0 && isComplete) return null;
  return (
    <div className="activity-summary mb-3 p-3 rounded border border-secondary border-opacity-25">
      {isComplete ? (
        <>
          <div className="fw-medium mb-1">Completion summary</div>
          <div className="text-muted small mb-2">
            {stepCount} step{stepCount !== 1 ? 's' : ''} · {fileCount} file{fileCount !== 1 ? 's' : ''} touched
            {edited > 0 && ` (${edited} edited, ${readOnly} read/list)`}
          </div>
          {edited > 0 && (
            <div className="small">
              <span className="text-muted">Changes: </span>
              {editedFiles.map((f, i) => (
                <span key={i}>
                  {i > 0 && ', '}
                  <code className="activity-local-path">{toLocalPath(projectRootPath, f.path || f.label)}</code>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="fw-medium mb-1 d-flex align-items-center gap-2">
            <span className="spinner-border spinner-border-sm activity-live-indicator" role="status" aria-hidden="true" />
            <span>Running…</span>
          </div>
          <div className="text-muted small">
            {statusMessage ? (
              <span>{statusMessage}</span>
            ) : (
              <span>{stepCount} step{stepCount !== 1 ? 's' : ''} so far · {fileCount} file{fileCount !== 1 ? 's' : ''} accessed</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityTab({ projectRootPath = '', projectId, isLive, live, runLog }) {
  const stepsRef = React.useRef(null);
  const [expandedDiffKey, setExpandedDiffKey] = React.useState(null);
  const [expandedThoughtKeys, setExpandedThoughtKeys] = React.useState(new Set());
  const [expandedFileKeys, setExpandedFileKeys] = React.useState(new Set());
  const [fetchedDiffs, setFetchedDiffs] = React.useState({});
  const [loadingDiffKey, setLoadingDiffKey] = React.useState(null);
  const steps = live?.steps ?? [];
  const files = live?.files ?? [];
  const toggleThought = (key) => {
    setExpandedThoughtKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleFiles = (key) => {
    setExpandedFileKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  React.useEffect(() => {
    if (stepsRef.current && isLive) stepsRef.current.scrollTop = stepsRef.current.scrollHeight;
  }, [steps.length, isLive]);

  const displayPath = (act) => toLocalPath(projectRootPath, act.path || act.label || '');

  function hasDiff(item) {
    return item && (item.oldText != null || item.newText != null || item.patch != null);
  }

  async function openDiff(key, item) {
    if (hasDiff(item)) {
      setExpandedDiffKey((k) => (k === key ? null : key));
      return;
    }
    if (!item.path || !projectId) return;
    setLoadingDiffKey(key);
    try {
      const data = await API.projects.fileDiff(projectId, item.path);
      setFetchedDiffs((prev) => ({ ...prev, [key]: data }));
      setExpandedDiffKey(key);
    } catch (_) {
      setFetchedDiffs((prev) => ({ ...prev, [key]: { error: true } }));
      setExpandedDiffKey(key);
    } finally {
      setLoadingDiffKey(null);
    }
  }

  function renderFileRow(item, stepIndex, totalSteps) {
    const { short, class: actionClass } = fileActionLabel({ action: item.action });
    const pathDisplay = toLocalPath(projectRootPath, item.path || item.text || '');
    const hasInlineDiff = hasDiff(item);
    const canViewDiff = item.action === 'edit' && (hasInlineDiff || (item.path && projectId));
    const key = `step-${stepIndex}`;
    const isExpanded = expandedDiffKey === key;
    const isLoading = loadingDiffKey === key;
    const fetched = fetchedDiffs[key];
    const isLastStepAndLive = isLive && totalSteps != null && stepIndex === totalSteps - 1 && item.action === 'edit';
    const toggleDiff = (e) => {
      if (e.target.closest('.activity-view-diff')) return;
      if (!canViewDiff) return;
      if (isExpanded) setExpandedDiffKey(null);
      else openDiff(key, item);
    };
    const handleViewDiffClick = (e) => {
      e.stopPropagation();
      if (isExpanded) setExpandedDiffKey(null);
      else openDiff(key, item);
    };
    let diffContent = null;
    if (isExpanded) {
      if (hasInlineDiff) {
        diffContent = <DiffView oldText={item.oldText} newText={item.newText} patch={item.patch} />;
      } else if (fetched?.error) {
        diffContent = <div className="text-muted small mt-2">Could not load diff for this file.</div>;
      } else if (fetched) {
        diffContent = <DiffView oldText={fetched.oldText} newText={fetched.newText} />;
      } else if (isLoading) {
        diffContent = (
          <div className="mt-2 d-flex align-items-center gap-2 text-muted small">
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <span>Loading before/after…</span>
          </div>
        );
      }
    }
    return (
      <div key={stepIndex} className="agent-activity-step">
        <div
          className={`cursor-log-line log-file agent-activity-item ${actionClass} ${isLastStepAndLive ? 'activity-file-updating' : ''}`}
          role={canViewDiff ? 'button' : undefined}
          tabIndex={canViewDiff ? 0 : undefined}
          onClick={canViewDiff ? toggleDiff : undefined}
          onKeyDown={canViewDiff ? (e) => e.key === 'Enter' && toggleDiff(e) : undefined}
          style={canViewDiff ? { cursor: 'pointer' } : undefined}
        >
          <span className="activity-action-badge">{short}</span>
          {isLastStepAndLive && (
            <span className="spinner-border spinner-border-sm ms-1 activity-file-updating-spinner" role="status" aria-label="Updating" />
          )}
          {isLastStepAndLive && <span className="ms-1 small text-muted">Updating…</span>}
          <span className="agent-activity-label" title={item.path}>
            {pathDisplay}
          </span>
          {canViewDiff && (
            <button
              type="button"
              className="btn btn-link btn-sm p-0 ms-2 activity-view-diff"
              onClick={handleViewDiffClick}
              disabled={isLoading}
            >
              {isExpanded ? 'Hide diff' : isLoading ? 'Loading…' : 'View diff'}
            </button>
          )}
        </div>
        {diffContent}
      </div>
    );
  }

  function renderStep(item, i, totalSteps) {
    if (item.type === 'context' || item.type === 'thinking') {
      return (
        <div key={i} className={`cursor-log-line log-thinking log-${item.type || 'context'}`}>
          <span className="agent-context-label">Agent: </span>
          {item.text}
        </div>
      );
    }
    if (item.type === 'file') {
      return renderFileRow(item, i, totalSteps);
    }
    return (
      <div key={i} className={`cursor-log-line log-${item.type || 'status'}`}>
        {item.text}
      </div>
    );
  }

  function renderStepsWithThoughtBlocks(stepList) {
    const blocks = groupStepsIntoBlocks(stepList);
    return blocks.map((block, bi) => {
      if (block.type === 'thoughts') {
        const key = `thoughts-${bi}`;
        const isExpanded = expandedThoughtKeys.has(key);
        return (
          <AgentThinkingBlock
            key={key}
            lines={block.items.map((i) => i.text)}
            expanded={isExpanded}
            onToggle={() => toggleThought(key)}
          />
        );
      }
      if (block.type === 'files') {
        const key = `files-${bi}`;
        const isExpanded = expandedFileKeys.has(key);
        const n = block.items.length;
        return (
          <div key={key} className="activity-files-block mb-2">
            <button
              type="button"
              className="btn btn-link btn-sm p-0 text-start activity-files-toggle d-flex align-items-center gap-1"
              onClick={() => toggleFiles(key)}
              aria-expanded={isExpanded}
            >
              <span className="activity-files-chevron">{isExpanded ? '▼' : '▶'}</span>
              <span className="text-muted small">Files ({n})</span>
            </button>
            {isExpanded && (
              <div className="activity-files-content mt-1 ps-3 border-start border-secondary border-opacity-25">
                {block.items.map((entry) => renderFileRow(entry.item, entry.index, stepList.length))}
              </div>
            )}
          </div>
        );
      }
      return <React.Fragment key={`step-${block.index}`}>{renderStep(block.item, block.index, stepList.length)}</React.Fragment>;
    });
  }

  if (isLive) {
    return (
      <div className="activity-section">
        <ActivitySummary
          steps={steps}
          files={files}
          isComplete={false}
          projectRootPath={projectRootPath}
          statusMessage={live?.statusMessage || ''}
        />
        <h6 className="text-muted small text-uppercase mb-2">Activity (live)</h6>
        <div
          ref={stepsRef}
          className="cursor-status-log cursor-status-log-live mb-3"
          style={{ maxHeight: '35vh', overflowY: 'auto' }}
        >
          {steps.length === 0 ? (
            <div className="text-muted small">
              {live?.statusMessage || 'Starting…'}
            </div>
          ) : (
            renderStepsWithThoughtBlocks(steps)
          )}
        </div>
      </div>
    );
  }
  if (runLog) {
    const runSteps = runLog.steps ?? [];
    const runFiles = runLog.files ?? [];
    const editedOnly = runFiles.filter((f) => f.action === 'edit');
    const lastContextStep = [...runSteps].reverse().find((s) => s.type === 'context' || s.type === 'thinking');
    const lastAgentMessage = lastContextStep?.text ?? '';
    return (
      <div className="activity-section">
        <ConfirmationSummary
          steps={runSteps}
          files={runFiles}
          projectRootPath={projectRootPath}
          lastAgentMessage={lastAgentMessage}
          onViewDiff={(key) => setExpandedDiffKey(key)}
        />
        {editedOnly.length > 0 && (
          <>
            <h6 className="text-muted small text-uppercase mb-2">Changes (files edited)</h6>
            <ul className="activity-changes-list mb-3 list-unstyled">
              {editedOnly.map((act, i) => {
                const key = `change-${i}`;
                const isExpanded = expandedDiffKey === key;
                const hasInlineDiff = act.oldText != null || act.newText != null || act.patch != null;
                const canViewDiff = act.path && (hasInlineDiff || projectId);
                const isLoading = loadingDiffKey === key;
                const fetched = fetchedDiffs[key];
                const handleClick = () => {
                  if (isExpanded) setExpandedDiffKey(null);
                  else openDiff(key, act);
                };
                let diffContent = null;
                if (isExpanded) {
                  if (hasInlineDiff) {
                    diffContent = <DiffView oldText={act.oldText} newText={act.newText} patch={act.patch} />;
                  } else if (fetched?.error) {
                    diffContent = <div className="text-muted small mt-2">Could not load diff for this file.</div>;
                  } else if (fetched) {
                    diffContent = <DiffView oldText={fetched.oldText} newText={fetched.newText} />;
                  } else if (isLoading) {
                    diffContent = (
                      <div className="mt-2 d-flex align-items-center gap-2 text-muted small">
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                        <span>Loading before/after…</span>
                      </div>
                    );
                  }
                }
                return (
                  <li key={i} className="mb-2">
                    <code className="activity-local-path">{displayPath(act)}</code>
                    {canViewDiff && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 ms-1 activity-view-diff"
                          onClick={handleClick}
                          disabled={isLoading}
                        >
                          {isExpanded ? 'Hide diff' : isLoading ? 'Loading…' : 'View diff'}
                        </button>
                      </>
                    )}
                    {diffContent}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <h6 className="text-muted small text-uppercase mb-2">Activity</h6>
        <div className="cursor-status-log mb-3" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
          {runSteps.length === 0 ? (
            <div className="text-muted small">No steps recorded</div>
          ) : (
            renderStepsWithThoughtBlocks(runSteps)
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="activity-section">
      <div className="text-muted small">
        No run data yet. Run this task to see steps and files.
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  editingNode,
  getAgentById,
  getUserById,
  formatTs,
  answerQuestion,
}) {
  const [answerInput, setAnswerInput] = React.useState('');
  const handleSubmit = () => {
    answerQuestion(editingNode.id, question.id, answerInput || '');
    setAnswerInput('');
  };
  return (
    <div
      className={`question-card ${question.answered ? 'answered' : 'pending'}`}
    >
      <div className="question-text">{question.question}</div>
      <div className="question-meta small text-muted">
        {(getAgentById(question.agent_id)?.name || 'Agent')} ·{' '}
        {formatTs(question.asked_at)}
      </div>
      {question.answered ? (
        <div className="question-answer mt-2">
          <span className="answer-label">Answer:</span>
          <span> {question.answer}</span>
          {question.answered_by && (
            <span className="text-muted small">
              {' — '}
              {getUserById(question.answered_by)?.name || ''}{' '}
              {formatTs(question.answered_at)}
            </span>
          )}
        </div>
      ) : (
        <div className="question-answer-form mt-2">
          <div className="input-group">
            <input
              type="text"
              className="form-control"
              placeholder="Type your answer..."
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
