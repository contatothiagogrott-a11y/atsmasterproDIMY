import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Briefcase, Users, CheckCircle, XCircle, Clock, AlertCircle, 
  Building2, TrendingUp, UserMinus, Lock, Unlock, X, 
  PieChart as PieChartIcon, ChevronRight, ExternalLink 
} from 'lucide-react';
import { isWithinInterval, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { jobs, candidates, settings, user } = useData();
  const navigate = useNavigate();
  
  // Filtros
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showConfidential, setShowConfidential] = useState(false);

  // Estado para detalhamento (Drill-down)
  const [drillDownType, setDrillDownType] = useState<'Aumento de Quadro' | 'Substituição' | null>(null);

  // Verificação de Permissão
  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some(j => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const filteredData = useMemo(() => {
    let fJobs = jobs.filter(j => !j.isHidden);
    
    fJobs = fJobs.filter(j => {
        if (!j.isConfidential) return true;
        if (!user) return false;
        return user.role === 'MASTER' || j.createdBy === user.id || j.allowedUserIds?.includes(user.id);
    });

    if (!showConfidential) {
        fJobs = fJobs.filter(j => !j.isConfidential);
    }

    if (sectorFilter) fJobs = fJobs.filter(j => j.sector === sectorFilter);
    if (unitFilter) fJobs = fJobs.filter(j => j.unit === unitFilter);
    
    if (startDate && endDate) {
      fJobs = fJobs.filter(j => isWithinInterval(parseISO(j.openedAt), { 
        start: parseISO(startDate), 
        end: parseISO(endDate) 
      }));
    }

    const jobIds = new Set(fJobs.map(j => j.id));
    const fCandidates = candidates.filter(c => jobIds.has(c.jobId));

    return { fJobs, fCandidates };
  }, [jobs, candidates, sectorFilter, unitFilter, startDate, endDate, showConfidential, user]);

  const { fJobs, fCandidates } = filteredData;

  const kpis = {
    open: fJobs.filter(j => j.status === 'Aberta').length,
    closed: fJobs.filter(j => j.status === 'Fechada').length,
    frozen: fJobs.filter(j => j.status === 'Congelada').length,
    canceled: fJobs.filter(j => j.status === 'Cancelada').length,
    totalCandidates: fCandidates.length,
    inTest: fCandidates.filter(c => c.status === 'Em Teste').length,
    approved: fCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length,
    internalRecruitment: fCandidates.filter(c => c.origin === 'Recrutamento Interno').length,
    expansion: fJobs.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === 'Aumento de Quadro').length,
    replacement: fJobs.filter(j => j.openingDetails?.reason === 'Substituição').length
  };

  const statusChartData = [
    { name: 'Aberta', value: kpis.open, color: '#3b82f6' },
    { name: 'Fechada', value: kpis.closed, color: '#10b981' },
    { name: 'Congelada', value: kpis.frozen, color: '#f59e0b' },
    { name: 'Cancelada', value: kpis.canceled, color: '#ef4444' },
  ];

  // Filtra as vagas para a janela de detalhamento
  const drillDownJobs = useMemo(() => {
    if (!drillDownType) return [];
    return fJobs.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === drillDownType);
  }, [drillDownType, fJobs]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header e Filtros */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 font-medium">Indicadores operacionais em tempo real</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <button 
                onClick={() => navigate('/strategic-report')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm transition-all"
            >
                <PieChartIcon size={18} /> Relatório Estratégico
            </button>

            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

            {hasConfidentialAccess && (
              <button 
                onClick={() => setShowConfidential(!showConfidential)}
                className={`p-2 rounded-xl transition-all border flex items-center gap-2 text-sm font-bold ${showConfidential ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400'}`}
              >
                {showConfidential ? <Unlock size={18} /> : <Lock size={18} />}
                <span className="hidden sm:inline">{showConfidential ? "Sigilo Aberto" : "Ativar Sigilo"}</span>
              </button>
            )}

            <select className="bg-slate-50 border-none rounded-xl text-sm p-2 outline-none font-bold" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}>
              <option value="">Todos Setores</option>
              {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select className="bg-slate-50 border-none rounded-xl text-sm p-2 outline-none font-bold" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}>
              <option value="">Todas Unidades</option>
              {settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-2">
                <input type="date" className="bg-transparent border-none text-xs p-2 outline-none font-bold" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-slate-300">-</span>
                <input type="date" className="bg-transparent border-none text-xs p-2 outline-none font-bold" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
        </div>
      </div>

      {/* KPI Cards - GRID OTIMIZADO PARA NÃO QUEBRAR TEXTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard title="Abertas" value={kpis.open} icon={<Briefcase size={20} />} color="text-blue-600 bg-blue-50 border-blue-100" />
        <KPICard title="Fechadas" value={kpis.closed} icon={<CheckCircle size={20} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
        <KPICard title="Congeladas" value={kpis.frozen} icon={<Clock size={20} />} color="text-amber-600 bg-amber-50 border-amber-100" />
        <KPICard title="Canceladas" value={kpis.canceled} icon={<XCircle size={20} />} color="text-red-600 bg-red-50 border-red-100" />
        <KPICard title="Candidatos" value={kpis.totalCandidates} icon={<Users size={20} />} color="text-slate-700 bg-slate-50 border-slate-200" />
        <KPICard title="Em Teste" value={kpis.inTest} icon={<AlertCircle size={20} />} color="text-indigo-600 bg-indigo-50 border-indigo-100" />
        <KPICard title="Aprovados" value={kpis.approved} icon={<CheckCircle size={20} />} color="text-green-700 bg-green-50 border-green-100" />
        <KPICard title="Rec. Interno" value={kpis.internalRecruitment} icon={<Building2 size={20} />} color="text-purple-700 bg-purple-50 border-purple-100" />
      </div>

      {/* Seção Central: Classificação + Gráfico de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Classificação de Aberturas (Interativo) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div className="mb-6">
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                    <TrendingUp size={22} className="text-indigo-600" /> Classificação
                </h2>
                <p className="text-sm text-slate-400 font-medium">Clique para detalhar as vagas</p>
            </div>

            <div className="space-y-4">
                <button 
                    onClick={() => setDrillDownType('Aumento de Quadro')}
                    className="w-full flex items-center gap-4 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 transition-all hover:shadow-md group active:scale-95"
                >
                    <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-indigo-200">
                        <TrendingUp size={24} />
                    </div>
                    <div className="text-left flex-1">
                        <span className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest block">Expansão</span>
                        <div className="text-2xl font-black text-indigo-900">{kpis.expansion}</div>
                        <p className="text-[10px] text-indigo-500 font-bold uppercase mt-1">Aumento de Quadro</p>
                    </div>
                    <ChevronRight className="text-indigo-300 group-hover:text-indigo-600 transition-colors" />
                </button>

                <button 
                    onClick={() => setDrillDownType('Substituição')}
                    className="w-full flex items-center gap-4 bg-rose-50/50 p-5 rounded-2xl border border-rose-100 transition-all hover:shadow-md group active:scale-95"
                >
                    <div className="bg-rose-500 p-3 rounded-xl text-white shadow-lg shadow-rose-200">
                        <UserMinus size={24} />
                    </div>
                    <div className="text-left flex-1">
                        <span className="text-[10px] font-black text-rose-900/40 uppercase tracking-widest block">Reposição</span>
                        <div className="text-2xl font-black text-rose-900">{kpis.replacement}</div>
                        <p className="text-[10px] text-rose-500 font-bold uppercase mt-1">Substituição</p>
                    </div>
                    <ChevronRight className="text-rose-300 group-hover:text-rose-600 transition-colors" />
                </button>
            </div>
        </div>

        {/* Gráfico de Barras: Status Geral */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Status Geral das Vagas</h3>
            <div className="h-64 w-full" style={{ minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} dy={10} />
                        <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}} 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                        />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={50}>
                            {statusChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Tabela de Candidatos Ativos */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter">
                    <Users size={20} className="text-blue-600"/> Candidatos Ativos
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Foco em processos seletivos abertos</p>
              </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Candidato</th>
                  <th className="px-6 py-4">Vaga</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fCandidates.filter(c => {
                  const job = fJobs.find(j => j.id === c.jobId);
                  return (job && job.status === 'Aberta' && !['Reprovado', 'Desistência', 'Contratado'].includes(c.status));
                }).slice(0, 10).map(c => {
                  const job = fJobs.find(j => j.id === c.jobId);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                       <td className="px-6 py-4 font-black text-slate-700">{c.name}</td>
                       <td className="px-6 py-4 text-blue-600 font-bold">{job?.title}</td>
                       <td className="px-6 py-4">
                         <span className="bg-white text-slate-700 px-2 py-1 rounded-lg text-[10px] font-black border border-slate-200 shadow-sm uppercase">{c.status}</span>
                       </td>
                       <td className="px-6 py-4 text-slate-400 font-bold text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
      </div>

      {/* MODAL DE BRANCH (DRILL-DOWN) */}
      {drillDownType && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl text-white shadow-lg ${drillDownType === 'Substituição' ? 'bg-rose-500' : 'bg-indigo-600'}`}>
                            {drillDownType === 'Substituição' ? <UserMinus size={22} /> : <TrendingUp size={22} />}
                          </div>
                          <div>
                              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Vagas de {drillDownType}</h2>
                              <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Detalhamento operacional por vaga</p>
                          </div>
                      </div>
                      <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm">
                          <X size={24} />
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest">
                              <tr>
                                  <th className="p-4 rounded-l-xl">Vaga</th>
                                  <th className="p-4 text-center">Status</th>
                                  <th className="p-4 text-center">Unidade</th>
                                  <th className="p-4 text-right rounded-r-xl">Ação</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {drillDownJobs.map(vaga => (
                                  <tr key={vaga.id} className="hover:bg-slate-50 transition-colors">
                                      <td className="p-4 font-black text-slate-700 text-sm">{vaga.title}</td>
                                      <td className="p-4 text-center">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                                              vaga.status === 'Aberta' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                              vaga.status === 'Fechada' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-200'
                                          }`}>{vaga.status}</span>
                                      </td>
                                      <td className="p-4 text-center font-bold text-slate-500 uppercase">{vaga.unit}</td>
                                      <td className="p-4 text-right">
                                          <button 
                                            onClick={() => navigate(`/jobs/${vaga.id}`)}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 px-3 rounded-lg shadow-sm shadow-indigo-100 transition-all flex items-center gap-2 ml-auto font-black uppercase text-[10px]"
                                          >
                                              <ExternalLink size={14} /> Abrir Vaga
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                      {drillDownJobs.length === 0 && <p className="text-center py-12 text-slate-400 italic">Nenhuma vaga encontrada para esta categoria.</p>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// COMPONENTE KPICARD CORRIGIDO
const KPICard = ({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) => (
  <div className={`p-4 rounded-2xl border bg-white shadow-sm flex flex-col justify-between min-h-[110px] transition-all hover:shadow-md hover:-translate-y-1`}>
    <div className="flex justify-between items-start gap-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight">{title}</span>
      <div className={`p-1.5 rounded-lg shrink-0 ${color.split(' ')[1]}`}>{icon}</div>
    </div>
    <span className={`text-3xl font-black tracking-tighter ${color.split(' ')[0]}`}>{value}</span>
  </div>
);
