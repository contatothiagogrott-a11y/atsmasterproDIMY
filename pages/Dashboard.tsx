import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Briefcase, Users, CheckCircle, XCircle, Clock, AlertCircle, Building2, TrendingUp, UserMinus, Lock, Unlock, X } from 'lucide-react';
import { isWithinInterval, parseISO } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { jobs, candidates, settings, user } = useData();
  
  // Filters
  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Confidential Visibility
  const [showConfidential, setShowConfidential] = useState(false);

  // PERMISSION CHECK
  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some(j => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const filteredData = useMemo(() => {
    // SECURITY FILTER (ACL)
    let fJobs = jobs.filter(j => !j.isHidden);
    
    // Filter out jobs user doesn't have permission to see
    fJobs = fJobs.filter(j => {
        if (!j.isConfidential) return true;
        if (!user) return false;
        return user.role === 'MASTER' || j.createdBy === user.id || j.allowedUserIds?.includes(user.id);
    });

    // If "Show Confidential" toggle is OFF, filter them out visually (but they were accessible)
    if (!showConfidential) {
        fJobs = fJobs.filter(j => !j.isConfidential);
    }

    let fCandidates = candidates;

    if (sectorFilter) {
      fJobs = fJobs.filter(j => j.sector === sectorFilter);
    }
    if (unitFilter) {
      fJobs = fJobs.filter(j => j.unit === unitFilter);
    }
    if (startDate && endDate) {
      fJobs = fJobs.filter(j => isWithinInterval(parseISO(j.openedAt), { start: parseISO(startDate), end: parseISO(endDate) }));
    }

    // Filter candidates based on filtered jobs
    const jobIds = new Set(fJobs.map(j => j.id));
    fCandidates = fCandidates.filter(c => jobIds.has(c.jobId));

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

  const openingReasonData = [
    { name: 'Aumento de Quadro', value: kpis.expansion, color: '#6366f1' },
    { name: 'Substituição', value: kpis.replacement, color: '#f43f5e' }
  ];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return percent > 0 ? (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    ) : null;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
           <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
           <p className="text-slate-500 mt-1">Visão geral dos indicadores de recrutamento</p>
        </div>
        
        {/* Filters and Security Toggle */}
        <div className="flex flex-wrap gap-3 mt-4 md:mt-0 items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200">
           {/* Confidential Toggle - Only if access exists */}
           {hasConfidentialAccess && (
             <button 
               onClick={() => setShowConfidential(!showConfidential)}
               className={`p-2 rounded-lg transition-colors border flex items-center gap-2 text-sm font-bold ${showConfidential ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-300 text-slate-400'}`}
               title={showConfidential ? "Modo Sigiloso Ativo" : "Ativar Modo Sigiloso"}
             >
               {showConfidential ? <Unlock size={18} /> : <Lock size={18} />}
               <span className="hidden sm:inline">{showConfidential ? "Modo Aberto" : "Modo Seguro"}</span>
             </button>
           )}

           <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

           <select 
            className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
           >
             <option value="">Todos Setores</option>
             {settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
           </select>
           <select 
            className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none focus:ring-2 focus:ring-blue-500"
            value={unitFilter}
            onChange={e => setUnitFilter(e.target.value)}
           >
             <option value="">Todas Unidades</option>
             {settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
           </select>
           <input type="date" className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
           <input type="date" className="bg-slate-50 border-slate-200 rounded-lg text-sm p-2 outline-none" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <KPICard title="Abertas" value={kpis.open} icon={<Briefcase size={18} />} color="bg-blue-50 text-blue-600 border-blue-100" />
        <KPICard title="Fechadas" value={kpis.closed} icon={<CheckCircle size={18} />} color="bg-emerald-50 text-emerald-600 border-emerald-100" />
        <KPICard title="Congeladas" value={kpis.frozen} icon={<Clock size={18} />} color="bg-amber-50 text-amber-600 border-amber-100" />
        <KPICard title="Canceladas" value={kpis.canceled} icon={<XCircle size={18} />} color="bg-red-50 text-red-600 border-red-100" />
        
        <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4 md:border-l md:pl-4 border-slate-200">
            <KPICard title="Candidatos" value={kpis.totalCandidates} icon={<Users size={18} />} color="bg-white text-slate-700 border-slate-200" />
            <KPICard title="Em Teste" value={kpis.inTest} icon={<AlertCircle size={18} />} color="bg-indigo-50 text-indigo-600 border-indigo-100" />
            <KPICard title="Aprovados" value={kpis.approved} icon={<CheckCircle size={18} />} color="bg-green-50 text-green-700 border-green-100" />
            <KPICard title="Rec. Interno" value={kpis.internalRecruitment} icon={<Building2 size={18} />} color="bg-purple-50 text-purple-700 border-purple-100" />
        </div>
      </div>

      {/* Opening Classification Section */}
      <div className={`bg-white p-6 rounded-2xl border shadow-sm overflow-hidden transition-all ${showConfidential ? 'border-amber-300 ring-4 ring-amber-50' : 'border-slate-200'}`}>
        <div className="flex items-center justify-between mb-6">
           <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp size={22} className="text-indigo-600" /> Classificação de Aberturas {showConfidential && <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded ml-2">CONFIDENCIAL ATIVO</span>}
              </h2>
              <p className="text-sm text-slate-500">Distribuição de vagas por motivo de solicitação</p>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <div className="flex flex-col gap-4 justify-center">
              <div className="flex items-center gap-4 bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 transition-all hover:shadow-md">
                 <div className="bg-indigo-600 p-3 rounded-xl text-white">
                    <TrendingUp size={24} />
                 </div>
                 <div>
                    <span className="text-sm font-bold text-indigo-900/60 uppercase tracking-widest">Vagas de Expansão</span>
                    <div className="text-3xl font-black text-indigo-900">{kpis.expansion}</div>
                    <p className="text-[10px] text-indigo-500 font-bold mt-1 uppercase">Aumento de Quadro</p>
                 </div>
              </div>
              <div className="flex items-center gap-4 bg-rose-50/50 p-6 rounded-2xl border border-rose-100 transition-all hover:shadow-md">
                 <div className="bg-rose-500 p-3 rounded-xl text-white">
                    <UserMinus size={24} />
                 </div>
                 <div>
                    <span className="text-sm font-bold text-rose-900/60 uppercase tracking-widest">Vagas de Reposição</span>
                    <div className="text-3xl font-black text-rose-900">{kpis.replacement}</div>
                    <p className="text-[10px] text-rose-500 font-bold mt-1 uppercase">Substituição</p>
                 </div>
              </div>
           </div>

           <div className="lg:col-span-2 bg-slate-50 rounded-2xl p-4 flex items-center justify-center border border-slate-100">
              <div className="h-64 w-full" style={{ minHeight: '300px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={openingReasonData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      stroke="none"
                    >
                      {openingReasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Status */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Status Geral das Vagas</h3>
          <div className="h-64 w-full" style={{ minHeight: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Job List - ACTIVE CANDIDATES ONLY */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 lg:col-span-2 overflow-hidden flex flex-col">
          <div className="p-6 border-b border-slate-100">
             <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Users size={20} className="text-blue-600"/> Candidatos Ativos (Prioridade)
             </h3>
             <p className="text-xs text-slate-400 mt-1">Exibindo apenas candidatos em processos seletivos abertos e ativos.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Candidato</th>
                  <th className="px-6 py-4">Vaga Aberta</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Entrada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fCandidates.filter(c => {
                  const job = fJobs.find(j => j.id === c.jobId);
                  return (
                    job && 
                    job.status === 'Aberta' && 
                    !['Reprovado', 'Desistência', 'Contratado'].includes(c.status)
                  );
                }).slice(0, 10).map(c => {
                  const job = fJobs.find(j => j.id === c.jobId);
                  return (
                    <tr key={c.id} className="hover:bg-blue-50/50 transition-colors">
                       <td className="px-6 py-4 font-bold text-slate-700">{c.name}</td>
                       <td className="px-6 py-4 text-blue-600 font-medium">{job?.title}</td>
                       <td className="px-6 py-4">
                         <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md text-xs font-bold border border-slate-200">{c.status}</span>
                       </td>
                       <td className="px-6 py-4 text-slate-400 text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                    </tr>
                  )
                })}
                {fCandidates.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      Nenhum candidato ativo em vagas monitoradas no momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) => (
  <div className={`p-4 rounded-xl border ${color} flex flex-col justify-between h-28 shadow-sm transition-transform hover:-translate-y-1`}>
    <div className="flex justify-between items-start">
      <span className="text-xs font-bold uppercase tracking-wider opacity-90">{title}</span>
      <div className="opacity-80 p-1.5 bg-white/50 rounded-lg backdrop-blur-sm">{icon}</div>
    </div>
    <span className="text-4xl font-bold tracking-tight">{value}</span>
  </div>
);
