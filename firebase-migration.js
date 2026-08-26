import { auth, db } from './firebase-init.js';
import { createOrUpdateUserDocument } from './firebase-auth.js';
import { pullFromCloud, syncExpenseToCloud } from './firebase-sync.js';

/**
 * Advanced Migration Utility with Deduplication and Retries
 */
async function checkAndMigrateData() {
  const user = auth.currentUser;
  if (!user || !navigator.onLine) return;

  const userId = user.uid;
  const migrationFlag = `migrated_${userId}`;

  // 1. Skip if already migrated
  if (localStorage.getItem(migrationFlag) === 'true') {
    console.log("Migration: Data already migrated for this user.");
    return;
  }

  // 2. Verify window.getAllExpenses is available (from app.js)
  if (!window.getAllExpenses) {
    console.warn("Migration: skipped, window.getAllExpenses not found.");
    return;
  }

  try {
    const localExpenses = await window.getAllExpenses();
    if (localExpenses.length === 0) {
      console.log("Migration: No local data to migrate.");
      localStorage.setItem(migrationFlag, 'true');
      return;
    }

    const confirmMigration = confirm(`Cloud Sync: We found ${localExpenses.length} local expenses. Would you like to back them up to your Google Account?`);
    if (!confirmMigration) {
      console.log("Migration: User declined.");
      return;
    }

    console.log("Migration: Starting process...");
    
    // 3. Ensure User Document exists first
    await createOrUpdateUserDocument(user);

    // 4. Fetch cloud data for deduplication
    const cloudExpenses = await pullFromCloud();
    const cloudKeys = new Set(cloudExpenses.map(ce => `${ce.amount}_${ce.date}_${ce.category}`));

    let successCount = 0;
    let skipCount = 0;
    let failCount = 0;
    const total = localExpenses.length;

    for (let i = 0; i < total; i++) {
      const expense = localExpenses[i];
      const key = `${expense.amount}_${expense.date}_${expense.category}`;

      if (cloudKeys.has(key)) {
        skipCount++;
        console.log(`Migration [${i + 1}/${total}]: Skipping duplicate expense.`);
        continue;
      }

      const success = await uploadWithRetry(expense, 3);
      if (success) {
        successCount++;
        console.log(`Migration [${i + 1}/${total}]: Uploaded successfully.`);
      } else {
        failCount++;
        console.error(`Migration [${i + 1}/${total}]: Failed after retries.`);
      }
    }

    // 5. Final Report
    console.log(`Migration Complete: ${successCount} uploaded, ${skipCount} skipped, ${failCount} failed.`);
    
    if (failCount === 0) {
      localStorage.setItem(migrationFlag, 'true');
      alert(`Migration successful! ✨\nSynced: ${successCount}\nDuplicates skipped: ${skipCount}`);
    } else {
      alert(`Migration partially complete.\nSynced: ${successCount}\nFailed: ${failCount}\nWe will try again next time.`);
    }

  } catch (error) {
    console.error("Migration error:", error);
  }
}

/**
 * Helper: Upload with simple retry logic
 */
async function uploadWithRetry(expense, retries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await syncExpenseToCloud(expense);
      return true;
    } catch (err) {
      console.warn(`Upload attempt ${attempt} failed. Retrying...`);
      if (attempt === retries) return false;
      // Exponential backoff
      await new Promise(res => setTimeout(res, 1000 * attempt));
    }
  }
  return false;
}

export { checkAndMigrateData };
window.checkAndMigrateData = checkAndMigrateData;
