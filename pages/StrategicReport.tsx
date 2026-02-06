import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Download, Briefcase, CheckCircle, Users, 
  XCircle, PieChart, TrendingUp, Filter, UserX, 
  AlertTriangle, Calendar, Building2, Lock, Unlock, X,
  ChevronRight, ExternalLink, ClipboardCheck 
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

  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
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

  const metrics = useMemo(() => {
    const jobsOpened = accessibleJobs.filter(j => isWithin(j.openedAt));
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;
    const jobsClosed = accessibleJobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));
    
    const jobIds = new Set(accessibleJobs.map(j => j.id));
    const fCandidates = candidates.filter(c => jobIds.has(c.jobId));

    // --- CÁLCULO DOS MOTIVOS (NECESSÁRIO PARA O EXCEL NÃO MORRER) ---
    const rejectionReasons: Record<string, number> = {};
    fCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).forEach(c => {
        const r = c.rejectionReason || 'Não informado';
        rejectionReasons[r] = (rejectionReasons[r] || 0) + 1;
    });

    const withdrawalReasons: Record<string, number> = {};
    fCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).forEach(c => {
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
        opened: { total: jobsOpened.length, expansion, replacement },
        closed: { total: jobsClosed.length },
        interviews: fCandidates.filter(c => isWithin(c.interviewAt)).length,
        tests: fCandidates.filter(c => c.techTest && isWithin(c.techTestDate)).length,
        rejected: { total: fCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).length, reasons: rejectionReasons },
        withdrawn: { total: fCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).length, reasons: withdrawalReasons },
        bySector
    };
  }, [accessibleJobs, candidates, startDate, endDate]);

  const sectorBranchData = useMemo(() => {
    if (!selectedSector) return [];
    return accessibleJobs
      .filter(j => j.sector === selectedSector && (isWithin(j.openedAt) || (j.closedAt && isWithin(j.closedAt))))
      .map(job => {
        const cands = candidates.filter(c => c.jobId === job.id);
        return {
            id: job.id,
            title: job.title,
            interviews: cands.filter(c => isWithin(c.interviewAt)).length,
            tests: cands.filter(c => c.techTest && isWithin(c.techTestDate)).length,
            rejected: cands.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate)).length,
            withdrawn: cands.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate)).length
        };
      });
  }, [selectedSector, accessibleJobs, candidates, startDate, endDate]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 border border-transparent hover:border-slate-200 transition-all shadow-sm"><ArrowLeft size={22} /></button>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Relatório Estratégico</h1>
        </div>
        <div className="flex gap-2">
            {hasConfidentialAccess && (
              <button onClick={() => isConfidentialUnlocked ? setIsConfidentialUnlocked(false) : setIsUnlockModalOpen(true)} className={`px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all ${isConfidentialUnlocked ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-400'}`}>
                {isConfidentialUnlocked ? <Unlock size={14} className="inline mr-1" /> : <Lock size={14} className="inline mr-1" />} Sigilo
              </button>
            )}
            <button 
                onClick={() => exportStrategicReport(metrics, startDate, endDate)} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm text-xs uppercase tracking-widest transition-all active:scale-95"
            >
                <Download size={16} /> Excel
            </button>
        </div>
      </div>

      {/* FILTROS */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-2 px-2"><Calendar size={16} className="text-indigo-500" /><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent" /></div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2"><Calendar size={16} className="text-rose-500" /><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none bg-transparent" /></div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 px-2"><Building2 size={16} className="text-slate-400" /><select className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas Unidades</option>{settings.filter(s => s.type === 'UNIT').map(u => (<option key={u.id} value={u.name}>{u.name}</option>))}</select></div>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StrategicCard title="Abertas" value={metrics.opened.total} color="blue" icon={Briefcase} subtitle={`+${metrics.opened.expansion} Novo | +${metrics.opened.replacement} Subst.`} />
          <StrategicCard title="Concluídas" value={metrics.closed.total} color="emerald" icon={CheckCircle} subtitle="No período" />
          <StrategicCard title="Entrevistas" value={metrics.interviews} color="amber" icon={Users} subtitle="Realizadas" />
          <StrategicCard title="Testes" value={metrics.tests} color="indigo" icon={ClipboardCheck} subtitle="Realizados" />
          <StrategicCard title="Reprovações" value={metrics.rejected.total} color="red" icon={XCircle} subtitle="Pela Empresa" />
          <StrategicCard title="Desistências" value={metrics.withdrawn.total} color="orange" icon={UserX} subtitle="Candidato" />
      </div>

      {/* RELAÇÃO POR ÁREA */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center gap-2 bg-slate-50/30"><TrendingUp size={20} className="text-indigo-600"/><h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Relação por Área</h3></div>
          <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                  <thead>
                      <tr className="bg-slate-50/80 text-slate-400 font-black uppercase tracking-widest border-b border-slate-100">
                          <th className="p-4 pl-6 text-left">Setor / Departamento</th>
                          <th className="p-4 text-center">Abertas</th>
                          <th className="p-4 text-center">Fechadas</th>
                          <th className="p-4 text-center">Cong.</th>
                          <th className="p-4 text-center">Canc.</th>
                          <th className="p-4 pr-6 text-right">Ação</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                      {Object.entries(metrics.bySector).filter(([_, d]: any) => d.opened+d.closed+d.frozen+d.canceled > 0).map(([sector, data]: [string, any]) => (
                          <tr key={sector} onClick={() => setSelectedSector(sector)} className="group cursor-pointer hover:bg-indigo-50/30 transition-colors text-left">
                              <td className="py-4 pl-6 font-black text-slate-700 text-sm group-hover:text-indigo-600 transition-colors">{sector}</td>
                              <td className="py-4 text-center"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-black">{data.opened}</span></td>
                              <td className="py-4 text-center"><span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg font-black">{data.closed}</span></td>
                              <td className="py-4 text-center text-slate-400">{data.frozen}</td>
                              <td className="py-4 text-center text-slate-400">{data.canceled}</td>
                              <td className="py-4 pr-6 text-right"><ChevronRight size={18} className="inline text-slate-300 group-hover:text-indigo-500 transform group-hover:translate-x-1 transition-all" /></td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* JANELA DE BRANCH (DETALHAMENTO) - CENTRALIZADA E CORRIGIDA */}
      {selectedSector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[99999] p-4 lg:p-8 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-100"><TrendingUp size={22} /></div>
                          <div className="text-left">
                              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tighter leading-tight">Área: {selectedSector}</h2>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Resumo operacional detalhado</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedSector(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all"><X size={26} /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                      <table className="w-full text-left text-xs">
                          <thead className="text-slate-400 font-black uppercase tracking-widest text-[9px] border-b border-slate-100">
                              <tr>
                                  <th className="p-3 pl-4 text-left">Solicitação / Vaga</th>
                                  <th className="p-3 text-center bg-indigo-50/50">Ent.</th>
                                  <th className="p-3 text-center bg-indigo-50/50">Test.</th>
                                  <th className="p-3 text-center bg-red-50/50">Rep.</th>
                                  <th className="p-3 text-center bg-orange-50/50">Des.</th>
                                  <th className="p-3 pr-4 text-right">Ação</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {sectorBranchData.map(vaga => (
                                  <tr key={vaga.id} className="hover:bg-slate-50 transition-colors text-left">
                                      <td className="p-4 pl-4 font-black text-slate-700 text-sm truncate max-w-[250px]">{vaga.title}</td>
                                      <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/10">{vaga.interviews}</td>
                                      <td className="p-4 text-center font-black text-indigo-600 bg-indigo-50/10">{vaga.tests}</td>
                                      <td className="p-4 text-center font-black text-red-600 bg-red-50/10">{vaga.rejected}</td>
                                      <td className="p-4 text-center font-black text-orange-600 bg-orange-50/10">{vaga.withdrawn}</td>
                                      <td className="p-4 pr-4 text-right">
                                          <button 
                                            onClick={() => navigate(`/jobs/${vaga.id}`)} 
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg shadow-sm transition-all inline-flex items-center gap-1 font-black uppercase text-[9px]"
                                          >
                                              <ExternalLink size={14} /> Gestão
                                          </button>
                                      </td>
                                  </tr>
                              ))}
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

const StrategicCard = ({ title, value, color, icon: Icon, subtitle }: any) => {
    const colorClasses: any = {
        blue: "text-blue-600 bg-blue-50/50",
        emerald: "text-emerald-600 bg-emerald-50/50",
        amber: "text-amber-600 bg-amber-50/50",
        indigo: "text-indigo-600 bg-indigo-50/50",
        red: "text-red-600 bg-red-50/50",
        orange: "text-orange-600 bg-orange-50/50"
    };

    return (
        <div className="p-5 rounded-3xl border border-slate-100 relative overflow-hidden bg-white shadow-sm flex flex-col justify-between min-h-[110px] group transition-all hover:shadow-md text-left">
            <Icon className={`absolute -right-2 -bottom-2 opacity-[0.07] size-20 transform group-hover:scale-110 transition-transform ${colorClasses[color]}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest relative z-10 ${colorClasses[color]}`}>{title}</span>
            <div className="text-4xl font-black text-slate-800 relative z-10 tracking-tighter">{value}</div>
            <p className="text-[9px] font-bold text-slate-400 uppercase relative z-10 truncate">{subtitle}</p>
        </div>
    );
};
