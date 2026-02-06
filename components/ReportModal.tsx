import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { X, Calendar, Download, Briefcase, CheckCircle, Users, XCircle, PieChart, TrendingUp, Filter } from 'lucide-react';
import { exportStrategicReport } from '../services/excelService';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose }) => {
  const { jobs, candidates } = useData();
  
  // Datas padrão: Início do mês atual até hoje
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);

  // --- CÁLCULO DAS MÉTRICAS ---
  const metrics = useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000); // Inclui o dia final inteiro

    // Helper para checar datas
    const isWithin = (dateStr?: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr).getTime();
        return d >= start && d <= end;
    };

    // 1. VAGAS ABERTAS NO PERÍODO
    const jobsOpened = jobs.filter(j => isWithin(j.openedAt));
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;

    // 2. VAGAS FECHADAS NO PERÍODO
    const jobsClosed = jobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));

    // 3. POR SETOR
    const bySector: Record<string, { opened: number, closed: number }> = {};
    // Popula setores
    jobs.forEach(j => {
        if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0 };
    });
    jobsOpened.forEach(j => bySector[j.sector].opened++);
    jobsClosed.forEach(j => bySector[j.sector].closed++);

    // 4. ENTREVISTAS (Baseado na data da entrevista)
    const interviews = candidates.filter(c => isWithin(c.interviewAt)).length;

    // 5. REPROVAÇÕES/PERDAS (Baseado na data de rejeição)
    const rejectedCandidates = candidates.filter(c => 
        (c.status === 'Reprovado' || c.status === 'Desistência') && isWithin(c.rejectionDate)
    );
    
    const rejectionReasons: Record<string, number> = {};
    rejectedCandidates.forEach(c => {
        const reason = c.rejectionReason || 'Não informado';
        rejectionReasons[reason] = (rejectionReasons[reason] || 0) + 1;
    });

    return {
        opened: { total: jobsOpened.length, expansion, replacement },
        closed: { total: jobsClosed.length },
        bySector,
        interviews,
        rejected: { total: rejectedCandidates.length, reasons: rejectionReasons }
    };
  }, [jobs, candidates, startDate, endDate]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
           <div className="flex items-center gap-3">
              <div className="bg-indigo-100 p-2.5 rounded-lg text-indigo-700">
                 <PieChart size={24} />
              </div>
              <div>
                 <h2 className="text-xl font-bold text-slate-800">Relatório Estratégico</h2>
                 <p className="text-sm text-slate-500">Métricas de produtividade e perdas</p>
              </div>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-600 transition-colors">
              <X size={24} />
           </button>
        </div>

        {/* Filtros de Data */}
        <div className="p-6 bg-white border-b border-slate-100 flex flex-wrap gap-4 items-end">
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data Início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border p-2 rounded-lg text-slate-700 font-medium outline-none focus:border-indigo-500" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Data Fim</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border p-2 rounded-lg text-slate-700 font-medium outline-none focus:border-indigo-500" />
            </div>
            <button 
                onClick={() => exportStrategicReport(metrics, startDate, endDate)}
                className="ml-auto bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
                <Download size={18} /> Exportar Excel
            </button>
        </div>

        {/* Corpo do Relatório */}
        <div className="p-8 space-y-8 bg-slate-50/50">
            
            {/* 1. Cards Principais */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-blue-500 uppercase">Vagas Abertas</span>
                        <Briefcase size={18} className="text-blue-200"/>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{metrics.opened.total}</div>
                    <div className="flex gap-2 mt-2 text-[10px] font-medium text-slate-500">
                        <span className="bg-blue-50 px-1.5 py-0.5 rounded text-blue-700">+{metrics.opened.expansion} Aumento</span>
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded">+{metrics.opened.replacement} Subst.</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-emerald-500 uppercase">Concluídas</span>
                        <CheckCircle size={18} className="text-emerald-200"/>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{metrics.closed.total}</div>
                    <div className="mt-2 text-xs text-emerald-600 font-medium">Sucesso no período</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-amber-500 uppercase">Entrevistas</span>
                        <Users size={18} className="text-amber-200"/>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{metrics.interviews}</div>
                    <div className="mt-2 text-xs text-amber-600 font-medium">Candidatos avaliados</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-bold text-red-500 uppercase">Reprovações</span>
                        <XCircle size={18} className="text-red-200"/>
                    </div>
                    <div className="text-3xl font-black text-slate-800">{metrics.rejected.total}</div>
                    <div className="mt-2 text-xs text-red-600 font-medium">Perdas no funil</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 2. Detalhamento por Setor */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center gap-2">
                        <TrendingUp size={16} className="text-slate-400"/> Movimentação por Setor
                    </h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(metrics.bySector)
                            .filter(([_, data]) => data.opened > 0 || data.closed > 0)
                            .sort((a,b) => b[1].opened - a[1].opened)
                            .map(([sector, data]) => (
                            <div key={sector} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded">
                                <span className="font-medium text-slate-700">{sector}</span>
                                <div className="flex gap-3">
                                    {data.opened > 0 && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded text-xs font-bold">+{data.opened} Abertas</span>}
                                    {data.closed > 0 && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs font-bold">-{data.closed} Fechadas</span>}
                                </div>
                            </div>
                        ))}
                        {Object.keys(metrics.bySector).length === 0 && <p className="text-slate-400 text-xs">Sem dados.</p>}
                    </div>
                </div>

                {/* 3. Motivos de Perda */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-800 uppercase mb-4 flex items-center gap-2">
                        <Filter size={16} className="text-slate-400"/> Motivos de Perda
                    </h3>
                    <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {Object.entries(metrics.rejected.reasons)
                            .sort((a,b) => b[1] - a[1])
                            .map(([reason, count]) => (
                            <div key={reason} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded">
                                <span className="text-slate-600 truncate max-w-[200px]" title={reason}>{reason}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-400" style={{ width: `${(count / metrics.rejected.total) * 100}%` }}></div>
                                    </div>
                                    <span className="font-bold text-slate-800 w-6 text-right">{count}</span>
                                </div>
                            </div>
                        ))}
                        {metrics.rejected.total === 0 && <p className="text-slate-400 text-xs">Nenhuma reprovação no período.</p>}
                    </div>
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};