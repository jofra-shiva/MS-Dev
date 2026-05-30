import * as vscode from 'vscode';
import { AuthManager } from './auth/AuthManager';
import { SidebarWebviewProvider } from './providers/SidebarWebviewProvider';
import { FileWatcher } from './providers/FileWatcher';
import { ProjectDashboardPanel } from './panels/ProjectDashboardPanel';
import { GlobalDashboardPanel } from './panels/GlobalDashboardPanel';
import { GlobalProjectsPanel } from './panels/GlobalProjectsPanel';
import { GlobalChatPanel } from './panels/GlobalChatPanel';
import { GlobalNotificationsPanel } from './panels/GlobalNotificationsPanel';
import { GlobalSettingsPanel } from './panels/GlobalSettingsPanel';
import {
  subscribeToAllTasks,
  subscribeToNotifications,
  getUserProjectIds,
  getProjects,
  Task,
  MSDEVNotification,
  Project,
} from './firebase/taskService';
import { Unsubscribe } from '@firebase/firestore';

let allTasksUnsubscribe: Unsubscribe | null = null;
let notifUnsubscribe: Unsubscribe | null = null;
let statusBarItem: vscode.StatusBarItem;
let seenNotifIds = new Set<string>();
let fileWatcher: FileWatcher | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('[MSDEV] Extension activated.');

  // ─── Auth Manager ────────────────────────────────────────────────────────
  const authManager = new AuthManager(context);

  // ─── Sidebar Webview Provider ─────────────────────────────────────────────
  const sidebarProvider = new SidebarWebviewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarWebviewProvider.viewId, sidebarProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // ─── Status Bar ──────────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'workbench.view.extension.msdev-sidebar';
  context.subscriptions.push(statusBarItem);

  // ─── Auth State Handler ──────────────────────────────────────────────────
  authManager.onAuthStateChange(async (user) => {
    if (user) {
      sidebarProvider.setLoggedIn(true);
      sidebarProvider.setUser(user);
      statusBarItem.text = '$(project) MSDEV';
      statusBarItem.tooltip = `MSDEV Projects — ${user.displayName || user.email}`;
      statusBarItem.show();
      // Start file watcher
      if (!fileWatcher) {
        fileWatcher = new FileWatcher(statusBarItem);
        fileWatcher.start();
        context.subscriptions.push({ dispose: () => fileWatcher?.stop() });
      }
      await startListeners(user.uid, sidebarProvider, user, context);
    } else {
      stopListeners();
      fileWatcher?.stop();
      fileWatcher = null;
      sidebarProvider.setLoggedIn(false);
      sidebarProvider.setUser(null);
      sidebarProvider.updateData([], new Map());
      statusBarItem.hide();
      seenNotifIds.clear();

      // Close any open dashboards
      for (const panel of ProjectDashboardPanel.currentPanels.values()) {
        panel.dispose();
      }
    }
  });

  // ─── Restore session silently ─────────────────────────────────────────────
  authManager.restoreSession().catch(err => {
    console.warn('[MSDEV] Failed to restore session:', err);
  });

  // ─── Register Commands ───────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.login', async () => {
      await authManager.loginWithEmail();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.logout', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Sign out of MSDEV?', { modal: true }, 'Sign Out'
      );
      if (confirm === 'Sign Out') { await authManager.logout(); }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.refreshProjects', () => {
      vscode.window.showInformationMessage('MSDEV: Project list refreshed.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openProjectDashboard', (project: Project) => {
      const user = authManager.currentUser;
      if (!user || !project) { return; }
      ProjectDashboardPanel.createOrShow(context.extensionPath, project, user);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openGlobalDashboard', () => {
      const user = authManager.currentUser;
      if (!user) { return; }
      GlobalDashboardPanel.createOrShow(context.extensionPath, user);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openProjectsList', () => {
      const user = authManager.currentUser;
      if (!user) { return; }
      GlobalProjectsPanel.createOrShow(context.extensionPath, user);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openChatList', () => {
      const user = authManager.currentUser;
      if (!user) { return; }
      GlobalChatPanel.createOrShow(context.extensionPath, user);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openNotifications', () => {
      const user = authManager.currentUser;
      if (!user) { return; }
      GlobalNotificationsPanel.createOrShow(context.extensionPath, user);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openSettings', () => {
      const user = authManager.currentUser;
      if (!user) { return; }
      GlobalSettingsPanel.createOrShow(context.extensionPath, user);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openLocalFolder', async (project: Project) => {
      if (!project || !project.id) { return; }
      const configKey = `msdev.localProject.${project.id}`;
      const savedPath = context.globalState.get<string>(configKey);

      if (savedPath) {
        vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(savedPath), true);
      } else {
        const result = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: `Link to ${project.name}`,
          title: `Select Local Folder for ${project.name}`
        });

        if (result && result[0]) {
          const localPath = result[0].fsPath;
          await context.globalState.update(configKey, localPath);
          vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(localPath), true);
        }
      }
    })
  );

  // ── Send task description to Antigravity chat ─────────────────────────────
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.sendTaskToChat', async (taskContent: string) => {
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: taskContent });
      } catch {
        await vscode.env.clipboard.writeText(taskContent);
        vscode.window.showInformationMessage('📋 Description copied to clipboard!');
      }
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Start Firestore listeners after login
// ─────────────────────────────────────────────────────────────────────────────

async function startListeners(
  uid: string,
  sidebarProvider: SidebarWebviewProvider,
  user: any,
  context: vscode.ExtensionContext
) {
  stopListeners();

  let projectIds: string[] = [];
  let projects: Project[] = [];

  try {
    projectIds = await getUserProjectIds(uid);
    projects = await getProjects(projectIds);
  } catch (err) {
    console.error('[MSDEV] Failed to load project IDs:', err);
  }

  if (projectIds.length === 0) {
    sidebarProvider.updateData([], new Map());
    return;
  }

  // Subscribe to all tasks to drive sidebar task counts
  allTasksUnsubscribe = subscribeToAllTasks(projectIds, (tasks) => {
    const tasksByProject = new Map<string, Task[]>();
    for (const p of projects) { tasksByProject.set(p.id, []); }
    for (const t of tasks) {
      if (!tasksByProject.has(t.projectId)) { tasksByProject.set(t.projectId, []); }
      tasksByProject.get(t.projectId)!.push(t);
    }
    sidebarProvider.updateData(projects, tasksByProject);
    statusBarItem.text = `$(project) MSDEV · ${projects.length} Projects`;
    // Feed latest tasks to FileWatcher
    fileWatcher?.updateTasks(tasks, uid);
  });

  // ── Notification listener ──────────────────────────────────────────────────
  notifUnsubscribe = subscribeToNotifications(uid, (notifs: MSDEVNotification[]) => {
    const newOnes = notifs.filter(n => !seenNotifIds.has(n.id));
    for (const notif of newOnes) {
      seenNotifIds.add(notif.id);
      vscode.window
        .showInformationMessage(`🔔 ${notif.title}: ${notif.body}`, 'View Projects')
        .then(action => {
          if (action === 'View Projects') {
            vscode.commands.executeCommand('workbench.view.extension.msdev-sidebar');
          }
        });
    }

    const unread = notifs.length;
    sidebarProvider.setUnreadCount(unread);
    if (unread > 0) {
      statusBarItem.text = `$(bell) ${unread} · $(project) MSDEV`;
    }
  });
}

function stopListeners() {
  allTasksUnsubscribe?.();
  notifUnsubscribe?.();
  allTasksUnsubscribe = null;
  notifUnsubscribe = null;
}

export function deactivate() {
  stopListeners();
  fileWatcher?.stop();
}
