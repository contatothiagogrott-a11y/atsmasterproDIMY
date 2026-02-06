import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { X, Download, Briefcase, CheckCircle, Users, XCircle, PieChart, TrendingUp, Filter, UserX, AlertTriangle, Search, Target } from 'lucide-react';
import { exportStrategicReport } from '../services/excelService';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
  const { jobs, candidates } = useData();
  
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  const metrics = useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);

    const isWithin = (dateStr?: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr).getTime();
        return d >= start && d <= end;
    };

    const jobsOpened = jobs.filter(j => isWithin(j.openedAt));
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;
    const jobsClosed = jobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));

    const bySector: Record<string, { opened: number, closed: number }> = {};
    jobs.forEach(j => { if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0 }; });
    jobsOpened.forEach(j => bySector[j.sector].opened++);
    jobsClosed.forEach(j => bySector[j.sector].closed++);

    const interviews = candidates.filter(c => isWithin(c.interviewAt)).length;

    // SEPARAÇÃO DE PERDAS
    const rejectedCandidates = candidates.filter(c => c.status === 'Reprovado' && isWithin(c.rejectionDate));
    const rejectionReasons: Record<string, number> = {};
    rejectedCandidates.forEach(c => {
        const reason = c.rejectionReason || 'Não informado';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    });

    const withdrawnCandidates = candidates.filter(c => c.status === 'Desistência' && isWithin(c.rejectionDate));
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
  }, [jobs, candidates, startDate, endDate]);

  if (!isOpen) return null;

  return (
    // FIX Z-INDEX: z-[999] garante que fique acima da barra lateral
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto flex flex-col animate-fadeIn">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl sticky top-0 z-20">
           <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-700">
                 <PieChart size={24} />
              </div>
              <div>
                 <h2 className="text-xl font-bold text-slate-800">Relatório Estratégico</h2>
                 <p className="text-sm text-slate-500">Analytics de Recrutamento & Seleção</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X size={24} />
           </button>
        </div>

        {/* Filtros */}
        <div className="p-6 bg-white border-b border-slate-100 flex flex-wrap gap-4 items-end sticky top-[88px] z-10 shadow-sm">
            <div className="flex gap-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Período De</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2 rounded-lg text-slate-700 font-medium outline-none focus:border-indigo-500 text-sm" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Até</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2 rounded-lg text-slate-700 font-medium outline-none focus:border-indigo-500 text-sm" />
                </div>
            </div>
            <button 
                onClick={() => exportStrategicReport(metrics, startDate, endDate)}
                className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
            >
                <Download size={18} /> Exportar Excel
            </button>
        </div>

        {/* Conteúdo */}
        <div className="p-8 space-y-8 bg-slate-50/30">
            
            {/* Indicadores Principais */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                    <span className="text-[10px] font-bold text-blue-500 uppercase">Vagas Abertas</span>
                    <div className="text-3xl font-black text-slate-800 mt-1">{metrics.opened.total}</div>
                    <div className="flex gap-2 mt-2 text-[9px] font-bold uppercase">
                        <span className="text-indigo-600">{metrics.opened.expansion} Novo</span>
                        <span className="text-rose-500">{metrics.opened.replacement} Subst.</span>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                    <span className="text-[10px] font-bold text-emerald-500 uppercase">Concluídas</span>
                    <div className="text-3xl font-black text-slate-800 mt-1">{metrics.closed.total}</div>
                    <div className="mt-2 text-[9px] text-emerald-600 font-bold uppercase">Sucesso</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                    <span className="text-[10px] font-bold text-amber-500 uppercase">Entrevistas</span>
                    <div className="text-3xl font-black text-slate-800 mt-1">{metrics.interviews}</div>
                    <div className="mt-2 text-[9px] text-amber-600 font-bold uppercase">Realizadas</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                    <span className="text-[10px] font-bold text-red-500 uppercase">Reprovações</span>
                    <div className="text-3xl font-black text-slate-800 mt-1">{metrics.rejected.total}</div>
                    <div className="mt-2 text-[9px] text-red-600 font-bold uppercase">Pela Empresa</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                    <span className="text-[10px] font-bold text-orange-500 uppercase">Desistências</span>
                    <div className="text-3xl font-black text-slate-800 mt-1">{metrics.withdrawn.total}</div>
                    <div className="mt-2 text-[9px] text-orange-600 font-bold uppercase">Pelo Candidato</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Movimentação por Setor */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-blue-600"/> Movimentação por Setor
                    </h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(metrics.bySector)
                            .filter(([_, data]) => data.opened > 0 || data.closed > 0)
                            .sort((a,b) => b[1].opened - a[1].opened)
                            .map(([sector, data]) => (
                            <div key={sector} className="flex justify-between items-center text-sm p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <span className="font-bold text-slate-700">{sector}</span>
                                <div className="flex gap-2 text-center">
                                    <div className="bg-white px-2 py-1 rounded border border-blue-100 w-16">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase block">Abriu</span>
                                        <span className="text-blue-600 font-black">{data.opened}</span>
                                    </div>
                                    <div className="bg-white px-2 py-1 rounded border border-emerald-100 w-16">
                                        <span className="text-[8px] text-slate-400 font-bold uppercase block">Fechou</span>
                                        <span className="text-emerald-600 font-black">{data.closed}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Motivos de Perdas (Empresa e Candidato) */}
                <div className="space-y-6">
                    {/* Motivos Empresa */}
                    <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
                        <h3 className="text-sm font-bold text-red-800 uppercase mb-4 flex items-center gap-2">
                            <Filter size={16}/> Motivos de Reprovação (Empresa)
                        </h3>
                        <div className="space-y-2">
                            {Object.entries(metrics.rejected.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                                <div key={reason} className="flex items-center text-xs">
                                    <span className="w-32 truncate font-medium text-slate-600" title={reason}>{reason}</span>
                                    <div className="flex-1 h-2 bg-red-50 rounded-full overflow-hidden mx-2">
                                        <div className="h-full bg-red-500" style={{ width: `${(count / (metrics.rejected.total || 1)) * 100}%` }}></div>
                                    </div>
                                    <span className="font-bold text-red-700 w-4 text-right">{count}</span>
                                </div>
                            ))}
                            {metrics.rejected.total === 0 && <p className="text-slate-400 text-xs italic">Sem registros no período.</p>}
                        </div>
                    </div>

                    {/* Motivos Candidato */}
                    <div className="bg-white p-6 rounded-xl border border-orange-100 shadow-sm">
                        <h3 className="text-sm font-bold text-orange-800 uppercase mb-4 flex items-center gap-2">
                            <AlertTriangle size={16}/> Motivos de Desistência (Candidato)
                        </h3>
                        <div className="space-y-2">
                            {Object.entries(metrics.withdrawn.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                                <div key={reason} className="flex items-center text-xs">
                                    <span className="w-32 truncate font-medium text-slate-600" title={reason}>{reason}</span>
                                    <div className="flex-1 h-2 bg-orange-50 rounded-full overflow-hidden mx-2">
                                        <div className="h-full bg-orange-500" style={{ width: `${(count / (metrics.withdrawn.total || 1)) * 100}%` }}></div>
                                    </div>
                                    <span className="font-bold text-orange-700 w-4 text-right">{count}</span>
                                </div>
                            ))}
                            {metrics.withdrawn.total === 0 && <p className="text-slate-400 text-xs italic">Sem registros no período.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
