import { auth, db } from './firebase-init.js';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const SYNC_QUEUE_KEY = 'firebase_sync_queue';
const ADMIN_EMAIL = 'admin@example.com'; // CHANGE THIS to your admin email in admin-view.html as well

/**
 * Queue Management
 */
function getQueue() {
  return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
}

function addToQueue(operation, data) {
  const queue = getQueue();
  queue.push({ operation, data, timestamp: Date.now() });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  console.log(`App: Added ${operation} to sync queue`);
}

function clearQueue() {
  localStorage.removeItem(SYNC_QUEUE_KEY);
}

async function processQueue() {
  if (!auth.currentUser || !navigator.onLine) return;
  
  const queue = getQueue();
  if (queue.length === 0) return;
  
  console.log(`App: Processing ${queue.length} items in sync queue...`);
  window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { status: 'syncing' } }));

  const remainingQueue = [];
  
  for (const item of queue) {
    try {
      if (item.operation === 'add') {
        await syncExpenseToCloud(item.data);
      } else if (item.operation === 'delete') {
        await syncDeleteFromCloud(item.data.id);
      } else if (item.operation === 'update') {
        await syncUpdateToCloud(item.data.id, item.data);
      }
    } catch (error) {
      console.warn("App: Queue processing failed for item:", item, error);
      remainingQueue.push(item);
    }
  }
  
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
  
  if (remainingQueue.length === 0) {
    window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { status: 'synced' } }));
  } else {
    window.dispatchEvent(new CustomEvent('sync-status-changed', { detail: { status: 'error' } }));
  }
}

/**
 * Firestore Sync Operations (Path: users/{userId}/expenses/{expenseId})
 */
async function syncExpenseToCloud(expense) {
  const user = auth?.currentUser;
  if (!user) {
    console.error("App: Cannot sync expense - no authenticated user");
    throw new Error("No authenticated user");
  }
  if (!db) {
    console.error("App: Cannot sync expense - Firestore not initialized");
    throw new Error("Firestore not initialized");
  }

  try {
    console.log("App: Syncing expense to user:", user.uid, user.email);
    const expenseData = {
      userId: user.uid,
      userEmail: user.email,
      amount: expense.amount,
      category: expense.category,
      date: expense.date,
      note: expense.note || '',
      createdAt: serverTimestamp()
    };

    // Use the numeric expense ID if available, otherwise let Firebase generate one
    const expensesCol = collection(db, 'users', user.uid, 'expenses');
    let docRef;

    if (expense.id) {
      // Use setDoc with custom ID for faster syncing
      docRef = doc(expensesCol, expense.id.toString());
      await setDoc(docRef, expenseData);
    } else {
      docRef = await addDoc(expensesCol, expenseData);
    }

    console.log("App: Expense synced to cloud with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("App: Error syncing expense to cloud:", error);
    throw error;
  }
}

async function syncDeleteFromCloud(expenseId) {
  const user = auth.currentUser;
  if (!user || !db) return;
  
  try {
    const docRef = doc(db, 'users', user.uid, 'expenses', expenseId.toString());
    await deleteDoc(docRef);
    console.log("App: Expense deleted from cloud:", expenseId);
  } catch (error) {
    console.error("App: Error deleting expense from cloud:", error);
    throw error;
  }
}

async function syncUpdateToCloud(expenseId, updatedExpense) {
  const user = auth.currentUser;
  if (!user || !db) return;
  
  try {
    const updateData = {
      amount: updatedExpense.amount,
      category: updatedExpense.category,
      date: updatedExpense.date,
      note: updatedExpense.note || '',
      updatedAt: serverTimestamp()
    };
    
    const docRef = doc(db, 'users', user.uid, 'expenses', expenseId.toString());
    // Use setDoc with merge: true instead of updateDoc for better resilience
    await setDoc(docRef, updateData, { merge: true });
    console.log("App: Expense updated in cloud:", expenseId);
  } catch (error) {
    console.error("App: Error updating expense in cloud:", error);
    throw error;
  }
}

async function pullFromCloud() {
  const user = auth?.currentUser;
  if (!user) {
    console.warn("App: Cannot pull from cloud - no authenticated user");
    return [];
  }
  if (!db) {
    console.warn("App: Cannot pull from cloud - Firestore not initialized");
    return [];
  }

  try {
    console.log("App: Pulling expenses from cloud for user:", user.uid);
    const expensesCol = collection(db, 'users', user.uid, 'expenses');
    const snapshot = await getDocs(expensesCol);
    const expenses = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
    console.log("App: Pulled", expenses.length, "expenses from cloud");
    return expenses;
  } catch (error) {
    console.error("App: Error pulling from cloud:", error);
    return [];
  }
}

async function syncSettingsToCloud(settings) {
  const user = auth?.currentUser;
  if (!user || !db) return;

  try {
    console.log("App: Syncing settings to cloud for user:", user.uid);
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'budget');
    await setDoc(settingsRef, {
      ...settings,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log("App: Settings synced successfully");
  } catch (error) {
    console.error("App: Error syncing settings to cloud:", error);
  }
}

async function pullSettingsFromCloud() {
  const user = auth?.currentUser;
  if (!user || !db) return null;

  try {
    console.log("App: Pulling settings from cloud for user:", user.uid);
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'budget');
    const docSnap = await getDocs(query(collection(db, 'users', user.uid, 'settings'), where('__name__', '==', 'budget')));
    
    // Alternative: simpler getDoc
    const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js");
    const snap = await getDoc(settingsRef);
    
    if (snap.exists()) {
      console.log("App: Settings pulled successfully");
      return snap.data();
    }
    return null;
  } catch (error) {
    console.error("App: Error pulling settings from cloud:", error);
    return null;
  }
}

async function clearAllCloudData() {
  const user = auth?.currentUser;
  if (!user) {
    console.warn("App: Cannot clear cloud data - no authenticated user");
    return;
  }
  if (!db) {
    console.warn("App: Cannot clear cloud data - Firestore not initialized");
    return;
  }

  try {
    console.log("App: Clearing all cloud data for user:", user.uid);
    
    // 1. Delete Expenses
    const expensesCol = collection(db, 'users', user.uid, 'expenses');
    const snapshot = await getDocs(expensesCol);
    const deleteExpensesPromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteExpensesPromises);
    
    // 2. Delete Settings
    const settingsRef = doc(db, 'users', user.uid, 'settings', 'budget');
    await deleteDoc(settingsRef);
    
    console.log("App: All cloud data (expenses and settings) deleted for user:", user.uid);
    return true;
  } catch (error) {
    console.error("App: Error clearing cloud data:", error);
    throw error;
  }
}

/**
 * Admin Functions
 */
async function getAllUsersForAdmin() {
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL || !db) {
    console.warn("App: Unauthorized access to admin function");
    return null;
  }

  try {
    console.log("App: Fetching all users for admin...");
    const usersCol = collection(db, 'users');
    const usersSnapshot = await getDocs(usersCol);
    const allData = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const expensesCol = collection(db, 'users', userDoc.id, 'expenses');
      const expensesSnapshot = await getDocs(expensesCol);
      
      allData.push({
        userId: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        createdAt: userData.createdAt,
        lastLogin: userData.lastLogin,
        expenses: expensesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }))
      });
    }

    return allData;
  } catch (error) {
    console.error("App: Error fetching admin data:", error);
    throw error;
  }
}

/**
 * Merge logic
 */
async function mergeData(cloudData) {
  if (!cloudData || cloudData.length === 0) return;
  
  console.log("App: Merging", cloudData.length, "expenses from cloud...");
  
  for (const cloudExp of cloudData) {
    if (window.updateExpense) {
      // 1. Convert Firebase Timestamp to number (epoch ms) if necessary
      if (cloudExp.createdAt && typeof cloudExp.createdAt.toMillis === 'function') {
        cloudExp.createdAt = cloudExp.createdAt.toMillis();
      }
      if (cloudExp.updatedAt && typeof cloudExp.updatedAt.toMillis === 'function') {
        cloudExp.updatedAt = cloudExp.updatedAt.toMillis();
      }
      
      // 2. Fix ID type mismatch (Firestore ID is string, IndexedDB expects number for timestamps)
      // If the ID is numeric (like "1710000000000"), convert it to a Number
      const finalId = isNaN(cloudExp.id) ? cloudExp.id : Number(cloudExp.id);
      
      // Pass true as the third argument to skip syncing BACK to cloud
      await window.updateExpense(finalId, cloudExp, true);
    }
  }
  
  if (window.refreshAllData) await window.refreshAllData();
}

/**
 * Periodic Sync - Pull new data from cloud every 2 minutes
 */
async function startPeriodicPull() {
  if (!auth.currentUser || !navigator.onLine) return;

  console.log("App: Running periodic cloud pull...");
  try {
    const cloudData = await pullFromCloud();
    if (cloudData && cloudData.length > 0) {
      if (window.mergeData) {
        await window.mergeData(cloudData);
        console.log("App: Periodic pull and merge complete.");
      }
    }
  } catch (error) {
    console.error("App: Periodic pull failed:", error);
  }
}

/**
 * Auto-sync setup
 */
function startAutoSync() {
  // Process queue when coming online
  window.addEventListener('app-online', () => {
    console.log("App: Network online - processing sync queue");
    processQueue();
    startPeriodicPull(); // Also pull when coming online
  });

  // Process queue when user logs in (with slight delay to ensure auth is ready)
  window.addEventListener('user-logged-in', () => {
    console.log("App: User logged in - processing sync queue and initial pull");
    setTimeout(() => {
      processQueue();
      startPeriodicPull();
    }, 1500);
  });

  // Also process on page load if user is already logged in
  setTimeout(() => {
    if (auth?.currentUser) {
      console.log("App: User already logged in on page load - starting auto-sync");
      processQueue();
      startPeriodicPull();
    }
  }, 3000);

  // Periodic UPLOAD every 30 seconds
  setInterval(processQueue, 30000);
  
  // Periodic DOWNLOAD every 2 minutes to support cross-device sync
  setInterval(startPeriodicPull, 120000);
}

// Initial call
startAutoSync();

export { 
  syncExpenseToCloud, 
  syncDeleteFromCloud, 
  syncUpdateToCloud, 
  pullFromCloud, 
  mergeData, 
  addToQueue,
  processQueue,
  getAllUsersForAdmin,
  clearAllCloudData,
  syncSettingsToCloud,
  pullSettingsFromCloud
};

window.syncExpenseToCloud = syncExpenseToCloud;
window.syncDeleteFromCloud = syncDeleteFromCloud;
window.syncUpdateToCloud = syncUpdateToCloud;
window.pullFromCloud = pullFromCloud;
window.mergeData = mergeData; // CRITICAL: Expose mergeData to window
window.addToQueue = addToQueue;
window.processQueue = processQueue;
window.getAllUsersForAdmin = getAllUsersForAdmin;
window.clearAllCloudData = clearAllCloudData;
window.syncSettingsToCloud = syncSettingsToCloud;
window.pullSettingsFromCloud = pullSettingsFromCloud;
