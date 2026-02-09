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
import { TalentDetails } from './pages/TalentDetails'; // A página de edição
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { StrategicReport } from './pages/StrategicReport';

// Componente que protege as rotas (Só deixa passar se tiver logado)
const ProtectedRoute = () => {
  const { user } = useData();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return (
    <Layout>
      {/* Outlet é onde o conteúdo das páginas (Jobs, Dashboard, etc) será renderizado */}
      <Outlet />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <DataProvider>
      <Router>
        <Routes>
          {/* Rota Pública - Login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rotas Protegidas (Dentro do Layout com Menu) */}
          <Route element={<ProtectedRoute />}>
            
            {/* Dashboard / Home */}
            <Route path="/" element={<Dashboard />} />
            
            {/* Vagas */}
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            
            {/* Banco de Talentos (Padronizado para /talent-pool) */}
            <Route path="/talent-pool" element={<TalentPool />} />
            <Route path="/talents/:id" element={<TalentDetails />} />
            
            {/* Relatórios */}
            <Route path="/reports" element={<Reports />} />
            <Route path="/strategic-report" element={<StrategicReport />} />
            
            {/* Configurações */}
            <Route path="/settings" element={<SettingsPage />} />

          </Route>

          {/* Rota de Segurança: Qualquer endereço desconhecido volta para a Home */}
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </Router>
    </DataProvider>
  );
};

export default App;
