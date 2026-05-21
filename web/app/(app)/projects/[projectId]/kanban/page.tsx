'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToProject, subscribeToTasks, updateTask, logActivity } from '@/lib/firebase/firestore';
import { Task, TaskStatus, Project } from '@/types';
import { useAuth } from '@/lib/hooks/useAuth';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import toast from 'react-hot-toast';

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeToProject(projectId, p => setProject(p));
    const u2 = subscribeToTasks(projectId, t => { setTasks(t); setLoading(false); });
    return () => { u1(); u2(); };
  }, [projectId]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      await updateTask(projectId, taskId, { 
        status: newStatus, 
        progress: newStatus === 'completed' ? 100 : newStatus === 'testing' ? 75 : newStatus === 'in_progress' ? 30 : 0,
        lastMovedBy: {
          uid: user!.uid,
          name: user!.displayName || 'Unknown User',
          photo: user!.photoURL || '',
          date: new Date()
        }
      });
      await logActivity(projectId, {
        type: newStatus === 'completed' ? 'task_completed' : 'task_updated',
        userId: user!.uid, userName: user!.displayName||'',
        userPhoto: user!.photoURL||'', taskId, taskTitle: task.title,
        metadata: { from: task.status, to: newStatus },
      });
      if (newStatus === 'completed') toast.success(`✅ "${task.title}" completed!`);
    } catch { toast.error('Failed to update task'); }
  };

  return (
    <div className="animate-fadeIn" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>Kanban Board</h1>
          <p style={{ color:'var(--text-2)', fontSize:13, marginTop:2 }}>{tasks.length} tasks · {project?.name}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button id="create-task-btn" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Task
          </button>
        </div>
      </div>

      {loading
        ? <div style={{ display:'flex', gap:16, flex:1 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width:300, flexShrink:0, borderRadius:12 }} />)}
          </div>
        : <KanbanBoard tasks={tasks} projectId={projectId} project={project} onStatusChange={handleStatusChange} />
      }
      {showCreate && <CreateTaskModal projectId={projectId} project={project} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
