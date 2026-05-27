'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { subscribeToProject, subscribeToTasks, updateTask, deleteTask, logActivity, subscribeToMeetings } from '@/lib/firebase/firestore';
import { Task, TaskStatus, Project, Meeting } from '@/types';
import { useAuth } from '@/lib/hooks/useAuth';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';
import TaskDetailModal from '@/components/tasks/TaskDetailModal';
import toast from 'react-hot-toast';

export default function KanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ticketParam = searchParams.get('ticket');
  
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>('');
  const [project, setProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeToProject(projectId, p => setProject(p));
    const u2 = subscribeToTasks(projectId, t => { setTasks(t); setLoading(false); });
    const u3 = subscribeToMeetings(projectId, (fetchedMeetings) => {
      const sorted = [...fetchedMeetings].sort((a,b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
      setMeetings(sorted);
      setSelectedMeetingId(prev => (prev === '' && sorted.length > 0) ? sorted[0].id : (prev === '' ? 'all' : prev));
    });
    return () => { u1(); u2(); u3(); };
  }, [projectId]);

  // Open TaskDetailModal if ticket param is present
  useEffect(() => {
    if (ticketParam && tasks.length > 0 && !selectedTask) {
      const matchingTask = tasks.find(task => task.ticketId === ticketParam || task.id === ticketParam);
      if (matchingTask) setSelectedTask(matchingTask);
    }
  }, [ticketParam, tasks, selectedTask]);

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(projectId, taskId);
      toast.success('Task deleted successfully');
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;
      await updateTask(projectId, taskId, { 
        status: newStatus, 
        progress: newStatus === 'deployed' ? 100 : newStatus === 'github_pushed' ? 100 : newStatus === 'completed' ? 100 : newStatus === 'testing' ? 75 : newStatus === 'in_progress' ? 30 : 0,
        lastMovedBy: {
          uid: user!.uid,
          name: user!.displayName || 'Unknown User',
          photo: user!.photoURL || '',
          date: new Date()
        },
        ...(newStatus === 'completed' && task.status !== 'completed' ? {
          completedBy: {
            uid: user!.uid,
            name: user!.displayName || 'Unknown User',
            photo: user!.photoURL || '',
            date: new Date(),
          }
        } : {}),
        ...(newStatus !== 'completed' && task.status === 'completed' ? { completedBy: null } : {})
      });
      await logActivity(projectId, {
        type: newStatus === 'completed' ? 'task_completed' : 'task_updated',
        userId: user!.uid, userName: user!.displayName||'',
        userPhoto: user!.photoURL||'', taskId, taskTitle: task.title,
        metadata: { from: task.status, to: newStatus },
      });
      if (newStatus === 'deployed') toast.success(`🚀 "${task.title}" is live!`);
      else if (newStatus === 'github_pushed') toast.success(`🐙 "${task.title}" pushed to GitHub!`);
      else if (newStatus === 'completed') toast.success(`✅ "${task.title}" completed!`);
    } catch { toast.error('Failed to update task'); }
  };

  const filteredTasks = selectedMeetingId === 'all' 
    ? tasks 
    : tasks.filter(t => t.meetingId === selectedMeetingId);

  const handleCloseModal = () => {
    setSelectedTask(null);
    if (ticketParam) {
      router.replace(pathname, { scroll: false });
    }
  };

  return (
    <div className="animate-fadeIn" style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 64px)' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexShrink:0 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>A to Z</h1>
          <p style={{ color:'var(--text-2)', fontSize:13, marginTop:2 }}>{filteredTasks.length} tasks · {project?.name}</p>
        </div>
        <div style={{ display:'flex', gap:12, alignItems: 'center' }}>
          {meetings.length > 0 && (
            <select 
              style={{ 
                padding: '6px 32px 6px 12px', 
                height: '32px', 
                borderRadius: '8px', 
                border: '1px solid var(--border)', 
                background: 'var(--bg-elevated)', 
                color: 'var(--text-1)', 
                fontSize: '13px', 
                cursor: 'pointer', 
                appearance: 'none', 
                backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23a1a1aa%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', 
                backgroundRepeat: 'no-repeat', 
                backgroundPosition: 'right 12px top 50%', 
                backgroundSize: '10px auto' 
              }}
              value={selectedMeetingId}
              onChange={(e) => setSelectedMeetingId(e.target.value)}
            >
              <option value="all">All Meetings</option>
              {meetings.map(m => {
                const pendingCount = tasks.filter(t => t.meetingId === m.id && t.status === 'pending').length;
                return (
                  <option key={m.id} value={m.id}>
                    {m.name || 'Unnamed Meeting'} {pendingCount > 0 ? `(${pendingCount} pending)` : ''}
                  </option>
                );
              })}
            </select>
          )}
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
        : <KanbanBoard
            tasks={filteredTasks}
            projectId={projectId}
            project={project}
            currentUser={user ? { uid: user.uid, displayName: user.displayName || '' } : undefined}
            onStatusChange={handleStatusChange}
            onDeleteTask={handleDeleteTask}
          />
      }
      {showCreate && <CreateTaskModal projectId={projectId} project={project} onClose={() => setShowCreate(false)} preselectedMeetingId={selectedMeetingId} />}
      {selectedTask && <TaskDetailModal task={selectedTask} projectId={projectId} onClose={handleCloseModal} />}
    </div>
  );
}
