'use client';
import { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  DragStartEvent, DragEndEvent, closestCorners,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Task, TaskStatus, Project } from '@/types';
import KanbanColumn from './KanbanColumn';
import TaskCard from './TaskCard';
import { motion } from 'framer-motion';

const COLUMNS: { id: TaskStatus; label: string; color: string; emoji: string }[] = [
  { id: 'pending',       label: 'Pending',        color: '#475569', emoji: '📌' },
  { id: 'in_progress',   label: 'In Progress',    color: '#F59E0B', emoji: '🔄' },
  { id: 'testing',       label: 'Testing',        color: '#3B82F6', emoji: '🧪' },
  { id: 'completed',     label: 'Completed',      color: '#10B981', emoji: '✅' },
  { id: 'github_pushed', label: 'GitHub',         color: '#8B5CF6', emoji: '🐙' },
  { id: 'deployed',      label: 'Deployed',       color: '#EC4899', emoji: '🚀' },
];

interface Props {
  tasks: Task[];
  projectId: string;
  project: Project | null;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export default function KanbanBoard({ tasks, projectId, project, onStatusChange }: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

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
    const columnIds = COLUMNS.map(c => c.id);

    // Dropped over a column
    if (columnIds.includes(overId as TaskStatus)) {
      const task = tasks.find(t => t.id === active.id);
      if (task && task.status !== overId) {
        onStatusChange(String(active.id), overId as TaskStatus);
      }
      return;
    }

    // Dropped over another task — figure out target column
    const targetTask = tasks.find(t => t.id === overId);
    if (targetTask) {
      const task = tasks.find(t => t.id === active.id);
      if (task && task.status !== targetTask.status) {
        onStatusChange(String(active.id), targetTask.status);
      }
    }
  };

  return (
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
  );
}
