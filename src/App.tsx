import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './contexts/useAuth';
import AppLayout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Families from './pages/Families';
import FamilyDetails from './pages/FamilyDetails';
import MemberDetails from './pages/MemberDetails';
import TanzeemView from './pages/TanzeemView';
import ReligiousActivitiesPage from './pages/ReligiousActivities';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import ImportData from './ImportAllData';
import MembersJsonView from './pages/MembersJsonView';
import WaqfJadeed from './pages/WaqfJadeed';

// Set this to true to run the data import script
const runImporter = false;

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public Route component (redirect to dashboard if already logged in)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  // If the runImporter flag is true, render the import component directly
  if (runImporter) {
    return (
      <div style={{ padding: '24px' }}>
        <ImportData />
      </div>
    );
  }

  // Otherwise, render the main application
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AuthProvider>
        <Router>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="members" element={<Members />} />
              <Route path="members/:slugId" element={<MemberDetails />} />
              <Route path="families" element={<Families />} />
              <Route path="families/:id" element={<FamilyDetails />} />
              <Route path="tanzeem" element={<TanzeemView />} />
              <Route path="religious-activities" element={<ReligiousActivitiesPage />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="members-json" element={<MembersJsonView />} />
              <Route path="waqf-jadeed" element={<WaqfJadeed />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
