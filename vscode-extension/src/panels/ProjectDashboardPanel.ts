import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { User } from '@firebase/auth';
import { Unsubscribe, doc, updateDoc, deleteDoc, serverTimestamp, collection, query, orderBy, getDocs } from '@firebase/firestore';
import {
  Project, Task, ActivityLog, Meeting,
  updateTaskStatus, addComment, setTaskBranch, getComments,
  subscribeToProject, subscribeToProjectTasks,
  subscribeToActivity, subscribeToMeetings, addTask,
} from '../firebase/taskService';
import { getFirebaseDb } from '../firebase/client';

export class ProjectDashboardPanel {
  public static currentPanels: Map<string, ProjectDashboardPanel> = new Map();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _project: Project;
  private _tasks: Task[] = [];
  private _activity: ActivityLog[] = [];
  private _meetings: Meeting[] = [];
  private _user: User;

  private _unsubProject?: Unsubscribe;
  private _unsubTasks?: Unsubscribe;
  private _unsubActivity?: Unsubscribe;
  private _unsubMeetings?: Unsubscribe;
  private _isReady: boolean = false;

  public static createOrShow(extensionPath: string, project: Project, user: User) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (ProjectDashboardPanel.currentPanels.has(project.id)) {
      ProjectDashboardPanel.currentPanels.get(project.id)!._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'msdevProjectDashboard',
      `📊 ${project.name}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
        retainContextWhenHidden: true,
      }
    );

    const dashboard = new ProjectDashboardPanel(panel, extensionPath, project, user);
    ProjectDashboardPanel.currentPanels.set(project.id, dashboard);
  }

  private constructor(panel: vscode.WebviewPanel, extensionPath: string, project: Project, user: User) {
    this._panel = panel;
    this._extensionPath = extensionPath;
    this._project = project;
    this._user = user;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg), null, this._disposables);

    this._render();
    this._startLiveSubscriptions();
  }

  private async _render() {
    this._panel.title = `📊 ${this._project.name}`;
    this._panel.webview.html = this._getHtmlContent();
  }

  private _pushAll() {
    if (!this._isReady) return;
    this._panel.webview.postMessage({
      command: 'updateAll',
      project: this._serializeProject(this._project),
      tasks: this._serializeTasks(this._tasks),
      activity: this._serializeActivity(this._activity),
      meetings: this._serializeMeetings(this._meetings),
      user: {
        uid: this._user.uid,
        displayName: this._user.displayName,
        photoURL: this._user.photoURL,
        email: this._user.email,
      }
    });
  }

  private _startLiveSubscriptions() {
    const pid = this._project.id;

    this._unsubProject = subscribeToProject(pid, (project) => {
      this._project = project;
      this._panel.title = `📊 ${project.name}`;
      this._panel.webview.postMessage({ command: 'updateProject', project: this._serializeProject(project) });
    });

    this._unsubTasks = subscribeToProjectTasks(pid, (tasks) => {
      this._tasks = tasks;
      this._panel.webview.postMessage({ command: 'updateTasks', tasks: this._serializeTasks(tasks) });
    });

    this._unsubActivity = subscribeToActivity(pid, (activity) => {
      this._activity = activity;
      this._panel.webview.postMessage({ command: 'updateActivity', activity: this._serializeActivity(activity) });
    });

    this._unsubMeetings = subscribeToMeetings(pid, (meetings) => {
      this._meetings = meetings;
      this._panel.webview.postMessage({ command: 'updateMeetings', meetings: this._serializeMeetings(meetings) });
    });
  }

  private async _handleMessage(msg: any) {
    switch (msg.command) {
      
      case 'ready': {
        this._isReady = true;
        this._pushAll();
        break;
      }

      // ── Update task status (drag-and-drop or status select) ──────────────────
      case 'updateStatus': {
        if (!msg.taskId || !msg.status) break;
        try {
          await updateTaskStatus(this._project.id, msg.taskId, msg.status as any);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to update status: ${err.message}`);
        }
        break;
      }

      // ── Create full task from modal ──────────────────────────────────────────
      case 'createTaskFull': {
        const d = msg.data;
        if (!d?.title?.trim()) break;
        try {
          await addTask(this._project.id, {
            title: d.title.trim(),
            description: d.description?.trim() || '',
            type: d.type || 'feature',
            priority: d.priority || 'medium',
            status: d.status || 'pending',
            module: d.module?.trim() || '',
            assigneeId: d.assigneeId || null,
            assigneeName: d.assigneeName || null,
            assigneePhoto: d.assigneePhoto || null,
            dueDate: d.dueDate ? new Date(d.dueDate) : null,
            tags: d.tags ? d.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
            createdBy: this._user.uid,
          });
          this._panel.webview.postMessage({ command: 'taskCreated' });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to create task: ${err.message}`);
          this._panel.webview.postMessage({ command: 'taskCreateError', message: err.message });
        }
        break;
      }

      // ── Update task fields (from detail modal edit) ──────────────────────────
      case 'updateTaskFull': {
        const { taskId, data } = msg;
        if (!taskId || !data) break;
        const db = getFirebaseDb();
        try {
          await updateDoc(doc(db, 'projects', this._project.id, 'tasks', taskId), {
            title: data.title,
            description: data.description,
            status: data.status,
            priority: data.priority,
            type: data.type,
            progress: data.progress || 0,
            module: data.module || '',
            lastMovedBy: {
              uid: this._user.uid,
              name: this._user.displayName || 'Unknown',
              photo: this._user.photoURL || '',
              date: new Date(),
            },
            ...(data.status === 'completed' ? {
              completedBy: {
                uid: this._user.uid,
                name: this._user.displayName || 'Unknown',
                photo: this._user.photoURL || '',
                date: new Date(),
              },
              completedAt: serverTimestamp(),
            } : {}),
            updatedAt: serverTimestamp(),
          });
          this._panel.webview.postMessage({ command: 'taskUpdated', taskId });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to update task: ${err.message}`);
        }
        break;
      }

      // ── Delete task ──────────────────────────────────────────────────────────
      case 'deleteTask': {
        if (!msg.taskId) break;
        const task = this._tasks.find(t => t.id === msg.taskId);
        const db = getFirebaseDb();
        try {
          await deleteDoc(doc(db, 'projects', this._project.id, 'tasks', msg.taskId));
          this._panel.webview.postMessage({ command: 'taskDeleted', taskId: msg.taskId });
          vscode.window.showInformationMessage(`🗑️ Task "${task?.title || msg.taskId}" deleted.`);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to delete task: ${err.message}`);
        }
        break;
      }

      // ── Fetch comments for a task ────────────────────────────────────────────
      case 'fetchComments': {
        if (!msg.taskId) break;
        try {
          const comments = await getComments(this._project.id, msg.taskId);
          this._panel.webview.postMessage({
            command: 'commentsLoaded',
            taskId: msg.taskId,
            comments: comments.map(c => ({
              ...c,
              createdAt: c.createdAt?.toISOString() ?? null,
            })),
          });
        } catch (err: any) {
          console.error('[MSDEV] Failed to fetch comments:', err);
        }
        break;
      }

      // ── Add comment from detail modal ────────────────────────────────────────
      case 'addComment': {
        if (!msg.taskId || !msg.text?.trim()) break;
        try {
          await addComment(this._project.id, msg.taskId, msg.text.trim(), {
            uid: this._user.uid,
            displayName: this._user.displayName || 'Unknown',
            photoURL: this._user.photoURL || '',
          });
          // Re-fetch and send updated comments
          const updated = await getComments(this._project.id, msg.taskId);
          this._panel.webview.postMessage({
            command: 'commentsLoaded',
            taskId: msg.taskId,
            comments: updated.map(c => ({
              ...c,
              createdAt: c.createdAt?.toISOString() ?? null,
            })),
          });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to add comment: ${err.message}`);
        }
        break;
      }

      // ── Create git branch ────────────────────────────────────────────────────
      case 'createBranch': {
        if (!msg.taskId) break;
        const task = this._tasks.find(t => t.id === msg.taskId);
        if (!task) break;
        const kebab = task.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
        const defaultBranch = `${task.type}/${task.ticketId ? task.ticketId + '-' : ''}${kebab}`;
        const branchName = await vscode.window.showInputBox({
          title: 'Create Git Branch',
          prompt: 'Confirm or edit the branch name',
          value: defaultBranch,
          ignoreFocusOut: true,
        });
        if (!branchName?.trim()) break;
        const terminal = vscode.window.createTerminal('MSDEV: Git Branch');
        terminal.show();
        terminal.sendText(`git checkout -b ${branchName.trim()}`);
        try {
          await setTaskBranch(task.projectId, task.id, branchName.trim());
        } catch { /* non-critical */ }
        break;
      }

      case 'openLiveUrl': {
        const url = (this._project as any).liveUrl;
        if (url) vscode.env.openExternal(vscode.Uri.parse(url));
        break;
      }

      // ── Send task details to Antigravity chat ────────────────────────────
      case 'sendToChat': {
        const task = this._tasks.find(t => t.id === msg.taskId);
        if (!task) break;

        const content = task.description || 'No description provided.';

        // Send to chat via command
        try {
          await vscode.commands.executeCommand('workbench.action.chat.open', { query: content });
        } catch {
          // Fallback: copy to clipboard
          await vscode.env.clipboard.writeText(content);
          vscode.window.showInformationMessage('📋 Description copied to clipboard!');
        }
        break;
      }

      // ── AI Task Generation ───────────────────────────────────────────────
      case 'generateAiTask': {
        try {
          // Build project context for the AI
          const proj = this._project as any;
          const members = Object.entries(proj.members || {}).map(([uid, m]: [string, any]) => ({
            uid,
            name: m.displayName || m.email || uid,
            role: m.role || 'member',
          }));
          const modules = [...new Set(this._tasks.map(t => t.module).filter(Boolean))];
          const meetings = this._meetings.slice(0, 5).map(m => ({
            id: m.id, name: m.name, date: m.date?.toISOString?.() ?? '',
          }));

          // Determine the API base URL from liveUrl or fall back to production
          const liveUrl: string = proj.liveUrl || 'https://msdev-eight.vercel.app';
          const base = liveUrl.replace(/\/$/, '');
          const apiUrl = `${base}/api/ai-task`;

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: msg.prompt,
              projectContext: { members, modules, meetings },
            }),
          });

          if (!res.ok) {
            const err = await res.text();
            this._panel.webview.postMessage({ command: 'aiTaskError', error: `API error: ${err}` });
            break;
          }

          const data = await res.json() as any;
          if (data.task) {
            this._panel.webview.postMessage({ command: 'aiTaskFilled', task: data.task });
          } else {
            this._panel.webview.postMessage({ command: 'aiTaskError', error: data.error || 'No task returned' });
          }
        } catch (err: any) {
          this._panel.webview.postMessage({ command: 'aiTaskError', error: err.message || 'Network error' });
        }
        break;
      }
    }
  }

  private _getHtmlContent(): string {
    const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'project-dashboard.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }

  private _serializeProject(p: any): any { return { ...p }; }

  private _serializeTasks(tasks: Task[]): any[] {
    return tasks.map(t => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      createdAt: t.createdAt?.toISOString() ?? null,
      updatedAt: t.updatedAt?.toISOString() ?? null,
    }));
  }

  private _serializeActivity(activity: ActivityLog[]): any[] {
    return activity.map(a => ({ ...a, createdAt: a.createdAt?.toISOString() ?? null }));
  }

  private _serializeMeetings(meetings: Meeting[]): any[] {
    return meetings.map(m => ({
      ...m,
      date: m.date?.toISOString() ?? null,
      createdAt: m.createdAt?.toISOString() ?? null,
    }));
  }

  public dispose() {
    this._unsubProject?.();
    this._unsubTasks?.();
    this._unsubActivity?.();
    this._unsubMeetings?.();
    ProjectDashboardPanel.currentPanels.delete(this._project.id);
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
