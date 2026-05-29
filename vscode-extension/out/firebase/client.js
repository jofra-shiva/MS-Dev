"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseApp = getFirebaseApp;
exports.getFirebaseAuth = getFirebaseAuth;
exports.getFirebaseDb = getFirebaseDb;
const app_1 = require("@firebase/app");
const auth_1 = require("@firebase/auth");
const firestore_1 = require("@firebase/firestore");
let _app = null;
function getFirebaseApp() {
    if (_app)
        return _app;
    const firebaseConfig = {
        apiKey: 'AIzaSyBEImX1yeZ_QC0BH034SJIEoOB_GNPrt_4',
        authDomain: 'msdev-msdev.firebaseapp.com',
        projectId: 'msdev-msdev',
        appId: '1:332300816650:web:8fa0340c901b6a00feaaf3',
        messagingSenderId: '332300816650',
    };
    _app = (0, app_1.getApps)().length === 0
        ? (0, app_1.initializeApp)(firebaseConfig, 'msdev-vscode')
        : (0, app_1.getApps)().find(a => a.name === 'msdev-vscode') || (0, app_1.initializeApp)(firebaseConfig, 'msdev-vscode');
    return _app;
}
function getFirebaseAuth() {
    return (0, auth_1.getAuth)(getFirebaseApp());
}
function getFirebaseDb() {
    return (0, firestore_1.getFirestore)(getFirebaseApp());
}
//# sourceMappingURL=client.js.map