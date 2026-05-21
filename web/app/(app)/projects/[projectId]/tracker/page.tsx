'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { subscribeToTasks, updateTask, subscribeToProject } from '@/lib/firebase/firestore';
import { Task, Project } from '@/types';
import { useAuth } from '@/lib/hooks/useAuth';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ColDef, CellValueChangedEvent, ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';

ModuleRegistry.registerModules([AllCommunityModule]);

const StatusRenderer = (p: any) => {
  const colors: Record<string, string> = { pending: '#475569', in_progress: '#F59E0B', testing: '#3B82F6', completed: '#10B981' };
  return <span style={{ padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${colors[p.value] || '#475569'}20`, color: colors[p.value] || '#475569' }}>{(p.value || '').replace('_', ' ')}</span>;
};

const PriorityRenderer = (p: any) => {
  const colors: Record<string, string> = { low: '#475569', medium: '#3B82F6', high: '#F59E0B', urgent: '#EF4444' };
  return <span style={{ padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: `${colors[p.value] || '#475569'}20`, color: colors[p.value] || '#475569' }}>{p.value}</span>;
};

const ProgressRenderer = (p: any) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
    <div style={{ flex: 1, height: 5, background: 'var(--bg-elevated)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${p.value || 0}%`, background: 'linear-gradient(90deg,#6366F1,#8B5CF6)', borderRadius: 99 }} />
    </div>
    <span style={{ fontSize: 11, color: 'var(--text-2)', minWidth: 28 }}>{p.value || 0}%</span>
  </div>
);

export default function TrackerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'bug' | 'feature' | 'improvement'>('all');

  useEffect(() => {
    const u1 = subscribeToProject(projectId, setProject);
    const u2 = subscribeToTasks(projectId, t => {
      setTasks(t);
      setLiveIndicator(true);
      setTimeout(() => setLiveIndicator(false), 1500);
    });
    return () => { u1(); u2(); };
  }, [projectId]);

  const handleCellChanged = useCallback(async (e: CellValueChangedEvent) => {
    if (!user) return;
    const task = e.data as Task;
    const field = e.colDef.field as string;
    const newValue = e.newValue;
    try {
      await updateTask(projectId, task.id, { 
        [field]: newValue,
        lastMovedBy: {
          uid: user.uid,
          name: user.displayName || 'Unknown User',
          photo: user.photoURL || '',
          date: new Date()
        }
      });
      toast.success('✓ Saved', { duration: 1200 });
    } catch { toast.error('Save failed'); e.node.setDataValue(field, e.oldValue); }
  }, [projectId, user]);

  const handleExport = () => {
    const headers = ['Task Title', 'Type', 'Status', 'Priority', 'Module', 'Assignee', 'Progress', 'Due Date'];
    const rows = tasks.map(t => [
      t.title || '',
      t.type || '',
      t.status || '',
      t.priority || '',
      t.module || '',
      t.assigneeName || '',
      t.progress || 0,
      t.dueDate ? format((t.dueDate as any).toDate?.() || new Date(t.dueDate as any), 'yyyy-MM-dd') : ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.map(v => `"${v}"`).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${project?.name || 'Project'}_Tasks.csv`;
    link.click();
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Live link copied to clipboard!');
  };

  const getRowStyle = useCallback((params: any) => {
    if (params.data?.status === 'completed') return { background: 'rgba(16, 185, 129, 0.08)' }; // light green
    if (params.data?.status === 'in_progress') return { background: 'rgba(245, 158, 11, 0.08)' }; // light yellow/orange
    if (params.data?.status === 'testing') return { background: 'rgba(59, 130, 246, 0.08)' }; // light blue
    return undefined;
  }, []);

  const colDefs: ColDef[] = [
    { headerName: 'S.No', valueGetter: 'node.rowIndex + 1', width: 70, editable: false, pinned: 'left', cellStyle: { color: 'var(--text-3)', fontWeight: 700, fontSize: 12 } },
    { field: 'title', headerName: 'Task Title', flex: 2, minWidth: 200, editable: true, cellStyle: (p: any) => ({ fontWeight: 600, textDecoration: p.data?.status === 'completed' ? 'line-through' : 'none', opacity: p.data?.status === 'completed' ? 0.6 : 1 }) },
    { field: 'type', headerName: 'Type', width: 110, editable: true, cellRenderer: (p: any) => {
        const icons: Record<string, string> = { bug: 'Bug', feature: 'Feature', improvement: 'Imp.' };
        return <span style={{ fontSize: 12 }}>{icons[p.value] || 'Task'}</span>;
      }, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['bug', 'feature', 'improvement'] } },
    { field: 'status', headerName: 'Status', width: 140, editable: true, cellRenderer: StatusRenderer, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['pending', 'in_progress', 'testing', 'completed'] } },
    { field: 'priority', headerName: 'Priority', width: 110, editable: true, cellRenderer: PriorityRenderer, cellEditor: 'agSelectCellEditor', cellEditorParams: { values: ['low', 'medium', 'high', 'urgent'] } },
    { field: 'module', headerName: 'Module', width: 140, editable: true },
    { field: 'assigneeName', headerName: 'Assignee', width: 150, editable: false },
    { field: 'progress', headerName: 'Progress', width: 180, editable: true, cellRenderer: ProgressRenderer, type: 'numericColumn' },
    { field: 'dueDate', headerName: 'Due Date', width: 130, editable: false, valueFormatter: p => p.value ? format(p.value.toDate?.() || new Date(p.value), 'MMM d, yyyy') : '—' },
    { field: 'githubRef.lastCommitSha', headerName: 'Last Commit', width: 130, editable: false, valueFormatter: p => p.value ? p.value.slice(0, 7) : '—', cellStyle: { fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--success)' } },
    { field: 'createdAt', headerName: 'Created', width: 130, editable: false, valueFormatter: p => p.value ? format(p.value.toDate?.() || new Date(p.value), 'MMM d, yyyy') : '—' },
  ];

  return (
    <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800 }}>Project Tracker</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <p style={{ color: 'var(--text-2)', fontSize: 13 }}>{tasks.length} tasks · Spreadsheet view</p>
            {liveIndicator && <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 700, animation: 'fadeIn 0.2s ease' }}>● Live update</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={handleShare}>
            🔗 Share Live
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>
            📥 Download Excel
          </button>
          <button id="tracker-create-task" className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Task
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {[
          { id: 'all', label: 'All Tasks' },
          { id: 'bug', label: 'Bugs' },
          { id: 'feature', label: 'Features' },
          { id: 'improvement', label: 'Improvements' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-1)' : 'var(--text-3)',
              border: 'none', padding: '6px 14px', borderRadius: 99, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="ag-theme-msdev" style={{ flex: 1, width: '100%' }}>
        <AgGridReact
          theme="legacy"
          rowData={activeTab === 'all' ? tasks : tasks.filter(t => t.type === activeTab)}
          columnDefs={colDefs}
          getRowStyle={getRowStyle}
          onCellValueChanged={handleCellChanged}
          rowSelection="multiple"
          animateRows
          suppressMovableColumns={false}
          defaultColDef={{ sortable: true, filter: true, resizable: true, suppressMovable: false }}
          getRowId={p => p.data.id}
          overlayNoRowsTemplate='<span style="color:var(--text-3);font-size:13px">No tasks yet — click "Add Task" to create one</span>'
        />
      </div>
      {showCreate && <CreateTaskModal projectId={projectId} project={project} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
