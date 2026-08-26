import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

let app;
let auth;
let db;

// 1. Initialize Firebase (Prevent double initialization)
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("App: Firebase initialized successfully! 🔥");
  } else {
    app = getApp();
  }

  // Initialize Services
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("App: Firebase Auth and Firestore initialized.");

  // 2. Enable Persistence with multi-tab sync
  // Only attempt to enable if it hasn't been started yet
  enableIndexedDbPersistence(db, { experimentalForceOwningTab: false })
    .then(() => console.log("App: Firestore persistence enabled"))
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn("App: Firestore persistence failed (multiple tabs) - using memory cache");
      } else if (err.code === 'unimplemented') {
        console.warn("App: Firestore persistence not supported");
      } else if (err.message && err.message.includes('already been started')) {
        console.log("App: Firestore already started, persistence should be active.");
      } else {
        console.error("App: Firestore persistence error:", err);
      }
    });
} catch (error) {
  if (error.message && error.message.includes('already been started')) {
     console.log("App: Firebase services already initialized.");
  } else {
     console.error("App: Firebase initialization error:", error);
  }
}

/**
 * 3. waitForAuth
 * Returns a promise that resolves when the initial auth state is determined
 */
export function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

/**
 * 4. isRedirectCallback
 * Checks if the current URL contains state indicating a redirect return
 */
export function isRedirectCallback() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  
  return hash.includes('access_token') || 
         params.has('code') || 
         params.has('state') ||
         localStorage.getItem('firebase:previous_external_idp_redirect_state') !== null;
}

// Network Monitoring
window.addEventListener('online', () => window.dispatchEvent(new CustomEvent('app-online')));
window.addEventListener('offline', () => window.dispatchEvent(new CustomEvent('app-offline')));

export { app, auth, db };
