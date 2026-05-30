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
exports.SidebarWebviewProvider = void 0;
const vscode = __importStar(require("vscode"));
class SidebarWebviewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._projects = [];
        this._tasksByProject = new Map();
        this._isLoggedIn = false;
        this._user = null;
        this._unreadCount = 0;
        this._isReady = false;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this._extensionUri, 'media'),
            ],
        };
        webviewView.webview.html = this._getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (msg) => {
            switch (msg.command) {
                case 'ready': {
                    this._isReady = true;
                    this._refresh();
                    break;
                }
                case 'openGlobalDashboard': {
                    vscode.commands.executeCommand('msdev.openGlobalDashboard');
                    break;
                }
                case 'openProjectsList': {
                    vscode.commands.executeCommand('msdev.openProjectsList');
                    break;
                }
                case 'openChatList': {
                    vscode.commands.executeCommand('msdev.openChatList');
                    break;
                }
                case 'openNotifications': {
                    vscode.commands.executeCommand('msdev.openNotifications');
                    break;
                }
                case 'openSettings': {
                    vscode.commands.executeCommand('msdev.openSettings');
                    break;
                }
                // ── Open web-app route in VS Code Simple Browser ─────────────────
                case 'navigate': {
                    const baseUrl = this._getWebAppUrl();
                    const url = baseUrl + (msg.route || '/');
                    try {
                        await vscode.commands.executeCommand('simpleBrowser.show', vscode.Uri.parse(url));
                    }
                    catch {
                        // simpleBrowser not available — open in system browser
                        vscode.env.openExternal(vscode.Uri.parse(url));
                    }
                    break;
                }
                // ── Open project VS Code dashboard panel ─────────────────────────
                case 'openProject': {
                    const project = this._projects.find(p => p.id === msg.projectId);
                    if (project) {
                        vscode.commands.executeCommand('msdev.openProjectDashboard', project);
                    }
                    break;
                }
                case 'login': {
                    vscode.commands.executeCommand('msdev.login');
                    break;
                }
                case 'logout': {
                    vscode.commands.executeCommand('msdev.logout');
                    break;
                }
            }
        });
    }
    // ── Public API for extension.ts ────────────────────────────────────────
    setLoggedIn(val) {
        this._isLoggedIn = val;
        this._refresh();
    }
    setUser(user) {
        this._user = user;
        this._refresh();
    }
    updateData(projects, tasksByProject) {
        this._projects = projects;
        this._tasksByProject = tasksByProject;
        this._refresh();
    }
    setUnreadCount(count) {
        this._unreadCount = count;
        this._refresh();
    }
    // ── Helpers ────────────────────────────────────────────────────────────
    _getWebAppUrl() {
        // 1. Check VS Code setting
        const cfg = vscode.workspace.getConfiguration('msdev').get('webAppUrl');
        if (cfg && cfg.trim()) {
            return cfg.replace(/\/$/, '');
        }
        // 2. Auto-detect from any project's liveUrl
        for (const p of this._projects) {
            const liveUrl = p.liveUrl;
            if (liveUrl) {
                try {
                    const u = new URL(liveUrl);
                    return u.origin; // e.g. https://msdev.vercel.app
                }
                catch { /* ignore */ }
            }
        }
        return 'https://msdev-eight.vercel.app';
    }
    _refresh() {
        if (!this._view || !this._isReady) {
            return;
        }
        this._view.webview.postMessage({
            command: 'update',
            isLoggedIn: this._isLoggedIn,
            user: this._user ? {
                displayName: this._user.displayName,
                email: this._user.email,
                photoURL: this._user.photoURL,
            } : null,
            projects: this._projects.map(p => ({
                id: p.id,
                name: p.name,
                color: p.color,
                taskCount: (this._tasksByProject.get(p.id) || []).length,
            })),
            unreadCount: this._unreadCount,
        });
    }
    _getHtml(webview) {
        const nonce = getNonce();
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'logo.png'));
        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  :root{
    --bg:#0d1117;--bg2:#161b22;
    --text1:#e6edf3;--text2:#8b949e;--text3:#6e7681;
    --border:#30363d;--accent:#2dd4bf;--accent2:#3b82f6;
    --red:#f85149;
  }
  html,body{height:100%;overflow:hidden;background:var(--bg);color:var(--text1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  body{display:flex;flex-direction:column;height:100vh;}

  .header{display:flex;align-items:center;gap:10px;padding:12px 14px 10px;border-bottom:1px solid var(--border);}
  .logo-img{width:36px;height:36px;border-radius:10px;object-fit:contain;flex-shrink:0;}
  .logo-text{font-size:15px;font-weight:800;color:var(--text1);letter-spacing:-.5px;}
  .logo-sub{font-size:10px;color:var(--text3);font-weight:500;margin-top:1px;}

  .nav{flex:1;overflow-y:auto;padding:8px 0;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
  .nav::-webkit-scrollbar{width:4px;}
  .nav::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}

  .nav-item{display:flex;align-items:center;gap:10px;padding:8px 14px;cursor:pointer;transition:background .12s,color .12s;color:var(--text2);font-size:13px;font-weight:500;border-left:2px solid transparent;user-select:none;}
  .nav-item:hover{background:rgba(255,255,255,.05);color:var(--text1);}
  .nav-item.active{background:rgba(45,212,191,.09);color:var(--accent);border-left-color:var(--accent);}
  .nav-item.active .nav-icon{opacity:1;}
  .nav-icon{width:16px;height:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;opacity:.7;}
  .nav-badge{margin-left:auto;background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;font-weight:700;min-width:18px;text-align:center;}

  .section-label{padding:10px 14px 4px;font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;}
  .divider{height:1px;background:var(--border);margin:6px 0;}

  .project-item{display:flex;align-items:center;gap:10px;padding:7px 14px;cursor:pointer;transition:background .12s,color .12s;color:var(--text2);font-size:12px;font-weight:500;border-left:2px solid transparent;user-select:none;}
  .project-item:hover{background:rgba(255,255,255,.05);color:var(--text1);}
  .project-item.active-proj{background:rgba(255,255,255,.07);color:var(--text1);border-left-color:var(--accent);}
  .proj-avatar{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#fff;flex-shrink:0;}
  .proj-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .proj-count{font-size:10px;color:var(--text3);background:var(--bg2);border-radius:9px;padding:1px 6px;flex-shrink:0;}

  .footer{border-top:1px solid var(--border);padding:6px 0;}
  .user-row{display:flex;align-items:center;gap:8px;padding:8px 14px;cursor:pointer;color:var(--text2);font-size:12px;font-weight:500;transition:background .12s;user-select:none;}
  .user-row:hover{background:rgba(255,255,255,.04);color:var(--text1);}
  .user-avatar{width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#0d1117;flex-shrink:0;overflow:hidden;}
  .user-avatar img{width:100%;height:100%;object-fit:cover;}
  .user-info{flex:1;min-width:0;}
  .user-name{font-weight:600;font-size:12px;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .user-email{font-size:10px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .logout-btn{background:none;border:none;cursor:pointer;color:var(--text3);padding:4px;border-radius:4px;display:flex;align-items:center;transition:color .12s;flex-shrink:0;}
  .logout-btn:hover{color:var(--red);}

  .signin-screen{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:16px;}
  .signin-logo{width:72px;height:72px;border-radius:16px;overflow:hidden;}
  .signin-logo img{width:100%;height:100%;object-fit:contain;}
  .signin-title{font-size:16px;font-weight:700;text-align:center;}
  .signin-sub{font-size:12px;color:var(--text3);text-align:center;line-height:1.5;}
  .signin-btn{padding:9px 20px;border-radius:8px;background:var(--accent);color:#0d1117;font-weight:700;font-size:13px;border:none;cursor:pointer;width:100%;transition:background .15s;}
  .signin-btn:hover{background:#14b8a6;}
</style>
</head>
<body>
<div id="root"></div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const LOGO_URI = '${logoUri}';
let state = { isLoggedIn: false, user: null, projects: [], unreadCount: 0 };
let activeProjectId = null;
let activeNav = 'dashboard'; // tracks which nav is highlighted

// ── SVG icons ─────────────────────────────────────────────────────────
const ICONS = {
  dashboard: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  projects:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  messages:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  notifs:    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  settings:  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  logout:    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
};

function esc(s) {
  if (!s) { return ''; }
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function navItem(id, icon, label, badge) {
  return '<div class="nav-item' + (activeNav === id ? ' active' : '') + '" data-nav="' + id + '">' +
    '<div class="nav-icon">' + icon + '</div>' +
    esc(label) +
    (badge ? '<span class="nav-badge">' + badge + '</span>' : '') +
  '</div>';
}

function render() {
  const root = document.getElementById('root');
  root.style.cssText = 'display:flex;flex-direction:column;height:100vh;';

  // ── SIGNED OUT ─────────────────────────────────────────────────────
  if (!state.isLoggedIn) {
    root.innerHTML =
      '<div class="signin-screen">' +
        '<div class="signin-logo"><img src="' + LOGO_URI + '" alt="MSDEV"/></div>' +
        '<div class="signin-title">MS Dev Tasks</div>' +
        '<div class="signin-sub">Sign in to manage your projects and tasks directly from VS Code.</div>' +
        '<button class="signin-btn" id="btn-signin">Sign In to MSDEV</button>' +
      '</div>';
    document.getElementById('btn-signin').addEventListener('click', function() {
      vscode.postMessage({ command: 'login' });
    });
    return;
  }

  // ── SIGNED IN ──────────────────────────────────────────────────────
  const user = state.user || {};
  const initials = (user.displayName || user.email || 'U').slice(0, 2).toUpperCase();

  const projectsHtml = state.projects.length === 0
    ? '<div style="padding:8px 14px;font-size:12px;color:var(--text3)">No projects yet</div>'
    : state.projects.map(function(p) {
        return '<div class="project-item' + (activeProjectId === p.id ? ' active-proj' : '') +
          '" data-project-id="' + esc(p.id) + '">' +
          '<div class="proj-avatar" style="background:' + esc(p.color || '#3b82f6') + '">' + esc((p.name||'?')[0].toUpperCase()) + '</div>' +
          '<span class="proj-name">' + esc(p.name) + '</span>' +
          '<span class="proj-count">' + p.taskCount + '</span>' +
        '</div>';
      }).join('');

  const avatarHtml = user.photoURL
    ? '<img src="' + esc(user.photoURL) + '" referrerpolicy="no-referrer"/>'
    : '<span>' + esc(initials) + '</span>';

  root.innerHTML =
    // ── Header ──
    '<div class="header">' +
      '<img class="logo-img" src="' + LOGO_URI + '" alt="MS Dev"/>' +
      '<div><div class="logo-text">MS Dev</div><div class="logo-sub">Project Manager</div></div>' +
    '</div>' +

    // ── Nav ──
    '<div class="nav">' +
      navItem('dashboard', ICONS.dashboard, 'Dashboard', '') +
      navItem('projects',  ICONS.projects,  'Projects',  '') +
      navItem('messages',  ICONS.messages,  'Messages',  '') +
      navItem('notifications', ICONS.notifs,'Notifications', state.unreadCount > 0 ? state.unreadCount : '') +
      '<div class="divider"></div>' +
      '<div class="section-label">PROJECTS</div>' +
      '<div id="projects-list">' + projectsHtml + '</div>' +
    '</div>' +

    // ── Footer ──
    '<div class="footer">' +
      navItem('settings', ICONS.settings, 'Settings', '') +
      '<div class="user-row" id="user-row">' +
        '<div class="user-avatar">' + avatarHtml + '</div>' +
        '<div class="user-info">' +
          '<div class="user-name">' + esc(user.displayName || 'User') + '</div>' +
          '<div class="user-email">' + esc(user.email || '') + '</div>' +
        '</div>' +
        '<button class="logout-btn" id="btn-logout" title="Sign out">' + ICONS.logout + '</button>' +
      '</div>' +
    '</div>';

  // ── Event listeners (all via addEventListener, NO onclick attrs) ────

  // Nav items (Dashboard / Projects / Messages / Notifications / Settings)
  document.querySelectorAll('[data-nav]').forEach(function(el) {
    el.addEventListener('click', function() {
      var nav = el.getAttribute('data-nav');
      activeNav = nav;
      
      if (nav === 'dashboard') {
        vscode.postMessage({ command: 'openGlobalDashboard' });
      } else if (nav === 'projects') {
        vscode.postMessage({ command: 'openProjectsList' });
      } else if (nav === 'messages') {
        vscode.postMessage({ command: 'openChatList' });
      } else if (nav === 'notifications') {
        vscode.postMessage({ command: 'openNotifications' });
      } else if (nav === 'settings') {
        vscode.postMessage({ command: 'openSettings' });
      } else {
        var routes = {};
        if (routes[nav]) {
          vscode.postMessage({ command: 'navigate', route: routes[nav] });
        }
      }
      
      render(); // re-render to highlight active nav
    });
  });

  // Project items → open VS Code dashboard panel
  document.getElementById('projects-list').addEventListener('click', function(e) {
    var item = e.target.closest('[data-project-id]');
    if (item) {
      var id = item.getAttribute('data-project-id');
      activeProjectId = id;
      activeNav = ''; // clear nav highlight
      vscode.postMessage({ command: 'openProject', projectId: id });
      render();
    }
  });

  // Sign out
  document.getElementById('btn-logout').addEventListener('click', function(e) {
    e.stopPropagation();
    vscode.postMessage({ command: 'logout' });
  });
}

window.addEventListener('message', function(e) {
  var m = e.data;
  if (m.command === 'update') {
    state = { isLoggedIn: m.isLoggedIn, user: m.user, projects: m.projects || [], unreadCount: m.unreadCount || 0 };
    render();
  }
});

render();
vscode.postMessage({ command: 'ready' });
</script>
</body>
</html>`;
    }
}
exports.SidebarWebviewProvider = SidebarWebviewProvider;
SidebarWebviewProvider.viewId = 'msdevSidebarWebview';
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
//# sourceMappingURL=SidebarWebviewProvider.js.map