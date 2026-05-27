import * as admin from 'firebase-admin';


admin.initializeApp();

// ─── Export all functions ────────────────────────────────────────────────────
export { githubWebhook } from './github/webhook';
export { onTaskCreated, onTaskUpdated } from './notifications/triggers';
export { deadlineReminder } from './analytics/scheduler';
export { generateIDEToken } from './ideToken';

