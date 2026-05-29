import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { User } from '@firebase/auth';
import { Unsubscribe } from '@firebase/firestore';
import {
  Project, Task,
  getUserProjectIds, getProjects, subscribeToAllTasks,
  createProject
} from '../firebase/taskService';

export class GlobalProjectsPanel {
  public static currentPanel: GlobalProjectsPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _user: User;
  private _projects: Project[] = [];
  private _tasks: Task[] = [];
  private _unsubTasks?: Unsubscribe;

  public static createOrShow(extensionPath: string, user: User) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (GlobalProjectsPanel.currentPanel) {
      GlobalProjectsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'msdevProjectsList',
      'MSDEV Projects',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
        retainContextWhenHidden: true,
      }
    );

    GlobalProjectsPanel.currentPanel = new GlobalProjectsPanel(panel, extensionPath, user);
  }

  private constructor(panel: vscode.WebviewPanel, extensionPath: string, user: User) {
    this._panel = panel;
    this._extensionPath = extensionPath;
    this._user = user;

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg), null, this._disposables);

    this._render();
    this._loadData();
  }

  private async _render() {
    this._panel.webview.html = this._getHtmlContent();
  }

  private async _loadData() {
    try {
      const projectIds = await getUserProjectIds(this._user.uid);
      this._projects = await getProjects(projectIds);
      
      this._unsubTasks = subscribeToAllTasks(projectIds, (tasks) => {
        this._tasks = tasks;
        this._pushAll();
      });
    } catch (err) {
      console.error('[MSDEV] Failed to load projects list data:', err);
    }
  }

  private _pushAll() {
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

  private async _handleMessage(msg: any) {
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
          const pid = await createProject(
            { name: msg.name, description: msg.description, liveUrl: msg.liveUrl, color: randomColor },
            this._user.uid,
            this._user.displayName || 'Unknown',
            this._user.email || '',
            this._user.photoURL || ''
          );
          
          // Re-fetch project list to include the new project
          const projectIds = await getUserProjectIds(this._user.uid);
          this._projects = await getProjects(projectIds);
          
          this._pushAll();
          this._panel.webview.postMessage({ command: 'projectCreated', projectId: pid });
          vscode.window.showInformationMessage(`Project "${msg.name}" created!`);
        } catch (e: any) {
          vscode.window.showErrorMessage(`Failed to create project: ${e.message}`);
          this._panel.webview.postMessage({ command: 'projectCreateError' });
        }
        break;
      }
    }
  }

  private _getHtmlContent(): string {
    const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'projects-list.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }

  private _serializeTasks(tasks: Task[]): any[] {
    return tasks.map(t => ({
      ...t,
      dueDate: t.dueDate?.toISOString() ?? null,
      createdAt: t.createdAt?.toISOString() ?? null,
      updatedAt: t.updatedAt?.toISOString() ?? null,
    }));
  }

  public dispose() {
    this._unsubTasks?.();
    GlobalProjectsPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
