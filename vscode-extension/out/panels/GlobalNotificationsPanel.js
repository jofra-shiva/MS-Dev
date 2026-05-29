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
exports.GlobalNotificationsPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const taskService_1 = require("../firebase/taskService");
class GlobalNotificationsPanel {
    static createOrShow(extensionPath, user) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (GlobalNotificationsPanel.currentPanel) {
            GlobalNotificationsPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('msdevGlobalNotifications', 'MSDEV Notifications', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
            retainContextWhenHidden: true,
        });
        GlobalNotificationsPanel.currentPanel = new GlobalNotificationsPanel(panel, extensionPath, user);
    }
    constructor(panel, extensionPath, user) {
        this._disposables = [];
        this._notifications = [];
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
    _loadData() {
        try {
            this._unsubNotifs = (0, taskService_1.subscribeToNotifications)(this._user.uid, (notifs) => {
                this._notifications = notifs;
                this._pushState();
            });
        }
        catch (err) {
            console.error('[MSDEV] Failed to load notifications:', err);
        }
    }
    _pushState() {
        this._panel.webview.postMessage({
            command: 'updateAll',
            notifications: this._serializeNotifications(this._notifications),
            user: {
                uid: this._user.uid,
                displayName: this._user.displayName,
            }
        });
    }
    async _handleMessage(msg) {
        switch (msg.command) {
            case 'markRead': {
                try {
                    await (0, taskService_1.markNotificationRead)(this._user.uid, msg.notifId);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to mark read: ${err.message}`);
                }
                break;
            }
            case 'markAllRead': {
                try {
                    await (0, taskService_1.markAllNotificationsRead)(this._user.uid);
                    vscode.window.showInformationMessage('All notifications marked as read.');
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to mark all read: ${err.message}`);
                }
                break;
            }
            case 'approveMove': {
                try {
                    await (0, taskService_1.approveTaskMovePermission)(msg.projectId, msg.taskId, msg.requesterId, msg.taskTitle);
                    await (0, taskService_1.markNotificationRead)(this._user.uid, msg.notifId);
                    vscode.window.showInformationMessage('Permission granted. They can move the task now.');
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to approve request: ${err.message}`);
                }
                break;
            }
        }
    }
    _getHtmlContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'notifications-list.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const nonce = crypto.randomBytes(16).toString('hex');
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        return html;
    }
    _serializeNotifications(notifs) {
        return notifs.map(n => ({
            ...n,
            createdAt: n.createdAt?.toISOString() ?? null,
        }));
    }
    dispose() {
        this._unsubNotifs?.();
        GlobalNotificationsPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
exports.GlobalNotificationsPanel = GlobalNotificationsPanel;
//# sourceMappingURL=GlobalNotificationsPanel.js.map