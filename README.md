# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# Tajneed Admin Dashboard - Jamaat Ahmadiyya Muridke

A comprehensive membership management system for Jamaat Ahmadiyya Muridke built with React TypeScript and Firebase.

## Features

### 🧍 Member Registration & Listing
- Complete member registration form with all required fields
- Auto-calculation of age from date of birth
- Auto-assignment to appropriate Tanzeem based on age and gender
- Profile photo upload support
- Searchable and filterable member listing

### 👪 Family Grouping
- Create and manage family groups
- Assign family head (Father/Guardian)
- View family members and statistics
- Family-wise reporting

### 📊 Dashboard Summary
- Real-time statistics and analytics
- Member distribution charts
- Tanzeem-wise breakdown
- Progress tracking and metrics

### 🏛️ Tanzeem Management
**Boys:**
- Under 7: Saf-e-Awal
- 7-15: Atfal
- 15-40: Khuddam
- 40+: Ansar

**Girls:**
- 7-15: Nasirat
- 15+: Lajna

### 🔍 Advanced Search & Filtering
- Search by name, phone, CNIC, or any field
- Filter by gender, age, Tanzeem, Halqa
- Real-time search results

### 📥 Import/Export Features
- CSV import with data validation
- Export member lists and reports
- Sample CSV format download
- Bulk data operations

### 🛡️ Authentication & Security
- Admin-only access with email/password
- Firebase Authentication integration
- Protected routes and sessions

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI Library:** Ant Design (complete component library)
- **Backend:** Firebase (Authentication + Firestore)
- **Charts:** @ant-design/charts
- **Routing:** React Router DOM
- **Date Handling:** Day.js
- **CSV Processing:** PapaParse

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Layout.tsx      # Main app layout with sidebar
├── pages/              # Page components
│   ├── Dashboard.tsx   # Analytics dashboard
│   ├── Members.tsx     # Member management
│   ├── Families.tsx    # Family management
│   ├── TanzeemView.tsx # Tanzeem-wise views
│   ├── Settings.tsx    # System settings
│   └── Login.tsx       # Authentication
├── contexts/           # React contexts
│   ├── AuthContext.tsx # Authentication context
│   └── useAuth.ts      # Auth hook
├── services/           # API services
│   └── firebase.ts     # Firebase configuration
├── types/              # TypeScript type definitions
│   └── index.ts        # All interfaces and types
├── utils/              # Utility functions
│   └── helpers.ts      # Helper functions
└── App.tsx             # Main app component
```

## Installation & Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create a new Firebase project
   - Enable Authentication (Email/Password)
   - Create a Firestore database
   - Update `src/services/firebase.ts` with your Firebase config

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Firebase Configuration

Update the Firebase configuration in `src/services/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};
```

## Usage

1. **Login:** Use admin credentials to access the system
2. **Add Members:** Use the Members page to register new members
3. **Manage Families:** Group members into families
4. **View Analytics:** Check dashboard for statistics and charts
5. **Import Data:** Use CSV import for bulk member registration
6. **Export Reports:** Generate CSV reports for external use

## Tanzeem Classification Rules

The system automatically assigns members to appropriate Tanzeem based on:

- **Boys:**
  - Under 7 years: Saf-e-Awal
  - 7-15 years: Atfal
  - 15-40 years: Khuddam
  - 40+ years: Ansar

- **Girls:**
  - Under 7 years: Not Applicable
  - 7-15 years: Nasirat
  - 15+ years: Lajna

## Data Validation

- **CNIC:** Must be 13 digits
- **Phone:** 10-15 digits
- **Age:** Auto-calculated from date of birth
- **Required Fields:** Name, Father Name, Gender, CNIC, DOB, Phone, Address

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, contact the development team.

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
