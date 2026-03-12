import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  LayoutDashboard, 
  Briefcase, 
  Users, 
  BarChart, 
  Settings, 
  LogOut, 
  UserCircle,
  Database,
  ClipboardList,
  CalendarX,
  ChevronDown,
  ChevronRight,
  Contact,
  CalendarClock,
  Coffee,
  Gift,
  UserPlus
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isMockMode } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const [isRecrutamentoOpen, setIsRecrutamentoOpen] = useState(true);
  const [isGestaoOpen, setIsGestaoOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // --- REGRAS DE PERMISSÃO ---
  const isMaster = user?.role === 'MASTER';
  const isAuxiliar = user?.role === 'AUXILIAR_RH';
  const isRecruiter = user?.role === 'RECRUITER';
  const isRecepcao = user?.role === 'RECEPCAO'; 
  
  const canViewRecrutamento = isMaster || isRecruiter; 
  const canViewAbsenteismo = isMaster || isAuxiliar;
  const canViewColaboradores = isMaster; 
  
  // AQUI FOI A ALTERAÇÃO: MASTER e RECRUTADOR podem ver!
  const canViewExperiencia = isMaster || isRecruiter; 
  
  // Reuniões: Todas as contas MENOS a Recepção
  const canViewReunioes = !isRecepcao; 
  
  // Aniversariantes: TODAS as contas (inclusive Recepção)
  const canViewAniversariantes = true; 

  // Configurações: Todas MENOS a Recepção
  const canViewSettings = !isRecepcao;

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white/70 backdrop-blur-lg border-r border-white/50 flex flex-col shadow-2xl z-20 relative">
        <div className="p-8 border-b border-slate-200/50">
          <h1 className="text-2xl font-bold tracking-tight text-blue-900">ATS Master</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">HR & Recruitment</p>
          {isMockMode && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                  <Database size={12} /> DADOS LOCAIS (PREVIEW)
              </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          
          <Link to="/" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/') && location.pathname === '/' ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600'}`}>
            <LayoutDashboard size={20} />
            <span className="font-semibold">Dashboard</span>
          </Link>

          {/* === MENU EXPANSÍVEL: RECRUTAMENTO E SELEÇÃO === */}
          {canViewRecrutamento && (
            <div className="pt-2 pb-1">
              <button 
                onClick={() => setIsRecrutamentoOpen(!isRecrutamentoOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-slate-400 hover:text-blue-600 transition-colors"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Recrutamento e Seleção</span>
                {isRecrutamentoOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
              
              {isRecrutamentoOpen && (
                <div className="mt-1 space-y-1 border-l-2 border-slate-100 ml-4 pl-2">
                  <Link to="/jobs" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/jobs') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                    <Briefcase size={18} />
                    <span>Vagas</span>
                  </Link>

                  <Link to="/general-interviews" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/general-interviews') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                    <ClipboardList size={18} />
                    <span>Entrevistas Gerais</span>
                  </Link>

                  <Link to="/talent-pool" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/talent-pool') || isActive('/talents') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                    <Users size={18} />
                    <span>Banco de Talentos</span>
                  </Link>

                  <Link to="/integracao" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/integracao') ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-emerald-600 text-sm'}`}>
                    <UserPlus size={18} />
                    <span>Integração (Admissão)</span>
                  </Link>

                  <Link to="/reports" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/reports') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                    <BarChart size={18} />
                    <span>Relatórios & SLA</span>
                  </Link>

                  <Link to="/strategic-report" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/strategic-report') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                    <BarChart size={18} />
                    <span>Relatório Estratégico</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* === MENU EXPANSÍVEL: GESTÃO DE PESSOAS === */}
          {(canViewAbsenteismo || canViewColaboradores || canViewExperiencia || canViewReunioes || canViewAniversariantes) && (
            <div className="pt-2 pb-1">
              <button 
                onClick={() => setIsGestaoOpen(!isGestaoOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-slate-400 hover:text-blue-600 transition-colors"
              >
                <span className="text-xs font-bold uppercase tracking-wider">Gestão de Pessoas</span>
                {isGestaoOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {isGestaoOpen && (
                <div className="mt-1 space-y-1 border-l-2 border-slate-100 ml-4 pl-2">
                  
                  {canViewColaboradores && (
                    <Link to="/colaboradores" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/colaboradores') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                      <Contact size={18} />
                      <span>Colaboradores</span>
                    </Link>
                  )}

                  {canViewAniversariantes && (
                    <Link to="/aniversariantes" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/aniversariantes') ? 'bg-pink-50 text-pink-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-pink-600 text-sm'}`}>
                      <Gift size={18} />
                      <span>Aniversariantes</span>
                    </Link>
                  )}

                  {canViewAbsenteismo && (
                    <Link to="/absenteismo" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/absenteismo') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                      <CalendarX size={18} />
                      <span>Absenteísmo</span>
                    </Link>
                  )}

                  {canViewExperiencia && (
                    <Link to="/experiencia" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/experiencia') ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-blue-600 text-sm'}`}>
                      <CalendarClock size={18} />
                      <span>Acomp. de Experiência</span>
                    </Link>
                  )}

                  {canViewReunioes && (
                    <Link to="/reunioes" className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-300 ${isActive('/reunioes') ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-slate-600 hover:bg-slate-100 hover:text-orange-600 text-sm'}`}>
                      <Coffee size={18} />
                      <span>Cafés e Reuniões</span>
                    </Link>
                  )}

                </div>
              )}
            </div>
          )}

          {/* SÓ MOSTRA CONFIGURAÇÕES SE NÃO FOR RECEPÇÃO */}
          {canViewSettings && (
            <>
              <div className="pt-4 pb-1">
                <span className="px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Sistema</span>
              </div>
              <Link to="/settings" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/settings') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600'}`}>
                <Settings size={20} />
                <span className="font-semibold">Configurações</span>
              </Link>
            </>
          )}
        </nav>

        <div className="p-6 border-t border-slate-200/50 bg-white/30 backdrop-blur-sm">
          <div className="flex items-center space-x-3 mb-4">
            <UserCircle className="text-slate-400" size={36} />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize font-medium truncate">
                {user?.role === 'MASTER' ? 'Administrador' : user?.role === 'AUXILIAR_RH' ? 'Auxiliar de RH' : user?.role === 'RECEPCAO' ? 'Recepção' : 'Recrutador'}
              </p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-100 hover:text-red-600 text-slate-600 py-2.5 rounded-lg transition-all text-sm font-semibold shadow-sm"
          >
            <LogOut size={16} />
            <span>Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50 relative">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none"></div>
        {isMockMode && (
          <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-4 py-2 text-xs font-bold text-center relative z-20">
              ⚠ MODO DE VISUALIZAÇÃO: Conexão com banco de dados falhou. Exibindo dados de exemplo locais. Alterações não serão salvas.
          </div>
        )}
        <div className="p-8 max-w-[1600px] mx-auto relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
};