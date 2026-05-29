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
exports.GlobalChatPanel = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
const chatService_1 = require("../firebase/chatService");
class GlobalChatPanel {
    static createOrShow(extensionPath, user) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : vscode.ViewColumn.One;
        if (GlobalChatPanel.currentPanel) {
            GlobalChatPanel.currentPanel._panel.reveal(column);
            return;
        }
        const panel = vscode.window.createWebviewPanel('msdevGlobalChat', 'MSDEV Chats', column || vscode.ViewColumn.One, {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
            retainContextWhenHidden: true,
        });
        GlobalChatPanel.currentPanel = new GlobalChatPanel(panel, extensionPath, user);
    }
    constructor(panel, extensionPath, user) {
        this._disposables = [];
        this._chats = [];
        this._activeChatId = null;
        this._messages = [];
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
            this._unsubChats = (0, chatService_1.subscribeToUserChats)(this._user.uid, (chats) => {
                this._chats = chats;
                this._pushState();
            });
        }
        catch (err) {
            console.error('[MSDEV] Failed to load chats:', err);
        }
    }
    _switchChat(chatId) {
        if (this._activeChatId === chatId)
            return;
        this._activeChatId = chatId;
        this._messages = [];
        if (this._unsubMessages) {
            this._unsubMessages();
        }
        // Mark as read immediately when switching
        (0, chatService_1.markChatAsRead)(chatId, this._user.uid).catch(console.error);
        this._unsubMessages = (0, chatService_1.subscribeToChatMessages)(chatId, (msgs) => {
            this._messages = msgs;
            this._pushState();
            // If we are actively in this chat and receive a new message, mark as read
            (0, chatService_1.markChatAsRead)(chatId, this._user.uid).catch(console.error);
        });
        this._pushState();
    }
    _pushState() {
        this._panel.webview.postMessage({
            command: 'updateAll',
            chats: this._serializeChats(this._chats),
            activeChatId: this._activeChatId,
            messages: this._serializeMessages(this._messages),
            user: {
                uid: this._user.uid,
                displayName: this._user.displayName,
                photoURL: this._user.photoURL,
                email: this._user.email,
            }
        });
    }
    async _handleMessage(msg) {
        switch (msg.command) {
            case 'openChat': {
                this._switchChat(msg.chatId);
                break;
            }
            case 'sendMessage': {
                if (!this._activeChatId)
                    return;
                try {
                    await (0, chatService_1.sendMessage)(this._activeChatId, this._user.uid, msg.text);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to send message: ${err.message}`);
                }
                break;
            }
            case 'startDirectChat': {
                try {
                    const users = await (0, chatService_1.searchUsersByEmail)(msg.email);
                    if (users.length === 0) {
                        vscode.window.showErrorMessage(`No user found with email ${msg.email}`);
                        this._panel.webview.postMessage({ command: 'newChatError' });
                        return;
                    }
                    const targetUser = users[0];
                    if (targetUser.uid === this._user.uid) {
                        vscode.window.showErrorMessage("You can't start a chat with yourself.");
                        this._panel.webview.postMessage({ command: 'newChatError' });
                        return;
                    }
                    const chatId = await (0, chatService_1.startDirectChat)(this._user, targetUser);
                    this._panel.webview.postMessage({ command: 'chatCreated', chatId });
                    this._switchChat(chatId);
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to start chat: ${err.message}`);
                    this._panel.webview.postMessage({ command: 'newChatError' });
                }
                break;
            }
            case 'uploadMedia': {
                if (!this._activeChatId)
                    return;
                try {
                    const mediaUrl = await (0, chatService_1.uploadChatMedia)(this._activeChatId, msg.fileData, msg.fileName);
                    await (0, chatService_1.sendMessage)(this._activeChatId, this._user.uid, '', mediaUrl, 'image');
                }
                catch (err) {
                    vscode.window.showErrorMessage(`Failed to upload media: ${err.message}`);
                }
                break;
            }
        }
    }
    _getHtmlContent() {
        const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'chat-list.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        const nonce = crypto.randomBytes(16).toString('hex');
        html = html.replace(/\{\{NONCE\}\}/g, nonce);
        return html;
    }
    _serializeChats(chats) {
        return chats.map(c => ({
            ...c,
            createdAt: c.createdAt?.toISOString() ?? null,
            updatedAt: c.updatedAt?.toISOString() ?? null,
            lastMessage: c.lastMessage ? {
                ...c.lastMessage,
                createdAt: c.lastMessage.createdAt?.toISOString() ?? null,
            } : undefined
        }));
    }
    _serializeMessages(messages) {
        return messages.map(m => ({
            ...m,
            createdAt: m.createdAt?.toISOString() ?? null,
        }));
    }
    dispose() {
        this._unsubChats?.();
        this._unsubMessages?.();
        GlobalChatPanel.currentPanel = undefined;
        this._panel.dispose();
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}
exports.GlobalChatPanel = GlobalChatPanel;
//# sourceMappingURL=GlobalChatPanel.js.map