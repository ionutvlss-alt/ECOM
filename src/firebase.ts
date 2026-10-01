import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB14B2-Flsi9XxJx8bL6v1g2PLhu0uoCVA',
  authDomain: 'review-tracker-b3291.firebaseapp.com',
  projectId: 'review-tracker-b3291',
  storageBucket: 'review-tracker-b3291.firebasestorage.app',
  messagingSenderId: '308280428536',
  appId: '1:308280428536:web:f55971c1bb78f6fbfcf80d',
};

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

try {
  enableIndexedDbPersistence(db).catch(() => {});
} catch {}
