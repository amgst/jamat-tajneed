# Tajneed Admin Dashboard - Jamaat Ahmadiyya Muridke

A comprehensive membership management system for Jamaat Ahmadiyya Muridke built with React TypeScript and Firebase.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start Firebase emulator
npm run emulator

# Import data to emulator
npm run import-data
```

## 📚 Documentation

- **[Firebase Emulator Guide](./FIREBASE_EMULATOR_GUIDE.md)** - Complete guide for local development and data sync
- **[Login Credentials](./LOGIN_CREDENTIALS.md)** - Development login information
- **[Firebase Setup](./FIREBASE_SETUP.md)** - Firebase configuration guide

## 🔧 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| Development | `npm run dev` | Start React development server |
| Build | `npm run build` | Build for production |
| Emulator | `npm run emulator` | Start Firebase emulator |
| Import Data | `npm run import-data` | Import JSON data to emulator |
| Sync Production | `npm run sync-to-prod` | Sync local data to production |

## 🏗️ Features

### 🧍 Member Management
- Complete member registration with auto-age calculation
- Auto-assignment to appropriate Tanzeem
- Profile photo upload support
- Advanced search and filtering

### 👪 Family Grouping
- Create and manage family groups
- Assign family heads
- Family-wise reporting and statistics

### 📊 Dashboard Analytics
- Real-time statistics and charts
- Member distribution by Tanzeem
- Progress tracking and metrics

### 🏛️ Tanzeem Classification
**Boys:**
- Under 7: Saf-e-Awal
- 7-15: Atfal  
- 15-40: Khuddam
- 40+: Ansar

**Girls:**
- 7-15: Nasirat
- 15+: Lajna

### 📥 Import/Export
- CSV import with validation
- Export reports and member lists
- Bulk data operations

## 🛠️ Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI Library:** Ant Design
- **Backend:** Firebase (Auth + Firestore)
- **Charts:** @ant-design/charts
- **Routing:** React Router DOM
- **Internationalization:** i18next

## 🔧 Development Setup

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd jamat-tajneed
   npm install
   ```

2. **Configure Firebase:**
   - Update `src/services/firebase.ts` with your Firebase config
   - See [Firebase Setup Guide](./FIREBASE_SETUP.md)

3. **Start development:**
   ```bash
   npm run emulator    # Start Firebase emulator
   npm run import-data # Import sample data
   npm run dev         # Start React app
   ```

## 🌐 Environment Configuration

Create `.env` file:
```bash
# Set to 'true' for emulator, 'false' for production
VITE_USE_EMULATOR=true
```

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Page components
├── contexts/           # React contexts
├── services/           # API services
├── types/              # TypeScript definitions
├── utils/              # Utility functions
└── App.tsx             # Main app component
```

## 🔒 Authentication

Currently using mock authentication for development. See [Login Credentials](./LOGIN_CREDENTIALS.md) for access details.

## 🚀 Deployment

1. **Build for production:**
   ```bash
   npm run build
   ```

2. **Deploy to Firebase:**
   ```bash
   firebase deploy
   ```

3. **Sync data to production:**
   ```bash
   npm run sync-to-prod
   ```

## 📊 Data Management

- **Local Development:** Use Firebase emulator
- **Data Import:** JSON to emulator via `npm run import-data`
- **Production Sync:** Local to production via `npm run sync-to-prod`
- **Backup:** Export emulator data via Firebase CLI

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with emulator
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check [Firebase Emulator Guide](./FIREBASE_EMULATOR_GUIDE.md)
2. Review [troubleshooting section](./FIREBASE_EMULATOR_GUIDE.md#-troubleshooting)
3. Contact development team

---

**Last Updated:** January 2025