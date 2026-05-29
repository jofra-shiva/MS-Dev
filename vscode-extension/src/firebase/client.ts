import { initializeApp, getApps, FirebaseApp } from '@firebase/app';
import { getAuth } from '@firebase/auth';
import { getFirestore } from '@firebase/firestore';
import * as vscode from 'vscode';

let _app: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (_app) return _app;

  const firebaseConfig = {
    apiKey:            'AIzaSyBEImX1yeZ_QC0BH034SJIEoOB_GNPrt_4',
    authDomain:        'msdev-msdev.firebaseapp.com',
    projectId:         'msdev-msdev',
    appId:             '1:332300816650:web:8fa0340c901b6a00feaaf3',
    messagingSenderId: '332300816650',
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
