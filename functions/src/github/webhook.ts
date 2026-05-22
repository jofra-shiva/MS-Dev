import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

const db = admin.firestore();
const messaging = admin.messaging();

// ────────────────────────────────────────────────────────────
// HMAC Signature Verification
// ────────────────────────────────────────────────────────────
function verifyGitHubSignature(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ────────────────────────────────────────────────────────────
// Task keyword → status mapping
// ────────────────────────────────────────────────────────────
function detectStatus(message: string): { status: string; progress: number } | null {
  const lower = message.toLowerCase();
  if (/\b(completed?|done|finished?|fixed|closes?|resolves?)\b/.test(lower)) return { status: 'completed', progress: 100 };
  if (/\b(testing|test|review|qa|staging)\b/.test(lower)) return { status: 'testing', progress: 75 };
  if (/\b(started?|begin|wip|progress|working|implement)\b/.test(lower)) return { status: 'in_progress', progress: 30 };
  return null;
}

// ────────────────────────────────────────────────────────────
// Extract task references from commit message
// e.g. "TASK-12 completed login" → ["TASK-12"]
// ────────────────────────────────────────────────────────────
function extractTaskRefs(message: string, prefix: string): string[] {
  const regex = new RegExp(`\\b(${prefix}-\\d+)\\b`, 'gi');
  return [...new Set((message.match(regex) || []).map(r => r.toUpperCase()))];
}

// ────────────────────────────────────────────────────────────
// Main GitHub Webhook Handler
// ────────────────────────────────────────────────────────────
export const githubWebhook = functions.https.onRequest(async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const secret = functions.config().github?.webhook_secret || process.env.GITHUB_WEBHOOK_SECRET || '';
  const signature = req.headers['x-hub-signature-256'] as string;
  const event = req.headers['x-github-event'] as string;

  // Verify signature
  const rawBody = JSON.stringify(req.body);
  if (secret && signature && !verifyGitHubSignature(rawBody, signature, secret)) {
    functions.logger.warn('Invalid GitHub webhook signature');
    res.status(401).send('Unauthorized');
    return;
  }

  const projectId = req.query.projectId as string;
  if (!projectId) { res.status(400).send('Missing projectId query param'); return; }

  try {
    const projectRef = db.doc(`projects/${projectId}`);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) { res.status(404).send('Project not found'); return; }

    const project = projectSnap.data()!;
    const taskPrefix = project.taskPrefix || 'TASK';

    // ── Handle push events ──────────────────────────────────
    if (event === 'push') {
      const commits: any[] = req.body.commits || [];
      const pusher = req.body.pusher?.name || 'Unknown';
      const branch = (req.body.ref || '').replace('refs/heads/', '');

      let totalTasksUpdated = 0;
      const batch = db.batch();

      for (const commit of commits) {
        const { message, id: sha, url, added, modified, removed } = commit;
        const taskRefs = extractTaskRefs(message, taskPrefix);
        const statusChange = detectStatus(message);
        const filesChanged = (added?.length || 0) + (modified?.length || 0) + (removed?.length || 0);
        const additions = commit.added?.length || 0;
        const deletions = commit.removed?.length || 0;

        // Store commit event
        const eventRef = db.collection(`projects/${projectId}/github_events`).doc();
        batch.set(eventRef, {
          type: 'push',
          commitSha: sha,
          commitMessage: message,
          author: pusher,
          authorAvatar: '',
          repoFullName: req.body.repository?.full_name || '',
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
            const taskId = `${taskPrefix}-${taskDoc.id}`;

            // Match by prefix number or check if any taskRef matches the pattern
            const matches = taskRefs.some(ref => {
              const num = ref.replace(`${taskPrefix}-`, '');
              return task.title?.toLowerCase().includes(ref.toLowerCase()) || taskDoc.id.includes(num);
            });

            if (matches) {
              batch.update(taskDoc.ref, {
                status: statusChange.status,
                progress: statusChange.progress,
                'githubRef.lastCommitSha': sha,
                'githubRef.lastCommitMessage': message,
                'githubRef.branchName': branch,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                ...(statusChange.status === 'completed' ? {
                  completedAt: admin.firestore.FieldValue.serverTimestamp(),
                  completedBy: {
                    uid: 'github',
                    name: pusher || 'GitHub',
                    photo: '',
                    date: admin.firestore.FieldValue.serverTimestamp(),
                  },
                } : {}),
              });
              totalTasksUpdated++;

              // Send FCM to assignee
              if (task.assigneeId) {
                const userSnap = await db.doc(`users/${task.assigneeId}`).get();
                const fcmTokens: string[] = userSnap.data()?.fcmTokens || [];
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
          userName: pr.merged_by?.login || 'GitHub',
          userPhoto: pr.merged_by?.avatar_url || '',
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
            const matches = taskRefs.some(ref => doc.data().title?.toLowerCase().includes(ref.toLowerCase()));
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
  } catch (error) {
    functions.logger.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
