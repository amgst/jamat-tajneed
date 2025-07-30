# Firebase Setup Instructions

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Enter project name: `jamaat-ahmadiyya-muridke`
4. Follow the setup wizard

## 2. Enable Authentication

1. In your Firebase project, go to "Authentication"
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable "Email/Password" provider

## 3. Create Firestore Database

1. Go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (for development)
4. Select your preferred location

## 4. Get Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps"
3. Click "Web" icon to add a web app
4. Register your app with name: "Tajneed Admin Dashboard"
5. Copy the configuration object

## 5. Update Configuration

Replace the Firebase config in `src/services/firebase.ts`:

```javascript
const firebaseConfig = {
  apiKey: "your-api-key-here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};
```

## 6. Create Admin User

1. Go to Authentication > Users
2. Click "Add user"
3. Enter email: `admin@jaamatmuridke.org`
4. Enter a secure password
5. Save the user

## 7. Security Rules (Optional for Production)

For production, update Firestore rules in the Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 8. Test the Application

1. Run `npm run dev`
2. Navigate to `http://localhost:5173`
3. Login with your admin credentials
4. Start adding members!

## Notes

- Keep your Firebase configuration secure
- For production deployment, set up proper security rules
- Consider enabling backup and monitoring features in Firebase Console
