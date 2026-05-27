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
exports.onTaskUpdated = exports.onTaskCreated = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
const messaging = admin.messaging();
// ── Send FCM to a user ──────────────────────────────────────
async function notifyUser(userId, title, body, data) {
    var _a;
    const userSnap = await db.doc(`users/${userId}`).get();
    if (!userSnap.exists)
        return;
    const fcmTokens = ((_a = userSnap.data()) === null || _a === void 0 ? void 0 : _a.fcmTokens) || [];
    if (fcmTokens.length === 0)
        return;
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
exports.onTaskCreated = functions.firestore
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
exports.onTaskUpdated = functions.firestore
    .document('projects/{projectId}/tasks/{taskId}')
    .onUpdate(async (change, ctx) => {
    var _a;
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
        const members = ((_a = projectSnap.data()) === null || _a === void 0 ? void 0 : _a.members) || {};
        const adminIds = Object.entries(members).filter(([_, m]) => m.role === 'admin').map(([uid]) => uid);
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
//# sourceMappingURL=triggers.js.map