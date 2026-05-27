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
exports.githubWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
const messaging = admin.messaging();
// ────────────────────────────────────────────────────────────
// HMAC Signature Verification
// ────────────────────────────────────────────────────────────
function verifyGitHubSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
    }
    catch (_a) {
        return false;
    }
}
// ────────────────────────────────────────────────────────────
// Task keyword → status mapping
// ────────────────────────────────────────────────────────────
function detectStatus(message) {
    const lower = message.toLowerCase();
    if (/\b(completed?|done|finished?|fixed|closes?|resolves?)\b/.test(lower))
        return { status: 'completed', progress: 100 };
    if (/\b(testing|test|review|qa|staging)\b/.test(lower))
        return { status: 'testing', progress: 75 };
    if (/\b(started?|begin|wip|progress|working|implement)\b/.test(lower))
        return { status: 'in_progress', progress: 30 };
    return null;
}
// ────────────────────────────────────────────────────────────
// Extract task references from commit message
// e.g. "TASK-12 completed login" → ["TASK-12"]
// ────────────────────────────────────────────────────────────
function extractTaskRefs(message, prefix) {
    const regex = new RegExp(`\\b(${prefix}-\\d+)\\b`, 'gi');
    return [...new Set((message.match(regex) || []).map(r => r.toUpperCase()))];
}
// ────────────────────────────────────────────────────────────
// Main GitHub Webhook Handler
// ────────────────────────────────────────────────────────────
exports.githubWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // Only accept POST
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const secret = ((_a = functions.config().github) === null || _a === void 0 ? void 0 : _a.webhook_secret) || process.env.GITHUB_WEBHOOK_SECRET || '';
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];
    // Verify signature
    const rawBody = JSON.stringify(req.body);
    if (secret && signature && !verifyGitHubSignature(rawBody, signature, secret)) {
        functions.logger.warn('Invalid GitHub webhook signature');
        res.status(401).send('Unauthorized');
        return;
    }
    const projectId = req.query.projectId;
    if (!projectId) {
        res.status(400).send('Missing projectId query param');
        return;
    }
    try {
        const projectRef = db.doc(`projects/${projectId}`);
        const projectSnap = await projectRef.get();
        if (!projectSnap.exists) {
            res.status(404).send('Project not found');
            return;
        }
        const project = projectSnap.data();
        const taskPrefix = project.taskPrefix || 'TASK';
        // ── Handle push events ──────────────────────────────────
        if (event === 'push') {
            const commits = req.body.commits || [];
            const pusher = ((_b = req.body.pusher) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown';
            const branch = (req.body.ref || '').replace('refs/heads/', '');
            let totalTasksUpdated = 0;
            const batch = db.batch();
            for (const commit of commits) {
                const { message, id: sha, url, added, modified, removed } = commit;
                const taskRefs = extractTaskRefs(message, taskPrefix);
                const statusChange = detectStatus(message);
                const filesChanged = ((added === null || added === void 0 ? void 0 : added.length) || 0) + ((modified === null || modified === void 0 ? void 0 : modified.length) || 0) + ((removed === null || removed === void 0 ? void 0 : removed.length) || 0);
                const additions = ((_c = commit.added) === null || _c === void 0 ? void 0 : _c.length) || 0;
                const deletions = ((_d = commit.removed) === null || _d === void 0 ? void 0 : _d.length) || 0;
                // Store commit event
                const eventRef = db.collection(`projects/${projectId}/github_events`).doc();
                batch.set(eventRef, {
                    type: 'push',
                    commitSha: sha,
                    commitMessage: message,
                    author: pusher,
                    authorAvatar: '',
                    repoFullName: ((_e = req.body.repository) === null || _e === void 0 ? void 0 : _e.full_name) || '',
                    taskRefs,
                    filesChanged,
                    additions,
                    deletions,
                    branch,
                    url,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Store activity log
                const activityRef = db.collection(`projects/${projectId}/activity`).doc();
                batch.set(activityRef, {
                    type: 'commit_pushed',
                    userId: 'github',
                    userName: pusher,
                    userPhoto: '',
                    taskId: null,
                    taskTitle: taskRefs.length > 0 ? taskRefs.join(', ') : null,
                    metadata: { commitSha: sha.slice(0, 7), message, branch, filesChanged },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Update referenced tasks
                if (taskRefs.length > 0 && statusChange) {
                    const tasksSnap = await db.collection(`projects/${projectId}/tasks`)
                        .where('__name__', '>=', '')
                        .get();
                    for (const taskDoc of tasksSnap.docs) {
                        const task = taskDoc.data();
                        // Match by prefix number or check if any taskRef matches the pattern
                        const matches = taskRefs.some(ref => {
                            var _a;
                            const num = ref.replace(`${taskPrefix}-`, '');
                            return ((_a = task.title) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(ref.toLowerCase())) || taskDoc.id.includes(num);
                        });
                        if (matches) {
                            batch.update(taskDoc.ref, Object.assign({ status: statusChange.status, progress: statusChange.progress, 'githubRef.lastCommitSha': sha, 'githubRef.lastCommitMessage': message, 'githubRef.branchName': branch, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, (statusChange.status === 'completed' ? {
                                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                                completedBy: {
                                    uid: 'github',
                                    name: pusher || 'GitHub',
                                    photo: '',
                                    date: admin.firestore.FieldValue.serverTimestamp(),
                                },
                            } : {})));
                            totalTasksUpdated++;
                            // Send FCM to assignee
                            if (task.assigneeId) {
                                const userSnap = await db.doc(`users/${task.assigneeId}`).get();
                                const fcmTokens = ((_f = userSnap.data()) === null || _f === void 0 ? void 0 : _f.fcmTokens) || [];
                                if (fcmTokens.length > 0) {
                                    const notifRef = db.collection(`notifications/${task.assigneeId}/items`).doc();
                                    batch.set(notifRef, {
                                        type: 'commit',
                                        title: `Commit detected: ${taskRefs[0]}`,
                                        body: `"${message.slice(0, 80)}" → ${statusChange.status.replace('_', ' ')}`,
                                        projectId,
                                        taskId: taskDoc.id,
                                        read: false,
                                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                                    });
                                    // FCM push
                                    await messaging.sendEachForMulticast({
                                        tokens: fcmTokens,
                                        notification: { title: `⚡ Task auto-updated: ${taskRefs[0]}`, body: message.slice(0, 100) },
                                        data: { projectId, taskId: taskDoc.id, type: 'commit' },
                                    }).catch(err => functions.logger.error('FCM error', err));
                                }
                            }
                        }
                    }
                }
            }
            // Recalculate project completion percentage
            const allTasksSnap = await db.collection(`projects/${projectId}/tasks`).get();
            const allTasks = allTasksSnap.docs.map(d => d.data());
            const total = allTasks.length;
            const completed = allTasks.filter(t => t.status === 'completed').length;
            const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
            const pending = allTasks.filter(t => t.status === 'pending').length;
            const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
            batch.update(projectRef, {
                completionPercentage: pct,
                'stats.completedTasks': completed,
                'stats.inProgressTasks': inProgress,
                'stats.pendingTasks': pending,
                'stats.totalCommits': admin.firestore.FieldValue.increment(commits.length),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await batch.commit();
            functions.logger.info(`Processed ${commits.length} commits, updated ${totalTasksUpdated} tasks, project ${pct}% complete`);
        }
        // ── Handle pull_request events ──────────────────────────
        if (event === 'pull_request') {
            const pr = req.body.pull_request;
            const action = req.body.action;
            const taskRefs = extractTaskRefs(pr.title + ' ' + (pr.body || ''), taskPrefix);
            if (action === 'closed' && pr.merged) {
                const activityRef = db.collection(`projects/${projectId}/activity`).doc();
                await activityRef.set({
                    type: 'pr_merged',
                    userId: 'github',
                    userName: ((_g = pr.merged_by) === null || _g === void 0 ? void 0 : _g.login) || 'GitHub',
                    userPhoto: ((_h = pr.merged_by) === null || _h === void 0 ? void 0 : _h.avatar_url) || '',
                    taskId: null,
                    taskTitle: taskRefs.join(', ') || pr.title,
                    metadata: { prNumber: pr.number, prTitle: pr.title, taskRefs },
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Auto-complete referenced tasks on merge
                if (taskRefs.length > 0) {
                    const tasksSnap = await db.collection(`projects/${projectId}/tasks`).get();
                    const batch = db.batch();
                    tasksSnap.docs.forEach(doc => {
                        const matches = taskRefs.some(ref => { var _a; return (_a = doc.data().title) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(ref.toLowerCase()); });
                        if (matches) {
                            batch.update(doc.ref, {
                                status: 'completed', progress: 100,
                                'githubRef.prNumber': pr.number,
                                completedAt: admin.firestore.FieldValue.serverTimestamp(),
                                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            });
                        }
                    });
                    await batch.commit();
                }
            }
        }
        res.status(200).json({ success: true, event });
    }
    catch (error) {
        functions.logger.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=webhook.js.map