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
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './config';
import { Project, Task, ActivityLog, ActivityType, Comment } from '@/types';

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

export const createTask = async (
  projectId: string,
  data: Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'completedAt'>,
  taskNumber: number
) => {
  const batch = writeBatch(db);
  const taskRef = doc(collection(db, `projects/${projectId}/tasks`));

  batch.set(taskRef, {
    ...data,
    id: taskRef.id,
    projectId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  });

  // Increment project task stats
  batch.update(doc(db, 'projects', projectId), {
    'stats.totalTasks': increment(1),
    'stats.pendingTasks': increment(1),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return taskRef.id;
};

export const updateTask = async (
  projectId: string,
  taskId: string,
  data: Partial<Task>
) => {
  const updates: Record<string, unknown> = {
    ...data,
    updatedAt: serverTimestamp(),
  };
  if (data.status === 'completed') {
    updates.completedAt = serverTimestamp();
    updates.progress = 100;
  }
  await updateDoc(doc(db, `projects/${projectId}/tasks/${taskId}`), updates);
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
  role: 'member' | 'viewer',
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
