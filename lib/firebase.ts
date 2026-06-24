import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app;
let db: any = null;
let auth: any = null;

try {
  // Dynamically load firebase config if available to prevent compile-time failures
  const firebaseConfig = require('../firebase-applet-config.json');
  if (firebaseConfig && firebaseConfig.projectId) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
    auth = getAuth(app);
    console.log("Firebase successfully initialized.");
  }
} catch (e) {
  console.warn("Firebase config not found or invalid, falling back to LocalStorage:", e);
}

export { db as firestoreDb, auth };
export default app;
