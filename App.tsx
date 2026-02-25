import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'; 
import { DataProvider, useData } from './context/DataContext';
import { Layout } from './components/Layout';

// Importação das Páginas
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { GeneralInterviews } from './pages/GeneralInterviews';
import { Jobs } from './pages/Jobs';
import { JobDetails } from './pages/JobDetails';
import { TalentPool } from './pages/TalentPool';
import { TalentDetails } from './pages/TalentDetails';
import { Reports } from './pages/Reports';
import { SettingsPage } from './pages/Settings';
import { StrategicReport } from './pages/StrategicReport';
import { Absenteismo } from './pages/Absenteismo'; 
import { Colaboradores } from './pages/Colaboradores'; // <--- 1. IMPORTADO AQUI

// Componente que protege as rotas
const ProtectedRoute = () => {
  const { user } = useData();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // --- BLOQUEIO DE URL PARA AUXILIAR DE RH ---
  const isAuxiliar = user.role === 'AUXILIAR_RH';
  
  // 2. ADICIONADO '/colaboradores' na lista de permissões do auxiliar
  const allowedAuxiliarRoutes = ['/absenteismo', '/settings', '/colaboradores'];
  
  if (isAuxiliar && !allowedAuxiliarRoutes.includes(location.pathname)) {
    return <Navigate to="/absenteismo" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <DataProvider>
        <Routes>
          {/* Rota Pública - Login */}
          <Route path="/login" element={<Login />} />
          
          {/* Rotas Protegidas */}
          <Route element={<ProtectedRoute />}>
            
            <Route path="/" element={<Dashboard />} />
            <Route path="/general-interviews" element={<GeneralInterviews />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:id" element={<JobDetails />} />
            <Route path="/talent-pool" element={<TalentPool />} />
            <Route path="/talents/:id" element={<TalentDetails />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/strategic-report" element={<StrategicReport />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/absenteismo" element={<Absenteismo />} />

            {/* --- 3. NOVA ROTA: COLABORADORES --- */}
            <Route path="/colaboradores" element={<Colaboradores />} />

          </Route>

          {/* Rota de Segurança */}
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </DataProvider>
    </Router>
  );
};

export default App;