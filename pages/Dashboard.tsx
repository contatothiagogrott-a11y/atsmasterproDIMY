import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  AlertTriangle, CalendarDays, UserCheck, Search, X, Lock, Unlock, 
  ExternalLink, Target, AlertCircle, CalendarX, Users, UserMinus
} from 'lucide-react';
import { parseISO, addDays, differenceInDays, isSameMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type DrillDownType = 'PENDING_CANDIDATES' | 'OLD_JOBS' | 'UPCOMING_ONBOARDINGS' | null;

export const Dashboard: React.FC = () => {
  const { jobs, candidates, settings, user, absences, employees } = useData();
  const navigate = useNavigate();
  
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [showConfidential, setShowConfidential] = useState(false);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);

  // --- 1. LÓGICA DE GESTÃO DE PESSOAS (NOVO) ---
  const peopleStats = useMemo(() => {
    const today = new Date();
    
    // Faltas do Mês Regente
    const monthlyAbsences = (absences || []).filter(a => {
      if (!a.absenceDate) return false;
      return isSameMonth(parseISO(a.absenceDate), today);
    }).length;

    // Colaboradores Ativos (Separados por CLT/PJ)
    const activeList = (employees || []).filter(e => e.status === 'Ativo');
    const ativosCLT = activeList.filter(e => e.contractType === 'CLT').length;
    const ativosPJ = activeList.filter(e => e.contractType === 'PJ').length;

    // Colaboradores Afastados
    const afastados = (employees || []).filter(e => e.status === 'Afastado').length;

    return { monthlyAbsences, totalAtivos: activeList.length, ativosCLT, ativosPJ, afastados };
  }, [absences, employees]);

  // --- 2. FILTRAGEM BASE DE ACESSO ---
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

  // --- 3. LÓGICAS DOS ALERTAS RECRUTAMENTO ---
  const pendingCandidates = useMemo(() => {
      return fCandidates.filter(c => 
          !['Aprovado', 'Reprovado', 'Desistência', 'Contratado'].includes(c.status)
      );
  }, [fCandidates]);

  const oldOpenJobs = useMemo(() => {
      const today = new Date();
      const thirtyDaysAgo = addDays(today, -30);
      return fJobs.filter(j => j.status === 'Aberta' && new Date(j.openedAt) < thirtyDaysAgo);
  }, [fJobs]);

  const upcomingOnboardings = useMemo(() => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      return candidates.filter(c => {
          if (c.status !== 'Contratado' || !c.timeline?.startDate) return false;
          const startDate = parseISO(c.timeline.startDate);
          return startDate >= todayStart; 
      }).sort((a, b) => new Date(a.timeline!.startDate!).getTime() - new Date(b.timeline!.startDate!).getTime());
  }, [candidates]);


  // --- 4. RENDERIZAÇÃO DA TABELA INLINE ---
  const getDrillDownContent = () => {
      if (drillDownType === 'PENDING_CANDIDATES') {
          return (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Candidato</th>
                            <th className="p-4">Vaga</th>
                            <th className="p-4 text-center">Status Pendente</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {pendingCandidates.map(c => {
                            const job = jobs.find(j => j.id === c.jobId);
                            return (
                                <tr key={c.id} className="hover:bg-amber-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{c.name}</td>
                                    <td className="p-4 text-slate-600 font-medium">{job?.title || 'Entrevista Geral (Pool)'}</td>
                                    <td className="p-4 text-center">
                                        <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">{c.status}</span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate(c.jobId === 'general' ? '/general-interviews' : `/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                            <Target size={14}/> Resolver
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          );
      }

      if (drillDownType === 'OLD_JOBS') {
          return (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Vaga</th>
                            <th className="p-4 text-center">Área</th>
                            <th className="p-4 text-center text-red-500">Dias em Aberto</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {oldOpenJobs.map(j => {
                            const daysOpen = differenceInDays(new Date(), parseISO(j.openedAt));
                            return (
                                <tr key={j.id} className="hover:bg-red-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{j.title}</td>
                                    <td className="p-4 text-center text-slate-500">{j.sector}</td>
                                    <td className="p-4 text-center font-black text-red-600">{daysOpen} dias</td>
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate(`/jobs/${j.id}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                            <ExternalLink size={14}/> Acessar Vaga
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          );
      }

      if (drillDownType === 'UPCOMING_ONBOARDINGS') {
          return (
            <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left text-xs min-w-[600px]">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Novo Colaborador</th>
                            <th className="p-4 text-center text-emerald-600">Data de Início</th>
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {upcomingOnboardings.map(c => {
                            const startDateObj = parseISO(c.timeline!.startDate!);
                            const isTodayStart = startDateObj.toDateString() === new Date().toDateString();
                            return (
                                <tr key={c.id} className="hover:bg-emerald-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{c.name}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase ${isTodayStart ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                                            {isTodayStart ? 'HOJE' : startDateObj.toLocaleDateString()}
                                        </span>
                                    </td>
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate(c.jobId === 'general' ? '/general-interviews' : `/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                            <Target size={14}/> Ficha
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          );
      }
      return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* --- HEADER --- */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
            <h2 className="text-lg font-bold text-indigo-600 mb-1">
                Bem-vindo(a){user?.name ? `, ${user.name.split(' ')[0]}` : ''}! 👋
            </h2>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Painel de Ações</h1>
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
        </div>
      </div>

      {/* --- NOVO BLOCO: GESTÃO DE PESSOAS (RESUMO) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl"><CalendarX size={32} /></div>
              <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Faltas no Mês</p>
                  <p className="text-3xl font-black text-slate-800">{peopleStats.monthlyAbsences}</p>
              </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl"><Users size={32} /></div>
              <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Colaboradores Ativos</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black text-slate-800">{peopleStats.totalAtivos}</p>
                    <p className="text-xs font-bold text-slate-500">({peopleStats.ativosCLT} CLT / {peopleStats.ativosPJ} PJ)</p>
                  </div>
              </div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-6">
              <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl"><UserMinus size={32} /></div>
              <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Afastados</p>
                  <p className="text-3xl font-black text-slate-800">{peopleStats.afastados}</p>
              </div>
          </div>
      </div>

      <div className="w-full h-px bg-slate-200 my-4"></div>

      {/* --- CARDS DE ALERTA RECRUTAMENTO --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* 1. Candidatos Pendentes */}
          <div 
             onClick={() => setDrillDownType(drillDownType === 'PENDING_CANDIDATES' ? null : 'PENDING_CANDIDATES')} 
             className={`relative bg-white border p-8 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'PENDING_CANDIDATES' ? 'border-amber-500 shadow-md ring-4 ring-amber-50' : 'border-amber-200'}`}
          >
              <div className="absolute -top-4 -right-4 bg-amber-50 p-8 rounded-full z-0 group-hover:bg-amber-100 transition-colors"></div>
              <div className="bg-amber-500 p-5 rounded-2xl text-white shadow-lg shadow-amber-200 mb-6 z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <UserCheck size={40}/>
              </div>
              <div className="text-center z-10">
                  <h4 className="font-black text-amber-900 uppercase tracking-widest text-xs mb-2">Candidatos Pendentes</h4>
                  <div className="text-6xl font-black text-amber-600 mb-2">{pendingCandidates.length}</div>
              </div>
          </div>

          {/* 2. Vagas Antigas */}
          <div 
             onClick={() => setDrillDownType(drillDownType === 'OLD_JOBS' ? null : 'OLD_JOBS')} 
             className={`relative bg-white border p-8 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'OLD_JOBS' ? 'border-red-500 shadow-md ring-4 ring-red-50' : 'border-red-200'}`}
          >
              <div className="absolute -top-4 -right-4 bg-red-50 p-8 rounded-full z-0 group-hover:bg-red-100 transition-colors"></div>
              <div className="bg-red-500 p-5 rounded-2xl text-white shadow-lg shadow-red-200 mb-6 z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <AlertCircle size={40}/>
              </div>
              <div className="text-center z-10">
                  <h4 className="font-black text-red-900 uppercase tracking-widest text-xs mb-2">Vagas em Atraso</h4>
                  <div className="text-6xl font-black text-red-600 mb-2">{oldOpenJobs.length}</div>
              </div>
          </div>

          {/* 3. Integrações */}
          <div 
             onClick={() => setDrillDownType(drillDownType === 'UPCOMING_ONBOARDINGS' ? null : 'UPCOMING_ONBOARDINGS')} 
             className={`relative bg-white border p-8 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:shadow-xl transition-all active:scale-95 group overflow-hidden ${drillDownType === 'UPCOMING_ONBOARDINGS' ? 'border-emerald-500 shadow-md ring-4 ring-emerald-50' : 'border-emerald-200'}`}
          >
              <div className="absolute -top-4 -right-4 bg-emerald-50 p-8 rounded-full z-0 group-hover:bg-emerald-100 transition-colors"></div>
              <div className="bg-emerald-500 p-5 rounded-2xl text-white shadow-lg shadow-emerald-200 mb-6 z-10 group-hover:-translate-y-2 transition-transform duration-300">
                  <CalendarDays size={40}/>
              </div>
              <div className="text-center z-10">
                  <h4 className="font-black text-emerald-900 uppercase tracking-widest text-xs mb-2">Próximas Integrações</h4>
                  <div className="text-6xl font-black text-emerald-600 mb-2">{upcomingOnboardings.length}</div>
              </div>
          </div>
      </div>

      {/* --- ÁREA INLINE DE VISUALIZAÇÃO DE DADOS --- */}
      {drillDownType && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden animate-fadeIn mt-8">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl text-white shadow-md ${
                          drillDownType === 'PENDING_CANDIDATES' ? 'bg-amber-500' :
                          drillDownType === 'OLD_JOBS' ? 'bg-red-500' : 'bg-emerald-500'
                      }`}>
                          {drillDownType === 'PENDING_CANDIDATES' && <UserCheck size={24} />}
                          {drillDownType === 'OLD_JOBS' && <AlertTriangle size={24} />}
                          {drillDownType === 'UPCOMING_ONBOARDINGS' && <CalendarDays size={24} />}
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                            {drillDownType === 'PENDING_CANDIDATES' ? 'Candidatos Pendentes' :
                             drillDownType === 'OLD_JOBS' ? 'Vagas Críticas' :
                             'Integrações Confirmadas'}
                        </h2>
                      </div>
                  </div>
                  <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all">
                      <X size={24} />
                  </button>
              </div>
              <div className="p-0 bg-white">
                  {getDrillDownContent()}
              </div>
          </div>
      )}
    </div>
  );
};