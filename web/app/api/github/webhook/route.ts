import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  updateDoc,
  getDocs,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import crypto from 'crypto';

// ─────────────────────────────────────────────
// Security: Verify GitHub HMAC Signature
// ─────────────────────────────────────────────
function verifyGitHubSignature(body: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return true; // skip if not configured
  if (!signature) return false;
  try {
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature.padEnd(expected.length)));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// AI Task Matching via Gemini / Pollinations
// ─────────────────────────────────────────────
async function aiMatchTasks(
  commitMessage: string,
  changedFiles: string[],
  tasks: any[],
  projectModules: string[]
): Promise<{ taskId: string; confidence: number; reason: string }[]> {
  if (tasks.length === 0) return [];

  // Filter only open tasks (not completed/deployed)
  const openTasks = tasks.filter(
    (t) => !['completed', 'deployed'].includes(t.status)
  );
  if (openTasks.length === 0) return [];

  const taskList = openTasks
    .map(
      (t) =>
        `- ID: "${t.id}" | Token: ${t.ticketId || 'N/A'} | Module: "${t.module}" | Title: "${t.title}" | Status: ${t.status}`
    )
    .join('\n');

  const filesText = changedFiles.slice(0, 30).join('\n') || 'No file info';
  const modulesText = projectModules.join(', ') || 'None';

  const prompt = `You are an AI that matches git commits to software project tasks.

COMMIT MESSAGE: "${commitMessage}"

CHANGED FILES:
${filesText}

PROJECT MODULES: ${modulesText}

OPEN TASKS (id, token, module, title, status):
${taskList}

MODULE ALIAS RULES (apply these when analyzing file paths and commit messages):
- messages / chat / message → "Chat" module
- auth / login / otp / password / signin → "Authentication" module
- dashboard / home / stats / overview → "Dashboard" module
- kanban / tasks / ticket / board → "Task Management" module
- notification / alert / bell → "Notifications" module
- meeting / sync / standup / meet → "Meetings" module
- profile / user / account / settings → "User Profile" module
- github / commit / deploy / webhook / repo → "GitHub Integration" module
- payment / billing / invoice → "Billing" module
- api / backend / server / route → infer from folder name

MATCHING RULES:
1. If commit message contains a ticket ID (e.g. TOKEN-5), match that task with 99 confidence.
2. Look at the file paths — the folder name (e.g. "messages", "auth") often reveals the module.
3. Match the detected module to tasks in that module that are "pending" or "in_progress" (not yet testing/completed).
4. Use the commit message semantics to narrow down the most relevant task.
5. NEVER return tasks with confidence below 60.
6. Return at most 2 tasks.

Respond with ONLY this JSON (no markdown):
{
  "detectedModule": "string",
  "matches": [
    { "taskId": "string", "confidence": 0-100, "reason": "one short sentence" }
  ]
}`;

  try {
    const response = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'system', content: prompt }],
        jsonMode: true,
      }),
    });

    if (!response.ok) return [];

    const text = await response.text();
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return (parsed.matches || []).filter((m: any) => m.confidence >= 60);
  } catch (e) {
    console.error('[Webhook] AI matching failed:', e);
    return [];
  }
}

// ─────────────────────────────────────────────
// Main Webhook Handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Read raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');

    if (!verifyGitHubSignature(rawBody, signature)) {
      console.warn('[Webhook] Invalid signature — request rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const eventType = req.headers.get('x-github-event') || 'push';
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // Get project data
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    if (!projectSnap.exists()) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const projectData = projectSnap.data();

    // ── Handle PUSH event ──────────────────────────────────────────────
    if (eventType === 'push') {
      const commits = payload.commits || [];
      const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : 'main';
      const repoFullName = payload.repository?.full_name || 'unknown/repo';
      const pusher = payload.pusher?.name || 'Unknown';

      if (commits.length === 0) {
        return NextResponse.json({ success: true, message: 'No commits to process' });
      }

      // Fetch all project tasks for AI matching
      const tasksSnap = await getDocs(collection(db, `projects/${projectId}/tasks`));
      const allTasks = tasksSnap.docs.map((d) => ({ ...d.data(), id: d.id, ref: d.ref }));
      const projectModules = projectData?.customModules || [];

      const processedTaskIds = new Set<string>();
      let totalTasksUpdated = 0;

      for (const commit of commits) {
        const message: string = commit.message || '';
        const changedFiles: string[] = [
          ...(commit.added || []),
          ...(commit.modified || []),
          ...(commit.removed || []),
        ];

        // ── Step 1: Try exact token ID match first ──
        const tokenRegex = /\bTOKEN-(\d+)\b/gi;
        const tokenMatches = Array.from(message.matchAll(tokenRegex)) as RegExpMatchArray[];
        const directMatches: { taskId: string; confidence: number; reason: string }[] = [];

        for (const match of tokenMatches) {
          const ticketId = match[0].toUpperCase();
          const task = allTasks.find(
            (t) => t.ticketId?.toUpperCase() === ticketId || t.id.toUpperCase() === ticketId
          );
          if (task && !processedTaskIds.has(task.id)) {
            directMatches.push({ taskId: task.id, confidence: 99, reason: `Exact token match: ${ticketId}` });
          }
        }

        // ── Step 2: AI-powered matching (if no direct match) ──
        let aiMatches: { taskId: string; confidence: number; reason: string }[] = [];
        if (directMatches.length === 0) {
          aiMatches = await aiMatchTasks(message, changedFiles, allTasks, projectModules);
        }

        const allMatches = directMatches.length > 0 ? directMatches : aiMatches;

        // ── Step 3: Update matched tasks ──
        for (const match of allMatches) {
          const task = allTasks.find((t) => t.id === match.taskId);
          if (!task || processedTaskIds.has(task.id)) continue;
          if (['completed', 'deployed'].includes(task.status)) continue;

          processedTaskIds.add(task.id);
          totalTasksUpdated++;

          await updateDoc(task.ref, {
            status: 'github_pushed',
            progress: 100,
            'githubRef.lastCommitSha': commit.id,
            'githubRef.lastCommitMessage': commit.message,
            'githubRef.branchName': branch,
            lastMovedBy: {
              uid: 'github-ai',
              name: `GitHub (${pusher})`,
              photo: `https://github.com/${payload.sender?.login || 'ghost'}.png`,
              date: new Date(),
            },
            updatedAt: serverTimestamp(),
          });

          // Notify assignee if set
          if (task.assigneeId) {
            try {
              const { createNotification } = await import('@/lib/firebase/firestore');
              await createNotification(task.assigneeId, {
                type: 'commit',
                title: '🐙 Code Pushed to GitHub',
                body: `"${task.title}" was auto-moved to GitHub Pushed. Commit: "${message.split('\n')[0].slice(0, 80)}"`,
                projectId,
                taskId: task.id,
                metadata: { commitSha: commit.id, branch, reason: match.reason },
              });
            } catch (e) {
              console.error('[Webhook] Failed to send notification:', e);
            }
          }
        }

        // ── Step 4: Log GitHub event ──
        const filesChanged =
          (commit.added?.length || 0) +
          (commit.modified?.length || 0) +
          (commit.removed?.length || 0);

        await addDoc(collection(db, `projects/${projectId}/github_events`), {
          type: 'push',
          commitSha: commit.id,
          commitMessage: commit.message,
          author: commit.author?.name || pusher,
          authorAvatar: payload.sender?.login
            ? `https://github.com/${payload.sender.login}.png`
            : '',
          repoFullName,
          taskRefs: allMatches.map((m) => m.taskId),
          aiMatched: aiMatches.length > 0,
          filesChanged,
          additions: commit.added?.length || 0,
          deletions: commit.removed?.length || 0,
          branch,
          url: commit.url,
          processedAt: serverTimestamp(),
        });
      }

      // Update project commit count
      await updateDoc(projectRef, {
        'stats.totalCommits': increment(commits.length),
      });

      return NextResponse.json({
        success: true,
        message: `Processed ${commits.length} commit(s), updated ${totalTasksUpdated} task(s)`,
        tasksUpdated: totalTasksUpdated,
      });
    }

    return NextResponse.json({ success: true, message: `Acknowledged ${eventType} event` });
  } catch (error: any) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
