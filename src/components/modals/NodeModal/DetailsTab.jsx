import React from 'react';

/**
 * Node modal: Details tab — title, status, description, feature, milestone, assignee, agent, prompt.
 */
export default function DetailsTab({
  editingNode,
  updateEditingNode,
  features,
  milestones,
  users,
  agents,
}) {
  if (!editingNode) return null;
  return (
    <div>
      <div className="row">
        <div className="col-md-6 mb-2">
          <label className="form-label small">Title</label>
          <input
            className="form-control"
            value={editingNode.title || ''}
            onChange={(e) => updateEditingNode({ title: e.target.value })}
          />
        </div>
        <div className="col-md-3 mb-2">
          <label className="form-label small">Status</label>
          <select
            className="form-select"
            value={editingNode.status || 'todo'}
            onChange={(e) => updateEditingNode({ status: e.target.value })}
          >
            <option value="todo">To Do</option>
            <option value="ready_for_agent">Ready for Agent</option>
            <option value="in_progress">In Progress</option>
            <option value="in_review">In Review</option>
            <option value="done">Done</option>
          </select>
        </div>
        <div className="col-md-3 mb-2">
          <label className="form-label small">Priority</label>
          <select
            className="form-select"
            value={editingNode.priority || ''}
            onChange={(e) =>
              updateEditingNode({ priority: e.target.value || null })
            }
          >
            <option value="">—</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label className="form-label small">Description</label>
        <textarea
          className="form-control"
          rows={2}
          value={editingNode.description || ''}
          onChange={(e) =>
            updateEditingNode({ description: e.target.value })
          }
        />
      </div>
      <div className="row">
        <div className="col-md-4 mb-2">
          <label className="form-label small">Progress %</label>
          <input
            type="number"
            className="form-control"
            min={0}
            max={100}
            value={editingNode.progress ?? ''}
            onChange={(e) =>
              updateEditingNode({
                progress:
                  e.target.value === ''
                    ? undefined
                    : parseInt(e.target.value, 10),
              })
            }
          />
        </div>
        <div className="col-md-4 mb-2">
          <label className="form-label small">Feature</label>
          <select
            className="form-select"
            value={editingNode.feature_id || ''}
            onChange={(e) =>
              updateEditingNode({
                feature_id: e.target.value || '_none',
              })
            }
          >
            <option value="">No feature</option>
            {features.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4 mb-2">
          <label className="form-label small">Milestone</label>
          <select
            className="form-select"
            value={editingNode.milestone_id || ''}
            onChange={(e) =>
              updateEditingNode({
                milestone_id: e.target.value || null,
              })
            }
          >
            <option value="">None</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4 mb-2">
          <label className="form-label small">Assignee</label>
          <select
            className="form-select"
            value={editingNode.assignee_id || ''}
            onChange={(e) =>
              updateEditingNode({
                assignee_id: e.target.value || null,
              })
            }
          >
            <option value="">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="col-md-4 mb-2">
          <label className="form-label small">Agent</label>
          <select
            className="form-select"
            value={editingNode.agent_id || ''}
            onChange={(e) =>
              updateEditingNode({
                agent_id: e.target.value || null,
              })
            }
          >
            <option value="">Select agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label className="form-label small">Agent prompt</label>
        <textarea
          className="form-control"
          rows={3}
          value={editingNode.prompt || ''}
          onChange={(e) => updateEditingNode({ prompt: e.target.value })}
          placeholder="LLM-generated instruction for this module"
        />
      </div>
      <div className="mb-2">
        <label className="form-label small">Complexity</label>
        <select
          className="form-select"
          value={editingNode.complexity || ''}
          onChange={(e) =>
            updateEditingNode({ complexity: e.target.value })
          }
        >
          <option value="simple">Simple — quick review</option>
          <option value="medium">Medium — review recommended</option>
          <option value="complex">Complex — detailed review required</option>
        </select>
      </div>
    </div>
  );
}
