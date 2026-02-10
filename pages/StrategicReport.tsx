import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Download, Briefcase, CheckCircle, Users, 
  XCircle, PieChart, TrendingUp, UserX, AlertTriangle, 
  Calendar, Building2, Lock, Unlock, X, ChevronRight, 
  ExternalLink, ClipboardCheck, UserCheck, Clock, Search, BarChart3, UserMinus, PauseCircle
} from 'lucide-react';
import { exportStrategicReport } from '../services/excelService';
import { differenceInDays, parseISO } from 'date-fns';

// Tipos expandidos para cobrir todos os cenários
type DrillDownType = 'CLOSED' | 'OPEN' | 'FROZEN' | 'CANCELED' | 'INTERVIEWS' | 'TESTS' | 'REJECTED' | 'WITHDRAWN' | 'EXPANSION' | 'REPLACEMENT' | 'SLA' | null;

export const StrategicReport: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, candidates, settings, user } = useData();
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  
  const [drillDownTarget, setDrillDownTarget] = useState<DrillDownType>(null);

  const [isConfidentialUnlocked, setIsConfidentialUnlocked] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');

  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some(j => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockPassword === user?.password || user?.role === 'MASTER') {
      setIsConfidentialUnlocked(true);
      setIsUnlockModalOpen(false);
      setUnlockPassword('');
    } else {
      alert('Senha incorreta.');
    }
  };

  // Funções de data
  const start = new Date(startDate).getTime();
  const endDateTime = new Date(endDate);
  endDateTime.setHours(23, 59, 59, 999);
  const end = endDateTime.getTime();

  const isWithin = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr).getTime();
      return d >= start && d <= end;
  };

  const accessibleJobs = useMemo(() => jobs.filter(j => {
      const matchesUnit = unitFilter ? j.unit === unitFilter : true;
      const isPublic = !j.isConfidential;
      const canSeeConfidential = isConfidentialUnlocked && (user?.role === 'MASTER' || j.createdBy === user?.id || j.allowedUserIds?.includes(user?.id || ''));
      return matchesUnit && (isPublic || canSeeConfidential);
  }), [jobs, unitFilter, isConfidentialUnlocked, user]);

  const jobIds = useMemo(() => new Set(accessibleJobs.map(j => j.id)), [accessibleJobs]);
  
  const accessibleCandidates = useMemo(() => candidates.filter(c => {
      const isGeneral = c.jobId === 'general' && (!unitFilter || unitFilter === ''); 
      return jobIds.has(c.jobId) || isGeneral;
  }), [candidates, jobIds, unitFilter]);

  // --- ESTATÍSTICAS ESTRATÉGICAS (SLA, EXPANSÃO, SUBSTITUIÇÃO) ---
  const strategicStats = useMemo(() => {
    const jobsInPeriod = accessibleJobs.filter(j => {
        const opened = new Date(j.openedAt).getTime();
        const closed = j.closedAt ? new Date(j.closedAt).getTime() : null;
        const isOpenBeforeEnd = opened <= end;
        const isNotClosedBeforeStart = !closed || closed >= start;
        return isOpenBeforeEnd && isNotClosedBeforeStart;
    });

    const expansionList = jobsInPeriod.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === 'Aumento de Quadro');
    const replacementList = jobsInPeriod.filter(j => j.openingDetails?.reason === 'Substituição');

    const closedInPeriod = accessibleJobs.filter(j => j.status === 'Fechada' && j.closedAt && isWithin(j.closedAt));
    const totalDays = closedInPeriod.reduce((acc, j) => {
        const days = differenceInDays(parseISO(j.closedAt!), parseISO(j.openedAt));
        return acc + days;
    }, 0);
    const avgSla = closedInPeriod.length > 0 ? (totalDays / closedInPeriod.length).toFixed(1) : '0';

    return { 
        expansionCount: expansionList.length, 
        replacementCount: replacementList.length, 
        avgSla, 
        closedCount: closedInPeriod.length,
        expansionList,
        replacementList,
        closedList: closedInPeriod
    };
  }, [accessibleJobs, start, end]);

  // --- MÉTRICAS OPERACIONAIS ---
  const metrics = useMemo(() => {
    // Filtros de Vagas por Status E Data
    const jobsOpened = accessibleJobs.filter(j => isWithin(j.openedAt));
    const jobsClosed = accessibleJobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));
    const jobsFrozen = accessibleJobs.filter(j => j.status === 'Congelada' && isWithin(j.frozenAt)); // Assumindo que você salva frozenAt
    const jobsCanceled = accessibleJobs.filter(j => j.status === 'Cancelada' && isWithin(j.closedAt)); // Cancelamento usa closedAt

    const interviewsList = accessibleCandidates.filter(c => isWithin(c.interviewAt));
    const testsList = accessibleCandidates.filter(c => c.techTest && isWithin(c.techTestDate));
    const rejectedList = accessibleCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate));
    const withdrawnList = accessibleCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate));

    const rejectionReasons: Record<string, number> = {};
    rejectedList.forEach(c => {
        const r = c.rejectionReason || 'Não informado';
        rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
    });

    const withdrawalReasons: Record<string, number> = {};
    withdrawnList.forEach(c => {
        const r = c.rejectionReason || 'Não informado';
        withdrawalReasons[r] = (withdrawalReasons[r] || 0) + 1;
    });

    const bySector: Record<string, any> = {};
    accessibleJobs.forEach(j => {
        if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0, frozen: 0, canceled: 0 };
        if (isWithin(j.openedAt)) bySector[j.sector].opened++;
        if (j.status === 'Fechada' && isWithin(j.closedAt)) bySector[j.sector].closed++;
        if (j.status === 'Congelada' && isWithin(j.frozenAt)) bySector[j.sector].frozen++;
        if (j.status === 'Cancelada' && isWithin(j.closedAt)) bySector[j.sector].canceled++;
    });

    return {
        opened: { total: jobsOpened.length, list: jobsOpened },
        closed: { total: jobsClosed.length, list: jobsClosed },
        frozen: { total: jobsFrozen.length, list: jobsFrozen },
        canceled: { total: jobsCanceled.length, list: jobsCanceled },
        interviews: { total: interviewsList.length, list: interviewsList },
        tests: { total: testsList.length, list: testsList },
        rejected: { total: rejectedList.length, reasons: rejectionReasons, list: rejectedList },
        withdrawn: { total: withdrawnList.length, reasons: withdrawalReasons, list: withdrawnList },
        bySector
    };
  }, [accessibleJobs, accessibleCandidates, startDate, endDate]);

  // --- HELPER PARA DRILL DOWN ---
  const getDrillDownContent = () => {
      // 1. LISTAS DE VAGAS (Expandida com mais detalhes)
      if (['OPEN', 'CLOSED', 'FROZEN', 'CANCELED', 'EXPANSION', 'REPLACEMENT', 'SLA'].includes(drillDownTarget as string)) {
          let list: any[] = [];
          if (drillDownTarget === 'OPEN') list = metrics.opened.list;
          if (drillDownTarget === 'CLOSED' || drillDownTarget === 'SLA') list = metrics.closed.list;
          if (drillDownTarget === 'FROZEN') list = metrics.frozen.list;
          if (drillDownTarget === 'CANCELED') list = metrics.canceled.list;
          if (drillDownTarget === 'EXPANSION') list = strategicStats.expansionList;
          if (drillDownTarget === 'REPLACEMENT') list = strategicStats.replacementList;

          return (
             <div className="overflow-x-auto">
             <table className="w-full text-left text-xs">
                 <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                     <tr>
                         <th className="p-4 pl-6 rounded-l-xl">Vaga</th>
                         <th className="p-4 text-center">Status</th>
                         <th className="p-4 text-center">Abertura</th>
                         {(drillDownTarget === 'CLOSED' || drillDownTarget === 'SLA') && <th className="p-4 text-center">Fechamento (SLA)</th>}
                         {(drillDownTarget === 'CLOSED') && <th className="p-4 text-center">Contratado</th>}
                         {(drillDownTarget === 'CANCELED') && <th className="p-4 text-center">Motivo Canc.</th>}
                         <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100">
                     {list.map(j => {
                         const sla = j.closedAt ? differenceInDays(parseISO(j.closedAt), parseISO(j.openedAt)) : 
                                     differenceInDays(new Date(), parseISO(j.openedAt)); // SLA atual se aberta
                         
                         const hiredId = j.hiredCandidateIds?.[0];
                         const hiredCandidate = hiredId ? candidates.find(c => c.id === hiredId) : null;

                         return (
                             <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                                 <td className="p-4 pl-6">
                                     <div className="font-black text-slate-700 text-sm">{j.title}</div>
                                     <div className="text-[10px] text-slate-400 font-bold uppercase">{j.sector} | {j.unit}</div>
                                 </td>
                                 <td className="p-4 text-center">
                                     <span className={`px-2 py-1 rounded text-[10px] font-black uppercase border ${
                                         j.status === 'Aberta' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                         j.status === 'Fechada' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                         j.status === 'Congelada' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                         'bg-red-50 text-red-700 border-red-100'
                                     }`}>{j.status}</span>
                                 </td>
                                 <td className="p-4 text-center text-slate-600 font-medium">
                                     {new Date(j.openedAt).toLocaleDateString()}
                                 </td>
                                 
                                 {(drillDownTarget === 'CLOSED' || drillDownTarget === 'SLA') && (
                                     <td className="p-4 text-center">
                                         <div className="font-bold text-slate-700">{new Date(j.closedAt).toLocaleDateString()}</div>
                                         <div className="text-[10px] text-slate-400 font-black uppercase">{sla} dias</div>
                                     </td>
                                 )}

                                 {(drillDownTarget === 'CLOSED') && (
                                     <td className="p-4 text-center">
                                         {hiredCandidate ? (
                                             <div className="flex items-center justify-center gap-1 text-emerald-700 font-bold text-xs">
                                                 <UserCheck size={14}/> {hiredCandidate.name}
                                             </div>
                                         ) : <span className="text-slate-300">-</span>}
                                     </td>
                                 )}

                                 {(drillDownTarget === 'CANCELED') && (
                                     <td className="p-4 text-center text-red-600 font-medium text-xs max-w-[150px] truncate" title={j.cancellationReason}>
                                         {j.cancellationReason || 'Não informado'}
                                     </td>
                                 )}

                                 <td className="p-4 pr-6 text-right">
                                     <button onClick={() => navigate(`/jobs/${j.id}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto">
                                         <ExternalLink size={14}/> Abrir
                                     </button>
                                 </td>
                             </tr>
                         );
                     })}
                     {list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-400 italic">Nenhum registro encontrado para este filtro.</td></tr>}
                 </tbody>
             </table>
             </div>
          );
      }
      
      // 2. LISTAS DE CANDIDATOS (INTERVISTAS, TESTES, REPROVADOS...)
      // ... Código de candidatos mantido igual, mas garantindo a coluna de data ...
      const candidateList = 
          drillDownTarget === 'INTERVIEWS' ? metrics.interviews.list :
          drillDownTarget === 'TESTS' ? metrics.tests.list :
          drillDownTarget === 'REJECTED' ? metrics.rejected.list :
          drillDownTarget === 'WITHDRAWN' ? metrics.withdrawn.list : [];

      return (
         <div className="overflow-x-auto">
         <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                  <tr>
                      <th className="p-4 pl-6 rounded-l-xl">Candidato</th>
                      <th className="p-4">Vaga / Origem</th>
                      {(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') && <th className="p-4">Motivo</th>}
                      {(drillDownTarget === 'TESTS') && <th className="p-4">Avaliador</th>}
                      <th className="p-4 text-right pr-6 rounded-r-xl">Data Evento</th>
                  </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                  {candidateList.map(c => {
                      const job = jobs.find(j => j.id === c.jobId);
                      const displayTitle = c.jobId === 'general' ? 'Entrevista Geral (Pool)' : job?.title;
                      
                      let eventDate = '-';
                      if(drillDownTarget === 'INTERVIEWS') eventDate = c.interviewAt ? new Date(c.interviewAt).toLocaleDateString() : '-';
                      if(drillDownTarget === 'TESTS') eventDate = c.techTestDate ? new Date(c.techTestDate).toLocaleDateString() : '-';
                      if(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') eventDate = c.rejectionDate ? new Date(c.rejectionDate).toLocaleDateString() : '-';

                      return (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                              <td className="p-4 pl-6 font-black text-slate-700">{c.name}</td>
                              <td className="p-4 text-slate-600">{displayTitle}</td>
                              
                              {(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') && (
                                  <td className="p-4">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${drillDownTarget === 'REJECTED' ? 'bg-red-50 text-red-700' : 'bg-orange-50 text-orange-700'}`}>
                                          {c.rejectionReason || 'Sem motivo'}
                                      </span>
                                  </td>
                              )}

                              {(drillDownTarget === 'TESTS') && (
                                  <td className="p-4 text-slate-600 font-medium">{c.techEvaluator || '-'}</td>
                              )}

                              <td className="p-4 pr-6 text-right font-black text-slate-600">{eventDate}</td>
                          </tr>
                      );
                  })}
                  {candidateList.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhum registro encontrado.</td></tr>}
            </tbody>
         </table>
         </div>
      );
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 border border-transparent hover:border-slate-200 transition-all shadow-sm"><ArrowLeft size={22} /></button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Relatório Estratégico</h1>
        </div>
        <div className="flex gap-2">
            <button onClick={() => exportStrategicReport(metrics, startDate, endDate)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm text-xs uppercase tracking-widest transition-all"><Download size={16} /> Excel</button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-2 px-2"><Calendar size={16} className="text-indigo-500" /><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" /></div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2"><Calendar size={16} className="text-rose-500" /><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2"><Building2 size={16} className="text-slate-400" /><select className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas Unidades</option>{settings.filter(s => s.type === 'UNIT').map(u => (<option key={u.id} value={u.name}>{u.name}</option>))}</select></div>
      </div>

      {/* CARDS ESTRATÉGICOS (CLICÁVEIS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
         <div 
            onClick={() => setDrillDownTarget('SLA')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
         >
            <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={80} className="text-blue-600"/></div>
            <div className="bg-blue-100 p-3 rounded-xl text-blue-600 z-10"><Clock size={24} /></div>
            <div className="z-10">
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tempo Médio (SLA)</p>
               <h4 className="text-3xl font-black text-slate-800">{strategicStats.avgSla} <span className="text-sm font-bold text-slate-400">dias</span></h4>
               <p className="text-[10px] text-slate-400 font-medium">Baseado em {strategicStats.closedCount} vagas fechadas</p>
            </div>
         </div>

         <div 
            onClick={() => setDrillDownTarget('EXPANSION')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
         >
            <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={80} className="text-indigo-600"/></div>
            <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600 z-10"><TrendingUp size={24} /></div>
            <div className="z-10">
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Expansão</p>
               <h4 className="text-3xl font-black text-slate-800">{strategicStats.expansionCount} <span className="text-sm font-bold text-slate-400">vagas</span></h4>
               <p className="text-[10px] text-indigo-500 font-bold uppercase">Aumento de Quadro (Ativas)</p>
            </div>
         </div>

         <div 
            onClick={() => setDrillDownTarget('REPLACEMENT')}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden group cursor-pointer hover:shadow-md transition-all hover:-translate-y-1"
         >
            <div className="absolute right-0 bottom-0 opacity-10 group-hover:opacity-20 transition-opacity"><UserMinus size={80} className="text-rose-600"/></div>
            <div className="bg-rose-100 p-3 rounded-xl text-rose-600 z-10"><UserMinus size={24} /></div>
            <div className="z-10">
               <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Reposição</p>
               <h4 className="text-3xl font-black text-slate-800">{strategicStats.replacementCount} <span className="text-sm font-bold text-slate-400">vagas</span></h4>
               <p className="text-[10px] text-rose-500 font-bold uppercase">Substituição (Ativas)</p>
            </div>
         </div>
      </div>

      {/* CARDS OPERACIONAIS (AGORA CLICÁVEIS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StrategicCard title="Abertas" value={metrics.opened.total} color="blue" icon={Briefcase} subtitle="Novas no período" onClick={() => setDrillDownTarget('OPEN')} />
          <StrategicCard title="Concluídas" value={metrics.closed.total} color="emerald" icon={CheckCircle} subtitle="Ver Contratações" onClick={() => setDrillDownTarget('CLOSED')} />
          <StrategicCard title="Congeladas" value={metrics.bySector ? Object.values(metrics.bySector).reduce((a: any, b: any) => a + b.frozen, 0) : 0} color="amber" icon={PauseCircle} subtitle="Ver Motivos" onClick={() => setDrillDownTarget('FROZEN')} />
          <StrategicCard title="Canceladas" value={metrics.bySector ? Object.values(metrics.bySector).reduce((a: any, b: any) => a + b.canceled, 0) : 0} color="red" icon={XCircle} subtitle="Ver Motivos" onClick={() => setDrillDownTarget('CANCELED')} />
          <StrategicCard title="Entrevistas" value={metrics.interviews.total} color="indigo" icon={Users} subtitle="Ver Agendas" onClick={() => setDrillDownTarget('INTERVIEWS')} />
          <StrategicCard title="Desistências" value={metrics.withdrawn.total} color="orange" icon={UserX} subtitle="Ver Detalhes" onClick={() => setDrillDownTarget('WITHDRAWN')} />
      </div>

      {/* RELAÇÃO POR ÁREA */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30"><TrendingUp size={20} className="text-indigo-600"/><h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Relação por Área</h3></div>
          <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                  <thead>
                      <tr className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                          <th className="p-4 pl-6">Setor / Departamento</th>
                          <th className="p-4 text-center">Abertas</th>
                          <th className="p-4 text-center">Fechadas</th>
                          <th className="p-4 text-center">Cong.</th>
                          <th className="p-4 text-center">Canc.</th>
                          <th className="p-4 pr-6 text-right">Ação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {Object.entries(metrics.bySector).filter(([_, d]: any) => d.opened+d.closed+d.frozen+d.canceled > 0).map(([sector, data]: [string, any]) => (
                          <tr key={sector} onClick={() => setSelectedSector(sector)} className="group cursor-pointer hover:bg-indigo-50/30 transition-colors">
                              <td className="p-4 pl-6 font-black text-slate-700 text-sm group-hover:text-indigo-600">{sector}</td>
                              <td className="p-4 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-black">{data.opened}</span></td>
                              <td className="p-4 text-center"><span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-black">{data.closed}</span></td>
                              <td className="p-4 text-center text-slate-400">{data.frozen}</td>
                              <td className="p-4 text-center text-slate-400">{data.canceled}</td>
                              <td className="py-4 pr-6 text-right"><ChevronRight size={18} className="inline text-slate-300 group-hover:text-indigo-500 transition-all" /></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* JANELA DE DRILL-DOWN DOS CARDS */}
      {drillDownTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Search size={22} /></div>
                          <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                {drillDownTarget === 'CLOSED' && "Vagas Concluídas"}
                                {drillDownTarget === 'OPEN' && "Vagas Abertas no Período"}
                                {drillDownTarget === 'FROZEN' && "Vagas Congeladas"}
                                {drillDownTarget === 'CANCELED' && "Vagas Canceladas"}
                                {drillDownTarget === 'INTERVIEWS' && "Entrevistas Realizadas"}
                                {drillDownTarget === 'REJECTED' && "Reprovações"}
                                {drillDownTarget === 'WITHDRAWN' && "Desistências"}
                                {drillDownTarget === 'EXPANSION' && "Aumento de Quadro"}
                                {drillDownTarget === 'REPLACEMENT' && "Substituição"}
                                {drillDownTarget === 'SLA' && "SLA - Vagas Fechadas"}
                            </h2>
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Detalhamento dos dados</p>
                          </div>
                      </div>
                      <button onClick={() => setDrillDownTarget(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={26} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
                      
                      {/* PAINEL DE INDICADORES VISUAIS PARA MOTIVOS */}
                      {(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') && (
                          <div className="p-6 bg-slate-50/50 border-b border-slate-100">
                              <div className="flex items-center gap-2 mb-4">
                                  <BarChart3 size={18} className={drillDownTarget === 'REJECTED' ? 'text-red-500' : 'text-orange-500'} />
                                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">
                                      Ranking de Motivos
                                  </h3>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {Object.entries(metrics[drillDownTarget === 'REJECTED' ? 'rejected' : 'withdrawn'].reasons)
                                      .sort(([,a], [,b]) => b - a) 
                                      .map(([reason, count]) => (
                                          <div key={reason} className={`p-3 rounded-xl border flex flex-col justify-between shadow-sm relative overflow-hidden ${drillDownTarget === 'REJECTED' ? 'bg-red-50 border-red-100' : 'bg-orange-50 border-orange-100'}`}>
                                              <div className={`text-2xl font-black mb-1 ${drillDownTarget === 'REJECTED' ? 'text-red-600' : 'text-orange-600'}`}>
                                                  {count}
                                              </div>
                                              <div className="text-[10px] font-bold uppercase text-slate-600 leading-tight">
                                                  {reason}
                                              </div>
                                              <div className="absolute bottom-0 left-0 h-1 bg-current opacity-20" style={{ 
                                                  width: `${(count / (metrics[drillDownTarget === 'REJECTED' ? 'rejected' : 'withdrawn'].total || 1)) * 100}%`,
                                                  color: drillDownTarget === 'REJECTED' ? 'red' : 'orange'
                                              }}></div>
                                          </div>
                                      ))
                                  }
                              </div>
                          </div>
                      )}

                      <div className="p-0">
                          {getDrillDownContent()}
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* JANELA DE SETOR (BRANCH) */}
      {selectedSector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="text-left">
                          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-tight">Área: {selectedSector}</h2>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Resumo operacional por vaga</p>
                      </div>
                      <button onClick={() => setSelectedSector(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={26} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
                      <table className="w-full text-left text-xs">
                          <thead className="text-slate-400 font-black uppercase tracking-widest text-[9px] border-b border-slate-100">
                              <tr><th className="p-3 pl-4">Vaga</th><th className="p-3 text-center bg-indigo-50/50">Ent.</th><th className="p-3 text-center bg-red-50/50">Rep.</th><th className="p-3 text-center bg-orange-50/50">Des.</th><th className="p-3 pr-4 text-right">Ação</th></tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {accessibleJobs.filter(j => j.sector === selectedSector && (isWithin(j.openedAt) || (j.closedAt && isWithin(j.closedAt)))).map(vaga => {
                                  const cands = candidates.filter(c => c.jobId === vaga.id);
                                  return (
                                      <tr key={vaga.id} className="hover:bg-slate-50 transition-colors text-left">
                                          <td className="p-3 pl-4 font-black text-slate-700 text-sm truncate max-w-[220px]">{vaga.title}</td>
                                          <td className="p-3 text-center font-black text-indigo-600 bg-indigo-50/10">{cands.filter(c => isWithin(c.interviewAt)).length}</td>
                                          <td className="p-3 text-center font-black text-red-600 bg-red-50/10">{cands.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).length}</td>
                                          <td className="p-3 text-center font-black text-orange-600 bg-orange-50/10">{cands.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).length}</td>
                                          <td className="p-3 pr-4 text-right"><button onClick={() => navigate(`/jobs/${vaga.id}`)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg shadow-sm font-black uppercase text-[9px] flex items-center gap-1 ml-auto"><ExternalLink size={14} /> Gestão</button></td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE SEGURANÇA */}
      {isUnlockModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100000] p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xs border-t-8 border-amber-500 text-center animate-fadeIn">
                  <div className="flex justify-center mb-4 bg-amber-50 w-12 h-12 rounded-full items-center mx-auto text-amber-600"><Lock size={20} /></div>
                  <h3 className="text-sm font-black text-slate-800 uppercase mb-4 tracking-widest text-center">Senha Master</h3>
                  <form onSubmit={handleUnlockSubmit}>
                      <input type="password" autoFocus placeholder="••••••" className="w-full border border-slate-200 p-3 rounded-xl mb-4 text-center font-bold outline-none focus:ring-2 focus:ring-amber-500" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                      <button type="submit" className="w-full bg-amber-600 text-white font-black py-3 rounded-xl hover:bg-amber-700 transition-all uppercase text-[10px] tracking-widest">Acessar</button>
                      <button type="button" onClick={() => setIsUnlockModalOpen(false)} className="w-full mt-2 text-slate-400 text-[9px] font-bold uppercase hover:text-slate-600">Voltar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

const StrategicCard = ({ title, value, color, icon: Icon, subtitle, onClick }: any) => {
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-50/50",
        emerald: "text-emerald-600 bg-emerald-50/50",
        amber: "text-amber-600 bg-amber-50/50",
        indigo: "text-indigo-600 bg-indigo-50/50",
        red: "text-red-600 bg-red-50/50",
        orange: "text-orange-600 bg-orange-50/50"
    };

    return (
        <div 
          onClick={onClick}
          className={`p-5 rounded-3xl border border-slate-100 relative overflow-hidden bg-white shadow-sm flex flex-col justify-between min-h-[110px] group transition-all text-left ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-1 hover:border-slate-200' : ''}`}
        >
            <Icon className={`absolute -right-2 -bottom-2 opacity-[0.07] size-20 transform group-hover:scale-110 transition-transform ${colorClasses[color]}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest relative z-10 ${colorClasses[color]}`}>{title}</span>
            <div className="text-4xl font-black text-slate-800 relative z-10 tracking-tighter">{value}</div>
            <p className={`text-[9px] font-bold uppercase relative z-10 truncate ${onClick ? 'text-indigo-500 group-hover:underline' : 'text-slate-400'}`}>
                {subtitle}
            </p>
        </div>
    );
}
