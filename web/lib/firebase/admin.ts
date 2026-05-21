import * as admin from 'firebase-admin';

// Protect against multiple initializations in Next.js development environment
if (!admin.apps.length) {
  try {
    // If the user has provided a base64 encoded service account JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_KEY, 'base64').toString()
      );
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      console.warn(
        'FIREBASE_SERVICE_ACCOUNT_KEY is missing. Admin SDK operations will fail if they require authentication.'
      );
      // Initialize without credentials (might fail depending on rules and environment)
      admin.initializeApp();
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

const adminDb = admin.firestore();

export { adminDb, admin };
