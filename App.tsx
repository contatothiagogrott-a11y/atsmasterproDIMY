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
import { Colaboradores } from './pages/Colaboradores';
import { Experiencia } from './pages/Experiencia';

// Componente que protege as rotas
const ProtectedRoute = () => {
  const { user } = useData();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = user.role?.toUpperCase();
  const isMaster = role === 'MASTER';
  const isAuxiliar = role === 'AUXILIAR_RH';

  // --- LÓGICA DE ACESSO ---

  // 1. Se for Auxiliar, restringir às rotas específicas dele
  const allowedAuxiliarRoutes = ['/absenteismo', '/settings', '/colaboradores'];
  if (isAuxiliar && !allowedAuxiliarRoutes.includes(location.pathname)) {
    return <Navigate to="/absenteismo" replace />;
  }

  // 2. Se for Recrutador (nem Master, nem Auxiliar), bloquear páginas de Gestão
  const forbiddenRecruiterRoutes = ['/absenteismo', '/colaboradores'];
  if (!isMaster && !isAuxiliar && forbiddenRecruiterRoutes.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // Master passa por aqui sem cair em nenhum IF acima, tendo acesso total.
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
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/experiencia" element={<Experiencia />} />

          </Route>

          {/* Rota de Segurança */}
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </DataProvider>
    </Router>
  );
};

export default App;