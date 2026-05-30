# MSDEV Tasks

Manage your MSDEV project tasks directly from VS Code with real-time Firebase sync. 

**Created and developed by Jofra Shiva (@jofrashiva)**

## Features

- **Sidebar Integration:** View all your MSDEV projects and tasks directly in the VS Code sidebar.
- **Real-time Sync:** Powered by Firebase, ensuring your tasks are always up to date.
- **Quick Actions:** Easily open your project dashboard or the linked local folder from the sidebar.
- **Chat Integration:** Send tasks to chat for seamless communication.

## How to Use

1. **Sign In:** Open the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) and type **`MSDEV: Sign In`** to authenticate.
2. **Access the Sidebar:** Click the MSDEV Tasks icon in the Activity Bar (usually on the left side of VS Code) to view and manage your projects.
3. **Configure Settings:** To ensure real-time sync works properly, configure your Firebase credentials:
   - Go to VS Code Settings (`Ctrl+,` or `Cmd+,`).
   - Search for `msdev`.
   - Enter your `Firebase API Key`, `Project ID`, `Auth Domain`, `App ID`, and `Web App URL` (matches your `.env` variables).
4. **Available Commands:** You can access various features via the Command Palette:
   - `MSDEV: Refresh Projects` - Manually refresh your project list.
   - `MSDEV: Open Project Dashboard` - Open the web dashboard for your project.
   - `MSDEV: Open Linked Local Folder` - Open the local workspace folder for the selected project.
   - `MSDEV: Sign Out` - Log out of your MSDEV account.

## Extension Settings

This extension contributes the following settings to VS Code:

* `msdev.webAppUrl`: Base URL of your MS Dev web app (e.g. `https://your-app.vercel.app`).
* `msdev.firebaseApiKey`: Firebase API Key.
* `msdev.firebaseProjectId`: Firebase Project ID.
* `msdev.firebaseAuthDomain`: Firebase Auth Domain.
* `msdev.firebaseAppId`: Firebase App ID.
* `msdev.firebaseMessagingSenderId`: Firebase Messaging Sender ID.

## Requirements

- You need an active MSDEV web application and its corresponding Firebase project setup to sync tasks correctly.
