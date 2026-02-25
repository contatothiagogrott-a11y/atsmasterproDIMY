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
  Contact 
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isMockMode } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  // Estado para controlar o menu sanfona
  const [isRecrutamentoOpen, setIsRecrutamentoOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Lógica de permissões refinada
  const isMaster = user?.role === 'MASTER';
  const isAuxiliar = user?.role === 'AUXILIAR_RH';
  
  // O Master vê tudo. O Auxiliar só vê Absenteísmo em "Gestão de Pessoas"
  const canViewAbsenteismo = isMaster || isAuxiliar;
  const canViewColaboradores = isMaster; // <--- Trava: Apenas Master vê a base de colaboradores

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
          {!isAuxiliar && (
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

          {/* === GESTÃO DE PESSOAS === */}
          {(canViewAbsenteismo || canViewColaboradores) && (
            <div className="pt-4 pb-1">
              <span className="px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Gestão de Pessoas</span>
            </div>
          )}

          {canViewColaboradores && (
            <Link to="/colaboradores" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/colaboradores') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600'}`}>
              <Contact size={20} />
              <span className="font-semibold">Colaboradores</span>
            </Link>
          )}

          {canViewAbsenteismo && (
            <Link to="/absenteismo" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/absenteismo') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600'}`}>
              <CalendarX size={20} />
              <span className="font-semibold">Absenteísmo</span>
            </Link>
          )}

          <div className="pt-4 pb-1">
            <span className="px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Sistema</span>
          </div>

          <Link to="/settings" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/settings') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600'}`}>
            <Settings size={20} />
            <span className="font-semibold">Configurações</span>
          </Link>
        </nav>

        <div className="p-6 border-t border-slate-200/50 bg-white/30 backdrop-blur-sm">
          <div className="flex items-center space-x-3 mb-4">
            <UserCircle className="text-slate-400" size={36} />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 capitalize font-medium truncate">
                {user?.role === 'MASTER' ? 'Administrador' : user?.role === 'AUXILIAR_RH' ? 'Auxiliar de RH' : 'Recrutador'}
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