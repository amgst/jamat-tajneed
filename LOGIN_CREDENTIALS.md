# 🔐 Login Credentials for Jamaat Ahmadiyya Muridke Membership System

## Development Mode Credentials

For testing the application, use these credentials:

**Email:** `admin@jamaatahmadiyya.org`  
**Password:** `admin123`

## Features Available After Login

### 📊 Dashboard
- Member statistics and charts
- Family overview
- Tanzeem distribution
- Quick access to all modules

### 👥 Members Management
- Add/Edit/Delete members
- Search and filter members
- View member details with Tanzeem classification
- Export member lists

### 👪 Families Management
- Group members into families
- Assign family heads
- View family statistics

### 🏷️ Tanzeem View
- View members by Tanzeem categories:
  - **Boys**: Saf-e-Awal (Under 7), Atfal (7-15), Khuddam (15-40), Ansar (40+)
  - **Girls**: Nasirat (7-15), Lajna (15+)

### ⚙️ Settings
- System configuration
- Data import/export options

## Note
This is currently running in **development mode** with mock authentication. The credentials are displayed on the login page for convenience.

To set up real Firebase authentication, update the Firebase configuration in `src/services/firebase.ts` with your Firebase project credentials.
