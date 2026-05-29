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
exports.ProjectTreeProvider = exports.ProjectTreeItem = void 0;
const vscode = __importStar(require("vscode"));
// ─── Tree Item Types ────────────────────────────────────────────────────────
class ProjectTreeItem extends vscode.TreeItem {
    constructor(project, taskCount) {
        super(project.name, vscode.TreeItemCollapsibleState.None);
        this.project = project;
        this.contextValue = 'project';
        this.description = `${taskCount} tasks`;
        this.iconPath = new vscode.ThemeIcon('project');
        this.tooltip = `Project: ${project.name}`;
        this.command = {
            command: 'msdev.openProjectDashboard',
            title: 'Open Project Dashboard',
            arguments: [project],
        };
    }
}
exports.ProjectTreeItem = ProjectTreeItem;
// ─── Provider ───────────────────────────────────────────────────────────────
class ProjectTreeProvider {
    constructor(emptyMessage = 'No projects found 🎉') {
        this.emptyMessage = emptyMessage;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this._projects = [];
        this._projectTasks = new Map(); // projectId -> tasks
        this._isLoggedIn = false;
    }
    setLoggedIn(val) {
        this._isLoggedIn = val;
        this.refresh();
    }
    updateData(projects, tasksByProject) {
        this._projects = projects;
        this._projectTasks = tasksByProject;
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
            const item = new vscode.TreeItem('Sign in to view your projects');
            item.command = { command: 'msdev.login', title: 'Sign In' };
            item.iconPath = new vscode.ThemeIcon('account');
            return [item];
        }
        if (!element) {
            // Root — show projects
            if (this._projects.length === 0) {
                const item = new vscode.TreeItem(this.emptyMessage);
                item.iconPath = new vscode.ThemeIcon('inbox');
                return [item];
            }
            return this._projects.map(p => {
                const tasks = this._projectTasks.get(p.id) || [];
                return new ProjectTreeItem(p, tasks.length);
            });
        }
        return [];
    }
}
exports.ProjectTreeProvider = ProjectTreeProvider;
//# sourceMappingURL=ProjectTreeProvider.js.map