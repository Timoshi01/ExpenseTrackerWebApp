# 🔐 Firebase Integration Guide

This guide explains how to set up and use the new Firebase Cloud Sync features in your Expense Tracker.

## 🚀 Setup Steps

### 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it "Expense Tracker".
3. Disable Google Analytics (optional).

### 2. Enable Google Authentication
1. In the Firebase Sidebar, go to **Build > Authentication**.
2. Click **Get Started**.
3. Go to the **Sign-in method** tab and click **Add new provider**.
4. Select **Google** and enable it.
5. Set your project support email and click **Save**.

### 3. Create Firestore Database
1. Go to **Build > Firestore Database**.
2. Click **Create database**.
3. Choose a location near you.
4. Start in **Production Mode**.
5. Go to the **Rules** tab and paste the contents of `firestore.rules`. Click **Publish**.

### 4. Get Configuration Values
1. Go to **Project Settings** (gear icon) > **General**.
2. Under "Your apps", click the **</> (Web)** icon.
3. Register the app as "Expense Tracker PWA".
4. Copy the `firebaseConfig` object values.
5. Open `firebase-config.js` in your code and replace the placeholders with your actual values.

## 🔄 How Sync Works

This app uses an **Offline-First** strategy:

1. **Local Save First:** When you add/edit/delete an expense, it is immediately saved to your device's IndexedDB.
2. **Background Sync:** If you are logged in and online, the app automatically syncs the change to Firestore.
3. **Sync Queue:** If you are offline, the app stores the change in a queue. It will automatically upload once you come back online.
4. **Cloud Merge:** When you log in on a new device, the app downloads all your expenses and merges them into the local database.

## 📱 Testing Instructions

1. **Test Login:** Go to Settings, click "Sign in with Google". Your email should appear.
2. **Test Online Sync:** Add an expense while online. Check the Firebase Console > Firestore to see the document.
3. **Test Offline Mode:** Turn off your WiFi/Data. Add an expense. You'll see a yellow "Offline" banner. Turn WiFi back on and see it sync!
4. **Test Migration:** If you had expenses before logging in, the app will ask if you want to upload them.

## 🛠️ Troubleshooting

- **"Popup Blocked":** If Google Login doesn't open, check your browser's address bar for a blocked popup icon.
- **"Permission Denied":** Ensure you published the `firestore.rules` and that you are logged in.
- **"Data not appearing":** Check your internet connection. Look for the "Last synced" timestamp in Settings.

## 📂 File Reference

- `firebase-config.js`: Your project credentials.
- `firebase-init.js`: Core initialization and connection monitoring.
- `firebase-auth.js`: Google Login/Logout logic.
- `firebase-sync.js`: The "brain" of the offline-first sync engine.
- `firebase-migration.js`: Helper to move local data to the cloud.
- `firestore.rules`: Security rules for your database.
