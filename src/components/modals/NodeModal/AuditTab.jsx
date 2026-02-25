import React from 'react';

/**
 * Node modal: Audit tab — agents involved and activity timeline.
 */
export default function AuditTab({
  editingNode,
  auditEntries,
  getAgentById,
  getUserById,
  formatTs,
}) {
  if (!editingNode) return null;
  return (
    <div className="audit-section">
      <div className="audit-agents mb-3">
        <h6 className="text-muted small text-uppercase mb-2">
          Agents involved
        </h6>
        <div className="d-flex flex-wrap gap-2">
          {(editingNode.agent_ids || []).map((aid) => (
            <span key={aid} className="agent-pill">
              {getAgentById(aid)?.name || aid}
            </span>
          ))}
          {(editingNode.agent_ids || []).length === 0 && (
            <span className="text-muted small">No agents yet</span>
          )}
        </div>
      </div>
      <h6 className="text-muted small text-uppercase mb-2">
        Activity & updates
      </h6>
      <div className="audit-timeline">
        {auditEntries.map((entry) => (
          <div key={entry.id} className="audit-entry">
            <span className="audit-ts">{formatTs(entry.ts)}</span>
            <span
              className={`audit-type type-${entry.type || 'action'}`}
            >
              {(entry.type || 'action').replace('_', ' ')}
            </span>
            <span className="audit-actor">
              {entry.agent_id
                ? getAgentById(entry.agent_id)?.name || entry.agent_id
                : entry.user_id
                  ? getUserById(entry.user_id)?.name || entry.user_id
                  : '—'}
            </span>
            <div className="audit-desc">{entry.description}</div>
            {entry.details && (
              <div className="audit-details text-muted small">
                {entry.details}
              </div>
            )}
          </div>
        ))}
        {auditEntries.length === 0 && (
          <div className="text-muted small">No activity yet</div>
        )}
      </div>
    </div>
  );
}
