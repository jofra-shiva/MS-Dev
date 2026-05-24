import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { Project, Task, ActivityLog, ActivityType, Comment } from '@/types';
import { sendProjectSystemMessage } from './chat';

// ─────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────

export const createProject = async (
  data: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'stats' | 'completionPercentage'>,
  userId: string
) => {
  const projectRef = doc(collection(db, 'projects'));
  const batch = writeBatch(db);

  batch.set(projectRef, {
    ...data,
    id: projectRef.id,
    completionPercentage: 0,
    stats: { totalTasks: 0, completedTasks: 0, inProgressTasks: 0, pendingTasks: 0, totalCommits: 0, totalMembers: 1 },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Add projectId to user's projectIds array
  batch.update(doc(db, 'users', userId), {
    projectIds: arrayUnion(projectRef.id),
  });

  await batch.commit();
  return projectRef.id;
};

export const getProject = async (projectId: string) => {
  const snap = await getDoc(doc(db, 'projects', projectId));
  return snap.exists() ? { ...snap.data(), id: snap.id } as Project : null;
};

export const updateProject = async (projectId: string, data: Partial<Project>) => {
  await updateDoc(doc(db, 'projects', projectId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
};

export const addCustomModule = async (projectId: string, moduleName: string) => {
  await updateDoc(doc(db, 'projects', projectId), {
    customModules: arrayUnion(moduleName),
  });
};

export const subscribeToProject = (
  projectId: string,
  callback: (project: Project) => void
): Unsubscribe => {
  return onSnapshot(doc(db, 'projects', projectId), (snap) => {
    if (snap.exists()) callback({ ...snap.data(), id: snap.id } as Project);
  });
};

export const subscribeToUserProjects = (
  userId: string,
  callback: (projects: Project[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'projects'),
    where(`members.${userId}.role`, 'in', ['admin', 'member', 'viewer'])
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Project)));
  });
};

// ─────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────

export async function createTask(projectId: string, data: Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'completedAt' | 'ticketId'>) {
  const projectRef = doc(db, 'projects', projectId);
  const projectSnap = await getDoc(projectRef);
  const projectData = projectSnap.data();
  
  const typeKey = data.type === 'feature' ? 'feat' : data.type === 'bug' ? 'bug' : 'imp';
  const currentCount = (projectData?.stats?.taskCounters?.[typeKey] || 0) + 1;
  const ticketId = `${typeKey.toUpperCase()}-${currentCount}`;
  
  // Use a generic UUID or timestamp-based ID for the actual document ID to avoid conflicts 
  // if multiple users create tasks at the exact same millisecond. But for simplicity, we can use ticketId if conflicts are rare.
  // Let's use ticketId as the document ID for cleaner URLs.
  const taskId = ticketId;
  const ref = doc(db, 'projects', projectId, 'tasks', taskId);
  
  await setDoc(ref, {
    ...data,
    id: taskId,
    projectId,
    ticketId,
    meetingId: data.meetingId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null
  });
  
  // Also increment project task count and the specific counter
  await updateDoc(projectRef, {
    'stats.totalTasks': increment(1),
    'stats.pendingTasks': increment(data.status === 'pending' ? 1 : 0),
    'stats.inProgressTasks': increment(data.status === 'in_progress' ? 1 : 0),
    'stats.testingTasks': increment(data.status === 'testing' ? 1 : 0),
    'stats.completedTasks': increment(data.status === 'completed' ? 1 : 0),
    [`stats.taskCounters.${typeKey}`]: increment(1),
    updatedAt: serverTimestamp()
  });
  
  if (data.assigneeId) {
    await sendProjectSystemMessage(
      projectId, 
      'task_assignment', 
      `Assigned [Task: ${taskId}] to ${data.assigneeName}`, 
      { taskId, title: data.title, assigneeId: data.assigneeId, assigneeName: data.assigneeName },
      data.createdBy
    );
  }

  return taskId;
}

export const updateTask = async (
  projectId: string,
  taskId: string,
  data: Partial<Task>
) => {
  const taskRef = doc(db, `projects/${projectId}/tasks/${taskId}`);
  const oldSnap = await getDoc(taskRef);
  const oldTask = oldSnap.exists() ? (oldSnap.data() as Task) : null;

  const updates: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (data.status === 'completed' || data.status === 'deployed') {
    updates.completedAt = serverTimestamp();
    updates.progress = 100;
  } else if (data.status) {
    updates.completedAt = null;
    updates.completedBy = null;
  }
  await updateDoc(taskRef, updates);

  if (oldTask) {
    if (data.status && oldTask.status !== data.status) {
      const actorId = data.lastMovedBy?.uid || data.completedBy?.uid || undefined;
      await sendProjectSystemMessage(
        projectId,
        'task_update',
        `Moved [Task: ${taskId}] to ${data.status.replace('_', ' ')}`,
        { taskId, title: data.title || oldTask.title, from: oldTask.status, to: data.status },
        actorId
      );
    }
    
    if (data.assigneeId !== undefined && oldTask.assigneeId !== data.assigneeId) {
      if (data.assigneeId) {
        await sendProjectSystemMessage(
          projectId,
          'task_assignment',
          `Reassigned [Task: ${taskId}] to ${data.assigneeName}`,
          { taskId, title: data.title || oldTask.title, assigneeId: data.assigneeId, assigneeName: data.assigneeName },
          data.lastMovedBy?.uid
        );
      }
    }
  }
};

export const deleteTask = async (projectId: string, taskId: string) => {
  await deleteDoc(doc(db, `projects/${projectId}/tasks/${taskId}`));
};



export const subscribeToTasks = (
  projectId: string,
  callback: (tasks: Task[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, `projects/${projectId}/tasks`),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Task)));
  });
};

export const requestTaskMovePermission = async (
  projectId: string,
  taskId: string,
  requesterId: string,
  requesterName: string,
  assigneeId: string,
  assigneeEmail?: string,
  taskTitle?: string
) => {
  const taskRef = doc(db, `projects/${projectId}/tasks/${taskId}`);
  await updateDoc(taskRef, {
    moveRequests: arrayUnion(requesterId)
  });

  // Create in-app notification
  await createNotification(assigneeId, {
    type: 'task_move_request',
    title: 'Task Move Permission Requested',
    body: `${requesterName} wants to move your task "${taskTitle || 'Unknown'}". Please review and approve.`,
    projectId,
    taskId,
    metadata: {
      requesterId,
      requesterName,
      assigneeId,
      taskTitle: taskTitle || 'Unknown',
    }
  });

  // Send email if assigneeEmail is provided
  if (assigneeEmail) {
    try {
      await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: assigneeEmail,
          subject: `Permission Request: Move Task`,
          html: `
            <div style="font-family: sans-serif; padding: 20px;">
              <h2>Permission Request</h2>
              <p><strong>${requesterName}</strong> has requested permission to move the task <strong>"${taskTitle || 'Unknown'}"</strong> which is currently assigned to you.</p>
              <p>Log in to your dashboard to approve or ignore this request.</p>
            </div>
          `
        })
      });
    } catch (e) {
      console.error('Failed to send permission email:', e);
    }
  }
};

export const approveTaskMovePermission = async (
  projectId: string,
  taskId: string,
  requesterId: string,
  taskTitle?: string
) => {
  const taskRef = doc(db, `projects/${projectId}/tasks/${taskId}`);
  await updateDoc(taskRef, {
    moveRequests: arrayRemove(requesterId),
    approvedMovers: arrayUnion(requesterId)
  });

  // Notify the requester
  await createNotification(requesterId, {
    type: 'task_move_approved',
    title: 'Permission Granted',
    body: `You have been granted permission to move the task "${taskTitle || 'Unknown'}".`,
    projectId,
    taskId
  });
};

export const getProjectModules = async (projectId: string): Promise<string[]> => {
  const snap = await getDocs(collection(db, `projects/${projectId}/tasks`));
  const modules = new Set<string>();
  snap.forEach((d) => {
    const m = d.data().module;
    if (m && typeof m === 'string' && m.trim()) modules.add(m.trim());
  });
  return Array.from(modules);
};

// ─────────────────────────────────────────────
// COMMENTS
// ─────────────────────────────────────────────

export const addComment = async (
  projectId: string,
  taskId: string,
  data: Omit<Comment, 'id' | 'createdAt'>
) => {
  await addDoc(collection(db, `projects/${projectId}/tasks/${taskId}/comments`), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToComments = (
  projectId: string,
  taskId: string,
  callback: (comments: Comment[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, `projects/${projectId}/tasks/${taskId}/comments`),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as Comment)));
  });
};

// ─────────────────────────────────────────────
// ACTIVITY
// ─────────────────────────────────────────────

export const logActivity = async (
  projectId: string,
  data: Omit<ActivityLog, 'id' | 'createdAt'>
) => {
  await addDoc(collection(db, `projects/${projectId}/activity`), {
    ...data,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToActivity = (
  projectId: string,
  callback: (activity: ActivityLog[]) => void,
  maxItems = 50
): Unsubscribe => {
  const q = query(
    collection(db, `projects/${projectId}/activity`),
    orderBy('createdAt', 'desc'),
    limit(maxItems)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id } as ActivityLog)));
  });
};

// ─────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────

export const createNotification = async (
  userId: string,
  data: {
    type: 'task_assigned' | 'task_completed' | 'deadline' | 'commit' | 'mention' | 'project_update' | 'task_move_request' | 'task_move_approved' | 'permission_request';
    title: string;
    body: string;
    link?: string;
    projectId?: string;
    taskId?: string;
    metadata?: any;
  }
) => {
  await addDoc(collection(db, `notifications/${userId}/items`), {
    ...data,
    read: false,
    createdAt: serverTimestamp(),
  });
};

export const subscribeToNotifications = (
  userId: string,
  callback: (notifs: unknown[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, `notifications/${userId}/items`),
    orderBy('createdAt', 'desc'),
    limit(30)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
};

export const markNotificationRead = async (userId: string, notifId: string) => {
  await updateDoc(doc(db, `notifications/${userId}/items/${notifId}`), {
    read: true,
  });
};

// ─────────────────────────────────────────────
// MEMBERS / INVITATIONS
// ─────────────────────────────────────────────

export const inviteMember = async (
  projectId: string,
  projectName: string,
  email: string,
  role: 'member' | 'viewer' | 'task_assigner',
  invitedBy: string,
  invitedByName: string
) => {
  const invRef = doc(collection(db, 'invitations'));
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await setDoc(invRef, {
    id: invRef.id,
    projectId,
    projectName,
    invitedEmail: email,
    invitedBy,
    invitedByName,
    role,
    status: 'pending',
    createdAt: serverTimestamp(),
    expiresAt,
  });

  // Try to find the user by email (case-insensitive) to send a notification
  const userQ = query(collection(db, 'users'));
  const snap = await getDocs(userQ);
  const matchedUser = snap.docs.find(d => d.data().email?.toLowerCase() === email.toLowerCase());
  
  if (matchedUser) {
    const uid = matchedUser.id;
    await createNotification(uid, {
      type: 'project_update',
      title: 'New Project Invitation',
      body: `${invitedByName} invited you to join ${projectName}.`,
    });
  }
};

export const subscribeToMyInvitations = (
  email: string,
  callback: (invitations: unknown[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'invitations'),
    where('invitedEmail', '==', email),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ ...d.data(), id: d.id })));
  });
};

export const getPendingInvitations = async (email: string) => {
  const q = query(
    collection(db, 'invitations'),
    where('invitedEmail', '==', email),
    where('status', '==', 'pending')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data());
};

export const acceptInvitation = async (
  invitationId: string,
  userId: string,
  displayName: string,
  photoURL: string,
  email: string
) => {
  const invSnap = await getDoc(doc(db, 'invitations', invitationId));
  if (!invSnap.exists()) throw new Error('Invitation not found');

  const inv = invSnap.data();
  const batch = writeBatch(db);

  // Add user to project members
  batch.update(doc(db, 'projects', inv.projectId), {
    [`members.${userId}`]: {
      role: inv.role,
      displayName,
      photoURL,
      email,
      joinedAt: serverTimestamp(),
    },
    'stats.totalMembers': increment(1),
  });

  // Add project to user's list
  batch.update(doc(db, 'users', userId), {
    projectIds: arrayUnion(inv.projectId),
  });

  // Mark invitation accepted
  batch.update(doc(db, 'invitations', invitationId), { status: 'accepted' });

  await batch.commit();
};

export const declineInvitation = async (invitationId: string) => {
  await updateDoc(doc(db, 'invitations', invitationId), { status: 'declined' });
};

// ============================================================
// Meetings (Subcollection under Project)
// ============================================================

export async function createMeeting(projectId: string, data: Omit<import('@/types').Meeting, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>) {
  const ref = doc(collection(db, 'projects', projectId, 'meetings'));
  await setDoc(ref, {
    ...data,
    id: ref.id,
    projectId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Notify all attendees
  if (data.attendees && Array.isArray(data.attendees)) {
    for (const uid of data.attendees) {
      if (uid !== data.createdBy) {
        await createNotification(uid, {
          type: 'project_update',
          title: 'New Meeting Scheduled',
          body: `A new meeting "${data.name}" was scheduled.`,
          link: data.link || undefined,
        });
      }
    }
  }

  // Send meeting invite to group chat
  await sendProjectSystemMessage(
    projectId,
    'meeting_invite',
    `Scheduled a meeting: ${data.name}`,
    { meetingId: ref.id, name: data.name, date: data.date, link: data.link },
    data.createdBy
  );

  return ref.id;
}

export async function updateMeeting(projectId: string, meetingId: string, data: Partial<import('@/types').Meeting>) {
  const ref = doc(db, 'projects', projectId, 'meetings', meetingId);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMeeting(projectId: string, meetingId: string) {
  await deleteDoc(doc(db, 'projects', projectId, 'meetings', meetingId));
}

export function subscribeToMeetings(projectId: string, callback: (meetings: import('@/types').Meeting[]) => void) {
  const q = query(collection(db, 'projects', projectId, 'meetings'), orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => {
    const res: import('@/types').Meeting[] = [];
    snap.forEach(d => {
      const data = d.data();
      res.push({
        ...data,
        date: data.date?.toDate() || new Date(),
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as import('@/types').Meeting);
    });
    callback(res);
  });
}
