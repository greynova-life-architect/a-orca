import React, { useState } from 'react';
import { formatThinkingForDisplay } from '../../store/selectors';

/**
 * Shared agent thinking block: collapsible "Thoughts" / "Thinking" with same look as NodeModal activity-thoughts.
 * Use for assessment thinking (PlanningView) and task-run thoughts (NodeModal).
 * Pass expanded + onToggle for controlled mode (e.g. NodeModal per-block state).
 */
export default function AgentThinkingBlock({
  text,
  lines,
  label: labelProp,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
}) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined && typeof onToggle === 'function';
  const expanded = isControlled ? controlledExpanded : internalExpanded;
  const handleToggle = isControlled ? onToggle : () => setInternalExpanded((e) => !e);
  const body = lines != null && lines.length
    ? lines.join('\n')
    : (text != null && text !== '' ? formatThinkingForDisplay(text) : '');
  const n = lines != null ? lines.length : 0;
  const label =
    labelProp != null
      ? labelProp
      : n > 0
        ? `Thoughts (${n} line${n !== 1 ? 's' : ''})`
        : 'Thinking';

  if (!body && n === 0) return null;

  return (
    <div className="activity-thoughts-block mb-2">
      <button
        type="button"
        className="btn btn-link btn-sm p-0 text-start activity-thoughts-toggle d-flex align-items-center gap-1"
        onClick={handleToggle}
        aria-expanded={expanded}
      >
        <span className="activity-thoughts-chevron">{expanded ? '▼' : '▶'}</span>
        <span className="text-muted small">{label}</span>
      </button>
      {expanded && (
        <div className="activity-thoughts-content mt-1 ps-3 border-start border-secondary border-opacity-25">
          <div className="agent-context-label small text-muted mb-1">
            Agent reasoning
          </div>
          <div
            className="activity-thoughts-body cursor-thinking-text"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {body}
          </div>
        </div>
      )}
    </div>
  );
}
