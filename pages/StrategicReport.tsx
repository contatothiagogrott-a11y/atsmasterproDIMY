import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Download, Briefcase, CheckCircle, Users, 
  XCircle, PieChart, TrendingUp, Filter, UserX, 
  AlertTriangle, Calendar, Building2, Lock, Unlock, X,
  PauseCircle, Beaker, ExternalLink, ChevronRight
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
  
  // Estado para a "Branch" (Setor selecionado para detalhamento)
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

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

  // --- MÉTODOS DE FILTRO ---
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
  const isWithin = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr).getTime();
      return d >= start && d <= end;
  };

  // Vagas acessíveis baseadas no sigilo e unidade
  const accessibleJobs = useMemo(() => jobs.filter(j => {
      const matchesUnit = unitFilter ? j.unit === unitFilter : true;
      const isPublic = !j.isConfidential;
      const canSeeConfidential = isConfidentialUnlocked && (user?.role === 'MASTER' || j.createdBy === user?.id || j.allowedUserIds?.includes(user?.id || ''));
      return matchesUnit && (isPublic || canSeeConfidential);
  }), [jobs, unitFilter, isConfidentialUnlocked, user]);

  // Candidatos vinculados a essas vagas
  const jobIds = useMemo(() => new Set(accessibleJobs.map(j => j.id)), [accessibleJobs]);
  const accessibleCandidates = useMemo(() => candidates.filter(c => jobIds.has(c.jobId)), [candidates, jobIds]);

  // --- MÉTRICAS GERAIS ---
  const metrics = useMemo(() => {
    const jobsOpened = accessibleJobs.filter(j => isWithin(j.openedAt));
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;
    const jobsClosed = accessibleJobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));
    
    const interviewsCount = accessibleCandidates.filter(c => isWithin(c.interviewAt)).length;
    const rejectedCount = accessibleCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).length;
    const withdrawnCount = accessibleCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).length;

    // Resumo por Setor (Apenas Vagas)
    const bySector: Record<string, any> = {};
    accessibleJobs.forEach(j => {
        if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0, frozen: 0, canceled: 0 };
        if (isWithin(j.openedAt)) bySector[j.sector].opened++;
        if (j.status === 'Fechada' && isWithin(j.closedAt)) bySector[j.sector].closed++;
        if (j.status === 'Congelada' && isWithin(j.frozenAt)) bySector[j.sector].frozen++;
        if (j.status === 'Cancelada' && isWithin(j.closedAt)) bySector[j.sector].canceled++;
    });

    const rejectionReasons: Record<string, number> = {};
    accessibleCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).forEach(c => {
        const r = c.rejectionReason || 'Não informado';
        rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
    });

    const withdrawalReasons: Record<string, number> = {};
    accessibleCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).forEach(c => {
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
  }, [accessibleJobs, accessibleCandidates, startDate, endDate]);

  // --- DADOS DA BRANCH (DETALHAMENTO DE VAGAS POR SETOR) ---
  const sectorBranchData = useMemo(() => {
    if (!selectedSector) return [];
    
    return accessibleJobs
      .filter(j => j.sector === selectedSector && (isWithin(j.openedAt) || (j.closedAt && isWithin(j.closedAt))))
      .map(job => {
        const cands = candidates.filter(c => c.jobId === job.id);
        return {
            id: job.id,
            title: job.title,
            status: job.status,
            interviews: cands.filter(c => isWithin(c.interviewAt)).length,
            tests: cands.filter(c => c.techTest && isWithin(c.techTestDate)).length,
            rejected: cands.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).length,
            withdrawn: cands.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).length
        };
      });
  }, [selectedSector, accessibleJobs, candidates, startDate, endDate]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* HEADER E FILTROS (Mantidos como no passo anterior) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 border border-transparent hover:border-slate-200 transition-all shadow-sm"><ArrowLeft size={24} /></button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">Relatório Estratégico <PieChart className="text-indigo-600" size={28} /></h1>
            <p className="text-slate-500 font-medium italic">Indicadores Analíticos por Área e Performance</p>
          </div>
        </div>
        <div className="flex gap-3">
            {hasConfidentialAccess && (
              <button onClick={() => isConfidentialUnlocked ? setIsConfidentialUnlocked(false) : setIsUnlockModalOpen(true)} className={`flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest border transition-all ${isConfidentialUnlocked ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-400'}`}>
                {isConfidentialUnlocked ? <Unlock size={18} /> : <Lock size={18} />} {isConfidentialUnlocked ? "Sigilo Aberto" : "Ativar Sigilo"}
              </button>
            )}
            <button onClick={() => exportStrategicReport(metrics, startDate, endDate)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 shadow-xl transition-all active:scale-95 uppercase text-xs tracking-widest"><Download size={20} /> Excel</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-3 px-3"><Calendar size={18} className="text-indigo-500" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div></div>
          <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-3 px-3"><Calendar size={18} className="text-rose-500" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Término</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div></div>
          <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-3 px-3"><Building2 size={18} className="text-slate-400" /><div className="flex flex-col"><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Filtrar Unidade</span><select className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas as Unidades</option>{settings.filter(s => s.type === 'UNIT').map(u => (<option key={u.id} value={u.name}>{u.name}</option>))}</select></div></div>
      </div>

      {/* KPIs SUPERIORES (Mantidos como no passo anterior) */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-blue-100 shadow-sm"><span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2">Vagas Abertas</span><div className="text-4xl font-black text-slate-800">{metrics.opened.total}</div><div className="flex gap-2 mt-4 text-[9px] font-bold"><span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">+{metrics.opened.expansion} Novo</span><span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">+{metrics.opened.replacement} Subst.</span></div></div>
          <div className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm"><span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Concluídas</span><div className="text-4xl font-black text-slate-800">{metrics.closed.total}</div><p className="mt-4 text-[10px] text-emerald-600 font-bold uppercase">Sucesso no período</p></div>
          <div className="bg-white p-6 rounded-3xl border border-amber-100 shadow-sm"><span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-2">Entrevistas</span><div className="text-4xl font-black text-slate-800">{metrics.interviews}</div><p className="mt-4 text-[10px] text-amber-600 font-bold uppercase tracking-wide">Candidatos avaliados</p></div>
          <div className="bg-white p-6 rounded-3xl border border-red-100 shadow-sm"><span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-2">Reprovações</span><div className="text-4xl font-black text-slate-800">{metrics.rejected.total}</div><p className="mt-4 text-[10px] text-red-600 font-bold uppercase">Empresa</p></div>
          <div className="bg-white p-6 rounded-3xl border border-orange-100 shadow-sm"><span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-2">Desistências</span><div className="text-4xl font-black text-slate-800">{metrics.withdrawn.total}</div><p className="mt-4 text-[10px] text-orange-600 font-bold uppercase">Candidato</p></div>
      </div>

      {/* RELAÇÃO POR ÁREA (SIMPLIFICADA CONFORME SOLICITADO) */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter"><TrendingUp size={22} className="text-indigo-600"/> Relação por Área</h3>
          <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                  <thead>
                      <tr className="border-b border-slate-100 text-slate-400 font-black uppercase tracking-widest">
                          <th className="pb-4 pl-2">Setor / Área</th>
                          <th className="pb-4 text-center">Abertas</th>
                          <th className="pb-4 text-center">Concluídas</th>
                          <th className="pb-4 text-center">Congeladas</th>
                          <th className="pb-4 text-center">Canceladas</th>
                          <th className="pb-4 pr-2 text-right">Ver Detalhes</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {Object.entries(metrics.bySector).map(([sector, data]: [string, any]) => (
                          <tr 
                            key={sector} 
                            onClick={() => setSelectedSector(sector)} // <--- CLIQUE PARA ABRIR A BRANCH
                            className="group cursor-pointer hover:bg-slate-50 transition-colors"
                          >
                              <td className="py-4 pl-2 font-black text-slate-700 text-sm group-hover:text-indigo-600">{sector}</td>
                              <td className="py-4 text-center"><span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg font-black">{data.opened}</span></td>
                              <td className="py-4 text-center"><span className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg font-black">{data.closed}</span></td>
                              <td className="py-4 text-center"><span className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-black">{data.frozen}</span></td>
                              <td className="py-4 text-center"><span className="bg-red-50 text-red-600 px-2.5 py-1 rounded-lg font-black">{data.canceled}</span></td>
                              <td className="py-4 pr-2 text-right"><ChevronRight size={18} className="inline text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" /></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* JANELA DE BRANCH (DETALHAMENTO DE VAGAS DO SETOR) */}
      {selectedSector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 lg:p-8 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100"><TrendingUp size={22} /></div>
                          <div>
                              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Detalhamento: {selectedSector}</h2>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Resumo de movimentação e funil por vaga</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedSector(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={24} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest">
                              <tr>
                                  <th className="p-4 rounded-l-xl">Título da Vaga</th>
                                  <th className="p-4 text-center">Status</th>
                                  <th className="p-4 text-center bg-indigo-50/50">Entrevistas</th>
                                  <th className="p-4 text-center bg-indigo-50/50">Testes</th>
                                  <th className="p-4 text-center bg-red-50/50">Reprovados</th>
                                  <th className="p-4 text-center bg-orange-50/50">Desistentes</th>
                                  <th className="p-4 text-right rounded-r-xl">Ação</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {sectorBranchData.map(vaga => (
                                  <tr key={vaga.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 font-black text-slate-700 text-sm">{vaga.title}</td>
                                      <td className="p-4 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                              vaga.status === 'Aberta' ? 'bg-blue-100 text-blue-700' : 
                                              vaga.status === 'Fechada' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                          }`}>{vaga.status}</span>
                                      </td>
                                      <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/20">{vaga.interviews}</td>
                                      <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/20">{vaga.tests}</td>
                                      <td className="p-4 text-center font-black text-red-600 bg-red-50/20">{vaga.rejected}</td>
                                      <td className="p-4 text-center font-black text-orange-600 bg-orange-50/20">{vaga.withdrawn}</td>
                                      <td className="p-4 text-right">
                                          <button 
                                            onClick={() => navigate(`/jobs/${vaga.id}`)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg shadow-sm shadow-indigo-100 transition-all flex items-center gap-2 ml-auto font-bold uppercase text-[9px]"
                                          >
                                              <ExternalLink size={14} /> Ir para Vaga
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      {sectorBranchData.length === 0 && <p className="text-center py-12 text-slate-400 italic">Nenhuma movimentação para esta área no período.</p>}
                  </div>
              </div>
          </div>
      )}

      {/* MODAL DE SEGURANÇA (Mantido igual) */}
      {isUnlockModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[10001] p-4">
              <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm border-t-8 border-amber-500 animate-fadeIn">
                  <div className="flex justify-center mb-6 bg-amber-100 w-20 h-20 rounded-full items-center mx-auto text-amber-600"><Lock size={40} /></div>
                  <h3 className="text-xl font-bold text-center mb-2">Segurança de Dados</h3>
                  <p className="text-center text-slate-500 text-sm mb-6">Confirme sua senha Master para incluir vagas sigilosas.</p>
                  <form onSubmit={handleUnlockSubmit}>
                      <input type="password" autoFocus placeholder="Senha Master" className="w-full border border-slate-200 p-4 rounded-2xl mb-4 text-center font-bold outline-none focus:ring-4 focus:ring-amber-100" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                      <button type="submit" className="w-full bg-amber-600 text-white font-black py-4 rounded-2xl hover:bg-amber-700 shadow-lg uppercase text-xs tracking-widest">Desbloquear</button>
                      <button type="button" onClick={() => { setIsUnlockModalOpen(false); setUnlockPassword(''); }} className="w-full py-3 text-slate-400 text-xs font-bold hover:text-slate-600 mt-2">Cancelar</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};
