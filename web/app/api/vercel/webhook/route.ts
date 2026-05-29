import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import crypto from 'crypto';

// ─────────────────────────────────────────────
// Security: Verify Vercel Webhook Signature
// ─────────────────────────────────────────────
function verifyVercelSignature(body: string, signature: string | null): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) return true; // skip if not configured
  if (!signature) return false;
  try {
    const expected = crypto.createHmac('sha1', secret).update(body).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Main Vercel Webhook Handler
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get('x-vercel-signature');

    if (!verifyVercelSignature(rawBody, signature)) {
      console.warn('[Vercel Webhook] Invalid signature — rejected');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const eventType: string = payload.type || '';
    const deployment = payload.payload?.deployment || payload.deployment || {};
    const deploymentUrl = deployment.url || '';
    const deploymentState = deployment.state || payload.payload?.deploymentState || '';

    console.log(`[Vercel Webhook] Event: ${eventType}, State: ${deploymentState}`);

    // ── Deployment Succeeded ──────────────────────────────────────────
    if (
      eventType === 'deployment.succeeded' ||
      deploymentState === 'READY' ||
      eventType === 'deployment-ready'
    ) {
      // Find all tasks that are currently in 'github_pushed' status
      const tasksRef = collection(db, `projects/${projectId}/tasks`);
      const q = query(tasksRef, where('status', '==', 'github_pushed'));
      const snap = await getDocs(q);

      if (snap.empty) {
        return NextResponse.json({ success: true, message: 'No github_pushed tasks to update' });
      }

      let updatedCount = 0;

      for (const taskDoc of snap.docs) {
        const task = taskDoc.data();

        // Move to deployed first
        await updateDoc(taskDoc.ref, {
          status: 'deployed',
          progress: 100,
          lastMovedBy: {
            uid: 'vercel-auto',
            name: 'Vercel (Auto Deploy)',
            photo: 'https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/logo.png',
            date: new Date(),
          },
          updatedAt: serverTimestamp(),
        });

        // Then immediately move to completed
        await updateDoc(taskDoc.ref, {
          status: 'completed',
          completedAt: serverTimestamp(),
          completedBy: {
            uid: 'vercel-auto',
            name: 'Vercel (Auto Deploy)',
            photo: 'https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/logo.png',
            date: new Date(),
          },
          updatedAt: serverTimestamp(),
        });

        updatedCount++;

        // Notify assignee
        if (task.assigneeId) {
          try {
            const { createNotification } = await import('@/lib/firebase/firestore');
            await createNotification(task.assigneeId, {
              type: 'task_completed',
              title: '🚀 Task Deployed & Completed!',
              body: `"${task.title}" was automatically marked as completed after a successful Vercel deployment.${deploymentUrl ? ` Live at: https://${deploymentUrl}` : ''}`,
              projectId,
              taskId: taskDoc.id,
              metadata: { deploymentUrl, autoCompleted: true },
            });
          } catch (e) {
            console.error('[Vercel Webhook] Notification failed:', e);
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Deployment succeeded. Marked ${updatedCount} task(s) as completed.`,
        tasksUpdated: updatedCount,
      });
    }

    // ── Deployment Failed ─────────────────────────────────────────────
    if (
      eventType === 'deployment.error' ||
      deploymentState === 'ERROR' ||
      deploymentState === 'CANCELED'
    ) {
      // Get project members to notify them
      const projectRef = doc(db, 'projects', projectId);
      const projectSnap = await getDoc(projectRef);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        const members = Object.keys(projectData?.members || {});
        const errorMessage = deployment.errorMessage || 'Build failed on Vercel.';

        try {
          const { createNotification } = await import('@/lib/firebase/firestore');
          for (const memberId of members.slice(0, 10)) {
            await createNotification(memberId, {
              type: 'project_update',
              title: '❌ Vercel Deployment Failed',
              body: `A deployment to Vercel failed: "${errorMessage}". Tasks remain in "GitHub Pushed" status.`,
              projectId,
              taskId: null,
              metadata: { deploymentUrl, errorMessage, state: deploymentState },
            });
          }
        } catch (e) {
          console.error('[Vercel Webhook] Failed to send failure notifications:', e);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Deployment failure acknowledged, team notified',
      });
    }

    return NextResponse.json({ success: true, message: `Acknowledged event: ${eventType}` });
  } catch (error: any) {
    console.error('[Vercel Webhook] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
