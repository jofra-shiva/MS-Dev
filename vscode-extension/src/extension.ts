import * as vscode from 'vscode';
import { AuthManager } from './auth/AuthManager';
import { TaskTreeProvider } from './providers/TaskTreeProvider';
import { TaskDetailPanel } from './panels/TaskDetailPanel';
import {
  subscribeToMyTasks,
  subscribeToNotifications,
  getUserProjectIds,
  getProjects,
  updateTaskStatus,
  addComment,
  Task,
  MSDEVNotification,
  Project,
} from './firebase/taskService';
import { Unsubscribe } from '@firebase/firestore';

let taskUnsubscribe: Unsubscribe | null = null;
let notifUnsubscribe: Unsubscribe | null = null;
let statusBarItem: vscode.StatusBarItem;
let seenNotifIds = new Set<string>();
let projectMap = new Map<string, string>(); // projectId -> name

export async function activate(context: vscode.ExtensionContext) {
  console.log('[MSDEV] Extension activated.');

  // ─── Auth Manager ────────────────────────────────────────────────────────
  const authManager = new AuthManager(context);

  // ─── Tree Provider ───────────────────────────────────────────────────────
  const treeProvider = new TaskTreeProvider();
  const treeView = vscode.window.createTreeView('msdevTasks', {
    treeDataProvider: treeProvider,
    showCollapseAll: true,
  });

  // ─── Status Bar ──────────────────────────────────────────────────────────
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'workbench.view.extension.msdev-sidebar';
  context.subscriptions.push(statusBarItem);

  // ─── Auth State Handler ──────────────────────────────────────────────────
  authManager.onAuthStateChange(async (user) => {
    if (user) {
      treeProvider.setLoggedIn(true);
      treeView.title = `MSDEV · ${user.displayName || user.email}`;
      statusBarItem.text = '$(tasklist) MSDEV';
      statusBarItem.tooltip = `MSDEV Tasks — ${user.displayName || user.email}`;
      statusBarItem.show();
      await startListeners(user.uid, treeProvider, user, context);
    } else {
      stopListeners();
      treeProvider.setLoggedIn(false);
      treeProvider.updateTasks([]);
      treeView.title = 'MSDEV Tasks';
      statusBarItem.hide();
      seenNotifIds.clear();
      projectMap.clear();
    }
  });

  // ─── Restore session silently ─────────────────────────────────────────────
  try {
    await authManager.restoreSession();
  } catch {
    // Firebase config not set yet — that's OK
  }

  // ─── Register Commands ───────────────────────────────────────────────────

  // LOGIN
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.login', async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: '$(link) Custom Token (from MSDEV web app)', value: 'token' },
          { label: '$(mail) Email & Password', value: 'email' },
        ],
        { title: 'MSDEV: Choose Sign-in Method', ignoreFocusOut: true }
      );
      if (!pick) return;

      if (pick.value === 'token') {
        await authManager.loginWithCustomToken();
      } else {
        await authManager.loginWithEmail();
      }
    })
  );

  // LOGOUT
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.logout', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Sign out of MSDEV?', { modal: true }, 'Sign Out'
      );
      if (confirm === 'Sign Out') await authManager.logout();
    })
  );

  // REFRESH
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.refreshTasks', () => {
      treeProvider.refresh();
      vscode.window.showInformationMessage('MSDEV: Task list refreshed.');
    })
  );

  // OPEN TASK DETAIL
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.openTask', (task: Task) => {
      const user = authManager.currentUser;
      if (!user || !task) return;
      const projectName = projectMap.get(task.projectId) || '';
      TaskDetailPanel.createOrShow(context.extensionPath, task, user, projectName);
    })
  );

  // UPDATE STATUS (Quick Pick)
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.updateStatus', async (task: Task) => {
      if (!task) return;
      const statuses = [
        { label: '📋 Pending',      value: 'pending' },
        { label: '🔥 In Progress',  value: 'in_progress' },
        { label: '🧪 Testing',      value: 'testing' },
        { label: '🚀 GitHub Pushed', value: 'github_pushed' },
        { label: '🌐 Deployed',     value: 'deployed' },
        { label: '✅ Completed',    value: 'completed' },
      ];
      const pick = await vscode.window.showQuickPick(statuses, {
        title: `Update Status: ${task.title}`,
        placeHolder: `Current: ${task.status.replace(/_/g, ' ')}`,
      });
      if (!pick) return;
      try {
        await updateTaskStatus(task.projectId, task.id, pick.value as any);
        vscode.window.showInformationMessage(`✅ Status updated to "${pick.label}"`);
        treeProvider.refresh();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to update: ${err.message}`);
      }
    })
  );

  // CREATE GIT BRANCH
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.createBranch', async (task: Task) => {
      if (!task) return;
      const user = authManager.currentUser;
      if (!user) return;
      // Reuse panel's branch logic
      const projectName = projectMap.get(task.projectId) || '';
      TaskDetailPanel.createOrShow(context.extensionPath, task, user, projectName);
      // Small delay to let the panel open, then trigger branch creation
      setTimeout(() => {
        TaskDetailPanel.currentPanel?.runCreateBranch();
      }, 800);
    })
  );

  // ADD COMMENT (Quick Input)
  context.subscriptions.push(
    vscode.commands.registerCommand('msdev.addComment', async (task: Task) => {
      if (!task) return;
      const user = authManager.currentUser;
      if (!user) return;

      const text = await vscode.window.showInputBox({
        title: `Add comment: ${task.title}`,
        prompt: 'Write your comment',
        placeHolder: 'Type your comment here...',
        ignoreFocusOut: true,
      });
      if (!text?.trim()) return;

      try {
        await addComment(task.projectId, task.id, text.trim(), {
          uid: user.uid,
          displayName: user.displayName || 'Unknown',
          photoURL: user.photoURL || '',
        });
        vscode.window.showInformationMessage('💬 Comment added!');
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to add comment: ${err.message}`);
      }
    })
  );

  context.subscriptions.push(treeView);
}

// ─────────────────────────────────────────────────────────────────────────────
// Start Firestore listeners after login
// ─────────────────────────────────────────────────────────────────────────────

async function startListeners(
  uid: string,
  treeProvider: TaskTreeProvider,
  user: any,
  context: vscode.ExtensionContext
) {
  stopListeners();

  // Load project IDs & names
  let projectIds: string[] = [];
  try {
    projectIds = await getUserProjectIds(uid);
    const projects = await getProjects(projectIds);
    projectMap.clear();
    projects.forEach(p => projectMap.set(p.id, p.name));
    treeProvider.setProjectNames(projectMap);
  } catch (err) {
    console.error('[MSDEV] Failed to load project IDs:', err);
  }

  if (projectIds.length === 0) {
    treeProvider.updateTasks([]);
    return;
  }

  // ── Task listener ──────────────────────────────────────────────────────────
  taskUnsubscribe = subscribeToMyTasks(uid, projectIds, (tasks) => {
    treeProvider.updateTasks(tasks);
    // Update status bar badge
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length;
    if (inProgress > 0) {
      statusBarItem.text = `$(tasklist) ${inProgress} in progress${urgent ? ` · $(warning) ${urgent} urgent` : ''}`;
    } else {
      statusBarItem.text = `$(tasklist) MSDEV · ${tasks.length} tasks`;
    }
  });

  // ── Notification listener ──────────────────────────────────────────────────
  notifUnsubscribe = subscribeToNotifications(uid, (notifs: MSDEVNotification[]) => {
    const newOnes = notifs.filter(n => !seenNotifIds.has(n.id));
    for (const notif of newOnes) {
      seenNotifIds.add(notif.id);
      vscode.window
        .showInformationMessage(`🔔 ${notif.title}: ${notif.body}`, 'View Tasks')
        .then(action => {
          if (action === 'View Tasks') {
            vscode.commands.executeCommand('workbench.view.extension.msdev-sidebar');
          }
        });
    }

    const unread = notifs.length;
    if (unread > 0) {
      statusBarItem.text = `$(bell) ${unread} · $(tasklist) MSDEV`;
    }
  });
}

function stopListeners() {
  taskUnsubscribe?.();
  notifUnsubscribe?.();
  taskUnsubscribe = null;
  notifUnsubscribe = null;
}

export function deactivate() {
  stopListeners();
}
