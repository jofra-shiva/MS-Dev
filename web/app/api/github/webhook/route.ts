import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, collection, addDoc, updateDoc, increment, query, where, getDocs, limit, serverTimestamp } from 'firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    const eventType = req.headers.get('x-github-event') || 'push';
    const payload = await req.json();

    // Get project details to find the taskPrefix using the Client SDK to avoid Admin SDK crash
    const projectRef = doc(db, 'projects', projectId);
    const projectSnap = await getDoc(projectRef);
    
    if (!projectSnap.exists()) {
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
        const regex = new RegExp(`\\b${taskPrefix}-(\\d+)\\b`, 'gi');
        const matches = Array.from(message.matchAll(regex)) as RegExpMatchArray[];
        
        const taskRefs: string[] = [];

        for (const match of matches) {
          const fullTaskRef = match[0].toUpperCase();
          taskRefs.push(fullTaskRef);

          const tasksRef = collection(db, `projects/${projectId}/tasks`);
          const q = query(tasksRef, where('title', '>=', fullTaskRef), where('title', '<=', fullTaskRef + '\uf8ff'), limit(1));
          const taskQuery = await getDocs(q);

          if (!taskQuery.empty) {
            const taskDoc = taskQuery.docs[0];
            
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
              updatedAt: serverTimestamp()
            };

            if (newStatus) {
              updates.status = newStatus;
              if (newStatus === 'completed') {
                updates.completedAt = serverTimestamp();
                updates.completedBy = {
                  uid: 'github',
                  name: commit.author?.name || 'GitHub',
                  photo: commit.author?.username ? `https://github.com/${commit.author.username}.png` : '',
                  date: serverTimestamp(),
                };
              }
              if (newStatus === 'in_progress') updates.progress = 50;
              if (newStatus === 'completed') updates.progress = 100;
            }

            await updateDoc(taskDoc.ref, updates);
          }
        }

        const filesChanged = (commit.added?.length || 0) + (commit.modified?.length || 0) + (commit.removed?.length || 0);

        await addDoc(collection(db, `projects/${projectId}/github_events`), {
          type: 'push',
          commitSha: commit.id,
          commitMessage: commit.message,
          author: commit.author?.name || 'Unknown',
          authorAvatar: commit.author?.username ? `https://github.com/${commit.author.username}.png` : '',
          repoFullName,
          taskRefs,
          filesChanged,
          additions: 0,
          deletions: 0,
          branch,
          url: commit.url,
          processedAt: serverTimestamp()
        });

        await updateDoc(projectRef, {
          'stats.totalCommits': increment(1)
        });
      }

      return NextResponse.json({ success: true, message: `Processed ${commits.length} commits` });
    }

    return NextResponse.json({ success: true, message: `Acknowledged ${eventType} event` });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
