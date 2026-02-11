import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  AlertTriangle, CalendarDays, UserCheck, Search, X, Lock, Unlock, 
  ExternalLink, Target, Clock, AlertCircle
} from 'lucide-react';
import { parseISO, addDays, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type DrillDownType = 'PENDING_CANDIDATES' | 'OLD_JOBS' | 'UPCOMING_ONBOARDINGS' | null;

export const Dashboard: React.FC = () => {
  const { jobs, candidates, settings, user } = useData();
  const navigate = useNavigate();
  
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showConfidential, setShowConfidential] = useState(false);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);

  // --- 1. FILTRAGEM BASE DE ACESSO ---
  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some(j => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const { fJobs, fCandidates } = useMemo(() => {
    let filteredJobs = jobs.filter(j => !j.isHidden);
    
    // Confidencialidade
    filteredJobs = filteredJobs.filter(j => {
        if (!j.isConfidential) return true;
        if (!user) return false;
        return user.role === 'MASTER' || j.createdBy === user.id || j.allowedUserIds?.includes(user.id);
    });
    if (!showConfidential) filteredJobs = filteredJobs.filter(j => !j.isConfidential);

    // Setor e Unidade
    if (sectorFilter) filteredJobs = filteredJobs.filter(j => j.sector === sectorFilter);
    if (unitFilter) filteredJobs = filteredJobs.filter(j => j.unit === unitFilter);

    // Candidatos das vagas filtradas + Pool Geral
    const jobIds = new Set(filteredJobs.map(j => j.id));
    const filteredCandidates = candidates.filter(c => {
        const isGeneral = c.jobId === 'general' && !sectorFilter && !unitFilter;
        return jobIds.has(c.jobId) || isGeneral;
    });
    
    return { fJobs: filteredJobs, fCandidates: filteredCandidates };
  }, [jobs, candidates, sectorFilter, unitFilter, showConfidential, user]);

  // --- 2. LÓGICAS DOS ALERTAS (O CORAÇÃO DO NOVO DASHBOARD) ---

  // Alerta 1: Candidatos pendentes (Não aprovados, não reprovados, não desistentes e não contratados)
  const pendingCandidates = useMemo(() => {
      return fCandidates.filter(c => 
          !['Aprovado', 'Reprovado', 'Desistência', 'Contratado'].includes(c.status)
      );
  }, [fCandidates]);

  // Alerta 2: Vagas Abertas Antigas (> 30 dias)
  const oldOpenJobs = useMemo(() => {
      const today = new Date();
      const thirtyDaysAgo = addDays(today, -30);
      return fJobs.filter(j => {
          return j.status === 'Aberta' && new Date(j.openedAt) < thirtyDaysAgo;
      });
  }, [fJobs]);

  // Alerta 3: Integrações Próximas (Contratados com start date de hoje para frente)
  const upcomingOnboardings = useMemo(() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0); // Zera a hora para pegar quem começa hoje

      return candidates.filter(c => {
          if (c.status !== 'Contratado' || !c.timeline?.startDate) return false;
          
          const startDate = parseISO(c.timeline.startDate);
          return startDate >= todayStart; 
      }).sort((a, b) => new Date(a.timeline!.startDate!).getTime() - new Date(b.timeline!.startDate!).getTime());
  }, [candidates]);


  // --- 3. RENDERIZAÇÃO DAS JANELAS (MODAIS) ---
  const getDrillDownContent = () => {
      
      // JANELA 1: Candidatos Pendentes
      if (drillDownType === 'PENDING_CANDIDATES') {
          return (
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                        <th className="p-4 rounded-l-xl">Candidato</th>
                        <th className="p-4">Vaga</th>
                        <th className="p-4 text-center">Status Pendente</th>
                        <th className="p-4 text-right rounded-r-xl">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {pendingCandidates.map(c => {
                        const job = jobs.find(j => j.id === c.jobId);
                        return (
                            <tr key={c.id} className="hover:bg-amber-50 transition-colors">
                                <td className="p-4 font-black text-slate-700">{c.name}</td>
                                <td className="p-4 text-slate-600 font-medium">{job?.title || 'Entrevista Geral (Pool)'}</td>
                                <td className="p-4 text-center">
                                    <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                                        {c.status}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => navigate(c.jobId === 'general' ? '/general-interviews' : `/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1">
                                        <Target size={14}/> Resolver
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {pendingCandidates.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhum candidato pendente no momento.</td></tr>}
                </tbody>
            </table>
          );
      }

      // JANELA 2: Vagas Antigas
      if (drillDownType === 'OLD_JOBS') {
          return (
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                        <th className="p-4 rounded-l-xl">Vaga</th>
                        <th className="p-4 text-center">Área</th>
                        <th className="p-4 text-center">Abertura</th>
                        <th className="p-4 text-center text-red-500">Dias em Aberto</th>
                        <th className="p-4 text-right rounded-r-xl">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {oldOpenJobs.map(j => {
                        const daysOpen = differenceInDays(new Date(), parseISO(j.openedAt));
                        return (
                            <tr key={j.id} className="hover:bg-red-50 transition-colors">
                                <td className="p-4 font-black text-slate-700">{j.title}</td>
                                <td className="p-4 text-center text-slate-500">{j.sector} - {j.unit}</td>
                                <td className="p-4 text-center font-medium text-slate-600">{new Date(j.openedAt).toLocaleDateString()}</td>
                                <td className="p-4 text-center font-black text-red-600">{daysOpen} dias</td>
                                <td className="p-4 text-right">
                                    <button onClick={() => navigate(`/jobs/${j.id}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1">
                                        <ExternalLink size={14}/> Acessar Vaga
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {oldOpenJobs.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400">Nenhuma vaga em atraso crítico.</td></tr>}
                </tbody>
            </table>
          );
      }

      // JANELA 3: Integrações
      if (drillDownType === 'UPCOMING_ONBOARDINGS') {
          return (
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                        <th className="p-4 rounded-l-xl">Novo Colaborador</th>
                        <th className="p-4">Vaga Aprovada</th>
                        <th className="p-4 text-center text-emerald-600">Data de Início</th>
                        <th className="p-4 text-right rounded-r-xl">Visualizar</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {upcomingOnboardings.map(c => {
                        const job = jobs.find(j => j.id === c.jobId);
                        const isTodayStart = isToday(parseISO(c.timeline!.startDate!));
                        return (
                            <tr key={c.id} className="hover:bg-emerald-50 transition-colors">
                                <td className="p-4 font-black text-slate-700">{c.name}</td>
                                <td className="p-4 text-slate-600 font-medium">{job?.title || '-'}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase ${isTodayStart ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                        {isTodayStart ? 'HOJE' : new Date(c.timeline!.startDate!).toLocaleDateString()}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button onClick={() => navigate(c.jobId === 'general' ? '/general-interviews' : `/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1">
                                        <Target size={14}/> Ficha
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {upcomingOnboardings.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Nenhuma integração agendada.</td></tr>}
                </tbody>
            </table>
          );
      }
      return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* --- HEADER --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Ações</h1>
            <p className="text-slate-500 font-medium italic">Foque no que precisa da sua atenção hoje.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            {hasConfidentialAccess && (
              <button onClick={() => setShowConfidential(!showConfidential)} className={`p-2 rounded-xl transition-all border flex items-center gap-2 text-sm font-bold ${showConfidential ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                {showConfidential ? <Unlock size={18} /> : <Lock size={18} />} <span className="hidden sm:inline">{showConfidential ? "Sigilo Aberto" : "Ativar Sigilo"}</span>
              </button>
            )}
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
            <select className="bg-slate-50 border-none rounded-xl text-sm p-2 font-bold outline-none cursor-pointer" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
                <option value="">Todos os Setores</option>
                {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="bg-slate-50 border-none rounded-xl text-sm p-2 font-bold outline-none cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
                <option value="">Todas as Unidades</option>
                {settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
        </div>
      </div>

      {/* --- CARDS DE ALERTA PRINCIPAIS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
          
          {/* 1. Candidatos Pendentes */}
          <div 
             onClick={() => setDrillDownType('PENDING_CANDIDATES')} 
             className="relative bg-white border border-amber-200 p-8 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden"
          >
              <div className="absolute -top-4 -right-4 bg-amber-50 p-8 rounded-full z-0 group-hover:bg-amber-100 transition-colors"></div>
              <div className="bg-amber-500 p-5 rounded-2xl text-white shadow-lg shadow-amber-200 mb-6 z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <UserCheck size={40}/>
              </div>
              <div className="text-center z-10">
                  <h4 className="font-black text-amber-900 uppercase tracking-widest text-xs mb-2">Candidatos Pendentes</h4>
                  <div className="text-6xl font-black text-amber-600 mb-2">{pendingCandidates.length}</div>
                  <p className="text-xs text-slate-500 font-medium px-4">
                      Em processo ativo. Evite esquecer candidatos no funil e atualize os status.
                  </p>
              </div>
          </div>

          {/* 2. Vagas Antigas */}
          <div 
             onClick={() => setDrillDownType('OLD_JOBS')} 
             className="relative bg-white border border-red-200 p-8 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden"
          >
              <div className="absolute -top-4 -right-4 bg-red-50 p-8 rounded-full z-0 group-hover:bg-red-100 transition-colors"></div>
              <div className="bg-red-500 p-5 rounded-2xl text-white shadow-lg shadow-red-200 mb-6 z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <AlertCircle size={40}/>
              </div>
              <div className="text-center z-10">
                  <h4 className="font-black text-red-900 uppercase tracking-widest text-xs mb-2">Vagas em Atraso</h4>
                  <div className="text-6xl font-black text-red-600 mb-2">{oldOpenJobs.length}</div>
                  <p className="text-xs text-slate-500 font-medium px-4">
                      Abertas há mais de 30 dias. Exigem atenção imediata para fechamento.
                  </p>
              </div>
          </div>

          {/* 3. Integrações */}
          <div 
             onClick={() => setDrillDownType('UPCOMING_ONBOARDINGS')} 
             className="relative bg-white border border-emerald-200 p-8 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden"
          >
              <div className="absolute -top-4 -right-4 bg-emerald-50 p-8 rounded-full z-0 group-hover:bg-emerald-100 transition-colors"></div>
              <div className="bg-emerald-500 p-5 rounded-2xl text-white shadow-lg shadow-emerald-200 mb-6 z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <CalendarDays size={40}/>
              </div>
              <div className="text-center z-10">
                  <h4 className="font-black text-emerald-900 uppercase tracking-widest text-xs mb-2">Próximas Integrações</h4>
                  <div className="text-6xl font-black text-emerald-600 mb-2">{upcomingOnboardings.length}</div>
                  <p className="text-xs text-slate-500 font-medium px-4">
                      Candidatos aprovados com data de início prevista para hoje ou datas futuras.
                  </p>
              </div>
          </div>

      </div>

      {/* --- MODAL DE VISUALIZAÇÃO DE DADOS (DRILL-DOWN) --- */}
      {drillDownType && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20 mx-auto">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl text-white shadow-lg ${
                              drillDownType === 'PENDING_CANDIDATES' ? 'bg-amber-500 shadow-amber-200' :
                              drillDownType === 'OLD_JOBS' ? 'bg-red-500 shadow-red-200' : 'bg-emerald-500 shadow-emerald-200'
                          }`}>
                              {drillDownType === 'PENDING_CANDIDATES' && <UserCheck size={24} />}
                              {drillDownType === 'OLD_JOBS' && <AlertTriangle size={24} />}
                              {drillDownType === 'UPCOMING_ONBOARDINGS' && <CalendarDays size={24} />}
                          </div>
                          <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                {drillDownType === 'PENDING_CANDIDATES' ? 'Candidatos Pendentes de Ação' :
                                 drillDownType === 'OLD_JOBS' ? 'Vagas Abertas Críticas (> 30 dias)' :
                                 'Integrações Confirmadas (Hoje/Futuro)'}
                            </h2>
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Ações Operacionais Necessárias</p>
                          </div>
                      </div>
                      <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm"><X size={24} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {getDrillDownContent()}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
