/**
 * Firebase Configuration for Expense Tracker PWA
 * 
 * To get these values:
 * 1. Go to Firebase Console (https://console.firebase.google.com/)
 * 2. Select your project (or create a new one)
 * 3. Click the 'Web' icon (</>) to add a new app
 * 4. Register the app and you will see the firebaseConfig object
 */

const firebaseConfig = {
  apiKey: "AIzaSyCZ11KCuZgOxHog7XEbVA468zqtbTcoiLU",
  authDomain: "pennypilot-expense-tracker.firebaseapp.com",
  projectId: "pennypilot-expense-tracker",
  storageBucket: "pennypilot-expense-tracker.firebasestorage.app",
  messagingSenderId: "875470610241",
  appId: "1:875470610241:web:09193658429c98b53bcbc0"
};

// Validation to ensure placeholders are replaced
const isPlaceholder = (value) => value.startsWith("YOUR_");
const placeholders = Object.keys(firebaseConfig).filter(key => isPlaceholder(firebaseConfig[key]));

if (placeholders.length > 0) {
  console.error("Firebase Configuration Error: Please replace placeholders in firebase-config.js:", placeholders.join(", "));
}

export { firebaseConfig };
export default firebaseConfig;
