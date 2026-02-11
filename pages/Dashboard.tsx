import React, { useMemo, useState } from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { 
  Briefcase, Users, CheckCircle, XCircle, Clock, AlertCircle, 
  Building2, TrendingUp, UserMinus, Lock, Unlock, X, 
  PieChart as PieChartIcon, ChevronRight, ExternalLink, Target,
  Search, Beaker, AlertTriangle, CalendarDays, UserCheck
} from 'lucide-react';
import { isWithinInterval, parseISO, differenceInDays, isToday, isFuture, addDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Tipos para o DrillDown (Detalhes ao clicar)
type DrillDownType = 
  'Aumento de Quadro' | 'Substituição' | 
  'OPEN' | 'CLOSED' | 'FROZEN' | 'CANCELED' | 
  'TOTAL_CANDIDATES' | 'IN_TEST' | 'APPROVED' | 'INTERNAL_REC' | 
  'PENDING_CANDIDATES' | 'OLD_JOBS' | 'UPCOMING_ONBOARDINGS' | null;

export const Dashboard: React.FC = () => {
  const { jobs, candidates, settings, user } = useData();
  const navigate = useNavigate();
  
  // --- 1. CONFIGURAÇÃO DE DATAS PADRÃO (MÊS ATUAL) ---
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [sectorFilter, setSectorFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [startDate, setStartDate] = useState(firstDay.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  
  const [showConfidential, setShowConfidential] = useState(false);
  const [drillDownType, setDrillDownType] = useState<DrillDownType>(null);

  const hasConfidentialAccess = useMemo(() => {
    if (!user) return false;
    if (user.role === 'MASTER') return true;
    return jobs.some(j => j.isConfidential && (j.createdBy === user.id || j.allowedUserIds?.includes(user.id)));
  }, [jobs, user]);

  const filteredData = useMemo(() => {
    let fJobs = jobs.filter(j => !j.isHidden);
    
    // Filtro de Confidencialidade
    fJobs = fJobs.filter(j => {
        if (!j.isConfidential) return true;
        if (!user) return false;
        return user.role === 'MASTER' || j.createdBy === user.id || j.allowedUserIds?.includes(user.id);
    });
    if (!showConfidential) fJobs = fJobs.filter(j => !j.isConfidential);

    // Filtros de Setor e Unidade
    if (sectorFilter) fJobs = fJobs.filter(j => j.sector === sectorFilter);
    if (unitFilter) fJobs = fJobs.filter(j => j.unit === unitFilter);

    // Filtro de Data (Aplica nas vagas)
    if (startDate && endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      
      fJobs = fJobs.filter(j => {
         const opened = new Date(j.openedAt);
         return opened >= new Date(startDate) && opened <= endDateTime;
      });
    }

    const jobIds = new Set(fJobs.map(j => j.id));
    const fCandidates = candidates.filter(c => jobIds.has(c.jobId));
    
    return { fJobs, fCandidates };
  }, [jobs, candidates, sectorFilter, unitFilter, startDate, endDate, showConfidential, user]);

  const { fJobs, fCandidates } = filteredData;

  // --- 2. NOVAS LÓGICAS DE ALERTA ---

  // 2.1. Candidatos Pendentes de Ação (Em andamento, mas faltando info)
  const pendingCandidates = useMemo(() => {
      return fCandidates.filter(c => {
          // Não olha para reprovados, desistentes ou contratados
          if (['Reprovado', 'Desistência', 'Contratado'].includes(c.status)) return false;
          
          // REGRA 1: Se está Aguardando Triagem, já é pendente de ação do recrutador automaticamente
          if (c.status === 'Aguardando Triagem') return true;
          
          // REGRA 2: Está em Teste, mas não tem o resultado/teste marcado como realizado
          const needsTestResult = c.status === 'Em Teste' && !c.techTest;
          
          // REGRA 3: Não teve nenhum registro de interação/contato
          const noInteraction = !c.lastInteractionAt;
          
          // REGRA 4: Está em Análise, mas a entrevista não foi agendada
          const noInterviewScheduled = c.status === 'Em Análise' && !c.interviewAt;

          return needsTestResult || noInteraction || noInterviewScheduled;
      });
  }, [fCandidates]);

  // 2.2. Vagas Antigas (Abertas há mais de 30 dias)
  const oldOpenJobs = useMemo(() => {
      const thirtyDaysAgo = addDays(today, -30);
      return fJobs.filter(j => {
          return j.status === 'Aberta' && new Date(j.openedAt) < thirtyDaysAgo;
      });
  }, [fJobs, today]);

  // 2.3. Integrações Próximas (Start date nos próximos 7 dias)
  const upcomingOnboardings = useMemo(() => {
      const nextWeek = addDays(today, 7);
      return candidates.filter(c => {
          if (c.status !== 'Contratado' || !c.timeline?.startDate) return false;
          const startDate = parseISO(c.timeline.startDate);
          return (isToday(startDate) || isFuture(startDate)) && startDate <= nextWeek;
      });
  }, [candidates, today]);


  // --- 3. CÁLCULO DOS KPIS ORIGINAIS ---
  const kpis = {
    open: fJobs.filter(j => j.status === 'Aberta').length,
    closed: fJobs.filter(j => j.status === 'Fechada').length,
    frozen: fJobs.filter(j => j.status === 'Congelada').length,
    canceled: fJobs.filter(j => j.status === 'Cancelada').length,
    totalCandidates: fCandidates.length,
    inTest: fCandidates.filter(c => c.status === 'Em Teste').length,
    approved: fCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length,
    internalRecruitment: fCandidates.filter(c => c.origin === 'Recrutamento Interno' && ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status)).length,
    expansion: fJobs.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === 'Aumento de Quadro').length,
    replacement: fJobs.filter(j => j.openingDetails?.reason === 'Substituição').length
  };

  const statusChartData = [
    { name: 'Aberta', value: kpis.open, color: '#3b82f6' },
    { name: 'Fechada', value: kpis.closed, color: '#10b981' },
    { name: 'Congelada', value: kpis.frozen, color: '#f59e0b' },
    { name: 'Cancelada', value: kpis.canceled, color: '#ef4444' },
  ];

  // --- HELPER PARA O CONTEÚDO DO MODAL ---
  const getDrillDownContent = () => {
      // 1. LISTA DE VAGAS
      if (['OPEN', 'CLOSED', 'FROZEN', 'CANCELED', 'Aumento de Quadro', 'Substituição', 'OLD_JOBS'].includes(drillDownType as string)) {
          let targetJobs = fJobs;
          if (drillDownType === 'OPEN') targetJobs = fJobs.filter(j => j.status === 'Aberta');
          if (drillDownType === 'CLOSED') targetJobs = fJobs.filter(j => j.status === 'Fechada');
          if (drillDownType === 'FROZEN') targetJobs = fJobs.filter(j => j.status === 'Congelada');
          if (drillDownType === 'CANCELED') targetJobs = fJobs.filter(j => j.status === 'Cancelada');
          if (drillDownType === 'Aumento de Quadro') targetJobs = fJobs.filter(j => (j.openingDetails?.reason || 'Aumento de Quadro') === 'Aumento de Quadro');
          if (drillDownType === 'Substituição') targetJobs = fJobs.filter(j => j.openingDetails?.reason === 'Substituição');
          if (drillDownType === 'OLD_JOBS') targetJobs = oldOpenJobs;

          return (
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                        <th className="p-4 rounded-l-xl">Vaga</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4 text-center">Abertura</th>
                        <th className="p-4 text-center">Unidade</th>
                        <th className="p-4 text-right rounded-r-xl">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {targetJobs.map(j => (
                        <tr key={j.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-black text-slate-700">{j.title}</td>
                            <td className="p-4 text-center"><span className={`px-2 py-1 rounded font-bold text-[10px] uppercase ${j.status === 'Aberta' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>{j.status}</span></td>
                            <td className="p-4 text-center text-slate-500">{new Date(j.openedAt).toLocaleDateString()}</td>
                            <td className="p-4 text-center text-slate-500">{j.unit}</td>
                            <td className="p-4 text-right"><button onClick={() => navigate(`/jobs/${j.id}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1"><ExternalLink size={14}/> Abrir</button></td>
                        </tr>
                    ))}
                    {targetJobs.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhum registro.</td></tr>}
                </tbody>
            </table>
          );
      }

      // 2. LISTA DE CANDIDATOS
      if (['TOTAL_CANDIDATES', 'IN_TEST', 'APPROVED', 'INTERNAL_REC', 'PENDING_CANDIDATES', 'UPCOMING_ONBOARDINGS'].includes(drillDownType as string)) {
          let targetCandidates = fCandidates;
          if (drillDownType === 'IN_TEST') targetCandidates = fCandidates.filter(c => c.status === 'Em Teste');
          if (drillDownType === 'APPROVED') targetCandidates = fCandidates.filter(c => ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status));
          if (drillDownType === 'INTERNAL_REC') targetCandidates = fCandidates.filter(c => c.origin === 'Recrutamento Interno' && ['Aprovado', 'Proposta Aceita', 'Contratado'].includes(c.status));
          if (drillDownType === 'PENDING_CANDIDATES') targetCandidates = pendingCandidates;
          if (drillDownType === 'UPCOMING_ONBOARDINGS') targetCandidates = upcomingOnboardings;

          return (
            <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                    <tr>
                        <th className="p-4 rounded-l-xl">Candidato</th>
                        <th className="p-4">Vaga</th>
                        <th className="p-4 text-center">Status</th>
                        {drillDownType === 'UPCOMING_ONBOARDINGS' && <th className="p-4 text-center text-emerald-600">Data Início</th>}
                        <th className="p-4 text-right rounded-r-xl">Ação</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {targetCandidates.map(c => {
                        const job = jobs.find(j => j.id === c.jobId);
                        return (
                            <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-black text-slate-700">{c.name}</td>
                                <td className="p-4 text-slate-600">{job?.title || 'Vaga N/I'}</td>
                                <td className="p-4 text-center"><span className="px-2 py-1 rounded bg-blue-50 text-blue-700 font-bold text-[10px] uppercase">{c.status}</span></td>
                                {drillDownType === 'UPCOMING_ONBOARDINGS' && (
                                    <td className="p-4 text-center font-bold text-emerald-600">
                                        {c.timeline?.startDate ? new Date(c.timeline.startDate).toLocaleDateString() : '-'}
                                    </td>
                                )}
                                <td className="p-4 text-right"><button onClick={() => navigate(`/jobs/${c.jobId}`)} className="text-indigo-600 font-bold hover:underline flex items-center justify-end gap-1"><Target size={14}/> Ver Vaga</button></td>
                            </tr>
                        );
                    })}
                    {targetCandidates.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Nenhum registro.</td></tr>}
                </tbody>
            </table>
          );
      }
      return null;
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header e Filtros */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Dashboard</h1>
            <p className="text-slate-500 font-medium italic">Visão Operacional Diária</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
            <button onClick={() => navigate('/strategic-report')} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm transition-all active:scale-95">
                <PieChartIcon size={18} /> Relatório Estratégico
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>
            {hasConfidentialAccess && (
              <button onClick={() => setShowConfidential(!showConfidential)} className={`p-2 rounded-xl transition-all border flex items-center gap-2 text-sm font-bold ${showConfidential ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                {showConfidential ? <Unlock size={18} /> : <Lock size={18} />} <span className="hidden sm:inline">{showConfidential ? "Sigilo Aberto" : "Ativar Sigilo"}</span>
              </button>
            )}
            <select className="bg-slate-50 border-none rounded-xl text-sm p-2 font-bold outline-none cursor-pointer" value={sectorFilter} onChange={e => setSectorFilter(e.target.value)}><option value="">Todos Setores</option>{settings.filter(s => s.type === 'SECTOR').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
            <select className="bg-slate-50 border-none rounded-xl text-sm p-2 font-bold outline-none cursor-pointer" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">Todas Unidades</option>{settings.filter(s => s.type === 'UNIT').map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
            <div className="flex items-center gap-1 bg-slate-50 rounded-xl px-2">
                <input type="date" className="bg-transparent border-none text-xs p-2 outline-none font-bold" value={startDate} onChange={e => setStartDate(e.target.value)} />
                <span className="text-slate-300">-</span>
                <input type="date" className="bg-transparent border-none text-xs p-2 outline-none font-bold" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
        </div>
      </div>

      {/* --- SEÇÃO DE ALERTAS PRIORITÁRIOS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div 
             onClick={() => setDrillDownType('PENDING_CANDIDATES')} 
             className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-4 cursor-pointer hover:shadow-md transition-all active:scale-95 group"
          >
              <div className="bg-amber-500 p-3 rounded-xl text-white shadow-sm group-hover:scale-110 transition-transform"><UserCheck size={24}/></div>
              <div>
                  <h4 className="font-black text-amber-900 uppercase tracking-tight text-sm">Candidatos Pendentes</h4>
                  <div className="text-2xl font-black text-amber-700">{pendingCandidates.length}</div>
                  <p className="text-[10px] text-amber-600/80 font-bold uppercase mt-1">Faltam feedbacks ou testes</p>
              </div>
          </div>

          <div 
             onClick={() => setDrillDownType('OLD_JOBS')} 
             className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-4 cursor-pointer hover:shadow-md transition-all active:scale-95 group"
          >
              <div className="bg-red-500 p-3 rounded-xl text-white shadow-sm group-hover:scale-110 transition-transform"><AlertTriangle size={24}/></div>
              <div>
                  <h4 className="font-black text-red-900 uppercase tracking-tight text-sm">Vagas em Atraso</h4>
                  <div className="text-2xl font-black text-red-700">{oldOpenJobs.length}</div>
                  <p className="text-[10px] text-red-600/80 font-bold uppercase mt-1">Abertas há mais de 30 dias</p>
              </div>
          </div>

          <div 
             onClick={() => setDrillDownType('UPCOMING_ONBOARDINGS')} 
             className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-start gap-4 cursor-pointer hover:shadow-md transition-all active:scale-95 group"
          >
              <div className="bg-emerald-500 p-3 rounded-xl text-white shadow-sm group-hover:scale-110 transition-transform"><CalendarDays size={24}/></div>
              <div>
                  <h4 className="font-black text-emerald-900 uppercase tracking-tight text-sm">Próximas Integrações</h4>
                  <div className="text-2xl font-black text-emerald-700">{upcomingOnboardings.length}</div>
                  <p className="text-[10px] text-emerald-600/80 font-bold uppercase mt-1">Contratações nos próx. 7 dias</p>
              </div>
          </div>
      </div>

      {/* --- KPI Cards CLICÁVEIS --- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <KPICard title="Abertas" value={kpis.open} color="text-blue-600" bgIcon={Briefcase} onClick={() => setDrillDownType('OPEN')} />
        <KPICard title="Fechadas" value={kpis.closed} color="text-emerald-600" bgIcon={CheckCircle} onClick={() => setDrillDownType('CLOSED')} />
        <KPICard title="Congeladas" value={kpis.frozen} color="text-amber-600" bgIcon={Clock} onClick={() => setDrillDownType('FROZEN')} />
        <KPICard title="Canceladas" value={kpis.canceled} color="text-red-600" bgIcon={XCircle} onClick={() => setDrillDownType('CANCELED')} />
        
        <KPICard title="Candidatos" value={kpis.totalCandidates} color="text-slate-700" bgIcon={Users} onClick={() => setDrillDownType('TOTAL_CANDIDATES')} />
        <KPICard title="Em Teste" value={kpis.inTest} color="text-indigo-600" bgIcon={Beaker} onClick={() => setDrillDownType('IN_TEST')} />
        <KPICard title="Aprovados" value={kpis.approved} color="text-green-700" bgIcon={Target} onClick={() => setDrillDownType('APPROVED')} />
        <KPICard title="Rec. Interno" value={kpis.internalRecruitment} color="text-purple-700" bgIcon={Building2} onClick={() => setDrillDownType('INTERNAL_REC')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seção de Classificação com Drill-down */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 uppercase tracking-tighter mb-8">
                <TrendingUp size={22} className="text-indigo-600" /> Classificação
            </h2>
            <div className="space-y-4">
                <button onClick={() => setDrillDownType('Aumento de Quadro')} className="w-full flex items-center gap-4 bg-indigo-50/50 p-5 rounded-2xl border border-indigo-100 transition-all hover:shadow-md group active:scale-95">
                    <div className="bg-indigo-600 p-3 rounded-xl text-white shadow-lg shadow-indigo-200"><TrendingUp size={24} /></div>
                    <div className="text-left flex-1">
                        <span className="text-[10px] font-black text-indigo-900/40 uppercase tracking-widest block">Expansão</span>
                        <div className="text-2xl font-black text-indigo-900">{kpis.expansion}</div>
                        <p className="text-[10px] text-indigo-500 font-bold uppercase">Aumento de Quadro</p>
                    </div>
                    <ChevronRight className="text-indigo-300 group-hover:text-indigo-600" />
                </button>
                <button onClick={() => setDrillDownType('Substituição')} className="w-full flex items-center gap-4 bg-rose-50/50 p-5 rounded-2xl border border-rose-100 transition-all hover:shadow-md group active:scale-95">
                    <div className="bg-rose-500 p-3 rounded-xl text-white shadow-lg shadow-rose-200"><UserMinus size={24} /></div>
                    <div className="text-left flex-1">
                        <span className="text-[10px] font-black text-rose-900/40 uppercase tracking-widest block">Reposição</span>
                        <div className="text-2xl font-black text-rose-900">{kpis.replacement}</div>
                        <p className="text-[10px] text-rose-500 font-bold uppercase">Substituição</p>
                    </div>
                    <ChevronRight className="text-rose-300 group-hover:text-rose-600" />
                </button>
            </div>
        </div>

        {/* Gráfico de Barras Principal */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-2 overflow-hidden">
            <h3 className="text-xl font-black text-slate-800 mb-6 uppercase tracking-tighter">Status Geral das Vagas</h3>
            <div className="h-64 w-full" style={{ minHeight: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} dy={10} />
                        <YAxis allowDecimals={false} fontSize={12} stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={50}>{statusChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}</Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* --- 4. MODAL DE DRILL-DOWN (DETALHES) --- */}
      {drillDownType && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4 animate-fadeIn">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-white/20">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <div className="flex items-center gap-3">
                          <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Search size={22} /></div>
                          <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                                {drillDownType === 'PENDING_CANDIDATES' ? 'Candidatos Pendentes' :
                                 drillDownType === 'OLD_JOBS' ? 'Vagas em Atraso (> 30 dias)' :
                                 drillDownType === 'UPCOMING_ONBOARDINGS' ? 'Próximas Integrações' : 
                                 `Detalhes: ${drillDownType}`}
                            </h2>
                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">Registros encontrados</p>
                          </div>
                      </div>
                      <button onClick={() => setDrillDownType(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm"><X size={24} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                      {getDrillDownContent()}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

// Componente de Card Operacional (KPI) com suporte a onClick
const KPICard = ({ title, value, color, bgIcon: BgIcon, onClick }: any) => (
  <div 
    onClick={onClick}
    className={`relative p-5 rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between min-h-[115px] overflow-hidden group transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer`}
  >
    {/* Ícone Decorativo */}
    <div className={`absolute -right-4 -bottom-4 opacity-[0.12] group-hover:opacity-[0.20] transition-all duration-300 pointer-events-none z-0 ${color}`}>
        <BgIcon size={95} strokeWidth={1.5} />
    </div>
    
    <div className="relative z-10">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-tight block mb-1">
        {title}
      </span>
    </div>
    <div className="relative z-10">
        <span className={`text-4xl font-black tracking-tighter ${color}`}>
          {value}
        </span>
    </div>
  </div>
);
