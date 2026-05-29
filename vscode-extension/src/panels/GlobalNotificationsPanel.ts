import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { User } from '@firebase/auth';
import { Unsubscribe } from '@firebase/firestore';
import {
  MSDEVNotification,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  approveTaskMovePermission
} from '../firebase/taskService';

export class GlobalNotificationsPanel {
  public static currentPanel: GlobalNotificationsPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _user: User;
  
  private _notifications: MSDEVNotification[] = [];
  private _unsubNotifs?: Unsubscribe;

  public static createOrShow(extensionPath: string, user: User) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (GlobalNotificationsPanel.currentPanel) {
      GlobalNotificationsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'msdevGlobalNotifications',
      'MSDEV Notifications',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
        retainContextWhenHidden: true,
      }
    );

    GlobalNotificationsPanel.currentPanel = new GlobalNotificationsPanel(panel, extensionPath, user);
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

  private _loadData() {
    try {
      this._unsubNotifs = subscribeToNotifications(this._user.uid, (notifs) => {
        this._notifications = notifs;
        this._pushState();
      });
    } catch (err) {
      console.error('[MSDEV] Failed to load notifications:', err);
    }
  }
  
  private _pushState() {
    this._panel.webview.postMessage({
      command: 'updateAll',
      notifications: this._serializeNotifications(this._notifications),
      user: {
        uid: this._user.uid,
        displayName: this._user.displayName,
      }
    });
  }

  private async _handleMessage(msg: any) {
    switch (msg.command) {
      case 'markRead': {
        try {
          await markNotificationRead(this._user.uid, msg.notifId);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to mark read: ${err.message}`);
        }
        break;
      }
      case 'markAllRead': {
        try {
          await markAllNotificationsRead(this._user.uid);
          vscode.window.showInformationMessage('All notifications marked as read.');
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to mark all read: ${err.message}`);
        }
        break;
      }
      case 'approveMove': {
        try {
          await approveTaskMovePermission(msg.projectId, msg.taskId, msg.requesterId, msg.taskTitle);
          await markNotificationRead(this._user.uid, msg.notifId);
          vscode.window.showInformationMessage('Permission granted. They can move the task now.');
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to approve request: ${err.message}`);
        }
        break;
      }
    }
  }

  private _getHtmlContent(): string {
    const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'notifications-list.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }

  private _serializeNotifications(notifs: MSDEVNotification[]): any[] {
    return notifs.map(n => ({
      ...n,
      createdAt: n.createdAt?.toISOString() ?? null,
    }));
  }

  public dispose() {
    this._unsubNotifs?.();
    GlobalNotificationsPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
