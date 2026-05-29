import {
  signInWithCustomToken,
  signOut,
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
} from '@firebase/auth';
import * as vscode from 'vscode';
import { getFirebaseAuth } from '../firebase/client';

const SECRET_EMAIL_KEY = 'msdev.firebase.email';
const SECRET_PASS_KEY = 'msdev.firebase.password';

export class AuthManager {
  private _context: vscode.ExtensionContext;
  private _currentUser: User | null = null;
  private _onAuthChange: ((user: User | null) => void) | null = null;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  get currentUser(): User | null {
    return this._currentUser;
  }

  onAuthStateChange(callback: (user: User | null) => void) {
    this._onAuthChange = callback;
  }

  /** Try to restore a persisted session silently on extension startup */
  async restoreSession(): Promise<User | null> {
    try {
      const email = await this._context.secrets.get(SECRET_EMAIL_KEY);
      const password = await this._context.secrets.get(SECRET_PASS_KEY);

      if (email && password) {
        const auth = getFirebaseAuth();
        const credential = await signInWithEmailAndPassword(auth, email, password);
        this._currentUser = credential.user;
        this._onAuthChange?.(credential.user);
        return credential.user;
      }
      return null;
    } catch {
      return null;
    }
  }


  /** Fallback: sign in with email + password */
  async loginWithEmail(): Promise<User | null> {
    const email = await vscode.window.showInputBox({
      title: 'MSDEV: Sign In — Email',
      prompt: 'Enter your MSDEV email address',
      placeHolder: 'you@example.com',
      ignoreFocusOut: true,
    });
    if (!email?.trim()) return null;

    const password = await vscode.window.showInputBox({
      title: 'MSDEV: Sign In — Password',
      prompt: 'Enter your MSDEV password',
      password: true,
      ignoreFocusOut: true,
    });
    if (!password) return null;

    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // Store credentials securely for auto-login
      await this._context.secrets.store(SECRET_EMAIL_KEY, email.trim());
      await this._context.secrets.store(SECRET_PASS_KEY, password);

      this._currentUser = credential.user;
      this._onAuthChange?.(credential.user);
      vscode.window.showInformationMessage(`✅ MSDEV: Signed in as ${credential.user.displayName || credential.user.email}`);
      return credential.user;
    } catch (err: any) {
      vscode.window.showErrorMessage(`MSDEV Sign In failed: ${err.message}`);
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      const auth = getFirebaseAuth();
      await signOut(auth);
      this._currentUser = null;
      
      // Clear saved credentials
      await this._context.secrets.delete(SECRET_EMAIL_KEY);
      await this._context.secrets.delete(SECRET_PASS_KEY);
      
      this._onAuthChange?.(null);
      vscode.window.showInformationMessage('MSDEV: Signed out.');
    } catch (err: any) {
      vscode.window.showErrorMessage(`MSDEV Sign Out failed: ${err.message}`);
    }
  }
}
