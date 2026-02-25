import React from 'react';
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
  CalendarX // <--- Ícone adicionado para Absenteísmo
} from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isMockMode } = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  // Lógica de permissão para ver o menu de Absenteísmo
  const canViewAbsenteismo = user?.role === 'MASTER' || user?.role === 'AUXILIAR_RH';

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white/70 backdrop-blur-lg border-r border-white/50 flex flex-col shadow-2xl z-20 relative">
        <div className="p-8 border-b border-slate-200/50">
          <h1 className="text-2xl font-bold tracking-tight text-blue-900">ATS Master</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Recruitment System</p>
          {isMockMode && (
              <div className="mt-2 flex items-center gap-1.5 px-2 py-1 bg-amber-100 text-amber-700 rounded text-[10px] font-bold border border-amber-200">
                  <Database size={12} /> DADOS LOCAIS (PREVIEW)
              </div>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-3 overflow-y-auto">
          <Link to="/" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/') && location.pathname === '/' ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <LayoutDashboard size={20} />
            <span className="font-semibold">Dashboard</span>
          </Link>
          
          <Link to="/jobs" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/jobs') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <Briefcase size={20} />
            <span className="font-semibold">Vagas</span>
          </Link>

          <Link to="/general-interviews" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/general-interviews') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <ClipboardList size={20} />
            <span className="font-semibold">Entrevistas Gerais</span>
          </Link>

          {/* --- NOVO MENU: ABSENTEÍSMO (Com bloqueio de Role) --- */}
          {canViewAbsenteismo && (
            <Link to="/absenteismo" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/absenteismo') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
              <CalendarX size={20} />
              <span className="font-semibold">Absenteísmo</span>
            </Link>
          )}

          <Link to="/talent-pool" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/talent-pool') || isActive('/talents') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <Users size={20} />
            <span className="font-semibold">Banco de Talentos</span>
          </Link>

          <Link to="/reports" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/reports') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <BarChart size={20} />
            <span className="font-semibold">Relatórios & SLA</span>
          </Link>

          <Link to="/strategic-report" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/strategic-report') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <BarChart size={20} />
            <span className="font-semibold">Relatório Estratégico</span>
          </Link>

          <Link to="/settings" className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 ${isActive('/settings') ? 'bg-blue-600/10 text-blue-700 shadow-sm border border-blue-100' : 'text-slate-600 hover:bg-white/50 hover:text-blue-600 hover:shadow-sm'}`}>
            <Settings size={20} />
            <span className="font-semibold">Configurações</span>
          </Link>
        </nav>

        <div className="p-6 border-t border-slate-200/50 bg-white/30 backdrop-blur-sm">
          <div className="flex items-center space-x-3 mb-4">
            <UserCircle className="text-slate-400" size={36} />
            <div>
              <p className="text-sm font-bold text-slate-800">{user?.name}</p>
              {/* Lógica atualizada para refletir corretamente o novo cargo */}
              <p className="text-xs text-slate-500 capitalize font-medium">
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
        
        {/* Mock Mode Banner */}
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
