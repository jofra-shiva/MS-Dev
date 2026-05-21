import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const messaging = admin.messaging();

// ── Send FCM to a user ──────────────────────────────────────
async function notifyUser(userId: string, title: string, body: string, data: Record<string, string>) {
  const userSnap = await db.doc(`users/${userId}`).get();
  if (!userSnap.exists) return;
  const fcmTokens: string[] = userSnap.data()?.fcmTokens || [];
  if (fcmTokens.length === 0) return;

  // Store in-app notification
  await db.collection(`notifications/${userId}/items`).add({
    type: data.type || 'project_update',
    title, body,
    projectId: data.projectId || null,
    taskId: data.taskId || null,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // FCM push
  await messaging.sendEachForMulticast({ tokens: fcmTokens, notification: { title, body }, data }).catch(e => functions.logger.error('FCM error', e));
}

// ── Firestore trigger: Task Created ─────────────────────────
export const onTaskCreated = functions.firestore
  .document('projects/{projectId}/tasks/{taskId}')
  .onCreate(async (snap, ctx) => {
    const task = snap.data();
    const { projectId } = ctx.params;

    // Notify assignee
    if (task.assigneeId && task.assigneeId !== task.createdBy) {
      await notifyUser(task.assigneeId, '📋 New task assigned', `You have been assigned: "${task.title}"`, { type: 'task_assigned', projectId, taskId: snap.id });
    }

    // Update project stats
    await db.doc(`projects/${projectId}`).update({
      'stats.totalTasks': admin.firestore.FieldValue.increment(1),
      'stats.pendingTasks': admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

// ── Firestore trigger: Task Updated ─────────────────────────
export const onTaskUpdated = functions.firestore
  .document('projects/{projectId}/tasks/{taskId}')
  .onUpdate(async (change, ctx) => {
    const before = change.before.data();
    const after = change.after.data();
    const { projectId } = ctx.params;

    // Task completed
    if (before.status !== 'completed' && after.status === 'completed') {
      // Update stats
      await db.doc(`projects/${projectId}`).update({
        'stats.completedTasks': admin.firestore.FieldValue.increment(1),
        'stats.pendingTasks': admin.firestore.FieldValue.increment(before.status === 'pending' ? -1 : 0),
        'stats.inProgressTasks': admin.firestore.FieldValue.increment(before.status === 'in_progress' ? -1 : 0),
      });

      // Recalculate project completion %
      const tasksSnap = await db.collection(`projects/${projectId}/tasks`).get();
      const total = tasksSnap.size;
      const completed = tasksSnap.docs.filter(d => d.data().status === 'completed').length;
      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
      await db.doc(`projects/${projectId}`).update({ completionPercentage: pct });

      // Notify project admins
      const projectSnap = await db.doc(`projects/${projectId}`).get();
      const members = projectSnap.data()?.members || {};
      const adminIds = Object.entries(members).filter(([_, m]: any) => m.role === 'admin').map(([uid]) => uid);

      for (const adminId of adminIds) {
        if (adminId !== after.assigneeId) {
          await notifyUser(adminId, '✅ Task completed!', `"${after.title}" has been marked complete`, { type: 'task_completed', projectId, taskId: change.after.id });
        }
      }
    }

    // Assignee changed
    if (before.assigneeId !== after.assigneeId && after.assigneeId) {
      await notifyUser(after.assigneeId, '📋 Task assigned to you', `You are now assigned to: "${after.title}"`, { type: 'task_assigned', projectId, taskId: change.after.id });
    }
  });
