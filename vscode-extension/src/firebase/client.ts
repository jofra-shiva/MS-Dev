import { initializeApp, getApps, FirebaseApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import * as vscode from 'vscode';

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;

  const config = vscode.workspace.getConfiguration('msdev');
  
  const firebaseConfig = {
    apiKey:            config.get<string>('firebaseApiKey') || '',
    authDomain:        config.get<string>('firebaseAuthDomain') || '',
    projectId:         config.get<string>('firebaseProjectId') || '',
    appId:             config.get<string>('firebaseAppId') || '',
    messagingSenderId: config.get<string>('firebaseMessagingSenderId') || '',
  };

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
