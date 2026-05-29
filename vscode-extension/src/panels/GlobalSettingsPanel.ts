import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { User } from '@firebase/auth';
import { getUserProfile, updateUserSettings } from '../firebase/taskService';

export class GlobalSettingsPanel {
  public static currentPanel: GlobalSettingsPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _user: User;
  
  private _profileData: any = {};

  public static createOrShow(extensionPath: string, user: User) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (GlobalSettingsPanel.currentPanel) {
      GlobalSettingsPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'msdevGlobalSettings',
      'MSDEV Settings',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
        retainContextWhenHidden: true,
      }
    );

    GlobalSettingsPanel.currentPanel = new GlobalSettingsPanel(panel, extensionPath, user);
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
      const data = await getUserProfile(this._user.uid);
      if (data) {
        this._profileData = {
          displayName: this._user.displayName || data.displayName || '',
          email: this._user.email || data.email || '',
          githubUsername: data.githubUsername || '',
          emailNotifications: data.emailNotifications ?? true,
          pushNotifications: data.pushNotifications ?? false,
          theme: data.theme || 'system',
        };
      } else {
        this._profileData = {
          displayName: this._user.displayName || '',
          email: this._user.email || '',
          githubUsername: '',
          emailNotifications: true,
          pushNotifications: false,
          theme: 'system',
        };
      }
      this._pushState();
    } catch (err) {
      console.error('[MSDEV] Failed to load settings:', err);
    }
  }
  
  private _pushState() {
    this._panel.webview.postMessage({
      command: 'updateAll',
      profile: this._profileData
    });
  }

  private async _handleMessage(msg: any) {
    switch (msg.command) {
      case 'saveSettings': {
        try {
          // Note: In the web app, email and displayName are NOT saved via updateDoc,
          // only githubUsername, emailNotifications, and pushNotifications.
          // We mirror that logic here.
          await updateUserSettings(this._user.uid, {
            githubUsername: msg.formData.githubUsername,
            emailNotifications: msg.formData.emailNotifications,
            pushNotifications: msg.formData.pushNotifications,
            theme: msg.formData.theme,
          });
          
          vscode.window.showInformationMessage('Settings saved successfully!');
          
          // Re-fetch to ensure local state is synced
          await this._loadData();
          
          this._panel.webview.postMessage({ command: 'saveComplete', success: true });
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to save settings: ${err.message}`);
          this._panel.webview.postMessage({ command: 'saveComplete', success: false });
        }
        break;
      }
    }
  }

  private _getHtmlContent(): string {
    const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'settings-list.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }

  public dispose() {
    GlobalSettingsPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
