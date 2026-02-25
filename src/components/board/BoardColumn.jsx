import React from 'react';
import { useStore } from '../../store';
import MapCard from './MapCard';

export default function BoardColumn({ column, colData, features }) {
  const dragOverColumn = useStore((s) => s.dragOverColumn);
  const setDragOverColumn = useStore((s) => s.setDragOverColumn);
  const dropNode = useStore((s) => s.dropNode);

  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnter = () => setDragOverColumn(column.id);
  const handleDragLeave = () => setDragOverColumn(null);
  const handleDrop = (e) => dropNode(e, column.id);

  const data = colData || { _none: [] };
  const unassigned = data._none || [];

  return (
    <div className="board-column">
      <div className="column-header">
        <span className="column-title">{column.label}</span>
        <span className="column-count">
          {features.reduce(
            (sum, f) => sum + (data[f.id]?.length || 0),
            0
          ) + unassigned.length}
        </span>
      </div>
      <div
        className={`column-cards ${dragOverColumn === column.id ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {features.map((feat) => {
          const nodes = data[feat.id] || [];
          if (nodes.length === 0) return null;
          return (
            <div key={feat.id} className="feature-group">
              <div className="feature-group-header">{feat.name}</div>
              {nodes.map((node) => (
                <MapCard key={node.id} node={node} />
              ))}
            </div>
          );
        })}
        {unassigned.map((node) => (
          <MapCard key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}
