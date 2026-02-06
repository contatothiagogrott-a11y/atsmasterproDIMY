import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
// CORREÇÃO: Adicionado Calendar, Search e Target na importação
import { 
  X, 
  Download, 
  Briefcase, 
  CheckCircle, 
  Users, 
  XCircle, 
  PieChart, 
  TrendingUp, 
  Filter, 
  UserX, 
  AlertTriangle, 
  Calendar,
  Search, 
  Target 
} from 'lucide-react';
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

  // --- CÁLCULO DAS MÉTRICAS ESTRATÉGICAS ---
  const metrics = useMemo(() => {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + (24 * 60 * 60 * 1000); 

    const isWithin = (dateStr?: string) => {
        if (!dateStr) return false;
        const d = new Date(dateStr).getTime();
        return d >= start && d <= end;
    };

    // 1. ANÁLISE DE VAGAS
    const jobsOpened = jobs.filter(j => isWithin(j.openedAt));
    const expansion = jobsOpened.filter(j => j.openingDetails?.reason === 'Aumento de Quadro').length;
    const replacement = jobsOpened.filter(j => j.openingDetails?.reason === 'Substituição').length;
    const jobsClosed = jobs.filter(j => j.status === 'Fechada' && isWithin(j.closedAt));

    // 2. MOVIMENTAÇÃO POR SETOR
    const bySector: Record<string, { opened: number, closed: number }> = {};
    jobs.forEach(j => { 
        if (!bySector[j.sector]) bySector[j.sector] = { opened: 0, closed: 0 }; 
    });
    jobsOpened.forEach(j => bySector[j.sector].opened++);
    jobsClosed.forEach(j => bySector[j.sector].closed++);

    // 3. ENTREVISTAS REALIZADAS
    const interviews = candidates.filter(c => isWithin(c.interviewAt)).length;

    // 4. ANÁLISE DE PERDAS SEPARADA (EMPRESA VS CANDIDATO)
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
    // FIX Z-INDEX: z-[9999] garante que cubra a barra lateral
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[9999] p-4 lg:p-8">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col animate-fadeIn border border-white/20">
        
        {/* Header Superior */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-30">
           <div className="flex items-center gap-4">
              <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
                 <PieChart size={28} />
              </div>
              <div>
                 <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Relatório Estratégico de BI</h2>
                 <p className="text-sm text-slate-500 font-medium italic">Indicadores de Desempenho e Inteligência de Perdas</p>
              </div>
           </div>
           <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500 transition-all">
              <X size={28} />
           </button>
        </div>

        {/* Barra de Filtros e Exportação */}
        <div className="px-8 py-6 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 px-3">
                    <Calendar size={18} className="text-indigo-500" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Início</span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                    </div>
                </div>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="flex items-center gap-3 px-3">
                    <Calendar size={18} className="text-rose-500" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Término</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm font-bold text-slate-700 outline-none cursor-pointer" />
                    </div>
                </div>
            </div>

            <button 
                onClick={() => exportStrategicReport(metrics, startDate, endDate)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-emerald-100 transition-all active:scale-95 uppercase text-xs tracking-widest"
            >
                <Download size={20} /> Baixar Relatório (Excel)
            </button>
        </div>

        {/* Área de Dados Rolável */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-10 bg-white">
            
            {/* Bloco 1: KPIs de Fluxo */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 relative overflow-hidden group">
                    <Briefcase className="absolute -right-4 -bottom-4 text-blue-100 size-24 transform group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-2">Vagas Abertas</span>
                    <div className="text-4xl font-black text-slate-800">{metrics.opened.total}</div>
                    <div className="flex gap-3 mt-4 text-[10px] font-bold">
                        <span className="text-indigo-600 bg-white px-2 py-1 rounded-lg border border-indigo-100">+{metrics.opened.expansion} Novo</span>
                        <span className="text-rose-500 bg-white px-2 py-1 rounded-lg border border-rose-100">+{metrics.opened.replacement} Subst.</span>
                    </div>
                </div>

                <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 relative overflow-hidden group">
                    <CheckCircle className="absolute -right-4 -bottom-4 text-emerald-100 size-24 transform group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2">Concluídas</span>
                    <div className="text-4xl font-black text-slate-800">{metrics.closed.total}</div>
                    <p className="mt-4 text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Sucesso de Fechamento</p>
                </div>

                <div className="bg-amber-50/50 p-6 rounded-3xl border border-amber-100 relative overflow-hidden group">
                    <Users className="absolute -right-4 -bottom-4 text-amber-100 size-24 transform group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest block mb-2">Entrevistas</span>
                    <div className="text-4xl font-black text-slate-800">{metrics.interviews}</div>
                    <p className="mt-4 text-[10px] text-amber-600 font-bold uppercase tracking-wide">Candidatos Triados</p>
                </div>

                <div className="bg-red-50/50 p-6 rounded-3xl border border-red-100 relative overflow-hidden group">
                    <XCircle className="absolute -right-4 -bottom-4 text-red-100 size-24 transform group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-red-600 uppercase tracking-widest block mb-2">Reprovações</span>
                    <div className="text-4xl font-black text-slate-800">{metrics.rejected.total}</div>
                    <p className="mt-4 text-[10px] text-red-600 font-bold uppercase tracking-wide">Decisão da Empresa</p>
                </div>

                <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 relative overflow-hidden group">
                    <UserX className="absolute -right-4 -bottom-4 text-orange-100 size-24 transform group-hover:scale-110 transition-transform" />
                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-2">Desistências</span>
                    <div className="text-4xl font-black text-slate-800">{metrics.withdrawn.total}</div>
                    <p className="mt-4 text-[10px] text-orange-600 font-bold uppercase tracking-wide">Decisão do Candidato</p>
                </div>
            </div>

            {/* Bloco 2: Gráficos e Tabelas */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Movimentação por Setor */}
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm h-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3 uppercase tracking-tighter">
                        <TrendingUp size={22} className="text-indigo-600"/> Movimentação por Área/Setor
                    </h3>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                        {Object.entries(metrics.bySector)
                            .filter(([_, data]) => data.opened > 0 || data.closed > 0)
                            .sort((a,b) => b[1].opened - a[1].opened)
                            .map(([sector, data]) => (
                            <div key={sector} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors group">
                                <span className="font-black text-slate-700 text-sm">{sector}</span>
                                <div className="flex gap-3">
                                    <div className="bg-white px-4 py-2 rounded-xl border border-blue-100 text-center min-w-[70px]">
                                        <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Abertas</span>
                                        <span className="text-blue-600 font-black text-lg">{data.opened}</span>
                                    </div>
                                    <div className="bg-white px-4 py-2 rounded-xl border border-emerald-100 text-center min-w-[70px]">
                                        <span className="text-[8px] text-slate-400 font-black uppercase block mb-1">Fechadas</span>
                                        <span className="text-emerald-600 font-black text-lg">{data.closed}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Motivos de Perdas */}
                <div className="flex flex-col gap-8">
                    
                    {/* Reprovações Empresa */}
                    <div className="bg-white p-8 rounded-3xl border border-red-100 shadow-sm border-l-8 border-l-red-500">
                        <h3 className="text-sm font-black text-red-800 uppercase mb-6 flex items-center gap-3 tracking-widest">
                            <Filter size={18}/> Motivos de Reprovação (Empresa)
                        </h3>
                        <div className="space-y-4">
                            {Object.entries(metrics.rejected.reasons).sort((a,b) => b[1] - a[1]).map(([reason, count]) => (
                                <div key={reason} className="flex flex-col gap-2">
                                    <div className="flex justify-between text-[11px] font-bold text-slate-500">
                                        <span className="truncate max-w-[250px] uppercase">{reason}</span>
                                        <span className="text-red-600">{count} perdas</span>
                                    </div>
                                    <div className="w-full h-2.5 bg-red-50 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 rounded-full shadow-inner
