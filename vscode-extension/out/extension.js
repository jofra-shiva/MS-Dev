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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const AuthManager_1 = require("./auth/AuthManager");
const SidebarWebviewProvider_1 = require("./providers/SidebarWebviewProvider");
const ProjectDashboardPanel_1 = require("./panels/ProjectDashboardPanel");
const taskService_1 = require("./firebase/taskService");
let allTasksUnsubscribe = null;
let notifUnsubscribe = null;
let statusBarItem;
let seenNotifIds = new Set();
async function activate(context) {
    console.log('[MSDEV] Extension activated.');
    // ─── Auth Manager ────────────────────────────────────────────────────────
    const authManager = new AuthManager_1.AuthManager(context);
    // ─── Sidebar Webview Provider ─────────────────────────────────────────────
    const sidebarProvider = new SidebarWebviewProvider_1.SidebarWebviewProvider(vscode.Uri.file(context.extensionPath));
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(SidebarWebviewProvider_1.SidebarWebviewProvider.viewId, sidebarProvider, {
        webviewOptions: { retainContextWhenHidden: true },
    }));
    // ─── Status Bar ──────────────────────────────────────────────────────────
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = 'workbench.view.extension.msdev-sidebar';
    context.subscriptions.push(statusBarItem);
    // ─── Auth State Handler ──────────────────────────────────────────────────
    authManager.onAuthStateChange(async (user) => {
        if (user) {
            sidebarProvider.setLoggedIn(true);
            sidebarProvider.setUser(user);
            statusBarItem.text = '$(project) MSDEV';
            statusBarItem.tooltip = `MSDEV Projects — ${user.displayName || user.email}`;
            statusBarItem.show();
            await startListeners(user.uid, sidebarProvider, user, context);
        }
        else {
            stopListeners();
            sidebarProvider.setLoggedIn(false);
            sidebarProvider.setUser(null);
            sidebarProvider.updateData([], new Map());
            statusBarItem.hide();
            seenNotifIds.clear();
            // Close any open dashboards
            for (const panel of ProjectDashboardPanel_1.ProjectDashboardPanel.currentPanels.values()) {
                panel.dispose();
            }
        }
    });
    // ─── Restore session silently ─────────────────────────────────────────────
    try {
        await authManager.restoreSession();
    }
    catch {
        // Firebase config not set yet — that's OK
    }
    // ─── Register Commands ───────────────────────────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('msdev.login', async () => {
        await authManager.loginWithEmail();
    }));
    context.subscriptions.push(vscode.commands.registerCommand('msdev.logout', async () => {
        const confirm = await vscode.window.showWarningMessage('Sign out of MSDEV?', { modal: true }, 'Sign Out');
        if (confirm === 'Sign Out') {
            await authManager.logout();
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('msdev.refreshProjects', () => {
        vscode.window.showInformationMessage('MSDEV: Project list refreshed.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('msdev.openProjectDashboard', (project) => {
        const user = authManager.currentUser;
        if (!user || !project) {
            return;
        }
        ProjectDashboardPanel_1.ProjectDashboardPanel.createOrShow(context.extensionPath, project, user);
    }));
    context.subscriptions.push(vscode.commands.registerCommand('msdev.openLocalFolder', async (project) => {
        if (!project || !project.id) {
            return;
        }
        const configKey = `msdev.localProject.${project.id}`;
        const savedPath = context.globalState.get(configKey);
        if (savedPath) {
            vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(savedPath), true);
        }
        else {
            const result = await vscode.window.showOpenDialog({
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: `Link to ${project.name}`,
                title: `Select Local Folder for ${project.name}`
            });
            if (result && result[0]) {
                const localPath = result[0].fsPath;
                await context.globalState.update(configKey, localPath);
                vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(localPath), true);
            }
        }
    }));
    // ── Send task description to Antigravity chat ─────────────────────────────
    context.subscriptions.push(vscode.commands.registerCommand('msdev.sendTaskToChat', async (taskContent) => {
        try {
            await vscode.commands.executeCommand('workbench.action.chat.open', { query: taskContent });
        }
        catch {
            await vscode.env.clipboard.writeText(taskContent);
            vscode.window.showInformationMessage('📋 Description copied to clipboard!');
        }
    }));
}
// ─────────────────────────────────────────────────────────────────────────────
// Start Firestore listeners after login
// ─────────────────────────────────────────────────────────────────────────────
async function startListeners(uid, sidebarProvider, user, context) {
    stopListeners();
    let projectIds = [];
    let projects = [];
    try {
        projectIds = await (0, taskService_1.getUserProjectIds)(uid);
        projects = await (0, taskService_1.getProjects)(projectIds);
    }
    catch (err) {
        console.error('[MSDEV] Failed to load project IDs:', err);
    }
    if (projectIds.length === 0) {
        sidebarProvider.updateData([], new Map());
        return;
    }
    // Subscribe to all tasks to drive sidebar task counts
    allTasksUnsubscribe = (0, taskService_1.subscribeToAllTasks)(projectIds, (tasks) => {
        const tasksByProject = new Map();
        for (const p of projects) {
            tasksByProject.set(p.id, []);
        }
        for (const t of tasks) {
            if (!tasksByProject.has(t.projectId)) {
                tasksByProject.set(t.projectId, []);
            }
            tasksByProject.get(t.projectId).push(t);
        }
        sidebarProvider.updateData(projects, tasksByProject);
        statusBarItem.text = `$(project) MSDEV · ${projects.length} Projects`;
    });
    // ── Notification listener ──────────────────────────────────────────────────
    notifUnsubscribe = (0, taskService_1.subscribeToNotifications)(uid, (notifs) => {
        const newOnes = notifs.filter(n => !seenNotifIds.has(n.id));
        for (const notif of newOnes) {
            seenNotifIds.add(notif.id);
            vscode.window
                .showInformationMessage(`🔔 ${notif.title}: ${notif.body}`, 'View Projects')
                .then(action => {
                if (action === 'View Projects') {
                    vscode.commands.executeCommand('workbench.view.extension.msdev-sidebar');
                }
            });
        }
        const unread = notifs.length;
        sidebarProvider.setUnreadCount(unread);
        if (unread > 0) {
            statusBarItem.text = `$(bell) ${unread} · $(project) MSDEV`;
        }
    });
}
function stopListeners() {
    allTasksUnsubscribe?.();
    notifUnsubscribe?.();
    allTasksUnsubscribe = null;
    notifUnsubscribe = null;
}
function deactivate() {
    stopListeners();
}
//# sourceMappingURL=extension.js.map