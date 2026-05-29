import * as vscode from 'vscode';
import { Project, Task } from '../firebase/taskService';

// ─── Tree Item Types ────────────────────────────────────────────────────────

export class ProjectTreeItem extends vscode.TreeItem {
  public readonly project: Project;

  constructor(project: Project, taskCount: number) {
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

// ─── Provider ───────────────────────────────────────────────────────────────

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _projects: Project[] = [];
  private _projectTasks = new Map<string, Task[]>(); // projectId -> tasks
  private _isLoggedIn = false;

  constructor(private emptyMessage: string = 'No projects found 🎉') {}

  setLoggedIn(val: boolean) {
    this._isLoggedIn = val;
    this.refresh();
  }

  updateData(projects: Project[], tasksByProject: Map<string, Task[]>) {
    this._projects = projects;
    this._projectTasks = tasksByProject;
    this.refresh();
  }

  refresh() {
    this._onDidChangeTreeData.fire(null);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: vscode.TreeItem): vscode.TreeItem[] {
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
