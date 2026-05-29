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
exports.GlobalProjectsPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const taskService_1 = require("../firebase/taskService");
class GlobalProjectsPanel {
    static createOrShow(extensionPath, user) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (GlobalProjectsPanel.currentPanel) {
            GlobalProjectsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('msdevProjectsList', 'MSDEV Projects', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
            retainContextWhenHidden: true,
        });
        GlobalProjectsPanel.currentPanel = new GlobalProjectsPanel(panel, extensionPath, user);
    }
    constructor(panel, extensionPath, user) {
        this._disposables = [];
        this._projects = [];
        this._tasks = [];
        this._panel = panel;
        this._extensionPath = extensionPath;
        this._user = user;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg), null, this._disposables);
        this._render();
        this._loadData();
    }
    async _render() {
        this._panel.webview.html = this._getHtmlContent();
    }
    async _loadData() {
        try {
            const projectIds = await (0, taskService_1.getUserProjectIds)(this._user.uid);
            this._projects = await (0, taskService_1.getProjects)(projectIds);
            this._unsubTasks = (0, taskService_1.subscribeToAllTasks)(projectIds, (tasks) => {
                this._tasks = tasks;
                this._pushAll();
            });
        }
        catch (err) {
            console.error('[MSDEV] Failed to load projects list data:', err);
        }
    }
    _pushAll() {
        this._panel.webview.postMessage({
            command: 'updateAll',
            projects: this._projects,
            tasks: this._serializeTasks(this._tasks),
            user: {
                uid: this._user.uid,
                displayName: this._user.displayName,
                photoURL: this._user.photoURL,
                email: this._user.email,
            }
        });
    }
    async _handleMessage(msg) {
        switch (msg.command) {
            case 'openProject': {
                const p = this._projects.find(p => p.id === msg.projectId);
                if (p) {
                    vscode.commands.executeCommand('msdev.openProjectDashboard', p);
                }
                break;
            }
            case 'createProject': {
                try {
                    const colors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    const pid = await (0, taskService_1.createProject)({ name: msg.name, description: msg.description, liveUrl: msg.liveUrl, color: randomColor }, this._user.uid, this._user.displayName || 'Unknown', this._user.email || '', this._user.photoURL || '');
                    // Re-fetch project list to include the new project
                    const projectIds = await (0, taskService_1.getUserProjectIds)(this._user.uid);
                    this._projects = await (0, taskService_1.getProjects)(projectIds);
                    this._pushAll();
                    this._panel.webview.postMessage({ command: 'projectCreated', projectId: pid });
                    vscode.window.showInformationMessage(`Project "${msg.name}" created!`);
                }
                catch (e) {
                    vscode.window.showErrorMessage(`Failed to create project: ${e.message}`);
                    this._panel.webview.postMessage({ command: 'projectCreateError' });
                }
                break;
            }
        }
    }
    _getHtmlContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'projects-list.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const nonce = crypto.randomBytes(16).toString('hex');
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        return html;
    }
    _serializeTasks(tasks) {
        return tasks.map(t => ({
            ...t,
            dueDate: t.dueDate?.toISOString() ?? null,
            createdAt: t.createdAt?.toISOString() ?? null,
            updatedAt: t.updatedAt?.toISOString() ?? null,
        }));
    }
    dispose() {
        this._unsubTasks?.();
        GlobalProjectsPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
exports.GlobalProjectsPanel = GlobalProjectsPanel;
//# sourceMappingURL=GlobalProjectsPanel.js.map