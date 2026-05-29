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
exports.AuthManager = void 0;
const auth_1 = require("@firebase/auth");
const vscode = __importStar(require("vscode"));
const client_1 = require("../firebase/client");
const SECRET_EMAIL_KEY = 'msdev.firebase.email';
const SECRET_PASS_KEY = 'msdev.firebase.password';
class AuthManager {
    constructor(context) {
        this._currentUser = null;
        this._onAuthChange = null;
        this._context = context;
    }
    get currentUser() {
        return this._currentUser;
    }
    onAuthStateChange(callback) {
        this._onAuthChange = callback;
    }
    /** Try to restore a persisted session silently on extension startup */
    async restoreSession() {
        try {
            const email = await this._context.secrets.get(SECRET_EMAIL_KEY);
            const password = await this._context.secrets.get(SECRET_PASS_KEY);
            if (email && password) {
                const auth = (0, client_1.getFirebaseAuth)();
                const credential = await (0, auth_1.signInWithEmailAndPassword)(auth, email, password);
                this._currentUser = credential.user;
                this._onAuthChange?.(credential.user);
                return credential.user;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /** Fallback: sign in with email + password */
    async loginWithEmail() {
        const email = await vscode.window.showInputBox({
            title: 'MSDEV: Sign In — Email',
            prompt: 'Enter your MSDEV email address',
            placeHolder: 'you@example.com',
            ignoreFocusOut: true,
        });
        if (!email?.trim())
            return null;
        const password = await vscode.window.showInputBox({
            title: 'MSDEV: Sign In — Password',
            prompt: 'Enter your MSDEV password',
            password: true,
            ignoreFocusOut: true,
        });
        if (!password)
            return null;
        try {
            const auth = (0, client_1.getFirebaseAuth)();
            const credential = await (0, auth_1.signInWithEmailAndPassword)(auth, email.trim(), password);
            // Store credentials securely for auto-login
            await this._context.secrets.store(SECRET_EMAIL_KEY, email.trim());
            await this._context.secrets.store(SECRET_PASS_KEY, password);
            this._currentUser = credential.user;
            this._onAuthChange?.(credential.user);
            vscode.window.showInformationMessage(`✅ MSDEV: Signed in as ${credential.user.displayName || credential.user.email}`);
            return credential.user;
        }
        catch (err) {
            vscode.window.showErrorMessage(`MSDEV Sign In failed: ${err.message}`);
            return null;
        }
    }
    async logout() {
        try {
            const auth = (0, client_1.getFirebaseAuth)();
            await (0, auth_1.signOut)(auth);
            this._currentUser = null;
            // Clear saved credentials
            await this._context.secrets.delete(SECRET_EMAIL_KEY);
            await this._context.secrets.delete(SECRET_PASS_KEY);
            this._onAuthChange?.(null);
            vscode.window.showInformationMessage('MSDEV: Signed out.');
        }
        catch (err) {
            vscode.window.showErrorMessage(`MSDEV Sign Out failed: ${err.message}`);
        }
    }
}
exports.AuthManager = AuthManager;
//# sourceMappingURL=AuthManager.js.map