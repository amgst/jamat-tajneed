# 🔥 Firebase Emulator Setup & Data Sync Guide

## Overview
This guide explains how to set up Firebase emulators for local development and sync data between local and production environments.

## 🚀 Quick Start

### 1. Start Firebase Emulator
```bash
# Start emulator without data
npm run emulator

# Start emulator with existing data
npm run emulator:import
```

### 2. Import Data to Emulator
```bash
# Import JSON data to running emulator
npm run import-data
```

### 3. Access Emulator UI
- **Firestore UI**: http://localhost:4000/firestore
- **Full Emulator UI**: http://localhost:4000

## 📁 File Structure

```
├── firebase.json              # Firebase configuration
├── firestore.rules           # Firestore security rules
├── firebase-export.json      # Raw JSON data export
├── firebase-export/          # Proper Firebase export directory
├── import-data.js            # Script to import JSON to emulator
├── sync-to-production.js     # Script to sync local → production
└── .env                      # Environment variables
```

## 🔄 Data Sync Methods

### Method 1: Automated Sync Script (Recommended)
```bash
npm run sync-to-prod
```
This script copies all data from local emulator to production Firebase.

### Method 2: Firebase CLI Export/Import
```bash
# Export from emulator
firebase emulators:export ./production-backup

# Import to production (⚠️ This will overwrite production data)
firebase firestore:delete --all-collections --project jamat-tajneed-44f6d
firebase firestore:import ./production-backup --project jamat-tajneed-44f6d
```

### Method 3: Toggle Between Emulator/Production
Edit `.env` file:
```bash
# Use emulator
VITE_USE_EMULATOR=true

# Use production
VITE_USE_EMULATOR=false
```

## ⚙️ Configuration Files

### firebase.json
```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

### .env
```bash
# Set to 'true' to use emulator, 'false' for production
VITE_USE_EMULATOR=true
```

## 📊 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Start Emulator | `npm run emulator` | Start Firebase emulator |
| Start with Data | `npm run emulator:import` | Start emulator with existing export |
| Import Data | `npm run import-data` | Import JSON data to running emulator |
| Sync to Production | `npm run sync-to-prod` | Copy local data to production |

## 🔒 Security Rules

The `firestore.rules` file contains security rules for Firestore:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // 🔓 open (dev only)
    }
  }
}
```

**⚠️ Warning**: Current rules allow all read/write access. Update for production use.

## 🚨 Important Notes

1. **Data Safety**: Always backup production data before syncing
2. **Environment**: Ensure `VITE_USE_EMULATOR` is set correctly
3. **Emulator Running**: Emulator must be running before importing data
4. **Project ID**: Scripts use project ID `jamat-tajneed-44f6d`

## 🐛 Troubleshooting

### Emulator Won't Start
- Check if ports 4000 and 8080 are available
- Restart terminal and try again

### Data Not Visible
- Verify emulator is running: http://localhost:4000
- Check console for connection errors
- Ensure correct project ID in scripts

### Import Fails
- Confirm emulator is running before import
- Check `firebase-export.json` file exists
- Verify JSON format is valid

### Sync to Production Fails
- Check internet connection
- Verify Firebase project permissions
- Ensure production Firebase project is accessible

## 📝 Data Structure

### Members Collection
```typescript
interface Member {
  id: string;
  name: string;
  fatherName: string;
  gender: 'male' | 'female';
  dateOfBirth: string;
  age: number;
  tanzeem: string;
  familyId: string;
  // ... other fields
}
```

### Families Collection
```typescript
interface Family {
  id: string;
  familyName: string;
  headId: string;
  memberIds: string[];
  totalMembers: number;
  halqa: string;
  // ... other fields
}
```

## 🔄 Workflow

1. **Development**: Work with emulator (`VITE_USE_EMULATOR=true`)
2. **Testing**: Import/export data as needed
3. **Production**: Sync data when ready (`npm run sync-to-prod`)
4. **Deployment**: Switch to production (`VITE_USE_EMULATOR=false`)

---

**Last Updated**: January 2025  
**Version**: 1.0