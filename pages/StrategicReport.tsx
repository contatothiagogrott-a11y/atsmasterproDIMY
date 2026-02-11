import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Download, Briefcase, CheckCircle, Users, 
  XCircle, TrendingUp, UserX, 
  Calendar, Building2, Lock, Unlock, X, ChevronRight, 
  ExternalLink, ClipboardCheck, Clock, Search, BarChart3, 
  UserMinus, PauseCircle, Activity, History, Layers 
} from 'lucide-react';
import { exportStrategicReport } from '../services/excelService';
import { differenceInDays, parseISO } from 'date-fns';

type DrillDownType = 'ALL_ACTIVE' | 'BACKLOG' | 'OPENED_NEW' | 'CANCELED' | 'FROZEN' | 'CLOSED' | 'BALANCE_OPEN' | 'INTERVIEWS' | 'TESTS' | 'REJECTED' | 'WITHDRAWN' | 'EXPANSION' | 'REPLACEMENT' | 'SLA' | null;

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

  const kpis = useMemo(() => {
      // 1. VAGAS ATIVAS (BACKLOG + NOVAS)
      const allActiveJobs = accessibleJobs.filter(j => {
          const opened = new Date(j.openedAt).getTime();
          const closed = j.closedAt ? new Date(j.closedAt).getTime() : null;
          return opened <= end && (!closed || closed >= start);
      });

      const expansionList = allActiveJobs.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === 'Aumento de Quadro');
      const replacementList = allActiveJobs.filter(j => j.openingDetails?.reason === 'Substituição');

      // SLA (Apenas fechadas no range)
      const closedInPeriodList = accessibleJobs.filter(j => j.status === 'Fechada' && j.closedAt && isWithin(j.closedAt));
      const totalDays = closedInPeriodList.reduce((acc, j) => {
          const days = differenceInDays(parseISO(j.closedAt!), parseISO(j.openedAt));
          return acc + days;
      }, 0);
      const avgSla = closedInPeriodList.length > 0 ? (totalDays / closedInPeriodList.length).toFixed(1) : '0';

      // 2. FLUXO DETALHADO
      
      // Backlog: Abertas ANTES do início
      const jobsBacklog = accessibleJobs.filter(j => {
          const opened = new Date(j.openedAt).getTime();
          const closed = j.closedAt ? new Date(j.closedAt).getTime() : null;
          return opened < start && (!closed || closed >= start);
      });

      // Novas: Abertas DURANTE
      const jobsOpenedNew = accessibleJobs.filter(j => isWithin(j.openedAt));
      
      // Saídas DURANTE
      const jobsClosed = accessibleJobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));
      const jobsCanceled = accessibleJobs.filter(j => j.status === 'Cancelada' && isWithin(j.closedAt));
      
      // --- CORREÇÃO: LÓGICA DE VAGAS CONGELADAS BASEADA NO HISTÓRICO ---
      // Uma vaga entra na contagem de congeladas se ALGUM evento de congelamento (freezeHistory) ocorreu neste período.
      const jobsFrozen = accessibleJobs.filter(j => {
          if (j.freezeHistory && j.freezeHistory.length > 0) {
              return j.freezeHistory.some((freeze: any) => isWithin(freeze.startDate));
          }
          // Fallback para vagas antigas que não tinham histórico
          return j.status === 'Congelada' && isWithin((j as any).frozenAt);
      });

      // SALDO EM ABERTO NO FIM DO PERÍODO
      const jobsBalanceOpen = accessibleJobs.filter(j => {
        const opened = new Date(j.openedAt).getTime();
        
        let exitDate = null;
        if (j.status === 'Fechada' || j.status === 'Cancelada') {
            exitDate = j.closedAt ? new Date(j.closedAt).getTime() : null;
        } else if (j.status === 'Congelada') {
            // Se está congelada, a data de saída é a do último congelamento
            if (j.freezeHistory && j.freezeHistory.length > 0) {
                 exitDate = new Date(j.freezeHistory[j.freezeHistory.length - 1].startDate).getTime();
            } else {
                 exitDate = (j as any).frozenAt ? new Date((j as any).frozenAt).getTime() : null;
            }
        }

        return opened <= end && (!exitDate || exitDate > end);
      });

      // 3. CANDIDATOS
      const interviews = accessibleCandidates.filter(c => isWithin(c.interviewAt));
      const tests = accessibleCandidates.filter(c => c.techTest && isWithin(c.techTestDate));
      const rejected = accessibleCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate));
      const withdrawn = accessibleCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate));

      const rejectionReasons: Record<string, number> = {};
      rejected.forEach(c => { const r = c.rejectionReason || 'N/I'; rejectionReasons[r] = (rejectionReasons[r] || 0) + 1; });
      
      const withdrawnReasons: Record<string, number> = {};
      withdrawn.forEach(c => { const r = c.rejectionReason || 'N/I'; withdrawnReasons[r] = (withdrawnReasons[r] || 0) + 1; });

      const bySector: Record<string, any> = {};
      accessibleJobs.forEach(j => {
          if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0, frozen: 0, canceled: 0 };
          if (isWithin(j.openedAt)) bySector[j.sector].opened++;
          if (j.status === 'Fechada' && isWithin(j.closedAt)) bySector[j.sector].closed++;
          if (j.status === 'Cancelada' && isWithin(j.closedAt)) bySector[j.sector].canceled++;
          
          // Conta por setor baseada no histórico também
          const isFrozenInPeriod = (j.freezeHistory && j.freezeHistory.length > 0) 
              ? j.freezeHistory.some((f: any) => isWithin(f.startDate))
              : (j.status === 'Congelada' && isWithin((j as any).frozenAt));
              
          if (isFrozenInPeriod) bySector[j.sector].frozen++;
      });

      return {
          allActive: { total: allActiveJobs.length, list: allActiveJobs },
          expansion: { total: expansionList.length, list: expansionList },     
          replacement: { total: replacementList.length, list: replacementList }, 
          sla: { avg: avgSla, list: closedInPeriodList, count: closedInPeriodList.length }, 

          backlog: { total: jobsBacklog.length, list: jobsBacklog }, 
          openedNew: { total: jobsOpenedNew.length, list: jobsOpenedNew },
          closed: { total: jobsClosed.length, list: jobsClosed },
          frozen: { total: jobsFrozen.length, list: jobsFrozen },
          canceled: { total: jobsCanceled.length, list: jobsCanceled },
          
          balanceOpen: { total: jobsBalanceOpen.length, list: jobsBalanceOpen },

          interviews: { total: interviews.length, list: interviews },
          tests: { total: tests.length, list: tests },
          rejected: { total: rejected.length, list: rejected, reasons: rejectionReasons },
          withdrawn: { total: withdrawn.length, list: withdrawn, reasons: withdrawnReasons },
          bySector
      };
  }, [accessibleJobs, accessibleCandidates, start, end]);

  const getModalContent = () => {
      if(['ALL_ACTIVE', 'BACKLOG', 'OPENED_NEW', 'CANCELED', 'FROZEN', 'CLOSED', 'EXPANSION', 'REPLACEMENT', 'SLA', 'BALANCE_OPEN'].includes(drillDownTarget as string)) {
          let list = kpis.allActive.list;
          if(drillDownTarget === 'BACKLOG') list = kpis.backlog.list;
          if(drillDownTarget === 'OPENED_NEW') list = kpis.openedNew.list;
          if(drillDownTarget === 'CANCELED') list = kpis.canceled.list;
          if(drillDownTarget === 'FROZEN') list = kpis.frozen.list;
          if(drillDownTarget === 'CLOSED') list = kpis.closed.list;
          if(drillDownTarget === 'EXPANSION') list = kpis.expansion.list;     
          if(drillDownTarget === 'REPLACEMENT') list = kpis.replacement.list; 
          if(drillDownTarget === 'SLA') list = kpis.sla.list;
          if(drillDownTarget === 'BALANCE_OPEN') list = kpis.balanceOpen.list;

          return (
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                          <tr>
                              <th className="p-4 pl-6 rounded-l-xl">Vaga</th>
                              <th className="p-4 text-center">Tipo</th>
                              <th className="p-4 text-center">Abertura</th>
                              {(drillDownTarget === 'CLOSED' || drillDownTarget === 'SLA') && <th className="p-4 text-center">Fechamento (SLA)</th>}
                              {(drillDownTarget === 'CLOSED') && <th className="p-4 text-center">Contratado</th>}
                              {(drillDownTarget === 'CANCELED') && <th className="p-4 text-center">Motivo Canc.</th>}
                              {(drillDownTarget === 'FROZEN') && <th className="p-4 text-center">Data Cong.</th>}
                              <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {list.map(j => {
                              const hiredId = j.hiredCandidateIds?.[0];
                              const hiredName = hiredId ? candidates.find(c => c.id === hiredId)?.name : '-';
                              const type = j.openingDetails?.reason || 'Aumento de Quadro';
                              const sla = j.closedAt ? differenceInDays(parseISO(j.closedAt), parseISO(j.openedAt)) : 
                                          differenceInDays(new Date(), parseISO(j.openedAt));
                                          
                              // Captura a data exata de congelamento que ocorreu neste período para exibir na tabela
                              let freezeDateStr = (j as any).frozenAt || null;
                              if (j.freezeHistory && j.freezeHistory.length > 0) {
                                  const freezeInPeriod = j.freezeHistory.slice().reverse().find((f: any) => isWithin(f.startDate));
                                  freezeDateStr = freezeInPeriod ? freezeInPeriod.startDate : j.freezeHistory[j.freezeHistory.length - 1].startDate;
                              }

                              return (
                                  <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 pl-6">
                                          <div className="font-black text-slate-700 text-sm">{j.title}</div>
                                          <div className="text-[10px] text-slate-400 font-bold uppercase">{j.sector} | {j.unit}</div>
                                      </td>
                                      <td className="p-4 text-center">
                                          <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${type === 'Substituição' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>{type}</span>
                                      </td>
                                      <td className="p-4 text-center text-slate-600 font-bold">{new Date(j.openedAt).toLocaleDateString()}</td>
                                      
                                      {(drillDownTarget === 'CLOSED' || drillDownTarget === 'SLA') && (
                                          <td className="p-4 text-center">
                                              <div className="font-bold text-slate-700">{j.closedAt ? new Date(j.closedAt).toLocaleDateString() : '-'}</div>
                                              <div className="text-[10px] text-slate-400 font-black uppercase">{sla} dias</div>
                                          </td>
                                      )}
                                      
                                      {drillDownTarget === 'CLOSED' && (
                                          <td className="p-4 text-center text-emerald-700 font-black">{hiredName}</td>
                                      )}
                                      
                                      {drillDownTarget === 'CANCELED' && <td className="p-4 text-center text-red-600 text-xs max-w-[150px] truncate" title={j.cancellationReason}>{j.cancellationReason || 'N/I'}</td>}
                                      
                                      {drillDownTarget === 'FROZEN' && <td className="p-4 text-center text-amber-600 font-bold">{freezeDateStr ? new Date(freezeDateStr).toLocaleDateString() : '-'}</td>}
                                      
                                      <td className="p-4 pr-6 text-right">
                                          <button onClick={() => navigate(`/jobs/${j.id}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto"><ExternalLink size={14}/> Abrir</button>
                                      </td>
                                  </tr>
                              );
                          })}
                          {list.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-400 italic">Nenhum registro encontrado.</td></tr>}
                      </tbody>
                  </table>
              </div>
          );
      }

      if(['INTERVIEWS', 'TESTS', 'REJECTED', 'WITHDRAWN'].includes(drillDownTarget as string)) {
          let list = kpis.interviews.list;
          if(drillDownTarget === 'TESTS') list = kpis.tests.list;
          if(drillDownTarget === 'REJECTED') list = kpis.rejected.list;
          if(drillDownTarget === 'WITHDRAWN') list = kpis.withdrawn.list;

          return (
              <div className="overflow-x-auto">
                 {(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') && (
                    <div className="p-4 bg-slate-50 mb-4 rounded-xl border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-2">
                        {Object.entries(drillDownTarget === 'REJECTED' ? kpis.rejected.reasons : kpis.withdrawn.reasons)
                            .sort(([,a], [,b]) => b - a).slice(0,4).map(([r, c]) => (
                                <div key={r} className="bg-white p-2 rounded border border-slate-200 shadow-sm text-xs">
                                    <span className="font-bold text-slate-700 block truncate" title={r}>{r}</span>
                                    <span className="font-black text-slate-400">{c} ocorren.</span>
                                </div>
                            ))
                        }
                    </div>
                 )}

                 <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                        <tr>
                            <th className="p-4 pl-6 rounded-l-xl">Candidato</th>
                            <th className="p-4">Vaga</th>
                            <th className="p-4 text-center">Data Evento</th>
                            {(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') && <th className="p-4">Motivo</th>}
                            <th className="p-4 text-right pr-6 rounded-r-xl">Ação</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {list.map(c => {
                            const job = jobs.find(j => j.id === c.jobId);
                            const displayTitle = c.jobId === 'general' ? 'Entrevista Geral (Pool)' : job?.title;
                            
                            let dateStr = '-';
                            if(drillDownTarget === 'INTERVIEWS') dateStr = c.interviewAt;
                            if(drillDownTarget === 'TESTS') dateStr = c.techTestDate;
                            if(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') dateStr = c.rejectionDate;

                            return (
                                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 pl-6 font-black text-slate-700">{c.name}</td>
                                    <td className="p-4 text-slate-600">{displayTitle}</td>
                                    <td className="p-4 text-center font-bold text-slate-500">{dateStr ? new Date(dateStr).toLocaleDateString() : '-'}</td>
                                    {(drillDownTarget === 'REJECTED' || drillDownTarget === 'WITHDRAWN') && (
                                        <td className="p-4 text-xs font-medium text-slate-600 max-w-[200px] truncate" title={c.rejectionReason}>{c.rejectionReason}</td>
                                    )}
                                    <td className="p-4 pr-6 text-right">
                                        <button onClick={() => navigate(c.jobId === 'general' ? '/general-interviews' : `/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1 ml-auto"><ExternalLink size={14}/> Ver</button>
                                    </td>
                                </tr>
                            )
                        })}
                        {list.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">Nenhum registro encontrado.</td></tr>}
                    </tbody>
                 </table>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 border border-transparent hover:border-slate-200 transition-all shadow-sm"><ArrowLeft size={22} /></button>
          <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Relatório Estratégico</h1>
              <p className="text-slate-500 text-sm">Visão executiva de performance e movimentação.</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => exportStrategicReport(kpis, startDate, endDate)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg text-xs uppercase tracking-widest transition-all"><Download size={16} /> Exportar Excel</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-2 px-2"><Calendar size={16} className="text-indigo-500" /><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" /></div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2"><Calendar size={16} className="text-rose-500" /><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2"><Building2 size={16} className="text-slate-400" /><select className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas Unidades</option>{settings.filter(s => s.type === 'UNIT').map(u => (<option key={u.id} value={u.name}>{u.name}</option>))}</select></div>
      </div>

      <div className="bg-indigo-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10"><Briefcase size={180}/></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
              <div 
                  onClick={() => setDrillDownTarget('ALL_ACTIVE')}
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  title="Ver todas as vagas ativas no período"
              >
                  <p className="text-indigo-200 font-bold uppercase tracking-widest text-xs mb-1">Volume Total Trabalhado</p>
                  <h2 className="text-5xl font-black">{kpis.allActive.total} <span className="text-2xl font-medium text-indigo-300">vagas ativas</span></h2>
                  <p className="text-indigo-300 text-sm mt-2 max-w-md">Vagas que estiveram abertas em algum momento dentro do período selecionado (Novas + Backlog).</p>
              </div>
              
              <div className="flex gap-4">
                  <div onClick={() => setDrillDownTarget('EXPANSION')} className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-all text-center min-w-[140px]">
                      <TrendingUp className="text-emerald-400 mx-auto mb-2" size={24}/>
                      <div className="text-2xl font-black">{kpis.expansion.total}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Aumento Quadro</div>
                  </div>
                  <div onClick={() => setDrillDownTarget('REPLACEMENT')} className="bg-white/10 p-4 rounded-2xl border border-white/20 backdrop-blur-sm cursor-pointer hover:bg-white/20 transition-all text-center min-w-[140px]">
                      <UserMinus className="text-rose-400 mx-auto mb-2" size={24}/>
                      <div className="text-2xl font-black">{kpis.replacement.total}</div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">Reposição</div>
                  </div>
              </div>
          </div>
      </div>

      <div>
         <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter mb-4 flex items-center gap-2"><Activity size={20}/> Movimentação de Vagas</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
             <StrategicCard title="Em Aberto (Antigas)" value={kpis.backlog.total} color="violet" icon={History} subtitle="Backlog anterior" onClick={() => setDrillDownTarget('BACKLOG')} />
             <StrategicCard title="Novas (Entrada)" value={kpis.openedNew.total} color="blue" icon={Briefcase} subtitle="Abertas neste intervalo" onClick={() => setDrillDownTarget('OPENED_NEW')} />
             <StrategicCard title="Canceladas" value={kpis.canceled.total} color="red" icon={XCircle} subtitle="Canceladas neste intervalo" onClick={() => setDrillDownTarget('CANCELED')} />
             <StrategicCard title="Congeladas" value={kpis.frozen.total} color="amber" icon={PauseCircle} subtitle="Congeladas neste intervalo" onClick={() => setDrillDownTarget('FROZEN')} />
             <StrategicCard title="Finalizadas (Saída)" value={kpis.closed.total} color="indigo" icon={CheckCircle} subtitle="Fechadas com sucesso" onClick={() => setDrillDownTarget('CLOSED')} />
             <StrategicCard title="Abertas (Saldo Final)" value={kpis.balanceOpen.total} color="emerald" icon={Layers} subtitle="Continuam p/ futuro" onClick={() => setDrillDownTarget('BALANCE_OPEN')} />
         </div>
      </div>

      <div>
         <h3 className="text-lg font-black text-slate-700 uppercase tracking-tighter mb-4 flex items-center gap-2"><Users size={20}/> Funil de Candidatos</h3>
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
             <StrategicCard title="Entrevistados" value={kpis.interviews.total} color="indigo" icon={Users} subtitle="Entrevistas realizadas" onClick={() => setDrillDownTarget('INTERVIEWS')} />
             <StrategicCard title="Testes Realizados" value={kpis.tests.total} color="violet" icon={ClipboardCheck} subtitle="Testes técnicos aplicados" onClick={() => setDrillDownTarget('TESTS')} />
             <StrategicCard title="Reprovados" value={kpis.rejected.total} color="rose" icon={XCircle} subtitle="Reprovações pela empresa" onClick={() => setDrillDownTarget('REJECTED')} />
             <StrategicCard title="Desistentes" value={kpis.withdrawn.total} color="orange" icon={UserX} subtitle="Desistências do processo" onClick={() => setDrillDownTarget('WITHDRAWN')} />
         </div>
      </div>

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
                      {Object.entries(kpis.bySector).filter(([_, d]: any) => d.opened+d.closed+d.frozen+d.canceled > 0).map(([sector, data]: [string, any]) => (
                          <tr key={sector} onClick={() => setSelectedSector(sector)} className="group cursor-pointer hover:bg-slate-50 transition-colors">
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

      {drillDownTarget && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20 mx-auto">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Search size={22} /></div>
                          <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                {drillDownTarget === 'EXPANSION' && "Vagas de Aumento de Quadro"}
                                {drillDownTarget === 'REPLACEMENT' && "Vagas de Substituição"}
                                {drillDownTarget === 'ALL_ACTIVE' && "Vagas Ativas (Total)"}
                                {drillDownTarget === 'BACKLOG' && "Vagas em Aberto (Antigas)"}
                                {drillDownTarget === 'OPENED_NEW' && "Novas Vagas (Entrada)"}
                                {drillDownTarget === 'CLOSED' && "Vagas Finalizadas (Saída)"}
                                {drillDownTarget === 'CANCELED' && "Vagas Canceladas"}
                                {drillDownTarget === 'FROZEN' && "Vagas Congeladas"}
                                {drillDownTarget === 'INTERVIEWS' && "Entrevistas Realizadas"}
                                {drillDownTarget === 'TESTS' && "Testes Técnicos"}
                                {drillDownTarget === 'REJECTED' && "Reprovações"}
                                {drillDownTarget === 'WITHDRAWN' && "Desistências"}
                                {drillDownTarget === 'SLA' && "Tempo de Fechamento"}
                                {drillDownTarget === 'BALANCE_OPEN' && "Saldo em Aberto (Final)"}
                            </h2>
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Registros encontrados no período</p>
                          </div>
                      </div>
                      <button onClick={() => setDrillDownTarget(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={26} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar bg-white p-0">
                      {getModalContent()}
                  </div>
              </div>
          </div>
      )}

      {selectedSector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[99999] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20 mx-auto">
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
        orange: "text-orange-600 bg-orange-50/50",
        violet: "text-violet-600 bg-violet-50/50",
        rose: "text-rose-600 bg-rose-50/50"
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
