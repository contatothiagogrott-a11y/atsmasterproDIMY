import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { exportToExcel } from '../services/excelService';
import { Download, Activity, TrendingDown, UserX, Building, Filter, TrendingUp, UserMinus, LayoutList, Lock, Unlock, X, PieChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { isWithinInterval, parseISO, endOfDay, startOfDay } from 'date-fns';
import { ReportModal } from '../components/ReportModal'; // <--- IMPORT NOVO

export const Reports: React.FC = () => {
  const { jobs, candidates, settings, user, users } = useData();
  
  // GLOBAL FILTERS
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // NEW: Report Type Logic
  const [reportType, setReportType] = useState<'HYBRID' | 'BACKLOG' | 'FLOW'>('HYBRID');

  // Confidential Security
  const [isConfidentialUnlocked, setIsConfidentialUnlocked] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');

  // NEW: Modal State
  const [isReportOpen, setIsReportOpen] = useState(false); // <--- ESTADO NOVO

  const filteredData = useMemo(() => {
    // SECURITY: STRICT FILTER - ONLY SHOW CONFIDENTIAL IF UNLOCKED
    let fJobs = jobs.filter(j => !j.isHidden && (isConfidentialUnlocked || !j.isConfidential));
    
    // Apply filters
    if (sectorFilter) {
      fJobs = fJobs.filter(j => j.sector === sectorFilter);
    }
    if (unitFilter) {
      fJobs = fJobs.filter(j => j.unit === unitFilter);
    }

    if (startDate && endDate) {
      const filterStart = startOfDay(parseISO(startDate));
      const filterEnd = endOfDay(parseISO(endDate));

      fJobs = fJobs.filter(j => {
         const opened = parseISO(j.openedAt);
         const closed = j.closedAt ? parseISO(j.closedAt) : null;
         
         if (reportType === 'FLOW') {
            // New Openings Only: Created strictly inside the period
            return isWithinInterval(opened, { start: filterStart, end: filterEnd });
         } else if (reportType === 'BACKLOG') {
            // Active during period: Opened BEFORE end AND (Closed AFTER start OR Still Open)
            const isOpenBeforeEnd = opened <= filterEnd;
            const isClosedAfterStart = !closed || closed >= filterStart;
            return isOpenBeforeEnd && isClosedAfterStart;
         } else {
            // HYBRID (General/Intersection): Standard intersection logic
            const openInRange = isWithinInterval(opened, { start: filterStart, end: filterEnd });
            const closeInRange = closed ? isWithinInterval(closed, { start: filterStart, end: filterEnd }) : false;
            // Also include if it spans the whole period (Backlog logic covers this too, but let's be explicit for "Touching")
            const spansPeriod = opened <= filterEnd && (!closed || closed >= filterStart);
            
            return openInRange || closeInRange || spansPeriod;
         }
      });
    }

    const jobIds = new Set(fJobs.map(j => j.id));
    const fCandidates = candidates.filter(c => jobIds.has(c.jobId));
    
    return { fJobs, fCandidates };
  }, [jobs, candidates, sectorFilter, unitFilter, startDate, endDate, isConfidentialUnlocked, reportType]);

  const { fJobs, fCandidates } = filteredData;

  const summary = useMemo(() => {
    const expansion = fJobs.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === 'Aumento de Quadro').length;
    const replacement = fJobs.filter(j => j.openingDetails?.reason === 'Substituição').length;
    return { expansion, replacement };
  }, [fJobs]);

  const charts = useMemo(() => {
    const rejected = fCandidates.filter(c => c.status === 'Reprovado');
    const withdrawn = fCandidates.filter(c => c.status === 'Proposta Recusada' || c.status === 'Desistência'); 

    const processReasons = (list: any[]) => {
      const counts: Record<string, number> = {};
      list.forEach(c => {
        const reason = c.rejectionReason?.trim() || 'Sem Motivo';
        const norm = reason.charAt(0).toUpperCase() + reason.slice(1);
        counts[norm] = (counts[norm] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    };

    return {
      companyDecisions: processReasons(rejected),
      candidateDecisions: processReasons(withdrawn),
      funnel: [
        { name: 'Inscritos', value: fCandidates.length, color: '#3b82f6' },
        { name: 'Entrevistados', value: fCandidates.filter(c => c.timeline?.interview).length, color: '#8b5cf6' },
        { name: 'Aprovados', value: fCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length, color: '#10b981' },
      ]
    };
  }, [fCandidates]);

  const handleUnlockConfidential = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockPassword === user?.password || user?.role === 'MASTER') {
      setIsConfidentialUnlocked(true);
      setIsUnlockModalOpen(false);
      setUnlockPassword('');
    } else {
      alert('Senha incorreta.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">Relatórios Inteligentes</h1>
            <p className="text-slate-500 text-sm">Filtre por período e unidade para métricas precisas.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
            {/* Confidential Mode Button */}
            <button 
              onClick={() => isConfidentialUnlocked ? setIsConfidentialUnlocked(false) : setIsUnlockModalOpen(true)}
              className={`p-2 rounded-lg transition-colors border flex items-center gap-2 text-xs font-bold ${isConfidentialUnlocked ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-400'}`}
              title={isConfidentialUnlocked ? "Ocultar Dados Sigilosos" : "Exibir Dados Sigilosos"}
            >
              {isConfidentialUnlocked ? <Unlock size={16} /> : <Lock size={16} />}
              <span className="hidden sm:inline">{isConfidentialUnlocked ? "Modo Sigiloso Ativo" : "Ativar Sigilo"}</span>
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            <select 
              className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none font-bold text-slate-700"
              value={reportType}
              onChange={e => setReportType(e.target.value as any)}
            >
              <option value="HYBRID">Visão Geral (Híbrido)</option>
              <option value="BACKLOG">Em Aberto (Backlog)</option>
              <option value="FLOW">Novas (Fluxo Entrada)</option>
            </select>

            <select 
              className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none"
              value={unitFilter}
              onChange={e => setUnitFilter(e.target.value)}
            >
              <option value="">Todas Unidades</option>
              {settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select 
              className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none"
              value={sectorFilter}
              onChange={e => setSectorFilter(e.target.value)}
            >
              <option value="">Todos Setores</option>
              {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-1 bg-slate-50 rounded-lg border border-slate-200 px-2">
              <span className="text-xs text-slate-400 font-bold">DE</span>
              <input type="date" className="bg-transparent text-sm p-2 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-xs text-slate-400 font-bold">ATÉ</span>
              <input type="date" className="bg-transparent text-sm p-2 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            
            {/* NOVO BOTÃO ESTRATÉGICO */}
            <button onClick={() => setIsReportOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-indigo-700 ml-2 shadow transition-all">
              <PieChart size={18}/> Análise Estratégica (BI)
            </button>

            <button onClick={() => exportToExcel(fJobs, fCandidates, users)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 font-bold hover:bg-green-700 ml-2 shadow transition-all hover:scale-105 active:scale-95">
              <Download size={18}/> Excel
            </button>
        </div>
      </div>

      {/* Unlock Confidential Modal */}
      {isUnlockModalOpen && (
          <div className="fixed inset-0 bg-amber-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm border-t-4 border-amber-500">
                  <div className="flex justify-center mb-4 bg-amber-100 w-16 h-16 rounded-full items-center mx-auto text-amber-600">
                      <Lock size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-center mb-2">Segurança de Dados</h3>
                  <p className="text-center text-slate-500 text-sm mb-6">
                      Você está tentando acessar relatórios que incluem vagas sigilosas. Confirme sua senha.
                  </p>
                  <form onSubmit={handleUnlockConfidential}>
                      <input 
                        type="password" 
                        autoFocus
                        placeholder="Senha administrativa" 
                        className="w-full border p-3 rounded-lg mb-4 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
                        value={unlockPassword}
                        onChange={e => setUnlockPassword(e.target.value)}
                      />
                      <button type="submit" className="w-full bg-amber-600 text-white font-bold py-3 rounded-lg hover:bg-amber-700 shadow-lg">Desbloquear Relatório</button>
                      <button type="button" onClick={() => { setIsUnlockModalOpen(false); setUnlockPassword(''); }} className="w-full mt-3 text-slate-400 text-sm hover:underline">Cancelar</button>
                  </form>
              </div>
          </div>
      )}

      {/* Motivação de Abertura Summary Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
               <TrendingUp size={24} />
            </div>
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vagas de Expansão</p>
               <h4 className="text-2xl font-black text-slate-800">{summary.expansion} <span className="text-sm font-normal text-slate-400">vagas selecionadas</span></h4>
            </div>
         </div>
         <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="bg-rose-100 p-3 rounded-full text-rose-600">
               <UserMinus size={24} />
            </div>
            <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Vagas de Reposição</p>
               <h4 className="text-2xl font-black text-slate-800">{summary.replacement} <span className="text-sm font-normal text-slate-400">vagas selecionadas</span></h4>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Funnel */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity size={20} className="text-blue-600"/> Funil Geral (Seleção)</h3>
           <div className="h-64 w-full" style={{ minHeight: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={charts.funnel} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false}/>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} fontSize={12} fontWeight={600} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{fill: 'transparent'}} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
                       {charts.funnel.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Bar>
                 </BarChart>
              </ResponsiveContainer>
           </div>
        </div>

        {/* Company Rejections */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-red-600"><Building size={20}/> Reprovações (Decisão Empresa)</h3>
           <div className="space-y-3 h-64 overflow-y-auto pr-2 custom-scrollbar">
              {charts.companyDecisions.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-slate-600 truncate" title={item.name}>{item.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-red-500" style={{width: `${Math.min((item.value/(fCandidates.length || 1))*100 * 5, 100)}%`}}></div></div>
                  <span className="text-xs font-bold">{item.value}</span>
                </div>
              ))}
              {charts.companyDecisions.length === 0 && <p className="text-slate-400 text-sm italic">Sem dados para os filtros selecionados.</p>}
           </div>
        </div>

        {/* Candidate Withdrawals */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-amber-600"><UserX size={20}/> Desistências (Decisão Candidato)</h3>
           <div className="space-y-3 h-64 overflow-y-auto pr-2 custom-scrollbar">
              {charts.candidateDecisions.map((item, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="w-40 text-sm font-medium text-slate-600 truncate" title={item.name}>{item.name}</span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-500" style={{width: `${Math.min((item.value/(fCandidates.length || 1))*100 * 5, 100)}%`}}></div></div>
                  <span className="text-xs font-bold">{item.value}</span>
                </div>
              ))}
              {charts.candidateDecisions.length === 0 && <p className="text-slate-400 text-sm italic">Sem dados para os filtros selecionados.</p>}
           </div>
        </div>
      </div>

      {/* Detailed Opening Table */}
      <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isConfidentialUnlocked ? 'border-amber-300 ring-2 ring-amber-50' : 'border-slate-200'}`}>
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
           <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><LayoutList size={20} className="text-indigo-600" /> Detalhamento de Motivação de Abertura {isConfidentialUnlocked && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded ml-2">CONFIDENCIAL ATIVO</span>}</h3>
           <p className="text-xs text-slate-500 mt-1">Lista detalhada das vagas filtradas e seus motivos de solicitação.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Vaga</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Motivo Abertura</th>
                <th className="px-6 py-4">Substituído</th>
                <th className="px-6 py-4">Motivo Saída</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fJobs.map(job => (
                <tr key={job.id} className={`hover:bg-slate-50/80 transition-colors ${job.isConfidential ? 'bg-amber-50/20' : ''}`}>
                  <td className="px-6 py-4 font-bold text-slate-700 flex items-center gap-2">
                    {job.title}
                    {job.isConfidential && <Lock size={12} className="text-amber-500" />}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      job.status === 'Aberta' ? 'bg-blue-100 text-blue-700' : 
                      job.status === 'Fechada' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${
                      job.openingDetails?.reason === 'Substituição' ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                    }`}>
                      {job.openingDetails?.reason || 'Aumento de Quadro'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {job.openingDetails?.reason === 'Substituição' ? (job.openingDetails.replacedEmployee || '-') : '-'}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs italic">
                    {job.openingDetails?.reason === 'Substituição' ? (job.openingDetails.replacementReason || '-') : '-'}
                  </td>
                </tr>
              ))}
              {fJobs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhuma vaga encontrada para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REPORT MODAL INJECTION */}
      <ReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} />
    </div>
  );
};
