import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { DataProvider, useData } from './context/DataContext';
import { Layout } from './components/Layout';

// Importação das Páginas
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Jobs } from './pages/Jobs';
import { JobDetails } from './pages/JobDetails';
import { TalentPool } from './pages/TalentPool';
import { TalentDetails } from './pages/TalentDetails';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { StrategicReport } from './pages/StrategicReport';

// Componente que protege as rotas
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

const App: React.FC = () => {
  return (
    // MUDANÇA CRÍTICA AQUI: O Router fica POR FORA do DataProvider
    <Router>
      <DataProvider>
        <Routes>
          {/* Rota Pública - Login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rotas Protegidas */}
          <Route element={<ProtectedRoute />}>
            
            <Route path="/" element={<Dashboard />} />
            
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            
            <Route path="/talent-pool" element={<TalentPool />} />
            <Route path="/talents/:id" element={<TalentDetails />} />
            
            <Route path="/reports" element={<Reports />} />
            <Route path="/strategic-report" element={<StrategicReport />} />
            
            <Route path="/settings" element={<SettingsPage />} />

          </Route>

          {/* Rota de Segurança */}
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </DataProvider>
    </Router>
  );
};

export default App;
