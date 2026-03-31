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
import { Reunioes } from './pages/Reunioes';
import { Aniversariantes } from './pages/Aniversariantes';
import { Integracao } from './pages/Integracao';
import { Setores } from './pages/Setores';
import { Desligamentos } from './pages/Desligamentos';
import { QuadroPessoal } from './pages/QuadroPessoal'; 
import { GestaoRefeitorio } from './pages/GestaoRefeitorio'; // <--- IMPORTAÇÃO ADICIONADA

// Componente que protege as rotas
const ProtectedRoute = () => {
  const { user } = useData() as any;
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // --- LÓGICA DE ACESSO LEGADO ---
  // Identificamos se o usuário possui um dos cargos "Chumbados" no código
  const role = user.role?.toUpperCase();
  const isMaster = role === 'MASTER';
  const isAuxiliar = role === 'AUXILIAR_RH';
  const isRecepcao = role === 'RECEPCAO';
  const isRecruiter = role === 'RECRUITER';

  // 1. RECEPÇÃO: Acesso estritamente restrito
  const allowedRecepcaoRoutes = ['/', '/aniversariantes'];
  if (isRecepcao && !allowedRecepcaoRoutes.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // 2. AUXILIAR DE RH: Liberado para Dashboard, Gestão, Configurações e Desligamentos
  const allowedAuxiliarRoutes = ['/', '/absenteismo', '/colaboradores', '/reunioes', '/aniversariantes', '/settings', '/setores', '/desligamentos', '/refeitorio'];
  if (isAuxiliar && !allowedAuxiliarRoutes.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // 3. RECRUTADOR PADRÃO: Bloqueado nas páginas profundas de DP/Gestão
  // NOTA: Mudamos a verificação para focar apenas no 'RECRUITER'. 
  // Cargos Dinâmicos/Personalizados passarão por aqui e a segurança será feita dentro da própria página!
  const forbiddenRecruiterRoutes = ['/absenteismo', '/colaboradores', '/setores', '/desligamentos', '/quadro', '/refeitorio']; 
  if (isRecruiter && forbiddenRecruiterRoutes.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // Master e Cargos Personalizados passam por aqui e renderizam a tela!
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
            <Route path="/integracao" element={<Integracao />} />
            <Route path="/absenteismo" element={<Absenteismo />} />
            <Route path="/colaboradores" element={<Colaboradores />} />
            <Route path="/experiencia" element={<Experiencia />} />
            <Route path="/reunioes" element={<Reunioes />} />
            <Route path="/aniversariantes" element={<Aniversariantes />} />
            <Route path="/setores" element={<Setores />} />
            <Route path="/desligamentos" element={<Desligamentos />} />
            <Route path="/quadro" element={<QuadroPessoal />} /> 
            <Route path="/refeitorio" element={<GestaoRefeitorio />} /> {/* <--- ROTA DO REFEITÓRIO ADICIONADA */}

          </Route>

          {/* Rota de Segurança: Se a URL não existir, volta pro Dashboard */}
          <Route path="*" element={<Navigate to="/" replace />} />
          
        </Routes>
      </DataProvider>
    </Router>
  );
};

export default App;