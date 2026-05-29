import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { User } from '@firebase/auth';
import { Unsubscribe } from '@firebase/firestore';
import {
  Chat, ChatMessage,
  subscribeToUserChats, subscribeToChatMessages,
  sendMessage, markChatAsRead,
  startDirectChat, searchUsersByEmail, uploadChatMedia
} from '../firebase/chatService';

export class GlobalChatPanel {
  public static currentPanel: GlobalChatPanel | undefined;

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _user: User;
  
  private _chats: Chat[] = [];
  private _activeChatId: string | null = null;
  private _messages: ChatMessage[] = [];
  
  private _unsubChats?: Unsubscribe;
  private _unsubMessages?: Unsubscribe;

  public static createOrShow(extensionPath: string, user: User) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : vscode.ViewColumn.One;

    if (GlobalChatPanel.currentPanel) {
      GlobalChatPanel.currentPanel._panel.reveal(column);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'msdevGlobalChat',
      'MSDEV Chats',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'src', 'webview'))],
        retainContextWhenHidden: true,
      }
    );

    GlobalChatPanel.currentPanel = new GlobalChatPanel(panel, extensionPath, user);
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
      this._unsubChats = subscribeToUserChats(this._user.uid, (chats) => {
        this._chats = chats;
        this._pushState();
      });
    } catch (err) {
      console.error('[MSDEV] Failed to load chats:', err);
    }
  }
  
  private _switchChat(chatId: string) {
    if (this._activeChatId === chatId) return;
    this._activeChatId = chatId;
    this._messages = [];
    
    if (this._unsubMessages) {
      this._unsubMessages();
    }
    
    // Mark as read immediately when switching
    markChatAsRead(chatId, this._user.uid).catch(console.error);
    
    this._unsubMessages = subscribeToChatMessages(chatId, (msgs) => {
      this._messages = msgs;
      this._pushState();
      // If we are actively in this chat and receive a new message, mark as read
      markChatAsRead(chatId, this._user.uid).catch(console.error);
    });
    
    this._pushState();
  }

  private _pushState() {
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

  private async _handleMessage(msg: any) {
    switch (msg.command) {
      case 'openChat': {
        this._switchChat(msg.chatId);
        break;
      }
      case 'sendMessage': {
        if (!this._activeChatId) return;
        try {
          await sendMessage(this._activeChatId, this._user.uid, msg.text);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to send message: ${err.message}`);
        }
        break;
      }
      
      case 'startDirectChat': {
        try {
          const users = await searchUsersByEmail(msg.email);
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
          const chatId = await startDirectChat(this._user, targetUser);
          this._panel.webview.postMessage({ command: 'chatCreated', chatId });
          this._switchChat(chatId);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to start chat: ${err.message}`);
          this._panel.webview.postMessage({ command: 'newChatError' });
        }
        break;
      }
      
      case 'uploadMedia': {
        if (!this._activeChatId) return;
        try {
          const mediaUrl = await uploadChatMedia(this._activeChatId, msg.fileData, msg.fileName);
          await sendMessage(this._activeChatId, this._user.uid, '', mediaUrl, 'image');
        } catch (err: any) {
          vscode.window.showErrorMessage(`Failed to upload media: ${err.message}`);
        }
        break;
      }
    }
  }

  private _getHtmlContent(): string {
    const htmlPath = path.join(this._extensionPath, 'src', 'webview', 'chat-list.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const nonce = crypto.randomBytes(16).toString('hex');
    html = html.replace(/\{\{NONCE\}\}/g, nonce);
    return html;
  }

  private _serializeChats(chats: Chat[]): any[] {
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
  
  private _serializeMessages(messages: ChatMessage[]): any[] {
    return messages.map(m => ({
      ...m,
      createdAt: m.createdAt?.toISOString() ?? null,
    }));
  }

  public dispose() {
    this._unsubChats?.();
    this._unsubMessages?.();
    GlobalChatPanel.currentPanel = undefined;
    this._panel.dispose();
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];
  }
}
