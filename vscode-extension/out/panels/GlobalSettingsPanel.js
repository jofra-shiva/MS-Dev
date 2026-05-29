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
exports.GlobalSettingsPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const taskService_1 = require("../firebase/taskService");
class GlobalSettingsPanel {
    static createOrShow(extensionPath, user) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (GlobalSettingsPanel.currentPanel) {
            GlobalSettingsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('msdevGlobalSettings', 'MSDEV Settings', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
            retainContextWhenHidden: true,
        });
        GlobalSettingsPanel.currentPanel = new GlobalSettingsPanel(panel, extensionPath, user);
    }
    constructor(panel, extensionPath, user) {
        this._disposables = [];
        this._profileData = {};
        this._panel = panel;
        this._extensionPath = extensionPath;
        this._user = user;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(msg => this._handleMessage(msg), null, this._disposables);
        this._render();
        this._loadData();
    }
    async _render() {
        this._panel.webview.html = this._getHtmlContent();
    }
    async _loadData() {
        try {
            const data = await (0, taskService_1.getUserProfile)(this._user.uid);
            if (data) {
                this._profileData = {
                    displayName: this._user.displayName || data.displayName || '',
                    email: this._user.email || data.email || '',
                    githubUsername: data.githubUsername || '',
                    emailNotifications: data.emailNotifications ?? true,
                    pushNotifications: data.pushNotifications ?? false,
                    theme: data.theme || 'system',
                };
            }
            else {
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
        }
        catch (err) {
            console.error('[MSDEV] Failed to load settings:', err);
        }
    }
    _pushState() {
        this._panel.webview.postMessage({
            command: 'updateAll',
            profile: this._profileData
        });
    }
    async _handleMessage(msg) {
        switch (msg.command) {
            case 'saveSettings': {
                try {
                    // Note: In the web app, email and displayName are NOT saved via updateDoc,
                    // only githubUsername, emailNotifications, and pushNotifications.
                    // We mirror that logic here.
                    await (0, taskService_1.updateUserSettings)(this._user.uid, {
                        githubUsername: msg.formData.githubUsername,
                        emailNotifications: msg.formData.emailNotifications,
                        pushNotifications: msg.formData.pushNotifications,
                        theme: msg.formData.theme,
                    });
                    vscode.window.showInformationMessage('Settings saved successfully!');
                    // Re-fetch to ensure local state is synced
                    await this._loadData();
                    this._panel.webview.postMessage({ command: 'saveComplete', success: true });
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to save settings: ${err.message}`);
                    this._panel.webview.postMessage({ command: 'saveComplete', success: false });
                }
                break;
            }
        }
    }
    _getHtmlContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'settings-list.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const nonce = crypto.randomBytes(16).toString('hex');
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        return html;
    }
    dispose() {
        GlobalSettingsPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
exports.GlobalSettingsPanel = GlobalSettingsPanel;
//# sourceMappingURL=GlobalSettingsPanel.js.map