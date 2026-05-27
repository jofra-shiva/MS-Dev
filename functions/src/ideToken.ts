import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

/**
 * Callable Cloud Function: generateIDEToken
 * 
 * Called from the MSDEV web app (Profile → Connect VS Code).
 * Returns a custom Firebase Auth token that expires in 1 hour.
 * The user must already be authenticated via the web app.
 */
export const generateIDEToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'You must be signed in to generate an IDE token.'
    );
  }

  const uid = context.auth.uid;
  
  try {
    // Mint a custom token for this user
    const customToken = await admin.auth().createCustomToken(uid, {
      source: 'vscode_extension',
      generatedAt: new Date().toISOString(),
    });
    
    return { token: customToken };
  } catch (error: any) {
    throw new functions.https.HttpsError(
      'internal',
      `Failed to generate IDE token: ${error.message}`
    );
  }
});
