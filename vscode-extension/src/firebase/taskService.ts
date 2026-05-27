import {
  collection,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  addDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  Unsubscribe,
  DocumentData,
  QuerySnapshot,
  QueryDocumentSnapshot,
  FirestoreError,
} from '@firebase/firestore';
import { getFirebaseDb } from './client';

// ─────────────────────────────────────────────
// Types (mirrored from web/types/index.ts)
// ─────────────────────────────────────────────

export type TaskStatus = 'pending' | 'in_progress' | 'testing' | 'completed' | 'github_pushed' | 'deployed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'bug' | 'feature' | 'improvement';

export interface Task {
  id: string;
  projectId: string;
  ticketId?: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  module: string;
  progress: number;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneePhoto: string | null;
  dueDate: Date | null;
  tags: string[];
  githubRef?: { branchName?: string | null; lastCommitSha?: string | null; prNumber?: number | null };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MSDEVNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  projectId: string;
  taskId: string | null;
  read: boolean;
  createdAt: Date;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  createdAt: Date;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  github?: { connected: boolean; repoOwner: string; repoName: string };
}

// ─────────────────────────────────────────────
// Firestore helpers
// ─────────────────────────────────────────────

function toDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val.toDate === 'function') return val.toDate();
  return new Date(val);
}

function docToTask(id: string, data: DocumentData, projectId: string): Task {
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

export function subscribeToMyTasks(
  uid: string,
  projectIds: string[],
  callback: (tasks: Task[]) => void
): Unsubscribe {
  if (projectIds.length === 0) {
    callback([]);
    return () => {};
  }

  const db = getFirebaseDb();
  const unsubs: Unsubscribe[] = [];
  const taskMap = new Map<string, Task[]>(); // projectId -> tasks

  const emit = () => {
    const all: Task[] = [];
    taskMap.forEach(tasks => all.push(...tasks));
    // Sort: in_progress first, then by priority weight
    const priorityWeight: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    const statusWeight: Record<string, number> = { in_progress: 5, testing: 4, pending: 3, github_pushed: 2, deployed: 1, completed: 0 };
    all.sort((a, b) => {
      const sw = (statusWeight[b.status] ?? 0) - (statusWeight[a.status] ?? 0);
      if (sw !== 0) return sw;
      return (priorityWeight[b.priority] ?? 0) - (priorityWeight[a.priority] ?? 0);
    });
    callback(all);
  };

  for (const projectId of projectIds) {
    const q = query(
      collection(db, 'projects', projectId, 'tasks'),
      where('assigneeId', '==', uid),
      orderBy('updatedAt', 'desc')
    );
    const unsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        taskMap.set(projectId, snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => docToTask(d.id, d.data(), projectId)));
        emit();
      },
      (err: FirestoreError) => {
        console.error(`[MSDEV] Task listener error for project ${projectId}:`, err);
      }
    );
    unsubs.push(unsub);
  }

  return () => unsubs.forEach(u => u());
}

// ─────────────────────────────────────────────
// Subscribe to unread notifications
// ─────────────────────────────────────────────

export function subscribeToNotifications(
  uid: string,
  callback: (notifications: MSDEVNotification[]) => void
): Unsubscribe {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'notifications', uid, 'items'),
    where('read', '==', false),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const notifs: MSDEVNotification[] = snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
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
    },
    (err: FirestoreError) => {
      console.error('[MSDEV] Notification listener error:', err);
    }
  );
}

// ─────────────────────────────────────────────
// Get user's project IDs from Firestore
// ─────────────────────────────────────────────

export async function getUserProjectIds(uid: string): Promise<string[]> {
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return [];
  return snap.data().projectIds || [];
}

// ─────────────────────────────────────────────
// Get projects metadata (name, color)
// ─────────────────────────────────────────────

export async function getProjects(projectIds: string[]): Promise<Project[]> {
  const db = getFirebaseDb();
  const projects: Project[] = [];
  for (const pid of projectIds) {
    const snap = await getDoc(doc(db, 'projects', pid));
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

export async function updateTaskStatus(
  projectId: string,
  taskId: string,
  status: TaskStatus
): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
    status,
    updatedAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Add a comment
// ─────────────────────────────────────────────

export async function addComment(
  projectId: string,
  taskId: string,
  text: string,
  author: { uid: string; displayName: string; photoURL: string }
): Promise<void> {
  const db = getFirebaseDb();
  await addDoc(collection(db, 'projects', projectId, 'tasks', taskId, 'comments'), {
    authorId: author.uid,
    authorName: author.displayName,
    authorPhoto: author.photoURL || '',
    text,
    attachments: [],
    createdAt: serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// Get comments for a task
// ─────────────────────────────────────────────

export async function getComments(projectId: string, taskId: string): Promise<Comment[]> {
  const db = getFirebaseDb();
  const q = query(
    collection(db, 'projects', projectId, 'tasks', taskId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d: QueryDocumentSnapshot<DocumentData>) => ({
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

export async function setTaskBranch(projectId: string, taskId: string, branchName: string): Promise<void> {
  const db = getFirebaseDb();
  await updateDoc(doc(db, 'projects', projectId, 'tasks', taskId), {
    'githubRef.branchName': branchName,
    updatedAt: serverTimestamp(),
  });
}
