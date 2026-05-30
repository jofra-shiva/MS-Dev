'use client';
import { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent, closestCorners, useDroppable
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, Project } from '@/types';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import { motion, AnimatePresence } from 'framer-motion';
import { requestTaskMovePermission } from '@/lib/firebase/firestore';
import toast from 'react-hot-toast';

const COLUMNS: { id: TaskStatus; label: string; color: string; emoji: string }[] = [
  { id: 'pending',       label: 'Pending',        color: '#475569', emoji: '📌' },
  { id: 'in_progress',   label: 'In Progress',    color: '#F59E0B', emoji: '🔄' },
  { id: 'testing',       label: 'Testing',        color: '#3B82F6', emoji: '🧪' },
  { id: 'github_pushed', label: 'GitHub',         color: '#8B5CF6', emoji: '🐙' },
  { id: 'deployed',      label: 'Deployed',       color: '#EC4899', emoji: '🚀' },
  { id: 'completed',     label: 'Completed',      color: '#10B981', emoji: '✅' },
];

interface Props {
  tasks: Task[];
  projectId: string;
  project: Project | null;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  onDeleteTask?: (taskId: string) => void;
  currentUser?: { uid: string; displayName: string; email?: string };
}



export default function KanbanBoard({ tasks, projectId, project, onStatusChange, onDeleteTask, currentUser }: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [taskToRequest, setTaskToRequest] = useState<Task | null>(null);
  const [requesting, setRequesting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const task = tasks.find(t => t.id === e.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveTask(null);
    if (!over) return;

    const overId = String(over.id);

    const task = tasks.find(t => t.id === active.id);
    if (!task) return;

    // Determine target status
    let newStatus: TaskStatus | null = null;
    const columnIds = COLUMNS.map(c => c.id);
    
    if (columnIds.includes(overId as TaskStatus)) {
      if (task.status !== overId) newStatus = overId as TaskStatus;
    } else {
      const targetTask = tasks.find(t => t.id === overId);
      if (targetTask && task.status !== targetTask.status) {
        newStatus = targetTask.status;
      }
    }

    if (!newStatus) return;

    // Check Authorization
    const isSuperAdmin = currentUser?.email === 'shivaprakash3115@gmail.com';
    const isAdmin = isSuperAdmin || project?.members?.[currentUser?.uid || '']?.role === 'admin';
    const isAssignee = task.assigneeId === currentUser?.uid;
    const isApproved = task.approvedMovers?.includes(currentUser?.uid || '');
    
    // Only restrict if someone is assigned and the current user is not authorized
    if (task.assigneeId && !isAssignee && !isApproved && !isAdmin) {
      setTaskToRequest(task);
      return; // prevent the move
    }

    onStatusChange(String(active.id), newStatus);
  };

  const handleRequestPermission = async () => {
    if (!taskToRequest || !currentUser) return;
    setRequesting(true);
    try {
      let assigneeEmail = undefined;
      if (project?.members && taskToRequest.assigneeId) {
        assigneeEmail = project.members[taskToRequest.assigneeId]?.email;
      }
      
      await requestTaskMovePermission(
        projectId,
        taskToRequest.id,
        currentUser.uid,
        currentUser.displayName,
        taskToRequest.assigneeId!,
        assigneeEmail,
        taskToRequest.title
      );
      toast.success('Permission request sent!');
      setTaskToRequest(null);
    } catch (e: any) {
      toast.error('Failed to send request: ' + e.message);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        
        <div className="kanban-board" style={{ flex: 1, minHeight: 0, overflowX: 'auto', overflowY: 'hidden' }}>
          {COLUMNS.map((col, i) => {
            const colTasks = tasks.filter(t => t.status === col.id);
            return (
              <motion.div key={col.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                <KanbanColumn
                  id={col.id}
                  label={col.label}
                  color={col.color}
                  emoji={col.emoji}
                  tasks={colTasks}
                  projectId={projectId}
                  project={project}
                />
              </motion.div>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask && (
            <div style={{ transform: 'rotate(3deg)', opacity: 0.9 }}>
              <TaskCard task={activeTask} projectId={projectId} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <AnimatePresence>
        {taskToDelete && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }} className="modal" style={{ maxWidth: 400, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: 10, borderRadius: '50%' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Delete Task?</h3>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
                Are you absolutely sure you want to delete this task? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setTaskToDelete(null)}>Cancel</button>
                <button className="btn" style={{ background: 'var(--danger)', color: 'white', border: 'none' }} onClick={() => {
                  if (taskToDelete) onDeleteTask?.(taskToDelete);
                  setTaskToDelete(null);
                }}>
                  Delete Task
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {taskToRequest && (
          <div className="modal-overlay" style={{ zIndex: 9999 }}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.15 }} className="modal" style={{ maxWidth: 400, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', padding: 10, borderRadius: '50%' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Permission Required</h3>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
                <strong>{currentUser?.displayName || 'Someone'}</strong> is trying to move this task, but it is assigned to <strong>{taskToRequest.assigneeName || 'someone else'}</strong>.
                You need their permission to move it.
                Would you like to send them a request?
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setTaskToRequest(null)} disabled={requesting}>Cancel</button>
                <button className="btn btn-primary" onClick={handleRequestPermission} disabled={requesting}>
                  {requesting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
