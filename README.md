# MSDEV 🚀
### Collaborative Project Management & Developer Productivity Platform

> A professional SaaS-grade platform combining Jira, Trello, GitHub Projects, and ClickUp — fully powered by Firebase.

---

## ✨ Features

| Feature | Status |
|---|---|
| 🔐 Google Sign-In + Email Auth | ✅ Complete |
| 👥 Role-Based Access Control (Admin/Member/Viewer) | ✅ Complete |
| 📁 Unlimited Projects with Invitations | ✅ Complete |
| 🗂️ Kanban Board (Drag & Drop) | ✅ Complete |
| 📋 AG Grid Spreadsheet Tracker | ✅ Complete |
| ⚡ GitHub Webhook Integration | ✅ Complete |
| 🔄 Real-time Firestore Sync | ✅ Complete |
| 📊 Analytics Dashboard (Recharts) | ✅ Complete |
| ⏰ Activity Timeline | ✅ Complete |
| 🔔 FCM Push Notifications | ✅ Complete |
| 💬 Task Comments | ✅ Complete |
| 📱 Flutter Mobile App | ✅ Complete |
| ☁️ Firebase Cloud Functions | ✅ Complete |
| 🔒 Firestore Security Rules | ✅ Complete |

---

## 🏗️ Architecture

```
MSDEV/
├── web/          # Next.js 14 Web App (TypeScript + Tailwind)
├── functions/    # Firebase Cloud Functions (Node.js + TypeScript)
├── mobile/       # Flutter Mobile App (iOS + Android)
├── firestore.rules
├── storage.rules
├── firebase.json
└── firestore.indexes.json
```

---

## 🚀 Quick Start

### 1. Firebase Setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Google + Email/Password providers
3. Create a **Firestore Database** (production mode)
4. Enable **Firebase Storage**
5. Get your config from **Project Settings → Your Apps**

### 2. Web App

```bash
cd web
cp .env.local.example .env.local
# Fill in your Firebase config values in .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 3. Cloud Functions

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 4. Deploy Security Rules

```bash
firebase deploy --only firestore:rules,storage
```

### 5. Flutter Mobile

```bash
cd mobile
# Add your google-services.json (Android) and GoogleService-Info.plist (iOS)
flutter pub get
flutter run
```

---

## ⚙️ Environment Variables

Create `web/.env.local` from `web/.env.local.example`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
GITHUB_WEBHOOK_SECRET=your_secret_here
```

---

## 🔗 GitHub Integration

### Setup Webhook

1. Go to your GitHub repo → **Settings → Webhooks → Add webhook**
2. Set **Payload URL** to your Cloud Function URL:
   ```
   https://us-central1-YOUR_PROJECT.cloudfunctions.net/githubWebhook?projectId=YOUR_PROJECT_ID
   ```
3. Set **Content type**: `application/json`
4. Set **Secret**: same as `GITHUB_WEBHOOK_SECRET`
5. Select events: **Pushes** + **Pull requests**

### Commit Message Format

```bash
git commit -m "TASK-12 completed login module"   # → ✅ Completed (100%)
git commit -m "TASK-15 started dashboard UI"     # → 🔄 In Progress (30%)
git commit -m "TASK-7 testing auth flow"         # → 🧪 Testing (75%)
```

---

## 🔒 Firestore Security Rules

- ✅ Only project members can read project data
- ✅ Only admins can manage members and settings
- ✅ Team members can only edit their assigned tasks
- ✅ Viewers have read-only access
- ✅ Activity logs are immutable (append-only)
- ✅ GitHub events only writable by Cloud Functions
- ✅ Notifications are private to each user

---

## 📱 Mobile Screens

| Screen | Description |
|---|---|
| Login | Google + Email auth with animated UI |
| Projects | Real-time project list with progress bars |
| Project Detail | Stats, completion ring, task list |
| Kanban | 4-column horizontal scroll board |
| Notifications | Real-time notifications with read states |

---

## 🔮 Future AI Features (Planned)

- [ ] Gemini AI task suggestions
- [ ] Smart delay prediction
- [ ] Natural language project search
- [ ] AI weekly summary reports
- [ ] Productivity insights via Vertex AI

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Web Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Mobile | Flutter 3.x, Riverpod, GoRouter |
| Backend | Firebase Cloud Functions |
| Database | Cloud Firestore |
| Auth | Firebase Authentication |
| Storage | Firebase Storage |
| Notifications | Firebase Cloud Messaging |
| Realtime | Firestore onSnapshot listeners |
| GitHub | GitHub API + Webhooks |
| Spreadsheet | AG Grid Community |
| Charts | Recharts |
| Animations | Framer Motion |
| Drag & Drop | @dnd-kit |

---

## 📄 License

MIT © MSDEV Team
