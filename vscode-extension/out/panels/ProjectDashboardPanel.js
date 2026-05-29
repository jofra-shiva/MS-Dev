"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectDashboardPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const firestore_1 = require("@firebase/firestore");
const taskService_1 = require("../firebase/taskService");
const client_1 = require("../firebase/client");
class ProjectDashboardPanel {
    static createOrShow(extensionPath, project, user) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (ProjectDashboardPanel.currentPanels.has(project.id)) {
            ProjectDashboardPanel.currentPanels.get(project.id)._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('msdevProjectDashboard', `📊 ${project.name}`, column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
            retainContextWhenHidden: true,
        });
        const dashboard = new ProjectDashboardPanel(panel, extensionPath, project, user);
        ProjectDashboardPanel.currentPanels.set(project.id, dashboard);
    }
    constructor(panel, extensionPath, project, user) {
        this._disposables = [];
        this._tasks = [];
        this._activity = [];
        this._meetings = [];
        this._panel = panel;
        this._extensionPath = extensionPath;
        this._project = project;
        this._user = user;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg), null, this._disposables);
        this._render();
        this._startLiveSubscriptions();
    }
    async _render() {
        this._panel.title = `📊 ${this._project.name}`;
        this._panel.webview.html = this._getHtmlContent();
        setTimeout(() => this._pushAll(), 400);
    }
    _pushAll() {
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
    _startLiveSubscriptions() {
        const pid = this._project.id;
        this._unsubProject = (0, taskService_1.subscribeToProject)(pid, (project) => {
            this._project = project;
            this._panel.title = `📊 ${project.name}`;
            this._panel.webview.postMessage({ command: 'updateProject', project: this._serializeProject(project) });
        });
        this._unsubTasks = (0, taskService_1.subscribeToProjectTasks)(pid, (tasks) => {
            this._tasks = tasks;
            this._panel.webview.postMessage({ command: 'updateTasks', tasks: this._serializeTasks(tasks) });
        });
        this._unsubActivity = (0, taskService_1.subscribeToActivity)(pid, (activity) => {
            this._activity = activity;
            this._panel.webview.postMessage({ command: 'updateActivity', activity: this._serializeActivity(activity) });
        });
        this._unsubMeetings = (0, taskService_1.subscribeToMeetings)(pid, (meetings) => {
            this._meetings = meetings;
            this._panel.webview.postMessage({ command: 'updateMeetings', meetings: this._serializeMeetings(meetings) });
        });
    }
    async _handleMessage(msg) {
        switch (msg.command) {
            // ── Update task status (drag-and-drop or status select) ──────────────────
            case 'updateStatus': {
                if (!msg.taskId || !msg.status)
                    break;
                try {
                    await (0, taskService_1.updateTaskStatus)(this._project.id, msg.taskId, msg.status);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to update status: ${err.message}`);
                }
                break;
            }
            // ── Create full task from modal ──────────────────────────────────────────
            case 'createTaskFull': {
                const d = msg.data;
                if (!d?.title?.trim())
                    break;
                try {
                    await (0, taskService_1.addTask)(this._project.id, {
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
                        tags: d.tags ? d.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
                        createdBy: this._user.uid,
                    });
                    this._panel.webview.postMessage({ command: 'taskCreated' });
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to create task: ${err.message}`);
                    this._panel.webview.postMessage({ command: 'taskCreateError', message: err.message });
                }
                break;
            }
            // ── Update task fields (from detail modal edit) ──────────────────────────
            case 'updateTaskFull': {
                const { taskId, data } = msg;
                if (!taskId || !data)
                    break;
                const db = (0, client_1.getFirebaseDb)();
                try {
                    await (0, firestore_1.updateDoc)((0, firestore_1.doc)(db, 'projects', this._project.id, 'tasks', taskId), {
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
                            completedAt: (0, firestore_1.serverTimestamp)(),
                        } : {}),
                        updatedAt: (0, firestore_1.serverTimestamp)(),
                    });
                    this._panel.webview.postMessage({ command: 'taskUpdated', taskId });
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to update task: ${err.message}`);
                }
                break;
            }
            // ── Delete task ──────────────────────────────────────────────────────────
            case 'deleteTask': {
                if (!msg.taskId)
                    break;
                const task = this._tasks.find(t => t.id === msg.taskId);
                const db = (0, client_1.getFirebaseDb)();
                try {
                    await (0, firestore_1.deleteDoc)((0, firestore_1.doc)(db, 'projects', this._project.id, 'tasks', msg.taskId));
                    this._panel.webview.postMessage({ command: 'taskDeleted', taskId: msg.taskId });
                    vscode.window.showInformationMessage(`🗑️ Task "${task?.title || msg.taskId}" deleted.`);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to delete task: ${err.message}`);
                }
                break;
            }
            // ── Fetch comments for a task ────────────────────────────────────────────
            case 'fetchComments': {
                if (!msg.taskId)
                    break;
                try {
                    const comments = await (0, taskService_1.getComments)(this._project.id, msg.taskId);
                    this._panel.webview.postMessage({
                        command: 'commentsLoaded',
                        taskId: msg.taskId,
                        comments: comments.map(c => ({
                            ...c,
                            createdAt: c.createdAt?.toISOString() ?? null,
                        })),
                    });
                }
                catch (err) {
                    console.error('[MSDEV] Failed to fetch comments:', err);
                }
                break;
            }
            // ── Add comment from detail modal ────────────────────────────────────────
            case 'addComment': {
                if (!msg.taskId || !msg.text?.trim())
                    break;
                try {
                    await (0, taskService_1.addComment)(this._project.id, msg.taskId, msg.text.trim(), {
                        uid: this._user.uid,
                        displayName: this._user.displayName || 'Unknown',
                        photoURL: this._user.photoURL || '',
                    });
                    // Re-fetch and send updated comments
                    const updated = await (0, taskService_1.getComments)(this._project.id, msg.taskId);
                    this._panel.webview.postMessage({
                        command: 'commentsLoaded',
                        taskId: msg.taskId,
                        comments: updated.map(c => ({
                            ...c,
                            createdAt: c.createdAt?.toISOString() ?? null,
                        })),
                    });
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to add comment: ${err.message}`);
                }
                break;
            }
            // ── Create git branch ────────────────────────────────────────────────────
            case 'createBranch': {
                if (!msg.taskId)
                    break;
                const task = this._tasks.find(t => t.id === msg.taskId);
                if (!task)
                    break;
                const kebab = task.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40);
                const defaultBranch = `${task.type}/${task.ticketId ? task.ticketId + '-' : ''}${kebab}`;
                const branchName = await vscode.window.showInputBox({
                    title: 'Create Git Branch',
                    prompt: 'Confirm or edit the branch name',
                    value: defaultBranch,
                    ignoreFocusOut: true,
                });
                if (!branchName?.trim())
                    break;
                const terminal = vscode.window.createTerminal('MSDEV: Git Branch');
                terminal.show();
                terminal.sendText(`git checkout -b ${branchName.trim()}`);
                try {
                    await (0, taskService_1.setTaskBranch)(task.projectId, task.id, branchName.trim());
                }
                catch { /* non-critical */ }
                break;
            }
            case 'openLiveUrl': {
                const url = this._project.liveUrl;
                if (url)
                    vscode.env.openExternal(vscode.Uri.parse(url));
                break;
            }
            // ── Send task details to Antigravity chat ────────────────────────────
            case 'sendToChat': {
                const task = this._tasks.find(t => t.id === msg.taskId);
                if (!task)
                    break;
                const content = task.description || 'No description provided.';
                // Send to chat via command
                try {
                    await vscode.commands.executeCommand('workbench.action.chat.open', { query: content });
                }
                catch {
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
                    const proj = this._project;
                    const members = Object.entries(proj.members || {}).map(([uid, m]) => ({
                        uid,
                        name: m.displayName || m.email || uid,
                        role: m.role || 'member',
                    }));
                    const modules = [...new Set(this._tasks.map(t => t.module).filter(Boolean))];
                    const meetings = this._meetings.slice(0, 5).map(m => ({
                        id: m.id, name: m.name, date: m.date?.toISOString?.() ?? '',
                    }));
                    // Determine the API base URL from liveUrl or fall back to production
                    const liveUrl = proj.liveUrl || 'https://msdev-eight.vercel.app';
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
                    const data = await res.json();
                    if (data.task) {
                        this._panel.webview.postMessage({ command: 'aiTaskFilled', task: data.task });
                    }
                    else {
                        this._panel.webview.postMessage({ command: 'aiTaskError', error: data.error || 'No task returned' });
                    }
                }
                catch (err) {
                    this._panel.webview.postMessage({ command: 'aiTaskError', error: err.message || 'Network error' });
                }
                break;
            }
        }
    }
    _getHtmlContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'project-dashboard.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const nonce = crypto.randomBytes(16).toString('hex');
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        return html;
    }
    _serializeProject(p) { return { ...p }; }
    _serializeTasks(tasks) {
        return tasks.map(t => ({
            ...t,
            dueDate: t.dueDate?.toISOString() ?? null,
            createdAt: t.createdAt?.toISOString() ?? null,
            updatedAt: t.updatedAt?.toISOString() ?? null,
        }));
    }
    _serializeActivity(activity) {
        return activity.map(a => ({ ...a, createdAt: a.createdAt?.toISOString() ?? null }));
    }
    _serializeMeetings(meetings) {
        return meetings.map(m => ({
            ...m,
            date: m.date?.toISOString() ?? null,
            createdAt: m.createdAt?.toISOString() ?? null,
        }));
    }
    dispose() {
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
exports.ProjectDashboardPanel = ProjectDashboardPanel;
ProjectDashboardPanel.currentPanels = new Map();
//# sourceMappingURL=ProjectDashboardPanel.js.map