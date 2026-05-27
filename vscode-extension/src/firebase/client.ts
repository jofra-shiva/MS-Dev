import { initializeApp, getApps, FirebaseApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import * as vscode from 'vscode';

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;

  const cfg = vscode.workspace.getConfiguration('msdev');
  const firebaseConfig = {
    apiKey:            cfg.get<string>('firebaseApiKey', ''),
    authDomain:        cfg.get<string>('firebaseAuthDomain', ''),
    projectId:         cfg.get<string>('firebaseProjectId', ''),
    appId:             cfg.get<string>('firebaseAppId', ''),
    messagingSenderId: cfg.get<string>('firebaseMessagingSenderId', ''),
  };

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error(
      'MSDEV Firebase config is missing. Please set msdev.firebaseApiKey and msdev.firebaseProjectId in VS Code Settings.'
    );
  }

  _app = getApps().length === 0
    ? initializeApp(firebaseConfig, 'msdev-vscode')
    : getApps().find(a => a.name === 'msdev-vscode') || initializeApp(firebaseConfig, 'msdev-vscode');

  return _app;
}

export function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

export function getFirebaseDb() {
  return getFirestore(getFirebaseApp());
}
