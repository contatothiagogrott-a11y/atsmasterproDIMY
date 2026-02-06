import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Download, Briefcase, CheckCircle, Users, 
  XCircle, PieChart, TrendingUp, Filter, UserX, 
  AlertTriangle, Calendar, Building2, Lock, Unlock, X,
  PauseCircle, Beaker, ClipboardCheck
} from 'lucide-react';
import { exportStrategicReport } from '../services/excelService';

export const StrategicReport: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, candidates, settings, user } = useData();
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState('');
  
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

  // --- CÁLCULO DAS MÉTRICAS ESTRATÉGICAS ---
  const metrics = useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);

    const isWithin = (dateStr?: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr).getTime();
        return d >= start && d <= end;
    };

    // 1. FILTRO DE ACESSIBILIDADE E UNIDADE
    const baseJobs = jobs.filter(j => {
        const matchesUnit = unitFilter ? j.unit === unitFilter : true;
        const isPublic = !j.isConfidential;
        const canSeeConfidential = isConfidentialUnlocked && (user?.role === 'MASTER' || j.createdBy === user?.id || j.allowedUserIds?.includes(user?.id || ''));
        return matchesUnit && (isPublic || canSeeConfidential);
    });

    const jobIds = new Set(baseJobs.map(j => j.id));
    const baseCandidates = candidates.filter(c => jobIds.has(c.jobId));

    // 2. KPIs DO TOPO (RESPEITANDO DATA E UNIDADE)
    const jobsOpened = baseJobs.filter(j => isWithin(j.openedAt));
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;
    const jobsClosed = baseJobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));
    
    const interviewsCount = baseCandidates.filter(c => isWithin(c.interviewAt)).length;
    const rejectedCount = baseCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).length;
    const withdrawnCount = baseCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).length;

    // 3. RELAÇÃO POR ÁREA (FUNIL COMPLETO)
    const bySector: Record<string, any> = {};
    
    // Inicializa setores existentes nas vagas filtradas
    baseJobs.forEach(j => {
        if (!bySector[j.sector]) {
            bySector[j.sector] = { 
                opened: 0, closed: 0, frozen: 0, canceled: 0, 
                interviews: 0, tests: 0, rejected: 0, withdrawn: 0 
            };
        }
    });

    // Contagem de Vagas por Setor
    baseJobs.forEach(j => {
        if (isWithin(j.openedAt)) bySector[j.sector].opened++;
        if (j.status === 'Fechada' && isWithin(j.closedAt)) bySector[j.sector].closed++;
        if (j.status === 'Congelada' && isWithin(j.frozenAt)) bySector[j.sector].frozen++;
        if (j.status === 'Cancelada' && isWithin(j.closedAt)) bySector[j.sector].canceled++;
    });

    // Contagem de Candidatos por Setor (Mapeado via Job)
    baseCandidates.forEach(c => {
        const job = baseJobs.find(j => j.id === c.jobId);
        if (!job) return;
        const sector = job.sector;

        if (isWithin(c.interviewAt)) bySector[sector].interviews++;
        if (c.techTest && isWithin(c.techTestDate)) bySector[sector].tests++;
        if (c.status === 'Reprovado' && isWithin(c.rejectionDate)) bySector[sector].rejected++;
        if (c.status === 'Desistência' && isWithin(c.rejectionDate)) bySector[sector].withdrawn++;
    });

    // Motivos de Perda para os cards de detalhamento
    const rejectionReasons: Record<string, number> = {};
    baseCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).forEach(c => {
        const r = c.rejectionReason || 'Não informado';
        rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
    });

    const withdrawalReasons: Record<string, number> = {};
    baseCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).forEach(c => {
        const r = c.rejectionReason || 'Não informado';
        withdrawalReasons[r] = (withdrawalReasons[r] || 0) + 1;
    });

    return {
        opened: { total: jobsOpened.length, expansion, replacement },
        closed: { total: jobsClosed.length },
        interviews: interviewsCount,
        rejected: { total: rejectedCount, reasons: rejectionReasons },
        withdrawn: { total: withdrawnCount, reasons: withdrawalReasons },
        bySector
    };
  }, [jobs, candidates, startDate, endDate, unitFilter, isConfidentialUnlocked, user]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200 shadow-sm"><ArrowLeft size={24} /></button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">Relatório Estratégico <PieChart className="text-indigo-600" size={28} /></h1>
            <p className="text-slate-500 font-medium italic">Dashboard Analítico de Performance {unitFilter && ` - Unidade: ${unitFilter}`}</p>
          </div>
        </div>

        <div className="flex gap-3">
            {hasConfidentialAccess && (
              <button 
                onClick={() => isConfidentialUnlocked ? setIsConfidentialUnlocked(false) : setIsUnlockModalOpen(true)}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all border ${isConfidentialUnlocked ? 'bg-amber-100 border-amber-300 text-amber-700 shadow-lg shadow-amber-100' : 'bg-white border-slate-300 text-slate-400'}`}
              >
                {isConfidentialUnlocked ? <Unlock size={18} /> : <Lock size={18} />} {isConfidentialUnlocked ? "Sigilo Aberto" : "Ativar Sigilo"}
              </button>
            )}
            <button onClick={() => exportStrategicReport(metrics, startDate, endDate)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-emerald-100 transition-all active:scale-95 uppercase text-xs tracking-widest"><Download size={20} /> Exportar Excel</button>
        </div>
      </div>

      {/* FILTROS DINÂMICOS */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 w-full md:w-fit">
          <div className="flex items-center gap-3 px-3"><Calendar size={18} className="text-indigo-500" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div></div>
          <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-3 px-3"><Calendar size={18} className="text-rose-500" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Término</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div></div>
          <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-3 px-3"><Building2 size={18} className="text-slate-400" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtrar Unidade</span><select className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas as Unidades</option>{settings.filter(s => s.type === 'UNIT').map(u => (<option key={u.id} value={u.name}>{u.name}</option>))}</select></div></div>
      </div>

      {/* KPIs SUPERIORES (ATUALIZAM COM FILTRO) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-blue-100 relative overflow-hidden group shadow-sm">
              <Briefcase className="absolute -right-2 -bottom-2 text-blue-500/5 size-24" />
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2 relative z-10">Vagas Abertas</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.opened.total}</div>
              <div className="flex gap-2 mt-4 text-[9px] font-bold relative z-10"><span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">+{metrics.opened.expansion} Novo</span><span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">+{metrics.opened.replacement} Subst.</span></div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-emerald-100 relative overflow-hidden group shadow-sm">
              <CheckCircle className="absolute -right-2 -bottom-2 text-emerald-500/5 size-24" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2 relative z-10">Concluídas</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.closed.total}</div>
              <p className="mt-4 text-[10px] text-emerald-600 font-bold uppercase relative z-10">Sucesso no período</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-amber-100 relative overflow-hidden group shadow-sm">
              <Users className="absolute -right-2 -bottom-2 text-amber-500/5 size-24" />
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-2 relative z-10">Entrevistas</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.interviews}</div>
              <p className="mt-4 text-[10px] text-amber-600 font-bold uppercase relative z-10">Total realizadas</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-red-100 relative overflow-hidden group shadow-sm">
              <XCircle className="absolute -right-2 -bottom-2 text-red-500/5 size-24" />
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-2 relative z-10">Reprovações</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.rejected.total}</div>
              <p className="mt-4 text-[10px] text-red-600 font-bold uppercase relative z-10">Decisão Empresa</p>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-orange-100 relative overflow-hidden group shadow-sm">
              <UserX className="absolute -right-2 -bottom-2 text-orange-500/5 size-24" />
              <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-2 relative z-10">Desistências</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.withdrawn.total}</div>
              <p className="mt-4 text-[10px] text-orange-600 font-bold uppercase relative z-10">Decisão Candidato</p>
          </div>
      </div>

      {/* RELAÇÃO POR ÁREA EXPANDIDA */}
      <div className="grid grid-cols-1 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter"><TrendingUp size={22} className="text-indigo-600"/> Relação por Área (Funil Completo)</h3>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                      <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest">
                              <th className="pb-4 pl-2">Setor / Área</th>
                              <th className="pb-4 text-center">Abertas</th>
                              <th className="pb-4 text-center">Concluídas</th>
                              <th className="pb-4 text-center">Congeladas</th>
                              <th className="pb-4 text-center">Canceladas</th>
                              <th className="pb-4 text-center bg-indigo-50/30">Entrevistas</th>
                              <th className="pb-4 text-center bg-indigo-50/30">Testes</th>
                              <th className="pb-4 text-center bg-red-50/30">Reprovados</th>
                              <th className="pb-4 text-center bg-orange-50/30 pr-2">Desistentes</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {Object.entries(metrics.bySector).map(([sector, data]: [string, any]) => (
                              <tr key={sector} className="group hover:bg-slate-50/80 transition-colors">
                                  <td className="py-4 pl-2 font-black text-slate-700 text-sm">{sector}</td>
                                  <td className="py-4 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-black">{data.opened}</span></td>
                                  <td className="py-4 text-center"><span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-black">{data.closed}</span></td>
                                  <td className="py-4 text-center"><span className="bg-amber-50 text-amber-700 px-2 py-1 rounded-lg font-black">{data.frozen}</span></td>
                                  <td className="py-4 text-center"><span className="bg-red-50 text-red-600 px-2 py-1 rounded-lg font-black">{data.canceled}</span></td>
                                  
                                  <td className="py-4 text-center bg-indigo-50/30 font-black text-indigo-700">{data.interviews}</td>
                                  <td className="py-4 text-center bg-indigo-50/30 font-black text-indigo-700">{data.tests}</td>
                                  
                                  <td className="py-4 text-center bg-red-50/30 font-black text-red-600">{data.rejected}</td>
                                  <td className="py-4 text-center bg-orange-50/30 font-black text-orange-600 pr-2">{data.withdrawn}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  {Object.keys(metrics.bySector).length === 0 && <p className="text-center py-12 text-slate-400 italic">Nenhum dado encontrado para os filtros selecionados.</p>}
              </div>
          </div>
      </div>

      {/* INTELIGÊNCIA DE PERDAS (DETALHAMENTO) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-sm border-l-8 border-l-red-500">
              <h3 className="text-sm font-black text-red-800 uppercase mb-6 flex items-center gap-3 tracking-widest"><Filter size={18}/> Motivos de Reprovação (Empresa)</h3>
              <div className="space-y-4">
                  {Object.entries(metrics.rejected.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                      <div key={reason} className="flex flex-col gap-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500"><span className="uppercase">{reason}</span><span className="text-red-600">{count} perdas</span></div>
                          <div className="w-full h-2 bg-red-50 rounded-full overflow-hidden"><div className="h-full bg-red-500 rounded-full" style={{ width: `${(count / (metrics.rejected.total || 1)) * 100}%` }}></div></div>
                      </div>
                  ))}
                  {metrics.rejected.total === 0 && <p className="text-slate-400 italic text-sm">Sem reprovações.</p>}
              </div>
          </div>

          <div className="bg-white p-8 rounded-3xl border border-orange-100 shadow-sm border-l-8 border-l-orange-500">
              <h3 className="text-sm font-black text-orange-800 uppercase mb-6 flex items-center gap-3 tracking-widest"><AlertTriangle size={18}/> Motivos de Desistência (Candidato)</h3>
              <div className="space-y-4">
                  {Object.entries(metrics.withdrawn.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                      <div key={reason} className="flex flex-col gap-2">
                          <div className="flex justify-between text-[11px] font-bold text-slate-500"><span className="uppercase">{reason}</span><span className="text-orange-600">{count} perdas</span></div>
                          <div className="w-full h-2 bg-orange-50 rounded-full overflow-hidden"><div className="h-full bg-orange-500 rounded-full" style={{ width: `${(count / (metrics.withdrawn.total || 1)) * 100}%` }}></div></div>
                      </div>
                  ))}
                  {metrics.withdrawn.total === 0 && <p className="text-slate-400 italic text-sm">Sem desistências.</p>}
              </div>
          </div>
      </div>

      {/* MODAL DE SEGURANÇA */}
      {isUnlockModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border-t-8 border-amber-500 animate-fadeIn">
                  <div className="flex justify-center mb-6 bg-amber-100 w-20 h-20 rounded-full items-center mx-auto text-amber-600"><Lock size={40} /></div>
                  <h3 className="text-xl font-bold text-center mb-2">Segurança de Dados</h3>
                  <p className="text-center text-slate-500 text-sm mb-6">Confirme sua senha administrativa para incluir vagas sigilosas.</p>
                  <form onSubmit={handleUnlockSubmit}>
                      <input type="password" autoFocus placeholder="Senha Master" className="w-full border border-slate-200 p-4 rounded-2xl mb-4 text-center font-bold outline-none focus:ring-4 focus:ring-amber-100" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                      <button type="submit" className="w-full bg-amber-600 text-white font-black py-4 rounded-2xl hover:bg-amber-700 shadow-lg transition-all uppercase text-xs tracking-widest">Desbloquear Dados</button>
                      <button type="button" onClick={() => { setIsUnlockModalOpen(false); setUnlockPassword(''); }} className="w-full py-3 text-slate-400 text-xs font-bold hover:text-slate-600 mt-2">Cancelar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
