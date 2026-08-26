import { auth, db } from './firebase-init.js';

const ADMIN_EMAIL = 'admin@example.com'; // IMPORTANT: Update this to match your admin email

/**
 * Security: Check if current user is an authorized administrator
 */
function isAdmin() {
  const user = auth.currentUser;
  if (!user || user.email !== ADMIN_EMAIL) {
    console.error("Unauthorized: Admin privileges required.");
    return false;
  }
  return true;
}

/**
 * 1. Get all registered user documents
 */
async function getAllUsers() {
  if (!isAdmin()) return [];
  
  try {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({
      userId: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching all users:", error);
    throw error;
  }
}

/**
 * 2. Get all expenses for a specific user
 */
async function getUserExpenses(userId) {
  if (!isAdmin()) return [];

  try {
    const snapshot = await db.collection('users').doc(userId).collection('expenses').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error(`Error fetching expenses for user ${userId}:`, error);
    throw error;
  }
}

/**
 * 3. Calculate statistics for a specific user
 */
async function getUserStats(userId) {
  if (!isAdmin()) return null;

  try {
    const expenses = await getUserExpenses(userId);
    if (expenses.length === 0) {
      return { totalExpenses: 0, totalSpent: 0, averageSpent: 0, topCategory: 'N/A' };
    }

    const totalSpent = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
    const totalExpenses = expenses.length;
    const averageSpent = totalSpent / totalExpenses;

    // Calculate top category
    const categoryMap = {};
    expenses.forEach(exp => {
      categoryMap[exp.category] = (categoryMap[exp.category] || 0) + exp.amount;
    });

    let topCategory = 'N/A';
    let maxSpent = 0;
    for (const cat in categoryMap) {
      if (categoryMap[cat] > maxSpent) {
        maxSpent = categoryMap[cat];
        topCategory = cat;
      }
    }

    return {
      totalExpenses,
      totalSpent,
      averageSpent,
      topCategory
    };
  } catch (error) {
    console.error(`Error calculating stats for user ${userId}:`, error);
    throw error;
  }
}

/**
 * 4. Get all users combined with their stats (Global Overview)
 */
async function getAllUsersWithStats() {
  if (!isAdmin()) return [];

  try {
    const users = await getAllUsers();
    const results = [];

    for (const user of users) {
      const stats = await getUserStats(user.userId);
      results.push({
        ...user,
        stats
      });
    }

    return results;
  } catch (error) {
    console.error("Error fetching users with stats:", error);
    throw error;
  }
}

/**
 * 5. Delete user document and all sub-collection data
 */
async function deleteUserAndData(userId) {
  if (!isAdmin()) return false;

  try {
    console.log(`Starting deletion for user: ${userId}`);
    
    // Deleting sub-collections in Firestore requires manual iteration
    const expensesRef = db.collection('users').doc(userId).collection('expenses');
    const snapshot = await expensesRef.get();
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // Delete the root user document
    batch.delete(db.collection('users').doc(userId));
    
    await batch.commit();
    console.log(`Successfully deleted user ${userId} and all associated data.`);
    return true;
  } catch (error) {
    console.error(`Failed to delete user ${userId}:`, error);
    throw error;
  }
}

/**
 * 6. Generate CSV string for a user's data
 */
async function exportUserDataCSV(userId) {
  if (!isAdmin()) return "";

  try {
    const expenses = await getUserExpenses(userId);
    if (expenses.length === 0) return "No data available";

    const header = "Date,Category,Amount,Note,ID\n";
    const rows = expenses.map(e => {
      return `${e.date},${e.category},${e.amount},"${e.note || ''}",${e.id}`;
    }).join("\n");

    return header + rows;
  } catch (error) {
    console.error(`Error exporting CSV for user ${userId}:`, error);
    throw error;
  }
}

export {
  getAllUsers,
  getUserExpenses,
  getUserStats,
  getAllUsersWithStats,
  deleteUserAndData,
  exportUserDataCSV
};

// Expose to window for debugging/dashboard script use
window.QueryHelper = {
  getAllUsers,
  getUserExpenses,
  getUserStats,
  getAllUsersWithStats,
  deleteUserAndData,
  exportUserDataCSV
};
