import * as vscode from 'vscode';
import { Task } from '../firebase/taskService';

// ─── Tree Item Types ────────────────────────────────────────────────────────

type TreeNodeType = 'group' | 'task';

export class TaskTreeItem extends vscode.TreeItem {
  public readonly nodeType: TreeNodeType;
  public readonly task?: Task;

  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    nodeType: TreeNodeType,
    task?: Task
  ) {
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
    } else {
      this.contextValue = 'group';
    }
  }

  private _buildTooltip(task: Task): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${task.title}**\n\n`);
    if (task.description) md.appendMarkdown(`${task.description}\n\n`);
    md.appendMarkdown(`- **Module**: ${task.module || 'N/A'}\n`);
    md.appendMarkdown(`- **Priority**: ${task.priority.toUpperCase()}\n`);
    md.appendMarkdown(`- **Status**: ${task.status.replace('_', ' ')}\n`);
    if (task.dueDate) md.appendMarkdown(`- **Due**: ${task.dueDate.toLocaleDateString()}\n`);
    if (task.tags?.length) md.appendMarkdown(`- **Tags**: ${task.tags.join(', ')}\n`);
    return md;
  }

  private _buildDescription(task: Task): string {
    const parts: string[] = [];
    if (task.module) parts.push(task.module);
    if (task.dueDate) {
      const diff = Math.ceil((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (diff < 0) parts.push(`⚠ ${Math.abs(diff)}d overdue`);
      else if (diff === 0) parts.push('⚠ Due today');
      else if (diff <= 2) parts.push(`⚡ Due in ${diff}d`);
      else parts.push(`${task.dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`);
    }
    return parts.join(' · ');
  }

  private _buildIcon(task: Task): vscode.ThemeIcon {
    // Priority-coloured icons
    const color = {
      urgent: new vscode.ThemeColor('charts.red'),
      high:   new vscode.ThemeColor('charts.orange'),
      medium: new vscode.ThemeColor('charts.yellow'),
      low:    new vscode.ThemeColor('charts.green'),
    }[task.priority] ?? new vscode.ThemeColor('charts.blue');

    const icon = {
      bug: 'bug',
      feature: 'sparkle',
      improvement: 'wrench',
    }[task.type] ?? 'circle-outline';

    return new vscode.ThemeIcon(icon, color);
  }
}

// ─── Group Item ─────────────────────────────────────────────────────────────

export class GroupTreeItem extends vscode.TreeItem {
  public readonly tasks: Task[];

  constructor(label: string, tasks: Task[], emoji: string) {
    super(`${emoji} ${label} (${tasks.length})`, vscode.TreeItemCollapsibleState.Expanded);
    this.tasks = tasks;
    this.contextValue = 'group';
    this.iconPath = undefined;
  }
}

// ─── Provider ───────────────────────────────────────────────────────────────

export class TaskTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private _tasks: Task[] = [];
  private _isLoggedIn = false;
  private _projectNames = new Map<string, string>();

  constructor(private emptyMessage: string = 'No tasks assigned to you 🎉') {}

  setLoggedIn(val: boolean) {
    this._isLoggedIn = val;
    this.refresh();
  }

  setProjectNames(map: Map<string, string>) {
    this._projectNames = map;
  }

  updateTasks(tasks: Task[]) {
    this._tasks = tasks;
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

  private _buildGroups(): vscode.TreeItem[] {
    const groups: Array<{ label: string; emoji: string; statuses: string[] }> = [
      { label: 'In Progress', emoji: '🔥', statuses: ['in_progress'] },
      { label: 'Testing',     emoji: '🧪', statuses: ['testing'] },
      { label: 'Pending',     emoji: '📋', statuses: ['pending'] },
      { label: 'GitHub',      emoji: '🚀', statuses: ['github_pushed', 'deployed'] },
      { label: 'Completed',   emoji: '✅', statuses: ['completed'] },
    ];

    const items: vscode.TreeItem[] = [];

    for (const g of groups) {
      const filtered = this._tasks.filter(t => g.statuses.includes(t.status));
      if (filtered.length > 0) {
        items.push(new GroupTreeItem(g.label, filtered, g.emoji));
      }
    }

    if (items.length === 0) {
      const item = new vscode.TreeItem(this.emptyMessage);
      item.iconPath = new vscode.ThemeIcon('check');
      return [item];
    }

    return items;
  }
}
