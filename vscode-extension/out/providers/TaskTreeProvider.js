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
exports.TaskTreeProvider = exports.GroupTreeItem = exports.TaskTreeItem = void 0;
const vscode = __importStar(require("vscode"));
class TaskTreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, nodeType, task) {
        super(label, collapsibleState);
        this.nodeType = nodeType;
        this.task = task;
        if (nodeType === 'task' && task) {
            this.contextValue = 'task';
            this.tooltip = this._buildTooltip(task);
            this.description = this._buildDescription(task);
            this.iconPath = this._buildIcon(task);
            this.command = {
                command: 'msdev.openTask',
                title: 'Open Task',
                arguments: [task],
            };
        }
        else {
            this.contextValue = 'group';
        }
    }
    _buildTooltip(task) {
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${task.title}**\n\n`);
        if (task.description)
            md.appendMarkdown(`${task.description}\n\n`);
        md.appendMarkdown(`- **Module**: ${task.module || 'N/A'}\n`);
        md.appendMarkdown(`- **Priority**: ${task.priority.toUpperCase()}\n`);
        md.appendMarkdown(`- **Status**: ${task.status.replace('_', ' ')}\n`);
        if (task.dueDate)
            md.appendMarkdown(`- **Due**: ${task.dueDate.toLocaleDateString()}\n`);
        if (task.tags?.length)
            md.appendMarkdown(`- **Tags**: ${task.tags.join(', ')}\n`);
        return md;
    }
    _buildDescription(task) {
        const parts = [];
        if (task.module)
            parts.push(task.module);
        if (task.dueDate) {
            const diff = Math.ceil((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            if (diff < 0)
                parts.push(`⚠ ${Math.abs(diff)}d overdue`);
            else if (diff === 0)
                parts.push('⚠ Due today');
            else if (diff <= 2)
                parts.push(`⚡ Due in ${diff}d`);
            else
                parts.push(`${task.dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`);
        }
        return parts.join(' · ');
    }
    _buildIcon(task) {
        // Priority-coloured icons
        const color = {
            urgent: new vscode.ThemeColor('charts.red'),
            high: new vscode.ThemeColor('charts.orange'),
            medium: new vscode.ThemeColor('charts.yellow'),
            low: new vscode.ThemeColor('charts.green'),
        }[task.priority] ?? new vscode.ThemeColor('charts.blue');
        const icon = {
            bug: 'bug',
            feature: 'sparkle',
            improvement: 'wrench',
        }[task.type] ?? 'circle-outline';
        return new vscode.ThemeIcon(icon, color);
    }
}
exports.TaskTreeItem = TaskTreeItem;
// ─── Group Item ─────────────────────────────────────────────────────────────
class GroupTreeItem extends vscode.TreeItem {
    constructor(label, tasks, emoji) {
        super(`${emoji} ${label} (${tasks.length})`, vscode.TreeItemCollapsibleState.Expanded);
        this.tasks = tasks;
        this.contextValue = 'group';
        this.iconPath = undefined;
    }
}
exports.GroupTreeItem = GroupTreeItem;
// ─── Provider ───────────────────────────────────────────────────────────────
class TaskTreeProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._tasks = [];
        this._isLoggedIn = false;
        this._projectNames = new Map();
    }
    setLoggedIn(val) {
        this._isLoggedIn = val;
        this.refresh();
    }
    setProjectNames(map) {
        this._projectNames = map;
    }
    updateTasks(tasks) {
        this._tasks = tasks;
        this.refresh();
    }
    refresh() {
        this._onDidChangeTreeData.fire(null);
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this._isLoggedIn) {
            const item = new vscode.TreeItem('Sign in to view your tasks');
            item.command = { command: 'msdev.login', title: 'Sign In' };
            item.iconPath = new vscode.ThemeIcon('account');
            return [item];
        }
        if (!element) {
            // Root — show status groups
            return this._buildGroups();
        }
        if (element instanceof GroupTreeItem) {
            return element.tasks.map(t => {
                const projectName = this._projectNames.get(t.projectId) || t.projectId;
                const item = new TaskTreeItem(t.title, vscode.TreeItemCollapsibleState.None, 'task', t);
                if (projectName) {
                    item.description = `[${projectName}] ${item.description || ''}`.trim();
                }
                return item;
            });
        }
        return [];
    }
    _buildGroups() {
        const groups = [
            { label: 'In Progress', emoji: '🔥', statuses: ['in_progress'] },
            { label: 'Testing', emoji: '🧪', statuses: ['testing'] },
            { label: 'Pending', emoji: '📋', statuses: ['pending'] },
            { label: 'GitHub', emoji: '🚀', statuses: ['github_pushed', 'deployed'] },
            { label: 'Completed', emoji: '✅', statuses: ['completed'] },
        ];
        const items = [];
        for (const g of groups) {
            const filtered = this._tasks.filter(t => g.statuses.includes(t.status));
            if (filtered.length > 0) {
                items.push(new GroupTreeItem(g.label, filtered, g.emoji));
            }
        }
        if (items.length === 0) {
            const item = new vscode.TreeItem('No tasks assigned to you 🎉');
            item.iconPath = new vscode.ThemeIcon('check');
            return [item];
        }
        return items;
    }
}
exports.TaskTreeProvider = TaskTreeProvider;
//# sourceMappingURL=TaskTreeProvider.js.map