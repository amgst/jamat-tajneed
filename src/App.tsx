import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
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

import MembersJsonView from './pages/MembersJsonView';
import WaqfJadeed from './pages/WaqfJadeed';
import Ansarullah from './pages/Ansarullah';
import TahreqJadeed from './pages/TahreqJadeed';
import Graveyard from './pages/Graveyard';
import FinancialReportsPage from './pages/FinancialReportsPage';
import Tools from './pages/Tools';
import ZakatCalculator from './pages/ZakatCalculator';
import WaqfeNau from './pages/Reports/WaqfeNau';
import Mossi from './pages/Reports/Mossi';

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

const appTheme = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
  },
};

function App() {
  // Otherwise, render the main application
  return (
    <ConfigProvider theme={appTheme}>
      <AntdApp>
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
                <Route path="ansar-uallah" element={<Ansarullah />} />
                <Route path="tahreq-jadeed" element={<TahreqJadeed />} />
                <Route path="graveyard" element={<Graveyard />} />
                <Route path="financial-reports" element={<FinancialReportsPage />} />
                <Route path="reports/waqfe-nau" element={<WaqfeNau />} />
                <Route path="reports/mossi" element={<Mossi />} />
                <Route path="tools" element={<Tools />} />
                <Route path="tools/zakat-calculator" element={<ZakatCalculator />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;