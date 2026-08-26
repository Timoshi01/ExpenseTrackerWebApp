import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signOut as firebaseSignOut,
  getAuth,
  getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { auth, db } from './firebase-init.js';

const provider = new GoogleAuthProvider();
// Request basic profile info from Google
provider.addScope('profile');
provider.addScope('email');

// Force account selection every time (helps with "logging out of gmail" requirement)
provider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * User Profile Management (Firestore Sync)
 */
export async function createOrUpdateUserDocument(user) {
  if (!user) {
    console.warn("App: No user provided to createOrUpdateUserDocument");
    return;
  }

  if (!db) {
    console.warn("App: Firestore (db) not initialized, cannot sync user profile");
    // Still save to localStorage even if cloud sync fails
    return;
  }

  console.log("App: Syncing user profile to Firestore...");
  const userRef = doc(db, 'users', user.uid);

  try {
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      console.log("App: Creating new user document...");
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || 'Anonymous User',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        photoURL: user.photoURL || ''
      });
    } else {
      console.log("App: Updating existing user document...");
      await updateDoc(userRef, {
        lastLogin: serverTimestamp(),
        displayName: user.displayName || docSnap.data().displayName,
        photoURL: user.photoURL || docSnap.data().photoURL
      });
    }
    console.log("App: User profile synced successfully!");
  } catch (error) {
    console.warn("App: Firestore sync failed:", error.message);
  }
}

/**
 * loginWithGoogle
 * Improved logic to handle both popup and redirect scenarios
 */
export async function loginWithGoogle() {
  console.log("App: loginWithGoogle triggered.");
  console.log("App: auth object:", auth);

  if (!auth) {
    console.error("App: Firebase Auth not initialized.");
    alert("Authentication not ready. Please refresh the page.");
    return;
  }

  console.log("App: auth.currentUser before login:", auth.currentUser);

  // Check if already logged in
  if (auth.currentUser) {
    console.log("App: User already logged in:", auth.currentUser.email);
    await handleUserLogin(auth.currentUser);
    return;
  }

  // Clear any stale auth state from previous sessions
  if (localStorage.getItem('firebase_user')) {
    console.log("App: Clearing stale user data from localStorage");
    localStorage.removeItem('firebase_user');
  }

  // Check if already logging in to prevent double trigger
  if (window.authLoading) {
    console.log("App: Login already in progress.");
    return;
  }
  window.authLoading = true;

  try {
    // Try popup first - works better on most devices including mobile
    // Popup is blocked only if explicitly blocked by browser
    console.log("App: Attempting Popup login...");

    // Add a timeout to handle the popup - it should complete within 30 seconds
    const popupPromise = signInWithPopup(auth, provider);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Login timeout - please try again")), 30000)
    );

    const result = await Promise.race([popupPromise, timeoutPromise]);

    console.log("App: Popup result received:", result);
    console.log("App: Popup result.user:", result?.user);

    if (result && result.user) {
      console.log("App: Popup login successful for:", result.user.email);
      // Small delay to ensure auth state is fully settled
      await new Promise(resolve => setTimeout(resolve, 100));
      await handleUserLogin(result.user);
    } else {
      // Wait for auth state to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      if (auth.currentUser) {
        console.log("App: User found via auth.currentUser after popup");
        await handleUserLogin(auth.currentUser);
      } else {
        console.log("App: No user found after popup - trying handleRedirectResult");
        await handleRedirectResult();
      }
    }
  } catch (error) {
    console.error("App: Login error:", error.code || 'no-code', error.message);

    const errorCode = error.code || '';

    if (errorCode === 'auth/popup-blocked') {
      console.log("App: Popup blocked, falling back to redirect.");
      await signInWithRedirect(auth, provider);
    } else if (errorCode === 'auth/popup-closed-by-user') {
      console.log("App: User closed popup or it was blocked by COOP. Trying redirect fallback...");
      // For a better UX, we can try redirect here too
      try {
        await signInWithRedirect(auth, provider);
      } catch (e) {
        console.error("App: Redirect fallback failed:", e);
      }
    } else if (errorCode === 'auth/credential-already-in-use') {
      alert("This account is already linked to another session. Try signing out first.");
    } else if (errorCode === 'auth/email-already-in-use') {
      alert("An account with this email already exists.");
    } else if (errorCode === 'auth/network-request-failed') {
      alert("Network error. Please check your connection and try again.");
    } else if (errorCode === 'auth/unauthorized-domain') {
      alert("This domain is not authorized for Google Sign-In. Please deploy to a registered domain or add it to Firebase Console > Authentication > Authorized domains.");
    } else if (errorCode === 'auth/admin-restricted-operation') {
      alert("This operation is not allowed. Please enable Google Sign-In in Firebase Console.");
    } else {
      // For other errors, try redirect as last resort
      console.log("App: Unknown error, trying redirect fallback.");
      try {
        await signInWithRedirect(auth, provider);
      } catch (e) {
        console.error("App: Redirect fallback also failed:", e);
        alert("Login failed: " + (e.message || 'Unknown error'));
      }
    }
  } finally {
    window.authLoading = false;
  }
}

/**
 * Internal helper to handle successful user login
 */
async function handleUserLogin(user, isManual = false) {
  if (!user) {
    console.error("App: handleUserLogin called with no user!");
    return;
  }

  console.log("App: handleUserLogin called for:", user.email, "Manual:", isManual);

  const userData = {
    email: user.email,
    uid: user.uid,
    displayName: user.displayName,
    photoURL: user.photoURL
  };

  // Save to localStorage immediately
  localStorage.setItem('firebase_user', JSON.stringify(userData));
  console.log("App: User saved to localStorage");

  // Dispatch login event - this will update the UI
  window.dispatchEvent(new CustomEvent('user-logged-in', {
    detail: { user: userData, uid: user.uid, isManual: isManual }
  }));
  console.log("App: user-logged-in event dispatched");

  // Try to sync to Firestore (non-blocking)
  try {
    await createOrUpdateUserDocument(user);
  } catch (err) {
    console.warn("App: Error in createOrUpdateUserDocument:", err);
  }

  console.log("App: Login handling complete for:", user.email);
}

/**
 * Get current signed-in user
 */
export function getCurrentUser() {
  return auth?.currentUser || null;
}

/**
 * Sign out user
 */
export async function logout() {
  if (!auth) return;

  try {
    console.log("App: Starting logout process...");
    
    // 1. Sign out from Firebase
    await firebaseSignOut(auth);
    
    // 2. Clear local session data
    localStorage.removeItem('firebase_user');
    
    // Optional: Clear other potential user-related storage
    localStorage.removeItem('user_settings');
    
    // 3. Dispatch event to update UI
    window.dispatchEvent(new CustomEvent('user-logged-out'));
    
    console.log("App: Firebase logout successful.");

    // 4. Return to home/dashboard and refresh to ensure clean state
    // This addresses the user requirement to "go back to no gmail account" 
    // by resetting the entire application state.
    window.location.href = window.location.origin + window.location.pathname + '#dashboard';
    
    // Small delay before reload to ensure storage changes are committed
    setTimeout(() => {
      window.location.reload();
    }, 100);
    
  } catch (error) {
    console.error("App: Logout error:", error);
    // Even if Firebase fails, we should still clear local state and reload
    localStorage.removeItem('firebase_user');
    window.location.reload();
  }
}

/**
 * handleRedirectResult
 * Processes the result after a redirect login
 */
export async function handleRedirectResult() {
  window.isProcessingRedirect = true;
  try {
    console.log("App: Checking for redirect result...");
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      console.log("App: Redirect login result detected.");
      await handleUserLogin(result.user, true); // Redirect result is usually a result of manual action
      return result.user;
    } else {
      console.log("App: No redirect result found.");
    }
  } catch (error) {
    console.error("App: Error handling redirect result:", error);
    if (error.code !== 'auth/redirect-cancelled-by-user') {
      alert("Login failed: " + error.message);
    }
  } finally {
    window.isProcessingRedirect = false;
  }
  return null;
}

/**
 * Auth System Initialization
 */
export function initAuth() {
  console.log("App: Initializing Auth listeners...");

  // 1. Check if we are in a redirect flow based on URL/Storage
  // Firebase redirect results are processed via getRedirectResult
  const isRedirect = window.location.hash.includes('access_token') ||
                     window.location.search.includes('code=') ||
                     window.location.search.includes('state=') ||
                     localStorage.getItem('firebase:previous_external_idp_redirect_state') !== null;

  if (isRedirect) {
    console.log("App: Redirect flow detected, waiting for result...");
    // Wait a moment for Firebase to process the redirect
    setTimeout(() => {
      handleRedirectResult();
    }, 500);
  }

  // 2. Setup persistence listener
  firebaseOnAuthStateChanged(auth, async (user) => {
    if (user) {
      console.log("App: Auth State -> Logged In:", user.email);
      // This is an automatic state change (persistence), so isManual = false
      await handleUserLogin(user, false);
    } else {
      // DONT clear local storage if we are currently processing a redirect!
      if (window.isProcessingRedirect) {
        console.log("App: Auth State is null but redirect is in progress. Skipping cleanup.");
        return;
      }

      console.log("App: Auth State -> Logged Out");
      const wasLoggedIn = localStorage.getItem('firebase_user') !== null;
      localStorage.removeItem('firebase_user');
      if (wasLoggedIn) {
        window.dispatchEvent(new CustomEvent('user-logged-out'));
      }
    }
  });
}

// Export onAuthStateChanged for external use
export { firebaseOnAuthStateChanged as onAuthStateChanged };

/**
 * Sign in with Google using redirect (better for mobile)
 */
export async function loginWithGoogleRedirect() {
  if (!auth) {
    console.error("App: Firebase Auth not initialized.");
    alert("Authentication not ready. Please refresh the page.");
    return;
  }

  // Clear any stale auth state
  if (localStorage.getItem('firebase_user')) {
    localStorage.removeItem('firebase_user');
  }

  console.log("App: Using redirect login for Google...");
  await signInWithRedirect(auth, provider);
}

// Global exposure for non-module scripts
window.loginWithGoogle = loginWithGoogle;
window.loginWithGoogleRedirect = loginWithGoogleRedirect;
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.initAuth = initAuth;

// Auto-initialize will be called by app.js to ensure listeners are ready
// initAuth(); 

// Ensure auth is ready before allowing login attempts
export function isAuthReady() {
  return auth !== undefined && auth !== null;
}
