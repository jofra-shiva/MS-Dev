import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb, admin } from '@/lib/firebase/admin';

// Helper to verify GitHub signature
function verifySignature(payload: string, signature: string, secret: string) {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const signature = req.headers.get('x-hub-signature-256');
    const eventType = req.headers.get('x-github-event');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) {
      return NextResponse.json({ error: 'Webhook secret not configured on server' }, { status: 500 });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    const rawBody = await req.text();
    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Get project details to find the taskPrefix
    const projectRef = adminDb.collection('projects').doc(projectId);
    const projectSnap = await projectRef.get();
    
    if (!projectSnap.exists) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const projectData = projectSnap.data();
    const taskPrefix = projectData?.taskPrefix || 'TASK';

    if (eventType === 'push') {
      const commits = payload.commits || [];
      const branch = payload.ref ? payload.ref.replace('refs/heads/', '') : 'main';
      const repoFullName = payload.repository?.full_name || 'unknown/repo';

      for (const commit of commits) {
        const message = commit.message || '';
        
        // Find tasks mentioned in the commit message: e.g. TASK-12 or AVSECO-001
        // Matches the prefix, followed by a dash, followed by numbers
        const regex = new RegExp(`\\b${taskPrefix}-(\\d+)\\b`, 'gi');
        const matches = Array.from(message.matchAll(regex)) as RegExpMatchArray[];
        
        const taskRefs: string[] = [];

        for (const match of matches) {
          const fullTaskRef = match[0].toUpperCase(); // e.g. AVSECO-001
          taskRefs.push(fullTaskRef);

          // Find the exact task in Firestore by title or an ID field
          // Since our tasks have IDs like "projectId_taskId", we need to query by title starting with fullTaskRef
          // Or if tasks don't have explicit ref fields, we can just query by title
          const taskQuery = await adminDb.collection(`projects/${projectId}/tasks`)
            .where('title', '>=', fullTaskRef)
            .where('title', '<=', fullTaskRef + '\uf8ff')
            .limit(1)
            .get();

          if (!taskQuery.empty) {
            const taskDoc = taskQuery.docs[0];
            
            // Determine status based on keywords
            let newStatus = null;
            const lowerMsg = message.toLowerCase();
            if (lowerMsg.includes('complete') || lowerMsg.includes('fix') || lowerMsg.includes('close')) {
              newStatus = 'completed';
            } else if (lowerMsg.includes('start') || lowerMsg.includes('progress')) {
              newStatus = 'in_progress';
            } else if (lowerMsg.includes('test')) {
              newStatus = 'testing';
            }

            const updates: any = {
              'githubRef.lastCommitSha': commit.id,
              'githubRef.lastCommitMessage': commit.message,
              'githubRef.branchName': branch,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            if (newStatus) {
              updates.status = newStatus;
              if (newStatus === 'completed') updates.completedAt = admin.firestore.FieldValue.serverTimestamp();
              if (newStatus === 'in_progress') updates.progress = 50; // just an example bump
              if (newStatus === 'completed') updates.progress = 100;
            }

            await taskDoc.ref.update(updates);
          }
        }

        // Log the GitHub Event for the UI
        const filesChanged = (commit.added?.length || 0) + (commit.modified?.length || 0) + (commit.removed?.length || 0);

        await adminDb.collection(`projects/${projectId}/github_events`).add({
          type: 'push',
          commitSha: commit.id,
          commitMessage: commit.message,
          author: commit.author?.name || 'Unknown',
          authorAvatar: commit.author?.username ? `https://github.com/${commit.author.username}.png` : '',
          repoFullName,
          taskRefs,
          filesChanged,
          additions: 0, // Basic payload doesn't give specific line counts
          deletions: 0,
          branch,
          url: commit.url,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Update Project Stats (increment commit count)
        await projectRef.update({
          'stats.totalCommits': admin.firestore.FieldValue.increment(1)
        });
      }

      return NextResponse.json({ success: true, message: `Processed ${commits.length} commits` });
    }

    // Acknowledge other event types (like ping or pull_request)
    return NextResponse.json({ success: true, message: `Acknowledged ${eventType} event` });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
