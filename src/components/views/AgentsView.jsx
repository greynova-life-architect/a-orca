import React, { useState, useEffect } from 'react';
import { useStore } from '../../store';

function AgentCard({ agent, onEdit, onDelete }) {
  return (
    <div className="card bg-dark border-secondary mb-2">
      <div className="card-body py-2 px-3">
        <div className="d-flex justify-content-between align-items-start">
          <div className="flex-grow-1 min-width-0">
            <div className="fw-semibold">{agent.name}</div>
            {agent.system_prompt && (
              <div
                className="text-muted small mt-1"
                style={{
                  whiteSpace: 'pre-wrap',
                  maxHeight: '3.6em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {agent.system_prompt}
              </div>
            )}
            {agent.created_at && (
              <div className="text-muted small mt-1" style={{ fontSize: '0.7rem' }}>
                Created {new Date(agent.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
          <div className="d-flex gap-1 ms-2 flex-shrink-0">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => onEdit(agent)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => onDelete(agent)}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AgentForm({ agent, onSave, onCancel }) {
  const [name, setName] = useState(agent?.name || '');
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(agent?.name || '');
    setSystemPrompt(agent?.system_prompt || '');
    setError('');
  }, [agent]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Agent name is required.');
      return;
    }
    setError('');
    onSave({ name: trimmedName, system_prompt: systemPrompt });
  };

  const isEditing = !!agent?.id;

  return (
    <form onSubmit={handleSubmit}>
      <div className="card bg-dark border-secondary">
        <div className="card-body">
          <h6 className="card-title mb-3">
            {isEditing ? 'Edit Agent' : 'Create Agent'}
          </h6>
          {error && (
            <div className="alert alert-danger py-1 px-2 small">{error}</div>
          )}
          <div className="mb-3">
            <label className="form-label small text-muted">Name</label>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="e.g. Cursor Agent, Claude, GPT-4"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="mb-3">
            <label className="form-label small text-muted">System Prompt</label>
            <textarea
              className="form-control form-control-sm"
              rows={5}
              placeholder="Optional system prompt for this agent..."
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          <div className="d-flex gap-2">
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={!name.trim()}
            >
              {isEditing ? 'Save Changes' : 'Create Agent'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default function AgentsView() {
  const agents = useStore((s) => s.agents);
  const addAgent = useStore((s) => s.addAgent);
  const updateAgent = useStore((s) => s.updateAgent);
  const deleteAgent = useStore((s) => s.deleteAgent);
  const fetchAgents = useStore((s) => s.fetchAgents);

  const [formVisible, setFormVisible] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleCreate = async (data) => {
    setApiError('');
    try {
      await addAgent(data);
      setFormVisible(false);
    } catch (e) {
      setApiError(e.message || 'Failed to create agent.');
    }
  };

  const handleUpdate = async (data) => {
    if (!editingAgent) return;
    setApiError('');
    try {
      await updateAgent(editingAgent.id, data);
      setEditingAgent(null);
    } catch (e) {
      setApiError(e.message || 'Failed to update agent.');
    }
  };

  const handleDelete = (agent) => {
    if (!window.confirm(`Delete agent "${agent.name}"? Tasks assigned to this agent will be unassigned.`)) {
      return;
    }
    deleteAgent(agent.id);
  };

  const handleEdit = (agent) => {
    setFormVisible(false);
    setEditingAgent(agent);
    setApiError('');
  };

  const handleCancelForm = () => {
    setFormVisible(false);
    setEditingAgent(null);
    setApiError('');
  };

  const showingForm = formVisible || editingAgent;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h1 className="h5 mb-0">Agents</h1>
        {!showingForm && (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => {
              setEditingAgent(null);
              setFormVisible(true);
              setApiError('');
            }}
          >
            + New Agent
          </button>
        )}
      </div>

      <p className="text-muted small mb-3">
        Create and manage custom agents. These are the agents you assign to tasks from the board or task details. The Cursor model (in Settings) is used for planning and running the cursor-agent; these agents are for your own labeling and workflow.
      </p>

      {apiError && (
        <div className="alert alert-danger py-1 px-2 small mb-3">{apiError}</div>
      )}

      {showingForm && (
        <div className="mb-3">
          <AgentForm
            agent={editingAgent}
            onSave={editingAgent ? handleUpdate : handleCreate}
            onCancel={handleCancelForm}
          />
        </div>
      )}

      <div>
        {agents.length === 0 ? (
          <div className="text-muted small py-4 text-center">
            No agents yet. Click "+ New Agent" to create one.
          </div>
        ) : (
          agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}
