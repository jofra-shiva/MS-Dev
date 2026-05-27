"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribeToMyTasks = subscribeToMyTasks;
exports.subscribeToNotifications = subscribeToNotifications;
exports.getUserProjectIds = getUserProjectIds;
exports.getProjects = getProjects;
exports.updateTaskStatus = updateTaskStatus;
exports.addComment = addComment;
exports.getComments = getComments;
exports.setTaskBranch = setTaskBranch;
const firestore_1 = require("@firebase/firestore");
const client_1 = require("./client");
// ─────────────────────────────────────────────
// Firestore helpers
// ─────────────────────────────────────────────
function toDate(val) {
    if (!val)
        return null;
    if (val instanceof Date)
        return val;
    if (typeof val.toDate === 'function')
        return val.toDate();
    return new Date(val);
}
function docToTask(id, data, projectId) {
    return {
        id,
        projectId,
        ticketId: data.ticketId,
        title: data.title || '',
        description: data.description || '',
        type: data.type || 'feature',
        status: data.status || 'pending',
        priority: data.priority || 'medium',
        module: data.module || '',
        progress: data.progress || 0,
        assigneeId: data.assigneeId ?? null,
        assigneeName: data.assigneeName ?? null,
        assigneePhoto: data.assigneePhoto ?? null,
        dueDate: toDate(data.dueDate),
        tags: data.tags || [],
        githubRef: data.githubRef || {},
        createdBy: data.createdBy || '',
        createdAt: toDate(data.createdAt) || new Date(),
        updatedAt: toDate(data.updatedAt) || new Date(),
    };
}
// ─────────────────────────────────────────────
// Subscribe to ALL tasks assigned to a user across all their projects
// ─────────────────────────────────────────────
function subscribeToMyTasks(uid, projectIds, callback) {
    if (projectIds.length === 0) {
        callback([]);
        return () => { };
    }
    const db = (0, client_1.getFirebaseDb)();
    const unsubs = [];
    const taskMap = new Map(); // projectId -> tasks
    const emit = () => {
        const all = [];
        taskMap.forEach(tasks => all.push(...tasks));
        // Sort: in_progress first, then by priority weight
        const priorityWeight = { urgent: 4, high: 3, medium: 2, low: 1 };
        const statusWeight = { in_progress: 5, testing: 4, pending: 3, github_pushed: 2, deployed: 1, completed: 0 };
        all.sort((a, b) => {
            const sw = (statusWeight[b.status] ?? 0) - (statusWeight[a.status] ?? 0);
            if (sw !== 0)
                return sw;
            return (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
        });
        callback(all);
    };
    for (const projectId of projectIds) {
        const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'projects', projectId, 'tasks'), (0, firestore_1.where)('assigneeId', '==', uid), (0, firestore_1.orderBy)('updatedAt', 'desc'));
        const unsub = (0, firestore_1.onSnapshot)(q, (snap) => {
            taskMap.set(projectId, snap.docs.map((d) => docToTask(d.id, d.data(), projectId)));
            emit();
        }, (err) => {
            console.error(`[MSDEV] Task listener error for project ${projectId}:`, err);
        });
        unsubs.push(unsub);
    }
    return () => unsubs.forEach(u => u());
}
// ─────────────────────────────────────────────
// Subscribe to unread notifications
// ─────────────────────────────────────────────
function subscribeToNotifications(uid, callback) {
    const db = (0, client_1.getFirebaseDb)();
    const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'notifications', uid, 'items'), (0, firestore_1.where)('read', '==', false), (0, firestore_1.orderBy)('createdAt', 'desc'));
    return (0, firestore_1.onSnapshot)(q, (snap) => {
        const notifs = snap.docs.map((d) => ({
            id: d.id,
            type: d.data().type || '',
            title: d.data().title || '',
            body: d.data().body || '',
            projectId: d.data().projectId || '',
            taskId: d.data().taskId ?? null,
            read: false,
            createdAt: toDate(d.data().createdAt) || new Date(),
        }));
        callback(notifs);
    }, (err) => {
        console.error('[MSDEV] Notification listener error:', err);
    });
}
// ─────────────────────────────────────────────
// Get user's project IDs from Firestore
// ─────────────────────────────────────────────
async function getUserProjectIds(uid) {
    const db = (0, client_1.getFirebaseDb)();
    const snap = await (0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'users', uid));
    if (!snap.exists())
        return [];
    return snap.data().projectIds || [];
}
// ─────────────────────────────────────────────
// Get projects metadata (name, color)
// ─────────────────────────────────────────────
async function getProjects(projectIds) {
    const db = (0, client_1.getFirebaseDb)();
    const projects = [];
    for (const pid of projectIds) {
        const snap = await (0, firestore_1.getDoc)((0, firestore_1.doc)(db, 'projects', pid));
        if (snap.exists()) {
            const d = snap.data();
            projects.push({ id: snap.id, name: d.name, description: d.description, color: d.color, github: d.github });
        }
    }
    return projects;
}
// ─────────────────────────────────────────────
// Update task status
// ─────────────────────────────────────────────
async function updateTaskStatus(projectId, taskId, status) {
    const db = (0, client_1.getFirebaseDb)();
    await (0, firestore_1.updateDoc)((0, firestore_1.doc)(db, 'projects', projectId, 'tasks', taskId), {
        status,
        updatedAt: (0, firestore_1.serverTimestamp)(),
    });
}
// ─────────────────────────────────────────────
// Add a comment
// ─────────────────────────────────────────────
async function addComment(projectId, taskId, text, author) {
    const db = (0, client_1.getFirebaseDb)();
    await (0, firestore_1.addDoc)((0, firestore_1.collection)(db, 'projects', projectId, 'tasks', taskId, 'comments'), {
        authorId: author.uid,
        authorName: author.displayName,
        authorPhoto: author.photoURL || '',
        text,
        attachments: [],
        createdAt: (0, firestore_1.serverTimestamp)(),
    });
}
// ─────────────────────────────────────────────
// Get comments for a task
// ─────────────────────────────────────────────
async function getComments(projectId, taskId) {
    const db = (0, client_1.getFirebaseDb)();
    const q = (0, firestore_1.query)((0, firestore_1.collection)(db, 'projects', projectId, 'tasks', taskId, 'comments'), (0, firestore_1.orderBy)('createdAt', 'asc'));
    const snap = await (0, firestore_1.getDocs)(q);
    return snap.docs.map((d) => ({
        id: d.id,
        authorId: d.data().authorId,
        authorName: d.data().authorName,
        authorPhoto: d.data().authorPhoto,
        text: d.data().text,
        createdAt: toDate(d.data().createdAt) || new Date(),
    }));
}
// ─────────────────────────────────────────────
// Update git branch name on a task
// ─────────────────────────────────────────────
async function setTaskBranch(projectId, taskId, branchName) {
    const db = (0, client_1.getFirebaseDb)();
    await (0, firestore_1.updateDoc)((0, firestore_1.doc)(db, 'projects', projectId, 'tasks', taskId), {
        'githubRef.branchName': branchName,
        updatedAt: (0, firestore_1.serverTimestamp)(),
    });
}
//# sourceMappingURL=taskService.js.map