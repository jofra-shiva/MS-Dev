'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import TaskDetailModal from '../tasks/TaskDetailModal';

interface Props { task: Task; projectId: string; isDragging?: boolean; }

const PRIORITY_DOT: Record<string, string> = {
  low: '#475569', medium: '#3B82F6', high: '#F59E0B', urgent: '#EF4444',
};

export default function TaskCard({ task, projectId, isDragging }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSortableDragging } = useSortable({ id: task.id });
  const [showDetail, setShowDetail] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : 1,
  };

  const dueDate = task.dueDate ? (task.dueDate as any).toDate?.() || new Date(task.dueDate) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`task-card priority-${task.priority}`}
        onClick={() => !isDragging && setShowDetail(true)}
      >
        {/* Priority + Module */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {task.type === 'bug' ? <span title="Bug" style={{ fontSize: 13 }}>🐛</span> : task.type === 'feature' ? <span title="Feature" style={{ fontSize: 13 }}>✨</span> : <span title="Improvement" style={{ fontSize: 13 }}>🛠️</span>}
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: PRIORITY_DOT[task.priority] }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{task.priority}</span>
          </div>
          {task.module && (
            <span style={{ fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-primary)', padding: '2px 7px', borderRadius: 99 }}>{task.module}</span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8, lineHeight: 1.4 }} className="truncate-2">
          {task.title}
        </div>

        {/* Progress bar */}
        {task.progress > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', marginBottom: 3 }}>
              <span>Progress</span><span>{task.progress}%</span>
            </div>
            <div className="progress-bar" style={{ height: 3 }}>
              <div className="progress-fill" style={{ width: `${task.progress}%` }} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {task.assigneePhoto
              ? <img src={task.assigneePhoto} className="avatar avatar-sm" alt="" title={task.assigneeName || ''} />
              : task.assigneeName
                ? <div className="avatar-placeholder" style={{ width: 22, height: 22, fontSize: 8 }} title={task.assigneeName}>{task.assigneeName.slice(0, 2).toUpperCase()}</div>
                : <div style={{ width: 22, height: 22, borderRadius: '50%', border: '1.5px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                  </div>
            }
            {task.tags && task.tags.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--accent)', background: 'rgba(99,102,241,0.1)', padding: '1px 6px', borderRadius: 99 }}>#{task.tags[0]}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {task.githubRef?.lastCommitSha && (
              <span title="Has commit" style={{ color: 'var(--success)', fontSize: 11 }}>⚡</span>
            )}
            {task.attachments?.length > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>📎 {task.attachments.length}</span>
            )}
            {dueDate && (
              <span style={{ fontSize: 10, color: isOverdue ? 'var(--danger)' : 'var(--text-3)', fontWeight: isOverdue ? 700 : 400 }}>
                {isOverdue ? '⚠️ ' : ''}{formatDistanceToNow(dueDate, { addSuffix: true })}
              </span>
            )}
          </div>
        </div>

        {/* Last Moved By Indicator */}
        {task.lastMovedBy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--border-subtle)', fontSize: 10, color: 'var(--text-3)' }}>
            <span style={{ fontStyle: 'italic' }}>Updated by:</span>
            {task.lastMovedBy.photo ? (
              <img src={task.lastMovedBy.photo} style={{ width: 14, height: 14, borderRadius: '50%' }} alt="" title={task.lastMovedBy.name} />
            ) : (
              <div className="avatar-placeholder" style={{ width: 14, height: 14, fontSize: 6 }} title={task.lastMovedBy.name}>
                {task.lastMovedBy.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span style={{ fontWeight: 500, color: 'var(--text-2)' }}>{task.lastMovedBy.name}</span>
          </div>
        )}
      </div>
      {showDetail && <TaskDetailModal task={task} projectId={projectId} onClose={() => setShowDetail(false)} />}
    </>
  );
}
