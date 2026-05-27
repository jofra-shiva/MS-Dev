import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Task, getComments, updateTaskStatus, addComment, setTaskBranch, Comment } from '../firebase/taskService';
import { User } from '@firebase/auth';

export class TaskDetailPanel {
  public static currentPanel: TaskDetailPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _task: Task;
  private _user: User;
  private _projectName: string;

  public static createOrShow(
    extensionPath: string,
    task: Task,
    user: User,
    projectName: string
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (TaskDetailPanel.currentPanel) {
      TaskDetailPanel.currentPanel._panel.reveal(column);
      TaskDetailPanel.currentPanel._update(task, user, projectName);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'msdevTaskDetail',
      `Task: ${task.title.slice(0, 30)}...`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
        retainContextWhenHidden: true,
      }
    );

    TaskDetailPanel.currentPanel = new TaskDetailPanel(panel, extensionPath, task, user, projectName);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionPath: string,
    task: Task,
    user: User,
    projectName: string
  ) {
    this._panel = panel;
    this._extensionPath = extensionPath;
    this._task = task;
    this._user = user;
    this._projectName = projectName;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(
      msg => this._handleMessage(msg),
      null,
      this._disposables
    );

    this._render(task, user, projectName);
  }

  private async _render(task: Task, user: User, projectName: string) {
    this._panel.title = `📋 ${task.title.slice(0, 40)}`;
    this._panel.webview.html = this._getHtmlContent();

    // Load comments then send task + comments to webview
    const comments = await getComments(task.projectId, task.id);
    this._panel.webview.postMessage({
      command: 'loadTask',
      task: this._serializeTask(task),
      comments: this._serializeComments(comments),
      projectName,
    });
  }

  private async _update(task: Task, user: User, projectName: string) {
    this._task = task;
    this._user = user;
    this._projectName = projectName;
    await this._render(task, user, projectName);
  }

  private async _handleMessage(msg: { command: string; status?: string }) {
    switch (msg.command) {
      case 'updateStatus': {
        if (!msg.status) break;
        try {
          await updateTaskStatus(this._task.projectId, this._task.id, msg.status as any);
          this._task.status = msg.status as any;
          this._panel.webview.postMessage({ command: 'statusUpdated', status: msg.status });
          vscode.window.showInformationMessage(
            `✅ Task status updated to "${msg.status.replace(/_/g, ' ')}"`
          );
        } catch (err: any) {
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
        if (!text?.trim()) break;
        try {
          await addComment(this._task.projectId, this._task.id, text.trim(), {
            uid: this._user.uid,
            displayName: this._user.displayName || 'Unknown',
            photoURL: this._user.photoURL || '',
          });
          // Reload comments
          const comments = await getComments(this._task.projectId, this._task.id);
          this._panel.webview.postMessage({
            command: 'updateComments',
            comments: this._serializeComments(comments),
          });
          vscode.window.showInformationMessage('💬 Comment added!');
        } catch (err: any) {
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

  public async runCreateBranch() {
    await this._createGitBranch();
  }

  private async _createGitBranch() {
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

    if (!branchName?.trim()) return;

    const terminal = vscode.window.createTerminal('MSDEV: Git Branch');
    terminal.show();
    terminal.sendText(`git checkout -b ${branchName.trim()}`);

    // Update Firestore
    try {
      await setTaskBranch(task.projectId, task.id, branchName.trim());
      vscode.window.showInformationMessage(
        `⎇ Branch "${branchName.trim()}" created and linked to task!`
      );
    } catch {
      // Non-critical — branch still created locally
    }
  }

  private _getHtmlContent(): string {
    const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'task-detail.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }

  private _serializeTask(task: Task): any {
    return {
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
      createdAt: task.createdAt?.toISOString() ?? null,
      updatedAt: task.updatedAt?.toISOString() ?? null,
    };
  }

  private _serializeComments(comments: Comment[]): any[] {
    return comments.map(c => ({
      ...c,
      createdAt: c.createdAt?.toISOString() ?? null,
    }));
  }

  public dispose() {
    TaskDetailPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
