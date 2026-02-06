import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetails } from './pages/JobDetails';
import { TalentPool } from './pages/TalentPool';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';

const ProtectedRoute = () => {
  const { user } = useData();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

// MUDANÇA 1: Tirei o <Router> daqui de dentro.
// Agora esse componente só devolve as Rotas puras.
const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/:id" element={<JobDetails />} />
        <Route path="/talent" element={<TalentPool />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

const App: React.FC = () => {
  return (
    // MUDANÇA 2: O Router agora é o Pai de Todos!
    // Ele precisa estar aqui fora para o DataProvider (que usa useLocation) funcionar.
    <Router>
      <DataProvider>
        <AppRoutes />
      </DataProvider>
    </Router>
  );
};

export default App;
