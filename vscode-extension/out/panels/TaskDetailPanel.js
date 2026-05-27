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
exports.TaskDetailPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const taskService_1 = require("../firebase/taskService");
class TaskDetailPanel {
    static createOrShow(extensionPath, task, user, projectName) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (TaskDetailPanel.currentPanel) {
            TaskDetailPanel.currentPanel._panel.reveal(column);
            TaskDetailPanel.currentPanel._update(task, user, projectName);
            return;
        }
        const panel = vscode.window.createWebviewPanel('msdevTaskDetail', `Task: ${task.title.slice(0, 30)}...`, column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
            retainContextWhenHidden: true,
        });
        TaskDetailPanel.currentPanel = new TaskDetailPanel(panel, extensionPath, task, user, projectName);
    }
    constructor(panel, extensionPath, task, user, projectName) {
        this._disposables = [];
        this._panel = panel;
        this._extensionPath = extensionPath;
        this._task = task;
        this._user = user;
        this._projectName = projectName;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg), null, this._disposables);
        this._render(task, user, projectName);
    }
    async _render(task, user, projectName) {
        this._panel.title = `📋 ${task.title.slice(0, 40)}`;
        this._panel.webview.html = this._getHtmlContent();
        // Load comments then send task + comments to webview
        const comments = await (0, taskService_1.getComments)(task.projectId, task.id);
        this._panel.webview.postMessage({
            command: 'loadTask',
            task: this._serializeTask(task),
            comments: this._serializeComments(comments),
            projectName,
        });
    }
    async _update(task, user, projectName) {
        this._task = task;
        this._user = user;
        this._projectName = projectName;
        await this._render(task, user, projectName);
    }
    async _handleMessage(msg) {
        switch (msg.command) {
            case 'updateStatus': {
                if (!msg.status)
                    break;
                try {
                    await (0, taskService_1.updateTaskStatus)(this._task.projectId, this._task.id, msg.status);
                    this._task.status = msg.status;
                    this._panel.webview.postMessage({ command: 'statusUpdated', status: msg.status });
                    vscode.window.showInformationMessage(`✅ Task status updated to "${msg.status.replace(/_/g, ' ')}"`);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to update status: ${err.message}`);
                }
                break;
            }
            case 'addComment': {
                const text = await vscode.window.showInputBox({
                    title: `Add comment on: ${this._task.title}`,
                    prompt: 'Write your comment',
                    placeHolder: 'Type your comment here...',
                    ignoreFocusOut: true,
                });
                if (!text?.trim())
                    break;
                try {
                    await (0, taskService_1.addComment)(this._task.projectId, this._task.id, text.trim(), {
                        uid: this._user.uid,
                        displayName: this._user.displayName || 'Unknown',
                        photoURL: this._user.photoURL || '',
                    });
                    // Reload comments
                    const comments = await (0, taskService_1.getComments)(this._task.projectId, this._task.id);
                    this._panel.webview.postMessage({
                        command: 'updateComments',
                        comments: this._serializeComments(comments),
                    });
                    vscode.window.showInformationMessage('💬 Comment added!');
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to add comment: ${err.message}`);
                }
                break;
            }
            case 'createBranch': {
                await this._createGitBranch();
                break;
            }
        }
    }
    async runCreateBranch() {
        await this._createGitBranch();
    }
    async _createGitBranch() {
        const task = this._task;
        const kebabTitle = task.title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .slice(0, 40);
        const ticketPart = task.ticketId ? `${task.ticketId}-` : '';
        const defaultBranch = `${task.type}/${ticketPart}${kebabTitle}`;
        const branchName = await vscode.window.showInputBox({
            title: 'Create Git Branch',
            prompt: 'Confirm or edit the branch name',
            value: defaultBranch,
            ignoreFocusOut: true,
        });
        if (!branchName?.trim())
            return;
        const terminal = vscode.window.createTerminal('MSDEV: Git Branch');
        terminal.show();
        terminal.sendText(`git checkout -b ${branchName.trim()}`);
        // Update Firestore
        try {
            await (0, taskService_1.setTaskBranch)(task.projectId, task.id, branchName.trim());
            vscode.window.showInformationMessage(`⎇ Branch "${branchName.trim()}" created and linked to task!`);
        }
        catch {
            // Non-critical — branch still created locally
        }
    }
    _getHtmlContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'task-detail.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const nonce = crypto.randomBytes(16).toString('hex');
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        return html;
    }
    _serializeTask(task) {
        return {
            ...task,
            dueDate: task.dueDate?.toISOString() ?? null,
            createdAt: task.createdAt?.toISOString() ?? null,
            updatedAt: task.updatedAt?.toISOString() ?? null,
        };
    }
    _serializeComments(comments) {
        return comments.map(c => ({
            ...c,
            createdAt: c.createdAt?.toISOString() ?? null,
        }));
    }
    dispose() {
        TaskDetailPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
exports.TaskDetailPanel = TaskDetailPanel;
//# sourceMappingURL=TaskDetailPanel.js.map