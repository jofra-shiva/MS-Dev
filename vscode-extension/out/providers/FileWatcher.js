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
exports.FileWatcher = void 0;
exports.detectModuleFromFile = detectModuleFromFile;
exports.findBestMatchingTask = findBestMatchingTask;
const vscode = __importStar(require("vscode"));
const taskService_1 = require("../firebase/taskService");
// Module alias map — same as web AI system
const MODULE_ALIASES = {
    'chat': ['message', 'chat', 'conversation', 'inbox', 'messages'],
    'authentication': ['auth', 'login', 'logout', 'signin', 'signup', 'otp', 'password', 'register'],
    'dashboard': ['dashboard', 'home', 'overview', 'stats', 'analytics', 'summary'],
    'task management': ['kanban', 'task', 'ticket', 'board', 'todo'],
    'notifications': ['notification', 'alert', 'bell', 'notif'],
    'meetings': ['meeting', 'sync', 'standup', 'meet', 'call'],
    'user profile': ['profile', 'user', 'account', 'avatar', 'settings'],
    'github integration': ['github', 'commit', 'webhook', 'deploy', 'repo', 'git'],
    'billing': ['payment', 'billing', 'invoice', 'subscription', 'stripe'],
    'settings': ['setting', 'config', 'configuration', 'preference'],
    'reports': ['report', 'export', 'pdf', 'excel', 'analytics'],
    'mobile app': ['mobile', 'android', 'ios', 'react-native', 'expo'],
};
/**
 * Detect which module a file path belongs to.
 * Returns the canonical module name (lowercase) or null if unknown.
 */
function detectModuleFromFile(filePath) {
    const normalized = filePath.toLowerCase().replace(/\\/g, '/');
    const parts = normalized.split('/');
    for (const [canonicalModule, aliases] of Object.entries(MODULE_ALIASES)) {
        for (const alias of aliases) {
            if (parts.some(p => p.includes(alias))) {
                return canonicalModule;
            }
        }
    }
    return null;
}
/**
 * Find the best matching task for a given module from the user's task list.
 * Priority: in_progress > pending, and only if the task's module matches.
 */
function findBestMatchingTask(detectedModule, tasks, userId) {
    const openStatuses = ['pending', 'in_progress'];
    const candidates = tasks.filter(t => {
        if (!openStatuses.includes(t.status))
            return false;
        if (t.assigneeId && t.assigneeId !== userId)
            return false;
        const taskModule = (t.module || '').toLowerCase().trim();
        const moduleAliases = MODULE_ALIASES[detectedModule] || [detectedModule];
        // Direct canonical match
        if (taskModule === detectedModule)
            return true;
        // Check aliases
        for (const alias of moduleAliases) {
            if (taskModule.includes(alias) || alias.includes(taskModule))
                return true;
        }
        return false;
    });
    if (candidates.length === 0)
        return null;
    // Prefer in_progress over pending, then by priority
    const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
    const statusWeight = { in_progress: 2, pending: 1 };
    candidates.sort((a, b) => {
        const sw = (statusWeight[b.status] ?? 0) - (statusWeight[a.status] ?? 0);
        if (sw !== 0)
            return sw;
        return (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
    });
    return candidates[0];
}
// ─────────────────────────────────────────────
// File Watcher Manager
// ─────────────────────────────────────────────
class FileWatcher {
    constructor(statusBarItem) {
        this.disposables = [];
        this.lastDetectedModule = null;
        this.lastAutoMovedTaskId = null;
        this.currentTasks = [];
        this.currentUserId = null;
        this.cooldownTimer = null;
        this.statusBarItem = statusBarItem;
    }
    /** Call this whenever the task list updates from Firestore */
    updateTasks(tasks, userId) {
        this.currentTasks = tasks;
        this.currentUserId = userId;
    }
    start() {
        // Watch when user switches to a different file
        const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.handleFileActivated(editor.document.uri.fsPath);
            }
        });
        this.disposables.push(onActiveEditorChange);
        // Also check current file immediately
        const currentEditor = vscode.window.activeTextEditor;
        if (currentEditor) {
            this.handleFileActivated(currentEditor.document.uri.fsPath);
        }
    }
    handleFileActivated(filePath) {
        if (!this.currentUserId || this.currentTasks.length === 0)
            return;
        const detectedModule = detectModuleFromFile(filePath);
        if (!detectedModule)
            return;
        // Debounce — only act if module changed, with 2 second delay
        if (detectedModule === this.lastDetectedModule)
            return;
        if (this.cooldownTimer)
            clearTimeout(this.cooldownTimer);
        this.cooldownTimer = setTimeout(async () => {
            await this.tryAutoMoveTask(detectedModule, filePath);
        }, 2000);
    }
    async tryAutoMoveTask(detectedModule, filePath) {
        const userId = this.currentUserId;
        if (!userId)
            return;
        const matchedTask = findBestMatchingTask(detectedModule, this.currentTasks, userId);
        if (!matchedTask)
            return;
        // Skip if already in progress or already auto-moved this task
        if (matchedTask.status === 'in_progress') {
            this.lastDetectedModule = detectedModule;
            this.lastAutoMovedTaskId = matchedTask.id;
            this.updateStatusBar(matchedTask);
            return;
        }
        if (matchedTask.status !== 'pending')
            return;
        // Don't auto-move the same task twice in a session without user going elsewhere
        if (this.lastAutoMovedTaskId === matchedTask.id)
            return;
        try {
            await (0, taskService_1.updateTaskStatus)(matchedTask.projectId, matchedTask.id, 'in_progress');
            this.lastDetectedModule = detectedModule;
            this.lastAutoMovedTaskId = matchedTask.id;
            this.updateStatusBar(matchedTask);
            vscode.window
                .showInformationMessage(`🚀 Started: "${matchedTask.title}" moved to In Progress`, 'View Task', 'Undo')
                .then(async (action) => {
                if (action === 'Undo') {
                    await (0, taskService_1.updateTaskStatus)(matchedTask.projectId, matchedTask.id, 'pending');
                    this.lastAutoMovedTaskId = null;
                    vscode.window.showInformationMessage(`↩️ "${matchedTask.title}" moved back to Pending`);
                }
                else if (action === 'View Task') {
                    vscode.commands.executeCommand('workbench.view.extension.msdev-sidebar');
                }
            });
        }
        catch (e) {
            console.error('[MSDEV] Failed to auto-move task:', e);
        }
    }
    updateStatusBar(task) {
        this.statusBarItem.text = `$(play) ${task.ticketId || 'TOKEN'}: ${task.title.slice(0, 30)}${task.title.length > 30 ? '…' : ''}`;
        this.statusBarItem.tooltip = `Working on: ${task.title}\nModule: ${task.module}\nClick to open MSDEV`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }
    resetStatusBar(defaultText) {
        this.statusBarItem.text = defaultText;
        this.statusBarItem.tooltip = 'MSDEV Projects';
        this.statusBarItem.backgroundColor = undefined;
        this.lastDetectedModule = null;
        this.lastAutoMovedTaskId = null;
    }
    stop() {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        if (this.cooldownTimer)
            clearTimeout(this.cooldownTimer);
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=FileWatcher.js.map