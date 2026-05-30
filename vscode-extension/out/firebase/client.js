"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseApp = getFirebaseApp;
exports.getFirebaseAuth = getFirebaseAuth;
exports.getFirebaseDb = getFirebaseDb;
const app_1 = require("@firebase/app");
const auth_1 = require("@firebase/auth");
const firestore_1 = require("@firebase/firestore");
const vscode = __importStar(require("vscode"));
let _app = null;
function getFirebaseApp() {
    if (_app)
        return _app;
    const config = vscode.workspace.getConfiguration('msdev');
    const firebaseConfig = {
        apiKey: config.get('firebaseApiKey') || '',
        authDomain: config.get('firebaseAuthDomain') || '',
        projectId: config.get('firebaseProjectId') || '',
        appId: config.get('firebaseAppId') || '',
        messagingSenderId: config.get('firebaseMessagingSenderId') || '',
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