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
exports.deadlineReminder = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// ── Daily deadline reminder — runs every day at 9AM UTC ─────
exports.deadlineReminder = functions.pubsub
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
            if (!task.dueDate || !task.assigneeId)
                continue;
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
            }
            else if (due < today) {
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
//# sourceMappingURL=scheduler.js.map