import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ── Daily deadline reminder — runs every day at 9AM UTC ─────
export const deadlineReminder = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    functions.logger.info('Running deadline reminder...');

    // Get all projects
    const projectsSnap = await db.collection('projects').where('status', '==', 'active').get();

    for (const projectDoc of projectsSnap.docs) {
      const tasksSnap = await db.collection(`projects/${projectDoc.id}/tasks`)
        .where('status', 'in', ['pending', 'in_progress', 'testing'])
        .get();

      for (const taskDoc of tasksSnap.docs) {
        const task = taskDoc.data();
        if (!task.dueDate || !task.assigneeId) continue;

        const due = task.dueDate.toDate();
        if (due >= today && due <= tomorrow) {
          // Task due tomorrow
          await db.collection(`notifications/${task.assigneeId}/items`).add({
            type: 'deadline',
            title: '⏰ Task due tomorrow',
            body: `"${task.title}" is due tomorrow. Don't forget to complete it!`,
            projectId: projectDoc.id,
            taskId: taskDoc.id,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else if (due < today) {
          // Overdue
          await db.collection(`notifications/${task.assigneeId}/items`).add({
            type: 'deadline',
            title: '🚨 Task overdue',
            body: `"${task.title}" is overdue! Please update its status.`,
            projectId: projectDoc.id,
            taskId: taskDoc.id,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    functions.logger.info('Deadline reminders sent.');
    return null;
  });
