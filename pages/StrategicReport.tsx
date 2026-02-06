import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  ArrowLeft, Download, Briefcase, CheckCircle, Users, 
  XCircle, PieChart, TrendingUp, Filter, UserX, 
  AlertTriangle, Calendar, Building2
} from 'lucide-react';
import { exportStrategicReport } from '../services/excelService';

export const StrategicReport: React.FC = () => {
  const navigate = useNavigate();
  const { jobs, candidates, settings } = useData();
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  const [unitFilter, setUnitFilter] = useState(''); // <--- NOVO ESTADO DE FILTRO

  // --- CÁLCULO DAS MÉTRICAS FILTRADAS ---
  const metrics = useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);

    const isWithin = (dateStr?: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr).getTime();
        return d >= start && d <= end;
    };

    // Filtro Base de Vagas (Data + Unidade)
    let fJobs = jobs.filter(j => isWithin(j.openedAt));
    if (unitFilter) {
        fJobs = fJobs.filter(j => j.unit === unitFilter);
    }

    const jobsOpened = fJobs;
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;
    
    // Vagas fechadas no período e unidade
    const jobsClosed = jobs.filter(j => 
        j.status === 'Fechada' && 
        isWithin(j.closedAt) && 
        (unitFilter ? j.unit === unitFilter : true)
    );

    // Relação por Área (Setores)
    const bySector: Record<string, { opened: number, closed: number }> = {};
    jobsOpened.forEach(j => { 
        if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0 };
        bySector[j.sector].opened++;
    });
    jobsClosed.forEach(j => {
        if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0 };
        bySector[j.sector].closed++;
    });

    // Filtro de Candidatos baseado nas vagas filtradas
    const jobIds = new Set(fJobs.map(j => j.id));
    const fCandidates = candidates.filter(c => jobIds.has(c.jobId));

    const interviews = fCandidates.filter(c => isWithin(c.interviewAt)).length;

    // Perdas Empresa
    const rejectedCandidates = fCandidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate));
    const rejectionReasons: Record<string, number> = {};
    rejectedCandidates.forEach(c => {
        const reason = c.rejectionReason || 'Não informado';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    });

    // Perdas Candidato
    const withdrawnCandidates = fCandidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate));
    const withdrawalReasons: Record<string, number> = {};
    withdrawnCandidates.forEach(c => {
        const reason = c.rejectionReason || 'Não informado';
        withdrawalReasons[reason] = (withdrawalReasons[reason] || 0) + 1;
    });

    return {
        opened: { total: jobsOpened.length, expansion, replacement },
        closed: { total: jobsClosed.length },
        bySector,
        interviews,
        rejected: { total: rejectedCandidates.length, reasons: rejectionReasons },
        withdrawn: { total: withdrawnCandidates.length, reasons: withdrawalReasons }
    };
  }, [jobs, candidates, startDate, endDate, unitFilter]);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2.5 hover:bg-white rounded-xl text-slate-500 hover:text-indigo-600 transition-all border border-transparent hover:border-slate-200 shadow-sm"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               Relatório Estratégico <PieChart className="text-indigo-600" size={28} />
            </h1>
            <p className="text-slate-500 font-medium italic">Indicadores de Desempenho e Inteligência de Perdas</p>
          </div>
        </div>

        <button 
            onClick={() => exportStrategicReport(metrics, startDate, endDate)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-emerald-100 transition-all active:scale-95 uppercase text-xs tracking-widest"
        >
            <Download size={20} /> Exportar Excel
        </button>
      </div>

      {/* BARRA DE FILTROS APRIMORADA */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200 w-full md:w-fit">
          <div className="flex items-center gap-3 px-3">
              <Calendar size={18} className="text-indigo-500" />
              <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none" />
              </div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
          <div className="flex items-center gap-3 px-3">
              <Calendar size={18} className="text-rose-500" />
              <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Término</span>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none" />
              </div>
          </div>
          <div className="w-px h-8 bg-slate-200 hidden md:block"></div>
          
          {/* SELETOR DE UNIDADE */}
          <div className="flex items-center gap-3 px-3">
              <Building2 size={18} className="text-slate-400" />
              <div className="flex flex-col">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Unidade</span>
                  <select 
                    className="text-sm font-bold text-slate-700 outline-none bg-transparent cursor-pointer"
                    value={unitFilter}
                    onChange={e => setUnitFilter(e.target.value)}
                  >
                      <option value="">Todas as Unidades</option>
                      {settings.filter(s => s.type === 'UNIT').map(u => (
                          <option key={u.id} value={u.name}>{u.name}</option>
                      ))}
                  </select>
              </div>
          </div>
      </div>

      {/* CARDS PRINCIPAIS */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-blue-100 relative overflow-hidden group shadow-sm">
              <Briefcase className="absolute -right-2 -bottom-2 text-blue-500/10 size-24 transform group-hover:translate-x-2 transition-transform" />
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2 relative z-10">Vagas Abertas</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.opened.total}</div>
              <div className="flex gap-2 mt-4 text-[9px] font-bold relative z-10">
                  <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">+{metrics.opened.expansion} Novo</span>
                  <span className="text-rose-500 bg-rose-50 px-2 py-1 rounded-lg">+{metrics.opened.replacement} Subst.</span>
              </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-emerald-100 relative overflow-hidden group shadow-sm">
              <CheckCircle className="absolute -right-2 -bottom-2 text-emerald-500/10 size-24 transform group-hover:translate-x-2 transition-transform" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2 relative z-10">Concluídas</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.closed.total}</div>
              <p className="mt-4 text-[10px] text-emerald-600 font-bold uppercase relative z-10">Sucesso no período</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-amber-100 relative overflow-hidden group shadow-sm">
              <Users className="absolute -right-2 -bottom-2 text-amber-500/10 size-24 transform group-hover:translate-x-2 transition-transform" />
              <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-2 relative z-10">Entrevistas</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.interviews}</div>
              <p className="mt-4 text-[10px] text-amber-600 font-bold uppercase relative z-10">Total realizadas</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-red-100 relative overflow-hidden group shadow-sm">
              <XCircle className="absolute -right-2 -bottom-2 text-red-500/10 size-24 transform group-hover:translate-x-2 transition-transform" />
              <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-2 relative z-10">Reprovações</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.rejected.total}</div>
              <p className="mt-4 text-[10px] text-red-600 font-bold uppercase relative z-10">Decisão Empresa</p>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-orange-100 relative overflow-hidden group shadow-sm">
              <UserX className="absolute -right-2 -bottom-2 text-orange-500/10 size-24 transform group-hover:translate-x-2 transition-transform" />
              <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-2 relative z-10">Desistências</span>
              <div className="text-4xl font-black text-slate-800 relative z-10">{metrics.withdrawn.total}</div>
              <p className="mt-4 text-[10px] text-orange-600 font-bold uppercase relative z-10">Decisão Candidato</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* RELAÇÃO POR ÁREA */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter">
                  <TrendingUp size={22} className="text-indigo-600"/> Relação por Área
              </h3>
              <div className="space-y-4">
                  {Object.entries(metrics.bySector)
                      .filter(([_, data]) => data.opened > 0 || data.closed > 0)
                      .map(([sector, data]) => (
                      <div key={sector} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-indigo-50/30">
                          <span className="font-black text-slate-700 text-sm">{sector}</span>
                          <div className="flex gap-3">
                              <div className="bg-white px-4 py-2 rounded-xl border border-blue-100 text-center min-w-[70px]">
                                  <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Abriu</span>
                                  <span className="text-blue-600 font-black text-lg">{data.opened}</span>
                              </div>
                              <div className="bg-white px-4 py-2 rounded-xl border border-emerald-100 text-center min-w-[70px]">
                                  <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Fechou</span>
                                  <span className="text-emerald-600 font-black text-lg">{data.closed}</span>
                              </div>
                          </div>
                      </div>
                  ))}
                  {Object.keys(metrics.bySector).length === 0 && <p className="text-slate-400 italic text-sm">Nenhum dado para os filtros aplicados.</p>}
              </div>
          </div>

          {/* INTELIGÊNCIA DE PERDAS */}
          <div className="flex flex-col gap-8">
              <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-sm border-l-8 border-l-red-500">
                  <h3 className="text-sm font-black text-red-800 uppercase mb-6 flex items-center gap-3 tracking-widest">
                      <Filter size={18}/> Motivos de Reprovação (Empresa)
                  </h3>
                  <div className="space-y-4">
                      {Object.entries(metrics.rejected.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                          <div key={reason} className="flex flex-col gap-2">
                              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                  <span className="uppercase">{reason}</span>
                                  <span className="text-red-600">{count} perdas</span>
                              </div>
                              <div className="w-full h-2 bg-red-50 rounded-full overflow-hidden">
                                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${(count / (metrics.rejected.total || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      ))}
                      {metrics.rejected.total === 0 && <p className="text-slate-400 italic text-sm">Sem reprovações.</p>}
                  </div>
              </div>

              <div className="bg-white p-8 rounded-3xl border border-orange-100 shadow-sm border-l-8 border-l-orange-500">
                  <h3 className="text-sm font-black text-orange-800 uppercase mb-6 flex items-center gap-3 tracking-widest">
                      <AlertTriangle size={18}/> Motivos de Desistência (Candidato)
                  </h3>
                  <div className="space-y-4">
                      {Object.entries(metrics.withdrawn.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                          <div key={reason} className="flex flex-col gap-2">
                              <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                  <span className="uppercase">{reason}</span>
                                  <span className="text-orange-600">{count} perdas</span>
                              </div>
                              <div className="w-full h-2 bg-orange-50 rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(count / (metrics.withdrawn.total || 1)) * 100}%` }}></div>
                              </div>
                          </div>
                      ))}
                      {metrics.withdrawn.total === 0 && <p className="text-slate-400 italic text-sm">Sem desistências.</p>}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
