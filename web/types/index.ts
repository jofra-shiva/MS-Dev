// ============================================================
// MSDEV — Core TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'member' | 'viewer';

export type TaskStatus = 'pending' | 'in_progress' | 'testing' | 'completed' | 'github_pushed' | 'deployed';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskType = 'bug' | 'feature' | 'improvement';

export type ActivityType =
  | 'task_created'
  | 'task_updated'
  | 'task_completed'
  | 'commit_pushed'
  | 'pr_merged'
  | 'member_added'
  | 'member_removed'
  | 'project_created';

export type NotificationType =
  | 'task_assigned'
  | 'task_completed'
  | 'deadline'
  | 'commit'
  | 'mention'
  | 'project_update'
  | 'project_request'
  | 'meeting_started';

// ─────────────────────────────────────────────
// User
// ─────────────────────────────────────────────
export interface MSDEVUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  projectIds: string[];
  fcmTokens: string[];
  preferences: {
    theme: 'dark' | 'light';
    notifications: boolean;
  };
  createdAt: Date;
  lastActive: Date;
}

// ─────────────────────────────────────────────
// Project
// ─────────────────────────────────────────────
export interface ProjectMember {
  role: UserRole;
  displayName: string;
  photoURL: string;
  email: string;
  joinedAt: Date;
}

export interface GitHubIntegration {
  connected: boolean;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  webhookId: number | null;
  installationId: string | null;
  connectedAt: Date | null;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  totalCommits: number;
  totalMembers: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  taskPrefix: string;
  status: 'active' | 'archived' | 'completed';
  completionPercentage: number;
  members: Record<string, ProjectMember>;
  github: GitHubIntegration;
  stats: ProjectStats;
  color: string; // hex color for project card
  liveUrl?: string;
  customModules?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────
// Task
// ─────────────────────────────────────────────
export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface TaskGitHubRef {
  lastCommitSha: string | null;
  lastCommitMessage: string | null;
  prNumber: number | null;
  branchName: string | null;
}

export interface TaskCompletionActor {
  uid: string;
  name: string;
  photo: string;
  date: Date;
}

export interface Meeting {
  id: string;
  projectId: string;
  name: string;
  date: Date;
  link: string | null;
  attendees: string[]; // User IDs
  createdAt: Date;
  updatedAt: Date;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  module: string;
  progress: number; // 0–100
  assigneeId: string | null;
  assigneeName: string | null;
  assigneePhoto: string | null;
  dueDate: Date | null;
  tags: string[];
  attachments: TaskAttachment[];
  githubRef: TaskGitHubRef;
  meetingId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  lastMovedBy?: TaskCompletionActor | null;
  completedBy?: TaskCompletionActor | null;
}

// ─────────────────────────────────────────────
// Comment
// ─────────────────────────────────────────────
export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  text: string;
  attachments: TaskAttachment[];
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Activity
// ─────────────────────────────────────────────
export interface ActivityLog {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  userPhoto: string;
  taskId: string | null;
  taskTitle: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// GitHub Event
// ─────────────────────────────────────────────
export interface GitHubEvent {
  id: string;
  type: 'push' | 'pull_request' | 'merge';
  commitSha: string;
  commitMessage: string;
  author: string;
  authorAvatar: string;
  repoFullName: string;
  taskRefs: string[];
  filesChanged: number;
  additions: number;
  deletions: number;
  branch: string;
  url: string;
  processedAt: Date;
}

// ─────────────────────────────────────────────
// Notification
// ─────────────────────────────────────────────
export interface MSDEVNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  projectId: string;
  taskId: string | null;
  read: boolean;
  createdAt: Date;
}

// ─────────────────────────────────────────────
// Invitation
// ─────────────────────────────────────────────
export interface Invitation {
  id: string;
  projectId: string;
  projectName: string;
  invitedEmail: string;
  invitedBy: string;
  invitedByName: string;
  role: 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'declined';
  createdAt: Date;
  expiresAt: Date;
}

// ─────────────────────────────────────────────
// Analytics
// ─────────────────────────────────────────────
export interface DailyActivity {
  date: string; // YYYY-MM-DD
  commits: number;
  tasksCompleted: number;
  tasksCreated: number;
}

export interface ContributorStat {
  userId: string;
  displayName: string;
  photoURL: string;
  commits: number;
  tasksCompleted: number;
  tasksCreated: number;
}

export interface ProjectAnalytics {
  dailyActivity: DailyActivity[];
  contributors: ContributorStat[];
  velocityByWeek: { week: string; completed: number }[];
  moduleCompletion: { module: string; total: number; completed: number }[];
}
