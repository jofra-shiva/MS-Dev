'use client';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Task, TaskStatus, Project } from '@/types';
import TaskCard from './TaskCard';

interface Props {
  id: TaskStatus;
  label: string;
  color: string;
  emoji: string;
  tasks: Task[];
  projectId: string;
  project: Project | null;
}

export default function KanbanColumn({ id, label, color, emoji, tasks, projectId, project }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="kanban-column" style={{ borderTop: `3px solid ${color}`, boxShadow: isOver ? `0 0 0 2px ${color}40` : 'none', transition: 'box-shadow 0.15s' }}>
      <div className="kanban-column-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>{emoji}</span>
          <span style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</span>
          <span style={{ background: `${color}25`, color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
            {tasks.length}
          </span>
        </div>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="kanban-cards" style={{ background: isOver ? `${color}08` : 'transparent', transition: 'background 0.15s', minHeight: 120 }}>
          {tasks.length === 0 && (
            <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12, border: '2px dashed var(--border-subtle)', borderRadius: 8, margin: '4px 0' }}>
              Drop tasks here
            </div>
          )}
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} projectId={projectId} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
