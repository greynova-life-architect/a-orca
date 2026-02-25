import React from 'react';
import { useStore } from '../../store';

export default function MapCard({ node }) {
  const users = useStore((s) => s.users);
  const agents = useStore((s) => s.agents);
  const getAgentById = useStore((s) => s.getAgentById);
  const getUserById = useStore((s) => s.getUserById);
  const openNodeModal = useStore((s) => s.openNodeModal);
  const openPromptModal = useStore((s) => s.openPromptModal);
  const assignNode = useStore((s) => s.assignNode);
  const assignAgentToNode = useStore((s) => s.assignAgentToNode);
  const runTask = useStore((s) => s.runTask);
  const dragNode = useStore((s) => s.dragNode);
  const cursorPhase = useStore((s) => s.cursorPhase);
  const cursorStreamTaskId = useStore((s) => s.cursorStreamTaskId);
  const cursorWaiting = useStore((s) => s.cursorWaiting);
  const hasRunLog = useStore((s) => !!(s.agentActivity?.runLogs?.[node.id]));

  const isRunning =
    cursorPhase === 'task' &&
    cursorStreamTaskId === node.id &&
    cursorWaiting;

  const handleDragEnd = (e) => {
    e.target.classList?.remove('dragging');
  };

  return (
    <div
      className={`map-card status-${node.status}${isRunning ? ' map-card--running' : ''}`}
      draggable
      onDragStart={(e) => dragNode(e, node)}
      onDragEnd={handleDragEnd}
    >
      <div className="card-title">{node.title}</div>
      <div className="card-prompts">
        {node.priority && (
          <span
            className={`priority-badge priority-${node.priority}`}
          >
            {node.priority}
          </span>
        )}
        <span
          className={`prompt-badge prompt-${node.prompt_status || 'pending'}`}
        >
          {(node.prompt_status || 'pending').replace('_', ' ')}
        </span>
        {isRunning && (
          <span className="cursor-status-badge agent-active-dots">
            Running…
          </span>
        )}
        {node.agent_id && !isRunning && (
          <span className="agent-badge">
            {getAgentById(node.agent_id)?.name || node.agent_id}
          </span>
        )}
        {node.complexity && (
          <span
            className={`complexity-badge complexity-${node.complexity}`}
          >
            {node.complexity}
          </span>
        )}
        {node.prompt_status !== 'approved' && (
          <button
            type="button"
            className="btn btn-sm btn-link p-0 ms-1"
            onClick={(e) => {
              e.stopPropagation();
              openPromptModal(node);
            }}
          >
            Review
          </button>
        )}
      </div>
      {node.description && (
        <div className="card-meta">{node.description}</div>
      )}
      <div className="card-footer">
        <span className="card-assignee">
          {getUserById(node.assignee_id)?.name || '—'}
        </span>
        {node.progress !== undefined && (
          <div className="card-progress">
            <div
              className="progress-bar"
              style={{ width: `${node.progress || 0}%` }}
            />
          </div>
        )}
      </div>
      <div className="card-actions">
        <button
          type="button"
          className="btn btn-sm btn-link"
          onClick={() => openNodeModal(node)}
        >
          Edit
        </button>
        <button
          type="button"
          className="btn btn-sm btn-primary map-card-run-btn"
          disabled={isRunning || node.status === 'done'}
          onClick={(e) => {
            e.stopPropagation();
            runTask(node);
          }}
          title={node.status === 'done' ? 'Task is done' : 'Run agent for this task'}
        >
          Run
        </button>
        <button
          type="button"
          className="btn btn-sm btn-link"
          onClick={(e) => {
            e.stopPropagation();
            openNodeModal(node, { defaultTab: 'activity' });
          }}
          title="Open task and show Activity tab"
        >
          View activity
        </button>
        <span className="card-action-label" title="AI agent to run this task">Agent</span>
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', minWidth: 100, height: 24, fontSize: '0.7rem' }}
          value={node.agent_id || ''}
          onChange={(e) => {
            e.stopPropagation();
            assignAgentToNode(node, e.target.value || null);
          }}
          onClick={(e) => e.stopPropagation()}
          title="Assign AI agent to run this task"
        >
          <option value="">Select agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <span className="card-action-label">Assignee</span>
        <select
          className="form-select form-select-sm"
          style={{ width: 'auto', minWidth: 80, height: 24, fontSize: '0.7rem' }}
          value={node.assignee_id || ''}
          onChange={(e) => assignNode(node, e.target.value || null)}
        >
          <option value="">Assign</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
